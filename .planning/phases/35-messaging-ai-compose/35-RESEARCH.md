# Phase 35: Messaging & AI Compose — Research

**Researched:** 2026-09-13
**Domain:** Refactor/integration of the existing Compose surface (React Native / Expo, on-device SQLite) into an AI-assisted drafting workspace with external delivery handoff.
**Confidence:** HIGH for existing-plumbing map (every claim opened on disk this session); MEDIUM for the two forward seams (three-state AI availability source, ADR-078 egress-construction ownership) which are genuine plan-time escalation points.

> **This is a REFACTOR phase, not greenfield.** The single most valuable output below is the verified map of existing plumbing and the exact seams + hard trip-wires the planner must respect. Provenance is marked `[VERIFIED: path:line]` (opened this session) vs `[INFERRED]`.

---

## User Constraints (from CONTEXT.md D-01..D-11 + dossier + planning-notes)

These are LOCKED. The dossier (`docs/dossier/milestone-2/phase-14-messaging-ai-compose-dossier.md`, 2026-09-01 amendment overrides older text) is ground truth; the planning-notes file is a binding appendix; ADR-070/071/078/079 are authoritative. Copied verbatim intent:

### Locked Decisions
- **D-01/D-02:** Dossier + planning-notes are binding. `[DECIDED]`/`[REJECTED]` items and any Accepted-ADR/HANDOFF reversal are **owner** decisions — stop and ask, never "fix."
- **D-03:** Ships SQLite schema — **no new entity tables**, only new `app_settings` columns (Compose default message mode + remembered value), added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage. **Verify head+1 on disk** (done below: next migration = **028**). The backup format bump is Phase 36's job, not here.
- **D-04 (ESCALATE trip-wire):** The Compose-attached "Did you send it?" must **coexist with** ADR-070/071's durable assist lifecycle — it is an *additional* surface. The app-global `AssistBanner` + `PendingConfirmationsSheet` **must stay**; removing the banner, removing the dismissal path, or stamping the write at confirmation time **reverses ADR-070/071 → stop and ask.**
- **D-05:** "Not yet" ≠ "Don't log." The write stays `markAssistLogged` stamped at `handoff_at`, never at confirmation time. Only explicit confirmation creates the canonical Message interaction. Transmit never claims delivery.
- **D-06:** `markAssistLogged` must **translate** transport → vocabulary (text/email→Message, call→Call), not copy. Ships **with** the Tone/channel migration owned by Phase 32/34. **(Already implemented — see Trip-Wire 2.)**
- **D-07:** AI availability is **three-state** (Off / On+Ready / On+Needs-Attention). Phase 35 **consumes** the state from Phase 36; it computes none of it.
- **D-08:** AI context may include an interaction note **only** where that interaction's Allow-AI flag is ON; `off_limits` excluded in SQL today; **Group Notes never AI-eligible**. ADR-078 is the superseding decision for off-limits — confirm before touching `fuel-read.ts` exclusions; **treat any further egress widening as an owner decision.**
- **D-09:** ADR-079 governs AI entry: Message → Draft/Rewrite with AI (Profile AI-draft entry removed by Phase 31); no auto-write on open; exactly three unlabeled varied suggestions on a non-destructive review surface; editor untouched until "Choose this"; Try Again replaces the set; no generation-history stack.
- **D-10:** Compose session state survives in-app nav + backgrounding, **not** relaunch — no drafts table, no backup contract. Message Focus capped at three, session-only; Add to AI grants no permission.
- **D-11:** ADR-035/036 stale text ("Send/Copy never write to SQLite") is already superseded in practice by ADR-072's assist row — **flag the overdue superseding note; do NOT "fix" it by removing the assist write.**

### Claude's Discretion
Everything the dossier marks `[DERIVED]`, plus implementation details not touching a `[DECIDED]` item, an ADR, or a HANDOFF entry.

### Deferred Ideas (OUT OF SCOPE — Phase 36 or later)
In-app messaging/inbox/threads/transport/receipts; third-party Messenger/WhatsApp/Signal/Instagram; durable per-contact drafts with backup/sync; per-generation full-context authorization screens; AI-generated suggestion labels; AI-generation history stack; freeform "Adjust"/prompt personalization; provider/model/API-key management; exact provider-specific prompt payloads; exact Text-vs-Email AI treatment; advanced Message Focus weighting; Random Thought.

---

## Phase Requirements

| ID | Description | Research Support (where the plumbing lives) |
|----|-------------|---------------------------------------------|
| COMP-01 | Compose opens blank, no auto-insert | Editor is already a blank `useState("")` `TextInput` [VERIFIED: ComposeScreen.tsx:143,894-914]; AI never auto-writes except the retired profile intent (D-09 removes it) |
| COMP-02 | Text/Email mode from Settings default (Text/Email/Remember), ad-hoc switch, remembered on Transmit/Copy | NEW `app_settings` columns (migration 028) + mode state; pattern = migration 027 (see §Compose Preference Schema) |
| COMP-03 | Primary phone/email resolution, establish missing primary, mode fallback, drafting/Copy usable when neither | `selectActionablePrimaryMethods` resolves both [VERIFIED: contact-methods-read.ts:10-19]; set-primary writer exists [VERIFIED: contact-methods-dao.ts:180-192]; `resolveComposeControls` is the pure gate to extend [VERIFIED: compose-logic.ts:71-116] |
| COMP-04 | Email Subject+Body, Transmit preserves both, Copy=body, Subject own copy | Email handoff currently bare `mailto:` [VERIFIED: handoff.ts:63-65] — must add subject+body (see §External Handoff) |
| COMP-05 | Transmit hands off, never claims delivery; "Did you send it?"; Yes logs, Not yet preserves session, Copy never triggers | `performReachOut` is the handoff+assist seam [VERIFIED: handoff.ts:39-73]; confirmation must be additive to the assist lifecycle (Trip-Wire 1) |
| COMP-06 | Confirmation coexists with ADR-070/071 (banner + sheet stay, dismissal path, stamp at handoff) | Trip-Wire 1; `AssistBanner` mounted app-wide [VERIFIED: App.tsx:393] |
| COMP-07 | Session state survives nav+backgrounding, not relaunch; no drafts table/backup | Zustand store pattern (e.g. `assist-store`); current draft is local `useState` lost on unmount [VERIFIED: ComposeScreen.tsx:143] |
| COMP-08 | Things to Remember Research: sibling read-only projection, only populated conv-relevant groups, no add/edit | Reuse Contact Knowledge read modules (first-class-knowledge-read, memories-read, profile-knowledge-read); `ThingsToRememberScreen` is the FULL editor — do NOT reuse its edit UI [VERIFIED: ThingsToRememberScreen.tsx:1-60] |
| COMP-09 | Three AI states; manual+Research work in every state | Currently binary `aiProvider !== 'none'` [VERIFIED: ComposeScreen.tsx:318]; three-state source is Phase 36 (Open Question 1) |
| COMP-10 | Preauthorized knowledge only; Off Limits Avoid presentation, avoidance-constraint when authorized, never Message Focus | ADR-078; `ai-context-read.ts` is the SOLE egress projection [VERIFIED: ai-context-read.ts:1-27,221-302]; off_limits excluded in SQL [VERIFIED: fuel-read.ts:133-135] |
| COMP-11 | ≤3 AI-authorized items Add to AI/Added ✓, session-only Message Focus, no permission grant | AI-eligibility = `allow_ai = 1 AND deleted_at IS NULL` [VERIFIED: memories-read.ts:31]; new session state |
| COMP-12 | Adaptive Draft/Rewrite; three unlabeled varied suggestions; non-destructive review; Choose this; Try Again | Reshape `AiSuggestionLifecycle` (currently single-suggestion) [VERIFIED: ai-suggestion-logic.ts:77-99,300-324] |
| COMP-13 | Cancellable, failure-safe, no provider-troubleshooting | Lifecycle already owns sole AbortController+timeout+stale-guard [VERIFIED: ai-suggestion-logic.ts:5-52]; error→short line [VERIFIED: ComposeScreen.tsx:488-506] |
| COMP-14 | Deep-link-ready, origin-aware return, no finished draft in Back history | Compose route `{contactId, requestAiSuggestion?}` [VERIFIED: navigation/types.ts:102,171]; current Back always resets to dashboard [VERIFIED: ComposeScreen.tsx:266-272] — must become origin-aware |

---

## Summary

The Compose surface exists (`src/screens/ComposeScreen.tsx`, 1202 lines) but its shape is the *old* product: **fuel-first** (conversational-fuel cards rendered ABOVE the editor, [VERIFIED: ComposeScreen.tsx:832-879]), **text-only** (hardcoded `channel: "text"`, [VERIFIED: :456]; no Email mode, no Subject), **single-suggestion AI** behind an ADR-052 exact-prompt acknowledgement gate ([VERIFIED: ComposeScreen.tsx:568-648] `needs-acknowledgement` state), and it **hand-rolls `Pressable`/`Text`/raw `fontSize`/`fontWeight`** and uses `colors.accent` for text where `accentText` belongs ([VERIFIED: :529,933,944,970; styles :1010-1202]). Session state is local `useState` lost on unmount; Back always resets to the dashboard root ([VERIFIED: :266-272]).

The good news for the planner: the **hard data-layer trip-wires are already satisfied on disk.** The D-06 channel translation is implemented (`markAssistLogged` → `remapLegacyChannel`, [VERIFIED: interaction-assist-dao.ts:112]); the interactions channel vocabulary already migrated to `Message/Call/In Person` (migration 025, [VERIFIED: 025-interaction-history-schema.ts:59-64]); the `interactions.allow_ai` gate column already exists (migration 025, [VERIFIED: grep line 48]); the durable assist lifecycle + app-global banner + launch sweep are wired ([VERIFIED: App.tsx:393]); `off_limits` is excluded from the ranked/AI projection in SQL ([VERIFIED: fuel-read.ts:133-135]). The AI lifecycle (`ai-suggestion-logic.ts`) is a well-architected node-pure, injected, stale-guarded owner of the sole AbortController+timeout — its machinery is reusable; only its *shape* (single→three suggestions, drop the ack gate per ADR-079) must change.

**Primary recommendation:** Treat this as a Compose UX/refactor + AI-lifecycle-reshape phase over intact data plumbing. Ship exactly one migration (028, additive `app_settings` columns modeled on migration 027). Reuse `performReachOut`/`markAssistLogged`/`selectActionablePrimaryMethods`/the Contact-Knowledge read modules/the `AiSuggestionLifecycle` abort+stale machinery. Rebuild the Compose UI in `AppText`+`Button` roles. Surface the two forward seams (Open Questions 1 & 2) to the owner BEFORE planning the AI-egress and AI-availability tasks — both risk reversing an ADR or widening egress if guessed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Message composition / editing | Client (RN screen + session store) | — | Draft is session-only UI state, never persisted (D-10) |
| Text/Email mode + remembered default | Database (`app_settings`) | Client (mode session state) | Durable preference is `app_settings`, portable via backup (D-03) |
| Primary destination resolution | Database (contact-methods DAO) | Client (picker for missing primary) | Canonical contact-method model; Compose consumes, never invents (dossier §D) |
| External handoff (SMS/email) | OS/external app (via Expo/Linking) | Client (marshalling) | Orbit hands off, never delivers (dossier §F) |
| Durable assist lifecycle + confirmation write | Database (`interaction_assists` + recency writer) | App shell (banner/sheet) | Single-writer recency invariant; app-global surface (ADR-070/071) |
| AI generation (three suggestions) | External AI provider (user-configured) | Client (lifecycle owns abort/timeout/review) | Only egress path; AI optional (dossier §L/§T) |
| AI-eligible context projection | Database (`ai-context-read.ts` closed projection) | — | Sole data-minimization boundary (ADR-078) |
| Things to Remember Research | Database (knowledge read modules) | Client (read-only projection) | Compact projection of Contact Knowledge, no editing (dossier §K) |
| AI availability state | Phase 36 (owner of the 3-state model) | Client (consumes) | Phase 35 consumes, computes none (D-07) |

---

## HARD TRIP-WIRES (planner must not miss — each is a stop-and-ask if crossed)

### Trip-Wire 1 — ADR-070/071 assist-lifecycle coexistence (D-04, D-05) — ESCALATE
The new Compose-attached "Did you send it?" panel is **additive**, not a replacement.
- The durable assist row is written **before** the OS handoff, stamped `handoff_at = now`, via `performReachOut` → `createPendingAssist` [VERIFIED: handoff.ts:50-57; interaction-assist-dao.ts:27-67]. Cap 5 newest pending; status `pending→logged|dismissed|expired|failed`.
- The confirmation write is `markAssistLogged`, which inserts ONE outbound interaction stamped at `transactionAssist.handoff_at` (NOT `now`) through the sole recency writer `insertInteractionCore` + `recomputeLastContactCore` [VERIFIED: interaction-assist-dao.ts:99-118].
- The app-global `AssistBanner` + `PendingConfirmationsSheet` are mounted app-wide [VERIFIED: App.tsx:393; AssistBanner.tsx:26-99] and MUST remain for assists whose Compose session is gone (process death / 24h window).
- `markAssistDismissed` is the "Don't log" path [VERIFIED: interaction-assist-dao.ts:141-153]; "Not yet" must keep a dismissal path or rows linger until expiry.
- **ESCALATE if a plan:** removes the app-global banner, removes the dismissal path, or stamps the write at confirmation time. Any of these reverses ADR-070/071.

### Trip-Wire 2 — D-06 channel translation is ALREADY DONE (do not re-plan or "fix")
`markAssistLogged` already routes the assist transport channel through `remapLegacyChannel` (text/email→Message, call→Call) [VERIFIED: interaction-assist-dao.ts:112; interaction-vocabulary.ts:44-49,72-77]. The `interaction_assists.channel` CHECK stays `('call','text','email')` [VERIFIED: 014-interaction-assists.ts:12] and is **not** rebuilt. The interactions vocabulary already migrated (migration 025 [VERIFIED: 025-interaction-history-schema.ts:59-64]). **The planner should verify this remains true and add no new translation work** — the fix landed in Phase 32 (T-32-03, referenced in the code comment [VERIFIED: interaction-assist-dao.ts:106-111]). Phase 35's confirmed Transmit reuses `markAssistLogged` unchanged and thereby writes `Message`.

### Trip-Wire 3 — ADR-078 AI egress (D-08) — confirm scope with owner before widening
`ai-context-read.ts` is the SOLE outbound projection [VERIFIED: ai-context-read.ts:1-27]. Today it:
- reads only `channel, quality, connected` from interactions — the free-text note is NOT selected [VERIFIED: :108-122];
- gets fuel only through `getRankedFuel`, which excludes `off_limits`/unconfirmed-AI/blank IN SQL [VERIFIED: fuel-read.ts:133-141; ai-context-read.ts:243-245];
- gets memories only through `listAiEligibleMemories` (`allow_ai = 1 AND deleted_at IS NULL`) [VERIFIED: memories-read.ts:31; ai-context-read.ts:196];
- gets custom fields only where `share_with_ai = 1` [VERIFIED: ai-context-read.ts:160-186].

ADR-078 (Accepted, supersedes ADR-050/036 partially) WIDENS this to: off-limits AI-enabled items as **negative avoidance constraints**; the **3 most-recent-interaction projection** with a note included **only when that interaction's `allow_ai` is ON** (column already exists, migration 025); **Group Notes never sent**; Off Limits visible on Research as an "Avoid" group, never Message Focus [CITED: ADR-078 lines 18, 50-56]. **None of the egress widening (off-limits constraints, gated recent-interaction notes) is built yet.** See Open Question 2 for the ownership seam (Phase 35 vs Phase 36) — do NOT silently widen egress; D-08 says any further widening is an owner decision.

### Trip-Wire 4 — ADR-079 removes the exact-prompt ack gate + Profile AI entry (D-09)
The current `needs-acknowledgement` exact-prompt gate [VERIFIED: ai-suggestion-logic.ts:82-90,242-274; ComposeScreen.tsx:568-648] is ADR-052's mechanism. ADR-079 (supersedes ADR-052 partial) replaces it with a lightweight first-setup disclosure (Phase 36 owns setup) + on-demand per-generation review ("Sharing N items with AI about <contact>") [CITED: ADR-079 line 18]. The `ai_ack_*` columns (migration 004) become **unused** — removal is a plan-phase choice, not required [CITED: ADR-079 line 53]. **Risk flagged by the ADR itself:** a partially-removed ack path could gate generation on a value nothing sets [CITED: ADR-079 line 44] — reshape the lifecycle cleanly, don't leave a half-wired gate. Profile AI-draft entry: Phase 31 already removed it (ContactProfileScreen references none of `requestAiSuggestion`/`Draft with AI` [VERIFIED: grep returned nothing]); the `requestAiSuggestion` route param + `ai-suggestion-navigation.ts` consume-once intent are leftover plumbing to retire [VERIFIED: navigation/types.ts:96-102,171; ai-suggestion-navigation.ts:28-31].

### Trip-Wire 5 — ADR-035/036 stale text (D-11) — flag, do not "fix"
ADR-035/036 still say Send/Copy "never write to SQLite," already superseded in practice by ADR-072's assist row. **Flag an overdue superseding note; do NOT remove the assist write to reconcile the discrepancy.**

---

## Standard Stack (existing — reuse, do not add)

### Core seams to reuse
| Module | Purpose | Reuse contract |
|--------|---------|----------------|
| `src/services/reach-out/handoff.ts` `performReachOut` | Create pending assist + hand off to OS (SMS/tel/mailto) | Reuse for Transmit; **extend email arm** to carry subject+body [VERIFIED: handoff.ts:39-73] |
| `src/db/interaction-assist-dao.ts` | `createPendingAssist` / `markAssistLogged` / `markAssistDismissed` / `markAssistFailed` | Reuse unchanged; confirmation = `markAssistLogged` [VERIFIED: interaction-assist-dao.ts:26-173] |
| `src/db/contact-methods-read.ts` `selectActionablePrimaryMethods` | Resolve primary phone AND email | Consume for both modes [VERIFIED: :10-19,41-48] |
| `src/db/contact-methods-dao.ts` | Set/clear `is_primary` per type | Reuse for "establish missing primary" [VERIFIED: :180-192] |
| `src/logic/compose-logic.ts` `resolveComposeControls` | Pure Send/Copy capability gate | Extend to Text/Email + no-destination Transmit-unavailable state [VERIFIED: :71-116] |
| `src/logic/ai-suggestion-logic.ts` `AiSuggestionLifecycle` | Sole AbortController + 20s timeout + stale-guard | Reuse machinery; reshape state union single→three, drop ack gate [VERIFIED: :151-388] |
| `src/db/ai-context-read.ts` `readPromptContext` | Sole closed egress projection | Extend ONLY per ADR-078 scope decision (Open Q2) [VERIFIED: :221-302] |
| `src/db/first-class-knowledge-read.ts`, `memories-read.ts`, `profile-knowledge-read.ts`, `current-state-history-read.ts` | Contact Knowledge reads | Compose Research read-only projection [VERIFIED: ThingsToRememberScreen.tsx imports :24-58] |
| `src/db/app-settings-dao.ts` `getAppSettings` | Settings read/write | Add compose-mode getters/setters [VERIFIED: ComposeScreen.tsx:296,451] |

### UI primitives to use (correct the refactor debt)
| Primitive | Location | Use |
|-----------|----------|-----|
| `AppText role="…"` | `src/components/ui/AppText.tsx` | ALL text — never raw `<Text fontSize=…>` [VERIFIED: ls src/components/ui/] |
| `Button` (roles in `button-roles.ts`, `MIN_TOUCH_TARGET`) | `src/components/ui/button-roles.ts`, `Button.tsx` | ALL buttons; `accent` fill only for the single primary per surface, `accentText`/tertiary for link-tone actions [VERIFIED: ls; UI-SPEC citations] |
| `GlassSurface`, `Sheet`, `Modal`, `ConfirmDialog`, `ChromeScrim` | `src/components/ui/` | Cards, review surface, destination picker, unsaved-draft dialog [VERIFIED: ls src/components/ui/] |
| `useTheme().colors[token]` | `src/theme` | Every colour; `npm run check:colors` enforces, incl. Skia |

### Handoff platform APIs — what's installed
| Package | Installed? | Note |
|---------|-----------|------|
| `expo-sms` `~57.0.1` | ✓ | `SMS.sendSMSAsync(addr, body)` (used today) + `SMS.isAvailableAsync()` [VERIFIED: package.json:29; ComposeScreen.tsx:41,380] |
| `expo-clipboard` `~57.0.1` | ✓ | Copy [VERIFIED: package.json:16] |
| `expo-linking` | ✗ NOT installed | Email uses RN built-in `Linking.openURL('mailto:…')` [VERIFIED: handoff.ts:2,63-65] |
| `expo-mail-composer` | ✗ NOT installed | Optional richer email composer (recipient+subject+body); see §External Handoff and Package Legitimacy Audit |

---

## Package Legitimacy Audit

Phase 35 ships **no new entity tables** and, on the recommended path, **no new npm packages** (email subject+body is achievable with the built-in `Linking` + a `mailto:` query string, no dependency). One OPTIONAL package is worth an owner decision:

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| `expo-mail-composer` | npm (Expo SDK) | `[ASSUMED]` — official Expo SDK module, but **not verified via registry this session** (no network tool run) | OPTIONAL. If chosen, planner must (a) pin to the Expo SDK 57 line to match the installed `expo-*` `~57.0.1`, (b) gate the install behind a `checkpoint:human-verify` task, (c) run `npx expo install expo-mail-composer` (not raw `npm install`) so Expo resolves the SDK-compatible version. Requires a dev-client rebuild (not Expo Go). |

**Recommendation:** default to the **no-dependency** `mailto:?subject=…&body=…` path (see §External Handoff) unless the owner wants the richer composer. `mailto` with a body is universally supported and keeps the local-first/no-new-native-surface posture. `expo-mail-composer` buys a slightly cleaner UX and a `MailComposerResult` status — but on Android that status is frequently `undetermined`, so it does **not** remove the need for the honest "Did you send it?" prompt.

---

## Architecture Patterns

### System data flow (Compose → handoff → confirmation → log)
```
                    ┌─────────────────────── Compose focused workflow (one screen, two sides) ───────────────────────┐
 route {contactId,  │                                                                                                │
  origin?} ───────► │  COMPOSE SIDE                                    RESEARCH SIDE (sibling, read-only)            │
                    │  ┌──────────────┐  mode(Text/Email)              ┌───────────────────────────────┐            │
 app_settings ────► │  │ editor(blank)│◄─ from default pref            │ compact projection of Contact  │            │
  default mode      │  │ +subject(Em) │   remembered on Copy/Transmit  │ Knowledge (populated groups)   │            │
                    │  └──────┬───────┘                                │  Avoid group (off_limits)      │            │
 contact_methods ─► │  destination resolve (primary phone/email;       │  Add to AI / Added ✓ (≤3)      │            │
  (primary)         │   picker to establish missing primary)           └───────────────┬───────────────┘            │
                    │         │                                                          │ Message Focus (session)   │
 AI availability ─► │  ┌──────▼───────┐   Draft/Rewrite    ┌─────────────────────────┐  │                            │
  (Phase 36, D-07)  │  │ AI action    ├──────────────────► │ AiSuggestionLifecycle   │◄─┘ session state (Zustand):   │
                    │  │ (adaptive)   │   3 suggestions     │ sole AbortController+   │    body/subject/mode/dest/    │
                    │  └──────┬───────┘◄──────────────────  │ timeout+stale-guard     │    Message Focus              │
                    │         │  Choose this / Try Again    └───────────┬─────────────┘                              │
                    │  ┌──────▼───────┐                                 │ generate(prompt, signal)                   │
                    │  │ Transmit /Copy│                                ▼                                            │
                    └──┼───────┬──────┼──── readPromptContext (ai-context-read.ts) ── egress ──► user-configured AI  │
                       │       │      └──── Copy → clipboard (no confirmation)                                       │
                       ▼       ▼
             performReachOut(exec, {contactId, channel, endpoint, ...})
                       │
             createPendingAssist (row @ handoff_at, status=pending)  ──► OS SMS/email composer
                       │
       ┌───────────────┴───────────────────────────────────────────┐
       ▼ (session alive)                                             ▼ (session gone: process death / 24h)
  Compose "Did you send it?"                              app-global AssistBanner + PendingConfirmationsSheet
   Yes → markAssistLogged (interaction @ handoff_at)       Yes → markAssistLogged   |   Don't log → markAssistDismissed
   Not yet → dismiss panel, keep session (row lingers)     launch sweep → expire >24h
```

### Recommended project structure (additions/edits, not new subsystems)
```
src/
├── screens/ComposeScreen.tsx        # rebuild: editor-first, Text/Email, AppText/Button roles, three-suggestion review
├── screens/ComposeResearch*.tsx     # NEW read-only Research side (or a mode within the Compose workflow)
├── logic/compose-logic.ts           # extend resolveComposeControls: Text/Email + no-destination Transmit state
├── logic/ai-suggestion-logic.ts     # reshape: single→three suggestions, drop ack gate (ADR-079)
├── stores/compose-session-store.ts  # NEW Zustand: body/subject/mode/destination/Message Focus (session-only)
├── services/reach-out/handoff.ts    # extend email arm: mailto subject+body (or expo-mail-composer)
├── db/migrations/028-compose-message-mode.ts  # NEW additive app_settings columns (verified head+1)
├── db/app-settings-dao.ts           # compose-mode getters/setters
└── db/ai-context-read.ts            # extend ONLY per ADR-078 scope decision (Open Q2)
```

### Pattern: additive `app_settings` preference with a "remember last" sentinel
Migration 027 is the exact template for the Compose default-message-mode preference (a `remember` sentinel + a remembered concrete value):
```ts
// Source: src/db/migrations/027-default-interaction-channel.ts:33-40 [VERIFIED]
ALTER TABLE app_settings
  ADD COLUMN default_interaction_channel TEXT NOT NULL DEFAULT 'remember'
    CHECK(default_interaction_channel IN ('remember','Message','Call','In Person'));
ALTER TABLE app_settings
  ADD COLUMN remembered_interaction_channel TEXT NOT NULL DEFAULT 'Message';
```
Phase 35's analog: `default_message_mode TEXT NOT NULL DEFAULT 'remember' CHECK(... IN ('remember','text','email'))` + `remembered_message_mode TEXT NOT NULL DEFAULT 'text'` (exact literals are the planner's call within the CHECK discipline). Both keys must be added to `PORTABLE_SETTINGS_KEYS` [VERIFIED: backup-schema.ts:135] but — per the established milestone pattern (theme keys, dashboard keys) — are **allowlisted-but-not-emitted** and carry **no `BACKUP_FORMAT_VERSION` bump** this phase (Phase 36 owns emission + bump) [VERIFIED: backup-schema.ts:157-172 comments].

### Anti-patterns to avoid
- **Reusing `ThingsToRememberScreen` for Research.** It is the full add/edit/delete editor [VERIFIED: :1-58 imports MemoryEditor/RelationshipEditor/Switch/setCurrentStateValue]. Compose Research is read-only and compact — build a projection over the read modules, not this screen.
- **A UI-side `.filter()` for off_limits or AI-eligibility.** The exclusion is structural, in SQL (`RANKED_FUEL_EXCLUSIONS`, `MEMORY_AI_ELIGIBILITY`). Add-to-AI eligibility must read the same `allow_ai=1` truth, never a component guess.
- **Stamping the logged interaction at confirmation time.** Trip-Wire 1.
- **Hardcoding `channel: "text"`** (current [VERIFIED: ComposeScreen.tsx:456]) — mode now decides text vs email transport.
- **Persisting the draft** anywhere durable (no drafts table, D-10).
- **Driving any feedback animation from React state per frame** (CLAUDE.md) — the existing "Copied" uses setState+setTimeout, not per-frame [VERIFIED: ComposeScreen.tsx:469-479]; keep that pattern.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Primary destination selection | A messaging-only destination store | `selectActionablePrimaryMethods` + set-primary DAO | Dossier §D: consume canonical contact-method model [VERIFIED: contact-methods-read.ts:10-19] |
| Interaction logging on confirm | A messaging-history record | `markAssistLogged` → recency writer | Single-writer recency invariant; canonical Message semantics [VERIFIED: interaction-assist-dao.ts:99-118] |
| Channel string mapping | A second remap copy | `remapLegacyChannel` (the one map) | interaction-vocabulary.ts is the single source of truth [VERIFIED: :2-31] |
| AbortController / timeout / stale-response guard | New cancellation logic | `AiSuggestionLifecycle` machinery | Already node-pure, injected, token-guarded [VERIFIED: ai-suggestion-logic.ts:5-52] |
| AI context serialization | A new prompt-context read | `readPromptContext` (extend within ADR-078 scope) | Sole data-minimization boundary [VERIFIED: ai-context-read.ts:1-27] |
| Buttons / text / touch targets | `Pressable`+`Text`+raw sizes | `Button`/`AppText` roles + `MIN_TOUCH_TARGET` | Corrects the flagged refactor debt; `check:colors` + typography scale |
| SMS availability probe | Assume availability | `SMS.isAvailableAsync()` with `null`=unknown interim | Existing no-flash pattern [VERIFIED: ComposeScreen.tsx:376-390; compose-logic.ts:75-84] |

**Key insight:** nearly every "new" capability in this phase already has a canonical owner on disk. The phase's real new work is UI reshape (editor-first, Text/Email, review surface), session state (a Zustand store), the email-handoff subject/body extension, and the AI-lifecycle reshape (three suggestions, drop ack).

---

## Runtime State Inventory (this is a refactor/integration phase)

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | `interaction_assists` rows (durable, before-handoff) [VERIFIED: interaction-assist-dao.ts:38-51]; `interactions` (canonical log) via recency writer; `app_settings` singleton row | New `app_settings` columns via migration 028 (NOT NULL defaults so no null state on the singleton, per migration 027 precedent). No data migration — additive only. |
| Live service config | None — no external service config embeds a Compose string | None |
| OS-registered state | Android SMS/email intent handoff (transient, not registered); share-sheet target is a separate phase | None new |
| Secrets/env vars | AI provider API keys via `ai-key-store` (consumed by `AiService`, not touched here) [VERIFIED: ComposeScreen.tsx:90] | None — Phase 36 owns key management |
| Build artifacts / installed packages | If `expo-mail-composer` is adopted: requires a **custom dev-client rebuild** (not Expo Go) | Only if the owner opts into that package |
| Retired plumbing | `requestAiSuggestion` route param + `ai-suggestion-navigation.ts` consume-once intent [VERIFIED: navigation/types.ts:96-102; ai-suggestion-navigation.ts:28-31]; `ai_ack_*` columns become unused (ADR-079) | Retire the intent plumbing; `ai_ack_*` column removal is optional (a migration would be forward-only — likely NOT worth it; leave columns, remove the writer/reader cleanly) |

---

## Common Pitfalls

### Pitfall 1: Re-planning the D-06 translation
**What goes wrong:** A plan adds a "translate assist channel to Message" task. **Why:** the planning-notes R-03 reads as unbuilt, but it shipped in Phase 32. **Avoid:** verify `interaction-assist-dao.ts:112` calls `remapLegacyChannel` before writing any translation task (Trip-Wire 2). **Warning sign:** a task touching `markAssistLogged`'s channel write.

### Pitfall 2: Widening AI egress beyond ADR-078's authorized scope
**What goes wrong:** a plan adds off-limits text or interaction notes to the prompt as positive context, or transmits an AI-disabled off-limits item, or includes a Group Note. **Why:** the Research-side "Avoid" display and the actual egress construction are easy to conflate. **Avoid:** off-limits AI-enabled → negative constraint ONLY; AI-disabled off-limits → never sent; note only when `interactions.allow_ai=1`; Group Notes never (ADR-078). Resolve Open Q2 first. **Warning sign:** any edit to `fuel-read.ts` exclusions or a new positive-context branch in `ai-context-read.ts`.

### Pitfall 3: Leaving a half-wired acknowledgement gate
**What goes wrong:** the ADR-052 ack gate is partially removed and generation gates on `ai_ack_*` that nothing sets — AI never fires. **Why:** the gate is threaded through the lifecycle, the screen, and the DAO [VERIFIED: ai-suggestion-logic.ts:242-274; ComposeScreen.tsx:196-212,568-648]. **Avoid:** reshape the lifecycle cleanly to the three-suggestion contract with no ack state; ADR-079 flags this exact risk [CITED: ADR-079 line 44].

### Pitfall 4: UTC off-by-one on timestamps
**What goes wrong:** using `toISOString().split('T')[0]`. **Avoid:** `formatLocalDate()` / `localDateTime()` [VERIFIED: ai-context-read.ts:47,85-92; ComposeScreen.tsx:70,459] — every timestamp in this subsystem already uses local wall-clock.

### Pitfall 5: adb tap false-negatives on device verification
**What goes wrong:** small RN `Pressable`/`Button` controls (mode switch, Add to AI, Choose this) silently miss `adb input tap`, reading as "broken control." **Avoid:** per the input taxonomy memory — chips/rows = plain tap, FAB/buttons = touchscreen tap; verify against code before declaring a control broken.

### Pitfall 6: Session state lost on the Compose↔Research sibling transition
**What goes wrong:** draft/subject/Message-Focus vanish when switching to Research and back, or on backgrounding. **Why:** current draft is local `useState` [VERIFIED: ComposeScreen.tsx:143]; the focus effect reloads on every focus [VERIFIED: :279-401]. **Avoid:** hold session state in a Zustand store (pattern: `assist-store`) keyed by contact, cleared on Transmit-confirmed/relaunch, surviving in-app nav + background (D-10).

---

## Validation Architecture

Nyquist validation is enabled (config default; not `false`). The codebase is heavily Vitest-tested (3287 tests as of Phase 34) with node-pure logic modules the norm.

### Test framework
| Property | Value |
|----------|-------|
| Framework | Vitest (node environment; RN modules injected/mocked) [VERIFIED: sibling `.test.ts` files throughout src/] |
| Config | repo Vitest config (project convention) |
| Quick run | `npx vitest run <path>` for a touched module |
| Full suite | `npm test` (or the project's vitest script) + `npx tsc --noEmit` + `npm run check:colors` |

### Phase requirements → test map (representative; planner completes)
| Req | Behavior | Test type | Command | Exists? |
|-----|----------|-----------|---------|---------|
| COMP-02 | mode default + remembered-on-Copy/Transmit | unit | `vitest run src/logic/compose-*` | ❌ Wave 0 (new mode logic) |
| COMP-03 | primary resolve + mode fallback + no-destination | unit | `vitest run src/logic/compose-logic.test.ts` | ⚠ extend existing |
| COMP-05/06 | confirm logs at handoff_at; Not yet keeps session; Copy no-trigger | unit | `vitest run src/db/interaction-assist-dao.test.ts` | ✅ exists (extend for coexistence) |
| COMP-10 | egress excludes off_limits/Group Notes; note gated on allow_ai | unit | `vitest run src/db/ai-context-read.test.ts` `fuel-read.test.ts` | ✅ exists (extend per ADR-078 scope) |
| COMP-12/13 | three suggestions; non-destructive; cancel/timeout/stale | unit | `vitest run src/logic/ai-suggestion-logic.test.ts` | ✅ exists (reshape) |
| COMP-14 | origin-aware return, no finished route in Back | manual/device | Pixel UAT (desktop-build-pipeline) | 🧪 device backstop |
| migration 028 | additive columns, head+1, portable-allowlisted | unit | `vitest run src/db/migrations/028-*.test.ts` `full-chain.test.ts` | ❌ Wave 0 |

### Sampling
- Per task commit: `npx vitest run <touched>` + `npx tsc --noEmit`.
- Per wave merge: full vitest + `tsc --noEmit` + `check:colors` (tsc is NOT in a commit hook — memory `tsc-in-post-merge-gate`; a passing suite is not a clean typecheck).
- Phase gate: full suite green + device UAT on the Pixel (memory `verify-ui-on-pixel-yourself`).

### Wave 0 gaps
- [ ] `src/db/migrations/028-compose-message-mode.test.ts` + `full-chain.test.ts` update — covers migration 028
- [ ] `src/stores/compose-session-store.test.ts` — session state (survives nav/background, not relaunch)
- [ ] AI lifecycle reshape tests (three suggestions, no ack gate, Try Again replaces set) — extend `ai-suggestion-logic.test.ts`
- [ ] `compose-logic` Text/Email + no-destination matrix — extend

---

## Security Domain

`security_enforcement` assumed enabled. Compose is a **privacy trip-wire surface** (contact data + the only AI egress path).

| ASVS category | Applies | Standard control (existing) |
|---------------|---------|------------------------------|
| V5 Input Validation | yes | Contact-derived values are untrusted and injectable into prompts; the closed `PromptContext` bounds + delimits them; every SQL value `?`-bound, only `isSafeColName`-guarded identifiers interpolated [VERIFIED: ai-context-read.ts:1-27,218-219] |
| V6 Cryptography | indirectly | Hermes `globalThis.crypto` is undefined on-device — never call `crypto.subtle`/`randomUUID` unguarded (memory `hermes-crypto-guard`). Compose uses `newUid()` (DAO-owned) — do not introduce raw crypto in a code example; if UID generation is touched, route through the existing guarded path [VERIFIED: interaction-assist-dao.ts:10,37] |
| V9 Data Protection / egress | yes | ADR-078: the sole egress is `ai-context-read.ts`; local-first — no network on read paths; AI is the only egress and only to the user-configured provider on explicit invoke (CLAUDE.md) |

| Threat pattern | STRIDE | Mitigation |
|----------------|--------|-----------|
| Prompt injection via contact-derived text | Tampering | Closed projection, bounded/delimited context; off-limits as negative constraint stays as injectable as positive and must stay delimited [CITED: ADR-078 line 46] |
| Silent egress widening | Information disclosure | Any widening beyond ADR-078 is an owner decision (D-08); off_limits/Group Notes structurally excluded in SQL |
| Credential leakage in review/error surfaces | Information disclosure | Review surfaces resolve from the same prompt construction and never display credentials [CITED: ADR-079 line 43]; error path maps sanitized codes, never raw provider text [VERIFIED: ComposeScreen.tsx:488-506] |

---

## Open Questions (surface to owner BEFORE planning the affected tasks)

1. **Three-state AI availability source (D-07, COMP-09) — sequencing tension.**
   - What we know: Phase 35 must *consume* Off / On+Ready / On+Needs-Attention from Phase 36 (dossier §L; D-07). Today Compose computes a binary `aiProvider !== 'none'` [VERIFIED: ComposeScreen.tsx:318].
   - What's unclear: **Phase 36 (AI Config) comes AFTER Phase 35 in the roadmap** [VERIFIED: STATE.md:55 "36 AI Config"]. The three-state model Phase 35 is told to consume does not exist yet.
   - Recommendation: Phase 35 defines the **consumer seam** (a small capability adapter with a stable 3-state interface) and ships a provisional implementation deriving the state from what exists now (Off = `aiProvider === 'none'`; Ready = provider set + credential present; Needs-Attention = provider set but credential missing/invalid). Phase 36 later replaces the adapter's internals without touching Compose UI (dossier §U clean-seam intent). **Confirm this framing with the owner** — it decides whether Needs-Attention is real in Phase 35 or a stubbed branch.

2. **ADR-078 egress construction ownership — Phase 35 vs Phase 36.**
   - What we know: Success Criterion 11 (Phase 35) requires Off Limits "passed to AI as an avoidance constraint when authorized." ADR-078 lists `ai-context-read.ts`, `prompt-types.ts`, `prompt-template.ts`, `ComposeScreen.tsx` as key files. But dossier §U DEFERS "exact ... generation-context construction" to Phase 16 (=36), and D-08 says any egress widening is an owner decision.
   - What's unclear: does Phase 35 (a) build only the Research-side "Avoid" display + Message-Focus exclusion + the closed-contract *shapes* (leaving exact prompt rendering to Phase 36), or (b) also implement the negative-constraint + gated-recent-interaction-note egress end-to-end? The `allow_ai` gate column already exists (migration 025); the projection code does not.
   - Recommendation: **owner decision.** Safest default: Phase 35 builds the human-facing Research "Avoid" group + the never-Message-Focus rule + extends `PromptContext`/`ai-context-read` to CARRY the avoidance-constraint and gated-note shapes; Phase 36 owns the exact prompt-template rendering/weighting. Do not widen egress beyond the ADR without explicit sign-off.

3. **Email handoff mechanism: `mailto` query string vs `expo-mail-composer`.**
   - What we know: no email dep installed; email is bare `mailto:` today [VERIFIED: handoff.ts:63-65]. Subject+body need adding.
   - Recommendation: default to `Linking.openURL('mailto:'+addr+'?subject='+enc+'&body='+enc)` (no new dep, no dev-client rebuild). Offer `expo-mail-composer` as an owner opt-in (richer UX, dev-client rebuild, Package Legitimacy gate). Either way the "Did you send it?" prompt is still required (Android send status is unreliable).

4. **Origin-aware return (COMP-14).** Current Back always resets to the dashboard root [VERIFIED: ComposeScreen.tsx:266-272]. Dossier §W wants return "normally back toward the contact Profile when launched there." Needs an `origin` route param (Profile/dashboard/deep-link) and a return that pops rather than resets when launched from Profile, without leaving the finished Compose route in Back history. Confirm the exact return targets with the shell's canonical navigation.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `expo-sms` | Text handoff + availability probe | ✓ | ~57.0.1 | — [VERIFIED: package.json:29] |
| `expo-clipboard` | Copy | ✓ | ~57.0.1 | — [VERIFIED: package.json:16] |
| RN `Linking` | Email/tel handoff | ✓ | (RN built-in) | — [VERIFIED: handoff.ts:2] |
| `expo-mail-composer` | Optional richer email | ✗ | — | `mailto:` query string (no dep) |
| Pixel 6 Pro (device UAT) | COMP-14 + UI verification | ✓ | per desktop-build-pipeline | desktop emulator (no perf claims) |

No missing dependency blocks execution on the recommended (no-new-dependency) path.

---

## State of the Art

| Old approach (current code) | Current product target | Source |
|-----------------------------|------------------------|--------|
| Fuel-first layout (cards above editor) | Editor-first; Research is a sibling side | dossier §A/§B; [VERIFIED: ComposeScreen.tsx:832-915] |
| Text-only, hardcoded `channel:"text"` | Text/Email mode + Subject | COMP-02/04; [VERIFIED: :456] |
| Single AI suggestion + exact-prompt ack gate (ADR-052) | Three suggestions, non-destructive review, lightweight disclosure (ADR-079) | ADR-079; [VERIFIED: ai-suggestion-logic.ts:82-90] |
| Profile AI-draft entry via `requestAiSuggestion` | Removed; Message → Compose is the only AI path | ADR-079; Phase 31 (done) [VERIFIED: grep] |
| Back always resets to dashboard | Origin-aware return | dossier §W; [VERIFIED: :266-272] |
| Hand-rolled `Pressable`/`Text`/raw sizes/`accent` on text | `AppText`/`Button` roles, `accentText` link tone | UI-SPEC; [VERIFIED: :529,933,944; styles] |

**Deprecated/outdated in this phase:** ADR-052 exact-prompt ack (→ ADR-079); ADR-050/036 off-limits/interaction-prose exclusions (→ ADR-078, partial); ADR-035/036 "Send/Copy never write to SQLite" (stale, superseded by ADR-072 in practice — flag, don't fix).

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `expo-mail-composer` is an official Expo SDK package installable at the `~57` line | Package Legitimacy | Low — but not registry-verified this session; gate behind checkpoint if adopted |
| A2 | Vitest is the test framework (inferred from pervasive `.test.ts` siblings + 3287-test count) | Validation | Low — config not opened this session |
| A3 | A Zustand session store is the right home for Compose session state (pattern from `assist-store`, CLAUDE.md "Zustand stores in src/stores/") | Patterns | Low — consistent with project convention |
| A4 | Phase 31 fully removed the Profile AI-draft entry (grep of ContactProfileScreen found no AI-draft refs; not the whole file read) | Trip-Wire 4 | Medium — confirm the profile hero exposes only Message/Call before retiring the nav intent |
| A5 | The three-state AI source does not yet exist because Phase 36 follows Phase 35 | Open Q1 | Medium — drives whether Needs-Attention is real or stubbed this phase |

**If the owner resolves Open Questions 1 and 2, A4/A5 collapse into decisions.**

---

## Sources

### Primary (HIGH — opened on disk this session)
- `src/screens/ComposeScreen.tsx` (full, 1202 lines) — current Compose surface
- `src/logic/ai-suggestion-logic.ts` (full) — single-suggestion lifecycle
- `src/logic/compose-logic.ts` (full) — Send/Copy capability gate
- `src/services/reach-out/handoff.ts` (full) — handoff + assist creation
- `src/db/interaction-assist-dao.ts` (full) — assist lifecycle writers
- `src/db/interaction-vocabulary.ts` (full) — the one channel/quality remap
- `src/db/ai-context-read.ts` (full) — sole egress projection
- `src/db/fuel-read.ts` (full) — ranked/off-limits exclusions
- `src/db/contact-methods-read.ts` (full) + `contact-methods-dao.ts` (grep) — primary resolution + set-primary
- `src/db/migrations/027-default-interaction-channel.ts` (full) + `025` (grep) + `014` (head) — schema head/vocabulary/CHECK
- `src/db/database.ts:62-99` — TARGET_VERSION=27, MIGRATIONS registry
- `src/backup/backup-schema.ts:135-172` — PORTABLE_SETTINGS_KEYS + allowlist-not-emit pattern
- `src/components/AssistBanner.tsx` (full) + `App.tsx` (grep, mount at :393)
- `src/screens/ThingsToRememberScreen.tsx:1-60` — Contact Knowledge editor imports
- `src/db/memories-read.ts` (grep) — `MEMORY_AI_ELIGIBILITY` / `resolveVisibility`
- `src/navigation/types.ts` + `ai-suggestion-navigation.ts` (grep) — Compose route params + retired intent
- Decision docs (full): dossier, planning-notes, 35-CONTEXT.md, 35-UI-SPEC.md, ADR-078, ADR-079, HANDOFF.md; REQUIREMENTS.md (COMP grep), STATE.md, ROADMAP.md (dep-completion grep)

### Secondary (MEDIUM)
- ADR-070/071/072 summarized via planning-notes + CONTEXT (not opened in full this session — the coexistence facts are cross-cited to `interaction-assist-dao.ts` + `AssistBanner.tsx` which WERE opened)

### Tertiary (LOW)
- `expo-mail-composer` availability/behavior (training knowledge; no registry/web tool run this session) — `[ASSUMED]`

---

## Metadata

**Confidence breakdown:**
- Existing-plumbing map: HIGH — every claim opened on disk with file:line this session
- Trip-wires (assist coexistence, D-06 done, egress, ack removal): HIGH — verified against code + ADRs
- Forward seams (3-state AI source, ADR-078 egress ownership): MEDIUM — genuine plan-time escalation, flagged as Open Questions
- Package/framework details: LOW-MEDIUM — `expo-mail-composer` unverified; Vitest inferred

**Research date:** 2026-09-13
**Valid until:** ~2026-10-13 for the code map (stable subsystem); re-verify migration head (currently 028) and D-06 remap presence at plan time — both drift with any intervening schema phase.

## RESEARCH COMPLETE
