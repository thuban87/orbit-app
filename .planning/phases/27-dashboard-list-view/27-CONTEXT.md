# Phase 27: Dashboard List View - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Build Orbit's Dashboard **List View** renderer over the shared Dashboard Data & State Foundation and Dashboard Control Surface: a scan-first, full-width row browser with a stable three-line information hierarchy, favorite and relationship-status treatment, snooze presentation, search-result rendering, swipe accelerators, and accessible equivalents. It stays meaningfully denser than Card View rather than becoming a mini-profile layout.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01 [informational]:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it. *(Process/ground-truth directive governing how planning is done — not a trackable feature deliverable; honored during planning, checker confirmed zero decision reversals.)*
- **D-02 [informational]:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask. *(Process/ground-truth directive — not a trackable feature deliverable; honored during planning.)*
- **D-03:** This phase ships SQLite schema — one small migration adding the right-swipe logging preference column. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). It may instead be folded into the Dashboard Data phase's preference migration if the two are planned together — **decide once, not twice.** Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage (R-16).

### Phase-specific constraints
- **D-04 (E-01, ADR-075):** **Binary favourites.** The star is membership only — immediate fill/unfill plus light haptic, no success snackbar, visual revert plus error notification on persistence failure. The drag-reorder Manage-favourites screen and `favourite_rank` are retired (ADR-033 superseded 2026-09-01 by ADR-075); **legacy/internal rank must never surface as ranked-Favorites UX, and the List never sorts by rank** (§H annotation).
- **D-05 (R-17 REPLAN):** Status glyphs and the semantic icon registry **do not exist** — status today is colour + border weight only, there is no registry anywhere in `src/`, and there is no reduced-motion hook. The Theme phase must deliver all three before this phase plans against them; if it has not, this phase defines them and hands them to Theme — **never fork a second icon source.**
- **D-06 (R-17 trip-wire):** Every colour resolves through theme tokens; **no hardcoded colour in row rendering**.
- **D-07 (status presentation):** Unsnoozed relationship state shows through **two redundant channels** — a same-weight status-coloured border plus a distinct non-tappable lower-right status glyph (celestial silhouettes for Stable/Wobbly/Decaying/Rogue) — never colour alone. Contacts with no status evaluation get a neutral border and **no status icon**; do not fabricate a fifth "Unknown" status. Snoozed contacts get the border suppressed to neutral and the status icon replaced by a snooze icon.
- **D-08 (E-02 reading):** `No interactions yet` plus the neutral border is the **row presentation** for never-contacted rows inside the All Contacts / Not Contacted populations — it is **not** a change to the Active predicate (Active still excludes never-contacted).
- **D-09 (swipe contract):** Right swipe executes the configured logging action, left swipe routes to Edit Contact; only one row is swipe-revealed at a time, tapping a partially swiped row closes the swipe rather than navigating, and there are **no destructive swipe actions**. The right-swipe choice is a **global** preference (Quick Log vs Log Contact, default Quick Log) — this phase owns storage and read, the Settings phase owns the UI, and onboarding owns the early choice.
- **D-10 (accessibility):** Assistive-technology users get row actions equivalent to the gestures (Log Interaction, Edit Contact) plus a description covering name, category, recency, favourite state, and relationship/snooze state **without relying on colour**.
- **D-11 (adaptive line):** Line 3 is a **deterministic** adaptive context item drawn from existing structured/user-authored knowledge, or one of roughly ten lightweight completeness prompts — **stable per contact, not changing on re-render**. Birthdays are deliberately excluded from the adaptive line, and no AI generates row copy.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry — including final status-icon artwork, exact row/avatar/spacing tokens, gesture thresholds, animation timings, and virtualization tuning.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-06-dashboard-list-view-dossier.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-06-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- `docs/decisions/ADR-075-binary-favourite-membership-without-a-user-facing-order.md` — the row star is binary membership; no ranked-favourites UX may surface and the List never sorts by rank (supersedes ADR-033).

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Explicitly do-not-build here: **per-contact swipe configuration, additional swipe actions, multi-button swipe drawers, or destructive swipe actions** (the swipe contract is exactly two non-destructive gestures with one global preference) and a **permanent in-List gesture tutorial** (gesture education belongs to onboarding). Also out: contact-frequency goals beside recency (deliberately excluded to avoid a cadence progress/game framing), AI-generated adaptive row copy, profile-completeness scoring or gamification, multi-category semantics, and user-controlled density.
</deferred>

---
*Phase: 27-dashboard-list-view*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
