# WP-13a: rc publish (`release.yml`, npm trusted publishing, `0.1.0-rc.N`)

Branch `feat/WP-13a-rc-publish`. Milestone U-M1 (the external leg of
demo 1: the CISP's WP-9 `web/` scaffold starts on an rc of the kit and
bumps; nothing else gates it). Split from WP-13 by the cross-plan
reconciliation (M32, U1) so the first publish does not wait for the
example app. Owns `.github/workflows/release.yml`, the publish
configuration in `package.json` (`publishConfig`, `files`, `version`),
`scripts/release-notes.mjs`, the `0.1.0-rc.N` sections of
`CHANGELOG.md`, and `docs/RELEASING.md`. Depends on WP-0..WP-5 merged
to `main` (the rc ships what is there). WP-13 depends on this.

## Read first

1. `docs/PLAN.md` §1.2 D10 (npmjs only, trusted publishing, the rc),
   D12, §10 (`release.yml`: the jobs, the dist-tag rule, the tag =
   version assertion), §11 (what a consumer pins and how), §12 (the
   `0.1.0-rc.N` line; an rc may still change an export, the CHANGELOG
   says what moved), §13 (WP-13a in the table and the waves), §14 Q1
   (**open**: the owner confirms the `@rootxkit` npm scope; this WP
   cannot publish without it and does not switch registries).
2. Spec `06 §4` (public repository: pinned and verified dependencies,
   provenance, SBOM, no secret in the repo), `07` U-M1 and C-M1.
3. The cross-plan decisions M32 (npmjs only; no `github:` tag installs,
   because a git dependency needs a `prepare` build with the full
   devDependencies inside every system's Docker image), M33 (consumer
   minimum versions), M34 (pnpm in every `web/`).
4. npm trusted publishing (OIDC) documentation: the repository and
   workflow file name registered on the package's npm settings, `pnpm
   publish --provenance`, `permissions: id-token: write`; the npm
   dist-tag rules (`--tag next` for a pre-release so `latest` is never
   an rc); semver pre-release ordering (`0.1.0-rc.1 < 0.1.0`).
5. LESSONS E-04 (a skipped step is reported as a skip, never as a
   pass), E-02 (run the branch that says nothing is wrong: the publish
   step that succeeds is the one nobody has watched).

## What to build

- `release.yml`: on tag `v*`: checkout, pnpm from `packageManager`,
  the `check`, `test`, `browser` and `fonts` jobs reused from `ci.yml`
  (`workflow_call` or a composite action; no duplicated steps), then a
  `publish` job that: asserts `package.json` `version` equals the tag
  without the `v` (fails before anything else otherwise); runs `pnpm
  pack` and the pack test below; runs `pnpm publish --provenance
  --access public --no-git-checks` with `--tag next` when the version
  has a pre-release suffix and no `--tag` otherwise (the rule is a
  three-line script with its own test, not an inline expression);
  then creates a GitHub release whose body is the CHANGELOG section
  for the version (`scripts/release-notes.mjs` extracts it and exits
  non-zero when the section is missing), marked pre-release for an rc.
  `permissions: { contents: write, id-token: write }`; no `NPM_TOKEN`
  anywhere; `concurrency` per tag.
- A dry-run job on pull requests that touch `release.yml`,
  `package.json` or `scripts/release-notes.mjs`: every step of the
  publish job with `pnpm publish --dry-run`, printing the file list and
  the dist-tag that *would* be used as a visible "would publish N files
  to tag T" line.
- `package.json`: `version` `0.1.0-rc.1`; `files` limited to `dist/`,
  `styles/`, `fonts/`, `README.md`, `LICENSE`, `CHANGELOG.md`;
  `publishConfig: { access: "public", provenance: true }`; no
  `.npmrc` registry line (npmjs is the default and the only registry).
- `docs/RELEASING.md`: how an rc is cut (bump `version`, add the
  CHANGELOG section, tag `v0.1.0-rc.N` from `main`), who tags (the
  owner), what the workflow does, how a consumer pins an rc (`pnpm add
  @rootxkit/uspace-ui@0.1.0-rc.1`, exact), and that a `github:` or
  tarball dependency on this repo is not supported.
- `CHANGELOG.md`: a `0.1.0-rc.1` section listing the entry points that
  ship (`model`, `theme`, `ui`, `i18n`, `fonts`, `map`, `api`,
  `auth/*`, `eslint`, `test`) and the ones that do not yet (`layers`,
  `legend`, `live`, `status`, `alerts`, `table`, `form`), so the
  CISP's WP-9 does not look for `ZoneLayer` in rc.1; `rc.2` follows
  WP-6's merge and says so.
- The owner's side, written down as a checklist in the PR (not done
  by the agent): create or confirm the `@rootxkit` scope on npmjs,
  register this repository and `release.yml` as the trusted publisher
  for `@rootxkit/uspace-ui`, tag `v0.1.0-rc.1` from `main`.

## Tests

- Pack test (`scripts/pack-test.mjs`, run in `check` and in the
  publish job): `pnpm pack` output contains `dist/`, `styles/`,
  `fonts/`, `README.md`, `LICENSE`, `CHANGELOG.md` and nothing from
  `browser/`, `examples/`, `src/`, `.github/`, `docs/` (presence and
  absence, E-01); every `exports` key of PLAN §2 resolves inside the
  packed tarball (unpack into a temp dir and `require.resolve` /
  import each, `node16` and `bundler` conditions).
- Dist-tag rule: `0.1.0-rc.1` → `next`; `0.1.0` → none; `1.0.0-beta.2`
  → `next`; `1.0.0` → none (a unit test on the script).
- Tag = version assertion: a tag `v0.1.0-rc.1` with `version`
  `0.1.0-rc.1` passes; with `0.1.0` fails before `pnpm pack` runs
  (assert by the job's step order in a dry run; paste the log).
- `release-notes.mjs`: extracts the section for an existing version;
  fails on a missing one; the extracted text is exactly the section
  (no neighbouring sections).
- The dry-run job on this WP's own PR: its "would publish N files to
  tag next" line pasted into the PR.
- After the owner tags `v0.1.0-rc.1`: the workflow run is green, `npm
  view @rootxkit/uspace-ui dist-tags` shows `next: 0.1.0-rc.1` and no
  `latest`, the npm page shows the provenance badge, and `pnpm add
  @rootxkit/uspace-ui@0.1.0-rc.1` in an empty directory installs
  without a token (say you ran it, paste the output; E-04).

## Done when

- [ ] `release.yml` merged; the dry-run job green on the PR with the
  file list and the dist-tag line pasted.
- [ ] The pack test runs in `check` and the publish job; `publint` and
  `attw` clean on the packed tarball, not only on `dist/`.
- [ ] `docs/RELEASING.md` and the `0.1.0-rc.1` CHANGELOG section
  committed; `README.md` "Consuming" says rc versions are under `next`.
- [ ] The owner has confirmed the scope and the trusted publisher (PLAN
  §14 Q1 stays open until then; this WP does not publish by any other
  route, and says in the PR that it is waiting).
- [ ] `0.1.0-rc.1` on npmjs with provenance, installable without a
  token; the CISP planner told the exact version to pin (a comment on
  `uspace-cisp` WP-9).
- [ ] `pnpm check`, `pnpm test` outputs in the PR.

## Safety notes

This is the supply chain of four state consoles (`06 §4`): the publish
must be reproducible from a tag, signed by the workflow, and contain
only built output. The one new risk an early rc adds is a consumer
reading `latest` and getting an rc; the dist-tag rule and its test are
the guard, and the post-publish check reads the dist-tags back rather
than trusting the log. No token, ever: if trusted publishing cannot be
set up, the WP stops and says so; it does not fall back to an
`NPM_TOKEN` secret or to a `github:` dependency (M32).

## Commits

`ci: add the tag release workflow with provenance and the pre-release dist-tag rule [WP-13a U-M1]`,
`build: limit the published files and pin the rc version [WP-13a U-M1]`,
`test: check the packed tarball for presence, absence and resolvable exports [WP-13a U-M1]`,
`docs: add the releasing guide and the 0.1.0-rc.1 changelog [WP-13a U-M1]`.
