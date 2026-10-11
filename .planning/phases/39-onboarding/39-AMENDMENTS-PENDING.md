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
| 4 | D-35 — history Back across tabs, plus a helper to switch tabs without entering Back history | D-12, D-68 (Orient's programmatic tab hops, frames 04–07) | Orient must use the no-history helper so Back after the tour isn't polluted | Verify |
| 5 | D-38 — + forms open over the tab you're on; Back before saving returns there | D-70, D-86 (first-run Acquire → Create hosting and where first run ends) | Where `Create` is hosted for first run may change; completion (new Profile / D-86 amendment) unchanged | Verify |
| 6 | D-44 — the shared header's Back is an icon-only chevron (label "Back") | Mockup frames 02/03 (draw a text "Back"); D-92 Tutorials screen header | Mockup redraw; the Tutorials header gets the chevron automatically | Verify |
| 7 | D-45 — person-scoped forms show the person's avatar + name under the title | D-97 (lesson shown on Log Interaction); any frame drawing that form | Frames of Log Interaction would show the name line | Verify |
| 8 | D-42 — "Never Contacted" is the single label everywhere | Frame 05 ("not yet contacted", "New people wait under Not yet contacted"), frame C ("Not Contacted — 0"), Orient copy, D-77 status label | Lesson/mockup copy → "Never Contacted" | Verify |
| 9 | D-49 — American "Favorite(s)" | Frame C ("Favorites — 1") | None expected (already American) | Verify |
| 10 | D-41 — no decided term renamed (Bound/Unbound, Orbit participation, Transmit, Group Log, Dissolve, Stable/Wobbly/Decaying/Rogue, Interaction Assist, Quarantine) | D-15, D-17, D-26, D-52, D-65, D-91, frame 03 | None; 39 copy stands. Note D-65's own noun "Wobble" vs status name "Wobbly" (D-22 unifies the UI on "Wobbly") | Verify |
| 11 | D-43 — dialogs use the elevated card with a 2dp strong border (matches 39 D-80 lesson cards) | D-80..D-85 lesson presenter | None; dialogs and lesson cards now share a look | Verify |
| 12 | D-47 — one Orbit switch (outlined off / filled on with check) | D-92 Tutorials switch | The Tutorials switch uses it | Verify |
| 13 | D-30 / D-39 / D-46 — destructive-action and feedback rules; snackbar copy "Logged Message with Ann" | D-57, D-92 (Restart tutorials); intercept copy ("the usual Logged snackbar follows") | Restart tutorials follows the rule (39 planner's call); any quoted snackbar copy uses the verb-first pattern | Verify |
| 14 | D-02 — A-30 (+ announced "Add", tab labels) stays in Phase 40 | Frame 07 TalkBack line expects "Add, button" | 39 cannot assume the + label until 40 (or 39 adds it as a prerequisite) | Verify |
| 15 | D-36 / D-37 — the + stays where it is (no hiding mid-scroll or over the Contacts panel) | Lesson pointers whose targets the + may cover (slice4 K-30 note) | Lesson placement must avoid the + corner | Verify |

## 38.10 — Fuel Retirement, Things to Remember & Sharing

_(none yet)_

## Roadmap split — 2026-10-10 (owner)

The original 38.11 "Everyday Screens" was split by seam, and a new feature phase was added before 39. Source: owner, 2026-10-10 plan-phase 38.9 session ("Fucking fine, go ahead" approving the split; "B-23 should be done before phase 39, it will need a tutorial journey I'm sure"). ROADMAP entries 38.11, 38.13–38.15.

| # | Change | Touches in 39 | What would change | Status |
|---|---|---|---|---|
| R-1 | D-95 (Active Contacts) and D-98 (empty-state button + Unbound line) are built in **38.13**, not 38.11 | D-101 ("built in 38.11"); D-100 table if it names 38.11 | Phase number in the record | Verify |
| R-2 | D-76 (one "Did you send it?") and J-02/J-05/J-08 are built in **38.14**, not 38.11 | D-102 (D-76 → 38.11); D-15 Reach Out lesson prerequisites | Phase number in the record | Verify |
| R-3 | D-50/D-51/D-87/D-94 and D-77 stay in **38.11** (now "Profile & Contact Forms") | D-102 | None (number unchanged) | Verify |
| R-4 | Phase 39 now depends on **38.15**, and the fix phases are 38.9–38.14 | 39 roadmap "Before planning" note and goal text ("Phases 38.9–38.12") | Wording of the range | Verify |
| R-5 | New feature phase **38.15 Events — Plan, Create & Remind** (audit B-23): future group events, an Events-tab create entry, reminders; owner wants a tutorial journey for it | D-26 (Group Events small moment, "no advanced management"); **D-29 ("no event-reminder tutorial")**; D-12 Orient copy if Events changes meaning | 39 gains an Events journey; D-29's "no event-reminder tutorial" would be reversed (owner said a journey is needed — confirm scope at 39) | Verify |

## 38.11 — Profile & Contact Forms UX

_(none yet)_

## 38.12 — Lifecycle, Import & Settings UX

_(none yet)_

## 38.13 — Contacts List, Search & Digest UX

_(none yet)_

## 38.14 — Logging, History, Events & Compose UX

_(none yet)_

## 38.15 — Events: Plan, Create & Remind

_(none yet)_
