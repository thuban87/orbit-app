// biome-ignore-all lint/a11y/useValidAriaRole: AppText/Button semantic roles are domain props.
import { useIsFocused } from "@react-navigation/native";
import { Canvas, Circle, Fill } from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ManageMembersGrid } from "@/components/orrery/ManageMembersGrid";
import { OrreryObstacle } from "@/components/orrery/OrreryObstacle";
import { SystemRuleAccordion } from "@/components/orrery/SystemRuleAccordion";
import {
  draftToRules,
  emptyRuleDraft,
  isMeaningfulChange,
  type RuleDraft,
  rulesToDraft,
  type SystemBuilderDraft,
} from "@/components/orrery/system-builder-logic";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { OrrerySystemId } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  listOrrerySystemCategories,
  readOrrerySystemBaseMemberIds,
  resolveDraftMembership,
} from "@/db/orrery-system-read";
import {
  getSystem,
  listSystemOverrides,
  listSystemRules,
  mapBuiltinPredicateToRules,
  resetSystemOverrides,
  type SystemOverride,
  type SystemOverrideIntent,
  saveMembershipOverrides,
  saveSystemDefinition,
} from "@/db/systems-dao";
import {
  listActiveMemberRows,
  readMemberRowsByIds,
} from "@/db/systems-members-read";
import {
  BUILTIN_SYSTEM_LABELS,
  parseSystemRef,
} from "@/logic/orrery-system-logic";
import { applyMembershipOverrides } from "@/logic/system-rule-resolver";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { useOrreryPreferencesStore } from "@/stores/orrery-preferences-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

type Props = RootStackScreenProps<"SystemBuilder">;
type BuilderPage = "definition" | "members";
type Membership = {
  memberIds: number[];
  candidateIds: number[];
  prunableExclusionContactIds: number[];
};

function refFromUid(uid: string): `custom:${string}` {
  return `custom:${uid}`;
}

function toOverrides(
  systemRef: OrrerySystemId,
  intent: readonly SystemOverrideIntent[],
): SystemOverride[] {
  const overrides: SystemOverride[] = [];
  for (const entry of intent) {
    if (entry.mode === null) continue;
    overrides.push({
      id: overrides.length,
      uid: `draft-${entry.contactId}`,
      systemRef,
      contactId: entry.contactId,
      mode: entry.mode,
      createdAt: "",
    });
  }
  return overrides;
}

function applyIntents(
  base: readonly SystemOverrideIntent[],
  intent: readonly SystemOverrideIntent[],
): SystemOverrideIntent[] {
  const values = new Map(base.map((entry) => [entry.contactId, entry.mode]));
  for (const entry of intent) {
    if (entry.mode === null) values.delete(entry.contactId);
    else values.set(entry.contactId, entry.mode);
  }
  return [...values].map(([contactId, mode]) => ({ contactId, mode }));
}

function memberIdsForOverrides(
  candidateIds: readonly number[],
  overrides: readonly SystemOverrideIntent[],
  availableIds: readonly number[],
): Membership {
  const includeIds = overrides
    .filter((entry) => entry.mode === "include")
    .map((entry) => entry.contactId);
  const excludeIds = overrides
    .filter((entry) => entry.mode === "exclude")
    .map((entry) => entry.contactId);
  return {
    candidateIds: [...candidateIds],
    ...applyMembershipOverrides({
      candidateIds,
      includeIds,
      excludeIds,
      eligibleIncludeIds: availableIds,
    }),
  };
}

/**
 * The app-scoped preference is the sole cross-stack selection publication.
 * It is intentionally after the durable composite: a failed creation cannot
 * switch the Orrery to a System that never committed.
 */
export async function saveCustomBuilderDraft(input: {
  systemRef: OrrerySystemId | null;
  name: string;
  rules: readonly { family: string; value: string }[];
  overrideIntent: readonly SystemOverrideIntent[];
  prunableExclusionContactIds: readonly number[];
  now: string;
}): Promise<void> {
  const exec = getExecutor();
  const saved = await saveSystemDefinition(exec, input);
  if (input.systemRef !== null) return;
  const prefs = useOrreryPreferencesStore.getState();
  if (!prefs.hydrated) await prefs.hydrate(exec);
  await useOrreryPreferencesStore
    .getState()
    .save(exec, { lastSystem: refFromUid(saved.uid) });
}

/** Immutable built-ins and Categories persist only their membership deltas. */
export async function saveOverrideBuilderDraft(input: {
  systemRef: OrrerySystemId;
  overrideIntent: readonly SystemOverrideIntent[];
  prunableExclusionContactIds: readonly number[];
  now: string;
}): Promise<void> {
  await saveMembershipOverrides(getExecutor(), input);
}

function saveErrorMessage(cause: unknown, name: string): string {
  const message =
    cause instanceof Error ? cause.message : "Couldn't save this System.";
  return message.includes("already exists")
    ? `A System named "${name.trim()}" already exists. Choose a different name.`
    : message;
}

function nameForOverrideRef(
  systemRef: string,
  categories: readonly { uid: string; name: string }[],
) {
  const parsed = parseSystemRef(systemRef);
  if (!parsed || parsed.kind === "custom") return "System";
  if (parsed.kind === "category")
    return (
      categories.find((category) => category.uid === parsed.uid)?.name ??
      "Category"
    );
  return BUILTIN_SYSTEM_LABELS[parsed.id];
}

/** Opaque builder route: this is its own decorative Orrery canvas, never the live screen. */
function BuilderBackgroundCanvas() {
  const { colors } = useTheme();
  return (
    <Canvas
      testID="system-builder-background-canvas"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.backgroundCanvas}
    >
      <Fill color={colors.background} />
      <Circle cx={160} cy={270} r={42} color={colors.accent} />
      <Circle
        cx={160}
        cy={270}
        r={120}
        color={colors.border}
        style="stroke"
        strokeWidth={1}
      />
    </Canvas>
  );
}

export function SystemBuilderScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const focused = useIsFocused();
  const systemRef = route.params?.systemRef;
  const customRef = route.params?.systemUid
    ? refFromUid(route.params.systemUid)
    : null;
  const overrideOnly = !!systemRef;
  const [page, setPage] = useState<BuilderPage>("definition");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<
    Array<{ uid: string; name: string }>
  >([]);
  const [baseOverrides, setBaseOverrides] = useState<SystemOverrideIntent[]>(
    [],
  );
  const [overrideIntent, setOverrideIntent] = useState<SystemOverrideIntent[]>(
    [],
  );
  const [baseCandidateIds, setBaseCandidateIds] = useState<number[]>([]);
  const [activeRows, setActiveRows] = useState<
    Awaited<ReturnType<typeof listActiveMemberRows>>
  >([]);
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof readMemberRowsByIds>>
  >([]);
  const [membership, setMembership] = useState<Membership>({
    memberIds: [],
    candidateIds: [],
    prunableExclusionContactIds: [],
  });
  const [draft, setDraft] = useState<SystemBuilderDraft>({
    name: "",
    rules: emptyRuleDraft(),
    overrideIntent: [],
  });
  const initialDraft = useRef<SystemBuilderDraft>(draft);
  const bypassRef = useRef(false);
  const currentOverrides = useMemo(
    () => applyIntents(baseOverrides, overrideIntent),
    [baseOverrides, overrideIntent],
  );
  const meaningful = isMeaningfulChange(initialDraft.current, {
    ...draft,
    overrideIntent,
  });
  useDiscardKeepGuard({ hasUnsavedChanges: meaningful, bypassRef });

  const load = useCallback(async () => {
    const exec = getExecutor();
    const loadedCategories = await listOrrerySystemCategories(exec);
    const active = await listActiveMemberRows(exec);
    let name = "";
    let rules: RuleDraft = emptyRuleDraft();
    let candidateIds: number[] = [];
    let overrides: SystemOverrideIntent[] = [];
    if (overrideOnly && systemRef) {
      const parsed = parseSystemRef(systemRef);
      if (!parsed || parsed.kind === "custom")
        throw new Error("Unknown System");
      name = nameForOverrideRef(systemRef, loadedCategories);
      candidateIds = await readOrrerySystemBaseMemberIds(exec, parsed);
      rules = rulesToDraft(mapBuiltinPredicateToRules(parsed));
      overrides = (
        await listSystemOverrides(exec, systemRef as OrrerySystemId)
      ).map(({ contactId, mode }) => ({
        contactId,
        mode,
      }));
    } else if (customRef) {
      const system = await getSystem(exec, route.params?.systemUid ?? "");
      if (!system) throw new Error("This System no longer exists.");
      name = system.name;
      const [storedRules, storedOverrides] = await Promise.all([
        listSystemRules(exec, system.id),
        listSystemOverrides(exec, customRef),
      ]);
      rules = rulesToDraft(storedRules);
      overrides = storedOverrides.map(({ contactId, mode }) => ({
        contactId,
        mode,
      }));
    }
    const nextDraft = { name, rules, overrideIntent: [] };
    initialDraft.current = { ...nextDraft, overrideIntent: [] };
    setCategories(loadedCategories);
    setActiveRows(active);
    setBaseCandidateIds(candidateIds);
    setBaseOverrides(overrides);
    setOverrideIntent([]);
    setDraft(nextDraft);
    setReady(true);
  }, [customRef, overrideOnly, route.params?.systemUid, systemRef]);

  useEffect(() => {
    void load().catch((cause: unknown) =>
      setError(
        cause instanceof Error ? cause.message : "Couldn't load this System.",
      ),
    );
  }, [load]);
  useEffect(() => {
    if (!focused) setPage("definition");
  }, [focused]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") setPage("definition");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const exec = getExecutor();
      const resolve = async () => {
        const next = overrideOnly
          ? memberIdsForOverrides(
              baseCandidateIds,
              currentOverrides,
              activeRows.filter((row) => row.available).map((row) => row.id),
            )
          : await resolveDraftMembership(exec, {
              rules: draftToRules(draft.rules).map((rule, index) => ({
                uid: `draft-${index}`,
                ...rule,
              })),
              overrides: toOverrides(
                customRef ?? "custom:draft",
                currentOverrides,
              ),
              now: localDateTime(),
            });
        if (cancelled) return;
        setMembership(next);
        const displayIds = [
          ...new Set([
            ...next.candidateIds,
            ...currentOverrides.map((entry) => entry.contactId),
          ]),
        ];
        setRows(await readMemberRowsByIds(exec, displayIds));
      };
      void resolve().catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Couldn't resolve this System.",
          );
      });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    activeRows,
    baseCandidateIds,
    currentOverrides,
    customRef,
    draft.rules,
    overrideOnly,
    ready,
  ]);

  const onOverrideChange = (intent: SystemOverrideIntent) => {
    setOverrideIntent((current) => [
      ...current.filter((entry) => entry.contactId !== intent.contactId),
      intent,
    ]);
  };
  const save = async () => {
    setError(null);
    if (!overrideOnly && !draft.name.trim()) {
      setError("Give this System a name.");
      return;
    }
    setSaving(true);
    try {
      if (overrideOnly && systemRef) {
        await saveOverrideBuilderDraft({
          systemRef: systemRef as OrrerySystemId,
          overrideIntent,
          prunableExclusionContactIds: membership.prunableExclusionContactIds,
          now: localDateTime(),
        });
      } else {
        await saveCustomBuilderDraft({
          systemRef: customRef,
          name: draft.name,
          rules: draftToRules(draft.rules),
          overrideIntent,
          prunableExclusionContactIds: membership.prunableExclusionContactIds,
          now: localDateTime(),
        });
      }
      bypassRef.current = true;
      navigation.goBack();
    } catch (cause) {
      setError(saveErrorMessage(cause, draft.name));
    } finally {
      setSaving(false);
    }
  };
  const resetOverrides = () => {
    const ref = systemRef ?? customRef;
    if (!ref) return;
    Alert.alert(
      "Reset overrides?",
      "Manual includes and excludes will be removed. The System's rules stay.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void resetSystemOverrides(getExecutor(), {
              systemRef: ref as OrrerySystemId,
            })
              .then(() => {
                setBaseOverrides([]);
                setOverrideIntent([]);
              })
              .catch(() => setError("Couldn't reset membership overrides."));
          },
        },
      ],
    );
  };
  const includeIds = currentOverrides
    .filter((entry) => entry.mode === "include")
    .map((entry) => entry.contactId);
  const excludeIds = currentOverrides
    .filter((entry) => entry.mode === "exclude")
    .map((entry) => entry.contactId);

  return (
    <View style={styles.root}>
      <BuilderBackgroundCanvas />
      <OrreryObstacle
        obstacleId="system-builder-hud"
        style={styles.hud}
        accessibilityViewIsModal
      >
        <GlassSurface density="dense" style={styles.surface}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Button
                role="secondary"
                label={page === "members" ? "Back" : "Cancel"}
                onPress={() =>
                  page === "members"
                    ? setPage("definition")
                    : navigation.goBack()
                }
              />
              <AppText role="heading">
                {overrideOnly
                  ? `Edit ${draft.name}`
                  : customRef
                    ? `Edit ${draft.name}`
                    : "New System"}
              </AppText>
            </View>
            {error ? (
              <AppText
                accessibilityLiveRegion="polite"
                style={{ color: colors.danger }}
              >
                {error}
              </AppText>
            ) : null}
            {!ready ? (
              <AppText>Loading System…</AppText>
            ) : page === "members" ? (
              <>
                <AppText role="heading">Manage Members</AppText>
                <ManageMembersGrid
                  candidateIds={membership.candidateIds}
                  includeIds={includeIds}
                  excludeIds={excludeIds}
                  rows={[
                    ...rows,
                    ...activeRows.filter(
                      (row) =>
                        !rows.some((candidate) => candidate.id === row.id),
                    ),
                  ]}
                  onChange={onOverrideChange}
                />
                <Button
                  role="secondary"
                  label="Back to Definition"
                  onPress={() => setPage("definition")}
                />
              </>
            ) : (
              <>
                <TextInput
                  accessibilityLabel="System name"
                  editable={!overrideOnly}
                  placeholder="Name this System"
                  placeholderTextColor={colors.textSecondary}
                  value={draft.name}
                  onChangeText={(name) =>
                    setDraft((current) => ({ ...current, name }))
                  }
                  style={[
                    styles.name,
                    {
                      color: colors.textPrimary,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                />
                {!overrideOnly ? (
                  <SystemRuleAccordion
                    rules={draft.rules}
                    categories={categories.map((category) => ({
                      value: category.uid,
                      label: category.name,
                    }))}
                    onChange={(rules) =>
                      setDraft((current) => ({ ...current, rules }))
                    }
                  />
                ) : (
                  <>
                    <SystemRuleAccordion
                      rules={draft.rules}
                      categories={categories.map((category) => ({
                        value: category.uid,
                        label: category.name,
                      }))}
                      disabled
                      onChange={() => {}}
                    />
                    <AppText
                      role="caption"
                      style={{ color: colors.textSecondary }}
                    >
                      This System's base rules are fixed.
                    </AppText>
                  </>
                )}
                <AppText role="label" accessibilityLiveRegion="polite">
                  {membership.memberIds.length}{" "}
                  {membership.memberIds.length === 1 ? "member" : "members"}
                </AppText>
                <Button
                  role="secondary"
                  label="Manage Members"
                  onPress={() => setPage("members")}
                />
                {customRef || systemRef ? (
                  <Button
                    role="secondary"
                    label="Reset Membership Overrides"
                    onPress={resetOverrides}
                  />
                ) : null}
                <Button
                  role="primary"
                  label="Save System"
                  disabled={saving}
                  onPress={() => void save()}
                />
              </>
            )}
          </ScrollView>
        </GlassSurface>
      </OrreryObstacle>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backgroundCanvas: { ...StyleSheet.absoluteFill },
  hud: {
    position: "absolute",
    top: SPACING.base,
    right: SPACING.base,
    bottom: SPACING.base,
    left: SPACING.base,
  },
  surface: { flex: 1 },
  content: { padding: SPACING.base, gap: SPACING.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    flexWrap: "wrap",
  },
  name: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
});
