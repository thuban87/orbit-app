/** Virtualized, responsive Dashboard card renderer over the shared result model. */
import type { ReactElement } from "react";
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions } from "react-native";
import type { DashboardRow } from "@/db/dashboard-read";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { GridCard } from "./GridCard";

export interface CardGridProps {
  rows: DashboardRow[];
  now: string;
  onPressContact: (contactId: number) => void;
  favouriteOverlay: ReadonlyMap<number, boolean>;
  onToggleFavourite: (contactId: number, nextMembership: boolean) => void;
  /** Mirrors the list renderer's empty-data error/loading gate. */
  error: boolean;
  showInitialSkeleton: boolean;
  loadingSkeleton: ReactElement | null;
  listHeader: ReactElement | null;
  listEmpty: ReactElement | null;
  refreshing: boolean;
  onRefresh: () => void;
  bottomClearance: number;
}

/** Portrait grid count; device UAT owns the exact thresholds. */
export function gridColumnCount(width: number, fontScale: number): number {
  if (width < 360 || fontScale >= 1.4) return 2;
  if (width >= 768 && fontScale <= 1.2) return 5;
  if (width >= 600 && fontScale <= 1.3) return 4;
  return 3;
}

export function CardGrid({
  rows,
  now,
  onPressContact,
  favouriteOverlay,
  onToggleFavourite,
  error,
  showInitialSkeleton,
  loadingSkeleton,
  listHeader,
  listEmpty,
  refreshing,
  onRefresh,
  bottomClearance,
}: CardGridProps) {
  const { colors } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const numColumns = gridColumnCount(width, fontScale);

  return (
    <FlatList
      key={`grid-${numColumns}`}
      data={error || showInitialSkeleton ? [] : rows}
      extraData={favouriteOverlay}
      numColumns={numColumns}
      keyExtractor={(item) => String(item.id)}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={showInitialSkeleton ? loadingSkeleton : listEmpty}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
      renderItem={({ item }) => {
        const renderedMembership =
          favouriteOverlay.get(item.id) ?? (item.favourite_rank !== null);
        return (
          <GridCard
            contactId={item.id}
            name={item.name}
            photo={item.photo}
            modifiedAt={item.modified_at}
            categoryLabel={item.categoryLabel}
            lastContact={item.last_contact}
            snoozeUntil={item.snooze_until}
            status={item.status}
            now={now}
            onPress={() => onPressContact(item.id)}
            isFavourite={renderedMembership}
            onToggleFavourite={() =>
              onToggleFavourite(item.id, !renderedMembership)
            }
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.sm,
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.base,
  },
  row: {
    gap: SPACING.sm,
  },
});
