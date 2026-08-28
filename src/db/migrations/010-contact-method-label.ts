import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/**
 * Migration 010 — durable labels for normalized contact methods.
 *
 * Existing normalized rows deliberately remain unlabeled: a nullable column lets
 * the editor distinguish legacy data from a user-selected label without
 * rewriting migration 009's already-shipped scalar-normalization step.
 */
export const ADD_CONTACT_METHOD_LABEL = `
ALTER TABLE contact_methods
  ADD COLUMN label TEXT;`;

export const migration010: Migration = {
  version: 10,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(ADD_CONTACT_METHOD_LABEL);
  },
};
