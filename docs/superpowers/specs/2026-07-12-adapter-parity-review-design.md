# Adapter Parity Review Remediation Design

## Goal

Remove two confirmed non-security differences between the Node HTTP and Fetch adapters, then finish
the current adversarial review against executable evidence.

## Scope

The change covers only the two failures reproduced on `bbaff21`:

- A Node request target beginning with `//` must retain that pathname instead of being interpreted
  as a protocol-relative URL. A target such as `//other.example/component` must therefore remain
  distinct from the registered `/component` route, matching Fetch behavior.
- Fetch must validate a declared `Content-Length` before routing regardless of HTTP method or
  whether the Fetch `Request` exposes a readable body. Oversized values return 413 and malformed
  values return 400 without invoking the add-on handler or `onError`, matching Node behavior.

Security assessment and unrelated adapter, router, creator, storage, packaging, or API changes are
out of scope.

## Architecture

The Node adapter will parse origin-form request targets against a fixed local origin without letting
a leading `//` replace that origin. Ordinary origin-form paths, query parameters, absolute-form
proxy targets, empty targets, and existing response behavior remain unchanged.

The Fetch adapter will split declared-length validation from streamed-body reading. It will perform
the declaration check once, before the method/body-presence branch, while the existing reader will
remain responsible for enforcing the streamed byte count.

No public API, export, dependency, manifest, scaffold, or package-layout changes are required.

## Request Flow

For Node requests, the raw target is converted to a URL that preserves every leading slash. The
adapter passes that pathname and its `URLSearchParams` to the router. Consequently, `/component`
still matches, while `//other.example/component` reaches the router as a different path and returns
404.

For Fetch requests, `Content-Length` is parsed immediately after the body-limit configuration is
resolved. A malformed declaration becomes 400, an over-limit declaration becomes 413, and neither
case reaches the add-on router or error reporter. If the declaration passes and the method can carry
a Fetch body, the existing bounded stream reader parses JSON or text as before.

## Tests

Focused regression tests will prove the old behavior first and the fixed behavior second:

- A raw Node HTTP request for `//other.example/component` returns 404 and does not call the
  `/component` handler.
- Fetch GET with an over-limit declaration returns 413 without dispatch or `onError`.
- Fetch HEAD with an over-limit declaration returns 413 without dispatch or `onError`.
- Fetch GET with a malformed declaration returns 400 without dispatch or `onError`.
- Existing POST declared-length and streamed-length tests continue to pass.

After focused tests, the full non-security review will re-check routing, adapter parity, creator
variants, package consumers, schemas/code generation, test claims, maintainability, and
documentation truth. Final proof includes `npm run ci:verify`, live schema verification, release dry
run, circular-dependency analysis, both audits, browser-target bundling, and `git diff --check`.

## Documentation and Delivery

`AGENTS.md` and `CLAUDE.md` will remain synchronized. Their body-limit claim will explicitly cover
all methods and the Node raw-target behavior will be stated without overstating broader URL
normalization.

The completed review will be written outside the repository in Downloads and will contain the
reviewed SHA, exact command outcomes, confirmed findings, rejected hypotheses, remaining evidence
gaps, remediation order, and final repository state. No npm publication, tag, Marketplace action,
or remote push is part of this work.
