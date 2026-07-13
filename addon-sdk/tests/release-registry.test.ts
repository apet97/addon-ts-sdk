import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type RequestListener, type Server } from "node:http";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import { waitForVersionsPublished } from "../../scripts/release-preflight.mjs";

const execFileAsync = promisify(execFile);
const packageRoot = process.cwd();
const repoRoot = resolve(packageRoot, "..");
const scriptPath = resolve(repoRoot, "scripts", "release-preflight.mjs");
const registryVerifierPath = resolve(repoRoot, "scripts", "verify-registry-consumer.mjs");
const registryVerifierSource = readFileSync(registryVerifierPath, "utf8");
const rootPackageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
const sdkPackageJson = JSON.parse(
  readFileSync(resolve(repoRoot, "addon-sdk", "package.json"), "utf8"),
);
const creatorPackageJson = JSON.parse(
  readFileSync(resolve(repoRoot, "create-clockify-addon", "package.json"), "utf8"),
);

function listen(server: Server): Promise<number> {
  return new Promise((resolvePort, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (address == null || typeof address === "string") {
        reject(new Error("expected server to listen on a TCP port"));
        return;
      }
      resolvePort(address.port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

async function runPreflight(server: Server) {
  const port = await listen(server);
  try {
    return await execFileAsync(process.execPath, [scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, NPM_CONFIG_REGISTRY: `http://127.0.0.1:${port}/` },
    });
  } finally {
    await close(server);
  }
}

function packageName(requestUrl: string | undefined): string {
  const pathname = new URL(requestUrl ?? "/", "http://registry").pathname;
  return decodeURIComponent(pathname.slice(1));
}

describe("release registry verification", () => {
  it("waits for an exact version that appears during bounded registry propagation", async () => {
    const releasePackage = {
      directory: "addon-sdk",
      manifest: {},
      name: "@example/addon-sdk",
      version: "1.2.3",
    };
    let lookups = 0;
    const retries: string[][] = [];

    const results = await waitForVersionsPublished([releasePackage], {
      fetchImplementation: async () => {
        lookups += 1;
        return new Response(
          JSON.stringify({
            versions: lookups === 1 ? {} : { [releasePackage.version]: {} },
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
      maxAttempts: 2,
      onRetry: ({ missing }) => {
        retries.push(missing.map(({ name, version }) => `${name}@${version}`));
      },
      retryDelayMs: 0,
    });

    expect(lookups).toBe(2);
    expect(retries).toEqual([[`${releasePackage.name}@${releasePackage.version}`]]);
    expect(results).toMatchObject([{ published: true }]);
  });

  it("returns immediately when the exact version is already visible", async () => {
    const releasePackage = {
      directory: "addon-sdk",
      manifest: {},
      name: "@example/addon-sdk",
      version: "1.2.3",
    };
    let lookups = 0;
    let retries = 0;

    const results = await waitForVersionsPublished([releasePackage], {
      fetchImplementation: async () => {
        lookups += 1;
        return new Response(JSON.stringify({ versions: { [releasePackage.version]: {} } }), {
          headers: { "content-type": "application/json" },
        });
      },
      onRetry: () => {
        retries += 1;
      },
    });

    expect(lookups).toBe(1);
    expect(retries).toBe(0);
    expect(results).toMatchObject([{ published: true }]);
  });

  it("fails with every missing exact version after the bounded attempts", async () => {
    const packages = [
      {
        directory: "addon-sdk",
        manifest: {},
        name: "@example/addon-sdk",
        version: "1.2.3",
      },
      {
        directory: "create-clockify-addon",
        manifest: {},
        name: "create-example-addon",
        version: "4.5.6",
      },
    ];
    let lookups = 0;
    let retries = 0;

    await expect(
      waitForVersionsPublished(packages, {
        fetchImplementation: async () => {
          lookups += 1;
          return new Response(JSON.stringify({ versions: {} }), {
            headers: { "content-type": "application/json" },
          });
        },
        maxAttempts: 3,
        onRetry: ({ missing }) => {
          expect(missing).toHaveLength(2);
          retries += 1;
        },
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(
      `${packages[0].name}@${packages[0].version}\n- ${packages[1].name}@${packages[1].version}`,
    );

    expect(lookups).toBe(6);
    expect(retries).toBe(2);
  });

  it("uses seven attempts by default", async () => {
    const releasePackage = {
      directory: "addon-sdk",
      manifest: {},
      name: "@example/addon-sdk",
      version: "1.2.3",
    };
    let lookups = 0;

    await expect(
      waitForVersionsPublished([releasePackage], {
        fetchImplementation: async () => {
          lookups += 1;
          return new Response(JSON.stringify({ versions: {} }), {
            headers: { "content-type": "application/json" },
          });
        },
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(`${releasePackage.name}@${releasePackage.version}`);

    expect(lookups).toBe(7);
  });

  it("does not retry registry errors, invalid metadata, or aborts", async () => {
    const releasePackage = {
      directory: "addon-sdk",
      manifest: {},
      name: "@example/addon-sdk",
      version: "1.2.3",
    };
    const responses = [
      async () => new Response(null, { status: 503 }),
      async () =>
        new Response("not json", {
          headers: { "content-type": "application/json" },
        }),
      async () => {
        throw new DOMException("The operation was aborted", "AbortError");
      },
    ];

    for (const response of responses) {
      let lookups = 0;
      await expect(
        waitForVersionsPublished([releasePackage], {
          fetchImplementation: async () => {
            lookups += 1;
            return response();
          },
          maxAttempts: 3,
          retryDelayMs: 0,
        }),
      ).rejects.toThrow();
      expect(lookups).toBe(1);
    }
  });

  it("wires exact-registry consumer verification outside deterministic gates", () => {
    expect(existsSync(registryVerifierPath)).toBe(true);
    expect(rootPackageJson.scripts["verify:registry"]).toBe(
      "node scripts/verify-registry-consumer.mjs",
    );
    expect(rootPackageJson.scripts["ci:verify"]).not.toContain("verify:registry");
    expect(rootPackageJson.scripts["release:verify"]).not.toContain("verify:registry");
    expect(registryVerifierSource).toContain("waitForVersionsPublished");
    expect(registryVerifierSource).not.toContain("assertVersionsPublished");
    expect(registryVerifierSource).toContain("Registry propagation pending");
  });

  it("wires a manual version-aware preflight outside deterministic gates", async () => {
    expect(existsSync(scriptPath)).toBe(true);
    expect(rootPackageJson.scripts["release:preflight"]).toBe("node scripts/release-preflight.mjs");
    expect(rootPackageJson.scripts["ci:verify"]).not.toContain("release:preflight");
    expect(rootPackageJson.scripts["release:verify"]).not.toContain("release:preflight");

    const { stdout } = await execFileAsync(process.execPath, [scriptPath, "--help"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(stdout).toContain("release:preflight");
  });

  it("accepts package metadata whose exact workspace versions are absent", async () => {
    const server = createServer((request, response) => {
      if (packageName(request.url) === sdkPackageJson.name) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ versions: { "0.9.0": {} } }));
    });

    const { stdout } = await runPreflight(server);
    expect(stdout).toContain(`${sdkPackageJson.name}@${sdkPackageJson.version}`);
    expect(stdout).toContain(`${creatorPackageJson.name}@${creatorPackageJson.version}`);
  });

  it("reports every exact version that already exists", async () => {
    const server = createServer((request, response) => {
      const name = packageName(request.url);
      const version =
        name === sdkPackageJson.name ? sdkPackageJson.version : creatorPackageJson.version;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ versions: { [version]: {} } }));
    });

    try {
      await runPreflight(server);
      throw new Error("expected preflight to reject published versions");
    } catch (error) {
      expect(error).toMatchObject({ code: 1 });
      const stderr = String((error as { stderr?: string }).stderr);
      expect(stderr).toContain(`${sdkPackageJson.name}@${sdkPackageJson.version}`);
      expect(stderr).toContain(`${creatorPackageJson.name}@${creatorPackageJson.version}`);
    }
  });

  it("rejects unknown arguments before making a registry request", async () => {
    await expect(
      execFileAsync(process.execPath, [scriptPath, "--unknown"], {
        cwd: repoRoot,
        encoding: "utf8",
      }),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("Unknown argument"),
    });
  });

  it("keeps registry-consumer help and argument rejection network-free", async () => {
    const environment = {
      ...process.env,
      NPM_CONFIG_REGISTRY: "http://127.0.0.1:1/",
    };
    const { stdout } = await execFileAsync(process.execPath, [registryVerifierPath, "--help"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: environment,
    });
    expect(stdout).toContain("verify:registry");

    await expect(
      execFileAsync(process.execPath, [registryVerifierPath, "--unknown"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: environment,
      }),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("Unknown argument"),
    });
  });

  it("fails closed on registry errors and malformed metadata", async () => {
    const handlers: RequestListener[] = [
      (_request, response) => {
        response.writeHead(503);
        response.end();
      },
      (_request, response) => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ versions: [] }));
      },
    ];

    for (const handler of handlers) {
      await expect(runPreflight(createServer(handler))).rejects.toMatchObject({ code: 1 });
    }
  });
});
