"use client";
import { Fragment, type ReactNode } from "react";

import { useT } from "../../i18n/I18nProvider.js";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../breadcrumb.js";
import { cn } from "../cn.js";
import { plainLink, type LinkRenderer } from "./link.js";

/**
 * One step of a PageHeader's trail; the last is the current page.
 *
 * @public
 */
export interface Crumb {
  label: ReactNode;
  /** Absent on the current page, and on a step that is not a page. */
  href?: string;
}

/** @public */
export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: readonly Crumb[];
  /** Controls for the page, such as "New zone" or a time range. */
  actions?: ReactNode;
  /** Beside the title: a StatusBadge, a count, the data's age. */
  meta?: ReactNode;
  /** The app's router link (next/link); a plain `<a>` by default. */
  renderLink?: LinkRenderer;
  className?: string;
}

/**
 * The top of a page: the breadcrumb trail, the page's h1 with what is
 * beside it, a description, and the page's actions.
 *
 * @public
 */
export function PageHeader(props: PageHeaderProps): ReactNode {
  const {
    title,
    description,
    breadcrumbs,
    actions,
    meta,
    renderLink = plainLink,
    className,
  } = props;
  const t = useT();
  return (
    <div
      data-slot="page-header"
      className={cn("grid min-w-0 gap-3 pb-1", className)}
    >
      {breadcrumbs !== undefined && breadcrumbs.length > 0 && (
        <Breadcrumb aria-label={t("ui.breadcrumb")}>
          <BreadcrumbList className="text-xs">
            {breadcrumbs.map((c, i) => {
              const last = i === breadcrumbs.length - 1;
              return (
                <Fragment key={i}>
                  <BreadcrumbItem>
                    {last ? (
                      <BreadcrumbPage className="font-semibold">
                        {c.label}
                      </BreadcrumbPage>
                    ) : c.href === undefined ? (
                      <span>{c.label}</span>
                    ) : (
                      renderLink({
                        href: c.href,
                        className:
                          "rounded-sm underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring",
                        children: c.label,
                      })
                    )}
                  </BreadcrumbItem>
                  {!last && <BreadcrumbSeparator />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="grid min-w-0 gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="m-0 text-2xl leading-tight font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {meta !== undefined && (
              <div
                data-part="meta"
                className="flex flex-wrap items-center gap-2"
              >
                {meta}
              </div>
            )}
          </div>
          {description !== undefined && (
            <p className="m-0 max-w-prose text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions !== undefined && (
          <div
            data-part="actions"
            className="flex flex-wrap items-center gap-2"
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
