import { describe, expect, it } from "vitest";
import { assertOrreryLastSystem } from "@/db/app-settings-dao";
import {
  buildOrrerySystemWhere,
  parseSystemRef,
  systemRefId,
} from "@/logic/orrery-system-logic";

describe("custom Orrery System identity", () => {
  it("round-trips a bounded custom token while retaining existing identities", () => {
    const custom = { kind: "custom" as const, uid: "custom-uid" };
    expect(systemRefId(custom)).toBe("custom:custom-uid");
    expect(parseSystemRef("custom:custom-uid")).toEqual(custom);
    expect(parseSystemRef("builtin:all-contacts")).toEqual({
      kind: "builtin",
      id: "all-contacts",
    });
    expect(parseSystemRef("category:category-uid")).toEqual({
      kind: "category",
      uid: "category-uid",
    });
    expect(() => assertOrreryLastSystem("System", "custom:bad\nuid")).toThrow();
  });

  it("requires custom Systems to use the resolver rather than a SQL WHERE", () => {
    expect(() =>
      buildOrrerySystemWhere({ kind: "custom", uid: "custom-uid" }),
    ).toThrow("custom Systems resolve via the resolver, not a WHERE");
  });
});
