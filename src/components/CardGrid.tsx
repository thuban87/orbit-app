/** Virtualized, responsive Dashboard card renderer over the shared result model. */
import { type ReactElement, useMemo } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import type { IconName } from "@/components/icons/icon-registry";
import type { DashboardRow } from "@/db/dashboard-read";
import type { DashboardSearchResult } from "@/logic/dashboard-search-match";
import { useTheme } from "@/theme";
import { GridCard } from "./GridCard";
import {
  GRID_COLUMN_GAP,
  GRID_CONTENT_PADDING,
  gridCardGeometry,
  gridColumnCount,
} from "./grid-card-geometry";

// Moved to the pure geometry module (38.6 D-06); re-exported for existing imports.
export { gridColumnCount };

export interface CardGridProps {
  rows: DashboardRow[];
  now: string;
  onPressContact: (contactId: number) => void;
  onLongPressContact?: (contactId: number) => void;
  onViewProfile?: (contactId: number) => void;
  onQuickLog?: (contactId: number) => void;
  onLogInteraction?: (contactId: number) => void;
  onMessage?: (contactId: number) => void;
  onEditContact?: (contactId: number) => void;
  onSelect?: (contactId: number) => void;
  selectionMode?: boolean;
  selectedIds?: ReadonlySet<number>;
  onToggleSelect?: (contactId: number) => void;
  favouriteOverlay: ReadonlyMap<number, boolean>;
  onToggleFavourite: (contactId: number, nextMembership: boolean) => void;
  line3ByContactId: ReadonlyMap<number, { text: string; iconName?: IconName }>;
  searchResultsByContactId: ReadonlyMap<number, DashboardSearchResult | null>;
  isSearchMode: boolean;
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

export function CardGrid({
  rows,
  now,
  onPressContact,
  onLongPressContact,
  onViewProfile,
  onQuickLog,
  onLogInteraction,
  onMessage,
  onEditContact,
  onSelect,
  selectionMode = false,
  selectedIds = new Set<number>(),
  onToggleSelect,
  favouriteOverlay,
  onToggleFavourite,
  line3ByContactId,
  searchResultsByContactId,
  isSearchMode,
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
  // D-06: every card's photo is sized from the nominal card width.
  const geometry = useMemo(
    () => gridCardGeometry(width, numColumns),
    [width, numColumns],
  );

  return (
    <FlatList
      key={`grid-${numColumns}`}
      data={error || showInitialSkeleton ? [] : rows}
      extraData={{
        favouriteOverlay,
        line3ByContactId,
        searchResultsByContactId,
        isSearchMode,
        selectionMode,
        selectedIds,
        geometry,
      }}
      numColumns={numColumns}
      keyExtractor={(item) => String(item.id)}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomClearance },
      ]}
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
          favouriteOverlay.get(item.id) ?? item.favourite_rank !== null;
        return (
          <GridCard
            contactId={item.id}
            geometry={geometry}
            name={item.name}
            photo={item.photo}
            categoryLabel={item.categoryLabel}
            lastContact={item.last_contact}
            snoozeUntil={item.snooze_until}
            status={item.status}
            now={now}
            onPress={() => onPressContact(item.id)}
            onLongPress={
              onLongPressContact ? () => onLongPressContact(item.id) : undefined
            }
            onViewProfile={
              onViewProfile ? () => onViewProfile(item.id) : undefined
            }
            onQuickLog={onQuickLog ? () => onQuickLog(item.id) : undefined}
            onLogInteraction={
              onLogInteraction ? () => onLogInteraction(item.id) : undefined
            }
            onMessage={onMessage ? () => onMessage(item.id) : undefined}
            onEditContact={
              onEditContact ? () => onEditContact(item.id) : undefined
            }
            onSelect={onSelect ? () => onSelect(item.id) : undefined}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            onToggleSelect={
              onToggleSelect ? () => onToggleSelect(item.id) : undefined
            }
            isFavourite={renderedMembership}
            onToggleFavourite={() =>
              onToggleFavourite(item.id, !renderedMembership)
            }
            line3={line3ByContactId.get(item.id) ?? null}
            searchResult={
              isSearchMode
                ? (searchResultsByContactId.get(item.id) ?? null)
                : undefined
            }
            searchSnippet={isSearchMode ? item.snippet : null}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: GRID_COLUMN_GAP,
    paddingHorizontal: GRID_CONTENT_PADDING,
    paddingTop: GRID_CONTENT_PADDING,
  },
  row: {
    gap: GRID_COLUMN_GAP,
  },
});
