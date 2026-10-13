// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's AppText / Button `role` is a typography / hierarchy role, not ARIA.
/**
 * MemoryAddScreen — the `Memory` route (the name is kept): + → Memory opens
 * the Add form directly (Phase 38.10 D-63; ADR-168). A Profile section's Add
 * opens it with `type` (plan 16), which fixes the type on the form.
 *
 * - Read: the ADR-168 gated read loads the app settings (the AI master,
 *   `isAiMasterEnabled`) and the per-type Allow AI defaults, with a loading
 *   state and Retry; the form never opens over a failed read (38.3 RG-035).
 * - The form is `MemoryEditor` in add-only mode. A new entry's Allow AI
 *   starts at its type's own default, and a type change re-applies the new
 *   type's default while the switch is untouched (D-13, D-92; F-U3). Imported
 *   is never a type here (D-35).
 * - Save is single-flight. A committed save goes back to the screen the user
 *   started from, then shows "Memory saved for <name>" with "Open Profile"
 *   (D-64, G-11). The action is left out when that screen is already this
 *   contact's Profile (F-U11). A failed save keeps the form and its draft.
 * - Back and the form's Cancel follow the Back rule (38.9 D-13/D-14, D-61):
 *   the open draft is the sub-editor; closing it without a save leaves the
 *   screen, since an add-only form has nothing else to show.
 * - No keyboard centring: D-66 does not name this form (CONTEXT :61 defers
 *   the rollout to Phase 40).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import {
  type MemoryAiDefaults,
  type MemoryDraft,
  type MemoryDraftState,
  MemoryEditor,
  type MemoryEditorHandle,
} from "@/components/MemoryEditor";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, Button } from "@/components/ui";
import {
  getAiPermissionDefaults,
  memoryAiDefaultsMap,
} from "@/db/ai-permissions-dao";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { addMemory } from "@/db/memories-dao";
import { useContactHeader } from "@/hooks/use-contact-header";
import { isAiMasterEnabled } from "@/logic/ai-enablement";
import { type ReadPhase, readLoading, runGatedRead } from "@/logic/read-phase";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { type SnackbarMessage, showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import { Logger } from "@/utils/logger";
import { beginInFlight, endInFlight } from "@/utils/single-flight";
import { memorySavedLabel, returnsToSameProfile } from "./memory-history-logic";
import { canAdd } from "./section-editor-logic";

const LOG_SCOPE = "memory-add";

interface MemoryAddData {
  globalAiEnabled: boolean;
  aiDefaults: MemoryAiDefaults;
}

export function MemoryAddScreen({
  navigation,
  route,
}: RootStackScreenProps<"Memory">) {
  const { colors } = useTheme();
  const { contactId, type } = route.params;
  // Only a user-addable type is fixed on the form (Imported never, D-35).
  const fixedType = type !== undefined && canAdd(type) ? type : undefined;
  // D-45: the person line under the fixed title.
  const person = useContactHeader(contactId);
  // The snackbar after a save reads the latest name.
  const nameRef = useRef<string | null>(null);
  nameRef.current = person?.name ?? null;

  const [phase, setPhase] = useState<ReadPhase<MemoryAddData>>(readLoading);
  // Only the latest load may publish; blur invalidates outstanding reads.
  const readAuthority = useMemo(() => createLatestRequestAuthority(), []);

  // Single-flight guard: a double tap must not add twice (CAPT-06; WR-03).
  // `saving` mirrors it for the header's Back and the editor's held controls
  // (D-26; WR-02).
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  // A committed save leaves through a deferred effect, so MemoryEditor
  // finishes its own close first (no setState on an unmounted editor).
  const [savedTick, setSavedTick] = useState(0);
  // The success snackbar, built before leaving (F-U11 reads the stack).
  const savedNoticeRef = useRef<SnackbarMessage | null>(null);
  // Set once the screen starts leaving, so it leaves once.
  const leftRef = useRef(false);

  // In-screen sub-editor guard (G-12; D-14, D-61): the open draft is the
  // sub-editor. Closing it without a save leaves (effect below).
  const memoryEditorRef = useRef<MemoryEditorHandle>(null);
  const [memoryDraft, setMemoryDraft] = useState<MemoryDraftState>({
    open: false,
    dirty: false,
  });
  const bypassRef = useRef(false);
  const { requestClose, settleHold } = useDiscardKeepGuard({
    hasUnsavedChanges: false,
    bypassRef,
    // An add in flight holds every exit, with no prompt (fix-pass WR-02).
    busyRef: savingRef,
    subEditor: {
      open: memoryDraft.open,
      dirty: memoryDraft.dirty,
      close: () => memoryEditorRef.current?.closeDraft(),
    },
  });

  /** NEVER rejects: a failure lands in the error phase (D-04). */
  const load = useCallback(async (): Promise<void> => {
    await runGatedRead({
      gate: readAuthority,
      read: async (): Promise<MemoryAddData> => {
        const exec = getExecutor();
        const settings = await getAppSettings(exec);
        const defaults = await getAiPermissionDefaults(exec);
        return {
          globalAiEnabled: isAiMasterEnabled(settings),
          aiDefaults: memoryAiDefaultsMap(defaults),
        };
      },
      publish: setPhase,
      onError: (error) =>
        Logger.error(LOG_SCOPE, "failed to load the memory form", error),
    });
  }, [readAuthority]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => readAuthority.invalidate();
    }, [load, readAuthority]),
  );

  // Return to where + → Memory started after a committed save (deferred),
  // then confirm it (D-64). The bypass lets the save leave without a prompt.
  useEffect(() => {
    if (savedTick > 0 && !leftRef.current) {
      leftRef.current = true;
      bypassRef.current = true;
      navigation.goBack();
      const notice = savedNoticeRef.current;
      if (notice !== null) showSnackbar(notice);
    }
  }, [savedTick, navigation]);

  // The draft closed without a save (Cancel, or Back on the open draft):
  // an add-only form has nothing left to show, so the screen leaves. A
  // failed re-read that unmounts the form is not a close: it shows Retry.
  const draftWasOpenRef = useRef(false);
  const formShown = phase.phase === "loaded";
  useEffect(() => {
    if (memoryDraft.open) {
      draftWasOpenRef.current = true;
      return;
    }
    if (!formShown || !draftWasOpenRef.current || leftRef.current) return;
    if (savedNoticeRef.current !== null) return; // the save leaves above
    leftRef.current = true;
    bypassRef.current = true;
    navigation.goBack();
  }, [memoryDraft.open, formShown, navigation]);

  const failureNotice = () =>
    showSnackbar({
      kind: "error",
      label: "Couldn't save. Please try again.",
      action: {
        label: "Dismiss",
        accessibilityLabel: "Dismiss error",
        onPress: () => {},
      },
    });

  /** Builds the D-64 snackbar from the stack it is about to return to. */
  const savedNotice = (): SnackbarMessage => {
    const state = navigation.getState();
    const label = memorySavedLabel(fixedType, nameRef.current);
    if (returnsToSameProfile(state.routes, state.index, contactId)) {
      return { kind: "success", label };
    }
    return {
      kind: "success",
      label,
      action: {
        label: "Open Profile",
        accessibilityLabel: nameRef.current
          ? `Open Profile: ${nameRef.current}`
          : "Open Profile",
        onPress: () => navigation.push("Profile", { contactId }),
      },
    };
  };

  const add = async (draft: MemoryDraft): Promise<boolean> => {
    // Claim the slot synchronously: a double tap must not INSERT twice (WR-03).
    if (!beginInFlight(savingRef)) return false;
    setSaving(true);
    let committed = false;
    try {
      const now = localDateTime();
      await addMemory(getExecutor(), {
        contactId,
        ...draft,
        createdAt: now,
        now,
      });
      committed = true;
      savedNoticeRef.current = savedNotice();
      setSavedTick((tick) => tick + 1);
      return true;
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to add memory", error);
      failureNotice();
      return false;
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      // A committed save leaves through the deferred goBack above, which wins
      // over a parked removal (dropped on unmount). Only a failed save, which
      // keeps the user here, lets a parked removal through (WR-01).
      if (!committed) settleHold();
    }
  };

  return (
    <View style={styles.root}>
      {/* While an add runs the guard holds Back (D-26; WR-02). */}
      <ShellAppBar
        variant="child"
        title="Memory"
        person={person}
        backDisabled={saving}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {phase.phase === "loading" ? (
          <View
            testID="memory-screen-loading"
            accessibilityLabel="Loading the memory form"
            style={styles.readState}
          >
            <ActivityIndicator color={colors.accentText} />
          </View>
        ) : phase.phase === "error" ? (
          <View testID="memory-screen-read-error" style={styles.readError}>
            <AppText role="body" style={{ color: colors.textPrimary }}>
              {"Couldn't load the memory form"}
            </AppText>
            <Button
              role="tertiary"
              label="Retry"
              accessibilityLabel="Retry loading the memory form"
              onPress={() => void load()}
            />
          </View>
        ) : (
          <MemoryEditor
            testID="memory-screen-editor"
            items={[]}
            addOnly
            fixedType={fixedType}
            onAdd={add}
            // Add-only: there is no list, so nothing to edit or delete.
            onEdit={async () => false}
            onDelete={() => false}
            globalAiEnabled={phase.data.globalAiEnabled}
            aiDefaults={phase.data.aiDefaults}
            ref={memoryEditorRef}
            onDraftStateChange={setMemoryDraft}
            onCancelRequest={(close) => requestClose(close, memoryDraft.dirty)}
            // An add in flight also holds the form's own Cancel and Save
            // (WR-02 follow-up; IN-01, D-26).
            busy={saving}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: SPACING.md, padding: SPACING.base },
  readState: { minHeight: 88, alignItems: "center", justifyContent: "center" },
  readError: { gap: SPACING.sm, alignItems: "flex-start" },
});
