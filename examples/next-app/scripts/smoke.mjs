// The example's smoke test (WP-13): the built app's standalone server,
// driven by Playwright's Chromium.
//
//   EXAMPLE_BASEMAP_ORIGIN=http://127.0.0.1:4599 pnpm build   # once
//   pnpm smoke
//
// It serves the browser tests' Tbilisi extract (browser/public/basemap/)
// with range requests where the build's /basemap/* rewrite points, starts
// the app with plain-HTTP cookies (EXAMPLE_SESSION_SECURE=false: no TLS in
// the test), and checks, in this order:
//
// - every page response carries the CSP of docs/PLAN.md §7 with
//   `connect-src 'self'` only, and the browser reports no violation;
// - no request leaves the app's origin;
// - the public map loads: the basemap with its OSM date, the zones with
//   "version 42, updated ... UTC" and the ETag, the legend's five types;
// - the language switch renders Georgian and sets <html lang="ka">;
// - signed out, the protected page says so (the twin of the next check);
// - a refused sign-in shows the API's detail and stays on the form;
// - the one-role fixture user sees the protected page's denial;
// - the two-role fixture user signs in and reaches the protected page;
// - accessibility (docs/ACCESSIBILITY.md): every page, in English light
//   and Georgian dark, has a title in its language and passes axe at
//   WCAG 2.2 AA; the map canvas is named in the page's language, apart
//   from the map region around it, also after a language switch; the
//   skip link is the first Tab stop and moves focus to the content; at
//   320 CSS px nothing scrolls sideways.
//
// Exit 0 when every check passed; 1 with the failing check otherwise.
// The servers it starts are stopped on every path.
import { spawn } from "node:child_process";
import {
  cpSync,
  createReadStream,
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, "..");
const repo = path.resolve(app, "../..");
const basemapDir = path.join(repo, "browser/public");
const users = JSON.parse(
  readFileSync(path.join(app, "fixtures/users.json"), "utf8"),
).users;

const APP_PORT = Number(process.env["SMOKE_APP_PORT"] ?? 3199);
const BASEMAP_PORT = Number(process.env["SMOKE_BASEMAP_PORT"] ?? 4599);
const APP = `http://127.0.0.1:${APP_PORT}`;
/** Display-only bound: how long a page may take to show what it should. */
const WAIT_MS = 30_000;
const AXE_SOURCE = readFileSync(
  createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
  "utf8",
);
/** The accessibility target (config/example.json: WCAG 2.2 AA, pending GCAA). */
const AXE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
];
const PAGES = ["/", "/login", "/protected"];
const LANG_SETUPS = [
  { lang: "en", colorScheme: "light", region: "Map", canvas: /^Map view/ },
  { lang: "ka", colorScheme: "dark", region: "რუკა", canvas: /^რუკის ხედი/ },
];

/** axe in the page, through the debugging protocol (the CSP governs page scripts, not this). */
async function axeViolations(page) {
  await page.evaluate(AXE_SOURCE);
  return page.evaluate(async (tags) => {
    const r = await globalThis.axe.run(document, {
      runOnly: { type: "tag", values: tags },
    });
    return r.violations.map(
      (v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ")}`,
    );
  }, AXE_TAGS);
}

/** The map canvas's name and the name of the map region around it. */
async function mapNames(page) {
  await page.locator("canvas.maplibregl-canvas").waitFor({ timeout: WAIT_MS });
  return page.evaluate(() => ({
    canvas:
      document
        .querySelector("canvas.maplibregl-canvas")
        ?.getAttribute("aria-label") ?? null,
    region:
      document.querySelector(".us-map-canvas")?.getAttribute("aria-label") ??
      null,
  }));
}

async function checkAccessibility(browser) {
  for (const s of LANG_SETUPS) {
    const context = await browser.newContext({
      locale: s.lang === "ka" ? "ka-GE" : "en-GB",
      colorScheme: s.colorScheme,
    });
    try {
      const page = await context.newPage();
      for (const p of PAGES) {
        await page.goto(`${APP}${p}`);
        await page.locator("main h1").waitFor({ timeout: WAIT_MS });
        if (p === "/") {
          await page
            .getByTestId("freshness")
            .getByText("42")
            .waitFor({ timeout: WAIT_MS });
        }
        const lang = await page.evaluate(() => document.documentElement.lang);
        expect(lang === s.lang, `${p}: <html lang> is ${lang}, want ${s.lang}`);
        const title = await page.title();
        expect(title.trim() !== "", `${p} (${s.lang}) has no <title>`);
        if (s.lang === "ka") {
          expect(
            /[ა-ჿ]/.test(title),
            `${p} (ka): the title "${title}" is not in Georgian`,
          );
        }
        // The scheme is applied after hydration (ThemeProvider sets
        // data-theme) and the colours transition into it: measure contrast
        // once the scheme is set and nothing is animating.
        await page.waitForFunction(
          (scheme) =>
            document.documentElement.getAttribute("data-theme") === scheme &&
            document.getAnimations().length === 0,
          s.colorScheme,
          { timeout: WAIT_MS },
        );
        const violations = await axeViolations(page);
        expect(
          violations.length === 0,
          `${p} (${s.lang}, ${s.colorScheme}): axe ${violations.join("; ")}`,
        );
      }
      await page.goto(`${APP}/`);
      const names = await mapNames(page);
      expect(
        names.region === s.region,
        `the map region is named ${JSON.stringify(names.region)}`,
      );
      expect(
        names.canvas !== null &&
          s.canvas.test(names.canvas) &&
          names.canvas !== names.region,
        `the map canvas is named ${JSON.stringify(names.canvas)} in a ${s.lang} page`,
      );
    } finally {
      await context.close();
    }
  }
  pass(
    "every page has a title in its language and passes axe (WCAG 2.2 AA), English light and Georgian dark",
  );

  const context = await browser.newContext({ locale: "en-GB" });
  try {
    const page = await context.newPage();
    // The canvas name follows a language switch on the same map.
    await page.goto(`${APP}/`);
    await mapNames(page);
    await page.getByRole("button", { name: "ქართული" }).click();
    await page.waitForFunction(
      () => document.documentElement.lang === "ka",
      null,
      { timeout: WAIT_MS },
    );
    await page.waitForFunction(
      () =>
        /^რუკის ხედი/.test(
          document
            .querySelector("canvas.maplibregl-canvas")
            ?.getAttribute("aria-label") ?? "",
        ),
      null,
      { timeout: WAIT_MS },
    );
    pass(
      "the map canvas is named in the page's language, apart from the map region, also after a switch",
    );
    await page.getByRole("button", { name: "English" }).click();
    await page.waitForFunction(
      () => document.documentElement.lang === "en",
      null,
      { timeout: WAIT_MS },
    );

    // The skip link: first Tab stop, and it moves focus to the content.
    await page.goto(`${APP}/`);
    await page.locator("main h1").waitFor({ timeout: WAIT_MS });
    await page.keyboard.press("Tab");
    const first = await page.evaluate(
      () => document.activeElement?.textContent,
    );
    expect(
      first === "Skip to content",
      `the first Tab stop is ${JSON.stringify(first)}`,
    );
    await page.keyboard.press("Enter");
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(
      focused === "main",
      `the skip link moved focus to ${JSON.stringify(focused)}, want main`,
    );
    pass("the skip link is the first Tab stop and moves focus to the content");

    // Reflow at 320 CSS px (WCAG 1.4.10).
    await page.setViewportSize({ width: 320, height: 720 });
    for (const p of PAGES) {
      await page.goto(`${APP}${p}`);
      await page.locator("main h1").waitFor({ timeout: WAIT_MS });
      const widths = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(
        widths.scroll <= widths.inner,
        `${p} at 320 px scrolls sideways (${widths.scroll} > ${widths.inner})`,
      );
    }
    pass("at 320 CSS px no page scrolls sideways");
  } finally {
    await context.close();
  }
}

const TYPES = {
  ".json": "application/json",
  ".pmtiles": "application/octet-stream",
  ".pbf": "application/x-protobuf",
  ".png": "image/png",
};

/** A static server of browser/public with single-range requests (PMTiles needs them). */
function basemapServer() {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const file = path.join(basemapDir, decodeURIComponent(url.pathname));
    if (
      !file.startsWith(basemapDir) ||
      !existsSync(file) ||
      !statSync(file).isFile()
    ) {
      res.writeHead(404).end();
      return;
    }
    const size = statSync(file).size;
    const type = TYPES[path.extname(file)] ?? "application/octet-stream";
    const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
    if (m) {
      const start = Number(m[1]);
      const end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": end - start + 1,
        "Accept-Ranges": "bytes",
      });
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": size,
      "Accept-Ranges": "bytes",
    });
    createReadStream(file).pipe(res);
  });
}

/**
 * The standalone server the image runs (`output: "standalone"`), with
 * `.next/static` and `public/` copied beside it as the Dockerfile does.
 * In this workspace the output mirrors the tracing root, so the server is
 * at examples/next-app/server.js under .next/standalone.
 */
function startApp() {
  const standalone = path.join(app, ".next/standalone");
  const dir = [path.join(standalone, "examples/next-app"), standalone].find(
    (d) => existsSync(path.join(d, "server.js")),
  );
  if (dir === undefined)
    throw new Error("no .next/standalone server.js: run pnpm build first");
  cpSync(path.join(app, ".next/static"), path.join(dir, ".next/static"), {
    recursive: true,
  });
  cpSync(path.join(app, "public"), path.join(dir, "public"), {
    recursive: true,
  });
  const child = spawn(process.execPath, [path.join(dir, "server.js")], {
    cwd: dir,
    env: {
      ...process.env,
      EXAMPLE_SESSION_SECURE: "false",
      PORT: String(APP_PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  return { child, log: () => log };
}

async function waitForApp() {
  const until = Date.now() + WAIT_MS;
  for (;;) {
    try {
      const res = await fetch(`${APP}/stub-api/v1/zones`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    if (Date.now() > until)
      throw new Error(`the app did not answer on ${APP} within ${WAIT_MS} ms`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

const checks = [];
function pass(name) {
  checks.push(name);
  console.log(`ok   ${name}`);
}

function expect(cond, message) {
  if (!cond) throw new Error(message);
}

/** The build must carry the smoke's basemap rewrite, or the map test would test nothing. */
function checkRewrite() {
  const manifest = JSON.parse(
    readFileSync(path.join(app, ".next/routes-manifest.json"), "utf8"),
  );
  const rewrites = [
    ...(manifest.rewrites?.beforeFiles ?? []),
    ...(manifest.rewrites?.afterFiles ?? []),
    ...(manifest.rewrites?.fallback ?? []),
    ...(Array.isArray(manifest.rewrites) ? manifest.rewrites : []),
  ];
  const hit = rewrites.find((r) => r.source === "/basemap/:path*");
  expect(
    hit !== undefined &&
      hit.destination.startsWith(`http://127.0.0.1:${BASEMAP_PORT}/`),
    `the build has no /basemap/* rewrite to 127.0.0.1:${BASEMAP_PORT}; build with EXAMPLE_BASEMAP_ORIGIN=http://127.0.0.1:${BASEMAP_PORT}`,
  );
  pass("the build rewrites /basemap/* to the smoke's basemap server");
}

async function run() {
  checkRewrite();
  const basemap = basemapServer();
  await new Promise((r) => basemap.listen(BASEMAP_PORT, "127.0.0.1", r));
  const server = startApp();
  let browser;
  let page;
  try {
    await waitForApp();
    if (process.argv.includes("--serve")) {
      // For a hand audit: the same servers, no checks, until Ctrl-C.
      console.log(
        `serving ${APP} (basemap on ${BASEMAP_PORT}); Ctrl-C stops both`,
      );
      await new Promise((resolve) => process.once("SIGINT", resolve));
      return;
    }
    browser = await chromium.launch({
      args: ["--use-gl=angle", "--use-angle=swiftshader"],
    });
    const context = await browser.newContext({ locale: "en-GB" });
    const pageDocs = [];
    const foreign = [];
    const violations = [];
    const consoleErrors = [];
    context.on("request", (req) => {
      const u = new URL(req.url());
      if (u.protocol.startsWith("http") && u.origin !== APP)
        foreign.push(req.url());
    });
    context.on("response", async (res) => {
      // Pages: documents, and the RSC payloads of client navigations.
      const req = res.request();
      if (!res.url().startsWith(APP)) return;
      if (
        req.resourceType() === "document" ||
        (await req.allHeaders())["rsc"] === "1"
      ) {
        pageDocs.push({
          url: res.url(),
          csp: (await res.allHeaders())["content-security-policy"] ?? null,
        });
      }
    });
    await context.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        console.error(
          `CSP violation: ${e.violatedDirective} ${e.blockedURI} at ${location.pathname} ${e.sourceFile}:${e.lineNumber} sample=${e.sample}`,
        );
      });
    });
    page = await context.newPage();
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
      if (m.text().startsWith("CSP violation")) violations.push(m.text());
    });

    // The public map.
    await page.goto(`${APP}/`);
    await page
      .getByTestId("freshness")
      .getByText("Zones version 42, updated 2026-10-01 08:30 UTC")
      .waitFor({ timeout: WAIT_MS });
    await page
      .getByTestId("etag")
      .getByText('ETag "42"')
      .waitFor({ timeout: WAIT_MS });
    pass(
      'the public map shows "Zones version 42, updated 2026-10-01 08:30 UTC" and the ETag',
    );
    await page.locator(".maplibregl-canvas").waitFor({ timeout: WAIT_MS });
    await page
      .getByText("OSM data as of 2026-10-01 (UTC)")
      .waitFor({ state: "attached", timeout: WAIT_MS });
    expect(
      (await page.getByText("no base map").count()) === 0,
      "the map says it has no base map",
    );
    pass("the basemap loads through /basemap/ and shows its OSM date");
    const legend = page.getByRole("region", { name: "Zone types" });
    await legend.waitFor({ timeout: WAIT_MS });
    expect(
      (await legend.locator("li").count()) === 5,
      "the legend does not list the five zone types",
    );
    pass("the legend lists the five zone types");

    // The language switch.
    await page.getByRole("button", { name: "ქართული" }).click();
    await page
      .getByTestId("freshness")
      .getByText("ზონების ვერსია 42")
      .waitFor({ timeout: WAIT_MS });
    await page.waitForFunction(
      () => document.documentElement.lang === "ka",
      null,
      { timeout: WAIT_MS },
    );
    await page
      .getByRole("region", { name: "ზონების ტიპები" })
      .waitFor({ timeout: WAIT_MS });
    pass('the language switch renders Georgian and sets <html lang="ka">');
    await page.getByRole("button", { name: "English" }).click();
    await page.waitForFunction(
      () => document.documentElement.lang === "en",
      null,
      { timeout: WAIT_MS },
    );

    // Signed out: the protected page says so.
    await page.goto(`${APP}/protected`);
    await page
      .getByTestId("protected-fallback")
      .getByText("Sign in to see this page.")
      .waitFor({ timeout: WAIT_MS });
    expect(
      (await page.getByTestId("protected-body").count()) === 0,
      "the protected page shows its body signed out",
    );
    pass("signed out, the protected page shows only its fallback");

    const operator = users.find((u) => u.username === "TEST-operator");
    const viewer = users.find((u) => u.username === "TEST-viewer");

    // A refused sign-in shows the API's detail.
    await page.goto(`${APP}/login`);
    await page.getByLabel("Username").fill(operator.username);
    await page.getByLabel("Password").fill(`${operator.password}-wrong`);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page
      .getByText("The username or password is not right.")
      .waitFor({ timeout: WAIT_MS });
    expect(
      new URL(page.url()).pathname === "/login",
      "a refused sign-in left the form",
    );
    pass("a refused sign-in shows the API's detail and stays on the form");

    // One role: signed in, and the page still hides its body.
    await page.getByLabel("Password").fill(viewer.password);
    await page.getByLabel("Username").fill(viewer.username);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`${APP}/protected`, { timeout: WAIT_MS });
    await page
      .getByTestId("protected-fallback")
      .getByText("This page is for the auditor role.")
      .waitFor({ timeout: WAIT_MS });
    expect(
      (await page.getByTestId("protected-body").count()) === 0,
      "the one-role user sees the protected body",
    );
    pass("the one-role user is signed in and sees the denial, not the body");
    const cookies = await context.cookies(APP);
    const session = cookies.find((c) => c.name === "uspace_session");
    expect(
      session !== undefined &&
        session.httpOnly &&
        session.sameSite === "Strict",
      "uspace_session is not HttpOnly; SameSite=Strict",
    );
    expect(
      cookies.some((c) => c.name === "uspace_csrf" && !c.httpOnly),
      "uspace_csrf is missing or HttpOnly",
    );
    expect(
      !(await page.evaluate(() => document.cookie)).includes("uspace_session"),
      "page script can read uspace_session",
    );
    pass(
      "the session cookie is HttpOnly and SameSite=Strict; the CSRF cookie is readable",
    );
    await page.getByRole("button", { name: "Sign out" }).click();
    await page
      .getByRole("link", { name: "Sign in" })
      .waitFor({ timeout: WAIT_MS });

    // Two roles: the protected page.
    await page.goto(`${APP}/login`);
    await page.getByLabel("Username").fill(operator.username);
    await page.getByLabel("Password").fill(operator.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`${APP}/protected`, { timeout: WAIT_MS });
    await page.getByTestId("protected-body").waitFor({ timeout: WAIT_MS });
    await page
      .getByText("Signed in as TEST-account-0001")
      .waitFor({ timeout: WAIT_MS });
    pass("the two-role user signs in and reaches the protected page");

    await checkAccessibility(browser);

    // Every page carried the CSP; nothing left the origin; nothing was refused.
    expect(
      pageDocs.length >= 6,
      `only ${pageDocs.length} page responses were seen`,
    );
    for (const d of pageDocs) {
      expect(d.csp !== null, `${d.url} has no Content-Security-Policy`);
      const connect = /(?:^|;\s*)connect-src ([^;]*)/.exec(d.csp)?.[1]?.trim();
      expect(
        connect === "'self'",
        `${d.url}: connect-src is ${JSON.stringify(connect)}, want 'self' only`,
      );
      expect(
        !/unsafe-eval/.test(d.csp),
        `${d.url}: the CSP allows unsafe-eval`,
      );
      expect(
        /worker-src blob:/.test(d.csp) && /font-src 'self'/.test(d.csp),
        `${d.url}: worker-src or font-src missing`,
      );
    }
    pass(
      `all ${pageDocs.length} page responses carry the CSP with connect-src 'self' only`,
    );
    expect(
      foreign.length === 0,
      `requests left the origin: ${foreign.join(", ")}`,
    );
    pass("no request left the app's origin");
    expect(violations.length === 0, `CSP violations: ${violations.join("; ")}`);
    pass("the browser reported no CSP violation");
    // The refused sign-in is a 401 the browser logs as a failed resource.
    const unexpected = consoleErrors.filter((e) => !/status of 401/.test(e));
    expect(unexpected.length === 0, `console errors: ${unexpected.join("; ")}`);
    pass("no console error beyond the refused sign-in's 401");
  } catch (err) {
    console.error(`FAIL ${err instanceof Error ? err.message : String(err)}`);
    if (page !== undefined) {
      console.error(`--- the page at ${page.url()} ---`);
      console.error(
        await page
          .evaluate(() => document.body.innerText)
          .catch(() => "(unreadable)"),
      );
    }
    console.error("--- server output ---");
    console.error(server.log());
    process.exitCode = 1;
  } finally {
    await browser?.close();
    server.child.kill();
    basemap.close();
  }
  console.log(
    process.exitCode === 1
      ? `smoke: FAILED after ${checks.length} checks`
      : `smoke: ${checks.length} checks passed`,
  );
}

await run();
