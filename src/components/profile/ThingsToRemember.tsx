// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import { AppText, Button, Sheet } from "@/components/ui";
import type { ProfileKnowledge } from "@/db/profile-knowledge-read";
import {
  buildKnowledgePresentation,
  type KnowledgeAction,
  type KnowledgeChildId,
  type KnowledgeDetailTarget,
  type KnowledgePresentationChild,
  type KnowledgePresentationItem,
} from "@/profile/knowledge-presentation";
import { SPACING } from "@/theme/tokens/spacing";

export type { KnowledgeChildId } from "@/profile/knowledge-presentation";

export interface KnowledgeActionIntent {
  action: KnowledgeAction;
  target: KnowledgeDetailTarget;
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
}

function childIcon(id: KnowledgeChildId): "favorite" | "message" | "settings" {
  switch (id) {
    case "pinned-featured":
      return "favorite";
    case "last-talked-about":
    case "key-people":
    case "current-location":
    case "memories":
    case "custom-fields":
    case "off-limits":
    case "imported-contact-notes":
      return "message";
    default:
      return "settings";
  }
}

function DetailSheet({
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
  return (
    <Sheet visible={item !== null} onRequestClose={onClose} variant="detail">
      {item ? (
        <View style={styles.sheetContent}>
          <AppText role="heading">{item.title}</AppText>
          {item.preview ? <AppText role="body">{item.preview}</AppText> : null}
          {item.metadata.map((entry) => (
            <AppText key={entry} role="caption">
              {entry}
            </AppText>
          ))}
          {item.invalid ? (
            <AppText role="caption">
              This value needs attention. Tap Edit to fix it.
            </AppText>
          ) : null}
          {item.history ? (
            <Button
              role="tertiary"
              label="View history"
              onPress={() => item.history && onOpenValueHistory(item.history)}
            />
          ) : null}
          {item.management.accessibility.map((action) => (
            <Button
              key={action}
              role="tertiary"
              label={action === "hide" ? "Hide from Profile" : action}
              onPress={() => {
                onAction({ action, target: item.detail });
                onClose();
              }}
            />
          ))}
          <Button role="secondary" label="Done" onPress={onClose} />
        </View>
      ) : null}
    </Sheet>
  );
}

function KnowledgeCard({
  item,
  onOpen,
  onManage,
}: {
  item: KnowledgePresentationItem;
  onOpen: () => void;
  onManage: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${item.invalid ? ", needs attention" : ""}`}
      accessibilityActions={item.management.accessibility.map((action) => ({
        name: action,
        label: action === "hide" ? "Hide from Profile" : action,
      }))}
      onAccessibilityAction={() => onManage()}
      onLongPress={onManage}
      onPress={onOpen}
      style={styles.card}
    >
      <View style={styles.cardHeading}>
        <AppText role="label">{item.title}</AppText>
        {item.sparkle ? (
          <Icon name="sparkle" tone="accentText" size="sm" />
        ) : null}
      </View>
      {item.preview ? (
        <AppText numberOfLines={2} role="body">
          {item.preview}
        </AppText>
      ) : null}
      {item.metadata.map((entry) => (
        <AppText key={entry} role="caption">
          {entry}
        </AppText>
      ))}
      {item.invalid ? <AppText role="caption">Needs attention</AppText> : null}
      <Button
        role="tertiary"
        label="Manage"
        accessibilityLabel={`Manage ${item.title}`}
        onPress={onManage}
      />
    </Pressable>
  );
}

function KnowledgeChild({
  child,
  onOpen,
  onViewAll,
}: {
  child: KnowledgePresentationChild;
  onOpen: (item: KnowledgePresentationItem) => void;
  onViewAll: (
    child: KnowledgePresentationChild,
    includeHidden: boolean,
  ) => void;
}) {
  const [showingHidden, setShowingHidden] = useState(false);
  return (
    <View style={styles.child}>
      <View style={styles.childHeading}>
        <Icon name={childIcon(child.id)} tone="textSecondary" size="sm" />
        <View style={styles.childCopy}>
          <AppText role="heading">{child.title}</AppText>
          <AppText role="caption">{child.summary}</AppText>
          {child.helper ? (
            <AppText role="caption">{child.helper}</AppText>
          ) : null}
        </View>
      </View>
      {child.groups.map((group, index) => (
        <View key={group.name ?? `direct-${index}`} style={styles.group}>
          {group.heading ? (
            <AppText role="label">{group.heading}</AppText>
          ) : null}
          {group.items.map((item) => (
            <KnowledgeCard
              key={item.id}
              item={item}
              onOpen={() => onOpen(item)}
              onManage={() => onOpen(item)}
            />
          ))}
        </View>
      ))}
      {child.groups.length === 0
        ? child.items.map((item) => (
            <KnowledgeCard
              key={item.id}
              item={item}
              onOpen={() => onOpen(item)}
              onManage={() => onOpen(item)}
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
      {child.showHiddenAvailable ? (
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
          onOpen={setSelected}
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
  sheetContent: { gap: SPACING.sm },
});
