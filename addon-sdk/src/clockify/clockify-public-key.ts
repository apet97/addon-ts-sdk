import type { ClockifyPublicKeyInput } from "./clockify-crypto-key";
import { ClockifySignatureParser } from "./clockify-signature-parser";

/**
 * SHA-256 fingerprint of the public key, computed over its DER/SPKI encoding
 * (not the PEM text). Pin against this when verifying the key out of band.
 */
export const CLOCKIFY_PLATFORM_PUBLIC_KEY_SHA256 =
  "0cebc449014cf940ad0763e204b29b3a2263abfa1ccd298347c9bd2db2708b16";

/**
 * Clockify's published RS256 platform public key for add-on JWT verification.
 * Fixed, non-secret SPKI PEM value, identical to the key published in the
 * Marketplace authentication docs. Override only for a non-production Clockify
 * environment that signs with a different key.
 */
export const CLOCKIFY_PLATFORM_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAubktufFNO/op+E5WBWL6
/Y9QRZGSGGCsV00FmPRl5A0mSfQu3yq2Yaq47IlN0zgFy9IUG8/JJfwiehsmbrKa
49t/xSkpG1u9w1GUyY0g4eKDUwofHKAt3IPw0St4qsWLK9mO+koUo56CGQOEpTui
5bMfmefVBBfShXTaZOtXPB349FdzSuYlU/5o3L12zVWMutNhiJCKyGfsuu2uXa9+
6uQnZBw1wO3/QEci7i4TbC+ZXqW1rCcbogSMORqHAP6qSAcTFRmrjFAEsOWiUUhZ
rLDg2QJ8VTDghFnUhYklNTJlGgfo80qEWe1NLIwvZj0h3bWRfrqZHsD/Yjh0duk6
yQIDAQAB
-----END PUBLIC KEY-----
`;

export interface CreateClockifySignatureParserOptions {
  publicKey?: ClockifyPublicKeyInput;
}

/**
 * Creates a Clockify add-on JWT parser using the platform public key by default.
 * Pass a public key override only for a Clockify environment with a different signer.
 */
export function createClockifySignatureParser(
  addonKey: string,
  options: CreateClockifySignatureParserOptions = {},
): ClockifySignatureParser {
  return new ClockifySignatureParser(
    addonKey,
    options.publicKey ?? CLOCKIFY_PLATFORM_PUBLIC_KEY_PEM,
  );
}
