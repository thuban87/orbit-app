import { describe, expect, it, vi } from "vitest";
import type { ContactMethodRow } from "@/db/contact-methods-dao";
import type { MemoryRow } from "@/db/memories-read";
import type { ProfileKnowledge } from "@/db/profile-knowledge-read";
import type { KnowledgeChildId } from "@/profile/knowledge-presentation";
import {
  binConfirmation,
  canStartLifecycleTransition,
  closeTopmostProfileOverlay,
  commitProfileOverviewToggle,
  consumeProfileReachOutIntent,
  createProfileSnapshotLoader,
  editDestination,
  heroNameBottomInContent,
  knowledgeNavigateParams,
  PROFILE_APP_BAR,
  PROFILE_APP_BAR_SCRIM_OPACITY,
  PROFILE_APP_BAR_SCRIM_THRESHOLD,
  PROFILE_APP_BAR_SCROLL_SCRIM,
  PROFILE_HERO_AVATAR_SIZE,
  PROFILE_HERO_GAP,
  PROFILE_LEGACY_NAME_TOP,
  pinSnackbar,
  pinUndoneSnackbar,
  profileAppBarGlyphClearance,
  profileAppBarHitBoxClearance,
  profileAppBarScrolled,
  profileAppBarShowsName,
  profileContentTopPadding,
  profileErrorPlacement,
  profileKnowledgeCollectionDestination,
  profileKnowledgeDestination,
  profileKnowledgeEmptyDestination,
  profileLifecycleView,
  profileMethodGroups,
  profileNameTop,
  profileOverflowEntries,
  profileScrollA11yOffset,
  profileScrollContentTopPadding,
  profileScrollTargetY,
  runMoveToBin,
  shouldRunProfileShellRefresh,
  unbindConfirmation,
} from "@/screens/contact-profile-logic";

const phone: ContactMethodRow = {
  id: 1,
  uid: "method-phone",
  contact_id: 4,
  method_type: "phone",
  raw_value: "(312) 555-1234",
  display_value: "+1 312 555 1234",
  canonical_value: "+13125551234",
  canonical_region: "US",
  extension: "42",
  label: "Mobile",
  is_actionable: 1,
  is_primary: 1,
  display_order: 0,
  created_at: "2026-08-28 12:00:00",
  modified_at: "2026-08-28 12:00:00",
};

describe("profileMethodGroups", () => {
  it("keeps phone first and renders stored labels, formatted values, primary state, extension, and full a11y", () => {
    expect(
      profileMethodGroups({
        phone: [phone],
        email: [
          {
            ...phone,
            id: 2,
            method_type: "email",
            label: "Work",
            extension: null,
            display_value: "ada@example.com",
          },
        ],
      }),
    ).toEqual([
      {
        type: "phone",
        title: "Phone numbers",
        rows: [
          {
            id: 1,
            label: "Mobile",
            displayValue: "+1 312 555 1234",
            extension: "42",
            isPrimary: true,
            helper: null,
            accessibilityLabel:
              "Mobile, +1 312 555 1234, extension 42, Primary",
          },
        ],
      },
      {
        type: "email",
        title: "Email addresses",
        rows: [
          {
            id: 2,
            label: "Work",
            displayValue: "ada@example.com",
            extension: null,
            isPrimary: true,
            helper: null,
            accessibilityLabel: "Work, ada@example.com, Primary",
          },
        ],
      },
    ]);
  });

  it("falls back only for a nullable label, retains invalid rows, and never exposes canonical/raw values", () => {
    const groups = profileMethodGroups({
      phone: [
        {
          ...phone,
          label: null,
          raw_value: "bad number",
          display_value: "bad number",
          canonical_value: null,
          canonical_region: null,
          is_actionable: 0,
        },
      ],
      email: [],
    });

    expect(groups).toEqual([
      {
        type: "phone",
        title: "Phone numbers",
        rows: [
          {
            id: 1,
            label: "Phone number",
            displayValue: "bad number",
            extension: "42",
            isPrimary: true,
            helper: "This number can’t be used for calls or messages yet.",
            accessibilityLabel:
              "Phone number, bad number, extension 42, Primary. This number can’t be used for calls or messages yet.",
          },
        ],
      },
    ]);
    expect(groups[0]?.rows[0]).not.toHaveProperty("canonicalValue");
    expect(groups[0]?.rows[0]).not.toHaveProperty("rawValue");
  });

  it("omits empty type groups", () => {
    expect(profileMethodGroups({ phone: [], email: [] })).toEqual([]);
  });
});

describe("profileLifecycleView", () => {
  it("retains Bound cadence treatment", () => {
    expect(
      profileLifecycleView({ trackingEnabled: 1, intervalDays: 30 }),
    ).toEqual({
      kind: "bound",
      showCadenceTreatment: true,
      showFrequencyPicker: false,
      bindEnabled: false,
    });
  });

  it("lets an Unbound contact with dormant cadence bind immediately", () => {
    expect(
      profileLifecycleView({ trackingEnabled: 0, intervalDays: 30 }),
    ).toEqual({
      kind: "unbound-dormant",
      showCadenceTreatment: false,
      showFrequencyPicker: false,
      bindEnabled: true,
    });
  });

  it("requires a cadence before binding a never-assigned Unbound contact", () => {
    expect(
      profileLifecycleView({ trackingEnabled: 0, intervalDays: null }),
    ).toEqual({
      kind: "unbound-never-assigned",
      showCadenceTreatment: false,
      showFrequencyPicker: true,
      bindEnabled: false,
    });
  });
});

describe("profile lifecycle actions", () => {
  it("uses the exact native Unbind confirmation copy", () => {
    expect(unbindConfirmation("Ada")).toEqual({
      title: "Unbind Ada?",
      message:
        "This removes them from your active orbit, reminders, favorites, and widgets. Their history, details, and saved reminder schedule stay.",
    });
  });

  it("allows only one lifecycle transition at a time and requires a bindable cadence", () => {
    expect(
      canStartLifecycleTransition({ pending: false, bindEnabled: true }),
    ).toBe(true);
    expect(
      canStartLifecycleTransition({ pending: true, bindEnabled: true }),
    ).toBe(false);
    expect(
      canStartLifecycleTransition({ pending: false, bindEnabled: false }),
    ).toBe(false);
  });
});

describe("Relationship Overview collapse tracer", () => {
  it("publishes only the committed readback value", async () => {
    const published: boolean[] = [];
    const write = vi.fn(async () => {});
    const read = vi.fn(async () => ({ "relationship-overview": false }));

    const result = await commitProfileOverviewToggle({
      currentExpanded: true,
      write,
      read,
      publish: (expanded) => published.push(expanded),
    });

    expect(write).toHaveBeenCalledWith(false);
    expect(read).toHaveBeenCalledOnce();
    expect(published).toEqual([false]);
    expect(result).toEqual({ ok: true, expanded: false });
  });

  it("retains the prior visible state when persistence fails", async () => {
    const published: boolean[] = [];
    const result = await commitProfileOverviewToggle({
      currentExpanded: true,
      write: async () => {
        throw new Error("disk full");
      },
      read: async () => ({ "relationship-overview": false }),
      publish: (expanded) => published.push(expanded),
    });

    expect(published).toEqual([]);
    expect(result).toEqual({ ok: false, expanded: true });
  });

  it("keeps failure isolated to the requested section and leaves its visible state unchanged", async () => {
    const published: boolean[] = [];
    const result = await commitProfileOverviewToggle({
      currentExpanded: false,
      write: async () => {
        throw new Error("storage unavailable");
      },
      read: async () => ({ "relationship-overview": true }),
      publish: (expanded) => published.push(expanded),
    });

    expect(result).toEqual({ ok: false, expanded: false });
    expect(published).toEqual([]);
  });
});

describe("integrated Profile controller contracts", () => {
  describe("Things to Remember routes (D-72, D-75, D-68, D-107; c8, c9, c10)", () => {
    const ids: readonly KnowledgeChildId[] = [
      "pinned-featured",
      "last-talked-about",
      "key-people",
      "current-location",
      "memories",
      "thought-of-them",
      "gift-ideas",
      "custom-fields",
      "off-limits",
      "imported-contact-notes",
    ];

    it("gives each section with entries its D-72 heading destination, and Pinned none", () => {
      expect(
        Object.fromEntries(
          ids.map((id) => [id, profileKnowledgeDestination(id)]),
        ),
      ).toEqual({
        "pinned-featured": { screen: "none" },
        "last-talked-about": {
          screen: "MemoryHistory",
          fieldKey: "last_talked_about",
          openAdd: true,
        },
        "key-people": { screen: "KeyPeopleEditor" },
        "current-location": {
          screen: "MemoryHistory",
          fieldKey: "current_location",
        },
        memories: { screen: "Memory", type: "general", origin: "profile" },
        "thought-of-them": {
          screen: "Memory",
          type: "thought_of_them",
          origin: "profile",
        },
        "gift-ideas": {
          screen: "Memory",
          type: "gift_idea",
          origin: "profile",
        },
        "custom-fields": { screen: "Edit" },
        "off-limits": { screen: "OffLimitsEditor" },
        "imported-contact-notes": { screen: "SectionEditor", type: "imported" },
      });
    });

    it("sends an empty section's 'Add …' to its add form; Imported and Pinned have none (D-68; c2 G-U3, c10)", () => {
      expect(
        Object.fromEntries(
          ids.map((id) => [id, profileKnowledgeEmptyDestination(id)]),
        ),
      ).toEqual({
        "pinned-featured": { screen: "none" },
        "last-talked-about": {
          screen: "MemoryHistory",
          fieldKey: "last_talked_about",
          openAdd: true,
        },
        "key-people": { screen: "KeyPeopleEditor" },
        "current-location": {
          screen: "MemoryHistory",
          fieldKey: "current_location",
          openAdd: true,
        },
        memories: { screen: "Memory", type: "general", origin: "profile" },
        "thought-of-them": {
          screen: "Memory",
          type: "thought_of_them",
          origin: "profile",
        },
        "gift-ideas": {
          screen: "Memory",
          type: "gift_idea",
          origin: "profile",
        },
        "custom-fields": { screen: "Edit" },
        "off-limits": { screen: "OffLimitsEditor" },
        "imported-contact-notes": { screen: "none" },
      });
      // The pencil opens the history page without its add form.
      expect(
        profileKnowledgeDestination("current-location"),
      ).not.toHaveProperty("openAdd");
    });

    it("routes View all, See all and Show hidden to the section's own editor, never Add (c8, c9)", () => {
      expect(
        Object.fromEntries(
          ids.map((id) => [id, profileKnowledgeCollectionDestination(id)]),
        ),
      ).toEqual({
        "pinned-featured": { screen: "none" },
        "last-talked-about": {
          screen: "MemoryHistory",
          fieldKey: "last_talked_about",
        },
        "key-people": { screen: "KeyPeopleEditor" },
        "current-location": {
          screen: "MemoryHistory",
          fieldKey: "current_location",
        },
        memories: { screen: "SectionEditor", type: "general" },
        "thought-of-them": { screen: "SectionEditor", type: "thought_of_them" },
        "gift-ideas": { screen: "SectionEditor", type: "gift_idea" },
        "custom-fields": { screen: "none" },
        "off-limits": { screen: "OffLimitsEditor" },
        "imported-contact-notes": { screen: "SectionEditor", type: "imported" },
      });
      expect(profileKnowledgeCollectionDestination("memories").screen).not.toBe(
        "Memory",
      );
      for (const id of ["last-talked-about", "current-location"] as const) {
        expect(profileKnowledgeCollectionDestination(id)).not.toHaveProperty(
          "openAdd",
        );
      }
    });

    it("never routes anywhere to the retired Things to Remember screen (D-63, D-75)", () => {
      for (const id of ids) {
        for (const destination of [
          profileKnowledgeDestination(id),
          profileKnowledgeEmptyDestination(id),
          profileKnowledgeCollectionDestination(id),
        ]) {
          expect(destination.screen).not.toBe("ThingsToRemember");
        }
      }
    });

    it("forwards every destination field to the route params (c10)", () => {
      expect(
        knowledgeNavigateParams(
          profileKnowledgeDestination("last-talked-about"),
          4,
        ),
      ).toEqual([
        "MemoryHistory",
        { contactId: 4, fieldKey: "last_talked_about", openAdd: true },
      ]);
      expect(
        knowledgeNavigateParams(
          profileKnowledgeEmptyDestination("current-location"),
          4,
        ),
      ).toEqual([
        "MemoryHistory",
        { contactId: 4, fieldKey: "current_location", openAdd: true },
      ]);
      expect(
        knowledgeNavigateParams(profileKnowledgeDestination("gift-ideas"), 4),
      ).toEqual([
        "Memory",
        { contactId: 4, type: "gift_idea", origin: "profile" },
      ]);
      expect(
        knowledgeNavigateParams(
          profileKnowledgeCollectionDestination("current-location"),
          4,
        ),
      ).toEqual([
        "MemoryHistory",
        { contactId: 4, fieldKey: "current_location" },
      ]);
      expect(
        knowledgeNavigateParams(
          profileKnowledgeDestination("pinned-featured"),
          4,
        ),
      ).toBeNull();
    });

    describe("an item's Edit opens that entry's form (D-107; c6 C-03)", () => {
      const row = (id: number, type: string) =>
        ({ id, type, pinned: 0 }) as unknown as MemoryRow;
      const list = (rows: MemoryRow[]) => ({
        items: rows,
        total: rows.length,
        remainingCount: 0,
        hiddenCount: 0,
        showHiddenAvailable: false,
      });
      const knowledge = {
        currentState: {
          current_location: {
            id: 30,
            previous: [{ id: 31, previous: [] }],
          },
        },
        featured: {
          ...list([]),
          items: [
            {
              owner: "memory",
              id: 5,
              row: { ...row(5, "gift_idea"), pinned: 1 },
            },
          ],
          total: 1,
        },
        relationships: list([]),
        memories: list([row(1, "general")]),
        thoughtOfThem: list([row(2, "thought_of_them")]),
        giftIdeas: list([row(3, "gift_idea")]),
        importedNotes: list([row(4, "imported")]),
        customFields: [],
        offLimits: [],
      } as unknown as ProfileKnowledge;

      it("opens a memory in its own section's editor, chosen by its type", () => {
        for (const [id, type] of [
          [1, "general"],
          [2, "thought_of_them"],
          [3, "gift_idea"],
          [4, "imported"],
          // A pinned Gift Idea still opens Gift Ideas.
          [5, "gift_idea"],
        ] as const) {
          expect(editDestination({ owner: "memory", id }, knowledge)).toEqual({
            screen: "SectionEditor",
            type,
            editId: id,
          });
        }
      });

      it("opens a current-state entry, a key person and an Off Limits item with editId", () => {
        expect(
          editDestination({ owner: "current-state", id: 31 }, knowledge),
        ).toEqual({
          screen: "MemoryHistory",
          fieldKey: "current_location",
          editId: 31,
        });
        expect(
          editDestination({ owner: "relationship", id: 8 }, knowledge),
        ).toEqual({
          screen: "KeyPeopleEditor",
          editId: 8,
        });
        expect(
          editDestination({ owner: "offLimits", id: 9 }, knowledge),
        ).toEqual({
          screen: "OffLimitsEditor",
          editId: 9,
        });
        expect(
          knowledgeNavigateParams(
            editDestination({ owner: "offLimits", id: 9 }, knowledge),
            4,
          ),
        ).toEqual(["OffLimitsEditor", { contactId: 4, editId: 9 }]);
      });

      it("opens Edit Contact for a custom field", () => {
        expect(
          editDestination({ owner: "custom-field", id: 22 }, knowledge),
        ).toEqual({
          screen: "Edit",
        });
      });
    });

    it("names the person in the Pin / Unpin snackbars and their Undo (c8 CU-05)", () => {
      expect(pinSnackbar(true, "Ada")).toBe("Pinned for Ada");
      expect(pinSnackbar(false, "Ada")).toBe("Unpinned for Ada");
      expect(pinUndoneSnackbar(true, "Ada")).toBe("Pin undone for Ada");
      expect(pinUndoneSnackbar(false, "Ada")).toBe("Unpin undone for Ada");
    });
  });

  it("uses one standard compact app bar with reachable icon targets", () => {
    expect(PROFILE_APP_BAR).toEqual({ height: 56, touchTarget: 44 });
  });

  describe("38.6 D-04/D-17 hero geometry", () => {
    it("doubles the photo and pins today's name line", () => {
      expect(PROFILE_HERO_AVATAR_SIZE).toBe(224);
      expect(PROFILE_HERO_GAP).toBe(16);
      // bar 56 + pad 16 + star row 44 + gap 16 + photo 112 + gap 16.
      expect(PROFILE_LEGACY_NAME_TOP).toBe(56 + 16 + 44 + 16 + 112 + 16);
      expect(PROFILE_LEGACY_NAME_TOP).toBe(260);
    });

    it("starts the 224 photo 20 px below the bar top so the name stays at 260", () => {
      expect(profileContentTopPadding(224)).toBe(20);
      expect(profileContentTopPadding()).toBe(20);
      expect(profileNameTop(profileContentTopPadding(224), 224)).toBe(260);
    });

    it("offsets the ScrollView by exactly one pixel without moving the D-04 lines (WR-03)", () => {
      for (const ratio of [1, 2, 2.625, 3, 3.5]) {
        // One physical pixel: enough for Android's bounds sort to read the bar first.
        expect(profileScrollA11yOffset(ratio) * ratio).toBeCloseTo(1, 10);
        // Offset + content padding is still the D-04 top padding, so the name
        // stays on the 260 line.
        expect(
          profileScrollA11yOffset(ratio) +
            profileScrollContentTopPadding(ratio),
        ).toBeCloseTo(profileContentTopPadding(), 10);
        expect(
          profileNameTop(
            profileScrollA11yOffset(ratio) +
              profileScrollContentTopPadding(ratio),
            224,
          ),
        ).toBeCloseTo(PROFILE_LEGACY_NAME_TOP, 10);
      }
      expect(profileScrollA11yOffset(0)).toBe(1);
      expect(profileScrollA11yOffset(Number.NaN)).toBe(1);
    });

    it("never lowers the name and never pads negatively", () => {
      for (let size = 112; size <= 244; size += 4) {
        expect(
          profileNameTop(profileContentTopPadding(size), size),
        ).toBeLessThanOrEqual(PROFILE_LEGACY_NAME_TOP);
      }
      for (const size of [112, 224, 244, 260, 400]) {
        expect(profileContentTopPadding(size)).toBeGreaterThanOrEqual(0);
      }
    });

    it.each([360, 393, 412])(
      "keeps the back, star and ⋮ glyphs clear of the photo at %i dp",
      (width) => {
        expect(
          profileAppBarGlyphClearance(width, 224, 20),
        ).toBeGreaterThanOrEqual(0);
      },
    );

    it.each([393, 412])(
      "keeps every 44-tall app-bar hit box clear of the photo at %i dp",
      (width) => {
        expect(
          profileAppBarHitBoxClearance(width, 224, 20),
        ).toBeGreaterThanOrEqual(0);
      },
    );

    it("pins the known star hit-box overlap at 360 dp for the owner's look (38.6-07 Task 4)", () => {
      // Star hit box corner (248, 50) is ≈106.5 from the photo centre (180, 132);
      // radius 112 → ≈-5.5. Any size tuning that changes this is visible here.
      expect(
        Number(profileAppBarHitBoxClearance(360, 224, 20).toFixed(1)),
      ).toBe(-5.5);
    });

    it("reports a negative clearance when a control overlaps the photo", () => {
      expect(profileAppBarGlyphClearance(360, 224, -40)).toBeLessThan(0);
    });
  });

  describe("38.6 D-17 overlay app bar", () => {
    it("has a switchable token scrim past a small scroll threshold", () => {
      expect(PROFILE_APP_BAR_SCROLL_SCRIM).toBe(true);
      expect(PROFILE_APP_BAR_SCRIM_OPACITY).toBe(0.92);
      expect(PROFILE_APP_BAR_SCRIM_THRESHOLD).toBe(8);
      expect(profileAppBarScrolled(0)).toBe(false);
      expect(profileAppBarScrolled(PROFILE_APP_BAR_SCRIM_THRESHOLD)).toBe(
        false,
      );
      expect(profileAppBarScrolled(PROFILE_APP_BAR_SCRIM_THRESHOLD + 1)).toBe(
        true,
      );
    });

    it("shows the name in the bar only once the hero name's bottom passes under it (38.11 D-57)", () => {
      const nameBottom = 300;
      const edge = nameBottom - PROFILE_APP_BAR.height;
      expect(profileAppBarShowsName(0, nameBottom)).toBe(false);
      expect(profileAppBarShowsName(edge - 1, nameBottom)).toBe(false);
      expect(profileAppBarShowsName(edge, nameBottom)).toBe(true);
      expect(profileAppBarShowsName(edge + 200, nameBottom)).toBe(true);
      // Unknown geometry (not laid out yet): never show the name.
      expect(profileAppBarShowsName(5000, null)).toBe(false);
      expect(profileAppBarShowsName(5000, Number.NaN)).toBe(false);
    });

    it("measures the name's bottom in scroll-content coordinates, not its local layout (review T-11)", () => {
      // Hero at y 20 in the scroll content (its top padding); the identity
      // View sits below the 224 photo plus the 16 gap; the name is its first
      // line, then a nonzero offset proves every term is summed.
      const parts = { heroY: 20, identityY: 240, nameY: 4, nameHeight: 34 };
      const bottom = heroNameBottomInContent(parts);
      expect(bottom).toBe(20 + 240 + 4 + 34);
      // The name's own onLayout bottom (relative to the identity View) is not it.
      expect(bottom).not.toBe(parts.nameY + parts.nameHeight);
      // It feeds the bar: hidden until the bar's bottom edge reaches it.
      expect(
        profileAppBarShowsName(bottom - PROFILE_APP_BAR.height - 1, bottom),
      ).toBe(false);
      expect(
        profileAppBarShowsName(bottom - PROFILE_APP_BAR.height, bottom),
      ).toBe(true);
    });

    it("keeps the signed-off scrim unchanged (38.6 D-36, 38.11 D-57)", () => {
      expect(PROFILE_APP_BAR_SCRIM_OPACITY).toBe(0.92);
      expect(PROFILE_APP_BAR_SCRIM_THRESHOLD).toBe(8);
    });

    it("keeps a refresh error off the overlay bar and the D-04 lines (WR-04)", () => {
      expect(profileErrorPlacement(null, true)).toBeNull();
      expect(profileErrorPlacement(null, false)).toBeNull();
      // Loaded Profile + failed refresh: below the hero, never at the top.
      expect(profileErrorPlacement("Couldn't load", true)).toBe("below-hero");
      // No content (and so no bar): the error is the page.
      expect(profileErrorPlacement("Couldn't load", false)).toBe("top");
    });

    it("lands in-Profile scroll targets below the overlay bar", () => {
      expect(profileScrollTargetY(500)).toBe(500 - PROFILE_APP_BAR.height);
      expect(profileScrollTargetY(20)).toBe(0);
    });
  });

  it("keeps the final ⋯ order: Snooze…, Unbind, Move to Bin, then Layout and Background (38.11 D-63, D-64, D-65)", () => {
    expect(profileOverflowEntries({ bound: true })).toEqual([
      "snooze",
      "unbind",
      "archive",
      "separator",
      "layout",
      "background",
    ]);
    expect(profileOverflowEntries({ bound: false })).toEqual([
      // 38.11 D-64: "snooze" in both states; never an instant "unsnooze".
      "snooze",
      "archive",
      "separator",
      "layout",
      "background",
    ]);
  });

  describe("Move to Bin (38.11 D-69, D-71; review U-04)", () => {
    it("asks first with the D-71 copy", () => {
      expect(binConfirmation("Alex")).toEqual({
        title: "Move Alex to the Bin?",
        message:
          "They'll be hidden everywhere. You can restore them, or delete them permanently, from Settings → Bin.",
        cancelLabel: "Cancel",
        confirmLabel: "Move to Bin",
      });
    });

    function harness(options: {
      confirmed: boolean;
      write: () => Promise<void>;
    }) {
      const calls: string[] = [];
      const deps = {
        name: "Alex",
        confirm: vi.fn(async () => {
          calls.push("confirm");
          return options.confirmed;
        }),
        archive: vi.fn(async () => {
          calls.push("archive");
          await options.write();
        }),
        closeOverlay: vi.fn(() => calls.push("closeOverlay")),
        goBack: vi.fn(() => calls.push("goBack")),
        showSnackbar: vi.fn(() => calls.push("snackbar")),
        logError: vi.fn(),
      };
      return { calls, deps };
    }

    it("asks with the themed destructive confirm", async () => {
      const { deps } = harness({ confirmed: false, write: async () => {} });
      await runMoveToBin(deps);
      expect(deps.confirm).toHaveBeenCalledTimes(1);
      expect(deps.confirm).toHaveBeenCalledWith({
        ...binConfirmation("Alex"),
        destructive: true,
      });
    });

    it("does nothing else when the confirm is cancelled", async () => {
      const { calls, deps } = harness({
        confirmed: false,
        write: async () => {},
      });
      await expect(runMoveToBin(deps)).resolves.toBe("cancelled");
      expect(calls).toEqual(["confirm"]);
      expect(deps.archive).not.toHaveBeenCalled();
      expect(deps.showSnackbar).not.toHaveBeenCalled();
    });

    it("shows only the error snackbar and stays when the write rejects", async () => {
      const cause = new Error("disk full");
      const { calls, deps } = harness({
        confirmed: true,
        write: async () => {
          throw cause;
        },
      });
      await expect(runMoveToBin(deps)).resolves.toBe("failed");
      expect(calls).toEqual(["confirm", "archive", "snackbar"]);
      expect(deps.goBack).not.toHaveBeenCalled();
      expect(deps.closeOverlay).not.toHaveBeenCalled();
      expect(deps.showSnackbar).toHaveBeenCalledTimes(1);
      expect(deps.showSnackbar).toHaveBeenCalledWith({
        kind: "error",
        label: "Couldn't move to the Bin. Try again.",
      });
      expect(deps.logError).toHaveBeenCalledWith(cause);
    });

    it("leaves the Profile, then names the person, only after the write resolves", async () => {
      const { calls, deps } = harness({
        confirmed: true,
        write: async () => {},
      });
      await expect(runMoveToBin(deps)).resolves.toBe("moved");
      expect(calls).toEqual([
        "confirm",
        "archive",
        "closeOverlay",
        "goBack",
        "snackbar",
      ]);
      expect(deps.showSnackbar).toHaveBeenCalledTimes(1);
      // D-71: no Undo; the warning look is "this plan only" (owner checks it
      // at 38.11-14).
      expect(deps.showSnackbar).toHaveBeenCalledWith({
        kind: "warning",
        label: "Moved Alex to the Bin",
      });
    });
  });

  it("closes only the topmost overlay before ordinary native-stack Back", () => {
    expect(closeTopmostProfileOverlay("background")).toBe(null);
    expect(closeTopmostProfileOverlay("templates")).toBe(null);
    expect(closeTopmostProfileOverlay("layout")).toBe(null);
    expect(closeTopmostProfileOverlay("overflow")).toBe(null);
    // 38.6 D-16: the photo lightbox is one more topmost overlay.
    expect(closeTopmostProfileOverlay("photo")).toBe(null);
    expect(closeTopmostProfileOverlay(null)).toBe(null);
  });

  it("consumes widget Reach out once and opens only when a route exists", () => {
    expect(
      consumeProfileReachOutIntent({
        openReachOut: true,
        hasReachRoute: true,
      }),
    ).toEqual({ clear: true, open: true });
    expect(
      consumeProfileReachOutIntent({
        openReachOut: true,
        hasReachRoute: false,
      }),
    ).toEqual({ clear: true, open: false });
    expect(
      consumeProfileReachOutIntent({
        openReachOut: undefined,
        hasReachRoute: true,
      }),
    ).toEqual({ clear: false, open: false });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createProfileSnapshotLoader (38.3 RG-024)", () => {
  function harness() {
    const reads: ReturnType<typeof deferred<string>>[] = [];
    const publish = vi.fn();
    const fail = vi.fn();
    const settle = vi.fn();
    const loader = createProfileSnapshotLoader<string>({
      read: () => {
        const next = deferred<string>();
        reads.push(next);
        return next.promise;
      },
      publish,
      fail,
      settle,
    });
    return { loader, reads, publish, fail, settle };
  }

  it("publishes only the newest read; an older resolution publishes nothing", async () => {
    const { loader, reads, publish, settle } = harness();
    const a = loader.load();
    const b = loader.load();
    reads[1].resolve("B");
    await b;
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenLastCalledWith("B", 1);
    reads[0].resolve("A");
    await a;
    expect(publish).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledTimes(1);
  });

  it("never fails from a stale rejection; a current rejection fails once without a revision", async () => {
    const { loader, reads, publish, fail, settle } = harness();
    const a = loader.load();
    const b = loader.load();
    reads[0].reject(new Error("stale"));
    await a;
    expect(fail).not.toHaveBeenCalled();
    reads[1].reject(new Error("current"));
    await b;
    expect(fail).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
    const c = loader.load();
    reads[2].resolve("C");
    await c;
    expect(publish).toHaveBeenLastCalledWith("C", 1);
  });

  it("bumps the revision by exactly one per current successful publication", async () => {
    const { loader, reads, publish } = harness();
    for (let i = 0; i < 3; i++) {
      const pending = loader.load();
      reads[i].resolve(`v${i}`);
      await pending;
    }
    expect(publish.mock.calls.map((call) => call[1])).toEqual([1, 2, 3]);
  });

  it("invalidate() retires every in-flight load", async () => {
    const { loader, reads, publish, fail, settle } = harness();
    const a = loader.load();
    const b = loader.load();
    loader.invalidate();
    reads[0].resolve("A");
    reads[1].reject(new Error("late"));
    await Promise.all([a, b]);
    expect(publish).not.toHaveBeenCalled();
    expect(fail).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
  });
});

describe("shouldRunProfileShellRefresh (38.3 VERIFICATION W2, 38.4 D-10)", () => {
  it("skips a shell refresh while the app is backgrounded", () => {
    expect(shouldRunProfileShellRefresh("background")).toBe(false);
  });

  it("runs a shell refresh while active or during a transient inactive overlay", () => {
    expect(shouldRunProfileShellRefresh("active")).toBe(true);
    expect(shouldRunProfileShellRefresh("inactive")).toBe(true);
  });

  it("runs when the app state is unknown (never silently drops a foreground read)", () => {
    expect(shouldRunProfileShellRefresh(null)).toBe(true);
    expect(shouldRunProfileShellRefresh(undefined)).toBe(true);
  });

  it("a backgrounded shell tick reads nothing; the resume (foreground) load still reads", async () => {
    let appState = "background";
    const read = vi.fn(() => Promise.resolve("snapshot"));
    const loader = createProfileSnapshotLoader({
      read,
      publish: vi.fn(),
      fail: vi.fn(),
      settle: vi.fn(),
    });
    const load = () => loader.load();
    // The screen's shell subscription: gated on the synchronous app state.
    const onShellRefresh = () => {
      if (!shouldRunProfileShellRefresh(appState)) return;
      void load();
    };
    onShellRefresh();
    expect(read).not.toHaveBeenCalled();
    // The foreground tick is ungated — it only fires on the post-sweep resume.
    appState = "active";
    await load();
    expect(read).toHaveBeenCalledTimes(1);
    onShellRefresh();
    expect(read).toHaveBeenCalledTimes(2);
  });
});
