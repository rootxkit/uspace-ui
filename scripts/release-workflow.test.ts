// release.yml signs what it releases: the release job may mint the OIDC
// token keyless signing needs and store an attestation, it attests the
// tarball before the GitHub Release is created, and its read-back
// verifies the attestation on the bytes downloaded from the public URL.
// SHA256SUMS alone is written by the same job and proves no origin.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(
  path.join(root, ".github/workflows/release.yml"),
  "utf8",
).replace(/\r\n/g, "\n");
const releaseJob = workflow.slice(workflow.indexOf("\n  release:\n"));

describe("release.yml provenance", () => {
  it("has a release job", () => {
    expect(workflow.indexOf("\n  release:\n")).toBeGreaterThan(0);
  });

  it("lets only the release job mint the OIDC token and write the attestation", () => {
    expect(releaseJob).toMatch(/^ {6}id-token: write$/m);
    expect(releaseJob).toMatch(/^ {6}attestations: write$/m);
    const beforeRelease = workflow.slice(0, workflow.indexOf("\n  release:\n"));
    expect(beforeRelease).not.toMatch(/id-token: write|attestations: write/);
  });

  it("attests the tarball with a SHA-pinned action before the release is created", () => {
    const attest =
      /uses: actions\/attest-build-provenance@[0-9a-f]{40} # v\d+\.\d+\.\d+\n {8}with:\n {10}subject-path: release\/\$\{\{ env\.NAME \}\}\n/;
    expect(releaseJob).toMatch(attest);
    const at = releaseJob.search(attest);
    expect(at).toBeGreaterThan(releaseJob.indexOf("sha256sum -c -"));
    expect(at).toBeLessThan(releaseJob.indexOf("gh release create"));
  });

  it("verifies the attestation on the downloaded asset, for this workflow", () => {
    const readBack = releaseJob.slice(
      releaseJob.indexOf("- name: Read the release back"),
    );
    expect(readBack).toContain(
      'gh attestation verify "$RUNNER_TEMP/$NAME" --repo "$GITHUB_REPOSITORY" \\\n',
    );
    expect(readBack).toContain(
      '--signer-workflow "$GITHUB_REPOSITORY/.github/workflows/release.yml"',
    );
    expect(readBack.indexOf("gh attestation verify")).toBeGreaterThan(
      readBack.indexOf("curl -sSfL"),
    );
  });

  it("reads back that a plain version is the latest release and an rc never is", () => {
    const readBack = releaseJob.slice(
      releaseJob.indexOf("- name: Read the release back"),
    );
    const create = releaseJob.slice(
      releaseJob.indexOf("- name: Create the GitHub Release"),
      releaseJob.indexOf("- name: Read the release back"),
    );
    // The flags that set it, both ways.
    expect(create).toContain("flags+=(--prerelease)");
    expect(create).toContain("flags+=(--latest)");
    // The answer read back without a 404 when no plain release exists yet.
    expect(readBack).toContain(
      "gh release list --limit 100 --json tagName,isLatest",
    );
    expect(readBack).not.toMatch(/gh api [^\n]*releases\/latest/);
    expect(readBack).toMatch(
      /if \[ "\$want_pre" = true \]; then\n\s+test "\$latest" != "\$GITHUB_REF_NAME"\n\s+else\n\s+test "\$latest" = "\$GITHUB_REF_NAME"\n\s+fi\n/,
    );
  });
});

describe("workflow shells", () => {
  it.each(["release.yml", "ci.yml"])(
    "%s runs every step with bash -eo pipefail",
    (name) => {
      const text = readFileSync(
        path.join(root, ".github/workflows", name),
        "utf8",
      ).replace(/\r\n/g, "\n");
      const head = text.slice(0, text.indexOf("\njobs:\n"));
      expect(head).toMatch(
        /^defaults:\n {2}run:\n(?: {4}#.*\n)* {4}shell: bash$/m,
      );
      expect(text).not.toMatch(/^\s+shell: (?!bash$)/m);
    },
  );
});
