#!/usr/bin/env bash
# Verifies the lab-derived fixtures (WP-14; like uspace-core's
# scripts/check-vectors.sh).
#   1. Offline, always: every file's sha256 matches SHA256SUMS, no file is
#      unlisted, docs/LAB_VERSION names the pinned lab commit, and
#      src/test/labExamples.generated.ts is what the files generate.
#   2. Online, with --online: every directory is byte-identical to its
#      source at the pinned commit (the same set of files, the same bytes).
# A source that cannot be fetched is reported "unverified", never "ok"
# (E-04: an unanswerable question is not a pass); REQUIRE_LAB=1 makes it a
# failure (CI on main).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
dst="src/test/fixtures"
version="$dst/VERSION"

echo "== offline: SHA256SUMS"
(cd "$dst" && sha256sum --check --strict --quiet SHA256SUMS)
listed="$(sed -E 's/^[0-9a-f]{64} [ *]//' "$dst/SHA256SUMS" | LC_ALL=C sort)"
present="$(cd "$dst" && find . -type f ! -name VERSION ! -name SHA256SUMS | sed 's#^\./##' | LC_ALL=C sort)"
if [[ "$listed" != "$present" ]]; then
  echo "check-fixtures: files and SHA256SUMS disagree:" >&2
  diff <(printf '%s\n' "$listed") <(printf '%s\n' "$present") >&2 || true
  exit 1
fi
echo "ok: $(printf '%s\n' "$present" | wc -l | tr -d ' ') files match SHA256SUMS"

lab_commit="$(sed -n 's/^uspace_lab_commit *= *//p' "$version")"
pinned="$(grep -v -e '^#' -e '^[[:space:]]*$' docs/LAB_VERSION | head -n 1 | tr -d '[:space:]')"
if [[ "$pinned" != "$lab_commit" ]]; then
  echo "check-fixtures: docs/LAB_VERSION ($pinned) is not uspace_lab_commit ($lab_commit)" >&2
  exit 1
fi
echo "ok: docs/LAB_VERSION is uspace-lab@${lab_commit:0:12}"
node scripts/gen-lab-fixtures.mjs --check

if [[ "${1:-}" != "--online" ]]; then
  echo "== online: skipped (pass --online to compare with the sources)"
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
unverified=0
mismatch=0
while read -r _ _ name repo commit path; do
  dir="$tmp/src-$(printf '%s' "$repo@$commit" | sha256sum | cut -c1-16)"
  if [[ ! -d "$dir" ]]; then
    if ! { git -c core.autocrlf=false -C "$tmp" init -q "$dir" &&
      git -C "$dir" remote add origin "$repo" &&
      git -C "$dir" fetch -q --depth 1 --filter=blob:none origin "$commit" &&
      git -C "$dir" -c advice.detachedHead=false -c core.autocrlf=false checkout -q FETCH_HEAD; } 2>"$tmp/err"; then
      echo "unverified: $name: could not fetch $repo@${commit:0:12} ($(tr '\n' ' ' <"$tmp/err" | cut -c1-200))"
      rm -rf "$dir"
      unverified=$((unverified + 1))
      continue
    fi
  fi
  if [[ -d "$dir/$path" ]]; then
    want="$(cd "$dir/$path" && find . -maxdepth 1 -type f -name '*.json' | sed 's#^\./##' | LC_ALL=C sort)"
    have="$(cd "$dst/$name" && find . -maxdepth 1 -type f | sed 's#^\./##' | LC_ALL=C sort)"
    if [[ "$want" != "$have" ]]; then
      echo "mismatch: $name: the set of examples differs from $repo@${commit:0:12} $path" >&2
      diff <(printf '%s\n' "$want") <(printf '%s\n' "$have") >&2 || true
      mismatch=$((mismatch + 1))
      continue
    fi
    for f in $want; do
      if ! cmp -s "$dir/$path/$f" "$dst/$name/$f"; then
        echo "mismatch: $name/$f differs from $repo@${commit:0:12}" >&2
        mismatch=$((mismatch + 1))
      fi
    done
  elif [[ -f "$dir/$path" ]]; then
    if ! cmp -s "$dir/$path" "$dst/$name/$(basename "$path")"; then
      echo "mismatch: $name/$(basename "$path") differs from $repo@${commit:0:12}" >&2
      mismatch=$((mismatch + 1))
    fi
  else
    echo "mismatch: $name: $path is not in $repo at ${commit:0:12}" >&2
    mismatch=$((mismatch + 1))
  fi
  echo "checked: $name against $repo@${commit:0:12} $path"
done < <(grep '^source = ' "$version")

if [[ $mismatch -gt 0 ]]; then
  echo "check-fixtures: $mismatch file(s) differ from their sources; run scripts/sync-fixtures.sh" >&2
  exit 1
fi
if [[ $unverified -gt 0 ]]; then
  echo "check-fixtures: $unverified source(s) unverified"
  if [[ "${REQUIRE_LAB:-0}" == "1" ]]; then exit 1; fi
  exit 0
fi
echo "ok: every fixture matches its source at the pinned commit"
