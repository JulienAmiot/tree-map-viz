@HE-2570 @component:views @phase:6
Feature: Text node views render Title + the latest text value (timestamp top-right)

  TextNode is now a `Historizable<string>` (SPEC §17.14). Both `asParent`
  and `asChild` roles render Title + the latest `TimestampedValue<string>`
  (its `.value` becomes the displayed text, its `.asOf` the timestamp in
  the tile's top-right corner). Description is no longer rendered in the
  tile body; it stays on `NodeIdentity` as a domain field.

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "textTree" fixture via the test bridge
    And I reload the kiosk

  @HE-???? @priority:high
  Scenario: TextNode `asParent` renders Title + value (no description, no Σ)
    Then the focused title is "Quarterly review"
    And the focused value is "On track for Q2"
    And the focused value has a date
    And the focused node has no computed badge
    And the focused tile has no description block

  @HE-???? @priority:high
  Scenario: TextNode `asChild` renders Title + value (no description, no Σ)
    Then there are 2 child tiles
    And the child "TXT-A" has title "Region"
    And the child "TXT-A" has value "North-east region"
    And the child "TXT-A" has a date
    And the child "TXT-A" has no computed badge

  @HE-???? @priority:high
  Scenario: TextNode with empty history renders an empty value area and no timestamp
    When I focus on node "TXT-B"
    Then the focused title is "Bare"
    And the focused value area is empty
    And the focused value has no date
    And the focused node has no computed badge
