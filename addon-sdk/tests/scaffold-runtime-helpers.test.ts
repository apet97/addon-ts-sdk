import { EventEmitter } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const helpersUrl = new URL(
  "../../create-clockify-addon/scripts/scaffold-runtime-helpers.mjs",
  import.meta.url,
).href;
const helpersExist = existsSync(fileURLToPath(helpersUrl));
const verifierPath = fileURLToPath(
  new URL("../../create-clockify-addon/scripts/verify-scaffolds.mjs", import.meta.url),
);

async function loadHelpers() {
  return import(helpersUrl);
}

describe("scaffold runtime helpers", () => {
  it("provides the scaffold runtime helper module", () => {
    expect(helpersExist).toBe(true);
  });

  it("captures close synchronously so an immediate event is not missed", async () => {
    if (!helpersExist) return;
    const { createChildClosePromise } = await loadHelpers();
    const child = new EventEmitter();
    const closed = createChildClosePromise(child);

    child.emit("close", 7, "SIGTERM");

    await expect(closed).resolves.toEqual({ exitCode: 7, signal: "SIGTERM" });
  });

  it("captures close immediately after starting a detached POSIX child", () => {
    const verifier = readFileSync(verifierPath, "utf8");
    const spawn = verifier.indexOf("const child = spawn(");
    const closeCapture = verifier.indexOf("const closed = createChildClosePromise(child);");
    const outputCapture = verifier.indexOf("const readOutput = captureChildOutput(child);");

    expect(verifier).toContain('detached: process.platform !== "win32"');
    expect(spawn).toBeGreaterThanOrEqual(0);
    expect(closeCapture).toBeGreaterThan(spawn);
    expect(closeCapture).toBeLessThan(outputCapture);
  });

  it("signals a detached POSIX process group", async () => {
    if (!helpersExist) return;
    const { signalProcessTree } = await loadHelpers();
    const child = {
      pid: 42,
      exitCode: null,
      signalCode: null,
      kill: vi.fn(() => true),
    };
    const killProcessGroup = vi.fn();

    signalProcessTree(child, "SIGKILL", {
      platform: "darwin",
      killProcessGroup,
      killWindowsTree: vi.fn(),
    });

    expect(killProcessGroup).toHaveBeenCalledWith(-42, "SIGKILL");
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("falls back to direct child signaling when group signaling fails", async () => {
    if (!helpersExist) return;
    const { signalProcessTree } = await loadHelpers();
    const child = {
      pid: 42,
      exitCode: null,
      signalCode: null,
      kill: vi.fn(() => true),
    };

    signalProcessTree(child, "SIGTERM", {
      platform: "linux",
      killProcessGroup: vi.fn(() => {
        throw new Error("group unavailable");
      }),
      killWindowsTree: vi.fn(),
    });

    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("uses the Windows process-tree fallback", async () => {
    if (!helpersExist) return;
    const { signalProcessTree } = await loadHelpers();
    const child = {
      pid: 42,
      exitCode: null,
      signalCode: null,
      kill: vi.fn(() => true),
    };
    const killWindowsTree = vi.fn();

    signalProcessTree(child, "SIGKILL", {
      platform: "win32",
      killProcessGroup: vi.fn(),
      killWindowsTree,
    });

    expect(killWindowsTree).toHaveBeenCalledWith(42, "SIGKILL");
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("bounds both graceful and forced termination phases", async () => {
    if (!helpersExist) return;
    const { terminateChildProcessTree } = await loadHelpers();
    const child = { pid: 42, exitCode: null, signalCode: null, kill: vi.fn(() => true) };
    const signals: string[] = [];
    const timeouts: number[] = [];

    await expect(
      terminateChildProcessTree(child, new Promise(() => {}), {
        graceMs: 10,
        forceMs: 20,
        signalTree: (_child: unknown, signal: string) => signals.push(signal),
        waitForClose: async (_closed: Promise<unknown>, timeoutMs: number) => {
          timeouts.push(timeoutMs);
          return false;
        },
      }),
    ).rejects.toThrow(/did not exit after SIGKILL/u);
    expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(timeouts).toEqual([10, 20]);
  });

  it("includes response body and Wrangler output for invalid manifest JSON", async () => {
    if (!helpersExist) return;
    const { parseWorkerManifest } = await loadHelpers();

    expect(() =>
      parseWorkerManifest(
        "<html>broken</html>",
        { name: "worker-minimal", features: "minimal" },
        "wrangler trace",
      ),
    ).toThrow(
      /worker-minimal[\s\S]*Body: <html>broken<\/html>[\s\S]*Wrangler output:[\s\S]*wrangler trace/u,
    );
  });

  it("includes response body and Wrangler output for an unexpected manifest shape", async () => {
    if (!helpersExist) return;
    const { parseWorkerManifest } = await loadHelpers();
    const body = JSON.stringify({ components: [], lifecycle: [], webhooks: [] });

    expect(() =>
      parseWorkerManifest(body, { name: "worker-all", features: "all" }, "shape trace"),
    ).toThrow(/worker-all[\s\S]*Body:.*components[\s\S]*Wrangler output:[\s\S]*shape trace/u);
  });
});
