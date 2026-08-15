# Phase 4: Contact CRUD & Lifecycle - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey areas drawn from `docs/dossier/06-crud.md` "Deferred to phase discussion"; all three areas accepted as recommended by owner.

<domain>
## Phase Boundary

Create-person and edit-person as native screens (schema-renderer pattern), the whole-contact
lifecycle surfaces (archive / restore / explicit purge), the contact profile scaffold, and the
new `contact_links` child table. Owns: the lean create flow (§14.7 `show_on_new`), the always-show
edit flow (§14.7), the inline name-only create path 03-fuel depends on, validation-at-entry
(§14.3), the reach fields (`phone`, `email`, links), the "Rarely responds" toggle, and where the
archived-contacts list lives.

**Excludes** (owned elsewhere, per 06-crud cross-domain exports): custom-field *definition* editor
internals and type-change machinery (domain `fields` / HANDOFF §14); photo capture mechanics
(domain `photos`); the profile/dashboard *read* surfaces themselves; favourites rank (dashboard/
widget), `ring_seq` drag + sun assignment (orrery).

**Requirements:** CRUD-01 … CRUD-06.
</domain>

<decisions>
## Implementation Decisions

> Inherited & already settled by `06-crud.md` (NOT reopened): create form asks a lean fixed set
> (name, category, frequency, last-spoke, phone) + `show_on_new` custom fields; fixed columns render
> as a block, custom fields grouped after (never interleaved); defining a custom field is a settings
> trip (no inline "+add field"); frequency picker = 7 presets **plus** custom "every N"; rename is a
> metadata-only UPDATE; duplicate names warn but don't block; archive→restore→purge is two-stage,
> purge shows an impact-summary single-confirm (no name typing); never-contacted and archived are
> **separate** homes; create writes contact + (optional) interaction atomically through the
> single-writer DAO; backdated create interaction is `source='manual'`, `direction=null`; purge
> DELETEs `contact_links` + interactions + events + fuel + custom values + photo file + scheduled
> notifications in one transaction; "Rarely responds" is an edit-form toggle, not folded into the
> frequency picker.

### Area 1 — Archive & Purge surfaces (owner accepted all)
- The **Archived contacts** list lives **in Settings** — a distinct, low-traffic row (not a top-level
  nav tab, not a dashboard filter). Matches 06-crud's "distinct, low-traffic entry."
- The Archived entry shows **no count badge** — the screen states its count when opened; a bin does
  not need an attention badge.
- The profile **"Archive"** action lives in a **low-emphasis overflow (⋯) menu** on the profile
  header — keeps the (reversible) archive action away from prominence and never one tap from purge.
- The purge action on the archived list is labelled **"Delete permanently"** with
  **destructive/red styling via a theme danger token**, sitting behind the already-decided
  impact-summary confirm.

### Area 2 — Contact links affordance (owner accepted all)
- Links carry an **optional label** (matches the `contact_links` shape); an unlabelled link shows its
  host/URL.
- **No label autocomplete in v1** — keep the links area lean; revisit if repeated labels accumulate.
- An actionable link opens as a **web URL**: prepend `https://` when no scheme is present and call
  `Linking.openURL` inside try/catch — deliberately sidesteps the Android-11 `<queries>` /
  `canOpenURL` manifest work (the `AndroidManifest <queries>` plugin stays deferred/unneeded for links;
  `phone`/`email` keep their own `tel:`/`mailto:` dedicated inputs).
- Links support **add / edit / remove in insertion order** in v1 — the `sort` column exists in the DDL
  but no drag-to-reorder UI ships yet.

### Area 3 — Create form & copy (owner accepted all)
- The last-spoke control is a **tri-state segmented control: `Today · Pick date · Not yet`**, with
  "Not yet" visually distinct so the never-contacted/backlog case reads honestly. "Not yet" writes the
  `contacts` row with **NULL `last_contact` and no interaction row**; "Today"/"Pick date" write an
  interaction row through the DAO (future dates rejected at entry, per 04-log).
- A capture-created **name-only** contact refines later via a prominent **"Add details"** affordance on
  its profile that opens the **full edit form**, surfacing **frequency + last-spoke + phone first**
  (they drive the decay→SMS core loop). No separate slim mini-form.
- The **duplicate-name warning fires on save** (non-blocking: "You already have a Chris — save
  anyway?"), symmetric across create and edit — avoids querying on every keystroke.
- **"Rarely responds" copy accepted as dossier-specified**: toggle labelled "Rarely responds" with
  helper "Attempts to reach out won't reset their orbit"; profile renders
  "Rarely responds · attempts don't reset the orbit."

### Navigation shell (resolved during planning, 2026-08-14 — owner)
- Phase 4 introduces the app's **real navigation shell** using **`@react-navigation/native` with the
  native-stack navigator** (owner-approved). This fulfills the Phase-3 forward note
  (`HomeScreen.tsx`: "Phase 4 introduces the real navigation shell") and the dossier's platform
  workpapers, which design against `@react-navigation/native` by name (`useFocusEffect`,
  `useIsFocused`, navigator deep-link reset for dashboard/orrery/widget). Reverses nothing — the
  prior "dependency-free routing" was an explicitly temporary Phase-1→3 state.
- Adds native deps (`react-native-screens`, `react-native-safe-area-context`) via `npx expo install`;
  requires a native rebuild through the desktop pipeline. Install via `expo install` (not bare npm).
- The existing hand-rolled `HomeScreen` `useState` route is migrated into the navigator; the
  Custom-Fields reachability route relocates into a Settings stack alongside the new Archived-contacts
  screen. `rejected: expo-router` (larger file-based refactor for the same engine), `rejected:
  keep hand-rolled` (reinvents back-stack/params for 15+ screens).

### Claude's Discretion (deferred to planning by 06-crud)
- Single-renderer-vs-two-sections form architecture (fixed columns need widgets the 7-type
  `FieldType` union can't express: category-over-live-table, `interval_days`, partial-date birthday,
  tri-state last-contact, native image picker).
- Edit-form initial-values assembly (JOIN of `contacts` + `contact_custom_values` row + `category_id`
  → label) via the §14.10 dynamic query layer.
- Splitting the submitted form dict into two writers (fixed `contacts` columns + custom-values row) in
  one transaction.
- Custom-interval frequency entry: unit affordance (days/weeks/months → `interval_days`) and
  positive-integer validation.
- Per-type validation-at-entry wiring for the fixed columns (duplicate-name query, partial-date
  birthday, phone format-or-not, category resolution).
- The `contact_links` table DDL (stable uid, `sort` column) and its inclusion in export/restore.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Predecessor plugin (`~/projects/Orbit`) `FormRenderer.tsx` (316 lines, 7 field types) ports
  **structurally**; the markdown-file plumbing around it dies (06-crud F4). The dropdown "raw value"
  escape hatch is dropped (no vault drift to preserve).
- Phase 2/3 data layer: the single-writer `last_contact` DAO, the shared `inWriteTransaction`
  (`src/db/transaction.ts`), `col-name.ts` whitelist slugifier, the §14.10 dynamic query layer for
  custom values, and `formatLocalDate()` (`src/utils/dates.ts`).
- Category + social-battery use native pickers (`@react-native-picker/picker` or `@expo/ui`); no JS
  `<select>` shim needed (06-crud F3).

### Established Patterns
- All colours resolve through theme tokens (incl. the new danger/destructive token for purge).
- Zustand stores in `src/stores/`; DAOs in `src/db/` (never inline queries in components).
- `formatLocalDate()` on the TS side, `date('now','localtime')` in SQL — never `toISOString()`.

### Integration Points
- `contact_links` is a **new child table** (stable uid, `contact_id`, `url`, optional label, `sort`)
  — a migration (added forward-only, never editing a shipped migration) plus export/restore inclusion
  and explicit purge DELETE.
- Reachability route currently a `HomeScreen` `useState` (Phase 3, Plan 03-08) — Phase 4 relocates it
  into Settings alongside the new Archived-contacts entry.
- The native Android date picker has no month+day-only mode → year-optional birthday is app logic
  ("year unknown" toggle), not a picker mode (06-crud F3, Decision-without-you 5).
</code_context>

<specifics>
## Specific Ideas

- Purge confirmation copy pattern (from 06-crud, decided): *"Permanently delete Chris and 12
  interactions, 4 fuel items, 1 photo? This cannot be undone."* — a single strong confirm.
- "Rarely responds" profile label: *"Rarely responds · attempts don't reset the orbit."*
- Duplicate-name warning: *"You already have a Chris — save anyway?"* (create + edit).
</specifics>

<deferred>
## Deferred Ideas

- Label autocomplete for links (revisit post-v1 if repeated labels accumulate).
- Drag-to-reorder for links (the `sort` column is ready; UI deferred).
- A count badge on the Archived entry (declined for v1).
</deferred>
