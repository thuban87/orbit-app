// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { HistorySection } from "@/components/history/HistorySection";
import { Icon } from "@/components/icons/Icon";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { getExecutor, localDateTime } from "@/db/database";
import type { CurrentStateFieldKey } from "@/db/memory-registry";
import {
  readProfileCollapseOverride,
  setProfileCollapseOverride,
} from "@/db/profile-presentation-dao";
import type { ProfileSnapshot } from "@/db/profile-read";
import { resolveProfileModuleHostState } from "@/profile/module-host-model";
import {
  PROFILE_MODULE_REGISTRY,
  PROFILE_MODULE_RENDERERS,
} from "@/profile/module-registry";
import type {
  ProfileCollapseMap,
  ProfileCollapsibleModuleId,
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

function ProfileSection({
  id,
  defaultExpanded,
  collapse,
  pending,
  failed,
  errorMessage,
  onToggle,
  headerAction,
  children,
}: {
  id: ProfileCollapsibleModuleId;
  defaultExpanded: boolean;
  collapse: ProfileCollapseMap;
  pending: boolean;
  failed: boolean;
  errorMessage?: string;
  onToggle: (placement: CollapsePlacement) => void;
  headerAction?: React.ReactNode;
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
      <View style={styles.sectionHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={state.accessibilityLabel}
          accessibilityState={{ expanded: state.expanded, disabled: pending }}
          disabled={pending}
          onPress={() => onToggle({ id, expanded: defaultExpanded })}
          style={styles.sectionToggle}
        >
          <View style={styles.sectionCopy}>
            <AppText role="heading" accessibilityRole="header">
              {label}
            </AppText>
            {pending ? <AppText role="caption">Saving…</AppText> : null}
            {!pending && errorMessage ? (
              <AppText role="caption">{errorMessage}</AppText>
            ) : null}
          </View>
          <Icon
            name="chevron-down"
            state={state.expanded ? "active" : "default"}
          />
        </Pressable>
        {headerAction}
      </View>
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
          errorMessage={
            snapshot.knowledge.status === "error"
              ? snapshot.knowledge.message
              : undefined
          }
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

  const knowledgeTarget = (
    id: KnowledgeChildId,
  ): KnowledgeActionIntent["target"] => {
    switch (id) {
      case "last-talked-about":
      case "current-location":
        return { owner: "current-state", id: 0 };
      case "key-people":
        return { owner: "relationship", id: 0 };
      case "custom-fields":
        return { owner: "custom-field", id: 0 };
      case "off-limits":
        return { owner: "fuel", id: 0 };
      case "pinned-featured":
      case "memories":
      case "imported-contact-notes":
        return { owner: "memory", id: 0 };
    }
  };

  const knowledgeHeaderAction = (id: KnowledgeChildId, label?: string) => {
    const actionLabel = label ?? PROFILE_MODULE_REGISTRY[id].label;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${actionLabel}`}
        hitSlop={8}
        onPress={() =>
          onKnowledgeAction({
            action: "edit",
            childId: id,
            target: knowledgeTarget(id),
          })
        }
        style={styles.sectionEdit}
      >
        <Icon name="edit" tone="accentText" />
      </Pressable>
    );
  };

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
              errorMessage={undefined}
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
              errorMessage={
                snapshot.knowledge.status === "error"
                  ? snapshot.knowledge.message
                  : undefined
              }
              onToggle={toggle}
              headerAction={knowledgeHeaderAction(
                // The top-level module ID is not a knowledge child ID. Route the
                // collection action through its memory owner instead.
                "memories",
                PROFILE_MODULE_REGISTRY[placement.id].label,
              )}
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
              errorMessage={undefined}
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
            errorMessage={
              snapshot.history.status === "error"
                ? snapshot.history.message
                : undefined
            }
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
    gap: SPACING.sm,
  },
  sectionToggle: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
  },
  sectionEdit: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  sectionCopy: { flex: 1, gap: SPACING.xs },
  sectionBody: { gap: SPACING.sm, padding: SPACING.base },
  method: { gap: SPACING.xs },
  methodActions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
});
