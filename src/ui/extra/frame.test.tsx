// The console frame of 1.1.0 in jsdom: each component shows what it was
// given, in words as well as in colour, and every "nothing" has its
// "something" (E-01). The look and axe run in browser/frame/.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider, useLang } from "../../i18n/I18nProvider.js";
import type { Lang } from "../../i18n/lang.js";
import { STATUS_TONES, statusTokens } from "../../theme/status.js";
import { DropdownMenuItem } from "../dropdown-menu.js";
import { TooltipProvider } from "../tooltip.js";
import {
  AppShell,
  EmptyState,
  KpiRow,
  LanguageSwitch,
  MapPanel,
  PageHeader,
  Panel,
  StatTile,
  StatusBadge,
  StatusPill,
  UserMenu,
  type NavGroup,
} from "./index.js";

afterEach(() => {
  cleanup();
});

function wrap(ui: ReactNode, lang: Lang = "en") {
  return render(
    <I18nProvider lang={lang}>
      <TooltipProvider>{ui}</TooltipProvider>
    </I18nProvider>,
  );
}

const NAV: NavGroup[] = [
  {
    id: "console",
    label: "Console",
    items: [
      {
        id: "dash",
        label: "Dashboard",
        href: "/dashboard",
        icon: <svg />,
        active: true,
        badge: "3",
      },
      { id: "map", label: "Map", href: "/map" },
    ],
  },
  { id: "more", items: [{ id: "audit", label: "Audit", href: "/audit" }] },
];

describe("status tones", () => {
  it("names three variables per tone, in order from good to bad", () => {
    expect(STATUS_TONES).toEqual([
      "ok",
      "info",
      "warning",
      "critical",
      "neutral",
    ]);
    expect(statusTokens.warning).toEqual({
      fg: "--us-status-warning",
      soft: "--us-status-warning-soft",
      border: "--us-status-warning-border",
    });
  });
});

describe("StatusBadge", () => {
  it("states the status in words, with its tone and a dot", () => {
    wrap(<StatusBadge tone="critical">1 critical</StatusBadge>);
    const b = screen.getByText("1 critical");
    expect(b.dataset["tone"]).toBe("critical");
    expect(b.dataset["variant"]).toBe("soft");
    expect(b.className).toContain("bg-status-critical-soft");
    expect(b.querySelector('[data-part="dot"]')).not.toBeNull();
  });

  it("drops the dot and the tint when asked (the twin)", () => {
    wrap(
      <StatusBadge tone="ok" variant="outline" dot={false}>
        Live
      </StatusBadge>,
    );
    const b = screen.getByText("Live");
    expect(b.className).toContain("border-status-ok");
    expect(b.className).not.toContain("bg-status-ok-soft");
    expect(b.querySelector('[data-part="dot"]')).toBeNull();
  });
});

describe("StatusPill", () => {
  it.each([
    ["live", "Live"],
    ["stale", "Stale"],
    ["connecting", "Connecting"],
    ["down", "Feed down, retrying"],
  ] as const)("%s says %s", (state, word) => {
    const { container } = wrap(<StatusPill state={state} ageS={4} />);
    const pill = container.querySelector('[data-slot="status-pill"]');
    expect(pill?.getAttribute("data-state")).toBe(state);
    expect(pill?.textContent).toContain(word);
    expect(pill?.textContent).toContain("Feed status:");
    expect(pill?.textContent).toContain("updated 4 s ago");
  });

  it("never says lost when the feed is down (C-12)", () => {
    const { container } = wrap(<StatusPill state="down" ageS={90} />);
    expect(container.textContent).not.toMatch(/lost/i);
  });

  it("says no update yet for null, and no age when none is given", () => {
    const a = wrap(<StatusPill state="connecting" ageS={null} />);
    expect(a.container.textContent).toContain("no update yet");
    cleanup();
    const b = wrap(<StatusPill state="live" />);
    expect(b.container.querySelector('[data-part="age"]')).toBeNull();
  });

  it("speaks Georgian", () => {
    const { container } = wrap(<StatusPill state="stale" ageS={12} />, "ka");
    expect(container.textContent).toContain("მოძველებული");
  });
});

describe("StatTile and KpiRow", () => {
  it("shows the value, unit, status in words, trend and hint", () => {
    const { container } = wrap(
      <KpiRow label="Airspace now">
        <StatTile
          label="Tracks"
          value={27}
          unit="tracks"
          icon={<svg />}
          status={{ tone: "ok", label: "Live" }}
          trend={{ direction: "up", label: "+4 in 10 min", tone: "warning" }}
          hint="as of 09:15 UTC"
        />
      </KpiRow>,
    );
    const row = screen.getByRole("group", { name: "Airspace now" });
    const tile = within(row).getByText("Tracks").closest("[data-slot]");
    expect(tile?.getAttribute("data-tone")).toBe("ok");
    expect(container.querySelector('[data-part="value"]')?.textContent).toBe(
      "27tracks",
    );
    expect(screen.getByText("Live")).toBeTruthy();
    const trend = container.querySelector('[data-part="trend"]');
    expect(trend?.getAttribute("data-direction")).toBe("up");
    expect(trend?.textContent).toContain("Trend: rising");
    expect(trend?.className).toContain("text-status-warning");
    expect(screen.getByText("as of 09:15 UTC")).toBeTruthy();
    expect(container.querySelector('[data-part="bar"]')).not.toBeNull();
  });

  it("renders an unknown value as a dash without its unit, never a zero", () => {
    const { container } = wrap(
      <StatTile label="Highest track" value={null} unit="m AGL" />,
    );
    const v = container.querySelector('[data-part="value"]');
    expect(v?.textContent).toBe("—");
    expect(v?.hasAttribute("data-unknown")).toBe(true);
    expect(container.querySelector('[data-part="bar"]')).toBeNull();
    expect(container.querySelector('[data-part="trend"]')).toBeNull();
  });

  it.each([
    ["down", "falling"],
    ["flat", "unchanged"],
  ] as const)("a %s trend is neutral without a tone", (direction, word) => {
    const { container } = wrap(
      <StatTile label="x" value={1} trend={{ direction, label: "d" }} />,
    );
    const trend = container.querySelector('[data-part="trend"]');
    expect(trend?.textContent).toContain(word);
    expect(trend?.className).toContain("text-status-neutral");
  });

  it("a row without a label is no group", () => {
    const { container } = wrap(<KpiRow>x</KpiRow>);
    expect(
      container.querySelector('[data-slot="kpi-row"]')?.getAttribute("role"),
    ).toBeNull();
  });
});

describe("Panel", () => {
  it("is a section named by its heading, with actions and a footer", () => {
    wrap(
      <Panel
        title="Alerts"
        description="Critical first"
        actions={<button type="button">Filter</button>}
        footer="as of 09:15 UTC"
        headingLevel={3}
      >
        body
      </Panel>,
    );
    const region = screen.getByRole("region", { name: "Alerts" });
    expect(within(region).getByRole("heading", { level: 3 })).toBeTruthy();
    expect(within(region).getByText("Critical first")).toBeTruthy();
    expect(within(region).getByRole("button", { name: "Filter" })).toBeTruthy();
    expect(within(region).getByText("as of 09:15 UTC")).toBeTruthy();
  });

  it("without a title has no header and no name (the twin)", () => {
    const { container } = wrap(<Panel padding="none">body</Panel>);
    const s = container.querySelector('[data-slot="panel"]');
    expect(s?.querySelector('[data-part="header"]')).toBeNull();
    expect(s?.getAttribute("aria-labelledby")).toBeNull();
    expect(s?.querySelector('[data-part="body"]')?.className).not.toContain(
      "p-[",
    );
  });
});

describe("PageHeader", () => {
  it("has the trail, the h1, meta, description and actions", () => {
    const renderLink = vi.fn((p: { href: string; children?: ReactNode }) => (
      <a href={p.href}>{p.children}</a>
    ));
    wrap(
      <PageHeader
        title="Overview"
        description="All of it"
        meta={<span>Demo</span>}
        actions={<button type="button">Export</button>}
        breadcrumbs={[
          { label: "Console", href: "/" },
          { label: "Section" },
          { label: "Overview" },
        ]}
        renderLink={renderLink}
      />,
    );
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(
      within(trail).getByRole("link", { name: "Console" }).getAttribute("href"),
    ).toBe("/");
    expect(within(trail).queryByRole("link", { name: "Section" })).toBeNull();
    expect(
      within(trail).getByText("Overview").closest('[aria-current="page"]'),
    ).not.toBeNull();
    expect(renderLink).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Overview",
    );
    expect(screen.getByText("Demo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
  });

  it("without a trail renders no breadcrumb (the twin)", () => {
    wrap(<PageHeader title="Overview" breadcrumbs={[]} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});

describe("LanguageSwitch", () => {
  it("names each language in itself and switches", () => {
    const onLang = vi.fn();
    function Probe() {
      return <span data-testid="lang">{useLang().lang}</span>;
    }
    render(
      <I18nProvider lang="en" onLangChange={onLang}>
        <LanguageSwitch />
        <Probe />
      </I18nProvider>,
    );
    const group = screen.getByRole("group", { name: "Language" });
    const ka = within(group).getByRole("button", { name: "ქართული" });
    const en = within(group).getByRole("button", { name: "English" });
    expect(ka.getAttribute("lang")).toBe("ka");
    expect(en.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(en);
    expect(onLang).not.toHaveBeenCalled();
    fireEvent.click(ka);
    expect(onLang).toHaveBeenCalledWith("ka");
    expect(screen.getByTestId("lang").textContent).toBe("ka");
    expect(ka.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("UserMenu", () => {
  it("shows the initials and opens on who is signed in", () => {
    wrap(
      <UserMenu name="TEST operator one" detail="viewer, auditor">
        <DropdownMenuItem>Sign out</DropdownMenuItem>
      </UserMenu>,
    );
    const trigger = screen.getByRole("button", {
      name: "Account menu: TEST operator one",
    });
    expect(trigger.textContent).toContain("TO");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    expect(screen.getByText("Signed in as TEST operator one")).toBeTruthy();
    expect(screen.getByText("viewer, auditor")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeTruthy();
  });

  it("opens with only the name when it has no items (the twin)", () => {
    wrap(<UserMenu name="TEST" />);
    fireEvent.pointerDown(screen.getByRole("button"), { button: 0 });
    expect(screen.getByText("Signed in as TEST")).toBeTruthy();
    expect(screen.queryByRole("menuitem")).toBeNull();
  });
});

describe("MapPanel", () => {
  it("lays the legend over the map and folds it", () => {
    const { container } = wrap(
      <MapPanel title="Airspace" legend={<p>Zone types</p>}>
        <div data-testid="map" />
      </MapPanel>,
    );
    expect(screen.getByRole("region", { name: "Airspace" })).toBeTruthy();
    expect(screen.getByTestId("map")).toBeTruthy();
    const toggle = screen.getByRole("button", { name: "Legend" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const body = document.getElementById(
      toggle.getAttribute("aria-controls") ?? "",
    );
    expect(body?.hasAttribute("hidden")).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(body?.hasAttribute("hidden")).toBe(true);
    expect(container.querySelector('[data-part="map"]')?.className).toContain(
      "h-[28rem]",
    );
  });

  it("starts folded on request, with its own title; none without a legend", () => {
    wrap(
      <MapPanel
        legend="x"
        legendTitle="Key"
        defaultLegendOpen={false}
        mapClassName="h-64"
      >
        map
      </MapPanel>,
    );
    expect(
      screen.getByRole("button", { name: "Key" }).getAttribute("aria-expanded"),
    ).toBe("false");
    cleanup();
    const { container } = wrap(<MapPanel>map</MapPanel>);
    expect(container.querySelector('[data-part="legend"]')).toBeNull();
  });
});

describe("EmptyState", () => {
  it("says why it is empty, with its icon and action", () => {
    wrap(
      <EmptyState
        title="No restriction is active"
        description="None in force"
        icon={<svg data-testid="icon" />}
        action={<button type="button">Refresh</button>}
      />,
    );
    const s = screen.getByRole("status");
    expect(within(s).getByText("No restriction is active")).toBeTruthy();
    expect(within(s).getByText("None in force")).toBeTruthy();
    expect(within(s).getByRole("button", { name: "Refresh" })).toBeTruthy();
  });
});

describe("AppShell", () => {
  function Shell(props: { collapsed?: boolean; onChange?(c: boolean): void }) {
    return (
      <AppShell
        systemName="U-space"
        logo={<svg />}
        nav={NAV}
        environment={{ name: "Training", tone: "info" }}
        status={<StatusPill state="live" ageS={2} />}
        actions={<button type="button">Theme</button>}
        user={<UserMenu name="TEST" />}
        sidebarFooter="WCAG 2.2 AA"
        {...(props.collapsed === undefined
          ? {}
          : { collapsed: props.collapsed })}
        {...(props.onChange === undefined
          ? {}
          : { onCollapsedChange: props.onChange })}
      >
        <h1>Page</h1>
      </AppShell>
    );
  }

  it("has a skip link to main, the navigation, and the top bar", () => {
    const { container } = wrap(<Shell />);
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip.getAttribute("href")).toBe("#main");
    expect(container.querySelector("a")).toBe(skip);
    expect(screen.getByRole("main").id).toBe("main");
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const current = within(nav).getByRole("link", { name: /Dashboard/ });
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByText("3")).toBeTruthy();
    expect(
      within(nav)
        .getByRole("link", { name: "Map" })
        .getAttribute("aria-current"),
    ).toBeNull();
    expect(within(nav).getByRole("group", { name: "Console" })).toBeTruthy();
    expect(screen.getByText("Training").textContent).toContain("Environment:");
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Theme" })).toBeTruthy();
    expect(screen.getByText("WCAG 2.2 AA")).toBeTruthy();
  });

  it("collapses to icons and back, telling the app", () => {
    const onChange = vi.fn();
    const { container } = wrap(<Shell onChange={onChange} />);
    const shell = container.querySelector('[data-slot="app-shell"]');
    const toggle = screen.getByRole("button", { name: "Collapse the sidebar" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(shell?.getAttribute("data-collapsed")).toBe("true");
    // Collapsed, the label stays for assistive technology and the footer goes.
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByRole("link", { name: /Dashboard/ })).toBeTruthy();
    expect(screen.queryByText("WCAG 2.2 AA")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand the sidebar" }));
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(shell?.getAttribute("data-collapsed")).toBe("false");
  });

  it("follows a controlled collapsed state", () => {
    function Controlled() {
      const [c, setC] = useState(true);
      return <Shell collapsed={c} onChange={setC} />;
    }
    const { container } = wrap(<Controlled />);
    expect(
      container
        .querySelector('[data-slot="app-shell"]')
        ?.getAttribute("data-collapsed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Expand the sidebar" }));
    expect(
      container
        .querySelector('[data-slot="app-shell"]')
        ?.getAttribute("data-collapsed"),
    ).toBe("false");
  });

  it("opens the navigation in a sheet on a narrow screen, closed by a link", () => {
    wrap(<Shell />);
    fireEvent.click(
      screen.getByRole("button", { name: "Open the navigation" }),
    );
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("WCAG 2.2 AA")).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: "Close" })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("link", { name: "Map" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("without a language switch, environment or status shows none (the twin)", () => {
    wrap(
      <AppShell
        systemName="U-space"
        nav={NAV}
        languageSwitch={false}
        defaultCollapsed
      >
        x
      </AppShell>,
    );
    expect(screen.queryByRole("group", { name: "Language" })).toBeNull();
    expect(screen.queryByText("Environment:")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Expand the sidebar" }),
    ).toBeTruthy();
  });
});
