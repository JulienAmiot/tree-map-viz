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

## [0.3.0] — 2026-05-18

### Changed

- **v5 round-7 class diagram refreshed for the §17.117 / §17.119 /
  §17.120 follow-up node kinds.** `examples/classDiagramMermaid.v5
  .mermaid` (canonical) and its `.md` IDE-preview companion now
  include `WorkflowNode` (concrete `TextNode` subclass with a
  `statusId` slug field referencing one entry of the board's
  `workflowStatuses` table), `PictureNode` and `URLNode` (both
  concrete `ValueNode<string>` snapshot leaves that inherit
  **directly** from `ValueNode` rather than `HistorizableValue-
  Node` — pictures and URLs have no meaningful timeline), plus
  the `WorkflowStatus` value object (`id` / `label` / `color`)
  and the three matching `WorkflowCard` / `PictureCard` /
  `URLCard` entries in the visual layer. A new soft dependency
  `WorkflowNode ..> WorkflowStatus` documents the slug-reference
  pattern (label + colour stay out of the domain; the view layer
  resolves them at map time so renames don't orphan nodes). The
  `.md` companion also gains a "Round-7 follow-up node kinds"
  block 10/11/12 above the diagram. Diagram is the
  documentation; no runtime code changes.

### Added

- **Inline strategy picker on focused-panel Computed* tiles**
  (§17.104 / §17.116-followup). The `<computed-card>` and
  `<computed-business-score-card>` tiles now render a small native
  `<select>` in the top-left corner when shown as the focused
  parent (`viewRole === "asParent"`); changing it dispatches the
  long-existing `computation-kind-change` event, which `main.ts`
  routes to `EditNodeService.editFields` end-to-end. The picker
  stays hidden on child tiles in the treemap grid (parity with the
  v3 inline-edit pattern: heavy affordances live on the parent
  strip, child tiles stay read-only). `<node-view>` now forwards
  `viewRole` to the rendered per-kind tag so kinds that share the
  same tag across roles (Computed* per the registry) can gate
  role-specific affordances. Operators get one-tap strategy swaps
  for everyday tuning, with the full edit modal still available
  via the pencil button for combined edits.
- **Computed Business Score Card editing in the Edit-Node modal**
  (§17.94 / §17.95). The combined edit form closes the third v5
  round-7 surface gap on the edit side. It surfaces the BSC ladder
  (description, unit, target objective rows) **and** the Computed
  strategy `<select>` dropdown in a single panel so the operator
  can swap the roll-up strategy while tweaking the objective the
  score targets. `main.ts`'s `buildEditTarget` snapshots
  `ComputedBusinessScoreNode` instances ahead of the generic
  `ComputedNode` / `BusinessScoreNode` branches (the narrower
  subclass must come first), and `toAppEditPayload` rewrites the
  modal-side `ComputedBusinessScoreNode` kind tag to the
  application-layer `ComputedBusinessScore` (parity with the BSC /
  Picture / URL / StrictRange / Computed kind-tag rewrites).
- **Computed editing in the Edit-Node modal** (§17.94 / §17.95).
  ComputedNode instances are now editable from the kiosk: description
  and weight flow through the shared `CommonEdit` slots, and a
  strategy `<select>` dropdown (the same one the Add-Child modal
  exposes via `COMPUTATION_KIND_LABELS`) lets the operator swap the
  roll-up between **Sum**, **Average**, **Min**, **Max**, **Weighted
  Average** and **Count** without leaving the modal. The canonical
  `ComputationKind.name` flows through the wire and `main.ts`
  resolves it back to the singleton via `ComputationKind.fromName`
  (so reference equality with the `static readonly` slots holds
  end-to-end). ComputedBusinessScoreNode editing still falls through
  to the BSC branch for now (combined editor lands in the next
  strand).
- **Strict Range editing in the Edit-Node modal** (§17.77 / §17.94).
  StrictRange nodes are now editable from the kiosk: description and
  weight flow through the existing modal, and the structural
  `[min, max]` bounds appear as a read-only row so the operator sees
  the active range contract while editing. Bounds remain structural
  (the application service's `StrictRange` edit shape is `CommonEdit`
  only); changing the bounds still requires re-creation through
  `<add-child-modal>`. `main.ts` rewrites the modal-side
  `StrictRangeNode` kind tag to the application-layer `StrictRange`
  (parity with the BSC / Picture / URL kind-tag rewrites).
- **Strict Range card kind in the Add-Child modal** (§17.77 / §17.94).
  The bounded-metric kind has been supported by the application service
  since the v5 round-7 Phase C landing, but operators couldn't reach it
  from the kiosk. The modal catalogue now lists **Strict Range** between
  **Business Score Card** and **Picture**, with a dedicated form that
  collects title + optional description + weight + `min` + `max` + a
  seed observation (current value + as-of date). Out-of-range seed
  values are rejected by the domain (`StrictRange.requireValue`) and
  surfaced through the modal's existing error path.
- **Computed card kind in the Add-Child modal** (§17.94 / §17.95). The
  derived-value roll-up kind is now reachable from the kiosk catalogue.
  Operators pick a strategy (**Sum**, **Average**, **Min**, **Max**,
  **Weighted Average**, or **Count**) from a native dropdown that lists
  every `ComputationKind` inhabitant with friendly labels (e.g. "Sum (Σ
  children)"); the current value is computed from the node's eligible
  children, no seed observation required.
- **Computed Business Score Card kind in the Add-Child modal** (§17.94 /
  §17.95). The scored-derived-metric kind closes the third v5 round-7
  surface gap. The form combines the BSC's unit + target objective rows
  with the Computed roll-up's strategy dropdown — the value rolls up
  from eligible children while still rendering against an objective bar
  on the kiosk tile.

### Removed

- **`Computed` + `Eligible for parent computation` checkboxes** retired
  from the Business Score Card forms in both `<add-child-modal>` and
  `<edit-node-modal>` (§17.99b / §17.99c follow-up). The v3-era flags
  were no-ops since round-7: a "computed BSC" is now created by picking
  a dedicated **Computed Business Score Card** kind from the catalogue
  (see above), and per-node eligibility is the `disabled` flag owned by
  the edit modal. No operator action required; pre-existing BSC nodes
  keep their effective behaviour through the v3 → v4 bridge.

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

[Unreleased]: https://github.com/JulienAmiot/tree-map-viz/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/JulienAmiot/tree-map-viz/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/JulienAmiot/tree-map-viz/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/JulienAmiot/tree-map-viz/releases/tag/v0.1.0
