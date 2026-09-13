# Phase 36: AI Configuration & Prompting - Pattern Map

**Mapped:** 2026-09-13
**Files analyzed:** 27 (new + modified)
**Analogs found:** 25 / 27 (2 net-new external integrations have partial analogs only)

> Ground truth: milestone-2 dossier + planning-notes + ADR-049/051/078/079/**107**; 36-CONTEXT.md is a shim; 36-UI-SPEC.md signed off. Where CONTEXT D-06 (Off Limits egress) conflicts with ADR-107, **ADR-107 wins — Off Limits is never transmitted in any form.** Every analog below was read on disk this session; file:line refs verified against the actual files, not the diff or RESEARCH.md alone.
>
> **Two drifts the planner must carry (both verified on disk):** (1) backup format is already `4` (`src/backup/types.ts:14`) → closing bump is **5**, not 4; (2) ADR-107 reversed ADR-078's Off Limits egress → no off-limits shape anywhere in `PromptContext`/prompt/permission-manager.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/migrations/029-*.ts` (AI config: `ai_enabled`, multi-connection, permission type-defaults) | migration | schema/DDL | `src/db/migrations/028-compose-message-mode.ts` | exact |
| `src/db/migrations/030-*.ts` (remaining portable pref columns, if split) | migration | schema/DDL | `src/db/migrations/028-compose-message-mode.ts` | exact |
| `src/db/ai-connections-dao.ts` (new) | DAO | CRUD | `src/db/systems-dao.ts` + `src/db/app-settings-dao.ts` | role-match |
| `src/db/ai-permissions-dao.ts` (new; type-defaults + review + bulk) | DAO | CRUD/batch | `src/db/systems-dao.ts` + `src/db/bulk-actions-dao.ts` | role-match |
| `src/db/personalization-dao.ts` (new; Personalization Context sections + Writing Style) | DAO | CRUD | `src/db/systems-dao.ts` | role-match |
| `src/ai/openrouter-oauth.ts` (new; PKCE browser-auth) | service | request-response (OAuth) | `src/ai/custom-endpoint.ts` + `src/ai/secure-fetch.ts` (guards only) | partial — net-new external flow |
| `src/ai/openrouter-catalog.ts` (new; `/models` + pricing + cache) | service | request-response + file-I/O cache | `src/ai/model-catalog-cache.ts` | exact (structure) |
| `src/ai/context-estimate.ts` (new; token/context size + cost) | utility | transform | `src/ai/token-budget.ts` | role-match |
| `src/logic/ai-diagnostics.ts` (new; sanitized diagnostic schema) | service | transform | `sanitizeError` seam in `src/logic/ai-suggestion-logic.ts` | role-match |
| `src/stores/ai-config-store.ts` (new; AI Enabled + active connection) | store | event-driven | `src/stores/theme-store.ts` (durable, app_settings-backed) — NOT `ai-model-prefs-store` (AsyncStorage) | role-match |
| AI settings screens (`src/screens/…AISettings*.tsx` + `*-logic.ts`) | screen + logic | request-response | `src/screens/SettingsScreen.tsx` + `settings-ai-logic.ts` / `BackupSettingsScreen.tsx` | exact |
| `src/services/ai-types.ts` (MOD: add `openrouter`) | model/types | — | itself (`:23-41`) | exact |
| `src/db/app-settings-dao.ts` (MOD: `acknowledgeProvider` switch, snapshot emission, new cols) | DAO | CRUD | itself (`:1450`, `:840`, `:420-490`) | exact |
| `src/screens/settings-ai-logic.ts` (MOD: `PROVIDER_NAMES`) | logic | — | itself (`:35-41`) | exact |
| `src/ai/token-budget.ts` (MOD: OpenRouter case) | utility | transform | itself (`:60-75`) | exact |
| `src/ai/model-catalog-filter.ts` (MOD carefully — do NOT force OpenRouter into `CatalogProvider`) | utility | transform | itself (`:44-51`) | exact |
| `src/ai/prompt-types.ts` / `prompt-template.ts` (MOD: render carry-only fields) | logic | transform | itself (`prompt-types.ts:133-155`, `prompt-template.ts:263-322`) | exact |
| `src/db/ai-context-read.ts` (MOD: gate/projection unchanged; verify) | read-model | request-response | itself (`:168-192`) | exact |
| `src/logic/ai-availability.ts` (MOD: multi-connection + model-unavailable) | logic | transform | itself (`:30-54`) | exact |
| `src/logic/ai-suggestion-logic.ts` (MOD: 8 failure categories) | logic | request-response | itself (`sanitizeError` seam) | exact |
| `src/backup/backup-schema.ts` (MOD: PORTABLE keys, FORWARD_MIGRATIONS `4:`, SECRET screen) | schema | transform | itself (`:101-108`, `:137-215`, `:217-218`) | exact |
| `src/backup/types.ts` (MOD: `BACKUP_FORMAT_VERSION = 5`) | config | — | itself (`:14`) | exact |
| `src/backup/export-manifest.ts` (MOD: serialize new entities) | service | file-I/O | itself (`:100-144`) | exact |
| `src/components/FuelEditor.tsx` + `src/db/fuel-dao.ts` + `Create/EditContactScreen.tsx` (MOD: retire AI-fuel confirm) | component + DAO | CRUD | itself (`FuelEditor.tsx:249-317`, `fuel-dao.ts:214/297`) | exact |

---

## Pattern Assignments

### `src/db/migrations/029-*.ts` (migration, schema/DDL)

**Analog:** `src/db/migrations/028-compose-message-mode.ts` (the newest registered step — the canonical additive-migration template).

**Head+1 is 029, but VERIFY on disk at plan time** — `TARGET_VERSION = COMPOSE_MESSAGE_MODE_SCHEMA_VERSION` (`src/db/database.ts:69`) and `COMPOSE_MESSAGE_MODE_SCHEMA_VERSION = 28` (`028-compose-message-mode.ts:27`). Migration numbers drift every schema phase; head+1 is only correct until the next one lands. Migrations are **forward-only and irreversible in production** (CLAUDE.md) — never edit a shipped one.

**Full migration shape to copy** (`028-compose-message-mode.ts:1-41`):
```typescript
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

export const COMPOSE_MESSAGE_MODE_SCHEMA_VERSION = 28;

export const migration028: Migration = {
  version: COMPOSE_MESSAGE_MODE_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings
        ADD COLUMN default_message_mode TEXT NOT NULL DEFAULT 'remember'
          CHECK(default_message_mode IN ('remember','text','email'));
      ALTER TABLE app_settings
        ADD COLUMN remembered_message_mode TEXT NOT NULL DEFAULT 'text';
    `);
  },
};
```
Key idioms: exported `*_SCHEMA_VERSION` const, `NOT NULL DEFAULT` on every new column (no null/empty state ever on the singleton settings row), `CHECK(... IN (...))` for a frozen vocabulary, a header comment stating the head+1 verification and the double-migration hazard. `ai_enabled` should be `INTEGER NOT NULL DEFAULT 0` mirroring the `ai_ack_*` boolean columns in `004-ai-settings.ts:66-83`. A new `ai_connections` table (Pattern 3 in RESEARCH) follows the DDL style in `022-orrery-systems.ts`. Every migration ships a co-located `*.test.ts` (see `028-compose-message-mode.test.ts`).

---

### `src/db/ai-connections-dao.ts` (DAO, CRUD) + `src/db/personalization-dao.ts`

**Analog:** `src/db/systems-dao.ts` (durable definition-table CRUD with an active-pointer in `app_settings`) and the writer idiom in `src/db/app-settings-dao.ts`.

**Imports pattern** (`systems-dao.ts:1-21`):
```typescript
import { updateAppSettingsCore } from "@/db/app-settings-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { inWriteTransaction, type ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
```

**Writer idiom** (from `acknowledgeProvider`, `app-settings-dao.ts:1479-1484`): every mutating call runs inside `inWriteTransaction(exec, …)`, uses `?`-bound params (never string interpolation of identifiers), bumps `modified_at`, and asserts `result.changes === 1` (a bad row count throws → rollback). New rows use `newUid()` and carry `uid UNIQUE`. The active-connection pointer belongs in `app_settings` (like `orrery_last_system`), read/written through `updateAppSettingsCore`.

**Compile-time exhaustiveness lock** (`app-settings-dao.ts:1456-1476`) — reuse this exact pattern for any per-connection switch so adding a lane forces a `case`:
```typescript
switch (provider) {
  case "openai": column = "ai_ack_openai"; break;
  // …
  default: {
    const _exhaustive: never = provider;
    throw new Error(`…: unknown provider ${String(_exhaustive)}`);
  }
}
```

---

### `src/ai/openrouter-catalog.ts` (service, request-response + cache)

**Analog:** `src/ai/model-catalog-cache.ts` — the I/O half of the existing LiteLLM picker. **Do NOT extend `CatalogProvider` (`model-catalog-filter.ts:44-51`) to include OpenRouter** (RESEARCH anti-pattern / D-10 #6) — model OpenRouter as a separate catalog+pricing source.

**Injected-I/O + fallback pattern to copy** (`model-catalog-cache.ts:14-45`): `fetchImpl` and `storage` are injected so the module is node-pure-testable with a fake network + in-memory store; device wiring supplies real `fetch` + an `expo-file-system`-backed `CatalogStorage`. `loadCachedCatalog` returns parsed cache or `null` and **NEVER throws** (a read path always resolves — offline-safe, local-first). `refreshModelCatalog` THROWS on network/non-2xx/shape-broken and leaves the prior cache untouched (failed refresh degrades to cache/seed, never clobbers).

**Privacy contract to preserve verbatim** (`model-catalog-cache.ts:5-13`): the catalog GET is a public, data-only fetch — **no API key, no contact data**, invoked ONLY from the explicit "Refresh Models" tap or the first settings-open of a new local day, **never on a read path / screen mount / app launch**. Use `formatLocalDate()` for the day boundary (`ai-context-read.ts:47` already does), never `toISOString().split('T')[0]`.

OpenRouter pricing values are decimal USD-per-token STRINGS — input-cost estimate = `estimatedInputTokens * Number(pricing.prompt)`; never hardcode model ids/prices.

---

### `src/ai/openrouter-oauth.ts` (service, OAuth PKCE — net-new, partial analog only)

**No exact analog** (zero OpenRouter/WebBrowser/AuthSession code in-repo). **Analog for the safety half only:** `src/ai/secure-fetch.ts` + `src/ai/custom-endpoint.ts` (egress must go through the validated boundary). **Analog for the credential landing:** `src/services/ai-key-store.ts`.

**Credential-storage pattern to copy** (`ai-key-store.ts:26-53`): the resulting OpenRouter API key goes to a new namespaced SecureStore slot `orbit.ai.key.openrouter` via `keyItemName(provider)` — `${KEY_ITEM_PREFIX}${provider}` (`:27,30-32`). **Never** into `app_settings`, the backup, or AsyncStorage (ADR-049 / D-04). Preserve "no bulk/all-keys accessor" (`:45-53`). `openrouter` must be added to `AiCloudProviderId` for this to key correctly.

**Hermes crypto guard (MEMORY hermes-crypto-guard):** `globalThis.crypto.subtle`/`randomUUID` are undefined in Hermes and vitest (Node WebCrypto) will NOT catch it. Use `expo-crypto` `digestStringAsync(SHA256)` for the S256 challenge and a guarded random for the verifier. Validate the redirect capture on the physical Pixel (emulator cannot validate OAuth — MEMORY verify-ui-on-pixel-yourself). During UAT, the OAuth connect + `/models` fetch are safe; a Draft/Rewrite generation call is NOT — never trigger one without owner clearing (MEMORY no-ai-api-calls-without-clearing).

---

### `src/ai/context-estimate.ts` (utility, transform)

**Analog:** `src/ai/token-budget.ts` — node-pure per-provider sizing (currently output-only, `:60-75`). Mirror its node-pure, switch-over-provider structure for the context-size estimate; add cost only for OpenRouter (Direct/Custom → "Cost estimate unavailable for this connection."). **No artificial ceiling, no silent truncation** (D-11): overflow is surfaced as an explicit `TruncationNotice`/warning (`prompt-types.ts:157-166`), never trimmed away. Debounce recompute after edits — never per-keystroke (UI-SPEC Surface #9).

---

### `src/ai/prompt-template.ts` + `prompt-types.ts` (logic, transform — render carry-only fields, AICFG-15)

**Analog:** the existing conditional-block assembly in `prompt-template.ts:263-322`.

**The carry-only contract** (`prompt-types.ts:133-155`): `sharedMemories?` and `gatedRecentInteractionNotes?` are populated by `ai-context-read.ts` but NOT rendered — "adding this field does NOT transmit it… `resolvePrompt` serializes context fields explicitly — it never spreads the context." Phase 36 owns rendering these into the prompt.

**DATA-block + budget idiom to copy** (`prompt-template.ts:263-322`): each new block is DATA-delimited (`===== DATA: … =====` / `===== END DATA: … =====`), value-bounded via `PER_VALUE_LIMIT`, appended to `scaffoldParts` conditionally (absent block ⇒ byte-identical to prior scaffold), then measured into `TOTAL_LIMIT` with an omission `truncations.push({category, detail})`. Preserve byte-identity: `prompt === inspectorDisplay === payload` (same frozen string instance — `prompt-types.ts:175-184`). **Off Limits gets NO block, positive OR negative (ADR-107 / D-14).** Do not build a second prompt builder — `resolvePrompt` is the sole path (`prompt-template.ts:6-13`).

**The gate that feeds it** (`ai-context-read.ts:168-192`): `readGatedRecentInteractionNotes` reads the 3 newest interactions and includes a note ONLY when `allow_ai === 1`, dropping blanks. This is correct and unchanged by ADR-107 — do not widen it.

---

### `src/logic/ai-availability.ts` (logic — multi-connection Needs Attention, AICFG-05)

**Analog:** the file itself (`:30-54`), explicitly authored as the provisional swap-later interface: `AiAvailability = "off" | "ready" | "needs-attention"` and pure `computeAiAvailability(input)`. Phase 36 replaces the derivation WITHOUT touching Compose (`:9-18`). Extend inputs for multi-connection + model-unavailable → **Needs Attention with explicit reselection, no silent substitution** (D-11). Keep it node-pure (reads no secret; caller supplies `hasCredential`).

---

### `src/logic/ai-suggestion-logic.ts` + `src/logic/ai-diagnostics.ts` (failure categories + sanitized diagnostics, AICFG-13/14)

**Analog:** the `sanitizeError` seam in `ai-suggestion-logic.ts` (one-request lifecycle; ack gate already removed per ADR-079). Map failures to the 8 human-readable categories in UI-SPEC Copywriting; Details shows **sanitized metadata ONLY**. The new diagnostic helper is node-pure and carries only: operation, lane, model id, status/category, correlation id, build/OS version, approx token count, item count, elapsed time. It **NEVER** carries contact names/notes/memories/Group Notes/Off Limits/personalization/Writing Style/Message Focus text, prompt bodies, credentials, raw request/response, or output (D-11 / UI-SPEC #12). No full Sentry — sanitized seam only (deferred).

---

### `src/backup/*` (FINAL plan — format v5 bump, AICFG-16)

**Analog:** `src/backup/backup-schema.ts` FORWARD_MIGRATIONS (`:101-108`) and `PORTABLE_SETTINGS_KEYS` (`:137-215`); `src/backup/export-manifest.ts` entity SELECTs (`:100-144`).

**FORWARD_MIGRATIONS upgrader shape** (`backup-schema.ts:101-108`) — add a `4:` entry (bumps `backupFormatVersion` to 5 and injects the new entity arrays), mirroring the existing `3:`:
```typescript
3: (manifest) => ({
  ...manifest,
  backupFormatVersion: 4,
  memories: [], relationships: [], currentStateEntries: [],
}),
```

**Emission pattern** (`app-settings-dao.ts:840-899`, `getPortableSettingsSnapshot`): every declare-only key (theme, dashboard, orrery, profile-template, history, channel, compose-mode — all listed `?:`-optional across `app-settings-dao.ts:432-488` and in `PORTABLE_SETTINGS_KEYS:160-214`) must move from "accepted-for-restore only" to **emitted**: add the snake_case column to the `SELECT` + the `Pick<AppSettingsRow, …>`, then the camelCase mapping in the return. Plus this phase's own `aiEnabled` + permission type-defaults + per-interaction Allow-AI default.

**Entity SELECT idiom** (`export-manifest.ts:100-144`): `SELECT … AS camelCase FROM … JOIN contacts c ON … ORDER BY uid`. Add the still-missing wire entities named on disk as "Phase 36 wire entities": orrery **Systems** tables (`backup-schema.ts:182-186`), profile **template** entities (`:188-189`), and the new **AI connections + personalization** entities. Verify group-events (`events`) + interaction `duration` coverage against migrations 025/026 at plan time (RESEARCH A6).

**Target is `BACKUP_FORMAT_VERSION = 5`** (`src/backup/types.ts:14` is `4`). Setting it to 4 is a no-op that ships an incomplete format — a second irreversible bump can't be given retroactively (planning-notes R-09). Sequence this as the phase's FINAL plan, after all other schema.

---

### `src/components/FuelEditor.tsx` + `fuel-dao.ts` + Create/EditContactScreen (retire AI-fuel confirm, AICFG-17)

**Analog:** the dead code itself. `confirmFuelCore` (`fuel-dao.ts:214`) / `confirmFuel` (`:297`) and the AI-unconfirmed render path in `FuelEditor.tsx:249-317` (`isAiUnconfirmed = item.source === "ai"` at `:251`) are inert — no producer since migration 017 (`ai-context-read.ts:326-327`). **CORRECTION to any task claim:** `confirmFuel` is NOT wired in `ContactProfileScreen.tsx`; `FuelEditor` is consumed by `CreateContactScreen.tsx` and `EditContactScreen.tsx` — grep `onConfirm=`/`confirmFuel` there for the exact wiring to delete. **Grep ALL consumers incl. `*.test.ts` before deleting a symbol** (MEMORY orphaned-test-consumer-build-breaker; the `Record<AiProviderId,…>` maps + `never` switch + tests break the project-wide tsc gate otherwise).

---

## Shared Patterns

### Compile-time exhaustiveness lock (adding `openrouter`)
**Source:** `src/db/app-settings-dao.ts:1456-1476` (`acknowledgeProvider` `never` switch).
**Apply to:** `AiProviderId`/`AI_PROVIDER_IDS` (`ai-types.ts:23-41`, add in lockstep), `PROVIDER_NAMES` (`settings-ai-logic.ts:35-41`, `Record<AiProviderId,string>` forces it), `token-budget` switch (`token-budget.ts:60-75`), and any new per-connection switch. Adding `openrouter` to `AiCloudProviderId` deliberately breaks the build at every unhandled `case` — that is the lock working, not a bug. `ai_ack_openrouter` (D-10 #2) is likely vestigial (ADR-079 retired the gate) — RESEARCH recommends adding the column purely to keep the `never` switch honest; confirm as a deliberate choice.

### Credentials → SecureStore only (ADR-049 / D-04)
**Source:** `src/services/ai-key-store.ts:26-53`; `buildAiSettingsPatch` (`settings-ai-logic.ts:74-82`) has NO path copying `apiKey`.
**Apply to:** OpenRouter OAuth result, all BYOK entry. Never into `app_settings`, backup, or a portable key. Preserve the `SECRET_SHAPED_KEY` screen (`backup-schema.ts:217-218`, `/(?:api.?key|secret|passphrase|token|credential|password)/i`) — name new portable keys plainly (`aiEnabled`, `openrouterModel`), never `*Key`/`*Token`/`*Credential` or restore silently drops them.

### Egress guards (ADR-051 / D-05 — never remove)
**Source:** `src/ai/custom-endpoint.ts` `validateCustomEndpoint` (HTTPS-only, no creds, no `.local`, no IP literals) + `src/ai/secure-fetch.ts` (runs the validator FIRST, DNS-rebind/SSRF at connect time).
**Apply to:** all custom-endpoint save/egress. Adding a host allowlist is additive/permitted; removing any guard is a trip-wire. OpenRouter adds a new egress host + browser-OAuth path — already owner-decided; do not widen further.

### Durable-preference store (NOT AsyncStorage)
**Source:** `src/stores/theme-store.ts` (app_settings-backed durable prefs). **Anti-analog:** `src/stores/ai-model-prefs-store.ts` is AsyncStorage — correct only for a pure display toggle, NOT for AICFG durable/portable state. D-03: all new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.

### Theme tokens (no hardcoded colour)
**Source:** `src/theme/` + UI-SPEC Color section. All colours via `useTheme().colors[key]`; `danger` carries its documented dual role (destructive fill + warning-emphasis text). Needs Attention is a restrained tonal notice, never a full `danger` slab. Status hues (`statusStable/Wobble/Decay`, `rogue`) must NOT be repurposed for AI state.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/ai/openrouter-oauth.ts` | service | OAuth PKCE / browser-auth | No OpenRouter/WebBrowser/AuthSession/PKCE code exists in-repo (verified zero hits). Structure per RESEARCH Pattern 1 + Expo docs; safety/credential halves reuse `secure-fetch`/`custom-endpoint`/`ai-key-store`. Spike on the Pixel — redirect capture is the highest-risk unknown. |
| Writing Style structured control wiring | logic | transform | New feature; use `SegmentedControl` primitive per UI-SPEC #7. No existing structured-preference analog beyond generic settings-logic (`settings-ai-logic.ts`). |

---

## Metadata

**Analog search scope:** `src/db/migrations/`, `src/db/`, `src/ai/`, `src/logic/`, `src/stores/`, `src/screens/`, `src/backup/`, `src/services/`, `src/components/`.
**Files read on disk this session:** `028-compose-message-mode.ts`, `ai-model-prefs-store.ts`, `app-settings-dao.ts` (:420-490, :500-589, :840-899, :1440-1484), `backup-schema.ts` (:95-224), `prompt-types.ts` (:125-184), `prompt-template.ts` (:255-324), `export-manifest.ts` (:100-144), `settings-ai-logic.ts` (:30-99), `ai-key-store.ts` (:20-59), `ai-availability.ts` (:1-54), `ai-context-read.ts` (:168-192), `model-catalog-cache.ts` (:1-45), `systems-dao.ts` (:1-40); directory listings for all above.
**Pattern extraction date:** 2026-09-13

---

## PATTERN MAPPING COMPLETE
