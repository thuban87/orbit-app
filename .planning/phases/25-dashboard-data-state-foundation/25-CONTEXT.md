# Phase 25: Dashboard Data & State Foundation - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Define the nonvisual Dashboard foundation consumed by the Dashboard Control Surface, List View, and Card View: the result universe, special populations, filter and sort semantics, Dashboard-specific semantic search with relevance and match context, deduplication, persistence, and navigation-state restoration — one shared query/state contract independent of how results are rendered.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01 [informational]:** process directive (honored: research + planner read the dossier in full; the amendment section governs). Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02 [informational]:** process directive (honored: planning-notes read as a binding appendix; every trip-wire enforced in the plans, see D-04..D-07 citations). Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). Milestone order is schema → consumers → backup; the backup v4 bump is Phase 36's final plan. All new durable preferences (population multi-select, view mode, sort mode including the Default-versus-explicit distinction) are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage — replacing today's non-portable `orbit-dashboard-prefs` (R-16).

### Phase-specific constraints
- **D-04 (E-01, ADR-075):** **Favourites are binary membership with no user-visible ranking.** The Manage-favourites drag-reorder screen is retired and the Dashboard never sorts by `favourite_rank`; the widget renders the Favorites population in Default order. This supersedes ADR-033 via ADR-075. **Trip-wire: do not drop the `favourite_rank` column** without a decided fate for `ManageFavouritesScreen.tsx` and the rank-ordered capture / sun / merge picker reads — they either fall back to Default order or the column becomes vestigial.
- **D-05 (E-02, ADR-011 preserved):** **Active Contacts stays status-bearing only** and excludes never-contacted, archived, and unbound contacts. A fifth special population **All Contacts = Active ∪ Not Contacted** provides the union; archived and unbound stay outside it. D-04-027 ("never-contacted remain eligible for Active Contacts") is **not** what ships — ADR-011's read-level segregation survives. **Trip-wire: keep `BASE_WHERE` for Active and build All Contacts as an explicit union predicate — do not weaken `BASE_WHERE`.** Retiring the Never Contacted screen and the `include_unbound_never_contacted` setting is a deletion with consumers (backup portable keys, SettingsScreen); coordinate the key removal with the backup format bump rather than dropping it unilaterally.
- **D-06 (E-04, ADR-076):** ADR-034 is superseded by ADR-076 — relocated birthday presentation moves to the deferred-planning "Your Week" phase; the Dashboard keeps only the Birthday population (next 30 days) and the entry point. The banner's fate is recorded in the dossier and `docs/decisions/` — confirm before planning, and **if the banner is removed while Your Week is unplanned, note the coverage gap rather than silently dropping the surface** (Digest has no birthday read at all today).
- **D-07 (R-11 trip-wire, ADR-062):** Search is today the **only name-lookup path for Unbound contacts**, and this phase removes them from Dashboard search. Provide a replacement retrieval path — give the Unbound child route its own search, or add Unbound to the shared picker's explicit-search path — coordinated once with the Control Surface phase's R-11. Removing Unbound retrieval without a replacement weakens ADR-062's "retrieval stays available" → this is a trip-wire, not a cleanup.
- **D-08 (R-10, ADR-031 ESCALATE trip-wire):** Typo tolerance and knowledge-wide search resolve as **TypeScript scoring over the already-filtered eligible set** — prefix/substring plus edit distance ≤ 1 per term (≤ 2 for six-or-more-character terms). **No FTS5, no new index**; FTS5 would reverse ADR-031 → stop and ask. The corpus depends on the Contact Knowledge phase landing first.
- **D-09:** Search is restricted to the currently eligible Population + Filters universe and never surfaces archived or unbound contacts; while search is active relevance is the primary order and the current Dashboard sort acts only as a tie-breaker. Global search crossing Dashboard/Archived/Unbound universes was explicitly **rejected**.
- **D-10 (architecture):** The query architecture must **not** be coupled to exactly two renderers. List and Card share one query state (never separate population/filter/sort selections), each axis is independently clearable, and a global Reset Dashboard View restores all four while preserving the List/Card preference.
- **D-11 [informational] (AF-08):** for Phase 25 — this is a **render-phase** scope note; Phase 25 is the nonvisual data/state foundation and builds no renderer, so Card View composition is verified in the render phase (26–28) that owns it, not here. Substance preserved, not reversed: The "compact Card/Grid renderer" deferral is stale and struck — **Card View *is* the compact 3-column avatar-first grid**; nothing separate remains deferred.
- **D-13 (owner resolution 2026-09-04, plan-review convergence cycle 2; resolves the D-07 trip-wire's "stop and ask"):** **Phase 25 makes the legacy Home term-search branch bound-only NOW** (`dashboard-read.ts` term branch adds `${DASHBOARD_BOUND_WHERE}` so Unbound `tracking_enabled = 0` contacts stop surfacing — fixes the DASHQ-08 leak where they render as unlabeled cards). The owner **explicitly accepts the one-phase Unbound retrieval gap** between Phase 25 and Phase 26: Unbound contacts have no name-lookup path until Phase 26's replacement (D-07 / ADR-062 / R-11) lands. This is NOT a reversal of D-07 or ADR-062 — the replacement is still coordinated with Phase 26; the owner has answered D-07's trip-wire by accepting the transient gap. The new scoped dashboard search (Plan 04) must still exclude Unbound per DASHQ-08.
- **D-14 (owner resolution 2026-09-04, plan-review convergence cycle 2; resolves the Never-Contacted retirement sequencing):** **Phase 25 retires the standalone `NeverContactedScreen` NOW** per DASHQ-03 / dossier E-02 (legacy Home re-points, no crash; the P25 engine keeps the Not-Contacted data path). The owner **explicitly accepts the one-phase user-facing gap** where Not-Contacted has no chip/control until Phase 26's Not-Contacted population control lands. This confirms the dossier E-02 retirement intent; it is not a reversal. `countNeverContacted` stays for Digest; `listNeverContacted` fate per its plan note.
- **D-12 (owner resolution 2026-09-04, plan-review convergence; clarifies — does not reverse — D-05):** **Currently-snoozed contacts remain IN Active Contacts and IN All Contacts.** Snooze suppression is a property of **Needs Attention**, not of the Active/Default population. Implement DASHQ-05 exactly as written (its requirement text is unchanged). Concretely: the `BASE_WHERE` snooze clause (`c.snooze_until IS NULL OR date(c.snooze_until) <= date('now','localtime')`) **moves out of the Active/Default population predicate into the Needs-Attention derived view**; Active/Default and the All-Contacts union no longer filter on snooze, so a currently-snoozed contact appears once in Active, in All Contacts, and in the Snoozed population. **D-05's "do not weaken `BASE_WHERE`" trip-wire is scoped to ADR-011 read-level segregation only** — the `archived_at IS NULL`, `${DASHBOARD_BOUND_WHERE}` (`tracking_enabled = 1`), and `c.last_contact IS NOT NULL` clauses (the last is load-bearing for `STATUS_SQL`/`progress` NULL-safety) stay intact and unweakened. Relocating the snooze clause is **not** a weakening of that trip-wire. This resolves the review cycle-1 HIGH (DASHQ-05 ↔ D-05 collision). Reconcile the dossier's D-05 wording to note this scoping at KB backfill.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry — including the exact numerical search-scoring weights, which are tuned with fixtures and tests.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-04-dashboard-data-state-foundation-dossier.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-04-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- `docs/decisions/ADR-075-binary-favourite-membership-without-a-user-facing-order.md` — favourites are binary membership; no ranked-favourites UX and no sorting by rank (supersedes ADR-033).
- `docs/decisions/ADR-076-population-reached-birthdays-without-a-dashboard-banner.md` — birthdays are reached via the population and entry point, not a Dashboard banner; richer presentation relocates to Your Week (supersedes ADR-034).
- `docs/decisions/ADR-011-query-time-status-and-never-contacted-segregation.md` — never-contacted contacts stay segregated at read level; Active Contacts is status-bearing only.
- `docs/decisions/ADR-062-bound-unbound-lifecycle-and-one-way-cadence-assignment.md` — unbound-contact lifecycle and the guarantee that retrieval stays available; removing Unbound from Dashboard search requires a replacement path.

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Explicitly do-not-build here: **ranked Favorites as a product concept** (retired along with the Manage-favourites drag-reorder screen and its rank) and **richer imminent/upcoming birthday presentation** (relocated to the deferred Your Week phase; the Dashboard keeps only the population and entry point). Also out: global search crossing Dashboard/Archived/Unbound universes (rejected), remote or indexed search infrastructure, advanced filter families beyond the initial five, arbitrary custom-field filtering, and permanent Dashboard summary modules.
</deferred>

---
*Phase: 25-dashboard-data-state-foundation*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
