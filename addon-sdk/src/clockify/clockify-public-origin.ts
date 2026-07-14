import { isCanonicalLoopbackHostname } from "../shared/loopback";

/** Inputs accepted by the fail-closed public-origin resolver. */
export interface ClockifyPublicOriginOptions {
  readonly publicBaseUrl?: string;
  readonly requestUrl?: string;
  readonly allowLocalRequestOrigin?: boolean;
}

/** Resolves the public origin used in manifests and browser security policies. */
export function resolveClockifyPublicOrigin(options: ClockifyPublicOriginOptions): string {
  if (options.publicBaseUrl?.trim()) {
    const configured = new URL(options.publicBaseUrl);
    if (configured.username || configured.password) {
      throw new Error("PUBLIC_BASE_URL must not contain credentials.");
    }
    if (configured.protocol !== "https:") throw new Error("PUBLIC_BASE_URL must use HTTPS.");
    return configured.origin;
  }
  if (!options.allowLocalRequestOrigin)
    throw new Error("PUBLIC_BASE_URL is required outside explicit local development.");
  if (!options.requestUrl)
    throw new Error("A request URL is required for local request-origin resolution.");
  const request = new URL(options.requestUrl);
  if (request.username || request.password) {
    throw new Error("Request URLs used for public origins must not contain credentials.");
  }
  if (!isCanonicalLoopbackHostname(request.hostname))
    throw new Error("Request-derived public origins are limited to local development hosts.");
  if (request.protocol !== "http:" && request.protocol !== "https:")
    throw new Error("Local request origins must use HTTP or HTTPS.");
  return request.origin;
}
