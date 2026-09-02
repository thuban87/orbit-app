# Roadmap: Orbit

Orbit is a local-first personal relationship manager (social CRM) for Android — React Native / Expo,
on-device SQLite, no backend. Built foundation-first, then in vertical feature slices (dashboard before
orrery), with the friction features (capture, notifications, widget) landing as early as their data
dependencies allow. Phases map one-to-one onto the dossier domains; a `[DECIDED]`/`[REJECTED]` decision
is implemented, never reopened.

## Milestones

- ✅ **v1.0 MVP** — Phases 1–21 (shipped 2026-09-01) — full detail archived in
  [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md); requirements in
  [`milestones/v1.0-REQUIREMENTS.md`](milestones/v1.0-REQUIREMENTS.md); phase artifacts in
  `milestones/v1.0-phases/`.
- ⏭️ **v1.1 (next)** — not yet scoped. Run `/gsd-new-milestone`. The milestone-2 dossier audit and its
  `docs/dossier/milestone-2/AUDIT-HANDOFF.md` bridge already exist to seed planning.

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–21) — SHIPPED 2026-09-01</summary>

Complete phase-by-phase detail, plan lists, and success criteria live in
[`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md). Summary:

- [x] Phase 1: Project Scaffold & Portable Code — completed 2026-08-14
- [x] Phase 2: Data Foundation & Status Engine — completed 2026-08-14
- [x] Phase 3: Custom Fields — completed 2026-08-15
- [x] Phase 4: Contact CRUD & Lifecycle — completed 2026-08-15
- [x] Phase 5: Photos — completed 2026-08-15
- [x] Phase 6: Interaction Log, Status & Impact — completed 2026-08-15
- [x] Phase 7: Conversational Fuel — completed 2026-08-16
- [x] Phase 8: Dashboard & Never-Contacted Screen — completed 2026-08-16
- [x] Phase 9: Compose Screen & SMS Handoff — completed 2026-08-16
- [x] Phase 10: Share-Sheet Capture — completed 2026-08-16
- [x] Phase 11: Actionable Notifications — completed 2026-08-16
- [x] Phase 12: Home Screen Widget — completed 2026-08-17
- [x] Phase 13: Orrery — completed 2026-08-18
- [x] Phase 14: AI Message Suggestions — owner-accepted 2026-08-22
- [x] Phase 15: Weekly Digest — completed 2026-08
- [x] Phase 16: Custom Field Value Normalization (migration 006 / ADR-001) — completed 2026-08
- [x] Phase 17: Backup, Export & Restore — completed 2026-08
- [x] Phase 18.1: Contact Method Normalization — completed 2026-08-28
- [x] Phase 18.2: Bound/Unbound Lifecycle — completed 2026-08
- [x] Phase 19: System Contact Import — completed 2026-08-30
- [x] Phase 19.1: Older-Android Contact Picker (Hybrid two-picker, ADR-002) (INSERTED) — completed 2026-08
- [x] Phase 20: Contact Reconciliation & Merge (ADR-003) — completed + owner-signed-off 2026-08-31
- [x] Phase 21: Interaction Assist & Reach Out — completed + owner-signed-off 2026-08-31

_Phase 18 ("Contact Data Normalization") was split into 18.1 + 18.2; its planning record is archived at
`milestones/v1.0-phases/18-contact-data-normalization/`._

All v1.0 commits are local on `main` and have NOT been pushed.

</details>
