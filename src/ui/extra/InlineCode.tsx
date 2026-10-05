import type { ComponentProps, ReactNode } from "react";

import { cn } from "../cn.js";

/**
 * An identifier or a value shown verbatim inside running text.
 *
 * @beta
 */
export function InlineCode({
  className,
  ...props
}: ComponentProps<"code">): ReactNode {
  return (
    <code
      data-slot="inline-code"
      className={cn(
        "rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.875em] text-foreground",
        className,
      )}
      {...props}
    />
  );
}
