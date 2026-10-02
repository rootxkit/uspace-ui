// Form (WP-10, PLAN §3.15) in jsdom: an API field error lands on its field
// and the summary counts it; an unknown path is listed with its path (the
// pair); 100 errors with `truncated` say there are more; submit is
// disabled while the promise is pending and re-enabled after (both
// branches); a submit that succeeds clears the earlier errors (E-02);
// Retry-After counts down on the button; the summary takes focus and its
// links focus their field; a refusal without field errors and a failure
// without an answer each say so.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { I18nProvider } from "../i18n/I18nProvider.js";
import type { Lang } from "../i18n/lang.js";
import { axeCheck } from "../test/axe.js";
import { formCounters, resetFormCountersForTests } from "./counters.js";
import { NumberField, TextField } from "./fields.js";
import {
  FORM_CATALOGUES,
  ZONE_PROBLEM,
  apiError,
  manyErrors,
} from "./fixtures.testing.js";
import { Form, type FormProps } from "./Form.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetFormCountersForTests();
});

const schema = z.object({
  features: z.array(
    z.object({
      properties: z.object({ name: z.string().min(1), upper: z.number() }),
    }),
  ),
});

const DEFAULTS = {
  features: [{ properties: { name: "TEST zone", upper: 900 } }],
};

function renderForm(
  onSubmit: FormProps<typeof schema>["onSubmit"],
  lang: Lang = "en",
) {
  return render(
    <I18nProvider lang={lang} catalogues={FORM_CATALOGUES}>
      <Form
        schema={schema}
        defaults={DEFAULTS}
        onSubmit={onSubmit}
        submitLabelKey="zone.form.submit"
      >
        <TextField
          name="features.0.properties.name"
          labelKey="zone.form.name"
          required
        />
        <NumberField
          name="features.0.properties.upper"
          labelKey="zone.form.upper"
          unit="form.unit.m"
          datum="AMSL"
          required
        />
      </Form>
    </I18nProvider>,
  );
}

const submit = () =>
  screen.getByRole("button", {
    name: /Publish zone|Sending|Try again|ზონის გამოქვეყნება/,
  });

async function send() {
  await act(async () => {
    fireEvent.click(submit());
  });
}

const summary = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-part="summary"]');

describe("API field errors", () => {
  it("puts features[0].properties.name on the field registered as features.0.properties.name; count 1", async () => {
    const { container } = renderForm(async () => [
      { field: "features[0].properties.name", reason: "already in use" },
    ]);
    await send();
    const box = screen.getByLabelText(/^Name/);
    expect(box.getAttribute("aria-invalid")).toBe("true");
    const described = box.getAttribute("aria-describedby") ?? "";
    const error = described
      .split(" ")
      .map((id) => document.getElementById(id))
      .find((el) => el?.getAttribute("data-part") === "field-error");
    expect(error?.textContent).toBe("already in use");
    expect(summary(container)?.getAttribute("data-count")).toBe("1");
    expect(summary(container)?.textContent).toMatch(
      /1 problem: correct it and send again/,
    );
    expect(container.querySelector('[data-part="field-errors"]')).toBeNull();
    expect(formCounters().field_error_unmapped).toBe(0);
  });

  it("lists an error with an unknown path, with its path, and counts it (the pair)", async () => {
    const { container } = renderForm(async () => [
      {
        field: "features[0].geometry[0].horizontalProjection",
        reason: "ring not closed",
      },
    ]);
    await send();
    const list = container.querySelector('[data-part="field-errors"]');
    expect(list?.textContent).toMatch(
      /features\[0\]\.geometry\[0\]\.horizontalProjection: ring not closed/,
    );
    expect(summary(container)?.getAttribute("data-count")).toBe("1");
    expect(
      screen.getByLabelText(/^Name/).getAttribute("aria-invalid"),
    ).toBeNull();
    expect(formCounters().field_error_unmapped).toBe(1);
  });

  it("reads a thrown ApiError: problem, mapped and unmapped errors, a JSON pointer too", async () => {
    const problem = {
      ...ZONE_PROBLEM,
      errors: [
        ...ZONE_PROBLEM.errors,
        { field: "/features/0/properties/name", reason: "too long" },
        { field: "features[0].properties.name", reason: "reserved" },
      ],
    };
    const { container } = renderForm(async () => {
      throw apiError(problem);
    });
    await send();
    expect(summary(container)?.getAttribute("data-count")).toBe("3");
    expect(summary(container)?.textContent).toMatch(
      /The zone dataset was refused \(status 422\)\. 2 problems/,
    );
    expect(
      container.querySelector('[data-field="features.0.properties.name"]')
        ?.textContent,
    ).toMatch(/too long; reserved/);
    expect(
      container.querySelector('[data-field="features.0.properties.upper"]')
        ?.textContent,
    ).toMatch(/must be above the lower limit/);
  });

  it("says when the API cut the list at 100, and lists every one it sent", async () => {
    const { container } = renderForm(async () => {
      throw apiError({
        ...ZONE_PROBLEM,
        errors: manyErrors(100),
        truncated: true,
      });
    });
    await send();
    const list = container.querySelector('[data-part="field-errors"]');
    expect(list?.querySelectorAll("li")).toHaveLength(100);
    expect(
      container.querySelector('[data-part="truncated"]')?.textContent,
    ).toMatch(/only the first problems; there are more/);
    expect(summary(container)?.getAttribute("data-count")).toBe("100");
  });

  it("shows no truncation note when the list was not cut (the twin)", async () => {
    const { container } = renderForm(async () => {
      throw apiError({ ...ZONE_PROBLEM, errors: manyErrors(3) });
    });
    await send();
    expect(container.querySelector('[data-part="truncated"]')).toBeNull();
  });

  it("names a refusal without field errors by its problem", async () => {
    const { container } = renderForm(async () => {
      throw apiError({
        ...ZONE_PROBLEM,
        title: "Conflict",
        status: 409,
        detail: null,
        errors: [],
      });
    });
    await send();
    expect(summary(container)?.textContent).toMatch(
      /The server refused the request.*Conflict \(status 409\)\./,
    );
    expect(formCounters().submit_refused).toBe(1);
  });

  it("says the request did not reach the server when it throws something else", async () => {
    const { container } = renderForm(async () => {
      throw new TypeError("network down");
    });
    await send();
    expect(summary(container)?.textContent).toMatch(/did not reach the server/);
    expect(formCounters().submit_failed).toBe(1);
  });
});

describe("submit", () => {
  it("is disabled while the request is pending and enabled after (both branches)", async () => {
    let resolve: () => void = () => undefined;
    const pending = new Promise<undefined>((r) => {
      resolve = () => {
        r(undefined);
      };
    });
    const { container } = renderForm(() => pending);
    expect((submit() as HTMLButtonElement).disabled).toBe(false);
    await send();
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    expect(submit().textContent).toBe("Sending");
    expect(container.querySelector("form")?.getAttribute("aria-busy")).toBe(
      "true",
    );
    await act(async () => {
      resolve();
      await pending;
    });
    expect((submit() as HTMLButtonElement).disabled).toBe(false);
    expect(submit().textContent).toBe("Publish zone");
  });

  it("clears the earlier errors when a later submit succeeds (E-02)", async () => {
    let refuse = true;
    const { container } = renderForm(async () =>
      refuse
        ? [
            { field: "features[0].properties.name", reason: "already in use" },
            { field: "elsewhere", reason: "TEST" },
          ]
        : undefined,
    );
    await send();
    expect(summary(container)).not.toBeNull();
    refuse = false;
    await send();
    expect(summary(container)).toBeNull();
    expect(
      screen.getByLabelText(/^Name/).getAttribute("aria-invalid"),
    ).toBeNull();
    expect(container.querySelector('[data-part="field-error"]')).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Saved");
  });

  it("counts Retry-After down on the button, then sends again", async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn(async () => {
      throw apiError({ ...ZONE_PROBLEM, status: 503, errors: [] }, 3);
    });
    renderForm(onSubmit);
    await send();
    expect(submit().textContent).toBe("Try again in 3 seconds");
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(submit().textContent).toBe("Try again in 2 seconds");
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(submit().textContent).toBe("Try again in 1 second");
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(submit().textContent).toBe("Publish zone");
    expect((submit() as HTMLButtonElement).disabled).toBe(false);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not call onSubmit for a shape error, and the summary takes focus", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const { container } = renderForm(onSubmit);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^Upper limit/), {
      target: { value: "abc" },
    });
    await send();
    expect(onSubmit).not.toHaveBeenCalled();
    const s = summary(container);
    expect(s?.getAttribute("data-count")).toBe("2");
    expect(document.activeElement).toBe(s);
    expect(s?.textContent).toMatch(/Name: Required/);
    expect(s?.textContent).toMatch(/Upper limit \(m, AMSL\): Not a number/);
    // A link in the summary focuses its field.
    fireEvent.click(
      within(s as HTMLElement).getByRole("link", { name: "Name" }),
    );
    expect(document.activeElement).toBe(screen.getByLabelText(/^Name/));
    await axeCheck(container);
  });

  it("speaks Georgian in the summary and the field errors", async () => {
    const { container } = renderForm(async () => undefined, "ka");
    fireEvent.change(screen.getByLabelText(/^სახელი/), {
      target: { value: "" },
    });
    await send();
    expect(summary(container)?.textContent).toMatch(/1 პრობლემა/);
    expect(summary(container)?.textContent).toMatch(/სავალდებულოა/);
    await axeCheck(container);
  });

  it("re-enables after a refusal and keeps the values typed", async () => {
    renderForm(async () => [{ field: "x", reason: "TEST" }]);
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "GEO-TEST zone 2" },
    });
    await send();
    await waitFor(() => {
      expect((submit() as HTMLButtonElement).disabled).toBe(false);
    });
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(
      "GEO-TEST zone 2",
    );
  });
});
