// `@rootxkit/uspace-ui/symbology` (docs/PLAN.md §3.8): pure functions from
// enumerations to visual values and MapLibre expressions. No React, no map.
// WP-6 adds the zone and restriction part; WP-7 adds the track part.
export {
  RESTRICTION_LINE_KEYS,
  RESTRICTION_STATE_KEYS,
  restrictionLine,
  restrictionLineFilter,
  restrictionStateToken,
  type RestrictionLine,
  type RestrictionLineKey,
} from "./restriction.js";
export {
  DIMMED_RESTRICTION_STATES,
  PATTERN_TILE_PX,
  PATTERNED_ZONE_TYPES,
  SELECTED_EXTRA_WIDTH_PX,
  ZONE_DIMMED_OPACITY,
  ZONE_LEGEND_ORDER,
  ZONE_PATTERN_KEYS,
  ZONE_TYPE_KEYS,
  parseHexColour,
  zoneDimExpression,
  zoneLineWidthPx,
  zoneOpacity,
  zoneOrder,
  zonePattern,
  zonePatternFillOpacity,
  zonePatternImage,
  zonePatternImageId,
  zoneStyle,
  zoneToken,
  type PatternImage,
  type Rgb,
  type ZoneColours,
  type ZoneFeatureProperties,
  type ZonePattern,
  type ZoneStyle,
} from "./zone.js";
