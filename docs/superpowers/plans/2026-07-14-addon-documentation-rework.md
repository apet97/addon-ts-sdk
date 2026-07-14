# Add-on Documentation Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize and rewrite the authored documentation around the real Clockify add-on lifecycle while preserving accurate package reference and maintainer evidence.

**Architecture:** The root README leads into a builder journey, task guides own one lifecycle stage each, package docs own API/runtime detail, and `docs/maintainers/` owns architecture, verification, release, and historical evidence. A dependency-free verifier enforces links, navigation, classification, synchronized agent guidance, and known factual boundaries.

**Tech Stack:** Markdown, Node.js 22 ESM scripts, Vitest 4, npm workspaces, Prettier, ESLint.

## Global Constraints

- Primary audience: a developer building their first Clockify add-on.
- Main-path examples use manifest schema 1.5 and current public package names.
- Every guide distinguishes Clockify, SDK, and add-on application responsibilities.
- Draw examples from `create-clockify-addon/src/index.mjs` and verified files under
  `addon-sdk/examples/`; do not create a second incompatible sample application.
- Do not change SDK runtime behavior, public exports, package versions, release configuration,
  generated API output, or existing captured Marketplace documents/provenance.
- Keep `addon-sdk/public-api.snapshot.md`, numbered `MARKETPLACE_DOCS/*.md`,
  `MARKETPLACE_DOCS/provenance.json`, ignored root `GOAL.md`, and ignored root
  `verification_report.md` untouched.
- Keep `AGENTS.md` and `CLAUDE.md` byte-identical after their four-line introductions.
- Preserve exact Node 22 runtime and Node 22.13.0 source-development claims.
- Do not add runtime dependencies. The documentation verifier uses only `node:*` modules.
- No version bump, npm publication, tag, Marketplace submission, GitHub metadata change, or push.
- Use small focused diffs, run the task's focused tests before each commit, and keep the worktree
  free of generated tarballs, `dist/`, coverage, and cache artifacts.

---

### Task 1: Establish the builder-first entry path

**Files:**

- Modify: `README.md`
- Create: `docs/README.md`
- Create: `docs/getting-started.md`
- Create: `docs/how-an-addon-works.md`
- Modify: `addon-sdk/tests/distribution-docs.test.ts:1-190`

**Interfaces:**

- Consumes: current creator command, schema 1.5 scaffold, package names, and runtime contracts.
- Produces: the canonical documentation entrypoint and conceptual lifecycle that every later guide
  links to.

- [ ] **Step 1: Add a failing builder-path contract test**

Update the `node:fs` import and add this focused test without removing existing release tests yet:

```ts
import { existsSync, readFileSync } from "node:fs";

it("provides a builder-first documentation path", () => {
  const builderDocs = [
    "docs/README.md",
    "docs/getting-started.md",
    "docs/how-an-addon-works.md",
  ];
  for (const file of builderDocs)
    expect(existsSync(resolve(repoRoot, file))).toBe(true);

  const rootReadme = readFileSync(resolve(repoRoot, "README.md"), "utf8");
  const index = readFileSync(resolve(repoRoot, "docs/README.md"), "utf8");
  const gettingStarted = readFileSync(
    resolve(repoRoot, "docs/getting-started.md"),
    "utf8",
  );
  const lifecycle = readFileSync(
    resolve(repoRoot, "docs/how-an-addon-works.md"),
    "utf8",
  );

  expect(rootReadme).toContain("docs/getting-started.md");
  expect(rootReadme).toContain("npm create clockify-addon@latest");
  expect(index).toContain("getting-started.md");
  expect(index).toContain("how-an-addon-works.md");
  expect(gettingStarted).toContain("GET /manifest");
  expect(gettingStarted).toContain("PUBLIC_BASE_URL");
  expect(gettingStarted).toContain("CLOCKIFY_PARENT_ORIGIN");
  for (const owner of ["Clockify", "SDK", "Add-on application"]) {
    expect(lifecycle).toContain(owner);
  }
  for (const stage of [
    "INSTALLED",
    "auth_token",
    "webhook",
    "X-Addon-Token",
    "DELETED",
  ]) {
    expect(lifecycle).toContain(stage);
  }
});
```

- [ ] **Step 2: Run the test and confirm the missing-path failure**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/distribution-docs.test.ts
```

Expected: FAIL because `docs/README.md`, `docs/getting-started.md`, and
`docs/how-an-addon-works.md` do not exist.

- [ ] **Step 3: Rewrite the root landing page around the builder journey**

Keep the existing restrained hero, badges, package boundary, runtime table, evidence links, and
unofficial-project disclaimer. Replace the current navigation with this exact section order:

```markdown
# Clockify Add-on SDK for TypeScript

A server-side SDK and executable Node/Worker scaffold for Clockify manifests, lifecycle events,
components, webhooks, and Marketplace-specific API calls.

## Build your first add-on

1. `npm create clockify-addon@latest my-addon`
2. Configure `.env` and replace the manifest key.
3. Run the generated project and open `GET /manifest`.
4. Add the manifest URL in the Clockify developer workspace.

Link: [Full getting-started guide](docs/getting-started.md)

## How a Clockify add-on works

`manifest -> INSTALLED -> component/webhook -> Clockify API -> DELETED`

Link: [Lifecycle and responsibility model](docs/how-an-addon-works.md)

## What the SDK owns

## Packages and runtimes

## Documentation

## Verification and trust

## Contributing

## License and project status
```

Do not put exact package versions, test counts, release SHAs, or live-validation dates in the root
README.

- [ ] **Step 4: Create the documentation index**

Create `docs/README.md` with these exact top-level sections and current links:

```markdown
# Documentation

## Start here

- [Getting started](getting-started.md)
- [How an add-on works](how-an-addon-works.md)

## SDK reference

- [SDK package README](../addon-sdk/README.md)
- [API reference](../addon-sdk/docs/api-reference.md)
- [Creator package README](../create-clockify-addon/README.md)

## Maintainers

- [Architecture](architecture.md)
- [Product surface](product-surface.md)
- [Quality gates](quality-gates.md)
- [Release readiness](release-readiness.md)
- [Marketplace coverage](marketplace-coverage.md)
- [Pre-release migration](pre-release-migration.md)

## Upstream, generated, and historical material

Classify `MARKETPLACE_DOCS/`, `addon-sdk/public-api.snapshot.md`, and
`docs/superpowers/`; state that ignored local working notes are not repository docs.
```

- [ ] **Step 5: Write the getting-started guide**

Create `docs/getting-started.md` with this complete flow:

```markdown
# Getting Started

## Prerequisites

Node 22.13.0+, npm, a Clockify developer workspace, and a public HTTPS URL for installation.

## Create a project

Show the default command and the `--runtime` / `--features` matrix.

## Understand the generated files

Explain `src/addon.ts`, `src/index.ts`, `.env.example`, and `package.json`.

## Configure it

Explain `PUBLIC_BASE_URL`, `CLOCKIFY_PARENT_ORIGIN`, `ALLOW_LOCAL_REQUEST_ORIGIN`, and
`ALLOW_EPHEMERAL_STORAGE`; require durable encrypted storage before real installation.

## Run it

Show `npm install`, copying `.env.example`, `npm start`, and `curl http://localhost:8080/manifest`
for Node; link Worker users to the generated Wrangler command.

## Install it in Clockify

Explain exposing HTTPS, submitting `${PUBLIC_BASE_URL}/manifest`, and the `INSTALLED` callback.

## Verify the first component

Explain the Clockify-hosted iframe and verified `auth_token` query value.

## Continue

Link the lifecycle model, documentation index, SDK package reference, and creator package reference.
```

Use `GET /manifest` in prose while keeping the concrete curl path `/manifest`.

- [ ] **Step 6: Write the lifecycle and responsibility model**

Create `docs/how-an-addon-works.md` with:

```markdown
# How a Clockify Add-on Works

## The three owners

Use the approved Clockify / SDK / Add-on application responsibility table.

## The request lifecycle

Number the ten approved stages from scaffold through deployment.

## Routes and credentials

Describe `/manifest`, component `auth_token`, `X-Addon-Lifecycle-Token`, webhook signature/event
headers, and outbound `X-Addon-Token` without logging or copying credential values.

## Storage lifecycle

Explain installation records, webhook-token lookup, encrypted durable storage, and unconditional
`DELETED` cleanup when no caller-supplied `installedAt` generation exists.

## Runtime boundary

Shared `createAddon`; Node HTTP or Fetch/Worker bootstrap; Express body parsing owned by the host.

## Failure model

Document 400/401/404/405/413/500/503 categories only where current handlers/adapters establish
them, and link detailed routing/token reference.

## Next steps

Link the documentation index and package references. Do not link guide files until those files
exist in the next task.
```

- [ ] **Step 7: Run the focused test and format the new entry docs**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/distribution-docs.test.ts
npm exec -- prettier README.md docs/README.md docs/getting-started.md docs/how-an-addon-works.md --check
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit the builder entry path**

```bash
git add README.md docs/README.md docs/getting-started.md docs/how-an-addon-works.md addon-sdk/tests/distribution-docs.test.ts
git commit -m "Reframe docs around the add-on lifecycle"
```

---

### Task 2: Add focused lifecycle task guides

**Files:**

- Create: `docs/guides/manifest-and-registration.md`
- Create: `docs/guides/installation-and-storage.md`
- Create: `docs/guides/components-and-ui.md`
- Create: `docs/guides/webhooks-and-idempotency.md`
- Create: `docs/guides/calling-clockify.md`
- Create: `docs/guides/deployment-and-operations.md`
- Create: `docs/guides/troubleshooting.md`
- Modify: `docs/README.md`
- Modify: `docs/getting-started.md`
- Modify: `docs/how-an-addon-works.md`
- Modify: `addon-sdk/tests/distribution-docs.test.ts`

**Interfaces:**

- Consumes: Task 1's entry docs and the current scaffold/example helper names.
- Produces: one canonical guide for each builder responsibility and the active guide list consumed
  by the verifier in Task 3.

- [ ] **Step 1: Add a failing guide-coverage test**

Add this test:

```ts
it("documents every builder lifecycle responsibility", () => {
  const guides = new Map([
    [
      "manifest-and-registration.md",
      ["v1_5Builder", "registerComponent", "/manifest"],
    ],
    [
      "installation-and-storage.md",
      ["INSTALLED", "installedAt", "encrypted", "DELETED"],
    ],
    [
      "components-and-ui.md",
      ["auth_token", "CLOCKIFY_PARENT_ORIGIN", "createClockifyHtmlResponse"],
    ],
    [
      "webhooks-and-idempotency.md",
      [
        "getExpectedWebhookAuthToken",
        "runClockifyIdempotentWebhook",
        "release",
      ],
    ],
    [
      "calling-clockify.md",
      ["ClockifyAddonClient", "X-Addon-Token", "backendUrl"],
    ],
    [
      "deployment-and-operations.md",
      ["PUBLIC_BASE_URL", "durable", "Node", "Worker"],
    ],
    ["troubleshooting.md", ["404", "405", "413", "503"]],
  ]);

  const index = readFileSync(resolve(repoRoot, "docs", "README.md"), "utf8");
  for (const [file, terms] of guides) {
    const path = resolve(repoRoot, "docs", "guides", file);
    expect(existsSync(path)).toBe(true);
    expect(index).toContain(`guides/${file}`);
    const content = readFileSync(path, "utf8");
    for (const term of terms) expect(content).toContain(term);
  }
});
```

- [ ] **Step 2: Run the test and confirm all seven files are missing**

Run the focused distribution-doc test. Expected: FAIL at the first missing guide.

- [ ] **Step 3: Write the seven guides using one shared shape**

Every file starts with its file-specific title and then uses these level-two headings:

```markdown
## Mental model

## What Clockify sends

## What the SDK does

## What your application must do

## Smallest correct path

## Failure behavior

## Prove it

## Reference
```

Use these exact content contracts:

- `manifest-and-registration.md`: schema 1.5 builder, explicit public base URL, register-only
  descriptors, identical-predeclared binding behavior, conflicting same-path rejection before
  mutation, automatic `GET /manifest`, exact path matching, and manifest validation.
- `installation-and-storage.md`: lifecycle-token verification, payload/claim matching, complete
  `ClockifyInstallationContext`, encrypted durable store, `installedAt` save ordering, delete
  results (`deleted`, `missing`, `stale`), and the real unqualified `DELETED` limitation.
- `components-and-ui.md`: `auth_token` verification, claims available to handlers,
  `createClockifyHtmlResponse`, exact `CLOCKIFY_PARENT_ORIGIN`, `createClockifyBridge`, theme and
  language helpers, and 401/503 outcomes.
- `webhooks-and-idempotency.md`: signature plus event/context verification, stored webhook-token
  lookup, bounded request bodies, a stable event key, ownership leases, duplicate handling,
  completion, release after throws/5xx, and durable/transactional store expectations.
- `calling-clockify.md`: construct `ClockifyAddonClient` from stored token and verified
  `backendUrl`, token exchange, settings calls, encoded generic path segments, read retry policy,
  mutation-only confirmed-429 replay, and the entity-specific `clockify-ts-sdk` boundary.
- `deployment-and-operations.md`: Node and Worker bootstraps, HTTPS public origin, local loopback
  opt-in, durable encrypted installation and lease stores, body ownership, structured logs without
  tokens/queries, health/monitoring expectations, and fresh Marketplace validation boundaries.
- `troubleshooting.md`: symptom tables for missing/invalid public origin, 401 component/lifecycle/
  webhook failures, 404 unknown path, 405 known path/wrong method, 413 body limit, 503 incomplete
  storage/parent-origin wiring, iframe refusal, webhook duplicate/retry, and stale install cleanup.

Code blocks must be copied or reduced from the current creator scaffold and SDK examples. Keep
imports valid and do not show hardcoded production tokens or Clockify service hosts.

- [ ] **Step 4: Add the final task-guide section to `docs/README.md`**

List the guides in lifecycle order and add reciprocal links from `getting-started.md` and
`how-an-addon-works.md`.

- [ ] **Step 5: Run focused tests and formatting**

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/distribution-docs.test.ts
npm exec -- prettier docs/README.md docs/getting-started.md docs/how-an-addon-works.md docs/guides/*.md --check
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit the task guides**

```bash
git add docs/README.md docs/getting-started.md docs/how-an-addon-works.md docs/guides addon-sdk/tests/distribution-docs.test.ts
git commit -m "Add lifecycle-focused builder guides"
```

---

### Task 3: Enforce documentation links and ownership

**Files:**

- Create: `scripts/verify-docs.mjs`
- Create: `addon-sdk/tests/documentation-verification.test.ts`
- Modify: `package.json:11-40`
- Modify: `addon-sdk/tests/tooling-config.test.ts:40-60`
- Modify: `addon-sdk/tests/distribution-docs.test.ts`

**Interfaces:**

- Consumes: the complete active builder-file list from Tasks 1-2.
- Produces: `collectDocumentationErrors(root, options)` and the root `npm run verify:docs` gate.

- [ ] **Step 1: Write failing verifier unit and wiring tests**

Create `addon-sdk/tests/documentation-verification.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectDocumentationErrors } from "../../scripts/verify-docs.mjs";

const temporaryRoots: string[] = [];

async function fixture(
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "clockify-docs-"));
  temporaryRoots.push(root);
  for (const [file, content] of Object.entries(files)) {
    const target = join(root, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("documentation verification", () => {
  it("accepts reachable relative files and anchors", async () => {
    const root = await fixture({
      "docs/README.md": "# Docs\n\n[Guide](guide.md#run-it)\n",
      "docs/guide.md": "# Guide\n\n## Run it\n",
    });
    await expect(
      collectDocumentationErrors(root, {
        documents: ["docs/README.md", "docs/guide.md"],
        requiredFromIndex: ["docs/guide.md"],
      }),
    ).resolves.toEqual([]);
  });

  it("reports broken files, anchors, and index reachability together", async () => {
    const root = await fixture({
      "docs/README.md":
        "# Docs\n\n[Broken](missing.md)\n[Anchor](guide.md#absent)\n",
      "docs/guide.md": "# Guide\n\n## Present\n",
      "docs/unlinked.md": "# Unlinked\n",
    });
    const errors = await collectDocumentationErrors(root, {
      documents: ["docs/README.md", "docs/guide.md", "docs/unlinked.md"],
      requiredFromIndex: ["docs/unlinked.md"],
    });
    expect(errors.join("\n")).toContain("missing.md");
    expect(errors.join("\n")).toContain("#absent");
    expect(errors.join("\n")).toContain("docs/unlinked.md");
  });
});
```

Add these assertions to `tooling-config.test.ts`:

```ts
expect(rootPackageJson.scripts["verify:docs"]).toBe(
  "node scripts/verify-docs.mjs",
);
expect(rootPackageJson.scripts["ci:verify"]).toContain("npm run verify:docs");
expect(rootPackageJson.scripts["lint:release-tools"]).toContain(
  "scripts/*.mjs",
);
expect(rootPackageJson.scripts["format:release-tools:check"]).toContain(
  "scripts/*.mjs",
);
```

- [ ] **Step 2: Run the focused tests and confirm the missing module/script failure**

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/documentation-verification.test.ts tests/tooling-config.test.ts
```

Expected: FAIL because `scripts/verify-docs.mjs` and `verify:docs` do not exist.

- [ ] **Step 3: Implement the dependency-free verifier**

Implement `scripts/verify-docs.mjs` with this code shape and behavior:

````js
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const BUILDER_DOCS = Object.freeze([
  "docs/getting-started.md",
  "docs/how-an-addon-works.md",
  "docs/guides/manifest-and-registration.md",
  "docs/guides/installation-and-storage.md",
  "docs/guides/components-and-ui.md",
  "docs/guides/webhooks-and-idempotency.md",
  "docs/guides/calling-clockify.md",
  "docs/guides/deployment-and-operations.md",
  "docs/guides/troubleshooting.md",
]);

const SKIP_DIRECTORIES = new Set([".git", "node_modules", "dist", "coverage"]);
function posix(value) {
  return value.split(path.sep).join("/");
}

function excluded(relative) {
  return (
    relative === "GOAL.md" ||
    relative === "verification_report.md" ||
    relative === "addon-sdk/public-api.snapshot.md" ||
    relative.startsWith("docs/superpowers/") ||
    relative.startsWith("docs/archive/") ||
    /^MARKETPLACE_DOCS\/\d{2}-.*\.md$/.test(relative)
  );
}

async function walk(root, directory, output) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(root, absolute, output);
      continue;
    }
    const relative = posix(path.relative(root, absolute));
    if (entry.isFile() && relative.endsWith(".md") && !excluded(relative))
      output.push(relative);
  }
}

export async function discoverActiveMarkdown(root) {
  const output = [];
  await walk(path.resolve(root), path.resolve(root), output);
  return output.sort();
}

function stripFencedCode(source) {
  return source.replace(/```[\s\S]*?```/g, "");
}

function linkTarget(raw) {
  const value = raw.trim();
  if (value.startsWith("<")) {
    const end = value.indexOf(">");
    return end === -1 ? value : value.slice(1, end);
  }
  return value.split(/\s+/u, 1)[0] ?? "";
}

function markdownLinks(source) {
  const content = stripFencedCode(source);
  const links = [];
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)\n]+)\)/g)) {
    links.push(linkTarget(match[1]));
  }
  for (const match of content.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gm)) {
    links.push(linkTarget(match[1]));
  }
  return links.filter(Boolean);
}

function headingSlug(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-");
}

function headingAnchors(source) {
  const anchors = new Set();
  const seen = new Map();
  for (const match of stripFencedCode(source).matchAll(
    /^#{1,6}\s+(.+?)\s*#*\s*$/gm,
  )) {
    const base = headingSlug(match[1]);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

function localParts(href) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return null;
  const hash = href.indexOf("#");
  const rawPath = hash === -1 ? href : href.slice(0, hash);
  const rawFragment = hash === -1 ? "" : href.slice(hash + 1);
  return {
    path: decodeURI(rawPath.split("?", 1)[0]),
    fragment: decodeURIComponent(rawFragment),
  };
}

async function resolvedTarget(root, sourceFile, parts) {
  let absolute = parts.path
    ? path.resolve(root, path.dirname(sourceFile), parts.path)
    : path.resolve(root, sourceFile);
  const relative = posix(path.relative(root, absolute));
  if (relative === ".." || relative.startsWith("../")) return { escaped: true };
  try {
    if ((await stat(absolute)).isDirectory())
      absolute = path.join(absolute, "README.md");
  } catch {
    return { missing: relative };
  }
  return { absolute, relative: posix(path.relative(root, absolute)) };
}

async function requiredText(root, file) {
  return readFile(path.resolve(root, file), "utf8");
}

export async function collectDocumentationErrors(
  root,
  {
    documents,
    index = "docs/README.md",
    requiredFromIndex = BUILDER_DOCS,
    repositoryContracts = false,
  } = {},
) {
  const absoluteRoot = path.resolve(root);
  const files = documents ?? (await discoverActiveMarkdown(absoluteRoot));
  const contents = new Map();
  const directLinks = new Map();
  const errors = [];

  for (const file of files)
    contents.set(file, await requiredText(absoluteRoot, file));

  for (const [sourceFile, source] of contents) {
    const targets = new Set();
    for (const href of markdownLinks(source)) {
      const parts = localParts(href);
      if (parts === null) continue;
      const target = await resolvedTarget(absoluteRoot, sourceFile, parts);
      if (target.escaped) {
        errors.push(`${sourceFile}: link escapes the repository: ${href}`);
        continue;
      }
      if (target.missing) {
        errors.push(`${sourceFile}: missing link target: ${href}`);
        continue;
      }
      targets.add(target.relative);
      if (parts.fragment && target.relative.endsWith(".md")) {
        const targetSource =
          contents.get(target.relative) ??
          (await readFile(target.absolute, "utf8"));
        if (!headingAnchors(targetSource).has(headingSlug(parts.fragment))) {
          errors.push(
            `${sourceFile}: missing anchor in ${target.relative}: #${parts.fragment}`,
          );
        }
      }
    }
    directLinks.set(sourceFile, targets);
  }

  const indexLinks = directLinks.get(index) ?? new Set();
  for (const file of requiredFromIndex) {
    if (!indexLinks.has(file))
      errors.push(`${index}: does not link required document ${file}`);
  }

  if (repositoryContracts) {
    const rootReadme = await requiredText(absoluteRoot, "README.md");
    const indexSource = await requiredText(absoluteRoot, index);
    const lifecycle = await requiredText(
      absoluteRoot,
      "docs/how-an-addon-works.md",
    );
    for (const value of ["Clockify", "SDK", "Add-on application", "1.5"]) {
      if (!lifecycle.includes(value))
        errors.push(`docs/how-an-addon-works.md: missing ${value}`);
    }
    if (!rootReadme.includes("docs/getting-started.md"))
      errors.push("README.md: missing getting-started link");
    for (const label of [
      "Maintainers",
      "Upstream",
      "generated",
      "historical",
    ]) {
      if (!indexSource.includes(label))
        errors.push(`${index}: missing classification ${label}`);
    }
    const agents = (await requiredText(absoluteRoot, "AGENTS.md"))
      .split("\n")
      .slice(4);
    const claude = (await requiredText(absoluteRoot, "CLAUDE.md"))
      .split("\n")
      .slice(4);
    if (agents.join("\n") !== claude.join("\n"))
      errors.push("AGENTS.md and CLAUDE.md differ after their introductions");
    for (const boundary of [
      "MARKETPLACE_DOCS/provenance.json",
      "addon-sdk/public-api.snapshot.md",
    ]) {
      try {
        await stat(path.resolve(absoluteRoot, boundary));
      } catch {
        errors.push(`missing generated/upstream boundary file: ${boundary}`);
      }
    }
  }

  return errors;
}

async function main() {
  const root = process.cwd();
  const documents = await discoverActiveMarkdown(root);
  const errors = await collectDocumentationErrors(root, {
    documents,
    repositoryContracts: true,
  });
  if (errors.length > 0) {
    console.error("Documentation verification failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Documentation verification passed (${documents.length} active files).`,
  );
}

const direct =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (direct) await main();
````

Let Prettier normalize wrapping. Ordinary missing links and contract failures are returned as
strings; unexpected filesystem or programming failures reject and make the CLI fail visibly.

- [ ] **Step 4: Wire the gate into root scripts**

Add:

```json
"verify:docs": "node scripts/verify-docs.mjs"
```

Place `npm run verify:docs` immediately after `npm run verify:marketplace-docs` in `ci:verify`.
Do not alter `release:verify`, `release:preflight`, or registry scripts.

- [ ] **Step 5: Run red/green verifier checks**

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/documentation-verification.test.ts tests/tooling-config.test.ts
npm run verify:docs
npm run lint:release-tools
npm run format:release-tools:check
```

Expected: all pass. Temporarily changing one fixture link to `missing.md` must make the unit test
fail; restore it before committing.

- [ ] **Step 6: Commit the documentation gate**

```bash
git add scripts/verify-docs.mjs package.json addon-sdk/tests/documentation-verification.test.ts addon-sdk/tests/tooling-config.test.ts addon-sdk/tests/distribution-docs.test.ts
git commit -m "Verify documentation links and ownership"
```

---

### Task 4: Make package and generated-project READMEs actionable

**Files:**

- Modify: `create-clockify-addon/src/index.mjs:13-274`
- Modify: `create-clockify-addon/README.md`
- Modify: `addon-sdk/README.md`
- Modify: `scripts/verify-docs.mjs`
- Modify: `addon-sdk/tests/creator.test.ts:53-84`
- Modify: `addon-sdk/tests/distribution-docs.test.ts`
- Modify: `docs/README.md`

**Interfaces:**

- Consumes: canonical builder guides and current Node/Worker scaffold behavior.
- Produces: `projectReadme(runtime, features)` output and package-specific entry docs.

- [ ] **Step 1: Strengthen generated README tests first**

For both runtimes, assert generated README contains:

```ts
for (const heading of [
  "## Run locally",
  "## Configure Clockify",
  "## Request flow",
  "## Before production",
])
  expect(readme).toContain(heading);
expect(readme).toContain(runtime === "node" ? "npm start" : "wrangler dev");
expect(readme).toContain("PUBLIC_BASE_URL");
expect(readme).toContain("CLOCKIFY_PARENT_ORIGIN");
expect(readme).toContain("replace-with-your-unique-addon-key");
expect(readme).toContain("persistent encrypted installation store");
expect(readme).toContain("GET /manifest");
```

For all features, require the component route. For `features === "all"`, require `INSTALLED`,
`NEW_TIME_ENTRY`, and `DELETED`; for minimal, require an explicit statement that lifecycle and
webhook routes were not generated. In the distribution-doc test, require both package READMEs to
contain `https://github.com/apet97/addon-ts-sdk/blob/main/docs/getting-started.md`.

- [ ] **Step 2: Confirm the creator test fails on the current two-paragraph README**

Run `npm test -w @apet97/clockify-addon-sdk -- tests/creator.test.ts`. Expected: FAIL on the first
missing generated README heading.

- [ ] **Step 3: Extract and use a focused README renderer**

Add a private `projectReadme(runtime, features)` function immediately before `tsconfig(runtime)`.
It returns Markdown with:

```markdown
# Clockify Add-on

## Run locally

Copy `.env.example`, install dependencies, run the runtime-specific start command, and request
`GET /manifest`.

## Configure Clockify

Replace the manifest key; explain public base URL and exact parent origin.

## Project layout

Describe shared `src/addon.ts` and runtime `src/index.ts`.

## Request flow

Describe the component and the feature-dependent lifecycle/webhook routes.

## Before production

Require persistent encrypted installation storage, durable idempotency storage when webhooks are
enabled, HTTPS, and disabled ephemeral storage.

## Learn more

Link to the repository's getting-started and lifecycle guides using absolute GitHub URLs because
the generated project is outside the repository.
```

Call `projectReadme(options.runtime, options.features)` from `scaffoldClockifyAddon`; do not alter
the generated source, package manifest, environment file, or runtime bootstrap.

- [ ] **Step 4: Rewrite the creator package README**

Document default Node/all behavior, separated and equals flag forms, all four variants, invalid
input behavior, generated file layout, environment variables, import-safe programmatic usage,
runtime commands, and production storage requirements. Link to canonical builder guides rather
than copying their full protocol explanations. Because npm renders this README outside the
monorepo, use `https://github.com/apet97/addon-ts-sdk/blob/main/docs/getting-started.md` and matching
absolute GitHub URLs for root documentation.

- [ ] **Step 5: Refocus the SDK package README**

Keep install/unreleased-tarball instructions, ESM/CJS and subpath imports, Node/Fetch/Express
adapters, testing helpers, schemas, and API links. Change the quick start to schema 1.5, correct the
404/405 summary, add `ClockifyAddonClient` to the product surface, and link the builder journey for
full installation/UI/webhook flow. Use the same absolute GitHub builder-guide URLs so npm readers do
not depend on monorepo-relative paths.

- [ ] **Step 6: Run package documentation gates**

Before running the gates, extend the verifier's `repositoryContracts` block with the same absolute
builder-link requirement for `addon-sdk/README.md` and `create-clockify-addon/README.md`:

```js
const publicGuide =
  "https://github.com/apet97/addon-ts-sdk/blob/main/docs/getting-started.md";
for (const file of ["addon-sdk/README.md", "create-clockify-addon/README.md"]) {
  if (!(await requiredText(absoluteRoot, file)).includes(publicGuide)) {
    errors.push(`${file}: missing public builder-guide link`);
  }
}
```

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/creator.test.ts tests/distribution-docs.test.ts
npm run verify:scaffolds
npm run verify:docs
npm exec -- prettier create-clockify-addon/src/index.mjs create-clockify-addon/README.md addon-sdk/README.md --check
git diff --check
```

Expected: all pass and every generated scaffold still executes unchanged.

- [ ] **Step 7: Commit package and scaffold docs**

```bash
git add create-clockify-addon/src/index.mjs create-clockify-addon/README.md addon-sdk/README.md scripts/verify-docs.mjs docs/README.md addon-sdk/tests/creator.test.ts addon-sdk/tests/distribution-docs.test.ts
git commit -m "Improve package and scaffold guidance"
```

---

### Task 5: Separate maintainer, upstream, and historical material

**Files:**

- Create: `docs/maintainers/README.md`
- Move: `docs/architecture.md` -> `docs/maintainers/architecture.md`
- Move: `docs/product-surface.md` -> `docs/maintainers/product-surface.md`
- Move: `docs/quality-gates.md` -> `docs/maintainers/quality-gates.md`
- Move: `docs/release-readiness.md` -> `docs/maintainers/release-readiness.md`
- Move: `docs/marketplace-coverage.md` -> `docs/maintainers/marketplace-coverage.md`
- Move: `docs/pre-release-migration.md` -> `docs/maintainers/pre-release-migration.md`
- Move: `addon-sdk/docs/porting/adversarial-review.md` ->
  `docs/maintainers/java-parity/adversarial-review.md`
- Move: `addon-sdk/docs/porting/evidence-map.md` ->
  `docs/maintainers/java-parity/evidence-map.md`
- Move: `addon-sdk/docs/porting/parity-checklist.md` ->
  `docs/maintainers/java-parity/parity-checklist.md`
- Create: `MARKETPLACE_DOCS/README.md`
- Modify: all tracked authored Markdown links that reference moved files
- Modify: `addon-sdk/tests/distribution-docs.test.ts`

**Interfaces:**

- Consumes: Task 3's active/historical classification and canonical builder docs.
- Produces: stable maintainer paths and a local provenance index without modifying upstream files.

- [ ] **Step 1: Change distribution tests to the final maintainer paths**

Replace the six old root-doc reads with the matching `docs/maintainers/architecture.md`,
`product-surface.md`, `quality-gates.md`, `release-readiness.md`, `marketplace-coverage.md`, and
`pre-release-migration.md` paths; read Java parity evidence from the new maintainer path. Assert
`docs/maintainers/README.md` links every moved document and
`MARKETPLACE_DOCS/README.md` states that numbered files are upstream snapshots verified by
`npm run verify:marketplace-docs`.

- [ ] **Step 2: Run the distribution test and confirm missing maintainer paths**

Expected: FAIL before any move.

- [ ] **Step 3: Move and reframe the maintainer documents**

Preserve release receipts and parity evidence verbatim where still factual. Add an evergreen
introduction to each moved file explaining its maintainer purpose. Expand
`docs/maintainers/architecture.md` to distinguish:

```text
Clockify request
  -> Node / Fetch / Express adapter
  -> shared request normalization and body limits
  -> exact router
  -> Clockify verification wrapper
  -> application handler
  -> AddonResponse
```

Also document the shared `createAddon` versus host bootstrap split and the package subpath boundary.
Do not copy the builder tutorial into this file.

- [ ] **Step 4: Add maintainer and Marketplace indexes**

`docs/maintainers/README.md` groups architecture/product surface, verification/release, Marketplace
evidence, migration, and Java parity. `MARKETPLACE_DOCS/README.md` identifies the numbered files as
captured upstream material, points to `provenance.json` and `scripts/verify-marketplace-docs.mjs`,
and directs builders to `docs/how-an-addon-works.md`.

- [ ] **Step 5: Repair every tracked link**

Use:

```bash
rg -n "docs/(architecture|product-surface|quality-gates|release-readiness|marketplace-coverage|pre-release-migration)\.md|docs/porting/(adversarial-review|evidence-map|parity-checklist)\.md" --glob '*.md' --glob '*.ts' --glob '*.mjs' --glob '*.json'
```

Update each result to the final path. Do not alter historical `docs/superpowers/**` links that are
quoted evidence unless they are intended as live navigation.

- [ ] **Step 6: Prove snapshot preservation and navigation**

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/distribution-docs.test.ts
npm run verify:marketplace-docs
npm run verify:docs
git diff --check
```

Expected: all pass; this command is empty because it excludes only the new local index:

```bash
git diff -- MARKETPLACE_DOCS ':!MARKETPLACE_DOCS/README.md'
```

- [ ] **Step 7: Commit the information-boundary moves**

```bash
git add docs/maintainers MARKETPLACE_DOCS/README.md README.md docs/README.md addon-sdk/README.md create-clockify-addon/README.md addon-sdk/tests/distribution-docs.test.ts
git add -u docs addon-sdk/docs/porting
git commit -m "Separate builder and maintainer documentation"
```

---

### Task 6: Correct and consolidate SDK reference documentation

**Files:**

- Modify: `addon-sdk/docs/api-reference.md`
- Modify: `addon-sdk/docs/dependency-strategy.md`
- Modify: `addon-sdk/docs/java-migration.md`
- Modify: `addon-sdk/docs/manifest-builders.md`
- Modify: `addon-sdk/docs/routing.md`
- Modify: `addon-sdk/docs/secure-server-recipe.md`
- Modify: `addon-sdk/docs/token-validation.md`
- Modify: `addon-sdk/docs/porting/java-to-ts-api-map.md`
- Modify: `docs/maintainers/product-surface.md`
- Modify: `docs/maintainers/java-parity/evidence-map.md`
- Modify: `scripts/verify-docs.mjs`
- Modify: `addon-sdk/tests/documentation-verification.test.ts`
- Modify: `addon-sdk/tests/distribution-docs.test.ts`

**Interfaces:**

- Consumes: current exports, source behavior, examples, and canonical builder guides.
- Produces: accurate detailed reference without duplicate tutorial ownership.

- [ ] **Step 1: Replace the stale-client assertion with the current boundary**

Change the secure-recipe test from the disproven phrase to:

```ts
expect(recipe).toContain("ClockifyAddonClient");
expect(recipe).toContain("Marketplace-specific");
expect(recipe).toContain("entity-specific");
expect(recipe).not.toContain("does not add a Clockify REST client");
```

Add assertions that routing says unknown paths are 404 and a known path with the wrong method is
405, and that manifest main-path examples use `v1_5Builder`.

Add a verifier fixture containing `This SDK does not add a Clockify REST client.` and assert that
passing that exact phrase through a new `staleClaims` option reports the file. Extend the verifier
with:

```js
export const STALE_CLAIMS = Object.freeze([
  "does not add a Clockify REST client",
  "No REST client or token exchange client is included",
  "not published to the npm registry",
]);
```

Add `staleClaims = []` to `collectDocumentationErrors` options, scan every active document for each
provided phrase, and pass `STALE_CLAIMS` from the direct CLI. Fixture callers remain able to supply
their own focused list.

- [ ] **Step 2: Confirm focused tests fail on stale prose**

Run the distribution-doc test. Expected: FAIL on `ClockifyAddonClient` or the removed stale phrase.

- [ ] **Step 3: Rewrite the secure server recipe around the current full flow**

Use these sections:

```markdown
# Secure Server Recipe

## Build and register schema 1.5 descriptors

## Verify and store INSTALLED

## Render a verified component

## Verify stored-token webhooks

## Make webhook work idempotent

## Call Marketplace endpoints

## Handle DELETED

## Run locally and deploy

## Boundary
```

The boundary must say: `ClockifyAddonClient` covers Marketplace-specific token exchange, structured
settings, and generic authenticated requests; entity-specific REST clients remain outside this SDK.

- [ ] **Step 4: Audit each remaining reference against source**

Apply only factual, ownership, and navigation corrections:

- API reference: current subpaths and public symbols; point exhaustive readers to the generated
  snapshot rather than duplicating every export.
- Manifest builders: schema 1.5 as current main path; supported 1.2-1.5 compatibility remains.
- Routing: exact 404/405/HEAD/OPTIONS/trailing-slash/body-limit semantics and adapter ownership.
- Token validation: current headers/query locations, expiration rules, context matching, and stored
  webhook token lookup.
- Dependency strategy: keep `jose@6`, AJV, Express optional peer, ESM/CJS boundaries accurate.
- Java migration/API map: user migration stays package reference; maintainer evidence links use the
  new paths.
- Product surface/evidence map: include `ClockifyAddonClient`; remove both stale no-client claims.

- [ ] **Step 5: Run contradiction and focused proof scans**

```bash
rg -n "does not add a Clockify REST client|No REST client or token exchange client is included" --glob '*.md' --glob '!docs/superpowers/**' --glob '!docs/archive/**' --glob '!MARKETPLACE_DOCS/**'
npm test -w @apet97/clockify-addon-sdk -- tests/distribution-docs.test.ts tests/router.test.ts tests/addon-client.test.ts
npm run verify:docs
npm run verify:public-api
git diff --check
```

Expected: the `rg` command returns no active authored-doc matches; tests and gates exit 0.

- [ ] **Step 6: Commit the reference correction**

```bash
git add addon-sdk/docs docs/maintainers/product-surface.md docs/maintainers/java-parity/evidence-map.md scripts/verify-docs.mjs addon-sdk/tests/documentation-verification.test.ts addon-sdk/tests/distribution-docs.test.ts
git commit -m "Align SDK reference with runtime behavior"
```

---

### Task 7: Make contributor and agent guidance stable

**Files:**

- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `CONTRIBUTING.md`
- Modify: `SECURITY.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/README.md`
- Modify: `docs/maintainers/quality-gates.md`
- Modify: `docs/maintainers/release-readiness.md`
- Modify: `addon-sdk/tests/distribution-docs.test.ts`

**Interfaces:**

- Consumes: final builder/reference/maintainer paths and `verify:docs`.
- Produces: concise stable contributor instructions and completed documentation-test ownership.

- [ ] **Step 1: Make tests expect stable agent sections and the new gate**

Keep the post-introduction equality test. Add expectations for these shared headings:

```ts
for (const heading of [
  "## How an add-on works",
  "## Commands",
  "## Documentation ownership",
  "## Stable engineering rules",
  "## Layout",
  "## Delivery",
])
  expect(agents).toContain(heading);
expect(agents).toContain("npm run verify:docs");
expect(agents).not.toContain("Current hardening checkpoint");
expect(agents).not.toContain("Discarded commit");
```

- [ ] **Step 2: Confirm the agent-document test fails**

Run the distribution-doc test. Expected: FAIL because the current files are organized around a
dated hardening checkpoint.

- [ ] **Step 3: Rewrite `AGENTS.md` and `CLAUDE.md` as one stable contract**

Preserve their distinct four-line introductions, then use identical content in this order:

```markdown
## How an add-on works

One compact lifecycle and ownership summary.

## Commands

Copy-paste root commands, including `verify:docs`, `ci:verify`, live schema, and release boundaries.

## Documentation ownership

Builder, SDK reference, maintainer, upstream, generated, historical, and ignored-local boundaries.

## Stable engineering rules

Runtime neutrality, Web Crypto, registration atomicity, verification, storage, body limits, retry,
URL/path, logging, and generated-source constraints.

## Layout

Current package, docs, source, examples, schemas, templates, tests, and scripts.

## Delivery

Ancestry checks, explicit push/publication authority, and no-force/no-amend rules.
```

Remove dated release narration, fixed package versions, transient SHAs/test counts, the discarded
commit note, and duplicated release-evidence prose. Keep commands and safety contracts concise and
actionable.

- [ ] **Step 4: Expand contributor and security navigation**

`CONTRIBUTING.md` must cover prerequisites, install, focused tests, `verify:docs`, `ci:verify`,
generated-file boundaries, documentation ownership, commit scope, and prohibited publication.
`SECURITY.md` keeps private reporting and supported-release policy, links the secure server recipe
and security-related guides, and avoids promising automatic security. Add an Unreleased changelog
entry describing the builder-first documentation, generated README, and docs verifier without a
version bump.

- [ ] **Step 5: Update quality/release docs for the new gate and published-version boundary**

Document `verify:docs` in the quality table. State that this documentation-only pass runs
`ci:verify` and `verify:schema-live`, but does not run `release:verify` against unchanged already
published versions because the publish dry-run must reject immutable versions.

- [ ] **Step 6: Run focused contributor/document tests**

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/distribution-docs.test.ts tests/tooling-config.test.ts
npm run verify:docs
npm exec -- prettier AGENTS.md CLAUDE.md CONTRIBUTING.md SECURITY.md CHANGELOG.md docs/README.md docs/maintainers --check
git diff --check
```

Expected: all pass, and a direct comparison of `AGENTS.md` and `CLAUDE.md` after line four is empty.

- [ ] **Step 7: Commit stable contributor guidance**

```bash
git add AGENTS.md CLAUDE.md CONTRIBUTING.md SECURITY.md CHANGELOG.md docs/README.md docs/maintainers/quality-gates.md docs/maintainers/release-readiness.md addon-sdk/tests/distribution-docs.test.ts
git commit -m "Stabilize contributor documentation"
```

---

### Task 8: Run the complete documentation and package proof

**Files:**

- Modify only if a verification failure proves a scoped documentation, test, or verifier defect.
- Do not modify package versions, runtime source, schemas, upstream snapshots, or generated output.

**Interfaces:**

- Consumes: all prior task deliverables.
- Produces: a clean, committed documentation rework with current local evidence.

- [ ] **Step 1: Run focused documentation gates**

```bash
npm run verify:docs
npm run verify:marketplace-docs
npm test -w @apet97/clockify-addon-sdk -- tests/documentation-verification.test.ts tests/distribution-docs.test.ts tests/creator.test.ts
npm run verify:scaffolds
```

Expected: all exit 0.

- [ ] **Step 2: Run the canonical deterministic gate**

```bash
npm run ci:verify
```

Expected: exit 0 with type-check, generated drift, Marketplace/docs verification, thresholded
coverage, lint, format, dual build/import, package/consumer/scaffold checks, and both audits green.

- [ ] **Step 3: Run the live schema check separately**

```bash
npm run verify:schema-live
```

Expected with network access: schema versions 1.2-1.5 match. If unavailable, record the exact
network failure as missing evidence; do not turn it into a code or documentation finding.

- [ ] **Step 4: Prove the no-change boundaries**

```bash
git diff --exit-code 4040224 -- addon-sdk/src addon-sdk/schemas addon-sdk/public-api.snapshot.md MARKETPLACE_DOCS/01-introduction.md MARKETPLACE_DOCS/02-quick-start.md MARKETPLACE_DOCS/03-lifecycle.md MARKETPLACE_DOCS/04-ui-components.md MARKETPLACE_DOCS/05-webhooks.md MARKETPLACE_DOCS/06-structured-settings.md MARKETPLACE_DOCS/07-developer-account.md MARKETPLACE_DOCS/08-authentication-and-authorization.md MARKETPLACE_DOCS/09-environments-and-regions.md MARKETPLACE_DOCS/10-window-events.md MARKETPLACE_DOCS/11-development-checklist.md MARKETPLACE_DOCS/12-publishing-and-guidelines.md MARKETPLACE_DOCS/13-private-addon-deployment.md MARKETPLACE_DOCS/provenance.json
git diff --check
git status --short --branch
```

Expected: the boundary diff is empty, `git diff --check` exits 0, and the worktree is clean.

- [ ] **Step 5: Perform the final human truth scan**

```bash
rg -n "v1_4Builder|does not add a Clockify REST client|No REST client or token exchange client is included|docs/(architecture|product-surface|quality-gates|release-readiness|marketplace-coverage|pre-release-migration)\.md" README.md docs addon-sdk/README.md addon-sdk/docs create-clockify-addon/README.md AGENTS.md CLAUDE.md CONTRIBUTING.md SECURITY.md --glob '!docs/superpowers/**' --glob '!docs/archive/**'
```

Expected: any `v1_4Builder` hits are explicitly compatibility/reference examples; no stale client
claim or old active maintainer path remains.

- [ ] **Step 6: Record the final state without publishing or pushing**

Update the existing Obsidian project note with the final commit, verification results, and any
unavailable network evidence. Stop with local `main` ahead of `origin/main`; delivery remains a
separate explicitly authorized action.
