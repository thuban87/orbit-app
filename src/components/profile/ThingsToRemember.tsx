// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { useMemo, useState } from "react";
import {
  type AccessibilityActionEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Icon } from "@/components/icons/Icon";
import { openMemoryLink } from "@/components/MemoryCard";
import { AppText, Button, Sheet } from "@/components/ui";
import { CLOSE } from "@/constants/glossary";
import { HIDE_FROM_PROFILE_ENABLED } from "@/db/memory-registry";
import type { ProfileKnowledge } from "@/db/profile-knowledge-read";
import {
  buildKnowledgePresentation,
  type KnowledgeAction,
  type KnowledgeChildId,
  type KnowledgeDetailTarget,
  type KnowledgeEntryLink,
  type KnowledgePresentationChild,
  type KnowledgePresentationItem,
  knowledgeChildTarget,
} from "@/profile/knowledge-presentation";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { ProfileHeading } from "./ProfileHeading";

export type { KnowledgeChildId } from "@/profile/knowledge-presentation";

export interface KnowledgeActionIntent {
  action: KnowledgeAction;
  target: KnowledgeDetailTarget;
  /** Present for a heading action that manages the entire child collection. */
  childId?: KnowledgeChildId;
  /**
   * Which section-level control fired: the heading action (absent) or an
   * empty section's "Add …" (D-68), whose destination differs.
   */
  affordance?: "heading" | "empty";
}

/** The entry sheet's and the card's action labels (D-87). */
const ACTION_LABELS: Readonly<Record<KnowledgeAction, string>> = {
  edit: "Edit",
  pin: "Pin",
  unpin: "Unpin",
};

function isKnowledgeAction(name: string): name is KnowledgeAction {
  return Object.hasOwn(ACTION_LABELS, name);
}

export interface KnowledgeViewAllIntent {
  id: KnowledgeChildId;
  includeHidden: boolean;
}

export interface ThingsToRememberProps {
  contactId: number;
  knowledge: ProfileKnowledge;
  /** The module host uses this to preserve each child's independent collapse state. */
  childIds?: readonly KnowledgeChildId[];
  /** Parent routes these source-owned intents to the owning editor/DAO surface. */
  onAction: (intent: KnowledgeActionIntent) => void;
  /** Parent opens the owner-backed dense View all reader; Profile never re-queries here. */
  onViewAll: (intent: KnowledgeViewAllIntent) => void;
  /** Opens the owner-backed retained-value history reader for a custom field. */
  onOpenValueHistory: (target: {
    contactId: number;
    fieldDefId: number;
  }) => void;
  /**
   * Opens the interaction a linked entry belongs to (D-107, D-37). Optional:
   * without it a linked card opens its sheet like any other.
   */
  onOpenLinked?: (link: KnowledgeEntryLink) => void;
}

function childIcon(id: KnowledgeChildId): "favorite" | "message" | "settings" {
  switch (id) {
    case "pinned-featured":
      return "favorite";
    case "last-talked-about":
    case "key-people":
    case "current-location":
    case "memories":
    case "thought-of-them":
    case "gift-ideas":
    case "custom-fields":
    case "off-limits":
    case "imported-contact-notes":
      return "message";
    default:
      return "settings";
  }
}

/**
 * An entry's detail sheet. A flagged custom-field value (38.12 D-70) shows one
 * "needs attention" line, in the danger colour, with how to fix it; the
 * metadata marker the card shows is not repeated here (review C-WR-04).
 * Exported for its render test.
 */
export function DetailSheet({
  item,
  onClose,
  onAction,
  onOpenValueHistory,
}: {
  item: KnowledgePresentationItem | null;
  onClose: () => void;
  onAction: (intent: KnowledgeActionIntent) => void;
  onOpenValueHistory: (target: {
    contactId: number;
    fieldDefId: number;
  }) => void;
}) {
  const { colors } = useTheme();
  const url = item?.detail.url;
  return (
    <Sheet visible={item !== null} onRequestClose={onClose} variant="detail">
      {item ? (
        <View style={styles.sheetContent}>
          <AppText role="heading">{item.title}</AppText>
          {item.preview ? <AppText role="body">{item.preview}</AppText> : null}
          {/* D-70: the invalid line below is the sheet's one marker. */}
          {item.invalid
            ? null
            : item.metadata.map((entry) => (
                <AppText key={entry} role="caption">
                  {entry}
                </AppText>
              ))}
          {url ? (
            // D-24: a link entry's sheet shows its URL with Open.
            <View style={styles.link}>
              <AppText role="caption" numberOfLines={2}>
                {url}
              </AppText>
              <Button
                role="tertiary"
                label="Open"
                accessibilityLabel="Open link"
                onPress={() => openMemoryLink(url)}
              />
            </View>
          ) : null}
          {item.invalid ? (
            <AppText role="caption" style={{ color: colors.danger }}>
              This value needs attention. Tap Edit to fix it.
            </AppText>
          ) : null}
          {item.history ? (
            <Button
              role="tertiary"
              label="View history"
              // Close the sheet first, as the other actions do, so it does
              // not stay over the history screen (38.12 D-106).
              onPress={() => {
                if (item.history) onOpenValueHistory(item.history);
                onClose();
              }}
            />
          ) : null}
          {item.management.accessibility.map((action) => (
            <Button
              key={action}
              role="tertiary"
              label={ACTION_LABELS[action]}
              onPress={() => {
                onAction({ action, target: item.detail });
                onClose();
              }}
            />
          ))}
          <Button role="secondary" label={CLOSE} onPress={onClose} />
        </View>
      ) : null}
    </Sheet>
  );
}

/**
 * One entry card. Tap opens a linked entry's interaction (D-107) or the
 * entry's sheet; long-press opens the sheet; the screen-reader actions run
 * Edit, Pin or Unpin directly. A flagged custom-field value (38.12 D-70)
 * shows its one "Needs attention" marker in the danger colour, and its tap
 * goes straight to Edit (Edit Contact at that field); long-press still opens
 * the sheet.
 */
export function KnowledgeCard({
  item,
  onOpen,
  onAction,
  onOpenLinked,
  hideTitle = false,
}: {
  item: KnowledgePresentationItem;
  onOpen: () => void;
  onAction: (action: KnowledgeAction) => void;
  onOpenLinked?: (link: KnowledgeEntryLink) => void;
  hideTitle?: boolean;
}) {
  const { colors } = useTheme();
  const link = item.detail.link;
  const onPress = item.invalid
    ? () => onAction("edit")
    : link && onOpenLinked
      ? () => onOpenLinked(link)
      : onOpen;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${item.invalid ? ", needs attention" : ""}${item.pinned ? ", pinned" : ""}`}
      accessibilityHint={
        item.invalid ? "Opens Edit Contact to fix it" : undefined
      }
      accessibilityActions={item.management.accessibility.map((action) => ({
        name: action,
        label: ACTION_LABELS[action],
      }))}
      onAccessibilityAction={(event: AccessibilityActionEvent) => {
        const name = event.nativeEvent.actionName;
        if (isKnowledgeAction(name)) onAction(name);
      }}
      onLongPress={onOpen}
      onPress={onPress}
      style={styles.card}
    >
      {!hideTitle ? (
        <View style={styles.cardHeading}>
          <AppText role="label">{item.title}</AppText>
          {item.sparkle ? (
            <Icon name="sparkle" tone="accentText" size="sm" />
          ) : null}
          {item.pinned ? (
            // The pushpin replaces the word "Pinned" (D-133); decorative here,
            // the card's label carries ", pinned".
            <Icon name="pin" tone="textSecondary" size="sm" />
          ) : null}
        </View>
      ) : null}
      {item.preview ? (
        <AppText numberOfLines={2} role="body">
          {item.preview}
        </AppText>
      ) : null}
      {/* The one "Needs attention" marker is the item's metadata entry,
          drawn in the danger colour (38.12 D-70). */}
      {item.metadata.map((entry) => (
        <AppText
          key={entry}
          role="caption"
          style={item.invalid ? { color: colors.danger } : undefined}
        >
          {entry}
        </AppText>
      ))}
    </Pressable>
  );
}

export function KnowledgeChild({
  child,
  suppressHeading,
  onOpen,
  onItemAction,
  onOpenLinked,
  onEmptyAdd,
  onViewAll,
}: {
  child: KnowledgePresentationChild;
  /** A one-child ProfileSection already supplies this semantic heading. */
  suppressHeading: boolean;
  onOpen: (item: KnowledgePresentationItem) => void;
  onItemAction: (
    item: KnowledgePresentationItem,
    action: KnowledgeAction,
  ) => void;
  onOpenLinked?: (link: KnowledgeEntryLink) => void;
  /** An empty section's "Add …" (D-68). */
  onEmptyAdd: (child: KnowledgePresentationChild) => void;
  onViewAll: (
    child: KnowledgePresentationChild,
    includeHidden: boolean,
  ) => void;
}) {
  const [showingHidden, setShowingHidden] = useState(false);
  const mostRecent = child.items.filter(
    (item) => item.temporalPosition === "most-recent",
  );
  const previous = child.items.filter(
    (item) => item.temporalPosition === "previous",
  );
  const isTemporal = mostRecent.length > 0 || previous.length > 0;
  return (
    <View style={styles.child}>
      {suppressHeading ? null : (
        <View style={styles.childHeading}>
          <Icon name={childIcon(child.id)} tone="textSecondary" size="sm" />
          <View style={styles.childCopy}>
            <AppText role="heading">{child.title}</AppText>
          </View>
        </View>
      )}
      {child.bodySummary ? (
        <AppText role="body">{child.bodySummary}</AppText>
      ) : null}
      {child.helper ? <AppText role="caption">{child.helper}</AppText> : null}
      {child.items.length === 0 && child.emptyAction ? (
        // D-68: an empty section's "Add …" opens its add form.
        <Button
          role="tertiary"
          label={child.emptyAction}
          onPress={() => onEmptyAdd(child)}
        />
      ) : null}
      {isTemporal ? (
        <View style={styles.temporal}>
          {mostRecent.length > 0 ? (
            <View style={styles.temporalGroup}>
              <ProfileHeading level="h3">MOST RECENT</ProfileHeading>
              {mostRecent.map((item) => (
                <KnowledgeCard
                  key={item.id}
                  item={item}
                  hideTitle
                  onOpen={() => onOpen(item)}
                  onAction={(action) => onItemAction(item, action)}
                  onOpenLinked={onOpenLinked}
                />
              ))}
            </View>
          ) : null}
          {previous.length > 0 ? (
            <View style={styles.temporalGroup}>
              <ProfileHeading level="h3">PREVIOUS</ProfileHeading>
              {previous.map((item) => (
                <KnowledgeCard
                  key={item.id}
                  item={item}
                  hideTitle
                  onOpen={() => onOpen(item)}
                  onAction={(action) => onItemAction(item, action)}
                  onOpenLinked={onOpenLinked}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {!isTemporal
        ? child.groups.map((group, index) => (
            <View key={group.name ?? `direct-${index}`} style={styles.group}>
              {group.heading ? (
                <ProfileHeading level="h3">{group.heading}</ProfileHeading>
              ) : null}
              {group.items.map((item) => (
                <KnowledgeCard
                  key={item.id}
                  item={item}
                  onOpen={() => onOpen(item)}
                  onAction={(action) => onItemAction(item, action)}
                  onOpenLinked={onOpenLinked}
                />
              ))}
            </View>
          ))
        : null}
      {!isTemporal && child.groups.length === 0
        ? child.items.map((item) => (
            <KnowledgeCard
              key={item.id}
              item={item}
              onOpen={() => onOpen(item)}
              onAction={(action) => onItemAction(item, action)}
              onOpenLinked={onOpenLinked}
            />
          ))
        : null}
      {child.viewAllLabel ? (
        <Button
          role="tertiary"
          label={child.viewAllLabel}
          onPress={() => onViewAll(child, showingHidden)}
        />
      ) : null}
      {/* Gated on the switch too, so the UI rule never rests on the data
          rule alone (D-134). */}
      {HIDE_FROM_PROFILE_ENABLED && child.showHiddenAvailable ? (
        <Button
          role="tertiary"
          label={showingHidden ? "Hide hidden" : "Show hidden"}
          onPress={() => {
            const next = !showingHidden;
            setShowingHidden(next);
            onViewAll(child, next);
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * Compact, one-column Things to Remember renderer. It maps the typed Profile
 * snapshot into visual cards only; all details, edits, recovery and history
 * remain explicit intents for their semantic owners.
 */
export function ThingsToRemember({
  contactId,
  knowledge,
  childIds,
  onAction,
  onViewAll,
  onOpenValueHistory,
  onOpenLinked,
}: ThingsToRememberProps) {
  const presentation = useMemo(
    () => buildKnowledgePresentation({ contactId, knowledge }),
    [contactId, knowledge],
  );
  const [selected, setSelected] = useState<KnowledgePresentationItem | null>(
    null,
  );
  const children = childIds
    ? presentation.children.filter((child) => childIds.includes(child.id))
    : presentation.children;
  return (
    <View style={styles.container}>
      {children.map((child) => (
        <KnowledgeChild
          key={child.id}
          child={child}
          suppressHeading={childIds?.length === 1}
          onOpen={setSelected}
          onItemAction={(item, action) =>
            onAction({ action, target: item.detail })
          }
          onOpenLinked={onOpenLinked}
          onEmptyAdd={(target) =>
            onAction({
              action: "edit",
              childId: target.id,
              target: knowledgeChildTarget(target.id),
              affordance: "empty",
            })
          }
          onViewAll={(target, includeHidden) =>
            onViewAll({ id: target.id, includeHidden })
          }
        />
      ))}
      <DetailSheet
        item={selected}
        onClose={() => setSelected(null)}
        onAction={onAction}
        onOpenValueHistory={onOpenValueHistory}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.xs, paddingVertical: SPACING.sm },
  cardHeading: { alignItems: "center", flexDirection: "row", gap: SPACING.sm },
  child: { gap: SPACING.xs },
  childCopy: { flex: 1, gap: SPACING.xs },
  childHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  container: { gap: SPACING.lg },
  group: { gap: SPACING.xs },
  link: { gap: SPACING.xs },
  sheetContent: { gap: SPACING.sm },
  temporal: { gap: SPACING.lg },
  temporalGroup: { gap: SPACING.xs },
});
