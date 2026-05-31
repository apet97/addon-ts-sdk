.PHONY: build test type-check addon-sdk-package addon-sdk-parity

build:
	npm run build

test:
	npm run test

type-check:
	npm run type-check

addon-sdk-package:
	cd addon-sdk && npm run type-check && npm run test && npm run build && npm pack --dry-run

addon-sdk-parity:
	cd addon-sdk && npm run generate && npm run test -- --run tests/parity
