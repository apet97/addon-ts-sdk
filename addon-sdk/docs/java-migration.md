# Java to TypeScript Migration Guide

This guide maps features, classes, and code patterns directly from the Clockify Java Addon SDK to the `@apet97/clockify-addon-sdk` package.

## API Comparison

| Java Addon SDK | TypeScript Addon SDK |
|---|---|
| `ClockifyManifest.v1_4Builder()` | `ClockifyManifest.v1_4Builder()` |
| `ClockifyComponent.builder()` | `ClockifyComponent.v1_4Builder()` / `v1_2Builder()` etc. |
| `RequestHandler<HttpRequest>` | `async (request: AddonRequest) => AddonResponse` |
| `AddonServlet` | `createExpressAddonHandler` or `handleFetchRequest` |
| `EmbeddedServer` | `createNodeHttpAddonServer` |
| `ClockifySignatureParser` | `ClockifySignatureParser` |
| `Filter` / `FilterChain` | `AddonMiddleware` |

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
  ClockifyManifest.v1_4Builder()
    .key("my-addon")
    .name("My Add-on")
    .baseUrl("https://example.com")
    .requireProPlan()
    .build()
);

addon.registerComponent(
  ClockifyComponent.v1_4Builder()
    .activityTab()
    .allowAdmins()
    .path("/tab")
    .label("My Tab")
    .build(),
  async (request) => {
    return {
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<h1>My Tab Content</h1>"
    };
  }
);
```
