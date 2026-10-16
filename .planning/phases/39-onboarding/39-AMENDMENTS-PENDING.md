# Phase 39 — Pending amendments from Phases 38.9–38.15

> **What this is.** A running list of decisions made in the UX-fix phases 38.9, 38.10, 38.11 and
> 38.12 that affect Phase 39's current docs (`39-CONTEXT.md`, `39-LEDGER.md`, the mockup in
> `39-WORKPAPER-mockup/`). **Nothing here has been applied to the 39 docs.** When Phase 39 resumes, its
> agent reads this list, verifies each item against the code and the source phase's CONTEXT, and
> then applies what is needed as dated amendments in 39's own ledger.
>
> **Source:** owner, 2026-10-10 (38.9 dossier session): "keep a running document in 39's phase
> directory where you and the next 3 phases can list your changes that will affect phase 39's
> current plans … I'd rather have a list of changes needed so we can verify everything and then
> apply as needed."
>
> **How to add an entry.** One row per source decision. Cite the source phase's D-ID, name the 39
> decision(s) or mockup frame(s) it touches, say what would change, and mark it **Verify** (the
> effect on 39 is my inference) or **Confirmed** (I opened the 39 text). Do not edit the 39 docs
> themselves. Frame and D-ID references below come from the 38.9 intake workpaper §8 unless marked.

## 38.9 — UX Standards (dossier draft 2026-10-10; `38.9-CONTEXT.md` once accepted)

| # | 38.9 decision | Touches in 39 | What would change | Status |
|---|---|---|---|---|
| 1 | D-03 / D-13 / D-15 / D-19 — E-01, F-01 guards and the inline name error are built in 38.9 | D-100 table (class-A items); D-61, D-70 (Back from Create warns); D-16 (Log Interaction "nothing saves until Save") | Nothing to rewrite; 39 consumes them. Confirm they landed before planning 39. | Verify |
| 2 | D-13 — discard prompt reads "Discard changes?" with **Keep editing** / **Discard changes** | Any lesson copy or mockup frame that quotes the prompt | Wording would match these labels | Verify |
| 3 | D-24 — one registry reports "a sheet or dialog is open" (BaseOverlay + confirm host; raw Modals moved or registered) | D-58, D-97 (coordinator suppresses lessons while a form, sheet, dialog or Assist question is open) | The coordinator reads this registry instead of building its own detection | Verify |
| 4 | D-35 / D-54 — history Back across tabs, plus a helper to switch tabs without entering Back history; D-54: Back at a non-Digest tab root with no history goes to Digest before exiting, so the app always exits from Digest | D-12, D-68 (Orient's programmatic tab hops, frames 04–07) | Orient must use the no-history helper (`switchTabWithoutHistory`, `src/navigation/tab-history.ts`) so Back after the tour isn't polluted; any lesson or frame that describes Back leaving the app from another tab now lands on Digest first | Verify |
| 5 | D-38 — + forms open over the tab you're on; Back before saving returns there | D-70, D-86 (first-run Acquire → Create hosting and where first run ends) | Where `Create` is hosted for first run may change; completion (new Profile / D-86 amendment) unchanged | Verify |
| 6 | D-44 — the shared header's Back is an icon-only chevron (label "Back") | Mockup frames 02/03 (draw a text "Back"); D-92 Tutorials screen header | Mockup redraw; the Tutorials header gets the chevron automatically | Verify |
| 7 | D-45 — person-scoped forms show the person's avatar + name under the title | D-97 (lesson shown on Log Interaction); any frame drawing that form | Frames of Log Interaction would show the name line | Verify |
| 8 | D-42 / D-56 — "Never Contacted" is the single label everywhere; D-56: it also covers the Contacts hidden-empty line ("N never contacted →") | Frame 05 ("not yet contacted", "New people wait under Not yet contacted"), frame C ("Not Contacted — 0"), Orient copy, D-77 status label | Lesson/mockup copy → "Never Contacted"; the hidden-empty line reads "N never contacted →" | Verify |
| 9 | D-49 — American "Favorite(s)" | Frame C ("Favorites — 1") | None expected (already American) | Verify |
| 10 | D-41 — no decided term renamed (Bound/Unbound, Orbit participation, Transmit, Group Log, Dissolve, Stable/Wobbly/Decaying/Rogue, Interaction Assist, Quarantine) | D-15, D-17, D-26, D-52, D-65, D-91, frame 03 | None; 39 copy stands. Note D-65's own noun "Wobble" vs status name "Wobbly" (D-22 unifies the UI on "Wobbly") | Verify |
| 11 | D-43 — dialogs use the elevated card with a 2dp strong border (matches 39 D-80 lesson cards) | D-80..D-85 lesson presenter | None; dialogs and lesson cards now share a look | Verify |
| 12 | D-47 — one Orbit switch (outlined off / filled on with check) | D-92 Tutorials switch | The Tutorials switch uses it | Verify |
| 13 | D-30 / D-39 / D-46 — destructive-action and feedback rules; snackbar copy "Logged Message with Ann" | D-57, D-92 (Restart tutorials); intercept copy ("the usual Logged snackbar follows") | Restart tutorials follows the rule (39 planner's call); any quoted snackbar copy uses the verb-first pattern | Verify |
| 14 | D-02 — A-30 (+ announced "Add", tab labels) stays in Phase 40 | Frame 07 TalkBack line expects "Add, button" | 39 cannot assume the + label until 40 (or 39 adds it as a prerequisite) | Verify |
| 15 | D-36 / D-37 — the + stays where it is (no hiding mid-scroll or over the Contacts panel) | Lesson pointers whose targets the + may cover (slice4 K-30 note) | Lesson placement must avoid the + corner | Verify |
| 16 | D-38 (38.9-07 execution finding, 2026-10-11) — the Orrery empty-state "Add Contact" button still jumps to the Contacts tab; it is not a + form, so 38.9 left it | D-70, D-86 (first-run Acquire → Create hosting); any frame where the empty Orrery offers Add Contact | Product question: should that button also open Create over the current tab like D-38? Owner call when 39 plans first run | Verify |
| 17 | D-24 (shipped in 38.9-01) — the overlay registry is `overlayRegistryStore` in `src/stores/overlay-registry-store.ts`; read "a sheet or dialog is open" with `selectAnyOverlayOpen` (top entry: `selectTopOverlayId`). It has no close API | D-58, D-97 (coordinator suppression) | The coordinator subscribes to this selector; it must not close overlays itself | Verify |
| 18 | D-24 (shipped in 38.9-01) — themed dialogs are `confirm({ title, message, confirmLabel, destructive })` → `Promise<boolean>` and `notice({ title, message })` → `Promise<void>` in `src/stores/confirm-store.ts`, shown by the one `DialogHost` in `App.tsx` | D-57, D-92 (Restart tutorials confirm); any lesson that asks a question | 39 calls these instead of building its own dialog; an open one also counts in the registry (row 17) | Verify |
| 19 | D-45 (shipped in 38.9-08) — `ShellAppBar` takes a `person` prop (`{ name, photo, contactId }`, from `useContactHeader`) and renders `PersonLine` under the title | D-97 (lesson on Log Interaction); frames drawing a person-scoped form | A lesson anchored to the header must allow for the person line's height | Verify |
| 20 | D-20 / D-71 (shipped in 38.9-13) — one `EmptyState` (`src/components/ui/EmptyState.tsx`): icon, heading, one help line, one action ("Clear search", "Log an event", "Try again", "Log interaction") | D-98 (empty-state button, now built in 38.13 per R-1); any frame showing an empty list | Frames and lesson targets use this layout and these action labels | Verify |
| 21 | D-01 / D-30 / D-39 / D-46 (38.9-16) — the 38.9 standards are written in `docs/systems/ux-standards.md` | Any 39 decision applying a destructive, feedback, dialog, guard, header or date rule (e.g. D-57, D-92) | 39 cites the standards doc and its D-IDs instead of restating the rules | Verify |

## 38.10 — Fuel Retirement, Things to Remember & Sharing (`38.10-CONTEXT.md`, accepted 2026-10-12)

| # | 38.10 decision | Touches in 39 | What would change | Status |
|---|---|---|---|---|
| 1 | D-63 — the Memory screen (+ → Memory) is retired; + → Memory opens the Add form directly; D-64 — after saving you return where you were with "Memory saved for <name>" | D-23 (Memory lesson at "first deliberate Memory creation"), D-17 / frame 07, trigger map (`39-CONTEXT.md:290` cites `MemoryScreen.tsx:149`) | Memory lesson trigger and frame 07 retarget to the Add form and its snackbar | Verify |
| 2 | D-75 — the Things to Remember editor screen is retired; each Profile pencil opens that section's own editor | Trigger map (`ThingsToRememberScreen.tsx:297`), any frame drawing that screen | Triggers move to the section editors / Add form | Verify |
| 3 | D-42 — the Add Note sheet loses "Create Memory Instead" and gets an "Also save to" section picker; D-37/D-38 — an interaction note can also be saved, linked, to Last Talked About / Gift Ideas / Thought of Them / Memories (History shows one tagged row) | D-97 (Memory lesson in "the Memory and post-log note editors"), D-16 ("Memory conversion" excluded), trigger map (`PostLogNoteEditor.tsx:187`), D-23 "distinct from an interaction note" | Lesson placement and copy; "Memory conversion" no longer exists; the Memory-vs-note distinction now includes linked notes | Verify |
| 4 | D-34/D-43/D-44 — new sections Thought of Them and Gift Ideas (after Memories); D-68 empty sections show "Add …"; D-72 one heading action per section (Add or pencil); D-70 Pin works, "Hide from Profile" removed from the entry sheet | D-14 / frame B (Prepare), D-14's "does not teach … pin/hide" | Prepare copy and frame B use the final section list and heading actions; pin is now real | Verify |
| 5 | D-77/D-78/D-79/D-80 — a share saves at once to Thought of Them, then a card offers section chips, Undo, Add note and Allow AI (off); multi-person shares move together; the picker is the list ContactPicker, not the face grid | D-93, D-99 (sharing lesson content), `39-CONTEXT.md:181` ("today shares are fuel", now stale) | Sharing lesson teaches save-first + chips + Undo + AI switch on the list picker | Verify |
| 6 | D-77 — the confirmation card is an interactive surface | D-58 (no lesson over a sheet/dialog), D-97 (exceptions) | A sharing lesson would sit on the share screen or card; 39 decides whether D-97's exception covers it | Verify |
| 7 | D-69 — every Things to Remember delete is at once + Undo, then permanent; Recently Deleted is removed | D-30 (Recently Deleted / memory Restore) | Moot; remove any reference | Verify |
| 8 | D-55 — backup format 7 → 8; a new migration (head moves past 032) | D-62 ("`BACKUP_FORMAT_VERSION = 7`, no change"), Claude's Discretion :231 (migration head 032) | Update the version and re-read the head at 39 plan time | Verify |
| 9 | D-76 / roadmap — new Phase 38.16 (share reminders + warm share) sits before 39; 39 now depends on 38.16 | D-93 (originally "with optional reminders"), roadmap "Depends on" | 39 decides whether the sharing lesson teaches reminders / warm-share return | Verify |
| 10 | D-87 — wording: "Avoid" → "Off Limits"; entry sheet buttons "Edit" / "Pin" / "Unpin", "Close"; share confirmation "Saved to <name> · <section>" | Any lesson copy or frame quoting these strings | Copy matches | Verify |

## Roadmap split — 2026-10-10 (owner)

The original 38.11 "Everyday Screens" was split by seam, and a new feature phase was added before 39. Source: owner, 2026-10-10 plan-phase 38.9 session ("Fucking fine, go ahead" approving the split; "B-23 should be done before phase 39, it will need a tutorial journey I'm sure"). ROADMAP entries 38.11, 38.13–38.15.

| # | Change | Touches in 39 | What would change | Status |
|---|---|---|---|---|
| R-1 | D-95 (Active Contacts) and D-98 (empty-state button + Unbound line) are built in **38.13**, not 38.11 | D-101 ("built in 38.11"); D-100 table if it names 38.11 | Phase number in the record | Verify |
| R-2 | D-76 (one "Did you send it?") and J-02/J-05/J-08 are built in **38.14**, not 38.11 | D-102 (D-76 → 38.11); D-15 Reach Out lesson prerequisites | Phase number in the record | Verify |
| R-3 | D-50/D-51/D-87/D-94 and D-77 stay in **38.11** (now "Profile & Contact Forms") | D-102 | None (number unchanged) | Verify |
| R-4 | Phase 39 now depends on **38.15**, and the fix phases are 38.9–38.14 | 39 roadmap "Before planning" note and goal text ("Phases 38.9–38.12") | Wording of the range | Verify |
| R-5 | New feature phase **38.15 Events — Plan, Create & Remind** (audit B-23): future group events, an Events-tab create entry, reminders; owner wants a tutorial journey for it | D-26 (Group Events small moment, "no advanced management"); **D-29 ("no event-reminder tutorial")**; D-12 Orient copy if Events changes meaning | 39 gains an Events journey; D-29's "no event-reminder tutorial" would be reversed (owner said a journey is needed — confirm scope at 39) | Verify |

## 38.11 — Profile & Contact Forms UX (`38.11-CONTEXT.md`, accepted 2026-10-16)

| # | 38.11 decision | Touches in 39 | What would change | Status |
|---|---|---|---|---|
| 1 | D-01–D-05 — 39's D-50/D-51/D-87/D-94/D-77 built here; D-44 extends D-94's selected "Not yet" to Edit Contact; D-23 not-contacted status label "Never Contacted" (context line copy set at 38.11 planning) | D-100/D-102 table, frame 03 (Add Contact), D-14 / frame B (Prepare), D-77 copy | Nothing to rewrite; confirm they landed and use the final status copy | Verify |
| 2 | D-62 — Update Contact is retired (one Edit Contact form); it leaves the + | D-17 (+ lesson lists Update Contact), D-68, any frame drawing the + menu | Drop Update Contact from the + lesson and frames | Verify |
| 3 | D-66 — Memory is removed from the + (memories still added from Profile sections, Edit/Add Contact, the post-Quick-Log step and sharing) | D-17, D-23 (Memory lesson at first deliberate Memory creation), D-97, 38.10 row 1 above (the + → Memory retarget is now moot) | Memory lesson triggers only from the remaining paths; the + lesson drops Memory | Verify |
| 4 | D-72 — Group Log leaves the + for the Events tab (decided in 38.11, built in 38.15) | D-17, D-26 and its trigger table (`39-CONTEXT.md:289` cites the + and bulk Log) | Group Log lesson triggers from the Events tab and Contacts 2+ only; the + lesson = Add Contact, Quick Log, Log Interaction | Verify |
| 5 | D-63 — full-width "Edit Contact" button above the Profile's top buttons; D-47 — "Message" renamed "Compose Message" | D-14 / frame B (Prepare), D-15 Reach Out lesson copy and frames that name the Profile's Message button | Frames and copy show Edit Contact + Compose Message / Call | Verify |
| 6 | D-69 / D-71 — "Archive" renamed "Bin" (Move to Bin with a confirm; Settings → Bin) | Any lesson copy, frame or journey rule that says "archive" | Wording → Bin | Verify |
| 7 | D-53/D-55 — Birthday tile in Relationship Overview; D-74 — Gravity reads "No interactions yet"; D-75 — the Status/Gravity/Intensity sheets explain their terms | D-14 / frame B (Relationship Overview on Prepare) | Frame B tile set and Prepare copy match | Verify |
| 8 | D-64/D-65/D-68 — ⋯ becomes Snooze… · Unbind contact (plain) · Move to Bin · Profile Layout · Background; Edit, Save as template and Reset leave ⋯ | Any frame or lesson that draws the Profile ⋯ menu | Match the new list | Verify |

## 38.12 — Lifecycle, Import & Settings UX

_(none yet)_

## 38.13 — Contacts List, Search & Digest UX

_(none yet)_

## 38.14 — Logging, History, Events & Compose UX

_(none yet)_

## 38.15 — Events: Plan, Create & Remind

_(none yet)_
