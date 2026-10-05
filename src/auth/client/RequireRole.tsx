"use client";
// Display gating (docs/PLAN.md §3.16, §7 "Display is not authorisation").
import type { ReactNode } from "react";

import { useSession } from "./SessionProvider.js";

/** @public */
export interface RequireRoleProps {
  /** Shown when the session holds at least one of these roles. */
  anyOf: string[];
  children?: ReactNode;
  /** Shown otherwise; nothing by default. */
  fallback?: ReactNode;
}

/**
 * Renders `children` when `session.roles` intersects `anyOf`, and
 * `fallback` when it does not, when the roles are empty, or when signed
 * out. A courtesy to the layout, not a control: it hides a menu, it
 * grants nothing. The roles are decoded without verification, and the
 * API decides every request whatever this shows.
 *
 * @public
 */
export function RequireRole(props: RequireRoleProps): ReactNode {
  const { session } = useSession();
  const roles = session?.roles ?? [];
  const match = props.anyOf.some((r) => roles.includes(r));
  return match ? props.children : (props.fallback ?? null);
}
