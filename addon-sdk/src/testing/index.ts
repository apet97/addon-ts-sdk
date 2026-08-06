import type { ClockifyCryptoKey, ClockifyPrivateKeyInput } from "../clockify/clockify-crypto-key";
import type { ClockifyInstalledLifecyclePayload } from "../clockify/clockify-lifecycle";
import { ClockifyHeaders, ClockifyQueryParams } from "../clockify/clockify-request-wire";
import type { AddonRequest } from "../shared/request";

export interface ClockifyTestKeys {
  publicKey: ClockifyCryptoKey;
  privateKey: ClockifyPrivateKeyInput;
  pem: string;
}

export async function generateTestKeys(): Promise<ClockifyTestKeys> {
  const { generateKeyPair, exportSPKI } = await import("jose");
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const pem = await exportSPKI(publicKey);
  return { publicKey, privateKey, pem };
}

/** Builds an `AddonRequest` for a signed component GET request, e.g. `?auth_token=<jwt>`. */
export function createTestComponentRequest(
  token: string,
  overrides: Partial<AddonRequest> = {},
): AddonRequest {
  const query = new URLSearchParams({ [ClockifyQueryParams.AUTH_TOKEN]: token });
  return {
    method: "GET",
    path: "/component",
    headers: {},
    query,
    ...overrides,
  };
}

/** Builds an `AddonRequest` for a signed lifecycle POST request carrying `payload`. */
export function createTestLifecycleRequest(
  token: string,
  payload: unknown,
  overrides: Partial<AddonRequest> = {},
): AddonRequest {
  return {
    method: "POST",
    path: "/lifecycle",
    headers: { [ClockifyHeaders.LIFECYCLE_TOKEN]: token },
    body: payload,
    ...overrides,
  };
}

/** Builds an `AddonRequest` for a signed webhook POST delivery carrying `payload`. */
export function createTestWebhookRequest(
  token: string,
  eventType: string,
  payload: unknown,
  overrides: Partial<AddonRequest> = {},
): AddonRequest {
  return {
    method: "POST",
    path: "/webhook",
    headers: {
      [ClockifyHeaders.SIGNATURE]: token,
      [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: eventType,
    },
    body: payload,
    ...overrides,
  };
}

/** Builds a documented `INSTALLED` lifecycle payload with sensible test defaults. */
export function buildInstalledPayload(
  overrides: Partial<ClockifyInstalledLifecyclePayload> = {},
): ClockifyInstalledLifecyclePayload {
  return {
    addonId: "addon-test",
    authToken: "installation-secret",
    workspaceId: "ws-test",
    asUser: "user-test",
    apiUrl: "https://api.clockify.me/api",
    addonUserId: "addon-user-test",
    ...overrides,
  };
}

export async function signTestToken(
  privateKey: ClockifyPrivateKeyInput,
  addonKey: string,
  claims: Record<string, unknown> = {},
  expiresIn = "30m",
) {
  const { SignJWT } = await import("jose");

  return await new SignJWT({
    type: "addon",
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("clockify")
    .setSubject(addonKey)
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}
