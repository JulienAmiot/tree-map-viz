@HE-2586 @component:persistence @phase:10
Feature: Boards panel — list / switch / create (§17.34)

  SPEC §13.2 + §17.34 — the burger menu's "Boards…" item opens
  `<boards-panel-modal>`, the collection-level surface for managing
  the kiosk's saved boards. Renaming and deletion remain on the
  per-board `<board-settings-modal>` (§17.31); this panel covers
  the collection-level operations:
    - **Switch** — tap a non-current row's Switch button.
    - **Create** — type a name and tap Create.

  The modal is a pure consumer of the snapshot the composition root
  assembles from `BoardCollectionService.list()` (id + name only) +
  `getCurrentBoardId()`. On confirm the composition root re-seats
  `TreeNavigationService` over the newly-current board's tree and
  replaces the URL hash to `#/b/<newBoardId>/n/<newRootId>`.

  Background:
    When I open the kiosk in test mode with empty storage
    And I tap the burger trigger
    And I tap the burger menu item with action "boards"

  @HE-2687 @priority:high
  Scenario: Tapping Boards… opens the panel pre-filled with the seed board (current)
    Then the boards-panel modal is open
    And the boards-panel lists 1 board
    And the boards-panel has a board named "Showcase" marked as current

  @HE-2692 @priority:high
  Scenario: Cancelling the panel closes it without changing focus
    When I cancel the boards-panel modal
    Then the boards-panel modal is closed

  @HE-2693 @priority:high
  Scenario: Create button is gated on a non-empty trimmed name
    Then the boards-panel Create button is disabled
    When I type "   " into the new-board name field
    Then the boards-panel Create button is disabled
    When I type "Q3 OKRs" into the new-board name field
    Then the boards-panel Create button is enabled

  @HE-2688 @priority:high
  Scenario: Creating a new board switches to it and updates the URL
    # SPEC §17.34 — `createBoard` flips `currentBoardId` to the new
    # board; the composition root re-seats nav + replaces the URL
    # hash so the route reflects the new board. The top bar's board
    # name label re-paints from `boards.getCurrentBoard().name`.
    When I type "Roadmap" into the new-board name field
    And I tap the boards-panel Create button
    Then the boards-panel modal is closed
    And the top-bar board name is "Roadmap"
    And the URL hash includes "/b/"

  @HE-2691 @priority:high
  Scenario: After creating, both boards are listed; the new one is current
    When I type "Roadmap" into the new-board name field
    And I tap the boards-panel Create button
    Then the boards-panel modal is closed
    # Re-open the panel to confirm the persisted collection now has
    # both boards, with the new one marked as current.
    When I tap the burger trigger
    And I tap the burger menu item with action "boards"
    Then the boards-panel modal is open
    And the boards-panel lists 2 boards
    And the boards-panel has a board named "Roadmap" marked as current
    And the boards-panel has a board named "Showcase" not marked as current

  @HE-2689 @priority:high
  Scenario: Switching to a non-current board updates focus + URL
    # Create a second board first (so a Switch target exists), then
    # re-open the panel and switch back to the original "Showcase".
    When I type "Roadmap" into the new-board name field
    And I tap the boards-panel Create button
    Then the top-bar board name is "Roadmap"
    When I tap the burger trigger
    And I tap the burger menu item with action "boards"
    And I tap the boards-panel switch button for "Showcase"
    Then the boards-panel modal is closed
    And the top-bar board name is "Showcase"

  @HE-2690 @priority:medium
  Scenario: Newly-created board persists across reload
    # SPEC §11 — every mutation flows through the
    # BoardCollectionRepository. Reloading the kiosk replays the
    # persisted snapshot; the new board must still be there and
    # still current.
    When I type "Roadmap" into the new-board name field
    And I tap the boards-panel Create button
    Then the top-bar board name is "Roadmap"
    When I reload the kiosk
    Then the top-bar board name is "Roadmap"
    When I tap the burger trigger
    And I tap the burger menu item with action "boards"
    Then the boards-panel lists 2 boards
    And the boards-panel has a board named "Roadmap" marked as current
