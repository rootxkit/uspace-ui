import type { ReactNode } from "react";

import { cn } from "../cn.js";

/** @public */
export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** A control the person can use, such as "Clear filters". */
  action?: ReactNode;
  className?: string;
}

/**
 * A visible "nothing here" with its reason (LESSONS E-02): an empty list
 * says why it is empty instead of rendering a blank.
 *
 * @public
 */
export function EmptyState(props: EmptyStateProps): ReactNode {
  const { title, description, icon, action, className } = props;
  return (
    <div
      data-slot="empty-state"
      role="status"
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center",
        className,
      )}
    >
      {icon !== undefined && (
        <div aria-hidden="true" className="text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="m-0 font-medium text-foreground">{title}</p>
      {description !== undefined && (
        <p className="m-0 text-sm text-muted-foreground">{description}</p>
      )}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  );
}
