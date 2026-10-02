import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useWatch } from "react-hook-form";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { z } from "zod";

import {
  BBoxField,
  ConfirmDialog,
  EnumField,
  Form,
  NumberField,
  TextField,
  UTCDateTimeField,
  shapes,
} from "../../src/form/index.js";
import {
  FORM_CATALOGUES,
  ZONE_DEFAULTS,
  ZONE_PROBLEM,
  apiError,
  zoneSchema,
} from "../../src/form/fixtures.testing.js";
import { I18nProvider, useLang } from "../../src/i18n/index.js";
import {
  VERTICAL_REFS,
  ZONE_TYPES,
  type VerticalRef,
} from "../../src/model/index.js";
import { Button } from "../../src/ui/index.js";

// WP-10: a zone-shaped form with the ED-318 fields, whose submit replays
// the API's refusal from a fixture problem body (one error lands on its
// field, one is listed with its path); an intent-shaped form with the ten
// Annex IV items as plain fields (labels only: the schema is the USSP's);
// a source switch through the confirm dialog with a mandatory reason.
// Both languages, both schemes.

const STORY_CATALOGUES = {
  en: {
    ...FORM_CATALOGUES.en,
    "intent.serial": "UA serial number",
    "intent.mode": "Mode of operation",
    "intent.mode.VLOS": "Visual line of sight (VLOS)",
    "intent.mode.BVLOS": "Beyond visual line of sight (BVLOS)",
    "intent.flight_type": "Type of flight or special operation",
    "intent.category": "Category, and class or type certificate",
    "intent.volume": "4D trajectory: area",
    "intent.lower": "4D trajectory: lower altitude",
    "intent.upper": "4D trajectory: upper altitude",
    "intent.start": "4D trajectory: start",
    "intent.end": "4D trajectory: end",
    "intent.ident_tech": "Identification technology",
    "intent.connectivity": "Connectivity methods",
    "intent.endurance": "Endurance",
    "intent.c2_loss": "Procedure on loss of command and control link",
    "intent.operator_reg": "Operator registration number",
    "intent.ua_reg": "UA registration number",
    "intent.submit": "Request authorisation",
    "switch.open": "Switch off rx-test-01",
    "switch.title": "Switch off {name}",
    "switch.body":
      "Positions from {name} are not shown while it is off. The source keeps sending; nothing is deleted.",
  },
  ka: {
    ...FORM_CATALOGUES.ka,
    "intent.serial": "საჰაერო ხომალდის სერიული ნომერი",
    "intent.mode": "ოპერაციის რეჟიმი",
    "intent.mode.VLOS": "ხედვის არეში (VLOS)",
    "intent.mode.BVLOS": "ხედვის არის მიღმა (BVLOS)",
    "intent.flight_type": "ფრენის ან სპეციალური ოპერაციის ტიპი",
    "intent.category": "კატეგორია და კლასი ან ტიპის სერტიფიკატი",
    "intent.volume": "4D ტრაექტორია: არეალი",
    "intent.lower": "4D ტრაექტორია: ქვედა სიმაღლე",
    "intent.upper": "4D ტრაექტორია: ზედა სიმაღლე",
    "intent.start": "4D ტრაექტორია: დაწყება",
    "intent.end": "4D ტრაექტორია: დასრულება",
    "intent.ident_tech": "იდენტიფიკაციის ტექნოლოგია",
    "intent.connectivity": "კავშირის საშუალებები",
    "intent.endurance": "ფრენის ხანგრძლივობის მარაგი",
    "intent.c2_loss": "მართვის არხის დაკარგვისას პროცედურა",
    "intent.operator_reg": "ოპერატორის სარეგისტრაციო ნომერი",
    "intent.ua_reg": "საჰაერო ხომალდის სარეგისტრაციო ნომერი",
    "intent.submit": "ავტორიზაციის მოთხოვნა",
    "switch.open": "rx-test-01: გათიშვა",
    "switch.title": "{name}: გათიშვა",
    "switch.body":
      "{name}-ის პოზიციები გათიშვისას არ ჩანს. წყარო აგრძელებს გაგზავნას; არაფერი იშლება.",
  },
};

function WithApp(props: { children: ReactNode }) {
  const { lang } = useLang();
  return (
    <I18nProvider lang={lang} catalogues={STORY_CATALOGUES}>
      {props.children}
    </I18nProvider>
  );
}

const P = "features.0.properties";

function ZoneFields() {
  const lowerRef = useWatch({ name: `${P}.lowerRef` }) as VerticalRef | null;
  const upperRef = useWatch({ name: `${P}.upperRef` }) as VerticalRef | null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        name={`${P}.identifier`}
        labelKey="zone.form.identifier"
        required
      />
      <TextField name={`${P}.name`} labelKey="zone.form.name" required />
      <EnumField
        name={`${P}.type`}
        labelKey="zone.form.type"
        values={ZONE_TYPES}
        i18nPrefix="zone.type"
        required
      />
      <TextField name={`${P}.message`} labelKey="zone.form.message" />
      <EnumField
        name={`${P}.lowerRef`}
        labelKey="zone.form.lowerRef"
        values={VERTICAL_REFS}
        i18nPrefix="form.datum"
        required
      />
      <NumberField
        name={`${P}.lower`}
        labelKey="zone.form.lower"
        unit="form.unit.m"
        datum={lowerRef}
        required
      />
      <EnumField
        name={`${P}.upperRef`}
        labelKey="zone.form.upperRef"
        values={VERTICAL_REFS}
        i18nPrefix="form.datum"
        required
      />
      <NumberField
        name={`${P}.upper`}
        labelKey="zone.form.upper"
        unit="form.unit.m"
        datum={upperRef}
        required
      />
      <UTCDateTimeField
        name={`${P}.start`}
        labelKey="zone.form.start"
        required
      />
      <UTCDateTimeField name={`${P}.end`} labelKey="zone.form.end" />
    </div>
  );
}

function ZoneForm() {
  return (
    <WithApp>
      <div className="max-w-3xl" data-testid="zone-form">
        <Form
          schema={zoneSchema}
          defaults={ZONE_DEFAULTS}
          onSubmit={async () => {
            throw apiError(ZONE_PROBLEM);
          }}
          submitLabelKey="zone.form.submit"
        >
          <ZoneFields />
        </Form>
      </div>
    </WithApp>
  );
}

// The ten Annex IV items (02 F5) as plain fields; the USSP's schema says
// what each must be. Shape only here.
const intentSchema = z.object({
  serial: z.string().min(1),
  mode: z.enum(["VLOS", "BVLOS"]).nullable(),
  flightType: z.string(),
  category: z.string(),
  volume: shapes.bbox(),
  lower: z.number().nullable(),
  upper: z.number().nullable(),
  start: shapes.utcTime(),
  end: shapes.utcTime(),
  identTech: z.string(),
  connectivity: z.string(),
  enduranceMin: z.number().nullable(),
  c2Loss: z.string(),
  operatorReg: z.string().min(1),
  uaReg: z.string(),
});

const INTENT_DEFAULTS: z.input<typeof intentSchema> = {
  serial: "TEST0000001",
  mode: null,
  flightType: "",
  category: "",
  volume: [44.78, 41.69, 44.81, 41.71],
  lower: null,
  upper: null,
  start: "2026-10-02T09:00:00Z",
  end: "2026-10-02T09:45:00Z",
  identTech: "",
  connectivity: "",
  enduranceMin: null,
  c2Loss: "",
  operatorReg: "GEO-TEST-OP-1",
  uaReg: "",
};

const intentSent = fn();

function IntentForm() {
  return (
    <WithApp>
      <div className="max-w-3xl" data-testid="intent-form">
        <Form
          schema={intentSchema}
          defaults={INTENT_DEFAULTS}
          onSubmit={async (v) => {
            intentSent(v);
          }}
          submitLabelKey="intent.submit"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField name="serial" labelKey="intent.serial" required />
            <EnumField
              name="mode"
              labelKey="intent.mode"
              values={["VLOS", "BVLOS"]}
              i18nPrefix="intent.mode"
            />
            <TextField name="flightType" labelKey="intent.flight_type" />
            <TextField name="category" labelKey="intent.category" />
          </div>
          <BBoxField name="volume" labelKey="intent.volume" required />
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              name="lower"
              labelKey="intent.lower"
              unit="form.unit.m"
              datum="WGS84"
            />
            <NumberField
              name="upper"
              labelKey="intent.upper"
              unit="form.unit.m"
              datum="WGS84"
            />
            <UTCDateTimeField name="start" labelKey="intent.start" required />
            <UTCDateTimeField name="end" labelKey="intent.end" required />
            <TextField name="identTech" labelKey="intent.ident_tech" />
            <TextField name="connectivity" labelKey="intent.connectivity" />
            <NumberField
              name="enduranceMin"
              labelKey="intent.endurance"
              unit="form.unit.min"
            />
            <TextField name="c2Loss" labelKey="intent.c2_loss" />
            <TextField
              name="operatorReg"
              labelKey="intent.operator_reg"
              required
            />
            <TextField name="uaReg" labelKey="intent.ua_reg" />
          </div>
        </Form>
      </div>
    </WithApp>
  );
}

const switched = fn();

function SourceSwitch() {
  return (
    <WithApp>
      <ConfirmDialog
        titleKey="switch.title"
        bodyKey="switch.body"
        vars={{ name: "rx-test-01" }}
        reason={{ required: true, minLength: 10 }}
        destructive
        onConfirm={switched}
        trigger={
          <Button type="button" variant="outline">
            <SwitchLabel />
          </Button>
        }
      />
    </WithApp>
  );
}

function SwitchLabel() {
  const { lang } = useLang();
  return <>{STORY_CATALOGUES[lang]["switch.open"]}</>;
}

const meta = {
  title: "form/Form kit",
  component: ZoneForm,
} satisfies Meta<typeof ZoneForm>;

export default meta;

const zonePlay =
  (upper: RegExp, submit: RegExp): NonNullable<StoryObj["play"]> =>
  async ({ canvasElement }) => {
    const root = within(within(canvasElement).getByTestId("zone-form"));
    await expect(root.getByLabelText(upper)).toBeTruthy();
    await userEvent.click(root.getByRole("button", { name: submit }));
    const summary = await waitFor(() => {
      const s = canvasElement.querySelector('[data-part="summary"]');
      if (s === null) throw new Error("no summary yet");
      return s;
    });
    await expect(summary.getAttribute("data-count")).toBe("2");
    await expect(
      canvasElement
        .querySelector(`[data-field="${P}.upper"]`)
        ?.getAttribute("data-invalid"),
    ).toBe("true");
    await expect(summary.textContent).toMatch(
      /features\[0\]\.geometry\[0\]\.horizontalProjection/,
    );
  };

export const ZoneFormEnglishLight: StoryObj = {
  render: () => <ZoneForm />,
  globals: { lang: "en", scheme: "light" },
  play: zonePlay(/^Upper limit \(m, AMSL\)/, /Publish zone/),
};

export const ZoneFormGeorgianDark: StoryObj = {
  render: () => <ZoneForm />,
  globals: { lang: "ka", scheme: "dark" },
  play: zonePlay(/^ზედა ზღვარი \(მ, ზღვის დონიდან\)/, /ზონის გამოქვეყნება/),
};

const intentPlay =
  (start: RegExp): NonNullable<StoryObj["play"]> =>
  async ({ canvasElement }) => {
    const root = within(within(canvasElement).getByTestId("intent-form"));
    // Ten Annex IV items: the bbox counts once for its four numbers.
    const labels = canvasElement.querySelectorAll(
      "[data-field]:not([data-field^='volume.'])",
    );
    await expect(labels.length).toBe(15);
    const label = root.getByText(start, { selector: "label" });
    await expect(label.textContent?.replace(/ \*$/, "").endsWith("UTC")).toBe(
      true,
    );
  };

export const IntentFormEnglishLight: StoryObj = {
  render: () => <IntentForm />,
  globals: { lang: "en", scheme: "light" },
  play: intentPlay(/^4D trajectory: start/),
};

export const IntentFormGeorgianDark: StoryObj = {
  render: () => <IntentForm />,
  globals: { lang: "ka", scheme: "dark" },
  play: intentPlay(/^4D ტრაექტორია: დაწყება/),
};

export const IntentSubmits: StoryObj = {
  render: () => <IntentForm />,
  globals: { lang: "en", scheme: "light" },
  play: async ({ canvasElement }) => {
    intentSent.mockClear();
    const root = within(canvasElement);
    await userEvent.click(
      root.getByRole("button", { name: "Request authorisation" }),
    );
    await waitFor(() => expect(intentSent).toHaveBeenCalledTimes(1));
    const v = intentSent.mock.calls[0]?.[0] as Record<string, unknown>;
    await expect(v["volume"]).toEqual([44.78, 41.69, 44.81, 41.71]);
    await expect(v["start"]).toBe("2026-10-02T09:00:00Z");
    await expect(v["lower"]).toBeNull();
    await expect(root.getByRole("status").textContent).toBe("Saved");
  },
};

const switchPlay =
  (
    open: string,
    confirm: string,
    reason: RegExp,
  ): NonNullable<StoryObj["play"]> =>
  async ({ canvasElement }) => {
    switched.mockClear();
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: open }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("alertdialog");
    // Destructive: the confirm button is not where focus starts.
    const confirmButton = within(dialog).getByRole("button", { name: confirm });
    await expect(canvasElement.ownerDocument.activeElement).not.toBe(
      confirmButton,
    );
    await userEvent.click(confirmButton);
    await expect(switched).not.toHaveBeenCalled();
    await userEvent.type(
      within(dialog).getByLabelText(reason),
      "receiver maintenance",
    );
    await userEvent.click(confirmButton);
    await expect(switched).toHaveBeenCalledWith("receiver maintenance");
  };

export const SourceSwitchEnglishLight: StoryObj = {
  render: () => <SourceSwitch />,
  globals: { lang: "en", scheme: "light" },
  play: switchPlay("Switch off rx-test-01", "Confirm", /^Reason/),
};

export const SourceSwitchGeorgianDark: StoryObj = {
  render: () => <SourceSwitch />,
  globals: { lang: "ka", scheme: "dark" },
  play: switchPlay("rx-test-01: გათიშვა", "დადასტურება", /^მიზეზი/),
};
