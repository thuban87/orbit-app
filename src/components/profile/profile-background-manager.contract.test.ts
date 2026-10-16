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
const MODEL = "../../profile/background-manager-model.ts";

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

  it("is choose-only: no global/category controls, no Delete, and a link to the Settings page (38.11 D-58.2-3)", () => {
    const source = read(MANAGER);
    const flat = collapse(source);

    // Global and Category management live on the Settings page (D-58.1).
    expect(source).not.toContain("Clear global background");
    expect(source).not.toContain("Clear category background");
    expect(source).not.toContain("Set as global default");
    expect(source).not.toContain("<CategoryChoiceSheet");
    expect(source).not.toMatch(/assignGlobal|assignCategory/);
    // Cards have no Delete (D-58.3).
    expect(source).not.toContain('label="Delete"');
    expect(source).not.toMatch(
      /deleteTemplate|deleteProfileBackgroundTemplate/,
    );
    // "Manage global backgrounds" closes the sheet, then opens the page.
    expect(source).toContain('label="Manage global backgrounds"');
    expect(flat).toContain(
      'onRequestClose(); navigation.navigate("ProfileBackgrounds");',
    );
    // Choose photo stays (D-79).
    expect(source).toContain('label="Choose photo"');
  });

  it("Assign applies to this person only; the current card is marked selected (38.11 D-58.3-4)", () => {
    const flat = collapse(read(MANAGER));

    // The only writer in the sheet is the contact-scoped one.
    expect(flat).toContain(
      "assignContactBackgroundTemplate(getExecutor(), { contactId, templateUid, now: localDateTime(), })",
    );
    expect(flat).toContain(
      "await assignContactBackground(writer, { templateUid, contactName })",
    );
    expect(flat).toContain('label="Assign"');
    expect(flat).toContain(
      "isContactBackground( template.uid, contactBackgroundTemplateUid, )",
    );
    expect(flat).toContain("selected={current}");
  });

  it("cards are two columns: the picture spanning both rows, name above Assign, centred (D-58.4)", () => {
    const flat = collapse(read(MANAGER));

    // The row is on the surface's content wrapper, where the children live.
    expect(flat).toContain("contentStyle={styles.cardContent}");
    expect(flat).toContain(
      'cardContent: { alignItems: "stretch", flexDirection: "row"',
    );
    expect(flat).toMatch(/thumbnail: \{ alignSelf: "stretch"/);
    expect(flat).toContain(
      'cardRight: { alignItems: "center", flex: 1, justifyContent: "center" }',
    );
    // Image, then the right column holding the name and Assign.
    const image = flat.indexOf("style={styles.thumbnail}");
    const right = flat.indexOf("style={styles.cardRight}", image);
    const name = flat.indexOf("{template.name}", right);
    const assign = flat.indexOf('label="Assign"', name);
    expect(image).toBeGreaterThan(-1);
    expect(right).toBeGreaterThan(image);
    expect(name).toBeGreaterThan(right);
    expect(assign).toBeGreaterThan(name);
  });

  it("after a new background is named, offers only Use for {name} and Not now (D-79, D-58.3)", () => {
    const flat = collapse(read(MANAGER));
    const at = flat.indexOf('page === "created"');
    expect(at).toBeGreaterThan(-1);
    const created = flat.slice(at, flat.indexOf("</ScrollView>", at));
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a source sample.
    expect(created).toContain("label={`Use for ${contactName}`}");
    expect(created).toContain('label="Not now"');
    expect(created.match(/<Button\b/g)).toHaveLength(2);
  });

  it("Reset to default clears only this person's background, with Undo through the same writer (38.11 D-65; 38.9 D-30, D-39; review U-06)", () => {
    const manager = collapse(read(MANAGER));
    const model = collapse(read(MODEL));

    // Shown only when the person has their own background.
    expect(manager).toContain(
      "const hasContactBackground = contactBackgroundTemplateUid !== null",
    );
    expect(manager).toMatch(
      /\{hasContactBackground \? \( <Button role="secondary" label="Reset to default"/,
    );
    // The previous uid is captured from the prop before the write.
    expect(manager).toContain(
      "await resetContactBackground(writer, { previousUid: contactBackgroundTemplateUid, })",
    );
    // The writer is contact-scoped: assignContactBackgroundTemplate for this
    // contact only, so Undo re-assigns the captured uid through it.
    expect(manager).toContain(
      "write: (templateUid) => assignContactBackgroundTemplate(getExecutor(), { contactId, templateUid,",
    );
    expect(manager).not.toContain("resetProfilePresentation");
    // The snackbar carries Undo, which writes previousUid back, then "Background restored".
    expect(model).toContain("await writer.write(null)");
    expect(model).toContain(
      'label: BACKGROUND_RESET_LABEL, action: { label: "Undo"',
    );
    expect(model).toContain("await writer.write(previousUid)");
    expect(model).toContain(
      'export const BACKGROUND_RESET_LABEL = "Background reset to default"',
    );
    expect(model).toContain(
      'export const BACKGROUND_RESTORED_LABEL = "Background restored"',
    );
    // The old inherit actions are gone; Reset replaces them.
    expect(manager).not.toMatch(/Use inherited background|Inherit Category/);
  });

  it("the sheet header Back is the icon-only chevron before the heading, guarded (D-43)", () => {
    const manager = collapse(read(MANAGER));
    expect(manager).not.toMatch(/\blabel="Back"/);
    const back = manager.indexOf(
      '<Button role="iconOnly" icon="back" accessibilityLabel="Back" onPress={closeOrGuard} />',
    );
    const title = manager.indexOf("Profile backgrounds </AppText>");
    expect(back).toBeGreaterThan(-1);
    expect(title).toBeGreaterThan(back);
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
