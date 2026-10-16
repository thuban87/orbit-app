// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { HistorySection } from "@/components/history/HistorySection";
import { Icon } from "@/components/icons/Icon";
import { SnoozeSheet } from "@/components/SnoozeSheet";
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
import {
  childHasEntries,
  headingActionFor,
  type KnowledgeEntryLink,
  knowledgeChildTarget,
} from "@/profile/knowledge-presentation";
import {
  completeHistoryScroll,
  createHistoryRevealScroll,
  type HistoryRevealScroll,
  resolveHistoryReveal,
  resolveProfileModuleHostState,
} from "@/profile/module-host-model";
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
import { isSnoozed } from "@/utils/dates";
import { Logger } from "@/utils/logger";
import { BirthdaySheet } from "./BirthdaySheet";
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

const LOG_SCOPE = "profile-module-host";

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
  /**
   * The Profile snapshot's publication revision (38.3 RG-024). HistorySection
   * re-reads on every change, so History and the metrics share one trigger.
   */
  historyRevision: number;
  /**
   * Scroll the Profile's own ScrollView to a content y (38.3 RG-021, D-10). The
   * Last Interaction tile and the Status sheet's "View history" reveal the
   * in-Profile History section through it — no route, no timeline (ADR-123).
   * The screen owns reduced motion.
   */
  onRequestScrollTo: (y: number) => void;
  onOpenInsights?: () => void;
  onSetFrequency: (days: number) => Promise<void>;
  onSnooze: (
    request: { preset: "3d" | "1w" | "1m" } | { until: string },
  ) => Promise<void>;
  onUnsnooze: () => Promise<void>;
  /**
   * Saves the birthday from the Birthday sheet (38.11 D-59): null clears.
   * Rejects on failure so the sheet keeps itself open and shows the error.
   */
  onSaveBirthday: (birthday: string | null) => Promise<void>;
  /** Screen-owned routing into the source-specific knowledge editors and histories. */
  onKnowledgeAction: (intent: KnowledgeActionIntent) => void;
  /**
   * Reuse the screen's EXISTING knowledge navigation for a History detail-sheet
   * knowledge-change row (decision-preserving — no new cross-stack target).
   */
  onOpenKnowledgeChange: (fieldKey: CurrentStateFieldKey) => void;
  onKnowledgeViewAll: (intent: KnowledgeViewAllIntent) => void;
  /**
   * Opens the interaction a linked entry belongs to (D-107). Optional: without
   * it a linked card opens its sheet.
   */
  onOpenLinked?: (link: KnowledgeEntryLink) => void;
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
  historyRevision,
  onRequestScrollTo,
  onOpenInsights,
  onSetFrequency,
  onSnooze,
  onUnsnooze,
  onSaveBirthday,
  onKnowledgeAction,
  onKnowledgeViewAll,
  onOpenLinked,
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

  // Resolves to the committed collapse map, or null when nothing was written
  // (already pending, or the write failed and the section shows Retry).
  const toggle = useCallback(
    async ({
      id,
      expanded: defaultExpanded,
    }: CollapsePlacement): Promise<ProfileCollapseMap | null> => {
      if (pending.has(id)) return null;
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
        return readback;
      } catch {
        setFailed(id);
        return null;
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
  // 38.11 D-45 (review W-01): the shared snooze sheet gets the EFFECTIVE end —
  // an expired `snooze_until` reads as not snoozed.
  const rawSnoozeUntil = snapshot.identity.snoozeUntil ?? null;
  const effectiveSnoozeUntil = isSnoozed(rawSnoozeUntil, todayLocal)
    ? rawSnoozeUntil
    : null;

  // 38.3 RG-021 (D-10, D-11, D-28): Last Interaction and Status → View history
  // reveal the in-Profile History section. Offered only when the layout shows
  // History; a collapsed History expands through the SAME persisted `toggle` a
  // header tap uses (D-28), and History's period/selection is never touched.
  const historyReveal = resolveHistoryReveal({ topLevel, collapse });
  const historyExpanded = historyReveal.available && !historyReveal.needsExpand;
  const requestScroll = useRef(onRequestScrollTo);
  requestScroll.current = onRequestScrollTo;
  const revealScroll = useRef<HistoryRevealScroll | null>(null);
  if (revealScroll.current === null) {
    revealScroll.current = createHistoryRevealScroll((y) =>
      requestScroll.current(y),
    );
  }
  const scroller = revealScroll.current;
  const revealHistory = () => {
    closeRelationshipSheet();
    scroller.reveal(historyReveal.needsExpand);
    if (!historyReveal.needsExpand) return;
    void toggle({
      id: "interaction-history",
      expanded: historyReveal.defaultExpanded,
    }).then((readback) =>
      scroller.expandSettled(
        readback !== null &&
          resolveProfileModuleHostState({
            id: "interaction-history",
            defaultExpanded: historyReveal.defaultExpanded,
            collapse: readback,
          }).expanded,
      ),
    );
  };
  const openHistory = historyReveal.available ? revealHistory : undefined;

  // 38.8 D-19/D-20 (RESEARCH Pattern 3; C2-01): a heatmap jump scrolls to a
  // day group inside History. The target is measured against the History
  // anchor (the ref form of measureLayout, not a node handle) and the request
  // carries its own staleness check; the host keeps no request state. The
  // empty-day note (38.8 D-73) asks to land `leadIn` above its own top.
  const historyAnchorRef = useRef<View>(null);
  const requestHistoryScroll = (
    target: View,
    isCurrent: () => boolean,
    onResult: (ok: boolean) => void,
    leadIn = 0,
  ) => {
    const anchor = historyAnchorRef.current;
    if (!anchor) {
      if (isCurrent()) onResult(false);
      return;
    }
    target.measureLayout(
      anchor,
      (_x, y) =>
        completeHistoryScroll(scroller, y, isCurrent, onResult, leadIn),
      () => {
        // Content-free: no contact data in the log line.
        Logger.warn(LOG_SCOPE, "history scroll measure failed");
        if (isCurrent()) onResult(false);
      },
    );
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
          // One heading action only once a section has entries (D-72): the
          // same rule as the empty line and its "Add …", so the two never
          // both show. An error snapshot draws none.
          headerAction={
            snapshot.knowledge.status === "ready" &&
            childHasEntries(
              placement.id as KnowledgeChildId,
              snapshot.knowledge.data,
            )
              ? knowledgeHeaderAction(placement.id as KnowledgeChildId)
              : null
          }
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
              onOpenLinked={onOpenLinked}
              onOpenValueHistory={onOpenValueHistory}
            />
          )}
        </ProfileSection>
      ))}
    </View>
  );

  // Add for a section the user adds to, the pencil for one edited in its own
  // editor, nothing for Pinned (D-72; the one table is `headingActionFor`).
  // Both emit an `edit` intent; the screen picks the destination per id.
  const knowledgeHeaderAction = (id: KnowledgeChildId, label?: string) => {
    const kind = headingActionFor(id);
    if (kind === "none") return null;
    const actionLabel = label ?? PROFILE_MODULE_REGISTRY[id].label;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          kind === "add" ? `Add ${actionLabel}` : `Edit ${actionLabel}`
        }
        hitSlop={8}
        onPress={() =>
          onKnowledgeAction({
            action: "edit",
            childId: id,
            target: knowledgeChildTarget(id),
          })
        }
        style={styles.sectionEdit}
      >
        <Icon name={kind === "add" ? "add" : "edit"} tone="accentText" />
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
      // History's laid-out content too, so an expanding reveal settles on it
      // (38.8 D-72).
      return (
        <AppText
          role="body"
          testID="profile-history-error"
          onLayout={scroller.historyContentLayout}
        >
          {snapshot.history.message}
        </AppText>
      );
    }
    // The assembled Profile History section (Plan 08; 38.8 D-10): the heatmap,
    // Intensity and the History stream behind this renderer seam. Keyed by the
    // contact so its transient view state starts fresh on a contact change
    // (38.8 D-62); a heatmap jump scrolls through `requestHistoryScroll`, and
    // its loaded content's layout settles an expanding reveal (38.8 D-72).
    return (
      <HistorySection
        key={snapshot.identity.id}
        contactId={snapshot.identity.id}
        revision={historyRevision}
        intervalDays={snapshot.identity.intervalDays}
        trackingEnabled={snapshot.identity.trackingEnabled}
        impactInputs={snapshot.impactInputs}
        onOpenKnowledgeChange={onOpenKnowledgeChange}
        onRequestHistoryScroll={requestHistoryScroll}
        onContentLayout={scroller.historyContentLayout}
      />
    );
  };

  return (
    <View
      testID="profile-module-host"
      style={styles.stack}
      onLayout={(event: LayoutChangeEvent) =>
        scroller.hostLayout(event.nativeEvent.layout.y)
      }
    >
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
          <View
            key={id}
            ref={historyAnchorRef}
            collapsable={false}
            testID="profile-history-anchor"
            onLayout={(event: LayoutChangeEvent) =>
              scroller.historyLayout(
                event.nativeEvent.layout.y,
                historyExpanded,
              )
            }
          >
            <ProfileSection
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
          </View>
        );
      })}
      <ProfileRelationshipSheets
        // The Birthday and Snooze tiles open their own sheets (38.11 D-56,
        // D-45), below.
        active={
          activeSheet === "birthday" || activeSheet === "snooze"
            ? null
            : activeSheet
        }
        snapshot={snapshot}
        onClose={closeRelationshipSheet}
        onOpenHistory={openHistory}
        onOpenInsights={onOpenInsights ? openInsights : undefined}
        onSetFrequency={onSetFrequency}
      />
      <SnoozeSheet
        // 38.11 D-45 (review T-06): the Overview tile's sheet stays hosted
        // here; the ⋯ "Snooze…" entry renders the same component from the
        // screen, wired to the same onSnooze / onUnsnooze.
        visible={activeSheet === "snooze"}
        title={`Snooze ${snapshot.identity.name}`}
        snoozedUntil={effectiveSnoozeUntil}
        showUnsnooze={effectiveSnoozeUntil !== null}
        todayLocal={todayLocal}
        onPreset={(preset) => onSnooze({ preset })}
        onUntil={(until) => onSnooze({ until })}
        onUnsnooze={onUnsnooze}
        confirmName={snapshot.identity.name}
        onRestore={(previousUntil) =>
          previousUntil === null
            ? onUnsnooze()
            : onSnooze({ until: previousUntil })
        }
        onClose={closeRelationshipSheet}
      />
      <BirthdaySheet
        visible={activeSheet === "birthday"}
        birthday={snapshot.identity.birthday}
        onSave={onSaveBirthday}
        onClose={closeRelationshipSheet}
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
