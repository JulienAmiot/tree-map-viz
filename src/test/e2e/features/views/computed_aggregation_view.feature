@HE-2570 @component:views @phase:6
Feature: BusinessScoreCard value aggregation modes

  Mirrors the three branches of `domain/aggregation/computedValue` (SPEC
  §13.2): `computedMean`, `recordedValue`, `childrenCount`. The
  `childrenCount` branch is itself split between `n > 0` (rendered as
  `<n> children` plain text — no `Unit`, no `Σ`) and `n = 0` (empty value
  area — see `valueTemplate.ts`).

  @HE-???? @priority:high
  Scenario: computed=true with eligible children renders weighted mean with Σ
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    Then the focused value is "80.0 %"
    And the focused node has a computed badge
    And the focused value has no date

  @HE-???? @priority:high
  Scenario: computed=true with zero eligible children renders "n children" plain text
    When I open the kiosk in test mode with empty storage
    And I seed the "zeroEligible" fixture via the test bridge
    And I reload the kiosk
    Then the focused value is "3 children"
    And the focused node has no computed badge
    And the focused value has no date

  @HE-???? @priority:high
  Scenario: computed=true with zero children renders an empty value area and only a "+" tile
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "EmptyLeaf"
    Then the focused value area is empty
    And the focused node has no computed badge
    And the focused value has no date
    And there are 0 child tiles
    And there is exactly one plus tile

  @HE-???? @priority:high
  Scenario: computed=false renders own latest value with date and no Σ
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "ChildB"
    Then the focused value is "60 %"
    And the focused value has a date
    And the focused node has no computed badge
