import { describe, expect, it } from "vitest";
import { isBackupShareIntent } from "./backup-share-intent";

describe("isBackupShareIntent", () => {
  it("accepts exactly one explicitly shared JSON backup", () => {
    expect(isBackupShareIntent({
      type: "file",
      files: [{ mimeType: "application/json" }],
    })).toBe(true);
    expect(isBackupShareIntent({
      type: "file",
      files: [{ mimeType: "TEXT/JSON" }],
    })).toBe(true);
  });

  it("does not route text, non-JSON, or multi-file shares into restore", () => {
    expect(isBackupShareIntent({ type: "text", files: null })).toBe(false);
    expect(isBackupShareIntent({ type: "file", files: [{ mimeType: "text/plain" }] })).toBe(false);
    expect(isBackupShareIntent({
      type: "file",
      files: [{ mimeType: "application/json" }, { mimeType: "application/json" }],
    })).toBe(false);
  });
});
