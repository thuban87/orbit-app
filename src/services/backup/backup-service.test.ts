import { beforeEach, describe, expect, it, vi } from "vitest";

const manifest = {
  backupFormatVersion: 1,
  envelopeVersion: 1,
  metadata: { exportedAt: "2026-08-25 12:00:00", sqliteUserVersion: 7 },
  appSettings: { sunContactUid: null, modifiedAt: "2026-08-25 12:00:00" },
  categories: [],
  profile: null,
  contacts: [],
  interactions: [],
  events: [],
  fuel: [],
  contactLinks: [],
  customFieldDefs: [],
  customFieldValues: [],
  tombstones: [],
};
const mocks = vi.hoisted(() => ({ buildExportManifest: vi.fn() }));
vi.mock("@/backup/export-manifest", () => ({
  buildExportManifest: mocks.buildExportManifest,
}));

import { createManualExportService } from "@/services/backup/backup-service";

describe("manual backup service", () => {
  beforeEach(() => {
    mocks.buildExportManifest.mockReset().mockResolvedValue(manifest);
  });

  it("writes, reads and parses before opening the share sheet", async () => {
    const steps: string[] = [];
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        create: async () => ({
          uri: "file:///export.json",
          write: async () => {
            steps.push("write");
          },
          read: async () => {
            steps.push("read");
            return JSON.stringify(manifest);
          },
        }),
      },
      share: {
        isAvailable: async () => true,
        open: async () => {
          steps.push("share");
        },
      },
    });
    await expect(service.sharePlaintextExport()).resolves.toEqual({
      status: "shared",
    });
    expect(steps).toEqual(["write", "read", "share"]);
  });

  it("returns a recoverable failure without claiming protection when sharing fails", async () => {
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        create: async () => ({
          uri: "file:///export.json",
          write: async () => {},
          read: async () => JSON.stringify(manifest),
        }),
      },
      share: {
        isAvailable: async () => true,
        open: async () => {
          throw new Error("cancelled");
        },
      },
    });
    await expect(service.sharePlaintextExport()).resolves.toEqual({
      status: "share-failed",
    });
  });

  it("does not open a sheet when the platform has no sharing surface", async () => {
    const open = vi.fn();
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        create: async () => ({
          uri: "file:///export.json",
          write: async () => {},
          read: async () => JSON.stringify(manifest),
        }),
      },
      share: { isAvailable: async () => false, open },
    });

    await expect(service.sharePlaintextExport()).resolves.toEqual({
      status: "sharing-unavailable",
    });
    expect(open).not.toHaveBeenCalled();
  });

  it("never opens a share sheet for a failed read-back validation", async () => {
    const open = vi.fn();
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        create: async () => ({
          uri: "file:///export.json",
          write: async () => {},
          read: async () => "{}",
        }),
      },
      share: { isAvailable: async () => true, open },
    });

    await expect(service.sharePlaintextExport()).resolves.toEqual({
      status: "export-failed",
    });
    expect(open).not.toHaveBeenCalled();
  });

  it("rejects overlapping requests before creating an ambiguous second share operation", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const service = createManualExportService({
      exec: {} as never,
      exportedAt: manifest.metadata.exportedAt,
      readPhotoBase64: async () => "",
      files: {
        create: async () => ({
          uri: "file:///export.json",
          write: async () => {},
          read: async () => JSON.stringify(manifest),
        }),
      },
      share: { isAvailable: async () => true, open: async () => pending },
    });
    const first = service.sharePlaintextExport();
    await expect(service.sharePlaintextExport()).resolves.toEqual({
      status: "busy",
    });
    release();
    await expect(first).resolves.toEqual({ status: "shared" });
  });
});
