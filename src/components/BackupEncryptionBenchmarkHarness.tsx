import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { measureBackupEncryptionCandidates, type BackupEncryptionBenchmarkResult } from "@/services/backup/encryption-benchmark";
import { useTheme } from "@/theme";

/**
 * Intentionally reachable only when EXPO_PUBLIC_BACKUP_ENCRYPTION_BENCHMARK=1
 * is embedded in a purpose-built release APK. This is not a product screen.
 */
export function BackupEncryptionBenchmarkHarness() {
  const { colors } = useTheme();
  const [results, setResults] = useState<readonly BackupEncryptionBenchmarkResult[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      setResults(measureBackupEncryptionCandidates());
    } catch {
      setFailed(true);
    }
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Backup encryption benchmark</Text>
      <Text style={[styles.detail, { color: colors.textSecondary }]}>RNQC PBKDF2-HMAC-SHA256 · five measured samples after one warmup</Text>
      {failed ? <Text style={[styles.result, { color: colors.danger }]}>Benchmark failed</Text> : null}
      {results?.map((result) => (
        <Text key={result.iterations} style={[styles.result, { color: colors.textPrimary }]}>
          {result.iterations} iterations: {result.samplesMs.join(", ")} ms · median {result.medianMs} ms
        </Text>
      ))}
      {!results && !failed ? <Text style={[styles.detail, { color: colors.textSecondary }]}>Measuring…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  detail: { fontSize: 15, lineHeight: 22 },
  result: { fontSize: 16, lineHeight: 24, fontVariant: ["tabular-nums"] },
});
