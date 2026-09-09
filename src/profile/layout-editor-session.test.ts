import { describe, expect, it } from "vitest";
import { profileLayoutEditorReducer } from "./layout-editor-reducer";
import {
  createLayoutTemplateIntent,
  requestLayoutEditorDismissal,
  saveLayoutEditorDraft,
} from "./layout-editor-session";
import { FACTORY_PROFILE_LAYOUT } from "./presentation-schema";

describe("Profile layout editor session", () => {
  it("closes only a clean draft and keeps editing while a save is pending", () => {
    const dirty = profileLayoutEditorReducer(FACTORY_PROFILE_LAYOUT, {
      type: "set-visible",
      id: "contact-methods",
      visible: false,
    });

    expect(
      requestLayoutEditorDismissal({
        initial: FACTORY_PROFILE_LAYOUT,
        draft: FACTORY_PROFILE_LAYOUT,
        saving: false,
      }),
    ).toBe("close");
    expect(
      requestLayoutEditorDismissal({
        initial: FACTORY_PROFILE_LAYOUT,
        draft: dirty,
        saving: false,
      }),
    ).toBe("confirm-discard");
    expect(
      requestLayoutEditorDismissal({
        initial: FACTORY_PROFILE_LAYOUT,
        draft: dirty,
        saving: true,
      }),
    ).toBe("keep-editing");
  });

  it("retains the complete draft after an atomic save failure", async () => {
    const draft = profileLayoutEditorReducer(FACTORY_PROFILE_LAYOUT, {
      type: "set-visible",
      id: "contact-methods",
      visible: false,
    });
    const result = await saveLayoutEditorDraft({
      draft,
      save: async () => {
        throw new Error("database unavailable");
      },
    });

    expect(result).toEqual({ ok: false, message: "database unavailable" });
    expect(
      draft.topLevel.find((item) => item.id === "contact-methods")?.visible,
    ).toBe(false);
  });

  it("emits a canonical template intent without writing it", () => {
    const intent = createLayoutTemplateIntent(FACTORY_PROFILE_LAYOUT);
    expect(intent).toEqual(FACTORY_PROFILE_LAYOUT);
  });
});
