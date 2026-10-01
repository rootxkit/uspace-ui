// `@rootxkit/uspace-ui/layers` (docs/PLAN.md §3.9): map layers rendered
// inside MapView. Each owns a GeoJSON source and its MapLibre layers,
// applies data at most once per animation frame (§8) and removes itself on
// unmount. A layer reads the fields of a view model and emits expressions;
// it never computes a position, a containment or an applicability.
export {
  countLayer,
  layerCounters,
  resetLayerCountersForTests,
  type LayerCounter,
} from "./counters.js";
export {
  RESTRICTION_FILL_OPACITY,
  RESTRICTION_LAYER_ID,
  RestrictionLayer,
  restrictionLayerIds,
  type RestrictionLayerIds,
  type RestrictionLayerProps,
} from "./RestrictionLayer.js";
export {
  UNRESOLVED_COLOUR,
  putImage,
  resolveColour,
  useLayer,
  type UseLayerOptions,
} from "./useLayer.js";
export {
  ZoneCard,
  type RestrictionView,
  type ZoneCardProps,
} from "./ZoneCard.js";
export {
  setSourceData,
  useFeaturePointer,
  zoneFeatureCollection,
  type PointerHover,
  type ZoneFeatureCollection,
} from "./zoneFeatures.js";
export {
  HOVER_OFFSET_PX,
  HoverCard,
  ZONE_LABEL_SIZE_PX,
  ZONE_LAYER_ID,
  ZoneLayer,
  putZonePatterns,
  resolveZoneColours,
  zoneLayerIds,
  type ZoneLayerIds,
  type ZoneLayerProps,
} from "./ZoneLayer.js";
