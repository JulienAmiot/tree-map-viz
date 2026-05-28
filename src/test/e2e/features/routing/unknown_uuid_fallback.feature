@HE-2589 @component:routing @phase:10
Feature: Unknown UUID in the URL hash falls back to the board root (§17.35)

  SPEC §11 line 206 + §17.11: when the URL hash references a node
  uuid that is not in the current board's tree, the composition
  root falls back to the board's root and replaces the URL (so the
  history stack doesn't accumulate broken entries). Two paths
  exercise this:
    - **Bootup**: the initial route's `focusNodeUuid` is unknown.
      `nav.focusByUuid(...)` rejects; `router.replace` writes the
      root id back.
    - **External hash change**: `router.onChange`'s subscriber sees
      `focusByUuid` reject and calls `router.replace` with the root.

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "textTree" fixture via the test bridge
    And I reload the kiosk

  @HE-2737 @priority:high
  Scenario: External hash change to an unknown UUID falls back to the root
    # SPEC §11 — the kiosk treats an unparseable / missing /
    # unknown route as "focus the board root and replace the URL".
    Then the focused id is "TXT-ROOT"
    When I navigate the kiosk to the literal hash "#/b/test-board/n/does-not-exist"
    Then the focused id is "TXT-ROOT"
    And the URL hash includes "/n/TXT-ROOT"

  @HE-2736 @priority:high
  Scenario: Reload on an unknown-UUID hash also falls back to the root
    # The bootup path's `startRoute && startRoute.boardId === ...`
    # branch falls through; the `else { router.replace(... root) }`
    # branch is what we're pinning here.
    When I navigate the kiosk to the literal hash "#/b/test-board/n/never-existed"
    And I reload the kiosk
    Then the focused id is "TXT-ROOT"
    And the URL hash includes "/n/TXT-ROOT"

  @HE-2738 @priority:high
  Scenario: Hash with a non-current board id is ignored (route is for the test-board, not us)
    # SPEC §11: `router.onChange` short-circuits when
    # `state.boardId !== boards.getCurrentBoardId()`. The current
    # focus stays put.
    Then the focused id is "TXT-ROOT"
    When I navigate the kiosk to the literal hash "#/b/some-other-board/n/TXT-A"
    Then the focused id is "TXT-ROOT"
