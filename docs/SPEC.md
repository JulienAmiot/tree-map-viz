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
| **5 (DT-9)** | `49c0eff` | 279 _(unit)_ + 0 → 2 _(e2e)_ | DONE | Composition root + Lit shell stub + `testBridge` + Playwright smoke (2 scenarios) green. DT-10 + Task B (XRay import + dry-run) still TODO. |
| **6–11** | — | — | TODO | Lit views, shell, modal, animations, wiring, kiosk smoke. |

Verification on each landed commit: `npm test` green, `npm run lint` (`tsc --noEmit`) clean, `npm run lint:rules` (ESLint layered rules) clean. Phase 5 also requires `npm run test:e2e` (Playwright BDD) green.

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

- `npm test` runs **279** unit tests (~6 s on a typical dev box).
- `npm run lint` (`tsc --noEmit`) clean.
- `npm run lint:rules` (ESLint layered rules) clean — no domain → application/adapters/browser-API leak, no application → adapters leak, no `lit` outside `adapters/ui`.
- `npm run build` produces a `dist/` with `<tree-graph-screen>` rendering the focused node's title and children. The `testBridge` is emitted as a separate ~0.75 KB chunk that's only fetched when `?test=1` is in the URL (dynamic-import tree-shake).
- `npm run dev` / `npm run preview` launch the kiosk. With empty `localStorage`, the default seed shows a single "Root" board.
- `npm run test:e2e` runs the Playwright BDD smoke under headless Chromium (2 scenarios: default-seed boot, and bridge-seed-then-reload of the org tree). Both green.

### 17.6 Phase 5 (DT-9) — BDD harness (`49c0eff`)

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

**What's still TODO in Phase 5** (DT-10 + Task B, separate strand):

- `bin/xray-import.ps1` (DT-10 / `HE-2581`) — script to zip `src/test/e2e/features/`, POST to XRay's `/api/v1/import/feature`, and round-trip the returned `@HE-…` Test keys back into the `.feature` files (§15.7).
- First XRay import dry-run (Task B / `HE-2589`) — needs `XRAY_CLIENT_ID` + `XRAY_CLIENT_SECRET` from Task A (`HE-2586`). Until then, the placeholder `@HE-????` tags in `app_boots.feature` stay as-is.

### 17.7 Open follow-ups beyond Phase 5

- **Decide whether to add `application/ports/ImportExportFile.ts`** when the UI file picker / Blob download is built. Currently the UI is expected to wrap `<input type="file">` + `URL.createObjectURL` around the string-in/string-out service.
- **Optional `architecture.test.ts`** mentioned in §12.5 Phase 4 was not added — `npm run lint:rules` (ESLint) already enforces the same import contract. Reconsider adding one only if a runtime invariant emerges that ESLint cannot express.
- **Composition root will grow** as Phases 6–8 land: `AddChildService` (Phase 8 modal consumer), `ImportExportService` (Phase 6/8 drawer consumer), and a router-driven board-switching path (Phase 10 routing/board_collection.feature).

---

## Resume protocol

When resuming this conversation:

1. **Read §17 (Implementation log) first** — it is the source of truth for as-built status (which phases have landed, on which commits, and any decisions taken during implementation that §1–§16 did not pin down). Then re-read this file end-to-end. Decisions §13.1, §13.2, §13.3, §14, §15, §16 are locked.
2. **Re-read** `examples/classDiagramMermaid.v2.mermaid`, `examples/test.json`, `examples/test-before.html`, `examples/test-after.html`.
3. **Run `git status` and `git log --oneline`** — confirm `HEAD` matches the latest commit recorded in §17.0. Phases 0–5 (DT-9) are landed; the working tree should be clean (or hold only docs/test-fixture WIP).
4. **Sanity check the build**: `npm test` (expect the count in §17.0), `npm run lint`, `npm run lint:rules`, and (Phase 5+) `npm run build` then `npm run test:e2e` — all should be green before starting new work. The first `npm run test:e2e` after a clone needs `npx playwright install chromium`.
5. **Verify Atlassian MCP is online** — list `C:\Users\amiot\.cursor\projects\d-Travail-tree-graph-viz\mcps\` and confirm an `atlassian`-like descriptor folder exists alongside `plugin-datadog-datadog`. If not, the user has not yet completed the OAuth flow after the Cursor restart that wrote `.cursor/mcp.json`. (Strand A — 16 issues + 25 `Blocks` edges — is already created per §15.9.)
6. **Pick up the next strand**:
   - **Phase 5 leftovers (separate strand)**: DT-10 (`HE-2581`) + Task A (`HE-2586`) + Task B (`HE-2589`) — XRay import pipeline (`bin/xray-import.ps1`), credential provisioning, and first XRay import dry-run. Needs `XRAY_CLIENT_ID` + `XRAY_CLIENT_SECRET` in env (§16.8).
   - **Phase 6 (DT-5 — Lit views)**: per §12.5, build the per-kind/per-role view templates + `NodeView` dispatcher + `PlusTile`. The `<tree-graph-screen>` shell stub from §17.6 will be replaced; the composition root grows by one more wire (`AddChildService` consumer arrives later in DT-7).
7. XRay import script and credentials are tracked under the Phase 5 (DT-10/Task A/Task B) strand above; not blocking for Phase 6.
