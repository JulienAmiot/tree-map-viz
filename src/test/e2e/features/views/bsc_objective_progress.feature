@HE-2570 @component:views @phase:10
Feature: BSC objective row, gradient value colour, off-track warning (§17.40 + §17.44)

  SPEC §17.40 enriches the BusinessScoreCard tile rendering so the
  operator can read the metric's *progress* against the recorded
  objective at a glance, without consulting the edit modal:

    1. Under the current value, a small target row shows the target
       value, the unit, the target date, a bullseye marker on the
       left, and (§17.44) the deadline-risk warning glyph on the
       right end of the row. The row sizes itself at ~20 % of the
       value's cqmin-driven font-size so the proportion holds at
       every tile size; the bullseye + text + date are painted in
       the default tile text colour (the gradient pop is reserved
       for the value glyph and for the §17.44 warning glyph).
    2. The current value (and its inline unit) are painted with a
       four-stop red → orange → yellow → green ramp keyed to the
       value's progress fraction between the objective's `min` and
       `target`. Direction-agnostic: ascending objectives (target >
       min) and descending objectives (target < min) both read off
       the same fraction so the same colour ⇒ same severity.
    3. When the operator's recorded trajectory (least-squares fit
       through the BSC's history), extrapolated to `targetDate`,
       predicts a value that does not reach the target, a small
       warning glyph appears at the right end of the target row
       (§17.44 — pre-§17.44 it was absolutely positioned at the
       tile's bottom-left in plain currentColor). §17.44 tints the
       glyph on a three-stop yellow → orange → red ramp keyed to
       the *deviation magnitude* — yellow when the trend is just
       barely below trajectory, red when the predicted value falls
       back to `min` or worse — so the operator decodes "how badly
       are we missing?" at a glance instead of the binary "is it
       missing?" the §17.40 amendment offered.

  These contracts are layout-and-colour, so we assert via real-browser
  computed styles (jsdom is too lossy for shadow-scoped CSS variables).

  The `objectiveProgress` fixture seeds three BSC nodes:
    - `Root`        — computed root, 1 historised entry.
    - `OnTrack`     — recorded BSC pacing on the projection line
                      (current 80 vs ~33 expected at the test date,
                      so AHEAD of schedule — gradient at ~80 % →
                      green-yellow, no warning).
    - `OffTrack`    — recorded BSC behind the projection (current 5
                      vs ~33 expected — RED gradient, warning glyph
                      visible).

  @HE-2769 @priority:high
  Scenario: Each child BSC tile shows a target row with target value and target date
    # SPEC §17.141 dropped the unit from the target cell — the unit
    # now lives on the title-prefix chip (§17.125), and the target
    # cell renders ONLY the bare numeric value. The assertion below
    # is on "100" rather than "100 %" accordingly.
    When I open the kiosk in test mode with empty storage
    And I seed the "objectiveProgress" fixture via the test bridge
    And I reload the kiosk
    Then the child tile "OnTrack" shows a target row with text containing "100"
    And the child tile "OffTrack" shows a target row with text containing "100"

  @HE-2773 @priority:high
  Scenario: Each child BSC value carries a gradient colour painted via --bsc-value-color
    When I open the kiosk in test mode with empty storage
    And I seed the "objectiveProgress" fixture via the test bridge
    And I reload the kiosk
    Then the child tile "OnTrack" value carries a gradient colour
    And the child tile "OffTrack" value carries a gradient colour

  @HE-2771 @priority:high
  Scenario: Off-track BSC shows a warning glyph in the target row tinted by deviation magnitude (§17.44), on-track BSC does not
    When I open the kiosk in test mode with empty storage
    And I seed the "objectiveProgress" fixture via the test bridge
    And I reload the kiosk
    Then the child tile "OffTrack" shows the off-track warning glyph
    And the child tile "OnTrack" does not show the off-track warning glyph

  @HE-2772 @priority:high
  Scenario: Focused BSC parent strip also renders the target row
    When I open the kiosk in test mode with empty storage
    And I seed the "objectiveProgress" fixture via the test bridge
    And I reload the kiosk
    And I focus on node "OffTrack"
    Then the focused parent strip shows a target row with text containing "100"
    And the focused parent strip shows the off-track warning glyph

  @HE-2770 @priority:high
  Scenario: Each recordedValue BSC tile shows a trend arrow whose data-direction matches the regression bucket (§17.41)
    # SPEC §17.41 — every recordedValue BSC with at least 2 distinct-
    # timestamp historized entries carries a small trend arrow at the
    # right of its value, sized at ~40 % of the value's cqmin clamp,
    # rendered in `currentColor` (NO inline tint — the colour-as-
    # severity signal stays on the value glyph alone). The arrow's
    # `data-direction` exposes the 5-bucket quantisation the mapper
    # landed on so the e2e test can assert the bucket without
    # parsing the rendered Unicode glyph.
    #
    # Fixture math:
    #   - OnTrack:  history (2026-01-01, 0) → (2026-04-30, 80).
    #               slope ≈ 80/119d; required ≈ 100/365d → progressRate
    #               ≈ 2.45 → bucket "up" (rate ≥ 1.5).
    #   - OffTrack: history (2026-01-01, 0) → (2026-04-30, 5).
    #               slope ≈ 5/119d → progressRate ≈ 0.15 → bucket
    #               "right" (-0.5 < rate < 0.5, the flat band).
    #
    # The OffTrack BSC therefore shows BOTH a deadline-risk warning
    # (the regression extrapolated to 2026-12-31 lands at ~15, well
    # short of 100) AND a flat-trend arrow (the slope is nearly zero
    # — barely making any progress). Two independent signals, each
    # answering a different operator question.
    When I open the kiosk in test mode with empty storage
    And I seed the "objectiveProgress" fixture via the test bridge
    And I reload the kiosk
    Then the child tile "OnTrack" shows a trend arrow with direction "up"
    And the child tile "OffTrack" shows a trend arrow with direction "right"
