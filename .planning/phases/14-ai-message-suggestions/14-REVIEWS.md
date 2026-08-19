# Phase 14: AI Message Suggestions — Plan Reviews

## Convergence status — Cycle 1 complete, NOT converged (owner gate on one HIGH)

Two independent reviewers (Codex CLI 0.148.0, run manually without the blocked
`--dangerously-bypass-hook-trust` flag; and a read-only in-session Claude subagent) reviewed the
full corrected six-plan set plus CONTEXT / AI-SPEC / RESEARCH / PATTERNS / VALIDATION. Both returned
**REQUEST_CHANGES**. Their findings strongly overlap. This is a genuine, fully-captured cycle — it
supersedes the prior "no verdict recorded" state.

- **Codex verdict:** HIGH 5, MEDIUM 2, LOW 0 → REQUEST_CHANGES
- **Claude verdict:** HIGH 3, MEDIUM 2, LOW 1 → REQUEST_CHANGES

**CYCLE_SUMMARY: current_high=7 current_actionable=4** (union of distinct concerns; nothing folded
into PLAN.md yet).

One HIGH (H3 below) was an **owner-bucket security-posture decision**, not a plan-quality fix — both
reviewers flagged it, Claude by name-citing CLAUDE.md. **The owner resolved it (2026-08-19):**
implement airtight connection-time enforcement via a native module (see H3). Cycle 2 replan folds
this in along with every other finding below.

## Owner decisions (Cycle 1 → Cycle 2 replan directives)

- **H3 — RESOLVED (2026-08-19): add native connection-time egress enforcement (chosen: airtight).**
  Add a focused Android-first native module that wraps OkHttp with a **custom `Dns` implementation**:
  resolve the Custom hostname → reject any resolved loopback/private/RFC1918/link-local/`.local`
  address → connect to exactly the vetted IP so `fetch` cannot re-resolve to a different address
  (closes active DNS-rebinding / TOCTOU). Route Custom-endpoint provider requests through this module.
  This also enforces redirect safety at the native layer (fixes M3 — RN `fetch` silently follows 3xx
  on Android). The must-have in 14-02 may now be stated truthfully as "loopback/private/link-local/
  LAN-**resolving** Custom URLs fail before any bytes leave the device," and threat T-14-04 is
  genuinely mitigated rather than best-effort.
  - Governance note: this does NOT reverse a recorded decision. The locked scope (14-CONTEXT.md, "the
    agent's Discretion") forbids provider SDKs / AI frameworks, not native modules; CONTEXT
    "Established Patterns" already contemplates new Expo native modules via `npx expo install` +
    config-plugin + clean prebuild/release-build UAT. The owner confirmed "no new deps" was
    conditional ("unless we talk about it"), and we talked.
  - Plan scope this adds: the native module + Expo config plugin registration; a typed JS wrapper the
    AiService Custom adapter calls; unit tests for the JS validation/rejection logic; and an explicit
    **on-device (Pixel) UAT** fixture that attempts an HTTPS→private-address escape and an HTTPS
    redirect, with release approval contingent on its pass (raw-`fetch` mock tests cannot prove this —
    both reviewers noted mocked-fetch can't establish native transport behavior).

---

## Cycle 1 — distinct HIGH concerns

### H1 — Prompt allowlist is not closed (egress-broadening risk)
- **Reviewer:** Codex. **Where:** 14-03-PLAN.md Task 1.
- Undefined "relationship metadata" and "where the contract permits it" leave the allowed contact
  columns unenumerated, leaving room to broaden egress beyond approved fuel/aggregates/newest
  channel/opted-in fields.
- **Fix:** Define `PromptContext` as a closed type listing every allowed source column (incl. whether
  contact name is allowed); prohibit all other contact reads in the AI-context DAO; add fixtures with
  sensitive non-allowlisted columns asserting they never reach the resolved prompt/payload.

### H2 — Custom-endpoint validator has a broken ownership/dependency boundary
- **Reviewer:** Codex. **Where:** 14-01-PLAN.md Task 1; 14-02-PLAN.md Task 2.
- Plan 01 must validate+persist the Custom endpoint, but the centralized validator is introduced only
  in Plan 02, and Plan 02 does not modify the settings DAO — so plans either duplicate validation or
  persist endpoints without the request-time rules.
- **Fix:** One shared endpoint-validation module in Plan 01; DAO uses it on writes; Plan 02 reuses it
  immediately before fetch. No separate save-time vs request-time validators.

### H3 — Custom-endpoint "LAN-resolving fails before request" is NOT implementable on the locked stack  ⚠ OWNER DECISION
- **Reviewers:** Codex AND Claude (independent agreement). **Where:** 14-02-PLAN.md Task 2 `<behavior>`
  ("localhost, loopback, private, link-local, and **LAN-resolving** Custom URLs fail before a
  request"); threat T-14-04; AI-SPEC §3 pitfall #2.
- Blocking a hostname that *resolves to* a private/LAN address needs DNS resolution in JS before the
  fetch. RN/Expo provide no `dns` module and no name-resolution API without a native module — and the
  phase is locked to raw `fetch` + first-party SecureStore, no provider SDK / AI framework / new native
  module. So only URL-literal checks are possible (reject `http:`, credentials, loopback/RFC1918/
  link-local **IP literals**, `.local`). A public hostname that resolves to a private address
  (DNS-rebinding) cannot be caught pre-flight. The must-have as written is undeliverable.
- Claude flagged per CLAUDE.md: weakening/scoping a named security control is an **owner decision**, not
  a silent executor/planner call. This was the escalation trigger.
- **✅ OWNER RESOLUTION (2026-08-19): option (c) — airtight native connection-time enforcement.** See
  the "Owner decisions" block above for the full directive (custom OkHttp `Dns`, pin vetted IP, reject
  private-resolving hosts, native redirect safety, on-device UAT). The planner must implement THIS, not
  rescope/weaken the control.

### H4 — AbortController ownership is contradictory
- **Reviewer:** Codex. **Where:** 14-02-PLAN.md Task 1; 14-05-PLAN.md Task 1.
- Plan 02 says the service creates a fresh `AbortController`+timeout; Plan 05 makes Compose own the
  controller/request lifecycle. Two controllers means Cancel/unmount/timeout can invalidate reducer
  state without aborting the real fetch.
- **Fix:** One owner (prefer Compose owning the sole controller+timeout, passing its `AbortSignal` to
  `AiService`; adapters never create a replacement). Tests proving Cancel/unmount/timeout/provider
  change abort the exact signal supplied to fetch.

### H5 — First-send acknowledgement is not durably gated before egress
- **Reviewers:** Codex (HIGH); Claude (MEDIUM) — same defect, ownership split across plans 04/05.
- **Where:** 14-04-PLAN.md Task 2; 14-05-PLAN.md Task 2.
- The per-provider acknowledgement must show the **exact resolved** (contact-specific) prompt, which
  only exists in Compose — but Plan 04 (Settings, no contact) is attributed the "show exact
  ResolvedPrompt" step, and the persisted `app_settings` write for the ack has no clear owner (Plan 05
  excludes `app-settings-dao.ts` and forbids settings writes). Ack may be built in neither place, or
  twice, or not persist across sessions.
- **Fix:** Assign the exact-prompt display + persistence to Compose (Plan 05); add `app-settings-dao`
  to Plan 05 with an explicit carve-out for the one ack flag (distinct from the contact/interaction/
  fuel no-write rule). Reduce Plan 04 to pure ack/inspector helpers that *accept* a `ResolvedPrompt` +
  the template editor. Tests: declined/unacknowledged → no network call; ack persistence and adapter
  receive the same `ResolvedPrompt` identity.

### H6 — Migration 004 is wired to a nonexistent file and never registered  (concrete, source-verified bug)
- **Reviewer:** Claude (verified against source). **Where:** 14-01-PLAN.md `files_modified` + Task 1.
- Plan lists `src/db/migrations/index.ts` — that file does not exist. The real registration point is
  `src/db/database.ts`: the hardcoded `[migration001, migration002, migration003]` array (~line 111),
  the per-migration imports (~lines 26–27), and `export const TARGET_VERSION = 3` (~line 38). None
  appear in `files_modified`. As written, migration 004 is authored but never imported/registered and
  `TARGET_VERSION` stays 3, so the runner never applies it — every later AI-settings read/write fails
  at runtime. Plan 01 also has no `tsc` gate to catch it.
- **Fix:** Replace `src/db/migrations/index.ts` with `src/db/database.ts` in `files_modified`; Task 1
  imports `migration004`, adds it to the array, bumps `TARGET_VERSION` 3→4.

### H7 — Edit-mode `share_with_ai` toggle has no persistence path  (concrete, source-verified bug)
- **Reviewer:** Claude (verified against source). **Where:** 14-04-PLAN.md Task 1.
- Create path works (`NewFieldDef.share_with_ai` exists; `field-ddl.ts:createField` INSERTs it; form
  hardcodes `share_with_ai: 0` at FieldDefForm.tsx:162). But the **edit** path can't persist it:
  `FieldDefDraft` (FieldDefForm.tsx:53–59) has no `share_with_ai`; the only edit-time metadata writer
  `updateFieldCuration(...)` writes only `show_on_new`+`always_show`. `CustomFieldsScreen.handleEdit`
  (line 163) would silently drop a toggled flag. Task 1's `files_modified` omits `field-defs-dao.ts`
  and `CustomFieldsScreen.tsx`.
- **Fix:** Add `share_with_ai` to `FieldDefDraft`; extend `updateFieldCuration` (or add a sibling
  writer) to persist it; wire it in `CustomFieldsScreen.handleEdit`; add both files to `files_modified`.

---

## Cycle 1 — actionable non-HIGH concerns

### M1 — Immutable-prompt tests don't cover the real integration seam
- **Reviewer:** Codex. **Where:** 14-03-PLAN.md Task 2; 14-05-PLAN.md Tasks 1–2.
- Identity test uses consumer stubs; the real inspector/ack/service wiring is in Compose. A screen
  integration could reconstruct a prompt or pass only its text without failing the pure-state tests.
- **Fix:** Injected Compose-flow integration test capturing objects received by inspector, ack, and
  `AiService`, asserting strict reference equality and equality with the outbound payload.

### M2 — Dependency install omits the lockfile from the change contract
- **Reviewer:** Codex. **Where:** 14-01-PLAN.md Task 2.
- `npx expo install expo-secure-store` updates `package-lock.json`, absent from `files_modified`.
- **Fix:** Add `package-lock.json` to modified files; verify clean `npm ci` + focused test.

### M3 — Redirect rejection via `fetch` may be a silent no-op on Android
- **Reviewer:** Claude. **Where:** 14-02-PLAN.md Task 2; AI-SPEC §3 pitfall #2 (`redirect: "error"`).
- RN `fetch` may not honor the `redirect` init on Android (native client follows 3xx transparently),
  so `redirect: "error"` — treated as a load-bearing egress control — may be inert on the primary
  target. (Related to the H3 cluster.)
- **Fix:** Add a Plan 06 device-verification step for redirect behavior; if unsupported, fall back to
  rejecting responses whose final-URL host differs from the validated host (where `response.url` is
  exposed), else document the limitation and fold into the H3 residual-risk note.

### L1 — Plan 01's `ai-types.ts` edit can break `AiService.ts` compile with no `tsc` gate
- **Reviewer:** Claude. **Where:** 14-01-PLAN.md Task 2 vs 14-02-PLAN.md.
- `AiService.refreshProviders` reads `settings.aiApiKeys?.[provider] ?? settings.aiApiKey`
  (AiService.ts:435–436). If Plan 01 removes those from `AiSettings`, `AiService.ts` (not in Plan 01's
  files) fails `tsc`, but Plan 01 runs only Vitest + `check:colors`, so it surfaces only in Plan 02.
- **Fix:** Plan 01 adds neutral types WITHOUT removing the legacy key fields (removal + `AiService`
  rewrite belongs to Plan 02), OR add `npx tsc --noEmit` to Plan 01 verification.

---

## Reviewer-confirmed strengths (not findings)

Claude verified against source that these are correct and grounded: `getRankedFuel` structurally
excludes `off_limits`/`source='ai'`/blank (fuel-read.ts:133–141); `impact-read` never selects
`note`/`detail`; the aggregate-only interaction read (`interactions.channel`/`quality` exist,
`note`/`detail` correctly forbidden); the `share_with_ai=1` + `col_name` field gate; the single
immutable `ResolvedPrompt` shared across inspector/ack/payload; ComposeScreen's reserved Phase-14 slot
(lines 374–375); serializable-only `Compose: { contactId }` navigation. Critique foci #3 (redaction),
#4 (prompt identity), #5 (cancellation/stale) are otherwise well-covered.

---

## Owner decision — RESOLVED (2026-08-19)

**H3** is resolved: airtight native connection-time enforcement (see "Owner decisions" block). Cycle 2
replan (`gsd-plan-phase 14 --reviews --skip-research`) folds H3's directive plus all other HIGH/
actionable findings into the plan set, followed by Cycle 2 review. M3 (Android redirect no-op) is
subsumed by H3's native path. Do NOT begin execution: Phase 14 execution remains owner-gated even
after convergence.

## Reviewer tooling notes (for future cycles)
- Codex: run manually — `codex exec --sandbox read-only --skip-git-repo-check --ephemeral -C <repo>
  -o <final.md> - < prompt.md`. NO `--dangerously-bypass-hook-trust` (classifier blocks it). The
  `--output-last-message` file cleanly captures the verdict (fixes the prior "verbose transcript
  obscured result" failure).
- Claude: read-only in-session subagent that returns markdown and writes NO files (avoids the headless
  `claude -p` Write-permission-wall 0-byte failure).
