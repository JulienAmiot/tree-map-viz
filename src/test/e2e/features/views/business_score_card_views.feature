@HE-2570 @component:views @phase:6
Feature: BusinessScoreCard views render the (role × computed) matrix

  SPEC §5 and §13.2 require uniform field content across roles, with the
  value area driven by a discriminated union (`computedMean` /
  `recordedValue` / `childrenCount`). This feature covers the full
  `(role × computed)` matrix using `mixedComputed.json`:

  | role     | computed | expected value branch                                |
  |----------|----------|------------------------------------------------------|
  | asParent | true     | weighted mean + Σ + children-derived date (§17.18)   |
  | asParent | false    | own latest value + own date, no Σ                    |
  | asChild  | true     | weighted mean + Σ + children-derived date (§17.18)   |
  | asChild  | false    | own latest value + own date, no Σ                    |

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk

  @HE-???? @priority:high
  Scenario: asParent + computed=true renders the weighted mean with a Σ badge and a children-derived date (§17.18)
    Then the focused title is "Root"
    # §17.99c landed the proper v5 polymorphic recursion: ChildA is now
    # ComputedBusinessScoreNode (no own-history; aggregate = GrandLeaf=80),
    # so Root.mean = (ChildA.aggregate=80, ChildB.history=60) / 2 = 70.0.
    # The pre-§17.99c value 80.0 was the §17.93 band-aid one-level rule
    # (ChildA.history=100 contributing directly); §17.99c retires that
    # quirk along with the BSN.computed field that gated it.
    And the focused value is "70.0 %"
    And the focused node has a computed badge
    And the focused value has a date

  @HE-???? @priority:high
  Scenario: asChild + computed=true renders the weighted mean with a Σ badge
    Then the child "ChildA" has title "ChildA"
    And the child "ChildA" has value "80.0 %"
    And the child "ChildA" has a computed badge

  @HE-???? @priority:high
  Scenario: asChild + computed=false renders own latest value with date and no Σ
    Then the child "ChildB" has value "60 %"
    And the child "ChildB" has a date
    And the child "ChildB" has no computed badge

  @HE-???? @priority:high
  Scenario: asParent + computed=false renders own latest value with date and no Σ
    When I focus on node "ChildB"
    Then the focused title is "ChildB"
    And the focused value is "60 %"
    And the focused value has a date
    And the focused node has no computed badge

  @HE-???? @priority:high
  Scenario: asParent renders the description below the title (SPEC §17.30)
    # SPEC §17.30 — the focused panel for a BSC shows the metric's
    # definition (the `description` field) under the title. Read-only
    # here; the operator edits it through the §17.28 edit modal.
    When I focus on node "ChildB"
    Then the focused description is "Recorded child"

  @HE-???? @priority:high
  Scenario: asChild does NOT render the description (SPEC §17.30 — parent-role only)
    # SPEC §17.30 — descriptions are intentionally rendered ONLY on
    # the focused panel. On a child tile a multi-line description
    # would crowd the figure; the per-tile body stays reserved for
    # the timestamped value per the unified §17.14 layout.
    Then the child "ChildB" has no description block
