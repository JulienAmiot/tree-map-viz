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

### Changed

- **Computed* both card classes both roles migrate to the shared
  `<card-body>` skeleton + AsChild title moves to SVG-mono + Computed*
  AsParent header bumps to 24% (§17.142c)**. Fourth strand of the §17.142
  plan: both `<computed-card>` (no objective) and `<computed-business-
  score-card>` (with objective) now render their body content through
  the shared `<card-body>` molecule on both `asChild` and `asParent`
  roles. The numeric value glyph migrates to `renderMonoTextSvg` so it
  scales with the cell width (closes "current value clipped" for
  Computed parents too); the trend arrow becomes a CSS background on the
  value cell (mirror of the §17.142a/b BSC pattern, no more standalone
  `<ds-icon>` DOM child); the CBSN-only target value + target date cells
  become direct `aux` + `meta` slot children rendered through SVG-mono.
  The `<objective-cell>` and `<target-date-cell>` shadow-DOM molecules
  retire as production consumers — every place in the kiosk that used
  to mount them now renders their cells inline (a follow-up clean-up
  strand can delete the molecule files themselves once a wider regress
  pass is done). The AsChild title also migrates to SVG-mono so a long
  title shrinks instead of overflowing the card-frame title slot, and
  the focused-panel Computed* header bumps 18% → 24% (mirror of
  §17.142b's BSC bump) so the title + sigma badge + subtitle strategy
  picker breathe on the focused panel without cropping.
- **BSC AsParent migrates to the shared `<card-body>` skeleton + value moves
  to SVG-mono + header bumps to 24% + description shrinks via container-
  query height instead of line-clamp (§17.142b)**. Third strand of the
  §17.142 plan: the focused-panel BSC's metric-pane is now a `<card-body>`
  molecule whose `lead` cell hosts the SVG-mono current value (so long
  values scale instead of clipping), `aux` cell hosts the target value +
  off-track warning, `meta` cell hosts the target date. The outer
  `.body` flex layout stays untouched so the §17.45 entering animation
  (metric-pane 100%→50%, description fade + slide-in) continues to
  fire on focus swap. Three of the operator's §17.141 design-system
  review items close: *"header still cropped at 18%"* (header bumps to
  24%, still under the card-frame 28% default since the focused panel
  is much taller than a child tile), *"current value clipped"* (SVG-
  mono value scales horizontally with its cell), *"description should
  shrink rather than line-clamp"* (font-size now scales with the
  container's height via `clamp(0.8vh, 4cqh, 1.5vh)`, so a long
  description in a short panel naturally shrinks instead of hard-
  truncating after 8 lines).
- **BSC AsChild migrates to the shared `<card-body>` skeleton + title moves
  to SVG-mono (§17.142a)**. Second strand of the §17.142 plan: business-score
  card child tiles now render their body through the §17.142-foundation
  `<card-body>` molecule (`.current-value` → `lead`, `.target-value` →
  `aux`, `.target-date` → `meta`), and the title text switches to the
  same `renderMonoTextSvg(...)` helper the value glyph already uses so
  the title scales with the title-slot width instead of the viewport
  height. Three of the operator's §17.141 design-system review items
  close as a direct consequence: (a) *"doesn't fill the whole space"* —
  the molecule's stretched grid cells let the SVG-mono glyph reach the
  bottom of its row; (b) *"target and date are missing"* — the new
  `aux` + `meta` cells render as direct grid items, no `display:
  contents` flatten against the now-irrelevant pre-§17.142 shared
  grid; (c) *"title relatively too big"* — long titles render as
  shorter (squat) SVGs, short titles render taller. The fourth review
  item (*"age uses gradient color"*) already closed in the §17.142
  foundation strand. Per-view migrations continue in §17.142b (BSC
  AsParent) → §17.142c (Computed* both roles) → §17.142d (Text +
  Workflow) → §17.142e (Picture + URL).

### Added

- **Shared `<card-body>` 3-cell skeleton (§17.142 foundation)**. New molecule
  every per-view will route its body content through so the kiosk's card
  layouts share one visual rhythm — `lead` cell on the left (the focal
  content), `aux` + `meta` cells stacked on the right (secondary +
  tertiary content). Container-query portrait flip stacks the three cells
  vertically when the host is taller than wide. Cells stretch to fill
  their tracks, fixing the §17.141-review "doesn't fill the whole space"
  feedback on BSC AsChild. Per-view divergence rides on `--card-body-lead-cols`
  + `--card-body-gap` custom properties + `part="lead|aux|meta"` shadow-
  piercing hooks. Foundation only — per-kind migrations land in
  §17.142a-§17.142e strands one kind at a time.

### Changed

- **Showcase `dateColor` fixtures now follow the kiosk's age-based rule
  (§17.142 foundation)**. Operator feedback on the §17.141 design-system
  review: *"the age is using the gradient color"*. The pre-§17.142
  showcase view-model builders hand-baked gradient rgb literals on each
  `dateColor` (the on-track BSC carried the value's green, the off-track
  BSC carried the warning's orange, etc.) — but the real `viewModelMapper`
  derives `dateColor` from §17.42's off-white → dark-grey age lerp.
  Routing every showcase fixture through `dateAgeColor()` against a
  frozen `SHOWCASE_NOW` realigns the demo with the kiosk's actual rule
  and keeps the result deterministic across reloads.

- **Edit-modal carries the disabled flag now, AsParent cards lose the inline
  toggle (§17.141)**. Operator-requested follow-up after §17.140. The
  pre-§17.141 `<button role="switch">` toggle at the left of the focused
  parent card's title row retires across all 6 AsParent organisms
  (`BusinessScoreCardNodeAsParent`, `TextNodeAsParent`, `URLNodeAsParent`,
  `PictureNodeAsParent`, `WorkflowNodeAsParent`, both Computed cards). In
  its place the `<edit-node-modal>` form gains a universal "Disabled
  (parked, excluded from aggregation)" checkbox, rendered right after the
  weight control for every kind (the flag rides `CommonEdit` in the
  application layer, so every kind that reaches the modal honours it).
  The AsChild read-side `.disabled-indicator` glyph on tree-map tiles is
  unchanged — operators still get a calm "this card is parked" badge at a
  glance.
- **Card-frame header grows so the Workflow PDCA pill fits (§17.141)**.
  Operator feedback on §17.140: "Increase the size of the header so that
  the status button appears fully (in child and parent card)". The pre-
  §17.141 `--card-header-height` default `22%` clipped the subtitle row
  on small child tiles when the value carried a status pill; bumping the
  default to `28%` (and the AsParent focused-panel override from `14%` to
  `18%`) gives the subtitle room without forcing a viewport-scaled
  switch.

- **BSC AsChild + shell polish on the operator's §17.139 review (§17.140)**.
  Six batched follow-ups: (a) target / date overlap bug above;
  (b) `(unit)` parens dropped from the title-prefix chip — the
  chip now reads the bare unit (`USD` / `%` / `EUR`) since the
  parens read as visual noise on the dense title row; (c)
  `<card-frame>` footer height shrinks from `12 %` to
  `1.4em` so the timestamp + weight icon don't claim a tile-
  relative band, freeing the body row for the value glyph; (d)
  trend-arrow + bullseye stroke bumped from Lucide's default
  `2` to `3.5` so the muted `#9aa3b4` arrows read at-a-glance;
  (e) `<weight-edit-button>` hit rect roughly doubled
  (`2rem 12cqmin 3.4rem` × `1.4rem 8cqmin 2.4rem`) while the
  inner icon stays the same visual size; (f) the SVG viewBox
  for the `.current-value` cell gains 10 % right whitespace
  (new `rightPadding` option on `renderMonoTextSvg`) so the
  value text has visual clearance before the right-edge trend
  arrow background.

- **BSC AsChild migrated to the SVG-mono 3-cell grid + CSS-background icons — closes the §17.139 plan (§17.139c)**.
  Third and final slice of the §17.139 migration. `<business-
  score-card-as-child>` swaps its pre-§17.139
  `.value-row + .target-row` HTML / `clamp(min(42cqmin,
  160cqi / N), …)` value-glyph plumbing (with
  `<objective-cell>` + `<target-date-cell>` molecule children)
  for a 3-cell CSS-Grid body driven by §17.139a's
  `renderMonoTextSvg` + §17.139b's `TREND_ARROW_BG` /
  `TARGET_ICON_BG`. New `.value-area` template: landscape
  `grid-template-columns: 2fr 1fr` × `1fr 1fr` rows with
  `.current-value` spanning both rows on the left (67 %
  width); portrait flip via `@container (orientation:
  portrait)` to `1fr × 2fr 1fr 1fr`. No JS, no resize
  observer — pure CSS container queries. Trend arrows + the
  target bullseye become `background-image` rules keyed off
  the `.current-value[data-direction="*"]` attribute and the
  shared `.target-value` rule. The pre-§17.139 `--char-count`
  inline CSS variable + the `<span class="trend-arrow"><ds-
  icon>` DOM child both retire. Driven by the operator's
  `examples/text-fills-container.html` POC layout.

### Fixed

- **BSC AsChild target cell drops the unit suffix (§17.141)**. Operator
  feedback on §17.140: "Don't write the unit in the target". The
  pre-§17.141 `.target-value` cell stamped the unit (`"80 %"` /
  `"100 EUR"`) but the §17.125 title-prefix chip already carries the unit
  on the same tile, so duplicating it in the narrow `.target-value` cell
  stole horizontal real estate from the value glyph for no information
  gain. The cell now renders the bare numeric target.
- **§17.139 BSC AsChild target / date overlap bug (§17.140)**.
  The shared `tileLayoutStyles` declares a
  `.value-area > .target-row { display: grid; ... }` rule whose
  specificity (`0,2,0`) beat the §17.139c override
  `.target-row { display: contents }` (`0,1,0`); the inner
  `.target-value` + `.target-date` referenced grid-areas that
  didn't exist in the nested grid and both collapsed onto cell
  `(1,1)` → operator saw the target text and the target date
  stacked on top of each other. Fixed by matching the
  selector shape (`.value-area > .target-row { display:
  contents }`) so source order wins on equal specificity.

### Added

- **`trendArrowBg` molecule: CSS-background data URIs for trend + target icons (§17.139b)**.
  Second slice of the §17.139 BSC AsChild migration. The new
  `src/adapters/ui/molecules/trendArrowBg.ts` molecule exports
  `TREND_ARROW_BG[direction]` (5 Lucide arrows — up / up-right
  / right / down-right / down) + `TARGET_ICON_BG` (Lucide
  bullseye target), each as a CSS `url(data:image/svg+xml,...)`
  background-image value. The `#9aa3b4` muted stroke colour is
  baked into every data URI because CSS `background-image`
  cannot inherit `currentColor` (the kiosk's value-glyph keeps
  its colour-as-severity signal per §17.40; the supporting
  icons stay monochrome). Foundation only; strand C wires
  both consts into the BSC AsChild `.current-value` +
  `.target-value` cells.

- **`svgMonoText` atom: monospace SVG text scaling foundation (§17.139a)**.
  First slice of the §17.139 BSC AsChild migration. The new
  `src/adapters/ui/atoms/svgMonoText.ts` atom exports
  `MONO_CHAR_WIDTH = 13.2` + a `renderMonoTextSvg(text, opts)`
  helper returning a Lit template for an `<svg width="100%"
  height="auto" viewBox="0 0 textLen*13.2 22"
  preserveAspectRatio="xMinYMid meet">` with the text rendered
  as a `<text fill="currentColor">` child. The SVG scales
  itself purely from its viewBox aspect ratio + parent width
  (no CSS `clamp()` / `cqmin` / `--char-count` plumbing
  needed). Foundation only; strand B (trendArrowBg molecule) +
  strand C (BSC AsChild migration) close the §17.139 plan.

- **Showcase organisms: Picture + URL migrated to 4-position grids (\u00a717.137, A5d) \u2014 closes the §17.137 plan**.
  Fourth and final A5 sub-slice. The pre-A5d combined Picture
  + URL section splits into two stacked 4-up grids \u2014 one for
  `<picture-node-as-*>` (inline data-URL SVG, offline-safe)
  and one for `<url-node-as-*>` (\u00a717.123 QR code + clickable
  URL aside). With this slice, the §17.137 5-strand plan
  (A1 \u2192 A2 \u2192 A3 \u2192 A4 \u2192 A5) is complete: every card kind
  appears in all four positions in the showcase, the atoms
  tier carries a typography subsection on a uniform tile
  shape, BSC + CBSN tiles use the 50/25/25 split-body layout
  that adapts to portrait + landscape via container queries,
  and Objective + target date are reusable molecules.
- **Showcase organisms: Text + Workflow migrated to 4-position grids (\u00a717.137, A5c)**.
  Third of four A5 sub-slices. The pre-A5c combined Text +
  Workflow section (one h2, four AsParent/AsChild cells)
  splits into two stacked 4-up grids \u2014 one for `<text-node-
  as-*>` and one for `<workflow-node-as-*>`. Each kind now
  stamps in all four positions; AsParent surfaces the markdown
  body / PDCA picker, AsChild stays compact.
- **Showcase organisms: Computed + CBSN migrated to 4-position grids (\u00a717.137, A5b)**.
  Second of four A5 sub-slices. The pre-A5b combined Computed
  section (one h2, two AsParent-only cells with mismatched
  stage sizes) splits into two stacked 4-up grids \u2014 one for
  `<computed-card>` (ComputedNode, SUM strategy) and one for
  `<computed-business-score-card>` (CBSN, WEIGHTED_AVERAGE).
  Each variant now stamps in all four positions (child
  portrait + landscape, parent portrait + landscape) with the
  `view-role` attribute toggling between rows so the operator
  sees how the strategy picker (AsParent) versus the read-only
  badge (AsChild) lay out under each orientation.
- **Showcase organisms: BSC migrated to a 4-position grid (\u00a717.137, A5a)**.
  First of four A5 sub-slices closing the §17.137 plan. The
  organisms-tier BSC section now stamps the same VM in four
  positions side-by-side: child portrait (160x240px), child
  landscape (280x180px), parent portrait (220x320px), and parent
  landscape (380x220px). The aspect ratio of each stage drives
  the per-view's `@container (orientation: portrait)` rule
  (already in place since A2b) so the operator sees how the
  card's value-area lays out under each combination at a glance.
  A5b/c/d will extend the same 4-up grid to Computed, Text,
  Workflow, Picture, and URL kinds.
- **Typography subsection on the showcase atoms tier (\u00a717.137, A4)**.
  A new `atoms-typography` section opens the atoms tier with a
  data-driven listing of every kiosk text role (title, value,
  subtitle, target, timestamp, description, code/monospace). Each
  role tile renders the role's sample text in the role's own
  inlined font-size + font-weight + font-style + font-family so
  the showcase matches the kiosk's real rendering of that role,
  plus a one-line meaning explaining where the role lands.

### Changed

- **Kiosk font flipped to `ui-monospace` (\u00a717.138)**.
  Operator-requested kiosk-wide flip from the pre-\u00a717.138
  `system-ui` sans stack to a layered monospace stack starting
  with the CSS-generic `ui-monospace` keyword
  (`ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo,
  Consolas, "Liberation Mono", monospace`). The `--font` CSS
  variable on `:root` is now the single source of truth: the
  three shadow roots that previously hardcoded a sans stack
  (`<tree-map-screen>`, every modal frame via the shared
  `modalFrameStyles`, `<design-system-page>`) refactor to
  `font: 1rem/1.4 var(--font)` so any future face swap is a
  one-line edit. The showcase Typography subsection collapses
  its per-role `fontFamily` strings onto a shared `MONO_STACK`
  constant so every role tile renders in the same monospace
  face the kiosk uses globally. Sample SVG demo content
  (topology-diagram data-URL in `showcaseSeed.ts`, the
  "Obeya wall" demo Picture in `sampleViewModels.ts`) flips to
  the same monospace stack too, per the operator's "flip" call
  on the SVG demo scope.

- **Showcase atoms unified onto a single `.atom-tile` shape (\u00a717.137, A3)**.
  Pre-A3 the four atoms-tier sections used four distinct tile
  shapes (`.swatch`, `.glyph-cell`, `.icon-cell`, `.pdca-badge`)
  with three different grid widths (180px / 150px / 140px) and
  the PDCA row was a flex-wrap inline pill row with no tile at
  all. A3 collapses them onto a shared `.atom-grid` container +
  `.atom-tile` base with modifier classes
  (`.atom-tile--swatch / --glyph / --icon / --pdca`) carrying
  only content-axis differences, so the showcase's atoms tier
  reads as one consistent tile family.
- **Split-body CSS Grid layout on BSC + CBSN tiles (\u00a717.137, A2b)**.
  The pre-A2b column-flex stack (`.value-row` above `.target-row`,
  the target row a horizontal row of icon + value + unit + date +
  warning) is retired in favour of a CSS Grid that puts the value
  + trend arrow on the LEFT (landscape) or TOP (portrait), and the
  target value + date stacked on the RIGHT (landscape) or BOTTOM
  (portrait), per the operator-locked 50%/25%/25% portrait split.
  The orientation flips automatically via a `@container
  (orientation: portrait)` query on the per-view's `:host` (already
  `container-type: size` from the shared `tileLayoutStyles`); no
  per-view template restructuring needed.
- **Deadline-risk warning folded into `<objective-cell>`; CBSN migrated to the molecules (\u00a717.137, A2a)**.
  The §17.44 deadline-risk warning glyph moves from "after the
  date" in `renderTargetRow` to "after the target text" inside
  `<objective-cell>` \u2014 the natural home for A2's split-body
  layout where target value + warning share one grid cell. CBSN's
  inline `renderObjectiveRow` (which stamped target-icon +
  target-text inline pre-A2a) now composes `<objective-cell>` +
  `<target-date-cell>` the same way BSC's `renderTargetRow` does;
  the local `renderTargetUnit` helper retires.
- **`Objective` and `target date` promoted to molecules (\u00a717.137, A1)**.
  Pre-A1 the bullseye glyph + target value + unit + date were stamped
  inline by `renderTargetRow` in BusinessScoreCardNode's value
  template; A1 promotes them into two dedicated LitElements,
  `<objective-cell>` (bullseye + value + unit) and `<target-date-cell>`
  (the formatted date), under
  `src/adapters/ui/molecules/objective/`. Pure refactor \u2014 visual
  output + `target-icon` / `target-text` / `target-date` testids
  preserved 1:1, the \u00a717.44 deadline-risk warning stays inline
  in `renderTargetRow` (A2 folds it into `<objective-cell>` when the
  split-body layout co-locates them anyway). The pre-A1 inline
  `formatDate` helper moves to `<target-date-cell>` as
  `formatTargetDate` (sole consumer).
- **Per-AsChild slot-fill test pins for the §17.136 S13b
  weight-edit button (\u00a717.136, S13b-2)**. Follow-up slice
  to S13b-1 (split per the 300-line gate ceiling): each of the
  6 AsChild test files (BSC, Computed*, Picture, Text, URL,
  Workflow) gains a contract pin asserting the AsChild stamps a
  `<weight-edit-button slot="footer-left" node-id=${vm.id}
  .weight=${weight}>` inside its shadow root. The Computed test
  additionally pins the AsParent-branch absence (no
  `<weight-edit-button>` on `renderAsParent()`). No source
  changes; behaviour-pinning only.
- **Weight-edit button moves into `<card-frame slot="footer-left">` (\u00a717.136, S13b-1)**.
  The per-tile weight-edit affordance retires from its
  `<children-grid>` corner overlay (where it sat as a sibling of
  `<node-view>` with an absolute corner anchor) and now lives inside
  each AsChild's `<card-frame>` footer-left cell. `<node-view>` grows
  a reactive `weight` property forwarded from the grid down to
  whichever per-kind AsChild tag the registry dispatches; the AsChild
  stamps `<weight-edit-button slot="footer-left" node-id=${vm.id}
  .weight=${weight}>` inside its `<card-frame>`. AsParent tags ignore
  the property -- a parent node has no parent-relative weight until
  the operator drills back out. The button's pre-strand absolute
  corner anchor (`:host { position: absolute; bottom: 0.2rem;
  left: 0.35rem; z-index: 2 }`) retires; card-frame's three-row grid
  positions the footer-left cell exactly where the corner overlay used
  to sit, so the host sits inline as flex content and the inner button
  keeps its `clamp(0.85rem, 5cqmin, 1.6rem)` sizing. The grid's
  `.tile > node-view` / `.tile > plus-tile` carve-out (added in
  \u00a717.52 to stop the absolute button from being forced to fill
  the tile) collapses back to a single `.tile > *` rule. The grid's
  long-press path drops its `tile.querySelector("weight-edit-button")`
  rect-capture (the button now lives two shadow boundaries below the
  tile) and relies on the popover's pre-existing tile-left-edge
  fallback; the icon-tap path is unaffected. Visual position
  unchanged.
- **URLNode AsChild migrated to `<card-frame>` (\u00a717.136, S12)**.
  The `<url-node-as-child>` per-view wraps its entire render output
  inside the unified template with the molecule's default 22%/12%
  header/footer (small tree-map tile). Slot routing: disabled
  indicator in `icons` (was the title's `firstElementChild`
  pre-strand), title text in `title` (plain `<h2 slot="title">`,
  stamped directly), empty `.subtitle` placeholder in `subtitle`,
  the QR `.value-area` (image / warning-fill) in `body`. No
  timestamp \u2014 URLNode is a snapshot leaf. Closes out the
  URLNode kind end-to-end AND the per-(kind,role) migration loop
  end-to-end (S1\u2192S12; only S13's cutover remains \u2014 fill
  `header-actions` + `footer-left` slots, retire legacy
  `<parent-identity-strip>` + `<children-grid>` corner overlay,
  update `<tree-map-screen>` + Templates showcase tier).
- **URLNode AsParent migrated to `<card-frame>` (\u00a717.136, S11)**.
  The `<url-node-as-parent>` per-view wraps its entire render output
  inside the unified template with `--card-header-height: 14%` +
  `--card-footer-height: 8%` (focused-panel host). Slot routing:
  disabled switch in `icons`, inline-editable `<h1>` in `title`,
  empty `.subtitle` placeholder in `subtitle`, the §17.121j
  split-body row (QR `.metric-pane` LEFT + §17.123 clickable URL
  `.description` aside RIGHT) in `body`. No timestamp \u2014 URLNode
  is a snapshot leaf so `footer-right` stays empty (same as
  PictureNode AsParent). Retired CSS: the `:host` column-flex
  wrapper + `.title { flex: 0 0 auto }` (card-frame's three-row
  grid drives the vertical layout now).
- **PictureNode AsChild migrated to `<card-frame>` (\u00a717.136, S10)**.
  The `<picture-node-as-child>` per-view wraps its entire render
  output inside the unified template with the molecule's default
  22%/12% header/footer (small tree-map tile). Slot routing:
  disabled indicator in `icons` (was the title's `firstElementChild`
  pre-strand), title text in `title` (the per-view stamps its own
  `<h2 slot="title">` directly, dropping the `renderStaticTitle`
  helper route), empty `.subtitle` placeholder in `subtitle`,
  `.value-area` (image / warning-fill) in `body`. No timestamp \u2014
  PictureNode is a snapshot leaf so `footer-right` stays empty.
  Closes out the PictureNode kind end-to-end \u2014 both
  `<picture-node-as-parent>` (S9) and `<picture-node-as-child>` (S10)
  now share the unified `<card-frame>` primitive.
- **PictureNode AsParent migrated to `<card-frame>` (\u00a717.136, S9)**.
  The `<picture-node-as-parent>` per-view wraps its entire render
  output inside the unified template with the focused-panel sizing
  (`--card-header-height: 14%; --card-footer-height: 8%`). Slot
  routing: disabled switch in `icons`, inline-editable title in
  `title` (via `<div slot="title">` wrapper around the
  `InlineTitleEditController` h1), empty `.subtitle` placeholder
  in `subtitle`, `.value-area` (image / warning-fill) in `body`.
  No timestamp \u2014 PictureNode is a snapshot leaf so
  `footer-right` stays empty. The shared `renderPictureValueArea()`
  helper grows an optional `slot` trailing parameter so the
  value-area can be stamped directly as a card-frame slot child
  (AsChild still calls without it pre-S10).
- **Lucide `weight` + `pencil` swap (\u00a717.136, S0a-followup)**.
  The child-tile weight-edit corner icon switches from Lucide
  `dumbbell` to Lucide `weight` (a cast-iron foundry silhouette
  with U-handle that closes the iconography loop on the same
  shape the \u00a717.52-polish hand-drawn SVG shipped four years
  ago), and the focused-card edit-pencil button switches from
  Lucide `pencil-line` to Lucide `pencil` (single graphite
  pencil silhouette without the underline-decorated edit
  cursor variant). Both swaps are pure name-attribute flips;
  no sizing or behaviour change.
- **WorkflowNode AsChild migrated to `<card-frame>` (\u00a717.136, S8)**.
  The `<workflow-node-as-child>` per-view wraps its entire render
  output inside the unified template with the molecule's default
  22%/12% header/footer (small tree-map tile). Slot routing:
  disabled indicator in `icons`, title text in `title`, \u00a717.117
  status badge in `subtitle`, markdown `.md-body` value-area in
  `body`, \u00a717.18 timestamp in `footer-right`. The per-view stamps
  its own `<h2 slot="title">` now (drops the `renderStaticTitle`
  helper route). Closes out the WorkflowNode kind end-to-end \u2014
  both roles now share the same card primitive.
- **WorkflowNode AsParent migrated to `<card-frame>` (\u00a717.136, S7)**.
  The `<workflow-node-as-parent>` per-view wraps its entire render
  output inside the unified template with the focused-panel sizing
  (`--card-header-height: 14%; --card-footer-height: 8%`). Routes
  the disabled switch into `icons`, the inline-editable title into
  `title` (wrapped via the same `<div slot="title">` pattern S3
  uses with `InlineTitleEditController`), the \u00a717.121f
  status-badge picker into `subtitle`, the markdown value-area into
  `body`, and the \u00a717.18 timestamp into `footer-right`. The
  pre-\u00a717.30 `:host { position: static }` strip-escape retires
  (the timestamp lives in card-frame's footer-right slot in
  natural flow now).
- **TextNode AsChild migrated to `<card-frame>` (\u00a717.136, S6)**.
  The `<text-node-as-child>` per-view wraps its entire render
  output inside the unified template with the molecule's default
  22%/12% header/footer (small tree-map tile, defaults apply).
  Slot routing: disabled indicator in `icons` (TextNode has no
  aggregation flag), title text in `title`, \u00a717.121j placeholder
  in `subtitle`, \u00a717.27 markdown `.md-body` value-area in `body`,
  \u00a717.18 timestamp in `footer-right`. Closes out the TextNode
  kind end-to-end \u2014 both roles now share the same card primitive.
- **TextNode AsParent migrated to `<card-frame>` (\u00a717.136, S5)**.
  The `<text-node-as-parent>` per-view wraps its entire render
  output inside the unified template with the same focused-panel
  sizing the BSC AsParent / Computed AsParent migrations use
  (`--card-header-height: 14%; --card-footer-height: 8%`). Slot
  routing: disabled switch in `icons` (TextNode has no aggregation
  flag), title text in `title`, \u00a717.121j placeholder in `subtitle`,
  \u00a717.27 markdown `.md-body` value-area in `body`, \u00a717.18 timestamp
  in `footer-right`. The pre-\u00a717.30 `:host { position: static }`
  strip-escape retires (the timestamp lives in card-frame's
  footer-right slot in natural flow now); the `--strip-gutter-right`
  escape on the inline title-edit's `max-width` retires too (the
  title cell sits inside card-frame's title row sibling to
  `header-actions`, so the operator's typed text never runs under
  the close-X / edit-pencil affordances by construction).
- **Computed AsChild migrated to `<card-frame>` (\u00a717.136, S4)**.
  Both `<computed-card>` and `<computed-business-score-card>`
  AsChild renders wrap every slot filler inside the unified
  template with the molecule's default 22%/12% header/footer
  (small tree-map tile, defaults apply): disabled indicator +
  sigma badge in `icons`, unit chip in `unit`, title in `title`,
  read-only kind label in `subtitle`, value-area / warning-fill
  in `body`, timestamp in `footer-right`. The `footer-left` slot
  stays empty until S13 cuts over the weight button. The CBSN
  host-level flex-column override + metric-pane fill rules
  retire (card-frame's grid layout now owns the host's row
  sizing); only the `.value-area { height: 100% }` pin survives
  because the value-area is nested one level deeper on CBSN
  than on the plain Computed card. Closes out the Computed kind
  end-to-end \u2014 both roles now share the same card primitive.
- **Computed AsParent migrated to `<card-frame>` (\u00a717.136, S3)**.
  Both `<computed-card>` and `<computed-business-score-card>`
  AsParent renders wrap every slot filler inside the unified
  template: disabled switch + sigma badge in `icons`, editable unit
  chip in `unit`, inline-editable title in `title`, strategy picker
  in `subtitle`, value-area / metric-pane in `body`, CBSN timestamp
  in `footer-right` (plain Computed AsParent has no timestamp).
  AsChild rendering keeps its pre-\u00a717.136 flat layout until S4
  migrates it. Behavioural follow-on: the sigma aggregation badge
  now stays visible while the operator edits the title (was hidden
  pre-\u00a717.136 because badge composed into the title's prefix slot,
  which the editor dropped on edit).
- **BSC AsChild migrated to `<card-frame>` (\u00a717.136, S2)**.
  The `<business-score-card-as-child>` per-view now wraps every
  slot filler inside the unified `<card-frame>` template:
  disabled indicator + sigma badge in `icons`, unit chip in `unit`,
  title in `title`, value-area in `body`, timestamp in
  `footer-right`. The `footer-left` slot stays empty until S13
  cuts over the `<weight-edit-button>` (currently a corner-overlay
  affordance on `<children-grid>`). The shared `tileLayoutStyles`
  still pins the §17.18 absolute corner-anchor for callsites that
  haven't migrated yet; the per-view overrides locally so its own
  slotted timestamp sits in card-frame's natural footer flow.
- **BSC AsParent migrated to `<card-frame>` (\u00a717.136, S1)**.
  The `<business-score-card-as-parent>` per-view now wraps every
  slot filler inside the unified `<card-frame>` template:
  disabled-toggle + sigma badge in the `icons` slot, unit chip in
  the `unit` slot, title in the `title` slot, metric-pane + optional
  description aside (with every \u00a717.45/\u00a717.46/\u00a717.48/\u00a717.49 entering
  animation preserved) in the `body` slot, timestamp in the
  `footer-right` slot. The `header-actions` + `footer-left` slots
  stay empty until S13 cuts over the close-X / edit-pencil
  affordances (off `<parent-identity-strip>`) and the weight button
  (off the `<children-grid>` corner overlay) into them. Visually the
  focused-panel BSC tile reads identically to pre-\u00a717.136 \u2014 the
  layout primitive is now shared, not bespoke.

### Added

- **`<card-frame>` molecule \u2014 shared header / body / footer
  template (\u00a717.136, S0b of the unified card-template refactor)**.
  The single layout primitive every node-kind organism will wrap
  its render in (S1-S12). Exposes eight named slots arranged in a
  three-row CSS grid: a header (panel-relative height, default
  `22 %`) with a title row carrying `icons` + `unit` + `title` +
  `header-actions` sub-slots plus a `subtitle` slot below it; a
  body that fills the remaining space and clips overflow; a footer
  (default `12 %`) anchoring `footer-left` (weight button on
  AsChild) and `footer-right` (age) at opposite edges. No
  production callsite is migrated yet \u2014 strands S1-S12 do that;
  S13 cuts over the affordances + retires `<parent-identity-strip>`
  + the `<children-grid>` corner-overlay weight button. Surfaces
  in the design-system showcase under Molecules with a 14-rem-tall
  demo stage showing every slot filled.

### Changed

- **Weight edit button icon swapped from Lucide `scale` to Lucide
  `dumbbell` (§17.136, S0a of the unified card-template refactor)**.
  Operator instruction — *"Replace the scale by a weight icon from
  lucide."* The corner-icon affordance on every child tile (§17.52)
  now renders the dumbbell Lucide SVG instead of the balance-scale
  one; the §17.132 `scale` slug is retired from `ICON_REGISTRY`.
  Closes the iconography loop opened by the §17.52 first-cut
  dumbbell that was retired on operator follow-up four years ago.
  No CSS / sizing change — the existing `font-size: clamp(...)` chain
  drives the new SVG box the same way it drove the old one.

### Removed

- **Retired-Unicode-glyphs tombstone block from the design-system
  showcase (§17.135)**. The §17.133 Atoms-tier section that listed
  the five retired Unicode codepoints (`U+25CE` / `U+26A0` /
  `U+29B8` / `U+00D7` / `U+2713`) alongside their Lucide
  replacements — kept after the §17.131 / §17.133 strands as a
  codepoint-search breadcrumb — is gone. The Lucide library
  section one level down already renders every replacement icon
  as a first-class `<ds-icon>` mount with its slug, so the
  tombstone was strictly redundant. The showcase's Atoms tier now
  collapses to four sections: colours, trend arrows, the Lucide
  icon library, and the PDCA workflow status colours.

### Changed

- **Close-X CSS-pseudo bar pairs migrated to the `<ds-icon>` Lucide
  atom (§17.134, L3b — 4-strand migration COMPLETE)**. The two
  remaining CSS-pseudo close-X constructions on the kiosk — the
  `.modal-close-x` button on every shipping modal (About,
  BoardsPanel, BoardSettings, AddChild, EditNode) AND the
  `.close-x` close-to-parent button on the focused-panel parent
  strip — now host a `<ds-icon name="x">` Lucide SVG child instead
  of a pair of bars rotated 45° via `::before` / `::after`. The
  button geometry, hit zone, hover / focus / active states, and
  click-handler wiring are unchanged so every cancel / backdrop /
  Escape path keeps working through the same `data-testid` chain.
  The §17.24 chunky plus-tile cross (the "add child" affordance)
  and the §17.116c value-stepper bars (the inline `+` / `-`
  buttons on BSC AsParent) deliberately stay CSS-only — they are
  hero affordances that communicate by their size and position
  rather than reading as catalogue close icons, and the operator
  locked that carve-out in the §17.131 scope. Every Unicode glyph
  that the kiosk used to render is now a `<ds-icon>` from the
  Lucide registry; the migration plan (L1 foundation → L2 inline
  glyphs → L3a CSS-pseudo glyphs → L3b close-X pairs) is complete
  end-to-end.
- **CSS-pseudo glyphs migrated to the `<ds-icon>` Lucide atom (§17.133,
  L3a of 4-strand migration)**. The six remaining Unicode codepoints
  that rendered via CSS `::before { content: "\u…" }` rules on the
  kiosk are now real `<ds-icon name="…">` Lucide SVG children inside
  their existing wrapper elements: the bullseye on the BSC target row,
  the deadline-risk warning on the BSC target row + the cannot-compute
  warning-fill on Computed / Picture / URL tiles, the forbidden-sign
  on the `.disabled-indicator` (AsChild role on every node kind), and
  the `×` / `✓` glyphs on the `.disabled-switch` (AsParent role on
  every node kind). The wrapper elements' `data-testid` + `role` +
  `aria-label` + inline `color:` chains are unchanged so every
  existing selector + the §17.44 yellow → orange → red deadline-risk
  colour ramp keep working untouched — only the glyph source moves
  from a system-font Unicode codepoint into a Lucide SVG. The
  design-system showcase's kiosk-glyph grid is retired in favour of a
  tombstone block that maps each retired codepoint (`U+25CE`,
  `U+26A0`, `U+29B8`, `U+00D7`, `U+2713`) to its Lucide replacement
  so an operator searching by codepoint still lands on a result. The
  close-X CSS-pseudo bars on modal frames + the focused-panel
  parent-strip will migrate next (§17.134 / L3b); the §17.24 chunky
  plus-tile cross + §17.116c value-stepper bars deliberately stay
  CSS-only per the §17.131 operator-locked scope.
- **Inline-Lit glyphs migrated to the `<ds-icon>` Lucide atom (§17.132,
  L2 of 4-strand migration)**. The five BSC trend arrows (↑ ↗ → ↘ ↓ on
  `<business-score-card-as-parent>`, `<business-score-card-as-child>`,
  and `<computed-business-score-card>`), the Σ aggregation badge (on
  both BSC roles + both `<computed-card>` / `<computed-business-score-card>`
  title prefixes), the §17.130 scales icon on `<weight-edit-button>`,
  the §17.130 crayon icon on `<parent-identity-strip>`'s edit-pencil
  button, and the two `×` buttons inside the design-system showcase
  (top-bar search-clear + `</>` snippet-panel close) now render via
  `<ds-icon name="…">` from the §17.131 Lucide registry instead of a
  Unicode codepoint interpolated into the Lit template. The visual
  shape is unchanged on every platform that already had the right
  system symbol font; on iOS / older Android (where the trend arrows
  + scales used to drift into the system emoji font's coloured
  rendering), the glyphs are now guaranteed monochrome and inherit
  `currentColor` consistently. The design-system showcase's
  Atoms-tier trend-arrow grid and kiosk-glyph grid track the swap:
  the trend cells now render the Lucide SVGs keyed by slug, and the
  scales + crayon entries leave the kiosk-glyph grid (they no longer
  render a Unicode glyph anywhere on the kiosk). CSS-pseudo
  `content:` glyphs (target / warning / forbidden / off-switch ×
  / on-switch ✓) and the close-X CSS-pseudo bars on modal frames
  stay as-is for now; the §17.133 / §17.134 follow-up strands (L3a
  + L3b) will migrate those next.

### Added

- **Lucide icon-library foundation — `<ds-icon>` atom + license attribution
  (§17.131, L1 of 4-strand migration)**. Adds `lucide-static@1.16.0` as a
  runtime dependency + a new atomic-design atom `<ds-icon>` at
  `src/adapters/ui/atoms/icon/Icon.ts` backed by a frozen `ICON_REGISTRY`
  of 14 Lucide slugs (`target`, `triangle-alert`, `sigma`, `ban`, `x`,
  `check`, `scale`, `pencil-line`, `plus` + the 5 trend arrows
  `arrow-up` / `arrow-up-right` / `arrow-right` / `arrow-down-right` /
  `arrow-down`) imported via Vite's `?raw` query so only the registered
  slugs ship in the bundle. Decorative by default (`aria-hidden`,
  `role="presentation"`); set `label` to switch to
  `role="img" aria-label=…`. The Atoms tier of the design-system
  showcase grows an "Icon library — Lucide (`<ds-icon>`)" section
  listing every registered slug + an attribution link to lucide.dev.
  The About modal grows an **Open-source notices** row linking to
  `THIRD_PARTY_LICENSES.md` (new file at the repo root, mirrors the
  full Lucide ISC + Feather MIT texts verbatim). No callsite migration
  in this strand — the existing §17.130 Unicode glyphs continue
  rendering as-is; follow-up strands migrate inline-Lit glyphs (L2),
  CSS-pseudo `content:` glyphs (L3a) and close-X buttons (L3b). The
  §17.24 chunky plus-tile cross + the §17.116c value-stepper bars
  are deliberately kept as CSS-only constructions per operator
  decision (they're hero affordances, not catalogue icons).
- **Design-system showcase, reachable from About (§17.127 strand A1)**.
  The About modal grows an "Open design system…" button that opens a
  new full-screen `<design-system-page>` overlay with a five-tier nav
  (Atoms / Molecules / Organisms / Templates / Pages). Strand A1 ships
  the foundation only — tier bodies are "Coming soon" placeholders;
  the §17.127.2 → §17.127.6 follow-ups fill each tier one at a time
  so every merge stays under the local `new_lines > 300` Sonar gate.
  Dismissal: "Back to kiosk" button or Escape.
- **Atoms tier of the design-system showcase (§17.127 strand A2)**.
  The first tier is now real: five colour swatches sourced from
  `src/index.css` (`--bg`, `--panel`, `--text`, `--muted`, `--accent`),
  the five trend-arrow glyphs sourced from BSC `valueTemplate.ts`
  (↑ ↗ → ↘ ↓), the kiosk's other Unicode glyphs (bullseye, warning,
  sigma, forbidden, times, check) with their U+ codepoints labelled,
  and the four PDCA workflow status badges sourced from
  `DEFAULT_WORKFLOW_STATUSES` (PLAN / DO / CHECK / ACT).
- **Molecules tier of the design-system showcase (§17.127 strand A3)**.
  The second tier now mounts the kiosk's real view-layer molecule
  helpers: `renderUnitChip` (three states: USD, %, empty → nothing),
  `renderStatusBadge` for each PDCA status (PLAN / DO / CHECK / ACT),
  `renderDisabledIndicator(true)` (the forbidden glyph), and
  `renderDisabledSwitch` in both enabled + disabled states. The
  showcase host silences the `value-node-disabled-change` event bubbled
  by the live switch so a click in the showcase doesn't reach
  `main.ts`'s screen listener.
- **Cast-iron-weight glyph promoted to an atom + child-weight
  affordances surfaced on the design-system showcase (§17.129)**.
  The §17.52 cast-iron-weight SVG icon used by `<weight-edit-button>`
  on every child tile is lifted into its own atom
  (`atoms/weightGlyph.ts → renderWeightGlyph()`), so the design-system
  showcase can demo it next to the other glyph primitives. The Atoms
  tier grows an "Cast-iron-weight glyph" section. The Molecules tier
  grows a "Child weight affordances (childWeight/\*)" section showing
  the `<weight-edit-button>` corner icon beside the live
  `<weight-edit-popover>` panel (mounted open at `.weight=2.5`, with
  a `position: static` override so the otherwise viewport-fixed panel
  flows inline). The `inline-edit-weight` bubbled event joins the
  showcase host's silenced list so a Confirm tap-through doesn't
  reach `main.ts`'s `EditNodeService.editFields` path. Reachable from
  About → Open design system → Atoms / Molecules.
- **Design-system showcase — "View source" snippet fill (§17.127 strand P3b)**.
  Completes P3. Every one of the 16 sections in the showcase now has
  a `</>` button surfacing its canonical render snippet via the
  popover from P3a. Snippets are centralised in a single
  `SNIPPETS: Record<string, string>` map at the top of the showcase
  module; adding a new section to the showcase is one entry in the
  map plus one `section()` call in the relevant render method.
- **Design-system showcase — "View source" snippet popover (§17.127 strand P3a, scaffolding)**.
  Each design-system section can now expose a `</>` button (top-right
  of the section heading) that opens a modal popover showing the
  canonical render snippet for that section, with a "Copy" button
  (writes to the clipboard when the API is available) and a close
  affordance (×, ESC, or click on the dim backdrop). ESC closes the
  popover before falling through to closing the showcase page. This
  strand ships the scaffolding plus one wired demo on the Molecules
  "Unit chip" section; the remaining 15 sections gain their snippets
  in strand P3b.
- **Design-system showcase — top-bar search filter (§17.127 strand P2)**.
  The design-system page now has a search input next to its "Back to
  kiosk" button. Typing filters every section in the current tier by
  case-insensitive substring match against the section's keyword
  haystack (heading + helper / glyph / event names). A clear `×`
  button reveals when the query is non-empty; a per-tier empty-state
  panel appears when no section matches. The query persists across
  tier switches.
- **Pages tier — live `<tree-map-screen>` (§17.127 strand A6)**.
  Closes out the §17.127 A-series sweep. The Pages tier mounts the
  kiosk's real outer page surface (`<tree-map-screen>`) inside the
  design-system showcase, bound to a synthesized `FocusedTreeViewModel`
  ("Quarterly revenue" focused on its child grid), a 3-segment
  breadcrumb ("Obeya / Reliability / Quarterly revenue"), and a
  friendly board name ("Design system demo"). Every bubbled UI event
  the embedded screen surfaces is already silenced at the showcase
  host so taps stay inside the page. Every tier of the design-system
  page (Atoms → Pages) now has a real, non-placeholder body.
- **Templates tier — focused panel composition (§17.127 strand A5)**.
  Mounts the real `<parent-identity-strip>` (focused VM in AsParent
  role + edit-pencil + close-X) above a real `<children-grid>`
  (squarified treemap of 3 sample child slots + a trailing `+`
  affordance) inside the Templates tier. All four bubbled events
  unique to this composition — `focus-close-to-parent`,
  `edit-node-open`, `tile-drill`, `weight-edit-open` — are silenced
  at the showcase host.
- **Organisms tier — node half: Picture + URL (§17.127 strand A4b-4)**.
  Live `<picture-node-as-parent>` + `<picture-node-as-child>`
  ("Architecture diagram" rendered from an inline data-URL SVG so the
  demo stays offline-safe) and `<url-node-as-parent>` +
  `<url-node-as-child>` ("Runbook" pointing at `example.org`, surfaced
  via the QR encoder + the §17.123 clickable anchor aside). Completes
  the A4b node-tier sweep — all 6 visible node kinds (BSC, Computed,
  CBSN, Text, Workflow, Picture, URL) now mount inside the Organisms
  tier.
- **Organisms tier — node half: Text + Workflow (§17.127 strand A4b-3)**.
  Live `<text-node-as-parent>` + `<text-node-as-child>` ("Retro
  note" demo) and `<workflow-node-as-parent>` + `<workflow-node-as-child>`
  ("Postmortem follow-up" with PDCA `DO`) mount inside the Organisms
  tier. The WorkflowNode AsParent surfaces its inline PDCA picker
  live; the bubbled `workflow-status-change` event is silenced at
  the showcase host.
- **Organisms tier — node half: Computed cards (§17.127 strand A4b-2)**.
  Live `<computed-card>` (SUM-strategy ComputedNode in AsParent
  role, "Pager hours saved" demo) and `<computed-business-score-card>`
  (WEIGHTED_AVERAGE CBSN AsParent, "Customer-impact score" demo
  with objective row) mount inside the Organisms tier. The strategy
  picker on each tile is live but the bubbled
  `computation-kind-change` event is silenced at the showcase host.
- **Organisms tier — node half: BSC (§17.127 strand A4b-1)**. The
  live `<business-score-card-as-parent>` and `<business-score-card-as-child>`
  elements mount inside the Organisms tier with realistic VMs
  sourced from a new `sampleViewModels.ts` helper: an "on-track"
  AsParent (recordedValue above objective, trend arrow `up-right`)
  and an "off-track" AsChild (computedMean below objective, warning
  glyph + `down-right` arrow). Inline-edit affordances (title /
  value / unit) stay inert because the showcase host silences the
  matching bubbled events.
- **Organisms tier — shell half (§17.127 strand A4a)**. Three real
  Lit elements now mount inside the Organisms tier of the showcase:
  `<burger-menu>` (live trigger + popup), `<focus-breadcrumb>` (a
  three-segment demo path Obeya → Reliability → Pager fatigue), and
  `<plus-tile>` (the dashed "add child" affordance, sized to a 120px
  square in-cell stage). The host's `SILENCED_BUBBLES` extends to
  include `burger-menu-action`, `breadcrumb-navigate`, and
  `plus-tile-activate` so showcase interactions never reach the live
  app handlers. The node-tile half of the Organisms tier lands as
  A4b.

### Changed

- **Affordance icons switched to Unicode glyphs (§17.130)**. Two
  long-standing affordances now render their icon as a Unicode
  codepoint instead of a custom artwork:
  - The **child-tile weight knob** (`<weight-edit-button>`, bottom-
    left corner of every child tile) now renders **⚖** (U+2696 SCALES)
    instead of the §17.52 cast-iron-weight SVG. The dedicated SVG
    helper module is retired.
  - The **focused-card edit button** (the pencil button on the
    parent identity strip, opens the Edit-node modal) now renders
    **🖍** (U+1F58D LOWER LEFT CRAYON) instead of the §17.28 CSS-pseudo
    pencil construction. Behaviour and event dispatching are
    unchanged on both affordances.
  Both glyphs use the U+FE0E text-presentation variation selector so
  they inherit the kiosk's text color rather than the system emoji
  palette where possible. Both new codepoints surface in the design-
  system showcase's Atoms → Kiosk Unicode glyphs grid.
- **The unit chip is now inline-editable on the focused panel (§17.126)**.
  Click the `(unit)` chip in the title row of a focused Business
  Score Card or Computed Business Score Card to swap it for a one-
  line input; Enter or blur commits, Escape cancels. Same click-
  to-edit UX as the title, value, and weight inline editors. The
  click on the chip stops at the chip itself, so editing the unit
  does NOT also enter title edit. Empty units are accepted (a
  metric can be unit-less — e.g. "raw count"). Tree-map (child)
  tiles keep the chip read-only so the click-to-drill gesture in
  the grid is preserved.
- **Sonar `projectVersion` double bump `0.2.80 → 0.2.81 → 0.2.82`
  rides the §17.126a + §17.126b by-element split**. The strand
  was sliced on the operator's "split" call at the first gate
  run (the unsliced strand reported `new_lines: 492 / 300`). An
  initial source/test split was rejected because §17.126a alone
  fell to `new_coverage: 52.6 %` (the tests for the new
  controller lived in §17.126b); re-sliced by element so each
  half ships source + matching tests + its own leak-window bump.
  §17.126a (BSC AsParent + shared infra) bumps `0.2.80 → 0.2.81`;
  §17.126b (Computed* wiring + docs) bumps `0.2.81 → 0.2.82` so
  the leak window resets between the two master pushes — each
  push is one Sonar analysis, and without the second bump the
  §17.126b scan would re-see §17.126a's lines against the 0.2.80
  baseline. Same `PREVIOUS_VERSION`-mode reasoning as §17.124 /
  §17.125.
- **Unit reads as a `(unit)` chip on the BSC + CBSN tile title (§17.125)**.
  The unit moves from the under-the-value `.unit-below` block to a
  subtle parenthesised chip immediately to the left of the title
  text on every BSC + CBSN tile (both child + focused-panel roles).
  Frees the under-value space for the target row + timestamp and
  anchors the unit to the metric's identity — operators read "Revenue
  (USD)" / "On-time delivery (%)" the same way they write it. The
  chip is hidden automatically while the title is being inline-edited
  (same prefix-disappears-during-edit behaviour as the Σ badge and
  the enable/disable switch).
- **Sonar `projectVersion` bump `0.2.79 → 0.2.80` rides the §17.125
  strand**. Same `PREVIOUS_VERSION` pattern as §17.124's 0.2.78 →
  0.2.79 — every new strand on top of a prior strand-attached bump
  must also bump again to actually reset the leak window.
- **Sonar `projectVersion` bump `0.2.78 → 0.2.79` rides the §17.124 strand**.
  Lesson captured from the §17.122-leakwindow-2 0.2.78 reset: a
  bump-only commit does NOT establish a new
  `PREVIOUS_VERSION` baseline for subsequent same-version scans,
  so every new strand on top of a bump-only commit must also
  bump the version again to actually reset the leak window. See
  the `sonar-project.properties` version-history block for the
  full rationale.
- **Computed-card titles are now inline-editable on the focused panel (§17.124)**.
  Closes the last parity gap in the inline-title-edit family
  (§17.28 / §17.50 / §17.117 / §17.118 / §17.120). On the focused
  panel both `<computed-card>` and `<computed-business-score-card>`
  let the operator click the title to swap it for a one-line
  input — Enter commits, Escape cancels, blur commits — same UX
  as every other parent-strip tile. The §17.121i left-of-title
  enable/disable switch and the §17.116 Σ aggregation badge stay
  in place as a single prefix while the title is at rest and
  disappear automatically while the input is open, so the visual
  chain reads `[switch][Σ]Title` exactly as today. Tree-map
  (AsChild) Computed tiles keep their static read-only title so
  the click-to-drill gesture in the grid is preserved.
- **URL card focused-panel description is now a real clickable link (§17.123)**.
  The URL text next to the QR code on the focused-panel
  `<url-node-as-parent>` tile is now wrapped in an anchor that
  opens the destination in a new tab (`target="_blank"
  rel="noopener noreferrer"`). On a desktop kiosk the QR is
  redundant if the operator already has the device in hand — a
  tap on the URL string now opens the link directly. Underline
  opacity bumps to full on `:hover` / `:focus-visible` so
  keyboard users get the same affordance signal as mouse users.

### Added

- **Disabled state surfaces as a left-of-title gold pill on every tile, with an interactive toggle on the focused panel (§17.121i)**.
  Operator-requested refresh of §17.121g + §17.121h. On the
  tree-map (AsChild) tile a node's `disabled` flag now shows up as
  a compact gold pill rendered at the LEFT of the title (mirrors
  the §17.121f ACT status pill colour); when enabled, nothing
  renders. The §17.121g strike-through + value-area dim are
  retired so the operator can keep reading the tile content
  untouched. On the focused panel (AsParent) the §17.121h
  "Active / Disabled" subtitle pill is replaced with a real
  `<button role="switch">` toggle button positioned at the SAME
  left-of-title slot — sliding knob, `aria-checked` driven by the
  current state, click flips the boolean through the existing
  `value-node-disabled-change` → `EditNodeService.editFields`
  pipeline. Visual parity across the read + write roles is now a
  direct consequence of using one shared `disabledToggleStyles`
  rule for both surfaces. The `ACT` workflow status colour also
  shifts from amber-600 (`rgb(217, 119, 6)`) to amber-500
  (`rgb(245, 158, 11)`) — a warmer, more yellow gold that reads
  unambiguously distinct from "alert red" on every kiosk display
  the operator tested.

- **Inline enable/disable toggle pill on the focused panel (§17.121h, write-side)**.
  Closes the loop on §17.121g: every focused-panel (AsParent) tile
  now hosts a single tap-to-toggle pill in the shared `.subtitle`
  slot that flips the v5 round-7 `ValueNode<T>.disabled` flag
  through `EditNodeService.editFields({ kind, disabled })`. The
  service applies `ValueNode.setDisabled` uniformly across kinds
  (§17.99a) so the routing in `main.ts` is kind-agnostic on the
  application side. The pill mirrors the §17.117 status-badge
  shape (rounded rectangle, transparent background, coloured
  border + text + dot) and toggles between an "Active" (green)
  and "Disabled" (warm gold, §17.121f ACT colour) state. On the
  WorkflowNode and Computed* AsParents the pill sits next to the
  pre-existing status / strategy picker — the shared `.subtitle`
  row gained a small flex `gap` so the two pills breathe. The
  AsChild tree-map tile intentionally does NOT carry the pill —
  the §17.121g strike + dim already signals state at-a-glance,
  and adding a second affordance would crowd the small tile. The
  loop is now end-to-end: tap → state flips → mapper re-bakes →
  tree-map repaints with the §17.121g strike + dim.

- **Disabled-node visibility in the tree-map (§17.121g, read-side)**.
  The v5 round-7 `ValueNode<T>.disabled` flag (§17.99a) was a
  domain-only concept until now — every node carried it, no view
  read it. The new strand surfaces it on every value VM (TextNode,
  WorkflowNode, BSC, ComputedNode, ComputedBusinessScoreNode,
  PictureNode, URLNode) and the AsChild tree-map tile paints a
  strike-through title + dimmed value-area when the node is parked.
  The AsParent (focused-panel) tile intentionally stays at full
  opacity so the operator can still read + edit the disabled node.
  Implemented as a shared `[data-disabled]` attribute selector in
  `tileLayoutStyles.ts` so adding the visual rule to a future kind
  is a one-line `?data-disabled=${vm.disabled}` template change.
  The §17.121h follow-on strand adds the inline operator-facing
  write affordance (an editable pill on the focused panel).

- **Inline status editing on the focused WorkflowNode tile**
  (§17.121f). The §17.121e subtitle slot's read-only status badge
  on `<workflow-node-as-parent>` becomes an editable `<select
  class="status-badge-picker">` populated from the focused board's
  full `workflowStatuses` table (baked into the VM at map-time as a
  new `availableStatuses` field). A change on the picker dispatches
  a bubbling, composed `workflow-status-change` event with
  `{ nodeId, newStatusId }`; the composition root in `main.ts`
  routes it to `EditNodeService.editFields({ kind: "Workflow",
  statusId })` — atomic + persister-rolled-back, mirror of the
  §17.110 `computation-kind-change` wiring. The picker's pill
  styling reuses the badge's coloured-border / coloured-text
  contract so the visual at idle is unchanged. AsChild keeps the
  read-only badge (child tiles never expose inline editors). A
  board-less VM (empty `availableStatuses`) gracefully degrades the
  picker back to the read-only badge so unit fixtures don't break.

### Changed

- **Added an optional `.subtitle` slot directly under the tile
  title for cards that surface a domain property at a glance**
  (§17.121e). Two card kinds opt into the new slot:
  - `WorkflowNode` (AsChild + AsParent) — the status badge moves
    out of its pre-§17.121e absolute bottom-left corner and into
    the centered subtitle row directly under the title. Operator
    eye-path now reads "title → status → value → date" top-to-
    bottom instead of having to scan the four corners of the
    tile. The badge keeps its coloured border + text styling
    (transparent background, `--status-color` from the
    mapper-baked `vm.status.color`) and remains presentational
    (pointer-events: none) — status edits still go through the
    Edit-node modal. The AsParent role keeps its
    `:host { position: static }` override for the timestamp's
    outer-corner escape; the badge no longer depends on it.
  - `ComputedNode` + `ComputedBusinessScoreNode` (both roles) —
    the active computation kind is surfaced as the subtitle
    content. **AsChild** renders a static `<span class="kind-
    label">` with a short noun-phrase descriptor ("Sum",
    "Average", "Weighted average", …); the §17.116-followup-2
    retirement of the kind-label is reversed in §17.121e
    (operator now sees the strategy under the title on every
    tile, including non-computable warning-fill ones — "we tried
    to SUM but couldn't" rather than a bare warning).
    **AsParent** renders the strategy `<select>` (the existing
    one-tap kind swap) inside the subtitle slot instead of the
    pre-§17.121e absolute top-left corner — the in-flow
    placement reads as part of the tile's identity row and no
    longer crowds the title on narrow panels.

  The slot itself is declared in `tileLayoutStyles` and opt-in
  per view via a `--subtitle-row-height` CSS custom property on
  `:host` (defaults to `0vh`, so every non-opted-in tile —
  TextNode, BSC, StrictRange, Picture, URL — stays pixel-
  identical to the pre-§17.121e rendering). The shared
  `.value-area` height formula reads the var and subtracts it
  from the body region, so the value figure shrinks by exactly
  the slot's height when the slot is in use.

- **Promoted the Add-Child modal's Cancel + Confirm row to a
  full-width panel-level footer** (§17.121d). Pre-§17.121d the
  Cancel + Confirm buttons were emitted inside `renderFormPane`,
  so they sat inside the right-pane column of the modal's two-
  column grid — visually they looked like a per-form sub-control
  rather than the modal's primary commit / abort affordance. The
  panel grid grew a third `auto` row, the actions row was lifted
  into a semantic `<footer class="actions">` at the panel level
  spanning both columns, and the row carries a subtle top
  border for visual separation from the form area. All testids
  (`modal-actions` / `modal-cancel` / `modal-confirm`) are
  preserved at their pre-refactor selectors, so every unit
  test, e2e scenario, and page-object helper that queries
  through them continues to work without touch-ups. Matches the
  full-width footer convention used by the operator's other
  modals and the §17.29 close-X chrome corner.

### Added

- **E2E coverage for the Workflow + Picture + URL Add-Child
  flows** (§17.121c — closes the deferred §17.117 / §17.118 /
  §17.119 / §17.120 coverage gaps). Six new scenarios on
  `add_child_modal.feature` complete the per-kind happy-create
  matrix for the v5 round-7 catalogue. Picking **Workflow**
  reveals title + weight + status picker + current-value + as-of
  date (Workflow is a TextNode + a board-level status badge, so
  it inherits the TextNode current-value row on top of the new
  status `<select>`); confirming with the default `plan` status
  appends and closes. Picking **Picture** reveals title + weight
  + image-url and nothing else (no description, no current-value,
  no unit, objective, range, strategy, or status); confirming
  with a syntactically valid image URL appends. Picking **URL**
  reveals title + weight + url and nothing else; confirming
  with a syntactically valid URL appends. Six new step
  definitions (`the modal has a status picker` + inverse,
  `…has an image-url field` + inverse, `…has a url field` +
  inverse) round out the per-kind assertion library; the
  generic `I set the modal field "<testid>" to "<value>"`
  setter from §17.121b is reused for both image-URL and URL
  fills, no new fill-step plumbing. The Add-Child modal e2e
  coverage now has at least one **picking-reveals-fields** and
  at least one **confirm-and-append** scenario for all 8 kinds
  in `KIND_OPTIONS`.

- **E2E coverage for the Computed + Computed Business Score Card
  Add-Child flows** (§17.121b — follow-up to §17.94 / §17.95).
  Five new scenarios on `add_child_modal.feature`: picking
  **Computed** reveals title + description + weight + strategy
  picker (and suppresses every measurable affordance — no
  current-value, unit, objective, or range — since a Computed
  node's value rolls up from children); confirming a Computed
  child with the default strategy "AVERAGE" appends and closes
  the modal with the focused id unchanged. Picking **Computed
  Business Score Card** reveals the same strategy picker plus
  the BSC's unit + objective row, but the objective row is the
  target-only variant (`field-target` + `field-target-date`, no
  `field-initial` baseline since the rolled-up value carries no
  up-front observation). Swapping from Computed to CBSN
  hot-swaps the form, layering unit + objective rows on top of
  the shared strategy picker. Confirming a minimum-viable CBSN
  seed (title + unit + target + target-date) appends and closes
  the modal. Two new assertion steps (`the modal has a strategy
  picker` + inverse; `the modal has the target-only objective
  fields`) and one parametric setter (`I set the modal field
  "<testid>" to "<value>"`) — the setter generalises the
  long-tail field-fill pattern so future per-kind happy-create
  scenarios cost just a new `data-testid`, no new step plumbing.

- **E2E coverage for the Strict Range Add-Child flow** (§17.121 —
  follow-up to §17.77 / §17.94). `add_child_modal.feature` gains
  three new scenarios: picking **Strict Range** reveals the
  range-min + range-max + current-value + as-of fields and
  suppresses the BSC's unit + objective rows; swapping from a
  Business Score Card to Strict Range hot-swaps the form pane
  without closing the modal; confirming a valid `[0, 100]` range
  with seed `42` appends the child and closes the modal with the
  focused id unchanged. The pre-existing **catalogue scenario**
  is brought back in sync with master — the kind-count assertion
  is bumped `3 → 8` and five new `the modal offers a "<Kind>" kind`
  rows cover Strict Range / Computed / Computed Business Score
  Card / Picture / URL (the catalogue grew through §17.95 /
  §17.118 / §17.119 / §17.120 but the e2e was left behind, so a
  hypothetical e2e run on master had been failing on the count
  assertion). The `the modal offers a "X" kind` step is tightened
  from a `startsWith(label)` substring match against the button's
  full innerText to a strict-equality check against the
  `.kind-btn-name` element so "Computed" no longer ambiguously
  matches "Computed Business Score Card" too.

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
