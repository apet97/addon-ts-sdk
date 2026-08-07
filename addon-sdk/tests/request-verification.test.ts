import { describe, it, expect, beforeAll, vi } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import {
  AddonRequest,
  ClockifyHeaders,
  ClockifyQueryParams,
  ClockifyDeletedLifecyclePayload,
  ClockifySignatureParser,
  ClockifyInstalledLifecyclePayload,
  ClockifySettingsUpdatedLifecyclePayload,
  ClockifyStatusChangedLifecyclePayload,
  getClockifyEnvironmentContext,
  getClockifyHeader,
  getClockifyQueryParam,
  isClockifyAdminRole,
  resolveClockifyApiBaseUrl,
  resolveClockifyReportsBaseUrl,
  verifyClockifyComponentRequest,
  verifyClockifyLifecycleRequest,
  verifyClockifyRequest,
  verifyClockifyWebhookRequest,
  verifyClockifyToken,
  withClockifyInstalledLifecycleRequest,
  withClockifyDeletedLifecycleRequest,
  withClockifySettingsUpdatedLifecycleRequest,
  withClockifyStatusChangedLifecycleRequest,
  withClockifyVerifiedComponentRequest,
  withClockifyVerifiedLifecycleRequest,
  withClockifyVerifiedRequest,
  withClockifyVerifiedWebhookRequest,
  withClockifyHandler,
  verifyComponentToken,
  verifyLifecycleToken,
  verifyWebhookToken,
} from "../src";
import { generateTestKeys, signTestToken } from "../src/testing";

const ADDON_KEY = "marketplace-docs-addon";
const WORKSPACE_ID = "ws-marketplace";
const ADDON_ID = "addon-marketplace";

let keys: Awaited<ReturnType<typeof generateTestKeys>>;

beforeAll(async () => {
  keys = await generateTestKeys();
});

function parser() {
  return new ClockifySignatureParser(ADDON_KEY, keys.publicKey);
}

function request(headers: AddonRequest["headers"]): AddonRequest {
  return { method: "POST", path: "/webhook", headers };
}

function componentRequest(query: URLSearchParams): AddonRequest {
  return { method: "GET", path: "/component", headers: {}, query };
}

async function validToken(extraClaims: Record<string, unknown> = {}) {
  return signTestToken(keys.privateKey, ADDON_KEY, {
    workspaceId: WORKSPACE_ID,
    addonId: ADDON_ID,
    ...extraClaims,
  });
}

describe("Marketplace request verification helpers", () => {
  it("rejects empty add-on keys before token verification", () => {
    expect(() => new ClockifySignatureParser(" ", keys.publicKey)).toThrow(/add-on key/i);
  });

  it("requires expiration on component tokens by default", async () => {
    const token = await new SignJWT({
      type: "addon",
      workspaceId: WORKSPACE_ID,
      addonId: ADDON_ID,
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("clockify")
      .setSubject(ADDON_KEY)
      .sign(keys.privateKey);

    await expect(
      verifyClockifyComponentRequest(
        parser(),
        componentRequest(new URLSearchParams({ [ClockifyQueryParams.AUTH_TOKEN]: token })),
      ),
    ).resolves.toEqual({ ok: false, reason: "missing-expiration" });
  });

  it("does not require expiration on lifecycle tokens by default (INSTALLED payload has none)", async () => {
    const token = await new SignJWT({
      type: "addon",
      workspaceId: WORKSPACE_ID,
      addonId: ADDON_ID,
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("clockify")
      .setSubject(ADDON_KEY)
      .sign(keys.privateKey);

    await expect(
      verifyClockifyLifecycleRequest(
        parser(),
        request({ [ClockifyHeaders.LIFECYCLE_TOKEN]: token }),
      ),
    ).resolves.toMatchObject({ ok: true });

    await expect(
      verifyClockifyLifecycleRequest(
        parser(),
        request({ [ClockifyHeaders.LIFECYCLE_TOKEN]: token }),
        { requireExpiration: true },
      ),
    ).resolves.toEqual({ ok: false, reason: "missing-expiration" });
  });

  it("exports documented wire names and reads headers case-insensitively", () => {
    const headers = {
      "Clockify-Signature": ["jwt-1", "jwt-2"],
      "X-Addon-Token": "installation-token",
    };

    expect(ClockifyHeaders.SIGNATURE).toBe("clockify-signature");
    expect(ClockifyHeaders.WEBHOOK_EVENT_TYPE).toBe("clockify-webhook-event-type");
    expect(ClockifyHeaders.LIFECYCLE_TOKEN).toBe("x-addon-lifecycle-token");
    expect(ClockifyHeaders.ADDON_TOKEN).toBe("x-addon-token");
    expect(ClockifyQueryParams.AUTH_TOKEN).toBe("auth_token");
    expect(getClockifyHeader(headers, ClockifyHeaders.SIGNATURE)).toBe("jwt-1");
    expect(getClockifyHeader(headers, ClockifyHeaders.ADDON_TOKEN)).toBe("installation-token");
    expect(getClockifyHeader(headers, "missing")).toBeUndefined();

    const query = new URLSearchParams([
      [ClockifyQueryParams.AUTH_TOKEN, "token-1"],
      [ClockifyQueryParams.AUTH_TOKEN, "token-2"],
    ]);
    expect(getClockifyQueryParam(query, ClockifyQueryParams.AUTH_TOKEN)).toBe("token-1");
    expect(getClockifyQueryParam(undefined, ClockifyQueryParams.AUTH_TOKEN)).toBeUndefined();
  });

  it("verifies a webhook signature, event header, workspace, and add-on id", async () => {
    const token = await validToken();
    const result = await verifyClockifyRequest(
      parser(),
      request({
        [ClockifyHeaders.SIGNATURE]: token,
        [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
      }),
      {
        expectedEventType: "EXPENSE_CREATED",
        expectedWorkspaceId: WORKSPACE_ID,
        expectedAddonId: ADDON_ID,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      eventType: "EXPENSE_CREATED",
      claims: {
        workspaceId: WORKSPACE_ID,
        addonId: ADDON_ID,
      },
    });
  });

  it("reports missing and invalid signatures without calling the parser successfully", async () => {
    await expect(verifyClockifyRequest(parser(), request({}))).resolves.toEqual({
      ok: false,
      reason: "missing-signature",
    });

    await expect(
      verifyClockifyRequest(parser(), request({ [ClockifyHeaders.SIGNATURE]: "not-a-jwt" })),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid-signature",
    });
  });

  it("rejects valid RSA JWTs that are not signed with RS256", async () => {
    const { privateKey, publicKey } = await generateKeyPair("PS256");
    const token = await new SignJWT({ type: "addon", workspaceId: WORKSPACE_ID, addonId: ADDON_ID })
      .setProtectedHeader({ alg: "PS256" })
      .setIssuer("clockify")
      .setSubject(ADDON_KEY)
      .setExpirationTime("30m")
      .sign(privateKey);

    const result = await verifyClockifyRequest(
      new ClockifySignatureParser(ADDON_KEY, publicKey),
      request({ [ClockifyHeaders.SIGNATURE]: token }),
    );

    expect(result).toEqual({ ok: false, reason: "invalid-signature" });
  });

  it("rejects webhook requests with missing or mismatched event headers", async () => {
    const token = await validToken();

    await expect(
      verifyClockifyRequest(parser(), request({ [ClockifyHeaders.SIGNATURE]: token }), {
        expectedEventType: "EXPENSE_CREATED",
      }),
    ).resolves.toEqual({ ok: false, reason: "missing-event-type" });

    await expect(
      verifyClockifyRequest(
        parser(),
        request({
          [ClockifyHeaders.SIGNATURE]: token,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_DELETED",
        }),
        { expectedEventType: "EXPENSE_CREATED" },
      ),
    ).resolves.toEqual({ ok: false, reason: "event-type-mismatch" });
  });

  it("rejects ambiguous signature and event headers during verification", async () => {
    const token = await validToken();

    await expect(
      verifyClockifyRequest(
        parser(),
        request({
          [ClockifyHeaders.SIGNATURE]: [token, token],
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
        }),
      ),
    ).resolves.toEqual({ ok: false, reason: "ambiguous-signature" });

    await expect(
      verifyClockifyRequest(
        parser(),
        request({
          [ClockifyHeaders.SIGNATURE]: token,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: ["EXPENSE_CREATED", "EXPENSE_CREATED"],
        }),
        { expectedEventType: "EXPENSE_CREATED" },
      ),
    ).resolves.toEqual({ ok: false, reason: "ambiguous-event-type" });

    await expect(
      verifyClockifyWebhookRequest(
        parser(),
        request({
          [ClockifyHeaders.SIGNATURE]: [token, token],
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
        }),
        { expectedEventType: "EXPENSE_CREATED", expectedWebhookAuthToken: token },
      ),
    ).resolves.toEqual({ ok: false, reason: "ambiguous-signature" });

    await expect(
      verifyClockifyWebhookRequest(
        parser(),
        request({
          [ClockifyHeaders.SIGNATURE]: token,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: ["EXPENSE_CREATED", "EXPENSE_CREATED"],
        }),
        { expectedEventType: "EXPENSE_CREATED", expectedWebhookAuthToken: token },
      ),
    ).resolves.toEqual({ ok: false, reason: "ambiguous-event-type" });
  });

  it("rejects a duplicate signature comma-joined into one header value", async () => {
    // Node and the Fetch Headers object both fold a client-repeated header into
    // one "value1, value2" string rather than an array; a real signature must
    // still be caught as ambiguous in that shape.
    const token = await validToken();

    await expect(
      verifyClockifyRequest(
        parser(),
        request({
          [ClockifyHeaders.SIGNATURE]: `${token}, ${token}`,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
        }),
      ),
    ).resolves.toEqual({ ok: false, reason: "ambiguous-signature" });
  });

  it("verifies webhook requests with event, workspace, add-on, and stored webhook token checks", async () => {
    const token = await validToken();

    await expect(
      verifyClockifyWebhookRequest(
        parser(),
        request({
          [ClockifyHeaders.SIGNATURE]: token,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
        }),
        {} as any,
      ),
    ).resolves.toEqual({ ok: false, reason: "missing-expected-event-type" });

    await expect(
      verifyClockifyWebhookRequest(parser(), request({ [ClockifyHeaders.SIGNATURE]: token }), {
        expectedEventType: "EXPENSE_CREATED",
        expectedWebhookAuthToken: token,
      }),
    ).resolves.toEqual({ ok: false, reason: "missing-event-type" });

    await expect(
      verifyClockifyWebhookRequest(
        parser(),
        request({
          [ClockifyHeaders.SIGNATURE]: token,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_DELETED",
        }),
        { expectedEventType: "EXPENSE_CREATED", expectedWebhookAuthToken: token },
      ),
    ).resolves.toEqual({ ok: false, reason: "event-type-mismatch" });

    await expect(
      verifyClockifyWebhookRequest(
        parser(),
        request({
          [ClockifyHeaders.SIGNATURE]: token,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
        }),
        {
          expectedEventType: "EXPENSE_CREATED",
          expectedWebhookAuthToken: "different-token",
        },
      ),
    ).resolves.toEqual({ ok: false, reason: "webhook-token-mismatch" });

    // An unsigned string that happens to equal the stored expected token must
    // still fail as an invalid signature, not a token mismatch — the JWT is
    // verified before the token is ever compared, closing the probing oracle.
    await expect(
      verifyClockifyWebhookRequest(
        parser(),
        request({
          [ClockifyHeaders.SIGNATURE]: "not-a-jwt-but-matches-stored-token",
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
        }),
        {
          expectedEventType: "EXPENSE_CREATED",
          expectedWebhookAuthToken: "not-a-jwt-but-matches-stored-token",
        },
      ),
    ).resolves.toEqual({ ok: false, reason: "invalid-signature" });

    await expect(
      verifyClockifyWebhookRequest(
        parser(),
        request({
          [ClockifyHeaders.SIGNATURE]: token,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
        }),
        {
          expectedEventType: "EXPENSE_CREATED",
          expectedWebhookAuthToken: token,
          expectedWorkspaceId: WORKSPACE_ID,
          expectedAddonId: ADDON_ID,
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      eventType: "EXPENSE_CREATED",
      claims: { workspaceId: WORKSPACE_ID, addonId: ADDON_ID },
    });
  });

  it("rejects missing or blank expected webhook tokens from runtime-unsafe callers", async () => {
    const token = await validToken();
    const webhookRequest = request({
      [ClockifyHeaders.SIGNATURE]: token,
      [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
    });

    for (const expectedWebhookAuthToken of [undefined, "", " \t"] as const) {
      await expect(
        verifyClockifyWebhookRequest(parser(), webhookRequest, {
          expectedEventType: "EXPENSE_CREATED",
          expectedWebhookAuthToken,
        } as any),
      ).resolves.toEqual({
        ok: false,
        reason: "missing-expected-webhook-auth-token",
      });
    }
  });

  it("rejects fixed webhook tokens without nonblank installation context", async () => {
    const tokens = [
      await signTestToken(keys.privateKey, ADDON_KEY, { addonId: ADDON_ID }),
      await signTestToken(keys.privateKey, ADDON_KEY, {
        workspaceId: WORKSPACE_ID,
        addonId: " ",
      }),
    ];

    for (const token of tokens) {
      const webhookRequest = request({
        [ClockifyHeaders.SIGNATURE]: token,
        [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
      });
      await expect(
        verifyClockifyWebhookRequest(parser(), webhookRequest, {
          expectedEventType: "EXPENSE_CREATED",
          expectedWebhookAuthToken: token,
        }),
      ).resolves.toEqual({ ok: false, reason: "missing-installation-context" });
    }

    let handled = false;
    const token = tokens[0]!;
    const handler = withClockifyVerifiedWebhookRequest(
      parser(),
      {
        expectedEventType: "EXPENSE_CREATED",
        expectedWebhookAuthToken: token,
      },
      async () => {
        handled = true;
        return { status: 204 };
      },
    );

    await expect(
      handler(
        request({
          [ClockifyHeaders.SIGNATURE]: token,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
        }),
      ),
    ).resolves.toEqual({ status: 401, body: "Unauthorized" });
    expect(handled).toBe(false);
  });

  it("reports missing installation context before configured id mismatches", async () => {
    const missingWorkspaceToken = await signTestToken(keys.privateKey, ADDON_KEY, {
      addonId: ADDON_ID,
    });
    const missingAddonToken = await signTestToken(keys.privateKey, ADDON_KEY, {
      workspaceId: WORKSPACE_ID,
    });

    for (const token of [missingWorkspaceToken, missingAddonToken]) {
      await expect(
        verifyClockifyWebhookRequest(
          parser(),
          request({
            [ClockifyHeaders.SIGNATURE]: token,
            [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
          }),
          {
            expectedEventType: "EXPENSE_CREATED",
            expectedWebhookAuthToken: token,
            expectedWorkspaceId: WORKSPACE_ID,
            expectedAddonId: ADDON_ID,
          },
        ),
      ).resolves.toEqual({ ok: false, reason: "missing-installation-context" });
    }

    const contextualToken = await validToken();
    const contextualRequest = request({
      [ClockifyHeaders.SIGNATURE]: contextualToken,
      [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
    });
    await expect(
      verifyClockifyWebhookRequest(parser(), contextualRequest, {
        expectedEventType: "EXPENSE_CREATED",
        expectedWebhookAuthToken: contextualToken,
        expectedWorkspaceId: "other-workspace",
      }),
    ).resolves.toEqual({ ok: false, reason: "workspace-id-mismatch" });
    await expect(
      verifyClockifyWebhookRequest(parser(), contextualRequest, {
        expectedEventType: "EXPENSE_CREATED",
        expectedWebhookAuthToken: contextualToken,
        expectedAddonId: "other-addon",
      }),
    ).resolves.toEqual({ ok: false, reason: "addon-id-mismatch" });
  });

  it("rejects verified tokens that target a different workspace or add-on id", async () => {
    const token = await validToken();
    const headers = { [ClockifyHeaders.SIGNATURE]: token };

    await expect(
      verifyClockifyRequest(parser(), request(headers), { expectedWorkspaceId: "other-workspace" }),
    ).resolves.toEqual({ ok: false, reason: "workspace-id-mismatch" });

    await expect(
      verifyClockifyRequest(parser(), request(headers), { expectedAddonId: "other-addon" }),
    ).resolves.toEqual({ ok: false, reason: "addon-id-mismatch" });
  });

  it("verifies lifecycle requests using X-Addon-Lifecycle-Token", async () => {
    const token = await validToken();
    const result = await verifyClockifyRequest(
      parser(),
      request({ "X-Addon-Lifecycle-Token": token }),
      {
        signatureHeader: ClockifyHeaders.LIFECYCLE_TOKEN,
        expectedWorkspaceId: WORKSPACE_ID,
        expectedAddonId: ADDON_ID,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      claims: { workspaceId: WORKSPACE_ID, addonId: ADDON_ID },
    });
  });

  it("verifies raw tokens without throwing for missing or invalid input", async () => {
    const token = await validToken();

    await expect(verifyClockifyToken(parser(), token)).resolves.toMatchObject({
      ok: true,
      claims: { workspaceId: WORKSPACE_ID, addonId: ADDON_ID },
    });
    await expect(verifyClockifyToken(parser(), undefined)).resolves.toEqual({
      ok: false,
      reason: "missing-token",
    });
    await expect(verifyClockifyToken(parser(), "not-a-jwt")).resolves.toEqual({
      ok: false,
      reason: "invalid-token",
    });
  });

  it("verifies component requests using the auth_token query parameter", async () => {
    const token = await validToken({ user: "admin-user", workspaceRole: "OWNER" });
    const result = await verifyClockifyComponentRequest(
      parser(),
      componentRequest(new URLSearchParams({ [ClockifyQueryParams.AUTH_TOKEN]: token })),
      {
        expectedWorkspaceId: WORKSPACE_ID,
        expectedAddonId: ADDON_ID,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      claims: { workspaceId: WORKSPACE_ID, addonId: ADDON_ID, user: "admin-user" },
    });
  });

  it("reports missing component tokens and verifies lifecycle tokens through narrow helpers", async () => {
    await expect(
      verifyClockifyComponentRequest(parser(), componentRequest(new URLSearchParams())),
    ).resolves.toEqual({
      ok: false,
      reason: "missing-token",
    });

    await expect(
      verifyClockifyComponentRequest(
        parser(),
        componentRequest(new URLSearchParams({ [ClockifyQueryParams.AUTH_TOKEN]: "not-a-jwt" })),
      ),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid-token",
    });

    const token = await validToken();
    await expect(
      verifyClockifyComponentRequest(
        parser(),
        componentRequest(
          new URLSearchParams([
            [ClockifyQueryParams.AUTH_TOKEN, token],
            [ClockifyQueryParams.AUTH_TOKEN, token],
          ]),
        ),
      ),
    ).resolves.toEqual({
      ok: false,
      reason: "ambiguous-token",
    });

    await expect(
      verifyClockifyLifecycleRequest(
        parser(),
        request({ [ClockifyHeaders.LIFECYCLE_TOKEN]: [token, token] }),
      ),
    ).resolves.toEqual({
      ok: false,
      reason: "ambiguous-token",
    });

    await expect(
      verifyClockifyLifecycleRequest(parser(), request({ "X-Addon-Lifecycle-Token": token })),
    ).resolves.toMatchObject({
      ok: true,
      claims: { workspaceId: WORKSPACE_ID, addonId: ADDON_ID },
    });
  });

  it("identifies Clockify admin roles case-insensitively", () => {
    expect(isClockifyAdminRole("OWNER")).toBe(true);
    expect(isClockifyAdminRole(" admin ")).toBe(true);
    expect(isClockifyAdminRole("USER")).toBe(false);
    expect(isClockifyAdminRole(undefined)).toBe(false);
  });

  it.each([
    ["https://developer.clockify.me", "https://developer.clockify.me/v1"],
    ["https://developer.clockify.me/", "https://developer.clockify.me/v1"],
    ["https://developer.clockify.me/api", "https://developer.clockify.me/api/v1"],
    ["https://developer.clockify.me/region/api///", "https://developer.clockify.me/region/api/v1"],
    ["https://developer.clockify.me/api/v1", "https://developer.clockify.me/api/v1"],
    ["https://developer.clockify.me/api/v1///", "https://developer.clockify.me/api/v1"],
    ["http://localhost:3000/api", "http://localhost:3000/api/v1"],
    ["http://127.0.0.1:3000/api", "http://127.0.0.1:3000/api/v1"],
    ["http://[::1]:3000/api", "http://[::1]:3000/api/v1"],
  ])("normalizes the Clockify API root %s", (apiUrl, expected) => {
    expect(resolveClockifyApiBaseUrl({ apiUrl })).toBe(expected);
  });

  it("normalizes reports roots with the same URL policy", () => {
    expect(
      resolveClockifyReportsBaseUrl({
        reportsUrl: "https://reports.example/region/report///",
      }),
    ).toBe("https://reports.example/region/report/v1");
    expect(resolveClockifyReportsBaseUrl({ reportsUrl: "http://[::1]:8787/report/v1/" })).toBe(
      "http://[::1]:8787/report/v1",
    );
  });

  it("prefers a nonblank apiUrl without falling back when it is invalid", () => {
    expect(
      resolveClockifyApiBaseUrl({
        apiUrl: "https://developer.clockify.me/api",
        backendUrl: "https://api.clockify.me/api",
      }),
    ).toBe("https://developer.clockify.me/api/v1");
    expect(
      resolveClockifyApiBaseUrl({
        apiUrl: "   ",
        backendUrl: "https://api.clockify.me/api",
      }),
    ).toBe("https://api.clockify.me/api/v1");
    expect(
      resolveClockifyApiBaseUrl({
        apiUrl: "http://nonloopback.example/api",
        backendUrl: "https://api.clockify.me/api",
      }),
    ).toBeUndefined();
    expect(
      resolveClockifyApiBaseUrl({
        apiUrl: 42 as unknown as string,
        backendUrl: "https://api.clockify.me/api",
      }),
    ).toBeUndefined();
  });

  it.each([
    ["non-string", 42],
    ["empty", ""],
    ["whitespace", "   "],
    ["username", "https://user@api.example/api"],
    ["password", "https://:password@api.example/api"],
    ["query", "https://api.example/api?workspace=secret"],
    ["fragment", "https://api.example/api#secret"],
    ["unsupported scheme", "ftp://api.example/api"],
    ["relative URL", "/api"],
    ["protocol-relative URL", "//api.example/api"],
    ["malformed URL", "https://[::1"],
    ["nonloopback HTTP", "http://api.example/api"],
  ])("rejects a %s claim-derived URL", (_label, value) => {
    expect(resolveClockifyApiBaseUrl({ apiUrl: value as string })).toBeUndefined();
    expect(resolveClockifyReportsBaseUrl({ reportsUrl: value as string })).toBeUndefined();
  });

  it("does not add production URL fallbacks", () => {
    expect(resolveClockifyApiBaseUrl({})).toBeUndefined();
    expect(resolveClockifyReportsBaseUrl({})).toBeUndefined();
  });

  it("wraps handlers and returns 401 for failed verification", async () => {
    let handled = false;
    const handler = withClockifyVerifiedRequest(
      parser(),
      { expectedWorkspaceId: WORKSPACE_ID },
      async (_request, claims, context) => {
        handled = true;
        expect(context.claims).toBe(claims);
        return { status: 202, body: { workspaceId: claims.workspaceId } };
      },
    );

    const valid = await handler(request({ [ClockifyHeaders.SIGNATURE]: await validToken() }));
    expect(valid).toEqual({ status: 202, body: { workspaceId: WORKSPACE_ID } });
    expect(handled).toBe(true);

    handled = false;
    const invalid = await handler(request({}));
    expect(invalid).toEqual({ status: 401, body: "Unauthorized" });
    expect(handled).toBe(false);
  });

  it("wraps component handlers and passes verified token context", async () => {
    const token = await validToken({ user: "component-user", workspaceRole: "ADMIN" });
    let handled = false;
    const handler = withClockifyVerifiedComponentRequest(
      parser(),
      async (_request, claims, context) => {
        handled = true;
        expect(context.claims).toBe(claims);
        return { status: 200, body: { user: claims.user, role: claims.workspaceRole } };
      },
      { expectedWorkspaceId: WORKSPACE_ID, expectedAddonId: ADDON_ID },
    );

    const valid = await handler(
      componentRequest(new URLSearchParams({ [ClockifyQueryParams.AUTH_TOKEN]: token })),
    );
    expect(valid).toEqual({
      status: 200,
      body: { user: "component-user", role: "ADMIN" },
    });
    expect(handled).toBe(true);

    handled = false;
    const invalid = await handler(componentRequest(new URLSearchParams()));
    expect(invalid).toEqual({ status: 401, body: "Unauthorized" });
    expect(handled).toBe(false);
  });

  it("wraps lifecycle handlers and passes verified token context", async () => {
    const token = await validToken();
    let handled = false;
    const handler = withClockifyVerifiedLifecycleRequest(
      parser(),
      async (_request, claims, context) => {
        handled = true;
        expect(context.claims).toBe(claims);
        return { status: 204 };
      },
      { expectedWorkspaceId: WORKSPACE_ID, expectedAddonId: ADDON_ID },
    );

    const valid = await handler(request({ [ClockifyHeaders.LIFECYCLE_TOKEN]: token }));
    expect(valid).toEqual({ status: 204 });
    expect(handled).toBe(true);

    handled = false;
    const invalid = await handler(request({}));
    expect(invalid).toEqual({ status: 401, body: "Unauthorized" });
    expect(handled).toBe(false);
  });

  it("wraps installed lifecycle handlers with matched payload and claims", async () => {
    const token = await validToken();
    const payload: ClockifyInstalledLifecyclePayload = {
      addonId: ADDON_ID,
      authToken: "installation-token",
      workspaceId: WORKSPACE_ID,
      asUser: "admin-user",
      apiUrl: "https://developer.clockify.me/api",
      addonUserId: "addon-user",
      webhooks: [
        {
          path: "/webhooks/expense-created",
          webhookType: "ADDON",
          authToken: "webhook-token",
        },
      ],
    };
    let handled = false;
    const handler = withClockifyInstalledLifecycleRequest(
      parser(),
      async (_request, installedPayload, claims, context) => {
        handled = true;
        expect(installedPayload).toBe(payload);
        expect(context.payload).toBe(payload);
        expect(context.claims).toBe(claims);
        const workspaceId: string = claims.workspaceId;
        const addonId: string = claims.addonId;
        return { status: 201, body: { workspaceId, addonId } };
      },
      { expectedWorkspaceId: WORKSPACE_ID, expectedAddonId: ADDON_ID },
    );

    const valid = await handler({
      ...request({ [ClockifyHeaders.LIFECYCLE_TOKEN]: token }),
      body: payload,
    });
    expect(valid).toEqual({
      status: 201,
      body: { workspaceId: WORKSPACE_ID, addonId: ADDON_ID },
    });
    expect(handled).toBe(true);

    handled = false;
    const mismatchedPayload = await handler({
      ...request({ [ClockifyHeaders.LIFECYCLE_TOKEN]: token }),
      body: { ...payload, workspaceId: "other-workspace" },
    });
    expect(mismatchedPayload).toEqual({ status: 401, body: "Unauthorized" });
    expect(handled).toBe(false);

    const invalidPayload = await handler({
      ...request({ [ClockifyHeaders.LIFECYCLE_TOKEN]: token }),
      body: { addonId: ADDON_ID, workspaceId: WORKSPACE_ID },
    });
    expect(invalidPayload).toEqual({ status: 401, body: "Unauthorized" });
  });

  it("wraps non-installed lifecycle handlers with matched typed payloads and claims", async () => {
    const token = await validToken();
    const statusPayload: ClockifyStatusChangedLifecyclePayload = {
      addonId: ADDON_ID,
      workspaceId: WORKSPACE_ID,
      status: "ACTIVE",
    };
    const settingsPayload: ClockifySettingsUpdatedLifecyclePayload = {
      addonId: ADDON_ID,
      workspaceId: WORKSPACE_ID,
      settings: [{ id: "setting-1", name: "Setting", value: true }],
    };
    const deletedPayload: ClockifyDeletedLifecyclePayload = {
      addonId: ADDON_ID,
      workspaceId: WORKSPACE_ID,
      asUser: "admin-user",
    };
    const headers = { [ClockifyHeaders.LIFECYCLE_TOKEN]: token };

    let statusHandled = false;
    const statusHandler = withClockifyStatusChangedLifecycleRequest(
      parser(),
      async (_request, payload, claims, context) => {
        statusHandled = true;
        expect(payload).toBe(statusPayload);
        expect(context.payload).toBe(statusPayload);
        const workspaceId: string = claims.workspaceId;
        const addonId: string = claims.addonId;
        return { status: 200, body: { workspaceId, addonId, lifecycleStatus: payload.status } };
      },
      { expectedWorkspaceId: WORKSPACE_ID, expectedAddonId: ADDON_ID },
    );

    await expect(statusHandler({ ...request(headers), body: statusPayload })).resolves.toEqual({
      status: 200,
      body: { workspaceId: WORKSPACE_ID, addonId: ADDON_ID, lifecycleStatus: "ACTIVE" },
    });
    expect(statusHandled).toBe(true);

    const settingsHandler = withClockifySettingsUpdatedLifecycleRequest(
      parser(),
      async (_request, payload, claims, context) => {
        expect(payload).toBe(settingsPayload);
        expect(context.claims).toBe(claims);
        return { status: 200, body: { settings: payload.settings.length } };
      },
      { expectedWorkspaceId: WORKSPACE_ID, expectedAddonId: ADDON_ID },
    );
    await expect(settingsHandler({ ...request(headers), body: settingsPayload })).resolves.toEqual({
      status: 200,
      body: { settings: 1 },
    });

    const deletedHandler = withClockifyDeletedLifecycleRequest(
      parser(),
      async (_request, payload) => ({ status: 200, body: { asUser: payload.asUser } }),
      { expectedWorkspaceId: WORKSPACE_ID, expectedAddonId: ADDON_ID },
    );
    await expect(deletedHandler({ ...request(headers), body: deletedPayload })).resolves.toEqual({
      status: 200,
      body: { asUser: "admin-user" },
    });

    statusHandled = false;
    await expect(
      statusHandler({
        ...request(headers),
        body: { ...statusPayload, workspaceId: "other-workspace" },
      }),
    ).resolves.toEqual({ status: 401, body: "Unauthorized" });
    expect(statusHandled).toBe(false);

    await expect(
      settingsHandler({
        ...request(headers),
        body: { addonId: ADDON_ID, workspaceId: WORKSPACE_ID, settings: [{ id: "bad" }] },
      }),
    ).resolves.toEqual({ status: 401, body: "Unauthorized" });

    await expect(deletedHandler(request({}))).resolves.toEqual({
      status: 401,
      body: "Unauthorized",
    });
  });

  it("wraps webhook handlers with an exact fixed stored token", async () => {
    const token = await validToken();
    let handled = false;
    const handler = withClockifyVerifiedWebhookRequest(
      parser(),
      {
        expectedEventType: "EXPENSE_CREATED",
        expectedWebhookAuthToken: token,
      },
      async () => {
        handled = true;
        return { status: 204 };
      },
    );
    const webhookRequest = request({
      [ClockifyHeaders.SIGNATURE]: token,
      [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
    });

    await expect(handler(webhookRequest)).resolves.toEqual({ status: 204 });
    expect(handled).toBe(true);

    handled = false;
    const mismatchedHandler = withClockifyVerifiedWebhookRequest(
      parser(),
      {
        expectedEventType: "EXPENSE_CREATED",
        expectedWebhookAuthToken: "different-token",
      },
      async () => {
        handled = true;
        return { status: 204 };
      },
    );
    await expect(mismatchedHandler(webhookRequest)).resolves.toEqual({
      status: 401,
      body: "Unauthorized",
    });
    expect(handled).toBe(false);
  });

  it("wraps webhook handlers with stored-token lookup and strict context checks", async () => {
    const token = await validToken();
    const lookups: Array<{ workspaceId: string; addonId: string; eventType: string }> = [];
    let handled = false;
    const clockifyParser = parser();
    const parseClaimsSpy = vi.spyOn(clockifyParser, "parseClaims");
    const handler = withClockifyVerifiedWebhookRequest(
      clockifyParser,
      {
        expectedEventType: "EXPENSE_CREATED",
        getExpectedWebhookAuthToken(input) {
          lookups.push(input);
          return input.workspaceId === WORKSPACE_ID &&
            input.addonId === ADDON_ID &&
            input.eventType === "EXPENSE_CREATED"
            ? token
            : undefined;
        },
      },
      async (_request, claims, context) => {
        handled = true;
        expect(context.claims).toBe(claims);
        expect(context.eventType).toBe("EXPENSE_CREATED");
        return { status: 204 };
      },
    );

    const valid = await handler(
      request({
        [ClockifyHeaders.SIGNATURE]: token,
        [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
      }),
    );
    expect(valid).toEqual({ status: 204 });
    expect(lookups).toEqual([
      { workspaceId: WORKSPACE_ID, addonId: ADDON_ID, eventType: "EXPENSE_CREATED" },
    ]);
    expect(handled).toBe(true);
    // The lookup path must verify the JWT exactly once: the stored-token
    // comparison reuses firstPass's already-verified claims and raw header
    // value instead of re-running verifyClockifyWebhookRequest.
    expect(parseClaimsSpy).toHaveBeenCalledTimes(1);

    handled = false;
    const missingStoredToken = withClockifyVerifiedWebhookRequest(
      parser(),
      {
        expectedEventType: "EXPENSE_CREATED",
        getExpectedWebhookAuthToken: () => undefined,
      },
      async () => {
        handled = true;
        return { status: 204 };
      },
    );
    await expect(
      missingStoredToken(
        request({
          [ClockifyHeaders.SIGNATURE]: token,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
        }),
      ),
    ).resolves.toEqual({ status: 401, body: "Unauthorized" });
    expect(handled).toBe(false);

    const mismatchedStoredToken = withClockifyVerifiedWebhookRequest(
      parser(),
      {
        expectedEventType: "EXPENSE_CREATED",
        getExpectedWebhookAuthToken: () => "different-token",
      },
      async () => ({ status: 204 }),
    );
    await expect(
      mismatchedStoredToken(
        request({
          [ClockifyHeaders.SIGNATURE]: token,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
        }),
      ),
    ).resolves.toEqual({ status: 401, body: "Unauthorized" });

    const tokenWithoutContext = await signTestToken(keys.privateKey, ADDON_KEY, {});
    let contextlessLookups = 0;
    const missingClaims = withClockifyVerifiedWebhookRequest(
      parser(),
      {
        expectedEventType: "EXPENSE_CREATED",
        getExpectedWebhookAuthToken: () => {
          contextlessLookups += 1;
          return tokenWithoutContext;
        },
      },
      async () => ({ status: 204 }),
    );
    await expect(
      missingClaims(
        request({
          [ClockifyHeaders.SIGNATURE]: tokenWithoutContext,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
        }),
      ),
    ).resolves.toEqual({ status: 401, body: "Unauthorized" });
    expect(contextlessLookups).toBe(0);
  });

  it("throws at wiring time for ambiguous fixed and lookup token configuration", async () => {
    const token = await validToken();
    let handled = false;
    // These are configuration mistakes, not verification failures: they must
    // surface immediately as a thrown error during setup, not as a silent
    // per-request 401 that hides a broken webhook registration.
    expect(() =>
      withClockifyVerifiedWebhookRequest(
        parser(),
        {
          expectedEventType: "EXPENSE_CREATED",
          expectedWebhookAuthToken: token,
          getExpectedWebhookAuthToken: () => token,
        } as any,
        async () => {
          handled = true;
          return { status: 204 };
        },
      ),
    ).toThrow(/requires exactly one of/);
    expect(handled).toBe(false);
  });

  it("throws at wiring time without a fixed or lookup token source", async () => {
    let handled = false;
    expect(() =>
      withClockifyVerifiedWebhookRequest(
        parser(),
        { expectedEventType: "EXPENSE_CREATED" } as any,
        async () => {
          handled = true;
          return { status: 204 };
        },
      ),
    ).toThrow(/requires exactly one of/);
    expect(handled).toBe(false);
  });

  it("throws at wiring time for a non-callable webhook token lookup", async () => {
    let handled = false;
    expect(() =>
      withClockifyVerifiedWebhookRequest(
        parser(),
        {
          expectedEventType: "EXPENSE_CREATED",
          getExpectedWebhookAuthToken: null,
        } as any,
        async () => {
          handled = true;
          return { status: 204 };
        },
      ),
    ).toThrow(/must be a function/);
    expect(handled).toBe(false);
  });

  it("throws at wiring time for a missing expected event type", async () => {
    let handled = false;
    expect(() =>
      withClockifyVerifiedWebhookRequest(parser(), {} as any, async () => {
        handled = true;
        return { status: 204 };
      }),
    ).toThrow(/requires a nonblank expectedEventType/);
    expect(handled).toBe(false);
  });

  it("reports a misconfigured token lookup via onError before returning 401", async () => {
    const token = await validToken();
    const onError = vi.fn();
    let handled = false;
    const handler = withClockifyVerifiedWebhookRequest(
      parser(),
      {
        expectedEventType: "EXPENSE_CREATED",
        getExpectedWebhookAuthToken: () => undefined,
        onError,
      },
      async () => {
        handled = true;
        return { status: 204 };
      },
    );

    await expect(
      handler(
        request({
          [ClockifyHeaders.SIGNATURE]: token,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
        }),
      ),
    ).resolves.toEqual({ status: 401, body: "Unauthorized" });
    expect(handled).toBe(false);
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({ source: "router" }),
    );
    expect(onError.mock.calls[0]![0].message).toMatch(/no stored token/);
  });

  it("extracts environment and user context claims without hardcoded URL fallbacks", () => {
    const context = getClockifyEnvironmentContext({
      type: "addon",
      iss: "clockify",
      sub: ADDON_KEY,
      backendUrl: "https://api.clockify.example",
      reportsUrl: "https://reports.clockify.example",
      locationsUrl: "https://locations.clockify.example",
      screenshotsUrl: "https://screenshots.clockify.example",
      workspaceId: WORKSPACE_ID,
      addonId: ADDON_ID,
      user: "user-1",
      workspaceRole: "OWNER",
      language: "en",
      theme: "dark",
    });

    expect(context).toEqual({
      backendUrl: "https://api.clockify.example",
      ptoUrl: undefined,
      reportsUrl: "https://reports.clockify.example",
      locationsUrl: "https://locations.clockify.example",
      screenshotsUrl: "https://screenshots.clockify.example",
      workspaceId: WORKSPACE_ID,
      addonId: ADDON_ID,
      user: "user-1",
      workspaceRole: "OWNER",
      language: "en",
      theme: "dark",
    });

    expect(
      getClockifyEnvironmentContext({
        type: "addon",
        iss: "clockify",
        sub: ADDON_KEY,
      }).backendUrl,
    ).toBeUndefined();
  });
});

describe("withClockifyHandler (unified arity)", () => {
  it("normalizes the verified kind to (request, context)", async () => {
    const token = await validToken();
    let handled = false;
    const handler = withClockifyHandler(
      parser(),
      { kind: "verified", expectedEventType: "EXPENSE_CREATED" },
      async (_request, context) => {
        handled = true;
        expect(context.eventType).toBe("EXPENSE_CREATED");
        return { status: 200, body: { workspaceId: context.claims.workspaceId } };
      },
    );

    const valid = await handler(
      request({
        [ClockifyHeaders.SIGNATURE]: token,
        [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
      }),
    );
    expect(valid).toEqual({ status: 200, body: { workspaceId: WORKSPACE_ID } });
    expect(handled).toBe(true);
  });

  it("normalizes the lifecycle kind to (request, context)", async () => {
    const token = await validToken();
    let handled = false;
    const handler = withClockifyHandler(parser(), { kind: "lifecycle" }, async (_request, context) => {
      handled = true;
      expect(context.payload).toBeUndefined();
      return { status: 200, body: { addonId: context.claims.addonId } };
    });

    const valid = await handler(request({ [ClockifyHeaders.LIFECYCLE_TOKEN]: token }));
    expect(valid).toEqual({ status: 200, body: { addonId: ADDON_ID } });
    expect(handled).toBe(true);
  });

  it("normalizes the statusChanged, settingsUpdated, and deleted kinds, exposing payload on context", async () => {
    const token = await validToken();
    const headers = { [ClockifyHeaders.LIFECYCLE_TOKEN]: token };

    const statusPayload: ClockifyStatusChangedLifecyclePayload = {
      addonId: ADDON_ID,
      workspaceId: WORKSPACE_ID,
      status: "ACTIVE",
    };
    const statusHandler = withClockifyHandler(
      parser(),
      { kind: "statusChanged" },
      async (_request, context) => {
        expect(context.payload).toBe(statusPayload);
        return { status: 200 };
      },
    );
    await expect(
      statusHandler({ ...request(headers), body: statusPayload }),
    ).resolves.toEqual({ status: 200 });

    const settingsPayload: ClockifySettingsUpdatedLifecyclePayload = {
      addonId: ADDON_ID,
      workspaceId: WORKSPACE_ID,
      settings: [{ id: "setting-1", name: "Setting", value: true }],
    };
    const settingsHandler = withClockifyHandler(
      parser(),
      { kind: "settingsUpdated" },
      async (_request, context) => {
        expect(context.payload).toBe(settingsPayload);
        return { status: 200 };
      },
    );
    await expect(
      settingsHandler({ ...request(headers), body: settingsPayload }),
    ).resolves.toEqual({ status: 200 });

    const deletedPayload: ClockifyDeletedLifecyclePayload = {
      addonId: ADDON_ID,
      workspaceId: WORKSPACE_ID,
      asUser: "admin-user",
    };
    const deletedHandler = withClockifyHandler(
      parser(),
      { kind: "deleted" },
      async (_request, context) => {
        expect(context.payload).toBe(deletedPayload);
        return { status: 200 };
      },
    );
    await expect(
      deletedHandler({ ...request(headers), body: deletedPayload }),
    ).resolves.toEqual({ status: 200 });
  });

  it("normalizes the component kind to (request, context)", async () => {
    const token = await validToken({ user: "component-user", workspaceRole: "ADMIN" });
    let handled = false;
    const handler = withClockifyHandler(
      parser(),
      { kind: "component", expectedWorkspaceId: WORKSPACE_ID, expectedAddonId: ADDON_ID },
      async (_request, context) => {
        handled = true;
        expect(context.payload).toBeUndefined();
        expect(context.eventType).toBeUndefined();
        return { status: 200, body: { user: context.claims.user } };
      },
    );

    const valid = await handler(
      componentRequest(new URLSearchParams({ [ClockifyQueryParams.AUTH_TOKEN]: token })),
    );
    expect(valid).toEqual({ status: 200, body: { user: "component-user" } });
    expect(handled).toBe(true);

    handled = false;
    const invalid = await handler(componentRequest(new URLSearchParams()));
    expect(invalid).toEqual({ status: 401, body: "Unauthorized" });
    expect(handled).toBe(false);
  });

  it("normalizes the installed lifecycle kind, exposing payload on context", async () => {
    const token = await validToken();
    const payload: ClockifyInstalledLifecyclePayload = {
      addonId: ADDON_ID,
      authToken: "installation-token",
      workspaceId: WORKSPACE_ID,
      asUser: "admin-user",
      apiUrl: "https://developer.clockify.me/api",
      addonUserId: "addon-user",
      webhooks: [],
    };
    let handled = false;
    const handler = withClockifyHandler(
      parser(),
      { kind: "installed", expectedWorkspaceId: WORKSPACE_ID, expectedAddonId: ADDON_ID },
      async (_request, context) => {
        handled = true;
        expect(context.payload).toBe(payload);
        return { status: 201, body: { workspaceId: context.claims.workspaceId } };
      },
    );

    const valid = await handler({
      ...request({ [ClockifyHeaders.LIFECYCLE_TOKEN]: token }),
      body: payload,
    });
    expect(valid).toEqual({ status: 201, body: { workspaceId: WORKSPACE_ID } });
    expect(handled).toBe(true);
  });

  it("normalizes the webhook kind, exposing eventType on context", async () => {
    const token = await signTestToken(keys.privateKey, ADDON_KEY, {
      workspaceId: WORKSPACE_ID,
      addonId: ADDON_ID,
    });
    let handled = false;
    const handler = withClockifyHandler(
      parser(),
      { kind: "webhook", expectedEventType: "EXPENSE_CREATED", expectedWebhookAuthToken: token },
      async (_request, context) => {
        handled = true;
        expect(context.eventType).toBe("EXPENSE_CREATED");
        return { status: 204 };
      },
    );

    const valid = await handler(
      request({
        [ClockifyHeaders.SIGNATURE]: token,
        [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_CREATED",
      }),
    );
    expect(valid).toEqual({ status: 204 });
    expect(handled).toBe(true);

    handled = false;
    const invalid = await handler(request({}));
    expect(invalid).toEqual({ status: 401, body: "Unauthorized" });
    expect(handled).toBe(false);
  });
});

describe("verifier naming aliases (deprecated, additive)", () => {
  it("verifyComponentToken is verifyClockifyComponentRequest", () => {
    expect(verifyComponentToken).toBe(verifyClockifyComponentRequest);
  });

  it("verifyLifecycleToken is verifyClockifyLifecycleRequest", () => {
    expect(verifyLifecycleToken).toBe(verifyClockifyLifecycleRequest);
  });

  it("verifyWebhookToken is verifyClockifyWebhookRequest", () => {
    expect(verifyWebhookToken).toBe(verifyClockifyWebhookRequest);
  });
});
