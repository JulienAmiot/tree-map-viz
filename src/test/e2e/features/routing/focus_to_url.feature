@HE-2588 @component:routing @phase:10
Feature: Every focus change reflects in the URL hash (§17.35)

  SPEC §11.3 + §17.11 + §17.20 + §17.32: the URL hash
  (`#/b/<boardId>/n/<focusNodeUuid>`) is the source of truth for
  which node is focused. The composition root pushes a new history
  entry on user-driven focus changes (drill / breadcrumb /
  close-to-parent) so the browser's Back button restores the
  previous focus, and replaces the entry on bootup-time fallbacks
  (unknown uuid → root) and destructive ops (import / board
  switch / board create) so history stays clean.

  These scenarios pin the focus → URL contract for every reachable
  focus-change gesture today.

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "textTree" fixture via the test bridge
    And I reload the kiosk
    And I dismiss animations via the test bridge

  @HE-???? @priority:high
  Scenario: Drilling into a child tile pushes the new focus on the URL
    # Drill is a `pushState` (history accumulates).
    Then the URL hash includes "/n/TXT-ROOT"
    When I tap the child tile for "TXT-A"
    Then the focused id is "TXT-A"
    And the URL hash includes "/n/TXT-A"

  @HE-???? @priority:high
  Scenario: Browser Back after a drill restores the previous focus
    # SPEC §11.3: drill uses pushState, so the browser back stack
    # holds the pre-drill focus. router.onChange picks the change
    # up and the composition root re-focuses + refreshes.
    When I tap the child tile for "TXT-A"
    Then the focused id is "TXT-A"
    When I press the browser back button
    Then the focused id is "TXT-ROOT"
    And the URL hash includes "/n/TXT-ROOT"

  @HE-???? @priority:high
  Scenario: Tapping a breadcrumb ancestor segment updates the URL
    # The breadcrumb lives in the drawer body; the drawer is auto-
    # hidden by default and intercepts pointer events when closed.
    # Open it first, same prelude as `shell/breadcrumb.feature`.
    When I tap the child tile for "TXT-A"
    Then the focused id is "TXT-A"
    When I tap the drawer handle
    And I tap the breadcrumb segment for "TXT-ROOT"
    Then the focused id is "TXT-ROOT"
    And the URL hash includes "/n/TXT-ROOT"

  @HE-???? @priority:high
  Scenario: Tapping the close-to-parent X updates the URL
    When I tap the child tile for "TXT-A"
    Then the focused id is "TXT-A"
    When I tap the close-to-parent button
    Then the focused id is "TXT-ROOT"
    And the URL hash includes "/n/TXT-ROOT"
