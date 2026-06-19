import { describe, it, expect } from "vitest";
import { ClockifySignatureParser, ClockifySignatureClaims } from "../src";
import { generateTestKeys, signTestToken } from "../src/testing";
import { generateKeyPair, SignJWT } from "jose";

describe("ClockifySignatureParser", () => {
  const addonKey = "my-test-addon";

  it("should parse claims with a valid RSA signature and correct type/issuer/subject", async () => {
    const { publicKey, privateKey } = await generateTestKeys();
    const token = await signTestToken(privateKey, addonKey, {
      workspaceId: "w123",
      user: "u456",
      workspaceRole: "ADMIN",
    });

    const parser = new ClockifySignatureParser(addonKey, publicKey);
    const claims = await parser.parseClaims(token);

    expect(claims.type).toBe("addon");
    expect(claims.iss).toBe("clockify");
    expect(claims.sub).toBe(addonKey);
    expect(claims.workspaceId).toBe("w123");
    expect(claims.user).toBe("u456");
    expect(claims.workspaceRole).toBe("ADMIN");
  });

  it("should support public key passed as a PEM string", async () => {
    const { pem, privateKey } = await generateTestKeys();
    const token = await signTestToken(privateKey, addonKey, {
      workspaceId: "w123",
    });

    const parser = new ClockifySignatureParser(addonKey, pem);
    const claims = await parser.parseClaims(token);

    expect(claims.sub).toBe(addonKey);
    expect(claims.workspaceId).toBe("w123");
  });

  it("should fail validation if issuer is incorrect", async () => {
    const { publicKey, privateKey } = await generateTestKeys();
    const token = await new SignJWT({ type: "addon" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("wrong-issuer")
      .setSubject(addonKey)
      .setExpirationTime("30m")
      .sign(privateKey);

    const parser = new ClockifySignatureParser(addonKey, publicKey);
    await expect(parser.parseClaims(token)).rejects.toThrow();
  });

  it("should fail validation if the issuer claim is missing", async () => {
    const { publicKey, privateKey } = await generateTestKeys();
    const token = await new SignJWT({ type: "addon" })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(addonKey)
      .setExpirationTime("30m")
      .sign(privateKey);

    const parser = new ClockifySignatureParser(addonKey, publicKey);
    await expect(parser.parseClaims(token)).rejects.toThrow();
  });

  it("should fail validation if the subject claim is missing", async () => {
    const { publicKey, privateKey } = await generateTestKeys();
    const token = await new SignJWT({ type: "addon" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("clockify")
      .setExpirationTime("30m")
      .sign(privateKey);

    const parser = new ClockifySignatureParser(addonKey, publicKey);
    await expect(parser.parseClaims(token)).rejects.toThrow();
  });

  it("should fail validation if subject does not match addonKey", async () => {
    const { publicKey, privateKey } = await generateTestKeys();
    const token = await signTestToken(privateKey, "wrong-subject");

    const parser = new ClockifySignatureParser(addonKey, publicKey);
    await expect(parser.parseClaims(token)).rejects.toThrow();
  });

  it("should fail validation if type claim is not addon", async () => {
    const { publicKey, privateKey } = await generateTestKeys();
    const token = await signTestToken(privateKey, addonKey, {
      type: "user-token", // Not "addon"
    });

    const parser = new ClockifySignatureParser(addonKey, publicKey);
    await expect(parser.parseClaims(token)).rejects.toThrow("Invalid token type.");
  });

  it("should fail validation if signature is signed by a different key", async () => {
    const { publicKey } = await generateTestKeys();
    const otherKeys = await generateTestKeys();
    
    // Sign token with different private key
    const token = await signTestToken(otherKeys.privateKey, addonKey);

    const parser = new ClockifySignatureParser(addonKey, publicKey);
    await expect(parser.parseClaims(token)).rejects.toThrow();
  });

  it("should reject valid RSA JWTs that are not signed with RS256", async () => {
    const { publicKey, privateKey } = await generateKeyPair("PS256");
    const token = await new SignJWT({ type: "addon" })
      .setProtectedHeader({ alg: "PS256" })
      .setIssuer("clockify")
      .setSubject(addonKey)
      .setExpirationTime("30m")
      .sign(privateKey);

    const parser = new ClockifySignatureParser(addonKey, publicKey);
    await expect(parser.parseClaims(token)).rejects.toThrow();
  });

  it("should parse new claims (locationsUrl, screenshotsUrl, language, theme) if present in token", async () => {
    const { publicKey, privateKey } = await generateTestKeys();
    const token = await signTestToken(privateKey, addonKey, {
      locationsUrl: "https://example.com/locations",
      screenshotsUrl: "https://example.com/screenshots",
      language: "EN",
      theme: "DEFAULT",
    });

    const parser = new ClockifySignatureParser(addonKey, publicKey);
    const claims = await parser.parseClaims(token);

    expect(claims.locationsUrl).toBe("https://example.com/locations");
    expect(claims.screenshotsUrl).toBe("https://example.com/screenshots");
    expect(claims.language).toBe("EN");
    expect(claims.theme).toBe("DEFAULT");
  });

  it("should fail validation if token has expired", async () => {
    const { publicKey, privateKey } = await generateTestKeys();
    // Sign token with -1s expiration
    const token = await signTestToken(privateKey, addonKey, {}, "-1s");

    const parser = new ClockifySignatureParser(addonKey, publicKey);
    await expect(parser.parseClaims(token)).rejects.toThrow();
  });

  it("should fail validation for malformed token", async () => {
    const { publicKey } = await generateTestKeys();
    const parser = new ClockifySignatureParser(addonKey, publicKey);
    await expect(parser.parseClaims("not.a.jwt.token")).rejects.toThrow();
  });

  it("should export claim names constants matching Java plus new claims", () => {
    expect(ClockifySignatureClaims.TYPE).toBe("type");
    expect(ClockifySignatureClaims.BACKEND_URL).toBe("backendUrl");
    expect(ClockifySignatureClaims.PTO_URL).toBe("ptoUrl");
    expect(ClockifySignatureClaims.REPORTS_URL).toBe("reportsUrl");
    expect(ClockifySignatureClaims.LOCATIONS_URL).toBe("locationsUrl");
    expect(ClockifySignatureClaims.SCREENSHOTS_URL).toBe("screenshotsUrl");
    expect(ClockifySignatureClaims.WORKSPACE_ID).toBe("workspaceId");
    expect(ClockifySignatureClaims.ADDON_ID).toBe("addonId");
    expect(ClockifySignatureClaims.USER_ID).toBe("user");
    expect(ClockifySignatureClaims.WORKSPACE_ROLE).toBe("workspaceRole");
    expect(ClockifySignatureClaims.LANGUAGE).toBe("language");
    expect(ClockifySignatureClaims.THEME).toBe("theme");
  });
});
