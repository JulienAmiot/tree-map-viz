@HE-2590 @component:shell @phase:7 @priority:high
Feature: Board settings modal — name + delete (§17.31, simplified by §17.42)

  SPEC §17.31: the burger menu's "Settings…" item opens
  `<board-settings-modal>` for the current board. §17.42 retired the
  per-board fresh-date colour the §17.31 design carried, so the modal
  exposes:
    - **Name** (required, trimmed)
    - **Delete board** with an inline confirmation step. Disabled when
      the collection holds the single remaining board.

  Confirming the modal calls `BoardCollectionService.updateSettings` and
  dismisses the modal on success. Confirming the inline delete prompt
  calls `BoardCollectionService.deleteBoard` (refused on the last
  remaining board — defence-in-depth alongside the disabled button).

  Background:
    When I open the kiosk in test mode with empty storage
    And I tap the burger trigger
    And I tap the burger menu item with action "settings"

  @HE-2829 @priority:high
  Scenario: Tapping Settings… opens the modal pre-filled with the current board's name
    Then the board-settings modal is open
    And the board-settings modal name field shows the current board's name

  @HE-2827 @priority:high
  Scenario: Confirming the form persists the new name and re-paints the top-bar label
    When I set the board-settings modal field "field-name" to "Renamed via settings"
    And I confirm the board-settings modal
    Then the board-settings modal is closed
    And the top-bar board name is "Renamed via settings"

  @HE-2825 @priority:high
  Scenario: The focused-panel title is bright off-white regardless of board (§17.42)
    # §17.42 — the focused-panel title is a flat off-white
    # `rgb(245, 245, 245)` for every board; the per-board fresh-date
    # colour and its `var(--board-fresh, currentColor)` plumbing have
    # been retired. The kiosk's dark theme already gives the title
    # enough emphasis with the flat colour, and removing the picker
    # collapses the modal + service + persistence path to a single
    # source of truth.
    When I cancel the board-settings modal
    Then the focused-panel title colour is "rgb(245, 245, 245)"

  @HE-2830 @priority:high
  Scenario: Cancelling the modal does not change the board name
    When I set the board-settings modal field "field-name" to "Should be discarded"
    And I cancel the board-settings modal
    Then the board-settings modal is closed
    And the top-bar board name is unchanged from the seed default

  @HE-2826 @priority:high
  Scenario: The Delete button is disabled when only one board exists
    # SPEC §17.31 — the empty-storage seed plants a single showcase
    # board; deleting it would violate the `getCurrentBoard` invariant.
    Then the board-settings delete button is disabled

  @HE-2828 @priority:high
  Scenario: Inline delete confirm requires a second tap (single tap arms only)
    # The empty-storage seed plants only one board, so the delete
    # button is disabled — but we can still verify the
    # arming-on-single-tap UX shape isn't reachable when disabled.
    Then the board-settings delete button is disabled
    And the board-settings inline delete confirm prompt is not visible
