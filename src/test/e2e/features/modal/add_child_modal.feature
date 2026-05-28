@HE-2570 @component:modal @phase:8
Feature: Add-child modal opens from the "+" tile and appends a new child

  SPEC §7: activating the "+" tile opens a wide modal with a
  semi-transparent backdrop so the underlying board is still partially
  visible. SPEC §17.25 — the modal is a two-pane layout: a kind list on
  the left (~20 % width, one button per available kind) picks the node
  kind (each button shows "Name" + "Description", same content the
  pre-§17.19 kind-cards carried), and the type-specific form (using
  the empty-field placeholder pattern, §6) appears in the right pane
  (~80 % width) as soon as a kind is chosen. Confirm appends a child
  to the focused parent and persists; cancel never persists.
  Activating the "+" tile is never a navigation; the focused id stays
  put through the whole interaction.

  Background:
    # SPEC §17.21 — the default seed is the showcase tree (with 5 root
    # children). These scenarios need a baseline where the focused
    # parent has zero children, so we explicitly seed an empty single-
    # TextNode tree via the test bridge instead of relying on the seed.
    When I open the kiosk in test mode with empty storage
    And I seed the "emptyRoot" fixture via the test bridge
    And I reload the kiosk

  @HE-2668 @priority:high
  Scenario: At rest the modal is closed
    Then the add-child modal is closed
    And there are 0 child tiles
    And there is exactly one plus tile

  @HE-2680 @priority:high
  Scenario: Clicking the "+" tile opens the modal with a left-rail kind list (§17.25)
    When I click the plus tile
    Then the add-child modal is open
    # §17.118 / §17.119 / §17.120 / §17.94 / §17.95 / §17.77 — catalogue grew
    # from the initial 3 (Text + Workflow + BSC) to 8 across the v5 round-7
    # surface-coverage strands. Order matches `KIND_OPTIONS` in `AddChildModal.ts`.
    And the modal kind list shows "8" options labelled with name and description
    And the modal offers a "Text" kind
    And the modal offers a "Workflow" kind
    And the modal offers a "Business Score Card" kind
    And the modal offers a "Strict Range" kind
    And the modal offers a "Computed" kind
    And the modal offers a "Computed Business Score Card" kind
    And the modal offers a "Picture" kind
    And the modal offers a "URL" kind

  @HE-2679 @priority:high
  Scenario: Before a kind is chosen, no type-specific fields render in the right pane (§17.25)
    When I click the plus tile
    Then the add-child modal is open
    And the modal has no title field
    And the modal has no current-value field
    And the modal has no unit field

  @HE-2665 @priority:high
  Scenario: The modal backdrop is semi-transparent (the board is still behind)
    When I click the plus tile
    Then the modal backdrop is semi-transparent

  @HE-2677 @priority:high
  Scenario: Picking Text reveals title + weight + current-value (no description, no unit, no objective — §17.15)
    When I click the plus tile
    And I pick the kind "TextNode"
    Then the add-child modal is open
    And the modal form is for kind "TextNode"
    And the modal has a title field
    And the modal has no description field
    And the modal has a weight field
    And the modal has a current-value field
    And the as-of date defaults to today's local-calendar ISO
    And the modal has no unit field
    And the modal has no objective fields

  @HE-2678 @priority:high
  Scenario: Picking BusinessScoreCard reveals description + unit + current-value + objective fields
    # SPEC §17.99b/c retired the v3-era `computed` + `eligible-for-
    # parent-computation` checkboxes from the add-child modal — a
    # computed BSC is now created via the parent's kind picker, not
    # via toggles on the child form. The two former toggle assertions
    # were dropped from this scenario accordingly.
    When I click the plus tile
    And I pick the kind "BusinessScoreCardNode"
    Then the modal form is for kind "BusinessScoreCardNode"
    And the modal has a description field
    And the modal has a unit field
    And the modal has a current-value field
    And the as-of date defaults to today's local-calendar ISO
    And the modal has objective fields

  @HE-2676 @priority:high
  Scenario: Switching the kind from Text to BusinessScoreCard swaps in the BSC form (§17.25)
    When I click the plus tile
    And I pick the kind "TextNode"
    Then the modal has no unit field
    When I pick the kind "BusinessScoreCardNode"
    Then the modal form is for kind "BusinessScoreCardNode"
    And the modal has a unit field
    And the modal has a description field

  @HE-2659 @priority:high
  Scenario: Confirming a Text child appends it to the focused parent and closes the modal
    When I click the plus tile
    And I pick the kind "TextNode"
    And I fill in the title with "Quarterly review"
    And I fill in the current value with "Q2 was on track"
    And I confirm the add-child modal
    Then the add-child modal is closed
    And there are 1 child tiles
    And the focused id is unchanged after the modal interaction

  @HE-2661 @priority:high
  Scenario: Cancel closes the modal without adding a child
    When I click the plus tile
    And I pick the kind "TextNode"
    And I fill in the title with "Should not stick"
    And I cancel the add-child modal
    Then the add-child modal is closed
    And there are 0 child tiles

  @HE-2675 @priority:high
  Scenario: The top-right close-X dismisses the modal without adding a child (SPEC §17.29)
    # SPEC §17.29 — every modal in the app carries a close-X glyph
    # in its top-right corner. Tapping it is a fourth close path
    # alongside Cancel / Escape / backdrop tap; never persists.
    When I click the plus tile
    And I pick the kind "TextNode"
    And I fill in the title with "Should not stick"
    And I tap the modal close-X
    Then the add-child modal is closed
    And there are 0 child tiles

  @HE-2674 @priority:high
  Scenario: Modal panel is content-sized and capped at viewport - 4rem (SPEC §17.29)
    # SPEC §17.29 — the modal panel never exceeds the viewport (modulo
    # a 4rem margin) and otherwise shrinks to its content. Pre-§17.29
    # the panel was pinned to inset:5vh 8vw which forced ~84vw / 90vh
    # regardless of how little content the modal carried.
    When I click the plus tile
    Then the modal panel fits inside the viewport with at least 2rem of margin

  @HE-2658 @priority:high
  Scenario: Activating the "+" tile is not a navigation (focused id is unchanged)
    When I click the plus tile
    And I pick the kind "TextNode"
    And I fill in the title with "Stable focus"
    And I fill in the current value with "Today's update"
    And I confirm the add-child modal
    Then the focused id is unchanged after the modal interaction

  @HE-2673 @priority:high
  Scenario: Weight is a slider + numeric input pair, bidirectionally synced (§17.26)
    When I click the plus tile
    And I pick the kind "TextNode"
    Then the weight slider runs 0.5..10 step 0.5 and mirrors the number input
    When I set the weight slider to "3.5"
    Then the weight number input shows the value "3.5"

  @HE-2672 @priority:high
  Scenario: Picking Strict Range reveals title + description + weight + range + current-value + as-of (no unit, no objective — §17.77 / §17.94)
    # SPEC §17.77 / §17.94 — `StrictRangeNode<number>` is the bounded-metric
    # kind. The form collects min + max + a seed observation, but no unit
    # (the bounds carry the dimension implicitly) and no objective (the
    # range itself defines acceptance; no target progression bar).
    When I click the plus tile
    And I pick the kind "StrictRangeNode"
    Then the modal form is for kind "StrictRangeNode"
    And the modal has a title field
    And the modal has a description field
    And the modal has a weight field
    And the modal has range fields
    And the modal has a current-value field
    And the as-of date defaults to today's local-calendar ISO
    And the modal has no unit field
    And the modal has no objective fields

  @HE-2671 @priority:high
  Scenario: Switching from BSC to Strict Range swaps the form (§17.25 / §17.77)
    # SPEC §17.25 — kind swaps re-render the right-pane form without
    # closing the modal. The previously-visible unit + objective rows
    # retire and the range row appears in their place.
    When I click the plus tile
    And I pick the kind "BusinessScoreCardNode"
    Then the modal has a unit field
    And the modal has objective fields
    And the modal has no range fields
    When I pick the kind "StrictRangeNode"
    Then the modal form is for kind "StrictRangeNode"
    And the modal has range fields
    And the modal has no unit field
    And the modal has no objective fields

  @HE-2670 @priority:high
  Scenario: Confirming a Strict Range child appends it to the focused parent and closes the modal (§17.77 / §17.94)
    # SPEC §17.77 — the seed value `42` lives inside `[0, 100]` so the
    # domain accepts it; the child appends and the modal closes.
    When I click the plus tile
    And I pick the kind "StrictRangeNode"
    And I fill in the title with "Headcount"
    And I set the range min to "0"
    And I set the range max to "100"
    And I fill in the current value with "42"
    And I confirm the add-child modal
    Then the add-child modal is closed
    And there are 1 child tiles
    And the focused id is unchanged after the modal interaction

  @HE-2669 @priority:high
  Scenario: Picking Computed reveals title + description + weight + strategy picker (no seed value, no unit, no objective — §17.94)
    # SPEC §17.94 — `ComputedNode` is a derived metric: its value is
    # rolled up from eligible children through a strategy, so the
    # modal collects ONLY the strategy choice (no seed observation,
    # no unit, no objective, no range).
    When I click the plus tile
    And I pick the kind "ComputedNode"
    Then the modal form is for kind "ComputedNode"
    And the modal has a title field
    And the modal has a description field
    And the modal has a weight field
    And the modal has a strategy picker
    And the modal has no current-value field
    And the modal has no unit field
    And the modal has no objective fields
    And the modal has no range fields

  @HE-2667 @priority:high
  Scenario: Confirming a Computed child with the default strategy appends and closes the modal (§17.94)
    # SPEC §17.94 — `computationKindName` defaults to "AVERAGE" so
    # confirming without touching the strategy dropdown still produces
    # a valid ComputedNode. No seed value to fill (the derived value
    # is computed from the focused parent's eligible children at
    # render time).
    When I click the plus tile
    And I pick the kind "ComputedNode"
    And I fill in the title with "North-region rollup"
    And I confirm the add-child modal
    Then the add-child modal is closed
    And there are 1 child tiles
    And the focused id is unchanged after the modal interaction

  @HE-2666 @priority:high
  Scenario: Picking Computed Business Score Card reveals unit + target objective + strategy (no initial baseline, no seed value — §17.95)
    # SPEC §17.95 — `ComputedBusinessScoreNode` combines the BSC's
    # measured shape (unit + target objective) with the Computed
    # roll-up strategy. The "initial" baseline that a plain BSC
    # carries is omitted (the rolled-up value carries no up-front
    # observation), so the objective row exposes only target value
    # + target date.
    When I click the plus tile
    And I pick the kind "ComputedBusinessScoreNode"
    Then the modal form is for kind "ComputedBusinessScoreNode"
    And the modal has a title field
    And the modal has a description field
    And the modal has a weight field
    And the modal has a unit field
    And the modal has the target-only objective fields
    And the modal has a strategy picker
    And the modal has no current-value field
    And the modal has no range fields

  @HE-2664 @priority:high
  Scenario: Switching from Computed to Computed Business Score Card adds unit + objective fields (§17.25 / §17.95)
    # SPEC §17.25 — kind swaps re-render the right pane without
    # closing the modal. The strategy picker stays put (both Computed
    # variants share `renderComputationKindField`); the CBSN switch
    # adds unit + target objective rows on top.
    When I click the plus tile
    And I pick the kind "ComputedNode"
    Then the modal has a strategy picker
    And the modal has no unit field
    When I pick the kind "ComputedBusinessScoreNode"
    Then the modal form is for kind "ComputedBusinessScoreNode"
    And the modal has a strategy picker
    And the modal has a unit field
    And the modal has the target-only objective fields

  @HE-2663 @priority:high
  Scenario: Confirming a Computed Business Score Card child with the default strategy appends and closes the modal (§17.95)
    # SPEC §17.95 — minimum-viable CBSN seed: title + unit + target value
    # + target date. Description is optional (no `required` attribute);
    # the strategy defaults to AVERAGE. The seed observation field is
    # absent on this kind, so there's no current-value to fill.
    When I click the plus tile
    And I pick the kind "ComputedBusinessScoreNode"
    And I fill in the title with "North-region scored rollup"
    And I set the modal field "field-unit" to "%"
    And I set the modal field "field-target" to "100"
    And I set the modal field "field-target-date" to "2027-12-31"
    And I confirm the add-child modal
    Then the add-child modal is closed
    And there are 1 child tiles
    And the focused id is unchanged after the modal interaction

  @HE-2662 @priority:high
  Scenario: Picking Workflow reveals title + weight + status picker + current-value + as-of (§17.118)
    # SPEC §17.118 — Workflow is a TextNode plus a board-level status
    # badge. The form therefore carries the full TextNode current-value
    # row (textarea + as-of date) on top of the new status `<select>`.
    # No unit / objective / range / strategy: those belong to
    # measurable kinds and roll-up kinds respectively.
    When I click the plus tile
    And I pick the kind "Workflow"
    Then the modal form is for kind "Workflow"
    And the modal has a title field
    And the modal has a weight field
    And the modal has a status picker
    And the modal has a current-value field
    And the as-of date defaults to today's local-calendar ISO
    And the modal has no unit field
    And the modal has no objective fields
    And the modal has no range fields
    And the modal has no strategy picker

  @HE-2660 @priority:high
  Scenario: Confirming a Workflow child appends with the default "plan" status (§17.118)
    # SPEC §17.118 — `DEFAULT_WORKFLOW_STATUS_ID` is `"plan"`; the
    # modal's `statusId` defaults to it so confirming without touching
    # the status dropdown produces a PLAN-tagged WorkflowNode. The
    # current value (textarea) is still required.
    When I click the plus tile
    And I pick the kind "Workflow"
    And I fill in the title with "Migrate the kiosk to v3"
    And I fill in the current value with "Kickoff scheduled for next sprint."
    And I confirm the add-child modal
    Then the add-child modal is closed
    And there are 1 child tiles
    And the focused id is unchanged after the modal interaction

  @HE-2657 @priority:high
  Scenario: Picking Picture reveals title + weight + image-url and nothing else (§17.119)
    # SPEC §17.119 — PictureNode is a title-bearing image card. The
    # only kind-specific input is the image URL (object-fit: cover at
    # render time). No description, no current-value, no unit, no
    # objective, no range, no strategy, no status.
    When I click the plus tile
    And I pick the kind "PictureNode"
    Then the modal form is for kind "PictureNode"
    And the modal has a title field
    And the modal has no description field
    And the modal has a weight field
    And the modal has an image-url field
    And the modal has no current-value field
    And the modal has no unit field
    And the modal has no objective fields
    And the modal has no range fields
    And the modal has no strategy picker
    And the modal has no status picker

  @HE-2656 @priority:high
  Scenario: Confirming a Picture child appends with a valid image URL (§17.119)
    # SPEC §17.119 — minimum-viable Picture seed: title + a syntactically
    # valid image URL. Render-time load failures surface a warning glyph
    # in the tile; the modal doesn't probe the URL.
    When I click the plus tile
    And I pick the kind "PictureNode"
    And I fill in the title with "Team retrospective whiteboard"
    And I set the modal field "field-image-url" to "https://example.com/retro.jpg"
    And I confirm the add-child modal
    Then the add-child modal is closed
    And there are 1 child tiles
    And the focused id is unchanged after the modal interaction

  @HE-2655 @priority:high
  Scenario: Picking URL reveals title + weight + URL field and nothing else (§17.120)
    # SPEC §17.120 — URLNode is a title-bearing QR card. The only
    # kind-specific input is the URL (rendered as a scannable QR with
    # object-fit: contain at render time). No description, no
    # current-value, no unit, no objective, no range, no strategy,
    # no status.
    When I click the plus tile
    And I pick the kind "URLNode"
    Then the modal form is for kind "URLNode"
    And the modal has a title field
    And the modal has no description field
    And the modal has a weight field
    And the modal has a url field
    And the modal has no image-url field
    And the modal has no current-value field
    And the modal has no unit field
    And the modal has no objective fields
    And the modal has no range fields
    And the modal has no strategy picker
    And the modal has no status picker

  @HE-2654 @priority:high
  Scenario: Confirming a URL child appends with a valid URL (§17.120)
    # SPEC §17.120 — minimum-viable URL seed: title + a syntactically
    # valid URL. QR generation failures surface a warning glyph at
    # render time; the modal doesn't probe the URL.
    When I click the plus tile
    And I pick the kind "URLNode"
    And I fill in the title with "Onboarding handbook"
    And I set the modal field "modal-url" to "https://example.com/onboarding"
    And I confirm the add-child modal
    Then the add-child modal is closed
    And there are 1 child tiles
    And the focused id is unchanged after the modal interaction
