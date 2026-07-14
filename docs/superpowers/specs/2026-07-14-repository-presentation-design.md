# Repository Presentation Design

## Goal

Make the public repository immediately understandable and credible without turning the README into
marketing copy or duplicating the package reference documentation. A visitor should understand what
the project is, how to start a new add-on, what the two packages provide, and where the behavioral
claims are proven within one short scan.

## Audience and Tone

The primary audience is a TypeScript developer evaluating how to build a Clockify add-on. The
presentation will use a polished, restrained open-source style:

- concise and technical rather than promotional;
- confident only where current code, packages, and gates provide evidence;
- visually scannable through whitespace, compact tables, and a small badge row;
- explicit that the project is independent and unofficial;
- free of decorative emoji, screenshots, custom artwork, and hard-coded test or coverage counts.

## Root README Structure

The root README will become the repository landing page in this order:

1. A centered hero titled **Clockify Add-on SDK for TypeScript**, followed by one sentence that
   explains the server-side SDK and Node/Worker scaffolding.
2. A restrained badge row linking to SDK npm version, creator npm version, SDK CI, the Node support
   policy, and the MIT license. Badges will use live sources where practical so version and CI state
   do not become stale prose.
3. A short positioning paragraph that distinguishes this inbound add-on SDK from a general Clockify
   REST client.
4. **Start in 30 seconds**, leading with the canonical `npm create` command and then showing direct
   SDK installation for an existing project.
5. **What you get**, as a compact table covering typed manifests, lifecycle and webhook handling,
   UI/security helpers, runtime adapters, installation storage contracts, and executable scaffolds.
6. **How it fits**, as a small text flow from Clockify to verified add-on handlers and then to the
   add-on's application logic. It will not imply that this repository is a general outbound entity
   API client.
7. **Packages and runtimes**, showing ownership of the SDK and creator packages, Node 22 support,
   and the Node/Fetch/Express and Node/Worker boundaries without claiming unverified runtime parity.
8. **Trust the artifact**, linking the deterministic CI gate, packed consumer/scaffold checks,
   release evidence, and Marketplace coverage rather than embedding transient numeric results.
9. A concise documentation index, contributor commands, license, and the unofficial-project
   disclaimer.

Detailed release procedures will remain in `docs/release-readiness.md`; detailed API and usage
material will remain in `addon-sdk/README.md` and `addon-sdk/docs/`. The root README will link to
those sources instead of copying them.

## Repository Metadata

The public GitHub repository will receive:

- description: **TypeScript SDK and scaffolding for Clockify add-ons: manifests, lifecycle,
  webhooks, UI components, and Node/Worker adapters.**;
- homepage: `https://www.npmjs.com/package/@apet97/clockify-addon-sdk`;
- focused topics: `clockify`, `clockify-addon`, `typescript`, `sdk`, `webhooks`, `nodejs`, and
  `cloudflare-workers`.

No social-preview artwork, GitHub Pages site, release, tag, or Marketplace submission is part of
this change.

## Accuracy Boundaries

Every command, link, package name, runtime claim, and feature label will be checked against current
package manifests, CLI help, exports, docs, and verification scripts. The README will not claim
official Clockify affiliation, Marketplace approval, universal runtime compatibility, automatic
security, or a release state beyond the currently published artifacts.

`AGENTS.md` and `CLAUDE.md` do not need presentation-only edits because their current package and
publication guidance remains accurate and synchronized. Package READMEs will change only if the
root refresh exposes a broken link or direct wording contradiction.

## Verification

Implementation will verify:

```bash
npm create clockify-addon@latest -- --help
npm run verify:marketplace-docs
npm run format:check
npm run test
git diff --check
```

The final diff will be reviewed for broken Markdown links, stale fixed counts, misleading badges,
duplicated package documentation, and claims unsupported by current code or package metadata.

## Delivery Boundary

The README and any necessary consistency corrections will be committed locally. Updating the
approved GitHub description, homepage, and topics is in scope. Pushing commits to `main` remains a
separate action unless the user explicitly authorizes it.
