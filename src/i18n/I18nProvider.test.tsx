import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { missingKeys, resetI18nCounters } from "./counters.js";
import {
  I18nProvider,
  useLang,
  useOptionalI18n,
  useT,
  useTFor,
} from "./I18nProvider.js";
import type { Lang } from "./lang.js";

beforeEach(() => {
  resetI18nCounters();
});

afterEach(() => {
  cleanup();
});

function Show({ k }: { k: string }) {
  const t = useT();
  const { lang } = useLang();
  return (
    <p data-testid="out" data-lang={lang}>
      {t(k)}
    </p>
  );
}

function Switch({ to }: { to: Lang }) {
  const { setLang } = useLang();
  return (
    <button type="button" onClick={() => setLang(to)}>
      switch
    </button>
  );
}

describe("I18nProvider", () => {
  it("translates in its language", () => {
    render(
      <I18nProvider lang="ka">
        <Show k="map.layers" />
      </I18nProvider>,
    );
    expect(screen.getByTestId("out").textContent).toBe("ფენები");
    expect(missingKeys()).toBe(0);
  });

  it("serves the app's keys and lets the app override the kit's", () => {
    render(
      <I18nProvider
        lang="en"
        catalogues={{ en: { "map.layers": "Overlays", "app.title": "Desk" } }}
      >
        <Show k="map.layers" />
      </I18nProvider>,
    );
    expect(screen.getByTestId("out").textContent).toBe("Overlays");
  });

  it("setLang switches the page and hands the choice to the app", () => {
    const onLangChange = vi.fn();
    render(
      <I18nProvider lang="ka" onLangChange={onLangChange}>
        <Show k="map.layers" />
        <Switch to="en" />
      </I18nProvider>,
    );
    act(() => screen.getByRole("button").click());
    expect(screen.getByTestId("out").textContent).toBe("Layers");
    expect(screen.getByTestId("out").dataset["lang"]).toBe("en");
    expect(onLangChange).toHaveBeenCalledWith("en");
  });

  it("setLang works without onLangChange", () => {
    render(
      <I18nProvider lang="en">
        <Show k="map.layers" />
        <Switch to="ka" />
      </I18nProvider>,
    );
    act(() => screen.getByRole("button").click());
    expect(screen.getByTestId("out").textContent).toBe("ფენები");
  });

  it("follows a change of the lang prop, over an earlier setLang", () => {
    const view = (lang: Lang) => (
      <I18nProvider lang={lang}>
        <Show k="map.layers" />
        <Switch to="ka" />
      </I18nProvider>
    );
    const { rerender } = render(view("en"));
    act(() => screen.getByRole("button").click());
    expect(screen.getByTestId("out").textContent).toBe("ფენები");
    rerender(view("ka"));
    rerender(view("en"));
    expect(screen.getByTestId("out").textContent).toBe("Layers");
  });

  it("counts a missing ka key and shows the English", () => {
    render(
      <I18nProvider lang="ka" catalogues={{ en: { "app.x": "English" } }}>
        <Show k="app.x" />
      </I18nProvider>,
    );
    expect(screen.getByTestId("out").textContent).toBe("English");
    expect(missingKeys()).toBeGreaterThan(0);
  });
});

describe("outside a provider", () => {
  it("useT and useLang throw and say what is missing", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Show k="map.layers" />)).toThrow(
      /useT\(\) needs an <I18nProvider>/,
    );
    function LangOnly() {
      useLang();
      return null;
    }
    expect(() => render(<LangOnly />)).toThrow(/useLang\(\) needs/);
  });

  it("useOptionalI18n is null and useTFor still translates", () => {
    function Probe() {
      const ctx = useOptionalI18n();
      const t = useTFor("ka");
      return <p data-testid="out">{`${ctx === null}:${t("map.layers")}`}</p>;
    }
    render(<Probe />);
    expect(screen.getByTestId("out").textContent).toBe("true:ფენები");
  });
});

describe("useTFor inside a provider", () => {
  it("uses its own language with the provider's app catalogues", () => {
    function Probe() {
      const t = useTFor("ka");
      return <p data-testid="out">{t("app.name")}</p>;
    }
    render(
      <I18nProvider lang="en" catalogues={{ ka: { "app.name": "სახელი" } }}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("out").textContent).toBe("სახელი");
  });
});
