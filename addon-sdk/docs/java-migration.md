# Java to TypeScript Migration Guide

This guide maps features, classes, and code patterns directly from the Clockify Java Addon SDK to
the published `@apet97/clockify-addon-sdk` package. New TypeScript add-ons should use schema 1.5;
the TypeScript builders retain 1.2-1.4 for compatibility with older manifests and Java parity.

## API Comparison

| Java Addon SDK                   | TypeScript Addon SDK                                                     |
| -------------------------------- | ------------------------------------------------------------------------ |
| `ClockifyManifest.v1_4Builder()` | `ClockifyManifest.v1_5Builder()` for the current main path               |
| `ClockifyComponent.builder()`    | `ClockifyComponent.v1_5Builder()` with versioned compatibility factories |
| `RequestHandler<HttpRequest>`    | `async (request: AddonRequest) => AddonResponse`                         |
| `AddonServlet`                   | `createExpressAddonHandler` or `handleFetchRequest`                      |
| `EmbeddedServer`                 | `createNodeHttpAddonServer`                                              |
| `ClockifySignatureParser`        | `ClockifySignatureParser` / `createClockifySignatureParser()`            |
| `Filter` / `FilterChain`         | `AddonMiddleware`                                                        |

## Java vs TypeScript Hook Registration

### Java

```java
ClockifyAddon addon = new ClockifyAddon(
    ClockifyManifest.v1_4Builder()
        .key("my-addon")
        .name("My Add-on")
        .baseUrl("https://example.com")
        .requireProPlan()
        .build()
);

addon.registerComponent(
    ClockifyComponent.builder()
        .activityTab()
        .allowAdmins()
        .path("/tab")
        .label("My Tab")
        .build(),
    new RequestHandler() {
        @Override
        public void handle(HttpServletRequest req, HttpServletResponse res) {
            // ...
        }
    }
);
```

### TypeScript

```typescript
import { ClockifyAddon, ClockifyManifest, ClockifyComponent } from "@apet97/clockify-addon-sdk";

const addon = new ClockifyAddon(
  ClockifyManifest.v1_5Builder()
    .key("my-addon")
    .name("My Add-on")
    .baseUrl("https://example.com")
    .requireProPlan()
    .build(),
);

addon.registerComponent(
  ClockifyComponent.v1_5Builder().activityTab().allowAdmins().path("/tab").label("My Tab").build(),
  async (request) => {
    return {
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<h1>My Tab Content</h1>",
    };
  },
);
```

Import framework-neutral runtime and Clockify symbols from the package root. Import host adapters
from `/adapters/node`, `/adapters/express`, or `/adapters/fetch`; the root entrypoint remains
runtime-neutral. For current package landmarks, see the [API reference](./api-reference.md) and the
[Java-to-TypeScript surface map](./porting/java-to-ts-api-map.md). Maintainer parity evidence lives
in the repository's [evidence map](../../docs/maintainers/java-parity/evidence-map.md).
