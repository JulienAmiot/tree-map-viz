@HE-2570 @component:shell @phase:7
Feature: Breadcrumb shows the focus path and navigates on tap

  SPEC §4 + §17.43: the breadcrumb renders the path from root →
  focused node as a row of tappable segments inside the permanent
  top bar. The focused segment is non-tappable and marked
  `aria-current="page"`. Tapping any ancestor segment focuses that
  node — the URL hash is the source of truth, so
  `walkPath(boardTree, focusedId)` reflects the new focus on the
  very next refresh (SPEC §9).

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "capacityTree" fixture via the test bridge
    And I reload the kiosk

  @HE-2749 @priority:high
  Scenario: At root the breadcrumb shows a single non-tappable segment
    Then the breadcrumb has 1 segment
    And breadcrumb segment 1 shows "Capacity test root"
    And the last breadcrumb segment is the current page

  @HE-2747 @priority:high
  Scenario: A 3-deep focus produces 3 segments root → … → focused
    When I focus on node "n11c5"
    Then the breadcrumb has 3 segments
    And breadcrumb segment 1 shows "Capacity test root"
    And breadcrumb segment 2 shows "Eleven children"
    And breadcrumb segment 3 shows "5"
    And the last breadcrumb segment is the current page

  @HE-2748 @priority:high
  Scenario: Tapping an ancestor segment navigates to that ancestor
    When I focus on node "n11c5"
    And I tap the breadcrumb segment for "n11"
    Then the focused id is "n11"
    And the breadcrumb has 2 segments
    And breadcrumb segment 2 shows "Eleven children"
