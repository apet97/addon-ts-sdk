# Repository Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the root README and GitHub metadata into a polished, accurate landing page for the
published Clockify add-on SDK and creator packages.

**Architecture:** Keep the root README as a concise navigation and evaluation surface, with detailed
usage remaining in the package README and `docs/`. Use live badges and canonical evidence links to
avoid stale release prose. Change public repository metadata separately through `gh`, then read it
back to verify the mutation.

**Tech Stack:** GitHub-flavored Markdown, npm package metadata, GitHub Actions badges, Shields.io,
GitHub CLI.

## Global Constraints

- Preserve the independent, unofficial-project disclaimer.
- Do not add screenshots, logos, social-preview art, decorative emoji, or hard-coded test counts.
- Do not claim official Clockify affiliation, Marketplace approval, universal runtime support, or
  automatic application security.
- Do not change package code, versions, dependencies, exports, CI, authentication, or security
  settings.
- Keep detailed API and release procedures in their existing canonical documents.
- Do not edit `AGENTS.md` or `CLAUDE.md`; their synchronized technical guidance remains current.
- Do not push, tag, publish, create a release, or submit to Marketplace.

---

## File Map

- Modify `README.md`: public repository landing page and navigation.
- Create no assets or additional runtime files.
- Read only `addon-sdk/README.md`, `create-clockify-addon/README.md`, `docs/architecture.md`,
  `docs/product-surface.md`, `docs/quality-gates.md`, and package manifests to validate claims.
- Update GitHub repository description, homepage, and topics through `gh repo edit`; this has no
  tracked file representation.

### Task 1: Replace the root landing page

**Files:**

- Modify: `README.md`
- Test: `addon-sdk/tests/distribution-docs.test.ts`

**Interfaces:**

- Consumes: current npm package names, CLI flags, Node floor, adapter subpaths, documentation paths,
  and GitHub workflow name.
- Produces: a root landing page that links developers to the published creator, SDK, technical docs,
  and repository gates.

- [ ] **Step 1: Reconfirm every public command and claim**

Run:

```bash
git status --short --branch
node create-clockify-addon/bin/create-clockify-addon.mjs --help
node -e 'for (const path of ["./addon-sdk/package.json", "./create-clockify-addon/package.json"]) { const value = require(path); console.log(value.name, value.version, value.engines.node); }'
cmp -s <(tail -n +4 AGENTS.md) <(tail -n +4 CLAUDE.md)
```

Expected: only the committed design/plan work is ahead of `origin/main`; CLI options remain
`node|worker` and `all|minimal`; both packages are `1.0.3` with Node `>=22`; agent-document tails
match.

- [ ] **Step 2: Replace `README.md` with the approved landing-page content**

Use this exact structure and copy, adjusting only a URL that a verification step proves broken:

````markdown
<div align="center">

# Clockify Add-on SDK for TypeScript

Build Clockify add-on backends with typed manifests, verified request handlers, and executable
Node.js or Cloudflare Worker scaffolds.

<p>
  <a href="https://www.npmjs.com/package/@apet97/clockify-addon-sdk"><img alt="SDK npm version" src="https://img.shields.io/npm/v/%40apet97%2Fclockify-addon-sdk?label=SDK"></a>
  <a href="https://www.npmjs.com/package/create-clockify-addon"><img alt="Creator npm version" src="https://img.shields.io/npm/v/create-clockify-addon?label=creator"></a>
  <a href="https://github.com/apet97/addon-ts-sdk/actions/workflows/ci.yml"><img alt="SDK CI" src="https://github.com/apet97/addon-ts-sdk/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="https://www.npmjs.com/package/@apet97/clockify-addon-sdk"><img alt="Node.js support" src="https://img.shields.io/node/v/%40apet97%2Fclockify-addon-sdk"></a>
  <a href="./LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/apet97/addon-ts-sdk"></a>
</p>

</div>

> Independent, unofficial project. Not affiliated with, endorsed by, or supported by Clockify or
> CAKE.com.

This repository handles the **inbound add-on boundary**: manifests, signed component and lifecycle
requests, webhooks, settings, iframe integration, and runtime wiring. It is not a general-purpose
Clockify REST API client.

## Start in 30 seconds

Create a fail-closed Node project with lifecycle and webhook routes:

```bash
npm create clockify-addon@latest ./my-addon -- --runtime node --features all
cd my-addon
cp .env.example .env
npm start
```

The generated README explains the required public origin, parent origin, and durable storage setup.
For an existing project, install the SDK directly:

```bash
npm install @apet97/clockify-addon-sdk
```

See the [SDK quick start](./addon-sdk/README.md#quick-start) or
[creator options](./create-clockify-addon/README.md) for the next step.

## What you get

| Capability             | Included                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Typed manifests        | Generated builders and runtime validation for Clockify manifest schemas 1.2–1.5                      |
| Verified requests      | RS256 component, lifecycle, and stored-token webhook verification with context checks                |
| Runtime adapters       | Node.js `http`, optional Express integration, and the standard Fetch API                             |
| Add-on services        | Claim-driven token exchange, structured settings transport, and generic authenticated requests       |
| Installation workflows | Store contracts, encryption wrappers, lifecycle guards, and webhook idempotency leases               |
| Browser integration    | Hardened HTML/JSON responses and an exact-origin iframe bridge                                       |
| Executable scaffolds   | Node/Worker and minimal/all-feature projects that type-check and fail closed before production setup |

## How it fits

```text
Clockify
  └─ signed component, lifecycle, or webhook request
      └─ @apet97/clockify-addon-sdk
          ├─ verify identity and installation context
          ├─ enforce body, routing, and response boundaries
          └─ call your handler, storage, and business logic
```

Entity-specific outbound REST clients remain outside this package. See
[Product Surface](./docs/product-surface.md) for the exact boundary.

## Packages

| Package                                                                                  | Purpose                                                                                          | Distribution             |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ |
| [`@apet97/clockify-addon-sdk`](https://www.npmjs.com/package/@apet97/clockify-addon-sdk) | Manifests, routing, verification, adapters, storage contracts, client helpers, and UI primitives | ESM + CommonJS, Node 22+ |
| [`create-clockify-addon`](https://www.npmjs.com/package/create-clockify-addon)           | CLI and typed programmatic scaffolding for Node or Worker projects                               | ESM, Node 22+            |

The SDK root stays runtime-neutral. Host integrations are explicit:

| Runtime         | Import                                        |
| --------------- | --------------------------------------------- |
| Node.js HTTP    | `@apet97/clockify-addon-sdk/adapters/node`    |
| Express         | `@apet97/clockify-addon-sdk/adapters/express` |
| Fetch / Workers | `@apet97/clockify-addon-sdk/adapters/fetch`   |

## Trust the artifact

The repository verifies what users install, not only workspace source:

- package linting checks both packed artifacts with publint and Are The Types Wrong;
- installed ESM, CommonJS, and TypeScript consumers import the packed SDK;
- all four Node/Worker and minimal/all-feature projects are generated and executed from tarballs;
- generated manifests are validated and failure paths are exercised;
- vendored schemas and public API declarations are checked for drift.

The canonical gate is:

```bash
npm ci
npm run ci:verify
```

See [Quality Gates](./docs/quality-gates.md),
[Release Evidence](./docs/release-readiness.md), and
[Marketplace Coverage](./docs/marketplace-coverage.md) for the proof boundaries.

## Documentation

- [SDK guide and quick start](./addon-sdk/README.md)
- [Creator CLI and programmatic API](./create-clockify-addon/README.md)
- [API reference](./addon-sdk/docs/api-reference.md)
- [Architecture](./docs/architecture.md)
- [Manifest builders](./addon-sdk/docs/manifest-builders.md)
- [Routing and middleware](./addon-sdk/docs/routing.md)
- [Token validation](./addon-sdk/docs/token-validation.md)
- [Secure server recipe](./addon-sdk/docs/secure-server-recipe.md)
- [Java migration](./addon-sdk/docs/java-migration.md)
- [Changelog](./CHANGELOG.md)

## Contributing

Source development requires Node 22.13.0 or newer. Start with:

```bash
npm ci
npm run verify:fast
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before changing generated models or public API, and use
[SECURITY.md](./SECURITY.md) for private vulnerability reporting.

MIT licensed. Clockify and CAKE.com are trademarks of their respective owners.
````

- [ ] **Step 3: Format the README and run the focused documentation contract**

Run:

```bash
npx prettier --write README.md
npx prettier --check README.md
npm exec -w @apet97/clockify-addon-sdk -- vitest run tests/distribution-docs.test.ts
git diff --check
```

Expected: Prettier reports the README formatted; four distribution-documentation tests pass; diff
check is silent.

- [ ] **Step 4: Validate local and remote links without adding dependencies**

Run this Node probe from the repository root:

```bash
node --input-type=module <<'NODE'
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const markdown = await readFile("README.md", "utf8");
const localTargets = [...markdown.matchAll(/\]\((\.\/[^)#]+)(?:#[^)]+)?\)/g)].map((match) =>
  resolve(match[1]),
);
for (const target of new Set(localTargets)) await readFile(target);

const remoteTargets = [
  "https://img.shields.io/npm/v/%40apet97%2Fclockify-addon-sdk?label=SDK",
  "https://img.shields.io/npm/v/create-clockify-addon?label=creator",
  "https://github.com/apet97/addon-ts-sdk/actions/workflows/ci.yml/badge.svg?branch=main",
  "https://img.shields.io/node/v/%40apet97%2Fclockify-addon-sdk",
  "https://img.shields.io/github/license/apet97/addon-ts-sdk",
];
for (const url of remoteTargets) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
}
console.log(`README links OK: ${new Set(localTargets).size} local, ${remoteTargets.length} badges`);
NODE
```

Expected: all local files open, all five badge requests return 2xx, and the final line reports the
validated link counts.

- [ ] **Step 5: Run the repository documentation and unit gates**

Run:

```bash
npm run verify:marketplace-docs
npm run format:check
npm run test
git diff --check
```

Expected: Marketplace provenance passes, formatting passes, 39 test files and 316 tests pass, and
diff check is silent.

- [ ] **Step 6: Review and commit the README**

Run:

```bash
git diff -- README.md
rg -n "official|Marketplace approved|production-ready|tests passed|coverage" README.md
git status --short
git add README.md
git commit -m "Polish repository landing page"
```

Expected: the review finds only the explicit unofficial disclaimer and evidence links, no unsupported
claims or fixed proof counts, and the commit contains the README plus this plan.

### Task 2: Apply and verify public GitHub metadata

**Files:**

- Modify: none; this task updates repository metadata through the GitHub API.

**Interfaces:**

- Consumes: repository `apet97/addon-ts-sdk` and the exact description, homepage, and topic set from
  the approved design.
- Produces: a scannable GitHub About panel that points to the published SDK.

- [ ] **Step 1: Confirm authentication and current repository identity**

Run:

```bash
gh auth status
gh repo view apet97/addon-ts-sdk --json nameWithOwner,visibility,url,defaultBranchRef
```

Expected: GitHub CLI is authenticated; the target is public `apet97/addon-ts-sdk`; default branch is
`main`. Stop if any identity differs.

- [ ] **Step 2: Apply the approved metadata**

Run:

```bash
gh repo edit apet97/addon-ts-sdk \
  --description "TypeScript SDK and scaffolding for Clockify add-ons: manifests, lifecycle, webhooks, UI components, and Node/Worker adapters." \
  --homepage "https://www.npmjs.com/package/@apet97/clockify-addon-sdk" \
  --add-topic clockify \
  --add-topic clockify-addon \
  --add-topic typescript \
  --add-topic sdk \
  --add-topic webhooks \
  --add-topic nodejs \
  --add-topic cloudflare-workers
```

Expected: command exits 0 without changing repository visibility, branch settings, or features.

- [ ] **Step 3: Read back the public metadata**

Run:

```bash
gh repo view apet97/addon-ts-sdk \
  --json description,homepageUrl,repositoryTopics,visibility,defaultBranchRef,url
```

Expected: description and homepage match exactly; topics contain the seven approved values;
visibility remains `PUBLIC`; default branch remains `main`.

### Task 3: Final presentation verification and project record

**Files:**

- Modify: `/Users/15x/Documents/Obsidian Vault/03 Projects/Clockify Add-on TypeScript SDK.md`
  outside the repository.

**Interfaces:**

- Consumes: committed README, verified metadata, local test results.
- Produces: final clean local state and a sanitized project-progress record.

- [ ] **Step 1: Verify the committed repository state**

Run:

```bash
git status --short --branch
git log -2 --oneline
git diff --check
cmp -s <(tail -n +4 AGENTS.md) <(tail -n +4 CLAUDE.md)
```

Expected: local `main` is clean and ahead of `origin/main` only by the approved design, plan, and
README commits; diff check is silent; agent-document tails match.

- [ ] **Step 2: Record the presentation refresh in the existing project note**

Add this exact milestone to the existing `## Milestones` list:

```markdown
- [x] Refresh the public repository presentation with a restrained OSS landing page and focused
      GitHub description, homepage, and topics; verify documentation and unit gates without pushing,
      tagging, publishing packages, or submitting to Marketplace.
```

- [ ] **Step 3: Report the handoff boundary**

Report the local commit SHA, verification commands, public metadata values, and whether the worktree
is clean. Explicitly state that the commits have not been pushed and request separate authorization
if the user wants `main` updated.
