import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scaffoldClockifyAddon } from "../../create-clockify-addon/src/index.mjs";

const creatorBin = resolve(
  import.meta.dirname,
  "../../create-clockify-addon/bin/create-clockify-addon.mjs",
);

function runCreator(args: readonly string[]): Promise<{
  readonly exitCode: number | null;
  readonly stderr: string;
  readonly stdout: string;
}> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [creatorBin, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (exitCode) => resolveResult({ exitCode, stderr, stdout }));
  });
}

describe("create-clockify-addon", () => {
  it("ships a typed programmatic export and a real workspace test command", async () => {
    const packageJson = JSON.parse(
      await readFile(
        resolve(import.meta.dirname, "../../create-clockify-addon/package.json"),
        "utf8",
      ),
    );

    expect(packageJson.types).toBe("./src/index.d.ts");
    expect(packageJson.exports).toEqual({
      ".": { types: "./src/index.d.ts", import: "./src/index.mjs" },
    });
    expect(packageJson.scripts.test).toBe(
      "npm test -w @apet97/clockify-addon-sdk -- tests/creator.test.ts",
    );
  });

  it("scaffolds with a default sdkSpec that matches the current addon-sdk package version", async () => {
    const addonSdkPackageJson = JSON.parse(
      await readFile(resolve(import.meta.dirname, "../package.json"), "utf8"),
    );
    const parent = await mkdtemp(join(tmpdir(), "clockify-addon-creator-"));
    const directory = join(parent, "default-spec-addon");
    try {
      // No sdkSpec override — exercises the same default `npm create clockify-addon` uses.
      await scaffoldClockifyAddon({ directory, runtime: "node", features: "minimal" });
      const packageJson = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));

      expect(packageJson.dependencies["@apet97/clockify-addon-sdk"]).toBe(
        `^${addonSdkPackageJson.version}`,
      );
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it.each(["node", "worker"] as const)("creates a fail-closed %s project", async (runtime) => {
    const parent = await mkdtemp(join(tmpdir(), "clockify-addon-creator-"));
    const directory = join(parent, `${runtime}-addon`);
    try {
      await scaffoldClockifyAddon({ directory, runtime, features: "all", sdkSpec: "^1.0.0" });
      const packageJson = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
      const source = await readFile(join(directory, "src", "addon.ts"), "utf8");
      const bootstrap = await readFile(join(directory, "src", "index.ts"), "utf8");
      const env = await readFile(join(directory, ".env.example"), "utf8");
      const readme = await readFile(join(directory, "README.md"), "utf8");

      expect(packageJson.dependencies["@apet97/clockify-addon-sdk"]).toBe("^1.0.0");
      expect(source).toContain("PUBLIC_BASE_URL");
      expect(bootstrap).toContain(
        `@apet97/clockify-addon-sdk/adapters/${runtime === "node" ? "node" : "fetch"}`,
      );
      expect(bootstrap).toContain('from "./addon.js"');
      expect(source).not.toContain("@apet97/clockify-addon-sdk/adapters/");
      expect(source).not.toContain("demo-token");
      expect(source).toContain("ALLOW_EPHEMERAL_STORAGE");
      expect(source).toContain("withClockifyInstalledLifecycleRequest");
      expect(source).toContain("getExpectedWebhookAuthToken");
      expect(source).toContain("normalizeClockifyWebhookPath(entry.path)");
      expect(source).toContain("normalizeClockifyWebhookPath(entry.path) === webhook.path");
      expect(source).not.toContain('entry.path.endsWith("/webhooks/time-entry")');
      expect(source).not.toContain(".components([component])");
      expect(source).not.toContain(".lifecycle([installed, deleted])");
      expect(source).not.toContain(".webhooks([webhook])");
      expect(env).toContain("PUBLIC_BASE_URL=https://");
      for (const heading of [
        "## Run locally",
        "## Configure Clockify",
        "## Request flow",
        "## Before production",
      ]) {
        expect(readme).toContain(heading);
      }
      expect(readme).toContain(runtime === "node" ? "npm start" : "wrangler dev");
      expect(readme).toContain("PUBLIC_BASE_URL");
      expect(readme).toContain("CLOCKIFY_PARENT_ORIGIN");
      expect(readme).toContain("replace-with-your-unique-addon-key");
      expect(readme).toContain("persistent encrypted installation store");
      expect(readme).toContain("GET /manifest");
      expect(readme).toContain("/component");
      for (const event of ["INSTALLED", "NEW_TIME_ENTRY", "DELETED"]) {
        expect(readme).toContain(event);
      }
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("refuses to overwrite a non-empty directory", async () => {
    const parent = await mkdtemp(join(tmpdir(), "clockify-addon-creator-"));
    try {
      await writeFile(join(parent, "existing.txt"), "keep");
      await expect(
        scaffoldClockifyAddon({ directory: parent, runtime: "node", features: "minimal" }),
      ).rejects.toThrow(/empty/i);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("validates programmatic options before touching the target", async () => {
    const parent = await mkdtemp(join(tmpdir(), "clockify-addon-creator-options-"));
    const directory = join(parent, "generated-addon");
    try {
      await expect(
        scaffoldClockifyAddon({ directory, runtime: "node", features: "minimal", sdkSpec: "" }),
      ).rejects.toThrow(/sdkSpec.*non-empty/i);
      await expect(readFile(join(directory, "package.json"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("keeps generated project names valid for package and Worker metadata", async () => {
    const parent = await mkdtemp(join(tmpdir(), "clockify-addon-creator-name-"));
    const directory = join(parent, `${"A".repeat(80)}.demo project`);
    try {
      await scaffoldClockifyAddon({ directory, runtime: "worker", features: "minimal" });
      const packageJson = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
      const wrangler = await readFile(join(directory, "wrangler.toml"), "utf8");
      expect(packageJson.name).toMatch(/^[a-z0-9][a-z0-9_-]{0,62}$/);
      expect(packageJson.name).not.toContain(".");
      expect(wrangler).toContain(`name = "${packageJson.name}"`);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("generates explicit Node port validation", async () => {
    const parent = await mkdtemp(join(tmpdir(), "clockify-addon-creator-port-"));
    const directory = join(parent, "node-addon");
    try {
      await scaffoldClockifyAddon({ directory, runtime: "node", features: "minimal" });
      const bootstrap = await readFile(join(directory, "src", "index.ts"), "utf8");
      expect(bootstrap).toContain("PORT must be an integer between 0 and 65535.");
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("keeps the minimal scaffold free of lifecycle and webhook routes", async () => {
    const parent = await mkdtemp(join(tmpdir(), "clockify-addon-creator-"));
    const directory = join(parent, "minimal-addon");
    try {
      await scaffoldClockifyAddon({ directory, runtime: "node", features: "minimal" });
      const source = await readFile(join(directory, "src", "addon.ts"), "utf8");
      const readme = await readFile(join(directory, "README.md"), "utf8");
      expect(source).not.toContain("ClockifyLifecycleEvent");
      expect(source).not.toContain("ClockifyWebhook");
      expect(source).toContain("ClockifyComponent");
      expect(source).not.toContain(".components([component])");
      expect(readme).toContain("/component");
      expect(readme).toContain("Lifecycle and webhook routes were not generated");
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it.each([
    ["default Node all-features", [], "node", "all"],
    ["separated Node minimal", ["--runtime", "node", "--features", "minimal"], "node", "minimal"],
    ["equals Worker all-features", ["--runtime=worker", "--features=all"], "worker", "all"],
    ["mixed Worker minimal", ["--runtime", "worker", "--features=minimal"], "worker", "minimal"],
  ] as const)(
    "generates the %s project through the real CLI",
    async (_label, flags, runtime, features) => {
      const parent = await mkdtemp(join(tmpdir(), "clockify-addon-cli-"));
      const directory = join(parent, "generated-addon");
      try {
        const result = await runCreator([directory, ...flags]);
        expect(result).toMatchObject({ exitCode: 0, stderr: "" });
        expect(result.stdout).toContain(`Created Clockify add-on in ${directory}`);

        const packageJson = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
        const source = await readFile(join(directory, "src", "addon.ts"), "utf8");
        const bootstrap = await readFile(join(directory, "src", "index.ts"), "utf8");
        const readme = await readFile(join(directory, "README.md"), "utf8");
        expect(packageJson.scripts.start).toBe(
          runtime === "node" ? "tsx src/index.ts" : "wrangler dev src/index.ts",
        );
        expect(bootstrap).toContain(
          `@apet97/clockify-addon-sdk/adapters/${runtime === "node" ? "node" : "fetch"}`,
        );
        expect(source).toContain("export function createAddon");
        expect(source.includes("ClockifyLifecycleEvent")).toBe(features === "all");
        expect(source.includes("ClockifyWebhook")).toBe(features === "all");
        expect(readme).toContain(runtime === "node" ? "npm start" : "wrangler dev");
        expect(readme).toContain(
          runtime === "node" ? "Node HTTP runtime entry point" : "Fetch/Worker runtime entry point",
        );
        if (features === "all") {
          for (const event of ["INSTALLED", "NEW_TIME_ENTRY", "DELETED"]) {
            expect(readme).toContain(event);
          }
          expect(readme).not.toContain("Lifecycle and webhook routes were not generated");
        } else {
          expect(readme).toContain("Lifecycle and webhook routes were not generated");
          for (const event of ["INSTALLED", "NEW_TIME_ENTRY", "DELETED"]) {
            expect(readme).not.toContain(event);
          }
        }
        expect(source).not.toMatch(/[ \t]+$/m);
        expect(bootstrap).not.toMatch(/[ \t]+$/m);
        expect(source).not.toContain("\n\n\n");
        expect(bootstrap).not.toContain("\n\n\n");
      } finally {
        await rm(parent, { recursive: true, force: true });
      }
    },
  );

  it.each([
    ["unknown flag", ["--unknown"]],
    ["invalid runtime", ["--runtime=deno"]],
    ["invalid features", ["--features", "everything"]],
    ["missing runtime value", ["--runtime"]],
    ["missing features value", ["--features"]],
    ["extra positional", ["another-directory"]],
  ] as const)("rejects %s before creating project files", async (_label, invalidArgs) => {
    const parent = await mkdtemp(join(tmpdir(), "clockify-addon-cli-invalid-"));
    const directory = join(parent, "generated-addon");
    try {
      const result = await runCreator([directory, ...invalidArgs]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/usage|unknown|runtime|features|positional/i);
      await expect(readFile(join(directory, "package.json"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("prints help without creating a project", async () => {
    const result = await runCreator(["--help"]);
    expect(result).toMatchObject({ exitCode: 0, stderr: "" });
    expect(result.stdout).toContain("Usage: create-clockify-addon");
    expect(result.stdout).toContain("--runtime <node|worker>");
    expect(result.stdout).toContain("--features <all|minimal>");
  });

  it("keeps the packed scaffold gate executable across all four variants", async () => {
    const gate = await readFile(
      resolve(import.meta.dirname, "../../create-clockify-addon/scripts/verify-scaffolds.mjs"),
      "utf8",
    );
    for (const variant of ["node-minimal", "node-all", "worker-minimal", "worker-all"]) {
      expect(gate).toContain(variant);
    }
    expect(gate).toContain("validateClockifyManifest");
    expect(gate).toContain("/manifest");
    expect(gate).toContain("/component");
    expect(gate).toContain("/missing");
  });
});
