import { createHash, createPublicKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CLOCKIFY_PLATFORM_PUBLIC_KEY_PEM,
  CLOCKIFY_PLATFORM_PUBLIC_KEY_SHA256,
  ClockifySignatureParser,
  createClockifySignatureParser,
} from "../src";

const PEM_BLOCK = /-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/;

describe("Clockify platform public key", () => {
  it("exports Clockify's parseable RSA SPKI public key with its pinned fingerprint", () => {
    const key = createPublicKey(CLOCKIFY_PLATFORM_PUBLIC_KEY_PEM);
    expect(key.asymmetricKeyType).toBe("rsa");

    const der = key.export({ type: "spki", format: "der" });
    const fingerprint = createHash("sha256").update(der).digest("hex");
    expect(fingerprint).toBe(CLOCKIFY_PLATFORM_PUBLIC_KEY_SHA256);
    expect(CLOCKIFY_PLATFORM_PUBLIC_KEY_SHA256).toBe(
      "0cebc449014cf940ad0763e204b29b3a2263abfa1ccd298347c9bd2db2708b16",
    );
  });

  it("matches the public key published in the Marketplace authentication docs", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const docPath = resolve(here, "../../MARKETPLACE_DOCS/08-authentication-and-authorization.md");
    // MARKETPLACE_DOCS lives at the repo root, outside the published tarball, so a
    // standalone install can't run this drift guard — skip it gracefully when absent.
    if (!existsSync(docPath)) return;

    const published = readFileSync(docPath, "utf8").match(PEM_BLOCK);
    expect(published).not.toBeNull();
    expect(published![0].trim()).toBe(CLOCKIFY_PLATFORM_PUBLIC_KEY_PEM.trim());
  });

  it("creates a signature parser using the built-in platform key by default", () => {
    const parser = createClockifySignatureParser("my-addon");

    expect(parser).toBeInstanceOf(ClockifySignatureParser);
  });
});
