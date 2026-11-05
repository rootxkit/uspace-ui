# Backlog

Ranked table of open items.

| # | Severity (high/medium/low) | Item | Where (file:line if given) | Source (the review that found it) |
|---|---|---|---|---|
| 1 | medium | Account menus show user ids, not names: staff cannot see who is signed in. An end-to-end run on 2026-10-25 showed account ids in the account menus of two consoles. `UserMenu` renders the `name` it is given; the session claims read here (`sessionClaimsUnverified`, M20: `sub`, `exp`, `roles`, `realm`) carry no display name, so some consumers pass the session's `sub` (or a shortened form of it), while others pass a username from their own account endpoint. Open: whether the name comes from a session claim (a contract change in the consumers) or from each app's own account endpoint. | src/ui/extra/UserMenu.tsx; src/auth/server/claims.ts | end-to-end run 2026-10-25 (UI finding 1) |
