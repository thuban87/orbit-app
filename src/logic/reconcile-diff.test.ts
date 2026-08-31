import { describe, expect, it } from "vitest";
import {
  buildDesiredMethodList,
  classifyReconciliation,
  serializeMethodFamily,
  type ReconcileSource,
} from "@/logic/reconcile-diff";

const source = (overrides: Partial<ReconcileSource> = {}): ReconcileSource => ({
  externalContactLinkId: 1,
  displayName: "Source Name",
  methods: [],
  birthday: null,
  ...overrides,
});

const orbit = (overrides = {}) => ({
  name: "Orbit Name",
  birthday: null,
  photo: null,
  methods: [],
  modifiedAt: "2026-08-30 10:00:00",
  ...overrides,
});

describe("classifyReconciliation", () => {
  it("classifies scalar additive, conflict, removed, and reviewed source values", () => {
    expect(classifyReconciliation({ orbit: orbit({ name: null }), sources: [source()], lastReviewed: {} }).fields[0].outcome).toBe("additive");
    expect(classifyReconciliation({ orbit: orbit(), sources: [source()], lastReviewed: {} }).fields[0].outcome).toBe("conflict");
    expect(classifyReconciliation({ orbit: orbit(), sources: [source({ displayName: null })], lastReviewed: {} }).fields[0].outcome).toBe("removed-from-source");
    expect(classifyReconciliation({ orbit: orbit(), sources: [source()], lastReviewed: { name: "Source Name" } }).fields[0].outcome).toBe("unchanged-since-review");
  });

  it("uses missing-source as a single card state before field removals", () => {
    const result = classifyReconciliation({ orbit: orbit(), sources: [], omittedCount: 1, lastReviewed: {} });
    expect(result.missingSource).toBe(true);
    expect(result.fields).toEqual([expect.objectContaining({ outcome: "missing-source" })]);
  });

  it("uses canonical method values, not raw formatting or labels, for Orbit/source equality", () => {
    const result = classifyReconciliation({
      orbit: orbit({ methods: [{ type: "phone", value: "(312) 555-1234", label: "Mobile" }] }),
      sources: [source({ methods: [{ type: "phone", value: "312-555-1234" }] })],
      lastReviewed: {},
    });
    expect(result.fields.find((field) => field.fieldFamily === "phones")).toBeUndefined();
  });

  it("combines multiple sources into one deterministic set of options", () => {
    const result = classifyReconciliation({
      orbit: orbit(),
      sources: [source({ externalContactLinkId: 2, displayName: "Zed" }), source({ externalContactLinkId: 1, displayName: "Amy" })],
      lastReviewed: {},
    });
    expect(result.fields[0].sourceOptions.map((option) => option.value)).toEqual(["Amy", "Zed"]);
  });

  it("re-surfaces a reviewed value when the source changes again", () => {
    const result = classifyReconciliation({ orbit: orbit(), sources: [source({ displayName: "Changed Again" })], lastReviewed: { name: "Source Name" } });
    expect(result.fields[0].outcome).toBe("conflict");
  });
});

describe("serializeMethodFamily", () => {
  const methods = [
    { type: "phone" as const, value: "312-555-1234", label: "Mobile" },
    { type: "email" as const, value: "orbit@example.com", label: "Personal" },
  ];

  it("is stable across ordering but detects source add/remove/relabel changes", () => {
    const serialized = serializeMethodFamily(methods);
    expect(serializeMethodFamily([...methods].reverse())).toBe(serialized);
    expect(serializeMethodFamily([...methods, { type: "email", value: "new@example.com", label: null }])).not.toBe(serialized);
    expect(serializeMethodFamily(methods.slice(1))).not.toBe(serialized);
    expect(serializeMethodFamily([{ ...methods[0], label: "Work" }, methods[1]])).not.toBe(serialized);
  });
});

describe("buildDesiredMethodList", () => {
  it("never drops seeded Orbit methods when accepting an addition", () => {
    const current = [
      { type: "phone" as const, value: "312-555-1234" },
      { type: "email" as const, value: "orbit@example.com" },
    ];
    const desired = buildDesiredMethodList(current, [{ type: "email", value: "new@example.com" }]);
    expect(desired).toEqual(expect.arrayContaining(current));
    expect(desired).toHaveLength(3);
  });
});
