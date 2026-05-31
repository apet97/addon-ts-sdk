import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { Addon } from "../shared/addon";
import { AddonRequest } from "../shared/request";
import { AddonResponse, isJsonBody } from "../shared/response";

async function readBody(req: IncomingMessage): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err) => reject(err));
  });
}

export async function fromNodeRequest(req: IncomingMessage): Promise<AddonRequest> {
  const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
  const rawBody = await readBody(req);
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

export function createNodeHttpAddonServer(addon: Addon<unknown>) {
  return createServer(async (req, res) => {
    try {
      const addonRequest = await fromNodeRequest(req);
      const addonResponse = await addon.handle(addonRequest);
      writeNodeResponse(res, addonResponse);
    } catch (e) {
      console.error(e);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });
}
