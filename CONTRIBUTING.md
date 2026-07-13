# Contributing

Use Node 22.13.0 or newer for source development, install with `npm ci`, and make changes on a topic
branch. Published packages retain a Node 22 runtime floor. Generated manifest models must be changed
through their schemas or generator, never by hand.

Run focused tests during development and `npm run ci:verify` before requesting review. Public API
changes require an updated declaration snapshot and documentation. Do not commit tarballs,
coverage, build output, credentials or live Clockify payloads.
