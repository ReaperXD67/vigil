# Security

Vigil is an open-source reliability workspace. The current supported code is the `main` branch. A successful scan is evidence for that revision and scan database, not a guarantee that no vulnerabilities exist.

## Report a vulnerability privately

Use the repository's [private vulnerability reporting page](https://github.com/reaperxd67/vigil/security/advisories/new) if it is available. Include the affected commit, a minimal reproduction, impact, and a suggested fix when possible. Do not include live passwords, session cookies, access keys, or another person's data.

If private reporting is unavailable, open a public issue that only asks the maintainer to enable private reporting. Keep exploit details private until a confidential channel is available. Ordinary non-security bugs belong in public issues.

## Deployment responsibilities

- Use HTTPS, production application settings, secure session cookies, and exact allowed origins for an internet-facing deployment.
- Keep databases and administrative ports private. The local Compose stack binds application ports to loopback and does not publish PostgreSQL.
- Replace the documented local database password before hosting. Store deployment credentials outside Git; do not commit `.env`, Terraform state, kubeconfig, or database exports.
- Preserve the external-check safeguards. User-supplied URLs must not reach loopback, private networks, link-local addresses, or cloud metadata services.
- Keep sample workspaces visibly identified and do not use them for sensitive operational information.
- Back up persistent data, test restoration, and review public status-page opt-ins before sharing links.

The CI image gate scans operating-system and application dependencies and fails on HIGH or CRITICAL findings, including vulnerabilities without a published fix. Fix the affected image or dependency rather than disabling the gate to obtain a green build. Action dependencies are pinned to verified commit SHAs and tracked by Dependabot.
