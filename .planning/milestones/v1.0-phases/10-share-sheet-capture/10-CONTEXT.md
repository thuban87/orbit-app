# Phase 10: Share-Sheet Capture - Context

**Gathered:** 2026-08-16
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey areas confirmed by owner

<domain>
## Phase Boundary

Zero-friction capture: register Orbit as an Android `text/plain` share target so sharing a
link/text into Orbit lands it as **Conversational Fuel** (Phase 7) against a picked — or
inline-created — contact, durably and fast, then returns the user to the source app.

This phase owns the *mechanics and the flow*: the intent-filter registration
(`expo-share-intent`, patched for `EXTRA_SUBJECT`), the payload→row mapping, the grid-of-faces
pick-contact screen (where the speed lives), the optional note, inline name-only create, and the
confirmation-then-return. It does **NOT** own the fuel table shape (Phase 3/7, settled) or the
inline create form's mechanics (Phase 4, settled) — it composes both.

**Authoritative decision record:** `docs/dossier/10-capture.md` (complete, no `[OPEN]` items) +
`docs/dossier/INDEX.md` capture cross-refs + `HANDOFF.md` §6/§10. Every `[DECIDED]`/`[REJECTED]`
item there is binding and is NOT reopened by this phase. Requirements: CAP-01, CAP-02, CAP-03, CAP-04.

</domain>

<decisions>
## Implementation Decisions

### Grey areas resolved this discuss (owner-confirmed 2026-08-16)

**Multi-select visual (dossier deferred #3).** Long-press enters multi-select (DECIDED); the visual
is a **corner checkmark badge on each selected face plus a persistent bottom "Done · N" bar** that
commits N independent fuel rows. Tap toggles a face; back or Done exits. Single tap outside
multi-select still commits to exactly one contact and closes (unchanged, DECIDED).

**Note + title composition (dossier deferred #1).** When a share carries both a title
(`EXTRA_SUBJECT`) and the user adds an optional note, the fuel **display text = note, then `" — "`,
then the shared title** ("note leads, title appended"). Both survive; the row stays fully editable
later. The canonical `url` stays in its own column, untouched (F-CAP-6 / F-CAP-15 — user prose must
never overwrite the captured payload). Note-only → note is display text; title-only → title is
display text (bare-URL fallback when no `EXTRA_SUBJECT`).

**Confirmation toast (dossier deferred #2).** On commit, show a brief **"Saved to {name}"** toast
(~1.5s), then `finish()` back to the source app. No Undo affordance in v1. (Multi-attach: a single
"Saved to N contacts" style confirmation is acceptable — planner's call on exact copy, same brevity.)

**Empty/near-empty picker + post-inline-create flow (dossier deferred #4 & #5).** The grid shows a
prominent **"＋ New contact" tile** (always present, and the effective only path at 0–1 contacts).
After an inline **name-only** create, Orbit **writes the fuel row and returns to source** (the same
save+return flow) — detail is refined **later on the profile**, NOT via an "add detail now?" prompt.

### Inherited & binding (from dossier — NOT reopened; listed so the planner honors them)

- **Library = `expo-share-intent`**, config-plugin registration to `.MainActivity`; **patched to read
  `EXTRA_SUBJECT`** (it reads `EXTRA_TITLE`; Chrome puts the page title in `EXTRA_SUBJECT`). A
  bare-URL fallback is still required (senders need not set the extra). Patch mechanism
  (patch-package vs config-plugin mod) is a **planning** decision (see deferred).
- **Intent filter registers `text/plain` ONLY** — not `text/*` (error branch for `text/html`), not
  `image/*` (images out of scope). Owner accepts Orbit silently not appearing for `text/html`-only sources.
- **Capture writes the fuel row the moment a contact is picked**, before any note prompt —
  `useShareIntent` defaults `resetOnBackground: true`, so an unsaved payload dies on background.
  Payload durability is load-bearing.
- **Default kind = `topic`, `source='share'`** (never `off_limits`, never anything otherwise
  transmitted). Fuel rows carry `url`, `created_at`, `kind`, `source` from migration 1.
- **Payload → row mapping split:** bare URL (Chrome) → `url`=URL, display=title-from-`EXTRA_SUBJECT`
  else bare URL; plain text → display=text, `url`=null; prose-with-URL → display=prose, `url`=first
  `http…` match.
- **Picker MUST NOT inherit `WHERE last_contact IS NOT NULL`.** It includes never-contacted, excludes
  archived, orders **favourites → capture-MRU → rest**. Capture-MRU is derived from existing fuel
  `created_at` + `contact_id` (no new column). Keyboard closed; search is a demoted tap-to-reveal
  affordance, NOT autofocused, NOT the full dashboard.
- **Contact pick is an in-app SQLite-backed screen**, never a system picker (a system picker
  backgrounds the app and destroys the payload). No Direct Share targets in v1.
- **Capture is NEVER a touchpoint** — no `last_contact` write, no interaction row, not even opt-in.
  Writes go through the **fuel writer (Phase 7)**, never the `last_contact` single-writer DAO.
- **Multi-attach writes N independent fuel rows** (each contact owns its copy — purge semantics
  unchanged), NOT a join table.
- **Inline-create is name-only**, `last_contact` defaults empty (never-contacted) — opposite of the
  standard create form's "today". Fuel `contact_id` is **NOT NULL** — no capture inbox, ever.
- **Return uses plain `finish()`, never `finishAndRemoveTask()`** (former returns to the sharing app;
  latter lands on home). Android 15 top-of-task `finish()` returns to last-active task.
- **`launchMode="singleTask"` is imposed app-wide** by `expo-share-intent` — a side effect Phases
  11/12 inherit (notification/widget taps arrive via `onNewIntent`). Recorded, not this phase's UI.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Fuel writer:** `src/db/fuel-dao.ts` — `addFuel()` (mutexed wrapper) + `addFuelCore()`
  (non-mutexed core, composable in a transaction). This is the capture write path. Fuel shape
  already carries `kind`, `label`, `text`, `url`, `created_at`, `source` (07-01).
- **Avatar:** `src/components/Avatar.tsx` — `contactId` + `cacheBust=modified_at` (recyclingKey
  anti-face-flash). The grid-of-faces reuses it verbatim.
- **Inline create:** `src/db/contacts-dao.ts` — `createContactFull()` composes non-mutexed cores in
  ONE transaction; a name-only path leaves `last_contact` NULL (never-contacted). Reuse for
  inline-create-from-capture.
- **Favourites read:** `listFavourites` / `favourite_rank` (08-03) for the favourites-first band.
- **Capture-MRU:** derivable from `fuel.created_at` + `fuel.contact_id` (fuel-read.ts patterns) — no
  new column, no migration.
- **Never-contacted screen renders fuel** (08-05, DASH-04) — required so captures onto
  new/never-contacted people are visible (F-CAP-13). Already satisfied.

### Established Patterns
- DAO-only writes (never inline in components); `inWriteTransaction` (`src/db/transaction.ts`) is the
  single non-reentrant write mutex — compose non-mutexed cores, never nest the wrapper.
- Correctness-critical logic extracted to react-native-free `-logic.ts` modules, node-tested under
  Vitest (`.tsx` screens are Pixel-UAT). Pure resolver idiom (compose-logic / dashboard-empty-logic).
- Colours ONLY via `useTheme().colors.*` (check:colors gate); `formatLocalDate()` for dates; no
  network on any read path.
- Zustand stores for device-local UI prefs (persist over AsyncStorage), never a SQLite row.

### Integration Points
- **New native dep `expo-share-intent`** → on-device UAT requires `expo prebuild --clean` + release
  APK via the desktop pipeline (a Metro reload will NOT surface the native module).
- `app.config.ts` plugin registration (share-intent config plugin + `EXTRA_SUBJECT` patch); dedupe
  lesson from 01-01 (a bogus plugins entry is a prebuild error).
- react-navigation stack (Phase 4 shell) — the capture picker is a new route reached via the share
  intent, not the dashboard.
- The `launchMode="singleTask"` change is app-wide (`AndroidManifest`/config plugin).

</code_context>

<specifics>
## Specific Ideas

- Cold-start-to-picker latency is bounded by full-app cold start; "zero-friction" success is measured
  on the **physical Pixel 6 Pro** (not the emulator — the emulator can't assess it). If slow, the fix
  is startup work, not share-sheet work (platform FINDING F).
- The `EXTRA_SUBJECT` patch must be re-verified on each Expo SDK bump; upstreaming to
  `expo-share-intent` is the better long-term play (note for later, not this phase).

</specifics>

<deferred>
## Deferred Ideas

### To phase planning (technical — planner decides)
- `EXTRA_SUBJECT` patch mechanism: **patch-package vs a config-plugin mod**, and its re-verify cost.
- Whether the capture picker may query `contacts` **before** the launch-time sweeps/migrations
  complete on a cold-start share (F-CAP-10). A read-only `contacts` query is untouched by a
  `contact_custom_values` `DROP COLUMN`, but this must be decided, not assumed.
- Multi-attach writing N rows in one transaction through the fuel writer.
- On-device checks: cold-start latency (Pixel), patched intent + library re-launch surviving Android
  16 intent-redirection hardening (API-36), and confirming `expo-share-intent` is still the current
  pinned version at build time.

### Out of scope (future / rejected for v1 — do NOT build)
- Direct Share / Android Sharing Shortcuts (native cost + data-leaves-device + decayed-contact
  suppression — REJECTED for v1).
- Capture inbox / nullable `contact_id` (REJECTED — not retrofittable, settled).
- `ACTION_SEND_MULTIPLE`, `ACTION_PROCESS_TEXT`, clipboard capture (future surfaces, not v1).
- Opt-in "and mark contacted" (declined for v1 to keep the capture semantic clean).
- `image/*` capture, network fetch of page titles (REJECTED).

</deferred>
