# Tree Map Viz

A touch-first, kiosk-scale visualisation of nested business metrics and goals,
arranged as a **squarified treemap** the operator can drill into, edit live,
import/export, and split across multiple boards.

The product runs as a single-page app deployed to GitHub Pages and serves
itself out of the visitor's `localStorage`, so a board, its history, and its
objectives survive page reloads and live-edits without any backend.

> **Live build**: <https://julienamiot.github.io/tree-map-viz/>
> Every push to `master` re-deploys via `.github/workflows/pages.yml`.

---

## 1. Product context

- **Surface**: 65" 4K touch kiosk that rotates between **landscape (16/9)**
  and **portrait (9/16)** — the layout reflows automatically.
- **Touch-first**: no keyboard assumed. Forms, sliders, and drag-style
  interactions are sized for a finger on glass.
- **Single-page**: a hash-routed Lit app served as a static bundle. No backend.
- **Storage**: everything (boards, trees, history, objectives, settings,
  workflow-status palette) lives in one `localStorage` envelope.
- **Multi-board**: the user manages a collection of independent boards;
  switching boards is a one-tap action.
- **Deep-linkable**: the URL hash fully reconstructs the visible state
  (selected board + focused node), so any view can be shared.

## 2. Core features

### 2.1 Treemap viewport

- Top bar with the board name, breadcrumb of the focus path, and burger menu.
- Parent identity strip showing the focused node — title, description, value,
  unit chip, objective progress, trend arrow, status pill, header actions.
- Children grid — squarified treemap of the focused node's direct children,
  tile size proportional to each child's weight.
- Synthetic `+` tile appended to the grid while the parent is under capacity.
- Children capacity ceiling of 12 per node.
- Automatic landscape ↔ portrait reflow (parent strip on the left rail in
  landscape, on top in portrait).

### 2.2 Node kinds

- **Text node** — free-text content + timestamped history; the latest entry
  is both the displayed value and the description.
- **Business Score Card node** — numeric value with timestamped history,
  unit, and an `Objective(targetValue, targetDate)` with on-track / off-track
  signalling.
- **Computed node** — numeric value derived from the children via a chosen
  `Computation` strategy; the value is read-only and updates as children
  change.
- **Computed Business Score Card node** — Computed-node value plus a
  Business-Score Card objective; the derived value is matched against the
  same on-track / off-track logic as a Business Score Card node.
- **Workflow node** — text content plus a board-level workflow status
  reference (default PDCA palette: *plan*, *do*, *check*, *act*); status
  is a stable id, label and colour are resolved per-board.
- **Picture node** — an image referenced by URL; the focused panel renders
  the full image, the child tile renders a thumbnail. A load failure paints
  a warning-fill fallback.
- **URL node** — a URL plus its QR code; the focused panel splits between
  the QR code and a clickable link aside (opens in a new tab with
  `noopener noreferrer`).

### 2.3 Aggregation

A parent's displayed value (on Computed and Computed-Business-Score nodes)
is derived from its children via a chosen `Computation` strategy:

- `SUM`
- `AVERAGE`
- `MIN`
- `MAX`
- `WEIGHTED_AVERAGE`
- `COUNT`

Each node carries a `disabled` flag that opts it out of its parent's
aggregation without removing it from the tree; Text and Workflow nodes
never enter aggregation by type. Aggregation is **read-only** — parent
history is never auto-written, so the audit trail of operator-recorded
inputs stays intact.

### 2.4 Editing

- **Add child** modal opened from the `+` tile; picks the child kind and
  pre-fills its identity and weight.
- **Edit node** modal opened from each focused-panel tile's gear icon;
  covers description, recorded value (with timestamp), objective,
  computation kind, weight, workflow status, picture/URL targets, and
  the disabled flag.
- **Inline title edit** on every focused-panel tile.
- **Inline value edit** on Business Score Card, Computed Business Score
  Card, Text, and Workflow focused panels.
- **Inline unit-chip edit** on Business Score Card and Computed Business
  Score Card focused panels (empty units are accepted).
- **Inline weight edit** via a touch-sized slider popover anchored to a
  child tile's weight icon.
- **Inline computation-kind switch** on Computed and Computed Business
  Score Card focused panels.
- **Inline workflow-status picker** on the Workflow focused panel.

### 2.5 Shell and chrome

- **Burger menu** — Import, Export, Boards, Settings, About entries.
- **About modal** — running semver, build date, repo link, "What's new"
  link to the changelog, and an entry into the design-system showcase.
- **Design-system page** — full-screen catalogue of every atom, molecule,
  organism, and per-kind view in both AsChild and AsParent roles, with a
  text search across the cells.
- **Boards panel modal** — list, switch, and create boards (with a
  showcase-seed option).
- **Board settings modal** — rename or delete the active board (the last
  remaining board cannot be deleted) and tune the board-level fresh-date
  colour gradient.
- **Focus breadcrumb** — clickable path from the root to the current
  focus, with one-tap navigation to any ancestor.

### 2.6 Animations

- **Drill into** — FLIP-style morph from the tapped child tile to the
  parent strip, with the rest of the grid fading out, followed by a
  brief children-grid fade-in once the new focus settles.
- **Close to parent** — symmetric morph back when the strip's close-X is
  pressed.
- **Description reveal** on focus swap — easing + staggered opacity +
  directional slide-in.
- **Animations honour `prefers-reduced-motion`** and commit synchronously
  when motion is suppressed.

### 2.7 Routing and deep links

- `HashRouter` reads `#/<boardId>/<nodeId>` and is the single source of
  truth for "what is on screen". Every drill, breadcrumb tap, and board
  switch goes through it, so the browser back button works and any view
  can be linked to.

### 2.8 Import / Export

- **Export** — pretty-printed JSON of the current board's tree.
- **Import** — validate-before-replace: a successful decode atomically
  swaps the current board's tree; a failed decode never touches in-memory
  state and surfaces the reason to the operator.

### 2.9 Versioning

- The kiosk stamps its semver and build date into the bundle and surfaces
  them via the About modal, alongside a link to [`CHANGELOG.md`](CHANGELOG.md).
- Every saved envelope carries the major version it was written with.
- A CI guard (`npm run check:version-bump`) compares modified wire
  snapshots against the base ref and refuses to land a breaking JSON
  shape change without a major bump.

**Semver policy**

- `X` (major) — wire-breaking change to the saved envelope.
- `Y` (minor) — new backward-compatible feature on the wire.
- `Z` (patch) — bug fixes, refactors, or UI-only features that don't
  touch the wire.

## 3. Architecture at a glance

Hexagonal layout, enforced via ESLint's `no-restricted-imports`:

```
src/
  domain/       pure TS — value objects, node hierarchy, capability interfaces,
                computation strategies, board model
  application/  use-cases and ports — TreeNavigationService,
                BoardCollectionService, EditNodeService, ImportExportService, …
  adapters/
    persistence/  LocalStorageBoardCollectionRepository, jsonCodec
    ui/           Lit custom elements (shell, modals, per-kind views, animations)
  test/         unit (vitest) + e2e (playwright-bdd) + snapshots
  main.ts       composition root — the only place that wires concrete adapters
  version.ts    APP_VERSION / APP_MAJOR / BUILD_DATE (Vite-injected at build)
```

The Lit custom-element surface (each in its own shadow root):

| Tag                                  | Role                                                        |
| ------------------------------------ | ----------------------------------------------------------- |
| `<tree-map-screen>`                  | Top-level shell — top bar + layout + design-system seam     |
| `<design-system-page>`               | Full-screen design-system showcase reached from About       |
| `<parent-identity-strip>`            | Focused-node panel — title + body + header actions          |
| `<children-grid>`                    | Squarified treemap of the focused node's children           |
| `<focus-breadcrumb>`                 | Breadcrumb of the focus path                                |
| `<burger-menu>`                      | Import / Export / Boards / Settings / About entry           |
| `<node-view>`                        | Per-kind view dispatcher                                    |
| `<plus-tile>`                        | Synthetic "+ add child" tile                                |
| `<card-frame>`                       | Shared card chrome — header + body + header-actions slot    |
| `<card-body>`                        | Shared 3-cell body skeleton (`lead` / `aux` / `meta` slots) |
| `<weight-edit-button>`               | Child-tile weight glyph + tap target                        |
| `<weight-edit-popover>`              | Touch slider anchored to a child tile                       |
| `<ds-icon>`                          | Lucide icon atom — `name` slug + `currentColor` SVG         |
| `<business-score-card-as-child>`     | Business Score Card tile in the children grid               |
| `<business-score-card-as-parent>`    | Business Score Card panel on focus                          |
| `<computed-card>`                    | Computed node tile + panel (`view-role` attribute)          |
| `<computed-business-score-card>`     | Computed Business Score Card tile + panel                   |
| `<workflow-node-as-child>`           | Workflow tile in the children grid                          |
| `<workflow-node-as-parent>`          | Workflow panel on focus                                     |
| `<text-node-as-child>`               | Text tile in the children grid                              |
| `<text-node-as-parent>`              | Text panel on focus                                         |
| `<picture-node-as-child>`            | Picture tile in the children grid                           |
| `<picture-node-as-parent>`           | Picture panel on focus                                      |
| `<url-node-as-child>`                | URL tile in the children grid                               |
| `<url-node-as-parent>`               | URL panel on focus                                          |
| `<add-child-modal>`                  | New-child flow                                              |
| `<edit-node-modal>`                  | Per-kind node-settings flow                                 |
| `<board-settings-modal>`             | Rename / delete the active board + fresh-date colour        |
| `<boards-panel-modal>`               | Browse / switch / create boards                             |
| `<about-modal>`                      | Read-only version + build date + repo + What's new link     |

## 4. Tech stack

| Concern             | Tool                                           |
| ------------------- | ---------------------------------------------- |
| Language            | TypeScript (strict)                            |
| UI                  | Lit 3 custom elements (no React, no framework) |
| Iconography         | Lucide (`lucide-static`, ISC + MIT)            |
| QR rendering        | `qrcode` (MIT)                                 |
| Build / dev server  | Vite 6                                         |
| Unit tests          | Vitest + jsdom + `@open-wc/testing-helpers`    |
| End-to-end tests    | playwright-bdd (Gherkin → Playwright)          |
| Quality gate        | SonarQube (local Docker; pre-push husky hook)  |
| Deploy              | GitHub Pages (`.github/workflows/pages.yml`)   |
| Persistence         | Browser `localStorage` (single envelope)       |
| Dependencies (prod) | `lit`, `qrcode`                                |

## 5. Development

Prerequisites: Node 22+, npm, and Docker (only if you want to run the local
SonarQube quality gate).

```sh
npm install
npm run dev              # Vite dev server with HMR
npm run build            # tsc -b && vite build → ./dist
npm run preview          # serve ./dist locally on :4173

npm run test             # vitest run — unit + integration suite
npm run test:watch       # vitest watch
npm run test:coverage    # writes coverage/lcov.info for Sonar

npm run test:e2e         # playwright-bdd against the built bundle
npm run test:e2e:headed  # same, but in headed Chromium
npm run test:e2e:xray    # run e2e then dry-run-export the results to XRay

npm run lint             # tsc --noEmit
npm run lint:rules       # eslint .

npm run check:version-bump  # CI guard: wire-snapshot diff ↔ major bump

npm run sonar:up         # start the local SonarQube + DB containers
npm run sonar:gate       # run the gate (blocks until pass/fail)
npm run sonar:status     # docker compose ps for the sonar containers
npm run sonar:logs       # follow the sonarqube container logs
npm run sonar:down       # stop the containers
```

A husky `pre-push` hook runs the Sonar gate against `HEAD` so a push to
`master` cannot succeed if the local gate fails.

A Cursor `sessionStart` hook brings Docker Desktop, the local SonarQube
container, and the Vite dev server online at the start of every agent
session.

## 6. Engineering principles

These are binding constraints (and the bar each PR is held to):

- **TDD** — every domain rule starts as a failing Vitest unit test
  (pure TS, no DOM).
- **BDD with Gherkin** — user-observable behaviour lives in `.feature`
  files under `src/test/e2e/features/`, driven against a real headless
  Chromium.
- **Hexagonal layering** — `domain → application → adapters` is one-way;
  a custom ESLint rule fails the build on a backwards import.
- **SOLID + object calisthenics** — value objects everywhere,
  polymorphism over flag conditionals, `null` never used as control flow.
- **CSS-first animations** — JS only flips classes and `aria-*` state.
  Honour `prefers-reduced-motion`.
- **Single-strand merges** — every feature lands on its own short-lived
  branch and passes through the SonarQube gate (≤ 300 net new lines per
  scan window) before merging to `master`.

## 7. Documentation map

| File                                                 | Purpose                                                |
| ---------------------------------------------------- | ------------------------------------------------------ |
| `README.md` (this file)                              | High-level functional spec — what the product does     |
| `CHANGELOG.md`                                       | User-facing release notes per `package.json#version`   |
| `examples/classDiagramMermaid.v4.md` / `.mermaid`    | Current implemented domain model                       |
| `examples/classDiagramMermaid.v5.md` / `.mermaid`    | Target round-7 domain design                           |
| `examples/test.json`                                 | Canonical single-tree wire fixture                     |
| `bin/README.md`                                      | Notes on the maintenance scripts under `bin/`          |
| `THIRD_PARTY_LICENSES.md`                            | Mirrored Lucide + Feather + QR-code license texts      |

## 8. Maintenance contract for this file

This README is the **exhaustive feature inventory**: every shipped node
kind, aggregation strategy, editing affordance, modal, shell entry, and
animation appears once, in its matching section, in one concise line.
Every modification — code, config, scripts, or docs — re-reads the
README and updates the inventory in the same commit if a feature
landed, retired, or changed shape.

The corresponding Cursor rule lives at
[`.cursor/rules/keep-readme-in-sync.mdc`](.cursor/rules/keep-readme-in-sync.mdc)
and applies to every session.
