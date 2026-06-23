# Dependency Strategy

This package ships both ESM and CommonJS entry points. The `verify:dist` gate imports both built
formats and boots the README quick start, so dependency upgrades must preserve those package-format
guarantees.

## `jose`

SDK 1.x stays on `jose@5` because it supports the current RS256 verification implementation while
preserving the CommonJS build. Registry metadata checked during release hardening showed that
`jose@6` is ESM-only (`"type": "module"` with no `require` export condition), while `jose@5`
still exposes CommonJS entry points. A future `jose@6` upgrade must be handled as a compatibility
spike:

1. install `jose@6` on a branch,
2. run `npm run type-check`,
3. run `npm run build && npm run verify:public-api && npm run verify:dist`,
4. run `npm run verify:package-consumer`,
5. specifically prove that CommonJS consumers can still verify and sign test tokens, and
6. if CommonJS support has to change, ship that as a major release instead of a routine dependency
   bump.

Do not bump `jose` across a major version as routine maintenance.

Initial spike result on 2026-06-23: a temporary project with `jose@6.2.3` loaded `require("jose")`
successfully on Node 22.20.0 and the current local Node. That proves a simple CommonJS load is not
enough reason to block the upgrade, but it is not a package-level migration by itself; the full SDK
upgrade still needs the gates above, including installed ESM/CJS token signing and verification from
`npm run verify:package-consumer`.

## Express

The Express adapter is intentionally thin. Express stays an optional peer dependency and the SDK test
fixture runs against Express 5 so the peer range can include both `^4.17.0` and `^5.0.0`.
