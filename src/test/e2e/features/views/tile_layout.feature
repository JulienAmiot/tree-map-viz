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
