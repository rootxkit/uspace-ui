// Class names of the status tones (styles/tokens.css, src/theme/status.ts),
// written out in full so Tailwind's scan of the compiled package finds
// every one.
import type { StatusTone } from "../../theme/status.js";

/** Text and mark colour of a tone, on any surface. */
export const TONE_TEXT: Readonly<Record<StatusTone, string>> = {
  ok: "text-status-ok",
  info: "text-status-info",
  warning: "text-status-warning",
  critical: "text-status-critical",
  neutral: "text-status-neutral",
};

/** A tone's tint, its border and its text, for a badge or a pill. */
export const TONE_SOFT: Readonly<Record<StatusTone, string>> = {
  ok: "border-status-ok-border bg-status-ok-soft text-status-ok",
  info: "border-status-info-border bg-status-info-soft text-status-info",
  warning:
    "border-status-warning-border bg-status-warning-soft text-status-warning",
  critical:
    "border-status-critical-border bg-status-critical-soft text-status-critical",
  neutral:
    "border-status-neutral-border bg-status-neutral-soft text-status-neutral",
};

/** A tone as an outline: its border and its text, no tint. */
export const TONE_OUTLINE: Readonly<Record<StatusTone, string>> = {
  ok: "border-status-ok text-status-ok",
  info: "border-status-info text-status-info",
  warning: "border-status-warning text-status-warning",
  critical: "border-status-critical text-status-critical",
  neutral: "border-border-strong text-status-neutral",
};

/** The fill of a tone's dot or bar. */
export const TONE_FILL: Readonly<Record<StatusTone, string>> = {
  ok: "bg-status-ok",
  info: "bg-status-info",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
  neutral: "bg-status-neutral",
};
