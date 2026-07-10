import type { ClockifyCryptoKey, ClockifyPublicKeyInput } from "./clockify-crypto-key";

export const ClockifySignatureClaims = {
  TYPE: "type",
  BACKEND_URL: "backendUrl",
  PTO_URL: "ptoUrl",
  REPORTS_URL: "reportsUrl",
  LOCATIONS_URL: "locationsUrl",
  SCREENSHOTS_URL: "screenshotsUrl",
  WORKSPACE_ID: "workspaceId",
  ADDON_ID: "addonId",
  USER_ID: "user",
  WORKSPACE_ROLE: "workspaceRole",
  LANGUAGE: "language",
  THEME: "theme",
} as const;

export const CLOCKIFY_JWT_ISSUER = "clockify";
export const CLOCKIFY_JWT_ADDON_TYPE = "addon";

export interface ClockifyAddonClaims {
  type: "addon";
  iss: "clockify";
  sub: string;
  exp?: number;
  backendUrl?: string;
  ptoUrl?: string;
  reportsUrl?: string;
  locationsUrl?: string;
  screenshotsUrl?: string;
  workspaceId?: string;
  addonId?: string;
  user?: string;
  workspaceRole?: string;
  language?: string;
  theme?: string;
  [claim: string]: unknown;
}

export class ClockifySignatureParser {
  private readonly addonKey: string;
  private readonly publicKey: ClockifyPublicKeyInput;
  private resolvedKey: ClockifyCryptoKey | null = null;

  constructor(addonKey: string, publicKey: ClockifyPublicKeyInput) {
    if (addonKey.trim() === "") {
      throw new Error("Clockify add-on key must not be empty.");
    }
    this.addonKey = addonKey;
    this.publicKey = publicKey;
  }

  async parseClaims(token: string): Promise<ClockifyAddonClaims> {
    const { jwtVerify, importSPKI } = await import("jose");

    if (!this.resolvedKey) {
      if (typeof this.publicKey === "string") {
        this.resolvedKey = await importSPKI(this.publicKey, "RS256");
      } else {
        this.resolvedKey = this.publicKey;
      }
    }

    const { payload } = await jwtVerify(token, this.resolvedKey, {
      algorithms: ["RS256"],
      issuer: CLOCKIFY_JWT_ISSUER,
      subject: this.addonKey,
    });

    if (payload.type !== CLOCKIFY_JWT_ADDON_TYPE) {
      throw new Error("Invalid token type.");
    }

    return payload as ClockifyAddonClaims;
  }
}
