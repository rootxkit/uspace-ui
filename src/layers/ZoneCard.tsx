"use client";
// The hover card of a zone or a restriction (docs/PLAN.md §3.9; WP-6): what
// the API said about the feature, with nothing worked out here. Limits
// carry their reference and unit (E-13); the applicability line is the
// server's statement, shown only when it made one (`applies` null: no
// line, never a guess); version and update time are shown wherever a zone
// is (Regulation (EU) 2021/664 Art. 9(2)), so a stale picture is visibly
// stale.
import type { ReactNode } from "react";

import { useTFor } from "../i18n/I18nProvider.js";
import { fmtAltitude, fmtTimeUTC } from "../i18n/format.js";
import type { Lang } from "../i18n/lang.js";
import type { ZoneView } from "../model/index.js";
import { RESTRICTION_STATE_KEYS } from "../symbology/restriction.js";
import { ZONE_TYPE_KEYS, zoneToken } from "../symbology/zone.js";
import { cn } from "../ui/cn.js";

/**
 * A restriction (reason DAR, spec 02 F2) as a zone view plus the times the
 * API spelled `starts_at` and `ends_at`. They are optional so a plain
 * `ZoneView[]` is accepted; an absent time shows as a dash.
 *
 * @public
 */
export interface RestrictionView extends ZoneView {
  startsAt?: string | null;
  endsAt?: string | null;
}

/** @beta */
export interface ZoneCardProps {
  zone: RestrictionView;
  lang: Lang;
  /** Adds the restriction rows: state, start and end. */
  restriction?: boolean;
  className?: string;
}

function Row(props: { label: string; children: ReactNode; field: string }) {
  return (
    <div className="flex gap-2" data-field={props.field}>
      <dt className="shrink-0 text-muted-foreground">{props.label}</dt>
      <dd className="m-0 font-medium">{props.children}</dd>
    </div>
  );
}

/** @beta */
export function ZoneCard(props: ZoneCardProps) {
  const { zone, lang, restriction = false, className } = props;
  const t = useTFor(lang);
  return (
    <div
      className={cn(
        "us-zone-card max-w-xs rounded-md border border-l-4 border-border bg-popover p-2 text-xs text-popover-foreground shadow-md",
        className,
      )}
      data-zone-type={zone.type}
      style={{ borderLeftColor: `var(${zoneToken(zone.type)})` }}
    >
      <p className="m-0 mb-1 text-sm font-semibold">
        {zone.name ?? t("zone.card.unnamed")}
      </p>
      <dl className="m-0 grid gap-0.5">
        <Row field="identifier" label={t("zone.card.identifier")}>
          {zone.identifier}
        </Row>
        <Row field="type" label={t("zone.card.type")}>
          {t(ZONE_TYPE_KEYS[zone.type])}
        </Row>
        {restriction && (
          <>
            <Row field="state" label={t("restriction.card.state")}>
              {t(RESTRICTION_STATE_KEYS[zone.restrictionState ?? "unstated"])}
            </Row>
            <Row field="starts" label={t("restriction.card.starts")}>
              {fmtTimeUTC(zone.startsAt ?? null, lang)}
            </Row>
            <Row field="ends" label={t("restriction.card.ends")}>
              {fmtTimeUTC(zone.endsAt ?? null, lang)}
            </Row>
          </>
        )}
        <Row field="lower" label={t("zone.card.lower")}>
          {fmtAltitude(zone.lowerLimitM, zone.lowerRef, lang)}
        </Row>
        <Row field="upper" label={t("zone.card.upper")}>
          {fmtAltitude(zone.upperLimitM, zone.upperRef, lang)}
        </Row>
        {zone.message !== null && (
          <Row field="message" label={t("zone.card.message")}>
            {zone.message}
          </Row>
        )}
        {zone.applies !== null && (
          <Row field="applicability" label={t("zone.card.applicability")}>
            {t(
              zone.applies
                ? "zone.applicability.applies"
                : "zone.applicability.not_applicable",
            )}
          </Row>
        )}
        <Row field="version" label={t("zone.card.version")}>
          {zone.version ?? t("common.dash")}
        </Row>
        <Row field="updated" label={t("zone.card.updated")}>
          {fmtTimeUTC(zone.updatedAt, lang)}
        </Row>
      </dl>
    </div>
  );
}
