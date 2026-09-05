import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { listKnowledgeSearchCandidates } from "@/db/knowledge-search-read";
import { addMemory } from "@/db/memories-dao";
import { MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import { runMigrations } from "@/db/migrations/runner";
import { addRelationship } from "@/db/relationships-dao";
import type { SqlExecutor } from "@/db/types";
import { rankCandidates } from "@/services/knowledge-search";

const NOW = "2026-09-04 12:00:00";
let exec: SqlExecutor;
let uidCounter = 0;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `migration-${++uidCounter}`,
  });
});

async function seedContact(name: string = "Alex Example"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [`contact-${++uidCounter}`, name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function insertField(
  colName: string,
  quarantinedAt: string | null = null,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO custom_field_defs (
       uid, col_name, label, type, options, show_on_new, always_show,
       display_order, quarantined_at, share_with_ai, created_at, modified_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `def-${colName}`,
      colName,
      colName,
      "text",
      null,
      0,
      0,
      0,
      quarantinedAt,
      0,
      NOW,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

describe("knowledge search corpus read", () => {
  it("scopes the completed corpus and preserves semantic provenance", async () => {
    const contactId = await seedContact();
    const excludedContactId = await seedContact("Archived Scope Leak");
    const category = await exec.runAsync(
      "INSERT INTO categories (uid, name, display_order, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
      ["category-friends", "Friends", 0, NOW, NOW],
    );
    await exec.runAsync("UPDATE contacts SET category_id = ? WHERE id = ?", [
      category.lastInsertRowId,
      contactId,
    ]);
    await exec.runAsync(
      `INSERT INTO contact_methods
        (uid, contact_id, method_type, raw_value, display_value, is_actionable, is_primary, display_order, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "phone-method", contactId, "phone", "+1 555 0100", "+1 555 0100", 1, 1, 0, NOW, NOW,
        "email-method", contactId, "email", "alex@example.com", "alex@example.com", 1, 1, 0, NOW, NOW,
      ],
    );
    const memoryId = await addMemory(exec, {
      contactId,
      type: "general",
      customLabel: "Weekend hobby",
      value: "Climbing on Sundays",
      note: "Indoor wall",
      provenance: "share",
      createdAt: NOW,
      now: NOW,
    });
    await exec.runAsync(
      "UPDATE memories SET provenance = ?, uid = ? WHERE id = ?",
      ["internal-provenance-marker", "internal-uid-marker", memoryId],
    );

    const originalCustomSearchability = MEMORY_TYPE_REGISTRY.custom.searchable;
    MEMORY_TYPE_REGISTRY.custom.searchable = false;
    try {
      await addMemory(exec, {
        contactId,
        type: "custom",
        customLabel: "Hidden registry type",
        value: "Non-searchable Memory marker",
        createdAt: NOW,
        now: NOW,
      });
      await addRelationship(exec, {
        contactId,
        personName: "Sam Rivera",
        relationType: "friend",
        createdAt: NOW,
        now: NOW,
      });
      await exec.runAsync(
        "UPDATE relationships SET note = ? WHERE contact_id = ?",
        ["Met through climbing", contactId],
      );

      const nicknameDefId = await insertField("nickname");
      const secretDefId = await insertField("secret_field", NOW);
      await exec.runAsync(
        `INSERT INTO custom_field_values
           (uid, contact_id, field_def_id, value, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["nickname-value", contactId, nicknameDefId, "Lex", NOW, NOW],
      );
      await exec.runAsync(
        `INSERT INTO custom_field_values
           (uid, contact_id, field_def_id, value, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "secret-value",
          contactId,
          secretDefId,
          "Quarantined marker",
          NOW,
          NOW,
        ],
      );
      await exec.runAsync(
        `INSERT INTO fuel (uid, contact_id, kind, text, created_at, source, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "off-limits-fuel",
          contactId,
          "off_limits",
          "Off-limits fuel marker",
          NOW,
          "manual",
          NOW,
        ],
      );
      await exec.runAsync(
        `INSERT INTO fuel (uid, contact_id, kind, text, created_at, source, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ["ai-fuel", contactId, "topic", "AI fuel marker", NOW, "ai", NOW],
      );

      const corpus = await listKnowledgeSearchCandidates(exec, {
        eligibleIds: [contactId],
      });
      expect(corpus).toHaveLength(1);
      expect(corpus[0]).toMatchObject({ contactId });
      expect(corpus[0].entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: "name", text: "Alex Example", label: "Name" }),
          expect.objectContaining({ source: "phone", text: "+1 555 0100", label: "Phone" }),
          expect.objectContaining({ source: "email", text: "alex@example.com", label: "Email" }),
          expect.objectContaining({ source: "category", text: "Friends", label: "Category" }),
          expect.objectContaining({ source: "memory", part: "memory-or-custom-field", memoryType: "general", text: "Weekend hobby" }),
          expect.objectContaining({ source: "memory", part: "memory-or-custom-field", memoryType: "general", text: "Climbing on Sundays" }),
          expect.objectContaining({ source: "memory", part: "note-or-body", memoryType: "general", text: "Indoor wall" }),
          expect.objectContaining({ source: "relationship", part: "relationship", relationType: "friend", text: "Sam Rivera" }),
          expect.objectContaining({ source: "relationship", part: "note-or-body", relationType: "friend", text: "Met through climbing" }),
          expect.objectContaining({ source: "customField", fieldKey: "nickname", label: "nickname", part: "memory-or-custom-field", text: "Lex" }),
        ]),
      );
      expect(corpus.map((candidate) => candidate.contactId)).not.toContain(
        excludedContactId,
      );

      const entryText = corpus[0].entries.map((entry) => entry.text).join(" ");
      expect(entryText).not.toContain("Non-searchable Memory marker");
      expect(entryText).not.toContain("Quarantined marker");
      expect(entryText).not.toContain("Off-limits fuel marker");
      expect(entryText).not.toContain("AI fuel marker");
      expect(entryText).not.toContain("internal-provenance-marker");
      expect(entryText).not.toContain("internal-uid-marker");

      expect(rankCandidates("climing", corpus)).toEqual(corpus);
      expect(rankCandidates("sam", corpus)).toEqual(corpus);
      expect(rankCandidates("lex", corpus)).toEqual(corpus);
      expect(rankCandidates("555", corpus)).toEqual(corpus);
      expect(rankCandidates("friends", corpus)).toEqual(corpus);
      expect(rankCandidates("internal-provenance-marker", corpus)).toEqual([]);
      expect(rankCandidates("internal-uid-marker", corpus)).toEqual([]);
    } finally {
      MEMORY_TYPE_REGISTRY.custom.searchable = originalCustomSearchability;
    }
  });

  it("excludes blank custom-field values", async () => {
    const contactId = await seedContact();
    const defId = await insertField("blank_value");
    await exec.runAsync(
      `INSERT INTO custom_field_values
         (uid, contact_id, field_def_id, value, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["blank-value", contactId, defId, "  \t", NOW, NOW],
    );

    const corpus = await listKnowledgeSearchCandidates(exec, {
      eligibleIds: [contactId],
    });
    expect(corpus[0].entries).not.toContainEqual(
      expect.objectContaining({
        source: "customField",
        fieldKey: "blank_value",
      }),
    );
  });

  it("returns no corpus rows for an empty eligible-id scope", async () => {
    await seedContact();
    await expect(
      listKnowledgeSearchCandidates(exec, { eligibleIds: [] }),
    ).resolves.toEqual([]);
  });
});
