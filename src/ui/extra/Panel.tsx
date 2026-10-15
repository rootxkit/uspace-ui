"use client";
import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "../cn.js";

/** @public */
export interface PanelProps extends Omit<
  ComponentProps<"section">,
  "title" | "children"
> {
  /** The heading; the section is named by it. */
  title?: ReactNode;
  description?: ReactNode;
  /** Controls in the header, such as a filter or "Export". */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Classes of the body, such as a flex layout for what fills it. */
  bodyClassName?: string;
  /** `none` lets a table or a map run edge to edge. */
  padding?: "default" | "none";
  /** The heading's level, 2 by default (a page's h1 is its PageHeader). */
  headingLevel?: 2 | 3 | 4;
  children?: ReactNode;
}

const HEADING = { 2: "h2", 3: "h3", 4: "h4" } as const;

/**
 * A titled surface of the console: a header with its title, description
 * and actions, a body, and an optional footer. The kit's operations
 * counterpart of Card, used by MapPanel and the dashboard's lists.
 *
 * @public
 */
export function Panel(props: PanelProps): ReactNode {
  const {
    title,
    description,
    actions,
    footer,
    padding = "default",
    bodyClassName,
    headingLevel = 2,
    children,
    className,
    ...rest
  } = props;
  const headingId = useId();
  const Heading = HEADING[headingLevel];
  const hasHeader =
    title !== undefined || description !== undefined || actions !== undefined;
  return (
    <section
      data-slot="panel"
      aria-labelledby={title === undefined ? undefined : headingId}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-panel border border-border bg-card text-card-foreground shadow-panel",
        className,
      )}
      {...rest}
    >
      {hasHeader && (
        <header
          data-part="header"
          className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3"
        >
          <div className="grid min-w-0 gap-0.5">
            {title !== undefined && (
              <Heading
                id={headingId}
                className="m-0 text-sm leading-6 font-semibold text-foreground"
              >
                {title}
              </Heading>
            )}
            {description !== undefined && (
              <p className="m-0 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions !== undefined && (
            <div
              data-part="actions"
              className="flex shrink-0 flex-wrap items-center gap-2"
            >
              {actions}
            </div>
          )}
        </header>
      )}
      <div
        data-part="body"
        className={cn(
          "min-w-0 flex-1",
          padding === "default" && "p-[var(--us-space-panel)]",
          bodyClassName,
        )}
      >
        {children}
      </div>
      {footer !== undefined && (
        <footer
          data-part="footer"
          className="border-t border-border bg-panel-header px-4 py-2.5 text-xs text-muted-foreground"
        >
          {footer}
        </footer>
      )}
    </section>
  );
}
