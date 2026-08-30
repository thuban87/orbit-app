import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getCountries } from "libphonenumber-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { requestPinWidget } from "react-native-android-widget";
import {
  loadCachedCatalog,
  refreshModelCatalog,
} from "@/ai/model-catalog-cache";
import type { ModelCatalog } from "@/ai/model-catalog-filter";
import { createFileCatalogStorage } from "@/ai/model-catalog-storage";
import {
  modelsFor,
  resolveActiveCatalog,
  SEED_CATALOG,
} from "@/ai/model-registry";
import { PhotoSourcePicker } from "@/components/PhotoSourcePicker";
import {
  type AppSettings,
  type AppSettingsPatch,
  getAppSettings,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import { getProfile } from "@/db/profile-dao";
import { listSunCandidates, type SunCandidate } from "@/db/sun-picker-read";
import { sunOccupantIsSelf } from "@/logic/sun-occupant-logic";
import type { RootStackParamList } from "@/navigation/types";
import { AiService } from "@/services/AiService";
import { aiKeyStore } from "@/services/ai-key-store";
import {
  AI_PROVIDER_IDS,
  type AiCloudProviderId,
  type AiProviderId,
} from "@/services/ai-types";
import { getDeviceRegion } from "@/services/device-region";
import { startContactImport } from "@/services/import/start-contact-import";
import { reconcileDigestSchedule } from "@/services/notifications/digest-schedule";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import {
  getNotificationPermission,
  requestNotificationPermission,
} from "@/services/notifications/permission";
import { useAiModelPrefs } from "@/stores/ai-model-prefs-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { pickContacts } from "../../modules/orbit-contact-picker";
import { contactImportMode } from "./use-contact-import-mode";
import { pinResultCopy } from "./settings-add-widget";
import {
  buildAiSettingsPatch,
  CUSTOM_RETENTION_CAVEAT,
  discoverModelsForField,
  type ModelFieldState,
  providerDisplayName,
  validateEndpointForSave,
} from "./settings-ai-logic";
import { phoneRegionValueLabel } from "./settings-lifecycle-logic";
import { phoneRegionOverridePatch } from "./settings-region-logic";

const LOG_SCOPE = "settings-screen";

/** Which time control's native picker is open (null = none). */
type ActivePicker = "delivery" | "quiet-start" | "quiet-end" | null;

const regionNames =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const PHONE_REGIONS = getCountries()
  .map((code) => ({ code, name: regionNames?.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Format a 0-23 hour as a "h:MM AM/PM" wall-clock label (e.g. 9 → "9:00 AM"). */
function formatHour(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${period}`;
}

/** A Date seeded to today at the given 0-23 hour — the time picker's initial value. */
function seedForHour(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * SettingsScreen — the low-traffic host for the two CRUD-05 "separate homes":
 * Custom Fields (relocated off the Phase-3 `HomeScreen` dependency-free route)
 * and Archived contacts (the distinct archive home, no count badge — the
 * Archived screen states its count when opened, CONTEXT Area 1).
 *
 * PLUS the Phase-11 Notifications section (NOTIF-05): the master toggle IS the
 * value-moment `POST_NOTIFICATIONS` affordance, the decay/birthday/lock-screen
 * toggles gate scheduling, and the owner's user-tunable delivery hour + quiet
 * window (the reversal) get their tappable time controls. Every control reads/
 * writes `app_settings` via the DAO and fires `reconcileSchedule` after a change
 * so the OS's scheduled set updates immediately (no wait for next launch).
 *
 * TWO base rows, not three: UI-SPEC:192's "Custom Fields" and "Reachability
 * route" name the SAME `CustomFieldsScreen` (there is no distinct Reachability
 * screen on disk), so a phantom third row would navigate nowhere. See the Plan
 * 04-01 Settings-rows reconciliation.
 *
 * Mirrors the `CustomFieldsScreen` chrome (ScrollView root `background`, header
 * with a `goBack` Back control, title 24/700). Every colour resolves through
 * `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Self-record photo seed. `name` is nullable (the id=1 seed row carries no name
  // until a self-name editor ships), so a stable "You" fallback below keeps the
  // initials avatar deterministic ("Y") rather than a permanently blank swatch.
  const [selfPhoto, setSelfPhoto] = useState<string | null>(null);
  const [selfName, setSelfName] = useState<string | null>(null);
  const [selfModifiedAt, setSelfModifiedAt] = useState<string | undefined>(
    undefined,
  );

  // Notification settings mirror app_settings; permission is READ FRESH on focus
  // (OS-owned, revocable between opens). `degraded` renders the non-nagging note
  // when the master is on but the OS permission is denied — text only, never a
  // re-prompt (orchestrator pick 6 / T-11-PERM).
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [phoneRegionPickerOpen, setPhoneRegionPickerOpen] = useState(false);
  const [phoneRegionSearch, setPhoneRegionSearch] = useState("");

  const onImportContacts = useCallback(async () => {
    try {
      const currentSettings = await getAppSettings(getExecutor());
      await startContactImport({
        mode: contactImportMode(),
        exec: getExecutor(),
        effectivePhoneRegion:
          currentSettings.phoneRegionOverride ?? getDeviceRegion(),
        now: localDateTime(),
        pick: () => pickContacts({ multiple: true }),
        navigate: navigation.navigate,
      });
    } catch {
      Alert.alert("Couldn't import contacts", "Please try again.");
    }
  }, [navigation]);

  // The "Add Orbit widget" fallback copy — null while there is nothing to show,
  // set to the UI-SPEC fallback string when requestPinWidget can't pin (unsupported
  // launcher / API < 26 / a rejected request). Surfaced inline under the row.
  const [addWidgetCopy, setAddWidgetCopy] = useState<string | null>(null);

  // --- Optional-AI section (AI-01 / AI-03 / AI-04) --------------------------
  // Non-secret provider config edited locally and persisted on "Save" via the
  // DAO; the API key NEVER lives in this state as a stored value — it is entered
  // transiently and routed straight to `ai-key-store` (SecureStore). `aiKeySet`
  // is a boolean presence flag only (the key value is never read back or rendered).
  const [aiProvider, setAiProvider] = useState<AiProviderId>("none");
  const [aiModel, setAiModel] = useState("");
  const [aiCustomEndpoint, setAiCustomEndpoint] = useState("");
  const [aiCustomModel, setAiCustomModel] = useState("");
  const [aiPromptTemplate, setAiPromptTemplate] = useState("");
  const [aiKeyInput, setAiKeyInput] = useState("");
  const [aiKeySet, setAiKeySet] = useState(false);
  const [aiModelField, setAiModelField] = useState<ModelFieldState>({
    kind: "manual",
  });
  // Discover + free-text live under an "Advanced" disclosure; the curated chips
  // are the default picker (D-03). Collapsed by default, reset on provider switch.
  const [aiModelAdvancedOpen, setAiModelAdvancedOpen] = useState(false);
  const [aiEndpointError, setAiEndpointError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  // The LiteLLM-sourced model catalog the picker renders from (14-10). Starts on
  // the BUNDLED seed (offline/first-run) and is overridden by the on-device cache
  // once loaded/refreshed. `modelScope` (Frontier only / All models) is a persisted
  // device-local UI preference in the AsyncStorage prefs store, not app_settings.
  const [modelCatalog, setModelCatalog] = useState<ModelCatalog>(SEED_CATALOG);
  const [aiRefreshing, setAiRefreshing] = useState(false);
  const modelScope = useAiModelPrefs((s) => s.modelScope);
  const setModelScope = useAiModelPrefs((s) => s.setModelScope);
  // The device FS-backed cache store — a stable instance for the screen's lifetime.
  const catalogStorage = useMemo(() => createFileCatalogStorage(), []);

  // Load the on-device catalog cache ONCE on mount. This is a LOCAL file read (no
  // network — local-first), so it is safe on a read path; a missing/corrupt cache
  // resolves to the bundled seed. The network refresh is user-instigated ONLY (the
  // "Refresh models" tap below), never here.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await loadCachedCatalog(catalogStorage);
      if (!cancelled && cached) {
        setModelCatalog(resolveActiveCatalog(cached));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogStorage]);

  // The AI service is stateless between calls; a single instance suffices for
  // on-demand model discovery. It reads keys through the app-wide `aiKeyStore`.
  const aiService = useMemo(() => new AiService(), []);

  // "Your orbit" section (ORR-05 / relocated ORR-06). `selfSunColour` is the raw
  // stored self-star hex or NULL; NULL resolves to `starPalette[0]` (gold) at
  // RENDER — no stored hex default (the DAO cannot import theme). Loaded on focus.
  const [selfSunColour, setSelfSunColour] = useState<string | null>(null);

  // The centre occupant (relocated ORR-06): the raw stored id (NULL = self), the
  // RESOLVED display name (with the M4 archived/missing→"Me" fallback), the
  // favourites-first candidate list, and whether the picker modal is open.
  const [sunContactId, setSunContactId] = useState<number | null>(null);
  const [sunOccupantName, setSunOccupantName] = useState("Me");
  const [sunCandidates, setSunCandidates] = useState<SunCandidate[]>([]);
  const [sunPickerOpen, setSunPickerOpen] = useState(false);

  // Reload the self record so a set/remove made on the crop screen refreshes when
  // it goBack()s here (mirrors ContactProfileScreen's reload-on-focus). The
  // sub-second same-path replace is closed elsewhere: the crop screen's profile
  // branch calls bumpPhotoCacheBust(profilePhotoRelPath()), which Avatar folds
  // into its cache key — so this only needs the coarse `modified_at` cache-bust.
  const reloadProfile = useCallback(async () => {
    try {
      const profile = await getProfile(getExecutor());
      setSelfPhoto(profile?.photo ?? null);
      setSelfName(profile?.name ?? null);
      setSelfModifiedAt(profile?.modified_at);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load self profile", err);
    }
  }, []);

  // Load app_settings + the current OS permission status. If the master is on but
  // the OS later revoked permission (out-of-app), surface the degraded note so the
  // user understands why nothing fires — still no re-prompt.
  const reloadNotifications = useCallback(async () => {
    try {
      const next = await getAppSettings(getExecutor());
      setSettings(next);
      if (next.notificationsEnabled === 1) {
        const perm = await getNotificationPermission();
        setDegraded(!perm.granted);
      } else {
        setDegraded(false);
      }
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load notification settings", err);
    }
  }, []);

  // Load the "Your orbit" settings (self-star colour, and — added in the sun
  // picker below — the centre occupant). Read on focus so a change made
  // elsewhere refreshes when this screen regains focus, mirroring reloadProfile.
  const reloadOrbit = useCallback(async () => {
    const exec = getExecutor();
    try {
      const next = await getAppSettings(exec);
      setSelfSunColour(next.selfSunColour);
      setSunContactId(next.sunContactId);
      setSunCandidates(await listSunCandidates(exec));
      // M4: resolve the occupant name through the SAME self-fallback predicate the
      // canvas uses (sunOccupantIsSelf, 13-05) so Settings and the orrery can never
      // disagree about a hidden occupant. NULL → "Me"; a stored id whose contact is
      // missing OR archived also shows "Me"; else the live contact's name.
      const header =
        next.sunContactId === null
          ? null
          : await getContactHeader(exec, next.sunContactId);
      const isSelf = sunOccupantIsSelf({
        sunContactId: next.sunContactId,
        occupant: header
          ? {
              archived: header.archived_at !== null,
              trackingEnabled: header.trackingEnabled,
            }
          : null,
      });
      setSunOccupantName(isSelf ? "Me" : (header?.name ?? "Me"));
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load orbit settings", err);
    }
  }, []);

  // Load the non-secret AI config on focus. The API key is NOT read as a value —
  // only its PRESENCE is probed (via `getKey() !== null`) so the UI can show
  // "key saved" without ever rendering or serializing the credential (T-14-12).
  const reloadAi = useCallback(async () => {
    try {
      const next = await getAppSettings(getExecutor());
      setAiProvider(next.aiProvider);
      setAiModel(next.aiModel);
      setAiCustomEndpoint(next.aiCustomEndpoint);
      setAiCustomModel(next.aiCustomModel);
      setAiPromptTemplate(next.aiPromptTemplate);
      setAiEndpointError(null);
      // Presence-only key probe for the active cloud provider (never the value).
      if (next.aiProvider !== "none") {
        const key = await aiKeyStore.getKey(next.aiProvider);
        setAiKeySet(key !== null);
      } else {
        setAiKeySet(false);
      }
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load AI settings", err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reloadProfile();
      void reloadNotifications();
      void reloadOrbit();
      void reloadAi();
    }, [reloadProfile, reloadNotifications, reloadOrbit, reloadAi]),
  );

  // M6: persist the tapped star token through the same try/catch + Logger.error
  // posture as `persist` — if a future design pass seeds a non-`#RRGGBB`
  // starPalette token the DAO validator throws, which is caught and logged here
  // rather than escaping as an unhandled rejection. Reloads from the write.
  const onPickStarColour = useCallback(
    async (token: string) => {
      try {
        await updateAppSettings(
          getExecutor(),
          { selfSunColour: token },
          localDateTime(),
        );
        await reloadOrbit();
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to persist star colour", err);
      }
    },
    [reloadOrbit],
  );

  // M6: persist the chosen centre occupant (a candidate id, or NULL for "Me")
  // through the same try/catch + Logger.error posture. Closes the picker and
  // reloads the displayed occupant from the write.
  const onPickSunOccupant = useCallback(
    async (id: number | null) => {
      try {
        await updateAppSettings(
          getExecutor(),
          { sunContactId: id },
          localDateTime(),
        );
        setSunPickerOpen(false);
        await reloadOrbit();
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to persist sun occupant", err);
      }
    },
    [reloadOrbit],
  );

  // The picker list: a synthetic "Me" (NULL id) first, then the favourites-first
  // candidates (already archived-excluded by listSunCandidates). This IS ORR-06's
  // "assign the sun" — RELOCATED to Settings by owner decision, NOT an orrery
  // gesture (the orrery long-press was rejected). Do not read the absence of an
  // orrery sun-assignment gesture as an ORR-06 gap (L10 doc-sync pointer).
  const sunOptions: Array<{ id: number | null; name: string }> = [
    { id: null, name: "Me" },
    ...sunCandidates.map((c) => ({ id: c.id as number | null, name: c.name })),
  ];

  // Persist a patch to app_settings then fire-and-forget a reconcile so the OS
  // schedule re-arms immediately (the self-coordinating reconcile coalesces
  // concurrent calls). Local state is refreshed from the write's return read.
  const persist = useCallback(async (patch: AppSettingsPatch) => {
    const exec = getExecutor();
    try {
      await updateAppSettings(exec, patch, localDateTime());
      const next = await getAppSettings(exec);
      setSettings(next);
      void reconcileSchedule(exec);
      // Fold the digest reconcile into the SHARED post-write path (review H1 /
      // Pitfall 7): master ON/OFF, the delivery-hour picker, AND the digest
      // toggle all route through `persist`, so every write that can affect the
      // WEEKLY trigger arms/cancels/re-times it synchronously — not only the
      // digest Switch, and not only at next launch. reconcileDigestSchedule
      // re-reads settings fresh, is idempotent, and is defer-one guarded, so
      // running it on every settings write is harmless (a quiet-window-only
      // change reconciles to "matching -> leave").
      void reconcileDigestSchedule(exec);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to persist notification setting", err);
    }
  }, []);

  const savePhoneRegionOverride = useCallback(
    async (input: string): Promise<boolean> => {
      try {
        await updateAppSettings(
          getExecutor(),
          phoneRegionOverridePatch(input),
          localDateTime(),
        );
        await reloadNotifications();
        return true;
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to persist phone region override", err);
        return false;
      }
    },
    [reloadNotifications],
  );

  const onSelectPhoneRegion = useCallback(
    async (region: string) => {
      if (await savePhoneRegionOverride(region)) {
        setPhoneRegionPickerOpen(false);
        setPhoneRegionSearch("");
      }
    },
    [savePhoneRegionOverride],
  );

  const filteredPhoneRegions = useMemo(() => {
    const term = phoneRegionSearch.trim().toLocaleLowerCase();
    if (term === "") return PHONE_REGIONS;
    return PHONE_REGIONS.filter(
      (region) =>
        region.code.toLocaleLowerCase().includes(term) ||
        region.name.toLocaleLowerCase().includes(term),
    );
  }, [phoneRegionSearch]);

  const masterOn = settings?.notificationsEnabled === 1;

  // Master toggle = the value-moment permission affordance. Flipping ON requests
  // POST_NOTIFICATIONS at that moment: granted → persist enabled + reconcile;
  // denied → keep master off and show the degraded note once (no re-prompt).
  const onToggleMaster = useCallback(
    async (on: boolean) => {
      if (on) {
        const result = await requestNotificationPermission();
        if (result.granted) {
          setDegraded(false);
          await persist({ notificationsEnabled: 1 });
        } else {
          // Denial reverts master to off (never persisted on) + degraded note.
          setDegraded(true);
        }
      } else {
        setDegraded(false);
        await persist({ notificationsEnabled: 0 });
      }
    },
    [persist],
  );

  // Time-picker pick handler. Extract the chosen hour (0-23) and persist it to the
  // field the open row owns — the DAO re-validates the 0-23 bound (T-11-05) — then
  // reconcile. Android dismiss/cancel (event.type !== "set") keeps the prior value.
  const onPickTime = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      const which = activePicker;
      setActivePicker(null);
      if (event.type !== "set" || !date || which === null) {
        return;
      }
      const hour = date.getHours();
      const field: AppSettingsPatch =
        which === "delivery"
          ? { deliveryHour: hour }
          : which === "quiet-start"
            ? { quietStartHour: hour }
            : { quietEndHour: hour };
      void persist(field);
    },
    [activePicker, persist],
  );

  const pickerSeedHour =
    activePicker === "delivery"
      ? (settings?.deliveryHour ?? 9)
      : activePicker === "quiet-start"
        ? (settings?.quietStartHour ?? 21)
        : (settings?.quietEndHour ?? 8);

  // "Add Orbit widget": open the launcher's native pin prompt. requestPinWidget
  // resolves false on an unsupported launcher / API < 26; a REJECTED promise is
  // caught and mapped to false so it is treated identically (no crash, no dead
  // button, no unhandled rejection — Codex MED). The pure pinResultCopy decides
  // the copy: null (accepted → nothing to show) or the verbatim fallback string.
  // The live pin prompt is a device-UAT (12-08); the provider must be prebuilt for
  // the name to resolve (Assumption A5).
  const onAddWidget = useCallback(async () => {
    let accepted = false;
    try {
      accepted = await requestPinWidget({ widgetName: "OrbitFavourites" });
    } catch (err) {
      Logger.error(LOG_SCOPE, "requestPinWidget rejected", err);
      accepted = false;
    }
    setAddWidgetCopy(pinResultCopy(accepted));
  }, []);

  // Switch the active provider locally. Reset the discovered model list (it is
  // provider-specific) and re-probe the key presence for the new provider. This
  // does not persist on its own — "Save AI settings" writes the config.
  const onSelectAiProvider = useCallback(async (provider: AiProviderId) => {
    setAiProvider(provider);
    setAiModelField({ kind: "manual" });
    setAiModelAdvancedOpen(false);
    setAiStatus(null);
    setAiEndpointError(null);
    if (provider !== "none") {
      const key = await aiKeyStore.getKey(provider);
      setAiKeySet(key !== null);
    } else {
      setAiKeySet(false);
    }
  }, []);

  // On-demand model discovery. Advisory only — any failure (or Custom, which is
  // always free-text) falls back to manual entry via the shared logic helper.
  const onDiscoverAiModels = useCallback(async () => {
    if (aiProvider === "none") return;
    setAiStatus("Discovering models…");
    aiService.refreshProviders({
      aiProvider,
      aiModel,
      aiCustomEndpoint,
      aiCustomModel,
    });
    const provider = aiService.getProvider(aiProvider);
    if (!provider) {
      setAiModelField({ kind: "manual" });
      setAiStatus("Enter a model name manually.");
      return;
    }
    const state = await discoverModelsForField(aiProvider, modelScope, () =>
      provider.listModels(),
    );
    setAiModelField(state);
    setAiStatus(
      state.kind === "list"
        ? `Found ${state.models.length} model${state.models.length === 1 ? "" : "s"}.`
        : "No model list available — enter a model name manually.",
    );
  }, [
    aiProvider,
    aiModel,
    aiCustomEndpoint,
    aiCustomModel,
    aiService,
    modelScope,
  ]);

  // User-instigated "Refresh models" — the ONLY place the runtime LiteLLM fetch
  // fires (never on a read path). A PLAIN public GET (no key, no user/contact
  // data), NOT the Custom `orbit-secure-fetch` transport. On success the on-device
  // cache is written and the picker re-renders from the fresh catalog; any failure
  // degrades gracefully (the existing catalog/seed stays, free-text still works).
  const onRefreshModels = useCallback(async () => {
    setAiRefreshing(true);
    setAiStatus("Refreshing model list…");
    try {
      const fresh = await refreshModelCatalog({
        fetchImpl: (url, init) => fetch(url, init),
        storage: catalogStorage,
      });
      setModelCatalog(fresh);
      const count =
        aiProvider === "openai" ||
        aiProvider === "anthropic" ||
        aiProvider === "google"
          ? fresh.models[aiProvider].length
          : 0;
      setAiStatus(`Model list updated (${count} available).`);
    } catch (err) {
      Logger.warn(LOG_SCOPE, "model refresh failed", err);
      setAiStatus("Couldn't refresh models — using the saved list.");
    } finally {
      setAiRefreshing(false);
    }
  }, [aiProvider, catalogStorage]);

  // Persist the NON-SECRET config. The Custom endpoint is validated up front
  // (H2); an invalid one blocks the save and surfaces an inline reason. The key
  // is never part of this patch (buildAiSettingsPatch omits it — T-14-12).
  const onSaveAiConfig = useCallback(async () => {
    if (aiProvider === "custom" && aiCustomEndpoint.trim() !== "") {
      const verdict = validateEndpointForSave(aiCustomEndpoint);
      if (!verdict.ok) {
        setAiEndpointError(verdict.reason);
        setAiStatus(null);
        return;
      }
    }
    setAiEndpointError(null);
    try {
      const patch = buildAiSettingsPatch({
        provider: aiProvider,
        model: aiModel,
        customModel: aiCustomModel,
        customEndpoint: aiCustomEndpoint.trim(),
        promptTemplate: aiPromptTemplate,
      });
      await updateAppSettings(getExecutor(), patch, localDateTime());
      setAiStatus("AI settings saved.");
      await reloadAi();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to save AI settings", err);
      setAiStatus("Couldn't save AI settings.");
    }
  }, [
    aiProvider,
    aiModel,
    aiCustomModel,
    aiCustomEndpoint,
    aiPromptTemplate,
    reloadAi,
  ]);

  // Store the entered key straight into SecureStore via ai-key-store. The input
  // is cleared immediately after; the value is never persisted to app_settings
  // and never read back for rendering (T-14-12).
  const onSaveAiKey = useCallback(
    async (provider: AiCloudProviderId) => {
      const key = aiKeyInput.trim();
      if (key === "") return;
      try {
        await aiKeyStore.setKey(provider, key);
        setAiKeyInput("");
        setAiKeySet(true);
        setAiStatus("API key saved securely.");
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to save AI key", err);
        setAiStatus("Couldn't save the API key.");
      }
    },
    [aiKeyInput],
  );

  // Remove the stored key for the active cloud provider (idempotent).
  const onRemoveAiKey = useCallback(async (provider: AiCloudProviderId) => {
    try {
      await aiKeyStore.deleteKey(provider);
      setAiKeyInput("");
      setAiKeySet(false);
      setAiStatus("API key removed.");
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to remove AI key", err);
      setAiStatus("Couldn't remove the API key.");
    }
  }, []);

  return (
    <ScrollView
      testID="settings-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          testID="settings-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Settings
        </Text>
      </View>

      <View testID="settings-phone-region-section" style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionHeading, { color: colors.textSecondary }]}
        >
          Contact methods
        </Text>
        <Pressable
          testID="settings-phone-region-row"
          accessibilityRole="button"
          accessibilityLabel={`Phone number region, ${phoneRegionValueLabel(settings?.phoneRegionOverride ?? null, settings?.phoneRegionOverride ? (regionNames?.of(settings.phoneRegionOverride) ?? settings.phoneRegionOverride) : null)}`}
          accessibilityState={{ disabled: settings === null }}
          disabled={settings === null}
          onPress={() => setPhoneRegionPickerOpen(true)}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Phone number region
            </Text>
            <Text style={[styles.rowValue, { color: colors.accent }]}>
              {phoneRegionValueLabel(
                settings?.phoneRegionOverride ?? null,
                settings?.phoneRegionOverride
                  ? (regionNames?.of(settings.phoneRegionOverride) ??
                      settings.phoneRegionOverride)
                  : null,
              )}
            </Text>
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Used to format phone numbers entered without a country code.
          </Text>
        </Pressable>
      </View>

      <View
        testID="settings-contacts-integration-section"
        style={styles.section}
      >
        <Text
          accessibilityRole="header"
          style={[styles.sectionHeading, { color: colors.textSecondary }]}
        >
          Contacts Integration
        </Text>
        <Pressable
          testID="settings-import-contacts-row"
          accessibilityRole="button"
          accessibilityLabel="Import contacts"
          onPress={() => void onImportContacts()}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
            Import contacts
          </Text>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Choose people from your phone and review each import first.
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={phoneRegionPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPhoneRegionPickerOpen(false)}
      >
        <View style={styles.regionModalScrim}>
          <View
            testID="settings-phone-region-modal"
            style={[
              styles.regionModal,
              { backgroundColor: colors.surfaceElevated },
            ]}
          >
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.textPrimary }]}
            >
              Phone number region
            </Text>
            <TextInput
              testID="settings-phone-region-search"
              accessibilityLabel="Search phone number regions"
              value={phoneRegionSearch}
              onChangeText={setPhoneRegionSearch}
              placeholder="Search regions"
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              style={[
                styles.aiInput,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            />
            <Pressable
              testID="settings-phone-region-device"
              accessibilityRole="button"
              accessibilityLabel="Use device region"
              onPress={() => void onSelectPhoneRegion("")}
              style={[styles.regionOption, { borderColor: colors.border }]}
            >
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                Use device region
              </Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>
                {getDeviceRegion() ?? "Unavailable"}
              </Text>
            </Pressable>
            <FlatList
              data={filteredPhoneRegions}
              keyExtractor={(region) => region.code}
              renderItem={({ item }) => (
                <Pressable
                  testID={`settings-phone-region-${item.code}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} (${item.code})`}
                  accessibilityState={{
                    selected: settings?.phoneRegionOverride === item.code,
                  }}
                  onPress={() => void onSelectPhoneRegion(item.code)}
                  style={[styles.regionOption, { borderColor: colors.border }]}
                >
                  <Text
                    style={[styles.rowLabel, { color: colors.textPrimary }]}
                  >{`${item.name} (${item.code})`}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      <View testID="settings-home-screen-section" style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionHeading, { color: colors.textSecondary }]}
        >
          Home screen
        </Text>
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Include unbound in Not yet contacted
            </Text>
            <Switch
              testID="settings-include-unbound-never-contacted"
              accessibilityRole="switch"
              accessibilityLabel="Include unbound in Not yet contacted"
              accessibilityState={{
                checked: settings?.includeUnboundNeverContacted === 1,
              }}
              value={settings?.includeUnboundNeverContacted === 1}
              onValueChange={(value) =>
                void persist({ includeUnboundNeverContacted: value ? 1 : 0 })
              }
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Show unbound contacts with no history in the Not yet contacted list.
          </Text>
        </View>
      </View>

      <View testID="settings-notifications-section" style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionHeading, { color: colors.textSecondary }]}
        >
          Notifications
        </Text>

        {/* Master toggle — the value-moment permission affordance. */}
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Allow notifications
            </Text>
            <Switch
              testID="settings-notifications-master"
              accessibilityRole="switch"
              accessibilityLabel="Allow notifications"
              accessibilityState={{ checked: masterOn }}
              value={masterOn}
              onValueChange={(v) => void onToggleMaster(v)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          {!masterOn ? (
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Get a calm morning reminder when someone's overdue, and a heads-up
              on birthdays.
            </Text>
          ) : null}
        </View>

        {degraded ? (
          <View
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              testID="settings-notifications-degraded"
              style={[styles.degradedHeading, { color: colors.textPrimary }]}
            >
              Notifications are off
            </Text>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Orbit's dashboard still shows who's due. To get reminders, turn
              notifications on in your phone's settings.
            </Text>
          </View>
        ) : null}

        {/* Decay reminders — gated by master. */}
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Decay reminders
            </Text>
            <Switch
              testID="settings-notifications-decay"
              accessibilityRole="switch"
              accessibilityLabel="Decay reminders"
              accessibilityState={{
                disabled: !masterOn,
                checked: settings?.decayEnabled === 1,
              }}
              disabled={!masterOn}
              value={settings?.decayEnabled === 1}
              onValueChange={(v) => void persist({ decayEnabled: v ? 1 : 0 })}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Reminders to reach out to people you're overdue with.
          </Text>
        </View>

        {/* Birthday alerts — gated by master. */}
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Birthday alerts
            </Text>
            <Switch
              testID="settings-notifications-birthday"
              accessibilityRole="switch"
              accessibilityLabel="Birthday alerts"
              accessibilityState={{
                disabled: !masterOn,
                checked: settings?.birthdayEnabled === 1,
              }}
              disabled={!masterOn}
              value={settings?.birthdayEnabled === 1}
              onValueChange={(v) =>
                void persist({ birthdayEnabled: v ? 1 : 0 })
              }
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            A morning nudge on a contact's birthday.
          </Text>
        </View>

        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Birthday alerts for unbound contacts
            </Text>
            <Switch
              testID="settings-notifications-birthday-unbound"
              accessibilityRole="switch"
              accessibilityLabel="Birthday alerts for unbound contacts"
              accessibilityState={{
                disabled: !masterOn,
                checked: settings?.birthdayUnboundEnabled === 1,
              }}
              disabled={!masterOn}
              value={settings?.birthdayUnboundEnabled === 1}
              onValueChange={(value) =>
                void persist({ birthdayUnboundEnabled: value ? 1 : 0 })
              }
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Keep birthday reminders on for contacts outside your active orbit.
          </Text>
        </View>

        {/* Weekly digest — gated by master. Persists + reconciles the WEEKLY
            trigger through the shared persist path (review H1). */}
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Weekly digest
            </Text>
            <Switch
              testID="settings-notifications-digest"
              accessibilityRole="switch"
              accessibilityLabel="Weekly digest"
              accessibilityState={{
                disabled: !masterOn,
                checked: settings?.digestEnabled === 1,
              }}
              disabled={!masterOn}
              value={settings?.digestEnabled === 1}
              onValueChange={(v) => void persist({ digestEnabled: v ? 1 : 0 })}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            A Sunday-morning look back at your week — who you reached, and who's
            slipping quietly.
          </Text>
        </View>

        {/* Lock-screen visibility — default off (private). */}
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Show names on lock screen
            </Text>
            <Switch
              testID="settings-notifications-lockscreen"
              accessibilityRole="switch"
              accessibilityLabel="Show names on lock screen"
              accessibilityState={{
                disabled: !masterOn,
                checked: settings?.lockscreenPublic === 1,
              }}
              disabled={!masterOn}
              value={settings?.lockscreenPublic === 1}
              onValueChange={(v) =>
                void persist({ lockscreenPublic: v ? 1 : 0 })
              }
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            When off, lock-screen reminders won't show who they're about.
          </Text>
        </View>

        {/* Reminder time — the user-tunable delivery hour (the reversal). */}
        <Pressable
          testID="settings-notifications-time"
          accessibilityRole="button"
          accessibilityLabel={`Reminder time, ${formatHour(settings?.deliveryHour ?? 9)}`}
          accessibilityState={{ disabled: !masterOn }}
          disabled={!masterOn}
          onPress={() => setActivePicker("delivery")}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Reminder time
            </Text>
            <Text
              style={[
                styles.rowValue,
                { color: masterOn ? colors.accent : colors.textSecondary },
              ]}
            >
              {formatHour(settings?.deliveryHour ?? 9)}
            </Text>
          </View>
        </Pressable>

        {/* Quiet-hours start — the user-tunable quiet-window start (the reversal). */}
        <Pressable
          testID="settings-notifications-quiet-start"
          accessibilityRole="button"
          accessibilityLabel={`Quiet hours start, ${formatHour(settings?.quietStartHour ?? 21)}`}
          accessibilityState={{ disabled: !masterOn }}
          disabled={!masterOn}
          onPress={() => setActivePicker("quiet-start")}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Quiet hours start
            </Text>
            <Text
              style={[
                styles.rowValue,
                { color: masterOn ? colors.accent : colors.textSecondary },
              ]}
            >
              {formatHour(settings?.quietStartHour ?? 21)}
            </Text>
          </View>
        </Pressable>

        {/* Quiet-hours end — the user-tunable quiet-window end (the reversal). */}
        <Pressable
          testID="settings-notifications-quiet-end"
          accessibilityRole="button"
          accessibilityLabel={`Quiet hours end, ${formatHour(settings?.quietEndHour ?? 8)}`}
          accessibilityState={{ disabled: !masterOn }}
          disabled={!masterOn}
          onPress={() => setActivePicker("quiet-end")}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text
              style={[
                styles.rowLabel,
                { color: masterOn ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              Quiet hours end
            </Text>
            <Text
              style={[
                styles.rowValue,
                { color: masterOn ? colors.accent : colors.textSecondary },
              ]}
            >
              {formatHour(settings?.quietEndHour ?? 8)}
            </Text>
          </View>
        </Pressable>
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          Reminders that would land inside quiet hours wait until the next
          morning.
        </Text>

        {activePicker !== null ? (
          <DateTimePicker
            testID="settings-notifications-time-picker"
            value={seedForHour(pickerSeedHour)}
            mode="time"
            onChange={onPickTime}
          />
        ) : null}
      </View>

      <View
        testID="settings-your-photo-row"
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          Your photo
        </Text>
        <PhotoSourcePicker
          target={{ kind: "profile" }}
          photo={selfPhoto}
          name={selfName ?? "You"}
          cacheBust={selfModifiedAt}
          onChanged={() => void reloadProfile()}
        />
      </View>

      <View testID="settings-your-orbit-section" style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionHeading, { color: colors.textSecondary }]}
        >
          Your orbit
        </Text>

        {/* "Your star" — the self-sun colour, picked from the themed starPalette.
            The selected swatch = selfSunColour, or starPalette[0] (gold) when
            unset (NULL resolves to gold at RENDER — no stored hex default). Swatch
            fills ARE starPalette TOKENS (legitimate token use, not hardcoded hex);
            the accent ring marks the selection. Writes self_sun_colour (ORR-05). */}
        <View
          testID="settings-your-star-row"
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
            Your star
          </Text>
          <View style={styles.swatchRow}>
            {colors.starPalette.map((token, index) => {
              const isSelected =
                token === (selfSunColour ?? colors.starPalette[0]);
              return (
                <Pressable
                  key={token}
                  testID={`settings-star-swatch-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Star colour ${index + 1}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => void onPickStarColour(token)}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: token,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                />
              );
            })}
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Pick the colour of your star at the centre of your orbit.
          </Text>
        </View>

        {/* "Sun / centre" — the occupant picker (Me / favourites / all contacts),
            writing sun_contact_id (NULL = Me). ORR-06 relocated to Settings by
            owner decision — NOT an orrery gesture. The row shows the resolved
            occupant name (M4: "Me" when the stored occupant is archived/missing). */}
        <Pressable
          testID="settings-sun-centre-row"
          accessibilityRole="button"
          accessibilityLabel={`Sun / centre, ${sunOccupantName}`}
          onPress={() => setSunPickerOpen(true)}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Sun / centre
            </Text>
            <Text style={[styles.rowValue, { color: colors.accent }]}>
              {sunOccupantName}
            </Text>
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Choose who sits at the centre — you, or someone you orbit around.
          </Text>
        </Pressable>

        <Modal
          visible={sunPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setSunPickerOpen(false)}
        >
          <View style={styles.modalRoot}>
            <Pressable
              accessibilityLabel="Dismiss sun options"
              style={StyleSheet.absoluteFill}
              onPress={() => setSunPickerOpen(false)}
            >
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.scrim,
                  { backgroundColor: colors.background },
                ]}
              />
            </Pressable>

            <View
              testID="settings-sun-picker"
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
            >
              <FlatList
                data={sunOptions}
                keyExtractor={(item) =>
                  item.id === null ? "me" : String(item.id)
                }
                renderItem={({ item }) => {
                  const isSelected = item.id === sunContactId;
                  return (
                    <Pressable
                      testID={`settings-sun-option-${item.id === null ? "me" : item.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={item.name}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => void onPickSunOccupant(item.id)}
                      style={[styles.option, { borderColor: colors.border }]}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          color: isSelected
                            ? colors.accent
                            : colors.textPrimary,
                        }}
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            </View>
          </View>
        </Modal>
      </View>

      {/* AI message suggestions (AI-01/03/04). Opt-in, dormant until a provider
          is chosen and a key is entered. The API key entry is masked and routed
          straight to SecureStore — no key value is ever rendered or persisted to
          app_settings. The first-send exact-prompt gate lives in Compose (H5). */}
      <View testID="settings-ai-section" style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionHeading, { color: colors.textSecondary }]}
        >
          AI message suggestions
        </Text>

        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
            Provider
          </Text>
          <View style={styles.aiChipRow}>
            {AI_PROVIDER_IDS.map((id) => {
              const selected = id === aiProvider;
              return (
                <Pressable
                  key={id}
                  testID={`settings-ai-provider-${id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Provider ${providerDisplayName(id)}`}
                  onPress={() => void onSelectAiProvider(id)}
                  style={[
                    styles.aiChip,
                    {
                      backgroundColor: selected
                        ? colors.accent
                        : colors.surface,
                      borderColor: selected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? colors.background : colors.textPrimary,
                    }}
                  >
                    {providerDisplayName(id)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Off by default. Orbit only sends anything to a provider you choose,
            and only when you ask for a suggestion.
          </Text>
        </View>

        {aiProvider !== "none" ? (
          <>
            {/* Cloud providers: curated frontier chips are the DEFAULT picker —
                no API key, no network (D-01/D-03). Discover + free-text move under
                an "Advanced" disclosure (D-04). Custom is free-text (row below). */}
            {aiProvider !== "custom" ? (
              <View
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                  Model
                </Text>

                {/* Frontier only / All models — a persisted display toggle. The
                    picker re-renders live from the cached LiteLLM catalog per
                    selection (14-10). Exact ids always come from the catalog. */}
                <View style={styles.aiScopeRow}>
                  <Text
                    style={[styles.rowLabel, { color: colors.textPrimary }]}
                  >
                    {modelScope === "frontier" ? "Frontier only" : "All models"}
                  </Text>
                  <Switch
                    testID="settings-ai-model-scope"
                    accessibilityLabel="Show frontier models only"
                    value={modelScope === "frontier"}
                    onValueChange={(on: boolean) =>
                      setModelScope(on ? "frontier" : "all")
                    }
                  />
                </View>

                {/* DEFAULT picker: the LiteLLM-sourced catalog (cache-or-seed)
                    filtered by the active scope — no API key, no network. */}
                <View style={styles.aiChipRow}>
                  {modelsFor(modelCatalog, aiProvider, modelScope).map((m) => {
                    const selected = m === aiModel;
                    return (
                      <Pressable
                        key={m}
                        testID={`settings-ai-model-${m}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Model ${m}`}
                        onPress={() => setAiModel(m)}
                        style={[
                          styles.aiChip,
                          {
                            backgroundColor: selected
                              ? colors.accent
                              : colors.surface,
                            borderColor: selected
                              ? colors.accent
                              : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: selected
                              ? colors.background
                              : colors.textPrimary,
                          }}
                        >
                          {m}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>
                  Model list from LiteLLM's public catalog — no API key needed
                  to choose one.
                </Text>

                {/* User-instigated refresh: a plain public GET of LiteLLM's model
                    catalog (no key, no personal data), never on a read path. */}
                <Pressable
                  testID="settings-ai-refresh-models"
                  accessibilityRole="button"
                  accessibilityLabel="Refresh model list"
                  disabled={aiRefreshing}
                  onPress={() => void onRefreshModels()}
                  style={[styles.aiButton, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.accent }}>
                    {aiRefreshing ? "Refreshing…" : "Refresh models"}
                  </Text>
                </Pressable>

                {/* ADVANCED: key-gated Discover (frontier-filtered) + free-text. */}
                <Pressable
                  testID="settings-ai-model-advanced-toggle"
                  accessibilityRole="button"
                  accessibilityState={{ expanded: aiModelAdvancedOpen }}
                  accessibilityLabel="Advanced model options"
                  onPress={() => setAiModelAdvancedOpen((open) => !open)}
                  style={[styles.aiButton, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.accent }}>
                    {aiModelAdvancedOpen
                      ? "Advanced options — hide"
                      : "Advanced options — discover or enter a model id"}
                  </Text>
                </Pressable>

                {aiModelAdvancedOpen ? (
                  <>
                    {aiModelField.kind === "list" ? (
                      <View style={styles.aiChipRow}>
                        {aiModelField.models.map((m) => {
                          const selected = m === aiModel;
                          return (
                            <Pressable
                              key={m}
                              testID={`settings-ai-discovered-${m}`}
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              accessibilityLabel={`Discovered model ${m}`}
                              onPress={() => setAiModel(m)}
                              style={[
                                styles.aiChip,
                                {
                                  backgroundColor: selected
                                    ? colors.accent
                                    : colors.surface,
                                  borderColor: selected
                                    ? colors.accent
                                    : colors.border,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: selected
                                    ? colors.background
                                    : colors.textPrimary,
                                }}
                              >
                                {m}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                    <TextInput
                      testID="settings-ai-model-input"
                      accessibilityLabel="Model name"
                      value={aiModel}
                      onChangeText={setAiModel}
                      placeholder="e.g. gpt-5.4-mini"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[
                        styles.aiInput,
                        {
                          color: colors.textPrimary,
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                    <Pressable
                      testID="settings-ai-discover"
                      accessibilityRole="button"
                      accessibilityLabel="Discover models"
                      onPress={() => void onDiscoverAiModels()}
                      style={[styles.aiButton, { borderColor: colors.accent }]}
                    >
                      <Text style={{ color: colors.accent }}>
                        Discover models
                      </Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            ) : null}

            {/* Custom provider: endpoint (validated on save) + free-text model. */}
            {aiProvider === "custom" ? (
              <View
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                  Custom endpoint
                </Text>
                <TextInput
                  testID="settings-ai-endpoint-input"
                  accessibilityLabel="Custom endpoint URL"
                  value={aiCustomEndpoint}
                  onChangeText={setAiCustomEndpoint}
                  placeholder="https://…"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={[
                    styles.aiInput,
                    {
                      color: colors.textPrimary,
                      backgroundColor: colors.background,
                      borderColor: aiEndpointError
                        ? colors.danger
                        : colors.border,
                    },
                  ]}
                />
                {aiEndpointError ? (
                  <Text
                    testID="settings-ai-endpoint-error"
                    style={[styles.helper, { color: colors.danger }]}
                  >
                    {aiEndpointError}
                  </Text>
                ) : null}
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                  Model
                </Text>
                <TextInput
                  testID="settings-ai-custom-model-input"
                  accessibilityLabel="Custom model name"
                  value={aiCustomModel}
                  onChangeText={setAiCustomModel}
                  placeholder="model id"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.aiInput,
                    {
                      color: colors.textPrimary,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <Text style={[styles.helper, { color: colors.textSecondary }]}>
                  {CUSTOM_RETENTION_CAVEAT}
                </Text>
              </View>
            ) : null}

            {/* Masked API key — SecureStore only, never rendered or persisted. */}
            <View
              style={[
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                API key {aiKeySet ? "(saved)" : ""}
              </Text>
              <TextInput
                testID="settings-ai-key-input"
                accessibilityLabel="API key"
                value={aiKeyInput}
                onChangeText={setAiKeyInput}
                placeholder={aiKeySet ? "•••••••• (saved)" : "Paste your key"}
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.aiInput,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              />
              <View style={styles.aiButtonRow}>
                <Pressable
                  testID="settings-ai-key-save"
                  accessibilityRole="button"
                  accessibilityLabel="Save API key"
                  onPress={() =>
                    void onSaveAiKey(aiProvider as AiCloudProviderId)
                  }
                  style={[styles.aiButton, { borderColor: colors.accent }]}
                >
                  <Text style={{ color: colors.accent }}>Save key</Text>
                </Pressable>
                {aiKeySet ? (
                  <Pressable
                    testID="settings-ai-key-remove"
                    accessibilityRole="button"
                    accessibilityLabel="Remove API key"
                    onPress={() =>
                      void onRemoveAiKey(aiProvider as AiCloudProviderId)
                    }
                    style={[
                      styles.aiButton,
                      { borderColor: colors.borderStrong },
                    ]}
                  >
                    <Text style={{ color: colors.textSecondary }}>
                      Remove key
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>
                Your key is stored only in your device's secure keystore — never
                in Orbit's database, a backup, or anything that leaves the
                phone.
              </Text>
            </View>

            {/* Prompt-template editor (ai_prompt_template). Empty = built-in. */}
            <View
              style={[
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                Prompt template
              </Text>
              <TextInput
                testID="settings-ai-template-input"
                accessibilityLabel="Prompt template"
                value={aiPromptTemplate}
                onChangeText={setAiPromptTemplate}
                placeholder="Leave empty to use Orbit's built-in template."
                placeholderTextColor={colors.textSecondary}
                multiline
                style={[
                  styles.aiInput,
                  styles.aiTemplateInput,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>
          </>
        ) : null}

        <Pressable
          testID="settings-ai-save"
          accessibilityRole="button"
          accessibilityLabel="Save AI settings"
          onPress={() => void onSaveAiConfig()}
          style={[
            styles.row,
            styles.aiSaveRow,
            { backgroundColor: colors.accent, borderColor: colors.accent },
          ]}
        >
          <Text style={{ color: colors.background, fontWeight: "600" }}>
            Save AI settings
          </Text>
        </Pressable>

        {aiStatus ? (
          <Text
            testID="settings-ai-status"
            style={[styles.helper, { color: colors.textSecondary }]}
          >
            {aiStatus}
          </Text>
        ) : null}
      </View>

      <View testID="settings-home-screen-section" style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionHeading, { color: colors.textSecondary }]}
        >
          Home screen
        </Text>

        {/* "Add Orbit widget" — opens the launcher's native pin prompt via
            requestPinWidget, degrading to the fallback copy on an unsupported
            launcher / API < 26 / a rejected request (WDG-03). Leading widget
            glyph + trailing chevron, consistent with the other rows. */}
        <Pressable
          testID="settings-add-widget"
          accessibilityRole="button"
          accessibilityLabel="Add Orbit widget"
          onPress={() => void onAddWidget()}
          style={[
            styles.row,
            styles.addWidgetRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[styles.addWidgetGlyph, { color: colors.textSecondary }]}
          >
            ▦
          </Text>
          <Text
            style={[
              styles.rowLabel,
              styles.addWidgetLabel,
              { color: colors.textPrimary },
            ]}
          >
            Add Orbit widget
          </Text>
          <Text
            style={[styles.addWidgetChevron, { color: colors.textSecondary }]}
          >
            ›
          </Text>
        </Pressable>

        {addWidgetCopy !== null ? (
          <Text
            testID="settings-add-widget-fallback"
            style={[styles.helper, { color: colors.textSecondary }]}
          >
            {addWidgetCopy}
          </Text>
        ) : null}
      </View>

      <Pressable
        testID="settings-manage-favourites-row"
        accessibilityRole="button"
        accessibilityLabel="Manage favourites"
        onPress={() => navigation.navigate("ManageFavourites")}
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          Manage favourites
        </Text>
      </Pressable>

      <Pressable
        testID="settings-custom-fields-row"
        accessibilityRole="button"
        accessibilityLabel="Custom Fields"
        onPress={() => navigation.navigate("CustomFields")}
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          Custom Fields
        </Text>
      </Pressable>

      <Pressable
        testID="settings-archived-row"
        accessibilityRole="button"
        accessibilityLabel="Archived contacts"
        onPress={() => navigation.navigate("Archived")}
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          Archived contacts
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
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
    fontSize: 24,
    fontWeight: "700",
  },
  section: {
    gap: 12,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  rowCopy: {
    gap: 4,
  },
  addWidgetRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  addWidgetGlyph: {
    fontSize: 18,
  },
  addWidgetLabel: {
    flex: 1,
  },
  addWidgetChevron: {
    fontSize: 20,
    fontWeight: "600",
  },
  rowValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scrim: {
    opacity: 0.85,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 12,
    maxHeight: "60%",
    overflow: "hidden",
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  helper: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
  degradedHeading: {
    fontSize: 16,
    fontWeight: "600",
  },
  aiChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  aiScopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  aiChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  aiInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  aiTemplateInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  aiButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  aiButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  aiSaveRow: {
    alignItems: "center",
  },
  regionModalScrim: {
    flex: 1,
    justifyContent: "flex-end",
  },
  regionModal: {
    maxHeight: "80%",
    gap: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 16,
  },
  regionOption: {
    minHeight: 44,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
});
