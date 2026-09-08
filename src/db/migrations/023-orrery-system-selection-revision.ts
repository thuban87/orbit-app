import type { Migration } from "@/db/types";

/**
 * An internal monotonic token distinguishes deletion's automatic All Contacts
 * fallback from a later explicit selection of that same System during Undo.
 * It is deliberately not portable preference data.
 */
export const migration023: Migration = {
  version: 23,
  async apply(exec) {
    await exec.execAsync(`
      ALTER TABLE app_settings ADD COLUMN orrery_system_selection_revision INTEGER NOT NULL DEFAULT 0
        CHECK(orrery_system_selection_revision >= 0);
    `);
  },
};
