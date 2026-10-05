import type { ComponentProps, ReactNode } from "react";

import { cn } from "../cn.js";

/**
 * A key or key combination, as in "press Esc to close".
 *
 * @beta
 */
export function Kbd({ className, ...props }: ComponentProps<"kbd">): ReactNode {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-sm border border-border bg-muted px-1 font-mono text-xs text-foreground",
        className,
      )}
      {...props}
    />
  );
}
