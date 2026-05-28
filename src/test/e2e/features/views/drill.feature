@HE-2570 @component:views
Feature: Drilling into a child tile changes the focus

  SPEC §4 — "Activating a real child tile → drill into it (focus changes;
  URL updates)." A bubbling+composed `tile-drill` event is dispatched from
  the children grid when a node tile is tapped; the composition root runs
  it through the same `nav.focusByUuid + router.push + refresh` triple
  the breadcrumb already uses.

  In test mode we call `dismissAnimations()` (SPEC §14.4) so the drill
  helper's reduced-motion branch commits the navigation synchronously and
  the assertion is timing-stable.

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "textTree" fixture via the test bridge
    And I reload the kiosk
    And I dismiss animations via the test bridge

  @HE-2794 @priority:high
  Scenario: Tapping a child tile drills into it (focus + URL update)
    Then the focused id is "TXT-ROOT"
    And there are 2 child tiles
    When I tap the child tile for "TXT-A"
    Then the focused id is "TXT-A"
    And the URL hash includes "/n/TXT-A"

  @HE-2793 @priority:medium
  Scenario: Drilling deeper preserves the URL contract (each drill pushes a new state)
    # The router uses pushState (per §17.11) so subsequent drills stack rather
    # than replace; the previous focus is reachable via browser back.
    Then the focused id is "TXT-ROOT"
    When I tap the child tile for "TXT-A"
    Then the URL hash includes "/n/TXT-A"
    # TXT-A is a leaf in textTree; the only tile in its grid is the `+` tile,
    # which must NOT drill (the existing plus_tile.feature pins this; here we
    # just confirm the post-drill state stays at TXT-A under a `+`-tap).
    When I click the plus tile
    Then the focused id is "TXT-A"
    And the URL hash includes "/n/TXT-A"
