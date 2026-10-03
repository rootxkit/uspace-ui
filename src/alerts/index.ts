// `@rootxkit/uspace-ui/alerts` (docs/PLAN.md §3.13, WP-11): the alert
// list, the one-line summaries, the toaster and the gesture-gated tone.
// The kit renders alerts; it never computes one. Kind, severity, state,
// numbers and the repeat period are the server's; the acknowledgement
// flag is this console's and recording it is the app's.
export { AlertList, type AlertListProps } from "./AlertList.js";
export {
  AlertToaster,
  TOAST_HOLD_MS,
  TOAST_LIMIT,
  type AlertToasterProps,
} from "./AlertToaster.js";
export {
  alertChanges,
  soundingAlerts,
  sortAlerts,
  uniqueById,
  type AlertChange,
  type Seen,
} from "./changes.js";
export {
  alertCounters,
  resetAlertCountersForTests,
  type AlertCounter,
} from "./counters.js";
export { SeverityMark, type SeverityMarkProps } from "./SeverityMark.js";
export {
  AlertSummary,
  alertPeer,
  alertSummary,
  detailFlag,
  isKnownKind,
  kindName,
  detailNumber,
  detailString,
  detailStrings,
  type AlertPeer,
  type AlertSummaryProps,
} from "./summary.js";
export {
  TONE_GAIN,
  TONE_HZ,
  TONE_S,
  playTone,
  useAlertTone,
  validRepeatMs,
  type AlertTone,
  type AlertToneState,
} from "./tone.js";
export {
  ALERT_KIND_KEYS,
  ALERT_STATE_KEYS,
  ALERT_SUMMARY_KEYS,
  CLEAR_REASON_KEYS,
  NONCONFORMANCE_REASON_KEYS,
} from "./words.js";
