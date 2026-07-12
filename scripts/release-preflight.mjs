import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = fileURLToPath(new URL("..", import.meta.url));
const defaultRegistry = "https://registry.npmjs.org/";

function readManifest(root, directory) {
  const manifestPath = resolve(root, directory, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  if (
    typeof manifest.name !== "string" ||
    typeof manifest.version !== "string"
  ) {
    throw new Error(
      `${manifestPath} must contain string name and version fields`,
    );
  }

  return {
    directory,
    manifest,
    name: manifest.name,
    version: manifest.version,
  };
}

/** Read the two independently published workspace package versions. */
export function readReleasePackages(root = defaultRoot) {
  return [
    readManifest(root, "addon-sdk"),
    readManifest(root, "create-clockify-addon"),
  ];
}

/** Resolve the npm registry used by npm itself, falling back to the public registry. */
export function configuredRegistry(environment = process.env) {
  const configured =
    environment.npm_config_registry ??
    environment.NPM_CONFIG_REGISTRY ??
    defaultRegistry;
  const registry = new URL(configured);
  registry.pathname = registry.pathname.endsWith("/")
    ? registry.pathname
    : `${registry.pathname}/`;
  return registry.href;
}

function packageEndpoint(registry, packageName) {
  return new URL(encodeURIComponent(packageName), registry);
}

async function readRegistryVersions(releasePackage, options) {
  const registry = options.registry ?? configuredRegistry();
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const signal =
    options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 10_000);
  const endpoint = packageEndpoint(registry, releasePackage.name);
  const response = await fetchImplementation(endpoint, {
    headers: { accept: "application/json" },
    signal,
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(
      `Registry lookup failed for ${releasePackage.name}: HTTP ${response.status}`,
    );
  }

  let metadata;
  try {
    metadata = await response.json();
  } catch {
    throw new Error(
      `Registry returned invalid JSON for ${releasePackage.name}`,
    );
  }

  if (
    metadata == null ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    metadata.versions == null ||
    typeof metadata.versions !== "object" ||
    Array.isArray(metadata.versions)
  ) {
    throw new Error(
      `Registry returned malformed metadata for ${releasePackage.name}`,
    );
  }

  return metadata.versions;
}

async function inspectExactVersions(packages, options = {}) {
  return Promise.all(
    packages.map(async (releasePackage) => {
      const versions = await readRegistryVersions(releasePackage, options);
      return {
        ...releasePackage,
        published:
          versions != null &&
          Object.prototype.hasOwnProperty.call(
            versions,
            releasePackage.version,
          ),
      };
    }),
  );
}

function packageVersion(releasePackage) {
  return `${releasePackage.name}@${releasePackage.version}`;
}

/** Fail when any exact workspace version already exists in the configured registry. */
export async function assertVersionsUnpublished(packages, options = {}) {
  const results = await inspectExactVersions(packages, options);
  const conflicts = results.filter((result) => result.published);
  if (conflicts.length > 0) {
    throw new Error(
      `Release preflight failed; exact version already published:\n${conflicts
        .map((releasePackage) => `- ${packageVersion(releasePackage)}`)
        .join("\n")}`,
    );
  }
  return results;
}

/** Fail when any exact workspace version is absent from the configured registry. */
export async function assertVersionsPublished(packages, options = {}) {
  const results = await inspectExactVersions(packages, options);
  const missing = results.filter((result) => !result.published);
  if (missing.length > 0) {
    throw new Error(
      `Registry verification failed; exact version is not published:\n${missing
        .map((releasePackage) => `- ${packageVersion(releasePackage)}`)
        .join("\n")}`,
    );
  }
  return results;
}

function printHelp() {
  console.log(`Usage: npm run release:preflight

Fail unless the exact SDK and creator workspace versions are absent from the
configured npm registry. This command performs registry network requests.`);
}

async function main(args) {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    printHelp();
    return;
  }
  if (args.length > 0) {
    throw new Error(`Unknown argument: ${args[0]}`);
  }

  const packages = readReleasePackages();
  await assertVersionsUnpublished(packages);
  console.log(
    `Release preflight OK; exact versions are unpublished:\n${packages
      .map((releasePackage) => `- ${packageVersion(releasePackage)}`)
      .join("\n")}`,
  );
}

const isDirectExecution =
  process.argv[1] != null &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
