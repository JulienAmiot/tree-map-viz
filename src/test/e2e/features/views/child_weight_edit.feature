@HE-2620 @component:views @phase:9
Feature: Inline weight editing on child tiles (SPEC §17.52)

  SPEC §17.52: child-tile weight editing as a per-tile inline affordance.
  Two triggers open the same slider popover:
    - a small dumbbell icon in the tile's bottom-LEFT corner (mirror of
      the §17.18 bottom-right timestamp); always visible per tile.
    - a long-press anywhere on the tile body (~500 ms hold); a hidden
      gesture for power users.

  The popover renders a horizontal range slider seeded at the tile's
  current weight, plus a live numeric label that updates continuously
  while the operator drags. The treemap layout reflows ONLY after the
  operator releases the slider thumb (the native `change` event), at
  which point the popover dispatches `inline-edit-weight`, the
  composition root applies `EditNodeService.editFields(node, { kind,
  weight })`, and the tree refreshes. Cancel paths (Escape, tap-
  outside) close the popover without committing.

  The parent node's weight remains modal-only (the focused panel has
  no enclosing tile to anchor the popover against; SPEC §17.50 keeps
  the modal as the parent-weight edit path).

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "textTree" fixture via the test bridge
    And I reload the kiosk
    And I dismiss animations via the test bridge

  @HE-???? @priority:high
  Scenario: Each child tile shows a weight-edit corner button
    Then there are 2 child tiles
    And the child tile "TXT-A" shows a weight-edit corner button
    And the child tile "TXT-B" shows a weight-edit corner button

  @HE-???? @priority:high
  Scenario: Tapping the corner icon opens the popover seeded at the tile's weight
    When I tap the weight-edit corner button on child tile "TXT-A"
    Then the weight-edit popover is open
    And the weight-edit slider value is "1"
    And the weight-edit live label shows "1.0"

  @HE-???? @priority:high
  Scenario: Tapping the corner icon does NOT drill into the tile
    # SPEC §17.52 -- the icon's click handler stops propagation so
    # the operator gets the popover, not a navigation jump.
    Then the focused id is "TXT-ROOT"
    When I tap the weight-edit corner button on child tile "TXT-A"
    Then the focused id is "TXT-ROOT"
    And the weight-edit popover is open

  @HE-???? @priority:high
  Scenario: Dragging the slider updates the live label without committing (commit-on-release)
    # SPEC §17.52 commit-on-release contract: the live label updates
    # on `input`, the persisted commit fires only on `change` (thumb
    # release). The tile's data-weight stays at the pre-edit value
    # mid-drag.
    When I tap the weight-edit corner button on child tile "TXT-A"
    Then the weight-edit popover is open
    When I drag the weight-edit slider to "5"
    Then the weight-edit live label shows "5.0"
    And the child tile "TXT-A" carries data-weight "1"

  @HE-???? @priority:high
  Scenario: Releasing the slider commits the new weight and reflows the treemap
    When I tap the weight-edit corner button on child tile "TXT-A"
    Then the weight-edit popover is open
    When I release the weight-edit slider at "5"
    Then the weight-edit popover is closed
    And the child tile "TXT-A" carries data-weight "5"
    And the child tile "TXT-B" carries data-weight "1"
    And the child tile "TXT-A" bounding-box area exceeds the child tile "TXT-B" bounding-box area

  @HE-???? @priority:medium
  Scenario: Pressing Escape closes the popover without committing
    When I tap the weight-edit corner button on child tile "TXT-A"
    Then the weight-edit popover is open
    When I drag the weight-edit slider to "7"
    And I press Escape to dismiss the weight-edit popover
    Then the weight-edit popover is closed
    And the child tile "TXT-A" carries data-weight "1"

  @HE-???? @priority:medium
  Scenario: A long-press on a child tile opens the same popover (SPEC §17.52 hidden gesture)
    # SPEC §17.52 -- the long-press is the hidden gesture; the corner
    # icon is the discoverable path. Both open the same popover.
    When I long-press on child tile "TXT-B"
    Then the weight-edit popover is open
    And the weight-edit slider value is "1"
    And the focused id is "TXT-ROOT"
