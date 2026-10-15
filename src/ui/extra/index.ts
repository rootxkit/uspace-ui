// Additions over upstream shadcn/ui (docs/PLAN.md §3.3): separate files,
// never edits inside a vendored component.
export {
  AppShell,
  type AppShellProps,
  type NavGroup,
  type NavItem,
  type ShellEnvironment,
} from "./AppShell.js";
export { CspNonceProvider, useCspNonce } from "./CspNonce.js";
export { EmptyState, type EmptyStateProps } from "./EmptyState.js";
export { InlineCode } from "./InlineCode.js";
export { Kbd } from "./Kbd.js";
export { LanguageSwitch, type LanguageSwitchProps } from "./LanguageSwitch.js";
export { type LinkProps, type LinkRenderer } from "./link.js";
export { MapPanel, type MapPanelProps } from "./MapPanel.js";
export { PageHeader, type Crumb, type PageHeaderProps } from "./PageHeader.js";
export { Panel, type PanelProps } from "./Panel.js";
export { STAT_UNKNOWN, Stat, type StatProps } from "./Stat.js";
export {
  KpiRow,
  StatTile,
  type KpiRowProps,
  type StatTileProps,
  type StatTileStatus,
  type StatTrend,
  type TrendDirection,
} from "./StatTile.js";
export { StatusBadge, type StatusBadgeProps } from "./StatusBadge.js";
export {
  StatusPill,
  type FeedPillState,
  type StatusPillProps,
} from "./StatusPill.js";
export { TABLE_NOWRAP } from "./tableNowrap.js";
export { UserMenu, type UserMenuProps } from "./UserMenu.js";
