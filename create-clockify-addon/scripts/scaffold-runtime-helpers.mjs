import { spawnSync } from "node:child_process";

function childHasExited(child) {
  return child.exitCode != null || child.signalCode != null;
}

function defaultKillWindowsTree(pid, signal) {
  const arguments_ = ["/pid", String(pid), "/t"];
  if (signal === "SIGKILL") arguments_.push("/f");
  const result = spawnSync("taskkill", arguments_, { stdio: "ignore" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`taskkill exited with status ${String(result.status)}.`);
  }
}

/** Capture the child close event before any asynchronous work can miss it. */
export function createChildClosePromise(child) {
  if (childHasExited(child)) {
    return Promise.resolve({
      exitCode: child.exitCode,
      signal: child.signalCode,
    });
  }
  return new Promise((resolve) => {
    child.once("close", (exitCode, signal) => resolve({ exitCode, signal }));
  });
}

/** Signal a detached process tree, falling back to the direct child. */
export function signalProcessTree(
  child,
  signal,
  {
    platform = process.platform,
    killProcessGroup = (pid, sentSignal) => process.kill(pid, sentSignal),
    killWindowsTree = defaultKillWindowsTree,
  } = {},
) {
  if (childHasExited(child)) return false;

  const pid = child.pid;
  if (Number.isInteger(pid) && pid > 0) {
    try {
      if (platform === "win32") {
        killWindowsTree(pid, signal);
      } else {
        killProcessGroup(-pid, signal);
      }
      return true;
    } catch {
      // The child may not own a process group on this platform. Fall through.
    }
  }

  if (childHasExited(child)) return false;
  return child.kill(signal);
}

function waitForClose(closed, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);
    closed.then(
      () => {
        clearTimeout(timeout);
        resolve(true);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

/** Terminate a child tree with bounded graceful and forced phases. */
export async function terminateChildProcessTree(
  child,
  closed,
  {
    graceMs = 5_000,
    forceMs = 5_000,
    signalTree = signalProcessTree,
    waitForClose: wait = waitForClose,
  } = {},
) {
  if (childHasExited(child)) return;

  signalTree(child, "SIGTERM");
  if (await wait(closed, graceMs)) return;

  signalTree(child, "SIGKILL");
  if (await wait(closed, forceMs)) return;

  throw new Error(
    `Wrangler process ${String(child.pid ?? "unknown")} did not exit after SIGKILL within ${forceMs}ms.`,
  );
}

function workerDiagnostics(variant, message, body, wranglerOutput) {
  return (
    `${variant.name}: ${message}\n` +
    `Body: ${body}\n` +
    `Wrangler output:\n${wranglerOutput || "(no output captured)"}`
  );
}

/** Parse and validate the manifest returned by a real Wrangler process. */
export function parseWorkerManifest(body, variant, wranglerOutput) {
  let manifest;
  try {
    manifest = JSON.parse(body);
  } catch (error) {
    throw new Error(
      workerDiagnostics(
        variant,
        "the /manifest response was not valid JSON.",
        body,
        wranglerOutput,
      ),
      { cause: error },
    );
  }

  const expectedLifecycle = variant.features === "all" ? 2 : 0;
  const expectedWebhooks = variant.features === "all" ? 1 : 0;
  if (
    !manifest ||
    typeof manifest !== "object" ||
    (manifest.components?.length ?? 0) !== 1 ||
    (manifest.lifecycle?.length ?? 0) !== expectedLifecycle ||
    (manifest.webhooks?.length ?? 0) !== expectedWebhooks
  ) {
    throw new Error(
      workerDiagnostics(
        variant,
        "unexpected workerd manifest shape.",
        body,
        wranglerOutput,
      ),
    );
  }

  return manifest;
}
