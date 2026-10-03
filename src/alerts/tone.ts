"use client";
// useAlertTone (docs/PLAN.md §3.13, WP-11): a short synthesised tone (Web
// Audio, no file) that sounds while `active` and repeats every `repeatMs`.
// The period is the server's policy (02 F5: "unacknowledged critical
// alerts repeat every 10 s" is the server's number), so it is a required
// argument with no default (CLAUDE.md rule 3).
//
// A browser lets audio start only after a user gesture, so the hook
// starts in `needs_gesture` and sounds nothing until `enable()` runs from
// a click; the toaster shows that state and its button, so a silent
// console is a visible state and never a quiet surprise (E-02). Muting is
// a visible state too. A cue change (a new alert joined the sounding set,
// or one rose to critical, C-07) sounds at once and restarts the period.
import { useCallback, useEffect, useRef, useState } from "react";

import { countAlert } from "./counters.js";

/** Where the tone stands, each a visible state in the toaster. */
export type AlertToneState = "needs_gesture" | "on" | "muted" | "unavailable";

export interface AlertTone {
  state: AlertToneState;
  /** True while the tone is repeating (on, active, a valid period). */
  sounding: boolean;
  /** Starts audio; call it from a user gesture (a click). */
  enable(): void;
  mute(): void;
  unmute(): void;
}

// Display constants of the tone itself, not thresholds: its pitch, its
// length and its loudness.
export const TONE_HZ = 880;
export const TONE_S = 0.25;
export const TONE_GAIN = 0.2;

type AudioCtor = new () => AudioContext;

function audioConstructor(): AudioCtor | null {
  const g = globalThis as unknown as {
    AudioContext?: AudioCtor;
    webkitAudioContext?: AudioCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** One tone on `ctx`: a sine with a short fade in and out. */
export function playTone(ctx: AudioContext): void {
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(TONE_HZ, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(TONE_GAIN, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + TONE_S);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + TONE_S + 0.05);
  } catch {
    countAlert("tone_failed");
  }
}

/** True for a usable repeat period: a positive finite number of ms. */
export function validRepeatMs(repeatMs: number): boolean {
  return Number.isFinite(repeatMs) && repeatMs > 0;
}

/**
 * Sounds while `active`, every `repeatMs`, once audio has been enabled by
 * a gesture and while not muted. `cue` restarts the period with a tone at
 * once when it changes (pass the ids of the sounding alerts).
 */
export function useAlertTone(
  active: boolean,
  repeatMs: number,
  cue = "",
): AlertTone {
  const ctx = useRef<AudioContext | null>(null);
  const [state, setState] = useState<AlertToneState>("needs_gesture");

  const enable = useCallback((): void => {
    if (ctx.current !== null) {
      setState("on");
      return;
    }
    const Ctor = audioConstructor();
    if (Ctor === null) {
      countAlert("tone_unavailable");
      setState("unavailable");
      return;
    }
    try {
      const c = new Ctor();
      void c.resume().catch(() => undefined);
      ctx.current = c;
      setState("on");
    } catch {
      countAlert("tone_unavailable");
      setState("unavailable");
    }
  }, []);
  const mute = useCallback((): void => {
    setState((s) => (s === "on" ? "muted" : s));
  }, []);
  const unmute = useCallback((): void => {
    setState((s) => (s === "muted" ? "on" : s));
  }, []);

  const valid = validRepeatMs(repeatMs);
  useEffect(() => {
    const c = ctx.current;
    if (!active || state !== "on" || c === null) return;
    playTone(c);
    if (!valid) {
      countAlert("tone_repeat_invalid");
      return;
    }
    const id = setInterval(() => {
      playTone(c);
    }, repeatMs);
    return () => {
      clearInterval(id);
    };
  }, [active, state, repeatMs, valid, cue]);

  useEffect(
    () => () => {
      const c = ctx.current;
      ctx.current = null;
      if (c !== null) void c.close().catch(() => undefined);
    },
    [],
  );

  return {
    state,
    sounding: active && state === "on" && valid,
    enable,
    mute,
    unmute,
  };
}
