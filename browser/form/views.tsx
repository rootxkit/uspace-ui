import { waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { useWatch } from "react-hook-form";
import { expect } from "vitest";
import { userEvent } from "vitest/browser";
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
// Both languages, both schemes. Shared by form.test.tsx and the golden
// set.

const APP_CATALOGUES = {
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
    <I18nProvider lang={lang} catalogues={APP_CATALOGUES}>
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

export function ZoneForm() {
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

export function IntentForm(props: { onSent?: (v: unknown) => void }) {
  return (
    <WithApp>
      <div className="max-w-3xl" data-testid="intent-form">
        <Form
          schema={intentSchema}
          defaults={INTENT_DEFAULTS}
          onSubmit={async (v) => {
            props.onSent?.(v);
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

export function SourceSwitch(props: { onConfirm: (reason: string) => void }) {
  return (
    <WithApp>
      <ConfirmDialog
        titleKey="switch.title"
        bodyKey="switch.body"
        vars={{ name: "rx-test-01" }}
        reason={{ required: true, minLength: 10 }}
        destructive
        onConfirm={props.onConfirm}
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
  return <>{APP_CATALOGUES[lang]["switch.open"]}</>;
}

/** Submit replays the API's refusal: one error on its field, one listed. */
export async function checkZoneForm(
  canvasElement: HTMLElement,
  upper: RegExp,
  submit: RegExp,
): Promise<void> {
  const root = within(within(canvasElement).getByTestId("zone-form"));
  expect(root.getByLabelText(upper)).toBeTruthy();
  await userEvent.click(root.getByRole("button", { name: submit }));
  const summary = await waitFor(() => {
    const s = canvasElement.querySelector('[data-part="summary"]');
    if (s === null) throw new Error("no summary yet");
    return s;
  });
  expect(summary.getAttribute("data-count")).toBe("2");
  expect(
    canvasElement
      .querySelector(`[data-field="${P}.upper"]`)
      ?.getAttribute("data-invalid"),
  ).toBe("true");
  expect(summary.textContent).toMatch(
    /features\[0\]\.geometry\[0\]\.horizontalProjection/,
  );
}

/** The ten Annex IV items, and a time label that says UTC. */
export function checkIntentForm(
  canvasElement: HTMLElement,
  start: RegExp,
): void {
  const root = within(within(canvasElement).getByTestId("intent-form"));
  // Ten Annex IV items: the bbox counts once for its four numbers.
  const labels = canvasElement.querySelectorAll(
    "[data-field]:not([data-field^='volume.'])",
  );
  expect(labels.length).toBe(15);
  const label = root.getByText(start, { selector: "label" });
  expect(label.textContent?.replace(/ \*$/, "").endsWith("UTC")).toBe(true);
}
