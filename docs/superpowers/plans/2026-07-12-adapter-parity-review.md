# Adapter Parity Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Node HTTP and Fetch request handling obey the same documented path and declared-body
limit contracts, then finish the current non-security adversarial review.

**Architecture:** Keep the correction inside the two runtime adapters. Node will preserve leading
slashes while parsing its raw request target; Fetch will validate `Content-Length` before deciding
whether the method exposes a readable body. Public APIs, dependencies, router semantics, and
scaffolds remain unchanged.

**Tech Stack:** TypeScript 6, Node 22 HTTP, Fetch API, Vitest 4, npm workspaces.

## Global Constraints

- Keep the root entrypoint runtime-neutral and do not add runtime dependencies.
- Keep `AGENTS.md` and `CLAUDE.md` synchronized except for their headings and introductions.
- Use test-first red-green-refactor for both runtime changes.
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

### Task 4: Finish the non-security adversarial review

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
SHA. Record the two baseline adapter findings as remediated, including their red-green tests and
fix commits. If nothing else survives investigation, state `No remaining confirmed non-security
findings.` Do not copy claims from the stale review at
`/Users/15x/Downloads/addon-ts-sdk-hostile-review-2026-07-12.md`.

---

### Task 5: Run final proof and record project evidence

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

Append a sanitized dated entry containing the baseline and final SHAs, the two corrected adapter
contracts, exact gate results, the review-report path, and the fact that no push/publication/tag or
Marketplace action occurred. Preserve the note's existing frontmatter and never include headers,
queries, bodies, JWTs, tokens, or credentials.

- [ ] **Step 5: Commit any final in-repository corrections discovered by verification**

If verification required an in-scope fix, repeat its red-green cycle and commit it with an
imperative subject. Otherwise leave the verified branch clean. Do not push.
