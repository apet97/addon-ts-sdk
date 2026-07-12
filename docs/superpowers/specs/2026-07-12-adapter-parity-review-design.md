# Adapter Parity Review Remediation Design

## Goal

Remove two confirmed non-security differences between the Node HTTP and Fetch adapters, then finish
the current adversarial review against executable evidence.

## Scope

The first remediation checkpoint covered the two failures reproduced on `bbaff21`:

- A Node request target beginning with `//` must retain that pathname instead of being interpreted
  as a protocol-relative URL. A target such as `//other.example/component` must therefore remain
  distinct from the registered `/component` route, matching Fetch behavior.
- Fetch must validate a declared `Content-Length` before routing regardless of HTTP method or
  whether the Fetch `Request` exposes a readable body. Oversized values return 413 and malformed
  values return 400 without invoking the add-on handler or `onError`, matching Node behavior.

The completed sweep subsequently confirmed four more non-security failures, which the project owner
approved for the same remediation branch:

- A schema-valid manifest may omit optional `components`, `lifecycle`, and `webhooks` arrays, but
  `register*` currently dereferences those missing arrays.
- A structurally typed Express-like request may omit `path`, but its `url` fallback repeats the
  protocol-relative leading-`//` mistake.
- Generated Worker projects advertise `wrangler dev` without an entry point, so `npm start` fails.
- The packed creator exposes a programmatic module without declarations, while its workspace test
  script exits successfully after running zero tests.

Security assessment, unrelated product behavior, new dependencies, and broad refactors remain out
of scope.

## Architecture

The Node adapter will parse origin-form request targets against a fixed local origin without letting
a leading `//` replace that origin. Ordinary origin-form paths, query parameters, absolute-form
proxy targets, empty targets, and existing response behavior remain unchanged.

The Fetch adapter will split declared-length validation from streamed-body reading. It will perform
the declaration check once, before the method/body-presence branch, while the existing reader will
remain responsible for enforcing the streamed byte count.

Node and the Express fallback will share one internal raw-target parser. Registration will treat a
missing optional descriptor array as an empty list and attach it only after route registration
succeeds. Its structural comparator will visit every array index instead of relying on
`Array.prototype.every`, which skips sparse slots.

The Worker package script will name `src/index.ts` explicitly. The creator will retain its ESM
programmatic export and add a declaration file for that existing API. Packed-artifact verification
will lint both packages, import the packed creator to generate all four variants, and perform a
Wrangler dry-run for generated Worker entry points. No dependency or SDK public-API change is
required.

## Request Flow

For Node requests, the raw target is converted to a URL that preserves every leading slash. The
adapter passes that pathname and its `URLSearchParams` to the router. Consequently, `/component`
still matches, while `//other.example/component` reaches the router as a different path and returns
404.

For Fetch requests, `Content-Length` is parsed immediately after the body-limit configuration is
resolved. A malformed declaration becomes 400, an over-limit declaration becomes 413, and neither
case reaches the add-on router or error reporter. If the declaration passes and the method can carry
a Fetch body, the existing bounded stream reader parses JSON or text as before.

For registration, a valid manifest with an absent optional collection receives that collection only
after the corresponding handler is registered. Conflicting descriptors still fail before either
the router or manifest changes. Nested sparse arrays in descriptors are compared index-by-index, so
a hole cannot conceal a conflicting value.

For creator projects, `npm start` for Worker variants invokes `wrangler dev src/index.ts`. The packed
creator module remains importable as ESM and its declaration exposes the exact runtime/features
unions and scaffold options accepted by the implementation.

## Tests

Focused regression tests will prove the old behavior first and the fixed behavior second:

- A raw Node HTTP request for `//other.example/component` returns 404 and does not call the
  `/component` handler.
- Fetch GET with an over-limit declaration returns 413 without dispatch or `onError`.
- Fetch HEAD with an over-limit declaration returns 413 without dispatch or `onError`.
- Fetch GET with a malformed declaration returns 400 without dispatch or `onError`.
- Existing POST declared-length and streamed-length tests continue to pass.
- Schema-valid raw manifests with no descriptor arrays can register one component, lifecycle event,
  and webhook without duplication or partial mutation.
- A sparse nested descriptor array conflicts with a populated value at the same index.
- An Express-like request with no `path` preserves a leading-`//` URL and returns 404.
- The real generated Worker start command includes its entry point, and Wrangler can dry-run that
  entry point after installation.
- The packed creator passes package lint/type-resolution checks and generates all four variants
  through its installed programmatic export.
- The creator workspace test command executes the real creator suite rather than zero tests.

After focused tests, the full non-security review will re-check routing, adapter parity, creator
variants, package consumers, schemas/code generation, test claims, maintainability, and
documentation truth. Final proof includes `npm run ci:verify`, live schema verification, release dry
run, circular-dependency analysis, both audits, browser-target bundling, and `git diff --check`.

## Documentation and Delivery

`AGENTS.md` and `CLAUDE.md` will remain synchronized. Their body-limit claim will explicitly cover
all methods, and the Node/Express fallback raw-target behavior will be stated without overstating
broader URL normalization. Source-only wording will not call either package published. The previous
authenticated workspace receipt will be labeled historical because these request/scaffold changes
postdate it.

The completed review will be written outside the repository in Downloads and will contain the
reviewed SHA, exact command outcomes, confirmed findings, rejected hypotheses, remaining evidence
gaps, remediation order, and final repository state. No npm publication, tag, Marketplace action,
or remote push is part of this work.
