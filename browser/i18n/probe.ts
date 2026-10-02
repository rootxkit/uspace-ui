// Test helper: which face a stack sets text in, measured. Chromium has no
// API that names the face used for a run of text, so the run is drawn in
// a probe span and its width compared with the same run in one family.

/** The rendered width of `text` in `fontFamily`, in a probe span. */
export function textWidth(
  host: HTMLElement,
  fontFamily: string,
  text: string,
  upper = false,
): number {
  const span = document.createElement("span");
  span.style.fontFamily = fontFamily;
  span.style.fontSize = "32px";
  span.style.whiteSpace = "nowrap";
  if (upper) span.style.textTransform = "uppercase";
  span.textContent = text;
  host.append(span);
  const w = span.getBoundingClientRect().width;
  span.remove();
  return w;
}

/** Loads every bundled face (fonts/fonts.css) before anything is measured. */
export async function loadKitFaces(): Promise<number> {
  const loads = await Promise.all(
    ["400", "700"].flatMap((w) => [
      document.fonts.load(`${w} 32px "Noto Sans Georgian"`, "ა"),
      document.fonts.load(`${w} 32px "Noto Sans"`, "A "),
    ]),
  );
  await document.fonts.ready;
  return loads.filter((faces) => faces.length > 0).length;
}
