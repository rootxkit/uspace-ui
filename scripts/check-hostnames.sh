#!/bin/sh
# Fails if the owner's production domain appears in the repository's files,
# tracked or not yet tracked (PLAN §7 "Public repository"; spec 06 §4).
# Allowed: examples/*/README.md (WP-13's example URL) and the plan
# documents that state this rule. The pattern is assembled so this script
# does not match itself.
set -u
cd "$(dirname "$0")/.."

pattern='chikox''\.net'
git grep --untracked -n -I -i -E "$pattern" -- . \
  ':(exclude,glob)examples/*/README.md' \
  ':(exclude)docs/PLAN.md' \
  ':(exclude,glob)docs/WORKPACKAGES/*.md'
status=$?
case $status in
  0)
    echo "check-hostnames: production hostname found in the files above" >&2
    exit 1
    ;;
  1)
    echo "check-hostnames: no production hostname in the repository's files"
    ;;
  *)
    echo "check-hostnames: git grep failed (exit $status); nothing was checked" >&2
    exit 2
    ;;
esac
