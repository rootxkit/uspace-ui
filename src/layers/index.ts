// `@rootxkit/uspace-ui/layers` (docs/PLAN.md §3.9): map layers rendered
// inside MapView. Each owns a GeoJSON source and its MapLibre layers,
// applies data at most once per animation frame (§8) and removes itself on
// unmount. A layer reads the fields of a view model and emits expressions;
// it never computes a position, a containment or an applicability.
export {
  ALERT_DASH,
  ALERT_LAYER_ID,
  ALERT_RING_RADIUS_PX,
  ALERT_WIDTH_PX,
  AlertLayer,
  alertLayerIds,
  resolveSeverityColours,
  type AlertLayerIds,
  type AlertLayerProps,
} from "./AlertLayer.js";
export {
  AlertGaps,
  alertFeatureCollection,
  type AlertFeature,
  type AlertFeatureCollection,
  type AlertFeatureProperties,
} from "./alertFeatures.js";
export {
  countLayer,
  layerCounters,
  resetLayerCountersForTests,
  type LayerCounter,
} from "./counters.js";
export { HoverPortal } from "./HoverPortal.js";
export {
  INTENT_LABEL_SIZE_PX,
  INTENT_LAYER_ID,
  IntentCard,
  IntentLayer,
  intentFeatureCollection,
  intentLabel,
  intentLayerIds,
  type IntentCardProps,
  type IntentFeatureCollection,
  type IntentInput,
  type IntentLayerIds,
  type IntentLayerProps,
} from "./IntentLayer.js";
export {
  MANNED_LAYER_ID,
  MannedLayer,
  mannedAge,
  mannedFeatureCollection,
  mannedLabel,
  mannedLayerIds,
  putMannedIcons,
  resolveMannedColours,
  type MannedFeatureCollection,
  type MannedFeatureOptions,
  type MannedLayerIds,
  type MannedLayerProps,
} from "./MannedLayer.js";
export {
  RESTRICTION_FILL_OPACITY,
  RESTRICTION_LAYER_ID,
  RestrictionLayer,
  restrictionLayerIds,
  type RestrictionLayerIds,
  type RestrictionLayerProps,
} from "./RestrictionLayer.js";
export {
  TrackHold,
  compareCapturedAt,
  receivedAgeS,
  trackFeatureCollection,
  trackLabel,
  type FeatureOptions,
  type TrackFeature,
  type TrackFeatureCollection,
  type TrailFeature,
} from "./trackFeatures.js";
export {
  TRACK_LAYER_ID,
  TrackLayer,
  putTrackIcons,
  resolveTrackColours,
  trackLayerIds,
  type TrackLayerIds,
  type TrackLayerProps,
} from "./TrackLayer.js";
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
