// Display formatters (docs/PLAN.md §3.4). Display only: none converts a
// unit or a datum, places a time or judges anything (CLAUDE.md rule 2).
// An unknown is a dash, never a zero (rule 6; predecessor format.ts);
// every altitude names its datum (rule 4, D-01, E-13); a time says UTC or
// names its zone (S-16). The words come from the catalogues.
import type { AltSource, VerticalRef } from "../model/index.js";
import { countI18n } from "./counters.js";
import type { Key } from "./en.js";
import { LOCALES, type Lang } from "./lang.js";
import { createTranslator, type Translate } from "./translate.js";

/** @beta */
export const DASH = "—";

/** @beta */
export type HeightRef = "TakeoffLocation" | "GroundLevel";

const translators = new Map<Lang, Translate>();

function kitT(lang: Lang): Translate {
  let t = translators.get(lang);
  if (t === undefined) {
    t = createTranslator(lang);
    translators.set(lang, t);
  }
  return t;
}

const numberFormats = new Map<string, Intl.NumberFormat>();

function known(v: number | null | undefined): v is number {
  return v !== null && v !== undefined && Number.isFinite(v);
}

/**
 * `v` with `digits` decimals and an optional unit; a dash for null, NaN or
 * Infinity. With `lang`, grouped and punctuated as `ka-GE` or `en-GB`;
 * without, plain digits.
 *
 * @public
 */
export function fmtNum(
  v: number | null | undefined,
  digits = 0,
  unit?: string,
  lang?: Lang,
): string {
  if (!known(v)) return DASH;
  let text: string;
  if (lang === undefined) {
    text = v.toFixed(digits);
  } else {
    const id = `${lang}/${digits}`;
    let nf = numberFormats.get(id);
    if (nf === undefined) {
      nf = new Intl.NumberFormat(LOCALES[lang], {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
      numberFormats.set(id, nf);
    }
    text = nf.format(v);
  }
  return unit === undefined || unit === "" ? text : `${text} ${unit}`;
}

/**
 * The catalogue key each datum or altitude source renders with. `geodetic`
 * is AMSL through the geoid (core/vertical.go); `pressure` is a pressure
 * altitude and never says AMSL (R-09); `none` has no altitude.
 *
 * @beta
 */
export const ALTITUDE_KEYS: Readonly<
  Record<VerticalRef | AltSource, Key | null>
> = {
  AMSL: "alt.amsl",
  AGL: "alt.agl",
  WGS84: "alt.wgs84",
  geodetic: "alt.amsl",
  pressure: "alt.pressure",
  network: "alt.network",
  none: null,
};

/**
 * "550 m AMSL", "120 m AGL", "600 m pressure altitude". A dash when the
 * value is unknown, when the source is `none`, and when no datum is given:
 * bare metres are never shown.
 *
 * @public
 */
export function fmtAltitude(
  v: number | null,
  ref: VerticalRef | AltSource | null,
  lang: Lang,
): string {
  if (!known(v) || ref === null) return DASH;
  const key = ALTITUDE_KEYS[ref];
  if (key === null) return DASH;
  const t = kitT(lang);
  return t(key, { v: fmtNum(v, 0, undefined, lang) });
}

/**
 * The catalogue key each broadcast height reference renders with (R-12).
 *
 * @beta
 */
export const HEIGHT_KEYS: Readonly<Record<HeightRef, Key>> = {
  TakeoffLocation: "height.takeoff",
  GroundLevel: "height.ground",
};

/**
 * A broadcast height: "40 m above take-off" or "40 m above ground", never
 * one for the other (R-12); a dash without a value or a reference.
 *
 * @beta
 */
export function fmtHeight(
  v: number | null,
  ref: HeightRef | null,
  lang: Lang,
): string {
  if (!known(v) || ref === null) return DASH;
  const t = kitT(lang);
  return t(HEIGHT_KEYS[ref], { v: fmtNum(v, 0, undefined, lang) });
}

/**
 * "3 s", "2 min", "5 h", "3 d" (whole units, truncated). The caller says
 * which age it is (since capture or since receipt, 04 §2).
 *
 * @public
 */
export function fmtAge(ageS: number | null, lang: Lang): string {
  if (!known(ageS)) return DASH;
  const t = kitT(lang);
  const s = Math.round(ageS);
  if (Math.abs(s) < 60) return t("age.seconds", { n: s });
  const min = Math.trunc(s / 60);
  if (Math.abs(min) < 60) return t("age.minutes", { n: min });
  const h = Math.trunc(min / 60);
  if (Math.abs(h) < 24) return t("age.hours", { n: h });
  return t("age.days", { n: Math.trunc(h / 24) });
}

// RFC 3339 requires a zone designator (02 §1); a time without one would be
// read as the browser's local time, so it is refused.
const ZONED = /(?:Z|[+-]\d{2}:?\d{2})$/i;

function parseZoned(iso: string | null): Date | null {
  if (iso === null) return null;
  const d = ZONED.test(iso.trim()) ? new Date(iso.trim()) : null;
  if (d === null || Number.isNaN(d.getTime())) {
    countI18n("time_refused");
    return null;
  }
  return d;
}

const two = (n: number): string => String(n).padStart(2, "0");

/**
 * "2026-10-02 14:03 UTC" (seconds on request), the same layout in both
 * languages and always saying UTC. A dash for null and for a string that
 * is not an RFC 3339 time with a zone (counted).
 *
 * @public
 */
export function fmtTimeUTC(
  iso: string | null,
  lang: Lang,
  opts: { seconds?: boolean } = {},
): string {
  const d = parseZoned(iso);
  if (d === null) return DASH;
  const date = `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`;
  let time = `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
  if (opts.seconds === true) time += `:${two(d.getUTCSeconds())}`;
  const t = kitT(lang);
  return t("time.utc", { time: `${date} ${time}` });
}

/**
 * "2026-10-02 18:03 Asia/Tbilisi": the time in the IANA zone `tz`, which
 * is the app's (the kit has no default zone), followed by the zone's name.
 * An unknown zone throws: it is a configuration error, not a display state.
 *
 * @public
 */
export function fmtTimeLocal(
  iso: string | null,
  lang: Lang,
  tz: string,
): string {
  const fmt = new Intl.DateTimeFormat(LOCALES[lang], {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    numberingSystem: "latn",
  });
  const d = parseZoned(iso);
  if (d === null) return DASH;
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    fmt.formatToParts(d).find((p) => p.type === type)?.value ?? "";
  const time = `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
  const t = kitT(lang);
  return t("time.local", { time, zone: tz });
}

/**
 * "12.3 m/s" ("12,3 მ/წმ"); a dash when unknown.
 *
 * @public
 */
export function fmtSpeed(ms: number | null, lang: Lang): string {
  if (!known(ms)) return DASH;
  const t = kitT(lang);
  return t("unit.speed", { v: fmtNum(ms, 1, undefined, lang) });
}

/**
 * "045°", whole degrees 000-359; a dash when unknown.
 *
 * @public
 */
export function fmtHeading(deg: number | null): string {
  if (!known(deg)) return DASH;
  const d = ((Math.round(deg) % 360) + 360) % 360;
  return `${String(d).padStart(3, "0")}°`;
}

/**
 * "1 250 m": always metres (the kit converts no unit); a dash when unknown.
 *
 * @beta
 */
export function fmtDistance(m: number | null, lang: Lang): string {
  if (!known(m)) return DASH;
  const t = kitT(lang);
  return t("unit.distance", { v: fmtNum(m, 0, undefined, lang) });
}

// The display side of uspace-core regnum.PublicPart (LESSONS G-04): an EU
// secret part is a hyphen and three ASCII letters or digits after a
// number, and a hyphenated public form ("GEO-OP-ABC") is not a number with
// a secret. The kit has no configured pattern and never validates a
// number; it only keeps a secret part off the screen (06 §5).
const SECRET_SUFFIX = /^([A-Za-z0-9]+)-[A-Za-z0-9]{3}$/;

/**
 * The public part as given. A value ending in a secret part shows only
 * what precedes the hyphen, and the refusal is counted: the API never
 * sends a secret part, so one reaching the kit is a defect upstream.
 *
 * @public
 */
export function fmtRegistrationNumber(publicPart: string | null): string {
  if (publicPart === null) return DASH;
  const v = publicPart.trim();
  if (v === "") return DASH;
  const m = SECRET_SUFFIX.exec(v);
  if (m === null) return v;
  countI18n("registration_secret_refused");
  return m[1] ?? DASH;
}
