// Consumer test (WP-13a): installs a packed tarball the way a system's
// `web/` installs a release, by URL, into a scratch pnpm project, and
// checks what a consumer relies on:
//
//   1. the lockfile pins the tarball's sha512 integrity next to its URL;
//   2. every `exports` subpath resolves to a file (Node's resolver);
//   3. the entry points type-check under `NodeNext` and `Bundler`
//      resolution with `skipLibCheck: false`, and their types are real
//      (a deliberate type error must be reported);
//   4. the `uspace-ui-gen-api` bin runs from the install;
//   5. pnpm refuses a tarball whose bytes changed after the lockfile was
//      written (the presence twin of 1, on a throwaway probe package).
//
// The tarball is served over HTTP from 127.0.0.1 under the same path the
// GitHub release asset has, so the dependency line has the release's form.
//
//   node scripts/consumer-test.mjs <tarball>
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assetUrl } from "./release.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const KIT = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const PNPM_ENV = { ...process.env, CI: "true" };

/** Runs a command; resolves { code, out } with stdout and stderr merged. */
function run(cmd, args, cwd) {
  return new Promise((done) => {
    const child = spawn(cmd, args, {
      cwd,
      env: PNPM_ENV,
      shell: process.platform === "win32",
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => done({ code: code ?? 1, out }));
  });
}

async function must(cmd, args, cwd, what) {
  const { code, out } = await run(cmd, args, cwd);
  if (code !== 0) {
    console.error(out);
    throw new Error(`${what} failed (exit ${code})`);
  }
  return out;
}

/** Serves `files` (a Map of URL path -> bytes) on 127.0.0.1. */
async function serve(files) {
  const server = createServer((req, res) => {
    const body = files.get(req.url ?? "");
    if (!body) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": body.length,
    });
    res.end(body);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = server.address();
  return { server, origin: `http://127.0.0.1:${port}` };
}

/** Removes a scratch directory; a failure to clean up is reported, not fatal. */
function cleanup(dir) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  } catch (err) {
    console.log(`note: could not remove ${dir}: ${err.code ?? err}`);
  }
}

function sri(bytes) {
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
}

function pin(name) {
  const v = KIT.devDependencies[name];
  if (!v) throw new Error(`no dev pin for ${name} in package.json`);
  return v;
}

function check(cond, message, failures) {
  if (cond) console.log(`ok   ${message}`);
  else {
    console.error(`FAIL ${message}`);
    failures.push(message);
  }
}

const OPENAPI = `openapi: 3.1.0
info: { title: consumer-test, version: "1" }
paths:
  /v1/ping:
    get:
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema: { type: object, properties: { ok: { type: boolean } } }
`;

function consumerSource(entries) {
  const names = entries.map((e, i) => [`e${i}`, e]);
  return [
    ...names.map(([n, e]) => `import * as ${n} from "${e}";`),
    `import type { Lang } from "@rootxkit/uspace-ui/i18n";`,
    ``,
    `export const entries = [${names.map(([n]) => n).join(", ")}];`,
    `export const lang: Lang = "ka";`,
    `// @ts-expect-error the kit's types are real, so "fr" is not a Lang`,
    `export const notALang: Lang = "fr";`,
    ``,
  ].join("\n");
}

/**
 * Splits tsc output into errors that belong to the consumer or the kit
 * (fatal) and errors located in other packages' declarations. An error
 * without a location (a config error) counts as the kit's.
 */
export function tscErrors(out) {
  const kit = [];
  const other = [];
  for (const line of out.split("\n")) {
    if (!/error TS\d+/.test(line)) continue;
    const located = /^(.+?)\(\d+,\d+\): error/.exec(line);
    const file = located?.[1]?.replaceAll("\\", "/") ?? "";
    const thirdParty =
      file.includes("node_modules/") &&
      !file.includes("node_modules/@rootxkit/uspace-ui/") &&
      !file.includes("@rootxkit+uspace-ui");
    (thirdParty ? other : kit).push(line);
  }
  return { kit, other };
}

/** The package a node_modules path belongs to, for a short note. */
function packageOf(line) {
  const parts = line.replaceAll("\\", "/").split("node_modules/");
  const last = parts[parts.length - 1] ?? "";
  const segs = last.split("/");
  return (last.startsWith("@") ? segs.slice(0, 2) : segs.slice(0, 1)).join("/");
}

function tsconfig(module, moduleResolution) {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2023", "DOM", "DOM.Iterable"],
        module,
        moduleResolution,
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: ["node"],
      },
      files: ["consumer.ts"],
    },
    null,
    2,
  );
}

async function kitConsumer(tarball, failures) {
  const bytes = readFileSync(tarball);
  const release = new URL(assetUrl(KIT));
  const { server, origin } = await serve(new Map([[release.pathname, bytes]]));
  const url = `${origin}${release.pathname}`;
  const dir = mkdtempSync(join(tmpdir(), "uspace-ui-consumer-"));
  try {
    const peers = Object.fromEntries(
      Object.keys(KIT.peerDependencies).map((n) => [n, pin(n)]),
    );
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        {
          name: "scratch-consumer",
          private: true,
          type: "module",
          packageManager: KIT.packageManager,
          dependencies: { "@rootxkit/uspace-ui": url, ...peers },
          devDependencies: Object.fromEntries(
            [
              "typescript",
              "@testing-library/dom",
              "@types/node",
              "@types/react",
              "@types/react-dom",
            ].map((n) => [n, pin(n)]),
          ),
        },
        null,
        2,
      ),
    );
    // Same install policy as this repository: peers are listed, not
    // auto-installed, and no dependency build script runs.
    writeFileSync(
      join(dir, "pnpm-workspace.yaml"),
      "autoInstallPeers: false\ndangerouslyAllowAllBuilds: false\n",
    );
    console.log(
      `consumer: ${dir}\ndependency: "@rootxkit/uspace-ui": "${url}"`,
    );
    await must("pnpm", ["install"], dir, "pnpm install of the release URL");

    const lock = readFileSync(join(dir, "pnpm-lock.yaml"), "utf8");
    check(lock.includes(url), "lockfile records the tarball URL", failures);
    check(
      lock.includes(sri(bytes)),
      `lockfile pins the tarball's integrity ${sri(bytes).slice(0, 24)}...`,
      failures,
    );

    const kitDir = join(dir, "node_modules", "@rootxkit", "uspace-ui");
    const installed = JSON.parse(
      readFileSync(join(kitDir, "package.json"), "utf8"),
    );
    check(
      installed.version === KIT.version,
      `installed version is ${KIT.version}`,
      failures,
    );
    const font = readdirSync(join(kitDir, "fonts")).find((f) =>
      f.endsWith(".woff2"),
    );
    const specs = Object.keys(installed.exports).map(
      (k) =>
        `@rootxkit/uspace-ui${k.slice(1).replace("*.woff2", font ?? "none.woff2")}`,
    );
    writeFileSync(
      join(dir, "resolve.mjs"),
      `import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const bad = [];
for (const s of ${JSON.stringify(specs)}) {
  try {
    const f = fileURLToPath(import.meta.resolve(s));
    if (!existsSync(f)) bad.push(s + " -> " + f + " (no file)");
  } catch (e) { bad.push(s + ": " + e.message); }
}
for (const b of bad) console.error(b);
console.log(${specs.length} - bad.length + " of ${specs.length} subpaths resolve");
process.exitCode = bad.length ? 1 : 0;
`,
    );
    const resolved = await run("node", ["resolve.mjs"], dir);
    process.stdout.write(resolved.out);
    check(
      resolved.code === 0,
      "every exports subpath resolves to a file",
      failures,
    );

    const entries = Object.entries(installed.exports)
      .filter(([, v]) => typeof v === "object" && v.types)
      .map(([k]) => `@rootxkit/uspace-ui${k.slice(1)}`);
    writeFileSync(join(dir, "consumer.ts"), consumerSource(entries));
    for (const [name, mod, res] of [
      ["nodenext", "NodeNext", "NodeNext"],
      ["bundler", "ESNext", "Bundler"],
    ]) {
      writeFileSync(join(dir, `tsconfig.${name}.json`), tsconfig(mod, res));
      const tsc = await run(
        "pnpm",
        ["exec", "tsc", "-p", `tsconfig.${name}.json`],
        dir,
      );
      const { kit, other } = tscErrors(tsc.out);
      for (const e of kit) console.error(e);
      if (other.length > 0)
        console.log(
          `note: ${other.length} error(s) in third-party declarations ignored ` +
            `(a consumer builds with skipLibCheck, as Next.js sets it): ` +
            [...new Set(other.map(packageOf))].join(", "),
        );
      check(
        (tsc.code === 0 || other.length > 0) && kit.length === 0,
        `${entries.length} entry points type-check (${res}); the kit's own declarations checked with skipLibCheck false`,
        failures,
      );
    }
    // Presence twin of the type check: without the @ts-expect-error line
    // the deliberate error must be reported.
    writeFileSync(
      join(dir, "consumer.ts"),
      consumerSource(entries).replace(/\/\/ @ts-expect-error.*\n/, ""),
    );
    const typeError = await run(
      "pnpm",
      ["exec", "tsc", "-p", "tsconfig.bundler.json"],
      dir,
    );
    check(
      typeError.code !== 0 && typeError.out.includes('"fr"'),
      'a wrong Lang ("fr") is a type error, so the types are not any',
      failures,
    );

    writeFileSync(join(dir, "openapi.yaml"), OPENAPI);
    const gen = await run(
      "pnpm",
      ["exec", "uspace-ui-gen-api", "openapi.yaml", "openapi.d.ts"],
      dir,
    );
    const header = existsSync(join(dir, "openapi.d.ts"))
      ? readFileSync(join(dir, "openapi.d.ts"), "utf8").split("\n")[0]
      : "";
    if (gen.code !== 0) console.error(gen.out);
    check(
      gen.code === 0 &&
        header.startsWith(`// @generated by uspace-ui-gen-api ${KIT.version} `),
      "the uspace-ui-gen-api bin runs from the install",
      failures,
    );
  } finally {
    server.close();
    cleanup(dir);
  }
}

/** A one-file package packed with pnpm; `marker` changes its bytes. */
async function probeTarball(dir, marker) {
  const src = join(dir, `probe-src-${marker}`);
  mkdirSync(src, { recursive: true });
  writeFileSync(
    join(src, "package.json"),
    JSON.stringify({
      name: "integrity-probe",
      version: "1.0.0",
      main: "index.js",
    }),
  );
  writeFileSync(join(src, "index.js"), `module.exports = "${marker}";\n`);
  await must(
    "pnpm",
    ["pack", "--pack-destination", src],
    src,
    "pnpm pack of the probe",
  );
  return readFileSync(join(src, "integrity-probe-1.0.0.tgz"));
}

async function tamperProbe(failures) {
  const dir = mkdtempSync(join(tmpdir(), "uspace-ui-tamper-"));
  const files = new Map();
  const { server, origin } = await serve(files);
  try {
    const path =
      "/owner/repo/releases/download/v1.0.0/integrity-probe-1.0.0.tgz";
    files.set(path, await probeTarball(dir, "original"));
    const app = join(dir, "app");
    mkdirSync(app);
    writeFileSync(
      join(app, "package.json"),
      JSON.stringify({
        name: "tamper-consumer",
        private: true,
        packageManager: KIT.packageManager,
        dependencies: { "integrity-probe": `${origin}${path}` },
      }),
    );
    const store1 = join(dir, "store1");
    await must(
      "pnpm",
      ["install", "--store-dir", store1],
      app,
      "pnpm install of the probe",
    );
    files.set(path, await probeTarball(dir, "tampered"));
    // A second checkout of the same manifest and lockfile, with an empty
    // store, so pnpm must download the asset again.
    const app2 = join(dir, "app2");
    mkdirSync(app2);
    for (const f of ["package.json", "pnpm-lock.yaml"])
      copyFileSync(join(app, f), join(app2, f));
    const again = await run(
      "pnpm",
      ["install", "--frozen-lockfile", "--store-dir", join(dir, "store2")],
      app2,
    );
    const refusal = again.out
      .split("\n")
      .find((l) => /ERR_PNPM_\w*INTEGRITY|integrity/i.test(l));
    if (refusal) console.log(`pnpm: ${refusal.trim()}`);
    check(
      again.code !== 0 && refusal !== undefined,
      "a release asset whose bytes changed is refused by --frozen-lockfile",
      failures,
    );
  } finally {
    server.close();
    cleanup(dir);
  }
}

async function main(argv) {
  const tarball = argv[0];
  if (!tarball || !existsSync(tarball)) {
    console.error("usage: consumer-test.mjs <tarball>");
    return 2;
  }
  const failures = [];
  await kitConsumer(resolve(tarball), failures);
  await tamperProbe(failures);
  if (failures.length > 0) {
    console.error(`consumer-test: ${failures.length} check(s) failed`);
    return 1;
  }
  console.log("consumer-test: every check passed");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
