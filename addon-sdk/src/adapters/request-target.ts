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

// Absolute-form ("scheme://host/path", valid request-target grammar for a
// proxy, not an origin server) is one shape that bypasses the prefix below
// entirely and lets the target dictate its own scheme and host.
const ABSOLUTE_FORM = /^[a-z][a-z\d+.-]*:\/\//i;

export function parseHttpRequestTarget(requestTarget: string | undefined): URL {
  const target = requestTarget || "";
  if (!target.startsWith("/") && ABSOLUTE_FORM.test(target)) {
    throw new InvalidRequestTargetError(target);
  }
  // A target starting with "//" is authority-form grammar ("//host/path"),
  // not origin-form. Prefixing it with "http://localhost" would still parse
  // to a literal, harmless path on this server, but a downstream proxy that
  // forwards the raw target could interpret "//host/path" as absolute with
  // host "host". Reject it outright rather than rely on every downstream
  // hop agreeing with this parser's interpretation.
  if (target.startsWith("//")) {
    throw new InvalidRequestTargetError(target);
  }
  return new URL(target.startsWith("/") ? `http://localhost${target}` : target, "http://localhost");
}
