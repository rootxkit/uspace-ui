"use client";

// The dashboard: every component of the kit's console frame on one page,
// over the demo data of src/dashboard/demo.ts and the stub API's zones.
// PageHeader with its trail and actions; a KpiRow of StatTiles (an unknown
// value is a dash, never a zero); the MapPanel around the MapView with
// the zone legend laid over it; the AlertList as the alert feed; the
// DataTable in a Panel; StatusBadges; the FeedStatusBar; an EmptyState.
// The page shows what it was given and judges nothing.
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertList } from "@rootxkit/uspace-ui/alerts";
import { fmtAge, fmtTimeUTC, useLang, useT } from "@rootxkit/uspace-ui/i18n";
import { ZoneLayer } from "@rootxkit/uspace-ui/layers";
import { ZoneLegend } from "@rootxkit/uspace-ui/legend";
import { MapControls, MapView } from "@rootxkit/uspace-ui/map";
import { FeedStatusBar } from "@rootxkit/uspace-ui/status";
import {
  DataTable,
  columnsFor,
  kitColumnMeta,
  tableColumn,
  type TableColumn,
} from "@rootxkit/uspace-ui/table";
import { STATUS_TONES, useTheme } from "@rootxkit/uspace-ui/theme";
import {
  Button,
  EmptyState,
  KpiRow,
  MapPanel,
  PageHeader,
  Panel,
  StatTile,
  StatusBadge,
} from "@rootxkit/uspace-ui/ui";
import { MAP_INITIAL } from "../config";
import {
  DEMO_ALERTS,
  DEMO_FEED,
  DEMO_NOW,
  DEMO_NOW_MS,
  DEMO_REGISTRY,
  DEMO_SOURCES,
  REG_TONE,
  SOURCE_TONE,
  type RegistryRow,
} from "../dashboard/demo";
import { useOrigin, useZones } from "../map/useZones";
import {
  AircraftIcon,
  AlertIcon,
  HeightIcon,
  InboxIcon,
  SourceIcon,
  ZoneIcon,
} from "./icons";

function registryColumns(
  t: ReturnType<typeof useT>,
): TableColumn<RegistryRow>[] {
  const c = columnsFor<RegistryRow>();
  return [
    c.text("regNumber", { headerKey: "example.dash.reg_number", mono: true }),
    c.text("serial", { headerKey: "example.dash.serial", mono: true }),
    tableColumn<RegistryRow, string>({
      id: "status",
      accessorFn: (r) => r.status,
      meta: kitColumnMeta({ headerKey: "example.dash.status" }),
      cell: (ctx) => {
        const s = ctx.row.original.status;
        return (
          <StatusBadge tone={REG_TONE[s]}>
            {t(`example.dash.reg_status.${s}`)}
          </StatusBadge>
        );
      },
    }),
    c.utc("updatedAt", { headerKey: "example.dash.updated" }),
  ];
}

export function DashboardPage() {
  const t = useT();
  const { lang } = useLang();
  const { resolved } = useTheme();
  const origin = useOrigin();
  const { loaded, zones, counts } = useZones();
  const [zonesVisible, setZonesVisible] = useState(true);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const columns = useMemo(() => registryColumns(t), [t]);
  const asOf = t("example.dash.as_of", {
    time: fmtTimeUTC(DEMO_NOW, lang, { seconds: true }),
  });
  const open = DEMO_ALERTS.filter((a) => a.state !== "cleared").length;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: t("example.nav.console"), href: "/dashboard" },
          { label: t("example.nav.dashboard") },
        ]}
        renderLink={(p) => <Link {...p} />}
        title={t("example.dash.title")}
        description={t("example.dash.description")}
        meta={
          <StatusBadge tone="neutral" variant="outline">
            {t("example.dash.demo")}
          </StatusBadge>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/">{t("example.dash.open_map")}</Link>
          </Button>
        }
      />

      <KpiRow label={t("example.dash.kpis")}>
        <StatTile
          icon={<AircraftIcon />}
          label={t("example.dash.tracks")}
          value={27}
          status={{ tone: "ok", label: t("example.dash.tracks_status") }}
          trend={{ direction: "up", label: t("example.dash.tracks_trend") }}
          hint={asOf}
        />
        <StatTile
          icon={<AlertIcon />}
          label={t("example.dash.alerts")}
          value={open}
          status={{ tone: "critical", label: t("example.dash.alerts_status") }}
          trend={{
            direction: "up",
            tone: "critical",
            label: t("example.dash.alerts_trend"),
          }}
          hint={asOf}
        />
        <StatTile
          icon={<ZoneIcon />}
          label={t("example.dash.zones")}
          value={loaded.state === "ok" ? zones.length : null}
          status={{ tone: "info", label: t("example.dash.zones_status") }}
          hint={asOf}
        />
        <StatTile
          icon={<SourceIcon />}
          label={t("example.dash.sources")}
          value={t("example.dash.sources_value")}
          status={{
            tone: "warning",
            label: t("example.dash.sources_status"),
          }}
          hint={asOf}
        />
        <StatTile
          icon={<HeightIcon />}
          label={t("example.dash.max_height")}
          value={null}
          unit={t("unit.symbol.m_agl")}
          hint={t("example.dash.max_height_hint")}
        />
      </KpiRow>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <MapPanel
          title={t("example.dash.map_title")}
          description={t("example.dash.map_description")}
          legend={<ZoneLegend counts={counts} />}
          mapClassName="h-[30rem]"
        >
          <div className="absolute inset-0">
            {origin !== null && (
              <MapView
                basemap={{ baseUrl: origin }}
                initial={MAP_INITIAL}
                lang={lang}
                scheme={resolved}
              >
                <ZoneLayer
                  zones={zones}
                  visible={zonesVisible}
                  selectedId={selectedZone}
                  onSelect={setSelectedZone}
                />
                <MapControls
                  layers={[
                    {
                      id: "zones",
                      labelKey: "example.map.heading",
                      visible: zonesVisible,
                      onChange: setZonesVisible,
                    },
                  ]}
                />
              </MapView>
            )}
          </div>
        </MapPanel>
        <Panel
          title={t("example.dash.alerts_title")}
          description={t("example.dash.alerts_description")}
          actions={
            <StatusBadge tone="critical">
              {t("example.dash.alerts_status")}
            </StatusBadge>
          }
        >
          <AlertList
            alerts={DEMO_ALERTS}
            nowMs={DEMO_NOW_MS}
            canAcknowledge={false}
          />
        </Panel>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Panel
          title={t("example.dash.registry_title")}
          description={t("example.dash.registry_description")}
        >
          <DataTable<RegistryRow>
            caption={t("example.dash.registry_caption")}
            captionHidden
            columns={columns}
            rows={DEMO_REGISTRY}
            getRowId={(r) => r.id}
            empty={<p className="m-0">{t("example.dash.registry_empty")}</p>}
            dense
          />
        </Panel>
        <div className="grid content-start gap-6">
          <Panel
            title={t("example.dash.sources_title")}
            description={t("example.dash.sources_description")}
            footer={<FeedStatusBar status={DEMO_FEED} nowMs={DEMO_NOW_MS} />}
          >
            <ul className="m-0 grid list-none gap-0 p-0">
              {DEMO_SOURCES.map((s) => (
                <li
                  key={s.key}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border py-2 text-sm last:border-b-0"
                >
                  <span className="font-semibold">
                    {t(`example.dash.source.${s.key}`)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t("age.ago", { age: fmtAge(s.ageS, lang) })}
                    </span>
                    <StatusBadge tone={SOURCE_TONE[s.state]}>
                      {t(`example.dash.state.${s.state}`)}
                    </StatusBadge>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={t("example.dash.restrictions_title")}>
            <EmptyState
              icon={<InboxIcon />}
              title={t("example.dash.restrictions_empty")}
              description={t("example.dash.restrictions_empty_detail")}
            />
          </Panel>
          <Panel title={t("example.dash.tones_title")}>
            <div className="flex flex-wrap gap-2">
              {STATUS_TONES.map((tone) => (
                <StatusBadge key={tone} tone={tone}>
                  {t(`example.dash.tone.${tone}`)}
                </StatusBadge>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
