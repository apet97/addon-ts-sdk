import { Addon } from "../shared/addon";
import { AddonRequest } from "../shared/request";
import { AddonResponse, isJsonBody } from "../shared/response";

export interface ExpressLikeRequest {
  method?: string;
  path?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  body?: unknown;
  rawBody?: Uint8Array;
}

export interface ExpressLikeResponse {
  status(code: number): this;
  set(headers: Record<string, string | readonly string[]>): this;
  json(body: unknown): unknown;
  send(body?: unknown): unknown;
  end(): unknown;
}

export type ExpressLikeNextFunction = (error?: unknown) => void;

export function createExpressAddonHandler(addon: Addon<unknown>) {
  return async function clockifyAddonExpressHandler(
    req: ExpressLikeRequest,
    res: ExpressLikeResponse,
    next?: ExpressLikeNextFunction,
  ) {
    try {
      const queryParams = new URLSearchParams();
      if (req.query) {
        for (const [key, val] of Object.entries(req.query)) {
          if (Array.isArray(val)) {
            val.forEach((v) => queryParams.append(key, String(v)));
          } else if (val !== undefined && val !== null) {
            queryParams.append(key, String(val));
          }
        }
      }

      const addonRequest: AddonRequest = {
        method: req.method || "GET",
        path: req.path || new URL(req.url || "", "http://localhost").pathname,
        headers: req.headers ?? {},
        query: queryParams,
        body: req.body,
        rawBody: req.rawBody,
      };

      const response: AddonResponse = await addon.handle(addonRequest);

      res.status(response.status || 200);
      if (response.headers) {
        res.set(response.headers);
      }

      if (response.body !== undefined && response.body !== null) {
        if (isJsonBody(response.body)) {
          res.json(response.body);
        } else if (response.body instanceof Uint8Array) {
          // express's res.send JSON-encodes a plain Uint8Array; wrap it so it ships as raw bytes.
          res.send(Buffer.from(response.body));
        } else {
          res.send(response.body);
        }
      } else {
        res.end();
      }
    } catch (e) {
      if (next) {
        next(e);
      } else {
        res.status(500).send("Internal Server Error");
      }
    }
  };
}
