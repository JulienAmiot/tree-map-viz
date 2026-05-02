import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/modal/BoardsPanelModal.js";
import {
  BOARDS_PANEL_CANCEL_EVENT,
  BOARDS_PANEL_CREATE_EVENT,
  BOARDS_PANEL_SWITCH_EVENT,
  type BoardsPanelCreateDetail,
  type BoardsPanelModal,
  type BoardsPanelSwitchDetail,
  type BoardsPanelTarget,
} from "../../../../../adapters/ui/modal/BoardsPanelModal.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

const baseTarget: BoardsPanelTarget = {
  boards: [
    { id: "uuid-board-A", name: "Showcase" },
    { id: "uuid-board-B", name: "Team OKRs" },
    { id: "uuid-board-C", name: "Personal" },
  ],
  currentBoardId: "uuid-board-A",
};

function fieldOf(el: BoardsPanelModal, testid: string): HTMLElement {
  const f = el.shadowRoot?.querySelector<HTMLElement>(
    `[data-testid="${testid}"]`,
  );
  if (!f) throw new Error(`expected element [${testid}]`);
  return f;
}

function maybe(el: BoardsPanelModal, testid: string): HTMLElement | null {
  return (
    el.shadowRoot?.querySelector<HTMLElement>(`[data-testid="${testid}"]`) ??
    null
  );
}

function rowsOf(el: BoardsPanelModal): HTMLElement[] {
  return Array.from(
    el.shadowRoot?.querySelectorAll<HTMLElement>(
      '[data-testid="board-row"]',
    ) ?? [],
  );
}

async function setText(
  el: BoardsPanelModal,
  testid: string,
  value: string,
): Promise<void> {
  const inp = fieldOf(el, testid) as HTMLInputElement;
  inp.value = value;
  inp.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  await el.updateComplete;
}

describe("<boards-panel-modal> (SPEC \u00a717.34)", () => {
  it("renders nothing when closed", async () => {
    const el = await mountLitElement<BoardsPanelModal>("boards-panel-modal");
    expect(maybe(el, "boards-panel-modal")).toBeNull();
  });

  it("renders one row per board with the correct order and current marker", async () => {
    // §17.34 — the modal is a pure consumer of the snapshot the
    // composition root assembles. The current board renders a
    // `(current)` badge in place of the Switch button so the
    // operator can't no-op-switch to themselves.
    const el = await mountLitElement<BoardsPanelModal>(
      "boards-panel-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
      },
    );
    const rows = rowsOf(el);
    expect(rows.map((r) => r.dataset["boardId"])).toEqual([
      "uuid-board-A",
      "uuid-board-B",
      "uuid-board-C",
    ]);
    expect(rows[0]?.dataset["current"]).toBe("true");
    expect(rows[1]?.dataset["current"]).toBe("false");
    expect(rows[2]?.dataset["current"]).toBe("false");
    // Current row has the badge, not a Switch button.
    expect(
      rows[0]?.querySelector('[data-testid="row-current-badge"]'),
    ).not.toBeNull();
    expect(rows[0]?.querySelector('[data-testid="row-switch"]')).toBeNull();
    // Non-current rows have Switch buttons, not the badge.
    expect(
      rows[1]?.querySelector('[data-testid="row-switch"]'),
    ).not.toBeNull();
    expect(
      rows[1]?.querySelector('[data-testid="row-current-badge"]'),
    ).toBeNull();
  });

  it("Switch button on a non-current row dispatches `boards-panel-switch` with that board id", async () => {
    const el = await mountLitElement<BoardsPanelModal>(
      "boards-panel-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(BOARDS_PANEL_SWITCH_EVENT, handler);
    const switchBtn = el.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-testid="row-switch"][data-board-id="uuid-board-B"]',
    );
    expect(switchBtn).not.toBeNull();
    switchBtn!.click();
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as
      | CustomEvent<BoardsPanelSwitchDetail>
      | undefined;
    expect(evt?.detail.boardId).toBe("uuid-board-B");
    expect(evt?.bubbles).toBe(true);
    expect(evt?.composed).toBe(true);
  });

  it("Create button is disabled until a non-empty trimmed name is typed", async () => {
    const el = await mountLitElement<BoardsPanelModal>(
      "boards-panel-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
      },
    );
    const btn = fieldOf(el, "create-board") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await setText(el, "field-new-name", "   ");
    expect((fieldOf(el, "create-board") as HTMLButtonElement).disabled).toBe(
      true,
    );
    await setText(el, "field-new-name", "  Q3 OKRs  ");
    expect((fieldOf(el, "create-board") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("Create dispatches `boards-panel-create` with the trimmed name", async () => {
    const el = await mountLitElement<BoardsPanelModal>(
      "boards-panel-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(BOARDS_PANEL_CREATE_EVENT, handler);
    await setText(el, "field-new-name", "  Roadmap  ");
    (fieldOf(el, "create-board") as HTMLButtonElement).click();
    await el.updateComplete;
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as
      | CustomEvent<BoardsPanelCreateDetail>
      | undefined;
    expect(evt?.detail.name).toBe("Roadmap");
    expect(evt?.bubbles).toBe(true);
    expect(evt?.composed).toBe(true);
  });

  it("Cancel dispatches `boards-panel-cancel`", async () => {
    const el = await mountLitElement<BoardsPanelModal>(
      "boards-panel-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(BOARDS_PANEL_CANCEL_EVENT, handler);
    (fieldOf(el, "modal-cancel") as HTMLButtonElement).click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("close-X dispatches `boards-panel-cancel` (SPEC \u00a717.29 shared frame)", async () => {
    // §17.29 — every shipping modal carries a top-right close-X via
    // `renderModalCloseX`. The shared testid is `modal-close-x`.
    const el = await mountLitElement<BoardsPanelModal>(
      "boards-panel-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(BOARDS_PANEL_CANCEL_EVENT, handler);
    (fieldOf(el, "modal-close-x") as HTMLButtonElement).click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("backdrop tap dispatches `boards-panel-cancel`", async () => {
    const el = await mountLitElement<BoardsPanelModal>(
      "boards-panel-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(BOARDS_PANEL_CANCEL_EVENT, handler);
    (fieldOf(el, "modal-backdrop") as HTMLElement).click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("renders the inline error when errorMessage is set", async () => {
    const el = await mountLitElement<BoardsPanelModal>(
      "boards-panel-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
        e.errorMessage = "Board name cannot be empty.";
      },
    );
    const err = fieldOf(el, "modal-error");
    expect(err.textContent?.trim()).toBe("Board name cannot be empty.");
  });

  it("re-opening the modal clears any half-typed create name", async () => {
    // §17.34 — `willUpdate` resets the create field on open so a
    // stale half-typed name from a previous session doesn't leak
    // across opens (mirrors the §17.31 `deleteArmed` reset idiom).
    const el = await mountLitElement<BoardsPanelModal>(
      "boards-panel-modal",
      (e) => {
        e.target = baseTarget;
        e.open = true;
      },
    );
    await setText(el, "field-new-name", "Half-typed");
    el.open = false;
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    expect((fieldOf(el, "field-new-name") as HTMLInputElement).value).toBe(
      "",
    );
  });

  it("renders a single-row collection without a Switch button (the current row)", async () => {
    // Edge case: a fresh kiosk's first-boot collection often has
    // exactly one board. The list still renders, but every row is
    // `current` so no Switch button appears anywhere. (Create is
    // still available for the operator to add a second board.)
    const el = await mountLitElement<BoardsPanelModal>(
      "boards-panel-modal",
      (e) => {
        e.target = {
          boards: [{ id: "only-board", name: "Showcase" }],
          currentBoardId: "only-board",
        };
        e.open = true;
      },
    );
    expect(rowsOf(el)).toHaveLength(1);
    expect(maybe(el, "row-switch")).toBeNull();
    expect(maybe(el, "row-current-badge")).not.toBeNull();
    // Create form is still available.
    expect(maybe(el, "field-new-name")).not.toBeNull();
    expect(maybe(el, "create-board")).not.toBeNull();
  });
});
