@HE-2570 @component:views @phase:6
Feature: Tile layout — title 3vh, value fills, unit 1/3, timestamp bottom-right with age gradient (§17.14, §17.18)

  SPEC §17.14 unifies the per-tile layout across both kinds:
    - Title row is fixed at 3 % of the viewport height (`vh`-relative,
      consistent across tiles regardless of tile size).
    - Value occupies the rest of the tile, sized via `cqmin` so it grows
      with the tile up to a clamp ceiling.
    - Numeric values render the unit at exactly 1/3 of the value's
      font-size (`calc(1em / 3)`).
    - The `asOf` timestamp of the current value sits in the tile's
      **bottom-right** corner (§17.18 — moved from top-right so the
      title row uses the full width and the date sits below the
      figure where the eye lands after reading the value),
      absolutely positioned, with a colour interpolated by age
      (§17.42: bright off-white at age 0 → dark grey at age ≥ 30 d;
      §17.21's per-board fresh-end colour was retired here).

  These invariants are layout-only, so we assert via real-browser
  computed styles (jsdom is too lossy for shadow-scoped CSS).

  @HE-2815 @priority:high
  Scenario: Tile titles share a viewport-relative height across all tiles
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    Then every tile title has the same font-size
    And every tile title's font-size is approximately 2vh

  @HE-2816 @priority:high
  Scenario: Numeric value renders the unit (now block-level under the value, §17.116) at roughly 1/3 of the value's font-size
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "ChildB"
    Then the focused value's unit font-size is roughly one third of the value font-size

  @HE-2814 @priority:high
  Scenario: Current-value timestamp is rendered in the bottom-right corner of the tile (§17.18)
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "ChildB"
    Then the focused value-date is in the bottom-right corner of the tile

  @HE-2813 @priority:high
  Scenario: Current-value timestamp colour is age-gradient driven (§17.18 / §17.42 — bright off-white → dark grey)
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "ChildB"
    Then the focused value-date colour is on the warm-to-cold age gradient

  @HE-2812 @priority:high
  Scenario: The figure is substantially bigger than the title on every child tile (§17.17)
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    Then on every child tile the value font-size is at least 3 times the title font-size

  @HE-2811 @priority:high
  Scenario: Child tiles are visually distinguishable from each other (§17.17)
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    Then every child tile has a visible border
    And every child tile has a non-transparent background

  @HE-2810 @priority:high
  Scenario: Parent panel and child tiles share the same panel surface (§17.36)
    # SPEC §17.36 — the parent-identity-strip and every child tile read
    # from the same screen-level CSS custom properties:
    #   --panel-border-color      (identical on both surfaces)
    #   --panel-border-radius     (identical on both surfaces)
    #   --panel-tile-bg           (≈ 7 % currentColor — children only)
    #   --panel-strip-bg          (≈ 12 % currentColor — strip only)
    # The contract is "same border look" (border colour + radius
    # identical, both visible at ≥ 1 px) with a deliberately distinct
    # bg tint so the focused panel still reads as the focused panel.
    # The drill-into morph (§17.36 amendment to §17.32) bridges the
    # 7 % → 12 % bg delta so the tile's surface visually flows into
    # the parent panel as it flies up.
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    Then the parent panel has a visible border
    And the parent panel has a non-transparent background
    And the parent panel border colour matches a child tile border colour
    And the parent panel border-radius matches a child tile border-radius
    And the parent panel background tint differs from a child tile background tint

  @HE-2809 @priority:high
  Scenario: Parent panel timestamp sits at the same offset from its outer edge as a child tile timestamp (§17.30 / §17.45)
    # SPEC §17.30 — the date on the focused panel must visually hug
    # the panel's bottom-right corner at the same distance a child
    # tile's date hugs its tile's bottom-right corner. Pre-§17.30 the
    # parent strip wrapped the per-view element with extra padding
    # (~1.25rem) which pushed the parent date ~1.65rem / ~1.85rem from
    # the panel's outer edge, while the children's dates stayed at
    # ~0.4rem / ~0.6rem. §17.30 piped the timestamp's containing
    # block to the strip's wrapper via `:host { position: static }`
    # so both offsets landed in the same range.
    #
    # SPEC §17.45 amendment — the per-view now splits its body
    # horizontally into a `.metric-pane` (left, holds the value +
    # target row + timestamp) and a `.description` (right, when
    # `vm.description` is non-empty). The metric-pane carries
    # `position: relative`, so the timestamp's containing block is
    # the metric-pane (not the strip's wrapper). The "outer edge"
    # the parity is measured against is therefore the metric-pane's
    # outer edge: with no description the metric-pane fills the
    # strip's body (parity collapses to the pre-§17.45 strip-edge
    # contract); with a description the metric-pane is the LEFT
    # half and the parity holds against that half's outer edge.
    #
    # Default focus on `mixedComputed` is `Root` (computed=true), whose
    # children-derived `dateIso` is the most recent of the children's
    # current-value dates per §17.18 — so the parent strip carries a
    # date AND there are child tiles with their own dates to compare
    # against. Focusing on a leaf (e.g. ChildB) would leave only the
    # plus tile under the strip, with no child date to compare to.
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    Then the focused value-date offset matches a child tile value-date offset within 4 px

  @HE-2808 @priority:high
  Scenario: Parent panel title sits at the same offset from its outer edge as a child tile title (§17.37)
    # SPEC §17.37 — the title on the focused panel must align with
    # the title on a child tile so the drill-into FLIP morph
    # (`drillTransitions.ts`) lands without a visible jump at commit.
    # Pre-§17.37 the parent strip wrapped the per-view in
    # `padding: clamp(0.5rem, 1.5vw, 1.25rem)`, pushing the parent
    # title ~0.5–1.25rem further down and to the right than the
    # child title (which had no `.tile` outer padding, only the
    # per-view's own `:host { padding: 0.4rem 0.6rem }` from
    # `tileLayoutStyles`). Post-§17.37 the strip's outer padding
    # is 0, so both surfaces share the same `1px border + 0.4rem
    # top / 0.6rem left` inset for the title — the morph commits
    # cleanly.
    #
    # Same `mixedComputed` setup as the §17.30 scenario above so
    # both parities can be diagnosed against the same kiosk state
    # (Root focused, ChildB present as a recordedValue child).
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    Then the focused title offset matches a child tile title offset within 4 px

  @HE-2807 @priority:high
  Scenario: Parent BSC value is horizontally centered to its metric pane (§17.39 / §17.45)
    # SPEC §17.39 — when the focused panel renders a BSC node, the
    # centered `.value` span must sit at the metric area's
    # horizontal center, NOT at the padding-right-shrunk content-
    # area's center. Pre-§17.39 the strip's `.strip` wrapper
    # carried `padding-right: clamp(5.5rem, 8vw, 7.5rem)` whenever
    # both the close-X and the edit-pencil were present (§17.37);
    # the per-view's value-area inherited the shrunken width and
    # the centered `.value` snapped left by `gutter / 2` at commit
    # vs. the morph's full-rect end-state — the operator's "value
    # jumping to the left" feedback. The §17.39 fix lifted the
    # gutter literal into a CSS custom property
    # `--strip-gutter-right` and applied a negative `margin-right`
    # on the BSC parent's metric area to cancel it.
    #
    # SPEC §17.45 amendment — the per-view's body now splits into
    # `.metric-pane` (left, holding the value + target row +
    # timestamp) and `.description` (right, when present). When
    # the focused node carries a description the metric-pane is
    # the LEFT half of the strip body, and the centered value sits
    # at the LEFT-half center, not the strip's full center. The
    # negative margin-right is dropped on description bodies
    # (description occupies the would-be right half, so there's no
    # gutter to escape into); without a description the metric-pane
    # fills the body and the negative margin still applies to land
    # the centered value at the strip's full-width center. The
    # invariant the operator cares about is "the value is centered
    # in its container" — the container is the metric-pane in both
    # cases. Focus on `ChildB` (recordedValue BSC, always present
    # in `mixedComputed` — has a description so the metric-pane is
    # the LEFT half of the strip body). Tolerance `2 px` absorbs
    # sub-pixel rounding from the flex / clamp arithmetic.
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "ChildB"
    Then the focused BSC value is horizontally centered to its metric pane within 2 px

  @HE-2806 @priority:high
  Scenario: Long values shrink to fit the tile width (§17.116-followup-3)
    # SPEC §17.116-followup-3 — the `.value` font-size rule's per-
    # character width cap (160cqi / max(2, --char-count)) must keep
    # every rendered value glyph inside the tile body width
    # regardless of digit count. The `longValues` fixture seeds two
    # multi-digit-decimal recorded BSCs (12345.6789 → "12345.68",
    # -987654.32 → "-987654.32") whose rendered glyphs would have
    # overflowed the ~200 px child tiles pre-followup-3 (the
    # legacy flat clamp(1.5rem, 42cqmin, 22rem) rule honoured only
    # the height envelope; with white-space: nowrap defeating wrap,
    # the text spilled the tile's right edge). The width cap +
    # per-VM --char-count inline style now hold the figure inside
    # the tile. Scenario lives at the END of the feature so a
    # potential downstream regression in the new scenario does not
    # mask the pre-existing §17.17 / §17.36 invariants that read
    # from a `mixedComputed` kiosk.
    When I open the kiosk in test mode with empty storage
    And I seed the "longValues" fixture via the test bridge
    And I reload the kiosk
    Then no rendered value overflows its tile horizontally
