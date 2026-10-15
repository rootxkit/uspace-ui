import type { ComponentProps, ReactNode } from "react";

import type { StatusTone } from "../../theme/status.js";
import { cn } from "../cn.js";
import { TONE_FILL, TONE_OUTLINE, TONE_SOFT } from "./tones.js";

/** @public */
export interface StatusBadgeProps extends Omit<
  ComponentProps<"span">,
  "children"
> {
  tone: StatusTone;
  /**
   * The status in words. Required: the tone only repeats it (WCAG 1.4.1),
   * so a badge without text would be a colour alone.
   */
  children: ReactNode;
  /** `soft` (a tint, the default) or `outline` (a border, no tint). */
  variant?: "soft" | "outline";
  /** A dot before the text; shown unless false. */
  dot?: boolean;
}

/**
 * A status in words with its tone: a source's state, an environment, a
 * count's condition. It shows what the app says; it decides nothing.
 *
 * @public
 */
export function StatusBadge(props: StatusBadgeProps): ReactNode {
  const {
    tone,
    children,
    variant = "soft",
    dot = true,
    className,
    ...rest
  } = props;
  return (
    <span
      data-slot="status-badge"
      data-tone={tone}
      data-variant={variant}
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap",
        variant === "soft" ? TONE_SOFT[tone] : TONE_OUTLINE[tone],
        className,
      )}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden="true"
          data-part="dot"
          className={cn("size-1.5 shrink-0 rounded-full", TONE_FILL[tone])}
        />
      )}
      {children}
    </span>
  );
}
