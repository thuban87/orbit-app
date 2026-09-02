# Phase 13 — Rapid Capture & Update Flows — Planning Notes

- **Phase:** 13 Rapid Capture & Update Flows
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-13-rapid-capture-update-flows-dossier.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

---

## Escalations resolved (how the dossier was amended)

**E-05 — the interaction-note AI permission gate.**

- **Owner resolution (2026-09-01):** a **per-interaction "Allow AI" toggle, default OFF**, surfaced
  by **Phases 11 and 13**, defaulted by **Phase 16**. **Group Notes are never sent**, with no toggle.
- Consequence for Phase 13: the ordinary **Log form** owns the toggle at capture time. It ships
  **OFF by default**. Today AI context never reads an interaction note
  (`src/db/ai-context-read.ts:114-120`) — the gate is what makes any note eligible at all.
- **Trip-wire:** default-ON, or a group-note path through the toggle, reverses the resolution and
  widens AI egress → stop and ask (`CLAUDE.md`: widening what the AI feature transmits is an owner
  decision).

**Open owner reconciliation items that block planning:**

- The **default/general built-in Memory type name** (D-13-060, D-RM-056, D-13-190) is **needed
  before Phase 13 planning** — the Update Contact / Memory editor names it.
- **`Log Contact` vs `Log Interaction`** naming (D-13-184, §AN) — taste, owner's call.

## REPLAN items for plan-phase

### R-13 — the streamlined Add Contact is silent on ADR-016's "normal create defaults last-spoke to today" (ESCALATE trip-wire)

- **Unbuilt / needed:** nothing — this is a **preservation** requirement. D-13-010…019
  (`phase-13…md:73-106`) describe a name-only Add Contact with Identity / Relationship Basics /
  Contact Methods and **never mention** the last-spoke / first-interaction choice.
- **Code facts (verified 2026-09-01):** the form default is `{ kind: "today" }`
  (`src/screens/CreateContactScreen.tsx:102`); `firstInteractionOccurredAt` supports
  today / date / not-yet (`src/screens/create-contact-logic.ts:76-88`); the DAO writes the first
  interaction **via the recency cores** (`src/db/contacts-dao.ts:188-196`).
- **Resolved path (owner, 2026-09-01):** **keep the tri-state last-spoke control (today / on date /
  not yet) in Add Contact's Relationship Basics, default "today". ADR-016 is unchanged.**
- **Constraints / trip-wires:**
  - **Dropping the control silently is the reversal.** ADR-016 is marked **costly**: "A normal
    create defaults last-spoke to today; 'Not yet' creates no interaction and leaves the contact
    genuinely never-contacted."
  - "Not yet" must continue to create **no interaction** — not an interaction with a null date.
  - Phase 13's Bound/Unbound supersession (D-13-029…035) is **compatible with ADR-062** (verified:
    `tracking_enabled` column, dormant cadence preserved, the `contacts_prevent_cadence_clear`
    trigger at `011-contact-lifecycle-schema.ts:181-186`). No finding there.

### R-03 — the channel vocabulary becomes exactly Message / Call / In Person

- **Unbuilt / needed:** D-13-078/079 (`phase-13…md:297-302`); D-13-082 keeps legacy values
  representable (:308); D-13-102…107 make Tone canonical with a null default, omitted ≠ Neutral
  (:372-383).
- **Code facts (verified 2026-09-01):** UI channel values are
  `call|text|in-person|email|other|unspecified` (`src/components/TouchpointRefineForm.tsx:60-67`);
  `interactions.channel` has **no CHECK**; **`interaction_assists.channel` does** —
  `CHECK(channel IN ('call','text','email'))` (`014-interaction-assists.ts:12`) — and
  `markAssistLogged` copies it into `interactions.channel`
  (`src/db/interaction-assist-dao.ts:98-111`).
- **Resolved path (owner, 2026-09-01):** backfill quality `good`→**Positive**, `fine`→**Neutral**,
  `hard`→**Negative**; channel `text`/`email`→**Message**, `call`→**Call**,
  `in-person`→**In Person**, `other`/`unspecified` **kept as legacy values**. **The
  `interaction_assists.channel` CHECK stays as the transport** (call/text/email) and is **mapped to
  Message at log time** — no rebuild of that table.
- **Constraints / trip-wires:** update every literal consumer of `quality`
  (`ai-context-read.ts:130-134`, `digest-read.ts:158-161`, timeline rendering, backup serializer)
  with the migration, not after it.

### R-16 — the Default Interaction Channel preference is a new durable setting

- **Unbuilt / needed:** ordinary Channel preference + remembered last channel (D-13-083…089).
- **Resolved path (owner, 2026-09-01):** `app_settings` columns, portable via the backup manifest —
  not AsyncStorage.
- **Constraint:** the remembered value updates **only after a successful ordinary save**, and
  **Group Log is exempt** (defaults In Person) — D-13-090…093, D-12-136.

### R-01 dependency — Update Contact needs the Phase 3 knowledge model

- The Update Contact flow and the Memory editor (D-13-128…133) consume Phase 3's Memory type
  registry, custom types, pinning, visibility, and per-item AI permission — **all unbuilt** (see
  `phase-03-planning-notes.md`). **Phase 3 must land first.**

## Migration / sequencing

- Implies changes to `interactions`: the **Tone/channel data migration** (R-03) and the
  **per-interaction Allow-AI column** (E-05, default OFF). **Decide once whether Phase 11 or Phase 13
  owns the `interactions` migration** — they touch the same table; the other phase consumes it.
- Plus the **Default Interaction Channel** and **remembered last channel** columns in `app_settings`.
- **No rebuild of `interaction_assists`** (owner resolution).
- **Number every migration head+1 at plan time**, verified against `src/db/migrations/` on disk.
  Head at audit time was 14.
- **Must land after:** Phase 3 (knowledge model). **Must land before:** Phase 16's format-4 bump.

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 15:** the ordinary logging **Default Interaction Channel** setting (Remember Last Choice
  factory / Message / Call / In Person; remembered updates only after a successful ordinary save)
  **with copy stating Group Log is exempt and defaults In Person**
  (D-13-083…093, D-12-136, D-GE-002, D-RM-053/054, D-MH-011).
- **Phase 17:** teach the final **Message / Call / In Person** vocabulary, never legacy
  Text/Email/Other; do not imply the Channel default governs Group Log (D-13-177).
- **Phase 18:** form validation and reflow QA (D-13-178).
