import { inspectRuntimeJavaScript } from "../../scripts/javascript-runtime-inspection.mjs";

/**
 * Fail when generated validator code imports runtime modules, invokes string
 * code generation, or retains AJV compiler machinery.
 */
export function assertStandaloneValidatorSafety(source: string): void {
  const findings = inspectRuntimeJavaScript(source, { forbidImports: true });
  if (findings.length === 0) return;

  const details = findings
    .map((finding) => `${finding.kind} at ${finding.line}:${finding.column + 1}`)
    .join(", ");
  throw new Error(`AJV standalone output is not self-contained: ${details}.`);
}
