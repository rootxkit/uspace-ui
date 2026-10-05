"use client";
// I18nProvider, useT and useLang (docs/PLAN.md §3.4). The language comes
// from the app (negotiated on the server from the `uspace_lang` cookie and
// Accept-Language); `setLang` switches it on the page and hands the choice
// to the app, which persists it. The kit never writes the cookie.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Lang } from "./lang.js";
import {
  createTranslator,
  type Catalogues,
  type Translate,
} from "./translate.js";

/** @beta */
export interface I18nContextValue {
  lang: Lang;
  setLang(l: Lang): void;
  t: Translate;
  /** The app's catalogues, as given to the provider. */
  catalogues: Catalogues;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** @public */
export interface I18nProviderProps {
  /** The language to show; a change of this prop is followed. */
  lang: Lang;
  /** The app's own keys; the app wins over the kit on a duplicate key. */
  catalogues?: Catalogues;
  /** Called by `setLang`, so the app can write the `uspace_lang` cookie. */
  onLangChange?(l: Lang): void;
  children?: ReactNode;
}

const NO_CATALOGUES: Catalogues = {};

/** @public */
export function I18nProvider(props: I18nProviderProps) {
  const { onLangChange, children } = props;
  const catalogues = props.catalogues ?? NO_CATALOGUES;
  // A language chosen with setLang holds until the prop itself changes;
  // a changed prop replaces it (state adjusted during render, React's
  // pattern for state derived from a prop).
  const [chosen, setChosen] = useState(props.lang);
  const [prop, setProp] = useState(props.lang);
  if (prop !== props.lang) {
    setProp(props.lang);
    setChosen(props.lang);
  }
  const lang = prop === props.lang ? chosen : props.lang;
  const setLang = useCallback(
    (l: Lang) => {
      setChosen(l);
      onLangChange?.(l);
    },
    [onLangChange],
  );
  const t = useMemo(
    () => createTranslator(lang, catalogues),
    [lang, catalogues],
  );
  const value = useMemo(
    () => ({ lang, setLang, t, catalogues }),
    [lang, setLang, t, catalogues],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(hook: string): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx === null) throw new Error(`${hook}() needs an <I18nProvider>`);
  return ctx;
}

/**
 * The translator of the enclosing I18nProvider.
 *
 * @public
 */
export function useT(): Translate {
  return useI18n("useT").t;
}

/** @public */
export function useLang(): { lang: Lang; setLang(l: Lang): void } {
  const { lang, setLang } = useI18n("useLang");
  return { lang, setLang };
}

/**
 * The enclosing provider's value, or null outside one.
 *
 * @beta
 */
export function useOptionalI18n(): I18nContextValue | null {
  return useContext(I18nContext);
}

/**
 * A translator for an explicit language, with the enclosing provider's
 * app catalogues when there is one. For components that take their own
 * `lang` prop (MapView), so they work with or without a provider.
 *
 * @beta
 */
export function useTFor(lang: Lang): Translate {
  const catalogues = useContext(I18nContext)?.catalogues ?? NO_CATALOGUES;
  return useMemo(() => createTranslator(lang, catalogues), [lang, catalogues]);
}
