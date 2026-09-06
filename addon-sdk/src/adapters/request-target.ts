/**
 * Raised when a Node request-target is not origin-form (`/path`). This adapter
 * dispatches registered paths and supports only origin-form request targets.
 */
export class InvalidRequestTargetError extends Error {
  constructor(readonly requestTarget: string) {
    super("Request target must be an origin-form path starting with '/'.");
    this.name = "InvalidRequestTargetError";
  }
}

export function parseHttpRequestTarget(requestTarget: string | undefined): URL {
  const target = requestTarget || "";
  // Do not let URL's relative-reference fallback repair an invalid target,
  // and reject network-path references that a proxy may interpret as a host.
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) {
    throw new InvalidRequestTargetError(target);
  }
  return new URL(`http://localhost${target}`);
}
