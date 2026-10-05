// The translator behind `useT` (docs/PLAN.md §3.4): the app's catalogue,
// then the kit's, in the chosen language, then in English; `{name}`
// interpolation; plurals by `_one` / `_other` suffix chosen by `count`.
// Pure, so non-React code (the basemap style, the formatters) uses it too.
import { countI18n } from "./counters.js";
import { en } from "./en.js";
import { ka } from "./ka.js";
import { LOCALES, type Lang } from "./lang.js";

/**
 * Keys are the kit's or the app's; values are the display text.
 *
 * @public
 */
export type Catalogue = Readonly<Record<string, string>>;
/** @public */
export type Catalogues = Partial<Record<Lang, Catalogue>>;
/** @public */
export type Vars = Readonly<Record<string, string | number>>;
/** @public */
export type Translate = (key: string, vars?: Vars) => string;

/** @beta */
export const KIT_CATALOGUES: Readonly<Record<Lang, Catalogue>> = { en, ka };

/**
 * `template` with each `{name}` replaced by `vars[name]`. A placeholder
 * without a value stays as written, so the gap is visible.
 *
 * @public
 */
export function interpolate(template: string, vars?: Vars): string {
  if (vars === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : whole,
  );
}

const pluralRules = new Map<Lang, Intl.PluralRules>();

function pluralForm(lang: Lang, count: number): string {
  let rules = pluralRules.get(lang);
  if (rules === undefined) {
    rules = new Intl.PluralRules(LOCALES[lang]);
    pluralRules.set(lang, rules);
  }
  return rules.select(count);
}

/**
 * A translator for `lang` over the kit's catalogues and, ahead of them,
 * `catalogues` (the app wins on a duplicate key). A key missing in `ka`
 * shows the `en` text, and a key missing in both shows the key; both are
 * counted (`missingKeys()`).
 *
 * @public
 */
export function createTranslator(
  lang: Lang,
  catalogues: Catalogues = {},
): Translate {
  const find = (l: Lang, key: string): string | undefined => {
    const app = catalogues[l];
    if (app !== undefined && Object.hasOwn(app, key)) return app[key];
    const kit = KIT_CATALOGUES[l];
    return Object.hasOwn(kit, key) ? kit[key] : undefined;
  };
  return (key, vars) => {
    const count = vars?.["count"];
    const candidates =
      typeof count === "number"
        ? [`${key}_${pluralForm(lang, count)}`, `${key}_other`, key]
        : [key];
    for (const c of candidates) {
      const hit = find(lang, c);
      if (hit !== undefined) return interpolate(hit, vars);
    }
    if (lang !== "en") {
      for (const c of candidates) {
        const hit = find("en", c);
        if (hit === undefined) continue;
        countI18n("missing_ka");
        return interpolate(hit, vars);
      }
    }
    countI18n("missing_key");
    return key;
  };
}
