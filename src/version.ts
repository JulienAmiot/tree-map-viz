/**
 * `version.ts` — typed re-export of the Vite-injected app version + ISO
 * build date (SPEC §17.84). Single import path so future inject-mechanism
 * swaps (e.g. `import.meta.env.VITE_*`) only edit this module. Globals
 * declared in `src/vite-env.d.ts`. `APP_VERSION` is `MAJOR.MINOR.PATCH`
 * (per SemVer 2.0.0); `BUILD_DATE` is ISO `YYYY-MM-DD`.
 */
export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_DATE: string = __APP_BUILD_DATE__;

/** §17.86 — extracts the SemVer MAJOR; throws on malformed input (build-config bug, not runtime). */
export function parseMajor(version: string): number {
  const m = /^(\d+)\.\d+\.\d+/.exec(version);
  if (m === null) throw new Error(`parseMajor: "${version}" is not a SemVer MAJOR.MINOR.PATCH string`);
  return Number(m[1]);
}

/** §17.86 — running app's MAJOR, consumed by the persistence adapter's mismatch check. */
export const APP_MAJOR: number = parseMajor(APP_VERSION);
