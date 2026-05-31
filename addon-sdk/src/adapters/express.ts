import type { Request, Response, NextFunction } from "express";
import { Addon } from "../shared/addon";
import { AddonRequest } from "../shared/request";
import { AddonResponse } from "../shared/response";

export function createExpressAddonHandler(addon: Addon<unknown>) {
  return async function clockifyAddonExpressHandler(
    req: Request,
    res: Response,
    next?: NextFunction,
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
        headers: req.headers as Record<string, string | string[] | undefined> || {},
        query: queryParams,
        body: req.body,
        rawBody: (req as any).rawBody,
      };

      const response: AddonResponse = await addon.handle(addonRequest);

      res.status(response.status || 200);
      if (response.headers) {
        res.set(response.headers);
      }

      if (response.body !== undefined && response.body !== null) {
        if (typeof response.body === "object" && !(response.body instanceof Uint8Array)) {
          res.json(response.body);
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

