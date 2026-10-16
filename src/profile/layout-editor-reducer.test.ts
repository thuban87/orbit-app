import { describe, expect, it } from "vitest";
import {
  changedDefaultExpandedIds,
  createAllSectionsPreview,
  createProfileLayoutEditorDraft,
  isMeaningfulLayoutChange,
  type ProfileLayoutEditorAction,
  profileLayoutEditorReducer,
} from "./layout-editor-reducer";
import { FACTORY_PROFILE_LAYOUT } from "./presentation-schema";

function reduce(actions: readonly ProfileLayoutEditorAction[]) {
  return actions.reduce(profileLayoutEditorReducer, FACTORY_PROFILE_LAYOUT);
}

describe("Profile layout editor reducer", () => {
  it("keeps drag and named move actions byte-equal with stable tie order", () => {
    const drag = reduce([
      {
        type: "reorder",
        parent: "relationship-overview",
        id: "snooze",
        toIndex: 0,
      },
    ]);
    const named = reduce([
      { type: "move", id: "snooze", direction: "up" },
      { type: "move", id: "snooze", direction: "up" },
      { type: "move", id: "snooze", direction: "up" },
      { type: "move", id: "snooze", direction: "up" },
      { type: "move", id: "snooze", direction: "up" },
    ]);

    expect(JSON.stringify(named)).toBe(JSON.stringify(drag));
    expect(drag.overview.map((placement) => placement.id)).toEqual([
      "snooze",
      "orbit-status",
      "gravity",
      "intensity",
      "last-interaction",
      "contact-frequency",
    ]);
  });

  it("rejects boundary and parent-crossing moves instead of repairing them", () => {
    const first = profileLayoutEditorReducer(FACTORY_PROFILE_LAYOUT, {
      type: "move",
      id: "orbit-status",
      direction: "up",
    });
    const crossParent = profileLayoutEditorReducer(FACTORY_PROFILE_LAYOUT, {
      type: "reorder",
      parent: "profile",
      id: "memories",
      toIndex: 0,
    });
    const outOfRange = profileLayoutEditorReducer(FACTORY_PROFILE_LAYOUT, {
      type: "reorder",
      parent: "things-to-remember",
      id: "memories",
      toIndex: 99,
    });

    expect(first).toStrictEqual(FACTORY_PROFILE_LAYOUT);
    expect(crossParent).toStrictEqual(FACTORY_PROFILE_LAYOUT);
    expect(outOfRange).toStrictEqual(FACTORY_PROFILE_LAYOUT);
  });

  it("keeps a parser-valid complete draft and restores any persisted omission as a preview placeholder", () => {
    const incomplete = {
      ...FACTORY_PROFILE_LAYOUT,
      topLevel: [FACTORY_PROFILE_LAYOUT.topLevel[0]],
      overview: [FACTORY_PROFILE_LAYOUT.overview[0]],
      thingsToRemember: [FACTORY_PROFILE_LAYOUT.thingsToRemember[0]],
    };
    const draft = createProfileLayoutEditorDraft(incomplete);

    expect(draft.topLevel).toHaveLength(4);
    expect(draft.overview).toHaveLength(6);
    expect(draft.thingsToRemember).toHaveLength(10);
    // A layout saved before Thought of Them and Gift Ideas gets them at their
    // D-44 places, as the Profile shows them, not at the end.
    const pre3810 = createProfileLayoutEditorDraft({
      ...FACTORY_PROFILE_LAYOUT,
      thingsToRemember: FACTORY_PROFILE_LAYOUT.thingsToRemember.filter(
        (p) => p.id !== "thought-of-them" && p.id !== "gift-ideas",
      ),
    });
    expect(pre3810.thingsToRemember).toEqual(
      FACTORY_PROFILE_LAYOUT.thingsToRemember,
    );
    expect(
      createAllSectionsPreview(
        profileLayoutEditorReducer(draft, {
          type: "set-visible",
          id: "memories",
          visible: false,
        }),
      ).thingsToRemember.find((item) => item.id === "memories")?.visible,
    ).toBe(true);
  });

  it("permits only legal expansion and Overview-size controls", () => {
    const collapsed = profileLayoutEditorReducer(FACTORY_PROFILE_LAYOUT, {
      type: "set-expanded",
      id: "memories",
      expanded: false,
    });
    const expandedTile = profileLayoutEditorReducer(FACTORY_PROFILE_LAYOUT, {
      type: "set-expanded",
      id: "gravity",
      expanded: true,
    });
    const compactStatus = profileLayoutEditorReducer(FACTORY_PROFILE_LAYOUT, {
      type: "set-size",
      id: "orbit-status",
      size: "1x1",
    });
    const wideGravity = profileLayoutEditorReducer(FACTORY_PROFILE_LAYOUT, {
      type: "set-size",
      id: "gravity",
      size: "2x1",
    });

    expect(
      collapsed.thingsToRemember.find((item) => item.id === "memories")
        ?.expanded,
    ).toBe(false);
    expect(expandedTile).toBe(FACTORY_PROFILE_LAYOUT);
    expect(
      compactStatus.overview.find((item) => item.id === "orbit-status")?.size,
    ).toBe("1x1");
    expect(wideGravity).toBe(FACTORY_PROFILE_LAYOUT);
  });

  it("compares canonical documents, not transient action history", () => {
    const before = createProfileLayoutEditorDraft(FACTORY_PROFILE_LAYOUT);
    const afterNoOp = profileLayoutEditorReducer(before, {
      type: "move",
      id: "orbit-status",
      direction: "up",
    });
    const afterChange = profileLayoutEditorReducer(before, {
      type: "set-visible",
      id: "contact-methods",
      visible: false,
    });

    expect(isMeaningfulLayoutChange(before, afterNoOp)).toBe(false);
    expect(isMeaningfulLayoutChange(before, afterChange)).toBe(true);
  });
});

/**
 * 38.11 D-83 (amends D-60): an own-layout save clears the person's open/closed
 * choice only for sections whose "Open by default" changed in that save.
 */
describe("changedDefaultExpandedIds (D-83)", () => {
  it("lists nothing when sections only moved or changed visibility", () => {
    const draft = reduce([
      { type: "move", id: "memories", direction: "up" },
      { type: "reorder", parent: "profile", id: "contact-methods", toIndex: 0 },
      { type: "set-visible", id: "key-people", visible: false },
      { type: "set-size", id: "orbit-status", size: "1x1" },
    ]);
    expect(changedDefaultExpandedIds(FACTORY_PROFILE_LAYOUT, draft)).toEqual(
      [],
    );
  });

  it("lists the one section whose default flipped", () => {
    const draft = reduce([
      { type: "move", id: "memories", direction: "up" },
      { type: "set-expanded", id: "memories", expanded: false },
    ]);
    expect(changedDefaultExpandedIds(FACTORY_PROFILE_LAYOUT, draft)).toEqual([
      "memories",
    ]);
  });

  it("lists flipped sections across different buckets", () => {
    const draft = reduce([
      { type: "set-expanded", id: "interaction-history", expanded: true },
      { type: "set-expanded", id: "gift-ideas", expanded: false },
    ]);
    expect(
      [...changedDefaultExpandedIds(FACTORY_PROFILE_LAYOUT, draft)].sort(),
    ).toEqual(["gift-ideas", "interaction-history"]);
  });

  it("lists nothing when a default is flipped and flipped back", () => {
    const draft = reduce([
      { type: "set-expanded", id: "memories", expanded: false },
      { type: "set-expanded", id: "memories", expanded: true },
    ]);
    expect(changedDefaultExpandedIds(FACTORY_PROFILE_LAYOUT, draft)).toEqual(
      [],
    );
  });
});
