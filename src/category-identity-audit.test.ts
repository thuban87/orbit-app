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
const CATEGORY_PATHS: readonly CategoryPath[] = [
  {
    file: "src/db/categories-dao.ts",
    identity: "id",
    role: "canonical catalog writer, ordered read, deletion coordinator",
  },
  {
    file: "src/db/contact-read.ts",
    identity: "id",
    role: "ordered chooser rows and display-name join",
  },
  {
    file: "src/db/contacts-dao.ts",
    identity: "id",
    role: "single-contact create, edit, and category assignment",
  },
  {
    file: "src/db/recency-dao.ts",
    identity: "id",
    role: "contact creation through recency transaction",
  },
  {
    file: "src/db/import-session-dao.ts",
    identity: "id",
    role: "all-status batch import assignment",
  },
  {
    file: "src/db/systems-dao.ts",
    identity: "uid/ref",
    role: "category rules and System reference mutation",
  },
  {
    file: "src/db/systems-catalog-read.ts",
    identity: "uid/ref",
    role: "ordered category System catalog",
  },
  {
    file: "src/db/profile-presentation-dao.ts",
    identity: "id",
    role: "local Profile category presentation",
  },
  {
    file: "src/db/app-settings-dao.ts",
    identity: "uid/ref",
    role: "portable durable Orrery System selection",
  },
  {
    file: "src/db/tombstones-dao.ts",
    identity: "uid/ref",
    role: "portable deletion evidence",
  },
  {
    file: "src/db/merge-dao.ts",
    identity: "id",
    role: "explicit contact merge field resolution",
  },
  {
    file: "src/db/reconcile-apply.ts",
    identity: "id",
    role: "system-contact reconciliation preservation",
  },
  {
    file: "src/db/bulk-actions-dao.ts",
    identity: "id",
    role: "Dashboard bulk assignment writer",
  },
  {
    file: "src/db/dashboard-read.ts",
    identity: "name",
    role: "Dashboard category labels",
  },
  {
    file: "src/db/profile-read.ts",
    identity: "name",
    role: "Profile display label",
  },
  {
    file: "src/db/ai-context-read.ts",
    identity: "name",
    role: "explicitly permitted AI identity label",
  },
  {
    file: "src/db/knowledge-search-read.ts",
    identity: "name",
    role: "local category-label search",
  },
  {
    file: "src/db/first-class-knowledge-read.ts",
    identity: "name",
    role: "Profile first-class category label",
  },
  {
    file: "src/backup/backup-schema.ts",
    identity: "uid/ref",
    role: "portable format validation",
  },
  {
    file: "src/backup/export-manifest.ts",
    identity: "uid/ref",
    role: "portable category relationships",
  },
  {
    file: "src/backup/reconciliation.ts",
    identity: "uid/ref",
    role: "tombstone-aware merge planning",
  },
  {
    file: "src/backup/restore-apply.ts",
    identity: "uid/ref",
    role: "merge and exact replace-all apply",
  },
  {
    file: "src/screens/CreateContactScreen.tsx",
    identity: "id",
    role: "create chooser and stale selection validation",
  },
  {
    file: "src/screens/EditContactScreen.tsx",
    identity: "id",
    role: "edit chooser and stale selection validation",
  },
  {
    file: "src/screens/BulkImportSetupScreen.tsx",
    identity: "id",
    role: "bulk-import default chooser",
  },
  {
    file: "src/screens/ImportReviewScreen.tsx",
    identity: "id",
    role: "single-import chooser",
  },
  {
    file: "src/screens/HomeScreen.tsx",
    identity: "id",
    role: "Dashboard bulk chooser",
  },
  {
    file: "src/components/profile/ProfileTemplateManager.tsx",
    identity: "id",
    role: "bounded category layout assignment",
  },
  {
    file: "src/components/profile/ProfileBackgroundManager.tsx",
    identity: "id",
    role: "bounded category background assignment",
  },
  {
    file: "src/screens/SystemBuilderScreen.tsx",
    identity: "uid/ref",
    role: "complete Category rule authoring",
  },
  {
    file: "src/components/orrery/OrrerySystemSelector.tsx",
    identity: "uid/ref",
    role: "grouped System selection",
  },
  {
    file: "src/stores/orrery-system-store.ts",
    identity: "uid/ref",
    role: "selected Category System refresh and fallback",
  },
  {
    file: "src/screens/MergeConflictsScreen.tsx",
    identity: "name",
    role: "audited pre-existing screen-local SQL label exception",
  },
];

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
    expect(
      [...REQUIRED_CONSUMERS].filter((file) => !classified.has(file)),
    ).toEqual([]);
  });

  it("keeps each classified path present and category-bearing", () => {
    for (const { file, identity, role } of CATEGORY_PATHS) {
      expect(role.length, file).toBeGreaterThan(0);
      expect(["id", "uid/ref", "name"], file).toContain(identity);
      expect(source(file), file).toMatch(
        /categor(y|ies)|category_id|categoryUid|category_ref/i,
      );
    }
  });

  it("pins the no-schema-change phase boundary and portable format 6", () => {
    const database = source("src/db/database.ts");
    const migrationTests = source("src/db/migrations/full-chain.test.ts");
    const backupTypes = source("src/backup/types.ts");
    expect(database).toContain(
      "TARGET_VERSION = AI_CONFIGURATION_SCHEMA_VERSION",
    );
    expect(database).not.toMatch(/migration030|030-category/i);
    expect(migrationTests).toContain("expect(TARGET_VERSION).toBe(29)");
    expect(backupTypes).toMatch(/BACKUP_FORMAT_VERSION\s*=\s*6/);
  });

  it("keeps category seeding migration-only and leaves zero-category restore exact", () => {
    expect(source("src/db/migrations/001-initial.ts")).toContain(
      "SEED_CATEGORIES",
    );
    for (const file of [
      "src/db/categories-dao.ts",
      "src/backup/restore-apply.ts",
      "src/services/backup/backup-service.ts",
    ]) {
      expect(source(file), file).not.toContain("SEED_CATEGORIES");
    }
    const restore = source("src/backup/restore-apply.ts");
    expect(restore).toContain('if (entity === "categories") continue');
    expect(restore).toContain("clearLiveCategoryTombstones");
  });

  it("keeps production component SQL at the one audited merge exception", () => {
    const components = CATEGORY_PATHS.filter(({ file }) =>
      /src\/(screens|components)\//.test(file),
    );
    for (const { file } of components) {
      const hasSql =
        /\b(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]{0,120}\b(categories|category_id)\b/i.test(
          source(file),
        );
      expect(hasSql, file).toBe(
        file === "src/screens/MergeConflictsScreen.tsx",
      );
    }
  });

  it("routes every import status through one reassignment and deletes the parent last", () => {
    const dao = source("src/db/categories-dao.ts");
    expect(dao).toContain('importCounts.get("pending")');
    expect(dao).toContain('importCounts.get("complete")');
    expect(dao).toContain('importCounts.get("discarded")');
    expect(dao).toContain("reassignImportSessionsCategoryCore");
    const parentDelete = dao.indexOf('"DELETE FROM categories WHERE id=?"');
    for (const stage of [
      'stage("contacts")',
      'stage("imports")',
      'stage("rules")',
      'stage("overrides")',
      'stage("prefs")',
      'stage("active-selection")',
      'stage("dashboard-filter")',
      'stage("profile")',
      'stage("order")',
      'stage("tombstone")',
    ])
      expect(dao.indexOf(stage), stage).toBeLessThan(parentDelete);
  });

  it("does not add alternate category databases, dev fault routes, or category-path colors", () => {
    const joined = CATEGORY_PATHS.map(({ file }) => source(file)).join("\n");
    expect(joined).not.toMatch(
      /category[^\n]*(test database|alternate database|fault route)/i,
    );
    expect(joined).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
