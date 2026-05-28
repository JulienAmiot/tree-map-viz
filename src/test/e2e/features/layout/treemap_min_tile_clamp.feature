@HE-2570 @component:layout @phase:7
Feature: Children grid clamps small tiles to the 1/12 floor

  SPEC §4: when child weights are skewed, the smallest tile must be
  clamped up to 1/12 of the children area so every tile remains tappable.
  The squarify quality degrades slightly in exchange (acceptable, kiosk
  ergonomics outrank tile-aspect purity). The `clampWeightsToFloor` pass
  in `treemapSquarify` enforces this; the scenario below asserts the
  floor end-to-end against a real Chromium viewport with weights
  100/1/1/1 (plus the "+" tile's implicit weight of 1).

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "skewedWeights" fixture via the test bridge
    And I reload the kiosk

  @HE-2650 @priority:high
  Scenario: Smallest tile is clamped up to the one-twelfth floor
    Then there are 4 child tiles
    And there is exactly one plus tile
    And every tile area is at least one twelfth of the inner children grid area

  @HE-2649 @priority:medium
  Scenario: Tiles together cover the inner children grid area
    Then the sum of tile areas covers the inner children grid area within 2%
