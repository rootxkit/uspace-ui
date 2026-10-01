# Security policy

`@rootxkit/uspace-ui` is the UI kit of the U-space consoles. It holds no
credential and runs no service, but its BFF helpers (`auth/server`) handle
the session cookie and CSRF token of every console, and its lint rules keep
judgement and server clients out of every `web/`. A flaw in either is a
flaw in five applications.

## Reporting a vulnerability

Report it privately through GitHub's private vulnerability reporting on
this repository (Security tab, "Report a vulnerability"). Do not open a
public issue, pull request or discussion for it.

Please include the affected version or commit, the entry point
(`auth/server`, `api`, `live`, ...), a description of the impact and the
steps to reproduce. Use synthetic data only: no real credentials, tokens,
registration numbers or positions.

## What happens next

- We aim to publish a fix within 90 days of the report. The advisory and
  the fixed version are published together; the reporter is credited
  unless they ask not to be.
- If a fix needs longer than 90 days, we agree a date with the reporter
  before then.

## Supported versions

Before `1.0.0`, only the latest published version receives fixes. From
`1.0.0`, the latest minor of the two most recent majors (docs/PLAN.md §12).
