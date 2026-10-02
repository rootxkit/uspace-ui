// The fields (WP-10, PLAN §3.15) in jsdom: an empty NumberField is null,
// never 0; "1,5" is 1.5 in ka and "1.5" in en; a label carries the unit
// and the datum when given and no brackets when not (pair); a time label
// ends with UTC in both languages and a time round-trips through the
// field across the London DST night in two fake zones; the bbox refuses
// west of east with an error naming the pair; EnumField over TRUSTS has
// six options with catalogue labels; axe on idle, invalid and disabled in
// both languages.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useFormContext } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n/I18nProvider.js";
import type { Lang } from "../i18n/lang.js";
import { TRUSTS, VERTICAL_REFS } from "../model/index.js";
import { axeCheck } from "../test/axe.js";
import { useFieldControl } from "./context.js";
import { Field } from "./Field.js";
import {
  BBoxField,
  CheckboxField,
  EnumField,
  NumberField,
  ReasonField,
  TextField,
  UTCDateTimeField,
} from "./fields.js";
import {
  ALL_DEFAULTS,
  FORM_CATALOGUES,
  allFieldsSchema,
  type AllFields,
} from "./fixtures.testing.js";
import { Form } from "./Form.js";

const TZ = process.env["TZ"];

afterEach(() => {
  cleanup();
  if (TZ === undefined) delete process.env["TZ"];
  else process.env["TZ"] = TZ;
});

function SetMass() {
  const { setValue } = useFormContext();
  return (
    <button
      type="button"
      onClick={() => {
        setValue("massKg", 2.5);
      }}
    >
      set mass
    </button>
  );
}

function renderFields(
  opts: {
    lang?: Lang;
    defaults?: Partial<AllFields>;
    disabled?: boolean;
  } = {},
) {
  const onSubmit = vi.fn<(values: unknown) => Promise<undefined>>(
    async () => undefined,
  );
  const disabled = opts.disabled === true;
  const view = render(
    <I18nProvider lang={opts.lang ?? "en"} catalogues={FORM_CATALOGUES}>
      <Form
        schema={allFieldsSchema}
        defaults={{ ...ALL_DEFAULTS, ...opts.defaults }}
        onSubmit={onSubmit}
        submitLabelKey="t.submit"
      >
        <TextField
          name="callsign"
          labelKey="t.callsign"
          required
          disabled={disabled}
        />
        <NumberField
          name="massKg"
          labelKey="t.mass"
          unit="form.unit.kg"
          disabled={disabled}
        />
        <NumberField
          name="heightM"
          labelKey="t.height"
          unit="form.unit.m"
          datum="AGL"
          required
          disabled={disabled}
        />
        <EnumField
          name="trust"
          labelKey="t.trust"
          values={TRUSTS}
          i18nPrefix="trust"
          disabled={disabled}
        />
        <EnumField
          name="ref"
          labelKey="t.ref"
          values={VERTICAL_REFS}
          i18nPrefix="form.datum"
          disabled={disabled}
        />
        <CheckboxField name="ack" labelKey="t.ack" disabled={disabled} />
        <UTCDateTimeField
          name="at"
          labelKey="t.at"
          required
          disabled={disabled}
        />
        <BBoxField name="area" labelKey="t.area" required disabled={disabled} />
        <ReasonField name="reason" minLength={10} />
        <SetMass />
      </Form>
    </I18nProvider>,
  );
  return { ...view, onSubmit };
}

const type = (label: RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

function fillValid() {
  type(/^Call sign/, "TEST01");
  type(/^Height/, "120");
  type(/^Reason/, "receiver maintenance");
}

async function send() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Send|გაგზავნა/ }));
  });
}

const labelText = (re: RegExp): string =>
  (screen.getByText(re, { selector: "label" }).textContent ?? "").replace(
    / \*$/,
    "",
  );

describe("NumberField", () => {
  it("stores an empty box as null, never 0, and a typed number as a number", async () => {
    const { onSubmit } = renderFields();
    fillValid();
    await send();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const values = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(values["massKg"]).toBeNull();
    expect(values["heightM"]).toBe(120);
  });

  it.each([
    ["ka", "1,5", /^მასა/],
    ["en", "1.5", /^Mass/],
  ] as const)("reads %s %j as 1.5", async (lang, text, label) => {
    const { onSubmit } = renderFields({
      lang,
      defaults: {
        callsign: "TEST01",
        heightM: 120,
        reason: "receiver maintenance",
      },
    });
    type(label, text);
    await send();
    const values = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(values["massKg"]).toBe(1.5);
  });

  it("refuses '1,5' in en as not a number, on the field", async () => {
    const { onSubmit, container } = renderFields();
    fillValid();
    type(/^Mass/, "1,5");
    await send();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-field="massKg"]')?.textContent,
    ).toMatch(/Not a number/);
  });

  it("follows a value set from outside, and shows a stored number in the box's language", () => {
    renderFields({ lang: "ka" });
    fireEvent.click(screen.getByRole("button", { name: "set mass" }));
    expect((screen.getByLabelText(/^მასა/) as HTMLInputElement).value).toBe(
      "2,5",
    );
  });
});

describe("labels", () => {
  it("carry the unit and the datum when given", () => {
    renderFields();
    expect(labelText(/^Height/)).toBe("Height (m, AGL)");
    expect(labelText(/^Mass/)).toBe("Mass (kg)");
  });

  it("have nothing in brackets without a unit or a datum (the pair)", () => {
    renderFields();
    expect(labelText(/^Call sign/)).toBe("Call sign");
    expect(labelText(/^Call sign/)).not.toMatch(/[()]/);
  });

  it("name the datum in Georgian", () => {
    renderFields({ lang: "ka" });
    expect(labelText(/^სიმაღლე/)).toBe("სიმაღლე (მ, მიწიდან)");
  });

  it.each(["en", "ka"] as const)("end with UTC for a time, %s", (lang) => {
    renderFields({ lang });
    const label = labelText(lang === "en" ? /^Start/ : /^დაწყება/);
    expect(label.endsWith("UTC")).toBe(true);
  });

  it("mark a required field with * hidden from speech and aria-required on the control", () => {
    renderFields();
    const box = screen.getByLabelText(/^Call sign/);
    expect(box.getAttribute("aria-required")).toBe("true");
    const mark = screen
      .getByText(/^Call sign/, { selector: "label" })
      .querySelector('[aria-hidden="true"]');
    expect(mark?.textContent).toBe(" *");
    expect(screen.getByText("Fields marked * are required.")).toBeTruthy();
    expect(
      screen.getByLabelText(/^Mass/).getAttribute("aria-required"),
    ).toBeNull();
  });
});

describe("UTCDateTimeField", () => {
  it.each(["Asia/Tbilisi", "Europe/London"])(
    "round-trips 2026-03-29T00:30:00Z, and a typed 01:30, in %s",
    async (tz) => {
      process.env["TZ"] = tz;
      expect(new Date("2026-03-29T01:30:00Z").getHours()).toBe(
        tz === "Asia/Tbilisi" ? 5 : 2,
      );
      const { onSubmit } = renderFields({
        defaults: {
          callsign: "TEST01",
          heightM: 120,
          reason: "receiver maintenance",
        },
      });
      const box = screen.getByLabelText(/^Start/) as HTMLInputElement;
      expect(box.type).toBe("datetime-local");
      expect(box.value).toBe("2026-03-29T00:30");
      await send();
      expect(
        (onSubmit.mock.calls[0]?.[0] as Record<string, unknown>)["at"],
      ).toBe("2026-03-29T00:30:00Z");
      type(/^Start/, "2026-03-29T01:30");
      await send();
      expect(
        (onSubmit.mock.calls[1]?.[0] as Record<string, unknown>)["at"],
      ).toBe("2026-03-29T01:30:00Z");
    },
  );

  it("refuses an emptied time as required", async () => {
    const { container, onSubmit } = renderFields();
    fillValid();
    type(/^Start/, "");
    await send();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.querySelector('[data-field="at"]')?.textContent).toMatch(
      /Required|Not a UTC time/,
    );
  });
});

describe("BBoxField", () => {
  it("labels the four numbers in [lng, lat] order", () => {
    renderFields();
    expect(
      screen.getByText(/^Area \(WGS84, \[lng, lat\] order\)/),
    ).toBeTruthy();
    const order = ["area.0", "area.1", "area.2", "area.3"].map(
      (n) =>
        document.querySelector(`[data-field="${n}"] label`)?.textContent ?? "",
    );
    expect(order[0]).toMatch(/^West: minimum longitude \(°\)/);
    expect(order[1]).toMatch(/^South: minimum latitude \(°\)/);
    expect(order[2]).toMatch(/^East: maximum longitude \(°\)/);
    expect(order[3]).toMatch(/^North: maximum latitude \(°\)/);
  });

  it("refuses west east of east with an error on the box naming the pair", async () => {
    const { container, onSubmit } = renderFields();
    fillValid();
    type(/^West/, "45");
    type(/^East/, "44");
    await send();
    expect(onSubmit).not.toHaveBeenCalled();
    const box = container.querySelector('fieldset[data-field="area"]');
    expect(box?.getAttribute("data-invalid")).toBe("true");
    expect(box?.querySelector('[data-part="field-error"]')?.textContent).toBe(
      "West (minimum longitude) is east of East (maximum longitude)",
    );
  });

  it("accepts the twin and sends [minLng, minLat, maxLng, maxLat]", async () => {
    const { onSubmit } = renderFields();
    fillValid();
    type(/^West/, "44.75");
    await send();
    expect(
      (onSubmit.mock.calls[0]?.[0] as Record<string, unknown>)["area"],
    ).toEqual([44.75, 41.6, 44.9, 41.8]);
  });
});

describe("EnumField, CheckboxField, ReasonField", () => {
  it("offers the six trust classes with catalogue labels, and nothing chosen is null", async () => {
    const { onSubmit } = renderFields();
    const select = screen.getByLabelText(/^Trust/) as HTMLSelectElement;
    const options = [...select.options].filter((o) => o.value !== "");
    expect(options.map((o) => o.value)).toEqual([...TRUSTS]);
    expect(options.map((o) => o.textContent)).toEqual([
      "Authenticated",
      "Provider (unverified)",
      "Surveillance",
      "Broadcast (unverified)",
      "Sensor",
      "Simulated",
    ]);
    fillValid();
    await send();
    expect(
      (onSubmit.mock.calls[0]?.[0] as Record<string, unknown>)["trust"],
    ).toBeNull();
    fireEvent.change(select, { target: { value: "broadcast" } });
    fireEvent.click(screen.getByLabelText(/^I have read/));
    await send();
    const v = onSubmit.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(v["trust"]).toBe("broadcast");
    expect(v["ack"]).toBe(true);
  });

  it("counts the reason and refuses one shorter than the minimum", async () => {
    const { container, onSubmit } = renderFields();
    expect(
      container.querySelector('[data-part="reason-count"]')?.textContent,
    ).toBe("0 characters, at least 10");
    type(/^Call sign/, "TEST01");
    type(/^Height/, "120");
    type(/^Reason/, "short");
    expect(
      container.querySelector('[data-part="reason-count"]')?.textContent,
    ).toBe("5 characters, at least 10");
    await send();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-field="reason"]')?.textContent,
    ).toMatch(/The reason is too short/);
  });
});

describe("axe on every state", () => {
  it.each(["en", "ka"] as const)(
    "idle, invalid and disabled, %s",
    async (lang) => {
      const idle = renderFields({ lang });
      await axeCheck(idle.container);
      await send();
      expect(
        idle.container.querySelector('[data-part="summary"]'),
      ).not.toBeNull();
      await axeCheck(idle.container);
      cleanup();
      const disabled = renderFields({ lang, disabled: true });
      expect(
        (
          screen.getByLabelText(
            lang === "en" ? /^Call sign/ : /^სახმობი/,
          ) as HTMLInputElement
        ).disabled,
      ).toBe(true);
      await axeCheck(disabled.container);
    },
  );
});

describe("wiring", () => {
  it("refuses a field outside a Form and a control outside a Field", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() =>
      render(
        <I18nProvider lang="en">
          <Field name="x" labelKey="common.yes">
            <span />
          </Field>
        </I18nProvider>,
      ),
    ).toThrow(/needs an enclosing <Form>/);
    function Bare() {
      useFieldControl();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/needs an enclosing <Field>/);
  });
});
