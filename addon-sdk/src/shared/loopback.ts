export function isCanonicalLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** True for HTTPS, or HTTP restricted to a canonical loopback host (local dev). */
export function isHttpsOrLoopbackHttp(url: URL): boolean {
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" && isCanonicalLoopbackHostname(url.hostname))
  );
}
