// `cn()`, the class-name helper every vendored shadcn/ui component imports
// (shadcn's `lib/utils`; the registry names it `cn`). Upstream source.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** @public */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
