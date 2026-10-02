"""Cut the browser tests' basemap extract out of a Protomaps daily build.

    python browser/public/basemap/extract.py BUILD MIN_LON,MIN_LAT,MAX_LON,MAX_LAT MAX_ZOOM

Reads https://build.protomaps.com/<BUILD>.pmtiles with HTTP range requests,
copies every tile intersecting the bbox from zoom 0 to MAX_ZOOM into
browser/public/basemap/basemap.pmtiles and writes browser/public/basemap/SOURCE.json.
Equivalent to `pmtiles extract <url> basemap.pmtiles --bbox=... --maxzoom=...`
(github.com/protomaps/go-pmtiles); this script exists so the extract can be
rebuilt with Python alone. Needs `pip install pmtiles==3.8.1`.

For the browser tests only: the deployment's basemap is built by the lab (PLAN §14 Q4).
"""

import json
import math
import os
import sys
import urllib.request
from datetime import datetime, timezone

from pmtiles.reader import Reader
from pmtiles.tile import zxy_to_tileid
from pmtiles.writer import write

HERE = os.path.dirname(os.path.abspath(__file__))


def http_source(url):
    cache = {}

    def get_bytes(offset, length):
        key = (offset, length)
        if key in cache:
            return cache[key]
        req = urllib.request.Request(
            url,
            headers={
                "Range": f"bytes={offset}-{offset + length - 1}",
                # The build host refuses the default urllib agent.
                "User-Agent": "uspace-ui-basemap-extract",
            },
        )
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
        if length <= 1 << 20:
            cache[key] = data
        return data

    return get_bytes


def tile_range(lon, lat, z):
    n = 2**z
    x = int((lon + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def main():
    build, bbox, max_zoom = sys.argv[1], sys.argv[2], int(sys.argv[3])
    min_lon, min_lat, max_lon, max_lat = (float(v) for v in bbox.split(","))
    url = f"https://build.protomaps.com/{build}.pmtiles"
    reader = Reader(http_source(url))
    header = reader.header()
    metadata = reader.metadata()

    tiles = []
    for z in range(0, max_zoom + 1):
        x0, y0 = tile_range(min_lon, max_lat, z)
        x1, y1 = tile_range(max_lon, min_lat, z)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                tiles.append((zxy_to_tileid(z, x, y), z, x, y))
    tiles.sort()

    out = os.path.join(HERE, "basemap.pmtiles")
    with write(out) as writer:
        for tile_id, z, x, y in tiles:
            data = reader.get(z, x, y)
            if data:
                writer.write_tile(tile_id, data)
        header = dict(header)
        header.update(
            min_zoom=0,
            max_zoom=max_zoom,
            min_lon_e7=round(min_lon * 1e7),
            min_lat_e7=round(min_lat * 1e7),
            max_lon_e7=round(max_lon * 1e7),
            max_lat_e7=round(max_lat * 1e7),
            center_zoom=max_zoom - 2,
            center_lon_e7=round((min_lon + max_lon) / 2 * 1e7),
            center_lat_e7=round((min_lat + max_lat) / 2 * 1e7),
        )
        writer.finalize(header, metadata)

    osm_as_of = metadata.get("planetiler:osm:osmosisreplicationtime")
    source = {
        "source": url,
        "build": build,
        "bounds": [min_lon, min_lat, max_lon, max_lat],
        "max_zoom": max_zoom,
        "osm_data_as_of": osm_as_of,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "licence": "Map data (c) OpenStreetMap contributors, ODbL. Fonts: SIL OFL.",
    }
    with open(os.path.join(HERE, "SOURCE.json"), "w", encoding="utf-8") as f:
        json.dump(source, f, indent=2)
        f.write("\n")
    print(f"{len(tiles)} tiles, {os.path.getsize(out)} bytes, osm {osm_as_of}")


if __name__ == "__main__":
    main()
