# 1.0 API Migration

Before the public `1.0.0` release, Node-only adapters stopped being re-exported from the root so
browser and Worker consumers could import the runtime-neutral entrypoint.

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
