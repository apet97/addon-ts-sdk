# Token Signature Verification

All tokens signed by Clockify are JWT tokens signed with the **RSA256** algorithm. The signature parser validates the token cryptographically and checks for required claims.

## Example

```typescript
import { ClockifySignatureParser } from "@apet97/clockify-addon-sdk";

// Clockify public key in PEM format
const publicKeyPem = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAubktufFNO/op+E5WBWL6
...
-----END PUBLIC KEY-----`;

const parser = new ClockifySignatureParser("my-addon-key", publicKeyPem);

// In your route handler:
try {
  const claims = await parser.parseClaims(token);
  console.log("Workspace ID:", claims.workspaceId);
  console.log("Installer/User ID:", claims.user);
  console.log("Workspace Role:", claims.workspaceRole);
} catch (error) {
  console.error("Invalid signature or token:", error);
}
```

## Validation Constraints

The signature parser checks that:
1. Issuer is exactly `clockify`.
2. Subject matches the manifest `key` / `addonKey`.
3. Type claim is exactly `addon`.
4. Token has not expired.
