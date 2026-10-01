# WP-2: `i18n` and `fonts` (ka / en catalogues, formatters, Georgian font)

Branch `feat/WP-2-i18n-fonts`. Milestone U-M1. Owns `src/i18n/`,
`src/fonts/`, `fonts/` exclusively. Depends on WP-0. Consumers: every
entry point with a user-facing string; every `web/`.

## Read first

1. `docs/PLAN.md` §1.2 D7, §3.4, §3.5, §5 (the wording lessons listed
   for `i18n`), §8 (font size budget), §14 Q8.
2. Spec `00 §6.3` (`ka`/`en` with Noto Sans Georgian and message
   catalogues), `02 §1` (RFC 3339 UTC with `Z`; altitudes with explicit
   reference), `04 §2` (`captured_at` versus `rx_ts`: an age is one or the
   other, never a mix), `06 §5` (no PII in strings), `08` Q15.
3. LESSONS R-05 (broadcast and unverified), R-09 (a pressure altitude is
   marked), R-12 (height over take-off is not AGL), C-12 (no loss claim),
   B-03, B-04, B-11 (the source words), G-10, E-13 (unit in every label),
   D-01 (AMSL and AGL never share a string without both datums named).
4. Predecessor `utm/web-pilot/src/i18n.ts` (the `en` and `ka` catalogues
   that operators already read; reuse the Georgian wording where it was
   reviewed) and `format.ts` (null is a dash).
5. Unicode Georgian blocks (Mkhedruli, Mtavruli, Nuskhuri, Asomtavruli)
   and the Noto Sans Georgian release notes for Mtavruli coverage; the
   OFL licence text (ship it as `fonts/LICENSE-OFL.txt`).

## What to build

**Catalogues.** `src/i18n/en.ts` and `src/i18n/ka.ts` as
`Record<Key, string>` with `Key` derived from `en` (`keyof typeof en`),
grouped under comments by owning WP; this WP writes the common keys
(connection states, ages, datums, units, dashes, yes/no, actions) and the
wording rules of PLAN §3.4. `I18nProvider`, `useT` with `{name}`
interpolation and `_one`/`_other` plural suffixes, `useLang`,
`negotiateLang` (`uspace_lang` cookie, then `Accept-Language` with
`ka`/`en` matching, then `ka`). A missing `ka` key falls back to `en`
and increments a counter the app can read (`missingKeys()`), never shows
a key.

**Formatters.** `fmtNum`, `fmtAltitude` (requires a reference or
source; `AltSource` `pressure` renders "pressure altitude" with the
value, never "AMSL"; `none` renders a dash), `fmtHeight` for
`heightRef` `TakeoffLocation` ("above take-off") and `GroundLevel`
("above ground"), `fmtAge`, `fmtTimeUTC` (always suffixed "UTC" in both
languages), `fmtTimeLocal` (takes an explicit IANA zone; the kit has no
default zone), `fmtSpeed`, `fmtHeading` (`045°`; null dash),
`fmtRegistrationNumber` (passes through; refuses a value containing a
hyphen followed by three alphanumerics by rendering only the part before
the hyphen and counting it: a secret part must never reach a screen,
`06 §5`), `fmtDistance`. Locale number formatting via `Intl` with `ka-GE`
and `en-GB`.

**Fonts.** `fonts/NotoSans-{Regular,Bold}.woff2` subset to Latin, Latin
Extended, Greek, Cyrillic; `fonts/NotoSansGeorgian-{Regular,Bold}.woff2`
with every Georgian block; produced by a documented command
(`scripts/subset-fonts.sh`, `pyftsubset` or `glyphhanger`, run by hand,
output committed with the source version and SHA256 in
`fonts/SOURCES.md`). `src/fonts/index.ts`: `next/font/local` loaders
with `unicode-range` so Georgian falls to the Georgian face,
`fontClassName`, `mapFontstack` (the glyph set name agreed with the lab,
PLAN §14 Q4; a constant exported here so every label layer uses one
name).

## Tests

- `catalogue.test.ts`: `ka` and `en` have the same key set (both
  directions); no `en` value equals its key; no value contains a raw
  `{` without a matching `}`; every key used by `t()` in `src/**` exists
  (a grep-based test over the source for `t("…")` literals; dynamic keys
  are listed in an allow-list with a reason).
- Wording pins (presence and absence, E-01): `t("track.broadcast_caveat")`
  contains "unverified" in `en` and its Georgian equivalent in `ka`; no
  catalogue value for a connection or source state contains "lost" /
  "დაკარგ" except the keys that describe a recorded gap (list them);
  the `disabled by` and `silent since` keys differ in both languages.
- Formatters: `fmtAltitude(550, "AMSL")` says AMSL; `(120, "AGL")` says
  AGL; `(600, "pressure")` says pressure altitude and not AMSL;
  `(null, ...)` is a dash; `fmtTimeUTC` output ends with "UTC" in both
  languages; `fmtRegistrationNumber("GEO12345678abcd-XYZ")` returns the
  public part and counts one refusal, `("GEO-OP-ABC")` passes through
  (G-04: the secret part is three alphanumerics after a number, and a
  hyphenated public form is not one — mirror the rule's *display* side
  only; the kit never validates a number).
- `negotiateLang`: cookie wins; `Accept-Language: en-US,en;q=0.9` gives
  `en`; `ka-GE` gives `ka`; nothing gives `ka`.
- `fonts.test.ts` (node, `fontkit`): for each Georgian block, every
  assigned code point in the block (from a table in the test, cited to
  the Unicode version) has a glyph in `NotoSansGeorgian-Regular.woff2`;
  Latin basic in `NotoSans-Regular.woff2`; total woff2 bytes ≤ the
  budget in `package.json`. Presence twin: a test that asks for a Hangul
  code point and sees the check fail.
- Stories: a `Typography` story rendering the same paragraph in `ka`
  (including Mtavruli upper case via `text-transform: uppercase`) and
  `en`; golden DOM snapshot; `axe`.

## Done when

- [ ] PLAN §3.4 and §3.5 implemented; API report updated.
- [ ] Catalogue parity and wording tests green; `missingKeys()` is 0 for
  the kit's own stories in both languages (a browser test asserts it).
- [ ] Font coverage test green; `fonts/SOURCES.md` names the Noto
  version, the subset command and the checksums; OFL text shipped.
- [ ] A `web/`-style consumer (the Welcome story is enough until WP-13)
  shows Georgian text in the Georgian face (visible in the Pages
  Storybook; say that you looked, E-04).
- [ ] `pnpm check`, `pnpm test`, `pnpm test:browser` outputs in the PR.

## Safety notes

Wording is a safety surface: C-12 says a console that overstates
("lost") teaches its operator to discount the alert that does not. The
tests pin the words; a reviewer reads both catalogues. A string that
names an altitude without its datum is a defect (D-01, E-13), not a
style issue.

## Commits

`feat(i18n): add the provider, catalogues and language negotiation for ka and en [WP-2 U-M1]`,
`feat(i18n): add display formatters that name every datum and unit [WP-2 U-M1]`,
`feat(fonts): bundle Noto Sans and Noto Sans Georgian subsets with next/font loaders [WP-2 U-M1]`,
`test(fonts): check every Georgian block has a glyph and the size budget holds [WP-2 U-M1]`.
