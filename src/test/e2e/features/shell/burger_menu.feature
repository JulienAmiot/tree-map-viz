@HE-2570 @component:shell @phase:7
Feature: Burger menu offers Import / Export / Boards / Settings entries

  SPEC §4 + §17.43: the burger menu in the permanent top bar holds the
  top-level kiosk actions — Import, Export, Boards (board collection
  management), Settings (per-board settings; §17.31) — plus future
  admin entries. It opens on tap of the trigger and closes on outside
  tap (`composedPath`-based, walks shadow DOM correctly so a tap
  elsewhere in the top bar closes only the burger menu and leaves the
  rest of the bar untouched). The Import / Export / Boards consumers
  themselves wire in Phase 10 per SPEC §15.4 + §17.3; the Settings
  consumer is wired in §17.31. This feature only validates the menu
  structure + open/close UX.

  Background:
    When I open the kiosk in test mode with empty storage

  @HE-???? @priority:high
  Scenario: At rest the burger menu is closed
    Then the burger menu is closed

  @HE-???? @priority:high
  Scenario: Tapping the burger trigger reveals exactly 4 items in order (\u00a717.31)
    # SPEC §17.31 — Settings… joins Import / Export / Boards as the
    # fourth menu item (last in the list).
    When I tap the burger trigger
    Then the burger menu is open
    And the burger menu has 4 items
    And the burger menu has an item with action "import"
    And the burger menu has an item with action "export"
    And the burger menu has an item with action "boards"
    And the burger menu has an item with action "settings"

  @HE-???? @priority:high
  Scenario: Tapping the top bar but outside the burger closes only the menu
    When I tap the burger trigger
    And I tap the board name
    Then the burger menu is closed
    And the top bar is visible

  @HE-???? @priority:high
  Scenario: Tapping the burger trigger a second time toggles the menu closed
    When I tap the burger trigger
    And I tap the burger trigger
    Then the burger menu is closed
