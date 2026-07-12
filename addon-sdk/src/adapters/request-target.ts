export function parseHttpRequestTarget(requestTarget: string | undefined): URL {
  const target = requestTarget || "";
  return new URL(target.startsWith("/") ? `http://localhost${target}` : target, "http://localhost");
}
