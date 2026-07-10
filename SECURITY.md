# Security Policy

Do not include Clockify tokens, webhook signatures, workspace data or private keys in an issue.
Report vulnerabilities privately through the repository owner's GitHub security contact.

Supported code is the latest commit on `main`; this source-only project has no published npm version
yet. Security reports should include the affected commit, runtime, minimal reproduction and impact.

The SDK pins Clockify JWT verification to RS256 with issuer/type/subject checks. Applications remain
responsible for TLS 1.2+, encrypted disks, access control, retention, incident response and an
appropriate privacy policy.
