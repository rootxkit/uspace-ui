"use client";
// AppShell (1.1.0): the frame every console page sits in. A left sidebar
// with the app's navigation groups, collapsible to icons (and a sheet on
// a narrow screen); a top bar with the system name, the environment, the
// feed's live/stale pill, the app's actions, the language switch and the
// user menu; a skip link; the page's <main>. It holds no data and makes
// no decision: the app passes which item is current, what the feed's
// state is, who is signed in. The collapsed state is the app's to keep
// (`onCollapsedChange`); the kit stores nothing (PLAN §6.1).
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { useT } from "../../i18n/I18nProvider.js";
import type { StatusTone } from "../../theme/status.js";
import { cn } from "../cn.js";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "../sheet.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../tooltip.js";
import { LanguageSwitch } from "./LanguageSwitch.js";
import { plainLink, type LinkRenderer } from "./link.js";
import { StatusBadge } from "./StatusBadge.js";

/** @public */
export interface NavItem {
  /** Stable key of the item. */
  id: string;
  label: ReactNode;
  href: string;
  /** A 16 px icon (lucide-react); shown alone when the sidebar is collapsed. */
  icon?: ReactNode;
  /** The current page: the app's router decides, the kit marks it. */
  active?: boolean;
  /** A count or a StatusBadge after the label; hidden when collapsed. */
  badge?: ReactNode;
}

/** @public */
export interface NavGroup {
  id: string;
  /** The group's heading; a group without one runs on from the last. */
  label?: ReactNode;
  items: readonly NavItem[];
}

/** @public */
export interface ShellEnvironment {
  /** As configured, such as "Training" or "Test". */
  name: ReactNode;
  tone: StatusTone;
}

/** @public */
export interface AppShellProps {
  /** The system's name from configuration (`Brand.name`). */
  systemName: ReactNode;
  /** A mark for the sidebar's head, such as the brand logo. */
  logo?: ReactNode;
  nav: readonly NavGroup[];
  environment?: ShellEnvironment;
  /** The feed's pill: a `StatusPill`. */
  status?: ReactNode;
  /** The app's own controls in the top bar, before the language switch. */
  actions?: ReactNode;
  /** The language switch; shown unless false. */
  languageSwitch?: boolean;
  /** The user menu: a `UserMenu`, or a "Sign in" link when signed out. */
  user?: ReactNode;
  /** Below the navigation, such as the build or the accessibility note. */
  sidebarFooter?: ReactNode;
  /** Controlled collapsed state of the sidebar. */
  collapsed?: boolean;
  /** Uncontrolled start; `false` by default. */
  defaultCollapsed?: boolean;
  onCollapsedChange?(collapsed: boolean): void;
  /** The app's router link (next/link); a plain `<a>` by default. */
  renderLink?: LinkRenderer;
  /** The id of <main>, the skip link's target. */
  mainId?: string;
  children?: ReactNode;
  className?: string;
}

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0";

function NavLink(props: {
  item: NavItem;
  collapsed: boolean;
  renderLink: LinkRenderer;
}): ReactNode {
  const { item, collapsed, renderLink } = props;
  const link = renderLink({
    href: item.href,
    ...(item.active === true ? { "aria-current": "page" as const } : {}),
    className: cn(
      "group/nav relative flex h-9 min-w-0 items-center gap-3 rounded-md px-2.5 text-sm font-semibold text-sidebar-text no-underline transition-colors hover:bg-hover aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-text",
      FOCUS,
      collapsed && "justify-center px-0",
    ),
    children: (
      <>
        {item.active === true && (
          <span
            aria-hidden="true"
            data-part="active-mark"
            className="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-brand-accent"
          />
        )}
        {item.icon !== undefined && (
          <span
            aria-hidden="true"
            className="inline-flex size-4 shrink-0 text-sidebar-muted group-aria-[current=page]/nav:text-accent-text [&>svg]:size-4"
          >
            {item.icon}
          </span>
        )}
        <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>
          {item.label}
        </span>
        {!collapsed && item.badge !== undefined && (
          <span className="ml-auto shrink-0 text-xs font-semibold">
            {item.badge}
          </span>
        )}
      </>
    ),
  });
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function NavGroups(props: {
  nav: readonly NavGroup[];
  collapsed: boolean;
  renderLink: LinkRenderer;
  label: string;
}): ReactNode {
  const { nav, collapsed, renderLink, label } = props;
  const baseId = useId();
  return (
    <nav aria-label={label} className="grid gap-4 px-3 py-4">
      {nav.map((g, gi) => {
        const headingId = `${baseId}-${String(gi)}`;
        const labelled = g.label !== undefined;
        return (
          <div
            key={g.id}
            role={labelled ? "group" : undefined}
            aria-labelledby={labelled ? headingId : undefined}
            className="grid gap-1"
          >
            {labelled && (
              <p
                id={headingId}
                className={cn(
                  "m-0 px-2.5 pb-1 text-2xs font-semibold tracking-[var(--us-tracking-label)] text-sidebar-muted",
                  collapsed && "sr-only",
                )}
              >
                {g.label}
              </p>
            )}
            {collapsed && gi > 0 && (
              <span aria-hidden="true" className="mx-2 mb-1 h-px bg-border" />
            )}
            <ul className="m-0 grid list-none gap-0.5 p-0">
              {g.items.map((item) => (
                <li key={item.id}>
                  <NavLink
                    item={item}
                    collapsed={collapsed}
                    renderLink={renderLink}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** @public */
export function AppShell(props: AppShellProps): ReactNode {
  const {
    systemName,
    logo,
    nav,
    environment,
    status,
    actions,
    languageSwitch = true,
    user,
    sidebarFooter,
    defaultCollapsed = false,
    onCollapsedChange,
    renderLink = plainLink,
    mainId = "main",
    children,
    className,
  } = props;
  const t = useT();
  const sidebarId = useId();
  const [own, setOwn] = useState(defaultCollapsed);
  const collapsed = props.collapsed ?? own;
  const [sheetOpen, setSheetOpen] = useState(false);
  const toggle = (): void => {
    setOwn(!collapsed);
    onCollapsedChange?.(!collapsed);
  };
  // A link chosen in the sheet closes it, so the page it opens is seen.
  const sheetLink: LinkRenderer = (p) => (
    <span
      className="contents"
      onClickCapture={() => {
        setSheetOpen(false);
      }}
    >
      {renderLink(p)}
    </span>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div
        data-slot="app-shell"
        data-collapsed={collapsed ? "true" : "false"}
        className={cn(
          "flex min-h-dvh w-full bg-background text-foreground",
          className,
        )}
      >
        <a
          href={`#${mainId}`}
          data-part="skip"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-overlay focus:outline-2 focus:outline-ring"
        >
          {t("shell.skip")}
        </a>
        {/* The column runs the page's full height; the sidebar in it stays
            in view while the page scrolls. */}
        <div className="hidden shrink-0 border-r border-border bg-sidebar md:block">
          <aside
            id={sidebarId}
            data-part="sidebar"
            className={cn(
              "sticky top-0 flex h-dvh flex-col transition-[width] duration-200 ease-out",
              collapsed
                ? "w-[var(--us-sidebar-width-collapsed)]"
                : "w-[var(--us-sidebar-width)]",
            )}
          >
            <div
              className={cn(
                "flex h-[var(--us-topbar-height)] shrink-0 items-center gap-2.5 border-b border-border px-4",
                collapsed && "justify-center px-0",
              )}
            >
              {logo !== undefined && (
                <span
                  aria-hidden="true"
                  className="inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md"
                >
                  {logo}
                </span>
              )}
              {!collapsed && (
                <span className="min-w-0 truncate text-sm font-bold text-foreground">
                  {systemName}
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <NavGroups
                nav={nav}
                collapsed={collapsed}
                renderLink={renderLink}
                label={t("shell.nav")}
              />
            </div>
            {sidebarFooter !== undefined && !collapsed && (
              <div className="border-t border-border px-4 py-3 text-xs text-sidebar-muted">
                {sidebarFooter}
              </div>
            )}
            <div className="border-t border-border p-3">
              <button
                type="button"
                aria-controls={sidebarId}
                aria-expanded={!collapsed}
                data-part="collapse"
                onClick={toggle}
                className={cn(
                  "inline-flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-xs font-semibold text-sidebar-muted transition-colors hover:bg-hover hover:text-sidebar-text",
                  FOCUS,
                  collapsed && "justify-center px-0",
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen aria-hidden="true" className="size-4" />
                ) : (
                  <PanelLeftClose aria-hidden="true" className="size-4" />
                )}
                <span className={collapsed ? "sr-only" : undefined}>
                  {collapsed ? t("shell.expand") : t("shell.collapse")}
                </span>
              </button>
            </div>
          </aside>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <header
            data-part="topbar"
            className="sticky top-0 z-30 flex min-h-[var(--us-topbar-height)] flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-topbar px-3 py-2 sm:px-5"
          >
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger
                aria-label={t("shell.open_nav")}
                data-part="open-nav"
                className={cn(
                  "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-hover md:hidden",
                  FOCUS,
                )}
              >
                <Menu aria-hidden="true" className="size-4" />
              </SheetTrigger>
              <SheetContent
                side="left"
                showCloseButton={false}
                className="w-72 max-w-[85vw] gap-0 bg-sidebar p-0"
              >
                <div className="flex h-[var(--us-topbar-height)] shrink-0 items-center justify-between gap-2 border-b border-border px-4">
                  <SheetTitle className="min-w-0 truncate text-sm font-bold">
                    {systemName}
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    {t("shell.nav")}
                  </SheetDescription>
                  <SheetClose
                    aria-label={t("ui.close")}
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-md hover:bg-hover",
                      FOCUS,
                    )}
                  >
                    <X aria-hidden="true" className="size-4" />
                  </SheetClose>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <NavGroups
                    nav={nav}
                    collapsed={false}
                    renderLink={sheetLink}
                    label={t("shell.nav")}
                  />
                </div>
                {sidebarFooter !== undefined && (
                  <div className="border-t border-border px-4 py-3 text-xs text-sidebar-muted">
                    {sidebarFooter}
                  </div>
                )}
              </SheetContent>
            </Sheet>
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                data-part="system-name"
                className="min-w-0 truncate text-sm font-bold text-foreground"
              >
                {systemName}
              </span>
              {environment !== undefined && (
                <StatusBadge
                  tone={environment.tone}
                  variant="outline"
                  data-part="environment"
                >
                  <span className="sr-only">{t("shell.environment")} </span>
                  {environment.name}
                </StatusBadge>
              )}
            </div>
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
              {status}
              {actions}
              {languageSwitch && <LanguageSwitch />}
              {user}
            </div>
          </header>
          <main
            id={mainId}
            tabIndex={-1}
            className="min-w-0 flex-1 outline-none"
          >
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
