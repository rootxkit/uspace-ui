#!/bin/sh
# Produces fonts/*.woff2 from the Noto release archives (docs/PLAN.md D7,
# WP-2). Run by hand; the output is committed with its checksums in
# fonts/SOURCES.md. CI never downloads a font: it checks the committed
# files (src/fonts/fonts.test.ts).
#
# Needs curl, unzip, sha256sum and fontTools with brotli
# (`pip install fonttools==4.51.0 brotli==1.0.9`, the versions the
# committed files were made with). The archives are kept in
# $SUBSET_FONTS_CACHE (default .cache/fonts) and checked against the
# SHA-256 below before use.
#
# Usage: sh scripts/subset-fonts.sh
set -eu

cd "$(dirname "$0")/.."
cache="${SUBSET_FONTS_CACHE:-.cache/fonts}"
mkdir -p "$cache" fonts

latin_tag="NotoSans-v2.015"
latin_zip="$latin_tag.zip"
latin_url="https://github.com/notofonts/latin-greek-cyrillic/releases/download/$latin_tag/$latin_zip"
latin_sha="0c34df072a3fa7efbb7cbf34950e1f971a4447cffe365d3a359e2d4089b958f5"

georgian_tag="NotoSansGeorgian-v2.005"
georgian_zip="$georgian_tag.zip"
georgian_url="https://github.com/notofonts/georgian/releases/download/$georgian_tag/$georgian_zip"
georgian_sha="10e85011008108308e6feab0408242acb07804da61ede3d3ff236461ae07ab1b"

# Keep in step with src/fonts/faces.ts (LATIN_UNICODE_RANGE,
# GEORGIAN_UNICODE_RANGE); the font test compares them.
# Latin: Basic Latin, Latin-1, Latin Extended-A, the Latin Extended-B and
# IPA letters of the region's Latin orthographies (Azerbaijani schwa,
# Romanian comma-below), spacing modifiers and the common combining marks,
# Greek and Coptic, Cyrillic, General Punctuation, the euro, tenge, rouble
# and lari signs, numero, trade mark, arrows and minus.
latin_range="U+0000-017F,U+018F,U+0192,U+0218-021B,U+0237,U+0259,U+02BB-02BC,U+02C6-02DD,U+0300-0304,U+0306-0308,U+030A-030C,U+0327-0328,U+0370-03FF,U+0400-04FF,U+1E9E,U+2000-206F,U+20AC,U+20B8,U+20BD,U+20BE,U+2116,U+2122,U+2190-2193,U+2212"
# Georgian: Asomtavruli and Mkhedruli (Georgian), Mtavruli (Georgian
# Extended), Nuskhuri (Georgian Supplement).
georgian_range="U+10A0-10FF,U+1C90-1CBF,U+2D00-2D2F"

fetch() { # url zip sha
  if [ ! -f "$cache/$2" ]; then
    curl -fsSL -o "$cache/$2.part" "$1"
    mv "$cache/$2.part" "$cache/$2"
  fi
  echo "$3  $cache/$2" | sha256sum -c -
}

fetch "$latin_url" "$latin_zip" "$latin_sha"
fetch "$georgian_url" "$georgian_zip" "$georgian_sha"

work="$cache/work"
rm -rf "$work"
mkdir -p "$work"
unzip -q -o "$cache/$latin_zip" -d "$work/latin" \
  "NotoSans/unhinted/ttf/NotoSans-Regular.ttf" \
  "NotoSans/unhinted/ttf/NotoSans-Bold.ttf" OFL.txt
unzip -q -o "$cache/$georgian_zip" -d "$work/georgian" \
  "NotoSansGeorgian/unhinted/ttf/NotoSansGeorgian-Regular.ttf" \
  "NotoSansGeorgian/unhinted/ttf/NotoSansGeorgian-Bold.ttf" OFL.txt

for w in Regular Bold; do
  pyftsubset "$work/latin/NotoSans/unhinted/ttf/NotoSans-$w.ttf" \
    --unicodes="$latin_range" --flavor=woff2 --no-hinting \
    --output-file="fonts/NotoSans-$w.woff2"
  pyftsubset "$work/georgian/NotoSansGeorgian/unhinted/ttf/NotoSansGeorgian-$w.ttf" \
    --unicodes="$georgian_range" --flavor=woff2 --no-hinting \
    --output-file="fonts/NotoSansGeorgian-$w.woff2"
done

echo "Sources:"
sha256sum "$work"/latin/NotoSans/unhinted/ttf/*.ttf \
  "$work"/georgian/NotoSansGeorgian/unhinted/ttf/*.ttf \
  "$work/latin/OFL.txt" "$work/georgian/OFL.txt"
echo "Output (record in fonts/SOURCES.md):"
sha256sum fonts/*.woff2
wc -c fonts/*.woff2
