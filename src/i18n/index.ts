// `@rootxkit/uspace-ui/i18n` (docs/PLAN.md §3.4, WP-2): the ka and en
// catalogues, the provider and translator, language negotiation and the
// display formatters.
export {
  i18nCounters,
  missingKeys,
  resetI18nCounters,
  type I18nCounter,
} from "./counters.js";
export { en, type Key } from "./en.js";
export {
  I18nProvider,
  useLang,
  useOptionalI18n,
  useT,
  useTFor,
  type I18nContextValue,
  type I18nProviderProps,
} from "./I18nProvider.js";
export { ka } from "./ka.js";
export {
  DEFAULT_LANG,
  LANG_COOKIE,
  LANGS,
  LOCALES,
  langFromAcceptLanguage,
  langFromCookie,
  negotiateLang,
  parseLang,
  type Lang,
} from "./lang.js";
export {
  KIT_CATALOGUES,
  createTranslator,
  interpolate,
  type Catalogue,
  type Catalogues,
  type Translate,
  type Vars,
} from "./translate.js";
