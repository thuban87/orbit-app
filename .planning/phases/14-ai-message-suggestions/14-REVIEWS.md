# Phase 14: AI Message Suggestions — Plan Reviews

## Convergence status — Cycle 2 complete, NOT converged (5 HIGH + 5 actionable, all planner-bucket)

Cycle 2 reviewed the corrected 7-plan set (commit `17534b4`) with the same two independent
reviewers (Codex CLI 0.148.0, run manually without the blocked bypass flag; and a read-only
in-session Claude subagent). **Both reviewers independently confirmed all 11 Cycle-1 findings
(H1–H7, M1–M3, L1) are genuinely resolved at the source level** — the Cycle-2 replan worked. Both
returned REQUEST_CHANGES on NEW, deeper source-grounded findings (not recurrences).

- **Codex verdict:** HIGH 3, MEDIUM 4, LOW 0 → REQUEST_CHANGES
- **Claude verdict:** HIGH 2, MEDIUM 1, LOW 2 → REQUEST_CHANGES

**CYCLE_SUMMARY: current_high=5 current_actionable=5** (union of distinct concerns; down from
Cycle 1's 11 → decreasing, not stalled). None of the Cycle-2 findings reverse or weaken a recorded
decision — C2-H2 *strengthens* the owner's airtight H3 control — so all are planner-bucket, no owner
gate. Every load-bearing finding below was independently re-verified against source by the
orchestrator before recording (per CLAUDE.md "review the code, not the diff").

### Cycle 2 — distinct HIGH concerns

- **C2-H1 — `category` is not a `contacts` column (source-verified).** Codex; Claude concurred on the
  schema. 14-03-PLAN.md instructs `SELECT name, category` and enumerates `category: string` as a
  direct `contacts` field, but `contacts` has `category_id INTEGER REFERENCES categories(id)`
  (001-initial.ts:66) — the category *name* lives in `categories.name`. The AI-context read would
  fail at runtime or invite an unplanned repair. **Fix:** resolve category via a narrow
  `LEFT JOIN categories` selecting `categories.name AS categoryName`; keep the allowlist closed
  (no broader contact row); update `PromptContext` + fixtures.

- **C2-H2 — native deny-set is IPv4/legacy-centric; not "airtight" for IPv6/mapped/CGNAT
  (design-judgment; both reviewers).** Codex (HIGH) + Claude (M-N3). 14-07 Task 1 rejects via
  loopback/any-local/link-local/`isSiteLocalAddress()`/multicast/`.local`. Java
  `Inet6Address.isSiteLocalAddress()` matches only deprecated `fec0::/10`, **not** IPv6 Unique-Local
  `fc00::/7`; IPv4-mapped forms (`::ffff:10.0.0.1`) and CGNAT `100.64.0.0/10` are also uncaught. A
  Custom hostname resolving only to those would pass the filter — defeating the owner's chosen
  airtight guarantee. 14-06 device fixture tests only `127.0.0.1`/RFC1918, so the gap would ship
  untested. **Fix:** specify the Kotlin predicate as *reject-unless-verifiably-public global unicast*,
  explicitly unwrap IPv4-mapped IPv6 and re-check, and add `fc00::/7` + `100.64.0.0/10`; add an
  IPv6-ULA (or IPv4-mapped) escape to the 14-06 device fixture as release-gating. (This implements the
  owner's airtight H3 mandate more faithfully — it does not reverse it.)

- **C2-H3 — first-send ack is not ordered before egress (source-verified).** Codex H5. 14-05 says
  "on acknowledge call `acknowledgeProvider`" and tests eventual persistence, but never requires
  *awaiting the committed ack transaction before* the lifecycle creates the controller / calls
  `AiService.generate`. A write failure would not block egress. **Fix:** require
  `await acknowledgeProvider(...)` to resolve before any controller creation / generate call; a write
  failure keeps egress blocked. Add a deferred-DAO test proving no `generate` call occurs until the
  commit resolves.

- **C2-H4 — Plan 07 has an undeclared same-wave dependency on Plan 01 (source-verified).** Claude
  H-N1. 14-07 (`depends_on: []`, `wave: 1`) requires `src/ai/secure-fetch.ts` to import
  `validateCustomEndpoint` from `@/ai/custom-endpoint` (Plan 01, also wave 1) and grep/tsc/vitest-gates
  on it — the wave-1 parallel run can execute 07's gate before 01 produces the module. **Fix:** add
  `depends_on: ["14-01"]` to 14-07 and reflow waves.

- **C2-H5 — Plan 04 has an undeclared same-wave dependency on Plan 02 (source-verified).** Claude
  H-N2. 14-04 (`depends_on: ["14-01","14-03"]`, `wave: 2`) reads `AiService.ts (Plan 02 …)` and its
  gate runs `npx vitest run … src/services/AiService.test.ts` — Plan 02's rewritten adapter/test, also
  wave 2. **Fix:** add `"14-02"` to 14-04 `depends_on` and reflow waves.

### Cycle 2 — actionable non-HIGH concerns

- **C2-M1 — abort→native cancellation race (Codex M4).** 14-07 `cancel(requestId)` can arrive before
  the native module records the `Call`, becoming a no-op while the request later starts. **Fix:**
  maintain cancelled-request tombstones checked before enqueue and immediately after registration;
  remove listeners on settlement; map `Call.isCanceled` to an abort code.

- **C2-M2 — no native compile proof before Plan 02 depends on 07 (Codex M5, source-verified).** 14-07
  only greps Kotlin; native compilation/autolinking is deferred to the final device gate. **Fix:** add
  a clean Android prebuild + native Gradle compile/build check to 14-07 before Plan 02 relies on it.

- **C2-M3 — private-resolution/redirect UAT lacks a concrete fixture + observer (Codex M6).** A generic
  failed request can't distinguish native rejection from TLS/DNS/connectivity failure, nor prove the
  redirect target received no payload. **Fix:** specify synthetic HTTPS origin/redirect-target
  fixtures, controlled DNS resolution, valid certs where needed, and sanitized request-observation
  criteria in 14-06.

- **C2-M4 — FieldDefForm component test is not executable in the current setup (Codex M7,
  source-verified).** 14-04's gate runs `src/components/field-def-form.test.tsx`, but neither
  `react-test-renderer` nor `@testing-library/react-native` is installed (Vitest is Node/render-free).
  **Fix:** extract draft hydration/`share_with_ai` payload construction into a pure tested helper and
  cover it in Vitest; keep the rendered toggle for the explicit Pixel UAT (preferred over adding
  renderer tooling to the dependency contract).

- **C2-M5 — Gemini key-in-URL sanitization is untested (Claude L-N5, source-verified).**
  `GoogleProvider.generate` embeds the key in the URL query (`…?key=${apiKey}`, AiService.ts:318);
  Plan 02 keeps Gemini on raw `fetch`. **Fix:** add a named Plan 02 test asserting a Gemini failure's
  sanitized error contains no URL/query string/key.

### Cycle 2 — not counted as actionable

- **VALIDATION.md staleness (Claude L-N4).** The coverage matrix still lists "Plans 01–05/01–06" and
  omits Plan 07 / `secure-fetch.test.ts` / the M1 integration test. **Already tasked:** 14-06 Task 1
  is charged with updating the matrix to add Plan 07 + those tests, so this is incorporated, not an
  open action. (Cycle 3 should nonetheless confirm 14-06 explicitly names the plan-07 rows.)

---

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
