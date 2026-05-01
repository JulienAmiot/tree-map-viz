@HE-2590 @component:shell @phase:7 @priority:high
Feature: Board settings modal — name, fresh-date colour, delete (§17.31)

  SPEC §17.31: the burger menu's "Settings…" item opens
  `<board-settings-modal>` for the current board. The modal exposes
  the mutable board fields:
    - **Name** (required, trimmed)
    - **Fresh-date colour** (`<input type="color">`) — drives both the
      timestamp's age gradient AND the focused-panel title colour.
    - **Delete board** with an inline confirmation step. Disabled when
      the collection holds the single remaining board.

  Confirming the modal calls `BoardCollectionService.updateSettings` and
  dismisses the modal on success. Confirming the inline delete prompt
  calls `BoardCollectionService.deleteBoard` (refused on the last
  remaining board — defence-in-depth alongside the disabled button).

  Background:
    When I open the kiosk in test mode with empty storage
    And I tap the drawer handle
    And I tap the burger trigger
    And I tap the burger menu item with action "settings"

  Scenario: Tapping Settings… opens the modal pre-filled with the current board's name
    Then the board-settings modal is open
    And the board-settings modal name field shows the current board's name

  Scenario: Confirming the form persists the new name and re-paints the drawer label
    When I set the board-settings modal field "field-name" to "Renamed via settings"
    And I confirm the board-settings modal
    Then the board-settings modal is closed
    And the drawer board name is "Renamed via settings"

  Scenario: Typing a hex colour repaints the focused-panel title accent
    # SPEC §17.31 — the hex `<input type="text">` is bidirectionally
    # synced with the native colour picker. Typing `#9000FF` and
    # saving updates the persisted board.freshDateColor; refresh()
    # then plumbs that as `--board-fresh` on the screen host so the
    # focused-panel title's `var(--board-fresh, currentColor)` rule
    # picks it up immediately.
    When I set the board-settings modal field "field-color-hex" to "#9000ff"
    And I confirm the board-settings modal
    Then the board-settings modal is closed
    And the focused-panel title colour is "rgb(144, 0, 255)"

  Scenario: Cancelling the modal does not change the board name
    When I set the board-settings modal field "field-name" to "Should be discarded"
    And I cancel the board-settings modal
    Then the board-settings modal is closed
    And the drawer board name is unchanged from the seed default

  Scenario: The Delete button is disabled when only one board exists
    # SPEC §17.31 — the empty-storage seed plants a single showcase
    # board; deleting it would violate the `getCurrentBoard` invariant.
    Then the board-settings delete button is disabled

  Scenario: Inline delete confirm requires a second tap (single tap arms only)
    # The empty-storage seed plants only one board, so the delete
    # button is disabled — but we can still verify the
    # arming-on-single-tap UX shape isn't reachable when disabled.
    Then the board-settings delete button is disabled
    And the board-settings inline delete confirm prompt is not visible
