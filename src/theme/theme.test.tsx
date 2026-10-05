// ThemeProvider, useTheme, branding and the scheme cookie (WP-1). Every
// test restores matchMedia, <html> and the cookie it touched (E-11).
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import {
  BRAND_FALLBACK_NAME,
  SCHEME_COOKIE,
  ThemeProvider,
  brandFromEnv,
  parseScheme,
  schemeAttribute,
  schemeFromCookie,
  tokens,
  useOptionalTheme,
  useTheme,
  type Brand,
  type ColorScheme,
} from "./index.js";

const BRAND: Brand = {
  name: "TEST Console",
  shortName: "TEST",
  logoUrl: null,
  contact: null,
  accent: null,
};

interface FakeMedia {
  set(dark: boolean): void;
  listeners(): number;
}

function fakeMatchMedia(dark: boolean): FakeMedia {
  let matches = dark;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mq = {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, l: (e: MediaQueryListEvent) => void) =>
      listeners.add(l),
    removeEventListener: (_: string, l: (e: MediaQueryListEvent) => void) =>
      listeners.delete(l),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mq),
  );
  return {
    set(d) {
      matches = d;
      for (const l of [...listeners]) l({ matches: d } as MediaQueryListEvent);
    },
    listeners: () => listeners.size,
  };
}

const html = (): HTMLElement => document.documentElement;

function Probe(): ReactNode {
  const t = useTheme();
  return (
    <div>
      <p data-testid="scheme">{t.scheme}</p>
      <p data-testid="resolved">{t.resolved}</p>
      <p data-testid="brand">{t.brand.shortName}</p>
      {(["light", "dark", "system"] as const).map((s) => (
        <button key={s} type="button" onClick={() => t.setScheme(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}

const text = (id: string): string | null => screen.getByTestId(id).textContent;

beforeEach(() => {
  html().removeAttribute("data-theme");
  html().style.removeProperty(tokens.brandAccent);
});

afterEach(() => {
  cleanup();
  html().removeAttribute("data-theme");
  html().style.removeProperty(tokens.brandAccent);
  document.cookie = `${SCHEME_COOKIE}=; max-age=0; path=/`;
});

describe("ThemeProvider", () => {
  it("follows prefers-color-scheme for system and switches live", () => {
    const media = fakeMatchMedia(false);
    const { unmount } = render(
      <ThemeProvider brand={BRAND} scheme="system">
        <Probe />
      </ThemeProvider>,
    );
    expect(text("scheme")).toBe("system");
    expect(text("resolved")).toBe("light");
    expect(html().getAttribute("data-theme")).toBe("light");
    expect(media.listeners()).toBe(1);

    act(() => media.set(true));
    expect(text("resolved")).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");

    act(() => media.set(false));
    expect(html().getAttribute("data-theme")).toBe("light");

    unmount();
    expect(media.listeners()).toBe(0);
  });

  it("ignores the system preference once a scheme is chosen", () => {
    const media = fakeMatchMedia(true);
    render(
      <ThemeProvider brand={BRAND} scheme="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(html().getAttribute("data-theme")).toBe("light");
    act(() => media.set(false));
    act(() => media.set(true));
    expect(text("resolved")).toBe("light");
  });

  it("setScheme('dark') sets data-theme and tells the app", () => {
    fakeMatchMedia(false);
    const onSchemeChange = vi.fn<(s: ColorScheme) => void>();
    render(
      <ThemeProvider brand={BRAND} onSchemeChange={onSchemeChange}>
        <Probe />
      </ThemeProvider>,
    );
    expect(text("scheme")).toBe("system");
    act(() => screen.getByRole("button", { name: "dark" }).click());
    expect(text("scheme")).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
    expect(onSchemeChange).toHaveBeenCalledWith("dark");
    act(() => screen.getByRole("button", { name: "light" }).click());
    expect(html().getAttribute("data-theme")).toBe("light");
    expect(onSchemeChange).toHaveBeenLastCalledWith("light");
  });

  it("does not write the cookie itself", () => {
    fakeMatchMedia(false);
    render(
      <ThemeProvider brand={BRAND}>
        <Probe />
      </ThemeProvider>,
    );
    act(() => screen.getByRole("button", { name: "dark" }).click());
    expect(document.cookie).not.toContain(SCHEME_COOKIE);
  });

  it("follows a change of the scheme prop", () => {
    fakeMatchMedia(false);
    const { rerender } = render(
      <ThemeProvider brand={BRAND} scheme="light">
        <Probe />
      </ThemeProvider>,
    );
    rerender(
      <ThemeProvider brand={BRAND} scheme="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(text("scheme")).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
    // Dropping the prop keeps the current choice.
    rerender(
      <ThemeProvider brand={BRAND}>
        <Probe />
      </ThemeProvider>,
    );
    expect(text("scheme")).toBe("dark");
  });

  it("starts from the uspace_scheme cookie when no scheme is passed", () => {
    fakeMatchMedia(false);
    document.cookie = `${SCHEME_COOKIE}=dark; path=/`;
    render(
      <ThemeProvider brand={BRAND}>
        <Probe />
      </ThemeProvider>,
    );
    expect(text("scheme")).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
  });

  it("prefers the scheme prop over the cookie", () => {
    fakeMatchMedia(false);
    document.cookie = `${SCHEME_COOKIE}=dark; path=/`;
    render(
      <ThemeProvider brand={BRAND} scheme="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(text("scheme")).toBe("light");
  });

  it("resolves system to light without matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    render(
      <ThemeProvider brand={BRAND}>
        <Probe />
      </ThemeProvider>,
    );
    expect(text("resolved")).toBe("light");
  });

  it("restores the previous data-theme when it unmounts", () => {
    fakeMatchMedia(false);
    html().setAttribute("data-theme", "dark");
    const { unmount } = render(
      <ThemeProvider brand={BRAND} scheme="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(html().getAttribute("data-theme")).toBe("light");
    unmount();
    expect(html().getAttribute("data-theme")).toBe("dark");
  });

  it("removes data-theme on unmount when there was none", () => {
    fakeMatchMedia(false);
    const { unmount } = render(
      <ThemeProvider brand={BRAND} scheme="dark">
        <Probe />
      </ThemeProvider>,
    );
    unmount();
    expect(html().hasAttribute("data-theme")).toBe(false);
  });

  it("writes the brand accent and removes it on unmount", () => {
    fakeMatchMedia(false);
    const { unmount } = render(
      <ThemeProvider brand={{ ...BRAND, accent: "#0a7d55" }}>
        <Probe />
      </ThemeProvider>,
    );
    expect(html().style.getPropertyValue(tokens.brandAccent)).toBe("#0a7d55");
    unmount();
    expect(html().style.getPropertyValue(tokens.brandAccent)).toBe("");
  });

  it("restores an accent that was there before", () => {
    fakeMatchMedia(false);
    html().style.setProperty(tokens.brandAccent, "#123456");
    const { unmount } = render(
      <ThemeProvider brand={{ ...BRAND, accent: "#0a7d55" }}>
        <Probe />
      </ThemeProvider>,
    );
    expect(html().style.getPropertyValue(tokens.brandAccent)).toBe("#0a7d55");
    unmount();
    expect(html().style.getPropertyValue(tokens.brandAccent)).toBe("#123456");
  });

  it("leaves the stylesheet's accent alone when the brand has none", () => {
    fakeMatchMedia(false);
    render(
      <ThemeProvider brand={BRAND}>
        <Probe />
      </ThemeProvider>,
    );
    expect(html().style.getPropertyValue(tokens.brandAccent)).toBe("");
  });

  it("exposes the brand", () => {
    fakeMatchMedia(false);
    render(
      <ThemeProvider brand={BRAND}>
        <Probe />
      </ThemeProvider>,
    );
    expect(text("brand")).toBe("TEST");
  });
});

describe("useTheme", () => {
  it("throws outside a ThemeProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme must be used inside a ThemeProvider",
    );
  });

  it("useOptionalTheme is null outside and the theme inside", () => {
    fakeMatchMedia(false);
    expect(renderHook(() => useOptionalTheme()).result.current).toBeNull();
    const inside = renderHook(() => useOptionalTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider brand={BRAND} scheme="dark">
          {children}
        </ThemeProvider>
      ),
    });
    expect(inside.result.current?.resolved).toBe("dark");
  });
});

describe("brandFromEnv", () => {
  it("yields exactly the role fallback with no variables", () => {
    expect(brandFromEnv({})).toEqual({
      name: "U-space",
      shortName: "U-space",
      logoUrl: null,
      contact: null,
      accent: null,
    });
    expect(BRAND_FALLBACK_NAME).toBe("U-space");
  });

  it("treats blank variables as missing", () => {
    expect(
      brandFromEnv({
        UI_BRAND_NAME: "  ",
        UI_BRAND_ACCENT: "",
        UI_BRAND_CONTACT: " ",
      }),
    ).toEqual(brandFromEnv({}));
  });

  it("reads every variable", () => {
    expect(
      brandFromEnv({
        UI_BRAND_NAME: "TEST Authority Console",
        UI_BRAND_SHORT_NAME: "TEST",
        UI_BRAND_LOGO_URL: "/brand/logo.svg",
        UI_BRAND_CONTACT: "ops@example.test",
        UI_BRAND_ACCENT: "#0A7D55",
      }),
    ).toEqual({
      name: "TEST Authority Console",
      shortName: "TEST",
      logoUrl: "/brand/logo.svg",
      contact: "ops@example.test",
      accent: "#0A7D55",
    });
  });

  it("uses the name as the short name when only the name is set", () => {
    expect(brandFromEnv({ UI_BRAND_NAME: "TEST" }).shortName).toBe("TEST");
  });

  it("reads under another prefix and ignores the default one", () => {
    const env = {
      NEXT_PUBLIC_UI_BRAND_NAME: "TEST Public",
      UI_BRAND_NAME: "TEST Server",
    };
    expect(brandFromEnv(env, "NEXT_PUBLIC_UI_BRAND_").name).toBe("TEST Public");
  });

  it.each(["#abc", "#abcd", "#aabbcc", "#aabbccdd"])(
    "accepts the accent %s",
    (accent) => {
      expect(brandFromEnv({ UI_BRAND_ACCENT: accent }).accent).toBe(accent);
    },
  );

  it.each(["red", "#abcde", "url(x)", "#aabbcc; color: red"])(
    "refuses the accent %s, naming the variable",
    (accent) => {
      expect(() => brandFromEnv({ UI_BRAND_ACCENT: accent })).toThrow(
        `UI_BRAND_ACCENT must be a hex colour such as #1f5fc4, got "${accent}"`,
      );
    },
  );
});

describe("the scheme cookie", () => {
  it("parses the three schemes and nothing else", () => {
    expect(parseScheme("light")).toBe("light");
    expect(parseScheme("dark")).toBe("dark");
    expect(parseScheme("system")).toBe("system");
    expect(parseScheme("Dark")).toBeNull();
    expect(parseScheme("")).toBeNull();
    expect(parseScheme(null)).toBeNull();
    expect(parseScheme(undefined)).toBeNull();
  });

  it("renders an explicit scheme as data-theme on the server (A5)", () => {
    expect(schemeAttribute("dark")).toBe("dark");
    expect(schemeAttribute("light")).toBe("light");
  });

  it("renders no data-theme for system or no choice, so CSS follows the preference (the twin)", () => {
    expect(schemeAttribute("system")).toBeUndefined();
    expect(schemeAttribute(null)).toBeUndefined();
    expect(schemeAttribute(undefined)).toBeUndefined();
  });

  it("finds uspace_scheme among other cookies", () => {
    expect(schemeFromCookie("a=1; uspace_scheme=dark; b=2")).toBe("dark");
    expect(schemeFromCookie("uspace_scheme=light")).toBe("light");
  });

  it("is null when the cookie is absent, malformed or not a scheme", () => {
    expect(schemeFromCookie(null)).toBeNull();
    expect(schemeFromCookie(undefined)).toBeNull();
    expect(schemeFromCookie("")).toBeNull();
    expect(schemeFromCookie("uspace_scheme")).toBeNull();
    expect(schemeFromCookie("uspace_schemes=dark")).toBeNull();
    expect(schemeFromCookie("uspace_scheme=blue")).toBeNull();
  });
});

describe("tokens", () => {
  it("names CSS variables, never colours", () => {
    expect(tokens.severity.critical).toBe("--us-severity-critical");
    expect(tokens.trust.broadcast).toBe("--us-trust-broadcast");
    expect(tokens.ident.unknown_operator).toBe("--us-ident-unknown_operator");
    expect(tokens.identNone).toBe("--us-ident-none");
    expect(tokens.zone.REQ_AUTHORIZATION).toBe("--us-zone-REQ_AUTHORIZATION");
    expect(tokens.age).toEqual([
      "--us-age-live",
      "--us-age-aging",
      "--us-age-stale",
      "--us-age-unknown",
    ]);
    expect(Object.isFrozen(tokens)).toBe(true);
  });
});
