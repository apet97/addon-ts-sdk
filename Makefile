.PHONY: build test type-check verify-fast ci-verify release-verify schema-live package-lint package-consumer addon-sdk-package addon-sdk-parity

build:
	npm run build

test:
	npm run test

type-check:
	npm run type-check

verify-fast:
	npm run verify:fast

ci-verify:
	npm run ci:verify

release-verify:
	npm run release:verify

schema-live:
	npm run verify:schema-live

package-lint:
	npm run verify:package-lint

package-consumer:
	npm run verify:package-consumer

addon-sdk-package: ci-verify

addon-sdk-parity: verify-fast
