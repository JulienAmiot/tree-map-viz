# Tree Graph Viz — Living Specification

> Working specification distilled from the design conversation.
> When resuming work, **read this first**, then resolve the **Open decisions** at the bottom before continuing.

Companion artefacts in the repo:

- `examples/classDiagramMermaid.mermaid` — historical (V1) domain model
- `examples/classDiagramMermaid.v2.mermaid` — **current** domain model (Option B)
- `examples/test.json` — wire/persistence format fixture (single tree)
- `examples/test-before.html`, `examples/test-after.html` — early UI sketch (drilling)

---

## 1. Product context

- **Surface**: kiosk-style giant interactive screen, **65"**, **4K**, **touch-first**, switches **landscape ↔ portrait** seamlessly.
- **No keyboard assumed**. Forms must be touch-ergonomic.
- **Persistence**: everything (board collection + each tree + all values) stored as JSON in `localStorage`. Users can **import/export** the JSON.
- **Multi-board**: the user manages a *collection* of boards, each with its own tree and name.
- **Deep-linkable views**: the URL fully reconstructs the current view (board + focused node).

## 2. Engineering principles (binding)

- **TDD**: every domain rule starts as a failing Vitest unit test (pure TS, no DOM).
- **BDD with Gherkin**: user-observable behaviours live in `.feature` files run by `playwright-bdd` against a real headless Chromium (see §13.3). Step fixtures drive the view layer through the URL and a single opt-in test bridge — never by importing `src/`.
- **SOLID** (especially OCP for node kinds via capability interfaces).
- **Object calisthenics**: small classes, value objects everywhere (no primitive obsession), shallow inheritance, polymorphism over flag-driven conditionals, no `null` as control flow.
- **Minimal external libraries**.
- **Full TypeScript**.
- **CSS-first animations**: when in tradeoff, prefer CSS transitions/animations over JS-driven motion. JS only flips classes / `aria-*` state. Honour `prefers-reduced-motion`.

## 3. Domain model — Option B (locked)

Canonical diagram: `examples/classDiagramMermaid.v2.mermaid`.

### Composition + capability interfaces

- `TreeNode<T>` — abstract base. Owns: `id: UUID`, `identity: NodeIdentity`, `weight: Weight`, `parent`, `children`. Exposes `currentValue(): T`.
- `TextNode` — concrete sibling of `BusinessScoreCardNode`. Has only identity. **Does NOT implement `ContributesToParent<T>`** → excluded from parent computation by the type system, not by a flag.
- `BusinessScoreCardNode<T>` — concrete sibling. Composes `BusinessScoreCard<T>`. Implements `Historizable<T>`, `HasObjective<T>`, `ContributesToParent<T>`. Carries `computed: boolean` and `eligibleForParentComputation: boolean`.

### Value objects (no primitives)

`Title`, `Description`, `Weight`, `Unit`, `NodeIdentity { title, description }`.

### Aggregates

- `BusinessScoreCard<T>` — `unit: Unit`, `objective: Objective<T>`, `historizedValues: TimestampedValue<T>[]`. Implements `Historizable<T>`.
- `Objective<T>` — `initialValue: T`, `targetValue: T`, `targetDate: Date`.
- `TimestampedValue<T>` — `date: Date`, `value: T`.

> **As-built convention (Phase 2)**: `historizedValues` is canonically ordered **ascending** (oldest → newest). The fixture `examples/test.json` is reordered to match. See §17.2.

### Capability interfaces

- `Historizable<T>` → `history(): TimestampedValue<T>[]`
- `HasObjective<T>` → `objective(): Objective<T>`
- `ContributesToParent<T>` → `isEligible(): boolean`, `contribution(): TimestampedValue<T>`

### Computation rule (display-only, never written)

For any node, `currentValue()` = the `TimestampedValue<T>` with the latest `date`.

If a parent has `computed === true`:

```
displayedValue =
    Σ ( child.currentValue × child.weight )
    ───────────────────────────────────────
    Σ ( child.weight )
```

over children that **(a)** implement `ContributesToParent<T>` (i.e. are not `TextNode`) AND **(b)** report `isEligible() === true`.

The aggregation is **never written** to the parent's `historizedValues` — `historizedValues` stays the truth of recorded inputs; computation is a pure read-time decoration.

### JSON wire format

The flat shape from `examples/test.json` is the persistence contract. The decoder folds `targetValue` / `minimalValue` / `unit` into an `Objective<T>` + `Unit`, and `historizedValues` feeds `BusinessScoreCard<T>.historizedValues`.

> **As-built decisions (Phase 2)**: an objective with **no deadline** omits `targetDate` on the wire; the codec round-trips this through a sentinel ISO date `9999-12-31T23:59:59.999Z` on the domain side. Decode errors carry an RFC-6901 JSON pointer (e.g. `/childrenNodes/2/historizedValues/0/date`). See §17.2.

## 4. Layout & UI rules

### Viewport allocation

- **Whole viewport** = the focused parent node. **No permanent screen chrome.**
- Aspect: **16/9 in landscape**, **9/16 in portrait**. Reflows on rotation via `ResizeObserver`.
- Inside the viewport:
  - **Parent identity strip**: 20–25% of viewport. Always visible (does not auto-hide). Position: top in both orientations (option **c1** locked).
  - **Children grid**: the remaining 75–80%. Squarified treemap.

### Drawer (chrome)

- **Auto-hidden** with a handle. Tap/swipe the handle to reveal.
- Holds: **board name**, **breadcrumb of the focus path**, **burger menu** (Import / Export / Board collection management / future admin).
- **Breadcrumb**: shows titles from root → focused node, e.g. `Root › … › Parent › Focus`. If overflowing one line, truncates **from the left** with leading `…` (keep the trailing/most-recent ancestors visible). Tapping a breadcrumb segment navigates to that ancestor.

### Children grid (treemap)

- Algorithm: **squarified** (Bruls/Huizing/van Wijk), already implemented in `src/domain/treemapSquarify.ts`. Default aspect ratio φ.
- **Always render N + 1 tiles** (N real children + 1 "+" tile) — except at the cap.
- **Per-parent cap**: **12 real children** (locked, but kept as a configurable constant for tuning).
  - 0 children → 1 tile ("+" only)
  - 1..11 children → N + 1 tiles (children + "+")
  - 12 children → 12 tiles (no "+")
  - The "+" is suppressed at the cap; user must delete to add (delete deferred).
- **Min tile size**: ~1/12 of the children area in the equal-weight worst case (≈ 1/15 of the viewport). When weights are skewed, the smallest tile is **clamped up to that 1/12 floor** and the remaining area is squarified across the others (square-ratio degrades slightly to keep tiles tappable).
- **Weight** of the "+" tile = `1` (matches the default new-child weight).
- **Activating a real child tile** → drill into it (focus changes; URL updates).
- **Activating the "+" tile** → opens the Add-child modal. Never drills.

### "+" tile visual

- **Just a square with a dashed border, in greyish, with a centered bold "+" sign filling the inner area minus padding. Nothing else.** No title placeholder, no value mock — the empty-field placeholder pattern (see §6) does **not** apply to the "+" tile.

### Drilling animation

- CSS transitions only (`encap--drill`, `encap--leave`). JS only sets classes and timeouts.
- `prefers-reduced-motion: reduce` → skip animation, commit navigation immediately.

## 5. View layer — MVC separation

The view layer must be a separate, swappable concern from the domain model. The user wants per-node-kind, per-role templates living in their own folder (MVC-style).

### Roles

Each node kind has **two role-specific templates**:

- **As parent**: large, used in the parent identity strip (20–25% of viewport).
- **As child**: compact, used in a treemap tile.

The two roles differ in **size / typography / density**, **not** in which fields they show. Field content is uniform across roles per the rules below.

### Field-content rules (locked)

| Node kind | `computed` | Fields rendered (both roles) |
|---|---|---|
| `BusinessScoreCardNode<T>` | `true`  | `Title` + `Description` + computed value (with `Unit`) |
| `BusinessScoreCardNode<T>` | `false` | `Title` + `Description` + latest `TimestampedValue.value` (with `Unit`) + its `Date` |
| `TextNode` | n/a | `Title` + `Description` |

A small "Σ" badge marks computed values so users can distinguish derived from recorded.

### Dispatcher (OCP)

A single `NodeView` dispatcher reads a registry mapping node kind → view module. Adding a new node kind = add a folder + register one entry; no edits to existing dispatchers/templates.

```
views/
  NodeView.*
  nodeViewRegistry.*
  TextNode/
    TextNodeAsParent.*
    TextNodeAsChild.*
  BusinessScoreCardNode/
    BusinessScoreCardNodeAsParent.*
    BusinessScoreCardNodeAsChild.*
```

The "+" tile is **not** in this registry — it's a UI affordance, not a node kind.

## 6. Empty-field placeholder pattern

Applies to **modal form fields only** (not to the "+" tile, not to view templates).

- No labels.
- Each empty field shows a **distinctively styled placeholder** (greyish/italic/muted) that **doubles as an example mock value** clearly explaining the field's purpose, e.g. `e.g. "North-region revenue"` for a Title field, `e.g. 100` for a target value.

## 7. Add-child modal

Triggered by activating the "+" tile. Never drills.

- **Wide**, with **side margin** so the underlying board is still partially visible (semi-transparent backdrop). Conveys "the board is still behind".
- Step 1 — pick the **node type**: `Text` or `BusinessScoreCard` (extensible later via the same registry as views).
- Step 2 — type-specific form, using the empty-field placeholder pattern (§6).
- Confirm → append child to the focused parent → persist to `localStorage` → close modal.

## 8. Persistence & boards

### Storage shape

`localStorage` holds:

- A **board collection**: an array of boards, each with `{ id, name, tree }` where `tree` follows the JSON shape in `examples/test.json`.
- A **`currentBoardId`** pointer.

> **As-built (Phase 4)**: stored under a single versioned key `tree-graph-viz/board-collection/v1` with envelope `{ v:1, currentBoardId, boards:[…] }`. Quota errors surface as a typed `StorageFullError`. See §17.4.

### Import / export

- **Export**: serialize the current board (or all boards — TBD) to a `.json` file the user can download.
- **Import**: file picker → parse → validate → replace (or merge — TBD) the current board collection.
- Both actions live behind the burger menu in the drawer.

### Auto-save

Every mutation (add child today; edit / delete later) auto-persists. Pure navigation (drilling, going back) does not write.

## 9. Routing (deep links)

Hash-based, no router library:

```
#/b/<boardId>/n/<focusNodeUuid>
```

- `boardId`: identifies the board within the collection.
- `focusNodeUuid`: the currently focused node. Breadcrumb path is derived by walking the loaded tree to that UUID.
- Drilling / back / breadcrumb-click → `pushState`. Browser back/forward works naturally.
- Unknown UUID → fall back to the board's root and `replaceState`.
- Copying the URL = sharing the current snapshot.

> **As-built (Phase 4)**: implemented by `HashRouter` against a `Router` port (`parse / build / current / push / replace / onChange` with unsubscribe). Strict regex `^#/b/([^/]+)/n/([^/]+)$`; non-matching shapes return `null`. See §17.4.

## 10. Out of scope (this iteration)

- **Edit** existing nodes — defer.
- **Delete** existing nodes — defer.
- **History sparkline** on tiles — defer.
- **Objective summary** (target/initial/target-date) on tiles — defer (not in §5 field rules).

## 11. Existing implementation pointers

(For continuity with whatever path is chosen — see §13 Open decisions.)

- `src/domain/treemapSquarify.ts` — squarified layout algorithm. Framework-agnostic; **stays as-is** regardless of view-layer choice.
- `src/domain/Node.ts`, `src/domain/BusinessScoreCard.ts`, `src/domain/treeQueries.ts` — current domain model; needs realignment to Option B.
- `src/application/TreeNavigationService.ts`, `src/application/ports/TreeNavigationPort.ts` — navigation use-case + port; survives both view-layer paths.
- `src/adapters/ui/TreeGraphScreen.tsx`, `NodeCard.tsx`, `useTreemapLayout.ts` — current React UI. **Will be rewritten as Lit Web Components** (per §13.1). React, `react-dom`, `@testing-library/react`, and `@vitejs/plugin-react` are removed; replaced by `lit` and `@open-wc/testing-helpers` (or equivalent). `useTreemapLayout` becomes a `ResizeObserver`-driven controller inside the Lit shell; the squarify algorithm itself is unchanged.

## 12. Test plan (LOCKED)

Two independent test pipelines:

- **Vitest** (`npm test`) — pure TS unit tests for domain rules, application services, adapter contracts, and Lit elements that benefit from a fast in-isolation test.
- **Playwright + `playwright-bdd`** (`npm run test:e2e`) — Gherkin behaviour specs in a real headless Chromium against the previewed app.

Domain-rule specs (latest-value, weighted-mean, contribution eligibility, capacity, weight defaults) are **Vitest TDD**. Everything user-observable (views, layout, drawer, modal, persistence, routing) is **Playwright BDD**. This split is binding.

### 12.1 Folder structure

Test files **do not live next to the implementation**. Every `+ .test.ts` marker below names a unit test that lives at the mirror path under `src/test/unit/<layer>/...`. End-to-end specs (features, steps, fixtures, page objects, `playwright.config.ts`) live under `src/test/e2e/`.

```
src/
  domain/
    values/                 Title, Description, Weight, Unit, NodeIdentity,
                            TimestampedValue, Objective                + .test.ts each
    capabilities/           Historizable, HasObjective, ContributesToParent,
                            capabilityGuards                            + .test.ts
    nodes/                  TreeNode, TextNode, BusinessScoreCardNode,
                            BusinessScoreCard                           + .test.ts each
    aggregation/computedValue.ts                                        + .test.ts
    capacity/childrenCapacity.ts                                        + .test.ts
    treeQueries.ts                                                      + .test.ts
    treemapSquarify.ts                                                  + .test.ts
    index.ts

  application/
    ports/
      TreeNavigationPort.ts
      BoardCollectionRepository.ts                       + contract test
      Router.ts
      ImportExportFile.ts
    TreeNavigationService.ts                             + .test.ts
    BoardCollectionService.ts                            + .test.ts
    AddChildService.ts                                   + .test.ts
    ImportExportService.ts                               + .test.ts
    index.ts

  adapters/
    persistence/
      jsonCodec.ts                                       + .test.ts
      LocalStorageBoardCollectionRepository.ts           + .test.ts
    routing/HashRouter.ts                                + .test.ts
    ui/
      controllers/
        TreemapController.ts                             + .test.ts
        OrientationController.ts                         + .test.ts
      views/
        NodeView.ts                                      + .test.ts
        nodeViewRegistry.ts                              + .test.ts
        TextNode/{TextNodeAsParent,TextNodeAsChild}.ts   + .test.ts each
        BusinessScoreCardNode/{AsParent,AsChild}.ts      + .test.ts each
        plus/PlusTile.ts                                 + .test.ts
      shell/
        TreeGraphScreen.ts                               + .test.ts
        ParentIdentityStrip.ts                           + .test.ts
        ChildrenGrid.ts                                  + .test.ts
        Drawer.ts                                        + .test.ts
        Breadcrumb.ts                                    + .test.ts
        BurgerMenu.ts                                    + .test.ts
        AddChildModal.ts                                 + .test.ts
      animations/drillTransitions.test.ts
    testBridge.ts                                        (gated by ?test=1; see §14)
    sampleData.ts

  test/
    setup.ts                  (jsdom + jest-dom + ResizeObserver mock + matchMedia mock)
    fixtures/
      treesFixtures.ts
      domFixtures.ts
    unit/                     Vitest unit tests; mirrors the implementation tree below.
      domain/...              <Foo>.test.ts at the same relative path as src/domain/<Foo>.ts
      application/...         <Foo>.test.ts at the same relative path as src/application/<Foo>.ts
      adapters/...            <Foo>.test.ts at the same relative path as src/adapters/<Foo>.ts
    e2e/                      Playwright + playwright-bdd; never imports src/{domain,application,adapters} or src/main.ts.
      playwright.config.ts
      features/
        layout/{treemap_n_plus_one,treemap_min_tile_clamp,orientation_reflow}.feature
        views/{business_score_card_views,text_node_views,plus_tile,computed_aggregation_view}.feature
        shell/{drawer,breadcrumb,burger_menu}.feature
        modal/{add_child_modal,empty_field_placeholders}.feature
        persistence/{load_save,import_export,board_collection}.feature
        routing/{deep_link,focus_to_url,unknown_uuid_fallback}.feature
      steps/
        layoutSteps.ts viewSteps.ts shellSteps.ts modalSteps.ts
        persistenceSteps.ts routingSteps.ts
      fixtures/
        trees/{orgTree,twelveChildren,zeroEligible}.json
      pageObjects/
        TreeGraphPage.ts DrawerPage.ts ModalPage.ts
  main.ts
```

### 12.2 Vitest coverage (TDD)

**Domain — value objects** — `Title` (non-empty trimmed, ≤120 chars, equality by value); `Description` (≤280 chars, empty allowed); `Weight` (>0, `Weight.default()` = 1, rejects NaN/∞/≤0); `Unit` (non-empty, `Unit.percent()`); `NodeIdentity` (Title+Description); `TimestampedValue<T>` (rejects invalid Date, `compareByDate`, `isAfter`); `Objective<T>` (initialValue/targetValue/targetDate, equality).

**Domain — capabilities & guards** — `capabilityGuards`: `implementsContributesToParent` true for `BusinessScoreCardNode`, false for `TextNode`; same for `Historizable`, `HasObjective`.

**Domain — nodes** — `TreeNode` (id/identity/weight/parent/children, attach/detach maintains parent pointer, `currentValue` abstract); `TextNode` (does **not** satisfy `ContributesToParent` at type level — compile-time assertion file; `currentValue()` throws `NotValuedError`); `BusinessScoreCardNode` (composes `BusinessScoreCard`; `history`, `objective`, `isEligible`, `contribution`, `currentValue`; `EmptyHistoryError` on empty history); `BusinessScoreCard` (`addRecorded(tv)` keeps list sorted; `history()` returns immutable copy).

**Domain — aggregation & capacity** — `computedValue` (all branches: weighted mean over `ContributesToParent` AND eligible; skip `TextNode` and ineligible; `computed === false` → parent's own latest value; zero eligible with `computed === true` → returns `{ kind: "childrenCount", n }` for the renderer per §13.2). `childrenCapacity` (`MAX_CHILDREN = 12`, `canAddChild`, `shouldRenderPlusTile`).

**Domain — queries / layout** — `treeQueries` (re-typed for `TreeNode`; add `walkPath(root, uuid)` for breadcrumb, returns `null` on miss). `treemapSquarify` (keep existing 3 tests; add: min-tile clamp for skewed weights; aspect-ratio of largest tile within `1/φ ≤ r ≤ φ` for balanced weights; orientation switch).

**Application** — `TreeNavigationService` (existing tests + `focusByUuid`); `BoardCollectionService` (list/switch/rename/create + persistence-port boundary); `AddChildService` (builds Option B node from payload, appends, persists, rejects at cap); `ImportExportService` (export = current board JSON; import = replace current board; validates first).

**Adapters — persistence & routing** — `jsonCodec` (round-trip on `examples/test.json` structurally equal; rejects malformed JSON with pointer); `LocalStorageBoardCollectionRepository` (`load()` empty → seed; `save()` writes one key; `QuotaExceededError` → typed `StorageFullError`; **contract test** shared with future adapters); `HashRouter` (parse `#/b/<id>/n/<uuid>`; build URL; `pushState` vs `replaceState`; ignores other hash shapes).

**Adapters — UI controllers** — `TreemapController` (observes host, updates `rects` reactively, stops observing on disconnect); `OrientationController` (`'landscape' | 'portrait'` flips on aspect change).

**Adapters — UI views (Vitest in addition to BDD)** — `NodeView` dispatcher (picks element via registry, throws on unknown kind); `nodeViewRegistry` (frozen-after-init).

**Adapters — animations** — `drillTransitions` (no-preference: drilling sets `encap--drill`, commits after `DRILL_SETTLE_MS`; reduce: commits immediately, never adds class).

### 12.3 Playwright BDD coverage — headline scenarios

| `.feature` file | Headline scenarios |
|---|---|
| `views/computed_aggregation_view.feature` | computed parent renders weighted mean + `Σ` badge; 3 ineligible children → `3 children` plain text, no `Unit`, no `Σ`; 0 children → only "+" tile, value area empty; `computed=false` → own latest value + date, no `Σ`. |
| `views/text_node_views.feature` | Title + Description, both roles; no value, no `Σ`. |
| `views/business_score_card_views.feature` | full (role × `computed`) matrix; `Σ` badge presence. |
| `views/plus_tile.feature` | exactly one `[data-testid="plus-tile"]`; dashed border; centered "+"; no title/value/date; opens modal; never drills. |
| `layout/treemap_n_plus_one.feature` | outline over n ∈ {0,1,11,12}: tile counts {1,2,12,12}; "+" hidden iff n=12. |
| `layout/treemap_min_tile_clamp.feature` | weights `[100,1,1,1]` in 1920×1080: smallest tile ≥ 1/12 of children area; coverage = viewport ±1px; square-ratio of large tiles within threshold. |
| `layout/orientation_reflow.feature` | `ResizeObserver` fires on aspect change; tile rectangles recompute; identity strip stays at top. |
| `shell/drawer.feature` | handle visible at rest; tap reveals; swipe-out hides; contains board name, breadcrumb, burger. |
| `shell/breadcrumb.feature` | `Root › … › Parent › Focus`; truncates from **left**; tap navigates; URL updates. |
| `shell/burger_menu.feature` | Import / Export / Boards entries; closes on outside tap. |
| `modal/add_child_modal.feature` | opens from "+", semi-transparent backdrop; type selector; per-type form; confirm appends → persists → closes; cancel never persists; never drills. |
| `modal/empty_field_placeholders.feature` | every empty field has placeholder starting with `e.g.` or recognisable mock; no `<label>` siblings; placeholder vanishes on input. |
| `persistence/load_save.feature` | empty `localStorage` seeds an empty collection with one default board; mutations write through; navigation does not. |
| `persistence/import_export.feature` | exporting matches wire format; export → import round-trip yields structurally equal tree. |
| `persistence/board_collection.feature` | switching `currentBoardId` reflects in URL and view; renaming persists; create adds entry. |
| `routing/deep_link.feature` | `#/b/<id>/n/<uuid>` focuses the right node when present. |
| `routing/focus_to_url.feature` | drilling, going back, breadcrumb-tapping all `pushState` correctly; browser back restores prior focus. |
| `routing/unknown_uuid_fallback.feature` | unknown UUID → board root with `replaceState`. |

### 12.4 Tagging convention in `.feature` files

Every **feature** carries (at minimum):
```
@HE-2570 @component:<layout|views|shell|modal|persistence|routing>
```

Every **scenario** carries (after first XRay round-trip; placeholder before):
```
@HE-???? @priority:<high|medium|low>
```

`@HE-2570` links the Test issue to the epic. `@HE-????` is the Test's own key, round-tripped into the file after first import so re-imports update existing tests instead of creating duplicates. `@component:*` becomes a Jira label.

### 12.5 Implementation order

> **As-built progress lives in §17 (Implementation log).** §12.5 below is the original plan; §17 records which phases landed, the commits, the test deltas, and any decisions taken during implementation that this section did not pin down.

| Phase | Scope | Done when |
|---|---|---|
| **0** | Deps swap (remove React, add `lit` + `@open-wc/testing-helpers` + `@playwright/test` + `playwright-bdd`); folder skeleton; tsconfig flips; per-layer ESLint rules. | `npm test` passes existing tests; `npm run lint` green; `npm run build` may be temporarily red. |
| **1** | Option B domain: values → capabilities → nodes → aggregation → capacity → updated `treeQueries` + `treemapSquarify`. | All `src/domain/**/*.test.ts` green; no domain file imports `application/**`, `adapters/**`, or any browser API. |
| **2** | JSON codec + Option B-aligned `sampleData.ts`. | Round-trip on `examples/test.json` green. |
| **3** | Application services (`focusByUuid`, `BoardCollectionService`, `AddChildService`, `ImportExportService`). | All service `.test.ts` green; services depend only on `domain/**` + their own ports. |
| **4** | Non-UI adapters: `LocalStorageBoardCollectionRepository`, `HashRouter`; contract tests. | All adapter `.test.ts` green; optional `architecture.test.ts` green. |
| **5** | Playwright skeleton: `playwright.config.ts`, `testBridge.ts`, one smoke `.feature` + step + page object. **First XRay import dry-run** (§15 Task B). | `npm run test:e2e` runs the smoke green; XRay import created the smoke Test issue under HE-2570. |
| **6** | Lit views (per-kind, per-role) + `NodeView` dispatcher + `PlusTile`. | `views/*.feature` green; views Vitest green. |
| **7** | Lit shell + layout + controllers. | `layout/*.feature` + `shell/*.feature` green. |
| **8** | Add-child modal. | `modal/*.feature` green. |
| **9** | CSS animations + a11y polish. | `animations/drillTransitions.test.ts` green; manual a11y pass. |
| **10** | Persistence + routing wiring under `<tree-graph-screen>`. | `persistence/*.feature` + `routing/*.feature` green. |
| **11** | Manual smoke on the kiosk hardware. | Out of automated test scope. |

## 13. Open decisions

### 13.1. View-layer framework — DECIDED: Path 1 (All-Lit)

The view layer is rewritten as Lit Web Components. Rationale:

- 2 roles × N kinds (today 4 templates, growing) is past the point where hand-rolled native Web Components stop paying off.
- CSS-first animations (binding rule §2) need stable DOM identity across re-renders; Lit's `lit-html` patches in place, native `innerHTML` does not.
- Reactive properties + `classMap`/`styleMap` collapse the JS surface to "flip classes", which is the only thing JS is supposed to do per §2.
- ~5–6 KB min+gzip is dwarfed by the equivalent hand-rolled binding layer, and Lit instances *are* `HTMLElement`s — no lock-in beyond re-templating if it ever needs to come out.

**Concrete bindings**:

- Add: `lit` (runtime), `@open-wc/testing-helpers` (test utilities for fixtures + `elementUpdated`).
- Remove: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `@testing-library/react`.
- Keep: Vitest, jsdom, `@testing-library/jest-dom` (matchers work against any DOM).
- Vite stays (no plugin needed for Lit; TS handles decorators with `experimentalDecorators` + `useDefineForClassFields: false`, or with the standard 2022 decorators if `lit` ≥ 3 is used).
- `treemapSquarify.ts`, `treeQueries.ts`, the Option B domain classes, and `TreeNavigationService` are **framework-free** and stay as plain TS.
- `useTreemapLayout` becomes `TreemapController` — a Lit `ReactiveController` wrapping a `ResizeObserver`, owned by the `<tree-graph-screen>` shell.

### 13.2. Follow-ups — DECIDED

- **Export scope**: current board only. Export atom = import atom = single tree matching `examples/test.json`.
- **Import behaviour**: replace the **current board**; other boards in the collection are untouched.
- **Drawer position**: top edge in both orientations (consistent with the parent-identity strip, also at the top — option c1).
- **Computed-parent display when zero eligible children**: show the **count of children** as plain text (e.g. `3 children`), with no `Unit` and no `Σ` badge — distinguishes "computed but undefined" from "recorded 0", and from "no children at all" (which renders only the "+" tile per §4).

### 13.3. BDD test runtime — DECIDED: Playwright + `playwright-bdd`

Behavioural specs run in a real headless browser (Chromium by default; the kiosk uses a Chromium-class engine), driven by Playwright. Gherkin `.feature` files are executed by `playwright-bdd`, which generates Playwright tests from features at build time and runs them under Playwright's own runner. Cucumber-style step definitions live in TypeScript files alongside the features.

**Loose-coupling rules** (binding):

- Playwright lives in `src/test/e2e/` with its own `playwright.config.ts` and its own `npm run test:e2e` script. The `vitest` and `playwright` invocations are independent.
- Step definitions **never import from `src/`**. The only contract between specs and app is:
  - the served URL (Vite preview);
  - an opt-in `window.__appTestApi__` bridge gated by `?test=1` in the URL, exposing a thin facade over the public ports (`seedBoardCollection(json)`, `currentUrl()`, `snapshot()`). Domain types are not leaked through the bridge — JSON in, JSON out.
- All "expressing a domain rule" specs (latest-value, weighted-mean aggregation, contribution eligibility, capacity, weight defaults) are **not** Playwright BDD; they are Vitest unit tests. BDD is reserved for behaviours the user can observe — UI, layout reflow, drawer, modal, persistence, deep links.

**Concrete bindings**:

- Add (dev only): `@playwright/test`, `playwright-bdd`.
- Browsers installed via `npx playwright install chromium` (CI installs Firefox + WebKit too).
- No Vitest changes; the hand-rolled Gherkin runner mentioned in earlier drafts is dropped.

---

## 14. Hexagonal architecture — enforcement (LOCKED)

### 14.1 Layered import contract

| From → To | `domain` | `application` | `adapters` | `main` |
|---|---|---|---|---|
| `domain` | ✅ within | ❌ | ❌ | ❌ |
| `application` | ✅ | ✅ within | ❌ | ❌ |
| `adapters` | ✅ | ✅ (only ports) | ✅ within (carefully) | ❌ |
| `main` | ✅ | ✅ | ✅ | — |

`src/main.ts` is the only composition root. `src/test/e2e/**` cannot import `src/{domain,application,adapters}/**` or `src/main.ts` at all.

### 14.2 What's enforced by the type system

- **No `null` as control flow** — services return `{ ok: true } | { ok: false, reason }` or typed errors.
- **Capability interfaces, not flags** — `TextNode` doesn't implement `ContributesToParent<T>`, so the compiler refuses to put it into an aggregation function. Aggregation eligibility is a compile-time property, not a runtime check.
- **Application sees only ports** — `TreeNavigationService`'s public surface is `TreeNavigationPort`-shaped; concrete adapter classes are never imported by application code.
- **Read models are plain data** — `FocusedTreeView` is a value object the adapter renders but cannot mutate.

### 14.3 What's enforced by tooling

- **ESLint `no-restricted-imports` per folder** in `eslint.config.js`. The same restrictions apply both to the implementation folder and to its mirror under `src/test/unit/`, so a test file cannot reach across a layer boundary that its system-under-test cannot:
  - `src/domain/**` and `src/test/unit/domain/**` — no imports from `application/**`, `adapters/**`, `main*`.
  - `src/application/**` and `src/test/unit/application/**` — no imports from `adapters/**`, `main*`.
  - `src/adapters/**` and `src/test/unit/adapters/**` — no imports from `main*`.
  - `src/test/e2e/**` — no imports from `**/src/**`, `**/domain/**`, `**/application/**`, `**/adapters/**`, `**/main`.
  - `lit` is only allowed inside `src/adapters/ui/**` (and the matching `src/test/unit/adapters/ui/**` test files).
- **No `Date.now()` / `crypto.randomUUID()` / `Math.random()` in `src/domain/**`** — domain consumes a `Clock` and `IdGenerator` port. Concrete adapters in `src/adapters/system/`. Tests inject deterministic stubs.
- **(Optional, recommended)** `architecture.test.ts` using `ts-morph` — parses the import graph and fails on any cross-layer violation. ~60 lines, runs in <1s.

### 14.4 The test bridge (`src/adapters/testBridge.ts`)

The only file in `src/` that knows e2e tests exist. Behaviour:

- **Activation gate**: only attaches to `window` when `new URL(location.href).searchParams.get("test") === "1"`.
- **Tree-shaken in production**: import call site behind `if (import.meta.env.DEV || urlFlag)`.
- **JSON-only API** (no domain types crossed):
  ```
  window.__appTestApi__ = {
    seed(json: unknown): Promise<void>,        // wipe localStorage + load a tree
    currentFocusUuid(): string,
    currentBoardId(): string,
    navigateTo(url: string): Promise<void>,
    dismissAnimations(): void,                  // forces prefers-reduced-motion=reduce
  };
  ```
- **Goes through public ports only** (`BoardCollectionRepository.replaceAll(...)`), never reaches into entities.
- **Hard cap ~80 lines**. If it grows beyond that, that's a red flag we're using it as a feature backdoor instead of a test seam.

### 14.5 Deliberately omitted

- No DI container (composition root is ~30 lines).
- No anti-corruption layer between application and domain (same project, same value objects).
- No CQRS split — the "displayed value" is a pure read decoration over the same write model.
- No event bus / domain events — added later if multi-tab sync ever lands.

---

## 15. Jira / XRay tracking plan (LOCKED)

### 15.1 Project & primary issues

- **Project key**: `HE` (Jira Cloud). _Migrated from `HOV` on 2026-04-26 to gain the XRay test issue types (`Test`, `Test Plan`, `Test Set`, `Pre-Condition`, `Test Execution`) which were not in `HOV`'s issue type scheme._
- **Epic**: `HE-2570` — Tree Graph Viz (formerly `HOV-2977`).
- **Functional business story**: `HE-2571` (formerly `HOV-2631` — "Create a Visual (Digital) Artifact for Obeya to communicate it"; moved to HE on 2026-04-26 alongside the epic). Parent epic = `HE-2570`.
- **MCP**: Atlassian Rovo at `https://mcp.atlassian.com/v1/mcp`, configured in `.cursor/mcp.json` (committed; OAuth-based, no secrets in repo).
- **Re-inspection required**: the §15.8 inspection performed against `HOV` (issue type IDs, link type IDs, required field list) **does not transfer** to `HE`. Re-run §15.8 next session against `HE` before any creation — IDs are workspace-scoped but the project's issue type scheme, field configuration, and link type availability are project-scoped and must be re-verified.

### 15.2 Issue types

- **Development Task** (custom) — items that involve commits / development.
- **Task** (built-in) — items that do **not** imply development (ops, configuration, manual verification).
- **Test Plan** (XRay) — groups Tests by implementation phase.
- **Test Set** (XRay) — groups Tests by `.feature` file.
- **Test** (XRay) — created by `.feature` file import; one per Scenario / Scenario Outline row.

Every Development Task and Task is parented to epic `HE-2570`.

### 15.3 Link semantics

The only inter-issue link type used is **`Blocks`** (built-in Jira link).
- "X **blocks** Y" = Y is **blocked by** X.
- Every Development Task and Task `blocks` `HE-2571` — except Task B (see below).
- Inter-task `blocks` edges mirror §12.5 phase order so Jira's blocker graph reads as the dependency graph.

### 15.4 Development Tasks (10) — to create

| # | Title | Maps to phase | Inter-task `blocks` edges (outgoing) |
|---|---|---|---|
| DT-1 | Domain model — Option B | 0–1 | DT-2, DT-3 |
| DT-2 | JSON codec + sample data alignment | 2 | DT-4 |
| DT-3 | Application services | 3 | DT-5, DT-7 |
| DT-4 | Persistence + Routing adapters | 4 | DT-6 |
| DT-5 | Lit views (per-kind, per-role) | 6 | DT-6 |
| DT-6 | Lit shell + layout | 7 | DT-8 |
| DT-7 | Add-child modal | 8 | — |
| DT-8 | Animations + a11y polish | 9 | — |
| DT-9 | BDD harness (Playwright + `playwright-bdd` + `testBridge`) | 5 | DT-6, DT-7, DT-8, DT-10 |
| DT-10 | XRay import pipeline (`bin/xray-import` + CI hook) | 5 | (Task B) |

### 15.5 Tasks (2) — to create

| # | Title | Notes |
|---|---|---|
| Task A | Generate XRay Cloud API credentials in Jira admin | One-time; produces `XRAY_CLIENT_ID` + `XRAY_CLIENT_SECRET`; `blocks` Task B. |
| Task B | First XRay import dry-run + sanity-check Test issues in HE | Blocked by DT-10 and Task A. **Does NOT block `HE-2571`** — the kiosk ships even if XRay traceability lags. |

### 15.6 Test Plans (4) — to create

| # | Title | Test Sets (one per `.feature` file) |
|---|---|---|
| TP-A | TGV — Phase 6 (Lit views) | `views/business_score_card_views`, `views/text_node_views`, `views/plus_tile`, `views/computed_aggregation_view` |
| TP-B | TGV — Phase 7 (Lit shell + Layout) | `layout/treemap_n_plus_one`, `layout/treemap_min_tile_clamp`, `layout/orientation_reflow`, `shell/drawer`, `shell/breadcrumb`, `shell/burger_menu` |
| TP-C | TGV — Phase 8 (Modal) | `modal/add_child_modal`, `modal/empty_field_placeholders` |
| TP-D | TGV — Phase 9–10 (Persistence + Routing) | `persistence/load_save`, `persistence/import_export`, `persistence/board_collection`, `routing/deep_link`, `routing/focus_to_url`, `routing/unknown_uuid_fallback` |

### 15.7 XRay import workflow

- **Atlassian MCP** drives Development Task / Task / Test Plan / Test Set creation and link wiring (steps 15.4–15.6).
- **XRay REST `POST /api/v1/import/feature`** drives `Test` issue creation. Reasons: only the REST endpoint populates the Cucumber test type and Gherkin steps body correctly; it auto-creates `Pre-Condition` issues for `Background:` blocks; `@HE-…` tags are honoured for linkage.
- **Auth**: OAuth via XRay's `POST /api/v2/authenticate` with `XRAY_CLIENT_ID` + `XRAY_CLIENT_SECRET` from env. Never in repo.
- **Script**: `bin/xray-import.ps1` (cross-shell sibling: `bin/xray-import.sh`). Reads env, zips `src/test/e2e/features/`, POSTs, round-trips returned keys back into the `.feature` files. Idempotent: same `@HE-…` tag → same Test issue updated.
- **CI**: a GitHub Action (or equivalent) runs the script on `main` after `npm run test:e2e` succeeds.

### 15.8 Pre-creation inspection (step 0 of any creation run)

Before creating any issue via the Atlassian MCP, the next session **must**:

1. Query `HE-2570` and `HE-2571` via the MCP — confirm they exist and that `HE-2571.parent = HE-2570`.
2. Inspect available **issue types** in HE — confirm the API IDs for `Development Task`, `Task`, `Test Plan`, `Test Set`, `Pre-Condition` (display names are not stable identifiers).
3. Inspect available **link types** in HE — confirm `Blocks` is enabled and capture its ID.
4. Inspect any **required custom fields** on Development Task **and** XRay test types in HE (XRay types often add required fields like Test Type / Cucumber Type).
5. Show findings to the user; only then create.

**Carry-over knowledge from the HOV inspection (run on 2026-04-26, must be re-verified in HE):**

- The `Blocks` link type ID `10000` is workspace-scoped and likely the same in HE.
- `inwardIssue = blocker, outwardIssue = blocked` for `createIssueLink` — confirmed from the tool descriptor; this is workspace-wide, not project-scoped.
- Issue type IDs (e.g. `Development Task = 11497`) **are workspace-scoped** in Jira Cloud — same numeric IDs apply to HE if the same custom issue type is reused. But which types are *enabled* for HE's issue type scheme is project-scoped and must be re-verified.

### 15.9 Created issues — key map (HE, 2026-04-26)

Re-inspection in HE on 2026-04-26 confirmed all required issue types, the `Blocks` link type ID, and the minimal required-field set (only `summary` beyond auto-set `project` / `issuetype` / `reporter`). All 16 issues + 25 `Blocks` edges below were then created in a single batch.

**Issue type IDs (project HE, observed):**

| Type | API id | Notes |
|---|---|---|
| Development Task | `11497` | classic custom type |
| Task | `10002` | built-in |
| Test Plan | `10028` | XRay |
| Test Set | `10027` | XRay |
| Test | `10026` | XRay |
| Precondition | `10030` | XRay — actual name is `Precondition` (one word), not `Pre-Condition` |
| Story | `10001` | host issue type of `HE-2571` (retyped from `Task` to `Story` on the HOV→HE move) |

**Link type ID:** `Blocks = 10000` (confirmed identical to HOV; workspace-scoped).

**Issues created (Development Tasks — parent epic `HE-2570`):**

| Code | Key | Summary |
|---|---|---|
| DT-1 | `HE-2578` | TGV / DT-1 — Domain model (Option B) |
| DT-2 | `HE-2575` | TGV / DT-2 — JSON codec + sample data alignment |
| DT-3 | `HE-2574` | TGV / DT-3 — Application services |
| DT-4 | `HE-2588` | TGV / DT-4 — Persistence + Routing adapters |
| DT-5 | `HE-2582` | TGV / DT-5 — Lit views (per-kind, per-role) |
| DT-6 | `HE-2583` | TGV / DT-6 — Lit shell + layout |
| DT-7 | `HE-2576` | TGV / DT-7 — Add-child modal |
| DT-8 | `HE-2584` | TGV / DT-8 — Animations + a11y polish |
| DT-9 | `HE-2579` | TGV / DT-9 — BDD harness (Playwright + playwright-bdd + testBridge) |
| DT-10 | `HE-2581` | TGV / DT-10 — XRay import pipeline (bin/xray-import + CI hook) |

**Issues created (Tasks — parent epic `HE-2570`):**

| Code | Key | Summary |
|---|---|---|
| Task A | `HE-2586` | TGV / Task A — Generate XRay Cloud API credentials in Jira admin |
| Task B | `HE-2589` | TGV / Task B — First XRay import dry-run + sanity-check Test issues in HE |

**Issues created (Test Plans — no parent):**

| Code | Key | Summary |
|---|---|---|
| TP-A | `HE-2577` | TGV / TP-A — Phase 6 (Lit views) |
| TP-B | `HE-2587` | TGV / TP-B — Phase 7 (Lit shell + Layout) |
| TP-C | `HE-2580` | TGV / TP-C — Phase 8 (Modal) |
| TP-D | `HE-2585` | TGV / TP-D — Phase 9–10 (Persistence + Routing) |

**Common fields applied:** `labels = ["tgv"]` on every issue; Dev Tasks + Tasks set `customfield_10014` (Epic Link) to `HE-2570`; `parent` echoes back as `HE-2570` for Dev Tasks + Tasks.

**`Blocks` edges wired (25 total):**

- 11 → `HE-2571`: every Dev Task (10) + Task A. Task B intentionally excluded per §15.5.
- 13 inter-Dev-Task edges per §15.4 table:
  - DT-1 → DT-2, DT-3
  - DT-2 → DT-4
  - DT-3 → DT-5, DT-7
  - DT-4 → DT-6
  - DT-5 → DT-6
  - DT-6 → DT-8
  - DT-9 → DT-6, DT-7, DT-8, DT-10
  - DT-10 → Task B
- 1 Task-to-Task edge per §15.5: Task A → Task B.

Verified post-creation: `HE-2571.issuelinks` shows exactly 11 incoming "is blocked by" edges from `HE-2574, HE-2575, HE-2576, HE-2578, HE-2579, HE-2581, HE-2582, HE-2583, HE-2584, HE-2586, HE-2588`.

**JQL filters for review:**

- All TGV-tracked issues: `project = HE AND labels = "tgv"`
- TGV Dev Tasks under epic: `project = HE AND issuetype = "Development Task" AND parent = HE-2570`
- All blockers of the kiosk story: `project = HE AND issue in linkedIssues("HE-2571", "is blocked by")`

---

## 16. Tooling & dependency manifest (LOCKED)

### 16.1 Add

```
npm i lit
npm i -D @open-wc/testing-helpers @playwright/test playwright-bdd
npx playwright install chromium      # CI also installs firefox + webkit
```

### 16.2 Remove

```
npm rm react react-dom @types/react @types/react-dom \
       @vitejs/plugin-react @testing-library/react
```

### 16.3 Keep

- `vite`, `vitest`, `jsdom`, `@testing-library/jest-dom`, `typescript`.

### 16.4 `tsconfig.json` flips

- `target: "ES2022"`.
- `experimentalDecorators: true` and `useDefineForClassFields: false` (Lit 3 standard-decorators path is also fine — pick one and stick to it).

### 16.5 `package.json` scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 4173",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "bddgen -c src/test/e2e/playwright.config.ts && playwright test -c src/test/e2e/playwright.config.ts",
    "test:e2e:headed": "bddgen -c src/test/e2e/playwright.config.ts && playwright test -c src/test/e2e/playwright.config.ts --headed",
    "lint": "tsc --noEmit",
    "lint:rules": "eslint ."
  }
}
```

`lint` is the type-check (binding); `lint:rules` runs the ESLint architectural rules from §16.7. CI must run both.

### 16.6 `playwright.config.ts` shape

```ts
import { defineBddConfig } from "playwright-bdd";

const testDir = defineBddConfig({
  features: "src/test/e2e/features/**/*.feature",
  steps:    "src/test/e2e/steps/**/*.ts",
});

export default {
  testDir,
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
};
```

### 16.7 ESLint per-layer rule shape (flat config — `eslint.config.js`)

ESLint 9+ uses flat config exclusively. The shipped `eslint.config.js` mirrors the layered import contract from §14.1 and the `lit`-only-in-`adapters/ui` rule from §14.3:

```js
import tseslint from "typescript-eslint";
import globals from "globals";

const FORBID_LIT = ["lit", "lit/decorators.js", "lit/directives/class-map.js", "lit/directives/style-map.js", "lit-html"];

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "src/test/e2e/.features-gen/**", "playwright-report/**", "test-results/**"] },
  { languageOptions: { parser: tseslint.parser, ecmaVersion: 2022, sourceType: "module",
                       globals: { ...globals.browser, ...globals.node } } },
  { files: ["src/domain/**/*.ts", "src/test/unit/domain/**/*.ts"],
    rules: { "no-restricted-imports": ["error", {
      patterns: ["**/application/**", "**/adapters/**", "**/main", "**/main.ts"],
      paths: FORBID_LIT }] } },
  { files: ["src/application/**/*.ts", "src/test/unit/application/**/*.ts"],
    rules: { "no-restricted-imports": ["error", {
      patterns: ["**/adapters/**", "**/main", "**/main.ts"],
      paths: FORBID_LIT }] } },
  { files: ["src/adapters/**/*.ts", "src/test/unit/adapters/**/*.ts"],
    ignores: ["src/adapters/ui/**", "src/test/unit/adapters/ui/**"],
    rules: { "no-restricted-imports": ["error", {
      patterns: ["**/main", "**/main.ts"],
      paths: FORBID_LIT }] } },
  { files: ["src/adapters/ui/**/*.ts", "src/test/unit/adapters/ui/**/*.ts"],
    rules: { "no-restricted-imports": ["error", {
      patterns: ["**/main", "**/main.ts"] }] } },
  { files: ["src/test/e2e/**/*.ts"],
    rules: { "no-restricted-imports": ["error", {
      patterns: ["**/src/**", "**/domain/**", "**/application/**", "**/adapters/**", "**/main", "**/main.ts"] }] } },
);
```

Two flat-config subtleties worth noting:

- Each block sets `no-restricted-imports` from scratch — flat-config rule values do **not** merge across matching blocks; the last matching block wins. So each layer must restate the full restriction list including `lit`-paths where relevant.
- `tseslint.parser` parses `.ts` files; no preset rules from `tseslint.configs.recommended` are applied — Phase 0 enables only the architectural rule. Style/quality rules are out of scope until a later phase explicitly opts in.

### 16.8 Env vars (never in repo)

- `XRAY_CLIENT_ID`, `XRAY_CLIENT_SECRET` — XRay Cloud credentials for the import script (Task A produces them).
- `JIRA_BASE_URL` — only if the import script needs it (typically `https://<workspace>.atlassian.net`).

---

## 17. Implementation log (as-built)

This section records what has actually been built, on top of the plan in §12.5. §1–§16 capture the *intent*; §17 captures the *as-built* state, including decisions taken during implementation that earlier sections did not pin down. **When resuming, read §17.0 first to know where the codebase is at.**

### 17.0 Status overview

| Phase | Commit | Test count | Status | One-line note |
|---|---|---|---|---|
| **0 + 1** | `e1fcd91` | 0 → 198 | DONE | Phase 0 deps/skeleton + Phase 1 Option B domain landed atomically. |
| **2** | `e2f4ef3` | 198 → 213 | DONE | JSON codec; `examples/test.json` reordered to ascending history. |
| **3** | `3335610` | 213 → 249 | DONE | 4 application services + 1 new port (`IdGenerator`). |
| **4** | `d3a8690` | 249 → 279 | DONE | `LocalStorageBoardCollectionRepository` + `HashRouter` + reusable contract test. |
| **5 (DT-9)** | `3daa85e` | 279 _(unit)_ + 0 → 2 _(e2e)_ | DONE | Composition root + Lit shell stub + `testBridge` + Playwright smoke (2 scenarios) green. |
| **5 (DT-10)** | `6d971bb` | unchanged | DONE (script) / TODO (run) | XRay import pipeline scaffolded: `bin/xray-import.ps1` + `bin/xray-import.sh` + `bin/README.md` + `.github/workflows/xray-import.yml` + `.env.example`. Dry-run smoke green. **Task A (`HE-2586`) creds + Task B (`HE-2589`) first import** still TODO — see §17.8. |
| **6 (DT-5)** | `7203eb8` | 279 → 321 _(unit)_ + 2 → 14 _(e2e)_ | DONE | Per-kind/per-role Lit views + `<node-view>` dispatcher + `<plus-tile>` + view-model mapper; shell rewired to consume a plain `FocusedTreeViewModel`. 4 new view `.feature` files + `viewSteps.ts` cover the (role × computed) matrix, the three `computedValue` branches, and the `+`-affordance contract. See §17.9. |
| **7 (DT-6 — layout)** | _(see git log)_ | 321 → 370 _(unit)_ + 14 → 23 _(e2e)_ | DONE | `OrientationController` + `TreemapController` + `<parent-identity-strip>` + `<children-grid>` (squarified treemap with the 1/12 floor + `ResizeObserver`-driven reflow). Shell composes them through a 22 % / 78 % CSS grid + reflects orientation as `data-orientation`. 3 new layout `.feature` files (TP-B): `treemap_n_plus_one` (n ∈ {0,1,11,12} outline), `treemap_min_tile_clamp`, `orientation_reflow`. See §17.10. |
| **7 (DT-6 — shell chrome)** | — | — | TODO | Drawer + breadcrumb + burger menu; the `shell/*.feature` test set (TP-B). |
| **8–11** | — | — | TODO | Add-child modal, animations, persistence/routing wiring, kiosk smoke. |

Verification on each landed commit: `npm test` green, `npm run lint` (`tsc --noEmit`) clean, `npm run lint:rules` (ESLint layered rules) clean. From Phase 5 onward, `npm run test:e2e` (Playwright BDD) is also part of the gate. From Phase 6 onward, `npm run build` (Vite production bundle) is too — the kiosk has shipped renderable views.

### 17.1 Phase 0 + Phase 1 — Lit-ready infra + Option B domain (`e1fcd91`)

Built end-to-end per §3 / §12.1 / §16. Decisions and concrete artefacts beyond what those sections pinned down:

- **Test files participate in type-checking.** `tsconfig.json` was extended to include `src/**/*.test.ts` (and `src/test/**/*.ts`). Required so the compile-time assertion in `TextNode.test.ts` (`@ts-expect-error TextNode does NOT implement ContributesToParent`) is actually checked by `tsc --noEmit`.
- **ESLint layered rules also gate the test mirror tree** (`src/test/unit/<layer>/`) — already implied by §14.3 / §16.7, confirmed in implementation.
- **`treemapSquarify` 1/12 minimum-tile-area floor** — a tile that would render below 1/12 of its parent's area is clamped up to 1/12. Implemented inside the existing pure squarify; no new dependency. 9 unit tests cover it.
- **Domain barrel `src/domain/index.ts` is curated (Option B)**: only re-exports the new node tree (TreeNode / TextNode / BusinessScoreCardNode / BusinessScoreCard / values / capabilities / aggregation / capacity / treeQueries / treemapSquarify). Legacy `Node.ts`, `BusinessScoreCard.ts` (root-level), and `guards.ts` were deleted; nothing else imports them.

### 17.2 Phase 2 — JSON codec + test.json alignment (`e2f4ef3`)

Implemented `src/application/jsonCodec.ts` and `JsonDecodeError`. Decisions:

- **Open-ended `targetDate` sentinel.** The wire schema in `examples/test.json` omits `targetDate` for objectives that have no deadline; the domain mandates `Objective.targetDate: Date`. Resolution: a sentinel ISO date `9999-12-31T23:59:59.999Z`. Decode synthesises the sentinel when the field is absent; encode omits the field when the date equals the sentinel. Round-trip on the fixture is structurally lossless.
- **Canonical history order is ascending** (oldest → newest). The fixture `examples/test.json` was reordered from descending to ascending so domain invariants line up with the wire format. All 15 codec tests + the round-trip tests assume ascending.
- **Decode errors carry an RFC-6901 JSON pointer** in their message, e.g. `/childrenNodes/2/historizedValues/0/date`. Surfaces a precise location for user-facing error UI later.

### 17.3 Phase 3 — Application services (`3335610`)

Four services + their ports landed. New port added beyond §12.1's listed set:

- **`application/ports/IdGenerator.ts`** — callable type alias `() => string`. Production binds `crypto.randomUUID`; tests inject deterministic stubs (e.g. counter-based). Lives at the application layer because it is a domain-side concern (every new node needs an id), but generation is a runtime capability.

Service-specific contracts and ordering:

- **`TreeNavigationService.focusByUuid(uuid)`** — tree-wide focus addressed by uuid; backs deep-link routing (§9) and breadcrumb taps. Returns `{ ok: false, reason }` on missing uuid. Coexists with the original index-path-based `focusBy(...)` (kept for the local "drill" gesture).
- **`BoardCollectionService`** exposes a static async factory `BoardCollectionService.create(repo, idGen)` (async because the repo load is async). Mutations (`switchTo` / `rename` / `createBoard`) persist atomically through the repo port and only mutate in-memory state on success. `list()` returns a defensive copy.
- **`AddChildService`** uses a `Persister = () => Promise<void>` callable injected at construction. Composition root binds it to a whole-snapshot save through `BoardCollectionRepository`, so `AddChildService` never knows about boards. **Ordering is strict**: capacity check (§4) → payload validation → attach → persist; if persist throws, the freshly-attached child is detached so the in-memory tree stays consistent with what was actually persisted. 11 tests cover the cap-then-validate-then-attach-then-persist + rollback path.
- **`ImportExportService`** is decoupled from `BoardCollectionService` via two callables — `getCurrentTree: () => TreeNode` and `replaceCurrentTree: (TreeNode) => Promise<void>` — so the service still depends only on `domain/**` + its own port (`TreeCodec`). **Validate before replace**: a decode error never invokes the replace callback; the import is atomic (all-or-nothing).

Deferred from §12.1's port list:

- **`application/ports/Router.ts`** — created in Phase 4 instead, since no Phase 3 service consumes it.
- **`application/ports/ImportExportFile.ts`** — not created. The file picker / Blob download is a UI concern (`<input type="file">`, `URL.createObjectURL`), so `ImportExportService` operates on plain strings and the UI adapter wraps file IO around it. If future cross-platform targets need a port, it can be added without changing the service.

### 17.4 Phase 4 — Non-UI adapters (`d3a8690`)

Two adapters + a reusable contract-test pattern landed.

**`application/ports/Router.ts`** (created here):

- `RouteState = { boardId: string; focusNodeUuid: string }`.
- Methods: `parse(href) / build(state) / current() / push(state) / replace(state) / onChange(handler)`.
- `onChange` returns an unsubscribe closure (idempotent — calling twice is a no-op).
- `current()` and `parse()` return `null` for any non-matching hash (so the composition root can fall back to a default route).

**`src/adapters/persistence/LocalStorageBoardCollectionRepository.ts`**:

- **Storage key**: `tree-graph-viz/board-collection/v1` (versioned; future migrations bump the suffix).
- **Wire envelope** (single key): `{ v: 1, currentBoardId: string, boards: [{ id, name, tree: <jsonCodec wire shape> }] }`. Each `tree` is the per-tree JSON object produced by `jsonCodec`; the parse/stringify dance at the codec boundary keeps `jsonCodec`'s string↔tree contract untouched.
- **Seeding when storage is empty**: builds a default snapshot via injectable `seed?: () => BoardCollectionSnapshot` (default seed = one board "Default Board" containing a single empty `TextNode` root) and persists it before returning. Subsequent loads do **not** re-seed.
- **`StorageFullError`**: typed translation of `QuotaExceededError`. Detection covers WHATWG `name === "QuotaExceededError"`, legacy WebKit `code === 22`, Firefox `NS_ERROR_DOM_QUOTA_REACHED`, and IE 1014 — so the same error class surfaces regardless of browser.
- **Storage injection**: takes a `Storage` interface (jsdom's `localStorage` in dev, in-memory fakes in tests). The adapter never references `window` or globals directly.

**`src/adapters/routing/HashRouter.ts`**:

- Strict regex `^#/b/([^/]+)/n/([^/]+)$` — non-matching shapes return `null` from `parse`, `current`, and the `onChange` handler payload. Other hash shapes (e.g. `#anchor`) are ignored, not coerced.
- **`RouterEnv` interface** (a `Pick<Window, "location" | "history" | "addEventListener" | "removeEventListener">`) is injected, so the same impl runs against real `window` in production and a stub in tests. No `globalThis` reach-through.

**Reusable contract-test pattern**:

- `src/test/unit/adapters/persistence/boardCollectionRepositoryContract.ts` — intentionally **no `.test.ts` suffix** so vitest does not auto-discover it. Exports `runBoardCollectionRepositoryContract(name, factory)` that adapter test files mount in their own `*.test.ts`.
- 7 contract assertions: non-empty load on a fresh repo, save→load round-trip, multi-board ordering preserved, `BusinessScoreCardNode` field preservation, second-save overwrites, idempotent reads, current-board pointer stability.
- The LocalStorage adapter mounts the contract + 7 adapter-specific tests (custom seed, custom key, error propagation on serialisation/quota, etc.) for 14 total.
- **Convention**: any future adapter port (e.g. `Router` contract, `TreeCodec` contract) should follow the same `<port>Contract.ts` filename pattern in `src/test/unit/adapters/<port-folder>/`.

### 17.5 What's testable today

Snapshot kept current with the latest landed phase (Phase 7 / DT-6 — layout half). Each phase's own as-built sub-section (§17.1–§17.10) preserves the per-phase numbers at landing time so the historical record isn't lost.

- `npm test` runs **370** unit tests across **36** files (~7 s on a typical dev box).
- `npm run lint` (`tsc --noEmit`) clean.
- `npm run lint:rules` (ESLint layered rules) clean — no domain → application/adapters/browser-API leak, no application → adapters leak, no `lit` outside `adapters/ui`, no `src/{domain,application,adapters}/**` imports inside `src/test/e2e/**`.
- `npm run build` produces a `dist/` with the kiosk bundle at ~53 KB (gzip ~16.2 KB) + a 0.75 KB on-demand `testBridge` chunk that's only fetched when `?test=1` is in the URL (dynamic-import tree-shake). 61 modules transformed (was 56 in §17.9). The bundled `<tree-graph-screen>` now composes `<parent-identity-strip>` (top, 22 %) + `<children-grid>` (bottom, 78 %, squarified treemap with 1/12 floor + `ResizeObserver` reflow), with `data-orientation` exposed on the layout wrapper for landscape/portrait CSS hooks (§17.10).
- `npm run dev` / `npm run preview` launch the kiosk. With empty `localStorage`, the default seed shows a single "Root" board (a `TextNode` — so the parent strip renders Title + Description and the children grid contains only the `+` tile).
- `npm run test:e2e` runs **23** Playwright BDD scenarios under headless Chromium: 2 boot scenarios + 12 view scenarios (TP-A; §17.9) + 9 layout scenarios across 3 `layout/*.feature` files (TP-B — `treemap_n_plus_one` ×4 outline rows, `treemap_min_tile_clamp` ×2, `orientation_reflow` ×3; §17.10). All green.

### 17.6 Phase 5 (DT-9) — BDD harness (`3daa85e`)

Composition root, Lit shell stub, test bridge, and Playwright skeleton landed atomically.

**Composition root — `src/main.ts`** (~75 lines including comments, ~35 of code; deliberate margin over §14.5's "~30 lines"):

- Wires `idGen → LocalStorageBoardCollectionRepository → BoardCollectionService.create → TreeNavigationService` over the current board's tree → `HashRouter`.
- Drives URL ↔ focus bidirectional sync: on boot, replaceState if the current hash doesn't match the loaded board; on `hashchange`, focus by uuid (replaceState back to root on miss).
- Lazy-imports `testBridge.ts` only when `?test=1` is in the URL — Vite emits it as a separate chunk, so the production bundle stays bridge-free unless the gate is opened.
- **Deliberately defers** wiring `AddChildService` / `ImportExportService`. Their consumers (modal + drawer) land in Phases 6–8; wiring them now would trip `noUnusedLocals` and add complexity that has nothing to drive it. The composition root grows incrementally with each phase that introduces a new consumer.

**Lit shell stub — `src/adapters/ui/shell/TreeGraphScreen.ts`** (~80 lines):

- `<tree-graph-screen>` renders the focused node's title + a flat list of its direct children's titles, exposed as `data-testid="focused-title"` and `data-testid="child"`. Phase 7 replaces the body with the squarified treemap + parent identity strip + drawer.
- View model is a plain `FocusedTreeViewModel` (id + title + children id/title) — `main.ts` is the only place that translates `TreeNode` → VM, so domain types never leak through Lit reactive updates.
- Built with Lit 3 + `experimentalDecorators: true` + `useDefineForClassFields: false` (the path picked in §16.4). `@property({ attribute: false })` works without `accessor`.

**Test bridge — `src/adapters/testBridge.ts`** (60 LOC, well under §14.4's 80-line cap):

- JSON-only API per §14.4: `seed(json)`, `currentFocusUuid()`, `currentBoardId()`, `navigateTo(url)`, `dismissAnimations()`.
- `seed` decodes via the public `TreeCodec`, wraps the tree in a single fixed-id `"test-board"` snapshot, and writes through the public `BoardCollectionRepository.save`. Never reaches into `TreeNode`. The page must reload for the new state to render — the bridge does not bypass the repo's load/save lifecycle.
- Activation gate is owned by `main.ts` (not the bridge): `main.ts` only does `await import("./adapters/testBridge.js")` when `?test=1` is set, so the bridge module is dynamically imported and tree-shaken otherwise.
- `Object.defineProperty(target, "__appTestApi__", { value: Object.freeze(api), … })` — the surface is frozen and re-installable (idempotent).

**Playwright skeleton — `src/test/e2e/`**:

- `playwright.config.ts` already existed (Phase 0). **Path correction (deviation from §16.6):** the canonical example in §16.6 has `features: "src/test/e2e/features/**/*.feature"` and `steps: "src/test/e2e/steps/**/*.ts"`. That shape only works if `playwright.config.ts` lives at the repo root. Our config sits at `src/test/e2e/playwright.config.ts`; playwright-bdd's `TestFilesGenerator.loadFeatures` calls `resolveFeatureFiles(configDir, features)` so patterns are resolved from the config's directory. Corrected to `features/**/*.feature` and `steps/**/*.ts`.
- `features/boot/app_boots.feature` (smoke) — 2 Scenarios:
  - **Scenario 1**: open with empty storage → focused title is `"Root"` (exercises composition root + LocalStorage default seed + Lit shell render).
  - **Scenario 2**: open with empty storage → seed the org tree via the bridge → reload → focused title is `"UUID1 Title"` (exercises the bridge + codec + reload boot flow).
  - Tagged `@HE-2570 @component:boot` (feature) and `@HE-???? @priority:<high|medium>` (per scenario, placeholders for first XRay round-trip).
- `steps/bootSteps.ts` — 4 steps; reads the org tree fixture via `node:fs` (Playwright runs from the repo root). The `@playwright/test` + `playwright-bdd` imports stay external.
- `pageObjects/TreeGraphPage.ts` — wraps `Page`; `expectBridgeReady()` waits for `window.__appTestApi__` to appear (the bridge is dynamically imported, so it's not synchronously available right after `goto`).
- `fixtures/trees/orgTree.json` — copy of `examples/test.json`. Independent fixture per §12.1; the wire reference at `examples/test.json` can change without breaking the smoke.

**Pitfalls fixed in flight**:

- **`page.addInitScript(() => localStorage.clear())` re-fires on every navigation, including reload.** This wiped the bridge-seeded state right before the reload's boot, causing Scenario 2 to render the default `"Root"` instead of `"UUID1 Title"`. Fix: drop the `addInitScript`. Playwright already gives every test a fresh browser context with empty `localStorage`, so the explicit clear was both unnecessary and harmful.
- **playwright-bdd default `outputDir` is `.features-gen` (not `.generated`).** Updated `.gitignore` and `eslint.config.js` ignore lists. The §16.6 / §14.3 spec snippets reference `.features-gen` from this commit forward.

**What's still TODO in Phase 5** (Task A + Task B — manual ops; see §17.8 for the script half, which has landed):

- **Task A (`HE-2586`)** — generate `XRAY_CLIENT_ID` + `XRAY_CLIENT_SECRET` in Jira admin → Apps → Manage your apps → Xray → API Keys.
- **Task B (`HE-2589`)** — first XRay import + sanity-check Test issues in HE. Until completed, the placeholder `@HE-????` tags in `app_boots.feature` stay as-is.

### 17.7 Open follow-ups beyond Phase 5

- **Decide whether to add `application/ports/ImportExportFile.ts`** when the UI file picker / Blob download is built. Currently the UI is expected to wrap `<input type="file">` + `URL.createObjectURL` around the string-in/string-out service.
- **Optional `architecture.test.ts`** mentioned in §12.5 Phase 4 was not added — `npm run lint:rules` (ESLint) already enforces the same import contract. Reconsider adding one only if a runtime invariant emerges that ESLint cannot express.
- **Composition root will grow** as Phases 6–8 land: `AddChildService` (Phase 8 modal consumer), `ImportExportService` (Phase 6/8 drawer consumer), and a router-driven board-switching path (Phase 10 routing/board_collection.feature).

### 17.8 Phase 5 (DT-10) — XRay import pipeline scaffold (commit `6d971bb`)

DT-10 (`HE-2581`) — the script half of the XRay import strand — landed alongside the §17.6 BDD harness work. The runtime half (Task A creds + Task B first import) remains the user's manual ops step, captured at the end of this section.

**Files added** (none modify existing source; entirely additive):

- `bin/xray-import.ps1` (~165 LoC) — primary script for local Windows dev. Targets **Windows PowerShell 5.1+** (so it runs on stock Windows without installing PowerShell 7) under `Set-StrictMode -Version Latest`. Forces `[Net.SecurityProtocolType]::Tls12` because 5.1 still defaults to TLS 1.0 in some configurations.
- `bin/xray-import.sh` (~140 LoC) — bash + `curl` + `jq` sibling for CI / Linux / macOS, wired by `.github/workflows/xray-import.yml`. Same algorithm, same idempotency contract.
- `bin/README.md` — usage docs for both scripts: env vars, dry-run, idempotency table, troubleshooting, and a short note explaining why two scripts (per §15.7) instead of one Node.js cross-platform script.
- `.env.example` (repo root) — credential template. Covered by the existing `.gitignore` rule `.env*` with `!.env.example` allowlist.
- `.github/workflows/xray-import.yml` — CI hook described in §15.7. On push to `main` it runs `npm ci` → `npx playwright install --with-deps chromium` → `npm run lint` + `lint:rules` + `npm test` + `npm run test:e2e`, then invokes `bin/xray-import.sh`. If the import rewrites any `.feature` files, the workflow auto-commits them back to `main` with `[skip ci]` so the workflow doesn't re-trigger itself.

**Algorithm — common to both scripts**:

For each `.feature` file under `src/test/e2e/features/` (sorted by path for determinism):

1. Authenticate against `POST {XRAY_BASE_URL}/api/v2/authenticate` with `{client_id, client_secret}`. The endpoint returns the JWT as a JSON string; both scripts strip wrapping quotes if any.
2. POST the file as `multipart/form-data` to `/api/v1/import/feature?projectKey=HE`.
3. Read `updatedOrCreatedTests[].key` from the response.
4. Compute `existing = real @HE-\d+ keys already in the source` and `new = returned keys not in existing` and `updated = returned keys in existing`.
5. If `len(new) === count of @HE-???? placeholders`, rewrite each placeholder in source order with the next new key. If they don't match, leave the file untouched and warn — operator decides next.

**Idempotency contract** (same on both scripts):

| Source tag before | First successful run | Re-run |
|---|---|---|
| `@HE-????` (placeholder) | XRay creates new Test; placeholder rewritten to the new key | (no longer present) |
| `@HE-1234` (real key) | XRay updates existing `HE-1234`; tag untouched | Same — keep updating in place; no churn |

So once `app_boots.feature` has been through one successful import, every subsequent run is a pure update — no new Test issues, no file rewrites, no CI auto-commit loop.

**Decisions taken during implementation that §15 / §16 did not pin down**:

- **Per-file POSTs over zipped batch** — §15.7 mentions zipping `src/test/e2e/features/`, but XRay's `import/feature` endpoint accepts either a single file or a zip and the per-file path keeps response→source attribution exact (the nth `updatedOrCreatedTests[i]` is the nth scenario in the posted file). Re-add a zip mode only if the feature-file count grows past the point where N round-trips matter.
- **PowerShell 5.1, not 7** — the spec implied PS without version pinning; pinning at 7 would have forced an extra install on a stock Windows kiosk dev machine. PS 5.1 just means hand-rolled multipart body construction (~12 extra lines) and explicit TLS 1.2 enforcement, both already in.
- **No `npm` script alias** (e.g. `npm run xray:import`) — invoking `bin/xray-import.ps1` directly on Windows is cleaner than wrapping it in an npm script that has to platform-detect between `pwsh`, `powershell.exe`, and `bash`. The CI workflow calls `bash bin/xray-import.sh` directly. If a unified entrypoint is wanted later, add it then.
- **Auto-commit in CI uses `[skip ci]`** to prevent the workflow re-triggering itself; the commit author is `github-actions[bot]`.

**Smoke-tested on the committed `app_boots.feature`** (no creds needed, no network):

```
[xray-import] Project    : HE
[xray-import] BaseUrl    : https://xray.cloud.getxray.app
[xray-import] Features   : 1 under .../src/test/e2e/features
[xray-import] DryRun     : True

[app_boots.feature]
  existing keys  : 1 - HE-2570       <-- feature-level epic tag, untouched
  placeholders   : 2                 <-- two @HE-???? scenario tags
  [dry-run] would POST .../app_boots.feature and rewrite 2 placeholder(s).
```

The rewrite mechanics were also verified out-of-band by dot-sourcing `Rewrite-Placeholders` and feeding it synthetic keys `HE-9001`, `HE-9002`: the feature-level `@HE-2570` is preserved and the two scenario-level `@HE-????` are positionally replaced with `@HE-9001` and `@HE-9002`. The on-disk file is **not** modified during dry-run.

**What's still TODO in DT-10's runtime half** (Tasks A + B, manual ops):

- **Task A (`HE-2586`)** — generate `XRAY_CLIENT_ID` + `XRAY_CLIENT_SECRET` in Jira admin → Apps → Manage your apps → Xray → API Keys. Pair only shown once at creation. Save into local `.env` (gitignored) and register both as repo secrets in GitHub Settings → Secrets → Actions.
- **Task B (`HE-2589`)** — first XRay import dry-run + sanity-check Test issues in HE. With creds in `.env`, run `powershell -NoProfile -ExecutionPolicy Bypass -File bin\xray-import.ps1` once locally; verify the two new Test issues appear under epic `HE-2570`, that `app_boots.feature`'s scenario tags now read `@HE-XXXX` instead of `@HE-????`, and that re-running the script is a no-op (no new tests, no further rewrites).

**Atlassian MCP — auth state at end of this session**:

- `.cursor/mcp.json` lives at three locations now: the repo's committed file (`tree-graph-viz/.cursor/mcp.json`), a global file at `%USERPROFILE%\.cursor\mcp.json`, and a workspace-root file at `c:\Cursor\.cursor\mcp.json` (since the user's current Cursor workspace root is `c:\Cursor`, not `tree-graph-viz`). All three carry the same single-server `atlassian → https://mcp.atlassian.com/v1/mcp` config; project file wins on duplicates per Cursor's documented merge rule, so there's no conflict.
- **OAuth flow is the user's manual step** — Cursor restart, *Tools & MCP* settings, sign in via the browser, pick the cloud site that owns project `HE`, approve scopes (Jira read/write minimum). After that, the §15.8 re-inspection (issue type IDs / link type IDs in `HE`) can run via the MCP and the §15.9 carry-over knowledge gets re-verified before any new issue creation work.
- The committed `tree-graph-viz/.cursor/mcp.json` remains the canonical config for any future contributor — they get OAuth-only setup for free on first open of `tree-graph-viz` as a workspace.

### 17.9 Phase 6 (DT-5) — Lit views (commit `7203eb8`)

DT-5 (`HE-2582`) — the per-kind / per-role view templates + `<node-view>` dispatcher + `<plus-tile>` + view-model mapper — landed atomically. The shell stub from §17.6 was rewired (composition root grows by exactly one wire: the `mapFocusedToViewModel` translation). 12 BDD scenarios across 4 new `views/*.feature` files (TP-A) cover the surface end-to-end.

**Files added** (all under `src/adapters/ui/views/` unless noted):

- `NodeViewModel.ts` — UI-only contract. `NodeViewModel = TextNodeViewModel | BusinessScoreCardNodeViewModel`; the BSC variant carries a discriminated `value: BusinessScoreCardValueViewModel` mirroring the three branches of `domain/aggregation/computedValue` 1:1 (`computedMean` / `recordedValue` / `childrenCount`). `FocusedTreeViewModel = { center, children: ChildSlotViewModel[] }` with `ChildSlotViewModel = { slot: "node"; vm } | { slot: "plus"; parentId }` so the shell consumes a single homogeneous list.
- `nodeViewRegistry.ts` — `(kind, role) → tag-name` map. `register(kind, role, tag)` is the only mutation API, enforced by `freeze()` (subsequent `register` calls throw). `resolveTag(kind, role)` is total over the 4 (kind × role) cells; `lookupTag` returns `null` for unregistered cells (used by `<node-view>` for diagnostics).
- `index.ts` — module-load side effect that calls `register(...)` for the 4 cells then `freeze()`. Importing this barrel is the only way to populate the registry — no entry self-registers, keeping element files free of registry coupling.
- `NodeView.ts` — `<node-view>` dispatcher. `@property({ attribute: false }) vm: NodeViewModel | null` + `@property({ attribute: "view-role", reflect: true }) role: NodeRole`. `render()` resolves `tag = registry.resolveTag(vm.kind, role)`, then emits `<${tag} .vm=${vm}></${tag}>` via `unsafeStatic` (the registry is the only source of tag names so the unsafe path is bounded). On unknown `kind` it throws (mapped at the registry boundary, never silent).
- `TextNode/TextNodeAsParent.ts` + `TextNode/TextNodeAsChild.ts` — Title + Description, no value, no Σ. Both roles emit `[data-testid="title"]` and `[data-testid="description"]`; CSS hides the description when empty (`display: none`) without removing the element so e2e tests can still address it. Roles differ only in typography/padding (asParent uses `<h1>` + larger `clamp()` font; asChild uses `<h2>` + tighter spacing) — content is identical per §5.
- `BusinessScoreCardNode/BusinessScoreCardNodeAsParent.ts` + `.../BusinessScoreCardNodeAsChild.ts` — Title + Description + value-row. Value-row content is delegated to a shared `valueTemplate.ts` so the (role × value-kind) matrix is *one* template, not eight.
- `BusinessScoreCardNode/valueTemplate.ts` — per-branch HTML:
  - `computedMean` → `<span data-testid="value" data-value-kind="computedMean">${mean.toFixed(1)} ${unit}</span>` + `<span data-testid="computed-badge" aria-label="Computed value">Σ</span>`.
  - `recordedValue` → `<span data-testid="value" data-value-kind="recordedValue">${value} ${unit}</span>` + `<time data-testid="value-date" datetime=${dateIso}>${formatDate(dateIso)}</time>` (no Σ).
  - `childrenCount` n>0 → `<span data-testid="value" data-value-kind="childrenCount">${n} children</span>` (no Σ, no Unit, no date).
  - `childrenCount` n=0 → `<span data-testid="value" data-value-kind="childrenCount-empty"></span>` (empty by design — span is *present* so e2e tests can assert presence + emptiness, satisfying §13.2 + §12.3).
- `plus/PlusTile.ts` — `<plus-tile>`. Single `<button data-testid="plus-tile">` with dashed CSS border + a `+` glyph. Activation dispatches a bubbling+composed `plus-tile-activate` `CustomEvent<{parentId}>` (`PLUS_TILE_ACTIVATE_EVENT` constant) — the Phase 8 / DT-7 modal will listen on the shell. **The tile never drills**: `e.stopPropagation()` in the click handler blocks any ancestor click-to-focus listener that might land later; e2e covers this with a "click `+` → focused id is unchanged" scenario (`plus_tile.feature`). Per §5 final sentence + §12.3 plus_tile row, the `+` tile is a UI affordance, not a node kind — deliberately not in `nodeViewRegistry`.
- `viewModelMapper.ts` — domain → VM boundary. `mapNodeToViewModel(node)` is total over `TextNode | BusinessScoreCardNode` (throws `ViewModelMappingError` on unknown subclasses). `mapBusinessScoreValue` calls `computedValue(node)` once and switches on its three branches. `mapFocusedToViewModel(center, children)` appends `{ slot: "plus", parentId }` iff `shouldRenderPlusTile(center)` (§4 — capacity-gated). The mapper sits under `adapters/ui/views/` (UI concern: shape of `NodeViewModel` is a UI contract) and imports from `domain/**` only — never from `application/**`, so the composition root is the single layer that pairs `TreeNavigationService.getFocusedView()` with the mapper.

**Files modified**:

- `src/adapters/ui/shell/TreeGraphScreen.ts` — body replaced. Now consumes `FocusedTreeViewModel | null` via `@property({ attribute: false }) view`; renders parent strip (`<header data-testid="parent-strip" data-focused-id=${center.id}>` containing `<node-view view-role="asParent" .vm=${center}>`) over a flat children grid (`<section data-testid="children">`). Each child slot becomes either `<div data-testid="child" data-id=${id} data-view-kind=${kind}><node-view view-role="asChild" .vm=${vm}></node-view></div>` or a `<plus-tile parent-id=${parentId} .parentId=${parentId}>` wrapper. Importing `../views/index.js` is the side-effect that populates+freezes the registry; the shell never registers anything itself. The squarified treemap layout, breadcrumb, and drawer arrive in Phase 7 (DT-6).
- `src/main.ts` — composition root grows by one wire: `screen.view = view ? mapFocusedToViewModel(view.center, view.childrenNodes) : null`. Domain types (`TreeNode`, `BusinessScoreCard`, `TimestampedValue`) still never cross the UI property boundary — `<tree-graph-screen>` and every `<node-view>`/`<*-as-*>` element only sees plain JSON-shaped VMs.

**Unit tests added** (Vitest — 321 total now, +42 since §17.6):

- `nodeViewRegistry.test.ts` (6 tests) — register-then-resolve happy path, all 4 cells round-trip, double-register throws, post-`freeze` register throws, `resolveTag` is exhaustive, `lookupTag` returns `null` for empty cells.
- `NodeView.test.ts` (5 tests) — dispatcher renders the registered tag for each (kind, role) pair, propagates the VM via `.vm` property, throws on unknown kind, reflects `view-role` attribute, defends against missing `vm`.
- `TextNode/TextNodeAsParent.test.ts` (4) + `TextNodeAsChild.test.ts` (3) — title + description, empty-description hidden, no value or computed-badge present, role-specific element tag for the title (`h1` vs `h2`).
- `BusinessScoreCardNode/BusinessScoreCardNodeAsParent.test.ts` (5) + `BusinessScoreCardNodeAsChild.test.ts` (4) — full (role × value-branch) matrix asserts on `data-testid`s + presence/absence of `computed-badge` and `value-date` per branch.
- `plus/PlusTile.test.ts` (6) — renders single `[data-testid="plus-tile"]`, dashed border via `getComputedStyle`, `+` glyph + sr-only label, click fires bubbling+composed `plus-tile-activate` with `{parentId}`, click does **not** propagate as a regular DOM `click` to ancestors (the `e.stopPropagation()` smoke), `parent-id` attribute reflects.
- `viewModelMapper.test.ts` (9) — TextNode → `{ kind: "TextNode", … }`, BSC computed=true with eligibles → `computedMean` mean+unit, BSC computed=false → `recordedValue` with ISO date, BSC computed=true zero-eligible → `childrenCount` with `n = children.length`, plus-tile slot is appended iff `shouldRenderPlusTile(center)` (covers n=0/1/11/12 outline of `treemap_n_plus_one`), unsupported subclass throws `ViewModelMappingError`.

**Unit-test infrastructure — `src/test/fixtures/litElementFixture.ts`**:

The Lit + jsdom + Vitest combo had two pitfalls that the existing pattern (`document.createElement` + `await el.updateComplete`) did not survive cleanly:

1. **`@customElement` decorator-on-import is tree-shaken away** when the test only imports the class as a *type*. esbuild/Vitest dropped the side-effect that `customElements.define(...)` relies on. Fixed by **always** pairing a side-effect import (`import "./TextNodeAsParent.js"`) with the type-only import (`import type { TextNodeAsParent } from "./TextNodeAsParent.js"`) in every view test. Documented as a convention in `docs/TESTING.md`-style comment in the fixture file.
2. **First `updateComplete` resolves before the shadow root is populated** in jsdom for some elements. Fixed by `mountLitElement(tag, props)` which creates the element, attaches it, sets each property, and then awaits `updateComplete` *plus* a microtask drain (`await Promise.resolve(); await Promise.resolve();`) before returning — covering both the "sync render" path and the "render scheduled in a microtask" path. The fixture always returns once `el.shadowRoot` is non-null and the queried template root has rendered.

The fixture is unit-test-only (`src/test/fixtures/`) and never ships in production — `tsconfig.test.json` includes it; the prod `tsconfig.json` does not.

**Playwright BDD added — TP-A test set** (4 `.feature` files under `src/test/e2e/features/views/`):

- `text_node_views.feature` (2 scenarios) — TextNode `asParent` and `asChild` both render Title + Description and only those fields (no value, no Σ). Background seeds `textTree.json` (TextNode root + 2 TextNode children).
- `business_score_card_views.feature` (4 scenarios) — full (role × computed) matrix on `mixedComputed.json`: `(asParent, computed=true)` → mean + Σ, `(asChild, computed=true)` → mean + Σ, `(asChild, computed=false)` → recorded value + date, `(asParent, computed=false)` → recorded value + date, all with the right Σ presence/absence.
- `computed_aggregation_view.feature` (4 scenarios) — three branches of `computedValue`: weighted mean + Σ (`mixedComputed`), `n children` plain text on `zeroEligible.json` (3 ineligible BSC + TextNode children), empty value-area + only-`+`-tile when computed=true with zero children (focus on `EmptyLeaf`), recordedValue + date when computed=false (focus on `ChildB`).
- `plus_tile.feature` (2 scenarios) — exactly one `[data-testid="plus-tile"]`, dashed border (read via `getComputedStyle().borderStyle`), `+` glyph, no descendant `[data-testid="title|value|value-date"]`, and clicking the tile leaves `data-focused-id` unchanged (the affordance is **not** a navigation target).

**Step + page-object plumbing**:

- `src/test/e2e/steps/viewSteps.ts` — adds 24 generic steps (parametric over fixture name, node uuid, expected text, expected count) so the same vocabulary serves all 4 view features. Loads fixtures via `node:fs` + a small in-memory cache (`fixtureCache`); never imports from `src/{domain,application,adapters}/**` (loose-coupling rule from §13.3, enforced by `eslint.config.js`).
- `src/test/e2e/pageObjects/TreeGraphPage.ts` — extended with `focusedDescription / focusedValue / focusedValueDate / focusedComputedBadge / parentStrip / childTiles / childById(id) / plusTileHosts / plusTileButtons / focusedId / focusNode(uuid)` accessors. Each chains `getByTestId` (Playwright's locator walks open shadow DOM, so the chain through `<tree-graph-screen> → <node-view> → <*-as-*>` is transparent); `focusNode` drives the hash router via the bridge's `navigateTo` so steps don't synthesise URLs themselves.
- New fixtures under `src/test/e2e/fixtures/trees/`:
  - `textTree.json` — TextNode root + 2 TextNode children (one with empty description).
  - `mixedComputed.json` — `Root` (computed=true) → `ChildA` (computed=true with `GrandLeaf`), `ChildB` (computed=false), `EmptyLeaf` (computed=true, no children). One file covers every cell in the (role × computed) matrix and the empty-value-area scenario.
  - `zeroEligible.json` — computed=true `Root` + 3 ineligible children (2 BSC `eligible=false`, 1 TextNode) so `computedValue` returns `childrenCount` with `n = 3`.

**Pitfalls fixed in flight**:

- **Side-effect imports vs. type-only imports** (see fixture infrastructure above). Specifically: tests that do `import type { Foo } from "./Foo.js"` got tree-shaken, the `@customElement` decorator never ran, and `document.createElement("foo-tag")` returned a generic `HTMLElement` (no `updateComplete`). Convention now: every view test pairs a bare `import "./Foo.js"` with the type import.
- **`await el.updateComplete` is necessary but not sufficient** under jsdom: a microtask drain after `updateComplete` was needed for some elements before `el.shadowRoot.querySelector(...)` returned the expected nodes. Encapsulated in `mountLitElement`.
- **`PlusTile` click stopping propagation** is intentional — the `+` tile is *not* a navigation target, so we must not let a future ancestor "click-to-focus" listener swallow the action and drill. The unit test asserts the click does not bubble as a regular DOM `click`; the e2e test confirms the focused id is unchanged after clicking.
- **VM mapper sits in `adapters/ui/views/`, not `application/`** even though it converts domain → plain data. Rationale: `NodeViewModel`'s shape is a UI concern (it determines what the Lit templates expect); placing the mapper in `application/` would leak UI shape upward. ESLint's `adapters` ruleset still allows the mapper to import from `domain/**`. The composition root keeps the single bridge from `application` to `adapters` — `main.ts` calls `nav.getFocusedView()` (application) and `mapFocusedToViewModel(...)` (adapters/ui).

**What's testable today**:

- `npm test` — **321 unit tests** across 31 files (~7 s).
- `npm run lint` (`tsc --noEmit`) clean.
- `npm run lint:rules` (ESLint layered rules) clean — no domain → application/adapters/browser-API leak, no application → adapters leak, no `lit` outside `adapters/ui`, no `src/{domain,application,adapters}/**` imports inside `src/test/e2e/**`.
- `npm run build` produces a `dist/` of ~48 KB (gzip 14.6 KB) JS for the kiosk + 0.75 KB on-demand `testBridge` chunk.
- `npm run test:e2e` runs **14 Playwright BDD scenarios** under headless Chromium (boot smoke ×2 + view scenarios ×12) — all green.

**What's deferred to Phase 7 (DT-6)**:

- `<tree-graph-screen>`'s flat children grid → squarified treemap with the 1/12 minimum-tile clamp + `ResizeObserver`-driven reflow.
- Breadcrumb + drawer + burger menu (the `shell/*.feature` test set).
- The `n=0/1/11/12` outline of `treemap_n_plus_one.feature` — the VM mapper already places the `+` slot correctly per `shouldRenderPlusTile(center)`, so Phase 7 only needs to drive the layout engine; the data plumbing is done.

### 17.10 Phase 7 (DT-6 — layout half) — Lit shell + layout

DT-6 (`HE-2583`) — squarified-treemap layout + orientation-aware shell composition — landed as a single coherent chunk on top of Phase 6 (`7203eb8`). The shell-chrome half of DT-6 (drawer + breadcrumb + burger menu, the `shell/*.feature` test set) is deliberately deferred to a separate sub-strand; this section documents only the layout half.

**Files added** (all under `src/adapters/ui/` unless noted):

- `controllers/OrientationController.ts` — Lit `ReactiveController`; subscribes a `ResizeObserver` over the host, derives `'landscape' | 'portrait'` from `width >= height` (square ties default to landscape per §4 — kiosk at-rest pose), and calls `host.requestUpdate()` only on flips. The `ResizeObserver` constructor is injectable for tests.
- `controllers/TreemapController.ts` — Lit `ReactiveController`; owns the most recently observed content size, the most recent weights/options, and the resulting rects. Two entry points: `layout(weights, opts?)` (host calls during render — synchronous, does *not* request update) and the private `onResize` (re-runs the squarify and requests update only if rects actually changed). `rects` is `[]` until the first `ResizeObserver` callback so the host knows to render an empty grid in jsdom (which never fires the observer).
- `views/NodeViewModel.ts` (modified) — `ChildSlotViewModel` gained a `weight: number` field. For `node` slots it mirrors `TreeNode.weight.value`; for `plus` slots it is fixed at `1` (matches the default new-child weight per §4 — keeps the `+` tile tappable under the 1/12 floor).
- `views/viewModelMapper.ts` (modified) — propagates `child.weight.value` per node slot and emits `weight: 1` on the `+` slot. +2 tests in the mapper suite.
- `shell/ParentIdentityStrip.ts` — `<parent-identity-strip>`. Thin wrapper over `<node-view view-role="asParent">` that emits `[data-testid="parent-strip"]` + `data-focused-id`. Exists as its own element (not inlined into the shell) so the e2e selector contract from §17.9 stays stable through the Phase 7 rewrite + the strip's CSS box (border, padding) is owned in one place.
- `shell/ChildrenGrid.ts` — `<children-grid>`. Holds a `TreemapController`, takes `slots: readonly ChildSlotViewModel[]`, runs `treemap.layout(weights, { padding: 4 })` from `willUpdate`, and absolutely-positions one `.tile` div per slot. Each tile wraps either `<node-view view-role="asChild">` (with `data-testid="child"` + `data-id` + `data-view-kind`) or `<plus-tile>` (with `data-slot="plus"` + `data-parent-id` — deliberately no `data-testid` per the §17.9 plus-tile contract). 4 px squarify padding (`TILE_PADDING_PX`).
- `shell/TreeGraphScreen.ts` (rewritten) — composes `<parent-identity-strip>` + `<children-grid>` through a 22 fr / 78 fr CSS grid (mid of §4's 20–25 % / 75–80 % range). Hosts an `OrientationController`; `render()` reflects the current orientation as `data-orientation` on the `[data-testid="layout"]` wrapper so CSS / e2e can branch on it without re-deriving the geometry. Loading placeholder kept (`[data-testid="loading"]`) for the brief pre-bridge boot.

**Test fixture added** — `src/test/fixtures/fakeResizeObserver.ts` (deliberately no `.test.ts`, vitest does not auto-discover it). jsdom does not implement `ResizeObserver`; the existing global stub in `src/test/setup.ts` is a no-op. The fake records observe/disconnect counts and exposes a synchronous `fire(entries)` so each controller test can drive its observer callback deterministically. `static instances[]` + `reset()` is the cross-test escape hatch — `beforeEach` resets, then the test grabs `FakeResizeObserver.instances.at(-1)`. Used by the controller tests, the `<children-grid>` test, and the `<tree-graph-screen>` test.

**Unit tests added** (Vitest — 370 total now, +49 since §17.9):

- `OrientationController.test.ts` (9) — landscape default, flip on portrait/landscape contentRect, square-tie → landscape, observe/disconnect/re-subscribe lifecycle, `requestUpdate` only on actual flips, ignores entries for other targets.
- `TreemapController.test.ts` (17) — empty pre-layout, 0×0 host gives empty rects, weight-proportional areas, full coverage, resize-driven re-layout, observe/disconnect lifecycle, `requestUpdate` only when rects change, `layout()` does *not* request update (host already rendering), padding propagation, ignores entries for other targets, returns same reference as `rects`, empty weights → empty rects.
- `ParentIdentityStrip.test.ts` (5) — null vm renders nothing in body, vm renders a `<node-view view-role="asParent">` carrying the supplied vm, `[data-testid="parent-strip"]` + `data-focused-id` are present, vm change updates both.
- `ChildrenGrid.test.ts` (11) — empty slots → 0 tiles, slots + first resize → N tiles with squarify-driven absolute geometry, areas proportional to weights, `<node-view view-role="asChild">` per node slot, `<plus-tile>` per plus slot with `parent-id` propagated, `data-testid="child"` only on node tiles (the `+` is not a child per §12.3), re-render on slots change, re-layout on host resize, plus-tile inherits the 1/12 floor.
- `TreeGraphScreen.test.ts` (5) — null view → loading placeholder, view set → composes both child elements with right vm/slots, view change re-propagates, controller orientation reflected as `data-orientation`, loading hidden once view is set.
- `viewModelMapper.test.ts` (+2) — node slot weight mirrors domain `Weight.value`; plus slot weight is fixed at 1 even when children carry heavier weights.

**Playwright BDD added — TP-B (layout half)** (3 `.feature` files under `src/test/e2e/features/layout/`):

- `treemap_n_plus_one.feature` — Background seeds `capacityTree.json` (root with 4 branches: 0, 1, 11, 12 children). Scenario Outline over n ∈ {0, 1, 11, 12} → child-tile count {0, 1, 11, 12} + plus-tile count {1, 1, 1, 0}. Mirrors §12.3's `{1,2,12,12}` total tile counts (children + plus).
- `treemap_min_tile_clamp.feature` — Background seeds `skewedWeights.json` (4 children, weights `[10, 1, 1, 1]`). Scenario 1: `every tile area is at least one twelfth of the inner children grid area` (assertion goes through tile bounding boxes against `<children-grid>`'s box minus the 4 px squarify padding × 2). Scenario 2: tiles together cover the inner children grid area within 2 %.
- `orientation_reflow.feature` — Background seeds `textTree.json`. Scenarios: default 1280×720 viewport reports `landscape`; resize to 400×900 flips to `portrait`; rotate back to 1280×720 flips again. Every scenario also asserts `the parent strip is above the children grid` to lock §4 / option c1 in both orientations.

**Step + page-object plumbing**:

- `src/test/e2e/steps/layoutSteps.ts` — adds 5 generic steps: `there are {int} plus tiles` (parametric supplement to the existing "exactly one plus tile"; lives in `viewSteps.ts` for locality), `I resize the viewport to {int}x{int}` (`page.setViewportSize`), `the layout orientation is {string}`, `the parent strip is above the children grid` (bounding-box geometry), `every tile area is at least one twelfth of the inner children grid area`, `the sum of tile areas covers the inner children grid area within {int}%`.
- `src/test/e2e/pageObjects/TreeGraphPage.ts` — extended with `layout()` (`getByTestId("layout")`), `childrenGridHost()` / `parentStripHost()` (custom-element CSS locators — Playwright's CSS engine pierces open shadow DOM, confirmed by the existing plus-tile selector chain), and `orientation()` (reads the `data-orientation` attribute).
- New e2e fixtures under `src/test/e2e/fixtures/trees/`:
  - `capacityTree.json` — TextNode root with branches `n0` (0 children), `n1` (1 child), `n11` (11), `n12` (12). 25 grandchildren total.
  - `skewedWeights.json` — TextNode root + 4 TextNode children with weights `[10, 1, 1, 1]`.

**Decisions taken during implementation that earlier sections did not pin down**:

- **`ChildrenGrid.children` would shadow `Element.children: HTMLCollection`** and break structural assignability of `ChildrenGrid` to `Element`, which in turn breaks `lastObserver().fire([{ target: el, … }])` (where `target: Element`). Renamed to `slots` — it matches the existing `ChildSlotViewModel` / `nodeSlot` / `plusSlot` terminology and doesn't collide with anything native. Documented in the Lit element's docstring so the next contributor doesn't re-introduce the shadow.
- **`OrientationController` lives on the shell, not on `<children-grid>`.** Orientation is a global property of the kiosk (ties into typography, breadcrumb truncation, future drawer placement); tile geometry only depends on the host's content rect, which `TreemapController` already observes independently. Reflecting `data-orientation` on the shell's `[data-testid="layout"]` wrapper gives both CSS and the e2e harness a single canonical seam.
- **22 fr / 78 fr CSS grid for the parent strip / children grid split** (mid of §4's 20–25 % / 75–80 % range). Pure ratio, no `clamp`, so the split is exact in both orientations; the strip's own padding/typography handles the 4K-pixel-density side of "looks right".
- **Skewed-weights fixture uses `[10, 1, 1, 1]`, not §12.3's illustrative `[100, 1, 1, 1]`.** The domain caps `Weight` at 10 (`InvalidWeightError` outside `[1, 10]`); the math still bites the floor with weight=10 (5 small tiles including the `+` get clamped to ≈ 10 / 7 ≈ 1.43 each, hitting exactly 1/12 of inner area). Captured here so re-readers don't try to widen the Weight bound just to honour a sketch.
- **Cucumber-expression literal-number pitfall.** `playwright-bdd`'s cucumber-expressions auto-parameterize literal numbers in step text — the step "every tile area is at least 1/12 of the inner children grid area" was parsed as `{int}/{int}` and didn't match any defined step. Spelled-out wording ("one twelfth") avoids this without dropping into a regex step. Convention going forward: prefer worded fractions in step text.
- **Per-tile floor assertion uses tolerance × 0.95** against the inner area (gross children-grid box minus 4 px padding × 2). Sub-pixel rounding from Chromium's layout engine can shave a few percent off the smallest tile in a row; the unit-test side (`treemapSquarify.test.ts`) holds the strict math, the e2e side holds the end-to-end behaviour with sane slack.
- **`<plus-tile>` participates in the 1/12 floor on equal footing.** The slot model carries `weight: 1` for plus slots (per §4); the squarify sees the plus tile as just another weight in the input, so its area is clamped up the same way as the lights in skewed-weights. The Phase 8 modal can still drop the plus tile (or hide it at cap) without changing the floor logic.
- **Side-effect imports for `<parent-identity-strip>` + `<children-grid>` in the shell.** `@customElement` decorators only register their tag if the module is *evaluated*. The shell's `import "./ChildrenGrid.js"` + `import "./ParentIdentityStrip.js"` are bare side-effect imports next to the `import type {}` from `NodeViewModel` (per the §17.9 view-test convention). Without them, the production bundle would silently render `<children-grid>` as a generic `HTMLElement` since nothing else imports it for runtime.

**What's testable today**:

- `npm test` — **370 unit tests** across 36 files (~7 s).
- `npm run lint` (`tsc --noEmit`) clean.
- `npm run lint:rules` (ESLint layered rules) clean.
- `npm run build` produces a 53.08 KB / 16.18 KB gzip bundle (was 48.08 / 14.65 in §17.9) + 0.75 KB on-demand `testBridge` chunk; 61 modules transformed (was 56).
- `npm run dev` / `npm run preview` — kiosk renders the parent identity strip + squarified children grid + plus tile, reflows on viewport resize.
- `npm run test:e2e` runs **23 Playwright BDD scenarios** under headless Chromium (boot ×2 + view ×12 + layout ×9). All green.

**What's deferred to the DT-6 shell-chrome sub-strand**:

- Drawer + handle + auto-hide gesture (`shell/drawer.feature`).
- Breadcrumb (root → focus, left-truncating, navigates on tap; `shell/breadcrumb.feature`).
- Burger menu (Import / Export / Boards entries; `shell/burger_menu.feature`).
- The composition root will need to wire `BoardCollectionService` rename / switch / create through the burger menu, and `ImportExportService` through the drawer's Import / Export entries.

---

## Resume protocol

When resuming this conversation:

1. **Read §17 (Implementation log) first** — it is the source of truth for as-built status (which phases have landed, on which commits, and any decisions taken during implementation that §1–§16 did not pin down). Then re-read this file end-to-end. Decisions §13.1, §13.2, §13.3, §14, §15, §16 are locked.
2. **Re-read** `examples/classDiagramMermaid.v2.mermaid`, `examples/test.json`, `examples/test-before.html`, `examples/test-after.html`.
3. **Run `git status` and `git log --oneline`** — confirm `HEAD` matches the latest commit recorded in §17.0. Phases 0–7 (DT-6 — layout half) are landed (DT-10 script half too — Tasks A/B remain manual ops); the working tree should be clean (or hold only docs/test-fixture WIP).
4. **Sanity check the build**: `npm test` (expect **370** tests across **36** files per §17.5), `npm run lint`, `npm run lint:rules`, `npm run build` (expect ~53 KB / ~16 KB gzip), and `npm run test:e2e` (expect **23** scenarios) — all should be green before starting new work. The first `npm run test:e2e` after a clone needs `npx playwright install chromium`.
5. **Verify Atlassian MCP is online** — list `C:\Users\amiot\.cursor\projects\<workspace-id>\mcps\` (the `<workspace-id>` derives from whichever folder is opened as the Cursor workspace; for `c:\Cursor` it is `c-Cursor`, for `c:\Cursor\tree-graph-viz` it is something like `d-…-tree-graph-viz`) and confirm an `atlassian`-like descriptor folder exists alongside `plugin-datadog-datadog`. If not, the user has not yet completed the OAuth flow after the Cursor restart that picked up `.cursor/mcp.json` (which is committed in the repo and also mirrored to global + workspace-root paths per §17.8). Strand A — 16 issues + 25 `Blocks` edges — is already created per §15.9.
6. **Pick up the next strand**:
   - **Phase 5 leftovers (separate strand)**: DT-10 (`HE-2581`) + Task A (`HE-2586`) + Task B (`HE-2589`) — XRay import pipeline (`bin/xray-import.ps1`), credential provisioning, and first XRay import dry-run. Needs `XRAY_CLIENT_ID` + `XRAY_CLIENT_SECRET` in env (§16.8).
   - **Phase 7 shell-chrome sub-strand (DT-6 continuation)**: the layout half is landed (§17.10 — `<parent-identity-strip>` + `<children-grid>` + `OrientationController` + 9 BDD layout scenarios). The remaining DT-6 work is Drawer (`shell/drawer.feature`) + Breadcrumb (`shell/breadcrumb.feature`) + Burger menu (`shell/burger_menu.feature`). Once those land, DT-6 is fully done and Phase 8 (DT-7 — Add-child modal) can start.
7. XRay import script and credentials are tracked under the Phase 5 (DT-10/Task A/Task B) strand above; not blocking for Phase 7.
