#!/bin/sh
# Compares the enumerations of src/model with the string constants of
# uspace-core/core at the tag in docs/CORE_VERSION (PLAN §10 job 7).
#
# Online: it fetches core/ by a sparse, shallow clone. The extraction here
# is deliberately small (awk over the `const (` blocks and the FieldError
# struct); the vitest file that follows is the real check, and it fails if
# the extraction comes back empty or partial.
#
# USPACE_CORE_REPO overrides the clone URL (a local path works).
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

tag=$(grep -v -e '^#' -e '^skip ' -e '^[[:space:]]*$' docs/CORE_VERSION | head -n 1 | tr -d '[:space:]')
if [ -z "$tag" ]; then
  echo "check-enums: no tag in docs/CORE_VERSION" >&2
  exit 1
fi
repo=${USPACE_CORE_REPO:-https://github.com/rootxkit/uspace-core.git}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo "check-enums: fetching core/ of $repo at $tag"
git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$tag" --filter=blob:none --sparse "$repo" "$work/core"
git -C "$work/core" sparse-checkout set core
commit=$(git -C "$work/core" rev-parse HEAD)

mkdir -p .cache
out=.cache/core-enums.tsv
{
  printf '# uspace-core %s %s\n' "$tag" "$commit"
  for f in "$work"/core/core/*.go; do
    case "$f" in *_test.go) continue ;; esac
    awk '
      /^const \(/ { inconst = 1; next }
      inconst && /^\)/ { inconst = 0; next }
      inconst && /^[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]+[A-Z][A-Za-z0-9_]*[ \t]*=[ \t]*"/ {
        value = $0
        sub(/^[^"]*"/, "", value)
        sub(/".*$/, "", value)
        printf "%s\t%s\n", $2, value
      }
      /^type FieldError struct \{/ { instruct = 1; next }
      instruct && /^\}/ { instruct = 0; next }
      instruct && $1 ~ /^[A-Z]/ { printf "FieldError\t%s\n", $1 }
    ' "$f"
  done
} > "$out"

count=$(grep -vc '^#' "$out" || true)
echo "check-enums: extracted $count constants from $tag ($commit) into $out"
if [ "$count" -eq 0 ]; then
  echo "check-enums: nothing extracted; the parser or the source layout changed" >&2
  exit 1
fi

CORE_ENUMS_FILE="$out" pnpm exec vitest run --project node --reporter=verbose src/model/enums.core.test.ts
