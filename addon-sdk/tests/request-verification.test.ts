import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import {
  AddonRequest,
  ClockifyHeaders,
  ClockifyQueryParams,
  ClockifySignatureParser,
  getClockifyEnvironmentContext,
  getClockifyHeader,
  verifyClockifyRequest,
  withClockifyVerifiedRequest,
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

    expect(result).toMatchObject({ ok: true, claims: { workspaceId: WORKSPACE_ID, addonId: ADDON_ID } });
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
