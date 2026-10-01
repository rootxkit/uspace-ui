// The same paragraph in each language, set in the kit's font stack
// (fonts/fonts.css): a heading upper-cased by CSS, the same words in
// Mtavruli, body text from the catalogue, and the formatters' datum and
// time wording.
import {
  fmtAltitude,
  fmtHeight,
  fmtTimeUTC,
  useLang,
  useT,
} from "../../src/i18n/index.js";

// Story-only sample values.
const SAMPLE = {
  altAmslM: 612,
  heightM: 48,
  capturedAt: "2026-10-02T14:03:27Z",
};

export function Typography() {
  const t = useT();
  const { lang } = useLang();
  return (
    <article lang={lang} className="max-w-prose space-y-3">
      <h2 className="text-xl font-bold uppercase" data-testid="upper">
        {t("track.broadcast")}
      </h2>
      {/* Chromium leaves Georgian alone under text-transform: uppercase,
          so Mtavruli is shown as upper-cased text (Unicode case mapping). */}
      <p className="font-bold" data-testid="mtavruli">
        {t("track.broadcast").toLocaleUpperCase(lang)}
      </p>
      <p data-testid="body">{t("track.broadcast_caveat")}</p>
      <ul className="list-disc pl-6">
        <li>{fmtAltitude(SAMPLE.altAmslM, "AMSL", lang)}</li>
        <li>{fmtAltitude(SAMPLE.altAmslM, "pressure", lang)}</li>
        <li>{fmtHeight(SAMPLE.heightM, "TakeoffLocation", lang)}</li>
        <li>{fmtTimeUTC(SAMPLE.capturedAt, lang, { seconds: true })}</li>
      </ul>
      <p className="font-bold">{t("source.state.unreachable")}</p>
    </article>
  );
}
