import { describe, expect, it, vi, beforeEach } from "vitest";

const { createNodeHttpAddonServer } = vi.hoisted(() => ({
  createNodeHttpAddonServer: vi.fn(() => ({
    listen: vi.fn(),
  })),
}));

vi.mock("../src/adapters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/adapters")>();
  return {
    ...actual,
    createNodeHttpAddonServer,
  };
});

describe("secure server example", () => {
  beforeEach(() => {
    vi.resetModules();
    createNodeHttpAddonServer.mockClear();
  });

  it("does not start a server when the example module is imported", async () => {
    await import("../snippets/secure-server");

    expect(createNodeHttpAddonServer).not.toHaveBeenCalled();
  }, 15_000);

  it("finds stored webhook tokens when Clockify reports absolute lifecycle webhook paths", async () => {
    const { createInMemorySecureServerStore } = await import("../snippets/secure-server");
    const store = createInMemorySecureServerStore("https://example.com/addon");

    await store.saveInstallation(
      {
        addonId: "addon-1",
        authToken: "installation-token",
        workspaceId: "workspace-1",
        asUser: "user-1",
        apiUrl: "https://api.clockify.example/api",
        addonUserId: "addon-user-1",
        webhooks: [
          {
            path: "https://example.com/addon/webhooks/expense-created",
            webhookType: "ADDON",
            authToken: "webhook-token",
          },
        ],
      },
      {
        type: "addon",
        iss: "clockify",
        sub: "secure-addon",
        workspaceId: "workspace-1",
        addonId: "addon-1",
      },
    );

    await expect(
      Promise.resolve(
        store.findWebhookAuthToken({
          workspaceId: "workspace-1",
          addonId: "addon-1",
          path: "/webhooks/expense-created",
          eventType: "EXPENSE_CREATED",
        }),
      ),
    ).resolves.toBe("webhook-token");
  }, 15_000);

  it("uses the SDK verification wrappers instead of local payload guards", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../snippets/secure-server/index.ts", import.meta.url), "utf8"),
    );

    expect(source).toContain("withClockifyVerifiedComponentRequest");
    expect(source).toContain("withClockifyInstalledLifecycleRequest");
    expect(source).toContain("withClockifyVerifiedWebhookRequest");
    expect(source).not.toContain("function isInstalledPayload");
    expect(source).not.toContain("function installationPayloadMatchesClaims");
    expect(source).not.toContain("as VerifiedInstallationClaims");
  });
});
