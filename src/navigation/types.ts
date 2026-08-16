import type { NativeStackScreenProps } from "@react-navigation/native-stack";
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
   * ONLY — a bare `contactId`, NO callback params (native-stack serialization +
   * deep-link safety), the same additive posture as `NeverContacted` /
   * `ManageFavourites`. The screen self-fetches header + fuel + SMS capability
   * from the id alone, so Phase 11 (notification), Phase 12 (widget), and Phase
   * 14 (AI) can open it with just a contact id and no wiring. Registered
   * additively; `initialRouteName` stays `Home` and every existing route is
   * untouched.
   */
  Compose: { contactId: number };
};

/**
 * Per-screen props helper: `RootStackScreenProps<"Profile">` gives a screen its
 * fully-typed `navigation` + `route` (with `route.params.contactId`).
 */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
