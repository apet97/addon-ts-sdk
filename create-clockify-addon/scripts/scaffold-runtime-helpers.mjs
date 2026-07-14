import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

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

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function processGroupExists(
  processGroupId,
  killProcessGroup = (pid, signal) => process.kill(pid, signal),
) {
  try {
    killProcessGroup(-processGroupId, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

async function waitForProcessGroupExit(processGroupId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (processGroupExists(processGroupId)) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return false;
    await sleep(Math.min(50, remainingMs));
  }
  return true;
}

/** Signal an explicitly captured process group, falling back to the direct child. */
export function signalProcessTree(
  child,
  signal,
  {
    platform = process.platform,
    processGroupId,
    killProcessGroup = (pid, sentSignal) => process.kill(pid, sentSignal),
    killWindowsTree = defaultKillWindowsTree,
  } = {},
) {
  const pid = child.pid;
  if (platform !== "win32" && isPositiveInteger(processGroupId)) {
    try {
      killProcessGroup(-processGroupId, signal);
      return true;
    } catch {
      // The captured process group may already be gone. Fall through only to
      // a direct child that is still known to be alive.
    }
  }

  if (childHasExited(child)) return false;
  if (platform === "win32" && isPositiveInteger(pid)) {
    try {
      killWindowsTree(pid, signal);
      return true;
    } catch {
      // taskkill may be unavailable. Fall through to the direct child.
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
    platform = process.platform,
    processGroupId,
    signalTree = signalProcessTree,
    waitForClose: wait = waitForClose,
    waitForProcessGroupExit: waitForGroup = waitForProcessGroupExit,
  } = {},
) {
  const hasProcessGroup =
    platform !== "win32" && isPositiveInteger(processGroupId);
  if (!hasProcessGroup && childHasExited(child)) return;

  const signalOptions = { platform, processGroupId };
  const waitForTreeExit = (timeoutMs) =>
    hasProcessGroup
      ? waitForGroup(processGroupId, timeoutMs)
      : wait(closed, timeoutMs);

  signalTree(child, "SIGTERM", signalOptions);
  if (await waitForTreeExit(graceMs)) return;

  signalTree(child, "SIGKILL", signalOptions);
  if (await waitForTreeExit(forceMs)) return;

  throw new Error(
    hasProcessGroup
      ? `Wrangler process group ${String(processGroupId)} did not exit after SIGKILL within ${forceMs}ms.`
      : `Wrangler process ${String(child.pid ?? "unknown")} did not exit after SIGKILL within ${forceMs}ms.`,
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
