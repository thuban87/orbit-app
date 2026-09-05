import { describe, expect, it } from "vitest";

import { MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import {
  buildDashboardSearchResult,
  searchDashboard,
} from "@/logic/dashboard-search-match";
import type { KnowledgeSearchCandidate } from "@/db/knowledge-search-read";

function candidate(
  contactId: number,
  entries: KnowledgeSearchCandidate["entries"],
): KnowledgeSearchCandidate {
  return { contactId, entries };
}

describe("dashboard search match descriptors", () => {
  it("maps semantic provenance, preserves scorer highlights, and collapses extras", () => {
    const source = candidate(1, [
      { source: "name", part: "identity", label: "Name", text: "Alex" },
      { source: "phone", part: "identity", label: "Phone", text: "555 Alex" },
      { source: "relationship", part: "relationship", label: "Friend", relationType: "Friend", text: "Alex friend" },
      { source: "memory", part: "memory-or-custom-field", label: "ignored", memoryType: "general", text: "Alex memory" },
      { source: "memory", part: "note-or-body", label: "ignored", memoryType: "general", text: "Alex note" },
      { source: "relationship", part: "note-or-body", label: "Friend", relationType: "Friend", text: "Alex relationship note" },
    ]);
    const result = buildDashboardSearchResult(source, "alex");

    expect(result).toMatchObject({
      contactId: 1,
      totalMatchCount: 6,
      moreMatchesLabel: "+3 more",
      matches: [
        { sourceKind: "identity", priority: 1, fieldLabel: "Name", highlights: [{ start: 0, length: 4 }] },
        { sourceKind: "identity", priority: 1, fieldLabel: "Phone" },
        { sourceKind: "relationship", priority: 2, fieldLabel: "Friend" },
      ],
    });
    expect(result.matches).toHaveLength(3);
    expect(result.matches.some((match) => match.fieldLabel === MEMORY_TYPE_REGISTRY.general.displayName)).toBe(false);
  });

  it("keeps name and secondary descriptors, and resolves memory labels from the registry", () => {
    const source = candidate(1, [
      { source: "name", part: "identity", label: "Name", text: "Alex" },
      { source: "memory", part: "memory-or-custom-field", label: "wrong label", memoryType: "general", text: "Alex hobby" },
    ]);
    const result = buildDashboardSearchResult(source, "alex");

    expect(result.matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "identity", fieldLabel: "Name" }),
      expect.objectContaining({
        sourceKind: "memory-or-custom-field",
        fieldLabel: MEMORY_TYPE_REGISTRY.general.displayName,
      }),
    ]));
  });

  it("maps memory and relationship notes to note-or-body while custom values stay semantic", () => {
    const source = candidate(2, [
      { source: "customField", part: "memory-or-custom-field", label: "Nickname", fieldKey: "nickname", text: "Nova" },
      { source: "memory", part: "note-or-body", label: "ignored", memoryType: "general", text: "Orchestra rehearsal" },
      { source: "relationship", part: "note-or-body", label: "Sibling", relationType: "Sibling", text: "Lives nearby" },
    ]);

    expect(buildDashboardSearchResult(source, "nova").matches[0]).toMatchObject({
      sourceKind: "memory-or-custom-field",
      fieldLabel: "Nickname",
    });
    expect(buildDashboardSearchResult(source, "orchestra").matches[0]).toMatchObject({
      sourceKind: "note-or-body",
      fieldLabel: MEMORY_TYPE_REGISTRY.general.displayName,
    });
    expect(buildDashboardSearchResult(source, "nearby").matches[0]).toMatchObject({
      sourceKind: "note-or-body",
      fieldLabel: "Sibling",
    });
  });

  it("uses resolved dashboard order only to break equal-relevance ties", () => {
    const earlier = candidate(10, [
      { source: "name", part: "identity", label: "Name", text: "Alex" },
    ]);
    const later = candidate(20, [
      { source: "name", part: "identity", label: "Name", text: "Alex" },
    ]);

    expect(searchDashboard([later, earlier], "alex", [10, 20]).map(
      (result) => result.contactId,
    )).toEqual([10, 20]);
  });
});
