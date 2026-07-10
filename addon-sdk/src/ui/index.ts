/** The supported message envelope sent by Clockify to an iframe component. */
export interface ClockifyWindowMessage {
  readonly title: string;
  readonly body?: unknown;
}

/** Minimal browser window contract used by the UI bridge and test doubles. */
export interface ClockifyBrowserWindow {
  readonly parent: { postMessage(message: string, targetOrigin: string): void };
  addEventListener(
    name: "message",
    listener: (event: {
      readonly origin: string;
      readonly source: unknown;
      readonly data: unknown;
    }) => void,
  ): void;
  removeEventListener(
    name: "message",
    listener: (event: {
      readonly origin: string;
      readonly source: unknown;
      readonly data: unknown;
    }) => void,
  ): void;
}

/** Options required to establish a fail-closed Clockify iframe bridge. */
export interface CreateClockifyBridgeOptions {
  readonly window: ClockifyBrowserWindow;
  readonly parentOrigin: string;
}

/** Typed Clockify iframe messaging surface. */
export interface ClockifyBridge {
  subscribe(title: string, handler: (body: unknown) => void): () => void;
  dispatch(action: string, payload?: unknown): void;
  refreshAddonToken(): void;
  preview(): void;
  navigate(type: "tracker"): void;
  showToast(type: "info" | "warning" | "success" | "error", message: string): void;
  dispose(): void;
}

function assertParentOrigin(value: string): string {
  if (value === "*") throw new Error("A specific Clockify parent origin is required.");
  const url = new URL(value);
  const local =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("Clockify parent origin must use HTTPS outside localhost.");
  }
  if (url.origin !== value) throw new Error("Clockify parent origin must not include a path.");
  return url.origin;
}

function parseMessage(data: unknown): ClockifyWindowMessage | null {
  let candidate = data;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (typeof candidate !== "object" || candidate === null || !("title" in candidate)) return null;
  const title = (candidate as { readonly title?: unknown }).title;
  if (typeof title !== "string" || title.trim() === "") return null;
  return candidate as ClockifyWindowMessage;
}

/** Creates a source- and origin-checked bridge for Clockify iframe events and actions. */
export function createClockifyBridge(options: CreateClockifyBridgeOptions): ClockifyBridge {
  const origin = assertParentOrigin(options.parentOrigin);
  const handlers = new Map<string, Set<(body: unknown) => void>>();
  const listener = (event: {
    readonly origin: string;
    readonly source: unknown;
    readonly data: unknown;
  }) => {
    if (event.origin !== origin || event.source !== options.window.parent) return;
    const message = parseMessage(event.data);
    if (!message) return;
    for (const handler of handlers.get(message.title) ?? []) handler(message.body);
  };
  options.window.addEventListener("message", listener);

  const dispatch = (action: string, payload?: unknown): void => {
    const envelope = payload === undefined ? { action } : { action, payload };
    options.window.parent.postMessage(JSON.stringify(envelope), origin);
  };

  return {
    subscribe(title, handler) {
      const existing = handlers.get(title) ?? new Set<(body: unknown) => void>();
      existing.add(handler);
      handlers.set(title, existing);
      return () => existing.delete(handler);
    },
    dispatch,
    refreshAddonToken: () => dispatch("refreshAddonToken"),
    preview: () => dispatch("preview"),
    navigate: (type) => dispatch("navigate", { type }),
    showToast: (type, message) => dispatch("toastrPop", { type, message }),
    dispose() {
      handlers.clear();
      options.window.removeEventListener("message", listener);
    },
  };
}

/** Minimal document-root contract used by theme and language helpers. */
export interface ClockifyDocumentRoot {
  readonly dataset: Record<string, string>;
  lang: string;
}

/** Applies the verified Clockify user theme as a normalized data attribute. */
export function applyClockifyTheme(
  theme: string | undefined,
  root: Pick<ClockifyDocumentRoot, "dataset">,
): void {
  root.dataset.clockifyTheme = (theme?.trim() || "DEFAULT").toLowerCase();
}

/** Applies the verified Clockify user language to a document root. */
export function applyClockifyLanguage(
  language: string | undefined,
  root: Pick<ClockifyDocumentRoot, "lang">,
): void {
  root.lang = (language?.trim() || "EN").toLowerCase().replace("_", "-");
}

/** Formats a date using the user's locale while permitting explicit timezone policy. */
export function formatClockifyDate(
  value: Date | number,
  locale: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...options }).format(value);
}
