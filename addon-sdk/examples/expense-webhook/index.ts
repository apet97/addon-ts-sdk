// Port of the `mileage-for-clockify` EXPENSE_CREATED webhook handler onto the TypeScript SDK.
//
// Java reference:
//   webhook/ExpenseCreatedWebhookHandler.java     (handler: resolve expenseId → convertIfEligible)
//   core/auth/filter/ClockifyWebhookAuthFilter     (verifies the Clockify-Signature JWT → 401)
//
// Real Clockify webhook request (see MileageWebhookIntegrationTest):
//   POST /webhook/expense-created
//   Clockify-Signature: <RSA JWT>            ← verified by ClockifySignatureParser
//   Clockify-Webhook-Event-Type: EXPENSE_CREATED
//   { "id": "...", "workspaceId": "...", "userId": "...", ... }   (or a reference payload with "expenseId")
import {
  ClockifyAddon,
  ClockifyManifest,
  ClockifySignatureParser,
  ClockifyAddonClaims,
  ClockifyHeaders,
  withClockifyVerifiedRequest,
  generated,
} from "../../src";

/** The Clockify expense webhook body. Full payloads carry `id`; reference payloads carry `expenseId`. */
export interface ExpenseWebhookPayload {
  id?: string;
  expenseId?: string;
  workspaceId?: string;
  userId?: string;
  date?: string;
  categoryId?: string;
  quantity?: number;
  billable?: boolean;
  total?: number;
}

/** Mirrors ExpenseCreatedWebhookHandler.expenseId(): `id` if non-blank, else `expenseId`, else null. */
export function resolveExpenseId(payload: ExpenseWebhookPayload | null | undefined): string | null {
  if (!payload) return null;
  if (typeof payload.id === "string" && payload.id.trim() !== "") return payload.id;
  if (typeof payload.expenseId === "string" && payload.expenseId.trim() !== "") return payload.expenseId;
  return null;
}

export type ConversionSource = "WEBHOOK_CREATED";
export type ConvertFn = (
  claims: ClockifyAddonClaims,
  expenseId: string,
  source: ConversionSource,
  eventType: string,
) => void | Promise<void>;

export interface ExpenseWebhookAddonOptions {
  key: string;
  name: string;
  baseUrl: string;
  /** The Clockify RSA public key (SPKI PEM) used to verify webhook signatures. */
  publicKey: string;
  /** Business hook invoked once a webhook is authenticated and an expense id is resolved. */
  onConvert: ConvertFn;
}

/**
 * Builds a Clockify add-on that registers the EXPENSE_CREATED webhook (schema 1.5) and routes it
 * through signature verification + the mileage conversion logic.
 */
export function createExpenseWebhookAddon(opts: ExpenseWebhookAddonOptions): ClockifyAddon<
  generated.v1_5.ClockifyManifest
> {
  const parser = new ClockifySignatureParser(opts.key, opts.publicKey);

  const manifest = ClockifyManifest.v1_5Builder()
    .key(opts.key)
    .name(opts.name)
    .baseUrl(opts.baseUrl)
    .requireProPlan()
    .scopes(["EXPENSE_READ", "EXPENSE_WRITE"])
    .build();

  const addon = new ClockifyAddon(manifest);

  const webhook = generated.v1_5
    .ClockifyWebhookBuilder()
    .event("EXPENSE_CREATED")
    .path("/webhook/expense-created")
    .build();

  addon.registerWebhook(
    webhook,
    withClockifyVerifiedRequest(
      parser,
      {
        expectedEventType: "EXPENSE_CREATED",
        eventHeader: ClockifyHeaders.WEBHOOK_EVENT_TYPE,
      },
      async (req, claims) => {
        const expenseId = resolveExpenseId(req.body as ExpenseWebhookPayload | undefined);
        if (!expenseId) {
          // Java handler returns void → 200 with no conversion.
          return { status: 200 };
        }
        await opts.onConvert(claims, expenseId, "WEBHOOK_CREATED", "EXPENSE_CREATED");
        return { status: 200 };
      },
    ),
  );

  return addon;
}
