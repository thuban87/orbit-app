import { describe, expect, it } from "vitest";
import { isOwnedAutomaticBackupName } from "@/backup/backup-file-names";
import {
  backupFolderEntry,
  entriesFromUris,
  uriSegmentName,
} from "@/backup/backup-folder-entries";

// 38.12 review A-WR-02 / D-143: backup files are recognised by the provider's
// display name, never by the URI's last segment (an opaque id on Drive).
const DRIVE_URI =
  "content://com.google.android.apps.docs.storage/tree/acc%3D1%3Bdoc%3Dencoded%3Droot/document/acc%3D1%3Bdoc%3Dencoded%3DAbCd";

describe("backupFolderEntry — a provider child named by its display name", () => {
  it("names a Drive child by its display name, not its opaque URI id", () => {
    const entry = backupFolderEntry({
      uri: DRIVE_URI,
      name: "orbit-auto-2026-10-17-0930.json",
      mimeType: "application/json",
    });
    expect(entry).toEqual({
      uri: DRIVE_URI,
      name: "orbit-auto-2026-10-17-0930.json",
    });
    expect(isOwnedAutomaticBackupName(uriSegmentName(DRIVE_URI))).toBe(false);
    expect(isOwnedAutomaticBackupName(entry.name)).toBe(true);
  });

  it("adds .json to a JSON document whose provider kept the bare stem", () => {
    expect(
      backupFolderEntry({
        uri: DRIVE_URI,
        name: "orbit-auto-2026-10-17-0930",
        mimeType: "application/json; charset=utf-8",
      }).name,
    ).toBe("orbit-auto-2026-10-17-0930.json");
    expect(
      backupFolderEntry({
        uri: DRIVE_URI,
        name: "orbit-auto-2026-10-17-0930",
        mimeType: "text/json",
      }).name,
    ).toBe("orbit-auto-2026-10-17-0930.json");
  });

  it("leaves a non-JSON document's name alone, so it is never recognised as a backup", () => {
    const entry = backupFolderEntry({
      uri: DRIVE_URI,
      name: "orbit-auto-2026-10-17-0930",
      mimeType: "text/plain",
    });
    expect(entry.name).toBe("orbit-auto-2026-10-17-0930");
    expect(isOwnedAutomaticBackupName(entry.name)).toBe(false);
  });

  it("falls back to the URI segment when the provider gives no name", () => {
    const local =
      "content://com.android.externalstorage.documents/tree/primary%3AOrbit/document/primary%3AOrbit%2Forbit-auto-2026-10-17-0930.json";
    for (const name of [null, "", "  "]) {
      expect(
        backupFolderEntry({ uri: local, name, mimeType: "application/json" })
          .name,
      ).toBe("orbit-auto-2026-10-17-0930.json");
    }
  });
});

describe("uriSegmentName / entriesFromUris — the legacy URI listing", () => {
  it("names device-storage children by their decoded last segment", () => {
    expect(
      entriesFromUris([
        "content://com.android.externalstorage.documents/tree/primary%3AOrbit/document/primary%3AOrbit%2Forbit-backup-2026-10-17-0930.json",
      ]),
    ).toEqual([
      {
        uri: "content://com.android.externalstorage.documents/tree/primary%3AOrbit/document/primary%3AOrbit%2Forbit-backup-2026-10-17-0930.json",
        name: "orbit-backup-2026-10-17-0930.json",
      },
    ]);
  });

  it("never throws on an undecodable URI", () => {
    expect(uriSegmentName("content://x/a%E0%A4%A")).toBe("a%E0%A4%A");
  });
});
