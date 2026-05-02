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
      absolutely positioned, with a colour interpolated by age (warm
      orange → cold pale blue).

  These invariants are layout-only, so we assert via real-browser
  computed styles (jsdom is too lossy for shadow-scoped CSS).

  @HE-???? @priority:high
  Scenario: Tile titles share a viewport-relative height across all tiles
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    Then every tile title has the same font-size
    And every tile title's font-size is approximately 2vh

  @HE-???? @priority:high
  Scenario: Numeric value renders the unit at 1/3 of the value's font-size
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "ChildB"
    Then the focused value's unit font-size is one third of the value font-size

  @HE-???? @priority:high
  Scenario: Current-value timestamp is rendered in the bottom-right corner of the tile (§17.18)
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "ChildB"
    Then the focused value-date is in the bottom-right corner of the tile

  @HE-???? @priority:high
  Scenario: Current-value timestamp colour is age-gradient driven (§17.18 — warm orange → cold pale blue)
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "ChildB"
    Then the focused value-date colour is on the warm-to-cold age gradient

  @HE-???? @priority:high
  Scenario: The figure is substantially bigger than the title on every child tile (§17.17)
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    Then on every child tile the value font-size is at least 3 times the title font-size

  @HE-???? @priority:high
  Scenario: Child tiles are visually distinguishable from each other (§17.17)
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    Then every child tile has a visible border
    And every child tile has a non-transparent background

  @HE-2592 @priority:high
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

  @HE-???? @priority:high
  Scenario: Parent panel timestamp sits at the same offset from its outer edge as a child tile timestamp (§17.30)
    # SPEC §17.30 — the date on the focused panel must visually hug
    # the panel's bottom-right corner at the same distance a child
    # tile's date hugs its tile's bottom-right corner. Pre-§17.30 the
    # parent strip wrapped the per-view element with extra padding
    # (~1.25rem) which pushed the parent date ~1.65rem / ~1.85rem from
    # the panel's outer edge, while the children's dates stayed at
    # ~0.4rem / ~0.6rem. Post-§17.30 the per-view's `:host { position:
    # static }` lets the timestamp escape into the strip's positioning
    # context so both offsets land in the same range.
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

  @HE-???? @priority:high
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

  @HE-???? @priority:high
  Scenario: Parent BSC value is horizontally centered to the strip's full width (§17.39)
    # SPEC §17.39 — when the focused panel renders a BSC node, the
    # centered `.value` span must sit at the strip's full-width
    # horizontal center, NOT at the padding-right-shrunk content-
    # area's center. Pre-§17.39 the strip's `.strip` wrapper
    # carried `padding-right: clamp(5.5rem, 8vw, 7.5rem)` whenever
    # both the close-X and the edit-pencil were present (§17.37);
    # the per-view's value-area inherited the shrunken width and
    # the centered `.value` snapped left by `gutter / 2` at commit
    # vs. the morph's full-rect end-state — the operator's "value
    # jumping to the left" feedback. Post-§17.39 the BSC parent's
    # `.value-area` carries a negative `margin-right` that exactly
    # cancels the strip's `padding-right` (via the
    # `--strip-gutter-right` custom property the strip publishes),
    # so the centered value lands at the strip's full-width center
    # — same as the morph end-state, no jump at commit.
    #
    # Focus on `ChildB` (recordedValue BSC, always present in
    # `mixedComputed`) so the strip carries a numeric `.value`
    # span. Tolerance `2 px` absorbs sub-pixel rounding from the
    # negative-margin / clamp arithmetic without admitting a 60-
    # px-class regression (the pre-fix offset was ~half the
    # gutter).
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "ChildB"
    Then the focused BSC value is horizontally centered to the parent strip within 2 px
