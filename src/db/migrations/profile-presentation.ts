import type { Migration } from "@/db/types";

/** Live-registry head + 1, validated immediately before this migration was authored. */
export const PROFILE_PRESENTATION_SCHEMA_VERSION = 24;

/**
 * Durable Profile presentation vocabulary. Layout and background assignments
 * remain independent at every scope; a contact may instead carry one freeform
 * layout document. Collapse state is per-contact and never part of a template.
 */
export const profilePresentationMigration: Migration = {
  version: PROFILE_PRESENTATION_SCHEMA_VERSION,
  async apply(exec) {
    await exec.execAsync(`
      CREATE TABLE profile_layout_templates (
        id INTEGER PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        layout_json TEXT NOT NULL
          CHECK(json_valid(layout_json))
          CHECK(json_type(layout_json) = 'object')
          CHECK(json_extract(layout_json, '$.version') = 1),
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL
      );

      CREATE TABLE profile_background_templates (
        id INTEGER PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        image_path TEXT NOT NULL
          CHECK(image_path GLOB 'profile-backgrounds/*')
          CHECK(instr(image_path, '\\') = 0)
          CHECK(image_path NOT LIKE '../%')
          CHECK(image_path NOT LIKE '%/../%'),
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL
      );

      CREATE TABLE profile_category_presentation (
        category_id INTEGER PRIMARY KEY
          REFERENCES categories(id) ON DELETE CASCADE,
        layout_template_uid TEXT
          REFERENCES profile_layout_templates(uid) ON DELETE SET NULL,
        background_template_uid TEXT
          REFERENCES profile_background_templates(uid) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL
      );

      CREATE TABLE profile_contact_presentation (
        contact_id INTEGER PRIMARY KEY
          REFERENCES contacts(id) ON DELETE CASCADE,
        layout_template_uid TEXT
          REFERENCES profile_layout_templates(uid) ON DELETE SET NULL,
        freeform_layout_json TEXT
          CHECK(freeform_layout_json IS NULL OR (
            json_valid(freeform_layout_json)
            AND json_type(freeform_layout_json) = 'object'
            AND json_extract(freeform_layout_json, '$.version') = 1
          )),
        background_template_uid TEXT
          REFERENCES profile_background_templates(uid) ON DELETE SET NULL,
        collapse_json TEXT NOT NULL DEFAULT '{}'
          CHECK(json_valid(collapse_json))
          CHECK(json_type(collapse_json) = 'object'),
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        CHECK(layout_template_uid IS NULL OR freeform_layout_json IS NULL)
      );

      ALTER TABLE app_settings ADD COLUMN profile_layout_template_uid TEXT
        REFERENCES profile_layout_templates(uid) ON DELETE SET NULL;
      ALTER TABLE app_settings ADD COLUMN profile_background_template_uid TEXT
        REFERENCES profile_background_templates(uid) ON DELETE SET NULL;
    `);
  },
};
