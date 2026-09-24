import { File, Paths } from "expo-file-system";
import {
  BACKUP_ENVELOPE_VERSION,
  BACKUP_FORMAT_VERSION,
  type BackupManifest,
} from "@/backup/types";
import { readRestoreDocument } from "@/screens/backup-restore-document";
import { isEncryptedBackupEnvelope } from "@/screens/backup-restore-logic";
import { loadBackupForRestore } from "@/services/backup/backup-service";
import {
  APPROVED_BACKUP_ENCRYPTION_PROFILE,
  createBackupEnvelopeCrypto,
} from "@/services/backup/encryption";
import { sampleBackupProcessPssKb } from "../../../../modules/orbit-backup-document-picker";

const MIB = 1024 * 1024;
const CANDIDATE_MIB = [8, 16, 32, 64, 96] as const;
const PASSPHRASE = "synthetic-measurement-only";

type MemorySample = {
  stage: string;
  heapBytes: number | null;
  pssKiB: number | null;
  elapsedMs: number;
};
type ProbeResult = {
  candidateMiB: number;
  encrypted: boolean;
  bytes: number;
  status: "ready" | "failed";
  peakHeapBytes: number | null;
  peakPssKiB: number | null;
  totalMs: number;
  isolatedParseMs: number;
  samples: MemorySample[];
};

function heapBytes(): number | null {
  const memory = (
    performance as Performance & { memory?: { usedJSHeapSize?: number | null } }
  ).memory;
  return memory?.usedJSHeapSize ?? null;
}

/** All data here is generated in memory; the live SQLite database is never read. */
export function syntheticManifest(targetBytes: number): BackupManifest {
  const rowCount = Math.max(1, Math.ceil(targetBytes / 24_576));
  const photo = "QUJD".repeat(Math.ceil(targetBytes / rowCount / 4));
  const now = "2026-09-24 12:00:00";
  const contacts = Array.from({ length: rowCount }, (_, index) => ({
    uid: `measurement-${index}`,
    name: `Synthetic ${index}`,
    categoryUid: null,
    trackingEnabled: 1,
    intervalDays: 30,
    socialBattery: null,
    birthday: null,
    photoBase64: photo,
    archivedAt: null,
    snoozeUntil: null,
    rarelyResponds: 0,
    remindersOff: 0,
    createdAt: now,
    modifiedAt: now,
  }));
  return {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    envelopeVersion: BACKUP_ENVELOPE_VERSION,
    metadata: { exportedAt: now, sqliteUserVersion: null },
    appSettings: { modifiedAt: now, sunContactUid: null },
    categories: [],
    profile: null,
    contacts,
    contactMethods: [],
    externalContactLinks: [],
    contactMethodProvenance: [],
    interactions: [],
    events: [],
    fuel: [],
    contactLinks: [],
    customFieldDefs: [],
    customFieldValues: [],
    memories: [],
    relationships: [],
    currentStateEntries: [],
    customFieldValueHistory: [],
    systems: [],
    systemRules: [],
    systemOverrides: [],
    systemPrefs: [],
    profileLayoutTemplates: [],
    profileBackgroundTemplates: [],
    aiConnections: [],
    personalizationSections: [],
    groupEvents: [],
    profileContactPresentation: [],
    profileCategoryPresentation: [],
    tombstones: [],
  };
}

function writeSyntheticBackup(
  file: File,
  targetBytes: number,
  encrypted: boolean,
): number {
  const manifest = syntheticManifest(targetBytes);
  const plain = JSON.stringify(manifest);
  const contents = encrypted
    ? JSON.stringify(
        createBackupEnvelopeCrypto({
          profiles: [APPROVED_BACKUP_ENCRYPTION_PROFILE],
        }).encrypt({
          passphrase: PASSPHRASE,
          plaintext: new TextEncoder().encode(plain),
          profile: APPROVED_BACKUP_ENCRYPTION_PROFILE,
        }),
      )
    : plain;
  file.write(contents);
  return file.size;
}

async function measureOne(
  candidateMiB: number,
  encrypted: boolean,
): Promise<ProbeResult> {
  const crypto = createBackupEnvelopeCrypto({
    profiles: [APPROVED_BACKUP_ENCRYPTION_PROFILE],
  });
  const file = new File(
    Paths.cache,
    `restore-share-measure-${Date.now()}.json`,
  );
  const samples: MemorySample[] = [];
  let started = 0;
  const sample = (stage: string) => {
    const observation = {
      stage,
      heapBytes: heapBytes(),
      pssKiB: sampleBackupProcessPssKb(),
      elapsedMs: Math.round(performance.now() - started),
    };
    samples.push(observation);
    console.log("ingress-measure-stage", {
      candidateMiB,
      encrypted,
      ...observation,
    });
  };
  let isolatedParseMs = 0;
  try {
    const bytes = writeSyntheticBackup(file, candidateMiB * MIB, encrypted);
    started = performance.now();
    sample("file-written");
    // The only source bytes still live here are on disk, as in a real restore.
    const readContents = await readRestoreDocument(file.uri);
    sample("readRestoreDocument");
    const isEncrypted = isEncryptedBackupEnvelope(readContents);
    sample("isEncryptedBackupEnvelope");
    const result = loadBackupForRestore({
      contents: readContents,
      passphrase: isEncrypted ? PASSPHRASE : undefined,
      crypto,
    });
    sample("loadBackupForRestore");
    const totalMs = Math.round(performance.now() - started);
    const pathHeapValues = samples
      .map((item) => item.heapBytes)
      .filter((item): item is number => item !== null);
    const peakHeapBytes = pathHeapValues.length
      ? Math.max(...pathHeapValues)
      : null;
    const pathPssValues = samples
      .map((item) => item.pssKiB)
      .filter((item): item is number => item !== null);
    const peakPssKiB = pathPssValues.length ? Math.max(...pathPssValues) : null;
    const parseStarted = performance.now();
    JSON.parse(readContents);
    isolatedParseMs = Math.round(performance.now() - parseStarted);
    sample("isolated-json-parse-secondary");
    const row: ProbeResult = {
      candidateMiB,
      encrypted,
      bytes,
      status: result.status,
      peakHeapBytes,
      peakPssKiB,
      totalMs,
      isolatedParseMs,
      samples,
    };
    console.log("ingress-measure-result", row);
    return row;
  } finally {
    if (file.exists) file.delete();
  }
}

export async function runIngressMeasure(): Promise<ProbeResult[]> {
  if (!__DEV__) throw new Error("Debug probe unavailable");
  const rows: ProbeResult[] = [];
  for (const candidateMiB of CANDIDATE_MIB) {
    rows.push(await measureOne(candidateMiB, false));
    if (candidateMiB <= 6) rows.push(await measureOne(candidateMiB, true));
  }
  // The approved encryption profile caps ciphertext at 8 MiB, so its largest
  // safe plaintext candidate is below 8 MiB.
  rows.push(await measureOne(4, true));
  return rows;
}

/** Runs one case so external PSS sampling can attribute a peak to that size. */
export async function runIngressMeasureCandidate(
  candidateMiB: (typeof CANDIDATE_MIB)[number],
): Promise<ProbeResult> {
  if (!__DEV__) throw new Error("Debug probe unavailable");
  return measureOne(candidateMiB, false);
}

export async function runIngressMeasureEncrypted(): Promise<ProbeResult> {
  if (!__DEV__) throw new Error("Debug probe unavailable");
  return measureOne(4, true);
}
