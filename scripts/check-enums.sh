#!/bin/sh
# Compares the enumerations of src/model with the string constants of
# uspace-core at the tag in docs/CORE_VERSION (PLAN §10 job 7; WP-14):
# core/ (Trust, Severity, ZoneType, the identification enumerations, the
# vertical and time enumerations, FieldError), alerting/ (ClearReason) and
# sources/ (Why, the kit's DisabledBy).
#
# Online: it fetches those packages by a sparse, shallow clone. The
# constants are read by scripts/go-consts.mjs, a tokenizer over the Go
# source (not a line pattern); the vitest file that follows compares every
# enumeration, prints a table, and fails on any difference, on an empty
# or partial extraction, and on a listed skip core has since gained.
#
# USPACE_CORE_REPO overrides the clone URL (a local path works);
# CORE_ENUMS_OUT the extraction file (default .cache/core-enums.tsv).
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

tag=$(grep -v -e '^#' -e '^skip ' -e '^[[:space:]]*$' docs/CORE_VERSION | head -n 1 | tr -d '[:space:]')
if [ -z "$tag" ]; then
  echo "check-enums: no tag in docs/CORE_VERSION" >&2
  exit 1
fi
repo=${USPACE_CORE_REPO:-https://github.com/rootxkit/uspace-core.git}
packages="core alerting sources"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo "check-enums: fetching $packages of $repo at $tag"
git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$tag" --filter=blob:none --sparse "$repo" "$work/core"
# shellcheck disable=SC2086 # the package names are words
git -C "$work/core" sparse-checkout set $packages
commit=$(git -C "$work/core" rev-parse HEAD)

out=${CORE_ENUMS_OUT:-.cache/core-enums.tsv}
mkdir -p "$(dirname "$out")"
printf '# uspace-core %s %s
' "$tag" "$commit" > "$out"
# shellcheck disable=SC2086
node scripts/go-consts.mjs "$work/core" $packages >> "$out"

count=$(grep -vc '^#' "$out" || true)
echo "check-enums: extracted $count constants from $tag ($commit) into $out"
if [ "$count" -eq 0 ]; then
  echo "check-enums: nothing extracted; the reader or the source layout changed" >&2
  exit 1
fi

CORE_ENUMS_FILE="$out" pnpm exec vitest run --project node --reporter=verbose src/model/enums.core.test.ts
