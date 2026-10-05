"use client";
// TrackDetail (docs/PLAN.md §3.12, WP-12): the panel of a selected
// unmanned (`TrackView`) or manned (`MannedTrack`) aircraft, with what
// the API sent and nothing worked out here. The identification block is
// the server's status, reason, basis and mismatch in their words (G-01,
// G-02, R-05: a registration on a broadcast basis says "as broadcast and
// unverified", an authenticated one says nothing of the kind); every
// altitude names its datum in the same string (D-01, E-13: through
// fmtAltitude and fmtHeight), a pressure altitude says so and never AMSL
// (R-09), a height over take-off is not "above ground" (R-12); vertical
// speed is positive up (R-10); each of the three times is labelled with
// its clock (04 §2) and a backlog sample says it is history (T-04); a
// registration shows its public part only (06 §5); every null is a dash.
// The flight and intent ids are links only when the app renders them.
import { useId, type ReactNode } from "react";

import type { Key } from "../i18n/en.js";
import {
  DASH,
  fmtAge,
  fmtAltitude,
  fmtHeading,
  fmtHeight,
  fmtNum,
  fmtRegistrationNumber,
  fmtSpeed,
  fmtTimeUTC,
} from "../i18n/format.js";
import { useOptionalI18n, useTFor } from "../i18n/I18nProvider.js";
import type { Lang } from "../i18n/lang.js";
import type { Translate } from "../i18n/translate.js";
import { ageS } from "../live/time.js";
import type {
  AltSource,
  TimeSource,
  Times,
  TrackView,
} from "../model/index.js";
import { AGE_BUCKET_KEYS, ageBucket } from "../symbology/age.js";
import {
  IDENT_BASIS_KEYS,
  IDENT_STATUS_KEYS,
  identDrawn,
  identHintKey,
} from "../symbology/ident.js";
import {
  MANNED_SOURCE_CLASS_KEYS,
  mannedTrustDrawn,
  type MannedTrack,
} from "../symbology/manned.js";
import { TRUST_KEYS, TRUST_MEANING_KEYS } from "../symbology/track.js";
import { cn } from "../ui/cn.js";

/**
 * A link the app may render for an id it knows how to open.
 *
 * @public
 */
export interface DetailLink {
  kind: "flight" | "intent";
  id: string;
}

/** @public */
export interface TrackDetailProps {
  /** The selected aircraft: unmanned (`TrackView`) or manned. */
  track: TrackView | MannedTrack;
  /** The app's clock tick, in ms since the epoch. */
  nowMs: number;
  /** The feed's `stale_after_s`; null until the server sends one. */
  staleAfterS: number | null;
  /**
   * Server minus browser clock, from the status frame
   * (`LiveStatus.clockOffsetMs`); without it the age since capture is a
   * dash (04 §2: an age is never read across two clocks).
   */
  clockOffsetMs?: number | null;
  /** Renders a flight or intent id as the app's link; else plain text. */
  renderLink?(link: DetailLink): ReactNode;
  /** Position, motion, trust and age only (a map hover card). */
  compact?: boolean;
  /** The language, when there is no I18nProvider (a map hover card). */
  lang?: Lang;
  className?: string;
}

/**
 * True for a manned track (the one view with `sourceClass`).
 *
 * @beta
 */
export function isMannedTrack(v: TrackView | MannedTrack): v is MannedTrack {
  return "sourceClass" in v;
}

/**
 * The catalogue key of an altitude source's line (R-09).
 *
 * @beta
 */
export const ALT_SOURCE_KEYS: Readonly<Record<AltSource, Key>> = Object.freeze({
  geodetic: "detail.alt_source.geodetic",
  pressure: "detail.alt_source.pressure",
  network: "detail.alt_source.network",
  none: "detail.alt_source.none",
});

/**
 * The catalogue key of who placed `capturedAt` (04 §2 `time_source`).
 *
 * @beta
 */
export const TIME_SOURCE_KEYS: Readonly<Record<TimeSource, Key>> =
  Object.freeze({
    source_clock: "detail.time_source.source_clock",
    broadcast: "detail.time_source.broadcast",
    receiver: "detail.time_source.receiver",
    provider: "detail.time_source.provider",
    system: "detail.time_source.system",
  });

/**
 * The words of a manned source class: ours for 02 F4's, else as sent.
 *
 * @beta
 */
export function sourceClassLabel(value: string, t: Translate): string {
  const key = Object.hasOwn(MANNED_SOURCE_CLASS_KEYS, value)
    ? MANNED_SOURCE_CLASS_KEYS[value]
    : undefined;
  if (key !== undefined) return t(key);
  return value.trim() === "" ? DASH : t("manned.source_class.other", { value });
}

/**
 * What a row is, for the tests and for styling: an `altitude` row's value
 * always carries its datum (or is a dash).
 */
type RowKind = "altitude" | "time" | "text";

function Row(props: {
  field: string;
  label: string;
  kind?: RowKind;
  children: ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-[minmax(7rem,40%)_1fr] gap-2"
      data-field={props.field}
      data-kind={props.kind ?? "text"}
    >
      <dt className="text-muted-foreground">{props.label}</dt>
      <dd className="m-0 font-medium break-words">{props.children}</dd>
    </div>
  );
}

/** A titled group of rows; `notes` are lines above the rows, outside the list. */
function Section(props: {
  id: string;
  title: string;
  notes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={props.id} data-section={props.id}>
      <h4 id={props.id} className="m-0 mb-1 text-xs font-semibold uppercase">
        {props.title}
      </h4>
      {props.notes}
      <dl className="m-0 grid gap-0.5">{props.children}</dl>
    </section>
  );
}

function text(v: string | null | undefined): string {
  return v === null || v === undefined || v.trim() === "" ? DASH : v;
}

function AgeValue(props: {
  ageS: number | null;
  staleAfterS: number | null;
  lang: Lang;
  t: Translate;
}) {
  const bucket = ageBucket(props.ageS, props.staleAfterS ?? Number.NaN);
  return (
    <span data-age={bucket}>
      {fmtAge(props.ageS, props.lang)}
      {bucket !== "unknown" && ` · ${props.t(AGE_BUCKET_KEYS[bucket])}`}
    </span>
  );
}

interface Ctx {
  t: Translate;
  lang: Lang;
  idBase: string;
}

function identificationSection(track: TrackView, c: Ctx): ReactNode {
  const { t } = c;
  const id = track.identification;
  const drawn = identDrawn(id);
  if (id === null) {
    return (
      <Section
        id={`${c.idBase}-ident`}
        title={t("detail.section.identification")}
      >
        <Row field="ident-status" label={t("detail.status")}>
          {t(IDENT_STATUS_KEYS.none)}
        </Row>
      </Section>
    );
  }
  const hint = identHintKey(id.status, id.reason, id.basis, id.mismatch);
  return (
    <Section
      id={`${c.idBase}-ident`}
      title={t("detail.section.identification")}
      notes={
        <>
          {hint.caveat !== null && (
            <p className="m-0 text-xs font-semibold" data-part="basis-caveat">
              {t(hint.caveat)}
            </p>
          )}
          {hint.mismatch !== null && (
            <p
              className="m-0 text-xs font-semibold text-severity-warning"
              data-part="mismatch"
            >
              {t(hint.mismatch)}
            </p>
          )}
        </>
      }
    >
      <Row field="ident-status" label={t("detail.status")}>
        <span data-ident={drawn}>{t(IDENT_STATUS_KEYS[drawn])}</span>
        <span className="block font-normal" data-part="status-hint">
          {t(hint.status)}
        </span>
      </Row>
      <Row field="ident-reason" label={t("detail.reason")}>
        {t(hint.reason)}
      </Row>
      <Row field="ident-basis" label={t("detail.basis")}>
        {t(IDENT_BASIS_KEYS[id.basis])}
      </Row>
      <Row field="serial" label={t("detail.serial")}>
        {text(id.serial)}
      </Row>
      <Row field="registration" label={t("detail.registration")}>
        {fmtRegistrationNumber(id.operatorReg)}
      </Row>
      {id.mismatch && (
        <Row
          field="registered-operator"
          label={t("detail.registered_operator")}
        >
          {fmtRegistrationNumber(id.registeredOperatorReg)}
        </Row>
      )}
    </Section>
  );
}

function positionRow(lat: number, lng: number, c: Ctx): ReactNode {
  return (
    <Row field="position" label={c.t("detail.position")}>
      {c.t("detail.position_value", {
        lat: fmtNum(lat, 5, undefined, c.lang),
        lng: fmtNum(lng, 5, undefined, c.lang),
      })}
    </Row>
  );
}

function uasPosition(track: TrackView, c: Ctx): ReactNode {
  const { t, lang } = c;
  return (
    <Section id={`${c.idBase}-position`} title={t("detail.section.position")}>
      {positionRow(track.lat, track.lng, c)}
      {/* `altAmslM` with the source that produced it: a pressure source
          reads "pressure altitude", never AMSL (R-09). */}
      <Row
        field="alt-amsl"
        kind="altitude"
        label={
          track.altSource === "pressure"
            ? t("detail.alt_pressure")
            : t("detail.altitude")
        }
      >
        {fmtAltitude(track.altAmslM, track.altSource, lang)}
      </Row>
      <Row field="alt-source" label={t("detail.alt_source")}>
        {t(ALT_SOURCE_KEYS[track.altSource])}
        {track.altSource === "pressure" && (
          <span className="block font-normal" data-part="pressure-note">
            {t("alt.pressure_note")}
          </span>
        )}
      </Row>
      <Row field="alt-wgs84" kind="altitude" label={t("detail.alt_wgs84")}>
        {fmtAltitude(track.altWgs84M, "WGS84", lang)}
      </Row>
      <Row field="height" kind="altitude" label={t("detail.height")}>
        {fmtHeight(track.heightM, track.heightRef, lang)}
      </Row>
    </Section>
  );
}

function mannedPosition(track: MannedTrack, c: Ctx): ReactNode {
  const { t, lang } = c;
  return (
    <Section id={`${c.idBase}-position`} title={t("detail.section.position")}>
      {positionRow(track.lat, track.lng, c)}
      <Row
        field="alt-pressure"
        kind="altitude"
        label={t("detail.alt_pressure")}
      >
        {fmtAltitude(track.altPressureM, "pressure", lang)}
      </Row>
      <Row field="alt-wgs84" kind="altitude" label={t("detail.alt_wgs84")}>
        {fmtAltitude(track.altWgs84M, "WGS84", lang)}
      </Row>
    </Section>
  );
}

function motionSection(
  speedMs: number | null,
  trackDeg: number | null,
  vspeedMs: number | null,
  emergency: boolean,
  status: ReactNode,
  c: Ctx,
): ReactNode {
  const { t, lang } = c;
  return (
    <Section id={`${c.idBase}-motion`} title={t("detail.section.motion")}>
      <Row field="speed" label={t("detail.speed")}>
        {fmtSpeed(speedMs, lang)}
      </Row>
      <Row field="track" label={t("detail.track")}>
        {fmtHeading(trackDeg)}
      </Row>
      <Row field="vspeed" label={t("detail.vspeed")}>
        {fmtSpeed(vspeedMs, lang)}
      </Row>
      {status}
      <Row field="emergency" label={t("detail.emergency")}>
        <span data-emergency={emergency ? "true" : "false"}>
          {t(emergency ? "detail.emergency_declared" : "detail.emergency_none")}
        </span>
      </Row>
    </Section>
  );
}

function timesSection(
  times: Times,
  age: { received: number | null; captured: number | null },
  staleAfterS: number | null,
  compact: boolean,
  c: Ctx,
): ReactNode {
  const { t, lang } = c;
  const utc = (iso: string | null): string =>
    fmtTimeUTC(iso, lang, { seconds: true });
  return (
    <Section
      id={`${c.idBase}-times`}
      title={t("detail.section.times")}
      notes={
        times.backlog && (
          <p
            className="m-0 w-fit rounded-full border-2 border-age-stale px-2 py-0.5 text-xs font-semibold"
            data-part="backlog"
          >
            {t("detail.backlog")}
          </p>
        )
      }
    >
      {!compact && (
        <>
          <Row field="ts" kind="time" label={t("detail.ts")}>
            {utc(times.ts)}
          </Row>
          <Row field="rx-ts" kind="time" label={t("detail.rx_ts")}>
            {utc(times.rxTs)}
          </Row>
          <Row field="captured-at" kind="time" label={t("detail.captured_at")}>
            {utc(times.capturedAt)}
          </Row>
          <Row field="time-source" label={t("detail.time_source")}>
            {t(TIME_SOURCE_KEYS[times.timeSource])}
          </Row>
        </>
      )}
      <Row field="age-received" label={t("detail.age_received")}>
        <AgeValue
          ageS={age.received}
          staleAfterS={staleAfterS}
          lang={lang}
          t={t}
        />
      </Row>
      {!compact && (
        <Row field="age-captured" label={t("detail.age_captured")}>
          {fmtAge(age.captured, lang)}
        </Row>
      )}
    </Section>
  );
}

/** @public */
export function TrackDetail(props: TrackDetailProps) {
  const {
    track,
    nowMs,
    staleAfterS,
    clockOffsetMs = null,
    renderLink,
    compact = false,
    className,
  } = props;
  const ctxLang = useOptionalI18n()?.lang;
  const given = props.lang ?? ctxLang;
  const t = useTFor(given ?? "en");
  const idBase = `us-detail-${useId().replace(/:/g, "")}`;
  if (given === undefined) {
    throw new Error("TrackDetail needs an I18nProvider or a `lang` prop");
  }
  const lang = given;
  const c: Ctx = { t, lang, idBase };
  const age = {
    received: ageS(track, nowMs, "received"),
    captured: ageS(track, nowMs, "captured", clockOffsetMs),
  };
  const link = (kind: DetailLink["kind"], id: string | null): ReactNode =>
    id === null
      ? DASH
      : renderLink === undefined
        ? id
        : renderLink({ kind, id });

  if (isMannedTrack(track)) {
    const stated = track.trust !== undefined && track.trust !== null;
    const trust = mannedTrustDrawn(track.trust);
    const name = track.callsign ?? track.icao24 ?? t("manned.label.unknown");
    return (
      <article
        className={cn("us-track-detail grid gap-2 text-xs", className)}
        data-detail="manned"
        data-trust={trust}
        aria-labelledby={`${c.idBase}-title`}
      >
        <h3 id={`${c.idBase}-title`} className="m-0 text-sm font-semibold">
          {t("detail.title.manned", { id: name })}
        </h3>
        {!compact && (
          <Section
            id={`${c.idBase}-ident`}
            title={t("detail.section.identification")}
          >
            <Row field="callsign" label={t("detail.callsign")}>
              {text(track.callsign)}
            </Row>
            <Row field="icao24" label={t("detail.icao24")}>
              {text(track.icao24)}
            </Row>
            {track.anomaly !== undefined &&
              track.anomaly !== null &&
              track.anomaly.trim() !== "" && (
                <Row field="anomaly" label={t("detail.anomaly")}>
                  {track.anomaly}
                </Row>
              )}
          </Section>
        )}
        {mannedPosition(track, c)}
        {motionSection(
          track.gsMs,
          track.trackDeg,
          track.vrateMs,
          track.emergency,
          null,
          c,
        )}
        <Section id={`${c.idBase}-source`} title={t("detail.section.source")}>
          <Row field="trust" label={t("detail.trust")}>
            {t(TRUST_KEYS[trust])}
            <span className="block font-normal" data-part="trust-meaning">
              {stated
                ? t(TRUST_MEANING_KEYS[trust])
                : t("manned.trust_unstated")}
            </span>
          </Row>
          <Row field="source-class" label={t("detail.source_class")}>
            {sourceClassLabel(track.sourceClass, t)}
          </Row>
        </Section>
        {timesSection(track.times, age, staleAfterS, compact, c)}
      </article>
    );
  }

  const broadcast = track.trust === "broadcast";
  return (
    <article
      className={cn("us-track-detail grid gap-2 text-xs", className)}
      data-detail="uas"
      data-trust={track.trust}
      aria-labelledby={`${c.idBase}-title`}
    >
      <h3 id={`${c.idBase}-title`} className="m-0 text-sm font-semibold">
        {t("detail.title.uas", { id: track.trackId })}
      </h3>
      {broadcast && (
        <p className="m-0 font-semibold" data-part="broadcast-caveat">
          {t("track.broadcast_caveat")}
        </p>
      )}
      {!compact && identificationSection(track, c)}
      {uasPosition(track, c)}
      {motionSection(
        track.speedMs,
        track.trackDeg,
        track.vspeedMs,
        track.emergency,
        compact ? null : (
          <Row
            field="operational-status"
            label={t("detail.operational_status")}
          >
            {text(track.status)}
          </Row>
        ),
        c,
      )}
      <Section id={`${c.idBase}-source`} title={t("detail.section.source")}>
        <Row field="trust" label={t("detail.trust")}>
          {t(TRUST_KEYS[track.trust])}
          <span className="block font-normal" data-part="trust-meaning">
            {t(TRUST_MEANING_KEYS[track.trust])}
          </span>
        </Row>
        {!compact && (
          <>
            <Row field="source" label={t("detail.source")}>
              {text(track.source)}
            </Row>
            <Row
              field="instance"
              label={broadcast ? t("detail.heard_by") : t("detail.instance")}
            >
              {text(track.sourceInstance)}
            </Row>
            <Row field="flight" label={t("detail.flight")}>
              {link("flight", track.flightId)}
            </Row>
            <Row field="intent" label={t("detail.intent")}>
              {link("intent", track.intentId)}
            </Row>
          </>
        )}
      </Section>
      {timesSection(track.times, age, staleAfterS, compact, c)}
    </article>
  );
}
