import { Addon } from "../shared/addon";
import { AddonRequest } from "../shared/request";
import { AddonResponse } from "../shared/response";

export async function handleFetchRequest(
  addon: Addon<unknown>,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);

  let rawBody: Uint8Array | undefined = undefined;
  let body: any = undefined;

  // Clone or check request body presence
  if (request.body && request.method !== "GET" && request.method !== "HEAD") {
    try {
      const arrayBuffer = await request.clone().arrayBuffer();
      rawBody = new Uint8Array(arrayBuffer);
      if (rawBody.length > 0) {
        const text = new TextDecoder().decode(rawBody);
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
    } catch (e) {
      console.warn("Failed to read fetch request body:", e);
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
    if (typeof response.body === "object" && !(response.body instanceof Uint8Array)) {
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
}
