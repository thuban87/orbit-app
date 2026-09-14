# Phase 37: Settings & Personalization - Context

**Gathered:** 2026-09-14 (replaces the 2026-09-02 deferred-planning shim)
**Status:** READY TO PLAN — Phases 22–36 executed; dossier interrogated and grounded against the repo

<domain>
## Phase Boundary

Turn Settings from an accumulated feature surface (today: one monolithic 2,168-line
`ScrollView`) into a navigation-first configuration directory over the preference/admin seams
exported by Phases 22–36. Organization-and-consolidation phase, not a new-feature phase. The
authoritative product contract is the **Phase 37 dossier** (see canonical_refs); this CONTEXT
records only the grounding-check corrections and the decisions settled during discuss.

**Note on provenance:** the Phase 37 dossier was authored externally *without* the milestone-2
cross-dossier collision audit the earlier dossiers received. The D-NN below are the result of
running that check against the live repo — they correct/refine the dossier where it collided
with an ADR, with the earlier stub contract, or with reality. Everywhere the D-NN are silent,
the dossier stands as written.
</domain>

<decisions>
## Implementation Decisions

- **D-01 [informational]:** Ground truth = `docs/dossier/milestone-2/phase-37-settings-personalization-dossier.md`.
  All §A–§S decisions stand EXCEPT where a D-NN below corrects them. Read the dossier in full
  before planning; CONTEXT is the overlay, not a replacement.

- **D-02 [informational]:** Sun color follows **ADR-047** unchanged. Only the self-star color
  (`self_sun_colour`) is user-configurable; a *contact* at the orrery center keeps its
  status-derived glow — it does NOT get a user-chosen color. §D's "sun color … configurable for
  every center choice" is read as: the "Your star" color control stays available regardless of
  the current center selection, NOT that each center gets its own color. No ADR-047 reversal, no
  data-layer change. (owner-confirmed 2026-09-14)

- **D-03:** **Category CRUD is OUT of Phase 37.** There is no category create/rename/delete
  anywhere in the app today — 4 categories are seeded at migration 001 and only ever read
  (contact assignment, Orrery Systems, backup). This overrides the earlier stub contract, which
  placed Category CRUD in the Settings phase. Phase 37 **reserves the Categories IA slot + a
  stable internal route** under Contacts & Relationships → Relationship Structure for a future
  Category Management phase, but does NOT build the CRUD manager or its deletion-cascade fallout
  (Orrery Systems, custom-System rules, Profile category assignments, backup). Per §K's
  no-dead-placeholders principle, do **not** ship a functional or inert Categories row until that
  manager exists — reserve the route name/IA position only. **Roadmap follow-up owed:** a
  "Category Management" phase (CRUD + deletion cascade) is now an unscheduled dependency — raise
  with the owner before or at plan close. (owner-confirmed 2026-09-14)

- **D-04:** Phase 37 **exposes three stub-contract preferences the dossier omitted**, all already
  persisted in `app_settings` (or on the self record) but never surfaced:
  (a) **Compose default message mode** — `default_message_mode` (Text / Email / Remember-last,
  Phase 35); reuses the existing column.
  (b) **Self-name / owner-profile editor** — the id=1 self record has a photo + Orbit Center/star
  but no name editor (`SettingsScreen.tsx:242-243` confirms none ships). Small NEW UI over the
  existing `contacts` row — no new column.
  (c) **Dashboard right-swipe action** — `dashboard_right_swipe_action` (Quick Log vs Log
  Contact); reuses the existing column.
  Category placement delegated to the planner (guidance: (a) and (c) fit **Interactions**; (b)
  fits an owner-profile grouping, Appearance-adjacent). (owner-confirmed 2026-09-14)

- **D-05:** Phase 37 **exposes the GLOBAL default profile layout/background** as a Settings
  control — `profile_layout_template_uid` and `profile_background_template_uid` (global
  `app_settings` PREFs from the profile-presentation migration), distinct from the per-contact
  profile managers. The **per-contact** layout/background managers stay contact-scoped (reachable
  only from a contact's profile); Settings does NOT link them. Guidance: the global default
  control fits **Appearance**. Resolves the dropped stub "Profile managers" route.
  (owner-confirmed 2026-09-14)

- **D-06:** Backup wire format is **v5** on disk (Phase 36 bumped it; the prior shim's "v4" was
  stale). Phase 37 owns no schema by default (§Q). D-04's three additions all reuse existing
  columns / the existing self record, so **no format bump is expected** — the planner must
  confirm this and treat any newly introduced durable/portable preference as owing a **format-6**
  bump, which is an owner decision, never a silent side effect.

- **D-07 [informational]:** Galaxy-conditional appearance controls are **trivial**, not the risk
  §D's planning note feared. The active package is already a reactive value; Mode and Accent
  controls are already per-package; only the Background grid currently renders both packages'
  subgroups. Gating a Galaxy-only control is a one-line guard on `themePackage === "galaxy"` —
  no store/schema change, no theme rewrite. §D's "more involved than expected" caution is
  superseded by the shipped architecture.

- **D-08 [informational]:** Data & Backup dual-home (§I) is feasible. The Backup screen tree
  (`BackupScreen`/`BackupSettingsScreen`/`RestorePreviewScreen`/`RestoreResultScreen`) self-fetches
  and takes only navigation props — it is NOT tab-bound. One canonical tree reachable from both
  the Backup tab and a Settings → Data & Backup route works by registering the four Backup route
  names in `SettingsStackParamList` + `SettingsStack.tsx`. Watch the non-serializable
  `restorePreviewCache` route param and the native shared-backup singleton (`consumeSharedBackup`)
  when dual-mounting. Tab removal stays deferred (§R) — Phase 37 only adds the entry point.

- **D-09 [informational]:** Settings is currently one monolithic 2,168-line screen
  (`src/screens/SettingsScreen.tsx`) with no category sub-routes — only the AI *leaf* routes
  (`AIConnection`, `AIModelPicker`, `AIPersonalization`, `AIPermissions`, `AIPreview`) exist.
  §A's navigation-first directory and §M's addressable routes (Notifications, Orrery, AI hub,
  Data & Backup, …) require building the hub + category routes and decomposing the monolith. Read
  §P's "small shared UI/navigation infrastructure" to include this decomposition — it is the
  phase's core structural work, larger than the phrase implies.
</decisions>

<canonical_refs>
## Canonical References

**Read before planning. The dossier is ground truth; the rest are the grounding-check substrate.**

- `docs/dossier/milestone-2/phase-37-settings-personalization-dossier.md` — GROUND TRUTH product
  contract (§A–§S). MUST read fully.
- `docs/dossier/milestone-2/planning-notes/phase-15-17-18-stub-contracts.md` — the original
  Settings stub. Superseded on **Category CRUD** by D-03, on the **three seams** by D-04, and on
  **Profile-manager routing** by D-05; otherwise still traces every source decision ID.
- `docs/decisions/ADR-047-app-level-assignable-sun-and-themed-self-identity.md` — governs Orbit
  Center / sun / self-star (D-02).
- `docs/decisions/ADR-041-notification-settings-privacy-channels-and-birthday-alerts.md` — governs §G.
- `docs/decisions/ADR-076-population-reached-birthdays-without-a-dashboard-banner.md` — birthday
  *presentation* belongs to Phase 38 / Your Week; Phase 37 §G owns birthday *notification
  settings* only (the seam).
- `docs/decisions/ADR-080-four-tab-bottom-navigation-shell-with-per-tab-stacks.md` — the Backup
  tab (§I / D-08); removal deferred.
- `docs/decisions/ADR-083-durable-multi-package-theme-configuration-and-restore-before-paint.md`,
  `ADR-084-four-semantic-theme-palettes-curated-accents-and-contrast-validation.md`,
  `ADR-087-bundled-background-presets-and-package-specific-surface-treatment.md` — theme model (§D / D-07).
- `docs/decisions/ADR-057-…`, `ADR-058-…`, `ADR-063-…`, `ADR-012-opt-out-android-backup-third-party-pii.md`
  — backup (§I / D-08).
- `.planning/STATE.md` `carried_forward` — the PARKED theme-merge (Galaxy/Standard → Dark/Light)
  will later rework Appearance IA; Phase 37 builds Appearance on the CURRENT package model and
  accepts that rework (see Deferred Ideas).
</canonical_refs>

<code_context>
## Reusable Assets & Integration Points (verified on disk 2026-09-14)

- `src/screens/SettingsScreen.tsx` — the 2,168-line monolith to decompose (D-09). Current rows:
  Appearance (theme/mode/accent/background), Contact methods (phone region, reconcile, flagged),
  Contacts Integration (import), Notifications (10 controls), Interaction Assist, Your photo,
  Your orbit (star color + sun/centre), AI hub, Home-screen widget, Custom Fields, Systems,
  Archived.
- `src/navigation/tabs/SettingsStack.tsx`, `BackupStack.tsx`, `RootNavigator.tsx`,
  `src/navigation/types.ts` — nav structure; AI leaf routes are the only Settings sub-routes today.
  `src/navigation/linking.ts` — deep-link config; open it if addressable Settings routes matter.
- `src/db/app-settings-dao.ts` — the full preference-vs-UI-state inventory lives here
  (`AppSettings` iface, `PortableSettingsSnapshot` export allowlist, `AppSettingsPatch`). Many
  keys are writable/restorable but emission was Phase-36-gated — confirm current emission state.
- `src/theme/*` + `src/stores/theme-store.ts` — package × mode (per-package) × accent × background;
  durable in `app_settings` (migration 015), NO AsyncStorage/persist (D-07).
- `src/backup/*`, `src/services/backup/*`, `src/screens/Backup*Screen.tsx` — tab-independent
  Backup tree (D-08).
- `categories` table (migration 001) — 4 seeded rows, **read-only, zero CRUD** (D-03).
- profile-presentation migration (`profile_layout_template_uid` / `profile_background_template_uid`
  global keys) + `src/components/profile/ProfileTemplateManager.tsx`,
  `ProfileBackgroundManager.tsx` — per-contact managers (D-05).
- `src/screens/settings-ai-hub-logic.ts` — canonical AI hub row/route definitions (§J).
- Widget: `settings-add-widget.ts`, `src/services/widget/*`, `src/navigation/widget-linking.ts` (§L).
</code_context>

<deferred>
## Deferred Ideas

- **Category Management** (CRUD + deletion cascade to Orrery Systems, custom-System rules, Profile
  assignments, backup) — its own future phase (D-03). A roadmap row is owed; raise with owner.
- **Theme-merge** (Galaxy/Standard → Dark/Light, reverses ADR-087) — PARKED as its own phase per
  STATE `carried_forward` (owner decision 2026-09-11). Phase 37 builds Appearance on the current
  package model; that IA will be reworked when theme-merge lands. Do NOT start it here.
- **Backup bottom-tab removal** (§R) — Phase 37 prepares (canonical tree + Settings entry) but
  does not remove the tab.
- **Settings search, global Reset, generic General/Advanced categories, external URL deep-links,
  additional interaction defaults without demonstrated need** (§R) — all deferred.
</deferred>

---
*Phase: 37-settings-personalization*
*Context gathered: 2026-09-14 — grounded against the post-Phase-36 repo; dossier is ground truth, D-NN are the audit overlay*
