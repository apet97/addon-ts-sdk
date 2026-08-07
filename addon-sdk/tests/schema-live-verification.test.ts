import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

const packageRoot = process.cwd();
const repoRoot = resolve(packageRoot, "..");
const scriptPath = resolve(packageRoot, "scripts", "verify-live-schemas.mjs");
const schemasDir = resolve(packageRoot, "schemas", "clockify-manifests");
const execFileAsync = promisify(execFile);

function listen(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolvePort) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address == null || typeof address === "string") {
        throw new Error("expected server to listen on a TCP port");
      }
      resolvePort(address.port);
    });
  });
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolveClose();
    });
  });
}

describe("live schema verification script", () => {
  it("is wired as a manual package/root script outside ci:verify", () => {
    const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
    const rootPackageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));

    expect(existsSync(scriptPath)).toBe(true);
    expect(packageJson.scripts["verify:schema-live"]).toBe("node scripts/verify-live-schemas.mjs");
    expect(rootPackageJson.scripts["verify:schema-live"]).toBe(
      "npm run verify:schema-live -w @apet97/clockify-addon-sdk",
    );
    expect(rootPackageJson.scripts["ci:verify"]).not.toContain("verify:schema-live");
  });

  it("has a scheduled/manual GitHub workflow outside deterministic CI", () => {
    const workflow = readFileSync(
      resolve(repoRoot, ".github", "workflows", "schema-live.yml"),
      "utf8",
    );

    expect(workflow).toContain("name: Live Schema Drift");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("schedule:");
    expect(workflow).toContain("node-version: 24.x");
    expect(workflow).toContain("npm run verify:schema-live");
  });

  it("accepts structurally equal live schemas and rejects unsupported 1.7", async () => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const version = url.searchParams.get("version");

      if (version === "1.7") {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: "Unsupported manifest schema version" }));
        return;
      }

      if (version && ["1.2", "1.3", "1.4", "1.5", "1.6"].includes(version)) {
        const schema = JSON.parse(readFileSync(resolve(schemasDir, `${version}.json`), "utf8"));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(schema));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    const port = await listen(server);
    try {
      const { stdout } = await execFileAsync(
        process.execPath,
        [
          scriptPath,
          "--schemas-dir",
          schemasDir,
          "--base-url",
          `http://127.0.0.1:${port}/manifest-schema`,
          "--unsupported-version",
          "1.7",
        ],
        { cwd: packageRoot, encoding: "utf8" },
      );

      expect(stdout).toContain("Live schema verification OK");
    } finally {
      await close(server);
    }
  }, 15_000);

  it("fails clearly when the live schema endpoint exceeds the configured timeout", async () => {
    const server = createServer(() => {
      // Intentionally never responds; the verification script must enforce its own fetch timeout.
    });

    const port = await listen(server);
    try {
      await expect(
        execFileAsync(
          process.execPath,
          [
            scriptPath,
            "--schemas-dir",
            schemasDir,
            "--base-url",
            `http://127.0.0.1:${port}/manifest-schema`,
            "--unsupported-version",
            "1.7",
            "--timeout-ms",
            "20",
          ],
          { cwd: packageRoot, encoding: "utf8", timeout: 1_000 },
        ),
      ).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("timed out after 20ms"),
      });
    } finally {
      await close(server);
    }
  }, 5_000);
});
