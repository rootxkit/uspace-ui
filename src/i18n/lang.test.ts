import { describe, expect, it } from "vitest";

import {
  DEFAULT_LANG,
  langFromAcceptLanguage,
  langFromCookie,
  LANGS,
  negotiateLang,
  parseLang,
} from "./lang.js";

describe("negotiateLang", () => {
  it("lets the cookie win over Accept-Language", () => {
    expect(negotiateLang("en-US,en;q=0.9", "ka")).toBe("ka");
    expect(negotiateLang("ka-GE", "en")).toBe("en");
  });

  it("reads the cookie from a whole Cookie header", () => {
    expect(negotiateLang("ka", "a=1; uspace_lang=en; b=2")).toBe("en");
  });

  it("gives en for Accept-Language en-US,en;q=0.9", () => {
    expect(negotiateLang("en-US,en;q=0.9", null)).toBe("en");
  });

  it("gives ka for ka-GE", () => {
    expect(negotiateLang("ka-GE", null)).toBe("ka");
  });

  it("gives ka when nothing is given", () => {
    expect(negotiateLang(null, null)).toBe("ka");
    expect(DEFAULT_LANG).toBe("ka");
  });

  it("ignores a cookie that is not a language and asks Accept-Language", () => {
    expect(negotiateLang("en", "fr")).toBe("en");
    expect(negotiateLang("en", "uspace_lang=fr")).toBe("en");
    expect(negotiateLang(null, "uspace_scheme=dark")).toBe("ka");
  });
});

describe("langFromAcceptLanguage", () => {
  it("ranks by q, then by order", () => {
    expect(langFromAcceptLanguage("en;q=0.5, ka;q=0.8")).toBe("ka");
    expect(langFromAcceptLanguage("en, ka")).toBe("en");
    expect(langFromAcceptLanguage("fr-FR, ka;q=0.3, en;q=0.3")).toBe("ka");
  });

  it("skips other languages, q=0, wildcards and nonsense", () => {
    expect(langFromAcceptLanguage("fr, de;q=0.9")).toBeNull();
    expect(langFromAcceptLanguage("ka;q=0, en;q=0.1")).toBe("en");
    expect(langFromAcceptLanguage("*")).toBeNull();
    expect(langFromAcceptLanguage("en;q=2")).toBeNull();
    expect(langFromAcceptLanguage("")).toBeNull();
    expect(langFromAcceptLanguage(undefined)).toBeNull();
  });

  it("matches case-insensitively and ignores parameters other than q", () => {
    expect(langFromAcceptLanguage("KA-ge;level=1")).toBe("ka");
  });
});

describe("langFromCookie and parseLang", () => {
  it("finds the cookie among others and refuses other values", () => {
    expect(langFromCookie("uspace_lang=ka")).toBe("ka");
    expect(langFromCookie("x; uspace_lang = en ")).toBe("en");
    expect(langFromCookie("uspace_lang=de")).toBeNull();
    expect(langFromCookie("other=ka")).toBeNull();
    expect(langFromCookie(null)).toBeNull();
    expect(langFromCookie(undefined)).toBeNull();
  });

  it("knows exactly the two languages", () => {
    expect(LANGS).toEqual(["ka", "en"]);
    expect(parseLang("ka")).toBe("ka");
    expect(parseLang("en")).toBe("en");
    expect(parseLang("KA")).toBeNull();
    expect(parseLang(null)).toBeNull();
  });
});
