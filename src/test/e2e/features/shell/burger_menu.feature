@HE-2570 @component:shell @phase:7
Feature: Burger menu offers Import / Export / Boards entries

  SPEC §4: the burger menu in the drawer holds the three top-level kiosk
  actions — Import, Export, Boards (board collection management) — plus
  future admin entries. It opens on tap of the trigger and closes on
  outside tap (`composedPath`-based, walks shadow DOM correctly so the
  drawer does NOT close at the same time when the user taps another spot
  in the drawer). The Import / Export / Boards consumers themselves wire
  in Phase 10 per SPEC §15.4 + §17.3; this feature only validates the
  menu structure + open/close UX.

  Background:
    When I open the kiosk in test mode with empty storage
    And I tap the drawer handle

  @HE-???? @priority:high
  Scenario: At rest the burger menu is closed
    Then the burger menu is closed

  @HE-???? @priority:high
  Scenario: Tapping the burger trigger reveals exactly 3 items in order
    When I tap the burger trigger
    Then the burger menu is open
    And the burger menu has 3 items
    And the burger menu has an item with action "import"
    And the burger menu has an item with action "export"
    And the burger menu has an item with action "boards"

  @HE-???? @priority:high
  Scenario: Tapping inside the drawer but outside the burger closes only the menu
    When I tap the burger trigger
    And I tap the board name
    Then the burger menu is closed
    And the drawer is open

  @HE-???? @priority:high
  Scenario: Tapping the burger trigger a second time toggles the menu closed
    When I tap the burger trigger
    And I tap the burger trigger
    Then the burger menu is closed
