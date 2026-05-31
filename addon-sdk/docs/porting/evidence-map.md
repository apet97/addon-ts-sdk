# Evidence Map: Java to TypeScript

This file documents the exact mapping from the source Java SDK classes to the TypeScript SDK port.

| Java Source File | TypeScript Target File | Notes / Parity Level |
|---|---|---|
| `shared/Addon.java` | `addon-sdk/src/shared/addon.ts` | Routing core: default `/manifest`, trailing-slash trim at dispatch, 405 on unmatched, 500 on handler throw, middleware (= Java `Filter`) chain. The servlet/server pieces (`AddonServlet`, `EmbeddedServer`) are ported separately under `src/adapters/`. |
| `shared/utils/ValidationUtils.java` | `addon-sdk/src/shared/addon.ts` (`isValidManifestPath`) | Manifest path validation (absolute, no trailing slash). Implemented inline in `addon.ts`, not in `errors.ts`. |
| `shared/utils/Utils.java` | `addon-sdk/src/shared/addon.ts` (`trimTrailingSlash`) | Trims one trailing slash during dispatch. |
| `clockify/ClockifyAddon.java` | `addon-sdk/src/clockify/clockify-addon.ts` | Extends `Addon`; registers hooks (component/lifecycle/webhook/settings) then mutates the manifest (register-then-mutate order preserved). |
| `clockify/ClockifySignatureParser.java` | `addon-sdk/src/clockify/clockify-signature-parser.ts` | RSA (RS256) JWT verification with `jose`. Enforces `iss=clockify`, `sub=addonKey`, `type=addon`. Adds doc-confirmed claim constants (`locationsUrl`, `screenshotsUrl`, `language`, `theme`) beyond the Java set — a forward extension. |
| `clockify/model/ClockifyManifest.java` | `addon-sdk/src/clockify/clockify-manifest.ts` | Versioned builders (`v1_2`–`v1_5`). 1.2–1.4 from the Java reference; 1.5 from the live Clockify schema API. |
| `clockify/model/ClockifyResource.java` | `addon-sdk/src/clockify/clockify-resource.ts` | Resource interface enforcing the `path` property. |
