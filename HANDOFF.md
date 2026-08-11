# Orbit (mobile) — Project Handoff

**Purpose of this document.** Orbit currently exists as an Obsidian plugin (`~/projects/Orbit`, repo `thuban87/Orbit`, v0.9.0, MIT). This document captures every decision made during the planning session that produced this project, so a fresh agent can start work in `~/projects/orbit-app` without re-litigating settled questions.

Everything below is tagged:

- **[DECIDED]** — settled. Do not reopen without the owner explicitly saying so.
- **[OPEN]** — discussed but not resolved. Needs an owner decision before it is implemented.
- **[UNEXPLORED]** — named as future work, not yet discussed in any depth.

---

## 1. What Orbit is

A personal relationship manager — a CRM for your own social life, not for sales. It tracks contacts, how overdue each one is for a check-in, and what you might talk about next time.

The underlying premise driving the product: **familiarity is a function of contact frequency, not depth per contact.** The app exists to make frequent, low-effort, no-obligation check-ins nearly frictionless. Every design decision should be measured against "does this reduce the number of taps between the reminder and the message actually being sent."

### Existing feature set (Obsidian plugin, v0.9.0)

Visual contact dashboard with color-coded status rings · "Orbit Hub" central management modal · automatic `[[Contact Name]]` link detection · "Conversational Fuel" tooltips (saved topics for the next conversation) · custom contact schemas · birthday alerts · weekly digest · right-click quick actions · optional AI message suggestions (5 providers: Ollama, OpenAI, Anthropic, Gemini, custom OpenAI-compatible endpoint).

---

## 2. Platform and stack

| Decision | Status |
|---|---|
| React Native / Expo, Android first, iOS later | **[DECIDED]** |
| TypeScript throughout | **[DECIDED]** |
| Built in tandem with quest-board-app, which remains the priority (pre-launch crunch) | **[DECIDED]** |
| Reuse quest-board's RN scaffolding, build pipeline, and theme-token pattern wherever possible | **[DECIDED]** |
| Initially personal-use, architected as if a public release will follow | **[DECIDED]** |
| Public launch timing — after quest-board is live | **[OPEN]** |

---

## 3. Data layer

### [DECIDED] Local-first. On-device SQLite. No cloud backend.

`expo-sqlite` (or `op-sqlite` if profiling shows a need). The database file lives in the app's private sandbox on the device.

**Rationale, in order of weight:**

1. **Privacy is the product.** Orbit stores notes about other people — who is struggling, what they told you in confidence. Cloud storage would make the owner custodian of third parties' private information, and those third parties never consented to anything. "Never leaves your phone" is a promise no cloud competitor can match.
2. **Market signal.** Research during the session found repeated user demand on competitor products for exactly two things: an Android version, and real privacy guarantees.
3. **No lock-in, no shutdown risk.** UpHabit (a competitor) shut down ~April 2026 and took its users' relationship histories with it. Dex charges $12/month with no free tier, so lapsing means losing access to data you spent years building. A local database structurally cannot do either of these things to a user.
4. **No per-user server cost**, which makes a subscription unnecessary.

### [DECIDED] Supabase is explicitly rejected for this app

Considered and dropped. The owner's original motivation for including it was to gain experience giving AI agents direct control of a database before doing so on quest-board (which is near launch and revenue-bearing). That is a legitimate goal but it is being moved to a different project — see §11.

A hybrid split (local SQLite for sensitive data, Supabase for "operational" data) was proposed and rejected: in a relationship CRM essentially all data is sensitive, so the cloud half would have been reduced to settings and schema definitions — too thin to be a useful exercise, while still incurring the complexity of two data layers.

### [DECIDED] Migration path stays open

Contact volume is tens of rows, not millions. If cloud sync is ever wanted, it gets added as an **opt-in sync layer over a working local database** — never the reverse. Reversing that order is far more expensive.

### On-device SQLite operating model — read this before touching schema

This differs fundamentally from Supabase and the difference has caught the owner out before:

- There is **no server, no dashboard, no connection string, and no remote access**. Nobody — including the developer — can reach into a user's device to inspect or repair their data.
- **Schema changes ship as application code.** Use the `PRAGMA user_version` pattern: on launch, read `user_version`, compare against the version the code expects, run migration functions in sequence, write the new value. `expo-sqlite` ships a helper for this.
- **Migrations are forward-only and must run in strict order.** Assume any user may jump from v1 directly to v6. Never write a migration that assumes a particular starting state.
- **There is no RPC equivalent.** Postgres server-side functions have no counterpart; that logic lives in TypeScript.
- **There are no automatic backups.** JSON export/import must be built deliberately — and it doubles as the anti-lock-in feature that differentiates the product.

### [DECIDED] Offline reads must always work

The core use case is opening the app on a train. Even with a local DB this means: no blocking network calls on the dashboard path. AI suggestions are the only network-dependent feature and must degrade gracefully.

### [OPEN] Backup and export

JSON export is agreed in principle. Unresolved: whether to add encrypted backup to the user's own cloud (Google Drive / Nextcloud), automatic local rotation, or manual export only.

---

## 4. Port analysis — verified against the repo, not estimated

Total plugin source: ~6,100 lines across 34 files in `src/`.

### Ports nearly as-is (~900 lines)

| File | Lines | Notes |
|---|---|---|
| `src/services/AiService.ts` | 540 | **Zero Obsidian references.** Sole coupling is `import { requestUrl } from 'obsidian'` — swap for `fetch`. Contains all 5 provider implementations behind a common interface. Highest-value single port in the codebase. |
| `src/types.ts` → `calculateStatus()` | ~25 | Pure function. `daysSince` vs `FREQUENCY_DAYS[frequency]`, thresholds at 80% and 100% → `stable` / `wobble` / `decay`. Copy verbatim. |
| `src/types.ts` → `FREQUENCY_DAYS`, `Frequency`, `OrbitStatus`, `SocialBattery`, `LastInteractionType` | — | Pure constants and type unions. |
| `src/schemas/types.ts` | 99 | Zero Obsidian. `FieldType`, `FieldDef`, `SchemaDef`. |
| `src/schemas/new-person.schema.ts` | 72 | Zero Obsidian. |
| `src/schemas/edit-person.schema.ts` | 72 | Zero Obsidian. |
| `src/utils/dates.ts` | 22 | Pure. `formatLocalDate()` — deliberately avoids the `toISOString()` UTC off-by-one. Keep the comment. |
| `src/utils/logger.ts` | 43 | Pure. |

**One contamination to fix first:** `src/types.ts` line 1 imports `TFile` from `obsidian`, and `OrbitContact` carries `file: TFile` as a core field. Strip or generalise this to an opaque ref and `types.ts` becomes 100% portable.

### Rewritten against SQLite (logic shapes reusable, implementation not)

| File | Lines | Obsidian refs | Replacement |
|---|---|---|---|
| `src/services/OrbitIndex.ts` | 425 | 31 | Vault scanner → SQL queries. The `statusOrder` sort (`decay` 0, `wobble` 1, `stable` 2, `snoozed` 3) is reusable. |
| `src/schemas/loader.ts` | 479 | 23 | Reads schema files from the vault. Custom-schema concept ports; plumbing does not. |
| `src/services/ContactManager.ts` | 217 | 25 | `vault.process()` / `processFrontMatter()` → SQLite DAO. Operation shapes port. |
| `src/settings.ts` | 504 | 12 | Obsidian settings tab → RN settings screens. |

### Rewritten entirely — UI

All 9 components plus 2 views plus 6 modals. The plugin **is** React (`react` 18.2 + `react-dom`), but React DOM and React Native share no rendering primitives — no `div`, no CSS, no `styles.css`. `src/context/OrbitContext.tsx` (84 lines) and the state patterns inside components carry over as reference.

The owner regards this as an upside: full freedom to redesign.

### Delete — Obsidian-only, no mobile analogue

`src/services/LinkListener.ts` (179) · `src/utils/ImageScraper.ts` (151) · `src/utils/FolderSuggest.ts` (63) · `src/utils/paths.ts` (60) · `src/modals/ReactModal.ts` (64) · `src/main.ts` (407, plugin lifecycle).

---

## 5. Repo structure and access to the old code

### [DECIDED] New repo at `~/projects/orbit-app`, sibling to the existing `~/projects/Orbit`

The owner keeps ~8 independent git repos side by side under `~/projects/`. That organisation stays as it is.

### [DECIDED] Do not clone the old repo into the new one and gitignore it

Claude Code's search tools use ripgrep, which respects `.gitignore` by default. A gitignored reference copy is **invisible to Glob and Grep** — discoverable only if the agent already knows the exact path. It would also drift from upstream.

### [DECIDED] Extract the portable source, and give agents full read access to the old repo in place

Day one: copy the files listed in §4 "ports nearly as-is" into the new repo as real, tracked, linted, tested source.

Beyond that, agents reference `~/projects/Orbit` **directly at its own path** rather than working from a carved-out subset. The owner's reasoning: full access to source, tests, docs, and git history beats a curated extract, because it is impossible to predict in advance which reference question will come up. Use `/add-dir ~/projects/Orbit` when a session needs it.

That clone is current — the owner's primary development copy was on his Windows machine, pushed to GitHub and cloned to the Linux box specifically so agents can read it. Treat it as up to date with `main`.

The old repo also carries user-facing docs worth consulting: `docs/Getting Started.md`, `Orbit Hub.md`, `Adding People.md`, `Custom Schemas.md`, `Updating and Editing.md`, `Weekly Digest.md`, `AI Features.md`, `Sidebar View.md`.

---

## 6. Friction reduction — the features that decide whether this works

The Obsidian version fell out of use because capture was too high-friction. **This is the primary product risk and these features are not optional polish.**

### [DECIDED] Share-sheet target

Register Orbit as an Android share target. Share a link, article, or text into Orbit → pick a contact → attaches as Conversational Fuel. Zero-friction capture.

### [DECIDED] Actionable notifications

Local notifications via `expo-notifications` — no backend required. A decay notification must carry a direct action that opens the SMS composer for that contact, with their Conversational Fuel visible. Reminder and action collapse into one tap.

### [DECIDED] Home screen widget

React Native **cannot** render Android widgets — they are native `RemoteViews` with XML layouts. Use `react-native-android-widget`, which compiles a JSX-like definition down to RemoteViews. Requires a custom dev client / prebuild; **not compatible with Expo Go**.

**Hard platform constraint: text input inside an Android widget is impossible.** `RemoteViews` has no editable field. Typed quick-entry from the widget cannot be built.

Agreed design: a grid of favourite contacts. Tap → one-tap preset action (primary: "mark contacted"). Long-press → deep link to that contact's profile. Tapping to swap the widget into a profile view is technically possible (widgets can update themselves) and is a stretch goal.

**[OPEN]** The exact set of preset widget actions.

---

## 7. Visual design

### [DECIDED] Space theme throughout

The metaphor already matches the data model — orbital decay *is* the status system — so visuals and logic reinforce each other.

- Round profile photos with rings around them, styled as planets.
- Starfield background, but **dashboard/orbit screens only**, not behind text-heavy screens where contrast suffers.
- If the starfield animates, it must be a static image or a very cheap shader. A particle field redrawing behind every screen is a battery complaint.

### [DECIDED] Two distinct screens — do not merge them

| Screen | Purpose |
|---|---|
| **Dashboard** | Classic layout. Cards or grid of contacts. Themed light/dark backgrounds. The everyday working screen. |
| **Orbit view** (orrery) | The animated solar-system visualisation. A glanceable overview, not the primary interface. |

### [DECIDED] Theme tokens

Every colour goes through a token pointing at the active theme profile, matching the quest-board pattern, so a user changing theme restyles the entire app. No hardcoded colours anywhere.

### The orrery — settled mechanics

- **[DECIDED] Sun at centre**, carrying the user's own profile photo.
- **[DECIDED] Angular position encodes progress through the contact interval.** Marking someone contacted resets them to the start of their arc; they sweep round as days pass; completing the circuit means they are due. Roughly 5 degrees per day of inactivity — deliberately near-static motion, not a fast animation.
- **[DECIDED] Every contact gets their own orbit ring.** This is the resolution to the overcrowding problem: contacts marked on the same day share an *angle* but never a *radius*, so they cannot stack. It is also more faithful to the motif — planets do not share orbits. Rings are ordered by frequency, so `Daily` contacts sit innermost and `Yearly` outermost, and radius continues to read as "how close this person is meant to be."
- **[DECIDED] Status is encoded without altering motion.** Colour on body and ring (existing stable/wobble/decay), ring style (solid → dashed → faded), and decayed contacts drifting outward past their assigned ring so "out of orbit" becomes literal while they stay on rails and stay tappable.
- **[REJECTED] Differentiated per-band animation** (wobble contacts moving irregularly, decayed contacts floating free with no orbit lines). Rejected because it destroys positional information precisely for the contacts the user most needs to find and act on, and makes them hard to tap. Motion encodes data, not mood.
- **[DECIDED] Elliptical orbits wider than the viewport.** Left and right extremes sit off-screen; a visible arc above centre and an inverted arc below. A body leaving the top-right arc re-enters on the bottom-right arc, travelling the unseen portion quickly. Consequence to keep straight: angle-to-time becomes piecewise rather than linear. Acceptable provided the *visible* arcs map consistently — simplest is for the top arc to carry the first half of the interval and the bottom arc the second.
- **[DECIDED] Tap-to-freeze**, so a moving body is never hard to hit.

### Rendering

- **[DECIDED] `react-native-skia`.** Do **not** animate via React state — `setState` per frame re-renders the tree 60× a second on the JS thread and will crawl. Skia runs its own render loop off the JS thread. Pair with Reanimated for gestures. The starfield comes essentially free.
- **[DECIDED]** Performance is not a concern at this scale — tens of bodies, not thousands. The risk is method, not volume.
- **[DECIDED] Pause all animation on `useIsFocused` false and on `AppState` background.** Nothing animates when nobody is looking.

---

## 8. Product positioning

### [DECIDED] Differentiators, all three answering complaints users are already making about competitors

1. **Android-first** — the field is overwhelmingly iOS-first.
2. **Private by construction** — data never leaves the device.
3. **No subscription** — no per-user server cost means none is needed.

### [OPEN] Monetisation

Discussed, not settled. Candidates: one-time purchase; free with paid AI features where the user supplies their own API key; free entirely. Note the plugin's AI layer already supports user-supplied keys for 5 providers, which makes BYO-key a natural fit.

### Competitive landscape as assessed

| Product | Assessment |
|---|---|
| **Monica** | Open source, self-hostable free or $9/mo hosted. Web only. CRM functionality judged lackluster. Self-host-or-subscribe model is worth emulating. **Check the license before borrowing any code** — copyleft (AGPL is common for self-hostable projects) would bind a released app to the same terms. Reading for architecture is always fine. |
| **Dex** | Well built — web, iOS, Android, browser extensions. $12/mo with no free tier. Owner would use it if not for cost and lock-in. The strongest competitor. |
| **Clay** | Professional/networking CRM, not the personal-social angle. Not a direct competitor. |
| **UpHabit** | Shut down ~April 2026. The strongest available argument for local-first. |

---

## 9. Security posture (settled context, carried from the session)

Relevant background, because it drove the local-first decision and applies to the owner's other projects:

- BaaS providers (Supabase, Firebase) provide **encryption in transit (TLS)** and **encryption at rest** (encrypted disks). **Neither is end-to-end encryption.** Encryption at rest defends against physical theft of a drive. It does nothing against anyone holding valid credentials — which includes the developer, who can read every row in plaintext from the dashboard.
- "We use a secure provider" and "your data never leaves your phone" are different promises. Only the second survives a skeptical user.
- For Orbit specifically, local-first sidesteps the entire question. There is no server-side data to leak, subpoena, or misconfigure.

---

## 10. Contact list driving the personal use case

The owner's initial focus list for the check-in habit the app supports. Useful as realistic seed data and for reasoning about scale:

Phil · Chris · Andrew · David · Mom (Colleen) · Dad (Jim) · Daniel. Jamie as alternate.

Seven to eight active contacts is the realistic working set. **Design for tens of contacts, not thousands.** This is what makes per-contact orbit rings viable and makes any future data migration trivial.

---

## 11. Explicitly out of scope

- **[DECIDED] Agent-controlled-database experimentation does not happen in this project.** It has been moved to **Mise** (the owner's recipe / kitchen inventory / grocery / meal-prep app), where the data — recipes and pantry contents — is genuinely non-sensitive and an agent can break things without stakes.
- **[DECIDED] No end-to-end encryption work.** Moot for a local-only database.
- **[DECIDED] iOS is deferred**, not cancelled.

---

## 12. Open questions summary

| # | Question | Notes |
|---|---|---|
| 1 | Monetisation model | §8 |
| 2 | Backup/export strategy beyond manual JSON | §3 |
| 3 | Exact preset widget actions | §6 |
| 4 | Dashboard card/grid layout specifics | Owner intends to design this directly with a Claude Code agent |
| 5 | Quarantine window length; whether user-configurable | §14.5 — 30 days is the working assumption. Rest of the custom-fields design is settled. |
| 6 | Public launch timing and app store presence | Gated on quest-board launch |
| 7 | Whether to keep "Weekly Digest" and "Birthday alerts" in v1 | Both exist in the plugin; neither has been discussed for mobile |

---

## 13. Tooling

### [DECIDED] GSD and Graphify from the start

Both are in use from day one, matching quest-board. `.planning/` for the phase workspace, Graphify as the discovery index. See `CLAUDE.md` for operating rules — particularly the build discipline, since the stock graphify build silently corrupts the graph.

Two supporting pieces must be ported from `~/projects/quest-board-app` **before the first graph build**, or ADR nodes will be missing or silently stale: `docs/decisions/adr-registry.ts` (generated; graphify only mints ADR nodes from `ADR-NNN` tokens in JS/TS comments, so markdown alone produces nothing) and `scripts/normalize-graph-docrefs.ts` (repairs a graphify bug that scatters one ADR into N disconnected nodes).

Quest-board's `qb-extract-phase-kb` skill is project-specific. An equivalent needs creating here before the first phase completes.

### [DECIDED] The Roadmap Workshop is not used

Quest-board's owner-operated roadmap planner at `/planner`, with its `planner.sqlite` state and dashboard service, is deliberately excluded. It exists to reconcile forward engineering with business work across version boundaries — overhead this project does not need.

---

## 14. Custom fields — [DECIDED] in v1, as its own phase

Custom contact fields ship in v1. **Reversed from an earlier lean toward deferral**, on the owner's call.

Rationale: he is the first daily user and will hit missing fields within a week of real use. Building it now also forces the data model to be correct in practice rather than in theory, and avoids a later migration against devices that cannot be reached.

> **Terminology.** The user-facing concept is a **custom field**. Avoid "custom column" in UI copy and discussion — the same field is a *row* in one table and a *column* in another, and mixing the words causes confusion. See the storage model below.

### 14.1 Storage model — [DECIDED] two tables

Rejected alternative: a single `custom_fields` JSON column on `contacts`. It works, but renaming a field means rewriting every row's JSON, with partial-write risk and no way to inspect the damage on a device you cannot reach.

```
custom_field_defs                    ← the DEFINITION. One ROW per field.
┌────┬──────────┬───────┬────────┬─────────┬──────────────┬────────────────┐
│ id │ col_name │ label │ type   │ options │ show_on_new  │ quarantined_at │
├────┼──────────┼───────┼────────┼─────────┼──────────────┼────────────────┤
│ 1  │ pets     │ Pets  │ number │ null    │ false        │ null           │
└────┴──────────┴───────┴────────┴─────────┴──────────────┴────────────────┘

contact_custom_values                ← the DATA. One COLUMN per field, one ROW per contact.
┌────────────┬──────┐
│ contact_id │ pets │
├────────────┼──────┤
│ Bob        │ 3    │
│ Phil       │ 0    │
│ Andrew     │ null │
└────────────┴──────┘
```

Creating a field is one transaction: `INSERT` a def row **and** `ALTER TABLE contact_custom_values ADD COLUMN`.

**Why real columns rather than JSON:** renaming is `ALTER TABLE ... RENAME COLUMN`, a metadata-only operation — instant, atomic, touching zero rows. That single property is the reason for this design.

### 14.2 [DECIDED] Every value column is declared TEXT, permanently

Two distinct concepts share the word "type." Keep them separate in code and in conversation:

| Concept | Where it lives | Changes? | Visible to user? |
|---|---|---|---|
| **Storage type** | The SQLite column declaration | **Never.** Always TEXT. | No |
| **Field type** | `custom_field_defs.type` | Yes — user-editable | Yes — determines the input widget |

SQLite uses type *affinity*, not strict typing: an INTEGER column accepts `"about 60k"` anyway. The declared type does almost nothing, so declaring everything TEXT costs nothing and **eliminates the entire `ALTER COLUMN TYPE` problem.** SQLite has no such statement; the workaround is a four-step add/copy/drop/rename dance. Declaring TEXT means that dance never runs.

**Consequence: a field type change is one `UPDATE` on one row in `custom_field_defs`.** No column is touched. No contact's data moves. Blast radius is zero.

**The one place this leaks:** numbers stored as text sort lexicographically (`"10"` before `"9"`). Handled in exactly one function in the query layer, which every sort and filter on a custom field must route through:

```ts
function sortExpr(field: FieldDef): string {
  switch (field.type) {
    case 'number': return `CAST(${field.col_name} AS REAL)`;
    case 'date':   return field.col_name;   // ISO strings sort correctly as text
    case 'toggle': return `CAST(${field.col_name} AS INTEGER)`;
    default:       return field.col_name;
  }
}
```

Written once, needs no maintenance when a field's type changes. **Nowhere else in the codebase should the TEXT-storage decision be observable** — reading, writing, rendering, and validating are all unaffected.

### 14.3 [DECIDED] Type enforcement is the UI's job, not the database's

SQLite will not reject bad values, so validation happens at entry:

- `number` → numeric keypad and stepper; only numeric input accepted
- `date` → date picker
- `toggle` → switch
- `dropdown` → picker constrained to `options`
- `text` / `textarea` → **accept anything, including digits.** "Apartment 3B" and "2 dogs, 1 cat" are legitimate text. Do not reject numerals in text fields.
- `photo` → native image picker with local file storage (**differs from the plugin**, which used a URL text input)

### 14.4 [DECIDED] Type changes — automatic conversion with flagged exceptions

Because storage is always TEXT, the *source* type is irrelevant. You are always parsing a string into the target type, so this needs **one parser per target type (7 total)**, not one converter per type pair (42). Adding a field type later adds one parser, not seven.

Flow when a user changes a field's type:

1. Pre-flight scans all stored values through the target type's parser.
2. Values that parse cleanly **convert automatically**.
3. Values that don't are **flagged, not destroyed**.
4. User sees a summary: *"8 of 12 values will convert automatically. 4 need your input — fix now or later."*
5. Unresolved values stay untouched in the database and render on the profile as an error state: *"Pets: unrecognized value '3' — tap to fix,"* opening the correct widget in one gesture.

**Write parsers permissively.** For a boolean target: `"3"` → yes, `"0"` → no, `"yes"/"true"/"y"` → yes, `"none"/"no"/"false"` → no, empty/null → null. Nonzero means yes. Every case the parser handles is one fewer landing on the user, and improvements go in one function.

**No data is ever destroyed by a type change**, and no exhaustive enumeration of conversion scenarios is required — unanticipated cases simply surface as flags.

**Do not add a "run the conversion?" confirmation.** The pre-flight summary already shows what will happen; a second prompt is friction with no new information.

### 14.5 [DECIDED] Deletion — dynamic action, quarantine, undo

`DROP COLUMN` is instantaneous and unrecoverable. There is no server, no backup, and no dashboard — deleting a populated field destroys every contact's value for it with no path to recovery.

**The settings action is dynamic — both label and behavior change based on whether the field holds data:**

| Field state | Action presented | Behavior |
|---|---|---|
| No values stored | **Delete** | Immediate. Harmless. |
| Any values stored | **Quarantine** | Reversible for 30 days. Immediate delete is not offered. |

**Quarantine:** set `quarantined_at`. The UI stops rendering the field everywhere. **Data is untouched.** Restore nulls the timestamp.

**Expiry:** SQLite has no scheduler or daemon, and triggers fire only on data events, never on elapsed time. **Nothing can watch a timestamp.** The sweep runs on app launch: find defs rows quarantined past the window, delete them.

**Cascading deletes do not apply.** `ON DELETE CASCADE` operates on foreign keys between *rows* and deletes rows — no SQL database drops a column in response to a row deletion. The sweep must do both explicitly, in one transaction:

```sql
BEGIN;
  DELETE FROM custom_field_defs WHERE id = 1;
  ALTER TABLE contact_custom_values DROP COLUMN pets;
COMMIT;
```

Both succeed or neither does — no orphaned columns, no orphaned definitions.

**[OPEN]** Quarantine window length, and whether it is user-configurable. 30 days is the working assumption.

### 14.6 [DECIDED] Snapshot table for undo

One mechanism, two uses: type-change conversions and quarantine expiry.

Before any destructive operation, copy affected values into a `field_history` table (contact id, field key, old value, timestamp, operation). Wrap the operation in a transaction — SQLite is fully ACID, so it completes or rolls back entirely, never leaving a half-converted state. Sweep history on the same 30-day schedule.

This is the only recovery mechanism that exists. There is no other backstop.

### 14.7 [DECIDED] Where fields appear

Three surfaces, only one of which is configurable:

| Surface | Configuration | Rationale |
|---|---|---|
| **New contact form** | Per-field `show_on_new` flag | Worth curating — creating a contact should not demand 15 fields. Birthdays are rarely known at first meeting. |
| **Edit contact form** | **None. Always shows every non-quarantined field.** | The user is explicitly there to change things. Hiding a field would force a settings trip just to record a birthday. |
| **Profile display** | Automatic + one global toggle per field | See below |

**Profile display rule:** a field shows on a profile **whenever it has a value**. A per-field global setting — "show even when empty" — makes it appear on every profile regardless.

Worked example: Pets. Leave the global off and profiles with no pet data stay uncluttered. Turn it on and every profile shows Pets, including zeros, so absence is visible at a glance.

**[DECIDED — dropped] Per-profile view options.** An earlier design had a per-profile field picker layered under a global setting. Removed: the value-presence rule covers the same need with no configuration, no per-profile state to store, and no settings surface to build.

**[DECIDED — declined] Per-profile exceptions to a global field.** A globally-shown field cannot be hidden on one specific contact. Per-profile exceptions to a global rule are confusing to build and rarely used.

### 14.8 What ports from the plugin

| Piece | Source | State |
|---|---|---|
| `FieldType`, `FieldDef`, `SchemaDef` | `src/schemas/types.ts` (99 lines) | Already ported. Zero Obsidian coupling. |
| Form rendering | `src/components/FormRenderer.tsx` (316 lines) | Schema-driven, handles all 7 field types. Rewrite against RN primitives; dispatch logic and validation carry over. |
| Built-in schemas | `new-person.schema.ts`, `edit-person.schema.ts` | Already ported. |

Field types: `text` · `textarea` · `dropdown` · `date` · `toggle` · `number` · `photo`.

### 14.9 What does not port

- **`src/schemas/loader.ts` (479 lines) is essentially all dead.** Its bulk is parsing schema definitions out of Obsidian markdown — `parseFrontmatter`, `extractFieldsBlock`, `parseFieldsYaml`, vault folder scanning, `generateExampleSchema`. Definitions are rows in SQLite here, so that layer disappears. Salvage only `keyToLabel()` (~9 lines) for deriving `col_name` from a user-entered label.
- **`output_path`** (`"People/Work/{{name}}.md"`) is an Obsidian file-path template. Meaningless on mobile. Drop.
- **The authoring model.** In the plugin, users hand-wrote schemas as markdown files with YAML frontmatter and ` ```fields ` code blocks. Fine on a desktop with a text editor; a non-starter on a phone. **This is the largest single piece of new work in the phase and has no predecessor to port from.**

### 14.10 What must be built new

1. **Field editor UI** — the largest item. Create a field; set label, type, dropdown options, `show_on_new`, and the global always-show flag. Edit and reorder. Delete/quarantine with the dynamic action from §14.5.
2. **`custom_field_defs` table** and the transactional DDL operations (add, rename, drop) in §14.1.
3. **Dynamic query layer** reading definitions to build forms, profile sections, and the `sortExpr` from §14.2.
4. **Type-change pre-flight and parsers** — 7 parsers plus the summary UI from §14.4.
5. **`field_history` snapshot table** and the launch-time sweep covering both quarantine expiry and history retention.
6. **Error-state rendering** on profiles for flagged unconvertible values.
7. **`photo` field rework** — native image picker replacing the plugin's URL input.

### 14.11 Two SQLite constraints — both non-issues, recorded so they are not re-derived

| Constraint | Why it does not apply |
|---|---|
| `DROP COLUMN` fails if the column is indexed, UNIQUE, or referenced by a view or generated column | Users never write SQL — they only touch the UI. An index or constraint exists only if *you* create one, so this is entirely under your control. **Do not add indexes or UNIQUE constraints to custom value columns.** If a custom field ever needs an index, drop the index before dropping the column. |
| No `ALTER COLUMN TYPE` | Moot. Every column is TEXT forever — see §14.2. |

Note also that UNIQUE is a *constraint* (no two rows may share a value), unrelated to column names being distinct; and a VIEW is a saved SQL query stored in the database, unrelated to the UI displaying a field. Neither applies to custom fields.

---


## 15. First moves

1. Scaffold the Expo project. Reuse quest-board's setup where it transfers.
2. Extract the §4 portable files into `src/`. Strip `TFile` from `types.ts`. Swap `requestUrl` → `fetch` in `AiService.ts`.
3. Stand up the SQLite layer with the `user_version` migration pattern in place **from the first migration** — retrofitting it later is painful. Create `custom_field_defs`, `contact_custom_values`, and `field_history` in that first migration per §14, whenever the field-editor phase itself is scheduled.
4. Write the importer that parses existing Obsidian markdown frontmatter into SQLite. The existing vault files are effectively the schema specification.
5. Build the dashboard before the orrery. The orrery is the memorable feature; the dashboard is the one that gets used daily.
6. Ship share-sheet capture and actionable notifications early — they are the reason the previous version failed.
