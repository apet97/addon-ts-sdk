import { describe, it, expect, beforeAll } from "vitest";
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
          [ClockifyHeaders.SIGNATURE]: token,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: ["EXPENSE_CREATED", "EXPENSE_CREATED"],
        }),
        { expectedEventType: "EXPENSE_CREATED" },
      ),
    ).resolves.toEqual({ ok: false, reason: "ambiguous-event-type" });
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
      }),
    ).resolves.toEqual({ ok: false, reason: "missing-event-type" });

    await expect(
      verifyClockifyWebhookRequest(
        parser(),
        request({
          [ClockifyHeaders.SIGNATURE]: token,
          [ClockifyHeaders.WEBHOOK_EVENT_TYPE]: "EXPENSE_DELETED",
        }),
        { expectedEventType: "EXPENSE_CREATED" },
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

  it("normalizes Clockify environment URLs without adding production fallbacks", () => {
    expect(resolveClockifyApiBaseUrl({ apiUrl: "https://developer.clockify.me/api" })).toBe(
      "https://developer.clockify.me/api/v1",
    );
    expect(resolveClockifyApiBaseUrl({ apiUrl: "https://x.clockify.me/api/v1" })).toBe(
      "https://x.clockify.me/api/v1",
    );
    expect(
      resolveClockifyApiBaseUrl({
        apiUrl: "https://developer.clockify.me/api",
        backendUrl: "https://api.clockify.me/api",
      }),
    ).toBe("https://developer.clockify.me/api/v1");
    expect(resolveClockifyApiBaseUrl({})).toBeUndefined();
    expect(
      resolveClockifyReportsBaseUrl({ reportsUrl: "https://developer.clockify.me/report" }),
    ).toBe("https://developer.clockify.me/report/v1");
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

  it("wraps webhook handlers with stored-token lookup and strict context checks", async () => {
    const token = await validToken();
    const lookups: Array<{ workspaceId: string; addonId: string; eventType: string }> = [];
    let handled = false;
    const handler = withClockifyVerifiedWebhookRequest(
      parser(),
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
    const missingClaims = withClockifyVerifiedWebhookRequest(
      parser(),
      {
        expectedEventType: "EXPENSE_CREATED",
        getExpectedWebhookAuthToken: () => tokenWithoutContext,
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
  });

  it("rejects webhook wrappers with ambiguous fixed and lookup token configuration", async () => {
    const token = await validToken();
    let handled = false;
    const handler = withClockifyVerifiedWebhookRequest(
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

  it("rejects webhook wrappers with missing expected event type", async () => {
    const token = await validToken();
    let handled = false;
    const handler = withClockifyVerifiedWebhookRequest(parser(), {} as any, async () => {
      handled = true;
      return { status: 204 };
    });

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
