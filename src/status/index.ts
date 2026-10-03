// `@rootxkit/uspace-ui/status` (docs/PLAN.md §3.12, WP-8): the feed's
// connection, its dropped and ignored frames, each source's state, what is
// degraded, ages, and the frozen picture while the feed is down. Wording
// per LESSONS B-03, B-04, B-11, C-12: nothing here says "lost", and a
// source disabled by a person never looks like a silent one. WP-12 adds
// TrackDetail, the panel of a selected aircraft.
export { AgeChip, type AgeChipProps } from "./AgeChip.js";
export { DegradedBanner, type DegradedBannerProps } from "./DegradedBanner.js";
export {
  FeedStatusBar,
  type FeedStatusBarProps,
  type FeedStatusInput,
} from "./FeedStatusBar.js";
export { FrozenOverlay, type FrozenOverlayProps } from "./FrozenOverlay.js";
export {
  SourceStateBadge,
  sourceDetailLines,
  sourceDisplayAgeS,
  type SourceInput,
  type SourceStateBadgeProps,
} from "./SourceStateBadge.js";
export { SourcesPanel, type SourcesPanelProps } from "./SourcesPanel.js";
export {
  ALT_SOURCE_KEYS,
  TIME_SOURCE_KEYS,
  TrackDetail,
  isMannedTrack,
  sourceClassLabel,
  type DetailLink,
  type TrackDetailProps,
} from "./TrackDetail.js";
export {
  CONNECTION_KEYS,
  DEGRADED_KEYS,
  DISABLED_BY_KEYS,
  SOURCE_STATE_KEYS,
  degradedLabel,
} from "./words.js";
