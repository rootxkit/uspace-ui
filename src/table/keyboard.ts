// Keyboard movement in the data grid (WAI-ARIA Authoring Practices, "Data
// Grid", keyboard interaction): where focus goes for each key, as a pure
// function of the key, the current cell and the grid's size. Row 0 is the
// header row; rows 1..rows-1 are the body rows the grid can reach (the
// page, or every row when virtualised).

export interface GridPos {
  row: number;
  col: number;
}

export interface GridSize {
  /** Rows including the header row. */
  rows: number;
  cols: number;
}

/**
 * Rows moved by PageUp and PageDown. A display-only constant (APG: "an
 * author-determined number of rows").
 */
export const PAGE_STEP_ROWS = 10;

export interface GridKey {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(Math.max(v, lo), hi);

/**
 * The cell focus moves to for `k`, or null when the key is not a grid
 * movement key (the event is then left alone). Movement stops at the
 * edges; it never wraps. PageUp and PageDown stay within the body rows
 * when they start there.
 */
export function nextGridPos(
  k: GridKey,
  pos: GridPos,
  size: GridSize,
  pageStep: number = PAGE_STEP_ROWS,
): GridPos | null {
  const lastRow = size.rows - 1;
  const lastCol = size.cols - 1;
  if (lastRow < 0 || lastCol < 0) return null;
  const ctrl = k.ctrlKey || k.metaKey;
  const firstBody = Math.min(1, lastRow);
  switch (k.key) {
    case "ArrowRight":
      return { row: pos.row, col: clamp(pos.col + 1, 0, lastCol) };
    case "ArrowLeft":
      return { row: pos.row, col: clamp(pos.col - 1, 0, lastCol) };
    case "ArrowDown":
      return { row: clamp(pos.row + 1, 0, lastRow), col: pos.col };
    case "ArrowUp":
      return { row: clamp(pos.row - 1, 0, lastRow), col: pos.col };
    case "Home":
      return ctrl ? { row: 0, col: 0 } : { row: pos.row, col: 0 };
    case "End":
      return ctrl
        ? { row: lastRow, col: lastCol }
        : { row: pos.row, col: lastCol };
    case "PageDown":
      return { row: clamp(pos.row + pageStep, 0, lastRow), col: pos.col };
    case "PageUp":
      return {
        row: clamp(
          pos.row - pageStep,
          pos.row >= firstBody ? firstBody : 0,
          lastRow,
        ),
        col: pos.col,
      };
    default:
      return null;
  }
}
