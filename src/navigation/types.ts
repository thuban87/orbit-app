import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MergeResolutions } from "@/db/merge-dao";
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
export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  CustomFields: undefined;
  Create: undefined;
  Profile: { contactId: number };
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
  /**
   * The "Not yet contacted" sibling screen (DASH-04) — the inverse-population
   * home. Carries no params (the sort lives in the screen's local state, default
   * Oldest added). Reached from the dashboard's counted "Not yet contacted (N)"
   * footer entry (Plan 07 wires that entry; this route is the first of the two
   * nav registrations this phase adds).
   */
  NeverContacted: undefined;
  /** Dedicated neutral browse surface for live contacts outside the active orbit. */
  UnboundContacts: undefined;
  /**
   * The shared "Manage favourites" reorder screen (DASH-06). Carries no params
   * (the favourites order lives in the screen's local state, seeded from
   * `listFavourites`). Reached from the Settings row (Plan 10) and the
   * favourites-chip Manage affordance (Plan 09) — the second of the two nav
   * registrations this phase adds.
   */
  ManageFavourites: undefined;
  /**
   * The entry-agnostic compose surface (CMP-01/02/03). Params are SERIALIZABLE
   * ONLY — a bare `contactId` plus the optional Phase-14 AI intent flag, NO
   * callback params (native-stack serialization + deep-link safety), the same
   * additive posture as `NeverContacted` / `ManageFavourites`. The screen
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
  /** Permanent local backup health/action surface (BKP-01..03). */
  Backup: undefined;
  /** Dedicated automatic-backup and encryption configuration screen. */
  BackupSettings: { section?: "automatic" | "encryption" } | undefined;
  /** Serializable aggregate hand-off; the validated backup stays process-local. */
  RestorePreview: RestorePreviewRoute;
  /** Aggregate-only committed restore outcome; never carries backup contents. */
  RestoreResult: {
    added: number;
    updated: number;
    newerLocalKept: number;
    deletionsApplied: number;
    replaceSafetySnapshot: "verified" | "not-configured" | null;
  };
  /** Durable system-contact import flow; all params are declared up front. */
  LegacyContactPicker: undefined;
  ImportReview: { sessionId: number };
  BulkImportSetup: { sessionId: number };
  ImportProgress: { sessionId: number; batchCategoryId: number | null };
  DuplicateReview: { sessionId: number };
  ImportComplete: { sessionId: number };
  /** Durable resolver for import rows whose birthdays could not be parsed. */
  BulkReview: undefined;
  SurvivorSelect: { firstContactId: number; secondContactId?: number };
  MergeConflicts: { survivorId: number; absorbedId: number };
  MergeImpactSummary: {
    survivorId: number;
    absorbedId: number;
    resolutions: MergeResolutions;
  };
  ReconcileDetail: { contactId: number; sessionId?: number; cardId?: number };
  /** Bulk linked-contact reconciliation; an id is supplied by later resume flow. */
  ReconcileGrid: { sessionId?: number } | undefined;
  ReconcileComplete: { sessionId: number };
};

/**
 * Per-screen props helper: `RootStackScreenProps<"Profile">` gives a screen its
 * fully-typed `navigation` + `route` (with `route.params.contactId`).
 */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
