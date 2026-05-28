@HE-2570 @component:boot
Feature: App boots and renders the focused tree

  This is the Phase 5 smoke test. It exercises the whole composition root —
  Vite preview, LocalStorage seeding, hash router, navigation service, and
  the `<tree-map-screen>` Lit element — plus the test bridge, end-to-end.

  @HE-2644 @priority:high
  Scenario: Default seed renders the showcase board's root title
    # SPEC §17.122 — a fresh kiosk lands on the Data Platform Obeya
    # showcase tree (root + six panels: reliability / ingestion /
    # infra-cost / products / team-health / workflow) covering every
    # shipped node kind. The minimal "Root" seed is gone; tests that
    # still want it inject a custom seed factory.
    When I open the kiosk in test mode with empty storage
    Then the focused title is "Data Platform Obeya"

  @HE-2643 @priority:medium
  Scenario: Test bridge seeds a tree and reload renders its root
    When I open the kiosk in test mode with empty storage
    And I seed the org tree via the test bridge
    And I reload the kiosk
    Then the focused title is "UUID1 Title"
