/** Strips the `[` `]` brackets WHATWG `URL.hostname` sometimes keeps around an IPv6 address. */
function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

export function isCanonicalLoopbackHostname(hostname: string): boolean {
  const normalized = stripIpv6Brackets(hostname);
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

/** True for HTTPS, or HTTP restricted to a canonical loopback host (local dev). */
export function isHttpsOrLoopbackHttp(url: URL): boolean {
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" && isCanonicalLoopbackHostname(url.hostname))
  );
}
