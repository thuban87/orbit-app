import { createCipheriv, createDecipheriv, pbkdf2Sync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  BackupEnvelopeError,
  createBackupEnvelopeCrypto,
  parseEnvelopeHeader,
} from "@/services/backup/encryption";
import type { BackupEncryptionProfile } from "@/backup/types";

const profile: BackupEncryptionProfile = {
  formatVersion: 71,
  cipher: "AES-256-GCM",
  kdf: {
    id: "PBKDF2-HMAC-SHA256",
    iterations: 1_000,
    derivedKeyLength: 32,
  },
  saltLength: 16,
  ivLength: 12,
  maxCiphertextBytes: 1_024,
};

function createTestBackend() {
  let nextByte = 0;
  return {
    randomBytes(size: number) {
      return Uint8Array.from({ length: size }, () => nextByte++);
    },
    deriveKey(passphrase: string, salt: Uint8Array, parameters: BackupEncryptionProfile["kdf"]) {
      return new Uint8Array(pbkdf2Sync(passphrase, salt, parameters.iterations, parameters.derivedKeyLength, "sha256"));
    },
    encryptGcm(key: Uint8Array, iv: Uint8Array, plaintext: Uint8Array, aad: Uint8Array) {
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(aad);
      return {
        ciphertext: new Uint8Array(Buffer.concat([cipher.update(plaintext), cipher.final()])),
        tag: new Uint8Array(cipher.getAuthTag()),
      };
    },
    decryptGcm(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array, tag: Uint8Array, aad: Uint8Array) {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(aad);
      decipher.setAuthTag(tag);
      return new Uint8Array(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
    },
  };
}

describe("backup encryption envelope", () => {
  it("round-trips bytes through an explicit profile with random salt and IV", () => {
    const crypto = createBackupEnvelopeCrypto({ profiles: [profile], backend: createTestBackend() });
    const envelope = crypto.encrypt({
      passphrase: "correct horse battery staple",
      plaintext: new TextEncoder().encode('{"exportedAt":"private"}'),
      profile,
    });

    expect(envelope).toMatchObject({
      formatVersion: 71,
      encrypted: true,
      cipher: "AES-256-GCM",
      kdf: profile.kdf,
    });
    expect(crypto.decrypt({ passphrase: "correct horse battery staple", envelope })).toEqual(
      new TextEncoder().encode('{"exportedAt":"private"}'),
    );
  });

  it("rejects a wrong passphrase and changed ciphertext or authenticated metadata without exposing plaintext", () => {
    const crypto = createBackupEnvelopeCrypto({ profiles: [profile], backend: createTestBackend() });
    const envelope = crypto.encrypt({ passphrase: "passphrase", plaintext: new TextEncoder().encode("secret"), profile });

    for (const altered of [
      envelope,
      { ...envelope, ciphertextBase64: `${envelope.ciphertextBase64.slice(0, -1)}A` },
      { ...envelope, saltBase64: `${envelope.saltBase64.slice(0, -1)}A` },
    ]) {
      expect(() => crypto.decrypt({ passphrase: altered === envelope ? "wrong passphrase" : "passphrase", envelope: altered })).toThrow(
        BackupEnvelopeError,
      );
    }
  });

  it("rejects unknown public keys before decryption", () => {
    const crypto = createBackupEnvelopeCrypto({ profiles: [profile], backend: createTestBackend() });
    const envelope = crypto.encrypt({ passphrase: "passphrase", plaintext: new Uint8Array([1]), profile });
    const deriveKey = vi.spyOn(createTestBackend(), "deriveKey");

    expect(() => parseEnvelopeHeader({ ...envelope, benchmarkDurationMs: 48 }, [profile])).toThrow(BackupEnvelopeError);
    expect(() => parseEnvelopeHeader({ ...envelope, kdf: { ...envelope.kdf, deviceModel: "Pixel" } }, [profile])).toThrow(
      BackupEnvelopeError,
    );
    expect(deriveKey).not.toHaveBeenCalled();
  });

  it("rejects hostile profiles before invoking PBKDF2", () => {
    const backend = createTestBackend();
    const deriveKey = vi.spyOn(backend, "deriveKey");
    const crypto = createBackupEnvelopeCrypto({ profiles: [profile], backend });
    const envelope = crypto.encrypt({ passphrase: "passphrase", plaintext: new Uint8Array([1]), profile });
    deriveKey.mockClear();

    for (const malformed of [
      { ...envelope, kdf: { ...envelope.kdf, iterations: 2 ** 31 } },
      { ...envelope, ciphertextBase64: Buffer.alloc(profile.maxCiphertextBytes + 1).toString("base64") },
      { ...envelope, saltBase64: Buffer.alloc(profile.saltLength - 1).toString("base64") },
      { ...envelope, ivBase64: Buffer.alloc(profile.ivLength - 1).toString("base64") },
      { ...envelope, formatVersion: 999 },
    ]) {
      expect(() => crypto.decrypt({ passphrase: "passphrase", envelope: malformed })).toThrow(BackupEnvelopeError);
    }

    expect(deriveKey).not.toHaveBeenCalled();
  });

  it("reports native KDF timing for a candidate without selecting a default profile", () => {
    const crypto = createBackupEnvelopeCrypto({ profiles: [profile], backend: createTestBackend(), now: () => 100 });
    expect(crypto.measurePbkdf2({ passphrase: "candidate", profile })).toEqual({ durationMs: 0 });
  });
});
