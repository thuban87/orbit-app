# Phase 35: Messaging & AI Compose — Pattern Map

**Mapped:** 2026-09-13
**Files analyzed:** 10 (2 new, 8 modified) — a REFACTOR phase; nearly every analog is in-repo
**Analogs found:** 10 / 10 (all in-repo; 0 need RESEARCH.md fallback)

> Every file:line below was opened on disk this session (CLAUDE.md "review the code, not the diff"). Migration head re-verified at plan time: highest registered migration is **027** (`TARGET_VERSION = DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION = 27`, `src/db/database.ts:68`), so the new migration is **028**. Trip-Wire 2 (D-06 channel translation) re-verified present at `interaction-assist-dao.ts:112` — do NOT plan translation work.

---

## File Classification

| New/Modified file | Role | Data flow | Closest analog | Match quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/migrations/028-compose-message-mode.ts` | migration | schema/DDL | `src/db/migrations/027-default-interaction-channel.ts` | exact (same additive-`app_settings`-pref shape, incl. `remember` sentinel) |
| `src/stores/compose-session-store.ts` | store (Zustand) | session state | `src/stores/assist-store.ts` | role-match (Zustand `create` + AppState subscribe; different payload) |
| `src/logic/ai-suggestion-logic.ts` (modify) | logic (pure lifecycle) | request-response (AI egress) | itself (reshape single→three, drop ack gate) | exact (self) |
| `src/logic/compose-logic.ts` (modify) | logic (pure gate) | transform (capability resolve) | itself (extend Text/Email + no-destination) | exact (self) |
| `src/services/reach-out/handoff.ts` (modify) | service | request-response (OS handoff) | itself (extend email arm subject+body) | exact (self) |
| `src/screens/ComposeResearch*.tsx` (new) | screen (read-only projection) | CRUD-read | `ThingsToRememberScreen.tsx` imports (READ modules only, NOT its editor UI) | partial (reuse reads, not the editor) |
| `src/db/ai-context-read.ts` (modify) | db (egress projection) | transform (data-minimization) | itself (CARRY new ADR-078 shapes only — Q2/D-13) | exact (self) |
| `src/screens/ComposeScreen.tsx` (rebuild) | screen | request-response + editor | `AppText`/`Button` role primitives | role-match (correct hand-rolled debt) |
| `src/db/app-settings-dao.ts` (modify) | db (DAO) | CRUD | itself (`default_interaction_channel` getter/mapper/setter is the exact template) | exact (self) |
| `src/backup/backup-schema.ts` (modify) | config (allowlist) | — | itself (`PORTABLE_SETTINGS_KEYS` allowlist-not-emit block) | exact (self) |

---

## Pattern Assignments

### `src/db/migrations/028-compose-message-mode.ts` (migration, DDL)

**Analog:** `src/db/migrations/027-default-interaction-channel.ts` (full file, VERIFIED). This is the exact template — a durable `app_settings` preference with a `remember` sentinel plus a concrete remembered value, both `NOT NULL` so the singleton row never has a null state.

**Copy the shape** (027:28-42):
```ts
export const DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION = 27;

export const migration027: Migration = {
  version: DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings
        ADD COLUMN default_interaction_channel TEXT NOT NULL DEFAULT 'remember'
          CHECK(default_interaction_channel IN ('remember','Message','Call','In Person'));

      ALTER TABLE app_settings
        ADD COLUMN remembered_interaction_channel TEXT NOT NULL DEFAULT 'Message';
    `);
  },
};
```

**Phase-35 analog** (planner picks exact literals within the CHECK discipline; RESEARCH §Compose Preference Schema):
```
default_message_mode  TEXT NOT NULL DEFAULT 'remember'
  CHECK(default_message_mode IN ('remember','text','email'));
remembered_message_mode TEXT NOT NULL DEFAULT 'text';
```

**Hard rules carried from the 027 header comment (do NOT break):**
- `app_settings`-ONLY, forward-only, additive. Never touch the shared `interactions` table (its vocabulary migrated at 025 — a second UPDATE is a double-migration hazard).
- Version constant = 28; register it and bump `TARGET_VERSION` (`database.ts:68`).
- Add a sibling `028-compose-message-mode.test.ts` and update `full-chain.test.ts` (Wave 0 gap, RESEARCH §Validation).
- **Migrations are irreversible in production (CLAUDE.md)** — no remote repair.

---

### `src/db/app-settings-dao.ts` (DAO, CRUD) — extend

**Analog:** the `default_interaction_channel` / `remembered_interaction_channel` path in this same file (VERIFIED). Add compose-mode getters/setters by copying it exactly.

**Column-name mapping** (`SETTINGS_COLUMN_MAP`, 621-622):
```ts
defaultInteractionChannel: "default_interaction_channel",
rememberedInteractionChannel: "remembered_interaction_channel",
```

**Read projection into `getAppSettings`** (654 SELECT list; 718-723 typed return):
```ts
// in the SELECT list (:654):
            default_interaction_channel, remembered_interaction_channel,
// in the returned object (:720-723):
    defaultInteractionChannel:
      row.default_interaction_channel as DefaultInteractionChannel,
    rememberedInteractionChannel:
      row.remembered_interaction_channel as RememberedInteractionChannel,
```

**Write posture** (file header, 12-20): one `inWriteTransaction`, a `?`-bound partial UPDATE, a `changes===1` loud-failure guard (mirrors favourites-dao), and a validator asserted BEFORE any UPDATE opens (see `assertOrreryDensity` :63-72 as the validator template — add an `assertMessageMode` that rejects anything outside the CHECK vocabulary). Enum columns are cast on read as a "read-shape convenience; validation on WRITE guarantees a known value" (comment style at :718-719).

---

### `src/backup/backup-schema.ts` (allowlist) — extend

**Analog:** the Phase-23 theme-keys / Phase-25 dashboard-keys blocks inside `PORTABLE_SETTINGS_KEYS` (VERIFIED :135-174). Both are **allowlisted-but-not-emitted**, with an explicit comment that emission + `BACKUP_FORMAT_VERSION` bump + a forward migration are deferred.

**Copy the allowlist-not-emit idiom** (:169-173):
```ts
  // Phase 25 dashboard keys: allowlisted NOW so a future format-5 backup can
  // carry them, but getPortableSettingsSnapshot does not emit them yet. Emission,
  // a format bump, and a forward migration remain Phase 36 scope.
  "dashboardViewMode",
  "dashboardPopulations",
  "dashboardFilters",
```

**Phase-35 application:** add the two new compose-mode keys with an equivalent comment. Per D-03 they are allowlisted only — **no `BACKUP_FORMAT_VERSION` bump this phase** (Phase 36 owns emission + bump). Do NOT add them to `getPortableSettingsSnapshot`.

---

### `src/stores/compose-session-store.ts` (Zustand store, session state) — NEW

**Analog:** `src/stores/assist-store.ts` (full, VERIFIED). Same `create<T>()((set) => …)` shape and the same `subscribeAppState` AppState-change pattern.

**Store creation pattern** (assist-store:23-33):
```ts
export const useAssistBanner = create<AssistBannerStore>()((set) => ({
  queue: [],
  newest: null,
  morePendingCount: 0,
  async refresh() {
    const now = localDateTime();
    const queue = await listEligiblePendingAssists(getExecutor(), now);
    const { newest, morePendingCount } = selectBannerState(queue, now);
    set({ queue, newest, morePendingCount });
  },
}));
```

**Phase-35 application (D-10, RESEARCH Pitfall 6):** hold `body / subject / mode / destination / Message Focus (≤3)` keyed by contact, surviving in-app nav + backgrounding but NOT relaunch (session-only, no drafts table, no backup contract). Clear on Transmit-confirmed and on relaunch. Use `localDateTime()` from `@/db/database` for any timestamp — never `toISOString()` (CLAUDE.md). Message Focus is session-only and **Add to AI grants no AI permission** (D-10). Add `compose-session-store.test.ts` (Wave 0 gap).

---

### `src/logic/ai-suggestion-logic.ts` (pure lifecycle) — RESHAPE

**Analog:** itself (full, VERIFIED). The machinery is reusable and must be preserved; only the *shape* changes.

**REUSE unchanged (these are security/privacy controls — header :5-52):**
- The SOLE `AbortController` + `AI_REQUEST_TIMEOUT_MS = 20_000` timeout (:61, :292-297), created together in `egress`, cleared together on settle.
- The monotonic `gen` generation token + stale-guard (`if (token !== this.gen) return;` at :305, :312, :348) so a slow/superseded completion can never mutate the draft.
- Node-pure + fully injected `AiSuggestionDeps` (:110-144); no expo/RN import. Every effect (generate, timer, applyDraft, sanitizeError) stays injected.
- `dispose()` / `onConfigChange()` resetting to idle so blur/unmount never strands `resolving`/`loading` (:363-382).
- `sanitizeError` → `{ status: "error", code }` — code only, never raw provider text (:98-99, :308).

**RESHAPE (ADR-079 / D-09, Trip-Wire 4 — reshape CLEANLY, do not half-wire):**
- Drop the `needs-acknowledgement` state (:86-90) and the entire ack path (`isProviderAcknowledged` / `acknowledgeProvider` / `acknowledge()` / `decline()` :223-281) — that is ADR-052's exact-prompt gate. **Pitfall 3:** never leave generation gated on `ai_ack_*` that nothing sets. The `ai_ack_*` columns become unused; column removal is optional (forward-only, likely not worth it — remove the writer/reader, leave the columns).
- Change the success shape from a single `confirm-replace` suggestion (:97) to **exactly three unlabeled, meaningfully varied suggestions** on a non-destructive review surface; the editor is untouched until "Choose this". "Try Again" = a fresh `begin()` that replaces the set (reuse `retry()` :385-387). No generation-history stack.
- `generate` returns three variants instead of one string (:122-125, :303) — reshape the dep signature.

Extend `ai-suggestion-logic.test.ts` for three-suggestion / no-ack / Try-Again-replaces-set (Wave 0 gap).

---

### `src/logic/compose-logic.ts` (pure gate) — EXTEND

**Analog:** itself (full, VERIFIED). It is already the single node-tested capability gate; extend it, never re-derive capability in the screen (WR-02).

**Existing pattern to extend** (`resolveComposeControls` :71-116) — the explicit-precedence, `null`=probe-pending idiom:
```ts
export function resolveComposeControls(
  hasPhone: boolean,
  smsAvailable: boolean | null,
): ComposeControls {
  // (0) Probe pending (capability UNKNOWN): Send hidden, Copy sole primary, no helper.
  if (smsAvailable === null) { return { send: "hidden", copyEmphasis: "primary", addNumber: !hasPhone, smsUnavailableHelper: false }; }
  // (1) No number wins first ...
  if (!hasPhone) { ... }
  // (2) Number but no SMS ...
  if (!smsAvailable) { ... }
  // (3) Number + SMS: both controls.
}
```

**Phase-35 extension (COMP-02/03):** widen to Text/Email mode + a no-destination Transmit-unavailable state (Transmit unavailable, Copy stays sole primary — dossier §D, UI-SPEC "No-destination state"). Keep the `null`=unknown/no-flash discipline and the "missing destination wins first" precedence. The remembered-mode logic (default `remember` sentinel → read `remembered_message_mode`; write remembered value on Copy/Transmit) is new pure logic — extend the `compose-logic` test matrix (Wave 0 gap). Consume `selectActionablePrimaryMethods` (`contact-methods-read.ts:10-19`) for BOTH phone and email; do not invent a destination store.

---

### `src/services/reach-out/handoff.ts` (service) — EXTEND email arm

**Analog:** itself (full, VERIFIED). Reuse `performReachOut` for Transmit; extend ONLY the email branch.

**Current email arm** (:60-66) — bare `mailto:`, no subject/body:
```ts
    if (channel === "text") {
      await SMS.sendSMSAsync(endpoint, messageBody);
    } else {
      await Linking.openURL(
        `${channel === "call" ? "tel" : "mailto"}:${endpoint}`,
      );
    }
```

**Phase-35 extension (COMP-04):** the email branch must carry subject + body. RESEARCH recommends the **no-dependency** path — `Linking.openURL('mailto:' + endpoint + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body))` — keeping the assist row + failure handling intact. `expo-mail-composer` is an OPTIONAL owner opt-in gated behind a `checkpoint:human-verify` task (Package Legitimacy Audit); it requires a dev-client rebuild and still needs the "Did you send it?" prompt.

**PRESERVE (Trip-Wire 1, D-04/D-05):** the assist row is created BEFORE handoff via `createPendingAssist` stamped `handoff_at = now` (:50-57); `markAssistFailed` on catch (:69). Transmit hands off, never claims delivery. Do NOT stamp the log at confirmation time; do NOT hardcode `channel:"text"` (mode now decides).

---

### `src/db/interaction-assist-dao.ts` — REUSE UNCHANGED (Trip-Wire 1 & 2)

Not a modify target — the confirmation write. `markAssistLogged` (VERIFIED :99-118) inserts ONE outbound interaction stamped at `transactionAssist.handoff_at` (NOT `now`) through the sole recency writer, and **already** routes the channel through `remapLegacyChannel` (D-06 done, Trip-Wire 2 — do not re-plan):
```ts
      await insertInteractionCore(exec, transactionAssist.contact_id, input.now, {
        uid: newUid(),
        occurredAt: transactionAssist.handoff_at,   // ← stamped at handoff, NOT confirmation
        channel: remapLegacyChannel(transactionAssist.channel), // text/email→Message, call→Call
        direction: "outbound", connected: input.connected, note: input.note ?? null, source: "assist",
      });
      await recomputeLastContactCore(exec, transactionAssist.contact_id, input.now);
```
The Compose "Did you send it?" → **Yes** calls `markAssistLogged` unchanged; **Not yet** keeps the session and leaves the row (dismissal path = `markAssistDismissed` :141-153). Copy never triggers this. `newUid()` is the DAO-owned guarded UID path — do NOT introduce raw `crypto` (Hermes crypto guard, RESEARCH §Security V6).

---

### `src/screens/ComposeResearch*.tsx` (read-only projection) — NEW

**Analog:** the READ-module imports of `ThingsToRememberScreen.tsx` (VERIFIED :19-57) — but **NOT** its editor UI (anti-pattern: it imports `MemoryEditor`, `RelationshipEditor`, `Switch`, `setCurrentStateValue`, add/edit/delete DAOs — Compose Research is read-only).

**Reuse ONLY these read modules** (seen in the imports):
```ts
import { getFirstClassDerived, getFirstClassFields } from "@/db/first-class-knowledge-read";
import { getCurrentStateValues } from "@/db/current-state-history-read";
import { listMemoriesForContact, resolveVisibility } from "@/db/memories-read";
import { KNOWLEDGE_GROUP_ORDER, MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
```
Plus `profile-knowledge-read.ts` (RESEARCH §Standard Stack). Build a compact read-only projection over these; render ONLY populated conversation-relevant groups (empty → `nothing to remember yet` caption, not Profile scaffolding — UI-SPEC E3). Off Limits renders as a distinct **Avoid** group, never exposes Add to AI, never Message Focus (dossier §N, ADR-078).

**Anti-pattern (RESEARCH):** never a UI-side `.filter()` for off_limits or AI-eligibility — the exclusion is structural in SQL (`RANKED_FUEL_EXCLUSIONS`, `MEMORY_AI_ELIGIBILITY` = `allow_ai=1 AND deleted_at IS NULL`). Add-to-AI eligibility must read the same `allow_ai=1` truth, never a component guess.

---

### `src/db/ai-context-read.ts` (egress projection) — EXTEND SHAPE ONLY (D-13, Trip-Wire 3)

**Analog:** itself (VERIFIED :1-27 header, :108-152 interaction aggregate, :160-210 shared fields/memories, :221+ builder). This is the SOLE outbound projection and the structural data-minimization boundary.

**Current egress facts to preserve** (header :9-26):
- Interaction read selects ONLY `channel, quality, connected` — the free-text note is NEVER selected (:117-120).
- Fuel only via `getRankedFuel` (off_limits / unconfirmed-AI / blank excluded IN SQL).
- Memories only via `listAiEligibleMemories` (`allow_ai=1 AND deleted_at IS NULL`, :196).
- Custom fields only where `share_with_ai=1` (:164-168). Every value `?`-bound; only `isSafeColName`-guarded identifiers interpolated.
- `formatLocalDate()` for every timestamp (:47) — never `toISOString().split('T')[0]`.

**Phase-35 scope (D-13, owner-resolved — DISPLAY + CARRY ONLY):** extend `PromptContext` / `ai-context-read.ts` to **carry the shapes** of (a) the avoidance-constraint (off-limits AI-enabled items as negative constraints) and (b) the gated recent-interaction note (note included only where that interaction's `allow_ai=1`; column exists since migration 025). **Do NOT** widen actual egress: do not add off-limits text or interaction notes as *positive* context, do not transmit an AI-disabled off-limits item, never include a Group Note. The exact prompt-template rendering/transmission of these NEW additions is **Phase 36's** job (§U). Any further widening is an owner decision (D-08). **Warning sign (Pitfall 2):** any edit to `fuel-read.ts` exclusions or a new positive-context branch here → stop.

Extend `ai-context-read.test.ts` + `fuel-read.test.ts` for the shape-carry (still excludes off_limits/Group Notes; note gated on allow_ai).

---

### `src/screens/ComposeScreen.tsx` (rebuild) — SPEAK IN ROLES

**Analog:** `AppText` (VERIFIED full) + `button-roles.ts`/`Button` (VERIFIED full). The current screen hand-rolls `Pressable`/`Text`/raw `fontSize`/`fontWeight` and mis-uses `accent` on text — that is the refactor debt to correct.

**Typography — use `role`, never raw sizes** (AppText :48-74; UI-SPEC role map):
```tsx
<AppText role="heading">{contactName}</AppText>   // header identity, Did-you-send-it heading, AI review heading
<AppText role="body">{...}</AppText>              // editor input, AI suggestion text (16/24 — do NOT shrink AI panels)
<AppText role="label">Subject</AppText>           // Subject field + section labels ("Avoid", "Message focus · N")
<AppText role="caption">{...}</AppText>           // metadata, helper/feedback, Off-Limits caption
```
Never `allowFontScaling={false}` / never clamp reflowable content (THEME-07, :10-16).

**Buttons — use roles, `accent` fill reserved** (button-roles :75-136; UI-SPEC Color):
- `primary` (fill `accent` + `onAccent`) — the single highest-emphasis action per surface: **Transmit**; the adaptive **Draft/Rewrite with AI**; **Choose this**; **Yes, log interaction**. When no destination exists, **Copy** becomes the sole primary.
- `tertiary` (text-only `accentText` link tone) — **Make this an email/text**, **Subject** copy, establish-primary prompts, **Things to Remember · N**, **Try Again**, **Add to AI**.
- `secondary` (surface + border) — **Copy** (when not primary), **Not yet**, **Cancel**, **Keep editing**.
- `destructive` (`danger`/`onDanger` + `warning` glyph) — **Discard changes** only.
- Every control pads to `MIN_TOUCH_TARGET = 44` (:45).

**Rebuild shape:** editor-first (not fuel-first); Research is a sibling read-only side; Text/Email mode; three-suggestion review surface. Keep the "Copied" feedback as setState+setTimeout (NOT per-frame animation — CLAUDE.md, RESEARCH anti-patterns). Origin-aware Back (COMP-14): pop toward Profile when launched there, don't always reset to dashboard, and don't leave the finished route in Back history. Retire the `requestAiSuggestion` route param + `ai-suggestion-navigation.ts` consume-once intent (Trip-Wire 4).

---

## Shared Patterns

### Theme tokens (all colour)
**Source:** `useTheme().colors[token]`; `button-roles.ts` returns token KEYS, resolved at render in `Button.tsx`.
**Apply to:** every new/rebuilt surface. No hex anywhere incl. Skia; `npm run check:colors` enforces. `accent` fill reserved for the single primary per surface; `accentText` for text-only actions. Never combine Android `elevation` with a translucent `GlassSurface` background (memory: opaque dark rect).

### Local wall-clock timestamps
**Source:** `formatLocalDate()` / `localDateTime()` (`ai-context-read.ts:47`, `database.ts`, `assist-store.ts:2`).
**Apply to:** every timestamp in this subsystem. NEVER `toISOString().split('T')[0]` (UTC off-by-one, CLAUDE.md).

### Pure, node-tested logic modules
**Source:** `compose-logic.ts`, `ai-suggestion-logic.ts` (no RN/expo import; effects injected).
**Apply to:** all new decision logic (mode/remember, session rules) — keep the screen free of capability/lifecycle arithmetic; test off-device with Vitest.

### `app_settings` durable prefs (never AsyncStorage)
**Source:** migration 027 + `app-settings-dao` column-map/getter/validator + `PORTABLE_SETTINGS_KEYS` allowlist-not-emit.
**Apply to:** the two new compose-mode preferences (D-03). NOT NULL defaults; portable-allowlisted; no format bump this phase.

### Additive assist coexistence (ESCALATE trip-wire)
**Source:** `interaction-assist-dao.ts:99-153`, `AssistBanner.tsx`, `App.tsx:393`.
**Apply to:** the Compose "Did you send it?" panel — ADDITIVE only. App-global banner + pending sheet + dismissal path stay; stamp at `handoff_at`. Removing any of these reverses ADR-070/071 → stop and ask the owner.

---

## No Analog Found

None. Every file has an in-repo analog; RESEARCH.md fallback patterns are not needed. Two forward seams are owner-resolved (D-12 three-state AI adapter; D-13 ADR-078 display+carry) rather than analog-missing — the D-12 adapter is a NEW small module with no direct analog, but its provisional derivation reads existing `aiProvider`/credential state (`ComposeScreen.tsx:318` binary check is the value to replace) and its stable-interface + swap-internals-later intent mirrors the `app-settings-dao` "read-shape convenience, validate on write" seam discipline.

## Metadata

**Analog search scope:** `src/db/migrations/`, `src/stores/`, `src/logic/`, `src/services/reach-out/`, `src/db/`, `src/screens/`, `src/components/ui/`, `src/backup/`
**Files opened on disk this session:** migration 027, `assist-store.ts`, `handoff.ts`, `compose-logic.ts`, `ai-suggestion-logic.ts`, `AppText.tsx`, `button-roles.ts`, `ai-context-read.ts` (three ranges), `ThingsToRememberScreen.tsx` (imports), `app-settings-dao.ts` (two ranges), `backup-schema.ts` (allowlist), `interaction-assist-dao.ts` (:95-155), `database.ts` (TARGET_VERSION), migrations dir listing
**Pattern extraction date:** 2026-09-13

## PATTERN MAPPING COMPLETE
