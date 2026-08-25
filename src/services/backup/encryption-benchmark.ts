import type { BackupEncryptionProfile } from "@/backup/types";
import { createBackupEnvelopeCrypto } from "@/services/backup/encryption";

/**
 * Release-benchmark candidates only. They are deliberately not a shipping
 * default and exist solely for the Task 2 physical-Pixel approval decision.
 */
export const BACKUP_ENCRYPTION_BENCHMARK_CANDIDATES: readonly BackupEncryptionProfile[] = [
  300_000,
  600_000,
  900_000,
].map((iterations) => ({
  formatVersion: 1,
  cipher: "AES-256-GCM" as const,
  kdf: { id: "PBKDF2-HMAC-SHA256" as const, iterations, derivedKeyLength: 32 },
  saltLength: 16,
  ivLength: 12,
  maxCiphertextBytes: 8 * 1024 * 1024,
}));

export interface BackupEncryptionBenchmarkResult {
  iterations: number;
  samplesMs: readonly number[];
  medianMs: number;
}

function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)]!;
}

/** Run only from the explicit release-build benchmark harness; never from product flows. */
export function measureBackupEncryptionCandidates(): readonly BackupEncryptionBenchmarkResult[] {
  return BACKUP_ENCRYPTION_BENCHMARK_CANDIDATES.map((profile) => {
    const crypto = createBackupEnvelopeCrypto({ profiles: [profile] });
    // Warm native dispatch before collecting the owner-facing samples.
    crypto.measurePbkdf2({ passphrase: "Orbit benchmark warmup", profile });
    const samplesMs = Array.from({ length: 5 }, () => crypto.measurePbkdf2({
      passphrase: "Orbit benchmark sample",
      profile,
    }).durationMs);
    return { iterations: profile.kdf.iterations, samplesMs, medianMs: median(samplesMs) };
  });
}
