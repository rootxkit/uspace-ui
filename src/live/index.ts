// `@rootxkit/uspace-ui/live` (docs/PLAN.md §3.11, D8, WP-8): the
// reconnect-forever feed client for the console frame of PLAN §6.3, the
// bounded track, alert and source stores it fills, and the display ages.
// It understands the common envelope and the three `console/*` frames,
// never a system's business messages: those go to the app's adapters.
export {
  ALERT_STORE_LIMIT,
  DEFAULT_CLEARED_HOLD_MS,
  createAlertStore,
  type AlertInput,
  type AlertStore,
  type AlertStoreCounter,
  type AlertStoreOptions,
} from "./alertStore.js";
export {
  DEFAULT_BACKOFF,
  STABLE_AFTER_MS,
  reconnectDelayMs,
  type Backoff,
} from "./backoff.js";
export {
  CLOSE_UNAUTHORIZED,
  FeedClient,
  resolveFeedUrl,
  type FeedOptions,
  type FeedStores,
  type LiveStatus,
  type SnapshotTarget,
} from "./client.js";
export {
  countLive,
  liveCounters,
  resetLiveCountersForTests,
  type LiveCounter,
} from "./counters.js";
export {
  NO_EXTRAS,
  SNAPSHOT_SCHEMA,
  STATUS_SCHEMA,
  SUBSCRIBE_SCHEMA,
  parseFrame,
  parseFrameText,
  parseSnapshotBody,
  parseStatusBody,
  subscribeFrame,
  thresholdUnit,
  type BBox,
  type ConsoleFrame,
  type DatasetAge,
  type SnapshotBody,
  type StatusBody,
  type StatusExtras,
  type StatusSource,
  type SubscribeFrame,
  type SubscribeLayer,
  type WireSourceState,
} from "./frame.js";
export {
  useFeed,
  useNowMs,
  useStore,
  type ExternalStore,
  type LiveFeed,
} from "./hooks.js";
export {
  SOURCE_STORE_LIMIT,
  createSourceStore,
  sourceAgeS,
  sourceStateOf,
  type LiveSourceView,
  type SourceStore,
  type SourceStoreCounter,
} from "./sourceStore.js";
export { ageS, compareCapturedAt, utcMs, type AgeBasis } from "./time.js";
export {
  RECENTLY_REMOVED_LIMIT,
  createMannedStore,
  createTrackStore,
  type MannedStore,
  type PositionStore,
  type RemovedReason,
  type RemovedTrack,
  type TrackStore,
  type TrackStoreCounter,
  type TrackStoreOptions,
} from "./trackStore.js";
