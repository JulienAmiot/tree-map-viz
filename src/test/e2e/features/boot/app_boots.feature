@HE-2570 @component:boot
Feature: App boots and renders the focused tree

  This is the Phase 5 smoke test. It exercises the whole composition root —
  Vite preview, LocalStorage seeding, hash router, navigation service, and
  the `<tree-graph-screen>` Lit element — plus the test bridge, end-to-end.

  @HE-???? @priority:high
  Scenario: Default seed renders the showcase board's root title
    # SPEC §17.21 — a fresh kiosk now lands on the showcase tree
    # (Quarterly OKRs root + 5 children mixing TextNodes / BSCs /
    # computed branches). The minimal "Root" seed is gone; tests that
    # still want it inject a custom seed factory.
    When I open the kiosk in test mode with empty storage
    Then the focused title is "Quarterly OKRs"

  @HE-???? @priority:medium
  Scenario: Test bridge seeds a tree and reload renders its root
    When I open the kiosk in test mode with empty storage
    And I seed the org tree via the test bridge
    And I reload the kiosk
    Then the focused title is "UUID1 Title"
