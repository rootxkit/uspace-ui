// The API freeze (WP-14): the rule that tags every export @public or
// @beta, and api-extractor configured to fail on an untagged export and
// on a public signature that reaches a beta type, shown both ways on a
// throwaway entry point (E-01).
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Extractor,
  ExtractorConfig,
  type ExtractorMessage,
} from "@microsoft/api-extractor";
import { afterEach, describe, expect, it } from "vitest";

import { decide, planNames } from "./release-tags.mjs";

describe("the release tag rule", () => {
  const names = planNames(
    "intro\n## 3. Public API per entry point\n`AlertList` `fixtures`\n## 4. Third\n`Hidden`\n",
  );

  it("reads the names of PLAN §3 only", () => {
    expect(names.has("AlertList")).toBe(true);
    expect(names.has("Hidden")).toBe(false);
  });

  it("makes a §3 name public and any other beta", () => {
    expect(
      decide("alerts", "AlertList", "src/alerts/AlertList.tsx", names),
    ).toBe("public");
    expect(decide("alerts", "sortAlerts", "src/alerts/changes.ts", names)).toBe(
      "beta",
    );
  });

  it("keeps model and the vendored ui set public whole, and ...ForTests and the adapters beta", () => {
    expect(decide("model", "TRUSTS", "src/model/enums.ts", names)).toBe(
      "public",
    );
    expect(decide("ui", "DialogContent", "src/ui/dialog.tsx", names)).toBe(
      "public",
    );
    expect(decide("ui", "Stat", "src/ui/extra/Stat.tsx", names)).toBe("beta");
    expect(decide("model", "resetForTests", "src/model/x.ts", names)).toBe(
      "beta",
    );
    expect(
      decide("test", "fixtures", "src/test/adapters/track.ts", names),
    ).toBe("beta");
  });

  it("is what scripts/api-extractor.json enforces", () => {
    const cfg = JSON.parse(
      readFileSync("scripts/api-extractor.json", "utf8"),
    ) as {
      messages: {
        extractorMessageReporting: Record<string, { logLevel: string }>;
      };
    };
    const m = cfg.messages.extractorMessageReporting;
    expect(m["ae-missing-release-tag"]?.logLevel).toBe("error");
    expect(m["ae-incompatible-release-tags"]?.logLevel).toBe("error");
  });
});

let dir = "";

afterEach(() => {
  if (dir !== "") rmSync(dir, { recursive: true, force: true });
  dir = "";
});

/** api-extractor with this repo's message rules on a one-file entry point. */
function extract(dts: string): ExtractorMessage[] {
  dir = mkdtempSync(join(tmpdir(), "release-tags-"));
  mkdirSync(join(dir, "report"));
  writeFileSync(join(dir, "entry.d.ts"), dts);
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "release-tags-probe", version: "1.0.0" }),
  );
  const repo = JSON.parse(
    readFileSync("scripts/api-extractor.json", "utf8"),
  ) as {
    messages: object;
  };
  const config = ExtractorConfig.prepare({
    configObject: {
      projectFolder: dir,
      mainEntryPointFilePath: join(dir, "entry.d.ts"),
      compiler: {
        overrideTsconfig: {
          compilerOptions: { strict: true, skipLibCheck: true, types: [] },
          include: [join(dir, "entry.d.ts")],
        },
      },
      apiReport: {
        enabled: true,
        reportFileName: "probe",
        reportFolder: join(dir, "report"),
        reportTempFolder: join(dir, "temp"),
      },
      docModel: { enabled: false },
      dtsRollup: { enabled: false },
      tsdocMetadata: { enabled: false },
      messages: repo.messages,
    },
    configObjectFullPath: join(dir, "api-extractor.json"),
    packageJsonFullPath: join(dir, "package.json"),
  });
  const messages: ExtractorMessage[] = [];
  Extractor.invoke(config, {
    localBuild: true,
    messageCallback: (m) => {
      messages.push(m);
      m.handled = true;
    },
  });
  // ae-undocumented goes into the report as "(undocumented)" in the real
  // run (addToApiReportFile); the callback sees it before that.
  return messages.filter(
    (m) => m.logLevel === "error" && m.messageId !== "ae-undocumented",
  );
}

describe("api-extractor on an entry point", () => {
  it("fails an untagged export", () => {
    const errors = extract("export declare function probe(): void;\n");
    expect(errors.map((m) => m.messageId)).toContain("ae-missing-release-tag");
  }, 60_000);

  it("fails a public signature that reaches a beta type", () => {
    const errors = extract(
      "/** @beta */\nexport interface Inner { a: number }\n/** @public */\nexport declare function probe(): Inner;\n",
    );
    expect(errors.map((m) => m.messageId)).toContain(
      "ae-incompatible-release-tags",
    );
  }, 60_000);

  it("passes when every export is tagged and public reaches public (the twin)", () => {
    const errors = extract(
      "/** @public */\nexport interface Inner { a: number }\n/** @public */\nexport declare function probe(): Inner;\n/** @beta */\nexport declare function later(): void;\n",
    );
    expect(errors.map((m) => `${m.messageId}: ${m.text}`)).toEqual([]);
  }, 60_000);
});
