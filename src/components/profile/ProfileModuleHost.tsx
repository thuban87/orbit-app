// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { HistorySection } from "@/components/history/HistorySection";
import { getExecutor, localDateTime } from "@/db/database";
import type { CurrentStateFieldKey } from "@/db/memory-registry";
import {
  readProfileCollapseOverride,
  setProfileCollapseOverride,
} from "@/db/profile-presentation-dao";
import type { ProfileSnapshot } from "@/db/profile-read";
import {
  PROFILE_MODULE_EMPTY_SUMMARIES,
  resolveProfileModuleHostState,
} from "@/profile/module-host-model";
import {
  PROFILE_MODULE_REGISTRY,
  PROFILE_MODULE_RENDERERS,
} from "@/profile/module-registry";
import type {
  ProfileCollapseMap,
  ProfileCollapsibleModuleId,
  ProfileModuleId,
  ProfileTopLevelModuleId,
} from "@/profile/persisted-contract";
import type { ProfilePresentation } from "@/profile/types";
import { SPACING } from "@/theme/tokens/spacing";
import { ProfileRelationshipSheets } from "./ProfileRelationshipSheets";
import {
  RelationshipOverview,
  type RelationshipSheetId,
} from "./RelationshipOverview";
import {
  type KnowledgeActionIntent,
  type KnowledgeChildId,
  type KnowledgeViewAllIntent,
  ThingsToRemember,
} from "./ThingsToRemember";

type CollapsePlacement = {
  id: ProfileCollapsibleModuleId;
  expanded: boolean;
};

type TopLevelPlacement = {
  id: ProfileTopLevelModuleId;
  visible: boolean;
  expanded: boolean;
};

const TOP_LEVEL_MODULE_IDS = new Set<ProfileTopLevelModuleId>([
  "relationship-overview",
  "things-to-remember",
  "contact-methods",
  "interaction-history",
]);

function knowledgeChildSummary(
  snapshot: ProfileSnapshot,
  id: ProfileModuleId,
): string {
  if (snapshot.knowledge.status === "error") return snapshot.knowledge.message;
  const knowledge = snapshot.knowledge.data;
  switch (id) {
    case "pinned-featured":
      return knowledge.featured.total === 0
        ? "Nothing added yet"
        : `${knowledge.featured.total} saved`;
    case "last-talked-about":
      return (
        knowledge.currentState.last_talked_about?.value ?? "Nothing added yet"
      );
    case "key-people":
      return knowledge.relationships.total === 0
        ? "Nothing added yet"
        : `${knowledge.relationships.total} saved`;
    case "current-location":
      return (
        knowledge.currentState.current_location?.value ?? "Nothing added yet"
      );
    case "memories":
      return knowledge.memories.total === 0
        ? "Nothing saved yet"
        : `${knowledge.memories.total} saved`;
    case "custom-fields":
      return knowledge.customFields.length === 0
        ? "Nothing added yet"
        : `${knowledge.customFields.reduce((count, group) => count + group.items.length, 0)} fields`;
    case "off-limits":
      return knowledge.offLimits.length === 0
        ? "Nothing added yet"
        : `${knowledge.offLimits.length} saved`;
    case "imported-contact-notes":
      return knowledge.importedNotes.total === 0
        ? "Nothing added yet"
        : `${knowledge.importedNotes.total} saved`;
    default:
      return "Nothing added yet";
  }
}

function topLevelSummary(
  snapshot: ProfileSnapshot,
  id: ProfileModuleId,
): string {
  switch (id) {
    case "relationship-overview":
      return "Relationship facts";
    case "things-to-remember":
      return snapshot.knowledge.status === "error"
        ? snapshot.knowledge.message
        : (PROFILE_MODULE_EMPTY_SUMMARIES[id] ?? "Things to Remember");
    case "contact-methods":
      return snapshot.methods.phone.length + snapshot.methods.email.length === 0
        ? (PROFILE_MODULE_EMPTY_SUMMARIES[id] ?? "Contact Methods · None")
        : `${snapshot.methods.phone.length + snapshot.methods.email.length} methods`;
    case "interaction-history":
      return snapshot.history.status === "error"
        ? snapshot.history.message
        : snapshot.history.data.summary.text;
    default:
      return "";
  }
}

function ProfileSection({
  id,
  defaultExpanded,
  collapse,
  pending,
  failed,
  summary,
  onToggle,
  children,
}: {
  id: ProfileCollapsibleModuleId;
  defaultExpanded: boolean;
  collapse: ProfileCollapseMap;
  pending: boolean;
  failed: boolean;
  summary: string;
  onToggle: (placement: CollapsePlacement) => void;
  children: React.ReactNode;
}) {
  const state = resolveProfileModuleHostState({
    id,
    defaultExpanded,
    collapse,
  });
  const label = PROFILE_MODULE_REGISTRY[id].label;
  return (
    <GlassSurface style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={state.accessibilityLabel}
        accessibilityState={{ expanded: state.expanded, disabled: pending }}
        disabled={pending}
        onPress={() => onToggle({ id, expanded: defaultExpanded })}
        style={styles.sectionHeader}
      >
        <View style={styles.sectionCopy}>
          <AppText role="heading" accessibilityRole="header">
            {label}
          </AppText>
          <AppText role="caption">{pending ? "Saving…" : summary}</AppText>
        </View>
        <Icon
          name="chevron-down"
          state={state.expanded ? "active" : "default"}
        />
      </Pressable>
      {state.expanded ? (
        <View style={styles.sectionBody}>{children}</View>
      ) : null}
      {failed ? (
        <Button
          role="tertiary"
          label="Retry"
          accessibilityLabel={`Retry saving ${label}`}
          onPress={() => onToggle({ id, expanded: defaultExpanded })}
        />
      ) : null}
    </GlassSurface>
  );
}

export interface ProfileModuleHostProps {
  snapshot: ProfileSnapshot;
  presentation: ProfilePresentation;
  todayLocal: string;
  onOpenHistory: () => void;
  onOpenInsights?: () => void;
  onSetFrequency: (days: number) => Promise<void>;
  onSnooze: (
    request: { preset: "3d" | "1w" | "1m" } | { until: string },
  ) => Promise<void>;
  onUnsnooze: () => Promise<void>;
  /** Screen-owned routing into the source-specific knowledge editors and histories. */
  onKnowledgeAction: (intent: KnowledgeActionIntent) => void;
  /**
   * Reuse the screen's EXISTING knowledge navigation for a History detail-sheet
   * knowledge-change row (decision-preserving — no new cross-stack target).
   */
  onOpenKnowledgeChange: (fieldKey: CurrentStateFieldKey) => void;
  onKnowledgeViewAll: (intent: KnowledgeViewAllIntent) => void;
  onOpenValueHistory: (target: {
    contactId: number;
    fieldDefId: number;
  }) => void;
  /** User-triggered method handoff; the screen owns native action/assist semantics. */
  onContactMethodAction: (
    method:
      | ProfileSnapshot["methods"]["phone"][number]
      | ProfileSnapshot["methods"]["email"][number],
    action: "call" | "message" | "email",
  ) => void;
  /** Lets the thin screen refresh its resolved presentation after a durable write. */
  onCollapseCommitted?: (collapse: ProfileCollapseMap) => void;
}

/**
 * Semantic Profile body renderer. It consumes one aggregate snapshot plus an
 * already-resolved presentation; it neither queries Profile facts nor changes
 * layout JSON. Future plans replace individual renderer bodies by the stable
 * semantic keys in PROFILE_MODULE_RENDERERS.
 */
export function ProfileModuleHost({
  snapshot,
  presentation,
  todayLocal,
  onOpenHistory,
  onOpenInsights,
  onSetFrequency,
  onSnooze,
  onUnsnooze,
  onKnowledgeAction,
  onKnowledgeViewAll,
  onOpenValueHistory,
  onOpenKnowledgeChange,
  onContactMethodAction,
  onCollapseCommitted,
}: ProfileModuleHostProps) {
  const [collapse, setCollapse] = useState<ProfileCollapseMap>(
    presentation.collapse,
  );
  const [pending, setPending] = useState<
    ReadonlySet<ProfileCollapsibleModuleId>
  >(new Set());
  const [failed, setFailed] = useState<ProfileCollapsibleModuleId | null>(null);
  const [activeSheet, setActiveSheet] = useState<RelationshipSheetId | null>(
    null,
  );

  useEffect(() => setCollapse(presentation.collapse), [presentation.collapse]);

  const toggle = useCallback(
    async ({ id, expanded: defaultExpanded }: CollapsePlacement) => {
      if (pending.has(id)) return;
      setPending((current) => new Set(current).add(id));
      setFailed((current) => (current === id ? null : current));
      try {
        const nextExpanded = !(collapse[id] ?? defaultExpanded);
        const exec = getExecutor();
        await setProfileCollapseOverride(exec, {
          contactId: snapshot.identity.id,
          moduleId: id,
          expanded: nextExpanded,
          now: localDateTime(),
        });
        const readback = await readProfileCollapseOverride(
          exec,
          snapshot.identity.id,
        );
        setCollapse(readback);
        onCollapseCommitted?.(readback);
      } catch {
        setFailed(id);
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    },
    [collapse, onCollapseCommitted, pending, snapshot.identity.id],
  );

  const topLevel = presentation.layout.document.topLevel.filter(
    (placement): placement is TopLevelPlacement =>
      placement.visible &&
      TOP_LEVEL_MODULE_IDS.has(placement.id as ProfileTopLevelModuleId),
  );
  const childrenByParent = useMemo(
    () =>
      presentation.layout.document.thingsToRemember.filter(
        (placement) => placement.visible,
      ),
    [presentation.layout.document.thingsToRemember],
  );
  const closeRelationshipSheet = () => setActiveSheet(null);
  const openHistory = () => {
    closeRelationshipSheet();
    onOpenHistory();
  };
  const openInsights = () => {
    closeRelationshipSheet();
    onOpenInsights?.();
  };

  const renderThingsToRemember = () => (
    <View style={styles.stack}>
      {childrenByParent.map((placement) => (
        <ProfileSection
          key={placement.id}
          id={placement.id as ProfileCollapsibleModuleId}
          defaultExpanded={placement.expanded}
          collapse={collapse}
          pending={pending.has(placement.id as ProfileCollapsibleModuleId)}
          failed={failed === placement.id}
          summary={knowledgeChildSummary(snapshot, placement.id)}
          onToggle={toggle}
        >
          {snapshot.knowledge.status === "error" ? (
            <AppText role="body">{snapshot.knowledge.message}</AppText>
          ) : (
            <ThingsToRemember
              contactId={snapshot.identity.id}
              knowledge={snapshot.knowledge.data}
              childIds={[placement.id as KnowledgeChildId]}
              onAction={onKnowledgeAction}
              onViewAll={onKnowledgeViewAll}
              onOpenValueHistory={onOpenValueHistory}
            />
          )}
        </ProfileSection>
      ))}
    </View>
  );

  const renderContactMethods = () => {
    const methods = [...snapshot.methods.phone, ...snapshot.methods.email];
    if (methods.length === 0) {
      return <AppText role="body">Contact Methods · None</AppText>;
    }
    return (
      <View style={styles.stack}>
        {methods.map((method) => (
          <View key={method.uid} style={styles.method}>
            <AppText role="label">{method.label ?? method.method_type}</AppText>
            <AppText role="body">{method.display_value}</AppText>
            {method.is_actionable === 0 ? (
              <AppText role="caption">
                {method.method_type === "phone"
                  ? "This number can’t be used for calls or messages yet."
                  : "This email address can’t be used yet."}
              </AppText>
            ) : null}
            {method.method_type === "phone" ? (
              <View style={styles.methodActions}>
                <Button
                  role="tertiary"
                  label="Call"
                  disabled={method.is_actionable !== 1}
                  accessibilityLabel={`Call ${method.display_value}`}
                  onPress={() => onContactMethodAction(method, "call")}
                />
                <Button
                  role="tertiary"
                  label="Message"
                  disabled={method.is_actionable !== 1}
                  accessibilityLabel={`Message ${method.display_value}`}
                  onPress={() => onContactMethodAction(method, "message")}
                />
              </View>
            ) : (
              <Button
                role="tertiary"
                label="Email"
                disabled={method.is_actionable !== 1}
                accessibilityLabel={`Email ${method.display_value}`}
                onPress={() => onContactMethodAction(method, "email")}
              />
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderHistory = () => {
    if (snapshot.history.status === "error") {
      return <AppText role="body">{snapshot.history.message}</AppText>;
    }
    // The assembled Profile History section (Plan 08): Heatmap + Intensity +
    // Rolodex browser behind this renderer seam, replacing the old
    // channel·occurredAt + "View all history" stub. Layout persistence and the
    // interaction-history summary case are untouched.
    return (
      <HistorySection
        contactId={snapshot.identity.id}
        intervalDays={snapshot.identity.intervalDays}
        trackingEnabled={snapshot.identity.trackingEnabled}
        impactInputs={snapshot.impactInputs}
        onOpenKnowledgeChange={onOpenKnowledgeChange}
      />
    );
  };

  return (
    <View testID="profile-module-host" style={styles.stack}>
      {topLevel.map((placement) => {
        const id = placement.id;
        const renderer = PROFILE_MODULE_RENDERERS[id];
        if (renderer === "relationship-overview") {
          return (
            <ProfileSection
              key={id}
              id={id}
              defaultExpanded={placement.expanded}
              collapse={collapse}
              pending={pending.has(id)}
              failed={failed === id}
              summary={topLevelSummary(snapshot, id)}
              onToggle={toggle}
            >
              <RelationshipOverview
                snapshot={snapshot}
                modules={presentation.layout.document.overview}
                onOpenSheet={setActiveSheet}
                onOpenHistory={openHistory}
              />
            </ProfileSection>
          );
        }
        if (renderer === "things-to-remember") {
          return (
            <ProfileSection
              key={id}
              id={id}
              defaultExpanded={placement.expanded}
              collapse={collapse}
              pending={pending.has(id)}
              failed={failed === id}
              summary={topLevelSummary(snapshot, id)}
              onToggle={toggle}
            >
              {renderThingsToRemember()}
            </ProfileSection>
          );
        }
        if (renderer === "contact-methods") {
          return (
            <ProfileSection
              key={id}
              id={id}
              defaultExpanded={placement.expanded}
              collapse={collapse}
              pending={pending.has(id)}
              failed={failed === id}
              summary={topLevelSummary(snapshot, id)}
              onToggle={toggle}
            >
              {renderContactMethods()}
            </ProfileSection>
          );
        }
        return (
          <ProfileSection
            key={id}
            id={id}
            defaultExpanded={placement.expanded}
            collapse={collapse}
            pending={pending.has(id)}
            failed={failed === id}
            summary={topLevelSummary(snapshot, id)}
            onToggle={toggle}
          >
            {renderHistory()}
          </ProfileSection>
        );
      })}
      <ProfileRelationshipSheets
        active={activeSheet}
        snapshot={snapshot}
        todayLocal={todayLocal}
        onClose={closeRelationshipSheet}
        onOpenHistory={openHistory}
        onOpenInsights={onOpenInsights ? openInsights : undefined}
        onSetFrequency={onSetFrequency}
        onSnooze={onSnooze}
        onUnsnooze={onUnsnooze}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.sm },
  section: { overflow: "hidden" },
  sectionHeader: {
    minHeight: 44,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  sectionCopy: { flex: 1, gap: SPACING.xs },
  sectionBody: { gap: SPACING.sm, padding: SPACING.base },
  method: { gap: SPACING.xs },
  methodActions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
});
