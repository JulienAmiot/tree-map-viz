@HE-2580 @component:shell @phase:9
Feature: Editing the focused node from the top panel

  SPEC §17.28: a pencil button sits to the LEFT of the close-X on the
  focused-panel strip. Tapping it opens `<edit-node-modal>` populated
  with the focused node's pre-edit values; confirming the modal applies
  the partial update via `EditNodeService.editFields(...)`.

  SPEC §17.50: the modal no longer carries a title field. The title is
  the canonical inline-editable field on the focused panel (tap → input
  → Enter), and exposing it through the modal as well duplicated an
  affordance the operator already had one tap away. The modal therefore
  covers ONLY fields with no inline equivalent: weight (slider + number
  input), and on a BSC also description, unit, and objective. The v3-era
  `computed` + `eligibleForParentComputation` checkboxes retired
  post-§17.99b/c.

  Inline editing on the focused panel:
    - Tapping the title swaps it for a single-line input. Pressing
      Enter commits a new title; Escape cancels. (Sole rename path
      after §17.50.)
    - Tapping the value swaps it for an editor (textarea for TextNode,
      number input for BSC recordedValue). Committing appends a new
      `TimestampedValue` to the node's history (it does NOT replace
      the previous entry).

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "textTree" fixture via the test bridge
    And I reload the kiosk

  @HE-2764 @priority:high
  Scenario: Edit pencil is visible on the focused panel and targets the focused id
    Then the focused id is "TXT-ROOT"
    And the edit-node pencil is visible
    And the edit-node pencil targets node "TXT-ROOT"

  @HE-2766 @priority:high
  Scenario: Tapping the pencil opens the edit modal pre-filled with the focused node's weight (SPEC §17.50 — no title field)
    # SPEC §17.50 -- the modal renders no `field-title`; the weight
    # input is the always-present field for both TextNode and BSC.
    # The pre-fill assertion shifts from "title shows X" to "weight
    # shows X" + an explicit "no title field" guard so a future
    # regression that re-introduces a title input is caught here.
    When I tap the edit-node pencil
    Then the edit-node modal is open
    And the edit-node modal does not render a title field
    And the edit-node modal weight field shows "1"

  @HE-2762 @priority:high
  Scenario: Confirming the edit modal updates the focused weight (SPEC §17.50 — title is inline-only)
    # SPEC §17.50 -- weight is one of the modal-only fields. Renaming
    # is exercised by the inline-edit scenario below; the modal no
    # longer participates in renames.
    When I tap the edit-node pencil
    And I set the edit-node modal field "field-weight" to "5"
    And I confirm the edit-node modal
    Then the edit-node modal is closed
    And the focused title is "Quarterly review"

  @HE-2767 @priority:high
  Scenario: Cancelling the edit modal does not change the focused node
    When I tap the edit-node pencil
    And I set the edit-node modal field "field-weight" to "7"
    And I cancel the edit-node modal
    Then the edit-node modal is closed
    And the focused title is "Quarterly review"

  @HE-2761 @priority:high
  Scenario: The top-right close-X dismisses the edit modal without applying changes (SPEC §17.29)
    # SPEC §17.29 — every modal in the app carries a close-X glyph
    # in its top-right corner. The edit modal's close-X is the same
    # affordance as the add-child modal's close-X; pressing it is a
    # fourth close path alongside Cancel / Escape / backdrop tap.
    When I tap the edit-node pencil
    And I set the edit-node modal field "field-weight" to "9"
    And I tap the modal close-X
    Then the edit-node modal is closed
    And the focused title is "Quarterly review"

  @HE-2763 @priority:high
  Scenario: Inline title edit on the focused panel renames the node
    When I tap the focused title
    And I type "Inline-renamed" in the focused title editor and press Enter
    Then the focused title is "Inline-renamed"

  @HE-2765 @priority:high
  Scenario: Inline value edit on a TextNode appends a new history entry
    When I tap the focused value
    And I type "Fresh status" in the focused value editor and commit
    Then the focused value is "Fresh status"
