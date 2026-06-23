import type { ClockifyCryptoKey, ClockifyPrivateKeyInput } from "../clockify/clockify-crypto-key";

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
