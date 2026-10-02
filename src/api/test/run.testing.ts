// Test helper: runs the uspace-ui-gen-api bin and tsc as child processes,
// the way a web/ and its CI run them. Not exported from the package.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

export const BIN = resolve("bin/uspace-ui-gen-api.mjs");
const TSC = require.resolve("typescript/bin/tsc");

export interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(args: string[]): Run {
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** `uspace-ui-gen-api ...args`. */
export function genApi(...args: string[]): Run {
  return run([BIN, ...args]);
}

/** `tsc --noEmit -p <project> ...flags`. */
export function tsc(project: string, ...flags: string[]): Run {
  return run([TSC, "--noEmit", "-p", project, ...flags]);
}
