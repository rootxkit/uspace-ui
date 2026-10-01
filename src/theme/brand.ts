// Branding from configuration (docs/PLAN.md §3.2, §6.3; spec 06 §4
// "Branding is configuration"). Nothing here names an organisation: the
// only default is the role word "U-space", and every other field is null
// until a deployment sets it.

export interface Brand {
  name: string;
  shortName: string;
  logoUrl: string | null;
  contact: string | null;
  /** A hex colour; ThemeProvider writes it to `--us-brand-accent`. */
  accent: string | null;
}

/** The fallback name: the role, not an organisation (PLAN §14 Q10). */
export const BRAND_FALLBACK_NAME = "U-space";

export const BRAND_ENV_PREFIX = "UI_BRAND_";

// #rgb, #rgba, #rrggbb or #rrggbbaa. Anything else is refused rather than
// written into a style property.
const HEX_COLOUR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function value(
  env: Record<string, string | undefined>,
  key: string,
): string | null {
  const v = env[key]?.trim();
  return v === undefined || v === "" ? null : v;
}

/**
 * Reads `<prefix>NAME`, `SHORT_NAME`, `LOGO_URL`, `CONTACT` and `ACCENT`.
 * A missing name is "U-space"; a missing short name is the name. An accent
 * that is not a hex colour throws, naming the variable: a misconfigured
 * deployment fails at start rather than rendering an unbranded console
 * that looks configured.
 */
export function brandFromEnv(
  env: Record<string, string | undefined>,
  prefix: string = BRAND_ENV_PREFIX,
): Brand {
  const name = value(env, `${prefix}NAME`) ?? BRAND_FALLBACK_NAME;
  const accent = value(env, `${prefix}ACCENT`);
  if (accent !== null && !HEX_COLOUR.test(accent)) {
    throw new Error(
      `${prefix}ACCENT must be a hex colour such as #1f5fc4, got "${accent}"`,
    );
  }
  return {
    name,
    shortName: value(env, `${prefix}SHORT_NAME`) ?? name,
    logoUrl: value(env, `${prefix}LOGO_URL`),
    contact: value(env, `${prefix}CONTACT`),
    accent,
  };
}
