# Contributing

Use Node 22+, install with `npm ci`, and make changes on a topic branch. Generated manifest models
must be changed through their schemas or generator, never by hand.

Run focused tests during development and `npm run ci:verify` before requesting review. Public API
changes require an updated declaration snapshot and documentation. Do not commit tarballs,
coverage, build output, credentials or live Clockify payloads.
