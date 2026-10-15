// The console frame of 1.1.0 in Chromium, in both languages and both
// schemes (light in English, dark in Georgian): AppShell with every slot,
// PageHeader, a KpiRow of StatTiles, Panels with an AlertList, the
// DataTable and an EmptyState, StatusBadges of every tone and the
// MapPanel with a legend over its map. browser/setup.ts runs axe (WCAG
// 2.2 AA) after every test, in the state the test leaves: the user menu
// open, the sidebar collapsed, the sheet open on a narrow screen.
import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import { AlertList } from "../../src/alerts/index.js";
import { NOW_MS } from "../../src/alerts/fixtures.testing.js";
import { useT } from "../../src/i18n/index.js";
import { ZoneLegend } from "../../src/legend/index.js";
import type { AlertView } from "../../src/model/index.js";
import { FeedStatusBar } from "../../src/status/index.js";
import { STATUS_TONES } from "../../src/theme/index.js";
import {
  AppShell,
  DropdownMenuItem,
  EmptyState,
  KpiRow,
  MapPanel,
  PageHeader,
  Panel,
  StatTile,
  StatusBadge,
  StatusPill,
  UserMenu,
} from "../../src/ui/index.js";
import { LOOKS, lookName, pageBody, renderKit, type Look } from "../kit.js";

// The test page's words, per language: the app's text, never the kit's.
const TEXT = {
  en: {
    console: "Console",
    dashboard: "Dashboard",
    map: "Zone map",
    training: "Training",
    title: "Operations overview",
    tracks: "Tracks in view",
    alerts: "Alerts",
    restrictions: "No restriction is active",
    signOut: "Sign out",
    tone: "Tone",
    airspace: "Airspace",
  },
  ka: {
    console: "კონსოლი",
    dashboard: "მიმოხილვა",
    map: "ზონების რუკა",
    training: "სასწავლო",
    title: "ოპერაციების მიმოხილვა",
    tracks: "ტრეკები ხედში",
    alerts: "განგაშები",
    restrictions: "აქტიური შეზღუდვა არ არის",
    signOut: "გასვლა",
    tone: "ტონი",
    airspace: "საჰაერო სივრცე",
  },
} as const;

const ALERT: AlertView = {
  alertId: "TEST-ALERT-0001",
  kind: "proximity",
  severity: "critical",
  state: "raised",
  clearReason: null,
  aircraft: ["TEST-TRK-0001"],
  peerTrackId: "TEST-TRK-0002",
  detail: {
    t_cpa_s: 42,
    d_cpa_h_m: 120,
    d_alt_m: 15,
    peer: { track_id: "TEST-TRK-0002", trust: "broadcast" },
  },
  capturedAt: "2026-10-02T09:15:02Z",
  raisedAt: "2026-10-02T09:15:02Z",
  policyVersion: "TEST-POLICY-1",
  acknowledged: false,
  receivedAtMs: NOW_MS - 3000,
};

function Frame(props: { look: Look }) {
  const w = TEXT[props.look.lang];
  const t = useT();
  return (
    <AppShell
      systemName="U-space"
      nav={[
        {
          id: "console",
          label: w.console,
          items: [
            { id: "dash", label: w.dashboard, href: "#dash", active: true },
            { id: "map", label: w.map, href: "#map", badge: "5" },
          ],
        },
      ]}
      environment={{ name: w.training, tone: "info" }}
      status={<StatusPill state="live" ageS={2} />}
      user={
        <UserMenu name="TEST-account-0001" detail="viewer">
          <DropdownMenuItem>{w.signOut}</DropdownMenuItem>
        </UserMenu>
      }
      className="min-h-0"
    >
      <div className="grid gap-4 p-4">
        <PageHeader
          title={w.title}
          breadcrumbs={[{ label: w.console, href: "#" }, { label: w.title }]}
          meta={<StatusBadge tone="neutral">{w.training}</StatusBadge>}
        />
        <KpiRow label={w.title}>
          <StatTile
            label={w.tracks}
            value={27}
            status={{ tone: "ok", label: t("feed.live") }}
            trend={{ direction: "up", label: "+4" }}
          />
          <StatTile
            label={w.alerts}
            value={1}
            status={{ tone: "critical", label: "1" }}
            trend={{ direction: "up", label: "+1", tone: "critical" }}
          />
          <StatTile label={w.tracks} value={null} unit="m AGL" hint="—" />
        </KpiRow>
        <Panel
          title={w.alerts}
          actions={<StatusBadge tone="critical">1</StatusBadge>}
        >
          <AlertList alerts={[ALERT]} nowMs={NOW_MS} canAcknowledge={false} />
        </Panel>
        <Panel
          title={w.tone}
          footer={
            <FeedStatusBar
              status={{
                connection: "live",
                sinceMs: NOW_MS - 60000,
                droppedFrames: 0,
                degraded: [],
                policyVersion: "TEST-POLICY-1",
                staleAfterS: 10,
                liveMaxAgeS: 5,
                serverTs: null,
                lastFrameAtMs: NOW_MS - 1000,
              }}
              nowMs={NOW_MS}
            />
          }
        >
          <div className="flex flex-wrap gap-2">
            {STATUS_TONES.map((tone) => (
              <StatusBadge key={tone} tone={tone}>
                {tone}
              </StatusBadge>
            ))}
            {STATUS_TONES.map((tone) => (
              <StatusBadge key={`o-${tone}`} tone={tone} variant="outline">
                {tone}
              </StatusBadge>
            ))}
          </div>
          <EmptyState title={w.restrictions} className="mt-3" />
        </Panel>
        <MapPanel
          title={w.airspace}
          legend={<ZoneLegend counts={{ PROHIBITED: 1 }} />}
          mapClassName="h-64"
        >
          <div className="absolute inset-0 bg-surface-sunken" />
        </MapPanel>
      </div>
    </AppShell>
  );
}

describe.each(LOOKS)("console frame, %s", (look) => {
  const name = lookName(look);
  const w = TEXT[look.lang];

  it(`renders every part (${name})`, async () => {
    await page.viewport(1280, 900);
    const view = renderKit(<Frame look={look} />, look);
    const c = within(view.container);
    expect(c.getByRole("main")).toBeVisible();
    const nav = c.getByRole("navigation", {
      name: look.lang === "ka" ? "მთავარი ნავიგაცია" : "Main navigation",
    });
    expect(
      within(nav).getByRole("link", { name: w.dashboard }),
    ).toHaveAttribute("aria-current", "page");
    expect(c.getByRole("heading", { level: 1 })).toHaveTextContent(w.title);
    expect(c.getByText(w.restrictions)).toBeVisible();
    expect(c.getByRole("region", { name: w.airspace })).toBeVisible();
    expect(
      view.container.querySelectorAll('[data-slot="stat-tile"]'),
    ).toHaveLength(3);
    expect(
      view.container.querySelector('[data-part="value"][data-unknown]'),
    ).toHaveTextContent("—");
  });

  it(`opens the user menu (${name})`, async () => {
    await page.viewport(1280, 900);
    const view = renderKit(<Frame look={look} />, look);
    const trigger = within(view.container).getByRole("button", {
      name: /TEST-account-0001/,
    });
    await userEvent.click(trigger);
    const menu = within(pageBody()).getByRole("menu");
    expect(
      within(menu).getByRole("menuitem", { name: w.signOut }),
    ).toBeVisible();
  });

  it(`collapses the sidebar to icons (${name})`, async () => {
    await page.viewport(1280, 900);
    const view = renderKit(<Frame look={look} />, look);
    const toggle = view.container.querySelector<HTMLButtonElement>(
      '[data-part="collapse"]',
    );
    expect(toggle).not.toBeNull();
    await userEvent.click(toggle as HTMLButtonElement);
    expect(
      view.container.querySelector('[data-slot="app-shell"]'),
    ).toHaveAttribute("data-collapsed", "true");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it(`puts the navigation in a sheet on a narrow screen (${name})`, async () => {
    await page.viewport(375, 800);
    try {
      const view = renderKit(<Frame look={look} />, look);
      const sidebar = view.container.querySelector('[data-part="sidebar"]');
      expect(sidebar).not.toBeVisible();
      const open = view.container.querySelector<HTMLButtonElement>(
        '[data-part="open-nav"]',
      );
      await userEvent.click(open as HTMLButtonElement);
      const sheet = within(pageBody()).getByRole("dialog");
      expect(
        within(sheet).getByRole("link", { name: new RegExp(w.map) }),
      ).toBeVisible();
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
    } finally {
      await page.viewport(1280, 900);
    }
  });
});
