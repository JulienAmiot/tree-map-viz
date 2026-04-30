@HE-2570 @component:views @phase:6
Feature: Tile layout — title 3vh, value fills, unit 1/3, timestamp top-right (§17.14)

  SPEC §17.14 unifies the per-tile layout across both kinds:
    - Title row is fixed at 3 % of the viewport height (`vh`-relative,
      consistent across tiles regardless of tile size).
    - Value occupies the rest of the tile, sized via `cqmin` so it grows
      with the tile up to a clamp ceiling.
    - Numeric values render the unit at exactly 1/3 of the value's
      font-size (`calc(1em / 3)`).
    - The `asOf` timestamp of the current value sits in the tile's
      top-right corner, absolutely positioned.

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
  Scenario: Current-value timestamp is rendered in the top-right corner of the tile
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "ChildB"
    Then the focused value-date is in the top-right corner of the tile

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
