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
  // WP-13 accessibility audit: MapLibre's focusable canvas, inside the
  // "Map" region, in the page's language.
  "map.canvas": "Map view: the arrow keys pan, plus and minus zoom",
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

  // WP-6: zones and restrictions. Applicability is the server's statement
  // (spec 02 F3, M17), and the wording says so; the kit never judges it.
  "zone.type.PROHIBITED": "Prohibited",
  "zone.type.REQ_AUTHORIZATION": "Authorisation required",
  "zone.type.CONDITIONAL": "Conditional",
  "zone.type.NO_RESTRICTION": "No restriction",
  "zone.type.USPACE": "U-space airspace",
  "zone.pattern.solid": "solid fill",
  "zone.pattern.hatched": "hatched",
  "zone.pattern.dotted": "dotted",
  "zone.pattern.none": "outline only",
  "zone.legend.title": "Zone types",
  "zone.legend.count_one": "{count} zone",
  "zone.legend.count_other": "{count} zones",
  "zone.legend.dimmed":
    "Dimmed: the server reports that the zone does not apply now.",
  "zone.legend.unstated":
    "Drawn in full when the server does not say whether the zone applies.",
  "zone.card.unnamed": "Unnamed zone",
  "zone.card.identifier": "Identifier",
  "zone.card.type": "Type",
  "zone.card.lower": "Lower limit",
  "zone.card.upper": "Upper limit",
  "zone.card.message": "Message",
  "zone.card.applicability": "Applicability",
  "zone.applicability.applies": "Applies now, as the server reports",
  "zone.applicability.not_applicable":
    "Does not apply now, as the server reports",
  "zone.card.version": "Version",
  "zone.card.updated": "Updated",
  "restriction.card.state": "State",
  "restriction.card.starts": "Starts",
  "restriction.card.ends": "Ends",
  "restriction.state.planned": "Planned",
  "restriction.state.active": "Active",
  "restriction.state.ended": "Ended",
  "restriction.state.cancelled": "Cancelled",
  "restriction.state.unstated": "State not provided",

  // WP-7: trust classes (04 §2). A trust class is how the position reached
  // the system, never how true it is (06 §1); the broadcast and provider
  // meanings say unverified (R-05, PLAN §14 Q18).
  "trust.authenticated": "Authenticated",
  "trust.provider": "Provider (unverified)",
  "trust.surveillance": "Surveillance",
  "trust.broadcast": "Broadcast (unverified)",
  "trust.sensor": "Sensor",
  "trust.simulated": "Simulated",
  "trust.authenticated.meaning":
    "Sent over the operator's own authenticated session for this aircraft.",
  "trust.provider.meaning":
    "Reported by a provider, unverified: as trustworthy as that peer system.",
  "trust.surveillance.meaning": "Air traffic surveillance, through the ANSP.",
  "trust.broadcast.meaning":
    "Broadcast and unverified: anyone can transmit this identity and position.",
  "trust.sensor.meaning": "Detected by a sensor, without an identity.",
  "trust.simulated.meaning": "Simulated traffic, from the lab only.",
  "trust.fill.solid": "solid",
  "trust.fill.hollow": "hollow",
  "trust.fill.dashed": "dashed ring",

  // WP-7: tracks on the map and their legend
  "track.provider": "reported by a provider, unverified",
  "track.emergency": "emergency",
  "track.label.unidentified": "unidentified",
  "track.legend.title": "Track symbols",
  "track.legend.count_one": "{count} track",
  "track.legend.count_other": "{count} tracks",
  "track.legend.shape":
    "Shape: how the position reached the system. Colour and mark: identification status. Faded: age.",
  "track.legend.arrow":
    "Arrow: course over ground as reported; no arrow when none is reported.",
  "track.legend.emergency": "Outer ring: the aircraft reports an emergency.",
  "track.legend.selected": "Inner ring: the selected track.",

  // WP-7: identification status (04 §3.2, G-01). The status is the
  // server's; these strings say what it means and on what basis.
  "ident.status.registered": "registered",
  "ident.status.suspended": "suspended",
  "ident.status.unknown_operator": "unknown operator",
  "ident.status.unidentified": "unidentified",
  "ident.status.none": "no identification",
  "ident.hint.registered":
    "The serial and the operator match an active registration.",
  "ident.hint.suspended":
    "Registered, but the aircraft or its operator is suspended or revoked.",
  "ident.hint.unknown_operator":
    "The serial is not registered, or the operator given is missing, unknown or not the owner.",
  "ident.hint.unidentified":
    "No usable serial number: nobody can say what aircraft this is.",
  "ident.hint.none": "No identification has been received for this track.",
  "ident.reason.matched": "Serial and operator match the registry.",
  "ident.reason.session_binding":
    "Bound by the operator's authenticated session.",
  "ident.reason.uas_suspended": "The aircraft's registration is suspended.",
  "ident.reason.uas_revoked": "The aircraft's registration is revoked.",
  "ident.reason.operator_suspended":
    "The operator's registration is suspended.",
  "ident.reason.operator_revoked": "The operator's registration is revoked.",
  "ident.reason.serial_unknown": "The serial is not in the registry.",
  "ident.reason.not_a_serial":
    "The identity given is not a serial number, so it is not looked up.",
  "ident.reason.operator_absent": "No operator registration was given.",
  "ident.reason.operator_mismatch":
    "The operator given is not the registered owner.",
  "ident.reason.owner_unknown":
    "The aircraft names an owner the registry does not hold.",
  "ident.reason.not_in_registry":
    "The aircraft is known but not in the registry.",
  "ident.reason.serial_conflict": "Registry records conflict over the serial.",
  "ident.reason.no_serial": "No serial was given.",
  "ident.reason.registry_unavailable": "The registry could not be consulted.",
  "ident.caveat.as_broadcast":
    "Serial and operator as broadcast and unverified.",
  "ident.caveat.provider":
    "Reported by a provider, unverified: a peer system's claim.",
  "ident.mismatch":
    "Operator mismatch: the operator given is not the registered owner.",
  "ident.mismatch_short": "operator mismatch",
  "ident.legend.title": "Identification",
  "ident.legend.attention":
    "Listed after registered and suspended: the statuses that need attention. The server raises the alerts.",
  "ident.legend.mismatch":
    "A mismatch is shown as a mismatch, never as registered.",
  "ident.legend.mark": "Mark beside the symbol: {mark}",
  "ident.legend.no_mark": "No mark beside the symbol",

  // WP-7: age buckets. The age counts from receipt by this console; the
  // threshold is the server's (stale_after_s).
  "age.bucket.live": "Live",
  "age.bucket.aging": "Ageing",
  "age.bucket.stale": "Stale",
  "age.bucket.unknown": "Age not known",
  "age.legend.title": "Track age",
  "age.legend.live": "under {a}",
  "age.legend.aging": "{a} to under {b}",
  "age.legend.stale": "{b} or more: drawn faded, never removed",
  "age.legend.unknown": "drawn in full: an unknown age is not shown as old",
  "age.legend.basis":
    "Age since this console received the position; the stale threshold is the server's ({b}).",
  "age.legend.no_threshold":
    "The server has not sent a stale threshold: ages are not bucketed.",

  // WP-7: severities. The severity is the server's (Z-10).
  "severity.critical": "Critical",
  "severity.warning": "Warning",
  "severity.info": "Information",
  "severity.critical.hint": "Needs action now.",
  "severity.warning.hint": "Needs attention; not yet a violation.",
  "severity.info.hint": "For information; no action expected.",
  "severity.legend.title": "Severity",

  // WP-5: sign-in. Rate limits are the API's (LESSONS S-15): the form shows
  // the API's refusal and its Retry-After, never a limit of its own.
  "auth.title": "Sign in",
  "auth.username": "Username",
  "auth.password": "Password",
  "auth.otp": "One-time code",
  "auth.submit": "Sign in",
  "auth.submitting": "Signing in",
  "auth.failed": "Sign-in refused (status {status})",
  "auth.unreachable": "The sign-in service could not be reached. Try again.",
  "auth.retry_in_one": "Try again in {count} second",
  "auth.retry_in_other": "Try again in {count} seconds",
  "auth.mfa_required":
    "Password accepted. Enter the one-time code from your authenticator app.",
  "auth.enrol":
    "Your account has no authenticator yet. Add this key to an authenticator app, then enter the code it shows.",
  "auth.enrol_key": "Authenticator key",
  "auth.recovery_codes":
    "Recovery codes: each works once, in place of a one-time code. Store them now; they are not shown again.",
  "auth.continue": "Continue",
  "auth.restart": "Start again",

  // WP-8: the feed's status bar and frozen overlay (C-12: down is "feed
  // down, retrying" with the age of the last frame, never "data lost").
  "feed.down_retrying": "Feed down, retrying",
  "feed.last_frame": "last frame {age} ago",
  "feed.no_frame_yet": "no frame received yet",
  "feed.as_of": "Showing data as of {time}, received {age} ago",
  "feed.no_data_yet": "No data received yet",
  "feed.malformed_one": "{count} malformed frame ignored",
  "feed.malformed_other": "{count} malformed frames ignored",
  "feed.degraded": "Degraded: {list}",
  "feed.no_threshold":
    "The server has sent no stale threshold: ages are shown without a bucket",

  // WP-8: what is degraded, by the server's key (02 F5), and the ages the
  // status frame carries (CIS cache, datasets, registry projection).
  "degraded.title": "Degraded service",
  "degraded.manned": "Manned traffic unavailable",
  "degraded.dss": "DSS unavailable",
  "degraded.source_disabled": "A source is switched off",
  "degraded.publisher_stale": "Publisher data out of date",
  "degraded.other": "{slug} (as the server names it)",
  "degraded.cis_age": "CIS data {age} old",
  "degraded.cis_age_over": "CIS data {age} old: over the bound of {bound}",
  "degraded.dataset_age": "{dataset}, version {version}: {age} old",
  "degraded.projection_age": "Registry projection {age} old",

  // WP-14: the thresholds a system's status frame carries (1.0.0; INV-03:
  // shown as sent, never defaulted, never judged with).
  "thresholds.title": "Thresholds in force",
  "thresholds.policy": "Policy version {version}",
  "thresholds.no_policy": "No policy version received yet",
  "thresholds.none":
    "The system sends no thresholds in its status; none is assumed.",
  "thresholds.caption":
    "As the system sends them; this console judges nothing with them.",
  "thresholds.cpa_tcpa_max_s": "Look-ahead to the closest approach",
  "thresholds.cpa_horizontal_min_m": "Horizontal separation minimum",
  "thresholds.cpa_vertical_min_m": "Vertical separation minimum",
  "thresholds.cpa_neighbour_radius_m": "Radius searched for neighbours",
  "thresholds.cpa_clear_after_s": "A proximity alert clears after",
  "thresholds.traffic_radius_m": "Traffic information radius",
  "thresholds.evaluation_period_s":
    "Proximity evaluation period (newest proximity alert)",
  "thresholds.unlabelled": "{name} (as the system names it)",

  // WP-14: the drawing tool's fields (1.0.0; uspace-ussp Q28 gap 1). Points
  // are sent as entered; the API judges the outline and draws a circle.
  "outline.legend": "Outline",
  "outline.hint":
    "Click the map to add a point, drag a point to move it, or type the points here. They are sent as entered; the system checks the outline.",
  "outline.kind": "Shape of the outline",
  "outline.polygon": "Polygon",
  "outline.circle": "Circle",
  "outline.point": "Point {n}",
  "outline.new_point": "New point {n}",
  "outline.center": "Centre",
  "outline.latitude": "{point}: latitude (degrees, WGS84)",
  "outline.longitude": "{point}: longitude (degrees, WGS84)",
  "outline.radius": "Radius (m)",
  "outline.add": "Add point",
  "outline.remove": "Remove point {n}",
  "outline.remove_short": "Remove",
  "outline.clear": "Clear the outline",
  "outline.count": "{count} of at most {max} points",
  "outline.full":
    "This outline takes at most {max} points: remove one to add another.",
  "outline.circle_words":
    "Circle: centre {lat}, {lng} (degrees, WGS84); radius {radius} m",
  "outline.circle_drawn":
    "The circle on the map is the outline the system drew.",
  "outline.circle_not_drawn":
    "The system draws a circle's outline; until it has, the map shows its centre only.",
  "outline.error.range": "Not between {min} and {max} degrees",
  "outline.error.positive": "Must be more than zero",

  // WP-8: the sources panel and the switch (B-09, B-11: a switch needs a
  // reason; disabled by a person never reads like silent).
  "source.panel.title": "Sources",
  "source.panel.empty": "The server reported no sources",
  "source.all": "All {type}",
  "source.last_heard": "last heard {age} ago",
  "source.counters": "{accepted} accepted, {refused} refused",
  "source.switch.disable": "Switch off",
  "source.switch.enable": "Switch on",
  "source.switch.title_disable": "Switch off {name}",
  "source.switch.title_enable": "Switch on {name}",
  "source.switch.description":
    "The server records the change with your name and the reason.",
  "source.switch.reason": "Reason (required)",
  "source.switch.reason_required": "Give a reason to continue",
  "source.switch.at_type": "Switched with its source type",

  // WP-9: the table kit. A unit and a datum are in the column header
  // (E-13), a time column says UTC (S-16), and an empty table says why
  // (E-02). No export: an export is an audited act at the API (01 A10).
  "table.header_unit": "{label} ({unit})",
  "table.header_utc": "{label} (UTC)",
  "table.column.age": "Age",
  "table.column.severity": "Severity",
  "table.column.trust": "Trust",
  "table.column.ident": "Identification",
  "table.column.select": "Select",
  "table.select_row": "Select row {id}",
  "table.select_page": "Select every row on this page",
  "table.filters": "Filters",
  "table.filter_label": "Filter: {label}",
  "table.filter_all": "All",
  "table.columns": "Columns",
  "table.columns_legend": "Columns to show",
  "table.keyboard_hint":
    "Arrow keys move between cells. Home and End go to the first and last cell of a row, with Control to the first and last row. Page Up and Page Down move ten rows. Enter selects a row or sorts by a column, with Shift adding to the sort. Space toggles a checkbox. Alt with Left or Right resizes a column.",
  "table.empty_filtered": "No rows match the filters",
  "table.clear_filters": "Clear filters",
  "table.error_title": "{title} (status {status})",
  "table.retry_after_one":
    "The server asks to wait {count} second before trying again",
  "table.retry_after_other":
    "The server asks to wait {count} seconds before trying again",
  "table.as_of_version": "As of version {version}",
  "table.updated_at": "updated {time}",
  "table.stale": "Stale, as the server reports",
  "table.refreshing": "Refreshing",
  "table.range": "Rows {from} to {to} of {total}",
  "table.page_size": "Rows per page",
  "table.page_of": "Page {page} of {pages}",
  "unit.symbol.m": "m",
  "unit.symbol.m_amsl": "m AMSL",
  "unit.symbol.m_agl": "m AGL",
  "unit.symbol.m_wgs84": "m above the WGS84 ellipsoid",
  "unit.symbol.m_takeoff": "m above take-off",
  "unit.symbol.ms": "m/s",
  "unit.symbol.s": "s",
  "unit.symbol.min": "min",
  "unit.symbol.deg": "°",
  "unit.symbol.pct": "%",
  "unit.symbol.kg": "kg",
  "unit.symbol.wh": "Wh",
  // WP-10: the form kit. A unit and a datum are in the label (E-13, D-01),
  // a time says UTC (S-16), every problem is named (Z-02), and an audited
  // act asks for a reason (B-09, B-11).
  "form.label_unit": "{label} ({unit})",
  "form.label_datum": "{label} ({datum})",
  "form.label_unit_datum": "{label} ({unit}, {datum})",
  "form.label_utc": "{label}, UTC",
  "form.utc_hint": "Enter the time in UTC, not in your local time.",
  "form.datum.AMSL": "AMSL",
  "form.datum.AGL": "AGL",
  "form.datum.WGS84": "above the WGS84 ellipsoid",
  "form.unit.m": "m",
  "form.unit.ft": "ft",
  "form.unit.ms": "m/s",
  "form.unit.s": "s",
  "form.unit.min": "min",
  "form.unit.deg": "°",
  "form.unit.kg": "kg",
  "form.unit.pct": "%",
  "form.choose": "Choose",
  "form.required_note": "Fields marked * are required.",
  "form.busy": "Sending",
  "form.saved": "Saved",
  "form.retry_in_one": "Try again in {count} second",
  "form.retry_in_other": "Try again in {count} seconds",
  "form.summary_one": "{count} problem: correct it and send again",
  "form.summary_other": "{count} problems: correct them and send again",
  "form.refused": "The server refused the request",
  "form.failed": "The request did not reach the server. Nothing was saved.",
  "form.problem": "{title} (status {status}).",
  "form.unmapped_title": "Problems the server named outside this form:",
  "form.whole_request": "the whole request",
  "form.truncated":
    "The server listed only the first problems; there are more. Correct these and send again to see the rest.",
  "form.reason": "Reason",
  "form.reason_count_one": "{count} character, at least {min}",
  "form.reason_count_other": "{count} characters, at least {min}",
  "form.confirm.recorded":
    "The server records this with your name and the reason.",
  "form.bbox.legend": "{label} (WGS84, [lng, lat] order)",
  "form.bbox.min_lng": "West: minimum longitude",
  "form.bbox.min_lat": "South: minimum latitude",
  "form.bbox.max_lng": "East: maximum longitude",
  "form.bbox.max_lat": "North: maximum latitude",
  "form.error.required": "Required",
  "form.error.not_a_number": "Not a number",
  "form.error.not_in_list": "Not one of the choices",
  "form.error.invalid_type": "Not the expected kind of value",
  "form.error.invalid_format": "Not in the expected format",
  "form.error.too_small": "Too small or too short",
  "form.error.too_big": "Too large or too long",
  "form.error.invalid": "Not accepted",
  "form.error.not_utc": "Not a UTC time (RFC 3339 ending in Z)",
  "form.error.bbox_lng_order":
    "West (minimum longitude) is east of East (maximum longitude)",
  "form.error.bbox_lat_order":
    "South (minimum latitude) is north of North (maximum latitude)",
  "form.error.reason_too_short": "The reason is too short",
  // WP-11: alerts and violations. The kind and every number are the
  // server's; units and datums in every number (E-13); "converging", never
  // "collision", and no loss claim for a silent link (C-12); a broadcast
  // or provider party says unverified (R-05); a clear says why, with its
  // own numbers (C-14); no resolution advice, ever (C-11).
  "alert.kind.proximity": "Converging aircraft",
  "alert.kind.nonconformance": "Outside the authorised intent",
  "alert.kind.nonconformance_nearby": "Nearby aircraft outside its intent",
  "alert.kind.height_exceedance": "Above the authorised upper limit",
  "alert.kind.zone_incursion": "Zone incursion",
  "alert.kind.lost_link": "No telemetry",
  "alert.kind.restriction_activated": "Restriction activated",
  "alert.kind.emergency_nearby": "Emergency nearby",
  "alert.kind.height_120m": "Above the height limit",
  "alert.kind.unregistered": "Unregistered aircraft",
  "alert.kind.no_authorisation": "No authorisation",
  "alert.kind.identification_mismatch": "Identification mismatch",
  "alert.kind.rid_absent": "No Remote ID broadcast",
  "alert.state.raised": "raised",
  "alert.state.updated": "updated",
  "alert.state.cleared": "cleared",
  "alert.clear_reason.resolved": "resolved",
  "alert.clear_reason.stale": "no recent data from the aircraft",
  "alert.clear_reason.source_disabled": "its source was disabled",
  "alert.clear_reason.flight_ended": "the flight ended",
  "alert.clear_reason.acknowledged_timeout":
    "acknowledged, and the hold period ended",
  "alert.clear_reason.landed": "the aircraft landed",
  "alert.reason.threshold_exceeded": "deviation threshold exceeded",
  "alert.reason.constraint_breached": "authorisation condition breached",
  "alert.numbers.proximity":
    "closest {d} m horizontally in {t} s, {v} m apart vertically",
  "alert.numbers.nonconformance":
    "{d} m outside the authorised volume horizontally, {h} m above it",
  "alert.numbers.height_exceedance": "{h} m over the authorised upper limit",
  "alert.numbers.height_120m": "{a} m AGL, {h} m over the height limit",
  "alert.numbers.lost_link": "no telemetry for {s} s",
  "alert.numbers.zone": "zone {zone}",
  "alert.summary.note": "{text}; {note}",
  "alert.summary.proximity": "Converging with {peer}: {numbers}",
  "alert.summary.peer_broadcast": "{peer} is broadcast and unverified",
  "alert.summary.peer_provider": "{peer} is reported by a provider, unverified",
  "alert.summary.nonconformance":
    "Outside its authorised intent ({reason}): {numbers}",
  "alert.summary.nonconformance_nearby":
    "A nearby aircraft deviated from its authorised intent",
  "alert.summary.height_exceedance": "{numbers}",
  "alert.summary.height_120m": "{numbers}",
  "alert.summary.terrain": "ground height from {terrain}",
  "alert.summary.zone_incursion": "Inside zone {zone} ({type})",
  "alert.summary.limit_not_judged": "limit not judged",
  "alert.summary.limit_not_judged_why": "limit not judged ({reasons})",
  "alert.summary.vertical_unknown": "vertical position not known",
  "alert.summary.within_band_widened":
    "within the widened band (pressure altitude)",
  "alert.summary.lost_link": "{numbers}",
  "alert.summary.restriction_activated": "Restriction {restriction} active",
  "alert.summary.authorisation_updated": "the authorisation was updated",
  "alert.summary.authorisation_withdrawn": "the authorisation was withdrawn",
  "alert.summary.emergency_nearby": "An aircraft nearby declared an emergency",
  "alert.summary.unregistered": "No registration found for this aircraft",
  "alert.summary.no_authorisation":
    "In U-space airspace with no matching authorised intent",
  "alert.summary.identification_mismatch":
    "Identification does not match the registry",
  "alert.summary.rid_absent":
    "Authenticated flight seen without a Remote ID broadcast",
  "alert.summary.cleared": "Cleared: {reason}",
  "alert.summary.cleared_numbers": "Cleared: {reason} ({numbers})",
  "alert.list.title": "Alerts",
  "alert.list.empty": "No alerts",
  "alert.list.severity": "Severity: {severity}",
  "alert.list.state": "State: {state}",
  "alert.list.raised_at": "raised {time}",
  "alert.list.received": "last update received {age} ago",
  "alert.list.aircraft": "Aircraft: {ids}",
  "alert.list.policy": "policy {version}",
  "alert.list.acknowledge": "Acknowledge",
  "alert.list.acknowledge_label": "Acknowledge {kind}, aircraft {ids}",
  "alert.list.acknowledged": "acknowledged on this console",
  "alert.list.not_acknowledged": "not acknowledged",
  "alert.list.show": "Show on map: {kind}, aircraft {ids}",
  "alert.list.show_short": "Show on map",
  "alert.list.announce": "Critical alert: {kind}. {summary}",
  "alert.toast.region": "New alerts",
  "alert.toast.raised": "{severity}: {kind}",
  "alert.toast.rose": "Severity raised to {severity}: {kind}",
  "alert.toast.dismiss": "Dismiss this notice; the alert stays in the list",
  "alert.tone.enable": "Enable alert sound",
  "alert.tone.needs_gesture": "Alert sound is off until you enable it",
  "alert.tone.on": "Alert sound on",
  "alert.tone.mute": "Turn alert sound off",
  "alert.tone.muted": "Alert sound is off",
  "alert.tone.unmute": "Turn alert sound on",
  "alert.tone.unavailable": "Alert sound is not available in this browser",
  "alert.tone.disabled": "Alert sound is switched off for this console",
  "alert.tone.repeat":
    "Repeats every {s} s while a critical alert is not acknowledged",
  // WP-12: traffic layers and the track detail. A manned aircraft is
  // never drawn as a drone and never hidden; a broadcast or provider
  // position says unverified (R-05, PLAN §14 Q18); every altitude goes
  // through fmtAltitude or fmtHeight, so it names its datum (D-01, E-13,
  // R-09, R-12); a receiver disabled by a person never reads like a
  // silent one (B-11); "current" is the server's, never the kit's clock.
  "manned.label.unknown": "no callsign or address",
  "manned.trust_unstated":
    "trust class not provided: shown as broadcast and unverified",
  "manned.history": "history, not live",
  "manned.source_class.ads_b": "ADS-B",
  "manned.source_class.mode_s": "Mode S",
  "manned.source_class.ssr": "SSR",
  "manned.source_class.atm_feed": "ATM surveillance feed",
  "manned.source_class.ads_l": "ADS-L",
  "manned.source_class.other": "{value} (as the server names it)",
  "intent.state.Accepted": "Accepted",
  "intent.state.Activated": "Activated",
  "intent.state.Nonconforming": "Nonconforming",
  "intent.state.Contingent": "Contingent",
  "intent.state.unstated": "DSS state not provided",
  "intent.state.other": "{state} (as the server names it)",
  "intent.peer":
    "Another USSP's intent through the DSS: reported by a provider, unverified",
  "intent.active": "Current, as the server reports",
  "intent.card.intent": "Intent",
  "intent.card.authorisation": "Authorisation",
  "intent.card.dss_state": "DSS state",
  "intent.card.local_state": "Local state",
  "intent.card.window": "Time window",
  "intent.card.priority": "Priority",
  "intent.card.volumes": "Volumes",
  "intent.window": "{start} to {end}",
  "receiver.card.title": "Receiver {id}",
  "detail.title.uas": "Unmanned aircraft {id}",
  "detail.title.manned": "Manned aircraft {id}",
  "detail.section.identification": "Identification",
  "detail.section.position": "Position and altitude",
  "detail.section.motion": "Motion",
  "detail.section.source": "Source and trust",
  "detail.section.times": "Times and age",
  "detail.status": "Status",
  "detail.reason": "Reason",
  "detail.basis": "Basis",
  "detail.serial": "Serial number",
  "detail.registration": "Operator registration (public part)",
  "detail.registered_operator": "Registered operator (public part)",
  "detail.position": "Position",
  "detail.position_value": "{lat}, {lng} (WGS84)",
  "detail.altitude": "Altitude",
  "detail.alt_wgs84": "Altitude above the ellipsoid",
  "detail.alt_pressure": "Pressure altitude",
  "detail.height": "Height",
  "detail.alt_source": "Altitude source",
  "detail.alt_source.geodetic": "geodetic: satellite fix through the geoid",
  "detail.alt_source.pressure":
    "barometric: a pressure altitude, referenced to 1013.25 hPa",
  "detail.alt_source.network": "as the network provider reported",
  "detail.alt_source.none": "no altitude reported",
  "detail.speed": "Ground speed",
  "detail.track": "Course over ground (degrees true)",
  "detail.vspeed": "Vertical speed (positive up)",
  "detail.operational_status": "Operational status",
  "detail.emergency": "Emergency",
  "detail.emergency_declared": "declared",
  "detail.emergency_none": "none reported",
  "detail.trust": "Trust class",
  "detail.source": "Source",
  "detail.instance": "Instance",
  "detail.heard_by": "Heard by",
  "detail.icao24": "ICAO 24-bit address",
  "detail.callsign": "Callsign",
  "detail.source_class": "Source class",
  "detail.anomaly": "Anomaly, as the server reports",
  "detail.ts": "Source time (the source's clock)",
  "detail.rx_ts": "Received (this system's clock)",
  "detail.captured_at": "Captured (this system's clock)",
  "detail.time_source": "Capture time placed by",
  "detail.time_source.source_clock": "the source's clock",
  "detail.time_source.broadcast": "the broadcast time",
  "detail.time_source.receiver": "the receiver's clock",
  "detail.time_source.provider": "the provider",
  "detail.time_source.system": "this system's clock",
  "detail.backlog": "History: delivered as backlog, not live",
  "detail.age_received": "Age since received",
  "detail.age_captured": "Age since captured",
  "detail.flight": "Flight",
  "detail.intent": "Intent",
} as const;

/** A key of the kit's own catalogue. Apps add keys of their own. */
export type Key = keyof typeof catalogue;

export const en: Readonly<Record<Key, string>> = catalogue;
