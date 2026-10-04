export function isPrerelease(version: string): boolean;
export function tagMismatch(tag: string, version: string): string | null;
export function tarballName(name: string, version: string): string;
export function githubRepo(repositoryUrl: string): string;
export function assetUrl(pkg: {
  name: string;
  version: string;
  repository: { url: string };
}): string;
export const LATEST_READ_ATTEMPTS: number;
export const LATEST_READ_DELAY_MS: number;
export const RELEASE_QUERY: string;
export interface ReleaseSeen {
  tagName: string;
  isLatest: boolean;
  isPrerelease: boolean;
}
export function releaseQueryArgs(repo: string, tag: string): string[];
export function parseReleaseAnswer(text: string): ReleaseSeen | null;
export function checkLatest(opts: {
  tag: string;
  prerelease: boolean;
  attempts: number;
  delayMs: number;
  query(tag: string): Promise<ReleaseSeen | null>;
  sleep(ms: number): Promise<void>;
  log(line: string): void;
}): Promise<{ ok: boolean; attempts: number; message: string }>;
