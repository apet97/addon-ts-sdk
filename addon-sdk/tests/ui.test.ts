import { describe, expect, it, vi } from "vitest";
import {
  applyClockifyLanguage,
  applyClockifyTheme,
  createClockifyBridge,
  formatClockifyDate,
} from "../src/ui";

describe("Clockify UI bridge", () => {
  it("accepts messages only from the configured parent source and origin", () => {
    const parent = { postMessage: vi.fn() };
    let listener: ((event: { origin: string; source: unknown; data: unknown }) => void) | undefined;
    const windowLike = {
      parent,
      addEventListener: (_name: "message", next: typeof listener) => {
        listener = next;
      },
      removeEventListener: vi.fn(),
    };
    const bridge = createClockifyBridge({
      window: windowLike,
      parentOrigin: "https://app.clockify.me",
    });
    const handler = vi.fn();
    bridge.subscribe("TIME_ENTRY_UPDATED", handler);

    listener?.({
      origin: "https://evil.example",
      source: parent,
      data: { title: "TIME_ENTRY_UPDATED", body: 1 },
    });
    listener?.({
      origin: "https://app.clockify.me",
      source: {},
      data: { title: "TIME_ENTRY_UPDATED", body: 2 },
    });
    listener?.({
      origin: "https://app.clockify.me",
      source: parent,
      data: { title: "TIME_ENTRY_UPDATED", body: 3 },
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(3);
    listener?.({ origin: "https://app.clockify.me", source: parent, data: "not-json" });
    listener?.({
      origin: "https://app.clockify.me",
      source: parent,
      data: JSON.stringify({ title: "TIME_ENTRY_UPDATED", body: 4 }),
    });
    expect(handler).toHaveBeenLastCalledWith(4);
  });

  it("dispatches typed actions without wildcard postMessage targets", () => {
    const parent = { postMessage: vi.fn() };
    const windowLike = { parent, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const bridge = createClockifyBridge({
      window: windowLike,
      parentOrigin: "https://app.clockify.me",
    });
    bridge.showToast("success", "Saved");
    bridge.refreshAddonToken();
    bridge.preview();
    bridge.navigate("tracker");
    expect(parent.postMessage).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({ action: "toastrPop", payload: { type: "success", message: "Saved" } }),
      "https://app.clockify.me",
    );
    expect(parent.postMessage.mock.calls.flat()).not.toContain("*");
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      JSON.stringify({ action: "navigate", payload: { type: "tracker" } }),
      "https://app.clockify.me",
    );
  });

  it("fails closed when the parent origin is not explicit HTTPS", () => {
    const windowLike = {
      parent: { postMessage: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    expect(() => createClockifyBridge({ window: windowLike, parentOrigin: "*" })).toThrow(
      /origin/i,
    );
    expect(() =>
      createClockifyBridge({ window: windowLike, parentOrigin: "http://app.clockify.me" }),
    ).toThrow(/HTTPS/i);
  });

  it("applies user theme/language and formats dates", () => {
    const root = { dataset: {} as Record<string, string>, lang: "" };
    applyClockifyTheme("DARK", root);
    applyClockifyLanguage("DE", root);
    expect(root.dataset.clockifyTheme).toBe("dark");
    expect(root.lang).toBe("de");
    expect(
      formatClockifyDate(new Date("2026-01-02T00:00:00Z"), "en-GB", { timeZone: "UTC" }),
    ).toContain("02");
    applyClockifyTheme(undefined, root);
    applyClockifyLanguage(undefined, root);
    expect(root.dataset.clockifyTheme).toBe("default");
    expect(root.lang).toBe("en");
  });

  it("unsubscribes and disposes its listener", () => {
    const parent = { postMessage: vi.fn() };
    let listener: ((event: { origin: string; source: unknown; data: unknown }) => void) | undefined;
    const removeEventListener = vi.fn();
    const windowLike = {
      parent,
      addEventListener: (_name: "message", next: typeof listener) => {
        listener = next;
      },
      removeEventListener,
    };
    const bridge = createClockifyBridge({
      window: windowLike,
      parentOrigin: "http://localhost:3000",
    });
    const handler = vi.fn();
    const unsubscribe = bridge.subscribe("EVENT", handler);
    unsubscribe();
    listener?.({ origin: "http://localhost:3000", source: parent, data: { title: "EVENT" } });
    expect(handler).not.toHaveBeenCalled();
    bridge.dispose();
    expect(removeEventListener).toHaveBeenCalledOnce();
  });
});
