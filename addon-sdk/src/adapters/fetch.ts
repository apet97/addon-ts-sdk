import { Addon } from "../shared/addon";
import { AddonRequest } from "../shared/request";
import { AddonResponse, isJsonBody } from "../shared/response";
import { BodyLimitOptions, PayloadTooLargeError, resolveMaxBodyBytes } from "./body-limit";

async function readFetchBody(request: Request, maxBodyBytes: number): Promise<Uint8Array> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > maxBodyBytes) {
    throw new PayloadTooLargeError(maxBodyBytes);
  }

  const clone = request.clone();
  if (!clone.body) return new Uint8Array();

  const reader = clone.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBodyBytes) {
      reader.cancel().catch(() => undefined);
      throw new PayloadTooLargeError(maxBodyBytes);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function handleFetchRequest(
  addon: Addon<unknown>,
  request: Request,
  options: BodyLimitOptions = {},
): Promise<Response> {
  const maxBodyBytes = resolveMaxBodyBytes(options);

  try {
    const url = new URL(request.url);

    let rawBody: Uint8Array | undefined = undefined;
    let body: unknown = undefined;

    // Clone or check request body presence
    if (request.body && request.method !== "GET" && request.method !== "HEAD") {
      try {
        rawBody = await readFetchBody(request, maxBodyBytes);
        if (rawBody.length > 0) {
          const text = new TextDecoder().decode(rawBody);
          try {
            body = JSON.parse(text);
          } catch {
            body = text;
          }
        }
      } catch (e) {
        if (e instanceof PayloadTooLargeError) {
          return new Response("Payload Too Large", { status: 413 });
        }
        return new Response("Bad Request", { status: 400 });
      }
    }

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const addonRequest: AddonRequest = {
      method: request.method,
      path: url.pathname,
      headers,
      query: url.searchParams,
      body,
      rawBody,
    };

    const response: AddonResponse = await addon.handle(addonRequest);

    const responseHeaders = new Headers();
    if (response.headers) {
      for (const [key, value] of Object.entries(response.headers)) {
        responseHeaders.set(key, value);
      }
    }

    let responseBody: any = null;
    if (response.body !== undefined && response.body !== null) {
      if (isJsonBody(response.body)) {
        if (!responseHeaders.has("content-type")) {
          responseHeaders.set("content-type", "application/json");
        }
        responseBody = JSON.stringify(response.body);
      } else {
        responseBody = response.body as any;
      }
    }

    return new Response(responseBody, {
      status: response.status || 200,
      headers: responseHeaders,
    });
  } catch (e) {
    console.error(e);
    return new Response("Internal Server Error", { status: 500 });
  }
}
