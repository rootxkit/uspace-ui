# Storybook basemap (Tbilisi centre)

A tiny self-hosted basemap bundle so the map stories render offline and make
no third-party request (PLAN D6, §6.3; spec `06 §4`). Storybook serves this
directory at `<base>/basemap/` (`.storybook/main.ts` `staticDirs`), the
layout a deployment serves from its shared volume. It is for stories only:
the deployment's Georgia-wide bundle is built by the lab (PLAN §14 Q4) and
is never committed here.

| Path | What |
|---|---|
| `basemap.pmtiles` | Protomaps daily build `20261001`, bbox `44.77,41.68,44.83,41.73`, zooms 0 to 14, 39 tiles, 3.3 MB |
| `SOURCE.json` | `bounds` (TileJSON order), `osm_data_as_of`, the build and the licence |
| `fonts/Noto Sans {Regular,Medium,Italic}/` | glyph PBFs for the ranges the story labels use: `0-255`, `256-511` (Latin), `4096-4351` (Georgian Mkhedruli), `7168-7423` (Georgian Mtavruli), `8192-8447` (punctuation), `8448-8703` (letterlike symbols such as №) |
| `sprites/v4/{light,dark}{,@2x}.{json,png}` | the Protomaps icon sheets |
| `fonts/OFL.txt` | the font licence, shipped with the glyphs |
| `extract.py` | the script that cut `basemap.pmtiles` and wrote `SOURCE.json` |

## Rebuild

```sh
pip install pmtiles==3.8.1
python stories/basemap/extract.py 20261001 44.77,41.68,44.83,41.73 14
```

The script reads `https://build.protomaps.com/<build>.pmtiles` with HTTP
range requests and copies every tile intersecting the bbox; it is the same
cut as `pmtiles extract https://build.protomaps.com/20261001.pmtiles
basemap.pmtiles --bbox=44.77,41.68,44.83,41.73 --maxzoom=14`
(github.com/protomaps/go-pmtiles). Keep the result to a few MB.

Glyphs and sprites come from `github.com/protomaps/basemaps-assets` at
commit `028c18f713baecad011301ff7a69acc39bcc2ae7`:

```sh
c=028c18f713baecad011301ff7a69acc39bcc2ae7
for fs in "Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic"; do
  for r in 0-255 256-511 4096-4351 7168-7423 8192-8447 8448-8703; do
    curl -fsS -o "fonts/$fs/$r.pbf" \
      "https://raw.githubusercontent.com/protomaps/basemaps-assets/$c/fonts/${fs// /%20}/$r.pbf"
  done
done
for f in light light@2x dark dark@2x; do
  for e in json png; do
    curl -fsS -o "sprites/v4/$f.$e" \
      "https://raw.githubusercontent.com/protomaps/basemaps-assets/$c/sprites/v4/$f.$e"
  done
done
```

A label that needs a glyph range not listed here makes MapLibre log a 404
and draw the character locally; add the range rather than ignore the log.

Licences: map data © OpenStreetMap contributors, ODbL; glyphs from Noto
Sans, SIL OFL 1.1 (`fonts/OFL.txt`); sprites derived from the MIT-licensed
tangrams/icons (basemaps-assets README); the style layers come from
`@protomaps/basemaps`, BSD-3-Clause.
