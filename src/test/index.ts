// `@rootxkit/uspace-ui/test`: helpers for unit and browser tests (PLAN §3.18).
// Imported by tests only; needs @testing-library/react and
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
