import { isHttpsOrLoopbackHttp } from "../shared/loopback";
import { isClockifyAdminRole as checkClockifyAdminRole } from "../clockify/clockify-request-wire";

/** True for Clockify owner and admin role values. */
export function isClockifyAdminRole(role: unknown): boolean {
  return checkClockifyAdminRole(role);
}

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
  /**
   * Observes a same-origin message the bridge could not parse as a
   * `ClockifyWindowMessage` — malformed JSON, or a missing/blank `title`.
   * The bridge always drops the message either way; this hook exists only
   * for debugging and never affects that drop behavior, even if it throws.
   */
  readonly onInvalidMessage?: (rawData: unknown, reason: "invalid-json" | "missing-title") => void;
}

/**
 * The add-on-dispatchable event names Clockify's window-messaging bridge documents. See
 * `MARKETPLACE_DOCS/10-window-events.md`'s "Event dispatch" section — Clockify states this list is
 * not final and is subject to change.
 */
export type ClockifyBridgeAction = "refreshAddonToken" | "preview" | "navigate" | "toastrPop";

/** Typed Clockify iframe messaging surface. */
export interface ClockifyBridge {
  subscribe(title: string, handler: (body: unknown) => void): () => void;
  dispatch(action: ClockifyBridgeAction, payload?: unknown): void;
  refreshAddonToken(): void;
  preview(): void;
  navigate(type: "tracker"): void;
  showToast(type: "info" | "warning" | "success" | "error", message: string): void;
  dispose(): void;
}

function assertParentOrigin(value: string): string {
  if (value === "*") throw new Error("A specific Clockify parent origin is required.");
  const url = new URL(value);
  if (!isHttpsOrLoopbackHttp(url)) {
    throw new Error("Clockify parent origin must use HTTPS outside localhost.");
  }
  if (url.origin !== value) throw new Error("Clockify parent origin must not include a path.");
  return url.origin;
}

function notifyInvalidMessage(
  onInvalidMessage: CreateClockifyBridgeOptions["onInvalidMessage"],
  rawData: unknown,
  reason: "invalid-json" | "missing-title",
): void {
  try {
    onInvalidMessage?.(rawData, reason);
  } catch {
    // An observer must never affect the bridge's drop behavior.
  }
}

function parseMessage(
  data: unknown,
  onInvalidMessage?: CreateClockifyBridgeOptions["onInvalidMessage"],
): ClockifyWindowMessage | null {
  let candidate = data;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      notifyInvalidMessage(onInvalidMessage, data, "invalid-json");
      return null;
    }
  }
  if (typeof candidate !== "object" || candidate === null || !("title" in candidate)) {
    notifyInvalidMessage(onInvalidMessage, data, "missing-title");
    return null;
  }
  const title = (candidate as { readonly title?: unknown }).title;
  if (typeof title !== "string" || title.trim() === "") {
    notifyInvalidMessage(onInvalidMessage, data, "missing-title");
    return null;
  }
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
    const message = parseMessage(event.data, options.onInvalidMessage);
    if (!message) return;
    for (const handler of handlers.get(message.title) ?? []) handler(message.body);
  };
  options.window.addEventListener("message", listener);

  const dispatch = (action: ClockifyBridgeAction, payload?: unknown): void => {
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
  readonly dataset: Record<string, string | undefined>;
  lang: string;
}

const CLOCKIFY_EXPLICIT_DATE_TIME_KEYS = [
  "dateStyle",
  "timeStyle",
  "weekday",
  "era",
  "year",
  "month",
  "day",
  "dayPeriod",
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "timeZoneName",
] as const satisfies readonly (keyof Intl.DateTimeFormatOptions)[];

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
  root.lang = (language?.trim() || "EN").toLowerCase().replaceAll("_", "-");
}

/**
 * Formats a date with the user's locale and explicit options. Uses medium `dateStyle` only when the
 * options contain no date or time fields or styles. Falls back to `"en"` for an invalid locale tag.
 */
export function formatClockifyDate(
  value: Date | number,
  locale: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const formatterOptions = CLOCKIFY_EXPLICIT_DATE_TIME_KEYS.some(
    (key) => options[key] !== undefined,
  )
    ? options
    : { dateStyle: "medium" as const, ...options };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(locale, formatterOptions);
  } catch {
    formatter = new Intl.DateTimeFormat("en", formatterOptions);
  }
  return formatter.format(value);
}
