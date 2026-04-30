@HE-2570 @component:modal @phase:8
Feature: Add-child modal opens from the "+" tile and appends a new child

  SPEC §7: activating the "+" tile opens a wide modal with a
  semi-transparent backdrop so the underlying board is still partially
  visible. Step 1 picks the node kind (Text or BusinessScoreCard); Step 2
  is a per-kind form (using the empty-field placeholder pattern, §6).
  Confirm appends a child to the focused parent and persists; cancel never
  persists. Activating the "+" tile is never a navigation; the focused id
  stays put through the whole interaction.

  Background:
    When I open the kiosk in test mode with empty storage

  @HE-???? @priority:high
  Scenario: At rest the modal is closed
    Then the add-child modal is closed
    And there are 0 child tiles
    And there is exactly one plus tile

  @HE-???? @priority:high
  Scenario: Clicking the "+" tile opens the modal at Step 1
    When I click the plus tile
    Then the add-child modal is open
    And the modal step indicator shows "Step 1 / 2"
    And the modal offers a "Text" kind
    And the modal offers a "Business Score Card" kind

  @HE-???? @priority:high
  Scenario: The modal backdrop is semi-transparent (the board is still behind)
    When I click the plus tile
    Then the modal backdrop is semi-transparent

  @HE-???? @priority:high
  Scenario: Picking Text reveals title + weight + current-value (no description, no unit, no objective — §17.15)
    When I click the plus tile
    And I pick the kind "TextNode"
    Then the add-child modal is open
    And the modal step indicator shows "Step 2 / 2"
    And the modal form is for kind "TextNode"
    And the modal has a title field
    And the modal has no description field
    And the modal has a weight field
    And the modal has a current-value field
    And the as-of date defaults to today's local-calendar ISO
    And the modal has no unit field
    And the modal has no objective fields

  @HE-???? @priority:high
  Scenario: Picking BusinessScoreCard reveals description + unit + current-value + objective + toggles
    When I click the plus tile
    And I pick the kind "BusinessScoreCardNode"
    Then the modal form is for kind "BusinessScoreCardNode"
    And the modal has a description field
    And the modal has a unit field
    And the modal has a current-value field
    And the as-of date defaults to today's local-calendar ISO
    And the modal has objective fields
    And the modal has the computed toggle
    And the modal has the eligible-for-parent-computation toggle

  @HE-???? @priority:high
  Scenario: Confirming a Text child appends it to the focused parent and closes the modal
    When I click the plus tile
    And I pick the kind "TextNode"
    And I fill in the title with "Quarterly review"
    And I fill in the current value with "Q2 was on track"
    And I confirm the add-child modal
    Then the add-child modal is closed
    And there are 1 child tiles
    And the focused id is unchanged after the modal interaction

  @HE-???? @priority:high
  Scenario: Cancel closes the modal without adding a child
    When I click the plus tile
    And I pick the kind "TextNode"
    And I fill in the title with "Should not stick"
    And I cancel the add-child modal
    Then the add-child modal is closed
    And there are 0 child tiles

  @HE-???? @priority:high
  Scenario: Activating the "+" tile is not a navigation (focused id is unchanged)
    When I click the plus tile
    And I pick the kind "TextNode"
    And I fill in the title with "Stable focus"
    And I fill in the current value with "Today's update"
    And I confirm the add-child modal
    Then the focused id is unchanged after the modal interaction
