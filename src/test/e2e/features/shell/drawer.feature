@HE-2570 @component:shell @phase:7
Feature: Drawer chrome auto-hides and reveals on tap

  SPEC §4: the kiosk has no permanent screen chrome — the focused parent
  fills the whole viewport. A small handle pulls down a drawer that holds
  the board name, the focus breadcrumb, and the burger menu (Import /
  Export / Boards / future admin). The drawer is auto-hidden at rest and
  closes again on a second tap of the handle.

  Background:
    # SPEC §17.21 — the default seed is now the showcase tree (board
    # name "Showcase"). The drawer scenarios pin the board-name
    # rendering, so we seed via the test bridge instead — the bridge
    # always names its board "Test board" (see `adapters/testBridge.ts`).
    When I open the kiosk in test mode with empty storage
    And I seed the "emptyRoot" fixture via the test bridge
    And I reload the kiosk

  @HE-???? @priority:high
  Scenario: At rest the drawer is closed and the handle is visible
    Then the drawer is closed

  @HE-???? @priority:high
  Scenario: Tapping the handle reveals a panel with board name, breadcrumb, and burger
    When I tap the drawer handle
    Then the drawer is open
    And the drawer panel contains the board name "Test board"
    And the drawer panel contains the focus breadcrumb
    And the drawer panel contains the burger trigger

  @HE-???? @priority:high
  Scenario: Tapping the handle a second time hides the drawer again
    When I tap the drawer handle
    And I tap the drawer handle
    Then the drawer is closed
