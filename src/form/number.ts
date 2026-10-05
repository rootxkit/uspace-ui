// Numbers typed by a person, in their language (docs/PLAN.md §3.15): `ka`
// writes a decimal comma ("1,5"), `en` a decimal point ("1.5"). Display
// only: the value stored is a JavaScript number, `null` when the box is
// empty (never `0`, CLAUDE.md rule 6), and `NaN` when the text is not a
// number, which the schema refuses as "not a number". A group separator
// is accepted only where it groups thousands, so "1,5" in `en` is refused
// instead of being read as fifteen.
import { LOCALES, type Lang } from "../i18n/lang.js";

interface Symbols {
  decimal: string;
  group: string;
}

const symbols = new Map<Lang, Symbols>();

function symbolsOf(lang: Lang): Symbols {
  let s = symbols.get(lang);
  if (s === undefined) {
    const parts = new Intl.NumberFormat(LOCALES[lang]).formatToParts(12345.6);
    s = {
      decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
      group: parts.find((p) => p.type === "group")?.value ?? ",",
    };
    symbols.set(lang, s);
  }
  return s;
}

const SPACES = /[\s  ]/g;
const escape = (c: string): string => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The number in `text` as typed in `lang`: `null` for an empty box, `NaN`
 * for text that is not a number in that language.
 *
 * @beta
 */
export function parseLocaleNumber(text: string, lang: Lang): number | null {
  const raw = text.trim();
  if (raw === "") return null;
  const { decimal, group } = symbolsOf(lang);
  const groupIsSpace = group.replace(SPACES, "") === "";
  let s = raw.replace(/^[−]/, "-");
  if (groupIsSpace) s = s.replace(SPACES, "");
  const g = groupIsSpace ? null : escape(group);
  const d = escape(decimal);
  const intPart = g === null ? "\\d+" : `(?:\\d{1,3}(?:${g}\\d{3})+|\\d+)`;
  // The locale's decimal sign; a decimal point is also read where it is
  // not the group sign (a `ka` keyboard often types one).
  const decimals = decimal === "." || group === "." ? d : `(?:${d}|\\.)`;
  const re = new RegExp(`^([+-]?)(${intPart})(?:${decimals}(\\d+))?$`);
  const m = re.exec(s);
  if (m === null) return Number.NaN;
  const digits = m[2] ?? "";
  const int = groupIsSpace ? digits : digits.split(group).join("");
  const frac = m[3] === undefined ? "" : `.${m[3]}`;
  return Number(`${m[1] ?? ""}${int}${frac}`);
}

const formats = new Map<Lang, Intl.NumberFormat>();

/**
 * A stored number as the text the box shows in `lang`; "" for null.
 *
 * @beta
 */
export function formatLocaleNumber(v: number | null, lang: Lang): string {
  if (v === null || !Number.isFinite(v)) return "";
  let nf = formats.get(lang);
  if (nf === undefined) {
    nf = new Intl.NumberFormat(LOCALES[lang], {
      useGrouping: false,
      maximumFractionDigits: 20,
    });
    formats.set(lang, nf);
  }
  return nf.format(v);
}
