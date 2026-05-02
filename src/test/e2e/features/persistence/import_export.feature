@HE-2585 @component:persistence @phase:10
Feature: Import / Export the current board's tree as JSON (§17.33)

  SPEC §13.2 + §17.33 — the burger menu's Import / Export items wire
  through `ImportExportService`. Export streams the current board's
  tree to a JSON file via a transient `<a download>`; Import opens
  a native file picker, decodes through the codec (validate-first),
  and replaces the current board's tree atomically — other boards
  are untouched. A failed decode is surfaced with `window.alert`
  and the in-memory tree stays put.

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "orgTree" fixture via the test bridge
    And I reload the kiosk

  @HE-???? @priority:high
  Scenario: Export downloads a JSON file matching the seeded tree
    When I tap the drawer handle
    And I tap the burger trigger
    And I trigger a download via the burger menu item with action "export"
    Then the downloaded JSON has root id "UUID1"
    And the downloaded JSON has root title "UUID1 Title"

  @HE-???? @priority:high
  Scenario: Import replaces the current board's tree with the picked file
    # Empty-storage seed = the showcase tree (root title varies). Re-seed
    # a known fixture, then import the textTree fixture and assert the
    # focus moved to the imported tree's root.
    When I tap the drawer handle
    And I tap the burger trigger
    And I import the "textTree" fixture via the burger menu
    Then the focused id is "TXT-ROOT"
    And the URL hash includes "/n/TXT-ROOT"

  @HE-???? @priority:high
  Scenario: Import of malformed JSON surfaces a window.alert and leaves the tree put
    Given I capture window.alert messages
    When I tap the drawer handle
    And I tap the burger trigger
    And I import the literal "not actually json" via the burger menu
    Then a window.alert was shown matching "/import failed/i"
    And the focused id is "UUID1"
