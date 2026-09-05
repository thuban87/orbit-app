import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MergeResolutions } from "@/db/merge-dao";
import type { CurrentStateFieldKey } from "@/db/memory-registry";
import type { RestorePreviewRoute } from "@/screens/backup-restore-logic";
import type { PhotoTargetDescriptor } from "@/services/photos/photo-storage";

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
  /** Placeholder routes the universal FAB exposes before their owning phases land. */
  LogContact: { contactId?: number } | undefined;
  GroupLog: undefined;
  UpdateContact: { contactId?: number } | undefined;
  Memory: { contactId?: number } | undefined;
  Settings: undefined;
  CustomFields: undefined;
  Create: undefined;
  Profile: { contactId: number; openReachOut?: boolean };
  ThingsToRemember: { contactId: number };
  RecentlyDeleted: { contactId: number };
  MemoryHistory: { contactId: number; fieldKey: CurrentStateFieldKey };
  Edit: { contactId: number };
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
   * ONLY — a bare `contactId` plus the optional Phase-14 AI intent flag, NO
   * callback params (native-stack serialization + deep-link safety). The screen
   * self-fetches header + fuel + SMS capability from the id alone, so Phase 11
   * (notification), Phase 12 (widget), and Phase 14 (AI) can open it with just a
   * contact id and no wiring. Registered additively; `initialRouteName` stays
   * `Home` and every existing route is untouched.
   *
   * `requestAiSuggestion` (Plan 14-05) is a SERIALIZABLE primitive the profile
   * "AI draft" entry sets to `true` so Compose auto-starts one suggestion on
   * focus. It is CONSUMED-ONCE: Compose clears it (`setParams`) before dispatch,
   * so a focus reload / re-render cannot repeat the (potentially billable)
   * request (T-14-16). Absent/`undefined` is the ordinary "opened to compose"
   * case — no suggestion is auto-started.
   */
  Compose: { contactId: number; requestAiSuggestion?: boolean };
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
  Profile: { contactId: number; openReachOut?: boolean };
  ThingsToRemember: { contactId: number };
  RecentlyDeleted: { contactId: number };
  MemoryHistory: { contactId: number; fieldKey: CurrentStateFieldKey };
  Edit: { contactId: number };
  Compose: { contactId: number; requestAiSuggestion?: boolean };
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
  CustomFields: undefined;
  Archived: undefined;
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
