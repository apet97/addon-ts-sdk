export interface AddonResponse {
  readonly status?: number;
  readonly headers?: Record<string, string>;
  readonly body?: string | Uint8Array | object | null;
}
