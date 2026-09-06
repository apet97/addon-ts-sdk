import { spawn } from "node:child_process";
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

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processExists(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return !processExists(pid);
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
      processGroupId: 42,
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
      processGroupId: 42,
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

  it("continues detached POSIX group cleanup after the leader exits", async () => {
    if (!helpersExist) return;
    const { terminateChildProcessTree } = await loadHelpers();
    const child = { pid: 42, exitCode: 0, signalCode: null, kill: vi.fn(() => true) };
    const signals: Array<{ readonly signal: string; readonly processGroupId?: number }> = [];
    const waits: Array<{ readonly processGroupId: number; readonly timeoutMs: number }> = [];
    const waitResults = [false, true];

    await terminateChildProcessTree(child, Promise.resolve({ exitCode: 0, signal: null }), {
      platform: "linux",
      processGroupId: 42,
      graceMs: 10,
      forceMs: 20,
      signalTree: (
        _child: unknown,
        signal: string,
        options: { readonly processGroupId?: number },
      ) => signals.push({ signal, processGroupId: options.processGroupId }),
      waitForProcessGroupExit: async (processGroupId: number, timeoutMs: number) => {
        waits.push({ processGroupId, timeoutMs });
        return waitResults.shift() ?? false;
      },
    });

    expect(signals).toEqual([
      { signal: "SIGTERM", processGroupId: 42 },
      { signal: "SIGKILL", processGroupId: 42 },
    ]);
    expect(waits).toEqual([
      { processGroupId: 42, timeoutMs: 10 },
      { processGroupId: 42, timeoutMs: 20 },
    ]);
  });

  it("removes a detached POSIX descendant after its leader exits", async () => {
    if (!helpersExist || process.platform === "win32") return;
    const { createChildClosePromise, terminateChildProcessTree } = await loadHelpers();
    const descendantSource = `
process.on("SIGTERM", () => {});
process.send?.("ready");
setInterval(() => {}, 1_000);
`;
    const leaderSource = `
const { spawn } = require("node:child_process");
const descendant = spawn(process.execPath, ["-e", ${JSON.stringify(descendantSource)}], {
  stdio: ["ignore", "ignore", "ignore", "ipc"],
});
descendant.once("message", () => {
  process.stdout.write(String(descendant.pid));
  descendant.disconnect();
  descendant.unref();
});
`;
    const leader = spawn(process.execPath, ["-e", leaderSource], {
      detached: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const processGroupId = leader.pid;
    if (!Number.isInteger(processGroupId) || processGroupId <= 0) {
      throw new Error("Detached test leader did not receive a process id.");
    }
    let output = "";
    leader.stdout.setEncoding("utf8").on("data", (chunk) => {
      output += chunk;
    });
    const closed = createChildClosePromise(leader);
    let descendantPid;

    try {
      await closed;
      descendantPid = Number.parseInt(output, 10);
      if (!Number.isInteger(descendantPid) || descendantPid <= 0) {
        throw new Error(`Detached test leader did not report its descendant: ${output}`);
      }
      expect(processExists(descendantPid)).toBe(true);
      await terminateChildProcessTree(leader, closed, {
        processGroupId,
        graceMs: 50,
        forceMs: 1_000,
      });

      expect(processExists(-processGroupId)).toBe(false);
      expect(processExists(descendantPid)).toBe(false);
    } finally {
      if (processExists(-processGroupId)) {
        process.kill(-processGroupId, "SIGKILL");
        await waitForProcessExit(-processGroupId, 1_000);
      }
      if (Number.isInteger(descendantPid) && processExists(descendantPid)) {
        process.kill(descendantPid, "SIGKILL");
        await waitForProcessExit(descendantPid, 1_000);
      }
    }
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

  it("rejects manifest fields that only imitate array lengths", async () => {
    if (!helpersExist) return;
    const { parseWorkerManifest } = await loadHelpers();
    expect(() =>
      parseWorkerManifest(
        JSON.stringify({
          components: { length: 1 },
          lifecycle: { length: 0 },
          webhooks: { length: 0 },
        }),
        { name: "worker-minimal", features: "minimal" },
        "array-shape trace",
      ),
    ).toThrow(/worker-minimal[\s\S]*unexpected workerd manifest shape/u);
  });
});
