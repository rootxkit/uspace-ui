// The status tones of the console frame (1.1.0): what a StatTile, a
// StatusBadge or the top bar's status pill is coloured by. A tone repeats
// a status the text already states; it never stands alone (WCAG 1.4.1),
// and it is not a legend colour: severity, trust, identification, zone
// and age keep their own palettes (styles/tokens.css). Names, never
// colours: the values live in styles/tokens.css per scheme, and
// src/theme/tokens.test.ts checks their contrast.

/**
 * The tones, from good to bad, then the one that says nothing.
 *
 * @public
 */
export const STATUS_TONES = [
  "ok",
  "info",
  "warning",
  "critical",
  "neutral",
] as const;

/** @public */
export type StatusTone = (typeof STATUS_TONES)[number];

/**
 * The CSS variables of one tone: the text and mark colour, the tint it
 * sits on, and the tint's border.
 *
 * @public
 */
export interface StatusToneTokens {
  fg: string;
  soft: string;
  border: string;
}

/** @public */
export const statusTokens: Readonly<Record<StatusTone, StatusToneTokens>> =
  Object.freeze(
    Object.fromEntries(
      STATUS_TONES.map((tone) => [
        tone,
        Object.freeze({
          fg: `--us-status-${tone}`,
          soft: `--us-status-${tone}-soft`,
          border: `--us-status-${tone}-border`,
        }),
      ]),
    ) as Record<StatusTone, StatusToneTokens>,
  );
