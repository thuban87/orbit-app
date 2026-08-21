/**
 * Migration 4 — the optional-AI non-secret settings columns (Phase 14, AI-01).
 *
 * Widens the single-row `app_settings` table with the disabled-by-default,
 * export-safe configuration for the BYO-key AI suggestion feature. Per the
 * CLAUDE.md data-layer rules this migration is IRREVERSIBLE-SAFE by construction:
 *   - it is purely ADDITIVE — ten `ALTER TABLE app_settings ADD COLUMN`
 *     statements, editing NO shipped table's DDL;
 *   - migrations 001/002/003 are byte-unchanged (never edit a shipped migration);
 *   - every new column is NOT NULL with a CONSTANT DEFAULT, so `ADD COLUMN` is
 *     legal in SQLite and the step is starting-state-independent (a device may
 *     jump v0->v4 or v3->v4 and land identically). The runner wraps each step
 *     atomically with its `user_version` bump — this module opens no transaction.
 *
 * NO SECRET COLUMN, EVER (T-14-01). There is deliberately no api-key / token /
 * credential column here: provider keys live ONLY in the device SecureStore via
 * `ai-key-store.ts`, never in SQLite (which Phase 16 exports by table). The
 * migration test asserts, via the pragma column list, that no credential column
 * exists.
 *
 * The columns (all disabled/empty by default so AI starts OFF):
 *   - `ai_provider TEXT NOT NULL DEFAULT 'none'` — active provider; `'none'`
 *     disables generation entirely (owner decision: AI is opt-in).
 *   - `ai_model` / `ai_custom_endpoint` / `ai_custom_model` / `ai_prompt_template`
 *     TEXT NOT NULL DEFAULT '' — empty = unset. An empty custom endpoint is the
 *     valid "unconfigured" state (C3-M5).
 *   - `ai_ack_openai` / `ai_ack_anthropic` / `ai_ack_google` / `ai_ack_custom`
 *     INTEGER NOT NULL DEFAULT 0 — the per-provider egress acknowledgement flags.
 *     They are NOT writable through the generic settings patch (only Plan 05's
 *     `acknowledgeProvider` sets them to 1); changing the Custom endpoint resets
 *     `ai_ack_custom` to 0 (C3-H3a/b, enforced in the DAO).
 *
 * Imports no expo-sqlite — it operates on the injected `SqlExecutor`. No runtime
 * value is bound or interpolated; every DDL string is a closed constant.
 */
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

// --- Column DDL --------------------------------------------------------------

/** Active provider selection. `'none'` (default) disables AI generation. */
export const ADD_AI_PROVIDER = `
ALTER TABLE app_settings
  ADD COLUMN ai_provider TEXT NOT NULL DEFAULT 'none';`;

/** Selected model id for the active cloud provider. Empty = unset. */
export const ADD_AI_MODEL = `
ALTER TABLE app_settings
  ADD COLUMN ai_model TEXT NOT NULL DEFAULT '';`;

/** Custom-endpoint URL. Empty = unconfigured (C3-M5); validated on write. */
export const ADD_AI_CUSTOM_ENDPOINT = `
ALTER TABLE app_settings
  ADD COLUMN ai_custom_endpoint TEXT NOT NULL DEFAULT '';`;

/** Model id sent to the custom endpoint. Empty = unset. */
export const ADD_AI_CUSTOM_MODEL = `
ALTER TABLE app_settings
  ADD COLUMN ai_custom_model TEXT NOT NULL DEFAULT '';`;

/** User prompt-template override. Empty = use the built-in default template. */
export const ADD_AI_PROMPT_TEMPLATE = `
ALTER TABLE app_settings
  ADD COLUMN ai_prompt_template TEXT NOT NULL DEFAULT '';`;

/** Per-provider egress acknowledgement — OpenAI. 0 = not yet acknowledged. */
export const ADD_AI_ACK_OPENAI = `
ALTER TABLE app_settings
  ADD COLUMN ai_ack_openai INTEGER NOT NULL DEFAULT 0;`;

/** Per-provider egress acknowledgement — Anthropic. */
export const ADD_AI_ACK_ANTHROPIC = `
ALTER TABLE app_settings
  ADD COLUMN ai_ack_anthropic INTEGER NOT NULL DEFAULT 0;`;

/** Per-provider egress acknowledgement — Google. */
export const ADD_AI_ACK_GOOGLE = `
ALTER TABLE app_settings
  ADD COLUMN ai_ack_google INTEGER NOT NULL DEFAULT 0;`;

/** Per-provider egress acknowledgement — Custom endpoint. Reset on URL change. */
export const ADD_AI_ACK_CUSTOM = `
ALTER TABLE app_settings
  ADD COLUMN ai_ack_custom INTEGER NOT NULL DEFAULT 0;`;

/**
 * Migration 4 — widens `app_settings` with the AI non-secret settings columns.
 * Runs inside the runner's per-step transaction; every `ADD COLUMN` commits
 * atomically with the `user_version` bump. `deps` is unused — this step adds
 * columns only (each with a constant default), seeds nothing. NO key column.
 */
export const migration004: Migration = {
  version: 4,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(ADD_AI_PROVIDER);
    await exec.execAsync(ADD_AI_MODEL);
    await exec.execAsync(ADD_AI_CUSTOM_ENDPOINT);
    await exec.execAsync(ADD_AI_CUSTOM_MODEL);
    await exec.execAsync(ADD_AI_PROMPT_TEMPLATE);
    await exec.execAsync(ADD_AI_ACK_OPENAI);
    await exec.execAsync(ADD_AI_ACK_ANTHROPIC);
    await exec.execAsync(ADD_AI_ACK_GOOGLE);
    await exec.execAsync(ADD_AI_ACK_CUSTOM);
  },
};
