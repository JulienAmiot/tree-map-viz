# Tree Map Viz

A touch-first, kiosk-scale visualisation of nested business metrics and goals,
arranged as a **squarified treemap** the operator can drill into, edit live,
import/export, and split across multiple boards.

The product runs as a single-page app deployed to GitHub Pages and serves
itself out of the visitor's `localStorage`, so a board, its history, and its
objectives survive page reloads and live-edits without any backend.

> **Live build**: <https://julienamiot.github.io/tree-map-viz/>
> Every push to `master` re-deploys via `.github/workflows/pages.yml`.

This file captures the **functional / high-level specification**; the
exhaustive implementation log (≈ 4 000 lines of as-built decisions) lives in
[`docs/SPEC.md`](docs/SPEC.md).

---

## 1. Product context

- **Surface**: 65" 4K touch kiosk that rotates between **landscape (16/9)** and
  **portrait (9/16)** — the layout reflows automatically via a `ResizeObserver`.
- **Touch-first**: no keyboard assumed. Forms, sliders, and drag-style
  interactions are sized for a finger on glass.
- **Single-page**: a hash-routed Lit app served as a static bundle. No backend.
- **Storage**: everything (boards, trees, history, objectives, settings) lives
  in one `localStorage` envelope. The user can **Import / Export** that
  envelope as JSON via the burger menu.
- **Multi-board**: the user manages a *collection* of independent boards;
  switching boards is a one-tap action.
- **Deep-linkable**: the URL hash fully reconstructs the visible state
  (selected board + focused node), so any view can be shared.

## 2. Core features (functional)

### 2.1 Treemap viewport

- **Top bar** — board name, breadcrumb of the focus path, burger menu.
  Always visible (no auto-hide).
- **Parent identity strip** — title, description, value, objective progress,
  trend arrow, and inline edit buttons for the currently-focused node.
  Sits on top in portrait and on the left rail in landscape.
- **Children grid** — squarified treemap of the focused node's direct
  children. Tile size is proportional to each child's `weight` value. A `+`
  tile is appended when capacity allows (max 12 children per node).

### 2.2 Node kinds

The kiosk currently supports two concrete node kinds, both live on the same
abstract tree base:

- **Business-Score nodes** — carry an `Objective(targetValue, targetDate)`,
  a `Unit`, and a time-stamped history of recorded values. The displayed value
  is the latest history entry; the displayed colour interpolates a gradient
  from "stale" to "fresh" based on the entry's age, with a separate signal
  for "off-objective" vs "on-track".
- **Text nodes** — carry only a time-stamped history of free-text entries; the
  description visible in the panel **is** the latest history value.

A v4 redesign is in flight (see §3 and `examples/classDiagramMermaid.v4.md`)
splitting the hierarchy into `TextNodeV4`, `BusinessScoreNode<T>`, and
`StrictRangeNode<T>` under a shared `RangedValueNode<T>` / `HistorizableValueNode<T>` /
`ValueNode<T>` / `Node` base. A v5 round-7 design adds `ComputedNode<T>` +
`ComputedBusinessScoreNode<T>` driven by a `Computation<T>` strategy hierarchy
(`SUM | AVERAGE | MIN | MAX | WEIGHTED_AVERAGE | COUNT`) — implementation
strands begin at §17.95.

### 2.3 Aggregation rule

A parent's displayed value is the **weighted average of its eligible children's
current values** (children that contribute and are not opted out via the
`eligibleForParentComputation` flag, with text children excluded by type).
The aggregation is **read-only**: parent history is never auto-written,
which preserves the audit trail of operator-recorded inputs.

### 2.4 Editing

- **Add child** — modal flow from a `+` tile; capacity-guarded by
  `MAX_CHILDREN_V4 = 12`.
- **Edit node** — modal flow from the parent strip's pencil icon; renames,
  edits the description, records a new value (with timestamp), and tunes the
  objective.
- **Inline weight edit** — popover anchored to a child tile's weight icon,
  with a slider sized for touch. Commits write a new `Weight` value object
  through the same persistence path.
- **Board settings** — rename / delete the active board.
- **Boards panel** — list, switch, create, and seed boards from a built-in
  showcase.

### 2.5 Animations

- **Drill into** — FLIP-style morph from the tapped tile to the parent strip,
  with the rest of the grid fading out, followed by a brief children-grid
  fade-in once the new focus settles.
- **Close to parent** — symmetric morph back when the strip's close-X is
  pressed.
- Both honour `prefers-reduced-motion` (and a test-only `dismissAnimations`
  sentinel) and commit synchronously when motion is suppressed.

### 2.6 Routing & deep links

- `HashRouter` reads `#/<boardId>/<nodeId>` and is the single source of truth
  for "what is on screen". Every navigation (drill, breadcrumb, board switch)
  goes through it, so the back button works and any view can be linked to.

### 2.7 Import / Export

- **Export** — pretty-printed JSON of the current board's tree (per-tree wire
  format; multi-board export rides on the same codec).
- **Import** — validate-before-replace: a successful decode atomically swaps
  the current board's tree; a failed decode never touches in-memory state
  and surfaces the reason via `window.alert`.

### 2.8 App version + version-mismatch handling

- The kiosk stamps its semver into the bundle (`__APP_VERSION__` +
  `__APP_BUILD_DATE__`) and surfaces it via the burger menu's **About**
  modal.
- Every saved envelope carries the major version it was written with
  (`appMajor`). On load, the persistence adapter classifies into one of four
  branches — **equal** (load), **lower** (try injected migrators, else load
  with tolerance), **higher** (seed a safe fallback), **legacy** (silent
  load and stamp on next save).
- On any mismatch a non-blocking `<version-mismatch-banner>` slides under
  the top bar with kind-specific copy + two operator actions:
  *Continue read-only* (subsequent saves become silent no-ops) and
  *Reset and lose data* (clears the storage key and reloads).
- A CI guard (`npm run check:version-bump`) compares modified wire snapshots
  against the base ref and refuses to land a breaking JSON shape change
  without an X-bump.

### 2.9 Versioning policy (semver-aligned)

- `X` (major) — JSON shape change that breaks existing saved envelopes.
  Guarded by the snapshot test + CI script.
- `Y` (minor) — new feature or capability that is backward-compatible
  on the wire (e.g. a new optional field).
- `Z` (patch) — bug fixes, refactors, or UI-only features that don't touch
  the wire.

Every feature strand also bumps `sonar.projectVersion`; this is independent
from `package.json#version` and exists only to reset SonarQube's leak window
between strands (see SPEC §17.72 for the corrected procedure).

## 3. Architecture at a glance

Hexagonal layout, enforced via ESLint's `no-restricted-imports`:

```
src/
  domain/       pure TS — value objects, node hierarchy, capability interfaces
  application/  use-cases & ports — TreeNavigationService, BoardCollectionService, ...
  adapters/
    persistence/  LocalStorageBoardCollectionRepository, jsonCodec
    ui/           Lit custom elements (shell, modals, per-node views, animations)
  test/         unit (vitest) + e2e (playwright-bdd) + snapshots
  main.ts       composition root — the only place that wires concrete adapters
  version.ts    APP_VERSION / APP_MAJOR / BUILD_DATE (Vite-injected at build)
```

The Lit custom-element surface (each in its own shadow root, registered via
`@customElement`):

| Tag                          | Role                                                  |
| ---------------------------- | ----------------------------------------------------- |
| `<tree-map-screen>`          | Top-level shell — top bar + banner slot + layout      |
| `<focus-breadcrumb>`         | Breadcrumb of the focus path                          |
| `<burger-menu>`              | Import / Export / Boards / Settings / About entry     |
| `<parent-identity-strip>`    | Focused-node panel (title + value + objective)        |
| `<children-grid>`            | Squarified treemap of the focused node's children     |
| `<node-view>`                | Per-kind dispatcher (`text-node-*` / `bsc-*`)         |
| `<plus-tile>`                | Synthetic "+ add child" tile                          |
| `<weight-edit-popover>`      | Touch slider anchored to a child tile                 |
| `<add-child-modal>`          | New-child flow                                        |
| `<edit-node-modal>`          | Rename / edit / record-value flow                     |
| `<board-settings-modal>`     | Rename / delete the active board                      |
| `<boards-panel-modal>`       | Browse / switch / create boards                       |
| `<about-modal>`              | Read-only version + build date + repo link            |
| `<version-mismatch-banner>`  | Non-blocking strip on persisted-vs-running mismatch   |

## 4. Tech stack

| Concern             | Tool                                           |
| ------------------- | ---------------------------------------------- |
| Language            | TypeScript (strict)                            |
| UI                  | Lit 3 custom elements (no React, no framework) |
| Build / dev server  | Vite 6                                         |
| Unit tests          | Vitest + jsdom + `@open-wc/testing-helpers`    |
| End-to-end tests    | playwright-bdd (Gherkin → Playwright)          |
| Quality gate        | SonarQube (local Docker; pre-push husky hook)  |
| Deploy              | GitHub Pages (`.github/workflows/pages.yml`)   |
| Persistence         | Browser `localStorage` (single envelope)       |
| Dependencies (prod) | `lit` only                                     |

## 5. Development

Prerequisites: Node 22+, npm, and Docker (only if you want to run the local
SonarQube quality gate).

```sh
npm install
npm run dev              # Vite dev server with HMR (no /tree-map-viz/ prefix)
npm run build            # tsc -b && vite build → ./dist
npm run preview          # serve ./dist locally on :4173

npm run test             # vitest run — unit + integration suite
npm run test:watch       # vitest watch
npm run test:coverage    # writes coverage/lcov.info for Sonar

npm run test:e2e         # playwright-bdd against the built bundle
npm run test:e2e:headed  # same, but in headed Chromium

npm run lint             # tsc --noEmit
npm run lint:rules       # eslint .

npm run snapshot:update  # regenerate the wire-shape snapshots (X-bump required)
npm run check:version-bump  # CI guard: snapshot diff ↔ X-bump consistency

npm run sonar:up         # start the local SonarQube + DB containers
npm run sonar:gate       # run the gate (blocks until pass/fail)
npm run sonar:down       # stop the containers
```

A husky `pre-push` hook runs the Sonar gate against `HEAD` so a push to
`master` cannot succeed if the local gate fails.

## 6. Engineering principles

These are binding constraints (and the bar each PR is held to):

- **TDD** — every domain rule starts as a failing Vitest unit test (pure TS,
  no DOM).
- **BDD with Gherkin** — user-observable behaviour lives in `.feature` files
  under `src/test/e2e/features/`, driven against a real headless Chromium.
- **Hexagonal layering** — `domain → application → adapters` is one-way; a
  custom ESLint `no-restricted-imports` rule fails the build on a backwards
  import.
- **SOLID + object calisthenics** — value objects everywhere, polymorphism
  over flag conditionals, `null` never used as control flow.
- **CSS-first animations** — JS only flips classes / `aria-*` state. Honour
  `prefers-reduced-motion`.
- **Single-strand merges** — every feature lands on its own short-lived
  branch and passes through the §17.85 schema guard + the SonarQube gate
  (≤ 300 net new lines per scan window) before merging to `master`.

## 7. Documentation map

| File                                                 | Purpose                                                 |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `README.md` (this file)                              | High-level functional spec (what the product does)      |
| `docs/SPEC.md`                                       | Living implementation log + open decisions              |
| `examples/classDiagramMermaid.v4.md` / `.mermaid`    | Current implemented domain model (Phase A + B shipped)  |
| `examples/classDiagramMermaid.v5.md` / `.mermaid`    | Target v5 design (Computation strategy + `disabled`)    |
| `examples/test.json`                                 | Canonical single-tree wire fixture                      |
| `bin/README.md`                                      | Notes on the maintenance scripts under `bin/`           |

## 8. Maintenance contract for this file

> **Rule** — whenever a feature strand changes user-observable behaviour,
> ship the matching update to this `README.md` in the same commit.

In practice that means: for any strand whose row in `docs/SPEC.md`
table adds, removes, or modifies a feature mentioned in **§2** (Core
features), **§3** (Architecture surface), **§4** (Tech stack), or **§5**
(Development scripts), this file gets edited alongside `docs/SPEC.md` and
lands in the same PR. Purely internal refactors and SPEC-only planning
strands don't require an update here.

The corresponding Cursor rule lives at
[`.cursor/rules/keep-readme-in-sync.mdc`](.cursor/rules/keep-readme-in-sync.mdc)
and applies to every session.
