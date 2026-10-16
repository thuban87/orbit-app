import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(resolve(__dirname, relative), "utf8");
}

const MANAGER = "ProfileBackgroundManager.tsx";
// 38.11 D-58.1, D-79: the crop workspace moved into the shared create flow.
const CREATE_FLOW = "ProfileBackgroundCreateFlow.tsx";
const SETTINGS_PAGE = "../../screens/ProfileBackgroundsScreen.tsx";

describe("ProfileBackgroundManager crop workspace contract", () => {
  it("uses the measured crop workspace for the contained source and full gesture surface", () => {
    const source = read(CREATE_FLOW);

    expect(source).toContain('cropTouchSurface: { flex: 1, width: "100%" }');
    expect(source).toContain("cropSpace.width / source.width");
    expect(source).toContain("(cropSpace.width - source.width * scale) / 2");
    expect(source).not.toContain("viewportWidth / source.width");
    expect(source).toContain("<GestureDetector gesture={flow.gesture}>");
  });

  it("keeps the crop gestures and the pending-crop cleanup in the shared flow only", () => {
    const manager = read(MANAGER);
    const flow = read(CREATE_FLOW);

    expect(manager).not.toMatch(/Gesture\.(Pan|Pinch)/);
    expect(flow).toContain("Gesture.Pan()");
    expect(flow).toContain("Gesture.Pinch()");
    // Discard deletes the pending file after the shared themed prompt (ADR-112).
    expect(flow).toContain("confirmDiscard()");
    expect(flow).toContain(
      "if (latest.pendingPath) deleteBackgroundDerivative(latest.pendingPath)",
    );
    expect(manager).toContain("<ProfileBackgroundCreateFlow");
    expect(manager).toContain("flow.requestCancel(onRequestClose)");
  });

  it("keeps global/category clear and contact inheritance reachable without a selected template", () => {
    const source = read(MANAGER);

    expect(source).toContain('label="Clear global background"');
    expect(source).toContain("Clear ${category.name} background");
    expect(source).toContain(
      "Inherit Category, global, or theme background for ${contactName}",
    );
    expect(source).toContain('scope === "clear-global" ? null : selectedUid');
    expect(source).toContain('scope === "clear-category" ? null : selectedUid');
    expect(source).toContain('scope === "inherit" ? null : selectedUid');
  });

  it("returns a clean reopened manager to the list before exposing assignment controls", () => {
    const source = read(MANAGER);

    expect(source).toContain("const opening = !wasVisibleRef.current");
    expect(source).toContain(
      "shouldResetBackgroundManagerViewOnOpen(managerState)",
    );
    expect(source).toContain("resetFlow()");
    expect(source).toContain('setPage("list")');
    expect(source).toContain("setSelectedUid(null)");
  });
});

/** Collapsed source, so multi-line JSX matches on one line. */
function collapse(source: string): string {
  return source.replace(/\s+/g, " ");
}

describe("Settings Profile Backgrounds create flow (38.11 D-79; review V-05, V-06)", () => {
  it("renders the create flow inside an expanded Sheet, never inline in the page scroll", () => {
    const page = collapse(read(SETTINGS_PAGE));
    const sheetOpen = page.search(/<Sheet [^>]*variant="expanded"/);
    expect(sheetOpen).toBeGreaterThan(-1);
    const sheetClose = page.indexOf("</Sheet>", sheetOpen);
    expect(sheetClose).toBeGreaterThan(sheetOpen);
    const flowAt = page.indexOf("<ProfileBackgroundCreateFlow", sheetOpen);
    expect(flowAt).toBeGreaterThan(sheetOpen);
    expect(flowAt).toBeLessThan(sheetClose);
    // The flow appears exactly once in the page: inside that Sheet.
    expect(page.match(/<ProfileBackgroundCreateFlow\b/g)).toHaveLength(1);
    expect(page).toContain('label="Choose photo"');
  });

  it("the crop header Back is the icon-only chevron, not a text Back (D-43)", () => {
    const flow = collapse(read(CREATE_FLOW));
    expect(flow).not.toMatch(/\blabel="Back"/);
    expect(flow).toContain(
      '<Button role="iconOnly" icon="back" accessibilityLabel="Back"',
    );
  });
});
