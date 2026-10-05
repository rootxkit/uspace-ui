// The words of the status components (docs/PLAN.md §3.12, WP-8), as
// catalogue keys so both languages carry them (CLAUDE.md rule 5): every
// source state, every way of being disabled, the degraded keys the spec
// names (02 F5 `degraded: [manned, dss]`, and the lab's examples), and
// the connection states. None says "lost" (C-12, B-04).
import type { Key } from "../i18n/en.js";
import type { Translate } from "../i18n/translate.js";
import type { DisabledBy, FeedStatus, SourceState } from "../model/index.js";

/** @public */
export const SOURCE_STATE_KEYS: Readonly<Record<SourceState, Key>> =
  Object.freeze({
    disabled: "source.state.disabled",
    healthy: "source.state.healthy",
    stale: "source.state.stale",
    lagging: "source.state.lagging",
    unreachable: "source.state.unreachable",
    never_heard: "source.state.never_heard",
  });

/** @beta */
export const DISABLED_BY_KEYS: Readonly<Record<DisabledBy, Key>> =
  Object.freeze({
    type: "source.disabled_by.type",
    instance: "source.disabled_by.instance",
    default_deny: "source.disabled_by.default_deny",
  });

/**
 * The degraded keys the kit has words for; any other is shown as sent.
 *
 * @beta
 */
export const DEGRADED_KEYS: Readonly<Record<string, Key>> = Object.freeze({
  manned: "degraded.manned",
  dss: "degraded.dss",
  source_disabled: "degraded.source_disabled",
  publisher_stale: "degraded.publisher_stale",
});

/** @beta */
export const CONNECTION_KEYS: Readonly<Record<FeedStatus["connection"], Key>> =
  Object.freeze({
    connecting: "feed.connecting",
    live: "feed.live",
    down: "feed.down_retrying",
  });

/**
 * One degraded entry in words: ours for a known key, the server's otherwise.
 *
 * @public
 */
export function degradedLabel(slug: string, t: Translate): string {
  const key = Object.hasOwn(DEGRADED_KEYS, slug)
    ? DEGRADED_KEYS[slug]
    : undefined;
  return key === undefined ? t("degraded.other", { slug }) : t(key);
}
