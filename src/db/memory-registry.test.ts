import { describe, expect, it } from "vitest";
import {
  CURRENT_STATE_FIELD_KEYS,
  CURRENT_STATE_FIELD_REGISTRY,
  DEFAULT_MEMORY_TYPE_KEY,
  isCurrentStateFieldKey,
  isMemoryTypeKey,
  MEMORY_TYPE_REGISTRY,
  RELATIONSHIPS_GROUP,
} from "@/db/memory-registry";

describe("Memory type registry", () => {
  it("is application-owned and includes the default, imported, and custom types", () => {
    expect(MEMORY_TYPE_REGISTRY[DEFAULT_MEMORY_TYPE_KEY]).toMatchObject({
      cardinality: expect.stringMatching(/^(single|many)$/),
      visibilityDefault: expect.stringMatching(/^(show|hide)$/),
    });
    expect(MEMORY_TYPE_REGISTRY.custom).toBeDefined();
    expect(MEMORY_TYPE_REGISTRY.imported).toMatchObject({
      displayName: "Imported from Contacts App",
      searchable: true,
      aiDefault: false,
    });
    expect(isMemoryTypeKey("imported")).toBe(true);
    expect(isMemoryTypeKey(DEFAULT_MEMORY_TYPE_KEY)).toBe(true);
    expect(isMemoryTypeKey("made_up_type")).toBe(false);
  });

  it("resolves the D-11 owner-final Memory-type display names without collision", () => {
    // D-11 (owner-resolved 2026-09-12): general → "Memory", custom → "Custom".
    expect(MEMORY_TYPE_REGISTRY.general.displayName).toBe("Memory");
    expect(MEMORY_TYPE_REGISTRY.custom.displayName).toBe("Custom");
    // No two built-in memory types may share a display name (a duplicate would let
    // a user mis-file a Memory — T-34-05).
    const displayNames = Object.values(MEMORY_TYPE_REGISTRY).map(
      (meta) => meta.displayName,
    );
    expect(new Set(displayNames).size).toBe(displayNames.length);
    // Rapid capture still requests the default type BY KEY, never by display name.
    expect(DEFAULT_MEMORY_TYPE_KEY).toBe("general");
  });

  it("owns the complete history-aware field contract", () => {
    expect(CURRENT_STATE_FIELD_KEYS).toEqual([
      "last_talked_about",
      "current_location",
    ]);
    expect(Object.keys(CURRENT_STATE_FIELD_REGISTRY).sort()).toEqual(
      [...CURRENT_STATE_FIELD_KEYS].sort(),
    );
    expect(isCurrentStateFieldKey("current_location")).toBe(true);
    expect(isCurrentStateFieldKey("bogus")).toBe(false);
    expect(RELATIONSHIPS_GROUP.visibilityDefault).toBe("show");
  });
});
