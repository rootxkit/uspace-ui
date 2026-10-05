// Reference adapter for alert and violation messages (WP-14): `alert/v1`
// (the USSP's schema, 02 F5) and `violation/v1` (the authority's, 04
// §3.3) to the alert store's input. `detail` is passed through untouched:
// AlertSummary reads it by the spec's names (PLAN §14 Q19).
import type { AlertInput } from "../../live/alertStore.js";
import type { ConsoleFrame } from "../../live/frame.js";
import {
  isAlertKind,
  isAlertState,
  isClearReason,
  isSeverity,
  isViolationKind,
} from "../../model/index.js";
import { adapted, obj, refused, str, type Adapted } from "./result.js";

/** `alert/v1` or `violation/v1` to an AlertInput. */
export function adaptAlert(f: ConsoleFrame): Adapted<AlertInput> {
  if (f.schema !== "alert/v1" && f.schema !== "violation/v1")
    return refused("schema", f.schema, "not alert/v1 or violation/v1");
  const violation = f.schema === "violation/v1";
  const b = obj(f.body);
  const idField = violation ? "violation_id" : "alert_id";
  const alertId = str(b[idField]);
  if (alertId === null) return refused(idField, b[idField], "missing");
  const kind = b["kind"];
  if (violation ? !isViolationKind(kind) : !isAlertKind(kind))
    return refused(
      "kind",
      kind,
      violation ? "not a ViolationKind" : "not an AlertKind",
    );
  // The lab's snapshot carries a violation's id and kind only: a missing
  // severity or state is unknown, and the adapter does not guess one.
  const severity = b["severity"];
  if (!isSeverity(severity))
    return refused("severity", severity, "not a core.Severity");
  const state = b["state"];
  if (!isAlertState(state))
    return refused("state", state, "not raised, updated or cleared");
  const clear = b["clear_reason"] ?? null;
  if (clear !== null && !isClearReason(clear))
    return refused("clear_reason", clear, "not a ClearReason the kit names");
  const detail = obj(b["detail"]);
  const peer = obj(detail["peer"]);
  const own = violation ? str(b["track_ref"]) : str(b["flight_id"]);
  const policy = b["policy_version"];
  const capturedAt = str(b["captured_at"]) ?? f.capturedAt ?? f.rxTs;
  return adapted({
    alertId,
    kind: kind as AlertInput["kind"],
    severity,
    state,
    clearReason: clear,
    aircraft: own === null ? [] : [own],
    peerTrackId: str(peer["track_id"]),
    detail,
    capturedAt,
    raisedAt: str(b[violation ? "opened_at" : "raised_at"]) ?? capturedAt,
    policyVersion:
      typeof policy === "number" || typeof policy === "string"
        ? String(policy)
        : "",
  });
}
