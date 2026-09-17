import { describe, expect, it } from "vitest";
import { createCategoryManagementLoadGuard } from "./CategoryManagementScreen";

describe("CategoryManagementScreen tracer contracts", () => {
  it("prevents stale loads from publishing", () => {
    const next = createCategoryManagementLoadGuard();
    const first = next();
    const second = next();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });
});
