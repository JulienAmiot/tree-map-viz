@HE-2570 @component:views @phase:6
Feature: BusinessScoreCard views render the (role × computed) matrix

  SPEC §5 and §13.2 require uniform field content across roles, with the
  value area driven by a discriminated union (`computedMean` /
  `recordedValue` / `childrenCount`). This feature covers the full
  `(role × computed)` matrix using `mixedComputed.json`:

  | role     | computed | expected value branch              |
  |----------|----------|------------------------------------|
  | asParent | true     | weighted mean + Σ                  |
  | asParent | false    | own latest value + date, no Σ      |
  | asChild  | true     | weighted mean + Σ                  |
  | asChild  | false    | own latest value + date, no Σ      |

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk

  @HE-???? @priority:high
  Scenario: asParent + computed=true renders the weighted mean with a Σ badge
    Then the focused title is "Root"
    And the focused value is "80.0 %"
    And the focused node has a computed badge
    And the focused value has no date

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
