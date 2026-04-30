@HE-2570 @component:modal @phase:8
Feature: Empty modal fields use the placeholder pattern (no labels)

  SPEC §6: modal form fields show a distinctively styled placeholder that
  doubles as an example mock value (starting with "e.g."). No `<label>`
  siblings; the placeholder is the field's purpose. Typing into the field
  replaces the placeholder with the user's value.

  Background:
    When I open the kiosk in test mode with empty storage
    And I click the plus tile

  @HE-???? @priority:high
  Scenario: TextNode form — every text/number/textarea field has an "e.g." placeholder
    When I pick the kind "TextNode"
    Then every modal text input has a placeholder starting with "e.g."

  @HE-???? @priority:high
  Scenario: BSC form — every text/number/date/textarea field has an "e.g." placeholder
    When I pick the kind "BusinessScoreCardNode"
    Then every modal text input has a placeholder starting with "e.g."

  @HE-???? @priority:high
  Scenario: Typing into the title field replaces the placeholder with the user's value
    When I pick the kind "TextNode"
    And I fill in the title with "Some new title"
    Then the title field shows the value "Some new title"

  @HE-???? @priority:high
  Scenario: The modal form has no <label> next to text/number/date inputs (only on checkboxes)
    When I pick the kind "BusinessScoreCardNode"
    Then no modal <label> wraps a text, number, date, or textarea field
