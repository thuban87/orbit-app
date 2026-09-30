import type { ContactMethodRow } from "@/db/contact-methods-dao";
import type { ContactMethodGroups } from "@/db/contact-methods-read";
import type { CurrentStateFieldKey } from "@/db/memory-registry";
import type { KnowledgeChildId } from "@/profile/knowledge-presentation";
import type { ProfileCollapseMap } from "@/profile/persisted-contract";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import { isAppBackgrounded } from "@/utils/screen-visibility";

export type ProfileMethodType = "phone" | "email";

/** Source-owned destinations for Profile knowledge collection affordances. */
export type ProfileKnowledgeDestination =
  | { screen: "MemoryHistory"; fieldKey: CurrentStateFieldKey }
  | { screen: "OffLimitsEditor" | "Edit" | "ThingsToRemember" };

/** Keeps the host's semantic child IDs from leaking into navigation. */
export function profileKnowledgeDestination(
  id: KnowledgeChildId,
): ProfileKnowledgeDestination {
  switch (id) {
    case "last-talked-about":
      return { screen: "MemoryHistory", fieldKey: "last_talked_about" };
    case "current-location":
      return { screen: "MemoryHistory", fieldKey: "current_location" };
    case "off-limits":
      return { screen: "OffLimitsEditor" };
    case "key-people":
    case "custom-fields":
      return { screen: "Edit" };
    case "pinned-featured":
    case "memories":
    case "imported-contact-notes":
      return { screen: "ThingsToRemember" };
  }
}

export interface ProfileMethodRow {
  id: number;
  label: string;
  displayValue: string;
  extension: string | null;
  isPrimary: boolean;
  helper: string | null;
  accessibilityLabel: string;
}

export interface ProfileMethodGroup {
  type: ProfileMethodType;
  title: string;
  rows: ProfileMethodRow[];
}

export type ProfileLifecycleKind =
  | "bound"
  | "unbound-dormant"
  | "unbound-never-assigned";

export interface ProfileLifecycleView {
  kind: ProfileLifecycleKind;
  showCadenceTreatment: boolean;
  showFrequencyPicker: boolean;
  bindEnabled: boolean;
}

export type ProfileOverlay =
  | "overflow"
  | "snooze"
  | "layout"
  | "templates"
  | "background"
  // 38.6 D-16: the Profile photo lightbox joins the single-overlay model, so
  // Back closes it first and never leaks to the screen underneath.
  | "photo"
  | null;

export type ProfileOverflowEntry =
  | "edit"
  | "snooze"
  | "unsnooze"
  | "unbind"
  | "archive"
  | "separator"
  | "layout"
  | "background"
  | "save-layout-template"
  | "reset";

/** One compact Profile app-bar row and the shared minimum icon target. */
export const PROFILE_APP_BAR = Object.freeze({ height: 56, touchTarget: 44 });

// ── 38.6 D-04/D-17 hero geometry — device-tuned with the owner in 38.6-07 ──
// Every size is a named constant so tuning is a single-number edit.

/** The Profile photo side (D-04: about 2× the old 112). */
export const PROFILE_HERO_AVATAR_SIZE = 224;

/** The hero's vertical gap between photo, identity and actions (SPACING.base). */
export const PROFILE_HERO_GAP = 16;

/**
 * Where the contact name's top edge sat before 38.6, measured from the app
 * bar's top: bar 56 + content padding 16 + star row 44 + gap 16 + photo 112 +
 * gap 16 = 260. D-04: content below the photo must never sit lower than this.
 */
export const PROFILE_LEGACY_NAME_TOP = 260;

/** D-17: show a token scrim behind the overlay app bar once content scrolls under it. */
export const PROFILE_APP_BAR_SCROLL_SCRIM = true;

/** Opacity of the app-bar scrim over `colors.background`. */
export const PROFILE_APP_BAR_SCRIM_OPACITY = 0.92;

/** Scroll offset (dp) past which the app-bar scrim shows. */
export const PROFILE_APP_BAR_SCRIM_THRESHOLD = 8;

/**
 * Scroll-content top padding (from the overlay app bar's top) that keeps the
 * name at PROFILE_LEGACY_NAME_TOP: the photo grows upward into the bar band.
 */
export function profileContentTopPadding(
  avatarSize: number = PROFILE_HERO_AVATAR_SIZE,
): number {
  return Math.max(0, PROFILE_LEGACY_NAME_TOP - avatarSize - PROFILE_HERO_GAP);
}

/**
 * WR-03: how far (dp) the Profile ScrollView starts below the overlay app bar's
 * top edge — exactly ONE physical pixel. Android orders a container's
 * accessibility children by screen bounds (top edge, then left, then the TALLER
 * view first), not by child index. With a shared top edge the full-height
 * ScrollView sorted ahead of the 56 dp bar, so TalkBack reached Back, the star
 * and ⋮ only after the whole Profile. One pixel lower puts the bar strictly
 * first by top edge. The scroll content's top padding shrinks by the same
 * amount, and a whole pixel keeps every rounded position identical, so the
 * D-04 photo and name lines do not move.
 */
export function profileScrollA11yOffset(pixelRatio: number): number {
  return Number.isFinite(pixelRatio) && pixelRatio > 0 ? 1 / pixelRatio : 1;
}

/**
 * The ScrollView content's own top padding: `profileContentTopPadding` less
 * the ScrollView's `profileScrollA11yOffset`, so offset + padding still puts
 * the photo top — and the name — exactly where D-04 pins them.
 */
export function profileScrollContentTopPadding(
  pixelRatio: number,
  avatarSize: number = PROFILE_HERO_AVATAR_SIZE,
): number {
  return Math.max(
    0,
    profileContentTopPadding(avatarSize) - profileScrollA11yOffset(pixelRatio),
  );
}

/** The name's top edge (from the app bar's top) for a padding and photo size. */
export function profileNameTop(
  contentTopPadding: number,
  avatarSize: number,
): number {
  return contentTopPadding + avatarSize + PROFILE_HERO_GAP;
}

interface BarBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Minimum distance (negative when overlapping) from the photo circle to boxes. */
function circleClearance(
  windowWidth: number,
  avatarSize: number,
  contentTopPadding: number,
  boxes: readonly BarBox[],
): number {
  const radius = avatarSize / 2;
  const cx = windowWidth / 2;
  const cy = contentTopPadding + radius;
  return Math.min(
    ...boxes.map((box) => {
      const dx = Math.max(box.left - cx, 0, cx - box.right);
      const dy = Math.max(box.top - cy, 0, cy - box.bottom);
      return Math.hypot(dx, dy) - radius;
    }),
  );
}

/**
 * Clearance of the back, star and ⋮ GLYPHS (20×20, vertically centred in the
 * 56 bar) from the photo circle. Bar padding 16; ⋮ Button 52 wide; the star
 * Pressable 44 wide immediately left of it.
 */
export function profileAppBarGlyphClearance(
  windowWidth: number,
  avatarSize: number,
  contentTopPadding: number,
): number {
  const top = (PROFILE_APP_BAR.height - 20) / 2;
  const bottom = top + 20;
  return circleClearance(windowWidth, avatarSize, contentTopPadding, [
    { left: 32, right: 52, top, bottom },
    { left: windowWidth - 100, right: windowWidth - 80, top, bottom },
    { left: windowWidth - 52, right: windowWidth - 32, top, bottom },
  ]);
}

/**
 * Clearance of the controls' full 44-tall HIT BOXES from the photo circle — a
 * tap on a hit box overlapping the photo toggles Favourite instead of opening
 * the lightbox. At 360 dp the star's box overlaps by ≈5.5 px; clearing it would
 * change an owner-set size (D-04 photo, name line, or D-17 star), so it is
 * pinned by test and put to the owner in 38.6-07 Task 4.
 */
export function profileAppBarHitBoxClearance(
  windowWidth: number,
  avatarSize: number,
  contentTopPadding: number,
): number {
  const top = (PROFILE_APP_BAR.height - PROFILE_APP_BAR.touchTarget) / 2;
  const bottom = top + PROFILE_APP_BAR.touchTarget;
  return circleClearance(windowWidth, avatarSize, contentTopPadding, [
    { left: 16, right: 68, top, bottom },
    { left: windowWidth - 112, right: windowWidth - 68, top, bottom },
    { left: windowWidth - 68, right: windowWidth - 16, top, bottom },
  ]);
}

/** Whether content has scrolled far enough under the bar to show its scrim. */
export function profileAppBarScrolled(scrollY: number): boolean {
  return scrollY > PROFILE_APP_BAR_SCRIM_THRESHOLD;
}

/**
 * An in-Profile scroll target (e.g. History reveal) lands below the overlay
 * app bar instead of underneath it.
 */
export function profileScrollTargetY(y: number): number {
  return Math.max(0, y - PROFILE_APP_BAR.height);
}

/** The screen presents exactly one modal surface, so Back never leaks to its underlay. */
export function closeTopmostProfileOverlay(_overlay: ProfileOverlay): null {
  return null;
}

/** Keep the product-mandated overflow order independent from view rendering. */
export function profileOverflowEntries(input: {
  snoozed: boolean;
  bound: boolean;
  hasFreeformLayout: boolean;
  hasContactPresentationOverride: boolean;
}): ProfileOverflowEntry[] {
  return [
    "edit",
    input.snoozed ? "unsnooze" : "snooze",
    ...(input.bound ? (["unbind"] as const) : []),
    "archive",
    "separator",
    "layout",
    "background",
    ...(input.hasFreeformLayout ? (["save-layout-template"] as const) : []),
    ...(input.hasContactPresentationOverride ? (["reset"] as const) : []),
  ];
}

export type ProfileOrigin =
  | "dashboard"
  | "orrery"
  | "settings"
  | "widget"
  | "notification";

/**
 * All origins retain the stack's own Back semantics. Widget and notification
 * reset construction happens at the linking/notification boundary, not here.
 */
export function profileOriginIntent(
  origin: ProfileOrigin,
  contactId: number,
  openReachOut?: boolean,
): {
  origin: ProfileOrigin;
  route: { contactId: number; openReachOut?: boolean };
  back: "native-go-back";
} {
  return {
    origin,
    route: openReachOut ? { contactId, openReachOut: true } : { contactId },
    back: "native-go-back",
  };
}

/**
 * Consume the widget-only Reach out intent exactly once. A methodless contact
 * still clears the flag so returning to Profile cannot replay stale intent.
 */
export function consumeProfileReachOutIntent(input: {
  openReachOut?: boolean;
  hasReachRoute: boolean;
}): { clear: boolean; open: boolean } {
  const clear = input.openReachOut === true;
  return { clear, open: clear && input.hasReachRoute };
}

/**
 * Lifecycle-only presentation state. Cadence stays durable data; this model
 * decides only which participation controls may be rendered around it.
 */
export function profileLifecycleView(input: {
  trackingEnabled: number;
  intervalDays: number | null;
}): ProfileLifecycleView {
  if (input.trackingEnabled === 1) {
    return {
      kind: "bound",
      showCadenceTreatment: true,
      showFrequencyPicker: false,
      bindEnabled: false,
    };
  }
  if (input.intervalDays !== null) {
    return {
      kind: "unbound-dormant",
      showCadenceTreatment: false,
      showFrequencyPicker: false,
      bindEnabled: true,
    };
  }
  return {
    kind: "unbound-never-assigned",
    showCadenceTreatment: false,
    showFrequencyPicker: true,
    bindEnabled: false,
  };
}

export function unbindConfirmation(name: string): {
  title: string;
  message: string;
} {
  return {
    title: `Unbind ${name}?`,
    message:
      "This removes them from your active orbit, reminders, favourites, and widgets. Their history, details, and saved cadence stay.",
  };
}

export function canStartLifecycleTransition(input: {
  pending: boolean;
  bindEnabled: boolean;
}): boolean {
  return !input.pending && input.bindEnabled;
}

/**
 * Persist-first collapse publication: the screen changes only after a durable
 * readback confirms the value, and retains the prior state on any failure.
 */
export async function commitProfileOverviewToggle(input: {
  currentExpanded: boolean;
  write: (expanded: boolean) => Promise<void>;
  read: () => Promise<ProfileCollapseMap>;
  publish: (expanded: boolean) => void;
}): Promise<{ ok: boolean; expanded: boolean }> {
  try {
    await input.write(!input.currentExpanded);
    const persisted = await input.read();
    const expanded =
      persisted["relationship-overview"] ?? input.currentExpanded;
    input.publish(expanded);
    return { ok: true, expanded };
  } catch {
    return { ok: false, expanded: input.currentExpanded };
  }
}

/**
 * Whether a SHELL tick may re-read the Profile (38.3 VERIFICATION W2, 38.4
 * D-10). A warm notification Mark/Snooze bumps the shell tick while the app is
 * backgrounded; that must not cost a Profile read. `appState` is the
 * synchronous `AppState.currentState`. The focus read and the post-sweep
 * foreground (resume) read are not gated here — the foreground tick only fires
 * after resume (D-14). Profile's hidden-but-foregrounded behavior is unchanged
 * (38.4 Plan 15 owns that evidence-gated decision).
 */
export function shouldRunProfileShellRefresh(
  appState: string | null | undefined,
): boolean {
  return !isAppBackgrounded(appState);
}

export interface ProfileSnapshotLoader {
  /** Start a read; only the newest (non-invalidated) one may publish. */
  load(): Promise<void>;
  /** Retire every in-flight load (unmount). */
  invalidate(): void;
}

/**
 * Latest-request gated Profile snapshot load (38.3 RG-024;
 * architecture/AUD-ARCH-004, react-native/AUD-RN-008).
 *
 * The Profile screen is the single invalidation owner for its two projections:
 * each CURRENT successful publication carries a monotonically increasing
 * revision, and the History section re-reads on that revision. An older read
 * can never overwrite a newer snapshot or error, and `publish`/`fail`/`settle`
 * run only for the current token. A failed read never bumps the revision.
 */
export function createProfileSnapshotLoader<T>(input: {
  read(): Promise<T>;
  publish(value: T, revision: number): void;
  fail(error: unknown): void;
  settle(): void;
}): ProfileSnapshotLoader {
  const authority = createLatestRequestAuthority();
  let revision = 0;
  return {
    async load() {
      const token = authority.begin();
      try {
        const value = await input.read();
        if (!authority.isCurrent(token)) return;
        revision += 1;
        input.publish(value, revision);
      } catch (error) {
        if (authority.isCurrent(token)) input.fail(error);
      } finally {
        if (authority.isCurrent(token)) input.settle();
      }
    },
    invalidate: () => authority.invalidate(),
  };
}

const typePresentation: Record<ProfileMethodType, string> = {
  phone: "Phone number",
  email: "Email address",
};

const typeTitle: Record<ProfileMethodType, string> = {
  phone: "Phone numbers",
  email: "Email addresses",
};

const invalidMethodHelper: Record<ProfileMethodType, string> = {
  phone: "This number can’t be used for calls or messages yet.",
  email: "This email address can’t be used yet.",
};

function profileMethodRow(row: ContactMethodRow): ProfileMethodRow {
  const type = row.method_type;
  const label = row.label ?? typePresentation[type];
  const extension = type === "phone" ? row.extension : null;
  const helper = row.is_actionable === 1 ? null : invalidMethodHelper[type];
  const details = [label, row.display_value];
  if (extension) details.push(`extension ${extension}`);
  if (row.is_primary === 1) details.push("Primary");
  const accessibilityLabel = helper
    ? `${details.join(", ")}. ${helper}`
    : details.join(", ");

  return {
    id: row.id,
    label,
    displayValue: row.display_value,
    extension,
    isPrimary: row.is_primary === 1,
    helper,
    accessibilityLabel,
  };
}

/**
 * Shape the stored method read for Profile presentation only. This deliberately
 * uses the DAO-provided formatted display and actionability state: it does not
 * parse raw values or reinterpret phone regions in the UI.
 */
export function profileMethodGroups(
  groups: ContactMethodGroups,
): ProfileMethodGroup[] {
  return (["phone", "email"] as const).flatMap((type) => {
    const rows = groups[type];
    return rows.length === 0
      ? []
      : [{ type, title: typeTitle[type], rows: rows.map(profileMethodRow) }];
  });
}
