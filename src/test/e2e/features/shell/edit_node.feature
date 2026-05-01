@HE-2580 @component:shell @phase:9
Feature: Editing the focused node from the top panel

  SPEC §17.28: a pencil button sits to the LEFT of the close-X on the
  focused-panel strip. Tapping it opens `<edit-node-modal>` populated
  with the focused node's pre-edit values; confirming the modal applies
  the partial update via `EditNodeService.editFields(...)`.

  Inline editing on the focused panel:
    - Tapping the title swaps it for a single-line input. Pressing
      Enter commits a new title; Escape cancels.
    - Tapping the value swaps it for an editor (textarea for TextNode,
      number input for BSC recordedValue). Committing appends a new
      `TimestampedValue` to the node's history (it does NOT replace
      the previous entry).

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "textTree" fixture via the test bridge
    And I reload the kiosk

  @HE-???? @priority:high
  Scenario: Edit pencil is visible on the focused panel and targets the focused id
    Then the focused id is "TXT-ROOT"
    And the edit-node pencil is visible
    And the edit-node pencil targets node "TXT-ROOT"

  @HE-???? @priority:high
  Scenario: Tapping the pencil opens the edit modal pre-filled with the focused node's title
    When I tap the edit-node pencil
    Then the edit-node modal is open
    And the edit-node modal title field shows "Quarterly review"

  @HE-???? @priority:high
  Scenario: Confirming the edit modal renames the focused node
    When I tap the edit-node pencil
    And I set the edit-node modal field "field-title" to "Updated title"
    And I confirm the edit-node modal
    Then the edit-node modal is closed
    And the focused title is "Updated title"

  @HE-???? @priority:high
  Scenario: Cancelling the edit modal does not change the focused node
    When I tap the edit-node pencil
    And I set the edit-node modal field "field-title" to "Throwaway"
    And I cancel the edit-node modal
    Then the edit-node modal is closed
    And the focused title is "Quarterly review"

  @HE-???? @priority:high
  Scenario: The top-right close-X dismisses the edit modal without applying changes (SPEC §17.29)
    # SPEC §17.29 — every modal in the app carries a close-X glyph
    # in its top-right corner. The edit modal's close-X is the same
    # affordance as the add-child modal's close-X; pressing it is a
    # fourth close path alongside Cancel / Escape / backdrop tap.
    When I tap the edit-node pencil
    And I set the edit-node modal field "field-title" to "Throwaway"
    And I tap the modal close-X
    Then the edit-node modal is closed
    And the focused title is "Quarterly review"

  @HE-???? @priority:high
  Scenario: Inline title edit on the focused panel renames the node
    When I tap the focused title
    And I type "Inline-renamed" in the focused title editor and press Enter
    Then the focused title is "Inline-renamed"

  @HE-???? @priority:high
  Scenario: Inline value edit on a TextNode appends a new history entry
    When I tap the focused value
    And I type "Fresh status" in the focused value editor and commit
    Then the focused value is "Fresh status"
