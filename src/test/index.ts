// `@rootxkit/uspace-ui/test`: helpers for unit and browser tests (PLAN §3.18).
// Imported by tests only; needs @testing-library/react and
// axe-core, which are optional peers.
export { axeCheck, WCAG_22_AA_TAGS } from "./axe.js";
export { fixtures, type Fixtures, type FixturesOptions } from "./fixtures.js";
export {
  LAB_COMMIT,
  labDecodings,
  labFixtures,
  type LabDecoding,
} from "./labFixtures.js";
// The reference adapters (WP-14): examples of what a web/ writes once,
// from its generated types to the kit's view models.
export { adaptAlert } from "./adapters/alert.js";
export {
  AdapterRefusal,
  adapted,
  refused,
  unwrap,
  type Adapted,
} from "./adapters/result.js";
export {
  adaptSource,
  adaptSourceFrame,
  adaptStatus,
} from "./adapters/status.js";
export { adaptManned, adaptTelemetry, timesOf } from "./adapters/track.js";
export {
  adaptApplicability,
  adaptCisChange,
  adaptEd318Collection,
  adaptEd318Feature,
  type CisChange,
} from "./adapters/zone.js";
export {
  renderWithKit,
  TEST_BRAND,
  type KitBrand,
  type KitLang,
  type KitScheme,
  type RenderWithKitOptions,
} from "./render.js";
