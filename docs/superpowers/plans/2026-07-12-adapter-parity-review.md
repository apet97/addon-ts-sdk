# Adapter Parity Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct all confirmed non-security request, registration, Worker-start, and creator-package
failures, then finish the current adversarial review.

**Architecture:** Keep request corrections inside the runtime adapters, initialize optional
manifest collections only after successful route registration, and retain the creator's existing
ESM API while adding declarations. Verify generated variants through the packed creator and compile
Worker entry points with Wrangler. Dependencies and SDK public APIs remain unchanged.

**Tech Stack:** TypeScript 6, Node 22 HTTP, Fetch API, Vitest 4, npm workspaces.

## Global Constraints

- Keep the root entrypoint runtime-neutral and do not add runtime dependencies.
- Keep `AGENTS.md` and `CLAUDE.md` synchronized except for their headings and introductions.
- Use test-first red-green-refactor for every behavior change.
- Keep security assessment explicitly out of scope.
- Do not publish, tag, submit to Marketplace, push, or modify another repository.

---

### Task 1: Preserve Node origin-form request targets

**Files:**
- Modify: `addon-sdk/tests/adapters-node-server.test.ts`
- Modify: `addon-sdk/src/adapters/node-http.ts`

**Interfaces:**
- Consumes: `IncomingMessage.url`, `Addon.handle(AddonRequest)`.
- Produces: unchanged `fromNodeRequest(req, options): Promise<AddonRequest>` behavior with a
  pathname that retains every leading slash.

- [ ] **Step 1: Write the failing raw-wire regression test**

Add this test after the existing unknown-route test:

```ts
it("does not reinterpret a double-slash request target as a different authority", async () => {
  const addon = new ClockifyAddon(base());
  const handler = vi.fn(() => ({ status: 204 }));
  addon.registerHandler("/component", "GET", handler);
  const port = await listen(addon);

  const response = await sendRawHttp(
    port,
    [
      "GET //other.example/component HTTP/1.1",
      "Host: localhost",
      "Connection: close",
      "",
      "",
    ].join("\r\n"),
  );

  expect(response).toMatch(/^HTTP\/1\.1 404 /);
  expect(handler).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Verify the test fails for the reproduced reason**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/adapters-node-server.test.ts \
  -t "does not reinterpret a double-slash request target"
```

Expected: FAIL because the current adapter returns 204 and invokes the `/component` handler.

- [ ] **Step 3: Implement origin-form parsing that retains leading slashes**

Add this private helper above `fromNodeRequest`:

```ts
function parseNodeRequestUrl(requestTarget: string | undefined): URL {
  const target = requestTarget || "";
  return new URL(target.startsWith("/") ? `http://localhost${target}` : target, "http://localhost");
}
```

Replace the existing URL construction with:

```ts
const url = parseNodeRequestUrl(req.url);
```

- [ ] **Step 4: Verify the focused Node adapter suite passes**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/adapters-node-server.test.ts
```

Expected: all Node server integration tests pass.

---

### Task 2: Validate Fetch declared lengths on every method

**Files:**
- Modify: `addon-sdk/tests/adapters.test.ts`
- Modify: `addon-sdk/src/adapters/fetch.ts`

**Interfaces:**
- Consumes: `Request.headers`, `parseContentLength`, `maxBodyBytes`.
- Produces: unchanged `handleFetchRequest(addon, request, options): Promise<Response>` API with
  method-independent declared-length validation.

- [ ] **Step 1: Write failing oversized GET/HEAD tests**

Add this test after the existing Fetch oversized-body test:

```ts
it.each(["GET", "HEAD"])(
  "returns 413 for an oversized declared length on %s without dispatching or reporting",
  async (method) => {
    const onError = vi.fn();
    const addon = new ClockifyAddon(mockManifest);
    const handler = vi.fn(() => ({ status: 204 }));
    addon.registerHandler("/component", "GET", handler);

    const response = await handleFetchRequest(
      addon,
      new Request("https://example.com/component", {
        method,
        headers: { "content-length": "5" },
      }),
      { maxBodyBytes: 4, onError },
    );

    expect(response.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  },
);
```

- [ ] **Step 2: Write the failing malformed GET test**

Add this adjacent test:

```ts
it("returns 400 for a malformed declared length on GET without dispatching or reporting", async () => {
  const onError = vi.fn();
  const addon = new ClockifyAddon(mockManifest);
  const handler = vi.fn(() => ({ status: 204 }));
  addon.registerHandler("/component", "GET", handler);

  const response = await handleFetchRequest(
    addon,
    new Request("https://example.com/component", {
      method: "GET",
      headers: { "content-length": "007" },
    }),
    { onError },
  );

  expect(response.status).toBe(400);
  expect(handler).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Verify all three cases fail for the reproduced reason**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/adapters.test.ts \
  -t "declared length on"
```

Expected: three failures because the current Fetch adapter routes GET and HEAD before parsing the
declaration.

- [ ] **Step 4: Move declaration validation ahead of the body-presence branch**

Remove the `Content-Length` check from `readFetchBody`. Replace the current conditional body block
inside `handleFetchRequest` with:

```ts
try {
  const contentLength = request.headers.get("content-length");
  if ((parseContentLength(contentLength) ?? 0) > maxBodyBytes) {
    throw new PayloadTooLargeError(maxBodyBytes);
  }

  if (request.body && request.method !== "GET" && request.method !== "HEAD") {
    rawBody = await readFetchBody(request, maxBodyBytes);
    if (rawBody.length > 0) {
      const text = new TextDecoder().decode(rawBody);
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
  }
} catch (e) {
  if (e instanceof PayloadTooLargeError) {
    return new Response("Payload Too Large", { status: 413 });
  }
  return new Response("Bad Request", { status: 400 });
}
```

- [ ] **Step 5: Verify both focused adapter suites pass**

Run:

```bash
npm test -w @apet97/clockify-addon-sdk -- \
  tests/adapters.test.ts tests/adapters-node-server.test.ts
```

Expected: both files pass with no warnings.

- [ ] **Step 6: Commit the runtime correction**

```bash
git add addon-sdk/src/adapters/node-http.ts addon-sdk/src/adapters/fetch.ts \
  addon-sdk/tests/adapters-node-server.test.ts addon-sdk/tests/adapters.test.ts
git commit -m "Align Node and Fetch request handling"
```

---

### Task 3: Synchronize the adapter contract documentation

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: the behavior proven by Tasks 1 and 2.
- Produces: synchronized contributor contracts with no broader compatibility claim.

- [ ] **Step 1: Replace the existing body-limit checkpoint in both files**

Use this exact text in each document:

```md
- Keep Node `http` and Fetch body-limit semantics aligned on every HTTP method: declared
  `content-length` values above `maxBodyBytes` must fail before routing, and streamed bodies must
  still fail once the byte counter crosses the limit. Malformed declared lengths return 400 without
  invoking `onError`. The Node adapter must preserve leading slashes in origin-form request targets;
  `//host/path` is a path, not an alternate authority. Express body limits stay with the host app.
```

- [ ] **Step 2: Verify synchronization and focused documentation checks**

Run:

```bash
diff -u <(tail -n +4 AGENTS.md) <(tail -n +4 CLAUDE.md)
npm test -w @apet97/clockify-addon-sdk -- tests/tooling-config.test.ts \
  tests/perfect-foundations.test.ts
git diff --check
```

Expected: the diff command and tests exit 0; `git diff --check` prints nothing.

- [ ] **Step 3: Commit the truthful contract update**

```bash
git add AGENTS.md CLAUDE.md
git commit -m "Document adapter request parity"
```

---

### Task 4: Register against valid manifests with absent arrays

**Files:**
- Modify: `addon-sdk/tests/clockify.test.ts`
- Modify: `addon-sdk/src/clockify/clockify-addon.ts`

**Interfaces:**
- Consumes: schema-valid `ClockifyManifest<"1.4">` values whose optional descriptor arrays are
  absent.
- Produces: unchanged `registerComponent`, `registerLifecycleEvent`, and `registerWebhook` methods
  that attach arrays only after successful route registration.

- [ ] **Step 1: Write the failing absent-array regression test**

Import `createValidatedClockifyAddon`, then add:

```ts
it("registers routes against schema-valid manifests with absent optional arrays", () => {
  const manifest: ClockifyManifest<"1.4"> = {
    schemaVersion: "1.4",
    key: "raw-valid-addon",
    name: "Raw Valid Addon",
    baseUrl: "https://example.com/addon",
    minimalSubscriptionPlan: "BASIC",
  };
  const addon = createValidatedClockifyAddon(manifest);
  const component = generated.v1_4
    .ClockifyComponentBuilder()
    .type("sidebar")
    .allowEveryone()
    .path("/component/raw")
    .label("Raw component")
    .build();
  const lifecycle = generated.v1_4
    .ClockifyLifecycleEventBuilder()
    .path("/lifecycle/raw")
    .onInstalled()
    .build();
  const webhook = generated.v1_4
    .ClockifyWebhookBuilder()
    .event("NEW_PROJECT")
    .path("/webhooks/raw")
    .build();

  addon.registerComponent(component, () => ({ status: 204 }));
  addon.registerLifecycleEvent(lifecycle, () => ({ status: 204 }));
  addon.registerWebhook(webhook, () => ({ status: 204 }));

  expect(addon.getManifest().components).toEqual([component]);
  expect(addon.getManifest().lifecycle).toEqual([lifecycle]);
  expect(addon.getManifest().webhooks).toEqual([webhook]);
});
```

- [ ] **Step 2: Verify the test fails for the reproduced reason**

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/clockify.test.ts \
  -t "absent optional arrays"
```

Expected: the case throws while reading `find` from `undefined`.

- [ ] **Step 3: Return initialized manifest entries**

Change `registerManifestRoute` to accept `T[] | undefined` and return the array it used:

```ts
function registerManifestRoute<T extends { readonly path: string }>(
  addon: { registerHandler(path: string, method: string, handler: RequestHandler): void },
  kind: string,
  entries: T[] | undefined,
  descriptor: T,
  method: string,
  handler: RequestHandler,
): T[] {
  const manifestEntries = entries ?? [];
  const existing = manifestEntries.find((entry) => entry.path === descriptor.path);
  if (existing && !descriptorsEqual(existing, descriptor)) {
    throw new IllegalArgumentException(
      `Conflicting ${kind} is already declared for path ${descriptor.path}.`,
    );
  }

  addon.registerHandler(descriptor.path, method, handler);
  if (!existing) manifestEntries.push(descriptor);
  return manifestEntries;
}
```

Assign each returned array to `m.webhooks`, `m.lifecycle`, or `m.components` after the helper
returns.

- [ ] **Step 4: Verify the full registration suite passes**

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/clockify.test.ts
```

- [ ] **Step 5: Commit registration hardening**

```bash
git add addon-sdk/src/clockify/clockify-addon.ts addon-sdk/tests/clockify.test.ts
git commit -m "Support manifests with optional descriptor arrays"
```

---

### Task 5: Share raw-target parsing with Express-like fallbacks

**Files:**
- Create: `addon-sdk/src/adapters/request-target.ts`
- Modify: `addon-sdk/src/adapters/node-http.ts`
- Modify: `addon-sdk/src/adapters/express.ts`
- Modify: `addon-sdk/tests/adapters.test.ts`

**Interfaces:**
- Consumes: an optional raw HTTP request target.
- Produces: internal `parseHttpRequestTarget(requestTarget): URL`, used only by Node and Express
  adapter implementation files.

- [ ] **Step 1: Write the failing Express fallback regression test**

Add this beside the existing Express URL-query fallback test:

```ts
it("preserves leading slashes when Express-like req.path is unavailable", async () => {
  const addon = new ClockifyAddon(mockManifest);
  const route = vi.fn(() => ({ status: 204 }));
  addon.registerHandler("/component", "GET", route);
  const handler = createExpressAddonHandler(addon);
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };

  await handler(
    { method: "GET", url: "//other.example/component", headers: {} },
    mockRes,
  );

  expect(mockRes.status).toHaveBeenCalledWith(404);
  expect(route).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Verify the test fails because `/component` is dispatched**

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/adapters.test.ts \
  -t "Express-like req.path is unavailable"
```

Expected: FAIL with status 204 and one route invocation.

- [ ] **Step 3: Extract and reuse the internal parser**

Create `request-target.ts`:

```ts
export function parseHttpRequestTarget(requestTarget: string | undefined): URL {
  const target = requestTarget || "";
  return new URL(target.startsWith("/") ? `http://localhost${target}` : target, "http://localhost");
}
```

Import it from `node-http.ts` and `express.ts`, remove the private Node helper, and construct both
adapter URLs with `parseHttpRequestTarget(req.url)`.

- [ ] **Step 4: Verify Node and Express adapter suites pass**

```bash
npm test -w @apet97/clockify-addon-sdk -- \
  tests/adapters.test.ts tests/adapters-node-server.test.ts tests/express-runtime.test.ts
```

- [ ] **Step 5: Commit shared target parsing**

```bash
git add addon-sdk/src/adapters/request-target.ts addon-sdk/src/adapters/node-http.ts \
  addon-sdk/src/adapters/express.ts addon-sdk/tests/adapters.test.ts
git commit -m "Preserve Express fallback request targets"
```

---

### Task 6: Make the packed creator typed, tested, and runnable

**Files:**
- Create: `create-clockify-addon/src/index.d.ts`
- Modify: `create-clockify-addon/package.json`
- Modify: `create-clockify-addon/src/index.mjs`
- Modify: `addon-sdk/tests/creator.test.ts`
- Modify: `create-clockify-addon/scripts/verify-scaffolds.mjs`
- Modify: `addon-sdk/scripts/verify-package-lint.mjs`

**Interfaces:**
- Consumes: existing `scaffoldClockifyAddon(options)` ESM implementation.
- Produces: `ScaffoldClockifyAddonOptions`, `ClockifyAddonRuntime`,
  `ClockifyAddonFeatureSet`, and the existing function declaration; Worker start scripts explicitly
  name `src/index.ts`.

- [ ] **Step 1: Write failing creator metadata and Worker start tests**

In `creator.test.ts`, load the creator package manifest once and assert:

```ts
it("ships a typed programmatic export and a real workspace test command", async () => {
  const packageJson = JSON.parse(
    await readFile(resolve(import.meta.dirname, "../../create-clockify-addon/package.json"), "utf8"),
  );
  expect(packageJson.types).toBe("./src/index.d.ts");
  expect(packageJson.exports).toEqual({
    ".": { types: "./src/index.d.ts", import: "./src/index.mjs" },
  });
  expect(packageJson.scripts.test).toBe(
    "npm test -w @apet97/clockify-addon-sdk -- tests/creator.test.ts",
  );
});
```

Change the generated Worker start expectation to `wrangler dev src/index.ts`.

- [ ] **Step 2: Verify metadata/start tests fail**

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/creator.test.ts \
  -t "typed programmatic export|real CLI"
```

Expected: FAIL because types are absent, the test command is disconnected, and Worker start omits
its entry point.

- [ ] **Step 3: Add the exact creator declaration surface**

Create `src/index.d.ts`:

```ts
export type ClockifyAddonRuntime = "node" | "worker";
export type ClockifyAddonFeatureSet = "all" | "minimal";

export interface ScaffoldClockifyAddonOptions {
  readonly directory: string;
  readonly runtime: ClockifyAddonRuntime;
  readonly features: ClockifyAddonFeatureSet;
  readonly sdkSpec?: string;
}

/** Creates a Clockify add-on project without overwriting existing files. */
export function scaffoldClockifyAddon(options: ScaffoldClockifyAddonOptions): Promise<string>;
```

Set `package.json#types`, the conditional export, and the real workspace test command exactly as the
test expects. Change the Worker start script in `src/index.mjs` to `wrangler dev src/index.ts`.

- [ ] **Step 4: Make scaffold verification consume the packed creator**

Pack both workspaces with `npm pack --ignore-scripts --json`. Install the creator tarball into a
temporary runner containing this script:

```js
import { scaffoldClockifyAddon } from "create-clockify-addon";

const [directory, runtime, features, sdkSpec] = process.argv.slice(2);
await scaffoldClockifyAddon({ directory, runtime, features, sdkSpec });
```

Execute that installed script for all four variants instead of importing workspace source. After
each Worker install/typecheck, run:

```bash
npm exec -- wrangler deploy src/index.ts --dry-run
```

- [ ] **Step 5: Lint both packed artifacts**

Refactor `verify-package-lint.mjs` to pack and run `publint --strict` plus Are The Types Wrong
Node16 against both `addon-sdk/` and `create-clockify-addon/`. Keep the existing temporary cleanup
and fail immediately if either artifact fails.

- [ ] **Step 6: Verify creator tests, direct workspace test, package lint, and scaffold gate**

```bash
npm test -w @apet97/clockify-addon-sdk -- tests/creator.test.ts
npm test -w create-clockify-addon
npm run build
npm run verify:package-lint
npm run verify:scaffolds
```

Expected: creator tests execute (not zero), both tarballs lint/type-resolve, and all four variants
are generated through the installed creator; Worker variants complete Wrangler dry-runs.

- [ ] **Step 7: Commit creator artifact hardening**

```bash
git add create-clockify-addon/src/index.d.ts create-clockify-addon/package.json \
  create-clockify-addon/src/index.mjs create-clockify-addon/scripts/verify-scaffolds.mjs \
  addon-sdk/tests/creator.test.ts addon-sdk/scripts/verify-package-lint.mjs
git commit -m "Verify the packed creator runtime"
```

---

### Task 7: Correct current documentation claims

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `CHANGELOG.md`
- Modify: `create-clockify-addon/README.md`
- Modify: `docs/product-surface.md`
- Modify: `docs/quality-gates.md`
- Modify: `docs/marketplace-coverage.md`
- Modify: `docs/release-readiness.md`

**Interfaces:**
- Consumes: behavior and gates completed in Tasks 4-6.
- Produces: synchronized, source-only documentation that treats the prior live receipt as historical.

- [ ] **Step 1: Update the synchronized hardening checkpoint**

In both agent files, call `addon-sdk/` the publishable package workspace rather than a published
package. State that optional manifest arrays are initialized by registration, Node/Express fallback
targets preserve leading slashes, the packed creator is typed and used by scaffold verification,
and Worker entry points complete a Wrangler dry-run. Mark the authenticated `bbaff21` receipt as
historical evidence that predates the current request/scaffold changes.

- [ ] **Step 2: Update user-facing gate and creator truth**

Document `wrangler dev src/index.ts`, the ESM programmatic creator export, two-package package lint,
packed-creator generation, and Worker dry-runs. In release readiness and Marketplace coverage,
state that the 2026-07-12 live pass applies to `bbaff21` and must be repeated before a new release
claim.

- [ ] **Step 3: Record the fixes in the changelog and product surface**

Add concise bullets for optional-array registration, shared request-target parsing, runnable Worker
start, creator declarations, and packed creator proof. Do not add security findings.

- [ ] **Step 4: Verify documentation synchronization and claims**

```bash
diff -u <(tail -n +4 AGENTS.md) <(tail -n +4 CLAUDE.md)
npm test -w @apet97/clockify-addon-sdk -- tests/source-only-docs.test.ts \
  tests/tooling-config.test.ts tests/perfect-foundations.test.ts tests/creator.test.ts
git diff --check
```

- [ ] **Step 5: Commit documentation corrections**

```bash
git add AGENTS.md CLAUDE.md CHANGELOG.md create-clockify-addon/README.md \
  docs/product-surface.md docs/quality-gates.md docs/marketplace-coverage.md \
  docs/release-readiness.md
git commit -m "Correct creator readiness documentation"
```

---

### Task 8: Finish the non-security adversarial review

**Files:**
- Create outside repository: `/Users/15x/Downloads/addon-ts-sdk-nonsecurity-review-2026-07-12.md`

**Interfaces:**
- Consumes: the current branch SHA, packed SDK/creator artifacts, runtime probes, and gate output.
- Produces: a read-only evidence report with two remediated findings and no security assessment.

- [ ] **Step 1: Review every required surface against current code**

Inspect registration/routing, Node/Fetch/Express parity, lifecycle/storage, creator CLI and all four
scaffolds, ESM/CJS public API, packed artifacts, schemas/code generation, tests/gates,
maintainability, and documentation. Use `rg`, package contents, real subprocesses, and raw HTTP
probes. Put any new probe under `/tmp` and remove it afterward.

- [ ] **Step 2: Try to disprove each suspected issue**

Accept a finding only with severity, exact file/line, violated contract, current evidence, minimal
reproduction, impact, smallest fix, confidence, and remaining uncertainty. Record cleared
hypotheses separately. Do not report style preferences, generic advice, security observations, or
network evidence that could not be obtained.

- [ ] **Step 3: Write the report with the required sections**

Use these headings:

```md
# addon-ts-sdk Non-Security Adversarial Review — 2026-07-12

## Executive Verdict
## Baseline and Evidence
## Confirmed Findings Remediated During Review
## Remaining Confirmed Findings
## Rejected Hypotheses
## Coverage Gaps and Blind Spots
## Prioritized Remediation Order
## Final Repository State
```

State the exact baseline SHA `bbaff21e494d5d92cd2da1e11d21938f61417d18` and final reviewed
SHA. Record the two baseline adapter findings and four approved follow-up findings as remediated,
including their red-green tests and fix commits. If nothing else survives investigation, state
`No remaining confirmed non-security findings.` Do not copy claims from the stale review at
`/Users/15x/Downloads/addon-ts-sdk-hostile-review-2026-07-12.md`.

---

### Task 9: Run final proof and record project evidence

**Files:**
- Modify outside repository: `/Users/15x/Documents/Obsidian Vault/03 Projects/Clockify Add-on TypeScript SDK.md`

**Interfaces:**
- Consumes: completed branch and review report.
- Produces: fresh command evidence, a clean committed worktree, and a sanitized project receipt.

- [ ] **Step 1: Run the canonical and network-dependent gates**

```bash
npm run ci:verify
npm run verify:schema-live
npm run release:dry-run
npx madge@8 --extensions ts --circular addon-sdk/src
npm audit --omit=dev --json
npm audit --json
```

Expected: every command exits 0; both audits report zero vulnerabilities; madge reports no circular
dependency.

- [ ] **Step 2: Run the browser-target package probe**

```bash
rm -rf /tmp/addon-ts-sdk-browser-review
mkdir -p /tmp/addon-ts-sdk-browser-review
npx --no-install esbuild addon-sdk/dist/esm/index.js --bundle --platform=browser --format=esm \
  --external:jose --outfile=/tmp/addon-ts-sdk-browser-review/bundle.js
if rg -n 'node:' /tmp/addon-ts-sdk-browser-review/bundle.js; then exit 1; fi
rm -rf /tmp/addon-ts-sdk-browser-review
```

Expected: esbuild exits 0 and the bundle contains no `node:` import.

- [ ] **Step 3: Run final repository checks**

```bash
git diff --check
diff -u <(tail -n +4 AGENTS.md) <(tail -n +4 CLAUDE.md)
git status --short --branch
git log --oneline --decorate -5
git rev-list --left-right --count origin/main...main
```

Expected: no whitespace errors, synchronized guidance bodies, a clean feature worktree, and the
original main checkout still at origin parity `0 0`.

- [ ] **Step 4: Update the existing Obsidian project note**

Append a sanitized dated entry containing the baseline and final SHAs, the six corrected findings,
exact gate results, the review-report path, and the fact that no push/publication/tag or Marketplace
action occurred. Preserve the note's existing frontmatter and never include headers, queries,
bodies, JWTs, tokens, or credentials.

- [ ] **Step 5: Commit any final in-repository corrections discovered by verification**

If verification required an in-scope fix, repeat its red-green cycle and commit it with an
imperative subject. Otherwise leave the verified branch clean. Do not push.
