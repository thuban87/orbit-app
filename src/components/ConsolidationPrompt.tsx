import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import type { ImportSessionRow } from "@/db/import-session-read";
import { resolveImportStagingUri } from "@/services/photos/photo-storage";
import { useTheme } from "@/theme";

interface SourceSnapshot {
  displayName: string | null;
}

function sourceName(row: ImportSessionRow): string {
  try {
    const snapshot = JSON.parse(row.sourcePayload) as SourceSnapshot;
    return snapshot.displayName?.trim() || "Unnamed contact";
  } catch {
    return "Unnamed contact";
  }
}

function SourcePreview({ row }: { row: ImportSessionRow }) {
  const { colors } = useTheme();
  const [photoFailed, setPhotoFailed] = useState(false);
  const name = sourceName(row);
  const uri = useMemo(() => {
    if (!row.photoRelPath) return null;
    try {
      return resolveImportStagingUri(row.photoRelPath);
    } catch {
      return null;
    }
  }, [row.photoRelPath]);

  return (
    <View style={styles.source}>
      {uri && !photoFailed ? (
        <Image
          accessibilityLabel={`Photo of ${name}`}
          source={{ uri }}
          contentFit="cover"
          onError={() => setPhotoFailed(true)}
          style={styles.photo}
        />
      ) : (
        <Avatar photo={null} name={name} size={44} />
      )}
      <Text
        numberOfLines={1}
        style={[styles.sourceName, { color: colors.textPrimary }]}
      >
        {name}
      </Text>
    </View>
  );
}

export function ConsolidationPrompt({
  visible,
  rows,
  onCombine,
  onKeepSeparate,
}: {
  visible: boolean;
  rows: ImportSessionRow[];
  onCombine: () => void;
  onKeepSeparate: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onKeepSeparate}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Keep contacts separate"
          style={StyleSheet.absoluteFill}
          onPress={onKeepSeparate}
        >
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.scrim,
              { backgroundColor: colors.background },
            ]}
          />
        </Pressable>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            These may be the same person
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Combine these selected source records into one new Orbit contact, or
            keep them separate for the normal import.
          </Text>
          <View style={styles.sources}>
            {rows.map((row) => (
              <SourcePreview key={row.id} row={row} />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Combine into one"
            onPress={onCombine}
            style={[styles.combine, { backgroundColor: colors.accent }]}
          >
            <Text style={{ color: colors.background, fontWeight: "700" }}>
              Combine into one
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Keep separate"
            onPress={onKeepSeparate}
            style={[styles.separate, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
              Keep separate
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scrim: { opacity: 0.85 },
  sheet: { borderWidth: 1, borderRadius: 12, padding: 20, gap: 14 },
  title: { fontSize: 20, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 21 },
  sources: { gap: 8 },
  source: { flexDirection: "row", alignItems: "center", gap: 10 },
  photo: { width: 44, height: 44, borderRadius: 22 },
  sourceName: { flex: 1, fontSize: 16, fontWeight: "600" },
  combine: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  separate: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
