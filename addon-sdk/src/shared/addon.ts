import { AddonRequest } from "./request";
import { AddonResponse } from "./response";
import { RequestHandler, AddonMiddleware } from "./handler";
import { ValidationException, IllegalArgumentException } from "./errors";

function isValidManifestPath(path: string): boolean {
  return !!path && path.length > 0 && path.startsWith("/") && !path.endsWith("/");
}

function trimTrailingSlash(path: string): string {
  if (path && path.length > 0 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

export type AddonErrorSource = "router" | "fetch-adapter" | "node-http-adapter";

export interface AddonErrorContext {
  readonly source: AddonErrorSource;
  readonly request?: AddonRequest;
  readonly nativeRequest?: unknown;
}

export type AddonErrorReporter = (error: unknown, context: AddonErrorContext) => void;

export interface AddonOptions {
  readonly onError?: AddonErrorReporter;
}

const REDACTED = "__redacted__";
const SENSITIVE_HEADER_NAMES = new Set([
  "x-addon-lifecycle-token",
  "x-addon-token",
  "clockify-signature",
  "authorization",
]);

function redactHeaders(headers: AddonRequest["headers"]): AddonRequest["headers"] {
  const redacted = { ...headers };
  for (const name of Object.keys(redacted)) {
    if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase())) redacted[name] = REDACTED;
  }
  return redacted;
}

function redactQuery(query: AddonRequest["query"]): AddonRequest["query"] {
  if (!query?.has("auth_token")) return query;
  const redacted = new URLSearchParams(query);
  redacted.set("auth_token", REDACTED);
  return redacted;
}

function redactBody(body: unknown): unknown {
  if (body === null || typeof body !== "object") return body;
  const redacted: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  if ("authToken" in redacted) redacted.authToken = REDACTED;
  if (Array.isArray(redacted.webhooks)) {
    redacted.webhooks = redacted.webhooks.map((webhook: unknown) =>
      webhook && typeof webhook === "object" ? { ...webhook, authToken: REDACTED } : webhook,
    );
  }
  return redacted;
}

/** Strips Clockify credentials from a request before an error reporter sees it. */
export function redactAddonRequest(request: AddonRequest): AddonRequest {
  return {
    ...request,
    headers: redactHeaders(request.headers),
    query: redactQuery(request.query),
    body: redactBody(request.body),
  };
}

export function reportAddonError(
  reporter: AddonErrorReporter | undefined,
  error: unknown,
  context: AddonErrorContext,
): void {
  try {
    const redacted = context.request
      ? { ...context, request: redactAddonRequest(context.request) }
      : context;
    reporter?.(error, redacted);
  } catch {
    // Error reporters must not change the response path.
  }
}

export abstract class Addon<M> {
  static readonly PATH_MANIFEST = "/manifest";
  static readonly HTTP_GET = "GET";
  static readonly HTTP_POST = "POST";

  protected readonly manifest: M;
  private readonly options: AddonOptions;
  private readonly requestHandlers = new Map<string, RequestHandler>();
  private readonly middlewares: AddonMiddleware[] = [];
  // Memoizes the allowed-methods scan per path, since routes are registered
  // once at startup and then handle() runs on every request. Cleared on any
  // new registration rather than maintained incrementally — simpler, and the
  // route count is small enough that a full rescan per distinct path is cheap.
  private readonly allowedMethodsByPath = new Map<string, readonly string[]>();

  constructor(manifest: M, manifestPath: string = Addon.PATH_MANIFEST, options: AddonOptions = {}) {
    this.manifest = manifest;
    this.options = options;

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
      throw new ValidationException("Url should be an absolute path and not end with a slash.");
    }

    const key = `${method.toUpperCase()}:${path}`;

    if (this.requestHandlers.has(key)) {
      throw new IllegalArgumentException("Handler has already been registered.");
    }

    this.requestHandlers.set(key, handler);
    this.allowedMethodsByPath.clear();
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

      let allowedMethods = this.allowedMethodsByPath.get(path);
      if (!allowedMethods) {
        allowedMethods = Array.from(this.requestHandlers.keys())
          .filter((registered) => registered.slice(registered.indexOf(":") + 1) === path)
          .map((registered) => registered.slice(0, registered.indexOf(":")));
        this.allowedMethodsByPath.set(path, allowedMethods);
      }
      if (allowedMethods.length === 0) return { status: 404, body: "Not Found" };

      const allow = Array.from(
        new Set([
          ...allowedMethods,
          ...(allowedMethods.includes(Addon.HTTP_GET) ? ["HEAD"] : []),
          "OPTIONS",
        ]),
      ).join(", ");
      if (method === "OPTIONS") return { status: 204, headers: { allow } };

      const headRequest = method === "HEAD" && allowedMethods.includes(Addon.HTTP_GET);
      const handler = this.requestHandlers.get(headRequest ? `${Addon.HTTP_GET}:${path}` : key);
      if (handler) {
        // Run filter chain
        const dispatch = async (i: number, req: AddonRequest): Promise<AddonResponse> => {
          if (i < this.middlewares.length) {
            const mw = this.middlewares[i];
            let nextCalled = false;
            return await mw(req, (nextReq) => {
              if (nextCalled) {
                throw new Error("Middleware next() called multiple times.");
              }
              nextCalled = true;
              return dispatch(i + 1, nextReq);
            });
          }
          return await handler(req);
        };
        const response = await dispatch(0, request);
        return headRequest ? { ...response, body: undefined } : response;
      }

      return {
        status: 405,
        headers: { allow },
        body: "Method Not Allowed",
      };
    } catch (e) {
      reportAddonError(this.options.onError, e, { source: "router", request });
      return {
        status: 500,
        body: "Internal Server Error",
      };
    }
  }
}
