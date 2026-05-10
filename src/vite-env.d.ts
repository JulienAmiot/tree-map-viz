/// <reference types="vite/client" />

// SPEC §17.84 — Vite `define` injects these at build / test time.
// Consumers import the typed re-exports from `src/version.ts` instead.
declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;
