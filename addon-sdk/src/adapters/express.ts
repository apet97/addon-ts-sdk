import { Addon, AddonErrorReporter, reportAddonError } from "../shared/addon";
import { AddonRequest } from "../shared/request";
import { AddonResponse, isJsonBody } from "../shared/response";
import { InvalidRequestTargetError, parseHttpRequestTarget } from "./request-target";

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

function queryParamsFromExpressRequest(req: ExpressLikeRequest, requestUrl: URL): URLSearchParams {
  if (req.query !== undefined) {
    const queryParams = new URLSearchParams();
    for (const [key, val] of Object.entries(req.query)) {
      if (Array.isArray(val)) {
        val.forEach((v) => queryParams.append(key, String(v)));
      } else if (val !== undefined && val !== null) {
        queryParams.append(key, String(val));
      }
    }
    return queryParams;
  }

  return requestUrl.searchParams;
}

/**
 * Unlike the Fetch and Node adapters, this handler enforces no body-size limit itself — it trusts
 * `req.body`/`req.rawBody` exactly as Express (or an upstream middleware) already produced them.
 * The host application must configure a limit before this handler runs, e.g.
 * `app.use(express.json({ limit: "1mb" }))`. Without one, a request body is unbounded.
 */
export function createExpressAddonHandler(
  addon: Addon<unknown>,
  options: { readonly onError?: AddonErrorReporter } = {},
) {
  return async function clockifyAddonExpressHandler(
    req: ExpressLikeRequest,
    res: ExpressLikeResponse,
    next?: ExpressLikeNextFunction,
  ) {
    try {
      const requestUrl = parseHttpRequestTarget(req.url);
      const queryParams = queryParamsFromExpressRequest(req, requestUrl);

      const addonRequest: AddonRequest = {
        method: req.method || "GET",
        path: req.path || requestUrl.pathname,
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
      // A malformed request target is a client error, not a server fault —
      // matches the Node adapter's 400 for the same InvalidRequestTargetError,
      // and is not reported through onError (same as the Node adapter).
      if (e instanceof InvalidRequestTargetError) {
        res.status(400).send("Bad Request");
        return;
      }
      // addon.handle() already reports errors from inside the handler/middleware
      // chain through its own onError (set on the ClockifyAddon/Addon instance).
      // This covers what that path can't see: an error thrown before dispatch
      // or while writing the response.
      reportAddonError(options.onError, e, { source: "express-adapter" });
      if (next) {
        next(e);
      } else {
        res.status(500).send("Internal Server Error");
      }
    }
  };
}
