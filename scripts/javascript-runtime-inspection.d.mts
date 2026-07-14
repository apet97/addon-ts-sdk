export interface RuntimeJavaScriptInspectionOptions {
  readonly forbidImports?: boolean;
}

export interface RuntimeJavaScriptFinding {
  readonly kind: string;
  readonly message: string;
  readonly line: number;
  readonly column: number;
}

export function inspectRuntimeJavaScript(
  source: string,
  options?: RuntimeJavaScriptInspectionOptions,
): RuntimeJavaScriptFinding[];
