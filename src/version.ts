/**
 * `version.ts` — typed re-export of the Vite-injected app version + ISO
 * build date (SPEC §17.84). Single import path so future inject-mechanism
 * swaps (e.g. `import.meta.env.VITE_*`) only edit this module. Globals
 * declared in `src/vite-env.d.ts`. `APP_VERSION` is `MAJOR.MINOR.PATCH`
 * (per SemVer 2.0.0); `BUILD_DATE` is ISO `YYYY-MM-DD`.
 */
export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_DATE: string = __APP_BUILD_DATE__;
