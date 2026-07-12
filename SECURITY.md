# Security Policy

Do not include Clockify tokens, webhook signatures, workspace data or private keys in an issue.
Report vulnerabilities privately through the repository owner's GitHub security contact.

Supported published code is the current npm `latest` release. `main` may contain unreleased changes.
Security reports should include the affected npm version or commit, runtime, minimal reproduction,
and impact.

The SDK pins Clockify JWT verification to RS256 with issuer/type/subject checks. Applications remain
responsible for TLS 1.2+, encrypted disks, access control, retention, incident response and an
appropriate privacy policy.
