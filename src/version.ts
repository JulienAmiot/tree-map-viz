/**
 * `version.ts` — typed re-export of the Vite-injected app version + ISO
 * build date (SPEC §17.84). Single import path so future inject-mechanism
 * swaps (e.g. `import.meta.env.VITE_*`) only edit this module. Globals
 * declared in `src/vite-env.d.ts`. `APP_VERSION` is `MAJOR.MINOR.PATCH`
 * (per SemVer 2.0.0); `BUILD_DATE` is ISO `YYYY-MM-DD`.
 */
export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_DATE: string = __APP_BUILD_DATE__;

/**
 * Extracts the SemVer major component from `MAJOR.MINOR.PATCH`. Throws on
 * malformed input — the source value flows from `package.json#version`
 * which is gated by SemVer at build time, so a parse failure is a build
 * configuration bug, not a runtime fault to swallow.
 *
 * Added in SPEC §17.86 for the runtime version-mismatch handler — the
 * persistence adapter compares the persisted envelope's `appMajor` against
 * {@link APP_MAJOR} to decide whether to load, migrate, or refuse.
 */
export function parseMajor(version: string): number {
  const m = /^(\d+)\.\d+\.\d+/.exec(version);
  if (m === null) {
    throw new Error(`parseMajor: "${version}" is not a SemVer MAJOR.MINOR.PATCH string`);
  }
  return Number(m[1]);
}

/**
 * The running app's MAJOR component. Consumed by the persistence adapter's
 * §17.86 mismatch check; bumped manually via `package.json#version`'s X
 * whenever the persisted JSON shape changes incompatibly (per §17.82).
 */
export const APP_MAJOR: number = parseMajor(APP_VERSION);
