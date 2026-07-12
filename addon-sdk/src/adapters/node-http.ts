import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { Addon, AddonErrorReporter, reportAddonError } from "../shared/addon";
import { AddonRequest } from "../shared/request";
import { AddonResponse, isJsonBody } from "../shared/response";
import {
  BodyLimitOptions,
  InvalidContentLengthError,
  PayloadTooLargeError,
  isPayloadTooLargeError,
  parseContentLength,
  resolveMaxBodyBytes,
} from "./body-limit";

function contentLengthExceedsLimit(
  headers: IncomingMessage["headers"],
  maxBodyBytes: number,
): boolean {
  const value = headers["content-length"];
  const contentLength = Array.isArray(value) ? value[0] : value;
  return (parseContentLength(contentLength) ?? 0) > maxBodyBytes;
}

async function readBody(req: IncomingMessage, maxBodyBytes: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      if (tooLarge) return;
      const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      total += bytes.byteLength;
      if (total > maxBodyBytes) {
        tooLarge = true;
        reject(new PayloadTooLargeError(maxBodyBytes));
        return;
      }
      chunks.push(bytes);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err) => reject(err));
  });
}

export async function fromNodeRequest(
  req: IncomingMessage,
  options: BodyLimitOptions = {},
): Promise<AddonRequest> {
  const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
  const maxBodyBytes = resolveMaxBodyBytes(options);
  if (contentLengthExceedsLimit(req.headers, maxBodyBytes)) {
    throw new PayloadTooLargeError(maxBodyBytes);
  }
  const rawBody = await readBody(req, maxBodyBytes);
  let body: unknown = undefined;
  if (rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody.toString());
    } catch {
      body = rawBody.toString();
    }
  }

  return {
    method: req.method || "GET",
    path: url.pathname,
    headers: req.headers as Record<string, string | string[] | undefined>,
    query: url.searchParams,
    body,
    rawBody,
  };
}

export function writeNodeResponse(res: ServerResponse, addonResponse: AddonResponse): void {
  res.statusCode = addonResponse.status || 200;
  if (addonResponse.headers) {
    for (const [key, value] of Object.entries(addonResponse.headers)) {
      res.setHeader(key, value);
    }
  }

  if (addonResponse.body !== undefined && addonResponse.body !== null) {
    if (isJsonBody(addonResponse.body)) {
      if (!res.getHeader("content-type")) {
        res.setHeader("content-type", "application/json");
      }
      res.end(JSON.stringify(addonResponse.body));
    } else {
      res.end(addonResponse.body);
    }
  } else {
    res.end();
  }
}

export function createNodeHttpAddonServer(
  addon: Addon<unknown>,
  options: BodyLimitOptions & { readonly onError?: AddonErrorReporter } = {},
) {
  const maxBodyBytes = resolveMaxBodyBytes(options);

  return createServer(async (req, res) => {
    try {
      const addonRequest = await fromNodeRequest(req, { maxBodyBytes });
      const addonResponse = await addon.handle(addonRequest);
      writeNodeResponse(res, addonResponse);
    } catch (e) {
      if (e instanceof InvalidContentLengthError) {
        res.statusCode = 400;
        res.setHeader("connection", "close");
        res.end("Bad Request", () => {
          req.destroy();
        });
        return;
      }
      if (isPayloadTooLargeError(e)) {
        res.statusCode = 413;
        res.setHeader("connection", "close");
        res.end("Payload Too Large", () => {
          req.destroy();
        });
        return;
      }
      reportAddonError(options.onError, e, {
        source: "node-http-adapter",
        nativeRequest: req,
      });
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });
}
