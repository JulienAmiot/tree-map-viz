@HE-2570 @component:modal @phase:8
Feature: Add-child modal opens from the "+" tile and appends a new child

  SPEC §7: activating the "+" tile opens a wide modal with a
  semi-transparent backdrop so the underlying board is still partially
  visible. SPEC §17.25 — the modal is a two-pane layout: a kind list on
  the left (~20 % width, one button per available kind) picks the node
  kind (each button shows "Name" + "Description", same content the
  pre-§17.19 kind-cards carried), and the type-specific form (using
  the empty-field placeholder pattern, §6) appears in the right pane
  (~80 % width) as soon as a kind is chosen. Confirm appends a child
  to the focused parent and persists; cancel never persists.
  Activating the "+" tile is never a navigation; the focused id stays
  put through the whole interaction.

  Background:
    # SPEC §17.21 — the default seed is the showcase tree (with 5 root
    # children). These scenarios need a baseline where the focused
    # parent has zero children, so we explicitly seed an empty single-
    # TextNode tree via the test bridge instead of relying on the seed.
    When I open the kiosk in test mode with empty storage
    And I seed the "emptyRoot" fixture via the test bridge
    And I reload the kiosk

  @HE-???? @priority:high
  Scenario: At rest the modal is closed
    Then the add-child modal is closed
    And there are 0 child tiles
    And there is exactly one plus tile

  @HE-???? @priority:high
  Scenario: Clicking the "+" tile opens the modal with a left-rail kind list (§17.25)
    When I click the plus tile
    Then the add-child modal is open
    And the modal kind list shows "2" options labelled with name and description
    And the modal offers a "Text" kind
    And the modal offers a "Business Score Card" kind

  @HE-???? @priority:high
  Scenario: Before a kind is chosen, no type-specific fields render in the right pane (§17.25)
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
  Scenario: Switching the kind from Text to BusinessScoreCard swaps in the BSC form (§17.25)
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
  Scenario: The top-right close-X dismisses the modal without adding a child (SPEC §17.29)
    # SPEC §17.29 — every modal in the app carries a close-X glyph
    # in its top-right corner. Tapping it is a fourth close path
    # alongside Cancel / Escape / backdrop tap; never persists.
    When I click the plus tile
    And I pick the kind "TextNode"
    And I fill in the title with "Should not stick"
    And I tap the modal close-X
    Then the add-child modal is closed
    And there are 0 child tiles

  @HE-???? @priority:high
  Scenario: Modal panel is content-sized and capped at viewport - 4rem (SPEC §17.29)
    # SPEC §17.29 — the modal panel never exceeds the viewport (modulo
    # a 4rem margin) and otherwise shrinks to its content. Pre-§17.29
    # the panel was pinned to inset:5vh 8vw which forced ~84vw / 90vh
    # regardless of how little content the modal carried.
    When I click the plus tile
    Then the modal panel fits inside the viewport with at least 2rem of margin

  @HE-???? @priority:high
  Scenario: Activating the "+" tile is not a navigation (focused id is unchanged)
    When I click the plus tile
    And I pick the kind "TextNode"
    And I fill in the title with "Stable focus"
    And I fill in the current value with "Today's update"
    And I confirm the add-child modal
    Then the focused id is unchanged after the modal interaction

  @HE-???? @priority:high
  Scenario: Weight is a slider + numeric input pair, bidirectionally synced (§17.26)
    When I click the plus tile
    And I pick the kind "TextNode"
    Then the weight slider runs 0.5..10 step 0.5 and mirrors the number input
    When I set the weight slider to "3.5"
    Then the weight number input shows the value "3.5"
