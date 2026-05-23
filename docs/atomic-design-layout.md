# Atomic-design source layout — Phase 2 plan (§17.128)

This document captures the target source-tree layout for the
`src/adapters/ui/` directory and the strand sequence that will get us
there. It is **planning material**: it lands in R0 (this strand) and
evolves alongside the moves themselves so a reader can always tell
which files have migrated and which are still scheduled.

## 1. Why

The Phase 1 atomic-design **showcase** (`§17.127`) inventoried every
UI primitive into a single page (`<design-system-page>`) organised by
the five canonical atomic-design tiers (atoms → pages). The showcase
proved the classification works; Phase 2 carries the same
classification into the **source tree** itself so the file layout
mirrors the page layout.

Concretely, Phase 2 moves `src/adapters/ui/{shell,views,modal,
markdown}/` into `src/adapters/ui/{atoms,molecules,organisms,
templates,pages}/` over a series of ≤ 300-line strands.

## 2. Target layout

```text
src/adapters/ui/
├── atoms/          ← pure CSS + format helpers (no Lit elements)
├── molecules/      ← reusable render helpers + sub-element widgets
│   ├── childWeight/
│   └── plus/
├── organisms/      ← self-contained Lit elements (custom elements)
│   ├── BusinessScoreCardNode/
│   ├── ComputedNode/
│   ├── TextNode/
│   ├── WorkflowNode/
│   ├── PictureNode/
│   ├── URLNode/
│   ├── shell/   ← BurgerMenu, Breadcrumb
│   └── modal/   ← AboutModal, AddChildModal, …
├── templates/      ← ChildrenGrid, ParentIdentityStrip
├── pages/          ← TreeMapScreen + showcase/
│   └── showcase/   ← DesignSystemPage, sampleViewModels
├── controllers/    ← (stays flat — cross-cutting)
└── animations/     ← (stays flat — cross-cutting)
```

## 3. Per-file classification

| Current path | New path | Tier | Strand |
| --- | --- | --- | --- |
| `views/ageFormat.ts` | `atoms/ageFormat.ts` | atom | R1a |
| `views/numberFormat.ts` | `atoms/numberFormat.ts` | atom | R1a |
| `views/dateAgeColor.ts` | `atoms/dateAgeColor.ts` | atom | R1a |
| `views/tileLayoutStyles.ts` | `atoms/tileLayoutStyles.ts` | atom | R1b |
| `views/warningFill.ts` | `atoms/warningFill.ts` | atom | R1b |
| `modal/modalFrameStyles.ts` | `atoms/modalFrameStyles.ts` | atom | R1b |
| `markdown/markdownToHtml.ts` | `atoms/markdownToHtml.ts` | atom | R1c |
| `views/unitChip.ts` | `molecules/unitChip.ts` | molecule | R2a |
| `views/WorkflowNode/statusBadge.ts` | `molecules/statusBadge.ts` | molecule | R2a |
| `views/disabledToggle.ts` | `molecules/disabledToggle.ts` | molecule | R2a |
| `views/inlineEditEvents.ts` | `molecules/inlineEditEvents.ts` | molecule | R2b |
| `views/inlineEditHelpers.ts` | `molecules/inlineEditHelpers.ts` | molecule | R2b |
| `views/inlineTitleEdit.ts` | `molecules/inlineTitleEdit.ts` | molecule | R2b |
| `views/NodeView.ts` | `molecules/NodeView.ts` | molecule | R2c |
| `views/NodeViewModel.ts` | `molecules/NodeViewModel.ts` | molecule | R2c |
| `views/nodeViewRegistry.ts` | `molecules/nodeViewRegistry.ts` | molecule | R2c |
| `views/viewModelMapper.ts` | `molecules/viewModelMapper.ts` | molecule | R2c |
| `views/index.ts` | `molecules/index.ts` | molecule | R2c |
| `views/childWeight/*` (3 files) | `molecules/childWeight/*` | molecule | R2d |
| `views/plus/PlusTile.ts` | `molecules/plus/PlusTile.ts` | molecule | R2d |
| `shell/BurgerMenu.ts` | `organisms/shell/BurgerMenu.ts` | organism | R3a |
| `shell/Breadcrumb.ts` | `organisms/shell/Breadcrumb.ts` | organism | R3a |
| `views/BusinessScoreCardNode/*` (3 files) | `organisms/BusinessScoreCardNode/*` | organism | R3b |
| `views/ComputedNode/*` (1 file) | `organisms/ComputedNode/*` | organism | R3c |
| `views/TextNode/*` (3 files) | `organisms/TextNode/*` | organism | R3d |
| `views/WorkflowNode/*` (2 files, post-R2a) | `organisms/WorkflowNode/*` | organism | R3e |
| `views/PictureNode/*` (4 files) | `organisms/PictureNode/*` | organism | R3f |
| `views/URLNode/*` (5 files) | `organisms/URLNode/*` | organism | R3g |
| `modal/AddChildModal.ts` + `EditNodeModal.ts` | `organisms/modal/*` | organism | R3h-1 |
| `modal/{About,BoardSettings,BoardsPanel}Modal.ts` | `organisms/modal/*` | organism | R3h-2 |
| `shell/ChildrenGrid.ts` | `templates/ChildrenGrid.ts` | template | R4 |
| `shell/ParentIdentityStrip.ts` | `templates/ParentIdentityStrip.ts` | template | R4 |
| `shell/TreeMapScreen.ts` | `pages/TreeMapScreen.ts` | page | R5a |
| `showcase/DesignSystemPage.ts` | `pages/showcase/DesignSystemPage.ts` | page | R5b |
| `showcase/sampleViewModels.ts` | `pages/showcase/sampleViewModels.ts` | page | R5b |
| `controllers/*` (2 files) | `controllers/*` (unchanged) | cross-cutting | n/a |
| `animations/*` (1 file) | `animations/*` (unchanged) | cross-cutting | n/a |

Total: **48 files moving**, **3 files staying flat**, **7 cross-cutting
files** untouched. Each strand updates every consumer's import path
within the same commit; no behaviour change ever lands inside a
refactor strand.

## 4. Classification rules of thumb

- **Atom** if the file is pure CSS, a Unicode-glyph constant, or a
  string-formatting helper with zero DOM knowledge. No Lit, no events.
- **Molecule** if it is a small reusable render helper (`renderXxx`
  function returning a `TemplateResult`), a thin Lit controller, a
  shared event type, or a small Lit element used as a sub-piece inside
  organisms (e.g. `WeightEditButton`, `PlusTile`).
- **Organism** if it is a self-contained `@customElement` with its own
  identity in the kiosk's mental model (every `*NodeAsParent` /
  `*NodeAsChild`, the modals, the burger menu, the breadcrumb).
- **Template** if it is a layout-shell Lit element whose job is to
  arrange organisms into a regular structure (the focused-panel strip,
  the children grid).
- **Page** if it is a full-screen Lit element that is mounted directly
  by the composition root (`main.ts`) or the burger-menu wiring.
- **Cross-cutting** if it is a `ReactiveController` / animation helper
  that operates on the DOM but isn't itself a UI primitive. Stays flat.

## 5. Per-node-kind cohesion

Sub-pieces of a node organism (e.g. `BusinessScoreCardNode/valueTemplate.ts`,
`PictureNode/pictureBody.ts`, `URLNode/qrGenerator.ts`) stay **co-located**
with their organism rather than being hoisted into `molecules/` or
`atoms/`. Cohesion (everything you need to read to understand one node
kind lives in one folder) wins over atomic purity. The one exception is
`WorkflowNode/statusBadge.ts`, which is also used by the showcase's
Molecules tier and so genuinely belongs in `molecules/`.

## 6. Strand sequence

| Strand | Scope | Status |
| --- | --- | --- |
| **R0**  | This doc + empty `atoms/ molecules/ organisms/ templates/ pages/` | **done** (§17.128 R0) |
| **R1a** | Atoms — format helpers | **done** (§17.128 R1a) |
| **R1b** | Atoms — visual helpers | **done** (§17.128 R1b) |
| **R1c** | Atoms — markdown helper | **done** (§17.128 R1c) — atoms tier complete |
| **R2a** | Molecules — render helpers | **done** (§17.128 R2a) |
| **R2b** | Molecules — inline-edit helpers | **done** (§17.128 R2b) |
| **R2c** | Molecules — NodeView + registry + mapper | **done** (§17.128 R2c) |
| **R2d** | Molecules — childWeight + plus | **done** (§17.128 R2d) — molecules tier feature-complete (minus `views/index.ts` barrel) |
| **R3a** | Organisms — shell | **done** (§17.128 R3a) |
| **R3b** | Organisms — BusinessScoreCardNode | **done** (§17.128 R3b) |
| **R3c** | Organisms — ComputedNode | **done** (§17.128 R3c) |
| **R3d** | Organisms — TextNode | **done** (§17.128 R3d) |
| **R3e** | Organisms — WorkflowNode | **done** (§17.128 R3e) |
| **R3f** | Organisms — PictureNode | pending |
| **R3g** | Organisms — URLNode | pending |
| **R3h-1** | Organisms — modals (AddChild + EditNode) | pending |
| **R3h-2** | Organisms — modals (About + BoardSettings + BoardsPanel) | pending |
| **R4**  | Templates — ChildrenGrid + ParentIdentityStrip | pending |
| **R5a** | Pages — TreeMapScreen | pending |
| **R5b** | Pages — DesignSystemPage + sampleViewModels | pending |

## 7. Test-file co-movement

Tests under `src/test/unit/adapters/ui/` mirror the production tree. A
strand that moves `views/ageFormat.ts` to `atoms/ageFormat.ts` also
moves `test/unit/adapters/ui/views/ageFormat.test.ts` to
`test/unit/adapters/ui/atoms/ageFormat.test.ts`. The test file's
import of the production module is rewritten in the same commit.

E2E features (`src/test/e2e/**`) interact with the kiosk through the
browser shell, not via production imports, and are unaffected by the
refactor.

## 8. Safety net + rollback

- **`tsc`** catches every stale import on either side of a move; the
  `npm run test:coverage` step before the Sonar gate compiles the
  entire tree.
- **No behaviour change** lands inside a refactor strand — kiosk +
  showcase render identically before and after each strand. A strand
  that needs behaviour change is the wrong strand.
- **Rollback per strand**: each strand is one merge commit on `master`.
  If a strand reveals a problem, revert the merge and re-slice that
  one strand.
