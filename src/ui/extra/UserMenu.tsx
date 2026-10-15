"use client";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { useT } from "../../i18n/I18nProvider.js";
import { cn } from "../cn.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu.js";

/** @public */
export interface UserMenuProps {
  /** The display name the session carries (display only, never verified here). */
  name: string;
  /** A second line, such as the roles. */
  detail?: ReactNode;
  /** The menu's items: `DropdownMenuItem`s such as "Sign out". */
  children?: ReactNode;
  className?: string;
}

/** The initials of a display name, for the avatar (display only). */
function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p !== "");
  const letters = parts.slice(0, 2).map((p) => Array.from(p)[0] ?? "");
  return letters.join("").toLocaleUpperCase();
}

/**
 * The user menu of the top bar: an avatar with the name, opening a menu
 * that says who is signed in and holds the app's items.
 *
 * @public
 */
export function UserMenu(props: UserMenuProps): ReactNode {
  const { name, detail, children, className } = props;
  const t = useT();
  return (
    // Not modal: a modal menu hides the rest of the page with aria-hidden
    // while focusable content stays in it, which axe reports.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={t("shell.account", { user: name })}
        data-slot="user-menu"
        className={cn(
          "inline-flex h-8 max-w-48 min-w-0 shrink-0 items-center gap-2 rounded-md px-1.5 text-sm font-semibold text-foreground transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-hover",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xs font-bold text-accent-text"
        >
          {initials(name)}
        </span>
        <span className="hidden min-w-0 truncate sm:inline">{name}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="grid gap-0.5">
          <span className="text-xs font-normal text-muted-foreground">
            {t("shell.signed_in_as", { user: name })}
          </span>
          {detail !== undefined && (
            <span className="text-xs font-normal text-muted-foreground">
              {detail}
            </span>
          )}
        </DropdownMenuLabel>
        {children !== undefined && (
          <>
            <DropdownMenuSeparator />
            {children}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
