# Dependency Strategy

This package ships both ESM and CommonJS entry points. The `verify:dist` gate imports both built
formats and boots the README quick start, so dependency upgrades must preserve those package-format
guarantees.

## `jose`

SDK 1.x stays on `jose@5` because it supports the current RS256 verification implementation while
preserving the CommonJS build. A future `jose@6` upgrade should be handled as a compatibility spike:

1. install `jose@6` on a branch,
2. run `npm run type-check`,
3. run `npm run build && npm run verify:dist`,
4. verify both `import` and `require` consumers still work, and
5. if CommonJS support has to change, ship that as a major release.

Do not bump `jose` across a major version as routine maintenance.

## Express

The Express adapter is intentionally thin. Express stays an optional peer dependency and the SDK test
fixture runs against Express 5 so the peer range can include both `^4.17.0` and `^5.0.0`.
