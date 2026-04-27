@HE-2570 @component:boot
Feature: App boots and renders the focused tree

  This is the Phase 5 smoke test. It exercises the whole composition root —
  Vite preview, LocalStorage seeding, hash router, navigation service, and
  the `<tree-graph-screen>` Lit element — plus the test bridge, end-to-end.

  @HE-???? @priority:high
  Scenario: Default seed renders the root board's title
    When I open the kiosk in test mode with empty storage
    Then the focused title is "Root"

  @HE-???? @priority:medium
  Scenario: Test bridge seeds a tree and reload renders its root
    When I open the kiosk in test mode with empty storage
    And I seed the org tree via the test bridge
    And I reload the kiosk
    Then the focused title is "UUID1 Title"
