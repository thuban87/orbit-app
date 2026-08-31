import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ignoreBulkReviewFlag,
  resolveBulkReviewFlag,
} from "@/db/bulk-review-dao";
import {
  type BulkReviewFlag,
  listBulkReviewFlags,
} from "@/db/bulk-review-read";
import { getExecutor, localDateTime } from "@/db/database";
import { normalizeEditedBirthday } from "@/logic/birthday-logic";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "bulk-review-screen";

/** Durable resolver for the import pipeline's previously count-only birthday flags. */
export function BulkReviewScreen({
  navigation,
}: RootStackScreenProps<"BulkReview">) {
  const { colors } = useTheme();
  const [flags, setFlags] = useState<BulkReviewFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [birthdayInput, setBirthdayInput] = useState("");
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFlags(await listBulkReviewFlags(getExecutor()));
      setFailed(false);
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to load bulk review flags", error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const normalizedBirthday = useMemo(
    () => normalizeEditedBirthday(birthdayInput),
    [birthdayInput],
  );
  const birthdayInvalid =
    birthdayInput.trim().length > 0 && !normalizedBirthday.valid;

  const clearEditor = () => {
    setEditingId(null);
    setBirthdayInput("");
  };

  const onFix = async (flag: BulkReviewFlag) => {
    if (!normalizedBirthday.valid || normalizedBirthday.stored === null) return;
    setSavingId(flag.importSessionRowId);
    try {
      await resolveBulkReviewFlag(getExecutor(), {
        importSessionRowId: flag.importSessionRowId,
        contactId: flag.contactId,
        birthday: normalizedBirthday.stored,
        now: localDateTime(),
      });
      clearEditor();
      await load();
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to fix birthday flag", error);
      setFailed(true);
    } finally {
      setSavingId(null);
    }
  };

  const onIgnore = async (flag: BulkReviewFlag) => {
    setSavingId(flag.importSessionRowId);
    try {
      await ignoreBulkReviewFlag(getExecutor(), {
        importSessionRowId: flag.importSessionRowId,
        now: localDateTime(),
      });
      if (editingId === flag.importSessionRowId) clearEditor();
      await load();
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to ignore birthday flag", error);
      setFailed(true);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <ScrollView
      testID="bulk-review-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.back, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Review flagged items
        </Text>
      </View>

      {loading ? (
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Loading flagged items…
        </Text>
      ) : null}
      {failed ? (
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Couldn&apos;t load flagged items. Please try again.
        </Text>
      ) : null}
      {!loading && !failed && flags.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Nothing to review
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            No flagged items right now.
          </Text>
        </View>
      ) : null}
      {flags.map((flag) => {
        const isEditing = editingId === flag.importSessionRowId;
        const saving = savingId === flag.importSessionRowId;
        return (
          <View
            key={flag.importSessionRowId}
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.name, { color: colors.textPrimary }]}
            >
              {flag.contactName}
            </Text>
            <Text style={[styles.raw, { color: colors.textSecondary }]}>
              Birthday: &quot;{flag.rawValue}&quot; — couldn&apos;t be read
            </Text>
            {isEditing ? (
              <View style={styles.editor}>
                <TextInput
                  autoFocus
                  value={birthdayInput}
                  onChangeText={setBirthdayInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    styles.input,
                    {
                      color: colors.textPrimary,
                      backgroundColor: colors.background,
                      borderColor: birthdayInvalid
                        ? colors.borderStrong
                        : colors.border,
                    },
                  ]}
                />
                {birthdayInvalid ? (
                  <Text style={[styles.error, { color: colors.accent }]}>
                    Enter a real date (YYYY-MM-DD or MM-DD).
                  </Text>
                ) : null}
                <Pressable
                  disabled={
                    saving ||
                    birthdayInvalid ||
                    normalizedBirthday.stored === null
                  }
                  onPress={() => void onFix(flag)}
                  style={[
                    styles.primary,
                    {
                      backgroundColor:
                        saving ||
                        birthdayInvalid ||
                        normalizedBirthday.stored === null
                          ? colors.surfaceElevated
                          : colors.accent,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        saving ||
                        birthdayInvalid ||
                        normalizedBirthday.stored === null
                          ? colors.textSecondary
                          : colors.background,
                    }}
                  >
                    Save birthday
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Fix birthday for ${flag.contactName}`}
                disabled={saving}
                onPress={() => {
                  setEditingId(flag.importSessionRowId);
                  setBirthdayInput("");
                }}
                style={[
                  styles.secondary,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={{ color: colors.textPrimary }}>Fix</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ignore birthday for ${flag.contactName}`}
                disabled={saving}
                onPress={() => void onIgnore(flag)}
                style={[
                  styles.secondary,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={{ color: colors.textPrimary }}>Ignore</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  header: { gap: 12, marginBottom: 4 },
  back: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  title: { fontSize: 24, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 21 },
  empty: { paddingVertical: 28, gap: 4 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 10 },
  name: { fontSize: 16, fontWeight: "600" },
  raw: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10 },
  secondary: {
    minHeight: 44,
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  editor: { gap: 8 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  error: { fontSize: 13, lineHeight: 18 },
  primary: {
    minHeight: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
