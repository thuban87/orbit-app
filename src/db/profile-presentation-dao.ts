import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  type ProfileCollapseMap,
  type ProfileCollapsibleModuleId,
  parseProfileCollapseMap,
} from "@/profile/persisted-contract";
import { serializeProfileLayout } from "@/profile/presentation-schema";

interface CollapseRow {
  collapse_json: string;
}

/** Malformed legacy/local state must not prevent Profile from rendering. */
export async function readProfileCollapseOverride(
  exec: Pick<SqlExecutor, "getFirstAsync">,
  contactId: number,
): Promise<ProfileCollapseMap> {
  const row = await exec.getFirstAsync<CollapseRow>(
    "SELECT collapse_json FROM profile_contact_presentation WHERE contact_id = ?",
    [contactId],
  );
  if (!row) return {};
  try {
    return parseProfileCollapseMap(row.collapse_json);
  } catch {
    return {};
  }
}

export interface SetProfileCollapseOverrideInput {
  contactId: number;
  moduleId: ProfileCollapsibleModuleId;
  expanded: boolean;
  now: string;
}

/** Transaction-body core for future composition; caller owns BEGIN/COMMIT. */
export async function setProfileCollapseOverrideCore(
  exec: SqlExecutor,
  input: SetProfileCollapseOverrideInput,
): Promise<void> {
  const current = await readProfileCollapseOverride(exec, input.contactId);
  const collapseJson = JSON.stringify(
    parseProfileCollapseMap({ ...current, [input.moduleId]: input.expanded }),
  );
  await exec.runAsync(
    `INSERT INTO profile_contact_presentation(
       contact_id, collapse_json, created_at, modified_at
     ) VALUES(?, ?, ?, ?)
     ON CONFLICT(contact_id) DO UPDATE SET
       collapse_json = excluded.collapse_json,
       modified_at = excluded.modified_at`,
    [input.contactId, collapseJson, input.now, input.now],
  );
}

/** Persist one semantic collapse override and bump backup revision exactly once. */
export function setProfileCollapseOverride(
  exec: SqlExecutor,
  input: SetProfileCollapseOverrideInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await setProfileCollapseOverrideCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

function assertUid(value: string, label: string): void {
  if (!/^[^\s\p{Cc}]{1,256}$/u.test(value)) {
    throw new Error(`${label} must be a bounded nonblank UID`);
  }
}

function normalizedName(value: string): string {
  const name = value.trim();
  if (name.length === 0 || name.length > 120) {
    throw new Error("Profile template name must contain 1-120 characters");
  }
  return name;
}

function assertBackgroundPath(value: string): void {
  if (
    !value.startsWith("profile-backgrounds/") ||
    value.length <= "profile-backgrounds/".length ||
    value.includes("\\") ||
    value.split("/").includes("..")
  ) {
    throw new Error("Profile background path must be app-owned and relative");
  }
}

async function assertContactExists(
  exec: SqlExecutor,
  contactId: number,
): Promise<void> {
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM contacts WHERE id=?",
    [contactId],
  );
  if (!row)
    throw new Error(`Profile presentation contact ${contactId} is missing`);
}

export interface ProfileLayoutTemplateWrite {
  uid: string;
  name: string;
  layout: unknown;
  now: string;
}

export async function createProfileLayoutTemplateCore(
  exec: SqlExecutor,
  input: ProfileLayoutTemplateWrite,
): Promise<void> {
  assertUid(input.uid, "Profile layout template UID");
  await exec.runAsync(
    `INSERT INTO profile_layout_templates(uid,name,layout_json,created_at,modified_at)
     VALUES(?,?,?,?,?)`,
    [
      input.uid,
      normalizedName(input.name),
      serializeProfileLayout(input.layout),
      input.now,
      input.now,
    ],
  );
}

export function createProfileLayoutTemplate(
  exec: SqlExecutor,
  input: ProfileLayoutTemplateWrite,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await createProfileLayoutTemplateCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

export async function updateProfileLayoutTemplateCore(
  exec: SqlExecutor,
  input: ProfileLayoutTemplateWrite,
): Promise<void> {
  assertUid(input.uid, "Profile layout template UID");
  const result = await exec.runAsync(
    `UPDATE profile_layout_templates
        SET name=?, layout_json=?, modified_at=?
      WHERE uid=?`,
    [
      normalizedName(input.name),
      serializeProfileLayout(input.layout),
      input.now,
      input.uid,
    ],
  );
  if (result.changes !== 1)
    throw new Error("Profile layout template is missing");
}

export function updateProfileLayoutTemplate(
  exec: SqlExecutor,
  input: ProfileLayoutTemplateWrite,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await updateProfileLayoutTemplateCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

export interface ProfileBackgroundTemplateWrite {
  uid: string;
  name: string;
  imagePath: string;
  now: string;
}

export async function createProfileBackgroundTemplateCore(
  exec: SqlExecutor,
  input: ProfileBackgroundTemplateWrite,
): Promise<void> {
  assertUid(input.uid, "Profile background template UID");
  assertBackgroundPath(input.imagePath);
  await exec.runAsync(
    `INSERT INTO profile_background_templates(uid,name,image_path,created_at,modified_at)
     VALUES(?,?,?,?,?)`,
    [
      input.uid,
      normalizedName(input.name),
      input.imagePath,
      input.now,
      input.now,
    ],
  );
}

export function createProfileBackgroundTemplate(
  exec: SqlExecutor,
  input: ProfileBackgroundTemplateWrite,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await createProfileBackgroundTemplateCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

export async function updateProfileBackgroundTemplateCore(
  exec: SqlExecutor,
  input: ProfileBackgroundTemplateWrite,
): Promise<void> {
  assertUid(input.uid, "Profile background template UID");
  assertBackgroundPath(input.imagePath);
  const result = await exec.runAsync(
    `UPDATE profile_background_templates
        SET name=?, image_path=?, modified_at=?
      WHERE uid=?`,
    [normalizedName(input.name), input.imagePath, input.now, input.uid],
  );
  if (result.changes !== 1)
    throw new Error("Profile background template is missing");
}

export function updateProfileBackgroundTemplate(
  exec: SqlExecutor,
  input: ProfileBackgroundTemplateWrite,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await updateProfileBackgroundTemplateCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

export interface ProfileAssignmentWrite {
  layoutTemplateUid: string | null;
  backgroundTemplateUid: string | null;
  now: string;
}

export async function assignGlobalProfilePresentationCore(
  exec: SqlExecutor,
  input: ProfileAssignmentWrite,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE app_settings
        SET profile_layout_template_uid=?, profile_background_template_uid=?, modified_at=?
      WHERE id=1`,
    [input.layoutTemplateUid, input.backgroundTemplateUid, input.now],
  );
  if (result.changes !== 1)
    throw new Error("Profile global settings row is missing");
}

export function assignGlobalProfilePresentation(
  exec: SqlExecutor,
  input: ProfileAssignmentWrite,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await assignGlobalProfilePresentationCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Changes only the global layout axis. Keeping this as a narrow UPDATE avoids
 * reconstructing the background axis from a potentially stale Profile read.
 */
export function assignGlobalProfileLayoutTemplate(
  exec: SqlExecutor,
  input: { templateUid: string | null; now: string },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `UPDATE app_settings
          SET profile_layout_template_uid=?, modified_at=?
        WHERE id=1`,
      [input.templateUid, input.now],
    );
    if (result.changes !== 1)
      throw new Error("Profile global settings row is missing");
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Changes only the global background axis. Keeping this as a narrow UPDATE
 * preserves a layout assignment made after the manager's Profile snapshot.
 */
export function assignGlobalProfileBackgroundTemplate(
  exec: SqlExecutor,
  input: { templateUid: string | null; now: string },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `UPDATE app_settings
          SET profile_background_template_uid=?, modified_at=?
        WHERE id=1`,
      [input.templateUid, input.now],
    );
    if (result.changes !== 1)
      throw new Error("Profile global settings row is missing");
    await bumpDataRevisionCore(exec);
  });
}

export function assignCategoryProfilePresentation(
  exec: SqlExecutor,
  input: ProfileAssignmentWrite & { categoryId: number },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await exec.runAsync(
      `INSERT INTO profile_category_presentation(
         category_id,layout_template_uid,background_template_uid,created_at,modified_at
       ) VALUES(?,?,?,?,?)
       ON CONFLICT(category_id) DO UPDATE SET
         layout_template_uid=excluded.layout_template_uid,
         background_template_uid=excluded.background_template_uid,
         modified_at=excluded.modified_at`,
      [
        input.categoryId,
        input.layoutTemplateUid,
        input.backgroundTemplateUid,
        input.now,
        input.now,
      ],
    );
    await bumpDataRevisionCore(exec);
  });
}

async function upsertContactPresentation(
  exec: SqlExecutor,
  input: {
    contactId: number;
    now: string;
    layoutTemplateUid?: string | null;
    freeformLayoutJson?: string | null;
    backgroundTemplateUid?: string | null;
    clearCollapse?: boolean;
  },
): Promise<void> {
  await assertContactExists(exec, input.contactId);
  const current = await exec.getFirstAsync<{
    layout_template_uid: string | null;
    freeform_layout_json: string | null;
    background_template_uid: string | null;
    collapse_json: string;
    created_at: string;
  }>("SELECT * FROM profile_contact_presentation WHERE contact_id=?", [
    input.contactId,
  ]);
  const layoutTemplateUid =
    input.layoutTemplateUid === undefined
      ? (current?.layout_template_uid ?? null)
      : input.layoutTemplateUid;
  const freeformLayoutJson =
    input.freeformLayoutJson === undefined
      ? (current?.freeform_layout_json ?? null)
      : input.freeformLayoutJson;
  const backgroundTemplateUid =
    input.backgroundTemplateUid === undefined
      ? (current?.background_template_uid ?? null)
      : input.backgroundTemplateUid;
  const collapseJson = input.clearCollapse
    ? "{}"
    : (current?.collapse_json ?? "{}");
  await exec.runAsync(
    `INSERT INTO profile_contact_presentation(
       contact_id,layout_template_uid,freeform_layout_json,background_template_uid,
       collapse_json,created_at,modified_at
     ) VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(contact_id) DO UPDATE SET
       layout_template_uid=excluded.layout_template_uid,
       freeform_layout_json=excluded.freeform_layout_json,
       background_template_uid=excluded.background_template_uid,
       collapse_json=excluded.collapse_json,
       modified_at=excluded.modified_at`,
    [
      input.contactId,
      layoutTemplateUid,
      freeformLayoutJson,
      backgroundTemplateUid,
      collapseJson,
      current?.created_at ?? input.now,
      input.now,
    ],
  );
}

export function assignContactLayoutTemplate(
  exec: SqlExecutor,
  input: { contactId: number; templateUid: string | null; now: string },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const current = await exec.getFirstAsync<{
      layout_template_uid: string | null;
      freeform_layout_json: string | null;
    }>(
      "SELECT layout_template_uid,freeform_layout_json FROM profile_contact_presentation WHERE contact_id=?",
      [input.contactId],
    );
    const switched =
      current?.layout_template_uid !== input.templateUid ||
      current?.freeform_layout_json !== null;
    await upsertContactPresentation(exec, {
      contactId: input.contactId,
      layoutTemplateUid: input.templateUid,
      freeformLayoutJson: null,
      clearCollapse: switched,
      now: input.now,
    });
    await bumpDataRevisionCore(exec);
  });
}

export function setContactFreeformLayout(
  exec: SqlExecutor,
  input: { contactId: number; layout: unknown; now: string },
): Promise<void> {
  const layoutJson = serializeProfileLayout(input.layout);
  return inWriteTransaction(exec, async () => {
    const current = await exec.getFirstAsync<{
      layout_template_uid: string | null;
      freeform_layout_json: string | null;
    }>(
      "SELECT layout_template_uid,freeform_layout_json FROM profile_contact_presentation WHERE contact_id=?",
      [input.contactId],
    );
    await upsertContactPresentation(exec, {
      contactId: input.contactId,
      layoutTemplateUid: null,
      freeformLayoutJson: layoutJson,
      clearCollapse:
        current?.layout_template_uid !== null ||
        current?.freeform_layout_json !== layoutJson,
      now: input.now,
    });
    await bumpDataRevisionCore(exec);
  });
}

export function assignContactBackgroundTemplate(
  exec: SqlExecutor,
  input: { contactId: number; templateUid: string | null; now: string },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await upsertContactPresentation(exec, {
      contactId: input.contactId,
      backgroundTemplateUid: input.templateUid,
      now: input.now,
    });
    await bumpDataRevisionCore(exec);
  });
}

export function resetProfilePresentation(
  exec: SqlExecutor,
  contactId: number,
  _now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await assertContactExists(exec, contactId);
    await exec.runAsync(
      "DELETE FROM profile_contact_presentation WHERE contact_id=?",
      [contactId],
    );
    await bumpDataRevisionCore(exec);
  });
}

export function deleteProfileLayoutTemplate(
  exec: SqlExecutor,
  uid: string,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "DELETE FROM profile_layout_templates WHERE uid=?",
      [uid],
    );
    if (result.changes !== 1)
      throw new Error("Profile layout template is missing");
    await exec.runAsync("UPDATE app_settings SET modified_at=? WHERE id=1", [
      now,
    ]);
    await bumpDataRevisionCore(exec);
  });
}

export function deleteProfileBackgroundTemplate(
  exec: SqlExecutor,
  uid: string,
  now: string,
): Promise<string | null> {
  return inWriteTransaction(exec, async () => {
    const row = await exec.getFirstAsync<{ image_path: string }>(
      "SELECT image_path FROM profile_background_templates WHERE uid=?",
      [uid],
    );
    if (!row) throw new Error("Profile background template is missing");
    const result = await exec.runAsync(
      "DELETE FROM profile_background_templates WHERE uid=?",
      [uid],
    );
    if (result.changes !== 1)
      throw new Error("Profile background template is missing");
    await exec.runAsync("UPDATE app_settings SET modified_at=? WHERE id=1", [
      now,
    ]);
    await bumpDataRevisionCore(exec);
    const remaining = await exec.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM profile_background_templates WHERE image_path=?",
      [row.image_path],
    );
    return (remaining?.count ?? 0) === 0 ? row.image_path : null;
  });
}
