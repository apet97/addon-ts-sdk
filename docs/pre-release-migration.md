# Pre-release API Migration

The package has not been published to npm, so this branch performs the one permitted API cleanup
before the first release: Node-only adapters are no longer re-exported from the root.

```ts
// Before: root or aggregate adapter import
// After:
import { createNodeHttpAddonServer } from "@apet97/clockify-addon-sdk/adapters/node";
import { createExpressAddonHandler } from "@apet97/clockify-addon-sdk/adapters/express";
import { handleFetchRequest } from "@apet97/clockify-addon-sdk/adapters/fetch";
```

The existing manifest, router, builder, verification, lifecycle and settings symbols retain their
names. New applications should use granular adapter imports even though `/adapters` remains as a
temporary source-compatibility entrypoint.
