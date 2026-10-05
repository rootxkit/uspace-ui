// OutlineFields (1.0.0; uspace-ussp Q28 gap 1): the typed path to every
// point of an outline in both languages. A point is added, edited and
// removed as typed; the bound refuses an add and says so, and below it the
// add works (E-01, E-10); a coordinate out of WGS84 range or a radius of
// zero is refused with its reason and changes nothing; a circle is said in
// words and says whether the map shows the server's outline; a point moved
// on the map shows in its fields.
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DrawOutline } from "../model/index.js";
import { axeCheck } from "../test/axe.js";
import { renderWithKit } from "../test/render.js";
import {
  OutlineFields,
  emptyOutline,
  type OutlineFieldsProps,
} from "./OutlineFields.js";

afterEach(() => {
  cleanup();
});

const A = { lat: 41.7151, lng: 44.8271 };
const B = { lat: 41.72, lng: 44.83 };

function mount(
  start: DrawOutline,
  over: Partial<OutlineFieldsProps> = {},
  lang: "en" | "ka" = "en",
) {
  const changes: DrawOutline[] = [];
  let set: (o: DrawOutline) => void = () => undefined;
  function Harness() {
    const [outline, setOutline] = useState(start);
    set = setOutline;
    return (
      <OutlineFields
        maxVertices={3}
        {...over}
        outline={outline}
        onChange={(o) => {
          changes.push(o);
          setOutline(o);
        }}
      />
    );
  }
  const r = renderWithKit(<Harness />, { lang });
  return { ...r, changes, setOutline: (o: DrawOutline) => set(o) };
}

const type = (label: RegExp | string, value: string): void => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe("OutlineFields: a polygon", () => {
  it("adds a typed point, edits it and removes it", async () => {
    const { changes, container } = mount(emptyOutline("polygon"));
    expect(
      (screen.getByRole("button", { name: "Add point" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    type("New point 1: latitude (degrees, WGS84)", "41.7151");
    type("New point 1: longitude (degrees, WGS84)", "44.8271");
    fireEvent.click(screen.getByRole("button", { name: "Add point" }));
    expect(changes.at(-1)).toEqual({ kind: "polygon", vertices: [A] });
    // The add row is empty again, numbered for the next point.
    expect(
      (screen.getByLabelText(/New point 2: latitude/) as HTMLInputElement)
        .value,
    ).toBe("");
    type("Point 1: latitude (degrees, WGS84)", "41.72");
    expect(changes.at(-1)).toEqual({
      kind: "polygon",
      vertices: [{ lat: 41.72, lng: A.lng }],
    });
    expect(screen.getByText("1 of at most 3 points")).toBeTruthy();
    await axeCheck(container);
    fireEvent.click(screen.getByRole("button", { name: "Remove point 1" }));
    expect(changes.at(-1)).toEqual({ kind: "polygon", vertices: [] });
  });

  it("refuses an add at the bound and says why", () => {
    const { changes } = mount({ kind: "polygon", vertices: [A, B, A] });
    type(/New point 4: latitude/, "41");
    type(/New point 4: longitude/, "44");
    const add = screen.getByRole("button", {
      name: "Add point",
    }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.click(add);
    expect(changes).toEqual([]);
    expect(
      screen.getByText(
        "This outline takes at most 3 points: remove one to add another.",
      ),
    ).toBeTruthy();
  });

  it("adds below the bound (the twin)", () => {
    const { changes } = mount({ kind: "polygon", vertices: [A, B] });
    type(/New point 3: latitude/, "41");
    type(/New point 3: longitude/, "44");
    fireEvent.click(screen.getByRole("button", { name: "Add point" }));
    expect(changes).toEqual([
      { kind: "polygon", vertices: [A, B, { lat: 41, lng: 44 }] },
    ]);
  });

  it("refuses a latitude out of range and text that is not a number, changing nothing", () => {
    const { changes } = mount({ kind: "polygon", vertices: [A] });
    type(/Point 1: latitude/, "95");
    expect(screen.getByText("Not between -90 and 90 degrees")).toBeTruthy();
    expect(
      screen.getByLabelText(/Point 1: latitude/).getAttribute("aria-invalid"),
    ).toBe("true");
    type(/Point 1: longitude/, "east");
    expect(screen.getByText("Not a number")).toBeTruthy();
    expect(changes).toEqual([]);
    // A negative number is typed through "-" without the text snapping back.
    type(/Point 1: latitude/, "-");
    expect(
      (screen.getByLabelText(/Point 1: latitude/) as HTMLInputElement).value,
    ).toBe("-");
    type(/Point 1: latitude/, "-41.5");
    expect(changes).toEqual([
      { kind: "polygon", vertices: [{ lat: -41.5, lng: A.lng }] },
    ]);
  });

  it("shows a point moved on the map in its fields", () => {
    const { setOutline } = mount({ kind: "polygon", vertices: [A] });
    const lat = screen.getByLabelText(/Point 1: latitude/) as HTMLInputElement;
    expect(lat.value).toBe("41.7151");
    act(() => setOutline({ kind: "polygon", vertices: [B] }));
    expect(
      (screen.getByLabelText(/Point 1: latitude/) as HTMLInputElement).value,
    ).toBe("41.72");
  });

  it("reads a Georgian decimal comma (ka)", () => {
    const { changes } = mount({ kind: "polygon", vertices: [] }, {}, "ka");
    type(/ახალი წერტილი 1: განედი/, "41,5");
    type(/ახალი წერტილი 1: გრძედი/, "44,75");
    fireEvent.click(screen.getByRole("button", { name: "წერტილის დამატება" }));
    expect(changes.at(-1)).toEqual({
      kind: "polygon",
      vertices: [{ lat: 41.5, lng: 44.75 }],
    });
  });
});

describe("OutlineFields: a circle", () => {
  it("places the centre once both numbers are typed, and takes the radius", async () => {
    const { changes, container } = mount(emptyOutline("circle"));
    type(/Centre: latitude/, "41.7151");
    expect(changes).toEqual([]);
    type(/Centre: longitude/, "44.8271");
    expect(changes.at(-1)).toEqual({
      kind: "circle",
      center: A,
      radiusM: null,
    });
    type("Radius (m)", "300");
    expect(changes.at(-1)).toEqual({ kind: "circle", center: A, radiusM: 300 });
    expect(container.querySelector("[data-circle-words]")?.textContent).toBe(
      "Circle: centre 41.7151, 44.8271 (degrees, WGS84); radius 300 m",
    );
    await axeCheck(container);
  });

  it("refuses a radius of zero with its reason", () => {
    const { changes } = mount({ kind: "circle", center: A, radiusM: 300 });
    type("Radius (m)", "0");
    expect(screen.getByText("Must be more than zero")).toBeTruthy();
    expect(changes).toEqual([{ kind: "circle", center: A, radiusM: null }]);
  });

  it("says the map shows the centre only without the server's outline", () => {
    const { container } = mount({ kind: "circle", center: A, radiusM: 300 });
    expect(container.querySelector("[data-circle-outline]")?.textContent).toBe(
      "The system draws a circle's outline; until it has, the map shows its centre only.",
    );
  });

  it("says the map shows the system's outline when the app has one (the twin)", () => {
    const { container } = mount(
      { kind: "circle", center: A, radiusM: 300 },
      { circleOutlineShown: true },
    );
    expect(container.querySelector("[data-circle-outline]")?.textContent).toBe(
      "The circle on the map is the outline the system drew.",
    );
  });

  it("says it in Georgian, a missing number a dash (ka)", () => {
    const { container } = mount(
      { kind: "circle", center: null, radiusM: null },
      {},
      "ka",
    );
    expect(container.querySelector("[data-circle-words]")?.textContent).toBe(
      "წრე: ცენტრი —, — (გრადუსი, WGS84); რადიუსი — მ",
    );
  });
});

describe("OutlineFields: the kind and clearing", () => {
  it("switching the kind starts an empty outline of it; choosing the same changes nothing", () => {
    const onChange = vi.fn();
    renderWithKit(
      <OutlineFields
        outline={{ kind: "polygon", vertices: [A] }}
        onChange={onChange}
        maxVertices={3}
      />,
    );
    fireEvent.click(screen.getByLabelText("Polygon"));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Circle"));
    expect(onChange).toHaveBeenCalledWith(emptyOutline("circle"));
  });

  it("offers one kind without a choice", () => {
    renderWithKit(
      <OutlineFields
        outline={emptyOutline("polygon")}
        onChange={() => undefined}
        maxVertices={3}
        kinds={["polygon"]}
      />,
    );
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("clears the outline; clear is disabled while there is nothing", () => {
    const { changes } = mount({ kind: "polygon", vertices: [A, B] });
    fireEvent.click(screen.getByRole("button", { name: "Clear the outline" }));
    expect(changes).toEqual([{ kind: "polygon", vertices: [] }]);
    expect(
      (
        screen.getByRole("button", {
          name: "Clear the outline",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
