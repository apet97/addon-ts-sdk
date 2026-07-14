# Add-on Documentation Rework Design

## Goal

Rework the repository documentation around the way a Clockify add-on actually operates. A new
TypeScript developer should be able to scaffold an add-on, expose its manifest, install it, render
an authenticated component, receive a webhook, call Clockify, and clean up on uninstall without
first learning the repository's release history or internal verification structure.

The rework must preserve the existing technical depth for SDK consumers and maintainers while
giving every concept one canonical owner. Documentation claims must remain grounded in current
source, executable scaffolds, package contents, tests, and verification scripts.

## Audience and Success Criteria

The primary audience is a developer building their first Clockify add-on. Existing application
integrators are the secondary audience. SDK maintainers remain supported through a separate
maintainer section rather than driving the beginner path.

The rework succeeds when:

- a new developer can reach a locally running `/manifest` from the root README;
- the install, component, webhook, outbound API, and uninstall flow is explained once and in order;
- each guide distinguishes Clockify, SDK, and application responsibilities;
- Node and Worker paths are both discoverable;
- active authored documentation does not contradict current code, exports, scaffolds, or gates;
- reference and historical evidence remain available without interrupting the beginner journey.

## Information Architecture

The active builder path will be:

```text
README.md
  -> docs/getting-started.md
  -> docs/how-an-addon-works.md
  -> docs/guides/
       manifest-and-registration.md
       installation-and-storage.md
       components-and-ui.md
       webhooks-and-idempotency.md
       calling-clockify.md
       deployment-and-operations.md
       troubleshooting.md
```

`docs/README.md` will be the complete documentation map. It will separate four kinds of material:

1. builder journey and task guides;
2. SDK/package reference;
3. maintainer architecture, evidence, verification, and release procedures;
4. generated, upstream, archived, and historical material.

The root README will remain a concise public landing page. It will explain the product boundary,
show the shortest scaffold path, summarize the lifecycle, and link to the canonical guides instead
of duplicating them.

## Canonical Add-on Model

Every beginner guide will use the same ownership model:

| Owner              | Responsibility                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Clockify           | Reads the manifest, embeds components, sends lifecycle events and webhooks, and issues tokens.                                 |
| SDK                | Builds and validates the manifest, routes requests, verifies Clockify context, enforces limits, and provides runtime helpers.  |
| Add-on application | Hosts the endpoint, persists installation credentials, implements UI and business logic, calls Clockify, and performs cleanup. |

The canonical journey will describe these stages:

1. Scaffold a Node or Worker project.
2. Configure the public base URL, Clockify parent origin, and durable installation storage.
3. Build a schema 1.5 manifest and register components, lifecycle handlers, and webhooks.
4. Serve `/manifest`, keeping descriptors and executable routes aligned.
5. Verify `INSTALLED` and persist installation and webhook credentials.
6. Verify a component's `auth_token`, return iframe-safe HTML, and use the exact parent origin.
7. Verify a webhook, claim an idempotency lease, process it, then complete or release the lease.
8. Call Clockify with stored add-on credentials and service URLs from verified claims.
9. Handle `DELETED` cleanup while stating that the real payload has no generation identifier.
10. Deploy with explicit public-origin configuration and durable encrypted storage.

Each guide will contain a mental model, a smallest-correct code path drawn from shipped examples,
required configuration, success and failure behavior, application-responsibility callouts, a
focused proof step, and links to detailed API reference.

## Document Ownership and Migration

The rewrite will handle existing material by purpose:

- `README.md` becomes the public landing page and shortest successful builder path.
- `addon-sdk/README.md` owns SDK installation, imports, runtime support, and package reference
  navigation.
- `create-clockify-addon/README.md` owns CLI flags, all four generated variants, generated layout,
  configuration, and the first-run workflow.
- The generated-project README emitted by `create-clockify-addon` explains its runtime entry
  points, required environment values, storage boundary, and lifecycle flow.
- The current `docs/architecture.md` content moves to `docs/maintainers/architecture.md` and expands
  into the internal module/runtime architecture; `docs/how-an-addon-works.md` owns the reader-facing
  request and lifecycle flow.
- Product surface, quality gates, Marketplace coverage, release readiness, and pre-release
  migration move under `docs/maintainers/` and link back to user guides where appropriate.
- `addon-sdk/docs/manifest-builders.md`, `routing.md`, `token-validation.md`, and
  `dependency-strategy.md` remain detailed package reference with repaired navigation and claims.
- `addon-sdk/docs/secure-server-recipe.md` is rewritten around the current installation store,
  `ClockifyAddonClient`, iframe, webhook, and runtime configuration contracts.
- `addon-sdk/docs/java-migration.md` and the Java-to-TypeScript API map remain consumer migration
  reference. Internal parity checklists, evidence maps, and adversarial-review history move to a
  clearly labeled maintainer evidence area.
- `AGENTS.md` and `CLAUDE.md` retain concise operational commands, stable architecture, ownership,
  and non-obvious constraints. Dated release narration moves to release evidence. Their shared
  sections remain synchronized.
- `CONTRIBUTING.md`, `SECURITY.md`, and `CHANGELOG.md` keep their existing roles; only navigation,
  ownership, and factual contradictions are corrected.
- Existing numbered files and provenance data in `MARKETPLACE_DOCS/` remain byte-for-byte unchanged.
  A local `MARKETPLACE_DOCS/README.md` explains provenance, update mechanics, and the relationship
  to the SDK guides without presenting itself as upstream content.
- `addon-sdk/public-api.snapshot.md` remains generated and is never hand-edited.
- `docs/superpowers/**` remains historical implementation evidence and is not part of beginner
  navigation.
- The ignored local `GOAL.md` and `verification_report.md` working notes remain untouched and are
  not promoted into tracked documentation. The root README, product-surface reference, and agent
  guidance carry the current tracked product contract.

File moves will preserve useful content and Git history. Redirect stubs will be used only where a
published or externally referenced path has a credible compatibility need; otherwise links are
updated to the canonical destination.

## Editorial Rules

- Give each concept one canonical explanation; other documents summarize and link.
- Use schema 1.5 in the main journey. Mention older versions only in compatibility reference.
- Draw code from executable scaffolds and verified examples rather than inventing parallel samples.
- Separate SDK guarantees from application responsibilities.
- State Node, Fetch/Worker, and Express differences only where the implementations differ.
- Document exact failure semantics, including 404 versus 405 routing, body-size rejection,
  verification failure, missing durable storage, webhook retry/idempotency behavior, and
  unqualified deletion.
- Avoid fixed test counts, release dates, transient SHA claims, and other aging evidence in
  evergreen guides.
- Use direct language, short sections, predictable headings, relative links, and restrained
  callouts.
- Do not imply official Clockify affiliation, automatic Marketplace acceptance, universal runtime
  parity, or proof broader than the cited gate.

## Verification Design

A dependency-free `scripts/verify-docs.mjs` will validate documentation structure. It will check:

- relative Markdown links and local anchors;
- reachability of active beginner documents from `docs/README.md`;
- explicit classification of archived, generated, upstream, and historical material;
- canonical links from root, SDK, creator, generated-project, agent, and contributor docs;
- synchronization of shared `AGENTS.md` and `CLAUDE.md` content;
- schema 1.5 and current package names on the main path;
- absence of specifically disproven stale claims;
- preservation of the captured Marketplace files, provenance data, and generated public API
  boundaries.

The root package will expose this as `npm run verify:docs`, and `ci:verify` will run it. Existing
distribution-document tests will assert durable contracts and navigation rather than exact
marketing sentences. Creator tests will prove that generated READMEs document configuration,
storage, runtime entry points, and lifecycle responsibilities. The existing scaffold verification
continues to execute all four Node/Worker and minimal/all variants.

Implementation verification will run, in order:

1. focused documentation and creator tests;
2. `npm run verify:docs`;
3. `npm run verify:marketplace-docs`;
4. `npm run verify:scaffolds`;
5. `npm run ci:verify`;
6. `npm run release:verify` when live schema and registry network access are available;
7. `git diff --check` plus final contradiction and orphan scans.

## Scope Boundaries

This project changes authored documentation, generated-project README output, documentation tests,
and the documentation verifier. It does not change SDK runtime behavior, public API, package
versions, release configuration, upstream Marketplace snapshot content, or generated API output.

No npm publication, tag, Marketplace submission, GitHub metadata change, or push is authorized by
this design. Any later delivery action requires explicit user authorization and the repository's
normal ancestry and verification checks.
