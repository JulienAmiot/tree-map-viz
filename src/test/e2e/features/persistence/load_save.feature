@HE-2591 @component:persistence @phase:10
Feature: Mutations survive a kiosk reload (§17.35)

  SPEC §11 + §17.11 + §17.28 + §17.31 + §17.34: every user-visible
  mutation flows through `BoardCollectionService` (or
  `EditNodeService` / `AddChildService` whose `Persister` callbacks
  re-save the collection) and lands in `localStorage` via
  `LocalStorageBoardCollectionRepository`. A reload replays that
  envelope, so the kiosk should come back exactly where the operator
  left it.

  Several existing features include a one-off reload step (e.g.
  `persistence/board_collection.feature` covers create-survives-reload;
  `shell/board_settings.feature` covers settings-changes-survive
  via the top-bar label). This feature is the **explicit
  load-save contract**: a representative slice of mutations + a
  reload, asserting the post-reload state still carries the change.

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "textTree" fixture via the test bridge
    And I reload the kiosk

  @HE-???? @priority:high
  Scenario: Inline title edit on the focused node survives reload
    # SPEC §17.28 — inline title edit goes through
    # `EditNodeService.editFields(...)` → `persistCurrent` →
    # `LocalStorageBoardCollectionRepository.save`. Reload reads
    # the new title back through the codec.
    Then the focused title is "Quarterly review"
    When I tap the focused title
    And I type "Annual review" in the focused title editor and press Enter
    Then the focused title is "Annual review"
    When I reload the kiosk
    Then the focused title is "Annual review"

  @HE-???? @priority:high
  Scenario: Drilling state (URL focus) survives reload
    # SPEC §9: the URL hash is the source of truth for focus.
    # Reload preserves the hash; the bootup path re-seats the
    # navigation service from it.
    When I dismiss animations via the test bridge
    And I tap the child tile for "TXT-A"
    Then the focused id is "TXT-A"
    When I reload the kiosk
    Then the focused id is "TXT-A"
    And the focused title is "Region"

  @HE-???? @priority:high
  Scenario: Adding a child survives reload
    # SPEC §7 — `AddChildService` mutates the in-memory tree and
    # persists. Reload must rehydrate the new node.
    When I dismiss animations via the test bridge
    And I focus on node "TXT-A"
    And I click the plus tile
    And I pick the kind "TextNode"
    And I fill in the title with "Reload survivor"
    And I fill in the current value with "still here"
    And I confirm the add-child modal
    Then the add-child modal is closed
    And there are 1 child tiles
    When I reload the kiosk
    Then the focused id is "TXT-A"
    And there are 1 child tiles
