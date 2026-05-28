@HE-2570 @component:layout @phase:7
Feature: Children grid renders N+1 tiles unless at the 12-children cap

  SPEC §4: per-parent capacity is 12 real children. The grid renders
  N + 1 tiles (N children + the "+" affordance) for every count up to
  the cap; at exactly 12 children the "+" is suppressed and only the
  children remain. The numbers below mirror the §12.3 `treemap_n_plus_one`
  outline {0,1,11,12} → tile counts {1,2,12,12}.

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "capacityTree" fixture via the test bridge
    And I reload the kiosk

  @HE-2652 @priority:high
  Scenario Outline: Focused on a parent with <n> child(ren) renders <n> child tiles + <plus> plus tile(s)
    When I focus on node "<focus>"
    Then there are <n> child tiles
    And there are <plus> plus tiles

    Examples:
      | focus | n  | plus |
      | n0    | 0  | 1    |
      | n1    | 1  | 1    |
      | n11   | 11 | 1    |
      | n12   | 12 | 0    |
