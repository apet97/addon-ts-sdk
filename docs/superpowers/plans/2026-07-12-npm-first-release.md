# npm First Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `@apet97/clockify-addon-sdk@1.0.0` and `create-clockify-addon@1.0.0`, make all
public documentation truthful for registry consumers, prove both registry artifacts from a fresh
consumer, and deliver the documentation commit to `main`.

**Architecture:** Treat the SDK and creator as separate npm artifacts. Update the documentation
contract before packing so the published READMEs describe registry installation, publish the SDK
before the creator because generated projects depend on `^1.0.0`, then validate the exact registry
artifacts outside the repository. Keep deterministic repository gates and future-release controls
unchanged.

**Tech Stack:** npm 11, TypeScript 6, Vitest 4, Node 22+, GitHub Actions.

## Global Constraints

- Publish exactly `@apet97/clockify-addon-sdk@1.0.0` and `create-clockify-addon@1.0.0`.
- Use the public npm registry and public access.
- Never print, copy, persist, or request an npm token or one-time password in repository files.
- Stop before real publication unless `npm whoami` succeeds as `apet97`.
- Publish the SDK before the creator.
- Do not create a git tag, GitHub release, Marketplace submission, or npm version bump.
- Keep `AGENTS.md` and `CLAUDE.md` synchronized after their title and introduction.
- Preserve the authenticated final-SHA Marketplace receipt and the existing Node 22/24 CI proof.
- Run the full release gate before publishing and a registry-only consumer probe afterward.

---

### Task 1: Establish the release boundary and write the failing documentation contract

**Files:**

- Create: `addon-sdk/tests/distribution-docs.test.ts`
- Delete: `addon-sdk/tests/source-only-docs.test.ts`

**Interfaces:**

- Consumes: public README files, package manifests, release-readiness documentation.
- Produces: a deterministic test that requires registry installation instructions and rejects stale
  source-only claims.

- [ ] **Step 1: Verify repository, registry, and package state**

Run:

```bash
git status --short --branch
git rev-list --left-right --count origin/main...main
npm config get registry
npm view @apet97/clockify-addon-sdk version
npm view create-clockify-addon version
npm whoami
```

Expected before release: clean `main`, `0 0`, the public npm registry, both package lookups return
404, and `npm whoami` must eventually return `apet97` before Task 4.

- [ ] **Step 2: Replace the source-only documentation test with a published-distribution contract**

The new test must retain the secure-server recipe assertions and additionally require:

```ts
expect(rootReadme).toContain("npm install @apet97/clockify-addon-sdk");
expect(packageReadme).toContain("npm install @apet97/clockify-addon-sdk");
expect(rootReadme).toContain("npm create clockify-addon@latest");
expect(creatorReadme).toContain("npm create clockify-addon@latest");
expect(productSurface).toContain("published to the npm registry");
expect(releaseReadiness).toContain("Published versions");
expect(releaseReadiness).toContain("@apet97/clockify-addon-sdk@1.0.0");
expect(releaseReadiness).toContain("create-clockify-addon@1.0.0");
```

It must reject stale public claims:

```ts
const publicDocs = [
  rootReadme,
  packageReadme,
  creatorReadme,
  productSurface,
  releaseReadiness,
];
for (const document of publicDocs) {
  expect(document).not.toContain("source-only");
  expect(document).not.toContain("not published to the npm registry");
}
```

- [ ] **Step 3: Verify the new contract fails for the expected reason**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/distribution-docs.test.ts
```

Expected: FAIL because the public docs still advertise source-only/local installation.

---

### Task 2: Make the public documentation and maintainer contracts publication-accurate

**Files:**

- Modify: `README.md`
- Modify: `addon-sdk/README.md`
- Modify: `create-clockify-addon/README.md`
- Modify: `docs/product-surface.md`
- Modify: `docs/release-readiness.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `create-clockify-addon/package.json`

**Interfaces:**

- Consumes: package names, version `1.0.0`, current CLI argument contract, final-SHA live receipt.
- Produces: accurate npm installation, creator invocation, future release, and maintainer guidance.

- [ ] **Step 1: Update registry installation instructions**

Use these canonical commands:

```bash
npm install @apet97/clockify-addon-sdk
npm create clockify-addon@latest ./my-addon -- --runtime node --features all
```

Keep local checkout/tarball commands only under contributor or unreleased-change guidance.

- [ ] **Step 2: Update release and product truth**

State that version `1.0.0` of both packages is published. Convert the first-publish checklist into a
future-release checklist that still requires `npm run release:verify`, explicit owner approval,
fresh live validation after behavior changes, SDK-first publication, and registry consumer smoke.
Keep Marketplace publication explicitly separate.

- [ ] **Step 3: Synchronize `AGENTS.md` and `CLAUDE.md`**

Both files must say:

- the SDK and creator are published npm packages at `1.0.0`;
- `npm install` and `npm create` are the supported consumer entry points;
- the authenticated Firefox lifecycle receipt applies to final runtime SHA `e74e1f7`;
- future publishes require version changes, full release verification, SDK-first order, registry
  smoke, and explicit authorization.

- [ ] **Step 4: Record the release in the changelog**

Rename the release-candidate heading to `1.0.0` and record the npm publication without adding a git
tag or implying Marketplace publication.

- [ ] **Step 5: Complete creator registry metadata**

Add public `publishConfig`, author, repository directory, homepage, bugs, and package keywords to
the creator manifest so its npm page has the same ownership and source links as the SDK.

- [ ] **Step 6: Verify the documentation contract turns green**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/distribution-docs.test.ts
diff -u <(tail -n +4 AGENTS.md) <(tail -n +4 CLAUDE.md)
```

Expected: PASS and no diff.

---

### Task 3: Prove and commit the exact release candidates

**Files:**

- Modify: files from Tasks 1 and 2 only.

**Interfaces:**

- Consumes: green distribution contract and synchronized docs.
- Produces: one clean documentation/release commit whose prepack outputs are the intended npm
  artifacts.

- [ ] **Step 1: Run the full release gate**

```bash
npm run release:verify
npx madge@8 --extensions ts --circular addon-sdk/src
git diff --check
```

Expected: all commands exit 0; release verification performs dry-run publication only.

- [ ] **Step 2: Inspect both final tarballs**

```bash
npm pack --ignore-scripts --json -w @apet97/clockify-addon-sdk
npm pack --ignore-scripts --json -w create-clockify-addon
```

Expected: SDK contains built output/docs/schemas; creator contains bin, typed source, README, and
license. Remove the temporary tarballs after inspection.

- [ ] **Step 3: Commit the release documentation**

```bash
git add AGENTS.md CLAUDE.md CHANGELOG.md README.md addon-sdk/README.md \
  create-clockify-addon/README.md create-clockify-addon/package.json \
  docs/product-surface.md docs/release-readiness.md docs/marketplace-coverage.md \
  docs/superpowers/plans/2026-07-12-npm-first-release.md \
  addon-sdk/tests/distribution-docs.test.ts addon-sdk/tests/source-only-docs.test.ts
git commit -m "Publish npm installation guidance"
```

Expected: one focused commit and a clean worktree.

---

### Task 4: Authenticate and publish both 1.0.0 packages

**Files:** None.

**Interfaces:**

- Consumes: clean committed release candidates and authenticated npm identity `apet97`.
- Produces: two public npm registry versions.

- [ ] **Step 1: Authenticate without exposing credentials**

```bash
npm login --auth-type=web
npm whoami
```

Expected: browser authorization completes and `npm whoami` prints `apet97`. If authentication does
not complete, stop; do not attempt publication.

- [ ] **Step 2: Reconfirm versions remain absent**

```bash
npm view @apet97/clockify-addon-sdk@1.0.0 version
npm view create-clockify-addon@1.0.0 version
```

Expected immediately before first publish: both return 404.

- [ ] **Step 3: Publish in dependency order**

```bash
npm publish -w @apet97/clockify-addon-sdk --access public
npm publish -w create-clockify-addon --access public
```

Expected: successful publication of both `1.0.0` versions. Do not retry a successful publish.

---

### Task 5: Prove registry consumers, deliver `main`, and record evidence

**Files:**

- Modify outside repository: `/Users/15x/Downloads/addon-ts-sdk-nonsecurity-review-2026-07-12.md`
- Modify outside repository: `/Users/15x/Documents/Obsidian Vault/03 Projects/Clockify Add-on TypeScript SDK.md`

**Interfaces:**

- Consumes: public npm versions and committed docs.
- Produces: registry-install proof, synchronized `main`, green CI, and sanitized release evidence.

- [ ] **Step 1: Wait for registry visibility**

```bash
npm view @apet97/clockify-addon-sdk@1.0.0 version
npm view create-clockify-addon@1.0.0 version
```

Expected: both print `1.0.0`.

- [ ] **Step 2: Install and exercise the registry artifacts in a fresh temporary consumer**

The probe must install exact versions from npm, import SDK ESM and creator ESM, type-check the
creator declaration and SDK root, invoke `npm create clockify-addon@1.0.0 -- --help`, and generate a
minimal project whose dependency resolves to `^1.0.0`.

- [ ] **Step 3: Push the release documentation commit safely**

```bash
git fetch origin
git merge-base --is-ancestor origin/main main
git push origin main
git rev-list --left-right --count origin/main...main
```

Expected: fast-forward push and `0 0`.

- [ ] **Step 4: Wait for GitHub Actions**

Use `gh run watch --exit-status` for the push-triggered SDK CI run. Require both Node 22.x and Node
24.x jobs to pass.

- [ ] **Step 5: Record sanitized evidence**

Update the report and existing project note with package names, version `1.0.0`, registry consumer
proof, commit SHA, CI run, and remote parity. Never record npm credentials, authorization URLs,
tokens, or one-time passwords.
