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
  it("is application-owned and includes the default, imported, gift and share types", () => {
    expect(MEMORY_TYPE_REGISTRY[DEFAULT_MEMORY_TYPE_KEY]).toMatchObject({
      cardinality: expect.stringMatching(/^(single|many)$/),
      visibilityDefault: expect.stringMatching(/^(show|hide)$/),
    });
    expect(Object.keys(MEMORY_TYPE_REGISTRY).sort()).toEqual([
      "general",
      "gift_idea",
      "imported",
      "thought_of_them",
    ]);
    expect(MEMORY_TYPE_REGISTRY.imported).toMatchObject({
      displayName: "Imported from Contacts App",
      searchable: true,
      aiDefault: false,
    });
    expect(isMemoryTypeKey("imported")).toBe(true);
    expect(isMemoryTypeKey(DEFAULT_MEMORY_TYPE_KEY)).toBe(true);
    expect(isMemoryTypeKey("made_up_type")).toBe(false);
  });

  it("D-86: the custom type is gone", () => {
    expect(isMemoryTypeKey("custom")).toBe(false);
  });

  it("D-34/D-43/D-91/D-92: Gift Ideas and Thought of Them are searchable, shown and AI-default off", () => {
    for (const [key, displayName] of [
      ["gift_idea", "Gift Ideas"],
      ["thought_of_them", "Thought of Them"],
    ] as const) {
      expect(isMemoryTypeKey(key)).toBe(true);
      expect(MEMORY_TYPE_REGISTRY[key]).toMatchObject({
        displayName,
        searchable: true,
        visibilityDefault: "show",
        aiDefault: false,
        userPickable: true,
      });
    }
  });

  it("D-35: imported is the only type the user cannot pick", () => {
    const pickable = Object.entries(MEMORY_TYPE_REGISTRY)
      .filter(([, meta]) => meta.userPickable)
      .map(([key]) => key)
      .sort();
    expect(pickable).toEqual(["general", "gift_idea", "thought_of_them"]);
    expect(MEMORY_TYPE_REGISTRY.imported.userPickable).toBe(false);
  });

  it("resolves the D-11 owner-final Memory-type display names without collision", () => {
    // D-11 (owner-resolved 2026-09-12): general → "Memory".
    expect(MEMORY_TYPE_REGISTRY.general.displayName).toBe("Memory");
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
    // G-23 (D-89): title case.
    expect(RELATIONSHIPS_GROUP.displayName).toBe("Key People");
  });
});
