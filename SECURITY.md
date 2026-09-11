# Security

## Reporting vulnerabilities

Do not disclose security-sensitive findings in public issues. Use a private security channel available to the repository owner.

## Current execution boundary

The House Of Coding can execute code on the host running the API. Treat submitted code as trusted while sandboxing is not yet implemented.

Before exposing execution to untrusted users, implement:

- container or VM isolation
- CPU, memory, process, and time limits
- filesystem and network restrictions
- runtime allowlists
- non-privileged execution accounts
- audit logging
- request authentication and authorization
