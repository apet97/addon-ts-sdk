// End-to-end request/JWT path: drives the ported EXPENSE_CREATED webhook handler
// (snippets/expense-webhook) through addon.handle() with REAL RS256 tokens, mirroring
// mileage-for-clockify's MileageWebhookIntegrationTest.
import { describe, it, expect, beforeAll } from "vitest";
import type { ClockifyWebhookAuthTokenLookup } from "../../src";
import { generateTestKeys, signTestToken } from "../../src/testing";
import { createExpenseWebhookAddon, ConvertFn } from "../../snippets/expense-webhook";

const KEY = "mileage-for-clockify";

let keys: Awaited<ReturnType<typeof generateTestKeys>>;
beforeAll(async () => {
  keys = await generateTestKeys();
});

interface Recorded {
  workspaceId?: string;
  expenseId: string;
  source: string;
  eventType: string;
}

function buildAddon(getExpectedWebhookAuthToken: ClockifyWebhookAuthTokenLookup = () => undefined) {
  const conversions: Recorded[] = [];
  const onConvert: ConvertFn = (claims, expenseId, source, eventType) => {
    conversions.push({ workspaceId: claims.workspaceId, expenseId, source, eventType });
  };
  const addon = createExpenseWebhookAddon({
    key: KEY,
    name: "Mileage for Clockify",
    baseUrl: "https://mileage.example.test",
    publicKey: keys.pem,
    getExpectedWebhookAuthToken,
    onConvert,
  });
  return { addon, conversions };
}

function validToken(extraClaims: Record<string, unknown> = {}) {
  return signTestToken(keys.privateKey, KEY, {
    workspaceId: "ws-webhook",
    addonId: "addon-webhook",
    user: "user-claims",
    workspaceRole: "OWNER",
    ...extraClaims,
  });
}

function post(path: string, headers: Record<string, string>, body: unknown) {
  return { method: "POST", path, headers, body } as const;
}

const SIG = "clockify-signature";
const EVENT = "clockify-webhook-event-type";
const PATH = "/webhook/expense-created";

describe("Ported EXPENSE_CREATED webhook (real RS256 token)", () => {
  it("valid token + full payload → converts using `id`", async () => {
    const token = await validToken();
    const lookups: Parameters<ClockifyWebhookAuthTokenLookup>[0][] = [];
    const { addon, conversions } = buildAddon((input) => {
      lookups.push(input);
      return token;
    });
    const res = await addon.handle(
      post(
        PATH,
        { [SIG]: token, [EVENT]: "EXPENSE_CREATED", "content-type": "application/json" },
        {
          id: "exp-1",
          workspaceId: "ws-webhook",
          userId: "user-1",
          date: "2026-05-24",
          categoryId: "cat-input",
          quantity: 37.4,
          billable: true,
          total: 0,
        },
      ),
    );
    expect(res.status).toBe(200);
    expect(conversions).toEqual([
      {
        workspaceId: "ws-webhook",
        expenseId: "exp-1",
        source: "WEBHOOK_CREATED",
        eventType: "EXPENSE_CREATED",
      },
    ]);
    expect(lookups).toEqual([
      {
        workspaceId: "ws-webhook",
        addonId: "addon-webhook",
        eventType: "EXPENSE_CREATED",
      },
    ]);
  });

  it("valid token + reference payload → converts using `expenseId`", async () => {
    const token = await validToken();
    const { addon, conversions } = buildAddon(() => token);
    const res = await addon.handle(
      post(
        PATH,
        { [SIG]: token, [EVENT]: "EXPENSE_CREATED" },
        {
          workspaceId: "ws-webhook",
          userId: "user-1",
          expenseId: "exp-ref",
          categoryId: "cat-input",
        },
      ),
    );
    expect(res.status).toBe(200);
    expect(conversions).toEqual([
      {
        workspaceId: "ws-webhook",
        expenseId: "exp-ref",
        source: "WEBHOOK_CREATED",
        eventType: "EXPENSE_CREATED",
      },
    ]);
  });

  it("valid token + payload without an id → 200 no-op (no conversion)", async () => {
    const token = await validToken();
    const { addon, conversions } = buildAddon(() => token);
    const res = await addon.handle(
      post(
        PATH,
        { [SIG]: token, [EVENT]: "EXPENSE_CREATED" },
        { workspaceId: "ws-webhook", categoryId: "cat-input" },
      ),
    );
    expect(res.status).toBe(200);
    expect(conversions).toEqual([]);
  });

  it("missing signature header → 401, no conversion", async () => {
    const { addon, conversions } = buildAddon();
    const res = await addon.handle(
      post(PATH, { "content-type": "application/json" }, { id: "exp-1" }),
    );
    expect(res.status).toBe(401);
    expect(conversions).toEqual([]);
  });

  it("garbage signature → 401, no conversion", async () => {
    const { addon, conversions } = buildAddon();
    const res = await addon.handle(post(PATH, { [SIG]: "not-a-jwt" }, { id: "exp-1" }));
    expect(res.status).toBe(401);
    expect(conversions).toEqual([]);
  });

  it("token signed for a different add-on key (subject mismatch) → 401", async () => {
    const { addon, conversions } = buildAddon();
    const wrong = await signTestToken(keys.privateKey, "some-other-addon", {
      workspaceId: "ws-webhook",
      addonId: "addon-webhook",
    });
    const res = await addon.handle(post(PATH, { [SIG]: wrong }, { id: "exp-1" }));
    expect(res.status).toBe(401);
    expect(conversions).toEqual([]);
  });

  it("missing webhook event header → 401, no conversion", async () => {
    const { addon, conversions } = buildAddon();
    const token = await validToken();
    const res = await addon.handle(post(PATH, { [SIG]: token }, { id: "exp-1" }));
    expect(res.status).toBe(401);
    expect(conversions).toEqual([]);
  });

  it("mismatched webhook event header → 401, no conversion", async () => {
    const { addon, conversions } = buildAddon();
    const token = await validToken();
    const res = await addon.handle(
      post(PATH, { [SIG]: token, [EVENT]: "EXPENSE_DELETED" }, { id: "exp-1" }),
    );
    expect(res.status).toBe(401);
    expect(conversions).toEqual([]);
  });

  it("missing stored webhook token → 401, no conversion", async () => {
    const token = await validToken();
    const { addon, conversions } = buildAddon(() => undefined);
    const res = await addon.handle(
      post(PATH, { [SIG]: token, [EVENT]: "EXPENSE_CREATED" }, { id: "exp-1" }),
    );
    expect(res.status).toBe(401);
    expect(conversions).toEqual([]);
  });

  it("does not respond to GET on the webhook path (POST-only) → 405", async () => {
    const { addon } = buildAddon();
    const res = await addon.handle({ method: "GET", path: PATH, headers: {} });
    expect(res.status).toBe(405);
  });
});
