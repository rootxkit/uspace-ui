# Releasing `@rootxkit/uspace-ui`

The kit is distributed as a **GitHub Release asset** of this repository:
a `pnpm pack` tarball of the built package with a `SHA256SUMS` file. It
is not on npmjs. The owner decided this on 2026-10-02, superseding PLAN
D10 and reconciliation M32 ("npmjs only"). Publishing to npm needs an
npm account and the `@rootxkit` scope, which the owner has to set up,
and that is not available. The npm path is kept, switched off, in
"Switching to npm later" below.

## What a consumer writes

An exact release asset URL, never a range, a branch or a `github:` spec:

```jsonc
// web/package.json
"dependencies": {
  "@rootxkit/uspace-ui": "https://github.com/rootxkit/uspace-ui/releases/download/v0.1.0-rc.1/rootxkit-uspace-ui-0.1.0-rc.1.tgz"
}
```

`pnpm install` writes the tarball's `sha512` integrity next to the URL
in `pnpm-lock.yaml`, and `pnpm install --frozen-lockfile` (every `web/`
CI and Docker build) refuses an asset whose bytes differ from it. CI's
`pack` job proves both on every pull request. The repository is public,
so the download needs no token. The tarball holds built output only, so
there is no `prepare` step and no devDependency in a consumer's image.
That build-in-every-image cost was M32's reason against a `github:` tag
dependency, and it does not apply here.

To upgrade, a `web/` replaces the URL with the next release's URL, runs
`pnpm install`, and commits the lockfile, in its own PR.

The asset name is what `pnpm pack` writes for a scoped package:
`rootxkit-uspace-ui-<version>.tgz`. `node scripts/release.mjs url`
prints the URL of the version in `package.json`.

## How a release is cut

1. On a branch, set `version` in `package.json` (`0.1.0-rc.2`, `0.1.0`)
   and add its `## <version>` section to `CHANGELOG.md`: what ships,
   what does not yet, and for an rc what moved since the last one.
   Merge it to `main`.
2. **The owner** tags the merge commit on `main` and pushes the tag:
   `git tag v0.1.0-rc.2 && git push origin v0.1.0-rc.2`. Agents do not
   tag.
3. `release.yml` runs:
   - `tag`: fails unless the tagged commit is on `main`, unless the tag
     is exactly `v<version>`, and unless `CHANGELOG.md` has a non-empty
     section for the version. Nothing is built before this passes.
   - `checks`: every job of `ci.yml` on the tag, through
     `workflow_call`. That includes `pack`, which builds, runs
     `pnpm pack`, checks that the tarball holds exactly `files`, runs
     publint and attw on the tarball, installs it by URL into a scratch
     consumer, and uploads it as the `package` artifact.
   - `release` (the only job with `contents: write`, using this run's
     `GITHUB_TOKEN`): downloads that artifact, checks its SHA-256
     against what `pack` reported, writes `SHA256SUMS`, attests the
     tarball's build provenance (below), and creates the GitHub Release
     with both files. The release body is the CHANGELOG
     section plus the dependency line. A version with a pre-release
     suffix (`-rc.1`, `-beta.2`) is marked as a pre-release. A plain
     version is marked latest. The job then reads the release back and
     re-downloads the asset from its public URL, checking the
     pre-release flag, the latest mark (a plain version is the latest
     release, a pre-release never), the SHA-256 and the attestation.
4. Tell each consumer the exact URL to pin.

A failed run releases nothing; fix on `main`, delete the tag, and tag
again. Do not replace an asset of a published release: consumers'
lockfiles pin its bytes, so a replaced asset breaks their installs, and
it should.

### Provenance: the tarball is signed, keyless

`SHA256SUMS` is written by the same job that uploads the tarball, so it
only says the bytes match what that job uploaded; it does not say who
built them, and a consumer's lockfile integrity pins whatever bytes it
first saw. The release job therefore attests the tarball with
`actions/attest-build-provenance` (pinned by SHA): a SLSA build
provenance statement for the tarball's SHA-256, signed through
Sigstore with a short-lived certificate for this run's GitHub OIDC
identity. There is no signing key to keep or leak. The attestation is
stored on this repository and names the repository, `release.yml` and
the tagged commit. The job needs `id-token: write` and
`attestations: write`, and only it has them.

A consumer verifies a release asset before pinning it (and again before
a bump):

```sh
gh attestation verify rootxkit-uspace-ui-<version>.tgz --repo rootxkit/uspace-ui \
  --signer-workflow rootxkit/uspace-ui/.github/workflows/release.yml
```

Releases cut before this (`v0.1.0-rc.1`) carry `SHA256SUMS` only and no
attestation.

### Who may tag

`release.yml` runs on any `v*` tag push, and the `tag` job only checks
that the tagged commit is on `main`; it cannot tell who pushed the tag.
The owner keeps a repository ruleset (Settings, Rules, Rulesets) that
targets tags matching `refs/tags/v*`, restricts creation, update and
deletion to the maintainers in its bypass list, and is active. Without
it, any account with push rights can cut a release of a commit on
`main`. Check it is still there before the first release after a change
of collaborators.

## Proving the release path without releasing

CI's `pack` job runs on every pull request and on `main`. Its summary
ends with a line of the form "Would release <file> (N files) as a GitHub
pre-release on tag v<version>", with the SHA-256 and the dependency
line. Locally:

```
pnpm build
node scripts/pack-test.mjs --out ../pack     # exactly `files`, exports and bin present
node scripts/consumer-test.mjs ../pack/rootxkit-uspace-ui-<version>.tgz
```

## Switching to npm later (off by default)

`package.json` keeps `publishConfig: { "access": "public", "provenance":
true }`. Nothing reads it until something runs `pnpm publish`, and
nothing does. To switch, the owner first:

1. creates or confirms the `@rootxkit` scope on npmjs and that the
   package is public;
2. registers this repository and `release.yml` as the trusted publisher
   (OIDC) of `@rootxkit/uspace-ui`.

Then a work package adds a `publish` job to `release.yml` after
`release`, with `permissions: { contents: read, id-token: write }`, that
downloads the same `package` artifact and runs `pnpm publish <tarball>
--provenance --access public --no-git-checks`, adding `--tag next` when
`node scripts/release.mjs prerelease` prints `true` so `latest` never
points at an rc. It never uses an `NPM_TOKEN` secret. Consumers then
move from the URL to an exact version (`"@rootxkit/uspace-ui":
"0.1.0"`), and PLAN D10, §10, §11 and this file change with it.
