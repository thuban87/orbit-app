---
phase: 10
slug: share-sheet-capture
reviewers: [codex, claude-subagent, plan-checker]
cycle: 1
date: 2026-08-16
status: findings-open
---

# Phase 10 — Cross-AI Plan Review

Reviewers this cycle: **codex CLI** (v0.144.1) + a **read-only Claude subagent** (the headless
`claude -p` reviewer is broken in this environment — 0-byte output — so the second reviewer runs as
an Agent subagent per the established Phase 4/9 workaround). The internal **gsd-plan-checker**'s
warnings are folded in as a third source. All findings below are source-grounded (file:line verified).

---

## Consolidated Actionable Findings (for the `--reviews` replan)

Each finding names its severity, the target PLAN, the concrete change, and which reviewers raised it.
The planner MUST incorporate each into executable PLAN.md content (task / `<action>` /
`<acceptance_criteria>` / `must_haves`) or explicitly defer/reject it in the relevant PLAN.md.

### A1 — [HIGH] `captureMultiAttach` must return the inserted row ids  · plans 10-03, 10-05, 10-06 · (plan-checker + codex + claude — 3/3)
`addFuelCore` returns `Promise<number>` (lastInsertRowId, `src/db/fuel-dao.ts:129-150`); `editFuel`/`editFuelCore`
locate the row by `WHERE id = ? AND contact_id = ?` (`fuel-dao.ts:189-193`) and there is **no uid-based fuel
lookup** anywhere. But 10-03 types `captureMultiAttach(...): Promise<void>` (`10-03-PLAN.md:112-113,131`),
discarding the ids that 10-06's note-recompose needs (`10-06-PLAN.md:93-104`, must-have `:16-18`).
**Change:** 10-03 Task 2 — `captureMultiAttach` returns ordered `{ id, contactId }[]`, accumulated inside the
one `inWriteTransaction`; update its must_haves/artifacts/acceptance. 10-06 Task 2 — pair each returned id with
its `contactId` to apply the composed note text to all N rows.

### A2 — [MEDIUM] Single-tap path (10-05) must retain the returned rowid + contactId in screen state  · plan 10-05 · (claude)
`addFuel` returns `Promise<number>` (`fuel-dao.ts:240-245`) but `10-05-PLAN.md:106` discards it; 10-06's note-Done
needs that id (no uid fallback — see A1). **Change:** 10-05 Task 2 stores `writtenRows: {id, contactId}[]` (the
same state slice the multi-attach path fills) so the note affordance can `editFuel` the exact row(s).

### A3 — [HIGH] `package-lock.json` must be committed with the native installs  · plan 10-01 · (codex)
10-01 modifies `package.json` via two installs (`expo-share-intent@8.0.1`, `patch-package`) but does not list or
require the lockfile (`10-01-PLAN.md:65-76`). The desktop pipeline runs `npm ci` against the transferred lockfile
(`docs/runbooks/desktop-build-pipeline.md`), which fails on a stale lockfile before prebuild. **Change:** add
`package-lock.json` to 10-01 `files_modified` + Artifacts, and an acceptance criterion that it is regenerated and
committed alongside `package.json` (and the `patches/` dir + the postinstall `patch-package` wiring).

### A4 — [HIGH] Deterministic share-consumption owner on cold start  · plan 10-04 · (codex; claude judged it resolved — treat as ambiguous → make explicit)
`useShareIntent` consumes the native pending share singleton on mount (`platform-share-intent.md:153-165`); the
navigator only mounts after the migration `ready` gate (`App.tsx:111-126`). If `ShareIntentProvider` wraps the whole
app and consumes the pending share before the ready-gated linker reads it (`10-04-PLAN.md:89-90`), the primary
cold-start flow can be lost. The two reviewers disagreed on whether 10-04 already resolves this — which itself means
the plan is under-specified. **Change:** 10-04 specifies ONE deterministic owner/order for the pending share (e.g.
the provider's `useShareIntent` state drives navigation via a ready-gated router, OR the linking config owns it —
not both racing), and adds an explicit **cold-start ordering** UAT assertion (share delivered while app was killed
→ lands on Capture), distinct from the warm/route-arrival assertion.

### A5 — [MEDIUM] Make `resolveCapturePayload` composition precise & consistent for ALL payload types × note  · plan 10-02 · (codex — resolve toward owner intent)
The locked owner decision is "**note leads, base appended — both survive**" (CONTEXT #2; the owner chose this over
"note replaces"). Codex read the CONTEXT "note-only → note" wording as "note + no EXTRA_SUBJECT title → note alone",
which would **discard** the shared prose/URL of a plain-text or bare-URL share — the opposite of the owner's
"both survive" intent. **Change (preserve content — do NOT drop the shared base):** define the resolver explicitly for
all four payload cases × {note, no-note}: note ALWAYS leads; the display base (EXTRA_SUBJECT title │ shared prose │
bare URL) is appended after `" — "` and is **never discarded**; `url` stays canonical/separate in every case.
Reconcile so "note-only" means "no base present". Add node tests for **note + plain-text** and **note + bare-URL**
(the two cases the current tests miss). This implements the owner's locked intent precisely; it is NOT a reversal.

### A6 — [MEDIUM] Multi-select Android Back needs an implementation mechanism  · plan 10-06 · (codex)
10-06 requires the first Back/Close to exit multi-select without writing (`10-06-PLAN.md:71-82`) but specifies no
handler; native-stack Back will pop/finish instead. The app's idiom is a focused `BackHandler` via `useFocusEffect`
(`src/screens/ComposeScreen.tsx:196-205`). **Change:** 10-06 adds a `useFocusEffect` hardware-back handler + one shared
close handler: first Back exits multi-select; otherwise reset the share intent and call `finishActivity()`.

### A7 — [MEDIUM] Inline create must reject an empty name  · plan 10-06 · (codex)
`10-06-PLAN.md:116-117` submits `name.trim()` directly; `contacts.name` is `TEXT NOT NULL` which accepts `""`
(`migrations/001-initial.ts`), while the established create form blocks blank names (`create-contact-logic.ts:54-60`).
**Change:** disable submit for `trimmedName.length === 0` and guard before `createContactFull`.

### A8 — [LOW] Multi-attach note application should be atomic  · plan 10-06 · (codex + claude)
`10-06-PLAN.md:94` offers a loop of `editFuel` wrappers (N transactions) OR one `inWriteTransaction`. The loop can
leave some rows noted on a mid-loop failure. **Change:** prefer the single-transaction `editFuelCore × N` form for the
multi-attach note (keep single-row on `editFuel`).

### A9 — [LOW] Add an automated exactly-once guard for the share-intent plugin tuple  · plan 10-01 · (claude)
10-01 correctly instructs filtering the bare `"expo-share-intent"` string before appending the tuple
(`10-01-PLAN.md:94`, mirroring the `expo-image-picker` filter at `app.config.ts:74`), but the verify only `grep -q`s
(`:97`) — a missed filter surfaces only as a prebuild error at UAT. **Change:** add an automated node-eval assertion
that the evaluated plugin list contains `expo-share-intent` exactly once.

### A10 — [LOW] Tidy-ups  · plans 10-02/10-03/10-05/10-06 · (codex + claude)
- Single `const stamp = localDateTime()` per fuel write (not independent calls for created_at/now).
- Align each task's "full suite green" acceptance wording with the actual command it runs (several run only the new targeted test).
- One-line cross-reference between 10-03 and 10-04 tying the two halves of the F-CAP-10 cold-start decision together.
- Phase-level note: end-of-phase **Pixel UAT via the desktop-build pipeline is a gate, not optional** — the `autonomous:true` flag covers only tsc/biome/check:colors/grep, never the native/on-device behaviors.

### D1 — [DOC] Reconcile 10-VALIDATION.md to the produced plans  · (plan-checker W2 — orchestrator handles post-replan)
Per-task map still has the `_planner fills_` placeholder and `nyquist_compliant: false`. The Nyquist *substance*
passes (every task has an `<automated>` verify or is a Wave-0 node-test). Orchestrator reconciles the map + flips the
flag after the plans settle.

---

## No invariant violations found

Both external reviewers confirmed the invariant-critical data-layer plans are sound: **capture never writes a
touchpoint** (no `recency-dao`/interaction write; `recency-dao.ts` stays the single `last_contact` writer),
**multi-attach is one transaction over non-mutexed cores** (no mutex nesting), the **picker scope is correct**
(`archived_at IS NULL` only, includes never-contacted, MRU from existing fuel columns), and **no migration/column/
index is added**. Residual real-world risk (native dep behavior, cold-start latency, Android 15/16 finish/intent
hardening) is correctly pushed to physical-Pixel UAT.

---

## Full reviewer outputs

### Reviewer: codex (risk: HIGH)
- HIGH package-lock.json omitted (→ A3); HIGH multi-attach discards ids (→ A1); HIGH provider placement cold-start race (→ A4); HIGH note composition vs no-title rule (→ A5, resolved toward owner intent); MEDIUM multi-select Back handler (→ A6); MEDIUM empty-name inline create (→ A7); suggestions → A8/A10.

### Reviewer: claude-subagent (risk: LOW–MEDIUM)
- HIGH `captureMultiAttach` return ids confirmed (→ A1); MEDIUM 10-05 retain rowid (→ A2); LOW atomic multi-note (→ A8); LOW app.config exactly-once guard (→ A9); suggestions → A10. Explicitly confirmed no HIGH invariant violated.

### Reviewer: plan-checker (internal, VERIFICATION PASSED w/ 2 warnings)
- W1 `captureMultiAttach` return-id contract (→ A1). W2 VALIDATION.md reconciliation (→ D1).
