export interface AddonRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly query?: URLSearchParams;
  readonly body?: any;
  readonly rawBody?: Uint8Array;
}
