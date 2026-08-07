import { describe, expect, it } from "vitest";
import { createFetchBasicAddon, handleFetchBasicRequest } from "../snippets/fetch-basic";

describe("fetch-basic example", () => {
  it("serves the manifest through the framework-free Fetch adapter", async () => {
    const addon = createFetchBasicAddon();
    const response = await handleFetchBasicRequest(
      addon,
      new Request("https://example.com/manifest", { method: "GET" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    await expect(response.json()).resolves.toMatchObject({
      key: "fetch-basic-addon",
      schemaVersion: "1.5",
    });
  });
});
