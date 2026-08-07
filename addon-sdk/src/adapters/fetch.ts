import { Addon, AddonErrorReporter, reportAddonError } from "../shared/addon";
import { AddonRequest } from "../shared/request";
import { AddonResponse, isJsonBody } from "../shared/response";
import {
  BodyLimitOptions,
  PayloadTooLargeError,
  parseContentLength,
  resolveMaxBodyBytes,
} from "./body-limit";

async function readFetchBody(request: Request, maxBodyBytes: number): Promise<Uint8Array> {
  // request.body is read exactly once here and never read again from the
  // original request, so cloning it first would only duplicate the stream.
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
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

function isHeaderValueArray(value: string | readonly string[]): value is readonly string[] {
  return Array.isArray(value);
}

export async function handleFetchRequest(
  addon: Addon<unknown>,
  request: Request,
  options: BodyLimitOptions & { readonly onError?: AddonErrorReporter } = {},
): Promise<Response> {
  const maxBodyBytes = resolveMaxBodyBytes(options);

  try {
    const url = new URL(request.url);

    let rawBody: Uint8Array | undefined = undefined;
    let body: unknown = undefined;

    try {
      const contentLength = request.headers.get("content-length");
      if ((parseContentLength(contentLength) ?? 0) > maxBodyBytes) {
        throw new PayloadTooLargeError(maxBodyBytes);
      }

      if (request.body && request.method !== "GET" && request.method !== "HEAD") {
        rawBody = await readFetchBody(request, maxBodyBytes);
        if (rawBody.length > 0) {
          const text = new TextDecoder().decode(rawBody);
          try {
            body = JSON.parse(text);
          } catch {
            body = text;
          }
        }
      }
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return new Response("Payload Too Large", { status: 413 });
      }
      return new Response("Bad Request", { status: 400 });
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
        if (isHeaderValueArray(value)) {
          for (const item of value) {
            responseHeaders.append(key, item);
          }
        } else {
          responseHeaders.set(key, value);
        }
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
    reportAddonError(options.onError, e, {
      source: "fetch-adapter",
      nativeRequest: request,
    });
    return new Response("Internal Server Error", { status: 500 });
  }
}
