import { jwtVerify, importSPKI, KeyLike } from "jose";

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
  private readonly publicKey: string | KeyLike | Uint8Array;
  private resolvedKey: KeyLike | Uint8Array | null = null;

  constructor(addonKey: string, publicKey: string | KeyLike | Uint8Array) {
    this.addonKey = addonKey;
    this.publicKey = publicKey;
  }

  async parseClaims(token: string): Promise<ClockifyAddonClaims> {
    if (!this.resolvedKey) {
      if (typeof this.publicKey === "string") {
        this.resolvedKey = await importSPKI(this.publicKey, "RS256");
      } else {
        this.resolvedKey = this.publicKey;
      }
    }

    const { payload } = await jwtVerify(token, this.resolvedKey, {
      issuer: CLOCKIFY_JWT_ISSUER,
      subject: this.addonKey,
    });

    if (payload.type !== CLOCKIFY_JWT_ADDON_TYPE) {
      throw new Error("Invalid token type.");
    }

    return payload as ClockifyAddonClaims;
  }
}

