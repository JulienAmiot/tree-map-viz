@HE-2570 @component:layout @phase:7
Feature: Layout reflows when the viewport rotates

  SPEC §4: aspect 16/9 in landscape, 9/16 in portrait. The shell hosts
  an `OrientationController` that observes the host's content rect via
  `ResizeObserver` and reports `'landscape' | 'portrait'`; the shell
  reflects the value as `data-orientation` on the layout wrapper.

  SPEC §17.46 amends the pre-§17.46 "parent identity strip stays at
  the top in both orientations" rule: in portrait the strip stays on
  TOP (above the children grid); in landscape the strip docks to the
  LEFT 25 % rail (to the left of the children grid) so the rail can
  hold the §17.45 metric / description vertical split.

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "textTree" fixture via the test bridge
    And I reload the kiosk

  @HE-2647 @priority:high
  Scenario: Default Playwright viewport (1280x720) reports landscape
    Then the layout orientation is "landscape"
    And the parent strip is to the left of the children grid

  @HE-2645 @priority:high
  Scenario: Resizing to a portrait viewport flips the orientation flag
    When I resize the viewport to 400x900
    Then the layout orientation is "portrait"
    And the parent strip is above the children grid

  @HE-2646 @priority:high
  Scenario: Rotating back to landscape flips the orientation again
    When I resize the viewport to 400x900
    And I resize the viewport to 1280x720
    Then the layout orientation is "landscape"
    And the parent strip is to the left of the children grid
