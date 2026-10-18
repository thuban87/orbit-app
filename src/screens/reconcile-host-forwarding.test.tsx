import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * The flow host travels through Check linked contacts (38.12 D-110;
 * convergence c1 A-1), plus the flow's one name (D-49) and the Check complete
 * count wording (D-46).
 *
 * A function-call render with a mocked React (the survivor-select-render
 * pattern): `useState` slots are seeded by call order and every setter is a
 * spy; `useEffect` runs its body only when asked. Without the forwarding, a
 * per-person check opened from a Profile and merged from there loses the
 * profile host and cannot end on the survivor's Profile.
 */

const hooks = vi.hoisted(() => ({
  index: 0,
  runEffects: false,
  seed: new Map<number, unknown>(),
  setters: [] as Array<ReturnType<typeof vi.fn>>,
}));
const mocks = vi.hoisted(() => ({
  pickContacts: vi.fn(),
  relinkExternalSource: vi.fn(),
  unlinkExternalSources: vi.fn(),
  confirm: vi.fn(),
  applyReconcileSelections: vi.fn(),
  promoteReconcilePhoto: vi.fn(),
  markCardStatusCore: vi.fn(),
  setCardCompletionDispositionCore: vi.fn(),
  showSnackbar: vi.fn(),
  getReconcileContact: vi.fn(),
  deleteReviewedSnapshotCore: vi.fn(),
  applyLifecycleTransitionEffects: vi.fn(),
  listReconcileSessionCards: vi.fn(),
  listReconcileCardIdentities: vi.fn(),
  getReconcileSessionById: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: <T,>(callback: T) => callback,
  useEffect: (effect: () => unknown) => {
    if (hooks.runEffects) effect();
  },
  useMemo: <T,>(factory: () => T) => factory(),
  useRef: <T,>(value: T) => ({ current: value }),
  useState: (value: unknown) => {
    const slot = hooks.index++;
    const initial =
      typeof value === "function" ? (value as () => unknown)() : value;
    const setter = vi.fn();
    hooks.setters[slot] = setter;
    return [hooks.seed.has(slot) ? hooks.seed.get(slot) : initial, setter];
  },
}));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: () => {} }));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: "Text",
  View: "View",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/theme/danger-scrim", () => ({ persistentDangerScrim: () => ({}) }));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/FieldChoiceGroup", () => ({
  FieldChoiceGroup: "FieldChoiceGroup",
}));
vi.mock("@/components/PhotoChoice", () => ({
  KEEP_ORBIT_PHOTO: "orbit",
  PhotoChoice: "PhotoChoice",
}));
vi.mock("@/components/CandidateCardGrid", () => ({
  CandidateCardGrid: "CandidateCardGrid",
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => "exec",
  localDateTime: () => "2026-10-17 12:00:00",
}));
vi.mock("@/db/app-settings-dao", () => ({ getAppSettings: vi.fn() }));
vi.mock("@/db/contacts-dao", () => ({ setContactPhoto: vi.fn() }));
vi.mock("@/db/reconcile-apply", () => ({
  applyReconcileSelections: mocks.applyReconcileSelections,
}));
vi.mock("@/db/reconcile-memory-read", () => ({
  classifyLinkedContact: vi.fn(),
  effectivePhoneRegionFor: vi.fn(),
  getReconcileContact: mocks.getReconcileContact,
  listLinkedContactsForScan: vi.fn(),
  loadReviewMemory: vi.fn(),
  scanLinkedContacts: vi.fn(),
}));
vi.mock("@/db/reconcile-relink-dao", () => ({
  relinkExternalSource: mocks.relinkExternalSource,
  unlinkExternalSources: mocks.unlinkExternalSources,
}));
vi.mock("@/db/reconcile-session-dao", () => ({
  createReconcileSessionCore: vi.fn(),
  finalizeSessionIfTerminal: vi.fn(),
  insertReconcileCardCore: vi.fn(),
  markCardStatusCore: mocks.markCardStatusCore,
  setCardCompletionDispositionCore: mocks.setCardCompletionDispositionCore,
}));
vi.mock("@/db/reconcile-session-read", () => ({
  getReconcileSessionById: mocks.getReconcileSessionById,
  listReconcileCardIdentities: mocks.listReconcileCardIdentities,
  listReconcileSessionCards: mocks.listReconcileSessionCards,
  reconcileCompletionCounts: vi.fn(),
}));
vi.mock("@/db/reconcile-snapshot-dao", () => ({
  deleteReviewedSnapshotCore: mocks.deleteReviewedSnapshotCore,
  recordReviewedPhoto: vi.fn(),
  rememberMissingSourceKeptCore: vi.fn(),
}));
vi.mock("@/db/transaction", () => ({
  inWriteTransaction: (_exec: unknown, work: () => unknown) => work(),
}));
vi.mock("@/db/uid", () => ({ newUid: () => "uid" }));
vi.mock("@/services/contacts/use-read-contacts-permission", () => ({
  ensureReadContactsPermission: vi.fn(),
  openContactsSettings: vi.fn(),
}));
vi.mock("@/services/device-region", () => ({ getDeviceRegion: () => "US" }));
vi.mock("@/services/contact-lifecycle-effects", () => ({
  applyLifecycleTransitionEffects: mocks.applyLifecycleTransitionEffects,
}));
vi.mock("@/services/import/reconcile-flow-guard", () => ({
  holdReconcileStaging: () => () => undefined,
  markReconcileSessionOpen: vi.fn(),
  withReconcileFlowActive: (run: () => unknown) => run(),
}));
vi.mock("@/services/photos/derivative-cache", () => ({
  discardDerivative: vi.fn(),
}));
vi.mock("@/services/photos/photo-storage", () => ({
  deleteReconcileStaging: vi.fn(),
  resolveReconcileStagingUri: vi.fn(),
}));
vi.mock("@/services/photos/reconcile-photo", () => ({
  promoteReconcilePhoto: mocks.promoteReconcilePhoto,
  reconcilePhotoFs: {},
  stageReconcileSourcePhoto: vi.fn(),
}));
vi.mock("@/stores/confirm-store", () => ({ confirm: mocks.confirm }));
vi.mock("@/stores/snackbar-store", () => ({
  showSnackbar: mocks.showSnackbar,
}));
vi.mock("@/navigation/back-acts-as-done", () => ({
  useBackActsAsDone: () => {},
}));
vi.mock("@/navigation/flow-host", () => ({
  DEFAULT_FLOW_HOST: { kind: "settings" },
  finishFlow: vi.fn(),
}));
vi.mock("../../modules/orbit-contact-picker", () => ({
  pickContacts: mocks.pickContacts,
  readAllContacts: vi.fn(),
}));

const { ReconcileDetailScreen } = await import("./ReconcileDetailScreen");
const { ReconcileGridScreen } = await import("./ReconcileGridScreen");
const { ReconcileCompleteScreen } = await import("./ReconcileCompleteScreen");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}
function textOf(element: TestElement): string {
  return nodes(element)
    .flatMap((node) => {
      const children = node.props.children;
      const parts = Array.isArray(children) ? children : [children];
      return parts.filter(
        (part) => typeof part === "string" || typeof part === "number",
      );
    })
    .join("");
}
function pressableWithText(tree: ReactNode, pattern: RegExp): TestElement {
  const found = nodes(tree).find(
    (node) => node.type === "Pressable" && pattern.test(textOf(node)),
  );
  if (!found) throw new Error(`no Pressable matching ${pattern}`);
  return found;
}
function titleOf(tree: ReactNode): unknown {
  return nodes(tree).find((node) => node.type === "ShellAppBar")?.props.title;
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const PROFILE_HOST = { kind: "profile", profileKey: "Profile-abc" } as const;
const CONTACT = 4;

function navigation() {
  return { navigate: vi.fn(), replace: vi.fn(), goBack: vi.fn() };
}

function renderDetail(
  scan: Record<string, unknown>,
  nav: ReturnType<typeof navigation>,
  extra: { seed?: Array<[number, unknown]>; card?: boolean } = {},
) {
  hooks.index = 0;
  hooks.runEffects = false;
  hooks.setters = [];
  hooks.seed = new Map([[0, scan], ...(extra.seed ?? [])]);
  return ReconcileDetailScreen({
    navigation: nav,
    route: {
      key: "ReconcileDetail-1",
      name: "ReconcileDetail",
      params: {
        contactId: CONTACT,
        host: PROFILE_HOST,
        ...(extra.card ? { sessionId: 3, cardId: 11 } : {}),
      },
    },
  } as never);
}

/** Every string any state setter received (the message setter among them). */
function setterStrings(): string[] {
  return hooks.setters.flatMap((setter) =>
    setter.mock.calls
      .map((call) => call[0])
      .filter((value): value is string => typeof value === "string"),
  );
}

const loadedScan = (missingSource: boolean) => ({
  contactName: "Ada Lovelace",
  orbitPhoto: null,
  diff: { missingSource, fields: [], orbitModifiedAt: null },
  links: [
    { id: 7, contact_id: CONTACT, external_contact_id: "lk", provider: "a" },
  ],
  missingLinkIds: missingSource ? [7] : [],
  effectivePhoneRegion: "US",
  reviewedPhotoLinkIds: [] as number[],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReconcileDetail forwards the flow host (D-110, A-1)", () => {
  it("Merge with another contact passes the profile host to SurvivorSelect", () => {
    const nav = navigation();
    const tree = renderDetail(loadedScan(false), nav);
    (
      pressableWithText(tree, /Merge with another contact/).props
        .onPress as () => void
    )();
    // It opens a chooser, so it carries the ellipsis (fix-pass queue 4).
    expect(pressableWithText(tree, /Merge with another contact…/)).toBeTruthy();
    expect(nav.navigate).toHaveBeenCalledWith("SurvivorSelect", {
      firstContactId: CONTACT,
      host: PROFILE_HOST,
    });
  });

  it("the already-linked-elsewhere merge keeps the host and the second contact", async () => {
    mocks.pickContacts.mockResolvedValue([
      { lookupKey: "other", photoTempUri: null },
    ]);
    mocks.relinkExternalSource.mockResolvedValue({
      kind: "duplicate-active-link",
      otherContactId: 9,
    });
    mocks.confirm.mockResolvedValue(true);
    const nav = navigation();
    const tree = renderDetail(loadedScan(true), nav);
    (
      pressableWithText(tree, /different phone contact/).props
        .onPress as () => void
    )();
    await flush();
    await flush();
    expect(nav.navigate).toHaveBeenCalledWith("SurvivorSelect", {
      firstContactId: CONTACT,
      secondContactId: 9,
      host: PROFILE_HOST,
    });
  });

  it("is named Check linked contacts, like the grid (D-49)", () => {
    expect(titleOf(renderDetail(loadedScan(false), navigation()))).toBe(
      "Check linked contacts",
    );
    expect(titleOf(renderDetail(loadedScan(true), navigation()))).toBe(
      "Check linked contacts",
    );
  });
});

describe("missing-source actions act on the missing link (38.12 review B-CR-01)", () => {
  // Link 7 still reads; link 8 is the one the check found missing.
  const twoLinkScan = {
    ...loadedScan(true),
    links: [
      {
        id: 7,
        contact_id: CONTACT,
        external_contact_id: "lk-7",
        provider: "a",
      },
      {
        id: 8,
        contact_id: CONTACT,
        external_contact_id: "lk-8",
        provider: "a",
      },
    ],
    missingLinkIds: [8],
  };

  it("Unlink retires the missing link, never links[0]", async () => {
    mocks.unlinkExternalSources.mockResolvedValue(undefined);
    const tree = renderDetail(twoLinkScan, navigation());
    (
      pressableWithText(tree, /Unlink from phone contact/i).props
        .onPress as () => void
    )();
    await flush();
    expect(mocks.unlinkExternalSources).toHaveBeenCalledWith("exec", {
      staleLinkIds: [8],
      contactId: CONTACT,
      now: "2026-10-17 12:00:00",
    });
  });

  it("Link to a different phone contact replaces the missing link", async () => {
    mocks.pickContacts.mockResolvedValue([
      { lookupKey: "new", photoTempUri: null },
    ]);
    mocks.relinkExternalSource.mockResolvedValue({
      kind: "duplicate-active-link",
      otherContactId: 9,
    });
    mocks.confirm.mockResolvedValue(false);
    const tree = renderDetail(twoLinkScan, navigation());
    (
      pressableWithText(tree, /different phone contact/).props
        .onPress as () => void
    )();
    await flush();
    await flush();
    expect(mocks.relinkExternalSource).toHaveBeenCalledWith(
      "exec",
      expect.objectContaining({ staleLinkId: 8, contactId: CONTACT }),
    );
  });
});

describe("a committed phone value refreshes reminders and the widget (38.12 review B-IN-07)", () => {
  it("runs the post-commit effects after Use phone's birthday", async () => {
    const birthday = {
      fieldFamily: "birthday",
      outcome: "conflict",
      orbitBaseline: "1990-01-01",
      sourceValue: "1991-02-03",
      reviewedComparable: "1991-02-03",
      reviewedValue: null,
      sourceOptions: [
        {
          optionId: "birthday:1991-02-03",
          value: "1991-02-03",
          sourceLinkIds: [7],
          provenanceLabels: [],
        },
      ],
    };
    mocks.applyReconcileSelections.mockResolvedValue({
      staleFields: [],
      pendingPhoto: null,
    });
    const nav = navigation();
    const tree = renderDetail(
      {
        ...loadedScan(false),
        diff: {
          missingSource: false,
          fields: [birthday],
          orbitModifiedAt: null,
        },
      },
      nav,
      { seed: [[1, { birthday: "source:birthday:1991-02-03" }]] },
    );
    (pressableWithText(tree, /^Apply$/).props.onPress as () => void)();
    for (let i = 0; i < 4; i++) await flush();
    expect(mocks.applyLifecycleTransitionEffects).toHaveBeenCalledWith(
      CONTACT,
      "reconcile",
      { exec: "exec" },
    );
    expect(nav.goBack).toHaveBeenCalled();
  });
});

describe("nothing to decide (38.12 review B-IN-04)", () => {
  it("Done closes the card with no disposition and no snackbar", async () => {
    const nav = navigation();
    const tree = renderDetail(loadedScan(false), nav, { card: true });
    (pressableWithText(tree, /^Done$/).props.onPress as () => void)();
    await flush();
    await flush();
    expect(mocks.markCardStatusCore).toHaveBeenCalledWith(
      "exec",
      11,
      "resolved",
      0,
      "2026-10-17 12:00:00",
    );
    expect(mocks.setCardCompletionDispositionCore).not.toHaveBeenCalled();
    expect(mocks.applyReconcileSelections).not.toHaveBeenCalled();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
    expect(nav.goBack).toHaveBeenCalled();
  });
});

describe("D-147 undo: ask about a declined phone photo again", () => {
  it("shows the action only when a phone photo is held back, and clears that memory", async () => {
    mocks.getReconcileContact.mockResolvedValue({ contact: null, links: [] });
    expect(
      nodes(renderDetail(loadedScan(false), navigation()))
        .map(textOf)
        .join("|"),
    ).not.toContain("Ask about the phone's photo again");
    const tree = renderDetail(
      { ...loadedScan(false), reviewedPhotoLinkIds: [7] },
      navigation(),
    );
    (
      pressableWithText(tree, /Ask about the phone's photo again/).props
        .onPress as () => void
    )();
    await flush();
    expect(mocks.deleteReviewedSnapshotCore).toHaveBeenCalledWith(
      "exec",
      7,
      "photo",
    );
  });
});

describe("a failed phone-photo step after the commit (38.12 review B-WR-03)", () => {
  it("leaves the card partial and never says 'kept safe'", async () => {
    const photoField = {
      fieldFamily: "photo",
      outcome: "conflict",
      orbitBaseline: "avatars/contact-4.jpg",
      sourceValue: "fp",
      reviewedComparable: "fp",
      reviewedValue: null,
      sourceOptions: [
        {
          optionId: "photo:fp",
          value: "fp",
          sourceLinkIds: [7],
          provenanceLabels: [],
          stagedPhotoRelative: "reconcile-staging/x.jpg",
        },
      ],
    };
    mocks.applyReconcileSelections.mockResolvedValue({
      staleFields: [],
      pendingPhoto: {
        fieldFamily: "photo",
        stagedPhotoRelative: "reconcile-staging/x.jpg",
        sourceLinkIds: [7],
        reviewedValue: "fp",
      },
    });
    mocks.promoteReconcilePhoto.mockRejectedValue(new Error("gone"));
    mocks.getReconcileContact.mockResolvedValue({ contact: null, links: [] });
    const nav = navigation();
    const tree = renderDetail(
      {
        ...loadedScan(false),
        diff: {
          missingSource: false,
          fields: [photoField],
          orbitModifiedAt: null,
        },
      },
      nav,
      { seed: [[1, { photo: "source:photo:fp" }]], card: true },
    );
    (pressableWithText(tree, /^Apply$/).props.onPress as () => void)();
    for (let i = 0; i < 6; i++) await flush();
    expect(mocks.markCardStatusCore).toHaveBeenCalledWith(
      "exec",
      11,
      "partial",
      1,
      "2026-10-17 12:00:00",
    );
    expect(mocks.setCardCompletionDispositionCore).not.toHaveBeenCalled();
    expect(nav.goBack).not.toHaveBeenCalled();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
    const messages = setterStrings();
    expect(messages.some((text) => /kept safe/.test(text))).toBe(false);
    expect(messages).toContain(
      "Updated Ada Lovelace, but the phone's photo couldn't be added. Try again.",
    );
  });
});

describe("ReconcileGrid forwards the flow host (D-110, A-1)", () => {
  const card = {
    id: 11,
    contactId: 21,
    cardStatus: "unresolved",
    unresolvedCount: 1,
    stagedPhotoRelPath: null,
    diffJson: "{}",
  };
  const diff = { missingSource: false, fields: [], orbitModifiedAt: null };

  function renderGrid(nav: ReturnType<typeof navigation>, runEffects = false) {
    hooks.index = 0;
    hooks.runEffects = runEffects;
    hooks.seed = new Map<number, unknown>([
      [0, 3],
      [1, [{ card, diff }]],
      [2, new Map()],
      [3, false],
    ]);
    return ReconcileGridScreen({
      navigation: nav,
      route: {
        key: "ReconcileGrid-1",
        name: "ReconcileGrid",
        params: { sessionId: 3, host: PROFILE_HOST },
      },
    } as never);
  }

  it("a tapped card opens ReconcileDetail with the host", () => {
    const nav = navigation();
    const grid = nodes(renderGrid(nav)).find(
      (node) => node.type === "CandidateCardGrid",
    );
    if (!grid) throw new Error("CandidateCardGrid not rendered");
    (grid.props.onInspect as (item: { id: number }) => void)({ id: 11 });
    expect(nav.navigate).toHaveBeenCalledWith("ReconcileDetail", {
      contactId: 21,
      sessionId: 3,
      cardId: 11,
      host: PROFILE_HOST,
    });
  });

  it("a finished session moves to Check complete with the host", async () => {
    mocks.listReconcileSessionCards.mockResolvedValue([]);
    mocks.listReconcileCardIdentities.mockResolvedValue(new Map());
    mocks.getReconcileSessionById.mockResolvedValue({ status: "complete" });
    const nav = navigation();
    renderGrid(nav, true);
    await flush();
    await flush();
    expect(nav.replace).toHaveBeenCalledWith("ReconcileComplete", {
      sessionId: 3,
      host: PROFILE_HOST,
    });
  });
});

describe("ReconcileComplete (D-46, D-110)", () => {
  function renderComplete(nav: ReturnType<typeof navigation>) {
    hooks.index = 0;
    hooks.runEffects = false;
    hooks.seed = new Map<number, unknown>([
      [
        0,
        {
          phase: "loaded",
          data: {
            checked: 3,
            changed: 1,
            updated: 1,
            keptOrbitValues: 0,
            sourceMissing: 0,
            unresolved: 2,
          },
        },
      ],
    ]);
    return ReconcileCompleteScreen({
      navigation: nav,
      route: {
        key: "ReconcileComplete-1",
        name: "ReconcileComplete",
        params: { sessionId: 3, host: PROFILE_HOST },
      },
    } as never);
  }

  it("View unresolved returns to the grid with the host", () => {
    const nav = navigation();
    (
      pressableWithText(renderComplete(nav), /View unresolved/).props
        .onPress as () => void
    )();
    expect(nav.navigate).toHaveBeenCalledWith("ReconcileGrid", {
      sessionId: 3,
      host: PROFILE_HOST,
    });
  });

  it("counts contacts, singular and plural", () => {
    const text = nodes(renderComplete(navigation())).map(textOf).join("|");
    expect(text).toContain("3 contacts");
    expect(text).toContain("1 contact");
    expect(text).not.toContain("interaction");
  });
});
