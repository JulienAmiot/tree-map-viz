# Changelog

All notable user-observable changes to **Tree Map Viz** land here, keyed by
`package.json#version` (the public semver per SPEC §17.82).

The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
the project's full as-built record (every internal strand, refactor, and
sonar-leak reset) lives in [`docs/SPEC.md`](docs/SPEC.md).

> **Semver triggers** — `X` bumps on any change that breaks an existing
> `localStorage` envelope (enforced by `npm run check:version-bump`);
> `Y` bumps on a backward-compatible user-visible feature; `Z` bumps on
> fixes, refactors, or UI-only features that don't touch the wire.

## [Unreleased]

_Nothing yet — open a new section here as soon as a feature strand starts._

## [0.2.0] — 2026-05-14

### Added

- **Runtime version-mismatch handling** (§17.86 + §17.86b). Every saved
  envelope now carries an `appMajor` field. On `load()`, the persistence
  adapter classifies the envelope into one of four branches — `equal`
  (load), `lower` (try injected migrators, else load with tolerance),
  `higher` (seed a safe fallback), or `legacy` (silent load, stamp on
  next save).
- **`<version-mismatch-banner>`** Lit element (§17.86b). A non-blocking
  inline strip slides under the top bar on any mismatch, with kind-specific
  copy and two operator actions: **Continue read-only** (subsequent saves
  become silent no-ops) and **Reset and lose data** (clears the storage
  key and reloads).
- **Wire-shape snapshot guard** (§17.85). New `npm run snapshot:update`
  regenerates the canonical `wire-tree.snap.json` + `wire-envelope.snap.json`
  fixtures; `npm run check:version-bump` fires on modified snapshots and
  refuses to land a breaking JSON shape change without an X-bump.
- **v4 read-side adapter chain** (§17.88 → §17.93). The kiosk's view-model
  mapper now consumes v4 nodes (`TextNodeV4`, `BusinessScoreNode<T>`,
  `StrictRangeNode<T>`) via a `v3 → v4` bridge — purely internal, but it
  unblocks the v5 round-7 computation hierarchy planned at §17.94.

### Changed

- `package.json#version` envelopes now write `appMajor: 0` (was unset
  pre-§17.86). Pre-§17.86 envelopes still load silently via the `legacy`
  branch — no operator action required.

## [0.1.0] — 2026-05-10

### Added

- **GitHub Pages deployment** (§17.83). Every push to `master`
  rebuilds via `.github/workflows/pages.yml` and ships to
  <https://julienamiot.github.io/tree-map-viz/>.
- **`<about-modal>`** Lit element (§17.84) reachable from the burger
  menu's new **About…** entry. Renders app version, build date, and a
  link to the GitHub repo.
- **`src/version.ts`** + Vite-injected `__APP_VERSION__` /
  `__APP_BUILD_DATE__` globals (§17.84). Single import path the rest of
  the app uses to read the current semver.
- **Semver policy** (§17.82). `X` / `Y` / `Z` triggers pinned in
  `docs/SPEC.md` and re-summarised in `README.md` §2.9.

### Changed

- `package.json#version` bumped `0.0.1 → 0.1.0` — first non-trivial
  value for the field; signals **pre-release** while the v3 → v4
  migration is still in flight.

[Unreleased]: https://github.com/JulienAmiot/tree-map-viz/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/JulienAmiot/tree-map-viz/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/JulienAmiot/tree-map-viz/releases/tag/v0.1.0
