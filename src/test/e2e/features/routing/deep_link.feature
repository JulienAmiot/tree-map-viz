@HE-2587 @component:routing @phase:10
Feature: Deep-linking via the URL hash (§17.35)

  SPEC §9 + §17.11: the hash router (`HashRouter`) treats the URL
  hash `#/b/<boardId>/n/<focusNodeUuid>` as the source of truth for
  which node is focused. On boot, the composition root reads the
  current hash and seeds the navigation service from it; on every
  external hash change (browser back/forward, manual edit, paste),
  `router.onChange` re-runs `nav.focusByUuid` + `refresh`.

  These scenarios pin the deep-link contract end-to-end: opening the
  kiosk on a specific URL lands on the matching focus, and reloading
  preserves it.

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "textTree" fixture via the test bridge
    And I reload the kiosk

  @HE-2703 @priority:high
  Scenario: Reloading on a non-root deep link lands focused on that node
    # Drive the URL to a non-root focus, then reload — the bootup
    # path's `nav.focusByUuid(startRoute.focusNodeUuid)` must read
    # the hash and seed the navigation service to the right node.
    When I focus on node "TXT-A"
    And I reload the kiosk
    Then the focused id is "TXT-A"
    And the focused title is "Region"
    And the URL hash includes "/n/TXT-A"

  @HE-2704 @priority:high
  Scenario: Reloading on the root deep link lands focused at root
    When I focus on node "TXT-ROOT"
    And I reload the kiosk
    Then the focused id is "TXT-ROOT"
    And the focused title is "Quarterly review"
    And the URL hash includes "/n/TXT-ROOT"

  @HE-2705 @priority:high
  Scenario: Manually changing the hash to an existing node updates the focus
    # External hash change (the operator pastes a URL, browser
    # back/forward, etc.). `router.onChange` runs synchronously
    # inside the hashchange handler.
    Then the focused id is "TXT-ROOT"
    When I navigate the kiosk to the focus hash for node "TXT-A"
    Then the focused id is "TXT-A"
    And the URL hash includes "/n/TXT-A"
