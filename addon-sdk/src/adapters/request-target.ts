/**
 * Raised when a Node request-target is not origin-form (`/path`). An origin
 * server only ever receives origin-form; absolute-form and authority-form
 * are proxy-only per RFC 7230 and have no business reaching this adapter.
 */
export class InvalidRequestTargetError extends Error {
  constructor(readonly requestTarget: string) {
    super("Request target must be an origin-form path starting with '/'.");
    this.name = "InvalidRequestTargetError";
  }
}

// A target starting with a single "/" (including "//path", which some clients
// send) is always prefixed with "http://localhost" below, so it can never
// resolve to a foreign host — the "//" case stays a literal, harmless path.
// Absolute-form ("scheme://host/path", valid request-target grammar for a
// proxy, not an origin server) is the one shape that bypasses the prefix
// entirely and lets the target dictate its own scheme and host.
const ABSOLUTE_FORM = /^[a-z][a-z\d+.-]*:\/\//i;

export function parseHttpRequestTarget(requestTarget: string | undefined): URL {
  const target = requestTarget || "";
  if (!target.startsWith("/") && ABSOLUTE_FORM.test(target)) {
    throw new InvalidRequestTargetError(target);
  }
  return new URL(target.startsWith("/") ? `http://localhost${target}` : target, "http://localhost");
}
