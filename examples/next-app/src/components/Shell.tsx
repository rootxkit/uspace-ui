"use client";

// The page frame: the kit's AppShell with the example's navigation, the
// environment from config, the feed pill on the page that has a feed,
// the scheme toggle, the language switch and the session.
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@rootxkit/uspace-ui/auth/client";
import { useT } from "@rootxkit/uspace-ui/i18n";
import { useTheme } from "@rootxkit/uspace-ui/theme";
import {
  AppShell,
  DropdownMenuItem,
  StatusPill,
  UserMenu,
  type LinkRenderer,
  type NavGroup,
} from "@rootxkit/uspace-ui/ui";
import { ENVIRONMENT, POLICY } from "../config";
import { DEMO_FEED_AGE_S } from "../dashboard/demo";
import {
  AuditIcon,
  DashboardIcon,
  Mark,
  MapIcon,
  MoonIcon,
  SignInIcon,
  SignOutIcon,
  SunIcon,
} from "./icons";

const renderLink: LinkRenderer = (p) => <Link {...p} />;

function SchemeToggle() {
  const t = useT();
  const { resolved, setScheme } = useTheme();
  const dark = resolved === "dark";
  return (
    <button
      type="button"
      aria-pressed={dark}
      aria-label={t("example.scheme.dark")}
      onClick={() => setScheme(dark ? "light" : "dark")}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {dark ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const t = useT();
  const { session, signOut } = useSession();
  const { brand } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const nav: NavGroup[] = [
    {
      id: "console",
      label: t("example.nav.console"),
      items: [
        {
          id: "dashboard",
          label: t("example.nav.dashboard"),
          href: "/dashboard",
          icon: <DashboardIcon />,
          active: pathname === "/dashboard",
        },
        {
          id: "map",
          label: t("example.nav.map"),
          href: "/",
          icon: <MapIcon />,
          active: pathname === "/",
        },
      ],
    },
    {
      id: "account",
      label: t("example.nav.account"),
      items: [
        {
          id: "protected",
          label: t("example.nav.protected"),
          href: "/protected",
          icon: <AuditIcon />,
          active: pathname === "/protected",
        },
        ...(session === null
          ? [
              {
                id: "login",
                label: t("example.nav.login"),
                href: "/login",
                icon: <SignInIcon />,
                active: pathname === "/login",
              },
            ]
          : []),
      ],
    },
  ];
  return (
    <AppShell
      systemName={brand.name}
      logo={<Mark />}
      nav={nav}
      renderLink={renderLink}
      environment={{ name: t("example.environment"), tone: ENVIRONMENT.tone }}
      // Only the dashboard has a feed (its demo data); the other pages
      // show no pill rather than one that would say nothing true.
      status={
        pathname === "/dashboard" ? (
          <StatusPill state="live" ageS={DEMO_FEED_AGE_S} />
        ) : undefined
      }
      actions={<SchemeToggle />}
      user={
        session === null ? undefined : (
          <UserMenu name={session.sub} detail={session.roles.join(", ")}>
            <DropdownMenuItem
              onSelect={() => {
                void signOut().then(() => router.refresh());
              }}
            >
              <SignOutIcon />
              {t("example.nav.sign_out")}
            </DropdownMenuItem>
          </UserMenu>
        )
      }
    >
      <div className="mx-auto grid w-full max-w-[96rem] gap-6 p-4 sm:p-6">
        {children}
        <footer className="border-t border-border pt-3 text-xs text-muted-foreground">
          {t("example.footer.a11y", {
            target: POLICY.accessibilityTarget.value,
            status: POLICY.accessibilityTarget.status,
          })}
        </footer>
      </div>
    </AppShell>
  );
}
