// The kit's English catalogue (docs/PLAN.md §3.4). `Key` is derived from
// it, and `ka.ts` must carry every key (the compiler and the parity test
// both check). Keys are grouped by the work package that owns them; a WP
// adds its keys under its own comment, in both files.
//
// Wording is a safety surface (CLAUDE.md rule 5):
// - every broadcast track and every alert involving one says "broadcast
//   and unverified"; a registration on a broadcast basis says "as
//   broadcast and unverified" (LESSONS R-05);
// - `unreachable` and `lagging` never say "lost"; loss wording only for a
//   recorded gap (C-12, B-03, B-04); the test lists the keys allowed it;
// - "disabled by" never reads like "silent since" (B-11);
// - an altitude always names its datum, a pressure altitude says so and
//   never says AMSL, height over take-off is not "above ground" (D-01,
//   E-13, R-09, R-12);
// - no registry personal data in a track or identification string (G-10).

const catalogue = {
  // WP-2: common words
  "common.dash": "—",
  "common.yes": "Yes",
  "common.no": "No",
  "common.unknown": "unknown",
  "common.none": "none",
  "common.not_provided": "not provided",
  "common.loading": "Loading",

  // WP-2: actions (towards people and the page, never towards an aircraft)
  "action.close": "Close",
  "action.cancel": "Cancel",
  "action.confirm": "Confirm",
  "action.retry": "Try again",
  "action.show_details": "Show details",
  "action.hide_details": "Hide details",

  // WP-2: languages
  "lang.label": "Language",
  "lang.name.ka": "Georgian",
  "lang.name.en": "English",

  // WP-2: connection states of the console feed (C-12: none says "lost")
  "feed.connecting": "Connecting",
  "feed.live": "Live",
  "feed.reconnecting": "Reconnecting: showing the last data received",
  "feed.closed": "Not connected",
  "feed.frozen": "Frozen: no update for {age}",
  "feed.session_expired": "Session ended: sign in again",
  "feed.dropped_one": "{count} frame dropped",
  "feed.dropped_other": "{count} frames dropped",
  // A recorded gap is the one place loss wording belongs (C-12, B-04).
  "feed.gap_recorded": "Data lost: recorded gap from {from} to {to}",

  // WP-2: source states and switches (B-03, B-04, B-11)
  "source.state.healthy": "healthy",
  "source.state.stale": "stale: not heard recently",
  "source.state.lagging": "lagging: behind, data still arriving",
  "source.state.unreachable": "unreachable: data buffered at the source",
  "source.state.never_heard": "never heard",
  "source.state.disabled": "disabled",
  "source.lagging_by": "behind by {age}",
  "source.disabled_by": "disabled by {who}",
  "source.disabled_by.type": "disabled: the whole source type is switched off",
  "source.disabled_by.instance": "disabled: this source is switched off",
  "source.disabled_by.default_deny":
    "disabled: new sources are off until enabled",
  "source.silent_since": "silent since {time}",
  "source.refused_one": "{count} frame refused while disabled",
  "source.refused_other": "{count} frames refused while disabled",

  // WP-2: ages. 04 §2: an age counts from capture or from receipt, never
  // a mix, so the two have their own words.
  "age.seconds": "{n} s",
  "age.minutes": "{n} min",
  "age.hours": "{n} h",
  "age.days": "{n} d",
  "age.ago": "{age} ago",
  "age.since_captured": "{age} since captured",
  "age.since_received": "{age} since received",

  // WP-2: datums and units. Every altitude names its datum (D-01, E-13).
  "alt.amsl": "{v} m AMSL",
  "alt.agl": "{v} m AGL",
  "alt.wgs84": "{v} m above the WGS84 ellipsoid",
  "alt.pressure": "{v} m pressure altitude",
  "alt.network": "{v} m AMSL, as the network provider reported",
  "alt.pressure_note":
    "Pressure altitude is referenced to 1013.25 hPa, not to sea level: its error is unknown",
  "height.takeoff": "{v} m above take-off",
  "height.ground": "{v} m above ground",
  "unit.speed": "{v} m/s",
  "unit.distance": "{v} m",
  "time.utc": "{time} UTC",
  "time.local": "{time} {zone}",

  // WP-2: trust and identification basis (R-05, G-10)
  "track.broadcast": "broadcast and unverified",
  "track.broadcast_caveat":
    "Broadcast and unverified: anyone can transmit this identity and position.",
  "alert.broadcast_caveat":
    "Involves a broadcast and unverified track: its position is a claim.",
  "ident.basis.authenticated": "authenticated",
  "ident.basis.as_broadcast": "as broadcast and unverified",
  "ident.basis.provider": "reported by a provider, unverified",
  "ident.registered_as_broadcast": "registered, as broadcast and unverified",

  // WP-1: the English text of the vendored shadcn/ui components, for the
  // props that replace it (src/ui/UPGRADING.md).
  "ui.close": "Close",
  "ui.more": "More",
  "ui.more_pages": "More pages",
  "ui.previous": "Previous",
  "ui.next": "Next",
  "ui.previous_page": "Go to the previous page",
  "ui.next_page": "Go to the next page",
  "ui.pagination": "Pages",
  "ui.breadcrumb": "Breadcrumb",
  "ui.command_title": "Command palette",
  "ui.command_description": "Search for a command",

  // WP-3: map
  "map.region": "Map",
  "map.loading": "Loading the base map",
  "map.no_basemap":
    "No base map: positions are drawn on a plain background. The base map files are missing or unreadable.",
  "map.no_basemap_attribution": "no base map",
  "map.osm_as_of": "OSM data as of {date} (UTC)",
  "map.webgl_unavailable":
    "The map cannot be drawn: this browser has no WebGL. Viewport:",
  "map.bbox": "{minLng}, {minLat} to {maxLng}, {maxLat} (lng, lat, WGS84)",
  "map.controls": "Map buttons",
  "map.zoom_in": "Zoom in",
  "map.zoom_out": "Zoom out",
  "map.north": "Turn the map to north up",
  "map.scheme_dark": "Dark map",
  "map.layers": "Layers",
  "map.layers_close": "Close layers",
} as const;

/** A key of the kit's own catalogue. Apps add keys of their own. */
export type Key = keyof typeof catalogue;

export const en: Readonly<Record<Key, string>> = catalogue;
