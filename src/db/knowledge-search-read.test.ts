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
        "phone-method",
        contactId,
        "phone",
        "+1 555 0100",
        "+1 555 0100",
        1,
        1,
        0,
        NOW,
        NOW,
        "email-method",
        contactId,
        "email",
        "alex@example.com",
        "alex@example.com",
        1,
        1,
        0,
        NOW,
        NOW,
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

    const originalGiftIdeaSearchability =
      MEMORY_TYPE_REGISTRY.gift_idea.searchable;
    MEMORY_TYPE_REGISTRY.gift_idea.searchable = false;
    try {
      await addMemory(exec, {
        contactId,
        type: "gift_idea",
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
        `INSERT INTO off_limits (uid, contact_id, label, text, url, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "off-limits-row",
          contactId,
          "Divorce topic",
          "Never ask about the custody case",
          "https://example.com/off-limits-url-marker",
          NOW,
          NOW,
        ],
      );
      await exec.runAsync(
        `INSERT INTO current_state_entries
           (uid, contact_id, field_key, value, entry_date, url, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "talked-previous",
          contactId,
          "last_talked_about",
          "Previous marathon training",
          "2026-08-01",
          null,
          NOW,
          NOW,
          "talked-current",
          contactId,
          "last_talked_about",
          "Current job interview",
          "2026-09-01",
          "https://example.com/current-state-url-marker",
          NOW,
          NOW,
          "location-current",
          contactId,
          "current_location",
          "Lisbon",
          "2026-09-02",
          null,
          NOW,
          NOW,
          "unknown-field",
          contactId,
          "retired_field_key",
          "Unregistered field marker",
          "2026-09-02",
          null,
          NOW,
          NOW,
        ],
      );

      const corpus = await listKnowledgeSearchCandidates(exec, {
        eligibleIds: [contactId],
      });
      expect(corpus).toHaveLength(1);
      expect(corpus[0]).toMatchObject({ contactId });
      expect(corpus[0].entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: "name",
            text: "Alex Example",
            label: "Name",
          }),
          expect.objectContaining({
            source: "phone",
            text: "+1 555 0100",
            label: "Phone",
          }),
          expect.objectContaining({
            source: "email",
            text: "alex@example.com",
            label: "Email",
          }),
          expect.objectContaining({
            source: "category",
            text: "Friends",
            label: "Category",
          }),
          expect.objectContaining({
            source: "memory",
            part: "memory-or-custom-field",
            memoryType: "general",
            text: "Weekend hobby",
          }),
          expect.objectContaining({
            source: "memory",
            part: "memory-or-custom-field",
            memoryType: "general",
            text: "Climbing on Sundays",
          }),
          expect.objectContaining({
            source: "memory",
            part: "note-or-body",
            memoryType: "general",
            text: "Indoor wall",
          }),
          expect.objectContaining({
            source: "relationship",
            part: "relationship",
            relationType: "friend",
            text: "Sam Rivera",
          }),
          expect.objectContaining({
            source: "relationship",
            part: "note-or-body",
            relationType: "friend",
            text: "Met through climbing",
          }),
          expect.objectContaining({
            source: "customField",
            fieldKey: "nickname",
            label: "nickname",
            part: "memory-or-custom-field",
            text: "Lex",
          }),
          expect.objectContaining({
            source: "offLimits",
            label: "Off Limits",
            text: "Divorce topic",
          }),
          expect.objectContaining({
            source: "offLimits",
            label: "Off Limits",
            text: "Never ask about the custody case",
          }),
          expect.objectContaining({
            source: "currentState",
            currentStateField: "last_talked_about",
            label: "Last Talked About",
            text: "Current job interview",
          }),
          expect.objectContaining({
            source: "currentState",
            currentStateField: "last_talked_about",
            label: "Last Talked About",
            text: "Previous marathon training",
          }),
          expect.objectContaining({
            source: "currentState",
            currentStateField: "current_location",
            label: "Current Location",
            text: "Lisbon",
          }),
        ]),
      );
      expect(corpus.map((candidate) => candidate.contactId)).not.toContain(
        excludedContactId,
      );

      const entryText = corpus[0].entries.map((entry) => entry.text).join(" ");
      expect(entryText).not.toContain("Non-searchable Memory marker");
      expect(entryText).not.toContain("Quarantined marker");
      expect(entryText).not.toContain("off-limits-url-marker");
      expect(entryText).not.toContain("current-state-url-marker");
      expect(entryText).not.toContain("Unregistered field marker");
      expect(entryText).not.toContain("internal-provenance-marker");
      expect(entryText).not.toContain("internal-uid-marker");

      expect(rankCandidates("climing", corpus)).toEqual(corpus);
      expect(rankCandidates("sam", corpus)).toEqual(corpus);
      expect(rankCandidates("lex", corpus)).toEqual(corpus);
      expect(rankCandidates("555", corpus)).toEqual(corpus);
      expect(rankCandidates("friends", corpus)).toEqual(corpus);
      expect(rankCandidates("custody", corpus)).toEqual(corpus);
      expect(rankCandidates("marathon", corpus)).toEqual(corpus);
      expect(rankCandidates("lisbon", corpus)).toEqual(corpus);
      expect(rankCandidates("internal-provenance-marker", corpus)).toEqual([]);
      expect(rankCandidates("internal-uid-marker", corpus)).toEqual([]);
    } finally {
      MEMORY_TYPE_REGISTRY.gift_idea.searchable = originalGiftIdeaSearchability;
    }
  });

  it("includes Gift Ideas and Thought of Them through the registry flag, and skips blank Off Limits parts", async () => {
    const contactId = await seedContact();
    await addMemory(exec, {
      contactId,
      type: "gift_idea",
      value: "Pottery wheel",
      createdAt: NOW,
      now: NOW,
    });
    await addMemory(exec, {
      contactId,
      type: "thought_of_them",
      value: "Article about tide pools",
      createdAt: NOW,
      now: NOW,
    });
    await exec.runAsync(
      `INSERT INTO off_limits (uid, contact_id, label, text, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["blank-off-limits", contactId, "   ", "Only the text", NOW, NOW],
    );

    const corpus = await listKnowledgeSearchCandidates(exec, {
      eligibleIds: [contactId],
    });
    expect(corpus[0].entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "memory",
          memoryType: "gift_idea",
          text: "Pottery wheel",
        }),
        expect.objectContaining({
          source: "memory",
          memoryType: "thought_of_them",
          text: "Article about tide pools",
        }),
      ]),
    );
    expect(
      corpus[0].entries.filter((entry) => entry.source === "offLimits"),
    ).toEqual([
      expect.objectContaining({ label: "Off Limits", text: "Only the text" }),
    ]);
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

  it("excludes hidden or outdated knowledge while retaining visible entries", async () => {
    const contactId = await seedContact();
    const visibleMemory = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Visible memory marker",
      createdAt: NOW,
      now: NOW,
    });
    const hiddenMemory = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Hidden memory marker",
      createdAt: NOW,
      now: NOW,
    });
    const outdatedMemory = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Outdated memory marker",
      createdAt: NOW,
      now: NOW,
    });
    await exec.runAsync("UPDATE memories SET hidden = 1 WHERE id = ?", [
      hiddenMemory,
    ]);
    await exec.runAsync("UPDATE memories SET outdated = 1 WHERE id = ?", [
      outdatedMemory,
    ]);
    const visibleRelationship = await addRelationship(exec, {
      contactId,
      personName: "Visible relationship marker",
      createdAt: NOW,
      now: NOW,
    });
    const hiddenRelationship = await addRelationship(exec, {
      contactId,
      personName: "Hidden relationship marker",
      createdAt: NOW,
      now: NOW,
    });
    await exec.runAsync("UPDATE relationships SET hidden = 1 WHERE id = ?", [
      hiddenRelationship,
    ]);

    const corpus = await listKnowledgeSearchCandidates(exec, {
      eligibleIds: [contactId],
    });
    const text = corpus[0].entries.map((entry) => entry.text).join(" ");
    expect(text).toContain("Visible memory marker");
    expect(text).toContain("Visible relationship marker");
    expect(text).not.toContain("Hidden memory marker");
    expect(text).not.toContain("Outdated memory marker");
    expect(text).not.toContain("Hidden relationship marker");
    expect(visibleMemory).toBeGreaterThan(0);
    expect(visibleRelationship).toBeGreaterThan(0);
  });

  it("reads custom values once for a multi-contact batch and ignores quarantined definitions", async () => {
    const firstContact = await seedContact("First");
    const secondContact = await seedContact("Second");
    const liveDef = await insertField("live_marker");
    const quarantinedDef = await insertField("quarantined_marker", NOW);
    await exec.runAsync(
      `INSERT INTO custom_field_values
         (uid, contact_id, field_def_id, value, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
      [
        "first-live",
        firstContact,
        liveDef,
        "First visible value",
        NOW,
        NOW,
        "second-live",
        secondContact,
        liveDef,
        "Second visible value",
        NOW,
        NOW,
        "first-quarantined",
        firstContact,
        quarantinedDef,
        "Quarantined value",
        NOW,
        NOW,
      ],
    );
    const getAllAsync = vi.spyOn(exec, "getAllAsync");

    const corpus = await listKnowledgeSearchCandidates(exec, {
      eligibleIds: [firstContact, secondContact],
    });

    expect(
      getAllAsync.mock.calls.filter(([sql]) =>
        String(sql).includes("FROM custom_field_values AS values_table"),
      ),
    ).toHaveLength(1);
    expect(
      corpus.find((candidate) => candidate.contactId === firstContact)?.entries,
    ).toContainEqual(expect.objectContaining({ text: "First visible value" }));
    expect(
      corpus.find((candidate) => candidate.contactId === secondContact)
        ?.entries,
    ).toContainEqual(expect.objectContaining({ text: "Second visible value" }));
    expect(corpus.flatMap((candidate) => candidate.entries)).not.toContainEqual(
      expect.objectContaining({ text: "Quarantined value" }),
    );
  });
});
