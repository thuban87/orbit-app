/**
 * Dev-only (38.6-07): validate a backup file with the app's own parser.
 *
 *   npx tsx scripts/dev/validate-backup-fixture.ts <file.json> [more.json ...]
 *
 * Parses each file with `parseBackupManifest` (src/backup/backup-schema.ts),
 * the same schema check restore runs, and prints a one-line summary per file:
 * format version, contact count, how many contacts carry photo bytes, how many
 * carry the D-26 `photoSkipped` marker, and the photo byte formats found
 * (JPEG / WebP, by magic bytes). Exits non-zero if any file fails to parse.
 * Readable (plaintext) manifests only; an encrypted envelope is reported as
 * such and counted as a failure, because its payload cannot be checked here.
 */
import { readFileSync } from "node:fs";
import { parseBackupManifest } from "@/backup/backup-schema";

function photoKind(base64: string): string {
  const head = Buffer.from(base64.slice(0, 24), "base64");
  if (head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    return "jpeg";
  if (
    head.subarray(0, 4).toString("latin1") === "RIFF" &&
    head.subarray(8, 12).toString("latin1") === "WEBP"
  )
    return "webp";
  return "other";
}

function validate(path: string): boolean {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`FAIL ${path}: not JSON (${String(error)})`);
    return false;
  }
  if (
    raw !== null &&
    typeof raw === "object" &&
    "ciphertext" in (raw as Record<string, unknown>)
  ) {
    console.error(`FAIL ${path}: encrypted envelope, cannot validate payload`);
    return false;
  }
  try {
    const manifest = parseBackupManifest(raw);
    const contacts = manifest.contacts as ReadonlyArray<{
      photoBase64?: string | null;
      photoSkipped?: boolean;
    }>;
    const kinds: Record<string, number> = {};
    let withPhoto = 0;
    let skipped = 0;
    for (const contact of contacts) {
      if (contact.photoBase64) {
        withPhoto += 1;
        const kind = photoKind(contact.photoBase64);
        kinds[kind] = (kinds[kind] ?? 0) + 1;
      }
      if (contact.photoSkipped === true) skipped += 1;
    }
    console.log(
      `OK ${path}: v${manifest.backupFormatVersion} contacts=${contacts.length} withPhoto=${withPhoto} photoSkipped=${skipped} kinds=${JSON.stringify(kinds)}`,
    );
    return true;
  } catch (error) {
    console.error(
      `FAIL ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: validate-backup-fixture.ts <file.json> [...]");
  process.exit(2);
}
const results = files.map(validate);
process.exit(results.every(Boolean) ? 0 : 1);
