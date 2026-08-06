import { isHttpsOrLoopbackHttp } from "../shared/loopback";
import type { AddonResponse } from "../shared/response";

/** Options for the SDK's browser-facing response security baseline. */
export interface ClockifySecurityHeaderOptions {
  readonly frameAncestors?: readonly string[];
  readonly contentSecurityPolicy?: Readonly<Record<string, readonly string[]>>;
}

const FORBIDDEN_DIRECTIVE_VALUE = /[;,\r\n]/;
const DIRECTIVE_NAME = /^[a-z][a-z0-9-]*$/;
const MANAGED_CSP_DIRECTIVES = new Set([
  "default-src",
  "base-uri",
  "form-action",
  "frame-ancestors",
]);

function browserSecurityHeaders(): Record<string, string> {
  return {
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
  };
}

function assertDirectiveValue(value: string): void {
  if (value.trim() === "" || FORBIDDEN_DIRECTIVE_VALUE.test(value)) {
    throw new Error(`Invalid CSP directive value: ${JSON.stringify(value)}`);
  }
}

function directive(name: string, values: readonly string[]): string {
  if (!DIRECTIVE_NAME.test(name)) throw new Error(`Invalid CSP directive name: ${name}`);
  values.forEach(assertDirectiveValue);
  return `${name} ${values.join(" ")}`;
}

function assertFrameAncestor(value: string): void {
  assertDirectiveValue(value);
  if (value === "'none'" || value === "'self'") return;
  const url = new URL(value);
  if (url.origin !== value) throw new Error("CSP frame ancestors must be origins without paths.");
  if (!isHttpsOrLoopbackHttp(url)) {
    throw new Error("CSP frame ancestors must use HTTPS outside localhost.");
  }
}

/** Builds the secure default headers for Clockify iframe HTML and browser-facing JSON. */
export function buildClockifySecurityHeaders(
  options: ClockifySecurityHeaderOptions = {},
): Record<string, string> {
  const frameAncestors = options.frameAncestors ?? ["'none'"];
  frameAncestors.forEach(assertFrameAncestor);
  const customPolicies = Object.entries(options.contentSecurityPolicy ?? {});
  for (const [name] of customPolicies) {
    if (MANAGED_CSP_DIRECTIVES.has(name)) {
      throw new Error(
        `Custom contentSecurityPolicy cannot override managed CSP directive ${name}.`,
      );
    }
  }
  const policies: Array<[string, readonly string[]]> = [
    ["default-src", ["'none'"]],
    ["base-uri", ["'none'"]],
    ["form-action", ["'none'"]],
    ["frame-ancestors", frameAncestors],
    ...customPolicies,
  ];
  return {
    "content-security-policy": policies.map(([name, values]) => directive(name, values)).join("; "),
    ...browserSecurityHeaders(),
  };
}

/** Creates a no-store HTML response with the SDK security baseline. */
export function createClockifyHtmlResponse(
  body: string,
  options: ClockifySecurityHeaderOptions & { readonly status?: number } = {},
): AddonResponse {
  return {
    status: options.status ?? 200,
    headers: {
      ...buildClockifySecurityHeaders(options),
      "content-type": "text/html; charset=utf-8",
    },
    body,
  };
}

/** Creates a no-store JSON response with MIME-sniffing and referrer protections. */
export function createClockifyJsonResponse(
  body: object | null,
  options: { readonly status?: number } = {},
): AddonResponse {
  return {
    status: options.status ?? 200,
    headers: {
      ...browserSecurityHeaders(),
      "content-type": "application/json; charset=utf-8",
    },
    body,
  };
}
