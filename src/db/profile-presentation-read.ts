import { inReadSnapshot, type ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { parseProfileCollapseMap } from "@/profile/persisted-contract";
import type {
  ProfileLayoutDocument,
  ProfilePresentationAssignment,
  ProfilePresentationInputs,
} from "@/profile/types";

export interface ProfileLayoutTemplateRow {
  id: number;
  uid: string;
  name: string;
  layoutJson: string;
  createdAt: string;
  modifiedAt: string;
}

export interface ProfileBackgroundTemplateRow {
  id: number;
  uid: string;
  name: string;
  imagePath: string;
  createdAt: string;
  modifiedAt: string;
}

export interface ProfileTemplateUsage {
  global: number;
  categories: number;
  contacts: number;
  total: number;
}

/**
 * Read one Category's independent presentation axes for a write that changes
 * only layout or only background. Feature UI must never recreate this SQL or
 * erase the sibling axis while assigning a template.
 */
export async function readCategoryProfilePresentation(
  exec: ReadOnlyExecutor,
  categoryId: number,
): Promise<ProfilePresentationAssignment> {
  const row = await exec.getFirstAsync<ProfilePresentationAssignment>(
    `SELECT layout_template_uid AS layoutTemplateUid,
            background_template_uid AS backgroundTemplateUid
       FROM profile_category_presentation
      WHERE category_id=?`,
    [categoryId],
  );
  return row ?? { layoutTemplateUid: null, backgroundTemplateUid: null };
}

export function listProfileLayoutTemplates(
  exec: ReadOnlyExecutor,
): Promise<ProfileLayoutTemplateRow[]> {
  return exec.getAllAsync<ProfileLayoutTemplateRow>(
    `SELECT id, uid, name, layout_json AS layoutJson,
            created_at AS createdAt, modified_at AS modifiedAt
       FROM profile_layout_templates
      ORDER BY name COLLATE NOCASE, uid`,
  );
}

export function listProfileBackgroundTemplates(
  exec: ReadOnlyExecutor,
): Promise<ProfileBackgroundTemplateRow[]> {
  return exec.getAllAsync<ProfileBackgroundTemplateRow>(
    `SELECT id, uid, name, image_path AS imagePath,
            created_at AS createdAt, modified_at AS modifiedAt
       FROM profile_background_templates
      ORDER BY name COLLATE NOCASE, uid`,
  );
}

export async function countProfileTemplateUsage(
  exec: ReadOnlyExecutor,
  axis: "layout" | "background",
  templateUid: string,
): Promise<ProfileTemplateUsage> {
  const columns =
    axis === "layout"
      ? {
          global: "profile_layout_template_uid",
          category: "layout_template_uid",
          contact: "layout_template_uid",
        }
      : {
          global: "profile_background_template_uid",
          category: "background_template_uid",
          contact: "background_template_uid",
        };
  const row = await exec.getFirstAsync<{
    globalCount: number;
    categoryCount: number;
    contactCount: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM app_settings WHERE id=1 AND ${columns.global}=?) AS globalCount,
       (SELECT COUNT(*) FROM profile_category_presentation WHERE ${columns.category}=?) AS categoryCount,
       (SELECT COUNT(*) FROM profile_contact_presentation WHERE ${columns.contact}=?) AS contactCount`,
    [templateUid, templateUid, templateUid],
  );
  const global = row?.globalCount ?? 0;
  const categories = row?.categoryCount ?? 0;
  const contacts = row?.contactCount ?? 0;
  return {
    global,
    categories,
    contacts,
    total: global + categories + contacts,
  };
}

interface PresentationReadOptions {
  factoryLayout: ProfileLayoutDocument;
  themeBackground: string;
}

/** Core for consumers that already own a coherent read snapshot. */
export async function readProfilePresentationInputsCore(
  exec: ReadOnlyExecutor,
  contactId: number,
  options: PresentationReadOptions,
): Promise<ProfilePresentationInputs> {
  const contact = await exec.getFirstAsync<{
    categoryId: number | null;
    layoutTemplateUid: string | null;
    freeformLayoutJson: string | null;
    backgroundTemplateUid: string | null;
    collapseJson: string | null;
  }>(
    `SELECT c.category_id AS categoryId,
            p.layout_template_uid AS layoutTemplateUid,
            p.freeform_layout_json AS freeformLayoutJson,
            p.background_template_uid AS backgroundTemplateUid,
            p.collapse_json AS collapseJson
       FROM contacts c
       LEFT JOIN profile_contact_presentation p ON p.contact_id=c.id
      WHERE c.id=?`,
    [contactId],
  );
  if (!contact) {
    throw new Error(
      `readProfilePresentationInputs: no contact with id=${contactId}`,
    );
  }
  const [settings, category, layoutRows, backgroundRows] = await Promise.all([
    exec.getFirstAsync<{
      layoutTemplateUid: string | null;
      backgroundTemplateUid: string | null;
    }>(
      `SELECT profile_layout_template_uid AS layoutTemplateUid,
              profile_background_template_uid AS backgroundTemplateUid
         FROM app_settings WHERE id=1`,
    ),
    contact.categoryId === null
      ? Promise.resolve(null)
      : exec.getFirstAsync<{
          layoutTemplateUid: string | null;
          backgroundTemplateUid: string | null;
        }>(
          `SELECT layout_template_uid AS layoutTemplateUid,
                  background_template_uid AS backgroundTemplateUid
             FROM profile_category_presentation WHERE category_id=?`,
          [contact.categoryId],
        ),
    listProfileLayoutTemplates(exec),
    listProfileBackgroundTemplates(exec),
  ]);
  if (!settings)
    throw new Error(
      "readProfilePresentationInputs: app_settings id=1 row is missing",
    );

  let collapse = {};
  if (contact.collapseJson !== null) {
    try {
      collapse = parseProfileCollapseMap(contact.collapseJson);
    } catch {
      collapse = {};
    }
  }
  return {
    factoryLayout: options.factoryLayout,
    themeBackground: options.themeBackground,
    layoutTemplates: layoutRows.map((row) => ({
      uid: row.uid,
      layout: row.layoutJson,
    })),
    backgroundTemplates: backgroundRows.map((row) => ({
      uid: row.uid,
      imagePath: row.imagePath,
    })),
    global: {
      layoutTemplateUid: settings.layoutTemplateUid,
      backgroundTemplateUid: settings.backgroundTemplateUid,
    },
    category:
      contact.categoryId === null
        ? null
        : {
            layoutTemplateUid: category?.layoutTemplateUid ?? null,
            backgroundTemplateUid: category?.backgroundTemplateUid ?? null,
          },
    contact: {
      layoutTemplateUid: contact.layoutTemplateUid,
      freeformLayout: contact.freeformLayoutJson,
      backgroundTemplateUid: contact.backgroundTemplateUid,
      collapse,
    },
  };
}

/** Public coherent read; callers already in a snapshot use the Core variant. */
export function readProfilePresentationInputs(
  exec: SqlExecutor,
  contactId: number,
  options: PresentationReadOptions,
): Promise<ProfilePresentationInputs> {
  return inReadSnapshot(exec, (ro) =>
    readProfilePresentationInputsCore(ro, contactId, options),
  );
}
