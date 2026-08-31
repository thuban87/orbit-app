/**
 * ContactProfileScreen (CRUD-01 scaffold) — the header the create flow lands on
 * (`navigation.replace("Profile", { contactId })`). This phase lays ONLY the
 * header + "Add details" refine affordance + the "Rarely responds" label + a
 * placeholder overflow `⋯`; the read surfaces (timeline, gravity/intensity,
 * fuel) are owned by later phases and appear here as clearly-labelled stubs.
 *
 * The `⋯` is a low-emphasis (`textSecondary`) `OverflowMenu` whose sole action
 * this phase is Archive (Plan 08) — a reversible `archived_at` flag flip that
 * hides the contact from every live surface, then navigates off the (now hidden)
 * profile back to Home. Archive is deliberately NOT styled destructive and is
 * never adjacent to purge (purge lands on the Archived list in Plan 09 — the
 * two-stage guarantee). "Add details" (accent text-link) opens the full edit
 * form (`Edit`), surfacing frequency/last-spoke/phone first — the name-only
 * refine path.
 *
 * The light `getContactHeader` read (name + rarely_responds) is the only data
 * this scaffold needs. Every colour resolves through `useTheme().colors.*`
 * (CLAUDE.md / check:colors).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { CustomFieldValue } from "@/components/CustomFieldValue";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import {
  type FuelDraft,
  FuelEditor,
  type FuelEditPatch,
} from "@/components/FuelEditor";
import { GravityBar } from "@/components/GravityBar";
import { IntensityLine } from "@/components/IntensityLine";
import { OverflowMenu } from "@/components/OverflowMenu";
import { RankedFuelLine } from "@/components/RankedFuelLine";
import { ReachOutRouter } from "@/components/ReachOutRouter";
import { TimelineRow } from "@/components/TimelineRow";
import {
  TouchpointRefineForm,
  type TouchpointRefineValue,
} from "@/components/TouchpointRefineForm";
import { getAppSettings } from "@/db/app-settings-dao";
import {
  type ContactMethodGroups,
  listContactMethodGroups,
  selectActionablePrimaryMethods,
} from "@/db/contact-methods-read";
import { getContactHeader } from "@/db/contact-read";
import {
  type ContactStatusRow,
  getContactStatus,
  type RogueReason,
} from "@/db/contact-status-read";
import { archiveContact } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { clearFavouriteRank, setFavouriteRank } from "@/db/favourites-dao";
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import {
  getValuesForContact,
  visibleDefsForProfile,
} from "@/db/field-values-dao";
import { addFuel, confirmFuel, deleteFuel, editFuel } from "@/db/fuel-dao";
import {
  type FuelItem,
  getRankedFuel,
  listFuelForEditor,
} from "@/db/fuel-read";
import { getImpactInputs } from "@/db/impact-read";
import { deriveReachRoutes } from "@/db/interaction-assist-read";
import {
  deleteTouchpoint,
  editTouchpointFull,
  recordTouchpoint,
} from "@/db/recency-dao";
import { clearSnooze, type SnoozePreset, snoozeContact } from "@/db/snooze-dao";
import {
  listTimeline,
  type TimelineItem,
  type TimelineTouchpoint,
} from "@/db/timeline-read";
import { newUid } from "@/db/uid";
import type { RootStackScreenProps } from "@/navigation/types";
import {
  canStartLifecycleTransition,
  profileLifecycleView,
  profileMethodGroups,
  unbindConfirmation,
} from "@/screens/contact-profile-logic";
import {
  bindWithLifecycleEffects,
  unbindWithLifecycleEffects,
} from "@/services/contact-lifecycle-effects";
import type { GravityResult } from "@/services/gravity-logic";
import {
  computeContactGravity,
  computeContactIntensity,
} from "@/services/impact";
import type { IntensityResult } from "@/services/intensity-logic";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { useTheme } from "@/theme";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "contact-profile";

/**
 * The in-app snooze presets (NOTIF-03) rendered as a row of tap-to-snooze chips.
 * Each writes `snooze_until` through the mutexed snooze-dao. Order is display
 * order; the labels are the UI-SPEC §3 copy.
 */
const SNOOZE_PRESETS: {
  preset: SnoozePreset;
  testID: string;
  label: string;
}[] = [
  { preset: "3d", testID: "contact-profile-snooze-3d", label: "3 days" },
  { preset: "1w", testID: "contact-profile-snooze-1w", label: "1 week" },
  { preset: "1m", testID: "contact-profile-snooze-1m", label: "1 month" },
];

/**
 * Human copy for a rogue reason (in-app label only — never a notification).
 * 'overdue' = beyond-decay time; 'unresponsive' = the Rarely-responds path.
 */
function rogueReasonText(reason: RogueReason): string | null {
  switch (reason) {
    case "overdue":
      return "overdue";
    case "unresponsive":
      return "unresponsive";
    default:
      return null;
  }
}

/** The light header read the scaffold renders. */
type Header = {
  id: number;
  name: string;
  rarely_responds: number;
  archived_at: string | null;
  /** Stored relative photo path (`avatars/…`) or null — drives the Avatar. */
  photo: string | null;
  /** Second-resolution row timestamp — the Avatar's cross-session cache-bust. */
  modified_at: string;
  /** The contact's favourite rank, or null — drives the header star's state. */
  favourite_rank: number | null;
  trackingEnabled: number;
  intervalDays: number | null;
  /**
   * The contact's active snooze date (`YYYY-MM-DD`) or null — drives the
   * Snooze-reminders status line. Rendered DIRECTLY as a local date string
   * (never `new Date(str)`, which would reintroduce the forbidden UTC off-by-one).
   */
  snooze_until: string | null;
};

export function ContactProfileScreen({
  navigation,
  route,
}: RootStackScreenProps<"Profile">) {
  const { colors } = useTheme();
  const { contactId } = route.params;
  const [header, setHeader] = useState<Header | null>(null);
  const [hasActiveExternalLink, setHasActiveExternalLink] = useState(false);
  // Custom values remain raw at rest.  The profile selects its live fields from
  // definitions plus this map, then CustomFieldValue owns presentation and the
  // invalid-value recovery affordance.
  const [fieldDefs, setFieldDefs] = useState<CustomFieldDef[]>([]);
  const [customValues, setCustomValues] = useState<
    Record<string, string | null>
  >({});
  const [methodGroups, setMethodGroups] = useState<ContactMethodGroups>({
    phone: [],
    email: [],
  });
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  // The contact's conversational fuel (FUEL-01/02) — read through the single
  // fuel-read choke point (all kinds incl off_limits, newest-first). Editing is
  // in-place and immediate: every add/edit/delete writes then re-runs load().
  const [fuel, setFuel] = useState<FuelItem[]>([]);
  // The single ranked projection (FUEL-03) — kind priority then recency, with
  // off_limits / unconfirmed source='ai' / blank text excluded IN-QUERY by
  // getRankedFuel. rankedFuel[0] is the one promoted line rendered above the
  // editor; it is recomputed by the SAME unified load() on every fuel mutation
  // (no second ranking in the UI). Empty when there is no rankable fuel.
  const [rankedFuel, setRankedFuel] = useState<FuelItem[]>([]);
  // Query-time status + rogue reason (DERIVED-NEVER-STORED). null for a
  // never-contacted contact — see getContactStatus's NULL guard.
  const [status, setStatus] = useState<ContactStatusRow | null>(null);
  // Derived-never-stored gravity (LOG-03) — the accumulated-familiarity tier,
  // computed at read time from the shared impact inputs. null when the contact
  // has no interaction history yet (nothing to show a buffer for).
  const [gravity, setGravity] = useState<GravityResult | null>(null);
  // Derived-never-stored intensity (LOG-03) — this period's contact RATE vs the
  // intended frequency + the long-run trailing cadence, from the SAME impact
  // inputs gravity uses (so the two can never disagree). NEUTRAL, profile-only,
  // presented BESIDE gravity, never blended into one score. null when there is
  // no interaction history yet.
  const [intensity, setIntensity] = useState<IntensityResult | null>(null);
  // In-flight latch for the one-tap log — blocks a double-fire while the write
  // is open, and dims the button.
  const [logging, setLogging] = useState(false);
  const [reachOutOpen, setReachOutOpen] = useState(false);
  const [assistEnabled, setAssistEnabled] = useState(true);
  // Whether an AI provider is configured (aiProvider !== 'none'). Gates the
  // additive "AI draft" entry (Plan 14-05) so a never-configured user never sees
  // a control that leads to an inert Compose flow — the exact prompt + first-send
  // acknowledgement all live in Compose, not here.
  const [aiConfigured, setAiConfigured] = useState(false);
  // The touchpoint currently open in the refine form (null = form closed) and
  // its controlled value. The parent owns both — the form is presentational.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [refineValue, setRefineValue] = useState<TouchpointRefineValue | null>(
    null,
  );
  // In-flight latch for the refine save — blocks a double-fire.
  const [savingEdit, setSavingEdit] = useState(false);
  const [bindIntervalDays, setBindIntervalDays] = useState(30);
  const [bindIntervalValid, setBindIntervalValid] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // The SINGLE unified read: the header AND the interleaved timeline, so both
  // refresh together on focus and after an in-place log (LOG-02 read half).
  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const [
        row,
        rows,
        statusRow,
        impactInputs,
        fuelRows,
        rankedFuelRows,
        settings,
        defs,
        methods,
        assistSetting,
        externalLink,
      ] = await Promise.all([
        getContactHeader(exec, contactId),
        listTimeline(exec, contactId),
        getContactStatus(exec, contactId),
        getImpactInputs(exec, contactId),
        listFuelForEditor(exec, contactId),
        getRankedFuel(exec, contactId),
        getAppSettings(exec),
        listDefs(exec, { includeQuarantined: false }),
        listContactMethodGroups(exec, contactId),
        exec.getFirstAsync<{ interaction_assist_enabled: number }>(
          "SELECT interaction_assist_enabled FROM app_settings WHERE id = 1",
        ),
        exec.getFirstAsync<{ id: number }>(
          "SELECT id FROM external_contact_links WHERE contact_id = ? AND is_active = 1 ORDER BY id ASC LIMIT 1",
          [contactId],
        ),
      ]);
      const values = await getValuesForContact(exec, contactId, defs);
      setHeader(row);
      setHasActiveExternalLink(externalLink != null);
      setFieldDefs(defs);
      setCustomValues(values);
      setMethodGroups(methods);
      // Migration 014 defaults the setting to enabled. Keep the safe enabled
      // default if a corrupted pre-migration row is ever unavailable.
      setAssistEnabled(assistSetting?.interaction_assist_enabled !== 0);
      setTimeline(rows);
      setStatus(statusRow);
      setFuel(fuelRows);
      setRankedFuel(rankedFuelRows);
      // Show the additive "AI draft" entry only when a provider is configured.
      setAiConfigured(settings.aiProvider !== "none");
      // Derive gravity AND intensity from the SAME impact inputs (read once so
      // they can never disagree); hide both until there is interaction history.
      // localDateTime() is captured once so both derivations share one "now".
      const now = localDateTime();
      const hasHistory =
        impactInputs !== null && impactInputs.interactions.length > 0;
      setGravity(hasHistory ? computeContactGravity(impactInputs, now) : null);
      // Intensity is unavailable for an Unbound contact (the `available: false`
      // marker); store only a real Bound result. The impact section is already
      // Bound-gated (showCadenceTreatment), so an unavailable marker would never
      // render — collapse it to null rather than widen the state type.
      const derivedIntensity = hasHistory
        ? computeContactIntensity(impactInputs, now)
        : null;
      setIntensity(
        derivedIntensity && "available" in derivedIntensity
          ? null
          : derivedIntensity,
      );
      // (impactInputs is narrowed non-null by `hasHistory` above.)
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load contact", err);
      Alert.alert("Couldn't load this contact", "Please go back and retry.");
    }
  }, [contactId]);

  // Both helpers are pure projections over the method rows loaded above; this
  // deliberately avoids a second route query or a reachable-action flash.
  const reachRoutes = deriveReachRoutes(
    selectActionablePrimaryMethods(methodGroups),
  );

  // Reload on focus, not just on mount: the only route into Edit is this
  // profile's "Add details", so Edit always sits directly above Profile in the
  // native stack. Saving via navigation.navigate("Profile", { contactId }) pops
  // back to THIS existing instance without remounting — an on-mount effect would
  // never re-run, leaving a renamed name / stale "Rarely responds" label. `load`
  // is a stable useCallback (keyed on contactId), so the focus effect is stable.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // One-tap "Log contact" (LOG-01) — the primary action of this slice. Records a
  // touchpoint through the SINGLE writer (recordTouchpoint) with the Cluster-G
  // one-tap defaults: direction='outbound' passed EXPLICITLY (the DAO defaults
  // direction to null, which would starve gravity), channel='unspecified',
  // connected=1, quality=null, source='manual'. occurredAt/now both come from
  // localDateTime() — never toISOString (DATA-05 local wall-clock contract).
  const doLogContact = useCallback(async () => {
    if (logging) {
      return; // Guard the double-fire while the write is in flight.
    }
    setLogging(true);
    try {
      const stamp = localDateTime();
      await recordTouchpoint(getExecutor(), {
        contactId,
        uid: newUid(),
        occurredAt: stamp,
        now: stamp,
        channel: "unspecified",
        direction: "outbound",
        connected: 1,
        quality: null,
        source: "manual",
      });
      // In-place log does NOT re-fire useFocusEffect (the screen stays focused),
      // so refresh every derived surface through the SINGLE unified load().
      await load();
      // A manual log changes last_contact → derived status/fuelText on the widget.
      notifyWidgetDataChanged();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to log contact", err);
      Alert.alert("Couldn't log contact", "Please try again.");
    } finally {
      setLogging(false);
    }
  }, [contactId, logging, load]);

  // Archive (the overflow's only action this phase): flip archived_at, then
  // leave the now-hidden profile back to Home. Reversible — Restore lives on the
  // Archived list (Settings), never here (two-stage guarantee).
  const doArchive = useCallback(async () => {
    try {
      await archiveContact(getExecutor(), contactId, localDateTime());
      // Archiving removes a (possibly-favourite) contact from the widget projection
      // (archived_at IS NOT NULL). This handler navigates away with no load(), so
      // publish right after the successful commit, before popToTop.
      notifyWidgetDataChanged();
      navigation.popToTop();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to archive contact", err);
      Alert.alert("Couldn't archive", "Please try again.");
    }
  }, [contactId, navigation]);

  // Toggle the favourite star (DASH-06): mark when not a favourite, clear when
  // it is, through the guarded favourites-dao (changes===1, transactional, the
  // recency column untouched), then the SINGLE unified load() reconciles the
  // header's favourite_rank so the star reflects the persisted state. Reversible
  // and non-destructive → NO confirmation dialog (dossier: reversible acts don't
  // gate). The current state is read off the freshly-loaded header, never a
  // stale snapshot. localDateTime() supplies the local wall-clock `now`.
  const isFavourite = header?.favourite_rank != null;
  const lifecycle = profileLifecycleView({
    trackingEnabled: header?.trackingEnabled ?? 1,
    intervalDays: header?.intervalDays ?? 30,
  });
  const doToggleFavourite = useCallback(async () => {
    const currentlyFavourite = header?.favourite_rank != null;
    try {
      const now = localDateTime();
      if (currentlyFavourite) {
        await clearFavouriteRank(getExecutor(), contactId, now);
      } else {
        await setFavouriteRank(getExecutor(), contactId, now);
      }
      await load();
      // Favourite membership is the widget projection itself — mark/clear adds or
      // removes this contact's tile.
      notifyWidgetDataChanged();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to toggle favourite", err);
      Alert.alert("Couldn't update favourite", "Please try again.");
    }
  }, [contactId, header?.favourite_rank, load]);

  const doLifecycleTransition = useCallback(
    async (direction: "bind" | "unbind") => {
      const bindEnabled =
        lifecycle.bindEnabled ||
        (lifecycle.showFrequencyPicker && bindIntervalValid);
      if (
        transitioning ||
        (direction === "bind" &&
          !canStartLifecycleTransition({ pending: false, bindEnabled }))
      ) {
        return;
      }
      setTransitioning(true);
      try {
        const exec = getExecutor();
        const now = localDateTime();
        if (direction === "bind") {
          await bindWithLifecycleEffects(
            exec,
            contactId,
            now,
            lifecycle.showFrequencyPicker ? bindIntervalDays : undefined,
          );
        } else {
          await unbindWithLifecycleEffects(exec, contactId, now);
        }
        await load();
      } catch (err) {
        Logger.error(LOG_SCOPE, `failed to ${direction} contact`, err);
        Alert.alert("Couldn't update contact", "Please try again.");
      } finally {
        setTransitioning(false);
      }
    },
    [
      bindIntervalDays,
      bindIntervalValid,
      contactId,
      lifecycle.bindEnabled,
      lifecycle.showFrequencyPicker,
      load,
      transitioning,
    ],
  );

  const confirmUnbind = useCallback(() => {
    const confirmation = unbindConfirmation(header?.name ?? "this contact");
    Alert.alert(confirmation.title, confirmation.message, [
      { text: "Keep contact bound", style: "cancel" },
      {
        text: "Unbind contact",
        style: "destructive",
        onPress: () => void doLifecycleTransition("unbind"),
      },
    ]);
  }, [doLifecycleTransition, header?.name]);

  // In-app snooze presets (NOTIF-03): write snooze_until through the mutexed
  // snooze-dao (uid minted here, local wall-clock now), then the SINGLE unified
  // load() reconciles the header so the status line reflects the fresh row.
  // Reversible, non-destructive → NO confirmation dialog. REVIEW ITEM B — after
  // the write, fire reconcileSchedule (fire-and-forget, Logger-guarded, NOT
  // awaited into the tap handler) so the pre-parked decay notification is
  // cancelled and re-armed PAST snooze_until immediately — otherwise the already-
  // scheduled notification would fire DURING the snooze. The app is alive here so
  // channels exist and a full reconcile is safe (same pattern as the settings-
  // change reconcile); reconcileSchedule is self-coordinating so it reads the
  // freshly-committed row.
  const doSnooze = useCallback(
    async (preset: SnoozePreset) => {
      try {
        await snoozeContact(getExecutor(), {
          contactId,
          uid: newUid(),
          preset,
          now: localDateTime(),
        });
        await load();
        void reconcileSchedule(getExecutor()).catch((e) =>
          Logger.error(LOG_SCOPE, "reconcile after snooze failed", e),
        );
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to snooze contact", err);
        Alert.alert("Couldn't snooze", "Please try again.");
      }
    },
    [contactId, load],
  );

  // Clear an active snooze (NULLs snooze_until, always writing an unsnooze event —
  // item 10) then the unified load() reconciles the header, and reconcileSchedule
  // re-arms the normal cadence immediately (item B, same fire-and-forget contract).
  const doClearSnooze = useCallback(async () => {
    try {
      await clearSnooze(getExecutor(), {
        contactId,
        uid: newUid(),
        now: localDateTime(),
      });
      await load();
      void reconcileSchedule(getExecutor()).catch((e) =>
        Logger.error(LOG_SCOPE, "reconcile after clear-snooze failed", e),
      );
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to clear snooze", err);
      Alert.alert("Couldn't clear snooze", "Please try again.");
    }
  }, [contactId, load]);

  // Snoozed IFF snooze_until is a FUTURE local date. Both sides are bare local
  // YYYY-MM-DD (the stored string + today via formatLocalDate), so a lexicographic
  // string compare is correct — NEVER construct a Date from the stored string
  // (that reintroduces the forbidden UTC evening off-by-one; review item 7). This
  // mirrors the dashboard's bare-date snooze contract (snooze_until <= today =
  // expired).
  const isSnoozed =
    header?.snooze_until != null &&
    header.snooze_until > formatLocalDate(new Date());

  // Open the refine form for a touchpoint (LOG-01). Seed the controlled value
  // from the stored row verbatim — occurred_at flows in as-is, and the form
  // seeds its date+time dialogs via parseLocalDateTime (time-of-day preserved),
  // NOT types.ts parseDate.
  const openEdit = useCallback((tp: TimelineTouchpoint) => {
    setEditingId(tp.id);
    setRefineValue({
      occurredAt: tp.occurred_at,
      channel: tp.channel,
      direction: tp.direction,
      connected: tp.connected,
      quality: tp.quality,
      note: tp.note,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setRefineValue(null);
  }, []);

  // Save the refine edit through the SINGLE full edit path (editTouchpointFull),
  // which always recomputes recency, then refresh every derived surface through
  // the SINGLE unified load() — an in-place edit does NOT re-fire useFocusEffect,
  // so a partial reload would leave status/gravity/intensity stale.
  const saveEdit = useCallback(async () => {
    if (editingId === null || !refineValue || savingEdit) {
      return;
    }
    setSavingEdit(true);
    try {
      await editTouchpointFull(getExecutor(), {
        interactionId: editingId,
        contactId,
        now: localDateTime(),
        occurredAt: refineValue.occurredAt,
        channel: refineValue.channel,
        direction: refineValue.direction,
        connected: refineValue.connected,
        quality: refineValue.quality,
        note: refineValue.note,
      });
      setEditingId(null);
      setRefineValue(null);
      await load();
      // A touchpoint edit recomputes recency → derived status may change.
      notifyWidgetDataChanged();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to save touchpoint edit", err);
      Alert.alert("Couldn't save", "Please try again.");
    } finally {
      setSavingEdit(false);
    }
  }, [editingId, refineValue, savingEdit, contactId, load]);

  // Delete a touchpoint behind a confirm whose copy states the deletion is
  // PERMANENT and unrecoverable (dossier Cluster C — no undo, no backup, no
  // server). deleteTouchpoint recomputes recency (moving it back when the newest
  // row is removed); then the SINGLE unified load() refreshes every surface.
  const doDelete = useCallback(
    (tp: TimelineTouchpoint) => {
      Alert.alert(
        "Delete this touchpoint?",
        "This permanently deletes it. There's no undo and no backup — it can't be recovered.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await deleteTouchpoint(getExecutor(), {
                    interactionId: tp.id,
                    contactId,
                    now: localDateTime(),
                  });
                  // If the deleted row was open in the refine form, close it.
                  if (editingId === tp.id) {
                    setEditingId(null);
                    setRefineValue(null);
                  }
                  await load();
                  // Deleting the newest touchpoint moves last_contact back →
                  // derived status may change on the widget.
                  notifyWidgetDataChanged();
                } catch (err) {
                  Logger.error(LOG_SCOPE, "failed to delete touchpoint", err);
                  Alert.alert("Couldn't delete", "Please try again.");
                }
              })();
            },
          },
        ],
      );
    },
    [contactId, editingId, load],
  );

  // Add a fuel item (FUEL-01) through the mutexed fuel-dao writer, then the
  // SINGLE unified load() (an in-place mutation does NOT re-fire useFocusEffect).
  // uid/createdAt/now are minted here; source='user' for a profile-typed item;
  // the draft's optionals are already NULL-normalized by FuelEditor.
  // Returns true on a successful write + reload, false on failure — FuelEditor
  // clears its draft only on true, so a failed insert keeps the user's typing
  // (review MEDIUM-3).
  const doAddFuel = useCallback(
    async (draft: FuelDraft): Promise<boolean> => {
      try {
        const stamp = localDateTime();
        await addFuel(getExecutor(), {
          uid: newUid(),
          contactId,
          kind: draft.kind,
          label: draft.label,
          text: draft.text,
          url: draft.url,
          createdAt: stamp,
          source: "user",
          now: stamp,
        });
        await load();
        // Fuel add can change the ranked fuelText shown on the widget tile.
        notifyWidgetDataChanged();
        return true;
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to add fuel", err);
        Alert.alert("Couldn't save fuel.", "Please try again.");
        return false;
      }
    },
    [contactId, load],
  );

  // Edit a fuel item (FUEL-02). FuelEditor commits ONE field at a time (blur /
  // kind-select), so pass ONLY the changed field(s) straight through as a
  // patch-scoped UPDATE (review HIGH-1) — do NOT merge onto the `fuel` render
  // snapshot, which can be stale between a write and its load() refresh and would
  // silently revert a concurrent field's just-committed edit. editFuel writes only
  // the present columns; created_at is never touched (age is stable). blank→NULL
  // normalization already happened at FuelEditor's commit boundary.
  const doEditFuel = useCallback(
    async (id: number, patch: FuelEditPatch) => {
      try {
        await editFuel(getExecutor(), {
          id,
          contactId,
          ...patch,
          now: localDateTime(),
        });
        await load();
        // Fuel edit can change the ranked fuelText shown on the widget tile.
        notifyWidgetDataChanged();
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to edit fuel", err);
        Alert.alert("Couldn't save fuel.", "Please try again.");
      }
    },
    [contactId, load],
  );

  // Confirm an AI-suggested fuel item (FUEL-06): flip source 'ai'→'manual' through
  // the mutexed confirmFuel writer, then the SINGLE unified load() (an in-place
  // mutation does NOT re-fire useFocusEffect). No ranking is computed here — after
  // load(), getRankedFuel re-reads and the now-'manual' item begins ranking. now is
  // caller-supplied local wall-clock (never toISOString).
  const doConfirmFuel = useCallback(
    async (id: number) => {
      try {
        await confirmFuel(getExecutor(), {
          id,
          contactId,
          now: localDateTime(),
        });
        await load();
        // Confirming an AI fuel item lets it begin ranking → widget fuelText may change.
        notifyWidgetDataChanged();
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to confirm fuel", err);
        Alert.alert("Couldn't save fuel.", "Please try again.");
      }
    },
    [contactId, load],
  );

  // Delete a fuel item behind the permanent-delete confirm (the same "no undo, no
  // backup" copy shipped for touchpoint deletion — the guarantee is identical).
  const doDeleteFuel = useCallback(
    (id: number) => {
      Alert.alert(
        "Delete this fuel item?",
        "This permanently deletes it. There's no undo and no backup — it can't be recovered.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await deleteFuel(getExecutor(), {
                    id,
                    contactId,
                    now: localDateTime(),
                  });
                  await load();
                  // Deleting fuel can change the ranked fuelText on the widget tile.
                  notifyWidgetDataChanged();
                } catch (err) {
                  Logger.error(LOG_SCOPE, "failed to delete fuel", err);
                  Alert.alert("Couldn't delete.", "Please try again.");
                }
              })();
            },
          },
        ],
      );
    },
    [contactId, load],
  );

  return (
    <ScrollView
      testID="contact-profile-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          testID="contact-profile-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>

        <Avatar
          photo={header?.photo ?? null}
          name={header?.name ?? ""}
          contactId={contactId}
          cacheBust={header?.modified_at}
          size={64}
        />

        <Text
          testID="contact-profile-name"
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          {header?.name ?? ""}
        </Text>

        {/* Favourite star toggle (DASH-06): marks/clears favourite_rank through
            the guarded DAO, reversible → no confirmation. The marked star uses
            colors.accent (OD-2 provisional favourite token — the owner may
            substitute a dedicated favourite hue/glyph). The accessibilityLabel
            flips with the persisted state so uiautomator UAT can read it. */}
        {lifecycle.showCadenceTreatment ? (
          <Pressable
            testID="contact-profile-favourite-star"
            accessibilityRole="button"
            accessibilityLabel={
              isFavourite ? "Remove favourite" : "Mark favourite"
            }
            accessibilityState={{ selected: isFavourite }}
            onPress={() => void doToggleFavourite()}
            style={styles.favouriteStar}
          >
            <Text
              style={[
                styles.favouriteGlyph,
                { color: isFavourite ? colors.accent : colors.textSecondary },
              ]}
            >
              {isFavourite ? "★" : "☆"}
            </Text>
          </Pressable>
        ) : null}

        <OverflowMenu
          actions={[
            {
              label: "Merge with another contact",
              testID: "contact-profile-merge",
              onPress: () =>
                navigation.navigate("SurvivorSelect", {
                  firstContactId: contactId,
                }),
            },
            ...(hasActiveExternalLink
              ? [
                  {
                    label: "Update from Contacts",
                    testID: "contact-profile-update-from-contacts",
                    onPress: () =>
                      navigation.navigate("ReconcileDetail", { contactId }),
                  },
                ]
              : []),
            {
              label: "Archive",
              testID: "contact-profile-archive",
              onPress: () => void doArchive(),
            },
          ]}
        />
      </View>

      {!reachRoutes.hidden ? (
        <Pressable
          testID="contact-profile-reach-out"
          accessibilityRole="button"
          accessibilityLabel={`Reach out to ${header?.name ?? ""}`}
          onPress={() => setReachOutOpen(true)}
          style={[
            styles.logContact,
            { backgroundColor: colors.accent, borderColor: colors.accent },
          ]}
        >
          <Text style={[styles.logContactText, { color: colors.background }]}>
            Reach out
          </Text>
        </Pressable>
      ) : null}

      {/* Rogue status label + reason — in-app only (never a notification),
          styled through the themed `colors.rogue` token (a status hue, NOT
          danger). Nothing renders for a never-contacted contact (status null)
          or any non-rogue status. */}
      {lifecycle.showCadenceTreatment && status?.status === "rogue" ? (
        <Text testID="contact-profile-rogue" style={styles.rogueLabel}>
          <Text style={{ color: colors.rogue }}>
            No longer in a working orbit
          </Text>
          {rogueReasonText(status.reason) ? (
            <Text style={{ color: colors.textSecondary }}>
              {` · ${rogueReasonText(status.reason)}`}
            </Text>
          ) : null}
        </Text>
      ) : null}

      {lifecycle.kind !== "bound" ? (
        <View
          testID="contact-profile-unbound-panel"
          style={[
            styles.lifecyclePanel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[styles.lifecycleHeading, { color: colors.textPrimary }]}
          >
            Unbound
          </Text>
          <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
            This contact isn’t in your active orbit. Their details and history
            are still here.
          </Text>
          {lifecycle.showFrequencyPicker ? (
            <FrequencyPicker
              testID="contact-profile-bind-frequency"
              value={bindIntervalDays}
              onChange={setBindIntervalDays}
              onValidityChange={setBindIntervalValid}
            />
          ) : null}
          <Pressable
            testID="contact-profile-bind"
            accessibilityRole="button"
            accessibilityLabel="Bind contact"
            accessibilityState={{
              disabled: !canStartLifecycleTransition({
                pending: transitioning,
                bindEnabled:
                  lifecycle.bindEnabled ||
                  (lifecycle.showFrequencyPicker && bindIntervalValid),
              }),
            }}
            disabled={
              !canStartLifecycleTransition({
                pending: transitioning,
                bindEnabled:
                  lifecycle.bindEnabled ||
                  (lifecycle.showFrequencyPicker && bindIntervalValid),
              })
            }
            onPress={() => void doLifecycleTransition("bind")}
            style={[
              styles.lifecycleAction,
              { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
          >
            <Text style={{ color: colors.background, fontWeight: "700" }}>
              Bind contact
            </Text>
          </Pressable>
        </View>
      ) : null}

      {lifecycle.kind === "bound" ? (
        <Pressable
          testID="contact-profile-unbind"
          accessibilityRole="button"
          accessibilityLabel="Unbind contact"
          accessibilityState={{ disabled: transitioning }}
          disabled={transitioning}
          onPress={confirmUnbind}
          style={[
            styles.lifecycleOutlineAction,
            { borderColor: colors.border },
          ]}
        >
          <Text style={{ color: colors.textPrimary }}>Unbind contact</Text>
        </Pressable>
      ) : null}

      {lifecycle.showCadenceTreatment && header?.rarely_responds === 1 ? (
        <Text
          testID="contact-profile-rarely-responds"
          style={[styles.rarelyLabel, { color: colors.textSecondary }]}
        >
          Rarely responds · attempts don't reset the orbit
        </Text>
      ) : null}

      <Pressable
        testID="contact-profile-add-details"
        accessibilityRole="button"
        accessibilityLabel="Add details"
        onPress={() => navigation.navigate("Edit", { contactId })}
        style={styles.addDetails}
      >
        <Text style={[styles.addDetailsText, { color: colors.accent }]}>
          Add details
        </Text>
      </Pressable>

      {visibleDefsForProfile(fieldDefs, customValues).length > 0 ? (
        <View
          testID="contact-profile-custom-fields"
          style={styles.customFields}
        >
          <Text
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Details
          </Text>
          {visibleDefsForProfile(fieldDefs, customValues).map((field) => (
            <CustomFieldValue
              key={field.id}
              testID={`contact-profile-custom-${field.col_name}`}
              field={field}
              value={customValues[field.col_name] ?? null}
              onFix={() => navigation.navigate("Edit", { contactId })}
            />
          ))}
        </View>
      ) : null}

      {profileMethodGroups(methodGroups).map((group) => (
        <View
          key={group.type}
          testID={`contact-profile-methods-${group.type}`}
          style={styles.methods}
        >
          <Text
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            {group.title}
          </Text>
          {group.rows.map((method) => (
            <View
              key={method.id}
              testID={`contact-profile-method-${method.id}`}
              accessibilityLabel={method.accessibilityLabel}
              style={[
                styles.methodCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text
                style={[styles.methodLabel, { color: colors.textSecondary }]}
              >
                {method.label}
              </Text>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.methodValue, { color: colors.textPrimary }]}
              >
                {method.displayValue}
              </Text>
              {method.isPrimary ? (
                <Text
                  style={[
                    styles.methodPrimary,
                    { color: colors.textSecondary },
                  ]}
                >
                  Primary
                </Text>
              ) : null}
              {method.extension ? (
                <Text
                  style={[
                    styles.methodExtension,
                    { color: colors.textSecondary },
                  ]}
                >
                  Ext. {method.extension}
                </Text>
              ) : null}
              {method.helper ? (
                <Text style={[styles.methodHelper, { color: colors.danger }]}>
                  {method.helper}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}

      {/* "Message" (CMP-02): opens the entry-agnostic compose surface for this
          contact. Filled-accent primary directly ABOVE "Log contact" — per the
          UI-SPEC owner-taste note both ship as filled-accent primaries; the
          existing "Log contact" styling is NOT changed (demoting one for hierarchy
          is an owner call). Serializable { contactId } param only. */}
      <Pressable
        testID="contact-profile-message"
        accessibilityRole="button"
        accessibilityLabel={`Message ${header?.name ?? ""}`}
        onPress={() => navigation.navigate("Compose", { contactId })}
        style={[
          styles.logContact,
          { backgroundColor: colors.accent, borderColor: colors.accent },
        ]}
      >
        <Text style={[styles.logContactText, { color: colors.background }]}>
          Message
        </Text>
      </Pressable>

      {/* "AI draft" (AI-02) — additive entry, shown only when a provider is
          configured. Navigates to the SAME entry-agnostic Compose surface with a
          serializable, consume-once `requestAiSuggestion` intent so Compose (the
          sole editable-draft surface, which holds the real contact-specific
          prompt + first-send acknowledgement) auto-starts one suggestion. Never a
          parallel result surface. Accent-OUTLINE (secondary) so the filled
          "Message"/"Log contact" primaries keep their hierarchy. */}
      {aiConfigured ? (
        <Pressable
          testID="contact-profile-ai-draft"
          accessibilityRole="button"
          accessibilityLabel={`Draft a message with AI for ${header?.name ?? ""}`}
          onPress={() =>
            navigation.navigate("Compose", {
              contactId,
              requestAiSuggestion: true,
            })
          }
          style={[
            styles.logContact,
            { backgroundColor: colors.background, borderColor: colors.accent },
          ]}
        >
          <Text style={[styles.logContactText, { color: colors.accent }]}>
            AI draft
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        testID="contact-profile-log-contact"
        accessibilityRole="button"
        accessibilityLabel="Log contact"
        accessibilityState={{ disabled: logging }}
        disabled={logging}
        onPress={() => void doLogContact()}
        style={[
          styles.logContact,
          {
            backgroundColor: logging ? colors.surface : colors.accent,
            borderColor: logging ? colors.border : colors.accent,
          },
        ]}
      >
        <Text
          style={[
            styles.logContactText,
            { color: logging ? colors.textSecondary : colors.background },
          ]}
        >
          Log contact
        </Text>
      </Pressable>

      {/* Snooze reminders (NOTIF-03) — three tap-to-snooze presets in the
          FilterChipRow filled-accent idiom (rendered in the unselected state:
          surface fill + border + textSecondary label — none is a persisted
          selection, they are actions). Each writes snooze_until through the
          mutexed snooze-dao then re-drives the OS schedule (item B). A "Snoozed
          until {date}" status + Clear affordance appear only while a future
          snooze is active. Reversible, no confirmation, no danger token — the
          block is state-neutral (UI-SPEC §3). */}
      {lifecycle.showCadenceTreatment ? (
        <View testID="contact-profile-snooze" style={styles.snooze}>
          <Text
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Snooze reminders
          </Text>
          <View style={styles.snoozeChips}>
            {SNOOZE_PRESETS.map(({ preset, testID, label }) => (
              <Pressable
                key={preset}
                testID={testID}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => void doSnooze(preset)}
                style={[
                  styles.snoozeChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.snoozeChipLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {isSnoozed ? (
            <View style={styles.snoozeStatusRow}>
              {/* Render the stored YYYY-MM-DD DIRECTLY (item 7) — it is already the
                correct local date; new Date(snooze_until) would re-add the UTC
                off-by-one. */}
              <Text
                testID="contact-profile-snooze-status"
                style={[styles.snoozeStatus, { color: colors.textSecondary }]}
              >
                Snoozed until {header?.snooze_until}
              </Text>
              <Pressable
                testID="contact-profile-snooze-clear"
                accessibilityRole="button"
                accessibilityLabel="Clear snooze"
                onPress={() => void doClearSnooze()}
                style={[styles.snoozeClear, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textSecondary }}>
                  Clear snooze
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Impact section — gravity + intensity (LOG-03), both derived-never-stored
          and PROFILE-ONLY (Cluster G: nothing log-derived on the dashboard card).
          The two are presented SIDE BY SIDE, never blended into one score:
          gravity is the accumulated-familiarity tier (named, coloured); intensity
          is a NEUTRAL this-period rate + trailing cadence (text tokens only).
          Hidden until there is interaction history. */}
      {gravity ? (
        <View testID="contact-profile-impact" style={styles.impact}>
          <GravityBar
            tierName={gravity.tierName}
            tierIndex={gravity.tierIndex}
            tierCount={gravity.tierCount}
          />
          {lifecycle.showCadenceTreatment && intensity ? (
            <IntensityLine intensity={intensity} />
          ) : null}
        </View>
      ) : null}

      {/* Conversational Fuel (FUEL-01/02) — the controlled per-item editor:
          add/edit/delete across the 5 kinds + optional label/url, off_limits
          editable and marked private here. Every mutation routes through
          fuel-dao then the SINGLE unified load(). */}
      <View testID="contact-profile-fuel" style={styles.fuel}>
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          Conversational Fuel
        </Text>
        {/* The one ranked projection (FUEL-03): the top-ranked item's text as a
            promoted line above the editor. Renders nothing when there is no
            rankable fuel; rankedFuel[0] is guaranteed non-blank by getRankedFuel,
            so the strip never renders empty over a real row. Refreshes with every
            fuel mutation via the SINGLE unified load() — no second ranking here. */}
        <RankedFuelLine
          testID="contact-profile-fuel-ranked"
          text={rankedFuel[0]?.text}
        />
        <FuelEditor
          testID="contact-profile-fuel-editor"
          items={fuel}
          now={localDateTime()}
          onAdd={doAddFuel}
          onEdit={(id, patch) => void doEditFuel(id, patch)}
          onDelete={doDeleteFuel}
          onConfirm={(id) => void doConfirmFuel(id)}
        />
      </View>

      {/* The real interleaved timeline (LOG-02 read half): touchpoints (editable
          next plan) + read-only events, newest-first. */}
      <View testID="contact-profile-timeline" style={styles.timeline}>
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          Timeline
        </Text>
        {timeline.length === 0 ? (
          <Text
            testID="contact-profile-timeline-empty"
            style={[styles.sectionBody, { color: colors.textSecondary }]}
          >
            No touchpoints yet
          </Text>
        ) : (
          timeline.map((item) => (
            <TimelineRow
              key={`${item.kind}-${item.id}`}
              item={item}
              // Edit + delete affordances on touchpoints ONLY — events stay
              // read-only (no callbacks passed).
              onEdit={
                item.kind === "touchpoint" ? () => openEdit(item) : undefined
              }
              onDelete={
                item.kind === "touchpoint" ? () => doDelete(item) : undefined
              }
            />
          ))
        )}
      </View>

      {editingId !== null && refineValue ? (
        <View
          testID="contact-profile-refine"
          style={[
            styles.refinePanel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Refine touchpoint
          </Text>
          <TouchpointRefineForm
            value={refineValue}
            onChange={setRefineValue}
            now={localDateTime()}
          />
          <View style={styles.refineActions}>
            <Pressable
              testID="contact-profile-refine-cancel"
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={cancelEdit}
              style={[styles.refineBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
            <Pressable
              testID="contact-profile-refine-save"
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityState={{ disabled: savingEdit }}
              disabled={savingEdit}
              onPress={() => void saveEdit()}
              style={[
                styles.refineBtn,
                {
                  backgroundColor: savingEdit ? colors.surface : colors.accent,
                  borderColor: savingEdit ? colors.border : colors.accent,
                },
              ]}
            >
              <Text
                style={{
                  color: savingEdit ? colors.textSecondary : colors.background,
                  fontWeight: "700",
                }}
              >
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <ReachOutRouter
        visible={reachOutOpen}
        contactId={contactId}
        routes={reachRoutes}
        assistEnabled={assistEnabled}
        onClose={() => setReachOutOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
  },
  favouriteStar: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  favouriteGlyph: {
    fontSize: 24,
  },
  lifecyclePanel: { gap: 12, borderWidth: 1, borderRadius: 12, padding: 16 },
  lifecycleHeading: { fontSize: 18, fontWeight: "700" },
  lifecycleAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
  },
  lifecycleOutlineAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
  },
  rogueLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  rarelyLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  addDetails: {
    minHeight: 44,
    justifyContent: "center",
  },
  addDetailsText: {
    fontSize: 16,
    fontWeight: "600",
  },
  logContact: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  logContactText: {
    fontSize: 16,
    fontWeight: "700",
  },
  snooze: {
    gap: 8,
  },
  snoozeChips: {
    flexDirection: "row",
    gap: 8,
  },
  snoozeChip: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  snoozeChipLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  snoozeStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  snoozeStatus: {
    fontSize: 13,
    fontWeight: "600",
  },
  snoozeClear: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  impact: {
    gap: 8,
  },
  customFields: {
    gap: 8,
  },
  methods: {
    gap: 8,
  },
  methodCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    gap: 4,
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  methodValue: {
    fontSize: 15,
    fontWeight: "400",
  },
  methodPrimary: {
    fontSize: 13,
    fontWeight: "600",
  },
  methodExtension: {
    fontSize: 13,
    fontWeight: "400",
  },
  methodHelper: {
    fontSize: 13,
    fontWeight: "600",
  },
  fuel: {
    gap: 8,
  },
  timeline: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionBody: {
    fontSize: 15,
  },
  refinePanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  refineActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  refineBtn: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
