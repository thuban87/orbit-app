import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Identity = "id" | "uid/ref" | "name";
type CategoryPath = {
  file: string;
  identity: Identity;
  role: string;
};

// Filled by the GREEN step after the full-tree category audit. Keeping this
// inventory executable makes omissions visible when category-bearing paths are
// added or moved.
const CATEGORY_PATHS: readonly CategoryPath[] = [];

const REQUIRED_CONSUMERS = [
  "src/screens/MergeConflictsScreen.tsx",
  "src/db/merge-dao.ts",
  "src/db/reconcile-apply.ts",
  "src/db/bulk-actions-dao.ts",
  "src/db/dashboard-read.ts",
  "src/db/profile-read.ts",
  "src/db/ai-context-read.ts",
  "src/db/knowledge-search-read.ts",
  "src/db/first-class-knowledge-read.ts",
  "src/stores/orrery-system-store.ts",
] as const;

const source = (file: string) => readFileSync(file, "utf8");

describe("category identity repository audit", () => {
  it("classifies every mandatory merge, Dashboard, Profile, AI, knowledge, and Orrery path", () => {
    const classified = new Set(CATEGORY_PATHS.map(({ file }) => file));
    expect([...REQUIRED_CONSUMERS].filter((file) => !classified.has(file))).toEqual([]);
  });

  it("keeps each classified path present and category-bearing", () => {
    for (const { file, identity, role } of CATEGORY_PATHS) {
      expect(role.length, file).toBeGreaterThan(0);
      expect(["id", "uid/ref", "name"], file).toContain(identity);
      expect(source(file), file).toMatch(/categor(y|ies)|category_id|categoryUid|category_ref/i);
    }
  });
});
