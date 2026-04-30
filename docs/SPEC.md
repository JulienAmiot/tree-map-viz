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
- `TextNode` — concrete sibling of `BusinessScoreCardNode`. Composes a `TextCard` (a string-typed history aggregate, parallel to `BusinessScoreCard`); extends `TreeNode<string>` and implements **`Historizable<string>`** (added in §17.14 — every node, including text nodes, now carries a `TimestampedValue` history; the displayed "value" is the latest entry's `.value`). Still **does NOT implement `ContributesToParent<T>` or `HasObjective<T>`** → excluded from parent computation by the type system, not by a flag. Per §17.15, the **current value IS the description for a text card** — the underlying `NodeIdentity.description` is always empty for `TextNode` (and the modal omits the field), so the same string is never collected/displayed twice.
- `BusinessScoreCardNode<T>` — concrete sibling. Composes `BusinessScoreCard<T>`. Implements `Historizable<T>`, `HasObjective<T>`, `ContributesToParent<T>`. Carries `computed: boolean` and `eligibleForParentComputation: boolean`.

### Value objects (no primitives)

`Title`, `Description`, `Weight`, `Unit`, `NodeIdentity { title, description }`.

### Aggregates

- `BusinessScoreCard<T>` — `unit: Unit`, `objective: Objective<T>`, `historizedValues: TimestampedValue<T>[]`. Implements `Historizable<T>`.
- `TextCard` (added in §17.14) — `historizedValues: TimestampedValue<string>[]`. Implements `Historizable<string>`. Minimal aggregate that owns a `TextNode`'s string-typed history; deliberately has no `Unit` or `Objective` (text values aren't on a numeric scale).
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

### Field-content rules (locked, refined in §17.14)

| Node kind | `computed` | Fields rendered (both roles) |
|---|---|---|
| `BusinessScoreCardNode<T>` | `true`  | `Title` + computed value (with `Unit` at 1/3 of the value's font-size) + `Σ` badge + **most-recent-child** date in the **bottom-right corner** (§17.18) |
| `BusinessScoreCardNode<T>` | `false` | `Title` + latest `TimestampedValue.value` (with `Unit` at 1/3 size) + its `asOf` in the **bottom-right corner** (§17.18) |
| `TextNode` | n/a | `Title` + latest `TimestampedValue<string>.value` (full text, fills the tile) + its `asOf` in the **bottom-right corner** (§17.18) |

A small "Σ" badge marks computed values so users can distinguish derived from recorded.

### Layout invariants (§17.14)

The four per-(kind × role) view elements share a single `tileLayoutStyles` chunk that pins the following invariants on every tile:

- **Title row** — fixed `3vh` height with a `vh`-relative font-size, so titles look the same across tiles regardless of how big or small a given tile is. The "3 %" comes straight from the user-stated requirement.
- **Timestamp** — absolutely positioned in the **bottom-right corner** of the tile (§17.18 — moved from top-right; the title row keeps the full width and the date sits below the figure where the eye lands after reading the value). Rendered when (and only when) a date can be derived: latest `TimestampedValue` for `recordedValue` BSC and `TextNode`; the **most recent date among the children's current values** for computed BSCs (`computedMean` / `childrenCount`, recursing through nested computed children — the date answers "as of when is this aggregate current?"). Omitted for empty-history nodes and computed BSCs whose subtree has no dated children. Colour follows a warm-orange → cold-pale-blue gradient by age in days (`dateAgeColor`, see §17.18).
- **Value** — fills the rest of the tile via `font-size: clamp(1.5rem, 36cqmin, 20rem)` (container-query-minimum), so the value scales with the *tile* (not the viewport) up to a clamp ceiling. The `36cqmin` coefficient (bumped from `18cqmin` in §17.17 — "the figure should be the biggest possible") keeps a 4-digit numeric value within the tile's width on a square tile while doubling the apparent value size on the kiosk. For numeric values the unit is nested as `<span class="unit">` styled at `font-size: calc(1em / 3)`, holding a fixed 1/3 ratio whatever the `cqmin` clamp lands at.
- **Description is no longer rendered in the tile body.** It stays a domain field on `NodeIdentity` (so import/export and future detail views can use it), but the per-tile body is reserved for the timestamped value to honour "the value should occupy the most space possible inside the tile".
- **Child tiles are visually distinguishable from each other (§17.17).** `<children-grid>` styles every `[data-slot="node"]` wrapper with a subtle `currentColor`-mixed background tint, a 1 px solid border, and an 8 px border-radius. The currentColor mix keeps the cues theme-adaptive; the border ensures the tile boundary is visible even when the value text is empty (e.g. a fresh TextNode whose history hasn't been seeded yet). The plus tile is intentionally NOT covered by this rule — its own dashed border stays the affordance's signature look.

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
- Each empty field shows a **distinctively styled placeholder** (greyish/italic/muted) of the form **`<Field name> — e.g. <mock value>`** — the capital-leading field name (re-)states the input's purpose, the em-dash (`—`, U+2014) separates label from example, and the `e.g.` clause carries a concrete sample value. Examples: `Title — e.g. "North-region revenue"` for a title field, `Objective target value — e.g. 100` for a numeric goal, `As of — e.g. 2026-04-30 (today)` for a date that defaults to today. The two-part shape ensures the field stays self-explanatory even when an empty form is read in isolation (no surrounding labels), while still carrying a usable example value the operator can pattern-match against. Pinned by `<add-child-modal>` unit tests + the `modal/empty_field_placeholders.feature` scenarios; the regex is `^[A-Z].* — e\.g\.`.

## 7. Add-child modal

Triggered by activating the "+" tile. Never drills.

- **Wide**, with **side margin** so the underlying board is still partially visible (semi-transparent backdrop). Conveys "the board is still behind".
- Step 1 — pick the **node type**: `Text` or `BusinessScoreCard` (extensible later via the same registry as views).
- Step 2 — type-specific form, using the empty-field placeholder pattern (§6).
  - For `BusinessScoreCard`: in addition to identity (title, optional description, weight, unit) and objective (initial / target / target date), the form requires a **mandatory current value** (the seed `TimestampedValue` for the otherwise-empty history) with an **as-of date defaulted to today** (kiosk-local calendar day, `YYYY-MM-DD`) and editable. See §17.13 for the rationale (a fresh BSC must boot with at least one observation; otherwise `currentValue()` would throw on the very first read).
  - For `Text`: identity is just **title + weight** — there is **no** description field (§17.15: the current value IS the description for a text card, so collecting it twice would be redundant). The form requires the same **mandatory current value** seed as BSC — a `TimestampedValue<string>` (textarea + as-of date defaulted to today, editable). Same rationale as BSC: every fresh `TextNode` must boot with at least one entry in its `TextCard` so `currentValue()` returns the displayed text instead of throwing `EmptyHistoryError`. See §17.14 + §17.15.
- The **`weight` field is pre-filled with `1`** on both kinds (§17.16) — the vast majority of nodes carry the default weight, so pre-filling saves the operator a tap. It stays editable for the rare case where a child should weigh more (or less) than its siblings.
- The **BSC current-value row aligns `current-value`, `unit`, and `as-of date` on the same line** (§17.16). Those three fields together describe a single measurement (the seed observation) and are cognitively a unit; putting them side-by-side reduces eye-travel for "42 % as of today". The unit field used to share the weight row; it now belongs with the seed observation it qualifies.
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
| **7 (DT-6 — layout)** | `d94e65b` | 321 → 370 _(unit)_ + 14 → 23 _(e2e)_ | DONE | `OrientationController` + `TreemapController` + `<parent-identity-strip>` + `<children-grid>` (squarified treemap with the 1/12 floor + `ResizeObserver`-driven reflow). Shell composes them through a 22 % / 78 % CSS grid + reflects orientation as `data-orientation`. 3 new layout `.feature` files (TP-B): `treemap_n_plus_one` (n ∈ {0,1,11,12} outline), `treemap_min_tile_clamp`, `orientation_reflow`. See §17.10. |
| **7 (DT-6 — shell chrome)** | `637d323` | 370 → 396 _(unit)_ + 23 → 33 _(e2e)_ | DONE | `<app-drawer>` (auto-hide top-edge panel, tap-toggle handle, outside-tap + Esc close) + `<focus-breadcrumb>` (tappable root → focus segments, `aria-current="page"` on focus, CSS-only left fade for overflow) + `<burger-menu>` (Import / Export / Boards items + outside-tap + Esc close). Shell composes them in the drawer body alongside the board name; composition root computes `boardName` + `breadcrumbPath` on each refresh and wires `breadcrumb-navigate` → `nav.focusByUuid` + `router.push` + `refresh`. 3 new shell `.feature` files (TP-B): `drawer`, `breadcrumb`, `burger_menu`. See §17.11. |
| **8 (DT-7)** | _(see git log)_ | 396 → 420 _(unit)_ + 33 → 45 _(e2e)_ | DONE | `<add-child-modal>` (wide kiosk modal: Step 1 type picker — Text / BusinessScoreCard — + Step 2 per-kind form using the empty-field placeholder pattern §6 + confirm/cancel/Esc/backdrop-tap closes). Composition root constructs `AddChildService(idGen, persistCurrent)` and listens to `add-child-confirm`: resolves the parent via `findNodeById`, calls `addChild`, on success closes the modal + refreshes; on failure surfaces the reason inline. 2 new modal `.feature` files (TP-B): `add_child_modal` (×8), `empty_field_placeholders` (×4). See §17.12. |
| **8 (DT-7) refinement** | _(see git log)_ | 420 → 425 _(unit)_ + 45 _(e2e, unchanged)_ | DONE | Named placeholders (`<Field name> — e.g. <mock>`) + mandatory seed `TimestampedValue` for new BSC nodes (current value + as-of date defaulted to today, editable). SPEC §6 + §7 refined; +5 unit tests. See §17.13. |
| **8 (DT-7) refinement #2** | _(see git log)_ | 425 → 438 _(unit)_ + 45 → 49 _(e2e)_ | DONE | TextNode now also `Historizable<string>` via a new `TextCard` aggregate (mandatory seed value + as-of date in the modal, mirrors the §17.13 BSC contract). Unified per-tile layout: title `3vh`, current-value timestamp top-right, value fills via `cqmin`, numeric unit at `calc(1em / 3)` (1/3 of the value's font-size). Description no longer rendered in the tile. SPEC §3 + §5 + §7 refined; +13 unit tests, +4 e2e scenarios (incl. new `views/tile_layout.feature`). See §17.14. |
| **8 (DT-7) refinement #3** | _(see git log)_ | 438 → 439 _(unit)_ + 49 _(e2e, unchanged)_ | DONE | TextNode no longer collects/exposes a description: the current value IS the description for a text card (modal omits the field; `TextNodeViewModel` drops it; `AddChildPayload.TextNode` has no `description` key). BSC keeps its description field (the metric's definition is still distinct from its measured value). SPEC §3 + §5 + §7 + §17.0 refined, new §17.15. +1 unit test (`<add-child-modal>` asserts the BSC form keeps the field while the Text form drops it); the e2e `add_child_modal` scenario flips `description field` → `no description field` on the Text branch and adds it to the BSC branch. |
| **8 (DT-7) refinement #4** | _(see git log)_ | 439 → 442 _(unit)_ + 49 _(e2e, unchanged)_ | DONE | Two small UX tweaks to the modal: (1) the `weight` field is **pre-filled with `1`** on both Text and BSC forms (matching the placeholder example AND the service-side fallback in `AddChildService.buildNode`); (2) the BSC current-value row now aligns **`current-value`, `unit`, and `as-of date` on the same line** — cognitively a unit (the seed observation). The weight row is now unit-less. SPEC §7 refined, new §17.16. +3 unit tests (`<add-child-modal>` asserts weight pre-fill on both kinds, weight default re-applied across re-opens, and BSC current-value row order). |
| **8 (DT-7) refinement #5** | _(see git log)_ | 442 → 444 _(unit)_ + 49 → 51 _(e2e)_ | DONE | "The figure should be the biggest possible + tiles must be distinguishable." Bumped the value font-size coefficient from `18cqmin` → `36cqmin` (≈ 2× larger; clamp floor 1.5rem, ceiling 20rem — chosen so a 4-digit number still fits a square tile's width). Added a subtle `currentColor`-mixed background tint + 1 px border + 8 px border-radius on `[data-slot="node"]` tiles in `<children-grid>` for visual separation; plus tile is intentionally exempt (its dashed border stays the affordance's signature). SPEC §5 layout invariants refined, new §17.17. +2 unit tests (CSS-rule presence + `data-slot` correctness in `<children-grid>`); +2 e2e scenarios (value font-size ≥ 3× title; every node tile has a 1+ px border + non-transparent background, with rgba alpha strictly between 0 and 1). |
| **8 (DT-7) refinement #6** | _(see git log)_ | 444 → 466 _(unit)_ + 51 → 52 _(e2e)_ | DONE | Three coupled UX tweaks to the corner timestamp: (1) **moved from top-right to bottom-right** so the title row keeps the full width and the date sits below the figure where the eye lands after reading the value; (2) for **computed BSCs** the date is now the **most recent date among the children's current-value dates**, recursing through nested computed BSCs (new `domain/aggregation/currentValueDate`) — the date answers "as of when is this aggregate current?"; (3) the **colour is age-driven** (warm orange `rgb(255,145,50)` for today, cold pale blue `rgb(140,180,220)` at 180+ days, linear lerp in RGB; new `dateAgeColor` helper). SPEC §5 layout invariants refined, new §17.18. **+22 unit tests** across new files (`dateAgeColor.test.ts`, `currentValueDate.test.ts`) + updates to TextNode/BSC view tests + the mapper test (top-level `dateIso` field, recursion through nested computed BSCs); **+1 e2e scenario** verifying the corner colour falls in the expected gradient hull (the previous "top-right" scenario flips to "bottom-right"). |
| **9–11** | — | — | TODO | Animations, persistence/routing wiring, kiosk smoke. |

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

Snapshot kept current with the latest landed phase (Phase 8 / DT-7 — Add-child modal). Each phase's own as-built sub-section (§17.1–§17.12) preserves the per-phase numbers at landing time so the historical record isn't lost.

- `npm test` runs **420** unit tests across **40** files (~7 s on a typical dev box).
- `npm run lint` (`tsc --noEmit`) clean.
- `npm run lint:rules` (ESLint layered rules) clean — no domain → application/adapters/browser-API leak, no application → adapters leak, no `lit` outside `adapters/ui`, no `src/{domain,application,adapters}/**` imports inside `src/test/e2e/**`.
- `npm run build` produces a `dist/` with the kiosk bundle at ~81.1 KB (gzip ~22.1 KB) + a 0.75 KB on-demand `testBridge` chunk that's only fetched when `?test=1` is in the URL (dynamic-import tree-shake). 66 modules transformed (was 64 in §17.11). The bundled `<tree-graph-screen>` now also overlays a `<add-child-modal>` triggered by the `<plus-tile>`'s `plus-tile-activate` event; the composition root drives `AddChildService.addChild` on `add-child-confirm` and refreshes the focused view (§17.12).
- `npm run dev` / `npm run preview` launch the kiosk. With empty `localStorage`, the default seed shows a single "Default Board" board (a `TextNode` "Root" — so the parent strip renders Title + Description and the children grid contains only the `+` tile; tapping the `+` opens the add-child modal, and confirming a Text or BusinessScoreCard payload appends a new child + persists to `localStorage`).
- `npm run test:e2e` runs **45** Playwright BDD scenarios under headless Chromium: 2 boot scenarios + 12 view scenarios (TP-A; §17.9) + 9 layout scenarios (TP-B; §17.10) + 10 shell scenarios (TP-B; §17.11) + 12 modal scenarios across 2 `modal/*.feature` files (TP-B — `add_child_modal` ×8, `empty_field_placeholders` ×4; §17.12). All green.

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

### 17.11 Phase 7 (DT-6 — shell chrome) — Drawer + breadcrumb + burger

DT-6 (`HE-2583`) — the shell-chrome sub-strand — landed on top of §17.10. Three new Lit elements (`<app-drawer>`, `<focus-breadcrumb>`, `<burger-menu>`) compose into the drawer body alongside the board name, and the composition root grows two new event wires (`breadcrumb-navigate` → router push + focus refresh, `burger-menu-action` → placeholder log; the real Import / Export / Boards consumers wire in Phase 10 per SPEC §15.4 + §17.3).

**Files added** (all under `src/adapters/ui/shell/` unless noted):

- `Drawer.ts` — `<app-drawer>`. Absolutely-positioned at the top of the host (`z-index: 50`, `pointer-events: none` on the host wrapper so the body underneath stays interactive when the panel is closed; the handle and panel re-enable `pointer-events: auto`). State surface: `open` boolean attribute (reflected) + `toggle()` method + `drawer-toggle` `CustomEvent<{open}>`. Auto-close paths: outside tap (`document` capture-phase listener + `composedPath().includes(this)` so taps on slotted children — including those inside other shadow roots — count as inside) and Escape key. Animation is pure CSS (`max-height` + `cubic-bezier`), gated by `prefers-reduced-motion: reduce`. The handle is a styled `<button>` with `aria-expanded` + `aria-controls` for screen readers, and a hidden `.sr-only` label that flips between "Show drawer" / "Hide drawer".
- `Breadcrumb.ts` — `<focus-breadcrumb>`. Property-only contract (`path: readonly BreadcrumbSegment[] = []`; segments are `{ id, title }` plain JSON, computed by the composition root via `walkPath`). Renders one `<button data-testid="crumb">` per ancestor + a non-button `<span data-testid="crumb" aria-current="page">` for the focused segment, with `›` separators in between. Click on an ancestor fires a bubbling+composed `breadcrumb-navigate` `CustomEvent<{nodeId}>`; click on the focus is a no-op by design (the `<span>` has no listener). Truncation is CSS-only: `display: flex; flex-wrap: nowrap; justify-content: flex-end; overflow: hidden;` anchors the recent segments to the right; `mask-image: linear-gradient(to right, transparent 0, black 1.25rem)` fades the leftmost (oldest) edge into a `…`-ish indicator without measurement loops or `ResizeObserver`. The pixel-perfect "head + tail" pattern (`Root › … › Parent › Focus`) sketched in §4 is a deferred refinement; the coarse strategy here ships the spec contract and is stable under arbitrary path lengths.
- `BurgerMenu.ts` — `<burger-menu>`. Trigger button (`data-testid="burger-trigger"`, `aria-haspopup="menu"`, `aria-expanded` reflects state) + popup `<ul role="menu" data-testid="burger-menu" hidden>`. Three menu items in fixed order: `import` / `export` / `boards`, each rendering as `<button role="menuitem" data-testid="burger-item" data-action="…">`. Activating an item closes the menu and dispatches a bubbling+composed `burger-menu-action` `CustomEvent<{action}>`. Same outside-tap + Escape close pattern as the drawer.

**Files modified**:

- `shell/TreeGraphScreen.ts` — composition body grows two new properties (`boardName: string` + `breadcrumbPath: readonly BreadcrumbSegment[]`) and the drawer overlay. The drawer is rendered above both the loading placeholder and the layout wrapper, so chrome (board name + breadcrumb + burger) is reachable even before the first view arrives. Slotted content inside `<app-drawer>` is the `.drawer-content` flex row: `<span data-testid="board-name">` (leading edge, ellipsis-truncated at `max-width: 14rem`) + `<focus-breadcrumb>` (flex-grow, `min-width: 0` so it can shrink) + `<burger-menu>` (trailing edge). Side-effect imports (`./Drawer.js`, `./Breadcrumb.js`, `./BurgerMenu.js`) sit alongside the existing `./ChildrenGrid.js` + `./ParentIdentityStrip.js` to satisfy the §17.9 / §17.10 `@customElement` registration pitfall.
- `main.ts` — composition root grows the breadcrumb + burger event wires. `refresh()` now also computes `boardName = boards.getCurrentBoard().name` and `breadcrumbPath = computeBreadcrumb(current.tree, nav.getFocusedId())` (`computeBreadcrumb` walks `walkPath(root, focusedId)` and maps each `TreeNode` to a plain `{ id, title }`). The `breadcrumb-navigate` listener calls `nav.focusByUuid(nodeId)` directly + `router.push(...)` + `refresh()` — see "Decisions" below for why the URL push isn't enough on its own. The `burger-menu-action` listener logs a placeholder; real consumers land in Phase 10.

**Unit tests added** (Vitest — 396 total now, +26 since §17.10):

- `Drawer.test.ts` (8 tests) — starts closed (open=false, aria-expanded=false, aria-hidden=true), slot projection works, handle-tap toggles open/closed, every state change fires `drawer-toggle` (bubbles+composed; detail flips), idempotent setter doesn't fire spurious events, outside tap closes, slotted-content tap doesn't close, Escape closes when open.
- `Breadcrumb.test.ts` (8 tests) — empty path renders nothing; populated path renders one crumb per segment in root → focus order; `n-1` separators between segments; ancestors are `<button>` + focus is `<span aria-current="page">`; clicking an ancestor fires `breadcrumb-navigate` with the right nodeId (bubbles+composed); clicking the focus is a no-op; single-segment path renders only the current crumb; reassigning `path` re-renders.
- `BurgerMenu.test.ts` (7 tests) — starts closed, renders exactly the three items in order, trigger-tap toggles, item-tap fires `burger-menu-action` and auto-closes, outside tap closes, item tap doesn't double-fire via the outside-tap path, Escape closes when open.
- `TreeGraphScreen.test.ts` (+2 tests) — drawer + drawer-content (board name, breadcrumb host, burger host) is rendered at all times (even before view is set); updates to `boardName` + `breadcrumbPath` propagate into the slotted children.

**Playwright BDD added — TP-B (shell chrome half)** (3 `.feature` files under `src/test/e2e/features/shell/`):

- `drawer.feature` — Background opens the kiosk (default seed = "Default Board"). Scenarios: at-rest the drawer is closed; tapping the handle reveals a panel containing the board name "Default Board", the breadcrumb host, and the burger trigger; tapping the handle a second time closes it.
- `breadcrumb.feature` — Background seeds `capacityTree` and opens the drawer. Scenarios: at root the breadcrumb shows a single non-tappable segment (`Capacity test root`); a 3-deep focus on `n11c5` produces 3 segments (`Capacity test root` → `Eleven children` → `5`) with the last one current; tapping the ancestor segment for `n11` flips focus to `n11` and the breadcrumb collapses to 2 segments.
- `burger_menu.feature` — Background opens the kiosk + drawer. Scenarios: at-rest the burger menu is closed; tapping the trigger reveals exactly 3 items (`import`, `export`, `boards`); tapping the burger trigger then the board name closes only the menu (drawer stays open — proves the "outside the burger but inside the drawer" probe walks shadow DOM correctly); tapping the trigger twice toggles closed.

**Step + page-object plumbing**:

- `src/test/e2e/steps/shellSteps.ts` — adds 13 generic steps. The drawer steps (`I tap the drawer handle`, `the drawer is {open|closed}`, `the drawer panel contains the board name {string}`, `…contains the focus breadcrumb`, `…contains the burger trigger`) speak through page-object getters, never reaching into shadow roots directly. The breadcrumb steps (`I tap the breadcrumb segment for {string}`, `the breadcrumb has {int} segment(s)`, `breadcrumb segment {int} shows {string}`, `the last breadcrumb segment is the current page`) cover both the count and the role-tagging contract. The burger steps (`I tap the burger trigger`, `I tap the board name`, `the burger menu is {open|closed}`, `the burger menu has {int} items`, `the burger menu has an item with action {string}`) are likewise generic. Reuses `bootSteps.ts` (`I open the kiosk in test mode with empty storage`, `I reload the kiosk`) and `viewSteps.ts` (`I seed the {string} fixture via the test bridge`, `I focus on node {string}`, `the focused id is {string}`) — no duplication.
- `src/test/e2e/pageObjects/TreeGraphPage.ts` — extended with `drawerHost()` / `drawerHandle()` / `boardNameLabel()` / `breadcrumbHost()` / `breadcrumbSegments()` / `breadcrumbSegmentByNodeId(id)` / `burgerTrigger()` / `burgerMenuList()` / `burgerMenuItems()` / `burgerMenuItemByAction(a)` plus the boolean readers `isDrawerOpen()` / `isBurgerMenuOpen()` and the `focusedId()` accessor (reads `data-focused-id` from the parent strip — used by the breadcrumb-navigate scenario). Playwright's CSS engine pierces open shadow DOM, so locating `[data-testid="crumb"][data-node-id="…"]` from `page.locator(...)` resolves the right shadow-root child without explicit traversal.

**Decisions taken during implementation that earlier sections did not pin down**:

- **`HashRouter.push` does NOT fire `hashchange`.** `history.pushState(null, "", href)` mutates the URL but Web standards explicitly say only `location.hash = …` (or browser back/forward / `popstate` / external mutation) fires `hashchange`. The composition root therefore does not rely on `router.onChange(...)` to react to its own internal navigation; the breadcrumb-navigate handler calls `nav.focusByUuid(nodeId)` + `router.push(state)` + `refresh()` *synchronously*. The `router.onChange` listener stays in place to cover external changes (browser back/forward, manual hash edits, the test bridge's `navigateTo` which uses `location.hash = …` and *does* fire `hashchange`). This is documented in `main.ts`'s top-of-file comment so the next contributor sees the asymmetry.
- **`aria-hidden` on the drawer panel uses a string-valued binding, not Lit's `?aria-hidden`** boolean-attribute syntax. `?aria-hidden=${cond}` adds a bare `aria-hidden=""` (truthy in attribute-presence terms but ambiguous as a string value); accessibility tooling expects literal `"true"` / `"false"`. The template now writes `aria-hidden=${this.open ? "false" : "true"}` so the attribute always carries the canonical string. Captured here so re-readers don't try to "simplify" back to `?aria-hidden`.
- **Outside-tap detection walks `composedPath()`, not target-equality.** All three new elements (drawer, breadcrumb host, burger) live in different shadow roots and may project content (the drawer slots its content; the breadcrumb is itself slotted). `path.includes(this)` is the only reliable "is the click *anywhere* inside this component's tree" check that survives shadow DOM, slotting, and event retargeting. Covered by unit tests on each element (e.g. "tap inside the slotted content does NOT close the drawer", "item tap inside burger does NOT double-fire via the outside-tap path").
- **Drawer chrome is rendered even before the first view arrives.** The shell renders `${drawer}` *above* the `if (!this.view)` early-return, so the user can interact with the chrome (drawer handle, board name, burger menu) during the brief loading state. The breadcrumb is empty at that point (renders nothing — see `<focus-breadcrumb>`'s `path.length === 0 → nothing` branch), so there's no flash of empty crumbs.
- **`mask-image` left fade for breadcrumb overflow over a JS measurement loop.** The §4 sketch suggests truncation from the left with a leading `…`, with the example `Root › … › Parent › Focus` implying a head-keep + tail-keep + middle-`…` pattern. Doing that pixel-perfectly requires measuring the rendered width, hiding/replacing middle segments, and re-measuring on each width change — a re-render loop that's not flat. The CSS-mask + `flex-end` strategy ships the spec contract today (the focus is always visible, ancestors fade out as they overflow) and is stable under arbitrary path lengths. The pixel-perfect refinement is captured as a follow-up rather than a blocker.
- **Breadcrumb feature seeds `capacityTree` because it covers the 3-deep `n11c5` focus path** without needing a new fixture. The titles (`Capacity test root` / `Eleven children` / `5`) are therefore part of the breadcrumb feature's expected text — re-readers should not "tidy up" the fixture's titles without also updating `shell/breadcrumb.feature`.
- **The drawer overlay sits at `z-index: 50` and the burger popup at `z-index: 60`** so the menu lifts above the drawer's bottom border on the rare layout where they would overlap. No other `z-index` is set in the shell; the layout wrapper, parent strip, and children grid all default to the auto stack and live underneath the drawer.

**What's testable today** (snapshot at landing):

- `npm test` — **396 unit tests** across 39 files (~7 s).
- `npm run lint` (`tsc --noEmit`) clean.
- `npm run lint:rules` (ESLint layered rules) clean.
- `npm run build` produces a 64.72 KB / 18.41 KB gzip bundle (was 53.08 / 16.18 in §17.10) + 0.75 KB on-demand `testBridge` chunk; 64 modules transformed (was 61).
- `npm run dev` / `npm run preview` — kiosk renders the focus tree; the drawer handle is visible at the top of the viewport; tapping it reveals the board name + breadcrumb + burger; breadcrumb taps re-focus; burger items log a placeholder action.
- `npm run test:e2e` runs **33 Playwright BDD scenarios** under headless Chromium (boot ×2 + view ×12 + layout ×9 + shell ×10). All green.

**What's deferred beyond DT-6** (now fully landed):

- Phase 8 (DT-7) — Add-child modal opened by `<plus-tile>`'s `plus-tile-activate` event. This unblocks the §12.3 `add_child/*.feature` test set + the existing `AddChildService` capacity → validate → attach → persist pipeline (§17.3).
- Phase 10 (DT-8 + persistence/routing) — wires the burger-menu-action handler to real consumers: Import (`<input type="file">` + `ImportExportService.importJson`), Export (`URL.createObjectURL` + `ImportExportService.exportJson`), Boards (rename / switch / create panel against `BoardCollectionService` + a `boards` deep-link path).
- The pixel-perfect breadcrumb truncation (`Root › … › Parent › Focus`) refinement noted in the Decisions section.

### 17.12 Phase 8 (DT-7) — Add-child modal

DT-7 (`HE-2584`) — the wide kiosk modal that triggers `AddChildService.addChild(parent, payload)` — landed on top of §17.11. One new Lit element (`<add-child-modal>`), a small wiring slice in the shell, two new wires in the composition root, and 12 new BDD scenarios across two `modal/*.feature` files. The pre-existing `AddChildService` (§17.3) was used unchanged: capacity → validate → attach → persist with rollback on persist error.

**Files added** (under `src/adapters/ui/modal/` unless noted):

- `AddChildModal.ts` — `<add-child-modal>`. Property surface: `open` (boolean attribute, reflected), `parentId` (informational, included in the confirm event so the composition root doesn't need to re-resolve focus), `errorMessage` (rendered inline, set by the composition root on a failed `addChild`). Two-step UI: Step 1 is a kind picker (`Text` + `Business Score Card`); Step 2 is the per-kind form following SPEC §6 (no `<label>` siblings, every text/number/date/textarea field carries an `e.g. …` placeholder). Confirm fires `add-child-confirm` `CustomEvent<{ parentId, payload }>` only when the constructed `AddChildPayload` is valid (Confirm button is disabled otherwise — Title required for Text, plus Unit + 3 objective fields for BusinessScoreCard). Cancel paths (Cancel button, Escape, backdrop tap) all fire `add-child-cancel`. The modal renders **nothing** in its body when `open=false`, so it has zero pointer-event surface in the at-rest state.

**Files modified**:

- `shell/TreeGraphScreen.ts` — composes `<add-child-modal>` as a sibling overlay at `z-index: 200`, owns its open state through two `@state` fields (`modalOpen`, `modalParentId`) plus an `addChildError` `@property`. Listens to `plus-tile-activate` on the layout wrapper (delegated capture: the children grid renders `<plus-tile>` deep in shadow DOM and the event is composed) → opens the modal with the supplied `parentId`. Listens to `add-child-cancel` → resets the open state. The modal does **not** auto-close on confirm; the composition root closes it explicitly via the new public seam `closeAddChildModal()` (so a failed addChild can keep the modal open with `setAddChildError(reason)`).
- `main.ts` — composition root wires `AddChildService(idGen, persistCurrent)`, where `persistCurrent` re-saves the whole `BoardCollectionSnapshot` through the `BoardCollectionRepository.save(...)` port. The `add-child-confirm` listener resolves the parent via `findNodeById(boards.getCurrentBoard().tree, detail.parentId)`, calls `addChildSvc.addChild(parent, detail.payload)`, and on success calls `screen.closeAddChildModal()` + `refresh()`. On failure (cap reached, invalid value, persist throws) it calls `screen.setAddChildError(result.reason)` so the modal renders an inline error and stays open.

**Unit tests added** (Vitest — 420 total now, +24 since §17.11):

- `AddChildModal.test.ts` (19 tests) — closed body is empty, Step 1 picker renders both kind cards + "Step 1 / 2" indicator, picking a kind moves to "Step 2 / 2" with the right form (Text-only fields vs. BSC unit + objective + toggles), Confirm-disabled-until-valid for both kinds, confirming a TextNode emits the right payload (description + weight optional folded), confirming a BSC emits the right payload (numbers parsed, ISO date as `Date`, default `computed=false` + `eligibleForParentComputation=true`), Cancel button + Escape + backdrop tap all dispatch `add-child-cancel` (Escape is a no-op when closed), Back returns to the picker without firing cancel, opening again resets the form (no leak from a prior session), `errorMessage` renders inline + flips `data-error` on the form. Plus 4 explicit tests for the empty-field placeholder pattern (every field has `e.g. …`, no `<label>` siblings on text/number/date/textarea fields, typing replaces the visual placeholder).
- `TreeGraphScreen.test.ts` (+5 tests) — `<add-child-modal>` is rendered at all times (closed by default), `plus-tile-activate` from inside the layout opens the modal with the supplied `parentId`, `add-child-cancel` closes the modal, `closeAddChildModal()` + `setAddChildError()` are the public seams the composition root uses, and `add-child-confirm` does **not** auto-close (intentional — the composition root has to make the call after `AddChildService` has acted).

**Playwright BDD added — TP-B (modal half)** (2 `.feature` files under `src/test/e2e/features/modal/`):

- `add_child_modal.feature` (8 scenarios) — at rest the modal is closed; clicking the `+` tile opens it at "Step 1 / 2"; the backdrop is semi-transparent (alpha < 1, parsed via `getComputedStyle().backgroundColor`); picking Text reveals only the text fields (no Unit, no objective); picking BSC reveals Unit + objective + the two toggles; confirming a Text child appends + closes the modal + leaves the focused id unchanged; cancel never persists; clicking the `+` tile is never a navigation.
- `empty_field_placeholders.feature` (4 scenarios) — every text/number/date/textarea field on the Text and BSC forms has a placeholder starting with `e.g.`; typing into a field replaces the placeholder; no `<label>` wraps a text/number/date/textarea (only the two checkboxes have labels — a deliberate a11y exception called out in the Decisions below).

**Step + page-object plumbing**:

- `src/test/e2e/steps/modalSteps.ts` — adds 23 generic steps (`I pick the kind {string}`, `I fill in the title with {string}`, `I confirm/cancel the add-child modal`, `the add-child modal is open/closed`, `the modal step indicator shows {string}`, `the modal form is for kind {string}`, `the modal has a/has no <field>`, `the modal backdrop is semi-transparent`, `every modal text input has a placeholder starting with "e.g."`, `no modal <label> wraps a text/number/date/textarea field`, `the focused id is unchanged after the modal interaction`). All steps speak through the page object; no imports from `src/{domain,application,adapters}/**`.
- `src/test/e2e/pageObjects/TreeGraphPage.ts` — extended with `addChildModalHost() / Panel() / Backdrop() / StepIndicator() / KindCard(kind) / Form() / Field(testId) / Confirm() / Cancel()` accessors plus the boolean reader `isAddChildModalOpen()`. All locators use Playwright's CSS engine which pierces open shadow DOM, so the chain through `<tree-graph-screen> → <add-child-modal> → <button>` resolves transparently.

**Decisions taken during implementation that earlier sections did not pin down**:

- **Private `@state() formTitle` (not `title`)**. Lit's `@property`/`@state` decorate fields on the host element; naming a field `title` would shadow the inherited `HTMLElement.title` (a public string property), which breaks the `T extends HTMLElement` constraint on `mountLitElement<T>` in the shared test fixture (§17.9). Captured in a code comment so the next contributor doesn't try to "tidy up" the naming.
- **Backdrop uses direct `rgba(0, 0, 0, 0.55)`, not `color-mix(in srgb, #000 55%, transparent)`.** Chromium resolves the latter to a fully-opaque value when read back through `getComputedStyle().backgroundColor` (the `transparent` keyword's alpha doesn't survive the round-trip in some color-mix paths in headless mode), which made the e2e "semi-transparent backdrop" assertion flaky. The direct `rgba(...)` keeps the effective shading identical and makes the alpha trivially parseable from the e2e harness.
- **Modal does NOT auto-close on Confirm.** The composition root needs to call `AddChildService.addChild(...)` first; only on success should the modal close. On failure the modal stays open with an inline `errorMessage` — explicitly tested (`<tree-graph-screen>` test "add-child-confirm does NOT auto-close"). Also documented in the modal's docstring so the inverse asymmetry doesn't get "fixed".
- **Cancel + Escape + backdrop-tap all share the same `add-child-cancel` event.** The composition root doesn't care which one the user picked — they all mean "do not persist". This collapses the API surface to two events (confirm + cancel) and matches the kiosk operator's mental model (one "leave without saving" affordance, regardless of which UI surface they touched).
- **`<plus-tile>` event listener is on the layout wrapper, not on the host.** The shell renders `<plus-tile>` deep inside `<children-grid>`'s shadow DOM. The `plus-tile-activate` event is composed + bubbling, so it crosses out of `<plus-tile>` and `<children-grid>`'s shadow roots and bubbles into `<tree-graph-screen>`'s shadow root. Attaching the listener on the layout wrapper (an element rendered by `<tree-graph-screen>`'s template) catches it without needing to reach into nested shadow roots; the test "plus-tile-activate from inside the layout opens the modal" verifies this end-to-end in jsdom.
- **Two checkboxes in the BSC form keep their `<label>` siblings** (the only `<label>` elements in the entire form). Checkboxes are non-textual and need a visible accessible name; SPEC §6 says the placeholder pattern applies to *form fields where a placeholder example doubles as the label*, which doesn't fit a checkbox (there's no input value to fill in). Encoded in the test via a "no `<label>` next to text/number/date/textarea" assertion (it explicitly allows labels around the two checkboxes).
- **Persister callback is decoupled from `BoardCollectionService`.** `AddChildService` takes a `Persister = () => Promise<void>`; the composition root passes a closure that calls `repo.save({ boards: [...boards.list()], currentBoardId: boards.getCurrentBoardId() })`. Because each board's `tree` is the same reference the service mutated via `parent.attach(child)`, the saved snapshot reflects the new structure. This avoids tight coupling between `AddChildService` and `BoardCollectionService` (the latter could be replaced or extended later without changing the former). On persist error, `AddChildService` already rolls back via `parent.detach(child)`.
- **Modal uses standard HTML `<input>` / `<textarea>` controls** rather than custom Lit form-control elements. Native form controls already implement keyboard navigation, IME, paste handling, and screen-reader semantics; rebuilding them as bespoke web components would be lot of work and a regression risk. The kiosk's "no scrollbars / no chrome" aesthetic is achieved through CSS only (`appearance: none` is implied by removing the OS chrome via background/border styling), no JS needed.
- **`buildPayload` returns `null` rather than throwing on incomplete input.** Confirm is disabled while the payload is `null`, so the user can't submit; on submit, `null` would short-circuit anyway. Throwing here would force a `try/catch` in the click handler and add no value (domain-level validation — Title length cap, Weight ≤ 0, etc. — still happens inside `AddChildService.buildNode` and surfaces back through the inline error path).

**What's testable today** (snapshot at landing):

- `npm test` — **420 unit tests** across 40 files (~7 s).
- `npm run lint` (`tsc --noEmit`) clean.
- `npm run lint:rules` (ESLint layered rules) clean.
- `npm run build` produces an 81.14 KB / 22.09 KB gzip bundle (was 64.72 / 18.41 in §17.11) + 0.75 KB on-demand `testBridge` chunk; 66 modules transformed (was 64). The increase is the modal element + its CSS + the wiring slice; still well within budget for a kiosk-class single-page app.
- `npm run dev` / `npm run preview` — kiosk renders the focus tree; tapping the `+` tile opens the modal; picking Text or BSC and confirming appends a new child to the focused parent and persists to `localStorage`; cancel/Esc/backdrop-tap all dismiss without persisting.
- `npm run test:e2e` runs **45 Playwright BDD scenarios** under headless Chromium (boot ×2 + view ×12 + layout ×9 + shell ×10 + modal ×12). All green.

**What's deferred beyond DT-7**:

- Phase 9 (DT-?) — CSS animations + a11y polish (`animations/drillTransitions.test.ts` per §12.5; the kiosk currently relies on default styling without the `encap--drill` transition).
- Phase 10 (DT-8 + persistence/routing wiring) — `burger-menu-action` real consumers (Import / Export / Boards), the `routing/*.feature` set (deep-link / focus-to-url / unknown-uuid-fallback), and the `persistence/*.feature` set (`load_save`, `import_export`, `board_collection`).
- The pixel-perfect breadcrumb truncation refinement carried over from §17.11.

### 17.13 Phase 8 (DT-7) refinement — Named placeholders + mandatory seed `TimestampedValue`

A user-driven follow-up landed on top of §17.12, refining two adjacent concerns surfaced during the first end-to-end demo:

1. **Empty-field placeholders should self-identify the field.** SPEC §6 originally said placeholders "doubl[e] as an example mock value … e.g. `e.g. "North-region revenue"`". Once the modal had ~9 fields stacked vertically, an `e.g.` example without a leading field name was hard to scan: which input am I looking at? Refined contract — every placeholder now reads **`<Field name> — e.g. <mock>`** (em-dash separator, U+2014). The regex pinned by both unit + e2e tests is `^[A-Z].* — e\.g\.`. SPEC §6 is updated in place; the original "doubles as example" intent is preserved (the `e.g.` half still carries a concrete mock value), and the new field-name half makes the form self-explanatory when read in isolation. Examples now in the modal: `Title — e.g. "North-region revenue"`, `Description — e.g. Quarterly revenue …`, `Weight — e.g. 1`, `Unit — e.g. "%" or "M€"`, `Current value — e.g. 42`, `As of — e.g. 2026-04-30 (today)`, `Objective initial value — e.g. 0`, `Objective target value — e.g. 100`, `Objective target date — e.g. 2026-12-31`.

2. **A fresh `BusinessScoreCardNode` must boot with at least one `TimestampedValue` in its history.** SPEC §3 already said the value displayed/used for parent computation is the **most recent** `TimestampedValue` (see `BusinessScoreCardNode.currentValue()` — `EmptyHistoryError` otherwise). The modal in §17.12 collected only the objective trajectory (`initialValue` / `targetValue` / `targetDate`), leaving `card.history()` empty — so the very first call to `currentValue()` on a freshly created BSC threw at view time. Refined contract — the BSC form now requires a **mandatory `Current value`** (the seed measurement) and a **`As of` date** (defaulted to today's local-calendar ISO `YYYY-MM-DD`, kept editable so the operator can back-fill a past observation when on-boarding a metric). The Confirm button stays disabled until both halves are filled. The payload shape (`AddChildPayload.initialHistory: readonly { value, asOf }[]`) was already in place in §17.3, so no domain or service changes — only the modal populates a one-element `initialHistory` from the form, and `AddChildService.buildNode` maps it through `TimestampedValue.of(...)` into `BusinessScoreCard.of(unit, objective, initialHistory)` exactly as it did for imported boards.

**Files modified**:

- `src/adapters/ui/modal/AddChildModal.ts` — every placeholder rewritten to the `<Field name> — e.g. <mock>` shape; new `@state` fields `currentValue` (number-as-string) + `currentValueDate` (ISO date string); new private template `renderCurrentValueFields()` rendering the two inputs in a `field-row` between unit and objective; `buildPayload` now requires the seed pair and emits `initialHistory: [{ value, asOf }]`; `bindString` widened to accept the two new field names; `resetForm` re-applies the today-default each time the modal opens (no leak from a prior unconfirmed session); new private static `todayIsoDate()` helper that formats a kiosk-local-calendar date as `YYYY-MM-DD` (no clock port — the modal stays a pure presentational element with no domain dependencies, the seam is the editable input itself).
- `src/test/unit/adapters/ui/modal/AddChildModal.test.ts` — updated the 6th test (BSC field reveal) to assert the two new fields; new test "BSC 'as of' date defaults to today's local-calendar ISO date"; new test "BSC 'as of' default is re-applied each time the modal re-opens (no leak)"; updated the BSC Confirm-disabled test to require the seed before Confirm enables and to flip back to disabled when the as-of date is cleared; updated the BSC Confirm payload test to assert `initialHistory.length === 1` with the parsed `value` (number) + `asOf` (`Date`); updated both placeholder-pattern tests' regex from `^e\.g\.` to `^[A-Z].* — e\.g\.`. Total unit tests now **425** across **40** files (was 420).
- `src/test/e2e/steps/modalSteps.ts` — renamed the placeholder step to `every modal text input has a placeholder of the form "<Field name> — e.g. <mock>"`, updated its regex; added two new steps `the modal has a current-value field` (asserts both inputs are present) and `the as-of date defaults to today (local-calendar ISO)` (asserts the value).
- `src/test/e2e/features/modal/empty_field_placeholders.feature` — preamble + step text updated to the new format; both placeholder scenarios re-titled.
- `src/test/e2e/features/modal/add_child_modal.feature` — the BSC-field-reveal scenario extended with the two new assertions.

**Decisions taken during this refinement**:

- **`As of` defaults to today, kept editable.** The kiosk's most common case is "we measured this just now"; making the field editable preserves the back-fill use case (on-boarding a metric whose first observation is from last quarter). The default is computed from `new Date()` (local calendar) inside `resetForm()` rather than from a clock port — see the rationale below.
- **No clock port for the today-default.** `<add-child-modal>` is a pure presentational element with no domain dependencies (it doesn't import from `src/{domain,application}/**`); introducing a clock port just for the today-default would buy negligible test value (the input is editable, so any test that wants a deterministic `asOf` simply sets the value directly via `setInput(..., "field-current-value-date", "2026-04-30")` — exactly what the unit test for the BSC payload does). The two unit tests that *do* assert the default (`.value === today`) compare against the same `new Date()` formatting they exercise, which is stable across the millisecond range that a single test run takes.
- **Seed lives in `initialHistory`, not in the objective.** The objective's `initialValue` is the *starting point of the goal trajectory* (where we agreed to *start tracking from* — a planned anchor, often the same as the first observation but not necessarily); the history's first entry is the *first measurement* (an observed reality, time-stamped). Conceptually distinct, even when numerically equal at creation time. The modal exposes both as separate fields so the operator can record divergence on day one (e.g. a metric whose objective was set in January with `initialValue=0` but whose first measurement on March 1st was 12).
- **Confirm-disabled gating is plain JS, not HTML5 `required`.** The new fields carry `required` for screen-reader semantics + browser validation popovers, but the Confirm button's disabled state is computed by `canConfirm()` (which calls `buildPayload()`) — same pattern as the rest of the form, and it lets the test assert both halves of the gating in `vitest` without involving DOM-level `:invalid` selectors.
- **`currentValue` is parsed once in `buildPayload` (no debounced parsing).** The `Number(this.currentValue)` call is cheap and runs on every keystroke (since `canConfirm()` triggers a re-render via Lit's reactive properties); the only edge case is the empty string (`Number("") === 0`), which is filtered out by an explicit `currentValueRaw === ""` check before the `Number.isNaN` check. Documented inline so the next contributor doesn't try to "tidy up" the redundant-looking guards.
- **Em-dash (U+2014), not hyphen-minus, in the placeholder separator.** The em-dash visually anchors the `e.g.` clause as a parenthetical aside, while a hyphen-minus reads as either a list item or a numeric-range separator. Encoded as a literal character in both source and tests (the file is UTF-8); the regex matches the same literal character.
- **SPEC §6 update is allowed (§6 is not in the locked list).** §13.1, §13.2, §13.3, §14, §15, §16 are explicitly locked; §6 is a UX rule and was always meant to evolve as the modal matured. The original "placeholder doubles as example mock value" intent is preserved — the refinement only adds the leading field-name half.

**What's testable today** (snapshot at landing):

- `npm test` — **425 unit tests** across 40 files (~8 s).
- `npm run lint` (`tsc --noEmit`) clean.
- `npm run lint:rules` (ESLint layered rules) clean.
- `npm run build` — bundle size unchanged within rounding (still ~81 KB / ~22 KB gzip — the refinement is two extra inputs + tighter validation, no new dependencies).
- `npm run dev` / `npm run preview` — opening the modal on a BSC now requires the operator to enter a current value + (today-defaulted) date before Confirm enables; the new BSC node's first `currentValue()` returns the entered seed instead of throwing `EmptyHistoryError`.
- `npm run test:e2e` — **45 Playwright BDD scenarios** still all green (no new scenarios; two existing ones extended with the new assertions).

### 17.14 Phase 8 (DT-7) refinement #2 — TextNode gets a history + unified per-tile layout

A second user-driven refinement landed on top of §17.13, addressing four adjacent observations from the demo:

1. **`TextNode` should have a `TimestampedValue<string>[]` history too.** SPEC §3 originally modelled `TextNode` as identity-only (no value, no history) and `BusinessScoreCardNode<T>` as the only node carrying a `Historizable<T>` history. From the demo the user observed that *every* node, text-typed or not, has a "what is its current value" question — for a text node it's the latest string the operator wrote (a meeting note, a status headline, a sticky-tag label). The model now mirrors BSC: a new `TextCard` aggregate (parallel to `BusinessScoreCard`) owns a `TimestampedValue<string>[]`, sorted ascending by date, with the latest entry being the "current value". `TextNode` extends `TreeNode<string>` and implements `Historizable<string>`. **Still excluded from parent computation** at the type level — `TextNode` does not implement `ContributesToParent` or `HasObjective`, exactly as before. The compile-time assertion test for those exclusions is preserved; the assertion against `Historizable` flips to a positive check (`Historizable<string>` IS satisfied).
2. **Every node's current-value timestamp is shown in the top-right corner of the tile.** Previously only BSC `recordedValue` rendered an inline date next to the value; computed BSC and TextNode rendered no timestamp. The user wants a single, predictable place — the tile's top-right corner — for the `asOf` of whatever value is currently displayed. Branches that have no single representative date (BSC `computedMean` aggregating multiple eligible children; BSC `childrenCount`; empty-history nodes) intentionally still omit the timestamp — implying one entry's date applies to a derived aggregate would be misleading.
3. **Title height is fixed at 3 % of the viewport, consistent across all tiles.** The user wants tile titles to read at the same size whether the tile is a 200×200 px corner pill or a 1500×800 px hero — so the title font-size is `vh`-relative, not `cqmin`-relative. The "3 %" is a `3vh` row with a `2vh` font for the children-grid tiles; the parent strip's title is allowed to scale up slightly (to `2.4vh`) to emphasise focus context, since the strip is conceptually a strip not a tile.
4. **The value should occupy the most space possible inside the tile.** For `TextNode` that's the latest string from the history, full-bleed across the tile body; for BSC's numeric branches that's the number plus its `Unit`, with the unit deliberately rendered at **1/3 of the value's font-size** (`calc(1em / 3)` on a nested `<span class="unit">`, so the ratio is exact regardless of where the `cqmin`-driven value font-size lands). The value's font-size itself is `clamp(1.1rem, 18cqmin, 12rem)` — container-query-minimum so it scales with the *tile* (not the viewport), with a small-tile floor that keeps numbers legible and a large-tile ceiling that prevents typographic blow-out.

**Files modified**:

- `src/domain/nodes/TextCard.ts` (new) — minimal `Historizable<string>` aggregate parallel to `BusinessScoreCard`. Internal sorted array + `addRecorded` + frozen `history()`.
- `src/domain/nodes/EmptyHistoryError.ts` (new) — lifted from `BusinessScoreCardNode.ts`; both kinds now share it. The old import path is preserved via a re-export from `BusinessScoreCardNode.ts` so existing call sites (incl. `computedValue.test.ts`) keep working.
- `src/domain/nodes/TextNode.ts` — refactored to `extends TreeNode<string> implements Historizable<string>`; constructor now takes a `card: TextCard` (required); `currentValue()` returns the latest entry or throws `EmptyHistoryError`. The old `NotValuedError` is gone — text nodes now have values.
- `src/domain/nodes/BusinessScoreCardNode.ts` — `EmptyHistoryError` re-exported from the new shared module.
- `src/test/unit/domain/nodes/TextNode.test.ts` (rewritten) + `src/test/unit/domain/nodes/TextCard.test.ts` (new) — the first asserts `currentValue()` returns the latest entry, throws `EmptyHistoryError` on empty history, IS structurally assignable to `Historizable<string>` (was `@ts-expect-error` before), still NOT assignable to `ContributesToParent` / `HasObjective`. The second mirrors the existing `BusinessScoreCard.test.ts` behaviours (sorted insert, frozen `history()`, etc.).
- `src/adapters/persistence/jsonCodec.ts` — `WireTextNode` gains an optional `historizedValues: { value: string, date: string }[]`. Decode tolerates absence (decoded as an empty `TextCard`, for backward compat with pre-§17.14 wire payloads); encode always emits the field. New `decodeTextTimestampedValue` helper mirrors the existing numeric decoder; pointer-based `JsonDecodeError` for malformed dates is preserved.
- `src/adapters/persistence/LocalStorageBoardCollectionRepository.ts` + `src/adapters/sampleData.ts` — both root TextNodes seed a `TimestampedValue<string>` so the kiosk renders cleanly out of the box and demo data exercises the history.
- `src/application/AddChildService.ts` — `AddChildPayload.TextNode` gains an optional `initialHistory: readonly { value, asOf }[]`; `buildNode` for TextNode wraps it through `TextCard.of([...])`. Optional in the type so unit tests that don't exercise rendering can still construct TextNode payloads with just `{ kind, title }`; the modal surfaces it as a *mandatory* field.
- `src/adapters/ui/modal/AddChildModal.ts` — the BSC current-value renderer is renamed `renderBscCurrentValueFields()`; a new `renderTextCurrentValueFields()` adds a `textarea` (`field-current-value`) + a date input (`field-current-value-date`) to the Text form. `buildPayload` for TextNode now requires both halves to be filled and emits `initialHistory: [{ value, asOf }]`. The "as of" default-to-today and reset-on-reopen behaviours from §17.13 are reused unchanged.
- `src/adapters/ui/views/NodeViewModel.ts` — `TextNodeViewModel` gains a `value: { text: string; dateIso: string }` field. Empty strings on both halves are the explicit "no current value" signal so the view can degrade gracefully without optional types.
- `src/adapters/ui/views/viewModelMapper.ts` — TextNode mapping pulls `node.card.history().at(-1)` and falls back to empty strings when the history is empty (rather than throwing `EmptyHistoryError` from a refresh-time mapper, which would crash the whole composition root over a single empty leaf).
- `src/adapters/ui/views/tileLayoutStyles.ts` (new) — the shared `css\`\`` chunk that pins the four invariants: `:host` is a `container-type: size` positioned context; `.title { height: 3vh; font-size: 2vh; }`; `.timestamp { position: absolute; top: 0.4rem; right: 0.6rem; font-size: 1.4vh; }`; `.value-area { flex-fill below the title }` + `.value { font-size: clamp(1.1rem, 18cqmin, 12rem); }`; `.value .unit { font-size: calc(1em / 3); }`. All four per-(kind × role) elements concat this chunk into their own `static styles` and override only the `.title` weight (and a slightly larger `2.4vh` for the parent-strip variants).
- `src/adapters/ui/views/{TextNode,BusinessScoreCardNode}/{*}AsParent.ts` + `{*}AsChild.ts` (4 files) — fully rewritten templates: title row + optional `<time class="timestamp">` (rendered via shared `timestampForValue()` for BSC; rendered iff `value.dateIso !== ""` for Text) + `.value-area` containing the per-kind value content. Description elements deleted from the templates.
- `src/adapters/ui/views/BusinessScoreCardNode/valueTemplate.ts` — the value branches now nest `<span class="unit">&nbsp;${unit}</span>` inside the value span (so the 1/3-size CSS rule in `tileLayoutStyles` resolves correctly via `1em`); the inline `<time>` for `recordedValue` is removed (the date is now rendered by the per-role element in the corner). New `timestampForValue(vm)` + `formatDate(iso)` helpers exported for the per-role elements.
- View element tests + the four shell test fixtures (`TreeGraphScreen`, `ParentIdentityStrip`, `ChildrenGrid`, `NodeView`) — every TextNode VM literal gains the new `value: { text, dateIso }` field; assertions flipped from "no value" / "has description" to "has value" / "no description" for TextNode; 1/3 unit ratio asserted at the markup level (`<span class="unit">` is present + has the right text content) since jsdom doesn't fully resolve shadow-scoped CSS for `getComputedStyle`-based ratios — the visual ratio is asserted in the new e2e `tile_layout.feature`.
- `src/test/e2e/fixtures/trees/textTree.json` — TXT-ROOT and TXT-A get one-entry `historizedValues`; TXT-B keeps an empty history to exercise the graceful-degradation path. `src/test/e2e/features/views/text_node_views.feature` rewritten for the new layout (3 scenarios: asParent renders value + corner date, asChild same, empty-history TextNode renders empty value-area + no date). `src/test/e2e/features/views/tile_layout.feature` (new, 3 scenarios) covers the §17.14 invariants in a real browser: same-font-size titles across child tiles, unit font-size = 1/3 of value font-size, timestamp bounding box sits in the top-right quadrant of the tile.
- `src/test/e2e/features/modal/add_child_modal.feature` — the "Picking Text reveals only the text fields" scenario re-titled to include the current-value/as-of assertions; the three Confirm-Text scenarios extended with `And I fill in the current value with "..."` (the as-of date defaults to today, so no extra step needed). `src/test/e2e/steps/modalSteps.ts` gets one new step `I fill in the current value with {string}`. `src/test/e2e/steps/viewSteps.ts` gets four new steps for the layout invariants + a "the focused tile has no description block" assertion.

**Decisions taken during this refinement**:

- **`TextNode` keeps `Description` on `NodeIdentity`.** The user's request said "the text" should be the displayed value (a string), implying description-as-displayed-content is gone. But `Description` is still useful as *metadata* on a node (a one-line caption an operator might fill in once and rarely change), and removing it from the domain would cascade through `NodeIdentity`, the JSON wire format, every fixture, and every test that asserts identity equality. The pragmatic call: **keep `Description` on `NodeIdentity` for both kinds; just stop rendering it in the per-tile layout.** The field stays available for a future detail view / drawer panel if/when the user asks.
- **TextNode current-value input is a `textarea`, not a single-line `<input type="text">`.** Operators write meeting notes / status headlines / sticky-tag labels in this field; allowing multi-line input from the start avoids a "but I needed two lines!" follow-up. The textarea respects the same `<Field name> — e.g. <mock>` placeholder rule from §17.13.
- **Computed BSC values intentionally omit the corner timestamp.** A weighted mean over multiple `TimestampedValue<T>` entries doesn't have a single representative date — picking the most recent `asOf` of any contributing child would be visually plausible but semantically wrong (the displayed mean's "as of" answer is "the moment this view rendered"). Same reasoning for `childrenCount` (`<n> children` is a structural count, not a measurement). The corner is therefore left empty for those branches.
- **Title size is `vh`-relative; value size is `cqmin`-relative.** Two different scaling axes by design: the title encodes context (which node am I looking at?), so it should be visually identical across tiles regardless of tile size — `vh` honours that. The value encodes the metric itself (how big is the number?), so it should fill its tile — `cqmin` honours that. The user's "consistent across tiles" requirement applies to titles; the user's "occupy the most space possible" applies to values.
- **Empty-history `TextNode` renders a visible empty value-area, not a hidden one.** The `data-testid="value"` element is always emitted (with `class="value empty"` when the text is `""`) so e2e + unit tests can assert presence + emptiness symmetrically — the same pattern §17.9 used for BSC `childrenCount` n=0. The corner timestamp, however, is omitted entirely (no `<time>` element rendered when `dateIso === ""`), since "an empty date" has no meaningful semantic.
- **Backward compat on the JSON wire shape.** Pre-§17.14 wire payloads (no `historizedValues` on TextNode entries) decode to an empty `TextCard` instead of erroring out — boards already in `localStorage` survive the upgrade without a migration. Encode always emits the field, even when empty, so a round-trip after a save doesn't drop information.
- **AddChildPayload.TextNode.initialHistory is optional in the type, mandatory in the modal.** Application-level unit tests that don't exercise rendering construct TextNode payloads with just `{ kind, title }`; making `initialHistory` required at the type level would cascade through every such test for no behavioural gain. The modal — the single user-facing entry point — gates Confirm on the seed pair being filled (mirroring §17.13's BSC contract); the service layer accepts whatever the payload carries and falls back to an empty card if absent (the same graceful path the JSON codec uses for legacy data).
- **CSS comments must not contain backticks.** The four view elements + `tileLayoutStyles` use Lit's `` css`...` `` tagged templates; backticks inside the CSS body terminate the template literal. The "obvious-once-you-hit-it" gotcha bit on the first build of this refinement (the templates failed to parse). Fixed by writing CSS-comment code references in *bare* form (e.g. `cqmin scales with…` rather than `` `cqmin` scales with… ``) — pinned with a one-line note in `tileLayoutStyles.ts`.

**What's testable today** (snapshot at landing):

- `npm test` — **438 unit tests** across **41 files** (~7 s). Net +13: the new `TextCard.test.ts` (+5), updated `TextNode.test.ts` (+2 around `Historizable` IS / `currentValue` returns), updated `viewModelMapper.test.ts` (+1 graceful-empty), updated `jsonCodec.test.ts` (+3 for the TextNode wire shape), updated `AddChildModal.test.ts` (+2 for the Text-form gating + today default).
- `npm run lint` (`tsc --noEmit`) clean.
- `npm run lint:rules` (ESLint layered rules) clean.
- `npm run build` — bundle size grew slightly to accommodate the new `TextCard` aggregate + `tileLayoutStyles` + the rewritten templates (~85 KB / ~23 KB gzip).
- `npm run dev` / `npm run preview` — the kiosk now renders titles at a consistent `vh`-relative size across the children grid; per-tile values fill the tile via `cqmin`; the BSC unit is exactly 1/3 of the number's font-size; the latest TimestampedValue's date is in the top-right corner. Adding a new TextNode through the modal now requires entering a current text + (today-defaulted) date.
- `npm run test:e2e` — **49 Playwright BDD scenarios** all green. Net +4: new `views/tile_layout.feature` (×3) covering the layout invariants in a real browser; `views/text_node_views.feature` rewritten (still 3 scenarios but for the new layout, including an "empty-history TextNode" path the §17.9 version couldn't express).

### 17.15 Phase 8 (DT-7) refinement #3 — TextNode drops description (the current value IS the description)

**Trigger** — user request: "The description of a TextCard IS the current value, no need to display/edit a description field for this kind of card."

**One-line summary** — for `TextNode` the latest `TimestampedValue<string>.value` IS the node's description, so the modal stops collecting a separate description, the view-model stops carrying one, and the application payload stops accepting one. `BusinessScoreCardNode` keeps its description (the metric's *definition* — "Quarterly revenue across the EU-North region; sourced from the BI data warehouse." — is still distinct from the latest measured value).

**Files modified**:

- `src/adapters/ui/modal/AddChildModal.ts` — the description `<textarea>` is hoisted into a new `renderDescriptionField()` helper, which the BSC branch calls and the TextNode branch skips. The TextNode kind-blurb on Step 1 is rephrased ("A note: a free-form text value (latest in its timestamped history); no Σ.") to match the field set actually shown on Step 2. `buildPayload` no longer threads `description` into the TextNode payload variant. Module-level JSDoc + the BSC branch's inline notes call out the §17.15 split.
- `src/application/AddChildService.ts` — `AddChildPayload` TextNode variant: **the `description?` key is removed**. `buildNode` constructs the BSC's `NodeIdentity` with `Description.of(payload.description ?? "")` as before, and the TextNode's `NodeIdentity` with `Description.of("")` unconditionally — pinned by a "§17.15 — current value IS the description" comment.
- `src/adapters/ui/views/NodeViewModel.ts` — `TextNodeViewModel.description` is removed. The TSDoc explains why: rendering it would tempt a future view to print the same string twice (description + value). Domain `NodeIdentity.description` stays — the codec wire format is unchanged for backward compat — but it never crosses the VM boundary for `TextNode`.
- `src/adapters/ui/views/viewModelMapper.ts` — `mapNodeToViewModel(TextNode)` no longer copies `node.identity.description.value`; the resulting VM has just `{ kind, id, title, value }`.
- Tests updated (net +1):
  - `src/test/unit/adapters/ui/modal/AddChildModal.test.ts` — the existing TextNode-form test gains an explicit `'[data-testid="field-description"]'` null-assertion; the Confirm-fires-payload test drops the `field-description` fill + `expect(p.description)` assertion and instead asserts `expect(p).not.toHaveProperty("description")`. **+1 new test** ("BSC form keeps the description field (§17.15 — only TextNode drops it)") pins the asymmetry.
  - `src/test/unit/application/AddChildService.test.ts` — the TextNode happy-path test no longer passes `description` in the payload; the assertion now reads "always-empty description (§17.15)".
  - All TextNode VM fixtures across the unit test tree (`shell/{ChildrenGrid,ParentIdentityStrip,TreeGraphScreen}.test.ts`, `views/NodeView.test.ts`, `views/TextNode/*.test.ts`, `views/viewModelMapper.test.ts`) drop the `description: "..."` field. The mapper test gains an `expect(vm).not.toHaveProperty("description")` invariant on the TextNode branch.
- `src/test/e2e/features/modal/add_child_modal.feature` — the Text-branch scenario flips `And the modal has a description field` → `And the modal has no description field`; the BSC scenario *adds* `And the modal has a description field` (the field still exists there, just wasn't asserted before).
- `src/test/e2e/steps/modalSteps.ts` — new `Then("the modal has no description field", ...)` step (mirror of the existing positive one).
- `docs/SPEC.md` — §3 (TextNode bullet), §5 (Field-content rules already implicit; §17.15 cross-ref added in §3 instead since §5 is layout-focused), §7 (Text-form bullet), §17.0 status table (new "refinement #3" row), and this section.

**Decisions taken during this refinement**:

- **Domain `NodeIdentity` keeps its `description` slot for both kinds.** Removing the field from the value object would cascade through every fixture, every `NodeIdentity.equals` assertion, the JSON wire format, and every existing board in `localStorage`. The pragmatic call: **leave the slot, force it to `Description.of("")` for `TextNode` at the only construction site (`AddChildService.buildNode`), and stop exposing it past the VM boundary.** Importing a pre-§17.15 board with a non-empty description on a TextNode is still *valid* — the field just doesn't render.
- **Drop `description` from `TextNodeViewModel` rather than always set it to `""`.** Either approach prevents the description from rendering, but a missing field is a stronger contract: a future view that tried to render `vm.description` would fail to type-check rather than silently render an empty string. The absence makes "the current value IS the description" a property of the type system, not of a runtime convention.
- **`AddChildPayload.TextNode` drops `description?` outright.** Same reasoning at the application boundary: a future caller can't accidentally smuggle a description in. Tests that previously passed `description: "..."` on TextNode payloads are simplified, not just stripped — they were testing a path the type system now refuses.
- **BSC keeps its description field** — the user's request was specifically about TextNode, and BSC nodes carry a meaningful description (the metric's definition / data source / notes about how it's measured) that is genuinely distinct from any single recorded value. The added test (`"BSC form keeps the description field (§17.15 — only TextNode drops it)"`) pins the asymmetry so a future "let's make the modal more uniform" refactor doesn't quietly delete the BSC description input.
- **JSON codec wire shape unchanged.** `WireTextNode.description` stays a required string (still emitted as `""` for new TextNodes; tolerated as a non-empty legacy value on decode). Reasoning matches the §17.14 note on `historizedValues`: backward compatibility with already-saved boards trumps a clean-slate wire format. A future migration can drop the field once we have a versioning story; today's gain isn't worth the migration cost.
- **The new "no description field" e2e step is a separate `Then`, not a parameterised one.** Playwright-BDD parses step strings literally; mixing positive ("has") and negative ("has no") under one parameterised step would produce ambiguous matches with the field-by-name steps already in §17.13's vocabulary. Keeping them as two distinct sentences mirrors the existing `has/has no unit field`, `has/has no objective fields` pairs.

**What's testable today** (snapshot at landing):

- `npm test` — **439 unit tests** across **41 files** (~7 s). Net +1: the new BSC-keeps-description test in `AddChildModal.test.ts`. Eight other test files lost a `description: "..."` line each, with no test-count change in those files.
- `npm run lint` (`tsc --noEmit`) clean — confirms the API-narrowing actually bites: `TextNodeViewModel.description` no longer exists at the type level, and `AddChildPayload.TextNode` rejects a `description` key.
- `npm run lint:rules` (ESLint layered rules) clean.
- `npm run build` — unchanged size (~85 KB / ~23 KB gzip); we removed code (one textarea per render + one VM field) without adding any.
- `npm run test:e2e` — **49 Playwright BDD scenarios** all green (count unchanged; the existing `add_child_modal` Text scenario was edited in place, and the BSC scenario gained a positive `description` assertion).
- `npm run dev` / `npm run preview` — the Add-child modal's Text form now shows just title + weight + current-value (textarea + as-of date defaulted to today); the BSC form is unchanged.

### 17.16 Phase 8 (DT-7) refinement #4 — weight default `1` + BSC current-value row alignment

**Trigger** — user request: "Default value for weight is 1 in the form. For the form of the BusinessScoreCard, the current value, unit and date should be aligned on the same line."

**One-line summary** — two small kiosk-UX tweaks: (1) `weight` is pre-filled with `1` on both Text and BSC forms (matching the placeholder example AND the service fallback); (2) the BSC current-value row now lays out `current-value`, `unit`, and `as-of date` on a single `field-row` — cognitively a unit (the seed observation).

**Files modified**:

- `src/adapters/ui/modal/AddChildModal.ts` — `resetForm()` initialises `this.weight = "1"` instead of `""` (still editable; the operator can override). The `renderUnitField()` helper is removed and the `<input data-testid="field-unit">` is inlined into `renderBscCurrentValueFields()` between `field-current-value` and `field-current-value-date`. The weight `field-row` gets a `data-testid="weight-row"` and the current-value `field-row` gets a `data-testid="current-value-row"` so unit tests can assert layout (the row a field is in, not just its presence). Module-level JSDoc + the inline notes call out the §17.16 split.
- `src/test/unit/adapters/ui/modal/AddChildModal.test.ts` — **+3 new tests**:
  - `"weight field is pre-filled with `1` on both Text and BSC forms (§17.16)"` — picks each kind in turn, reads `field-weight.value`, asserts `"1"`.
  - `"weight default is re-applied each time the modal re-opens (no leak)"` — types `"7"`, closes, reopens, asserts `"1"` again. Locks the same "no leak" property §17.13's `as-of` field test pinned for the date.
  - `"BSC current-value row aligns current-value, unit, and as-of date on one line (§17.16)"` — reads the children of `[data-testid="current-value-row"]`, asserts the three `data-testid`s are exactly `["field-current-value", "field-unit", "field-current-value-date"]` in that order, and that `[data-testid="weight-row"]` no longer contains a `field-unit`.
  - The existing `"clicking Confirm fires `add-child-confirm` with a BusinessScoreCard payload"` test gains a single assertion `expect(p.weight).toBe(1)` (the operator did not touch the weight field; the default flows end-to-end).
- `docs/SPEC.md` — §7 (Add-child modal) gains two bullets (weight pre-fill + BSC row layout); §17.0 status table gains a "refinement #4" row; new §17.16 captures the trigger, files modified, decisions, and snapshot counts. Resume protocol bumped to **442 tests / 41 files**.

**Decisions taken during this refinement**:

- **`weight` defaults to `"1"`, not `"1.0"` or `1` (number).** The state field is a `string` (it mirrors `<input type="number">.value`, which is always a string). Using `"1"` matches the placeholder example (`Weight — e.g. 1`) literally; using `"1.0"` would render as `1` in the input anyway (browsers normalise integer numeric values) but would feel inconsistent with the placeholder text. Using a numeric `1` would force a state-type change for zero behavioural gain.
- **The default is re-applied on every modal *open*, not just on first construction.** `resetForm()` already runs in `willUpdate(open ↑)`; the new line piggybacks on that. This is the same path that re-defaults the as-of date to today (§17.13). Pinned by the new "no leak" test: an operator who types `7`, cancels, then re-opens the modal sees `1` again, not `7`.
- **Operator can still clear the weight.** A field cleared to `""` in the form sends `weight: undefined` in the payload (the existing branch in `buildPayload`), which the service maps to its own default of `1` via `payload.weight ?? 1`. Functionally identical to leaving the pre-filled `1`; the difference is purely UX (the empty-then-fallback path was the only one before, now the default is *visible*).
- **Unit moves to the current-value row, not to a row of its own.** The user's request is explicit: "current value, unit and date should be aligned on the same line." The unit field used to share the weight row purely as a layout convenience (two short fields side-by-side); semantically the unit *qualifies the current value* (and every other recorded value the metric will ever carry), so its natural neighbours are the value and its date. The weight row is now unit-less and stretches to fit just the weight input — visually a touch wider than before, but unambiguous.
- **Why `data-testid` markers on the rows.** The existing test suite uses `[data-testid="field-X"]` to query individual inputs; asserting "field X is in the same row as field Y" without a row-level marker would require sibling-walking the parent of the input, which is brittle (a future refactor that wraps inputs in another `<div>` would break the test for the wrong reason). Adding `data-testid="weight-row"` + `data-testid="current-value-row"` keeps the assertion intent (`querySelectorAll` inside the row) decoupled from intermediate markup.
- **No e2e changes.** The user-visible behaviour is fully covered by the unit tests (which exercise the rendered shadow DOM directly). The existing `add_child_modal.feature` BSC scenario still passes — it queries fields by `data-testid` regardless of which row they live in. Adding an e2e scenario for "rows align on one line" would require Playwright bounding-box geometry (already known-flaky in jsdom-shadow-root tests, see §17.14 layout-feature notes) for no extra confidence — the unit test already pins both the order and the row membership.

**What's testable today** (snapshot at landing):

- `npm test` — **442 unit tests** across **41 files** (~7 s). Net +3: the three new `<add-child-modal>` tests above. The existing BSC payload test gained one inline `expect(p.weight).toBe(1)` assertion (no test-count change).
- `npm run lint` (`tsc --noEmit`) clean.
- `npm run lint:rules` (ESLint layered rules) clean.
- `npm run build` — bundle size effectively unchanged (~85 KB / ~23 KB gzip); we removed `renderUnitField()` and added `data-testid` attributes — net wash.
- `npm run test:e2e` — **49 Playwright BDD scenarios** all green (count unchanged; existing scenarios are layout-agnostic in their queries).
- `npm run dev` / `npm run preview` — opening the modal now shows `1` pre-filled in the weight field; picking BusinessScoreCard lays out the three seed-observation fields (`Current value`, `Unit`, `As of`) on a single horizontal row.

### 17.17 Phase 8 (DT-7) refinement #5 — biggest-possible figure + distinguishable tiles

**Trigger** — user request: "The figure into the tile should be bigger, the biggest possible. The children tiles should be distinguishable the one from the other, either use a border or a background color and margin with different background. Keep the visibility/accessibility/usability in mind."

**One-line summary** — two visual contracts on the children grid: (1) the value font-size coefficient is bumped from `18cqmin` → `36cqmin` so the figure is roughly 2× larger and dominates the tile (still clamped so a 4-digit number fits a square tile's width); (2) every node tile gets a subtle `currentColor`-mixed background tint, a 1 px solid border, and an 8 px border-radius so adjacent tiles are visibly separated.

**Files modified**:

- `src/adapters/ui/views/tileLayoutStyles.ts` — `.value { font-size: clamp(1.5rem, 36cqmin, 20rem); }` (was `clamp(1.1rem, 18cqmin, 12rem)`). Module-level JSDoc + the inline note explain the new coefficient and the chosen clamp range.
- `src/adapters/ui/shell/ChildrenGrid.ts` — `<children-grid>`'s `static styles` gain a `.tile[data-slot="node"]` rule with `background: color-mix(in srgb, currentColor 7%, transparent); border: 1px solid color-mix(in srgb, currentColor 28%, transparent); border-radius: 8px; overflow: hidden;`. The `[data-slot="node"]` selector is deliberate: it scopes the new look to actual node tiles and leaves the plus tile's wrapper untouched (the plus tile's dashed border lives on its inner `<button class="tile">`).
- Tests:
  - `src/test/unit/adapters/ui/shell/ChildrenGrid.test.ts` — **+2 unit tests**: "node tiles get a distinguishable look (bg tint + 1 px border + radius)" pins the rule at the source (jsdom can't compute styles from `<style>` rules; the test reads `ChildrenGrid.styles.cssText` directly); "renders one tile per slot with the correct data-slot" pins the selector hook (`data-slot="node"` on every node wrapper, `data-slot="plus"` on every plus wrapper).
  - `src/test/e2e/features/views/tile_layout.feature` — **+2 e2e scenarios**: "the figure is substantially bigger than the title on every child tile" (asserts `value font-size ≥ 3 × title font-size` on every `<children-grid>` tile — a behavioural lower bound that captures the §17.17 bump without hard-coding a pixel size that depends on the viewport); "child tiles are visually distinguishable from each other" (asserts every `[data-slot="node"]` wrapper has a `borderTopWidth ≥ 1px` and a `backgroundColor` that's neither `rgba(0, 0, 0, 0)`, `transparent`, nor empty, with a strict `0 < alpha < 1` parse so a future "make it solid" regression is caught).
  - `src/test/e2e/steps/viewSteps.ts` — three new `Then` steps backing the scenarios above.
- `docs/SPEC.md` — §5 "Layout invariants (§17.14)" extended with the new `36cqmin` coefficient + the `[data-slot="node"]` distinction rule; §17.0 status table gains a "refinement #5" row; new §17.17 (this section). Resume protocol bumped to **444 tests / 41 files** + **51 e2e scenarios**.

**Decisions taken during this refinement**:

- **`36cqmin`, not a more aggressive `40+cqmin`.** The clamp coefficient determines the value's font-size as a fraction of the smaller tile dimension (`min(width, height)`). A 4-digit number takes ~`0.6em × N` of horizontal space at our typeface; for a square tile, `font-size × 0.6 × 4 ≤ tile_width` ⇒ `36cqmin × 0.6 × 4 = 0.864 × cqmin ≤ tile_width = cqmin` (square case). 36cqmin is the largest round value that still leaves a comfortable 14% horizontal margin on a 4-digit numeric value on a square tile. Higher coefficients (40, 45) would clip "1234"-class values; lower ones would leave the figure feeling small. Pinned by the e2e "≥ 3× title" scenario, which fails fast if a future tweak under-shoots.
- **Floor `1.5rem` (≈ 24 px) keeps the value legible on the smallest tiles.** With the squarify 1/12 floor (§4) on a 1280×720 viewport, the smallest tile won't fall below ~150 px in either dimension, so `36cqmin = 54 px` wins over the floor on real grids; the floor only kicks in on degenerate tiny tiles (e.g. an unusually wide grid with 12 children of equal weight on a tiny preview). Even there, 24 px is comfortably above the WCAG 1.4.4 "Resize text" 200% baseline for a 12 px default.
- **Ceiling `20rem` (≈ 320 px) prevents typographic blow-out on giant single-child layouts.** When a parent has just one child, that child gets the entire grid area; without a ceiling the value would consume the screen and visually compete with the parent strip. 20 rem is roughly half the height of a 720 p kiosk panel, which keeps the value imposing but not overwhelming.
- **Distinction is bg + border + radius, not border alone.** The user explicitly mentioned "either a border or a background color", so we use both — the border anchors the boundary even when the background tint is too subtle for a particular palette, and the background gives the tile visual weight (so an empty-history TextNode still reads as a *thing* rather than a hole). 8 px border-radius modernises the look at zero accessibility cost. The CSS palette is `color-mix(... currentColor ...)` so the cues are theme-adaptive without a media query — the dark kiosk theme gets a faint white tint + a brighter white border; a light theme would get a faint black tint + a darker border. WCAG 1.4.11 (Non-text contrast 3:1) was used as the design target for the border-against-page contrast on the dark theme.
- **Plus tile is exempt from the new rule.** The plus tile's affordance is its **dashed** 2 px border + transparent background (already in `plus-tile.ts` as the canonical "this is an action, not a node" cue). Stacking the children-grid wrapper's solid-bordered tinted box on top of that would visually box the dashed button, muddying the affordance — so the rule is `[data-slot="node"]`-scoped, not `.tile`-scoped. Pinned by an e2e step that reads each plus wrapper's borderTopWidth + backgroundColor and asserts they're untouched.
- **No `:focus-visible` / `:hover` ring at this layer (yet).** Tiles aren't currently navigation targets in the Lit shell — drilling lands in a future phase (the existing `views/text_node_views.feature` etc. don't exercise click-to-drill). Adding focus rings now would either be invisible (no focus path reaches the tile) or wrongly suggest tap-to-drill. When drilling lands, the rings will be added on top of the §17.17 baseline (border thickness bump on focus, not a colour change, to preserve the contrast ratio).
- **Unit-test approach: assert the CSS string, not `getComputedStyle`.** jsdom doesn't compute styles from `<style>` rules inside a shadow root — `getComputedStyle(tile).borderTopWidth` returns `""`, not `"1px"`. We pin the rule at the source by reading `ChildrenGrid.styles.cssText` and `expect(...).toMatch(...)` against the relevant fragments. Behavioural verification ("is the border actually painted?") happens in the e2e suite via real-Chromium `getComputedStyle`. This split mirrors what §17.14 already established for the title/value/timestamp invariants.

**What's testable today** (snapshot at landing):

- `npm test` — **444 unit tests** across **41 files** (~7 s). Net +2: the two new `<children-grid>` tests above.
- `npm run lint` (`tsc --noEmit`) clean.
- `npm run lint:rules` (ESLint layered rules) clean.
- `npm run build` — bundle size grew ~2 KB (raw) / ~0.7 KB (gzip) to **~87 KB / ~24 KB gzip** to accommodate the new `<children-grid>` rule + the rewritten clamp comment.
- `npm run test:e2e` — **51 Playwright BDD scenarios** all green (was 49; +2 in `views/tile_layout.feature`).
- `npm run dev` / `npm run preview` — every BSC tile now renders a substantially larger numeric value (≈ 2× the prior size); every node tile in the children grid carries a subtle background tint + a thin border + rounded corners, visibly separating from its neighbours; the plus tile keeps its dashed-border look unchanged.

---

### 17.18 Phase 8 (DT-7) refinement #6 — bottom-right timestamp + computed-aggregate date + age-gradient colour

**Trigger** — user request: _"The date should appear at the bottom right of the card. The date for a 'computed' node should be the most recent date out of the values of its children. The color of the date should depend of its age, use a lerp on a gradient (from bright/warm orange to cold/pale blue), based on the number of days between now and the date of the value. The older, the bluer, the younger, the more orange."_

**One-line summary** — three coupled tweaks to the corner timestamp on every tile: (a) **move from top-right to bottom-right**; (b) **derive a date for computed BSCs** as the most recent date amongst their children's current-value dates (recursive through nested computed BSCs); (c) **colour the date** with an age-driven gradient (warm orange today → cold pale blue at 180 d).

**Files modified**:

- `src/domain/aggregation/currentValueDate.ts` — **new domain helper**. `currentValueDateIso(node): string | null` returns:
  - latest `TimestampedValue.asOf.toISOString()` for `TextNode` and recorded BSC;
  - the **most recent date amongst the children's current-value dates** for computed BSC (recursing through nested computed children), or `null` when no descendant has a date.
  Pure read-only domain query, mirrors `computedValue.ts` (same shape: walks `node.computed` + `node.children`). Single source of truth for "which date applies to this node's displayed value", consumed by the view-model mapper.
- `src/adapters/ui/views/dateAgeColor.ts` — **new UI helper**. `dateAgeColor(iso, now?): string` lerps between warm orange `rgb(255, 145, 50)` (age 0 d) and cold pale blue `rgb(140, 180, 220)` (age `MAX_AGE_DAYS = 180 d` and beyond) in linear RGB; future dates clamp to the warm endpoint (a freshly scheduled measurement reads as "fresh", not "ancient"); empty/unparseable input falls back to `currentColor`. The 180 d range is the tunable: anything older saturates at the cold endpoint so a 6-month-old measurement and a 5-year-old one look the same; the user only cares "is this from this season or not". Exposes `ageInDays(iso, now?)` separately for testability.
- `src/adapters/ui/views/NodeViewModel.ts` — `BusinessScoreCardNodeViewModel` gains a top-level `readonly dateIso: string` field (empty string when no date applies). The `BusinessScoreCardValueViewModel.recordedValue.dateIso` is kept for backward compatibility with existing tests; it is the same string as the top-level `dateIso` on a recorded BSC. The TextNode VM keeps its `value.dateIso` (the structure already had a single source of truth there).
- `src/adapters/ui/views/viewModelMapper.ts` — populates `vm.dateIso = currentValueDateIso(node) ?? ""` on the BSC VM. The TextNode mapping is unchanged (it already pulls from the latest `TextCard` history entry).
- `src/adapters/ui/views/BusinessScoreCardNode/valueTemplate.ts` — `timestampForValue` simplified to `(vm) => vm.dateIso ? vm.dateIso : null` (was a `value.kind === "recordedValue"` branch). The corner timestamp is now uniform across all three BSC value branches: it renders iff the unified domain helper produced a date.
- `src/adapters/ui/views/{BusinessScoreCardNode,TextNode}/{*}AsParent.ts` + `{*}AsChild.ts` (4 files) — emit `style="--age-color: ${dateAgeColor(dateIso)}"` on the `<time class="timestamp">` element. The colour flows through the `var(--age-color, currentColor)` fallback chain so a missing inline style still renders a readable timestamp (e.g. in tests that don't set `dateIso`).
- `src/adapters/ui/views/tileLayoutStyles.ts` — `.timestamp` rule moved from `top: 0.4rem` to `bottom: 0.4rem`; `.title { padding-right: ... }` reservation removed (the title now uses the full width); `color: color-mix(in srgb, currentColor 60%, transparent)` replaced with `color: var(--age-color, currentColor)` so the picked gradient colour shows at full saturation against the tile background. `pointer-events: none` added to the timestamp so it doesn't intercept clicks aimed at the value.
- Tests:
  - `src/test/unit/domain/aggregation/currentValueDate.test.ts` — **new, 9 tests**: latest history for recorded BSC + TextNode, null for empty histories, max child date for computed BSC, recursion through nested computed BSCs, mixed Text + BSC children, all-empty children, leaf with no children.
  - `src/test/unit/adapters/ui/views/dateAgeColor.test.ts` — **new, 9 tests**: `ageInDays` boundary cases (today, past, future-clamped-to-zero, unparseable), `dateAgeColor` endpoints + clamping beyond `MAX_AGE_DAYS`, monotonic lerp (older = bluer), `currentColor` fallback for empty input.
  - `src/test/unit/adapters/ui/views/viewModelMapper.test.ts` — **+3 tests**: top-level `dateIso` set from latest entry on recorded BSC, set from most recent child for computed BSC, recursion through nested computed BSCs, empty-string fallback when no descendant has a date.
  - `src/test/unit/adapters/ui/views/{BusinessScoreCardNode,TextNode}/{*}AsParent,{*}AsChild}.test.ts` (4 files) — the existing "timestamp in the top-right corner" tests flip to "timestamp in the bottom-right corner with `--age-color`" (assert `bottom: 0.4rem` in the static CSS string + `--age-color: rgb(...)` on the rendered element's inline style); BSC tests gain a "renders the corner timestamp for `computedMean` when `vm.dateIso` is set" scenario.
  - `src/test/e2e/features/views/tile_layout.feature` — the "top-right corner" scenario flips to **bottom-right**; **+1 new scenario** "Current-value timestamp colour is age-gradient driven" (asserts `getComputedStyle(time).color` is `rgb(...)` with `r ∈ [140,255], g ∈ [145,180], b ∈ [50,220]` — the convex hull of the two endpoints). `src/test/e2e/features/views/text_node_views.feature` — feature title and intro updated for "bottom-right".
  - `src/test/e2e/steps/viewSteps.ts` — the existing `Then` step renamed and rewritten for bottom-right (uses the parent-strip host's bounding box for the bottom edge); **+1 new step** for the gradient hull check.
- `docs/SPEC.md` — §5 field-content table + layout invariants updated with bottom-right + age gradient + recursive-computed-date; §17.0 status table gains a "refinement #6" row; new §17.18 (this section). Resume protocol bumped to **466 tests / 43 files** + **52 e2e scenarios**.

**Decisions taken during this refinement**:

- **Bottom-right, not bottom-centre.** The user said "bottom right of the card". Centre placement would compete with the value's horizontal alignment; right placement preserves the existing tabular-numeric reading flow (eye lands on the figure → drifts down-right → sees the date for context). It also keeps the corner-anchor symmetry with how operators learn to scan a wall of tiles (right edge anchors the latest update).
- **Computed-node date = max amongst _all_ children, not only "eligible" children.** The user wrote "the most recent date out of the values of its children." A computed BSC's eligibility filter (`ContributesToParent.isEligible()`) governs whether a child contributes to the **weighted mean**; it does not govern whether a child has been *observed recently*. A non-eligible TextNode child observed yesterday is still a more recent observation than a 3-month-old eligible BSC sibling, and that is the question the corner date answers. So `currentValueDateIso` walks every direct child regardless of `isEligible`.
- **Recursion is implicit through `currentValueDateIso(child)`, not a separate "deep walk".** A grandchild's date for a computed parent is the parent's own most-recent-children date, computed by the same function. The function is recursive on the computed branch and constant-time on leaves; cycle-free by virtue of `TreeNode` being a strict tree (§3 — each node has a single parent).
- **Linear RGB lerp, not OKLab / HSL.** Both endpoints land on the dark kiosk background with WCAG AA contrast (≈ 7.5:1 for orange, ≈ 8.5:1 for pale blue, well above the 4.5:1 baseline). A perceptual lerp would change the midpoint hue but not the contrast story; the simplicity of `Math.round(a + (b - a) * t)` per channel + the testability ("midpoint = (197, 162, 135)") wins. Future themes that need a perceptual gradient can swap the lerp implementation in one place; the public surface (`dateAgeColor(iso) -> rgb(...)`) doesn't change.
- **`MAX_AGE_DAYS = 180`, not 365 or 90.** A 90-day saturation feels too aggressive for annual planning cycles (an "old" measurement at 3 months); 365 days softens the visual cue too much (a 6-month-old number still reads as "fresh-ish"). 180 days is the inflection point that matches a half-year planning rhythm — the operator's mental model of "this season" vs "old". Tunable in one constant if a future user requirement disagrees; the surrounding contract (linear lerp from the warm to the cold endpoint, clamp at the ends) doesn't need to change.
- **Future dates clamp to the warm endpoint.** A measurement scheduled tomorrow should read as "fresh" — not "ancient" or "warning". This also defends against clock-skew between the kiosk and the data source: a slightly-future timestamp doesn't visually flag as a fault.
- **`--age-color` CSS custom property + `var(...)` fallback, not a hard-coded `style="color: ..."`.** The custom property keeps a single CSS rule (`color: var(--age-color, currentColor)`) responsible for the colour, with the per-tile lerp result driven by inline JS. If a future theme wants to mute the gradient (e.g. for an all-grayscale print export), overriding `--age-color` at any ancestor level reverts to the inherited colour without editing the per-role elements. The `currentColor` fallback also keeps existing unit-test fixtures legible when the inline style isn't set.
- **`recordedValue.dateIso` kept on the value VM for back-compat.** Tests that fabricate a VM literally still read `vm.value.dateIso` for the asserted text. Removing the field would force a wider VM-shape edit across multiple tests for no gain; the duplication is one sentence of mapper code (`dateIso: result.value.asOf.toISOString()` next to the new top-level `dateIso = currentValueDateIso(node)`).
- **Unit-test approach: read static `cssText`, not `getComputedStyle`.** Same constraint as §17.17: jsdom doesn't compute styles from `<style>` rules inside a shadow root. We pin the `.timestamp { bottom: 0.4rem; right: 0.6rem }` rule by reading `TextNodeAsChild.styles` (a readonly array of `CSSResult`) and concatenating their `cssText`. The end-to-end visual ("does the timestamp actually paint at the bottom-right?") moves to Playwright in real Chromium, which already had a "top-right corner" scenario — that scenario flips to bottom-right + a new "colour is on the gradient" scenario.

**What's testable today** (snapshot at landing):

- `npm test` — **466 unit tests** across **43 files** (~7 s). Net +22: new `dateAgeColor.test.ts` (9 tests), new `currentValueDate.test.ts` (9 tests), 3 new mapper tests, 1 new BSC parent test (computed date case); other view-test rewrites are net-zero count.
- `npm run lint` (`tsc --noEmit`) clean.
- `npm run lint:rules` (ESLint layered rules) clean.
- `npm run build` — clean; bundle stays in the same band as §17.17 (~89 KB raw / ~25 KB gzip; +1 KB for the new domain helper + colour helper + recursive mapper logic).
- `npm run test:e2e` — **52 Playwright BDD scenarios** all green (was 51; +1 for the gradient-hull colour check; the prior "top-right corner" scenario was rewritten in place to "bottom-right corner").
- `npm run dev` / `npm run preview` — every tile's corner timestamp is now in the bottom-right; computed BSCs show a date derived from the most recent observation amongst their descendants; the colour shifts from a warm orange for today to a cold pale blue for ≥ 6-month-old measurements, with a smooth lerp in between.

---

## Resume protocol

When resuming this conversation:

1. **Read §17 (Implementation log) first** — it is the source of truth for as-built status (which phases have landed, on which commits, and any decisions taken during implementation that §1–§16 did not pin down). Then re-read this file end-to-end. Decisions §13.1, §13.2, §13.3, §14, §15, §16 are locked.
2. **Re-read** `examples/classDiagramMermaid.v2.mermaid`, `examples/test.json`, `examples/test-before.html`, `examples/test-after.html`.
3. **Run `git status` and `git log --oneline`** — confirm `HEAD` matches the latest commit recorded in §17.0. Phases 0–8 are fully landed (incl. the §17.13 + §17.14 + §17.15 + §17.16 + §17.17 + §17.18 refinements; DT-10 script half too — Tasks A/B remain manual ops); the working tree should be clean (or hold only docs/test-fixture WIP).
4. **Sanity check the build**: `npm test` (expect **466** tests across **43** files per §17.18), `npm run lint`, `npm run lint:rules`, `npm run build` (expect ~89 KB / ~25 KB gzip), and `npm run test:e2e` (expect **52** scenarios) — all should be green before starting new work. The first `npm run test:e2e` after a clone needs `npx playwright install chromium`.
5. **Verify Atlassian MCP is online** — list `C:\Users\amiot\.cursor\projects\<workspace-id>\mcps\` (the `<workspace-id>` derives from whichever folder is opened as the Cursor workspace; for `c:\Cursor` it is `c-Cursor`, for `c:\Cursor\tree-graph-viz` it is something like `d-…-tree-graph-viz`) and confirm an `atlassian`-like descriptor folder exists alongside `plugin-datadog-datadog`. If not, the user has not yet completed the OAuth flow after the Cursor restart that picked up `.cursor/mcp.json` (which is committed in the repo and also mirrored to global + workspace-root paths per §17.8). Strand A — 16 issues + 25 `Blocks` edges — is already created per §15.9.
6. **Pick up the next strand**:
   - **Phase 9 (CSS animations + a11y polish)**: per §12.5 — `animations/drillTransitions.test.ts` (no-preference: drilling sets `encap--drill`, commits after `DRILL_SETTLE_MS`; reduce: commits immediately, never adds class). The kiosk currently has no drill animation; the existing `dismissAnimations()` test bridge hook is already in place to short-circuit them in BDD.
   - **Phase 10 (DT-8 + persistence/routing)**: real consumers for `burger-menu-action` — Import / Export / Boards. Currently the composition root logs a placeholder; replacing that with `<input type="file">` + `ImportExportService.importJson`, `URL.createObjectURL` + `ImportExportService.exportJson`, and a boards panel against `BoardCollectionService.{rename,switchTo,createBoard}` is the §17.7 follow-up. Also wires the `routing/*.feature` set (deep-link / focus-to-url / unknown-uuid-fallback).
   - **Phase 5 leftovers (separate strand)**: DT-10 (`HE-2581`) + Task A (`HE-2586`) + Task B (`HE-2589`) — XRay import pipeline (`bin/xray-import.ps1`), credential provisioning, and first XRay import dry-run. Needs `XRAY_CLIENT_ID` + `XRAY_CLIENT_SECRET` in env (§16.8).
   - **Breadcrumb truncation refinement** (deferred from §17.11): pixel-perfect head-keep + tail-keep + middle-`…` (`Root › … › Parent › Focus`). The current CSS-mask + `flex-end` approach satisfies the spec contract but isn't the literal sketch in §4.
7. XRay import script and credentials are tracked under the Phase 5 (DT-10/Task A/Task B) strand above; not blocking for any further coding work.
