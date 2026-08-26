import type { BackupEncryptionProfile, EncryptedBackupEnvelope } from "@/backup/types";

const TAG_LENGTH = 16;
const MIN_ITERATIONS = 1;
const MAX_ITERATIONS = 10_000_000;
const MAX_PROFILE_CIPHERTEXT_BYTES = 16 * 1024 * 1024;
const encoder = new TextEncoder();

/**
 * Approved by the owner from the 2026-08-25 Pixel 6 Pro release benchmark:
 * RNQC 1.1.7, 600,000 iterations, median PBKDF2 time 53 ms. This record is
 * deliberately technical only; device/build evidence never enters envelopes.
 */
export const APPROVED_BACKUP_ENCRYPTION_PROFILE: BackupEncryptionProfile = {
  formatVersion: 1,
  cipher: "AES-256-GCM",
  kdf: { id: "PBKDF2-HMAC-SHA256", iterations: 600_000, derivedKeyLength: 32 },
  saltLength: 16,
  ivLength: 12,
  maxCiphertextBytes: 8_388_608,
};

export type BackupEnvelopeErrorCode =
  | "invalid-envelope"
  | "unsupported-profile"
  | "authentication-failed"
  | "encryption-failed";

/** A safe, content-free error for corrupted, unsupported, or unauthentic files. */
export class BackupEnvelopeError extends Error {
  override name = "BackupEnvelopeError";
  constructor(readonly code: BackupEnvelopeErrorCode) {
    super(code === "authentication-failed" ? "The encrypted backup could not be authenticated." : "The encrypted backup is invalid.");
  }
}

export interface BackupEncryptionBackend {
  randomBytes(size: number): Uint8Array;
  deriveKey(passphrase: string, salt: Uint8Array, parameters: BackupEncryptionProfile["kdf"]): Uint8Array;
  encryptGcm(key: Uint8Array, iv: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): { ciphertext: Uint8Array; tag: Uint8Array };
  decryptGcm(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array, tag: Uint8Array, aad: Uint8Array): Uint8Array;
}

interface NativeGcmCipher {
  setAAD(aad: Uint8Array): void;
  setAuthTag?(tag: Uint8Array): void;
  update(input: Uint8Array): Uint8Array;
  final(): Uint8Array;
  getAuthTag?(): Uint8Array;
}

interface NativeQuickCrypto {
  randomBytes(size: number): Uint8Array;
  pbkdf2Sync(passphrase: string, salt: Uint8Array, iterations: number, keyLength: number, digest: string): Uint8Array;
  createCipheriv(algorithm: string, key: Uint8Array, iv: Uint8Array): NativeGcmCipher;
  createDecipheriv(algorithm: string, key: Uint8Array, iv: Uint8Array): NativeGcmCipher;
}

/** Delayed so node-side injected-backend tests never resolve a native module. */
function quickCrypto(): NativeQuickCrypto {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("react-native-quick-crypto") as NativeQuickCrypto;
}

function concatenate(...parts: Uint8Array[]): Uint8Array {
  const combined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }
  return combined;
}

/** RNQC is the sole production cryptographic primitive; tests inject this narrow boundary. */
const nativeBackend: BackupEncryptionBackend = {
  randomBytes: (size) => new Uint8Array(quickCrypto().randomBytes(size)),
  deriveKey: (passphrase, salt, parameters) => new Uint8Array(quickCrypto().pbkdf2Sync(
    passphrase, salt, parameters.iterations, parameters.derivedKeyLength, "sha256",
  )),
  encryptGcm(key, iv, plaintext, aad) {
    const cipher = quickCrypto().createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(aad);
    const ciphertext = concatenate(cipher.update(plaintext), cipher.final());
    const tag = cipher.getAuthTag?.();
    if (!tag) throw new BackupEnvelopeError("encryption-failed");
    return {
      ciphertext,
      tag: new Uint8Array(tag),
    };
  },
  decryptGcm(key, iv, ciphertext, tag, aad) {
    const decipher = quickCrypto().createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad);
    if (!decipher.setAuthTag) throw new BackupEnvelopeError("authentication-failed");
    decipher.setAuthTag(tag);
    return concatenate(decipher.update(ciphertext), decipher.final());
  },
};

export interface BackupEnvelopeCryptoOptions {
  /** Every supported file version must be explicitly registered by its caller. */
  profiles: readonly BackupEncryptionProfile[];
  backend?: BackupEncryptionBackend;
  now?: () => number;
}

export interface BackupEnvelopeCrypto {
  encrypt(input: { passphrase: string; plaintext: Uint8Array; profile: BackupEncryptionProfile }): EncryptedBackupEnvelope;
  decrypt(input: { passphrase: string; envelope: unknown }): Uint8Array;
  measurePbkdf2(input: { passphrase: string; profile: BackupEncryptionProfile }): { durationMs: number };
}

const envelopeKeys = ["formatVersion", "encrypted", "cipher", "kdf", "saltBase64", "ivBase64", "ciphertextBase64"] as const;
const kdfKeys = ["id", "iterations", "derivedKeyLength"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key)) && allowed.every((key) => key in value);
}

function isIntegerBetween(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function validProfile(profile: BackupEncryptionProfile): boolean {
  return isIntegerBetween(profile.formatVersion, 1, Number.MAX_SAFE_INTEGER)
    && profile.cipher === "AES-256-GCM"
    && profile.kdf.id === "PBKDF2-HMAC-SHA256"
    && isIntegerBetween(profile.kdf.iterations, MIN_ITERATIONS, MAX_ITERATIONS)
    && profile.kdf.derivedKeyLength === 32
    && isIntegerBetween(profile.saltLength, 16, 64)
    && profile.ivLength === 12
    && isIntegerBetween(profile.maxCiphertextBytes, TAG_LENGTH, MAX_PROFILE_CIPHERTEXT_BYTES);
}

function profilesByVersion(profiles: readonly BackupEncryptionProfile[]): Map<number, BackupEncryptionProfile> {
  const byVersion = new Map<number, BackupEncryptionProfile>();
  for (const profile of profiles) {
    if (!validProfile(profile) || byVersion.has(profile.formatVersion)) throw new BackupEnvelopeError("unsupported-profile");
    byVersion.set(profile.formatVersion, profile);
  }
  if (byVersion.size === 0) throw new BackupEnvelopeError("unsupported-profile");
  return byVersion;
}

function base64(value: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let index = 0; index < value.length; index += 3) {
    const first = value[index]!;
    const second = value[index + 1];
    const third = value[index + 2];
    result += alphabet[first >> 2];
    result += alphabet[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
    result += second === undefined ? "=" : alphabet[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
    result += third === undefined ? "=" : alphabet[third & 0x3f];
  }
  return result;
}

function decodeBase64(value: unknown, maximumBytes: number): Uint8Array {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new BackupEnvelopeError("invalid-envelope");
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 4) {
    const first = alphabet.indexOf(value[index]!);
    const second = alphabet.indexOf(value[index + 1]!);
    const third = value[index + 2] === "=" ? 0 : alphabet.indexOf(value[index + 2]!);
    const fourth = value[index + 3] === "=" ? 0 : alphabet.indexOf(value[index + 3]!);
    if (first < 0 || second < 0 || third < 0 || fourth < 0) throw new BackupEnvelopeError("invalid-envelope");
    bytes.push((first << 2) | (second >> 4));
    if (value[index + 2] !== "=") bytes.push(((second & 0x0f) << 4) | (third >> 2));
    if (value[index + 3] !== "=") bytes.push(((third & 0x03) << 6) | fourth);
  }
  const decoded = new Uint8Array(bytes);
  if (decoded.length > maximumBytes || base64(decoded) !== value) throw new BackupEnvelopeError("invalid-envelope");
  return decoded;
}

/**
 * Byte-canonical AAD for public technical metadata. Ciphertext/tag are already
 * authenticated by GCM itself and therefore are intentionally not circular AAD.
 */
function aadFor(header: Omit<EncryptedBackupEnvelope, "ciphertextBase64">): Uint8Array {
  return encoder.encode(JSON.stringify({
    formatVersion: header.formatVersion,
    encrypted: header.encrypted,
    cipher: header.cipher,
    kdf: {
      id: header.kdf.id,
      iterations: header.kdf.iterations,
      derivedKeyLength: header.kdf.derivedKeyLength,
    },
    saltBase64: header.saltBase64,
    ivBase64: header.ivBase64,
  }));
}

function exactProfile(left: BackupEncryptionProfile, right: BackupEncryptionProfile): boolean {
  return left.formatVersion === right.formatVersion
    && left.cipher === right.cipher
    && left.kdf.id === right.kdf.id
    && left.kdf.iterations === right.kdf.iterations
    && left.kdf.derivedKeyLength === right.kdf.derivedKeyLength
    && left.saltLength === right.saltLength
    && left.ivLength === right.ivLength
    && left.maxCiphertextBytes === right.maxCiphertextBytes;
}

/** Strictly parse public metadata before any native KDF, cipher, or large allocation. */
export function parseEnvelopeHeader(
  input: unknown,
  profiles: readonly BackupEncryptionProfile[],
): EncryptedBackupEnvelope {
  const byVersion = profilesByVersion(profiles);
  if (!isRecord(input) || !hasOnlyKeys(input, envelopeKeys) || !isRecord(input.kdf) || !hasOnlyKeys(input.kdf, kdfKeys)) {
    throw new BackupEnvelopeError("invalid-envelope");
  }
  if (!isIntegerBetween(input.formatVersion, 1, Number.MAX_SAFE_INTEGER) || input.encrypted !== true || input.cipher !== "AES-256-GCM") {
    throw new BackupEnvelopeError("invalid-envelope");
  }
  const profile = byVersion.get(input.formatVersion);
  if (!profile) throw new BackupEnvelopeError("unsupported-profile");
  if (input.kdf.id !== profile.kdf.id || input.kdf.iterations !== profile.kdf.iterations || input.kdf.derivedKeyLength !== profile.kdf.derivedKeyLength) {
    throw new BackupEnvelopeError("unsupported-profile");
  }
  const salt = decodeBase64(input.saltBase64, profile.saltLength);
  const iv = decodeBase64(input.ivBase64, profile.ivLength);
  const ciphertext = decodeBase64(input.ciphertextBase64, profile.maxCiphertextBytes);
  if (salt.length !== profile.saltLength || iv.length !== profile.ivLength || ciphertext.length < TAG_LENGTH) {
    throw new BackupEnvelopeError("invalid-envelope");
  }
  return {
    formatVersion: input.formatVersion,
    encrypted: true,
    cipher: "AES-256-GCM",
    kdf: { id: profile.kdf.id, iterations: profile.kdf.iterations, derivedKeyLength: profile.kdf.derivedKeyLength },
    saltBase64: base64(salt),
    ivBase64: base64(iv),
    ciphertextBase64: base64(ciphertext),
  };
}

export function createBackupEnvelopeCrypto(options: BackupEnvelopeCryptoOptions): BackupEnvelopeCrypto {
  const byVersion = profilesByVersion(options.profiles);
  const backend = options.backend ?? nativeBackend;
  const now = options.now ?? Date.now;

  function configuredProfile(profile: BackupEncryptionProfile): BackupEncryptionProfile {
    const configured = byVersion.get(profile.formatVersion);
    if (!configured || !exactProfile(configured, profile)) throw new BackupEnvelopeError("unsupported-profile");
    return configured;
  }

  return {
    encrypt({ passphrase, plaintext, profile }) {
      const selected = configuredProfile(profile);
      const salt = backend.randomBytes(selected.saltLength);
      const iv = backend.randomBytes(selected.ivLength);
      const technicalHeader = {
        formatVersion: selected.formatVersion,
        encrypted: true as const,
        cipher: selected.cipher,
        kdf: { ...selected.kdf },
        saltBase64: base64(salt),
        ivBase64: base64(iv),
      };
      try {
        const key = backend.deriveKey(passphrase, salt, selected.kdf);
        const encrypted = backend.encryptGcm(key, iv, plaintext, aadFor(technicalHeader));
        if (encrypted.tag.length !== TAG_LENGTH) throw new BackupEnvelopeError("encryption-failed");
        const ciphertext = concatenate(encrypted.ciphertext, encrypted.tag);
        if (ciphertext.length > selected.maxCiphertextBytes) throw new BackupEnvelopeError("encryption-failed");
        return { ...technicalHeader, ciphertextBase64: base64(ciphertext) };
      } catch (error) {
        if (error instanceof BackupEnvelopeError) throw error;
        throw new BackupEnvelopeError("encryption-failed");
      }
    },
    decrypt({ passphrase, envelope }) {
      const header = parseEnvelopeHeader(envelope, options.profiles);
      const selected = byVersion.get(header.formatVersion)!;
      const salt = decodeBase64(header.saltBase64, selected.saltLength);
      const iv = decodeBase64(header.ivBase64, selected.ivLength);
      const combined = decodeBase64(header.ciphertextBase64, selected.maxCiphertextBytes);
      try {
        const key = backend.deriveKey(passphrase, salt, selected.kdf);
        return backend.decryptGcm(key, iv, combined.slice(0, -TAG_LENGTH), combined.slice(-TAG_LENGTH), aadFor({
          formatVersion: header.formatVersion,
          encrypted: header.encrypted,
          cipher: header.cipher,
          kdf: header.kdf,
          saltBase64: header.saltBase64,
          ivBase64: header.ivBase64,
        }));
      } catch {
        throw new BackupEnvelopeError("authentication-failed");
      }
    },
    measurePbkdf2({ passphrase, profile }) {
      const selected = configuredProfile(profile);
      const startedAt = now();
      try {
        backend.deriveKey(passphrase, backend.randomBytes(selected.saltLength), selected.kdf);
      } catch {
        throw new BackupEnvelopeError("encryption-failed");
      }
      return { durationMs: Math.max(0, now() - startedAt) };
    },
  };
}
