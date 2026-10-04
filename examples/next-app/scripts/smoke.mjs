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
// - the two-role fixture user signs in and reaches the protected page.
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
