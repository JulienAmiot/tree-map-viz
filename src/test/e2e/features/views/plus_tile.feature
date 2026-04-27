@HE-2570 @component:views @phase:6
Feature: Plus tile is the add-child affordance, never a node

  SPEC §4 last bullet, §5 final sentence, §12.3 plus_tile row: the `+` tile
  is a UI affordance — not a node kind, not a navigation target. It must
  carry a dashed border, render only the `+` glyph, expose no per-node
  fields (title / value / date), and never drill on click (the modal arrives
  in Phase 8 / DT-7).

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "mixedComputed" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "EmptyLeaf"

  @HE-???? @priority:high
  Scenario: Plus tile renders alone, with a dashed border and a "+" glyph
    Then there are 0 child tiles
    And there is exactly one plus tile
    And the plus tile shows "+"
    And the plus tile has a dashed border
    And the plus tile has no title
    And the plus tile has no value
    And the plus tile has no value-date

  @HE-???? @priority:high
  Scenario: Clicking the plus tile never drills (focus is unchanged)
    When I click the plus tile
    Then the focused id is "EmptyLeaf"
