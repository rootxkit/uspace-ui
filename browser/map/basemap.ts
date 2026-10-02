// The committed Tbilisi extract (browser/public/basemap/, README.md) is
// served at /basemap/ on the test page's own origin (vitest.config.ts
// publicDir), as a deployment serves it (PLAN §6.3).
export const basemapBaseUrl = (): string => window.location.origin;
