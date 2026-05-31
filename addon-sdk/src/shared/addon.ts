import { AddonRequest } from "./request";
import { AddonResponse } from "./response";
import { RequestHandler, AddonMiddleware } from "./handler";
import { ValidationException, IllegalArgumentException } from "./errors";

function isValidManifestPath(path: string): boolean {
  return (
    !!path &&
    path.length > 0 &&
    path.startsWith("/") &&
    !path.endsWith("/")
  );
}

function trimTrailingSlash(path: string): string {
  if (path && path.length > 0 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

export abstract class Addon<M> {
  static readonly PATH_MANIFEST = "/manifest";
  static readonly HTTP_GET = "GET";
  static readonly HTTP_POST = "POST";

  protected readonly manifest: M;
  private readonly requestHandlers = new Map<string, RequestHandler>();
  private readonly middlewares: AddonMiddleware[] = [];

  constructor(manifest: M, manifestPath: string = Addon.PATH_MANIFEST) {
    this.manifest = manifest;

    this.registerHandler(manifestPath, Addon.HTTP_GET, () => {
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: this.manifest as any,
      };
    });
  }

  getManifest(): M {
    return this.manifest;
  }

  registerHandler(path: string, method: string, handler: RequestHandler): void {
    if (!isValidManifestPath(path)) {
      throw new ValidationException(
        "Url should be an absolute path and not end with a slash."
      );
    }

    const key = `${method.toUpperCase()}:${path}`;

    if (this.requestHandlers.has(key)) {
      throw new IllegalArgumentException("Handler has already been registered.");
    }

    this.requestHandlers.set(key, handler);
  }

  getRegisteredRequests(): Array<{ path: string; method: string }> {
    const list: Array<{ path: string; method: string }> = [];
    for (const key of this.requestHandlers.keys()) {
      const sep = key.indexOf(":");
      const method = key.slice(0, sep);
      const path = key.slice(sep + 1);
      list.push({ path, method });
    }
    return list;
  }

  use(middleware: AddonMiddleware): void {
    this.middlewares.push(middleware);
  }

  async handle(request: AddonRequest): Promise<AddonResponse> {
    try {
      const path = trimTrailingSlash(request.path);
      const method = request.method.toUpperCase();
      const key = `${method}:${path}`;

      const handler = this.requestHandlers.get(key);
      if (handler) {
        // Run filter chain
        const dispatch = async (i: number, req: AddonRequest): Promise<AddonResponse> => {
          if (i < this.middlewares.length) {
            const mw = this.middlewares[i];
            return await mw(req, (nextReq) => dispatch(i + 1, nextReq));
          }
          return await handler(req);
        };
        return await dispatch(0, request);
      }

      return {
        status: 405,
        body: "Method Not Allowed",
      };
    } catch (e) {
      console.error(e);
      return {
        status: 500,
        body: "Internal Server Error",
      };
    }
  }
}
