#!/usr/bin/env bash
# Copies the lab-derived fixtures from their sources at the commits pinned
# in src/test/fixtures/VERSION (WP-14; like uspace-core's
# scripts/sync-vectors.sh), then writes SHA256SUMS, docs/LAB_VERSION and
# src/test/labExamples.generated.ts. To move a pin: edit its commit in
# VERSION, run this, review the diff, run pnpm test, commit with the
# reason.
#
#   scripts/sync-fixtures.sh
#
# Refusals (E-04): a source that cannot be fetched at its commit, a path
# that is not there, a copied file with the production hostname in it
# (spec 06 §4). Nothing is half-written: the copy is built aside and moved
# in only when every source succeeded.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
dst="src/test/fixtures"
version="$dst/VERSION"
[[ -f "$version" ]] || { echo "sync-fixtures: no $version" >&2; exit 2; }

lab_commit="$(sed -n 's/^uspace_lab_commit *= *//p' "$version")"
[[ "$lab_commit" =~ ^[0-9a-f]{40}$ ]] || { echo "sync-fixtures: uspace_lab_commit is not a full commit" >&2; exit 2; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
stage="$tmp/stage"
mkdir -p "$stage"

# fetch <repo> <commit> <path>: a checkout of <repo> at <commit>,
# echoing its directory.
fetch() {
  local repo="$1" commit="$2" path="$3"
  local dir
  dir="$tmp/src-$(printf '%s' "$repo@$commit" | sha256sum | cut -c1-16)"
  if [[ ! -d "$dir" ]]; then
    git -c core.autocrlf=false -C "$tmp" init -q "$dir"
    git -C "$dir" remote add origin "$repo"
    git -C "$dir" fetch -q --depth 1 --filter=blob:none origin "$commit"
    git -C "$dir" -c advice.detachedHead=false -c core.autocrlf=false checkout -q FETCH_HEAD
  fi
  printf '%s' "$dir"
}

n=0
while read -r _ _ name repo commit path; do
  [[ "$commit" =~ ^[0-9a-f]{40}$ ]] || { echo "sync-fixtures: $name: $commit is not a full commit" >&2; exit 2; }
  src="$(fetch "$repo" "$commit" "$path")"
  mkdir -p "$stage/$name"
  if [[ -d "$src/$path" ]]; then
    found=0
    for f in "$src/$path"/*.json; do
      [[ -e "$f" ]] || continue
      cp "$f" "$stage/$name/"
      found=$((found + 1))
    done
    [[ $found -gt 0 ]] || { echo "sync-fixtures: $name: no examples at $path" >&2; exit 1; }
  elif [[ -f "$src/$path" ]]; then
    cp "$src/$path" "$stage/$name/"
  else
    echo "sync-fixtures: $name: $path is not in $repo at $commit" >&2
    exit 1
  fi
  echo "sync-fixtures: $name <- $repo@${commit:0:12} $path"
  n=$((n + 1))
done < <(grep '^source = ' "$version")
[[ $n -gt 0 ]] || { echo "sync-fixtures: no source lines in $version" >&2; exit 2; }

# The production hostname never enters the repository (spec 06 §4).
pattern='chikox''\.net'
if grep -rliE "$pattern" "$stage"; then
  echo "sync-fixtures: the files above carry the production hostname; leave that source out (VERSION says why)" >&2
  exit 1
fi

# Move the copy in, keeping VERSION.
find "$dst" -mindepth 1 -maxdepth 1 ! -name VERSION -exec rm -rf {} +
cp -R "$stage"/. "$dst"/
(
  cd "$dst"
  find . -type f ! -name VERSION ! -name SHA256SUMS | sed 's#^\./##' | LC_ALL=C sort |
    while read -r f; do sha256sum "$f"; done
) | sed -E 's/^([0-9a-f]{64}) [ *]/\1  /' > "$tmp/SHA256SUMS"
mv "$tmp/SHA256SUMS" "$dst/SHA256SUMS"
sed -i.bak "s/^synced_at = .*/synced_at = $(date -u +%Y-%m-%d)/" "$version" && rm -f "$version.bak"

cat > docs/LAB_VERSION <<EOF
$lab_commit
# The uspace-lab commit the kit's lab-derived fixtures are copied at
# (WP-14; PLAN §6.4, §14 Q16). Written by scripts/sync-fixtures.sh from
# src/test/fixtures/VERSION, which also pins the per-system sources.
EOF

node scripts/gen-lab-fixtures.mjs
echo "sync-fixtures: $n sources at uspace-lab@${lab_commit:0:12}; review the diff, run pnpm test, commit"
