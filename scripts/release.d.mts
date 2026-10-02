export function isPrerelease(version: string): boolean;
export function tagMismatch(tag: string, version: string): string | null;
export function tarballName(name: string, version: string): string;
export function githubRepo(repositoryUrl: string): string;
export function assetUrl(pkg: {
  name: string;
  version: string;
  repository: { url: string };
}): string;
