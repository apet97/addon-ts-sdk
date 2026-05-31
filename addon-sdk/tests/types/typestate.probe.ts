// Compile-only type-state probes. Compiled by tsconfig.typecheck.json, NOT run by vitest.
// Each @ts-expect-error must sit above a line that genuinely fails to type-check.
import { ClockifyAddon, generated } from "../../src";

// --- POSITIVE CONTROL: a fully valid chain MUST compile (no expect-error). ---
const _validComponent = generated.v1_4
  .ClockifyComponentBuilder()
  .type("sidebar")
  .allowAdmins()
  .path("/ui")
  .label("UI")
  .build();
void _validComponent;

// --- NEGATIVE: cannot build a manifest without its required steps. ---
// @ts-expect-error build() does not exist on the first required step (key)
generated.v1_4.ClockifyManifestBuilder().build();

// --- NEGATIVE: cannot build a component without required steps. ---
// @ts-expect-error build() does not exist on the first required step (type)
generated.v1_4.ClockifyComponentBuilder().build();

// --- NEGATIVE: cannot jump straight to build() after only the type step. ---
// @ts-expect-error build() is not available until accessLevel/path/label are set
generated.v1_4.ClockifyComponentBuilder().sidebar().build();

// --- NEGATIVE (version diff): v1.2 component type has no "invoices.action". ---
// @ts-expect-error "invoices.action" is not a valid v1.2 component type
generated.v1_2.ClockifyComponentBuilder().type("invoices.action");

// --- POSITIVE CONTROL: valid webhook and lifecycle chains MUST compile. ---
const _validWebhook = generated.v1_4
  .ClockifyWebhookBuilder()
  .event("NEW_PROJECT")
  .path("/hooks/np")
  .build();
void _validWebhook;

const _validLifecycle = generated.v1_4
  .ClockifyLifecycleEventBuilder()
  .path("/lc/install")
  .onInstalled()
  .build();
void _validLifecycle;

// --- NEGATIVE: cannot build a webhook without its required steps (event, path). ---
// @ts-expect-error build() does not exist on the first required step (event)
generated.v1_4.ClockifyWebhookBuilder().build();

// --- NEGATIVE: cannot build a lifecycle event without its required steps (path, type). ---
// @ts-expect-error build() does not exist on the first required step (path)
generated.v1_4.ClockifyLifecycleEventBuilder().build();

// --- POSITIVE CONTROL: a manifest of ANY version constructs an addon without an explicit
//     type parameter (version is inferred from the manifest). Regression guard for v1.5+. ---
const _v15Manifest = generated.v1_5
  .ClockifyManifestBuilder()
  .key("k")
  .name("n")
  .baseUrl("https://example.com/addon")
  .requireProPlan()
  .build();
const _v15Addon = new ClockifyAddon(_v15Manifest);
void _v15Addon;
