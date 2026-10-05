"use client";
// OutlineFields (1.0.0; uspace-ussp docs/PLAN.md Q28 gap 1): the typed and
// keyboard side of the drawing tool, beside layers/DrawLayer on the map.
// The same controlled `DrawOutline`: a polygon's vertices in the order
// given, each editable and removable, and a row to add one; or a circle's
// centre and radius. Values are read in the page's language (a `ka`
// decimal comma is a decimal) and passed on as entered.
//
// What it checks is the form of a number, not the outline: a latitude in
// [-90, 90], a longitude in [-180, 180] (WGS84 degrees) and a radius above
// zero. Whether the polygon is simple, how big it is, whether the circle
// fits anywhere: the API judges that and names the field it refuses
// (spec 00 §6; the kit's Form maps those errors). A circle's outline is
// drawn by the API, never here (DrawLayer's `circleOutline`); until the
// app has one, the circle is said in words.
//
// The vertex list is bounded by `maxVertices` (the app's bound, no
// default): at the bound the add row is disabled and says why.
import { useId, useState, type ReactNode } from "react";

import type { Key } from "../i18n/en.js";
import { useLang, useT } from "../i18n/I18nProvider.js";
import type { DrawOutline, DrawPoint } from "../model/index.js";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import { formatLocaleNumber, parseLocaleNumber } from "./number.js";

/**
 * The two outline kinds, in the order the choice lists them.
 *
 * @public
 */
export const OUTLINE_KINDS = ["polygon", "circle"] as const;
/** @public */
export type OutlineKind = (typeof OUTLINE_KINDS)[number];

/**
 * An empty outline of `kind`.
 *
 * @public
 */
export function emptyOutline(kind: OutlineKind): DrawOutline {
  return kind === "polygon"
    ? { kind: "polygon", vertices: [] }
    : { kind: "circle", center: null, radiusM: null };
}

/** WGS84 degree ranges: the form of a coordinate, not a judgement. */
const RANGES = {
  lat: { min: -90, max: 90 },
  lng: { min: -180, max: 180 },
} as const;

/** @public */
export interface OutlineFieldsProps {
  outline: DrawOutline;
  onChange(next: DrawOutline): void;
  /** The most vertices the app's API takes; required, no default. */
  maxVertices: number;
  /** True while the map shows the circle's outline as the API drew it. */
  circleOutlineShown?: boolean;
  /** The kinds offered (default both). */
  kinds?: readonly OutlineKind[];
  /** The legend's catalogue key (default `outline.legend`). */
  legendKey?: string;
}

type Axis = "lat" | "lng";

function CoordInput(props: {
  id: string;
  label: string;
  value: number | null;
  range?: { min: number; max: number };
  positive?: boolean;
  onValue(v: number | null): void;
}): ReactNode {
  const { id, label, value, range, positive, onValue } = props;
  const t = useT();
  const { lang } = useLang();
  const [text, setText] = useState(() => formatLocaleNumber(value, lang));
  const [lastValue, setLastValue] = useState(value);
  // What this field last handed up: the echo of it is not a change.
  const [emitted, setEmitted] = useState<number | null | undefined>(undefined);
  // A value changed from outside (a drag or a click on the map) replaces
  // the text; the echo of what was typed, or a value the text already
  // says, leaves the text as typed.
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== emitted && parseLocaleNumber(text, lang) !== value)
      setText(formatLocaleNumber(value, lang));
  }
  const parsed = parseLocaleNumber(text, lang);
  let error: Key | null = null;
  if (parsed !== null) {
    if (Number.isNaN(parsed)) error = "form.error.not_a_number";
    else if (range !== undefined && (parsed < range.min || parsed > range.max))
      error = "outline.error.range";
    else if (positive === true && parsed <= 0) error = "outline.error.positive";
  }
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        aria-invalid={error !== null ? true : undefined}
        aria-describedby={error !== null ? errorId : undefined}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const v = parseLocaleNumber(next, lang);
          const ok =
            v !== null &&
            !Number.isNaN(v) &&
            (range === undefined || (v >= range.min && v <= range.max)) &&
            (positive !== true || v > 0);
          const out = ok ? v : null;
          setEmitted(out);
          onValue(out);
        }}
      />
      {error !== null && (
        <p id={errorId} className="m-0 text-xs text-destructive">
          {t(error, range === undefined ? {} : range)}
        </p>
      )}
    </div>
  );
}

function PointInputs(props: {
  base: string;
  labelKey: Key;
  number: number;
  point: { lat: number | null; lng: number | null };
  onAxis(axis: Axis, v: number | null): void;
}): ReactNode {
  const t = useT();
  const { base, labelKey, number, point, onAxis } = props;
  return (
    <>
      {(["lat", "lng"] as const).map((axis) => (
        <CoordInput
          key={axis}
          id={`${base}-${axis}`}
          label={t(axis === "lat" ? "outline.latitude" : "outline.longitude", {
            point: t(labelKey, { n: number }),
          })}
          value={point[axis]}
          range={RANGES[axis]}
          onValue={(v) => onAxis(axis, v)}
        />
      ))}
    </>
  );
}

/** @public */
export function OutlineFields(props: OutlineFieldsProps): ReactNode {
  const {
    outline,
    onChange,
    maxVertices,
    circleOutlineShown = false,
    kinds = OUTLINE_KINDS,
    legendKey = "outline.legend",
  } = props;
  const t = useT();
  const { lang } = useLang();
  const base = useId();
  const [draft, setDraft] = useState<{
    lat: number | null;
    lng: number | null;
  }>({ lat: null, lng: null });
  const [draftKey, setDraftKey] = useState(0);
  // A circle's centre while only one of its numbers is typed.
  const [centre, setCentre] = useState<{
    lat: number | null;
    lng: number | null;
  }>({ lat: null, lng: null });

  const full =
    outline.kind === "polygon" && outline.vertices.length >= maxVertices;
  const draftPoint: DrawPoint | null =
    draft.lat !== null && draft.lng !== null
      ? { lat: draft.lat, lng: draft.lng }
      : null;

  const setVertex = (i: number, axis: Axis, v: number | null): void => {
    if (outline.kind !== "polygon" || v === null) return;
    const vertices = [...outline.vertices];
    const old = vertices[i];
    if (old === undefined) return;
    vertices[i] = { ...old, [axis]: v };
    onChange({ kind: "polygon", vertices });
  };

  const fmt = (v: number | null): string =>
    v === null ? t("common.dash") : formatLocaleNumber(v, lang);

  return (
    <fieldset
      className="flex flex-col gap-3 rounded-md border border-border p-3"
      data-outline={outline.kind}
    >
      <legend className="px-1 text-sm font-medium">{t(legendKey)}</legend>
      <p className="m-0 text-xs text-muted-foreground">{t("outline.hint")}</p>
      {kinds.length > 1 && (
        <div
          role="radiogroup"
          aria-label={t("outline.kind")}
          className="flex gap-4 text-sm"
        >
          {kinds.map((k) => (
            <label key={k} className="flex items-center gap-1">
              <input
                type="radio"
                name={`${base}-kind`}
                value={k}
                checked={outline.kind === k}
                onChange={() => {
                  if (outline.kind !== k) onChange(emptyOutline(k));
                }}
              />
              {t(k === "polygon" ? "outline.polygon" : "outline.circle")}
            </label>
          ))}
        </div>
      )}

      {outline.kind === "polygon" ? (
        <>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {outline.vertices.map((p, i) => (
              <li
                // The index is the vertex's identity: its number on the map.
                key={i}
                className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
                data-vertex={i + 1}
              >
                <PointInputs
                  base={`${base}-v${i}`}
                  labelKey="outline.point"
                  number={i + 1}
                  point={p}
                  onAxis={(axis, v) => setVertex(i, axis, v)}
                />
                <Button
                  type="button"
                  variant="outline"
                  aria-label={t("outline.remove", { n: i + 1 })}
                  onClick={() =>
                    onChange({
                      kind: "polygon",
                      vertices: outline.vertices.filter((_, j) => j !== i),
                    })
                  }
                >
                  {t("outline.remove_short")}
                </Button>
              </li>
            ))}
          </ol>
          <div
            key={draftKey}
            className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
            data-add-vertex=""
          >
            <PointInputs
              base={`${base}-add`}
              labelKey="outline.new_point"
              number={outline.vertices.length + 1}
              point={draft}
              onAxis={(axis, v) => setDraft((d) => ({ ...d, [axis]: v }))}
            />
            <Button
              type="button"
              disabled={full || draftPoint === null}
              onClick={() => {
                if (draftPoint === null || full) return;
                onChange({
                  kind: "polygon",
                  vertices: [...outline.vertices, draftPoint],
                });
                setDraft({ lat: null, lng: null });
                setDraftKey((k) => k + 1);
              }}
            >
              {t("outline.add")}
            </Button>
          </div>
          <p className="m-0 text-xs" role="status" data-vertex-count="">
            {full
              ? t("outline.full", { max: maxVertices })
              : t("outline.count", {
                  count: outline.vertices.length,
                  max: maxVertices,
                })}
          </p>
        </>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_1fr] gap-2">
            <PointInputs
              base={`${base}-c`}
              labelKey="outline.center"
              number={1}
              point={outline.center ?? centre}
              onAxis={(axis, v) => {
                if (outline.kind !== "circle" || v === null) return;
                const next = { ...(outline.center ?? centre), [axis]: v };
                setCentre(next);
                // A centre is placed once both of its numbers are given.
                if (next.lat !== null && next.lng !== null)
                  onChange({
                    ...outline,
                    center: { lat: next.lat, lng: next.lng },
                  });
              }}
            />
          </div>
          <CoordInput
            id={`${base}-radius`}
            label={t("outline.radius")}
            value={outline.radiusM}
            positive
            onValue={(v) => {
              if (outline.kind === "circle")
                onChange({ ...outline, radiusM: v });
            }}
          />
          <p className="m-0 text-sm" data-circle-words="">
            {t("outline.circle_words", {
              lat: fmt(outline.center?.lat ?? null),
              lng: fmt(outline.center?.lng ?? null),
              radius: fmt(outline.radiusM),
            })}
          </p>
          <p
            className="m-0 text-xs text-muted-foreground"
            data-circle-outline=""
          >
            {t(
              circleOutlineShown
                ? "outline.circle_drawn"
                : "outline.circle_not_drawn",
            )}
          </p>
        </>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={
            outline.kind === "polygon"
              ? outline.vertices.length === 0
              : outline.center === null && outline.radiusM === null
          }
          onClick={() => {
            onChange(emptyOutline(outline.kind));
            setDraft({ lat: null, lng: null });
            setCentre({ lat: null, lng: null });
            setDraftKey((k) => k + 1);
          }}
        >
          {t("outline.clear")}
        </Button>
      </div>
    </fieldset>
  );
}
