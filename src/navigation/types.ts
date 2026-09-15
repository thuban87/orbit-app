import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CurrentStateFieldKey } from "@/db/memory-registry";
import type { MergeResolutions } from "@/db/merge-dao";
import type { RestorePreviewRoute } from "@/screens/backup-restore-logic";
import type { AiCloudProviderId } from "@/services/ai-types";
import type { PhotoTargetDescriptor } from "@/services/photos/photo-storage";

/** Serializable Profile route state shared by every stack that can open it. */
export type ProfileRouteParams = {
  contactId: number;
  openReachOut?: boolean;
};

/**
 * Where a Compose session was launched from, driving origin-aware return
 * (COMP-14 / HIGH-8). A serializable primitive only. `profile` returns toward the
 * contact Profile (pop within whichever stack hosted it); `dashboard`/`deep-link`
 * keep the default dashboard-reset semantics. Absent/`undefined` is treated as the
 * default (dashboard) case, so existing callers need no change.
 */
export type ComposeOrigin = "profile" | "dashboard" | "deep-link";

/**
 * The single route → params contract for the app's native-stack navigator
 * (Phase 4's real navigation shell, replacing the Phase-1→3 dependency-free
 * `HomeScreen` `useState` toggle).
 *
 * `Profile`/`Edit` carry the `contactId` they operate on; `Create` opens the
 * blank create form and carries no params. `CustomFields` and `Archived` are
 * the two CRUD-05 "separate, low-traffic homes" reached through Settings.
 * Routes whose screens land in later plans (`Create`, `Profile`, `Edit`,
 * `Archived`) register themed placeholders until those plans replace them, so
 * every route is type-checked and reachable now.
 *
 * Declared as a `type` alias (not an `interface`) so it gains the implicit
 * index signature that satisfies `createNativeStackNavigator`'s `ParamListBase`
 * constraint — an `interface` would fail to assign (TS2344).
 */
export type DashboardStackParamList = {
  Home: undefined;
  /** Placeholder until Phase 33 supplies the Group Events workflow. */
  GroupEvents: undefined;
  /**
   * The detailed-log entry (universal FAB today; the empty-date History action
   * in Phase 32). `prefillDate` is the local `YYYY-MM-DD` an empty date/cell
   * "Log interaction" prefills so the contact is preselected AND the date is set
   * (HIST-15). Phase 32 owns the typed route CONTRACT + placeholder target;
   * Phase 34 fills the real detailed-log form that consumes `prefillDate`.
   */
  LogContact: { contactId?: number; prefillDate?: string } | undefined;
  /**
   * Optional selected Dashboard participant ids. Phase 33 consumes these ids
   * when it replaces the Group Log placeholder with the real group workflow.
   * Serializable primitives only: no callbacks or contact data cross routes.
   */
  GroupLog: { participantIds?: number[] } | undefined;
  GroupEventDetail: { groupEventId: number };
  EditGroupEvent: { groupEventId: number };
  EditParticipant: {
    groupEventId: number;
    interactionId: number;
    contactId: number;
  };
  UpdateContact: { contactId?: number } | undefined;
  Memory: { contactId?: number } | undefined;
  Settings: undefined;
  CustomFields: undefined;
  Create: undefined;
  Profile: ProfileRouteParams;
  ThingsToRemember: { contactId: number };
  RecentlyDeleted: { contactId: number };
  MemoryHistory: { contactId: number; fieldKey: CurrentStateFieldKey };
  Edit: { contactId: number };
  /** The canonical Edit Interaction route (HIST-12); scoped by contact + interaction. */
  EditInteraction: { contactId: number; interactionId: number };
  Archived: undefined;
  /**
   * The in-app Skia crop screen (PHOTO-01). Params are SERIALIZABLE only — a raw
   * cache URI to crop, a target descriptor object, and (customField only) a
   * serializable `requestId` correlation key so Plan 08's widget can match the
   * published crop-success to the awaiting field. NO callback params (native-stack
   * serialization + deep-link safety); contact/profile leave `requestId` undefined.
   */
  CropPhoto: {
    rawUri: string;
    target: PhotoTargetDescriptor;
    requestId?: string;
  };
  /** Dedicated neutral browse surface for live contacts outside the active orbit. */
  UnboundContacts: undefined;
  /**
   * The entry-agnostic compose surface (CMP-01/02/03). Params are SERIALIZABLE
   * ONLY — a bare `contactId` plus the optional origin, NO callback params
   * (native-stack serialization + deep-link safety). The screen self-fetches
   * header + fuel + SMS capability from the id alone, so Phase 11 (notification)
   * and Phase 12 (widget) can open it with just a contact id and no wiring.
   * Registered additively; `initialRouteName` stays `Home` and every existing
   * route is untouched.
   *
   * The retired consume-once AI-intent param (Plan 14-05, Trip-Wire 4) was REMOVED
   * in Plan 35-09: Phase 31 removed the Profile AI-draft entry, and AI now starts
   * only from the in-Compose adaptive Draft/Rewrite action (Plan 35-08) — never
   * auto-started from a route param.
   *
   * `origin` (Plan 35-09, COMP-14) is an OPTIONAL serializable primitive naming
   * the launch context so a completed send/log or Back returns toward it — the
   * Profile caller passes `'profile'`; dashboard/widget/notification callers omit
   * it and keep the default dashboard-reset semantics.
   */
  Compose: {
    contactId: number;
    origin?: ComposeOrigin;
  };
  /**
   * The read-only "Things to Remember" Research sibling of Compose (COMP-08,
   * plan 35-06 screen / 35-09 wiring). Carries the SERIALIZABLE `contactId` only —
   * the screen self-fetches its normalized projection and the session-only Message
   * Focus store survives the Compose↔Research transition (no callbacks; deep-link
   * safe). Registered in every stack that hosts Compose so the navigate resolves.
   */
  ComposeResearch: { contactId: number };
  /**
   * The share-sheet capture picker (CAP-01/04). Carries NO params — a system
   * share is consumed by the `ShareIntentProvider` (the single owner of the
   * native pending-share singleton), and the screen drains the payload via
   * `useShareIntentContext()` rather than route params (serializable-only,
   * deep-link-safe, no callbacks). Registered additively; `initialRouteName`
   * stays `Home` and every existing route is untouched. The Stack.Screen for
   * this route lands in Plan 10-05 with the screen component.
   */
  Capture: undefined;
  /**
   * The orrery "solar system" view (ORR-01/03/04/05). Carries NO params — the
   * screen self-fetches the orbiting set + sun occupant from the DB on focus
   * (serializable-only, deep-link-safe, no callbacks — the same additive posture
   * as `Capture`/`Compose`). Reached from the dashboard header ◎ Orbit button.
   * Registered additively; `initialRouteName` stays `Home` and every existing
   * route is untouched.
   */
  Orrery: undefined;
  /**
   * The weekly "your week" digest screen (DGST-01/02/03). Carries NO params — the
   * screen self-fetches the three digest reads + the backlog count on focus
   * (serializable-only, deep-link-safe, no callbacks — the same additive posture
   * as `Orrery`/`Capture`/`Compose`). Reached from the dashboard's discreet "Your
   * week" top-bar entry (this plan) and, later, the Sunday notification tap
   * (Plan 15-05). Registered additively; `initialRouteName` stays `Home` and
   * every existing route is untouched.
   */
  Digest: undefined;
  SurvivorSelect: { firstContactId: number; secondContactId?: number };
  MergeConflicts: { survivorId: number; absorbedId: number };
  MergeImpactSummary: {
    survivorId: number;
    absorbedId: number;
    resolutions: MergeResolutions;
  };
};

/** The Orrery owns its visual root and duplicates contact detail for origin-aware Back. */
export type OrreryStackParamList = {
  Orrery: undefined;
  SystemBuilder: { systemUid?: string; systemRef?: string } | undefined;
  SystemsManagement: undefined;
  Profile: ProfileRouteParams;
  /**
   * The detailed-log route (HIST-15). Registered here because Profile is hosted
   * in the Orrery stack, so an Orrery-originated empty-date "Log interaction"
   * must resolve rather than throw on an unregistered route name.
   */
  LogContact: { contactId?: number; prefillDate?: string } | undefined;
  ThingsToRemember: { contactId: number };
  RecentlyDeleted: { contactId: number };
  MemoryHistory: { contactId: number; fieldKey: CurrentStateFieldKey };
  Edit: { contactId: number };
  /** The canonical Edit Interaction route (HIST-12); scoped by contact + interaction. */
  EditInteraction: { contactId: number; interactionId: number };
  /**
   * Group Event routes are registered here because Profile is hosted in the
   * Orrery stack. RootStackParamList is a type intersection, so the history
   * surface must resolve these routes in every stack that can host Profile.
   */
  GroupEventDetail: { groupEventId: number };
  EditGroupEvent: { groupEventId: number };
  EditParticipant: {
    groupEventId: number;
    interactionId: number;
    contactId: number;
  };
  Compose: {
    contactId: number;
    origin?: ComposeOrigin;
  };
  /** The read-only Things to Remember Research sibling of Compose — registered
   *  here too because Compose is hosted in the Orrery stack (COMP-08). */
  ComposeResearch: { contactId: number };
  CropPhoto: {
    rawUri: string;
    target: PhotoTargetDescriptor;
    requestId?: string;
  };
  SurvivorSelect: { firstContactId: number; secondContactId?: number };
  MergeConflicts: { survivorId: number; absorbedId: number };
  MergeImpactSummary: {
    survivorId: number;
    absorbedId: number;
    resolutions: MergeResolutions;
  };
};

export type BackupStackParamList = {
  Backup: undefined;
  BackupSettings: { section?: "automatic" | "encryption" } | undefined;
  RestorePreview: RestorePreviewRoute;
  RestoreResult: {
    added: number;
    updated: number;
    newerLocalKept: number;
    deletionsApplied: number;
    replaceSafetySnapshot: "verified" | "not-configured" | null;
  };
};

export type SettingsStackParamList = {
  Settings: undefined;
  AIConnection: undefined;
  AIModelPicker: { lane: AiCloudProviderId };
  AIPersonalization:
    | { focus?: "writing-style" | "personalization" }
    | undefined;
  AIPermissions: undefined;
  AIPreview: undefined;
  /**
   * Phase 37 Settings decomposition (D-09). `Settings` (above) now mounts the
   * navigation-first hub; `SettingsMore` re-registers the untouched monolith at
   * a transitional internal route so every not-yet-migrated control stays
   * reachable (removed in Plan 08), and `SettingsInteractions` is the first real
   * category screen. Later plans add the remaining category route names.
   */
  SettingsMore: undefined;
  SettingsInteractions: undefined;
  SettingsAppearance: undefined;
  SettingsContacts: undefined;
  /**
   * Categories IA reservation (D-03 / §K). A stable internal route NAME held for
   * a FUTURE Category Management phase (CRUD + deletion cascade). Phase 37 ships
   * NO `<Stack.Screen>` for it, NO tappable row, and NO category create/rename/
   * delete writer — the `categories` table stays read-only (seeded at migration
   * 001; only ever read at runtime). Deliberately EXCLUDED from
   * `SETTINGS_REGISTERED_ROUTES`; the source-scan test asserts it is not
   * registered (the D-03 typed-but-unregistered case, no dead placeholder).
   */
  CategoryManagement: undefined;
  /** DEV-only device-UAT harness; its route is compile-time gated from release. */
  __ThemePreview: undefined;
  SystemBuilder: { systemUid?: string; systemRef?: string } | undefined;
  SystemsManagement: undefined;
  CustomFields: undefined;
  Archived: undefined;
  Profile: ProfileRouteParams;
  /**
   * The detailed-log route (HIST-15). Registered here because Profile is hosted
   * in Settings (Archived → Profile), so a Settings-originated empty-date "Log
   * interaction" must resolve rather than throw on an unregistered route name.
   */
  LogContact: { contactId?: number; prefillDate?: string } | undefined;
  /**
   * Knowledge-change edit routes. The History section's `onOpenKnowledgeChange`
   * reuses ContactProfileScreen's existing knowledge nav to `ThingsToRemember`
   * (and `MemoryHistory`), which are registered in Dashboard/Orrery but were
   * ABSENT here — so a Settings-originated knowledge-change edit would throw on
   * an unregistered route. Registered to mirror those stacks (review cycle-2 HIGH).
   */
  ThingsToRemember: { contactId: number };
  MemoryHistory: { contactId: number; fieldKey: CurrentStateFieldKey };
  /**
   * The canonical Edit Interaction route (HIST-12). Registered here too because
   * Profile is hosted in Settings (Archived → Profile), and RootStackParamList is
   * a TYPE intersection — each stack must register the screen it can reach.
   */
  EditInteraction: { contactId: number; interactionId: number };
  /**
   * Group Event routes are registered here because Profile is hosted in Settings
   * (Archived → Profile). RootStackParamList is a type intersection, so the
   * history surface must resolve these routes in every stack that can host Profile.
   */
  GroupEventDetail: { groupEventId: number };
  EditGroupEvent: { groupEventId: number };
  EditParticipant: {
    groupEventId: number;
    interactionId: number;
    contactId: number;
  };
  CropPhoto: {
    rawUri: string;
    target: PhotoTargetDescriptor;
    requestId?: string;
  };
  LegacyContactPicker: undefined;
  ImportReview: { sessionId: number };
  BulkImportSetup: { sessionId: number };
  ImportProgress: { sessionId: number; batchCategoryId: number | null };
  DuplicateReview: { sessionId: number };
  ImportComplete: { sessionId: number };
  BulkReview: undefined;
  SurvivorSelect: { firstContactId: number; secondContactId?: number };
  MergeConflicts: { survivorId: number; absorbedId: number };
  MergeImpactSummary: {
    survivorId: number;
    absorbedId: number;
    resolutions: MergeResolutions;
  };
  ReconcileDetail: { contactId: number; sessionId?: number; cardId?: number };
  ReconcileGrid: { sessionId?: number } | undefined;
  ReconcileComplete: { sessionId: number };
};

/** The root container exposes only the four persistent tab destinations. */
export type TabParamList = {
  DashboardTab: NavigatorScreenParams<DashboardStackParamList>;
  OrreryTab: NavigatorScreenParams<OrreryStackParamList>;
  BackupTab: NavigatorScreenParams<BackupStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};

/**
 * Compatibility contract for existing screen-local navigation typing. New
 * container navigation is deliberately typed against TabParamList instead.
 */
export type RootStackParamList = DashboardStackParamList &
  OrreryStackParamList &
  BackupStackParamList &
  SettingsStackParamList;

export type DashboardScreenProps<T extends keyof DashboardStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<DashboardStackParamList, T>,
    BottomTabScreenProps<TabParamList>
  >;

export type OrreryScreenProps<T extends keyof OrreryStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<OrreryStackParamList, T>,
    BottomTabScreenProps<TabParamList>
  >;

export type BackupScreenProps<T extends keyof BackupStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<BackupStackParamList, T>,
    BottomTabScreenProps<TabParamList>
  >;

export type SettingsScreenProps<T extends keyof SettingsStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<SettingsStackParamList, T>,
    BottomTabScreenProps<TabParamList>
  >;

/**
 * Per-screen props helper: `RootStackScreenProps<"Profile">` gives a screen its
 * fully-typed `navigation` + `route` (with `route.params.contactId`).
 */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
