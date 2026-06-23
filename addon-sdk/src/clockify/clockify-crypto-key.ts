import type { CryptoKey, JWK, KeyObject } from "jose" with { "resolution-mode": "import" };

export type ClockifyCryptoKey = CryptoKey | KeyObject | JWK | Uint8Array;
export type ClockifyPublicKeyInput = string | ClockifyCryptoKey;
export type ClockifyPrivateKeyInput = ClockifyCryptoKey;
