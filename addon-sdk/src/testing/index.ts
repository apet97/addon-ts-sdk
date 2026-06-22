import { generateKeyPair, SignJWT, exportSPKI, type KeyLike } from "jose";

export async function generateTestKeys() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const pem = await exportSPKI(publicKey);
  return { publicKey, privateKey, pem };
}

export async function signTestToken(
  privateKey: KeyLike | Uint8Array,
  addonKey: string,
  claims: Record<string, unknown> = {},
  expiresIn = "30m",
) {
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
