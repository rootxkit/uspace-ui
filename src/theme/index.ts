// `@rootxkit/uspace-ui/theme` (docs/PLAN.md §3.2, WP-1): tokens, the
// ThemeProvider, branding from configuration, the colour scheme.
export {
  BRAND_ENV_PREFIX,
  BRAND_FALLBACK_NAME,
  brandFromEnv,
  type Brand,
} from "./brand.js";
export {
  COLOR_SCHEMES,
  DARK_QUERY,
  SCHEME_COOKIE,
  parseScheme,
  schemeFromCookie,
  type ColorScheme,
  type ResolvedScheme,
} from "./scheme.js";
export {
  ThemeProvider,
  useOptionalTheme,
  useTheme,
  type ThemeContextValue,
  type ThemeProviderProps,
} from "./ThemeProvider.js";
export { AGE_BUCKETS, tokens, type AgeBucket, type Tokens } from "./tokens.js";
