@HE-2570 @component:shell @phase:9
Feature: Close-to-parent X navigates the focused panel back up

  SPEC §17.23: when the focused node has a parent, the parent-identity
  strip overlays a small "X" button at its top-right corner. Tapping it
  is equivalent to tapping the parent's breadcrumb segment — the focus
  moves to the parent, the URL hash is updated, and the kiosk re-renders.
  At the root (no parent), the X is omitted entirely.

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "capacityTree" fixture via the test bridge
    And I reload the kiosk

  @HE-2759 @priority:high
  Scenario: At root focus the close-to-parent button is not rendered
    Then the focused id is "capacity-root"
    And the close-to-parent button is not rendered

  @HE-2758 @priority:high
  Scenario: After drilling, the close-to-parent button is visible on the focused panel
    When I focus on node "n11c5"
    Then the focused id is "n11c5"
    And the close-to-parent button is visible
    And the close-to-parent button targets node "n11"

  @HE-2756 @priority:high
  Scenario: Tapping the close-to-parent button focuses the parent
    When I focus on node "n11c5"
    And I tap the close-to-parent button
    Then the focused id is "n11"
    And the focused title is "Eleven children"
    And the close-to-parent button is visible
    And the close-to-parent button targets node "capacity-root"

  @HE-2757 @priority:high
  Scenario: Walking up to the root removes the close-to-parent button
    When I focus on node "n11c5"
    And I tap the close-to-parent button
    And I tap the close-to-parent button
    Then the focused id is "capacity-root"
    And the close-to-parent button is not rendered
