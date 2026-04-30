@HE-2570 @component:shell @phase:7
Feature: Drawer chrome auto-hides and reveals on tap

  SPEC §4: the kiosk has no permanent screen chrome — the focused parent
  fills the whole viewport. A small handle pulls down a drawer that holds
  the board name, the focus breadcrumb, and the burger menu (Import /
  Export / Boards / future admin). The drawer is auto-hidden at rest and
  closes again on a second tap of the handle.

  Background:
    When I open the kiosk in test mode with empty storage

  @HE-???? @priority:high
  Scenario: At rest the drawer is closed and the handle is visible
    Then the drawer is closed

  @HE-???? @priority:high
  Scenario: Tapping the handle reveals a panel with board name, breadcrumb, and burger
    When I tap the drawer handle
    Then the drawer is open
    And the drawer panel contains the board name "Default Board"
    And the drawer panel contains the focus breadcrumb
    And the drawer panel contains the burger trigger

  @HE-???? @priority:high
  Scenario: Tapping the handle a second time hides the drawer again
    When I tap the drawer handle
    And I tap the drawer handle
    Then the drawer is closed
