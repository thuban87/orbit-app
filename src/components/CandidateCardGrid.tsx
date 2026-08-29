import { Image } from "expo-image";
import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import {
  ConfidenceChip,
  type ConfidenceOutcome,
} from "@/components/ConfidenceChip";
import { useTheme } from "@/theme";

export type BulkAction = "link" | "import-new" | "skip" | "apply-recommendation";

export interface CandidateChoice {
  contactId: number;
  name: string;
  photoUri?: string | null;
  evidenceHint?: string;
}

export interface CandidateItem {
  id: string | number;
  name: string;
  outcome: ConfidenceOutcome;
  evidenceHint: string;
  /** A caller-resolved file URI. Raw stored photo paths must never be supplied here. */
  photoUri: string | null;
  candidates?: CandidateChoice[];
}

interface CandidateCardGridProps {
  items: CandidateItem[];
  bulkActions: BulkAction[];
  onInspect: (item: CandidateItem) => void;
  onBulkAction: (action: BulkAction, items: CandidateItem[]) => Promise<void> | void;
  /** Generic Phase 20 safety contract: recommendation never resolves these items. */
  recommendationExcludes: "needs_review";
  scoring?: boolean;
}

const actionLabels: Record<BulkAction, string> = {
  link: "Link to Existing",
  "import-new": "Import as New",
  skip: "Skip",
  "apply-recommendation": "Apply recommendation",
};

export function CandidateCardGrid({
  items,
  bulkActions,
  onInspect,
  onBulkAction,
  recommendationExcludes,
  scoring = false,
}: CandidateCardGridProps) {
  const { colors } = useTheme();
  const [selectedIds, setSelectedIds] = useState<Set<CandidateItem["id"]>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<CandidateItem["id"]>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<CandidateItem["id"]>>(new Set());
  const [actionsOpen, setActionsOpen] = useState(false);

  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const multiSelect = selectedIds.size > 0;

  const toggleSelection = (item: CandidateItem) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  };

  const runBulkAction = async (action: BulkAction) => {
    const targets =
      action === "apply-recommendation"
        ? selectedItems.filter((item) => item.outcome !== recommendationExcludes)
        : selectedItems;
    setActionsOpen(false);
    if (targets.length === 0) return;

    try {
      await onBulkAction(action, targets);
      setFailedIds((current) => {
        const next = new Set(current);
        targets.forEach((item) => next.delete(item.id));
        return next;
      });
      setSelectedIds(new Set());
    } catch {
      // Keep the rest of the grid usable and make the affected cards retryable.
      setFailedIds((current) => new Set([...current, ...targets.map((item) => item.id)]));
    }
  };

  if (scoring) {
    return (
      <View style={styles.progress}>
        <Text style={{ color: colors.textSecondary }}>Checking for matches…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => {
          const selected = selectedIds.has(item.id);
          const showPhoto = item.photoUri != null && !imageErrors.has(item.id);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => (multiSelect ? toggleSelection(item) : onInspect(item))}
              onLongPress={() => toggleSelection(item)}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: selected ? colors.borderStrong : colors.border,
                },
                selected && { borderWidth: 2 },
              ]}
            >
              {showPhoto ? (
                <Image
                  accessibilityLabel={`Photo of ${item.name}`}
                  source={{ uri: item.photoUri ?? undefined }}
                  contentFit="cover"
                  onError={() =>
                    setImageErrors((current) => new Set([...current, item.id]))
                  }
                  style={styles.photo}
                />
              ) : (
                <Avatar photo={null} name={item.name} size={48} contactId={item.id} />
              )}
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.name, { color: colors.textPrimary }]}
              >
                {item.name}
              </Text>
              <ConfidenceChip outcome={item.outcome} />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.hint, { color: colors.textSecondary }]}
              >
                {item.evidenceHint}
              </Text>
              {failedIds.has(item.id) ? (
                <Text style={[styles.error, { color: colors.textSecondary }]}>
                  This action could not be completed. Try again.
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />

      {multiSelect ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setActionsOpen(true)}
          style={[styles.actionBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        >
          <Text style={[styles.actionBarText, { color: colors.textPrimary }]}>
            {selectedItems.length} selected · Choose action
          </Text>
        </Pressable>
      ) : null}

      <Modal
        visible={actionsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setActionsOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Dismiss bulk actions"
            onPress={() => setActionsOpen(false)}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: 0.85 }]}
          />
          <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {bulkActions.map((action) => (
              <Pressable
                key={action}
                accessibilityRole="button"
                onPress={() => void runBulkAction(action)}
                style={[styles.option, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textPrimary }}>{actionLabels[action]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { gap: 8, padding: 16 },
  row: { gap: 8 },
  card: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    gap: 8,
    padding: 12,
  },
  photo: { width: 48, height: 48, borderRadius: 24 },
  name: { fontSize: 15, fontWeight: "400" },
  hint: { fontSize: 13, fontWeight: "400" },
  error: { fontSize: 13, fontWeight: "600" },
  progress: { alignItems: "center", justifyContent: "center", minHeight: 120 },
  actionBar: {
    borderTopWidth: 1,
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  actionBarText: { fontSize: 16, fontWeight: "600" },
  modalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  sheet: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  option: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 14 },
});
