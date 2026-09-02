# Phase 14 — Messaging & AI Compose — Planning Notes

- **Phase:** 14 Messaging & AI Compose
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-14-messaging-ai-compose-dossier.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

---

## Escalations resolved (how the dossier was amended)

**E-05 — AI egress widening.**

- **Owner resolution (2026-09-01):** a **per-interaction "Allow AI" toggle, default OFF**
  (Phases 11/13 surface it, Phase 16 defaults it); **Group Notes are never sent**.
- Consequence for Phase 14: Compose's context may include an interaction note **only** where that
  interaction's Allow-AI flag is ON. Today AI context reads only `channel, quality, connected` from
  interactions (`src/db/ai-context-read.ts:114-120`) and `off_limits` fuel is excluded in SQL
  everywhere (`src/db/fuel-read.ts:133-141`).
- The **Off Limits** half of E-05 (D-14-076 `phase-14…md:351` transmits them as avoidance
  constraints; D-14-075 :349 shows them to the human on the Research side) touches ADR-050's
  "never … off-limits fuel" and ADR-036's rejected UI-side privacy filter. **That outcome is
  recorded in the dossier and `docs/decisions/`, not here** — confirm a superseding ADR before
  changing `fuel-read.ts`'s exclusions.

**E-06 — the exact-prompt first-send acknowledgement and the Profile AI-draft entry.** Phase 16
replaces ADR-052's exact-prompt ack with a lightweight disclosure (D-16-135/137); Phase 10 removes
the Profile AI-draft entry (D-10-016). Code: the exact-prompt gate is live at
`src/logic/ai-suggestion-logic.ts:223-235` with per-provider `ai_ack_*` columns (migration 004).
**The outcome is recorded in the dossier and `docs/decisions/`, not here.**

**AUTO-FIX applied to this dossier:** **AF-01** — §L and SC9 no longer use binary AI-availability
wording. The three-state model is: **AI Off → no AI affordances; AI On + Ready → AI actions;
AI On + Needs Attention → a restrained "AI needs attention" repair notice** (cross-reference Phase 16
§F). "Manual Compose/Research fully usable regardless" is preserved.

## REPLAN items for plan-phase

### R-14 — the Compose-attached "Did you send it?" must coexist with ADR-070/071's durable assist lifecycle and app-global banner

- **Unbuilt / needed:** the Compose-attached confirmation presentation (D-14-036,
  `phase-14…md:169-182` — Yes, log interaction / Not yet); D-14-047 says session state does not
  survive relaunch (:225).
- **Code facts (verified 2026-09-01):**
  - It is **already an in-app banner, not a notification** (`src/components/AssistBanner.tsx:14-22`),
    mounted app-wide at `App.tsx:323`.
  - "Don't log" → `markAssistDismissed`; email handoff via `mailto:` exists
    (`src/services/reach-out/handoff.ts:50-66`); the Compose Send path already creates the assist
    (`src/screens/ComposeScreen.tsx:451-458`).
  - ADR-070: a durable `interaction_assists` row is written **before** launch;
    `pending → logged | dismissed | expired | failed`; cap 5; 15 s eligibility; 24 h expiry; launch
    sweep; "off means off". ADR-071: confirmation writes **one outbound interaction stamped
    `handoff_at`** via the recency cores; Text/Email offer **Yes / Don't log**.
- **Plan rules (copy into the plan):**
  1. **The Compose-attached prompt is an *additional* surface.** The app-global banner and the
     pending-confirmations sheet **must stay** for assists whose Compose session is gone — process
     death, or the 24 h window.
  2. **"Not yet" ≠ "Don't log".** Keep a dismissal path, or rows linger until expiry.
  3. **The write stays `markAssistLogged` at `handoff_at`** — not at confirmation time. D-14-042
     agrees.
- **ESCALATE trip-wire:** removing the app-global banner, removing the dismissal path, or stamping
  the interaction at confirmation time **reverses ADR-070/071** → stop and ask.
- **Note (not this milestone's doing):** ADR-035/036 still say Send/Copy "never write to SQLite",
  already superseded in practice by ADR-072's assist row. A superseding note is overdue; flag it,
  do not silently rely on the stale text.

### R-03 — writing `Message` through the assist CHECK

- **Code facts (verified 2026-09-01):** `interaction_assists.channel` has
  `CHECK(channel IN ('call','text','email'))` (`014-interaction-assists.ts:12`), and
  `markAssistLogged` copies that value straight into `interactions.channel`
  (`src/db/interaction-assist-dao.ts:98-111`). Phase 14's confirmed Transmit must write **Message**
  (D-14-037).
- **Resolved path (owner, 2026-09-01):** **the CHECK stays** as the *transport* (`call`/`text`/
  `email`); the value is **mapped to Message at log time**. So `markAssistLogged` must **translate**
  rather than copy: `text`/`email` → `Message`, `call` → `Call`. **No rebuild of
  `interaction_assists`.**
- **Trip-wire:** leaving `markAssistLogged` as a straight copy after the vocabulary change writes
  legacy transport values into `interactions.channel` — a silent data inconsistency the CHECK will
  not catch.

### R-16 — the Compose default message mode is a new durable preference

- **Unbuilt / needed:** Compose mode preference + remembered value (D-14-013/017).
- **Resolved path (owner, 2026-09-01):** `app_settings` columns, portable via the backup manifest —
  not AsyncStorage. Remembered on Copy/Transmit (D-14-014/133).

## Migration / sequencing

- Implies **`app_settings` columns** for the Compose default message mode and the remembered value.
- **No `interaction_assists` rebuild** (owner resolution on R-03) — but `markAssistLogged`'s
  translation change ships **with** the Tone/channel migration owned by Phase 11 or 13, not before
  it.
- **Number every migration head+1 at plan time**, verified against `src/db/migrations/` on disk.
  Head at audit time was 14.
- **Must land after:** Phase 3 (AI context contents), Phase 11/13 (channel vocabulary), Phase 16's
  AI configuration model for the three-state availability wording.
- **Must land before:** Phase 16's format-4 backup bump.

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 15:** the Compose **default message mode** setting (Text / Email / Remember Last Choice
  factory; remembered on Copy/Transmit) — D-14-013/014/017/133, D-RM-059.
- **Phase 17:** may explain AI data flow and respect AI's optional posture (D-14-135).
- **Phase 18:** external-app resume/lifecycle heuristics for "Did you send it?", and AI loading
  presentation (D-14-041/112/136).
