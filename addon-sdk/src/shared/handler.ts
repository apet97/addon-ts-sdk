import { AddonRequest } from "./request";
import { AddonResponse } from "./response";

export type RequestHandler = (
  request: AddonRequest
) => AddonResponse | Promise<AddonResponse>;

export type AddonMiddleware = (
  request: AddonRequest,
  next: (req: AddonRequest) => Promise<AddonResponse>
) => AddonResponse | Promise<AddonResponse>;
