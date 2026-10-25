# Backlog

Ranked table of open items.

| # | Severity (high/medium/low) | Item | Where (file:line if given) | Source (the review that found it) |
|---|---|---|---|---|
| 1 | medium | Account menus show user ids, not names: staff cannot see who is signed in. Staging 2026-10-25 (round 12): the USSP console showed 9460c25f… and fe8b847c…, the authority 315c707c…. `UserMenu` renders the `name` it is given; the session claims read here (`sessionClaimsUnverified`, M20: `sub`, `exp`, `roles`, `realm`) carry no display name, so consumers pass the id. Consumers: uspace-ussp `web/src/components/frame.tsx:88` (`name={session.sub}`); uspace-authority `web/src/shell/AppShell.tsx:70` (`name={shortId(session.sub)}`; its comment: the api's SessionInfo has no username). uspace-ansp passes `me.username` (falling back to `session.sub`) and uspace-cisp `me.account.username`. Open: whether the name comes from a session claim (a contract change in the consumers) or from each app's own account endpoint, as the ANSP and the CISP do. | src/ui/extra/UserMenu.tsx; src/auth/server/claims.ts | end-to-end staging run 2026-10-25 (UI finding 1) |
