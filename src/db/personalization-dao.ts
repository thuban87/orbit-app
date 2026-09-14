/** Durable Writing Style and ordered global Personalization Context sections. */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { inWriteTransaction, type ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

export type WritingTone = "casual" | "balanced" | "polished" | "custom";
export type WritingLength = "concise" | "normal" | "detailed" | "custom";
export type WritingDirectness = "gentle" | "balanced" | "direct" | "custom";

export interface WritingStyle {
  tone: WritingTone;
  length: WritingLength;
  directness: WritingDirectness;
  freeform: string;
}

export interface PersonalizationSection {
  id: number;
  uid: string;
  title: string;
  body: string;
  /** The sole egress gate: disabled sections stay local and are not rendered. */
  enabled: boolean;
  displayOrder: number;
  createdAt: string;
  modifiedAt: string;
}

interface WritingStyleRow {
  ai_writing_tone: WritingTone;
  ai_writing_length: WritingLength;
  ai_writing_directness: WritingDirectness;
  ai_writing_freeform: string;
}

interface PersonalizationSectionRow {
  id: number;
  uid: string;
  title: string;
  body: string;
  enabled: 0 | 1;
  display_order: number;
  created_at: string;
  modified_at: string;
}

function mapSection(row: PersonalizationSectionRow): PersonalizationSection {
  return {
    id: row.id,
    uid: row.uid,
    title: row.title,
    body: row.body,
    enabled: row.enabled === 1,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };
}

function assertOneChange(operation: string, changes: number): void {
  if (changes !== 1) {
    throw new Error(`${operation}: expected one changed row, got ${changes}`);
  }
}

function normalizeTitle(title: string): string {
  const normalized = title.trim();
  if (!normalized)
    throw new Error("Give this personalization section a title.");
  return normalized;
}

export async function getWritingStyle(
  exec: ReadOnlyExecutor,
): Promise<WritingStyle> {
  const row = await exec.getFirstAsync<WritingStyleRow>(
    `SELECT ai_writing_tone, ai_writing_length, ai_writing_directness,
            ai_writing_freeform
       FROM app_settings
      WHERE id = 1`,
  );
  if (!row)
    throw new Error("getWritingStyle: app_settings id=1 row is missing");
  return {
    tone: row.ai_writing_tone,
    length: row.ai_writing_length,
    directness: row.ai_writing_directness,
    freeform: row.ai_writing_freeform,
  };
}

export function updateWritingStyle(
  exec: SqlExecutor,
  style: WritingStyle,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `UPDATE app_settings
          SET ai_writing_tone = ?, ai_writing_length = ?,
              ai_writing_directness = ?, ai_writing_freeform = ?, modified_at = ?
        WHERE id = 1`,
      [style.tone, style.length, style.directness, style.freeform, now],
    );
    assertOneChange("updateWritingStyle", result.changes);
    await bumpDataRevisionCore(exec);
  });
}

export async function listPersonalizationSections(
  exec: ReadOnlyExecutor,
): Promise<PersonalizationSection[]> {
  const rows = await exec.getAllAsync<PersonalizationSectionRow>(
    `SELECT id, uid, title, body, enabled, display_order, created_at, modified_at
       FROM personalization_sections
      ORDER BY display_order, id`,
  );
  return rows.map(mapSection);
}

export function createPersonalizationSection(
  exec: SqlExecutor,
  input: { title: string; body: string; now: string },
): Promise<PersonalizationSection> {
  const title = normalizeTitle(input.title);
  return inWriteTransaction(exec, async () => {
    const orderRow = await exec.getFirstAsync<{ next_order: number }>(
      "SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM personalization_sections",
    );
    const displayOrder = orderRow?.next_order ?? 0;
    const uid = newUid();
    const result = await exec.runAsync(
      `INSERT INTO personalization_sections
         (uid, title, body, enabled, display_order, created_at, modified_at)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [uid, title, input.body, displayOrder, input.now, input.now],
    );
    await bumpDataRevisionCore(exec);
    return {
      id: result.lastInsertRowId,
      uid,
      title,
      body: input.body,
      enabled: true,
      displayOrder,
      createdAt: input.now,
      modifiedAt: input.now,
    };
  });
}

/**
 * Store already-read text as an ordinary editable local row. No URI, path, file
 * handle, or picker result enters this boundary, so later source-file changes
 * cannot affect the section.
 */
export function importPersonalizationSection(
  exec: SqlExecutor,
  input: { title: string; text: string; now: string },
): Promise<PersonalizationSection> {
  return createPersonalizationSection(exec, {
    title: input.title,
    body: input.text,
    now: input.now,
  });
}

async function updateSectionField(
  exec: SqlExecutor,
  operation: string,
  column: "title" | "body" | "enabled",
  value: string | number,
  uid: string,
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE personalization_sections SET ${column} = ?, modified_at = ? WHERE uid = ?`,
    [value, now, uid],
  );
  assertOneChange(operation, result.changes);
}

export function renamePersonalizationSection(
  exec: SqlExecutor,
  uid: string,
  title: string,
  now: string,
): Promise<void> {
  const normalized = normalizeTitle(title);
  return inWriteTransaction(exec, async () => {
    await updateSectionField(
      exec,
      "renamePersonalizationSection",
      "title",
      normalized,
      uid,
      now,
    );
    await bumpDataRevisionCore(exec);
  });
}

export function updatePersonalizationSectionBody(
  exec: SqlExecutor,
  uid: string,
  body: string,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await updateSectionField(
      exec,
      "updatePersonalizationSectionBody",
      "body",
      body,
      uid,
      now,
    );
    await bumpDataRevisionCore(exec);
  });
}

/** Rename and edit one section atomically for the combined screen editor. */
export function updatePersonalizationSection(
  exec: SqlExecutor,
  input: { uid: string; title: string; body: string; now: string },
): Promise<void> {
  const title = normalizeTitle(input.title);
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `UPDATE personalization_sections
          SET title = ?, body = ?, modified_at = ?
        WHERE uid = ?`,
      [title, input.body, input.now, input.uid],
    );
    assertOneChange("updatePersonalizationSection", result.changes);
    await bumpDataRevisionCore(exec);
  });
}

export function setPersonalizationSectionEnabled(
  exec: SqlExecutor,
  uid: string,
  enabled: boolean,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await updateSectionField(
      exec,
      "setPersonalizationSectionEnabled",
      "enabled",
      enabled ? 1 : 0,
      uid,
      now,
    );
    await bumpDataRevisionCore(exec);
  });
}

export function replacePersonalizationSectionFromImport(
  exec: SqlExecutor,
  uid: string,
  text: string,
  now: string,
): Promise<void> {
  return updatePersonalizationSectionBody(exec, uid, text, now);
}

export function reorderPersonalizationSections(
  exec: SqlExecutor,
  orderedUids: readonly string[],
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const current = await exec.getAllAsync<{ uid: string }>(
      "SELECT uid FROM personalization_sections ORDER BY display_order, id",
    );
    if (orderedUids.length !== current.length) {
      throw new Error(
        "reorderPersonalizationSections: expected the complete section inventory",
      );
    }
    const requested = new Set(orderedUids);
    if (requested.size !== orderedUids.length) {
      throw new Error("reorderPersonalizationSections: duplicate section uid");
    }
    const currentUids = new Set(current.map((row) => row.uid));
    if (orderedUids.some((uid) => !currentUids.has(uid))) {
      throw new Error("reorderPersonalizationSections: unknown section uid");
    }
    for (const [displayOrder, uid] of orderedUids.entries()) {
      const result = await exec.runAsync(
        "UPDATE personalization_sections SET display_order = ?, modified_at = ? WHERE uid = ?",
        [displayOrder, now, uid],
      );
      assertOneChange("reorderPersonalizationSections", result.changes);
    }
    await bumpDataRevisionCore(exec);
  });
}

export function deletePersonalizationSection(
  exec: SqlExecutor,
  uid: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "DELETE FROM personalization_sections WHERE uid = ?",
      [uid],
    );
    assertOneChange("deletePersonalizationSection", result.changes);
    await bumpDataRevisionCore(exec);
  });
}
