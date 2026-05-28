@HE-2570 @component:views @phase:6
Feature: TextNode values render Markdown (SPEC §17.27)

  TextNode values pass through a small zero-dependency markdown
  pipeline (escape-first, then bold/italic/code/headings/lists/links).
  The rendered DOM gains the corresponding semantic elements so the
  kiosk operator can compose richer notes than a single line of plain
  text. The body's font-size is tile-relative (`cqmin` clamp) and
  tightened by a JS shrink-to-fit pass so the full content stays
  visible regardless of tile size.

  Background:
    When I open the kiosk in test mode with empty storage
    And I seed the "markdownTextTree" fixture via the test bridge
    And I reload the kiosk

  @HE-2800 @priority:high
  Scenario: Markdown source renders the matching semantic elements
    Then the focused title is "Markdown demo"
    And the focused value contains a "h4" element
    And the focused value contains a "strong" element
    And the focused value contains a "em" element
    And the focused value contains a "ul" element
    And the focused value contains 2 "li" elements
    And the focused value contains a "code" element

  @HE-2799 @priority:high
  Scenario: The markdown body font-size adapts to the tile (between 8 and 64 px)
    Then the focused value's body font-size is between 8 and 64 pixels
