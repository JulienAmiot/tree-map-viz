@HE-2570 @component:views @phase:6
Feature: BusinessScoreCard value aggregation modes

  Mirrors the three branches of `domain/aggregation/computedValue` (SPEC
  §13.2): `computedMean`, `recordedValue`, `childrenCount`. The
  `childrenCount` branch is itself split between `n > 0` (rendered as
  `<n> children` plain text — no `Unit`, no `Σ`) and `n = 0` (empty value
  area — see `valueTemplate.ts`).

  @HE-2792 @priority:high
  Scenario: computed=true with eligible children renders weighted mean with Σ and a children-derived date (§17.18 / §17.116)
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    # §17.99c — see business_score_card_views.feature for the rationale.
    # Root.mean = (ChildA.aggregate=80, ChildB.history=60) / 2 = 70.0
    # post-substitution (was 80.0 under the §17.93 band-aid).
    # §17.116 — trailing zero stripped (max 2 decimals, only if needed).
    Then the focused value is "70 %"
    And the focused node has a computed badge
    And the focused value has a date

  @HE-2791 @priority:high
  Scenario: computed=true with zero eligible children renders the §17.116 warning-fill (cannot-compute → full-tile ⚠)
    # SPEC §17.116 — a Computed*BusinessScoreNode whose strategy
    # cannot produce a numeric value (every eligible child surfaced
    # an EmptyChildrenError or the result was non-finite) renders
    # the full-tile warning glyph instead of the pre-§17.116
    # "<n> children" plain text. The kind label + title still
    # surface so the tile reads as the node's identity; the
    # children-derived date is intentionally NOT shown when there
    # is no value to date-stamp.
    When I open the kiosk in test mode with empty storage
    And I seed the "zeroEligible" fixture via the test bridge
    And I reload the kiosk
    Then the focused node shows the §17.116 warning-fill
    And the focused node has no computed badge
    And the focused value has no date

  @HE-2790 @priority:high
  Scenario: computed=true with zero children renders the §17.116 warning-fill and only a "+" tile
    # SPEC §17.116 — a CBSN with literally zero children also
    # surfaces the warning-fill (parity with the zero-eligible
    # branch — operator can't compute = warning, regardless of
    # whether the children-set is empty or all-disabled). The "+"
    # tile still renders because the children-grid is a sibling
    # of the parent strip; the warning-fill is entirely inside
    # the strip and does not consume the children-grid's slot.
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "EmptyLeaf"
    Then the focused node shows the §17.116 warning-fill
    And the focused node has no computed badge
    And the focused value has no date
    And there are 0 child tiles
    And there is exactly one plus tile

  @HE-2789 @priority:high
  Scenario: computed=false renders own latest value with date and no Σ
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "ChildB"
    Then the focused value is "60 %"
    And the focused value has a date
    And the focused node has no computed badge
