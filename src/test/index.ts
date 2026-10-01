// `@rootxkit/uspace-ui/test`: helpers for tests and stories (PLAN §3.18).
// Imported by tests and stories only; needs @testing-library/react and
// axe-core, which are optional peers.
export { axeCheck, WCAG_22_AA_TAGS } from "./axe.js";
export { fixtures, type Fixtures } from "./fixtures.js";
export {
  renderWithKit,
  TEST_BRAND,
  type KitBrand,
  type KitLang,
  type KitScheme,
  type RenderWithKitOptions,
} from "./render.js";
