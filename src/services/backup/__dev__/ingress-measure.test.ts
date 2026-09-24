import { describe, expect, it, vi } from "vitest";

vi.mock("expo-file-system", () => ({
  File: class {},
  Paths: { cache: "file:///cache" },
}));
vi.mock("../../../../modules/orbit-backup-document-picker", () => ({
  sampleBackupProcessPssKb: () => null,
}));

import { loadBackupForRestore } from "@/services/backup/backup-service";
import { syntheticManifest } from "./ingress-measure";

describe("synthetic ingress measurement fixture", () => {
  it("reaches the same ready preview validation as a real restore", () => {
    const contents = JSON.stringify(syntheticManifest(1024 * 1024));
    const candidate = loadBackupForRestore({ contents });
    expect(candidate.status).toBe("ready");
    if (candidate.status === "ready") {
      expect(candidate.preview.contactCount).toBeGreaterThan(0);
      expect(candidate.preview.photoCount).toBe(candidate.preview.contactCount);
    }
  });
});
