# Phase 14: AI Message Suggestions — Plan Reviews

## Convergence status — Cycle 3 complete (MAX CYCLES), NOT converged — REVIEWERS SPLIT, owner escalation

Cycle 3 reviewed the corrected 7-plan set (commit `a4da2bd`) with the same two reviewers. **They
split:**

- **Claude verdict:** APPROVE — HIGH 0, MEDIUM 0, LOW 2 (both non-blocking: optional IPv6
  NAT64/6to4/Teredo hardening; a `note`/`detail` label fix). Confirmed all 10 Cycle-2 findings
  resolved and the wave map internally consistent.
- **Codex verdict:** REQUEST_CHANGES — HIGH 4, MEDIUM 6, LOW 2. Also confirmed all 10 Cycle-2
  findings genuinely resolved and the wave map consistent, but surfaced deeper NEW issues Claude
  missed — including several that are direct consequences of the Cycle-3 edits.

**The orchestrator independently re-verified Codex's load-bearing claims against source** (per
CLAUDE.md): the ack single-writer contradiction (`AppSettingsPatch = Partial<AppSettings>` +
generic column loop, app-settings-dao.ts:60), `getImpactInputs` reading `contacts.interval_days`/
`rarely_responds` (impact-read.ts:62), `detail` being an `events` column not `interactions`
(001-initial.ts:122 vs 107), and `NewFieldDef` requiring `uid`/`col_name`/`display_order`/`now`
(field-types.ts) all check out. The OkHttp semantics behind C3-H1/H2 (custom `Dns` is not consulted
for numeric-IP literals; a system HTTP/SOCKS proxy bypasses the origin-pin) are established OkHttp
behavior. **Codex's findings are real, not over-reach.**

**CYCLE_SUMMARY: current_high=4 current_actionable=8** (union of distinct concerns; Claude's 2 LOWs
are subsumed by Codex C3-H1/C3-M3). This is Cycle 3 = `--max-cycles 3`, so the workflow's replan
loop stops here and hands the decision to the owner. Note: the raw unresolved count rose 10 → 12,
but this is healthy churn — every Cycle-2 item was resolved; these 12 are entirely new, deeper
findings (transport semantics, plan-vs-plan contradictions), several introduced by the Cycle-3
fixes themselves. None reverse or weaken a recorded decision; the security-relevant HIGHs
STRENGTHEN the owner's airtight H3 mandate.

### Cycle 3 — distinct HIGH concerns (all Codex; orchestrator-verified)

- **C3-H1 — native egress predicate is still an incomplete deny-list AND has an OkHttp IP-literal
  bypass.** 14-07 Task 1. Two parts: (a) the enumerated `isNonPublic` list still omits
  not-globally-reachable ranges (IPv4 `0.0.0.0/8`, benchmarking `198.18.0.0/15`, documentation
  nets, reserved; IPv6 NAT64 `64:ff9b::/96`, and — if strict — 6to4/Teredo). (b) **More critical:**
  a custom `okhttp3.Dns` is only consulted for *hostname* resolution — for a numeric-IP-literal URL
  OkHttp builds the route WITHOUT calling `Dns`, so a CGNAT/ULA/IPv4-mapped **literal** URL bypasses
  the native predicate entirely and is caught only by Plan 01's URL-literal validator, which does
  NOT cover CGNAT/ULA/mapped literals. **Fix:** base the predicate on the IANA special-purpose
  registries as an `isGloballyReachable` allowlist; validate the numeric `HttpUrl.host` natively
  before creating the `Call` (independent of the DNS hook); unwrap `::ffff/96`; extend Plan 01's
  literal validator to the same full set; add Kotlin behavioral tests + IP-literal device fixtures
  (grep gates are insufficient for this control).

- **C3-H2 — system-proxy bypass of the origin-pin.** 14-07 Task 1. The custom `Dns` does not
  guarantee origin resolution when an Android system proxy is configured: for an HTTP proxy OkHttp
  connects to the proxy and the proxy resolves the origin; SOCKS may receive the origin unresolved —
  either way defeating "resolve once, pin the vetted origin IP." **Fix:** force the security client
  to `Proxy.NO_PROXY` (or a proxy-aware strict origin validator); add a device test with an
  HTTP/SOCKS proxy configured proving the origin cannot bypass validation.

- **C3-H3 — ack single-writer invariant is unenforceable + no re-ack on Custom-endpoint change.**
  14-01 vs 14-05. (a) Plan 01 folds the four ack columns into the generic `AppSettingsPatch`/
  `COLUMN_OF`/validation, so any ordinary `updateSettings({aiAckCustom:1})` could set an ack —
  defeating Plan 05's "acknowledgeProvider is the SOLE ack writer" gate (a privacy control). (b) A
  Custom-endpoint change does not reset `ai_ack_custom`, so a *different* recipient inherits the old
  endpoint's acknowledgement and receives the prompt with no fresh consent. **Fix:** exclude ack
  fields from the generic patch/column loop; make `acknowledgeProvider` the only path that sets them
  to 1; atomically reset `ai_ack_custom=0` whenever the canonical Custom endpoint changes; test
  single-writer enforcement + endpoint-change re-acknowledgement.

- **C3-H4 — stale-request egress after the ack await (regression from the C2-H3 fix).** 14-05. The
  C2-H3 fix moved controller creation to AFTER `await acknowledgeProvider`, but nothing rechecks
  request freshness once the await resolves — and no controller exists during the ack write, so
  Cancel/unmount/navigation/provider-model/contact change during that window cannot abort it; a
  naive `await ack(); startRequest()` then sends anyway. **Fix:** snapshot a request-generation
  token + immutable provider/model/prompt before awaiting; after the ack resolves, recheck the token
  is current, Compose is focused/mounted, and config is unchanged before creating the controller/
  calling generate; add deferred-ack tests for cancel, unmount/navigation, and provider/model/
  contact change.

### Cycle 3 — actionable non-HIGH concerns (Codex)

- **C3-M1 — `generate(input)` contract vs ResolvedPrompt reference-identity contradiction.** 14-02
  defines `generate(input)` with `prompt: string`; 14-05/M1 require the SAME `ResolvedPrompt` object
  to reach `AiService.generate` and be compared by reference — and Plan 02 does not depend on Plan
  03's type. **Fix:** make Plan 02 depend on 14-03 and carry `resolvedPrompt: ResolvedPrompt`
  (adapters read `.payload`), OR weaken the M1 identity claim to string-byte-equality at the adapter
  boundary and test that.
- **C3-M2 — key-read-timing contradiction.** 14-02 behavior says read the key immediately before
  every call; the action says `refreshProviders` reads keys from the store (the existing code caches
  key strings in provider instances). **Fix:** inject a provider-scoped key accessor called inside
  `generate`/networked `listModels`; never retain keys during `refreshProviders`.
- **C3-M3 — two false source claims in 14-03.** (a) `getImpactInputs` necessarily reads
  `contacts.interval_days`/`rarely_responds`, contradicting "reads NOTHING else off a contact"
  (they are internal derivation inputs, not serialized). (b) `detail` is an `events` column, not
  `interactions` — the "interaction carrying note/detail" fixture can't be built as written. **Fix:**
  distinguish internal derivation inputs (permit, prohibit serialization) from `PromptContext`-
  exposed fields; seed `interactions.note` and `events.detail` separately and prove neither reaches
  the prompt.
- **C3-M4 — JS abort listener never removed on settlement (regression from the C2-M1 fix).** 14-07
  Task 2 adds an abort listener but doesn't remove it on settle, so a late abort calls native
  `cancel` for an already-settled request and creates an orphan tombstone no request clears. **Fix:**
  remove the listener in `finally`; consume the native promise after abort without an unhandled
  rejection; test that aborting after success/failure issues no `cancel`.
- **C3-M5 — empty Custom endpoint fails the save-time validator.** The migration seeds
  `ai_custom_endpoint DEFAULT ''`, but the DAO validates every endpoint patch with a validator that
  only accepts complete HTTPS URLs — so clearing an endpoint, or persisting a whole non-Custom form
  containing `""`, fails. **Fix:** treat empty as the valid "unconfigured" value; validate only
  non-empty; require a non-empty valid endpoint only when Custom is selected/invoked; add
  clear-and-switch-provider tests.
- **C3-M6 — 14-AI-SPEC.md is stale and NO plan owns its regeneration.** AI-SPEC §3–6 still prescribes
  raw Custom `fetch` + `redirect: "error"`, adapters sending through `fetch`, first-send inspection
  at Settings, no native transport, and forbids any settings write on generation — all contradicted
  by the owner-directed native module and Plan 05's ack carve-out. Unlike VALIDATION.md (owned by
  Plan 06), nothing regenerates AI-SPEC. **Fix:** update AI-SPEC §3–6 (native Custom transport +
  address/proxy tests, Compose-owned ack, the one pre-egress ack write), or assign that regeneration
  to a plan.
- **C3-L1 — `toNewFieldDefPayload(draft)` can't build a real `NewFieldDef`** (needs `uid`/`col_name`/
  `display_order`/`now`) — regression from the C2-M4 helper extraction. **Fix:** helper returns only
  draft-derived fields; the component adds create-only metadata.
- **C3-L2 — Plan 07 records its compile gate in VALIDATION.md but doesn't own that file** (Plan 06
  does) — regression from the C2-M2 edit. **Fix:** record in 14-07-SUMMARY.md and have Plan 06
  transfer the evidence, or add VALIDATION.md to Plan 07's ownership.

### Cycle 3 — owner escalation (max cycles reached)

`--max-cycles 3` is reached and the plan set is NOT converged (4 HIGH + 8 actionable, all verified
real, all planner-bucket, none reversing a recorded decision). The convergence loop's replan stops
here per the gate. **Awaiting owner decision:** run a 4th replan+review cycle (recommended — the
findings are concrete and several are self-inflicted by the Cycle-3 edits, so one pass would very
likely clear them), accept-and-proceed, or stop for manual review. Execution remains owner-gated
regardless.

---

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
