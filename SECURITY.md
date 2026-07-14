# Security Policy

## Report a vulnerability

Do not include Clockify tokens, webhook signatures, workspace data, private keys, or an exploitable
reproduction in a public issue. Report vulnerabilities privately through the repository owner's
GitHub security contact.

Include the affected npm version or commit, runtime, minimal reproduction, impact, and any known
mitigation. Supported published code is the current npm `latest` release; `main` may contain
unreleased changes.

## Application security remains application-owned

The SDK provides fail-closed request verification, encrypted installation-store contracts, bounded
request adapters, hardened response helpers, and static manifest validation. Those controls reduce
risk but do not make an add-on automatically secure. Applications still own TLS, durable encrypted
storage, access control, secret rotation, retention, dependency review, monitoring, incident
response, and an appropriate privacy policy.

Keep installation and webhook credentials server-side. Never log tokens, signatures, private keys,
or outbound query strings. Configure exact public and iframe parent origins, resolve Clockify hosts
from verified installation context, and replace local ephemeral stores before production.

## Security guidance

- [Secure server recipe](addon-sdk/docs/secure-server-recipe.md)
- [Token and environment validation](addon-sdk/docs/token-validation.md)
- [Installation and storage](docs/guides/installation-and-storage.md)
- [Components and UI](docs/guides/components-and-ui.md)
- [Webhooks and idempotency](docs/guides/webhooks-and-idempotency.md)
- [Calling Clockify](docs/guides/calling-clockify.md)
- [Deployment and operations](docs/guides/deployment-and-operations.md)

Passing repository gates, audits, or static validation is evidence for those checks only; it is not
a guarantee that an application, deployment, dependency set, or Marketplace installation is secure.
