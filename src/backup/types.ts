/** Wire-level records used by backup Merge before local integer IDs are mapped. */
export interface ReconciliationRow {
  uid: string;
  modified_at: string;
  [field: string]: unknown;
}

export interface ReconciliationTombstone {
  entity_uid: string;
  deleted_at: string;
}

/** Bump only when the portable JSON wire shape changes, never with SQLite. */
export const BACKUP_FORMAT_VERSION = 3;
/** Container/envelope evolution is independent from the plaintext manifest. */
export const BACKUP_ENVELOPE_VERSION = 1;

/**
 * Compatibility contract for one encrypted-backup envelope version. This is
 * deliberately caller-supplied until a physical-device benchmark approves a
 * shipping profile; no service-level encryption default exists.
 */
export interface BackupEncryptionProfile {
  formatVersion: number;
  cipher: "AES-256-GCM";
  kdf: {
    id: "PBKDF2-HMAC-SHA256";
    iterations: number;
    derivedKeyLength: number;
  };
  saltLength: number;
  ivLength: number;
  maxCiphertextBytes: number;
}

/** The complete public schema of an encrypted backup envelope. Nothing else may be public. */
export interface EncryptedBackupEnvelope {
  formatVersion: number;
  encrypted: true;
  cipher: "AES-256-GCM";
  kdf: BackupEncryptionProfile["kdf"];
  saltBase64: string;
  ivBase64: string;
  /** Opaque AES-GCM ciphertext followed by its 16-byte authentication tag. */
  ciphertextBase64: string;
}

export interface BackupManifest {
  backupFormatVersion: number;
  envelopeVersion: number;
  metadata: { exportedAt: string; sqliteUserVersion: number | null };
  appSettings: Record<string, unknown> & { sunContactUid: string | null };
  categories: Record<string, unknown>[];
  profile: Record<string, unknown> | null;
  contacts: Record<string, unknown>[];
  contactMethods: Record<string, unknown>[];
  externalContactLinks: Record<string, unknown>[];
  contactMethodProvenance: Record<string, unknown>[];
  interactions: Record<string, unknown>[];
  events: Record<string, unknown>[];
  fuel: Record<string, unknown>[];
  contactLinks: Record<string, unknown>[];
  customFieldDefs: Record<string, unknown>[];
  customFieldValues: Record<string, unknown>[];
  tombstones: Array<{ entityType: string; entityUid: string; deletedAt: string }>;
}

export class BackupSchemaError extends Error {
  override name = "BackupSchemaError";
}

/** Typed, content-free repair cue: file details must never enter user-visible errors. */
export class BackupPhotoUnreadableError extends Error {
  override name = "BackupPhotoUnreadableError";
  constructor() {
    super("A photo could not be read. Repair it before exporting.");
  }
}
