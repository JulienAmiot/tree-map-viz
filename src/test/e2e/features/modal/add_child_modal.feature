@HE-2570 @component:modal @phase:8
Feature: Add-child modal opens from the "+" tile and appends a new child

  SPEC §7: activating the "+" tile opens a wide modal with a
  semi-transparent backdrop so the underlying board is still partially
  visible. SPEC §17.19 — the modal is a single page: a kind dropdown at
  the top picks the node kind (each option shows "Name — Description",
  same content the pre-§17.19 kind-cards carried), and the type-specific
  form (using the empty-field placeholder pattern, §6) appears
  dynamically beneath the dropdown as soon as a kind is chosen. Confirm
  appends a child to the focused parent and persists; cancel never
  persists. Activating the "+" tile is never a navigation; the focused
  id stays put through the whole interaction.

  Background:
    When I open the kiosk in test mode with empty storage

  @HE-???? @priority:high
  Scenario: At rest the modal is closed
    Then the add-child modal is closed
    And there are 0 child tiles
    And there is exactly one plus tile

  @HE-???? @priority:high
  Scenario: Clicking the "+" tile opens the modal with a kind dropdown (§17.19)
    When I click the plus tile
    Then the add-child modal is open
    And the modal kind dropdown shows "2" options labelled with name and description
    And the modal offers a "Text" kind
    And the modal offers a "Business Score Card" kind

  @HE-???? @priority:high
  Scenario: Before a kind is chosen, no type-specific fields render below the dropdown (§17.19)
    When I click the plus tile
    Then the add-child modal is open
    And the modal has no title field
    And the modal has no current-value field
    And the modal has no unit field

  @HE-???? @priority:high
  Scenario: The modal backdrop is semi-transparent (the board is still behind)
    When I click the plus tile
    Then the modal backdrop is semi-transparent

  @HE-???? @priority:high
  Scenario: Picking Text reveals title + weight + current-value (no description, no unit, no objective — §17.15)
    When I click the plus tile
    And I pick the kind "TextNode"
    Then the add-child modal is open
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
  Scenario: Switching the dropdown from Text to BusinessScoreCard swaps in the BSC form (§17.19)
    When I click the plus tile
    And I pick the kind "TextNode"
    Then the modal has no unit field
    When I pick the kind "BusinessScoreCardNode"
    Then the modal form is for kind "BusinessScoreCardNode"
    And the modal has a unit field
    And the modal has a description field

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
