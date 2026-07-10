import type { ClockifyLifecycleWebhookToken } from "./clockify-lifecycle";
import type { ClockifyCryptoKey } from "./clockify-crypto-key";

/** Web Crypto AES-GCM key accepted without requiring consumer DOM library declarations. */
export type ClockifyAesGcmKey = Extract<
  ClockifyCryptoKey,
  { readonly algorithm: unknown; readonly usages: readonly string[] }
>;

/** Persisted server-side context for one Clockify add-on installation. */
export interface ClockifyInstallationContext {
  readonly workspaceId: string;
  readonly addonId: string;
  readonly addonUserId: string;
  readonly asUser: string;
  readonly apiUrl: string;
  readonly authToken: string;
  readonly installedAt: number;
  readonly webhooks?: readonly ClockifyLifecycleWebhookToken[];
}

/** Generation-aware input used to delete one installation. */
export interface ClockifyInstallationDeleteInput {
  readonly workspaceId: string;
  readonly addonId: string;
  readonly installedAt?: number;
}

/** Result of an installation deletion attempt. */
export type ClockifyInstallationDeleteResult = "deleted" | "missing" | "stale";

/** Minimal persistence contract required by the lifecycle helpers. */
export interface ClockifyInstallationStore {
  load(workspaceId: string, addonId: string): Promise<ClockifyInstallationContext | null>;
  save(context: ClockifyInstallationContext): Promise<void>;
  delete(input: ClockifyInstallationDeleteInput): Promise<ClockifyInstallationDeleteResult>;
}

function storageKey(workspaceId: string, addonId: string): string {
  return `${encodeURIComponent(workspaceId)}:${encodeURIComponent(addonId)}`;
}

function cloneContext(context: ClockifyInstallationContext): ClockifyInstallationContext {
  return {
    ...context,
    ...(context.webhooks ? { webhooks: context.webhooks.map((webhook) => ({ ...webhook })) } : {}),
  };
}

/** In-memory installation store intended for tests and single-process development. */
export class InMemoryClockifyInstallationStore implements ClockifyInstallationStore {
  private readonly records = new Map<string, ClockifyInstallationContext>();

  async load(workspaceId: string, addonId: string): Promise<ClockifyInstallationContext | null> {
    const context = this.records.get(storageKey(workspaceId, addonId));
    return context ? cloneContext(context) : null;
  }

  async save(context: ClockifyInstallationContext): Promise<void> {
    assertInstallationContext(context);
    const key = storageKey(context.workspaceId, context.addonId);
    const current = this.records.get(key);
    if (current && current.installedAt > context.installedAt) return;
    this.records.set(key, cloneContext(context));
  }

  async delete(input: ClockifyInstallationDeleteInput): Promise<ClockifyInstallationDeleteResult> {
    const key = storageKey(input.workspaceId, input.addonId);
    const current = this.records.get(key);
    if (!current) return "missing";
    if (input.installedAt !== undefined && input.installedAt !== current.installedAt)
      return "stale";
    this.records.delete(key);
    return "deleted";
  }
}

/** Reversible token codec used by encrypted installation-store wrappers. */
export interface ClockifyTokenCodec {
  encode(token: string): Promise<string>;
  decode(encoded: string): Promise<string>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Creates an AES-256-GCM token codec backed exclusively by Web Crypto. */
export function createClockifyAesGcmTokenCodec(key: ClockifyAesGcmKey): ClockifyTokenCodec {
  return {
    async encode(token) {
      if (token.trim() === "") throw new Error("Clockify auth token must not be empty.");
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(token),
      );
      return `enc:v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ciphertext))}`;
    },
    async decode(encoded) {
      const parts = encoded.split(":");
      if (parts.length !== 4 || parts[0] !== "enc" || parts[1] !== "v1") {
        throw new Error("Invalid encrypted Clockify token encoding.");
      }
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(parts[2]) },
        key,
        base64ToBytes(parts[3]),
      );
      return new TextDecoder().decode(plaintext);
    },
  };
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim() === "") throw new Error(`Clockify ${field} must not be empty.`);
}

function assertInstallationContext(context: ClockifyInstallationContext): void {
  assertNonEmpty(context.workspaceId, "workspace id");
  assertNonEmpty(context.addonId, "add-on id");
  assertNonEmpty(context.authToken, "auth token");
  if (!Number.isFinite(context.installedAt))
    throw new Error("Clockify installedAt must be finite.");
  for (const webhook of context.webhooks ?? [])
    assertNonEmpty(webhook.authToken, "webhook auth token");
}

/** Wraps a store so installation and nested webhook credentials are encrypted at rest. */
export function wrapClockifyInstallationStoreWithEncryption(
  store: ClockifyInstallationStore,
  codec: ClockifyTokenCodec,
): ClockifyInstallationStore {
  return {
    async load(workspaceId, addonId) {
      const stored = await store.load(workspaceId, addonId);
      if (!stored) return null;
      try {
        return {
          ...stored,
          authToken: await codec.decode(stored.authToken),
          ...(stored.webhooks
            ? {
                webhooks: await Promise.all(
                  stored.webhooks.map(async (webhook) => ({
                    ...webhook,
                    authToken: await codec.decode(webhook.authToken),
                  })),
                ),
              }
            : {}),
        };
      } catch {
        return null;
      }
    },
    async save(context) {
      assertInstallationContext(context);
      await store.save({
        ...context,
        authToken: await codec.encode(context.authToken),
        ...(context.webhooks
          ? {
              webhooks: await Promise.all(
                context.webhooks.map(async (webhook) => ({
                  ...webhook,
                  authToken: await codec.encode(webhook.authToken),
                })),
              ),
            }
          : {}),
      });
    },
    delete(input) {
      return store.delete(input);
    },
  };
}
