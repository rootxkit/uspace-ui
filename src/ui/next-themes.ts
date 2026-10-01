"use client";
// Stands in for `next-themes`, which upstream `sonner.tsx` imports for the
// current theme. The kit's ThemeProvider owns the scheme (next-themes would
// keep it in localStorage, which PLAN §6.1 forbids), so the vendored file's
// import path points here and the file itself stays unchanged
// (src/ui/UPGRADING.md). Outside a ThemeProvider the toaster follows the
// system preference, which is what sonner does with "system".
import { useOptionalTheme } from "../theme/ThemeProvider.js";

export function useTheme(): { theme: "light" | "dark" | "system" } {
  return { theme: useOptionalTheme()?.resolved ?? "system" };
}
