@HE-2570 @component:views @phase:6
Feature: Text node views render Title + Description (no value, no Σ)

  TextNode is intentionally value-free (SPEC §3, §5). Both `asParent` and
  `asChild` roles must render Title + Description and *only* those fields —
  no value cell, no `Σ` badge, no date.

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "textTree" fixture via the test bridge
    And I reload the kiosk

  @HE-???? @priority:high
  Scenario: TextNode `asParent` renders Title + Description, no value, no Σ
    Then the focused title is "Quarterly review"
    And the focused description is "Top-level scorecard"
    And the focused node has no value
    And the focused node has no computed badge

  @HE-???? @priority:high
  Scenario: TextNode `asChild` renders Title + Description, no value, no Σ
    Then there are 2 child tiles
    And the child "TXT-A" has title "Region"
    And the child "TXT-A" has description "North-east"
    And the child "TXT-A" has no value
    And the child "TXT-A" has no computed badge
