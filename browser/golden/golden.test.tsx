// DOM snapshots of the golden set (docs/PLAN.md D9, §9). A snapshot
// changes only with a reviewed reason; update it with
// `pnpm test:browser -u` and say why in the PR. Each entry renders a
// component the way its own test does, runs that test's checks, and
// records what is left on the page.
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it } from "vitest";

import {
  I18nProvider,
  missingKeys,
  resetI18nCounters,
  useT,
} from "../../src/i18n/index.js";
import { LoginForm } from "../../src/auth/client/index.js";
import {
  ListView,
  Summaries,
  checkList,
  checkSummaries,
} from "../alerts/views.js";
import { LOGIN_PROPS } from "../auth/login.js";
import {
  IntentForm,
  ZoneForm,
  checkIntentForm,
  checkZoneForm,
} from "../form/views.js";
import { checkEnglish, checkGeorgian } from "../i18n/checks.js";
import { Typography } from "../i18n/Typography.js";
import {
  EN_DARK,
  EN_LIGHT,
  KA_DARK,
  KA_LIGHT,
  renderKit,
  type Look,
} from "../kit.js";
import {
  Degraded,
  Sources,
  StatusBars,
  checkBars,
  checkDegraded,
  checkSources,
} from "../live/views.js";
import {
  Deliveries,
  Registry,
  WithCatalogues,
  checkEmpty,
  checkError,
  checkRegistry,
} from "../table/views.js";
import { checkPalettes, Palettes } from "../theme/Palettes.js";
import { LegendsBox, checkLegends } from "../tracks/views.js";
import { Cards, LegendBox, checkCards, checkLegend } from "../zones/views.js";

// One element per line, so a reviewed diff reads line by line.
const pretty = (html: string): string => `${html.replace(/></g, ">\n<")}\n`;

// React's generated ids depend on how many ids were made before, so they
// are numbered in order of appearance; the references stay matched.
function stableIds(html: string): string {
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1] ?? "");
  let out = html;
  ids.forEach((id, i) => {
    out = out.split(id).join(`id-${i}`);
  });
  return out;
}

/** Renders `ui` in `look`, runs `check` on it, and returns its DOM. */
async function snapshot(
  ui: ReactNode,
  look: Look,
  check: (canvas: HTMLElement) => void | Promise<void> = () => undefined,
): Promise<string> {
  const { container } = renderKit(ui, look);
  await check(container);
  return pretty(container.innerHTML);
}

async function snapshotPalettes(look: Look): Promise<string> {
  const { container } = renderKit(<Palettes />, look);
  checkPalettes(container);
  expect(document.documentElement.getAttribute("data-theme")).toBe(look.scheme);
  // The DOM is the same in both schemes; the colours each swatch resolves
  // to are what differs, so they are part of the snapshot.
  const colours = [...container.querySelectorAll<HTMLElement>("[data-token]")]
    .map(
      (el) => `${el.dataset["token"]}: ${getComputedStyle(el).backgroundColor}`,
    )
    .join("\n");
  return `${pretty(container.innerHTML)}<!-- resolved in ${look.scheme}\n${colours}\n-->\n`;
}

it("palettes.light", async () => {
  await expect(await snapshotPalettes(EN_LIGHT)).toMatchFileSnapshot(
    "./__snapshots__/palettes.light.html",
  );
});

it("palettes.dark", async () => {
  await expect(await snapshotPalettes(EN_DARK)).toMatchFileSnapshot(
    "./__snapshots__/palettes.dark.html",
  );
});

it("typography.ka", async () => {
  await expect(
    await snapshot(<Typography />, KA_LIGHT, checkGeorgian),
  ).toMatchFileSnapshot("./__snapshots__/typography.ka.html");
});

it("typography.en", async () => {
  await expect(
    await snapshot(<Typography />, EN_LIGHT, checkEnglish),
  ).toMatchFileSnapshot("./__snapshots__/typography.en.html");
});

const table = (ui: ReactNode): ReactNode => (
  <WithCatalogues>{ui}</WithCatalogues>
);

// The rest of the set, with React's ids numbered: zone legend and hover
// card (WP-6), track legends (WP-7), the sign-in form (WP-5), the status
// bar in each connection state, the sources panel with every source
// state, the degraded banner and age chips (WP-8), and one page of the
// registry table with its empty and error states (WP-9), the zone form
// with the API's field errors replayed and the intent form with the ten
// Annex IV items (WP-10), the alert list with every kind raised and
// cleared and one summary per kind (WP-11).
const GOLDEN: Record<
  string,
  [ReactNode, Look, (canvas: HTMLElement) => void | Promise<void>]
> = {
  "zone-legend.en": [<LegendBox />, EN_LIGHT, checkLegend],
  "zone-legend.ka": [<LegendBox />, KA_DARK, checkLegend],
  "zone-card.en": [<Cards />, EN_LIGHT, (c) => checkCards(c, "en")],
  "zone-card.ka": [<Cards />, KA_DARK, (c) => checkCards(c, "ka")],
  "track-legends.en": [
    <LegendsBox />,
    EN_LIGHT,
    (c) => checkLegends(c, /Broadcast and unverified/),
  ],
  "track-legends.ka": [
    <LegendsBox />,
    KA_DARK,
    (c) => checkLegends(c, /დაუდასტურებელი/),
  ],
  "login-form.en": [<LoginForm {...LOGIN_PROPS} />, EN_LIGHT, () => undefined],
  "login-form.ka": [<LoginForm {...LOGIN_PROPS} />, KA_DARK, () => undefined],
  "feed-status.en": [<StatusBars />, EN_LIGHT, checkBars],
  "feed-status.ka": [<StatusBars />, KA_DARK, checkBars],
  "sources-panel.en": [
    <Sources />,
    EN_LIGHT,
    (c) => checkSources(c, /disabled by admin:test-1/, /silent since/),
  ],
  "sources-panel.ka": [
    <Sources />,
    KA_DARK,
    (c) => checkSources(c, /admin:test-1/, /დუმს/),
  ],
  "degraded.en": [<Degraded />, EN_LIGHT, checkDegraded],
  "degraded.ka": [<Degraded />, KA_DARK, checkDegraded],
  "table-page.en": [
    table(<Registry />),
    EN_LIGHT,
    (c) => checkRegistry(c, "Registered aircraft", /^Ceiling \(m AMSL\)$/),
  ],
  "table-page.ka": [
    table(<Registry />),
    KA_DARK,
    (c) =>
      checkRegistry(
        c,
        "რეგისტრირებული საჰაერო ხომალდები",
        /^ჭერი \(მ ზღვის დონიდან\)$/,
      ),
  ],
  "table-empty.en": [
    table(<Registry rows={0} />),
    EN_LIGHT,
    (c) => checkEmpty(c, /No registrations yet/),
  ],
  "table-empty.ka": [
    table(<Registry rows={0} />),
    KA_DARK,
    (c) => checkEmpty(c, /რეგისტრაციები ჯერ არ არის/),
  ],
  "table-error.en": [
    table(<Deliveries error />),
    EN_LIGHT,
    (c) => checkError(c, /wait 30 seconds/),
  ],
  "table-error.ka": [
    table(<Deliveries error />),
    KA_DARK,
    (c) => checkError(c, /30 წამის/),
  ],
  "form-zone.en": [
    <ZoneForm />,
    EN_LIGHT,
    (c) => checkZoneForm(c, /^Upper limit \(m, AMSL\)/, /Publish zone/),
  ],
  "form-zone.ka": [
    <ZoneForm />,
    KA_DARK,
    (c) =>
      checkZoneForm(
        c,
        /^ზედა ზღვარი \(მ, ზღვის დონიდან\)/,
        /ზონის გამოქვეყნება/,
      ),
  ],
  "form-intent.en": [
    <IntentForm />,
    EN_LIGHT,
    (c) => checkIntentForm(c, /^4D trajectory: start/),
  ],
  "form-intent.ka": [
    <IntentForm />,
    KA_DARK,
    (c) => checkIntentForm(c, /^4D ტრაექტორია: დაწყება/),
  ],
  "alert-list.en": [<ListView />, EN_LIGHT, checkList],
  "alert-list.ka": [<ListView />, KA_DARK, checkList],
  "alert-summaries.en": [
    <Summaries />,
    EN_LIGHT,
    (c) => checkSummaries(c, / m horizontally in /),
  ],
  "alert-summaries.ka": [
    <Summaries />,
    KA_DARK,
    (c) => checkSummaries(c, / წმ-ში/),
  ],
};

for (const [name, [ui, look, check]] of Object.entries(GOLDEN)) {
  it(name, async () => {
    await expect(
      stableIds(await snapshot(ui, look, check)),
    ).toMatchFileSnapshot(`./__snapshots__/${name}.html`);
  });
}

// The presence twin of the setup's missingKeys() check: a key that `ka`
// lacks is counted in the browser too. Reset after, so the setup's own
// afterEach sees the zero it requires.
it("counts a key missing in ka", () => {
  function Probe() {
    return <p>{useT()("test.only_en")}</p>;
  }
  const view = render(
    <I18nProvider lang="ka" catalogues={{ en: { "test.only_en": "English" } }}>
      <Probe />
    </I18nProvider>,
  );
  expect(view.container.textContent).toBe("English");
  expect(missingKeys()).toBe(1);
  view.unmount();
  resetI18nCounters();
});
