import { describe, expect, it, vi } from "vitest";
import type { ContactMethodRow } from "@/db/contact-methods-dao";
import {
  canStartLifecycleTransition,
  closeTopmostProfileOverlay,
  commitProfileOverviewToggle,
  consumeProfileReachOutIntent,
  createProfileSnapshotLoader,
  PROFILE_APP_BAR,
  PROFILE_APP_BAR_SCRIM_OPACITY,
  PROFILE_APP_BAR_SCRIM_THRESHOLD,
  PROFILE_APP_BAR_SCROLL_SCRIM,
  PROFILE_HERO_AVATAR_SIZE,
  PROFILE_HERO_GAP,
  PROFILE_LEGACY_NAME_TOP,
  profileAppBarGlyphClearance,
  profileAppBarHitBoxClearance,
  profileAppBarScrolled,
  profileContentTopPadding,
  profileKnowledgeDestination,
  profileLifecycleView,
  profileMethodGroups,
  profileNameTop,
  profileOverflowEntries,
  profileScrollA11yOffset,
  profileScrollContentTopPadding,
  profileScrollTargetY,
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
        "This removes them from your active orbit, reminders, favourites, and widgets. Their history, details, and saved cadence stay.",
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
  it("routes the Things to Remember collection action through its memories owner", () => {
    expect(profileKnowledgeDestination("memories")).toEqual({
      screen: "ThingsToRemember",
    });
  });

  it("routes Custom Fields to the contact's value editor", () => {
    expect(profileKnowledgeDestination("custom-fields")).toEqual({
      screen: "Edit",
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

    it("lands in-Profile scroll targets below the overlay bar", () => {
      expect(profileScrollTargetY(500)).toBe(500 - PROFILE_APP_BAR.height);
      expect(profileScrollTargetY(20)).toBe(0);
    });
  });

  it("keeps the required overflow ordering and only exposes conditional presentation actions", () => {
    expect(
      profileOverflowEntries({
        snoozed: false,
        bound: true,
        hasFreeformLayout: true,
        hasContactPresentationOverride: true,
      }),
    ).toEqual([
      "edit",
      "snooze",
      "unbind",
      "archive",
      "separator",
      "layout",
      "background",
      "save-layout-template",
      "reset",
    ]);
    expect(
      profileOverflowEntries({
        snoozed: true,
        bound: false,
        hasFreeformLayout: false,
        hasContactPresentationOverride: false,
      }),
    ).toEqual([
      "edit",
      "unsnooze",
      "archive",
      "separator",
      "layout",
      "background",
    ]);
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
