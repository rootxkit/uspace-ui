// The example's navigation and tile icons: 16 px line icons drawn here,
// so the example needs no icon package of its own (a system's web/ uses
// lucide-react, which the kit's components use too).
import type { ReactNode, SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  const { children, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = () => (
  <Icon>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Icon>
);

export const MapIcon = () => (
  <Icon>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
    <path d="M9 4v14M15 6v14" />
  </Icon>
);

export const AuditIcon = () => (
  <Icon>
    <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export const SignInIcon = () => (
  <Icon>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <path d="m10 17 5-5-5-5M15 12H3" />
  </Icon>
);

export const SignOutIcon = () => (
  <Icon>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </Icon>
);

export const AircraftIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="2" />
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <circle cx="5" cy="5" r="2" />
    <circle cx="19" cy="5" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
  </Icon>
);

export const AlertIcon = () => (
  <Icon>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Icon>
);

export const ZoneIcon = () => (
  <Icon>
    <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
  </Icon>
);

export const SourceIcon = () => (
  <Icon>
    <path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
    <path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
    <circle cx="12" cy="12" r="2" />
  </Icon>
);

export const HeightIcon = () => (
  <Icon>
    <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />
  </Icon>
);

export const InboxIcon = () => (
  <Icon>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-7Z" />
  </Icon>
);

export const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const MoonIcon = () => (
  <Icon>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </Icon>
);

/** A neutral mark for the sidebar's head; a system shows its brand logo. */
export const Mark = () => (
  <svg
    viewBox="0 0 28 28"
    width="28"
    height="28"
    aria-hidden="true"
    focusable="false"
  >
    <rect width="28" height="28" rx="7" fill="var(--us-brand-accent)" />
    <path
      d="M8 15.5 14 8l6 7.5M10.5 20h7"
      fill="none"
      stroke="var(--us-on-brand-accent)"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
