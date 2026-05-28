@HE-2570 @component:modal @phase:8
Feature: Empty modal fields use the placeholder pattern (no labels)

  SPEC §6 (refined in §17.13): modal form fields show a distinctively
  styled placeholder of the form `<Field name> — e.g. <mock>` — the
  capital-leading field name (re-)states the input's purpose, and the
  `e.g.` clause carries a concrete sample value. No `<label>` siblings;
  the placeholder *is* the field's affordance. Typing into the field
  replaces the placeholder with the user's value.

  Background:
    When I open the kiosk in test mode with empty storage
    And I click the plus tile

  @HE-2685 @priority:high
  Scenario: TextNode form — every text/number/textarea field has a "<Field name> — e.g. <mock>" placeholder
    When I pick the kind "TextNode"
    Then every modal text input has a placeholder of the form "<Field name> — e.g. <mock>"

  @HE-2683 @priority:high
  Scenario: BSC form — every text/number/date/textarea field has a "<Field name> — e.g. <mock>" placeholder
    When I pick the kind "BusinessScoreCardNode"
    Then every modal text input has a placeholder of the form "<Field name> — e.g. <mock>"

  @HE-2682 @priority:high
  Scenario: Typing into the title field replaces the placeholder with the user's value
    When I pick the kind "TextNode"
    And I fill in the title with "Some new title"
    Then the title field shows the value "Some new title"

  @HE-2684 @priority:high
  Scenario: The modal form has no <label> next to text/number/date inputs (only on checkboxes)
    When I pick the kind "BusinessScoreCardNode"
    Then no modal <label> wraps a text, number, date, or textarea field
