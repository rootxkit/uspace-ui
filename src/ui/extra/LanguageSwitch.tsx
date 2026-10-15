"use client";
import type { ReactNode } from "react";

import { useLang, useT } from "../../i18n/I18nProvider.js";
import { LANGS, type Lang } from "../../i18n/lang.js";
import { cn } from "../cn.js";

// Each language named in itself, so a reader of either finds theirs.
const ENDONYM = {
  en: "lang.endonym.en",
  ka: "lang.endonym.ka",
} as const satisfies Record<Lang, string>;

/** @public */
export interface LanguageSwitchProps {
  className?: string;
}

/**
 * The `ka`/`en` switch of the top bar: a pressed button per language,
 * each named in its own language. It calls the provider's `setLang`; the
 * app persists the choice (its `onLangChange` writes the cookie).
 *
 * @public
 */
export function LanguageSwitch(props: LanguageSwitchProps): ReactNode {
  const t = useT();
  const { lang, setLang } = useLang();
  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      data-slot="language-switch"
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-md border border-border bg-surface-sunken p-0.5",
        props.className,
      )}
    >
      {LANGS.map((l) => {
        const pressed = l === lang;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={pressed}
            onClick={() => {
              if (!pressed) setLang(l);
            }}
            className={cn(
              "inline-flex h-full items-center rounded-[calc(var(--radius)-3px)] px-2.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              pressed
                ? "bg-card text-foreground shadow-panel"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(ENDONYM[l])}
          </button>
        );
      })}
    </div>
  );
}
