# UX audit — finding → phase assignment

**Date:** 2026-10-10 · **Status:** recommended placements (orchestrator review pending). Each placement follows the owner rules below; close calls are listed in §7.

**Purpose.** Give every one of the 297 UX-audit findings and the 7 non-UX items exactly one home phase, so the dossier sessions for 38.9–38.12 (and Phase 39 and 40 planning) know what is theirs and nobody redoes or drops work.

**Sources.**
- `.planning/ux-audit/UX-AUDIT-REPORT.md` (main @ 05b85252): findings §3, themes §4 (X-01..X-43), quick wins §5, needs investigation §6, known items §7.
- `.planning/ux-audit/NON-UX-FINDINGS.md` (7 items).
- `.planning/ux-audit/triage/` slice1–5 (class A–E vs Phase 39, tags, slice5 grouping proposal).
- `.planning/phases/39-onboarding/39-CONTEXT.md` D-94..D-100 (D-100 table); `39-LEDGER.md` Batches 13–14.
- Owner rulings relayed by the coordinator 2026-10-10: **Batch 15** (D-95 and D-98 built in 38.11, not 39; owner: "let's try to keep 39 focused on the tutorial journeys and not fixing the stuff that composes those journeys.") and **Batch 16, D-102** (D-50/D-51/D-87/D-94 + E-05, E-13 → 38.11; D-75 + H-02, H-03 → 38.12; D-76 + J-02, J-05, J-08 → 38.11; D-77 + D-09 → 38.11).
- `.planning/ROADMAP.md` Phases 38.9–38.12, 39, 40, backlog 999.2–999.6; `40-CONTEXT.md` D-01..D-05.

## 1. Owner placement rules (owner, 2026-10-10; 39-LEDGER Batches 13–16; 39-CONTEXT D-100, D-102)

- **38.9 UX standards** — builds the shared rules and components and does the mechanical app-wide conversions (Batch 14 R1). Home for findings whose fix *is* a shared standard or mechanical app-wide change: grey Android dialogs → themed dialog (X-04), the warn-before-Back-discards guard (X-01, incl. E-01, F-01 per D-100), header/Back chrome (X-26), the destructive-action rule and dialog swaps (X-03; area semantics stay with the area), feedback/snackbar and validation primitives (X-05, X-29; E-02 per D-100), selected/disabled styling (X-34), glossary and mechanical wording sweeps (X-36, X-37, spelling, plurals), date formatting (X-14), shared empty state, FAB/shell visibility rules.
- **38.10 Fuel retirement, Things to Remember & sharing** — fuel removed; each former fuel kind gets its own Profile place; shares go to a person and a chosen section; new shares get a per-item Allow AI switch, off by default (Batch 13 P1/Q3 → D-99). Home for areas G and I and any memory/fuel/Off Limits/TTR finding elsewhere (X-15, X-17, D-01, H-10, H-25), and backlog 999.3/999.5/999.6. Class-A G-11, I-01, I-04 (D-100).
- **38.11 Everyday screens** — *(split 2026-10-10, owner: D/E → 38.11 Profile & contact forms; A/C → 38.13; B/F/J → 38.14; B-23 planning → new feature phase 38.15)* — areas A, B, C, D, E, F, J not owned by 38.9/38.10. Class-A A-02, A-23, F-05, J-01 and the list-row TalkBack label (D-100); D-95 + A-04 and D-98 (Batch 15); D-50/D-51/D-87/D-94 + E-05, E-13, D-76 + J-02, J-05, J-08, D-77 + D-09 (D-102). The A-X01/A-X02 investigation at its start (Batch 14 R4 a) and the other non-UX items in these areas.
- **38.12 Lifecycle, import & Settings** — areas H and K except items owned elsewhere. Class-A K-36 (D-100); D-75 + H-02, H-03 (D-102).
- **39 Onboarding** — after Batches 15–16 it holds **no fix findings**. It consumes the fixes (D-03, D-100). Class-C items whose effect on 39 is lesson copy/mockup carry a **39 copy note** flag on their real home.
- **40** — accessibility-label sweep (X-39) and large-text/reflow items (Batch 14 R3), plus work 40-CONTEXT D-01 names.
- **No action** — D-35 (superseded by H-01, report §4.1).
- **Tie-break** (coordinator task brief): one home, chosen by "who changes the code that fixes it"; other phases go under "touches".

Note: ROADMAP 38.11's provisional scope lists areas A, B, C, D, F and J (no E). This table follows the owner rule above, which includes E in 38.11; see §7 J-02.

## 2. Totals

| Home | Audit findings | of which High | Non-UX items | Total |
|---|---:|---:|---:|---:|
| 38.9 UX standards | 52 | 2 | 1 | 53 |
| 38.10 Fuel retirement, TTR & sharing | 48 | 3 | 1 | 49 |
| 38.11 Profile & contact forms | 28 | 0 | — | 28 |
| 38.13 Contacts list, search & Digest | 37 | 1 | — | 37 |
| 38.14 Logging, History, Events & Compose | 50 | 2 | — | 50 |
| 38.15 Events — plan, create & remind | 1 | 0 | — | 1 |
| (38.11–38.14 non-UX items, split by area at the dossiers) | | | 5 | 5 |
| 38.12 Lifecycle, import & Settings | 71 | 3 | 0 | 71 |
| 39 Onboarding (copy notes only) | 0 | 0 | 0 | 0 |
| 40 Responsive & release hardening | 9 | 0 | 0 | 9 |
| No action | 1 | 0 | 0 | 1 |
| **Total** | **297** | **11** | **7** | **304** |

High findings by home: 38.9: E-01, F-01; 38.10: D-01, G-01, I-01; 38.13: A-02; 38.14: B-01, J-01; 38.12: H-01, H-02, K-22.

Severity: H/M/L. Fix tag from report §5 (QW) and §6 (NI). Theme = every `X-NN` section in report §4.3 that cites the finding. "39 link" = triage class (A–E) and the 39-CONTEXT D-IDs from `triage/slice1-4`; class E shows "—". **39 copy note** = class C: Phase 39 lesson copy or mockup must follow whatever this fix ships (the fix itself still lives in the home shown).

## 3. Assignment by home

### 38.9 UX standards — 52 findings

| id | sev | code | short title | theme | fix | 39 link | touches | report line |
|---|---|---|---|---|---|---|---|---:|
| A-10 | M | VIS | The + button floats above the open Population/Filters/Sort panel and its dim… | X-06 | NI | — | — | 282 |
| A-13 | M | DEAD | Bulk frequency "Continue" with an empty field or "0" does nothing visible;… | X-05, X-11, X-29 | QW | — | 38.11 (bulk sheet Continue) | 303 |
| A-15 | L | COPY | "Favorite/Favorites" and "Favourite/Favourites" are both used on the Contacts… | X-36 | QW | — | — | 317 |
| A-16 | L | COPY | Plurals: "Archive 1 contacts?", "Set all 1 contacts…", "…for 1 contacts",… | X-38 | QW | — | — | 324 |
| A-17 | L | COPY | "Dashboard" appears in user copy; the tab is "Contacts" | X-36 | QW | — | — | 331 |
| A-29 | L | COPY | Menu labels don't match the screens they open | X-24, X-27, X-36, X-38 | QW | — | — | 415 |
| A-32 | L | VIS | "No matches for "…"" echoes the whole search text without limit | X-09, X-41 | QW | — | — | 443 |
| B-03 | M | INC | Edit Group Event and Edit participant look like an older generation of the… | X-26, X-40 | NI | — | — | 548 |
| B-10 | M | COPY | Developer terms throughout Events: "Dissolve", "Follows event", "overridden",… | X-37 | NI | — | — | 607 |
| B-12 | M | COPY | One concept, many names: Events / Group Event / Group Events / Group Log /… | X-36, X-38 | NI | C D-17, D-26, D-89 | **39 copy note** | 625 |
| B-13 | L | COPY | Search with no matches shows the same sentence twice and echoes the full… | X-09, X-41 | QW | — | — | 631 |
| B-18 | M | INC | Event editors use unthemed Android system dialogs and dropdowns next to… | X-04, X-33 | NI | — | — | 666 |
| B-19 | L | INC | Destructive dialogs lay out their buttons differently | X-04 | NI | — | — | 673 |
| C-01 | M | HID | Android Back on Digest goes to the Contacts tab; Back after a Digest link… | X-08 | QW | — | 39 (Orient tab hops must stay out of history, slice1 G-5) | 754 |
| C-02 | M | HID | + button actions started on Digest open on top of old Contacts-tab history;… | X-07 | NI | — | 38.11, 38.12 (other X-07 landings) | 761 |
| C-06 | M | COPY | Digest shows raw numeric dates ("2026-10-13", "2026-10-07", "10/07/2026") | X-14 | QW | — | — | 796 |
| C-11 | L | COPY | Three names for the same group: "Never Contacted", "Not Contacted", "Not yet… | X-36 | QW | C D-12, D-77, D-81 (frames 04/05) | **39 copy note** | 834 |
| C-14 | L | VIS | The + button covers the Your Week day-panel rows | X-06 | NI | — | — | 858 |
| D-12 | M | COPY | Developer terms in Profile Layout, Background and Reset | X-37 | NI | — | — | 992 |
| D-18 | L | VIS | The + button covers the "Imported from Contacts App" edit pencil and the… | X-06, X-43 | NI | — | — | 1032 |
| D-21 | L | COPY | Raw numeric dates on the Profile | X-14, X-20 | QW | — | — | 1051 |
| D-26 | L | INC | Profile confirmations use unthemed Android dialogs with different button… | X-04 | NI | — | — | 1083 |
| D-31 | L | COPY | Casing differs between the Profile and the screens it opens | X-12, X-36, X-38 | none | — | — | 1114 |
| D-32 | L | INC | Five different Back styles across the Profile and the screens and sheets it… | X-26 | none | — | — | 1119 |
| E-01 | H | DEAD | Add Contact throws away everything you typed on Back, with no warning | X-01 | QW | A D-03, D-02, D-61, D-86, D-70 | 39 consumer (D-100); 38.11 | 1198 |
| E-02 | M | DEAD | Save with an empty name does nothing: no message, no scroll (Add and Edit) | X-29, X-34 | QW | A D-03, D-51 ("Name stays the only required field") | 39 consumer (D-100); 38.11 (Edit half); with E-X01 | 1214 |
| E-09 | M | HID | In Update Contact, Back from a single editor leaves Update Contact and… | X-01, X-08 | QW | — | — | 1312 |
| E-10 | M | HID | Update Contact never says who you are updating | X-25 | QW | — | 38.11 (Update Contact) | 1319 |
| E-16 | M | INC | Three kinds of picker and two kinds of dialog on the same forms | X-04, X-21, X-33 | NI | — | — | 1377 |
| E-20 | L | COPY | Titles, casing, Save labels and Back styles differ across the three forms | X-22, X-26, X-28, X-38 | NI | C D-10, D-74 (frames 02/03) | **39 copy note** | 1408 |
| E-22 | L | VIS | Switches that are off are nearly invisible on dark backgrounds; the custom… | X-19, X-34 | NI | — | with K-29 (§4.1) | 1423 |
| E-23 | L | COPY | "Orbit participation", "Bound/Unbound" and "cadence" are unexplained jargon… | X-36, X-37 | QW | C D-51, D-87, D-91, frame 03 | **39 copy note** | 1431 |
| F-01 | H | DEAD | Log Interaction throws away what you typed on Back, with no warning | X-01 | QW | A D-16, D-03, D-02, D-17 | 39 consumer (D-100); 38.11 | 1558 |
| F-08 | M | HID | No logging or edit form says who it's for (extends D-29) | X-25 | QW | — | 38.11 (logging forms) | 1652 |
| F-12 | M | HID | Group Log: the "needs a title" error appears at the bottom, pushes the button… | X-29, X-31 | QW | — | 38.11 | 1686 |
| G-04 | M | DEAD | Android Back from "Edit field" / "New field" leaves Custom Fields altogether… | X-01, X-08, X-26 | QW | — | 38.10 | 2012 |
| G-12 | M | DEAD | Back on the Memory screen throws away a typed new memory without warning | X-01 | NI | — | 38.10 (Memory screen may be reworked) | 2124 |
| G-21 | L | VIS | The + button covers "Create field" and the AI explanation on the field editor | X-06 | NI | — | — | 2229 |
| H-08 | M | INC | Import, reconcile and merge screens each use a different header and Back… | X-08, X-26, X-41 | NI | — | ⊂ K-04 | 2437 |
| I-05 | M | DEAD | Back throws away a typed note, or an open New-contact sheet, and leaves the… | X-01, X-08 | QW | — | 38.10 (Capture flow rebuilt) | 2817 |
| J-07 | M | DEAD | A note typed under "Add a note" is thrown away without warning when the… | X-01, X-30 | NI | — | 38.11 (D-76 surfaces) | 3045 |
| J-11 | L | INC | Compose and its own Things to Remember page differ in chrome: tab bar, +… | X-06, X-26, X-40 | QW | — | 38.11 (Compose) | 3074 |
| J-17 | L | A11Y | "Things to Remember, 1 items" plural slip | X-38 | QW | — | 40 (A11Y code; plural fix only here) | 3116 |
| J-18 | L | COPY | "Transmit" and "Interaction Assist" are unusual words for Send and for the… | X-36 | QW | C D-15 | **39 copy note** | 3123 |
| K-04 | M | INC | Settings pages use at least six different header and Back styles (deepens… | X-26 | NI | C D-92 | with H-08 (§4.1); 39 copy note (D-92 header) | 3218 |
| K-06 | M | INC | Four ways to save a setting; two of them silently throw away edits on Back | X-01, X-02, X-05, X-28 | NI | — | — | 3244 |
| K-08 | M | HID | The System builder's "name required" error appears off-screen, and stays… | X-29 | NI | — | 38.12 (System builder) | 3262 |
| K-28 | M | VIS | The selected accent colour is nearly invisible, and the colour pickers mark… | X-34, X-39 | NI | — | — | 3461 |
| K-29 | M | VIS | Switches are hard to read in Galaxy Dark: a dark thumb on a dark track, and… | X-34 | QW | — | with E-22; 39 (D-92 switch) | 3471 |
| K-30 | M | VIS | The + button covers controls throughout Settings | X-06 | NI | — | 39 (D-92 Tutorials screen clearance) | 3478 |
| K-32 | L | INC | Interactions page wording doesn't match itself or the rest of the app | X-36 | QW | C D-34, D-16, D-44 | **39 copy note** | 3500 |
| K-43 | L | COPY | Systems vocabulary: Favorites/Favorite, "Needs Attention · Needs attention",… | X-36, X-37, X-38 | NI | — | — | 3603 |

### 38.10 Fuel retirement, TTR & sharing — 48 findings

| id | sev | code | short title | theme | fix | 39 link | touches | report line |
|---|---|---|---|---|---|---|---|---:|
| A-06 | M | INC | Search ("Search people and notes") misses Last talked about, Current location… | X-09, X-12, X-17 | NI | — | 38.11 (search corpus code) | 254 |
| D-01 | H | DEAD | "pin", "unpin" and "Hide from Profile" in a Things to Remember item sheet do… | X-15, X-16 | NI | — | 39 (Prepare must not invite pin/hide until fixed) | 911 |
| D-03 | M | INC | Identical pencil icons and item "edit" buttons go to different places, never… | X-12, X-15, X-16 | NI | — | — | 927 |
| D-04 | M | DEAD | "Show hidden" in Memories leaves the Profile, then flips to "Hide hidden"… | X-15 | QW | — | — | 934 |
| D-15 | L | COPY | Item sheet buttons are lowercase ("edit", "pin", "unpin") next to "Hide from… | X-28, X-32 | QW | — | 38.9 (X-28 wording) | 1013 |
| D-22 | L | COPY | Empty values say "Not available yet", and an empty Profile is a wall of… | X-19, X-41 | QW | C D-14 (frame B) | 38.9 (X-41); 39 copy note | 1057 |
| D-23 | M | HID | A Link memory shows only the word "Link"; the URL can't be seen or opened… | X-15 | NI | — | — | 1064 |
| D-34 | L | COPY | Things to Remember counts and labels are inconsistent and repetitive | X-17 | none | — | — | 1129 |
| E-07 | M | INC | "Last talked about" and "Current location" are edited two different ways | X-12 | NI | — | — | 1285 |
| E-08 | M | INC | Some changes save the moment you tap, inside forms that otherwise wait for… | X-02, X-03, X-16, X-17, X-21 | NI | — | 38.11 (photo-remove half); 38.9 (X-02 draft rule) | 1296 |
| E-14 | M | HID | On Add Contact, a key person linked to an Orbit contact never shows which… | X-16 | QW | — | with G-16 (§4.1 merge) | 1356 |
| E-15 | L | COPY | Key person editor: "…doesn't hide it from search or AH." and an unexplained… | X-16, X-37 | QW | — | with G-17 (same string); 38.9 (std X-37) | 1371 |
| E-24 | L | VIS | "Add" controls look different in every section of one form | X-18 | NI | — | 38.11 (phone/email Add rows) | 1441 |
| E-25 | L | VIS | Long "Last talked about" text is squeezed into a one-line box | X-12 | QW | — | — | 1452 |
| E-29 | L | INC | Update Contact → Memory lists hidden memories with no "hidden" marker | X-15 | NI | — | ⊂ G-10 (§4.1) | 1484 |
| F-18 | M | INC | Add Note sheet: notes and memories behave differently, and the memory path… | X-05, X-15, X-28, X-32 | NI | — | 38.11 (Add Note sheet); 38.9 (std X-05, X-28) | 1749 |
| G-01 | H | DEAD | Editing an "Imported from Contacts App" memory silently turns it into a plain… | X-15 | QW | — | — | 1958 |
| G-02 | M | HID | In the TTR editor, a hidden memory has no "Hidden" badge, and its "Show on… | X-15 | QW | — | — | 1978 |
| G-03 | M | INC | Each kind of item in this area is deleted a different way | X-03, X-04, X-05, X-16, X-17 | NI | — | 38.9 (X-03 rule) | 1991 |
| G-09 | M | INC | The TTR editor shows read-only and raw values for things it can't edit, and… | X-11, X-14, X-17, X-19 | both | — | 38.9 (std X-14) | 2083 |
| G-10 | M | LEFT | Three different memory lists for one person | X-15, X-25 | NI | C D-23, D-14 | with E-29; 39 copy note | 2097 |
| G-11 | M | HID | After saving from + → Memory, you land on a different person's Profile | X-05, X-07, X-25 | NI | A D-23, D-58 | 39 consumer (D-100); 38.9 (X-07 rule) | 2111 |
| G-13 | M | HID | Memory "Link" and "Meaningful date" accept anything; a bad link opens a… | X-13, X-15, X-29 | NI | — | 38.9 (std X-29) | 2138 |
| G-14 | L | HID | "Allow AI to use this" saves the moment you tap it, even if you then press… | X-02, X-15 | NI | — | owner-bucket (AI egress); 38.9 (std X-02) | 2149 |
| G-15 | M | INC | "Last talked about" values: two different "Set new value" forms, duplicate… | X-12, X-28, X-29 | NI | — | 38.9 (std X-28, X-29) | 2162 |
| G-16 | L | INC | Key person: the linked contact's name isn't shown while editing, and pinning… | X-16 | NI | — | with E-14 | 2176 |
| G-17 | L | COPY | Pin/hide help text is developer wording and differs between memories and key… | X-16, X-37 | QW | — | with E-15; 38.9 (std X-37) | 2188 |
| G-18 | L | VIS | Inline edit forms open away from the tapped card, and the Memory screen's… | X-15, X-28, X-31 | NI | — | 38.9 (std X-28) | 2198 |
| G-19 | L | HID | Choosing "Custom" memory type disables Save without saying why | X-29, X-34 | NI | — | 38.9 (std X-29, X-34) | 2207 |
| G-23 | L | COPY | Section names and small labels differ between the Profile and its editor | X-14, X-15, X-16, X-36, X-38, X-41 | NI | C D-14, D-23 | 38.9 (std X-14, X-36, X-38, X-41); **39 copy note** | 2247 |
| H-10 | M | COPY | Merge flow wording is developer language and contradicts itself | X-03, X-04, X-17, X-36, X-37 | NI | — | 38.9 (std X-03, X-04, X-36, X-37) | 2460 |
| H-25 | L | COPY | The permanent-delete dialog counts "events" the user never created | X-17, X-36 | NI | — | 38.9 (std X-36) | 2636 |
| I-01 | H | HID | A cold-start share shows "Resume your check?" over the capture screen; Back… | X-07, X-08 | QW | A D-93, D-58, D-61 | 39 consumer (D-100, D-99); 38.9 (std X-07) | 2755 |
| I-02 | M | VIS | On the capture screen, the keyboard covers the "New contact" name sheet and… | X-30 | NI | — | — | 2781 |
| I-03 | M | HID | Sharing into Orbit while you're using it closes Orbit afterwards; reopening… | X-08 | NI | — | — | 2791 |
| I-04 | M | HID | One tap saves at once, with no Undo; the confirmation and "Add a note" stay… | X-05 | NI | A D-93, D-02 | 39 consumer (D-100, D-99); 38.9 (std X-05) | 2804 |
| I-06 | M | INC | New contact from a share is silently set to Monthly tracking, with no choice… | X-11, X-22 | QW | D D-50, D-51 (D-05 analogue) | 38.11 (share D-51 default constant with Add Contact, D-102) | 2835 |
| I-07 | M | HID | "New contact" is the last tile after every contact, and the search text isn't… | X-22, X-41 | QW | — | 38.9 (std X-41) | 2851 |
| I-08 | M | INC | The capture picker is a completely different design from every other contact… | X-25, X-26, X-33 | NI | — | 38.9 (std X-26) | 2865 |
| I-09 | L | HID | Multi-select is long-press only, and with nothing selected there's no way out… | X-08, X-42 | QW | — | — | 2877 |
| I-10 | L | VIS | Tiles change size and position: the last row stretches, and selected tiles… | X-34, X-35 | QW | — | 38.9 (std X-34) | 2890 |
| I-11 | L | VIS | The header (Close, search, preview) scrolls away with the grid | — | QW | — | — | 2901 |
| I-12 | L | COPY | The preview of what's being saved is one truncated line | — | QW | — | — | 2910 |
| I-13 | L | COPY | Confirmation wording leaves out what happened | X-05 | QW | — | 38.9 (std X-05) | 2917 |
| I-14 | L | HID | A second share arriving while Capture is open keeps the old search filter | X-09 | QW | — | — | 2932 |
| I-16 | L | VIS | The note sheet's Skip/Done and the confirmation card sit in the bottom… | X-31 | QW | — | — | 2949 |
| J-09 | M | INC | Compose's "Things to Remember" is a different, read-only rendition with… | X-15, X-17, X-36 | QW | — | with J-X01 (same groupItems fix); 38.9 (std X-36) | 3059 |
| J-10 | L | COPY | Compose's Things to Remember shows raw values | X-11, X-14, X-19, X-41 | NI | — | 38.9 (X-14) | 3067 |

> **Split 2026-10-10 (owner).** The original 38.11 "Everyday screens" (116 findings) is split by seam into 38.11, 38.13 and 38.14 below. B-23's planning/reminders half is a separate new-feature phase, 38.15; only its future-date picker cap stays with 38.14. "38.11" in the *touches* columns elsewhere in this file predates the split: read it by area — A/C → 38.13, B/F/J → 38.14, D/E → 38.11.

### 38.11 Profile & contact forms — 28 findings

| id | sev | code | short title | theme | fix | 39 link | touches | report line |
|---|---|---|---|---|---|---|---|---:|
| D-02 | M | DEAD | After Save on Edit Contact, Back shows the stale Edit form again | X-08, X-10 | QW | — | fixes H-23 too (same cause, §4.1); 39 (D-14 trigger) | 919 |
| D-05 | M | INC | Two different Snooze sheets on the same Profile | X-05, X-20, X-32, X-36 | QW | — | 38.9 | 942 |
| D-08 | M | COPY | "Call unavailable. Add a phone number" on a contact that has a phone number | X-18 | QW | — | — | 964 |
| D-09 | M | COPY | Unbound Profile says "Not tracked. Set a contact frequency" while showing a… | X-23, X-36 | NI | D D-77 | D-77 built here (D-102); 39 consumer; 38.9 (std X-36) | 971 |
| D-10 | M | INC | Three different contact-frequency choosers, and the card and sheet use… | X-02, X-11, X-36 | NI | — | 38.9 (std X-02, X-36) | 978 |
| D-11 | M | HID | Saving a profile layout collapses every section, and the editor's "Collapsed… | — | NI | — | with D-X01 | 985 |
| D-13 | M | HID | The Background sheet, opened from one person, puts app-wide actions first and… | X-03, X-26 | NI | — | 38.9 (std X-03, X-26) | 999 |
| D-14 | M | VIS | A photo background makes Profile text hard to read | X-40 | NI | — | — | 1006 |
| D-16 | L | HID | Section chevrons point down whether the section is open or closed | X-34 | NI | C D-14 (frame B), D-67 (frame D) | 39 copy note; 38.9 (std X-34) | 1019 |
| D-17 | L | VIS | Content scrolls visibly behind the translucent header, and the header never… | X-26, X-40 | NI | — | 38.9 (std X-26) | 1026 |
| D-19 | L | COPY | Relationship Overview repeats itself and uses unexplained numbers | X-37 | NI | — | 38.9 (std X-37) | 1039 |
| D-24 | M | HID | Birthday appears nowhere on the Profile | — | NI | — | — | 1070 |
| D-29 | M | HID | The Profile has no Log button, and + → Log Interaction from a Profile doesn't… | X-07, X-25 | NI | — | 39 (would add a D-53 entry); 38.9 (std X-07) | 1101 |
| D-33 | L | COPY | The custom snooze date flow uses an unthemed picker and leaves an ambiguous… | X-02, X-04, X-13, X-20, X-31 | none | — | 38.9 (X-04) | 1124 |
| E-03 | M | DEAD | A birthday can never be removed, and Add Contact can't set one (moved from… | X-13 | QW | — | — | 1230 |
| E-04 | M | INC | Add Contact lacks many of the fields Edit Contact has, and Show More can't be… | X-21, X-22 | NI | — | 39 (frame 03 redraw if Add changes) | 1247 |
| E-05 | M | HID | Choosing "Bound" on Add Contact pre-selects "Custom…" with 0 days and shows a… | X-11, X-22, X-29 | QW | D D-51 | D-51 built here (D-102); 39 consumer; 38.9 (std X-29) | 1259 |
| E-06 | M | HID | Bad phone numbers and emails are accepted silently on Add; Profile then says… | X-18, X-29 | NI | — | 38.9 (std X-29) | 1275 |
| E-11 | M | INC | Contact frequency: Add, Edit and Update agree, but the rest of the app uses… | X-11, X-36 | NI | C D-51, D-14 | 38.9 (std X-36); **39 copy note** | 1326 |
| E-12 | M | HID | "Pick date" for Last spoke lets you choose a future date, then rejects it… | X-13, X-14 | QW | — | with F-13, B-23 picker half (§4.1 maximumDate); same control as D-50/D-94 work in this phase; 38.9 (std X-14) | 1339 |
| E-13 | M | VIS | "Not yet" never looks selected, and selected chips use two different styles… | X-22, X-34 | QW | B → D-94 | D-94 built here (D-102); 39 consumer; 38.9 (std X-34) | 1346 |
| E-17 | L | INC | Custom date fields are free-text boxes that accept anything; Birthday uses a… | X-13, X-19, X-29 | NI | — | 38.9 (std X-29) | 1390 |
| E-18 | L | LEFT | Update Contact lists every custom field and then a "Custom Fields" row with… | X-19 | NI | — | — | 1397 |
| E-19 | L | INC | Links can be edited only in Edit Contact | X-18 | NI | — | — | 1403 |
| E-21 | L | INC | Update Contact's "Updated" badge shows only on the most recently edited row | X-10 | QW | — | — | 1417 |
| E-27 | L | HID | Add Contact's duplicate-name warning offers no way to open the existing… | X-22 | NI | — | — | 1468 |
| E-28 | L | VIS | The empty "Pet photo" custom field shows a person-style initials avatar "PP" | X-19, X-21 | NI | — | — | 1478 |
| H-23 | M | DEAD | Archiving from a Profile you've just edited lands on the stale Edit form for… | X-08, X-10 | QW | — | 38.12 (archive flow); fixed by D-02 change | 2610 |

### 38.13 Contacts list, search & Digest — 37 findings

| id | sev | code | short title | theme | fix | 39 link | touches | report line |
|---|---|---|---|---|---|---|---|---:|
| A-01 | M | VIS | List goes blank for seconds after a change, with no loading indicator (seen… | — | NI | — | with A-X01/A-X02 investigation (R4) | 219 |
| A-02 | H | DEAD | After leaving and reopening the app, the list is silently filtered by an old… | X-08, X-09 | QW | A D-57, D-71, D-81, D-12 | 39 consumer (D-100) | 226 |
| A-03 | M | INC | Population options add up instead of switching; "Favourites" with "All… | — | QW | — | with A-X03 (same handler) | 233 |
| A-04 | M | HID | Hidden "Active Contacts" population appears when nothing is selected, and… | X-09, X-36 | NI | B → D-95 (Batch 15: built in 38.11) | D-95 built here (owner, Batch 15); 39 consumer; 38.9 (std X-36) | 240 |
| A-05 | M | HID | A list filtered to nothing says only "Nothing here right now.", with no… | X-09, X-41 | QW | — | 38.9 (std X-41) | 247 |
| A-07 | M | DEAD | Search returns a wrong match: "Denver" finds "History Dense", highlighting… | X-09 | NI | — | — | 261 |
| A-08 | M | VIS | While a search runs, the old rows stay on screen labelled "1 match" (seen at… | X-09, X-10 | NI | — | with A-X01/A-X02 investigation (R4) | 268 |
| A-09 | M | HID | Android Back while search is open exits the app instead of closing search | X-08 | QW | — | — | 275 |
| A-11 | M | COPY | "More" in the selection bar opens a "Sensitive Operations" sheet with one item | X-27, X-37 | QW | — | 38.9 (std X-37) | 289 |
| A-12 | M | INC | Bulk "Change Contact Frequency" asks for a raw number of days | X-11 | NI | — | — | 296 |
| A-14 | M | INC | Snoozing one contact uses a plain Android system dialog; bulk snooze uses a… | X-04, X-05, X-20 | QW | — | 38.9 (X-04 Alert sweep must leave this site to the snooze sheet) | 310 |
| A-18 | L | COPY | Filters chip reads "Filters / Filters" when nothing is set | — | QW | — | — | 338 |
| A-19 | M | HID | Status colours/icons and filter words are unexplained jargon | X-37 | NI | C D-65, D-12 | 38.9 (std X-37); **39 copy note** | 345 |
| A-20 | L | COPY | Sort offers "Default" and "Status", which give the same order for All Contacts | — | QW | — | — | 352 |
| A-21 | L | INC | List rows rotate between different filler prompts in line 3; all are… | X-35, X-41 | NI | — | 38.9 (std X-41) | 359 |
| A-22 | L | VIS | Card view truncates "No interactions yet" to "No interacti…" | X-35 | NI | — | — | 366 |
| A-23 | L | VIS | After swipe-right to log, the row stays slid open showing a "Log" panel that… | X-42 | QW | A* D-71, D-53, D-16 | 39 consumer (D-100); with the D-53 intercept handler | 373 |
| A-24 | L | HID | One identical "Choose contact" picker serves four different + actions | X-25, X-28, X-33 | QW | — | 38.9 (std X-28) | 380 |
| A-25 | M | VIS | Contact picker: the keyboard hides the whole sheet, including the search… | X-30, X-33 | NI | — | — | 387 |
| A-26 | L | INC | Selection: "Select All" never becomes "Deselect all", and irrelevant actions… | X-34 | NI | — | 38.9 (std X-34) | 394 |
| A-27 | L | VIS | Selection bar takes ~40 % of the screen; a stray "Working…" line shows while… | — | NI | — | — | 401 |
| A-28 | L | INC | Bulk sheets differ: "Set category" is full-height, the others are compact;… | X-21, X-32, X-38 | NI | — | 38.9 (std X-38) | 408 |
| A-31 | L | COPY | Search result meta uses developer terms and repeats the name | X-37 | NI | — | 38.9 (std X-37) | 436 |
| A-33 | L | COPY | Population empty states don't explain the population | X-41 | QW | — | D-98 tucked-away state (same empty-state branch); 38.9 (std X-41) | 450 |
| A-34 | L | VIS | Reset Dashboard View keeps the old scroll position (seen at ~1,000 contacts;… | — | NI | — | — | 457 |
| A-35 | L | HID | Quick Log from long-press or swipe says only "Logged", with no name or channel | X-05 | QW | — | fixed with F-03 (same snackbar line, §4.1); 38.9 (std X-05) | 464 |
| A-36 | L | HID | Row swipe gestures are undiscoverable and absent in card view | X-42 | NI | C D-71, D-48 | **39 copy note** | 471 |
| A-37 | L | VIS | A single search result in card view becomes one full-width card | X-35 | NI | — | — | 478 |
| C-03 | M | HID | Digest links silently replace the user's saved Contacts view and land on a… | X-07, X-09 | NI | — | 39 (Orient Contacts step state); 38.9 (std X-07) | 768 |
| C-04 | M | HID | Your Week day detail can't be closed; a busy day becomes a very long list | X-43 | QW | — | — | 779 |
| C-05 | M | INC | Day-detail entries can't be tapped and show only name and time | X-35, X-43 | QW | — | — | 789 |
| C-07 | L | HID | Heatmap squares have no day labels; the selected square is barely marked | X-34, X-43 | QW | — | 38.9 (std X-34) | 806 |
| C-08 | L | INC | Birthday rows have no avatar, unlike every other Digest row | X-35 | QW | — | — | 813 |
| C-09 | L | VIS | Switching Rolling 7 Days / Calendar Week makes the page jump | — | NI | — | — | 820 |
| C-10 | L | INC | The Your Week period is set in two places, and one is labelled with jargon | X-36, X-37 | NI | — | with K-33; 38.9 (std X-36, X-37) | 827 |
| C-13 | L | HID | "Overlooked" vs "Up Next" is unexplained; Overlooked rows give no reason | X-37 | NI | C D-12 (frame 04) | 38.9 (std X-37); **39 copy note** | 847 |
| K-33 | L | COPY | Your Week period and Weekly digest (agrees with C-10, adds detail) | X-36 | NI | — | 38.12 (Settings page); fixed with C-10 (§4.1 merge); 38.9 (std X-36) | 3514 |

### 38.14 Logging, History, Events & Compose — 50 findings

| id | sev | code | short title | theme | fix | 39 link | touches | report line |
|---|---|---|---|---|---|---|---|---:|
| B-01 | H | DEAD | The participant editor inside Edit Group Event can't be saved: "Save… | X-08, X-30, X-32 | QW | — | — | 534 |
| B-02 | M | INC | The same participant record has two different editors under three different… | X-24, X-28 | QW | — | 38.9 (std X-28) | 541 |
| B-04 | M | HID | An event's title can't be changed anywhere | — | NI | — | — | 561 |
| B-05 | M | INC | Adding or removing participants on Edit Group Event saves at once, skipping… | X-01, X-02 | NI | — | 38.9 (std X-01, X-02) | 568 |
| B-06 | M | DEAD | After editing a participant from the interaction sheet, the sheet comes back… | X-10 | QW | — | — | 575 |
| B-07 | M | INC | "Remove from group → Delete interaction" deletes at once; the same delete… | X-03 | NI | — | 38.9 (X-03 rule) | 586 |
| B-08 | M | HID | Group Log started from the Events tab ends on the Contacts tab, and the new… | X-05, X-07 | NI | C D-26 | 38.9 (X-07 rule); 39 copy note | 593 |
| B-09 | M | HID | Event detail hides its main actions in ⋯, and the empty participant state has… | X-27, X-41 | QW | — | 38.9 (std X-41) | 600 |
| B-11 | M | COPY | The participant editor shows three identical "Follows event" lines, apart… | X-24, X-37 | QW | — | 38.9 (std X-37) | 618 |
| B-14 | M | HID | Closing Events search keeps the filter: the list stays filtered with the… | X-09 | QW | — | with B-X01 | 638 |
| B-15 | L | HID | Android Back doesn't close Events search; it leaves the tab | X-08 | NI | — | — | 645 |
| B-16 | M | VIS | The interaction sheet cuts "Delete" to "Delet", and its actions are hidden… | X-31 | QW | — | — | 652 |
| B-17 | L | COPY | Interaction sheet: "Connected / Connected", and "View Group Event" while… | X-24 | QW | — | — | 659 |
| B-20 | L | VIS | Duration control: a saved custom duration isn't shown on reopening, and… | — | NI | — | — | 679 |
| B-21 | L | HID | Participant cards don't show what's different for a person | — | NI | — | — | 686 |
| B-23 | M | HID | The Events tab can't create, plan or remind: no add button, no future events,… | X-13 | NI | — | maximumDate half with E-12 | 700 |
| F-02 | M | HID | Saving a full log, group log, edit or delete gives no confirmation and no… | X-05 | QW | C D-16 ("close the loop"), Discretion item 6 | 38.9 (std X-05); **39 copy note** | 1579 |
| F-03 | M | HID | Quick Log silently switches channel to whatever was last picked in Log… | X-05, X-24 | QW | C D-16, D-53, D-34, frame A | with A-35; 39 copy note; 38.9 (std X-05) | 1595 |
| F-04 | M | INC | Bulk Quick Log records channel "unspecified" and has no Add Note, unlike… | X-05, X-24, X-36 | QW | C D-53, D-16, frame A | 38.9 (std X-05, X-36); **39 copy note** | 1606 |
| F-05 | M | INC | Bulk "Log Interaction" with 2+ selected silently becomes a Group Log, and… | X-24, X-36 | NI | A D-26, D-02, D-03 | 39 consumer (D-100); 38.9 (std X-36) | 1615 |
| F-06 | M | INC | The three logging forms (Log Interaction, Edit interaction, Group Log) are… | X-24, X-26, X-28 | NI | — | 38.9 (std X-26, X-28) | 1627 |
| F-07 | L | VIS | Group Log has a flat background in every theme; Log Interaction and Edit… | X-24, X-40 | QW | — | — | 1645 |
| F-09 | L | COPY | Raw lowercase values: "outbound / inbound / mutual", "unspecified" | X-24, X-36 | QW | — | 38.9 (std X-36) | 1663 |
| F-10 | L | INC | The interaction sheet shows "Connected / Connected" for In Person and group… | X-24 | QW | — | — | 1672 |
| F-11 | M | VIS | On Edit interaction the keyboard covers the field you are typing in | X-30 | NI | — | — | 1679 |
| F-13 | M | HID | Log forms let you pick a future date, then reject it after both pickers… | X-13 | QW | — | with E-12 | 1703 |
| F-14 | L | HID | Logging from an empty month or day doesn't use the date you were looking at… | — | QW | — | — | 1710 |
| F-15 | M | HID | History "Intensity" numbers are unexplained and look wrong | X-37 | NI | — | 38.9 (std X-37) | 1722 |
| F-16 | M | HID | Year and Month heatmaps and the Cycles count chips have no labels | X-43 | NI | — | 40 (yearly heatmap rendering, 40-CONTEXT D-01) | 1732 |
| F-19 | M | VIS | Once an interaction has a note, the sheet hides Edit/Delete below the fold… | X-31 | NI | — | — | 1764 |
| F-20 | L | HID | "Make this a group interaction" is the only item behind ⋯, and it uses two… | X-24, X-27, X-36 | NI | C D-26 | 38.9 (std X-36); **39 copy note** | 1771 |
| F-21 | L | HID | Undo removes a Quick Log silently (bulk Undo, by contrast, confirms) | X-05 | QW | — | 38.9 (std X-05) | 1778 |
| F-22 | L | VIS | "Save changes" on Edit interaction sits in the gesture bar | X-31 | QW | — | — | 1788 |
| F-23 | L | INC | The stream interleaves lifecycle events with interactions with no filter, and… | — | both | — | — | 1796 |
| F-24 | L | COPY | Small wording and label slips on the logging forms | X-05, X-36, X-39 | QW | — | 38.9 (std X-05, X-36) | 1807 |
| F-25 | L | HID | The Quick Log contact picker keeps the previous search between opens | X-09 | QW | — | — | 1821 |
| F-26 | L | VIS | After a bulk Quick Log, selected cards change position while selection mode… | X-06 | NI | — | 38.9 (std X-06) | 1829 |
| F-27 | L | HID | In a long history the History controls are a long scroll away, and History… | — | NI | — | — | 1843 |
| J-01 | H | HID | A message Compose presents as a text is sent as an email, and Compose never… | X-18 | QW | A D-15 | 39 consumer (D-100) | 3002 |
| J-02 | M | HID | After "Yes, log interaction" Compose closes silently, and the banner still… | X-05 | NI | D D-76 | D-76 built here (D-102); 39 consumer; 38.9 (std X-05) | 3010 |
| J-03 | M | HID | After "Not yet", the reminder disappears until the app is closed and reopened | X-10 | NI | D D-76 | with D-76 "Later" (D-102); 40 (40-CONTEXT D-01 lifecycle heuristics) | 3017 |
| J-04 | M | HID | A typed draft is silently discarded when you start a message to someone else | X-01 | NI | — | 38.9 (std X-01) | 3024 |
| J-05 | M | INC | The two confirmation surfaces mirror their primary button, and an email is… | X-24, X-28, X-36 | NI | D D-76, D-44 | D-76 built here (D-102); owner call: email logged as Message (D-44/ADR-116); 38.9 (std X-28, X-36) | 3031 |
| J-06 | M | HID | Pending confirmations: identical rows, no way to tell them apart, no Close,… | X-03, X-05, X-08, X-28, X-32, X-41 | NI | D D-76 | with D-76 work (D-102); 39 consumer; 38.9 (std X-03, X-05, X-28, X-41) | 3038 |
| J-08 | M | VIS | The app-wide banner pushes Compose's Copy and Transmit to the gesture bar,… | X-31, X-32 | NI | D D-76, D-15 | D-76 built here (D-102); 39 consumer | 3052 |
| J-12 | L | VIS | Compose labels sit on visible patches in light themes and in Standard Dark | X-40 | NI | — | — | 3081 |
| J-13 | L | HID | Copy, Copy subject and Transmit all "work" with nothing to send | X-05 | QW | — | 38.9 (std X-05) | 3088 |
| J-14 | L | VIS | "Subject copied" appears far from "Copy subject", often off-screen | X-05 | NI | — | 38.9 (std X-05) | 3095 |
| J-15 | L | HID | No-destination Compose offers an email switch for a person with no email, and… | X-18 | NI | — | — | 3102 |
| J-16 | L | VIS | A long message makes the whole screen scroll: header gone, actions pushed… | X-31 | NI | — | — | 3109 |

### 38.15 Events — plan, create & remind — 1 finding (plus B-23's planning half)

> Owner, 2026-10-10: the Events tab header and empty-state copy are not designed in 38.14 only to change in 38.15; B-24 lives here with the B-23 feature.

| id | sev | code | short title | theme | fix | 39 link | touches | report line |
|---|---|---|---|---|---|---|---|---:|
| B-24 | L | COPY | The Events empty state points to "Group Log on any contact", which doesn't… | X-41 | QW | — | 38.9 (std X-41) | 710 |

### 38.12 Lifecycle, import & Settings — 71 findings

| id | sev | code | short title | theme | fix | 39 link | touches | report line |
|---|---|---|---|---|---|---|---|---:|
| D-06 | M | DEAD | An archived contact's Profile has no Restore, still offers Archive (which… | X-04, X-23 | QW | — | 38.11 (Profile code); with H-24; 38.9 (std X-04) | 949 |
| D-07 | M | HID | Archive from Profile drops you on the list with no message and no undo; the… | X-03, X-05, X-23 | NI | — | 38.11 (Profile code); 38.9 (X-03/X-05) | 957 |
| D-25 | L | INC | The ⋯ menu stresses Unbind (red, warning icon) but not Archive; the sheet is… | X-03, X-23, X-27, X-28, X-32 | NI | — | 38.11 (Profile ⋯ sheet, Reset half); 38.9 (std X-03, X-28) | 1077 |
| D-27 | L | HID | After Unbind the menu stays open with no Bind option; Snooze is still offered… | X-20, X-23 | NI | — | 38.11; with H-21 | 1089 |
| D-28 | L | VIS | The favourite star on Unbound contacts is disabled but looks enabled | X-23, X-34 | NI | — | 38.11; 38.9 (X-34 disabled style); with H-20 | 1095 |
| G-08 | M | INC | Custom Fields and Categories, side by side under "Relationship Structure",… | X-26, X-27, X-28, X-35 | NI | — | 38.10 (custom-fields half); fixed with K-10 (§4.1 G-08 ⊂ K-10); 38.9 (std X-26, X-28) | 2066 |
| H-01 | H | DEAD | The Archived list on the Contacts tab never refreshes, and stale rows then… | X-03, X-04, X-10 | QW | — | 38.9 (std X-03, X-04) | 2338 |
| H-02 | H | DEAD | "Link to Existing" in Review matches opens a list that runs off the screen,… | X-08, X-28, X-31, X-32, X-33 | QW | D D-75, D-06 | D-75 built here (D-102); 39 consumer; 38.9 (std X-28) | 2355 |
| H-03 | M | HID | Review-match cards don't say which Orbit contact they match, and the only way… | X-35, X-42 | NI | D D-75, D-06 | D-75 built here (D-102); 39 consumer | 2375 |
| H-04 | M | COPY | "Check complete" counts contacts as "interactions" | X-36 | QW | — | 38.9 (std X-36) | 2387 |
| H-05 | M | DEAD | Check linked contacts doesn't keep decisions: the next check lists every card… | X-10 | NI | — | — | 2394 |
| H-06 | M | INC | Choosing the phone's email in "Update from Contacts" adds it instead of… | X-18 | both | — | — | 2409 |
| H-07 | M | HID | Apply in "Update from Contacts" gives weak feedback, stays enabled and jumps;… | X-05, X-34 | NI | — | 38.9 (std X-05, X-34) | 2421 |
| H-09 | M | HID | Merging two people is reachable only from Settings → Check linked contacts →… | X-23 | NI | — | — | 2449 |
| H-11 | M | HID | The merge contact picker is the whole contact list, with no search, no Cancel… | X-25, X-28, X-33 | NI | — | 38.9 (std X-28) | 2473 |
| H-12 | M | HID | Flows started in Settings end on the Contacts tab; Back then lands on… | X-07 | NI | — | 38.9 (X-07 rule) | 2484 |
| H-13 | M | HID | Importing a phone contact that's already linked shows a full editable review… | X-22 | NI | — | — | 2498 |
| H-14 | M | INC | The import editors differ from Add/Edit Contact and from each other | X-11, X-13, X-21, X-22 | NI | C D-52, D-05 | **39 copy note** | 2509 |
| H-15 | L | COPY | Import complete is six near-identical count cards, mostly zeros, and the… | X-41 | NI | — | 38.9 (std X-41) | 2522 |
| H-16 | M | HID | An unfinished import gives no sign that work is pending, and neither resume… | X-28 | NI | — | 38.9 (std X-28) | 2533 |
| H-17 | M | INC | Archived rows cut the name short to fit two large buttons, and look nothing… | X-03, X-35 | NI | — | 38.9 (std X-03) | 2545 |
| H-18 | M | HID | Restore gives no feedback and doesn't say where the person went | X-05, X-23 | NI | — | 38.9 (std X-05) | 2558 |
| H-19 | M | INC | Lifecycle actions are confirmed inconsistently, and Bind and Unbind live in… | X-03, X-04, X-23 | NI | — | 38.9 (X-03 rule) | 2568 |
| H-20 | M | COPY | The Unbind dialog says favourites are removed, but the star stays filled (and… | X-23 | NI | — | with D-28 | 2579 |
| H-21 | L | HID | Snooze on an Unbound contact really applies, and the Overview then shows… | X-20, X-23, X-31 | NI | — | with D-27 | 2590 |
| H-22 | M | HID | "Mute reminders" exists only as a switch deep inside Edit Contact, and a… | X-20 | NI | — | — | 2600 |
| H-24 | L | COPY | An archived person's Profile shows them as "Stable", and Unbind still works… | X-23 | NI | — | with D-06 | 2626 |
| H-26 | L | COPY | Settings describes Archived in Unbound wording, and has no Unbound entry | X-23, X-36 | QW | C D-52, D-65, D-91 | with K-34 (§4.1 merge); 38.9 glossary; **39 copy note** | 2647 |
| H-27 | L | VIS | In the Unbound list, the first match after a search is hidden above the fold,… | X-09, X-35 | NI | — | — | 2656 |
| H-28 | L | COPY | Linked-contact check wording and values | X-13, X-14, X-37, X-38 | NI | — | 38.9 (std X-14, X-37, X-38) | 2669 |
| H-29 | L | HID | The Unbound Profile shows frequency chips with Bind only for a never-bound… | X-05, X-11 | NI | — | 38.9 (std X-05) | 2681 |
| K-01 | M | HID | With "Allow notifications" off, every reminder switch still shows On and… | X-34 | QW | — | 38.9 (std X-34) | 3193 |
| K-02 | M | HID | "Birthday alerts for unbound contacts" stays on and changeable when Birthday… | X-34 | QW | — | 38.9 (std X-34) | 3204 |
| K-03 | M | HID | The reminder time can be set inside quiet hours with no warning | — | NI | — | — | 3211 |
| K-05 | M | INC | Settings pages use different row and page layouts, and tappable rows look the… | X-34, X-35 | NI | C D-92 | 38.9 (std X-34); **39 copy note** | 3232 |
| K-07 | M | VIS | The System builder draws a decorative planet on top of its form | — | QW | — | — | 3255 |
| K-09 | M | HID | "Manage Members" opens an editor, which has its own "Manage Members" button | X-34, X-37 | NI | — | 38.9 (std X-34, X-37) | 3269 |
| K-10 | M | INC | The Systems list uses yet another way to manage a list, and makes Delete the… | X-03, X-04, X-34, X-35 | NI | — | fixes G-08 too; 38.9 (std X-03, X-04, X-34) | 3280 |
| K-11 | M | COPY | The phone number region picker is close to unusable: bare codes, name search… | X-09, X-30, X-41 | QW | — | 38.9 (std X-41) | 3296 |
| K-12 | M | COPY | Backup settings never says which folder is selected | — | QW | — | — | 3311 |
| K-13 | M | HID | "Your backup needs attention" offers no way to back up now | — | NI | — | — | 3318 |
| K-14 | M | HID | Export asks "Export readable JSON?" as if that were the choice you made, with… | X-03, X-04 | QW | — | 38.9 (std X-03, X-04) | 3328 |
| K-15 | M | COPY | Backup files have unreadable names: a raw number for exports, UTC times for… | X-14 | QW | — | 38.9 (std X-14) | 3335 |
| K-16 | M | HID | The restore flow never says which file you picked, and two different backups… | — | NI | — | — | 3347 |
| K-17 | M | COPY | Restore preview speaks developer, and doesn't compare the backup with what's… | X-37 | QW | — | 38.9 (std X-37) | 3357 |
| K-18 | M | HID | The Replace confirmation gives no idea of scale, in an unthemed all-caps… | X-03, X-04 | NI | — | 38.9 (std X-03, X-04) | 3364 |
| K-19 | M | COPY | After Replace, the result says "Deletions applied: 0" and is a dead end (from… | — | NI | B D-63, D-62 | 39 (D-96 first-run entry/exit) | 3371 |
| K-20 | M | HID | A restore runs for minutes with no progress, and the tab bar stays usable… | X-06 | NI | B D-63, D-70 | 39 (D-96 first-run entry/exit); 38.9 (X-06) | 3381 |
| K-21 | L | INC | Restore preview: "Merge" preselected, and one option has three names | X-28, X-34 | NI | — | 38.9 (std X-28, X-34) | 3390 |
| K-22 | H | HID | Favourites aren't in backups, so any restore silently unfavourites everyone,… | — | NI | — | owner call: backup format bump (40-CONTEXT D-03) | 3400 |
| K-23 | L | COPY | Backup naming and navigation don't line up: "Data & Backup" vs "Backup &… | X-38 | QW | — | 38.9 (std X-38) | 3410 |
| K-24 | L | VIS | Backup & Restore uses text glyphs for icons, and Export and Restore both show… | — | NI | — | — | 3421 |
| K-25 | M | INC | Appearance mixes the app theme with Orrery-only settings, although Settings… | X-36 | NI | — | 38.9 (std X-36) | 3428 |
| K-26 | M | HID | Default profile layout and background: untitled lists of templates named… | — | NI | — | — | 3438 |
| K-27 | M | INC | Five different picker designs within Settings | X-04, X-09, X-32, X-33, X-41 | NI | — | 38.9 (std X-04, X-41) | 3449 |
| K-31 | M | VIS | Your name: the keyboard covers the field, and the name saves silently on blur | X-02, X-05, X-30 | NI | — | 38.9 (std X-02, X-05) | 3491 |
| K-34 | L | COPY | Notification jargon: "Decay reminders" and "unbound contacts" | X-23, X-36 | QW | C D-28, D-52 | with H-26; 38.9 glossary; **39 copy note** | 3524 |
| K-35 | M | COPY | The AI page shows no current state, and its rows don't match the pages they… | X-38 | NI | C D-20, D-69 | 38.9 (std X-38); **39 copy note** | 3531 |
| K-36 | M | COPY | AI Connections: an active provider still shows "Connect with OpenRouter" as… | X-03 | NI | A D-69, D-20 | 39 consumer (D-100); 38.9 (std X-03) | 3543 |
| K-37 | M | HID | AI Personalization: "Use custom guidance instead" ×3, and the preset still… | — | NI | — | — | 3553 |
| K-38 | M | HID | AI Personalization sections: the ⋯ options open off-screen, below the… | X-27, X-35, X-42 | QW | — | — | 3563 |
| K-39 | L | HID | AI Data Permissions: "Review existing…" silently changes filters off-screen | — | NI | — | — | 3572 |
| K-40 | L | COPY | "Preview What Orbit Sends" is written for developers | X-26, X-37, X-40 | NI | — | 38.9 (std X-26, X-37) | 3579 |
| K-41 | L | HID | About Orbit shows only an icon, a name and a version | — | NI | — | — | 3589 |
| K-42 | L | COPY | Background names don't match what they show in the other mode | — | NI | — | — | 3596 |
| K-44 | L | VIS | AI Personalization: section text wraps in a narrow column, making very tall… | — | QW | — | — | 3615 |
| G-22 | L | COPY | New-field hints and type names | X-19, X-38 | QW | — | 38.9 (std X-38); moved from 38.10 by orchestrator 2026-10-10 (Settings management page; keeps 38.10 on fuel) | 2236 |
| G-20 | M | COPY | Deleting a category shows a wall of internal jargon and needs two "Keep" taps… | X-03, X-28, X-37 | NI | — | 38.9 (std X-03, X-28, X-37); moved from 38.10 by orchestrator 2026-10-10 (Settings management page; keeps 38.10 on fuel) | 2218 |
| G-07 | M | COPY | "Quarantine" is developer wording, and the same button reads "Delete" or… | X-04, X-19, X-37 | NI | — | 38.9 (std X-04, X-37); moved from 38.10 by orchestrator 2026-10-10 (Settings management page; keeps 38.10 on fuel) | 2057 |
| G-06 | M | HID | A value that "Needs attention" says so twice, and the Edit it points to shows… | X-19 | both | — | —; moved from 38.10 by orchestrator 2026-10-10 (Settings management page; keeps 38.10 on fuel) | 2043 |
| G-05 | M | HID | The field-type change dialog hides what will happen to existing values | X-04, X-19, X-37 | NI | — | 38.9 (std X-04, X-37); moved from 38.10 by orchestrator 2026-10-10 (Settings management page; keeps 38.10 on fuel) | 2030 |

### 39 Onboarding (copy notes only) — 0 findings

No fix findings. Every Phase 39 prerequisite fold moved to a fix phase (Batch 15: D-95, D-98 → 38.11; Batch 16 D-102: D-50/D-51/D-87/D-94, D-76, D-77 → 38.11, D-75 → 38.12). Phase 39 consumes them under D-03/D-100. Items whose only 39 effect is lesson copy or mockup carry **39 copy note** on their home row (26 class-C items; list below).

39 copy notes (home in parentheses): A-19 (38.11), A-30 (40), A-36 (38.11), B-08 (38.11), B-12 (38.9), C-11 (38.9), C-13 (38.11), D-16 (38.11), D-22 (38.10), E-11 (38.11), E-20 (38.9), E-23 (38.9), F-02 (38.11), F-03 (38.11), F-04 (38.11), F-20 (38.11), G-10 (38.10), G-23 (38.10), H-14 (38.12), H-26 (38.12), J-18 (38.9), K-04 (38.9), K-05 (38.12), K-32 (38.9), K-34 (38.12), K-35 (38.12).

### 40 Responsive & release hardening — 9 findings

| id | sev | code | short title | theme | fix | 39 link | touches | report line |
|---|---|---|---|---|---|---|---|---:|
| A-30 | M | A11Y | Screen-reader labels: icon glyphs in tab labels, nameless star buttons, stale… | X-39 | NI | C D-32, D-68 (frame 07 TalkBack) | 39 copy note (frame 07 TalkBack "Add, button") | 422 |
| B-22 | L | A11Y | Screen-reader labels on Events lose context | X-39 | QW | — | — | 693 |
| C-12 | L | A11Y | Avatars are announced with internal status names ("rogue status") | X-37, X-39 | QW | — | 38.9 (status vocabulary) | 840 |
| D-20 | L | VIS | The Overview grid leaves an empty half-width gap beside Contact Frequency and… | — | NI | — | 40-CONTEXT D-01 "Relationship Overview packing" | 1045 |
| D-30 | L | A11Y | Things to Remember cards are announced by type, not content; mixed… | X-17, X-36, X-39 | QW | — | 38.9 (spelling half) | 1108 |
| E-26 | L | A11Y | Unlabelled or context-free controls on the forms | X-16, X-39 | NI | — | — | 1458 |
| F-17 | L | A11Y | Year heatmap dots are far below touch-target size; count chips are announced… | X-39, X-43 | NI | — | 38.11 (heatmap) | 1743 |
| G-24 | L | A11Y | Memory cards are announced as "Edit Memory memory" in the editor and Memory… | X-39 | QW | — | — | 2257 |
| I-15 | L | A11Y | Close is announced as "Cancel"; search is an emoji glyph | X-26, X-39 | QW | — | — | 2939 |

### No action — 1 findings

D-35 is superseded by H-01 (report §4.1); H-01 (38.12) owns the fix.

| id | sev | code | short title | theme | fix | 39 link | touches | report line |
|---|---|---|---|---|---|---|---|---:|
| D-35 | M | DEAD | After a restore from Settings → Archived contacts, the Archived screen in the… | X-10 | QW | — | superseded by H-01 (38.12 owns) | 1134 |

## 4. Themes

> Note (2026-10-10): member counts below predate the orchestrator's move of G-05/G-06/G-07/G-20/G-22 to 38.12; the per-home tables in §3 are authoritative.

Homes = where the theme's member findings are assigned above (count per home). Standard-setting = slice5 "Std" column (Y / lite / N).

| X-NN | title | home(s) of its members | standard-setting? | note |
|---|---|---|---|---|
| X-01 | Back with unsaved changes: five forms ask "Discard changes?", at… | 38.9 (8), 38.11 (2) | Y | 38.9 applies `useDiscardKeepGuard` to every unguarded form and themes its prompt (`discard-keep-guard.ts:29` is a native Alert). B-05/J-04 stay with areas (ADR-167 / ADR-133 owner calls). |
| X-02 | Some edits save the moment you tap, inside forms that otherwise wait… | 38.9 (1), 38.10 (2), 38.11 (3), 38.12 (1) | Y (draft rule) | Draft rule set in 38.9; G-14 (Allow AI survives Cancel) is AI-egress, owner bucket, in 38.10. |
| X-03 | Destructive actions: confirmation, undo, recoverability and visual… | 38.10 (4), 38.11 (3), 38.12 (9) | Y (rule + ADR) | Rule (+ ADR) in 38.9; area semantics (B-07, G-03, H-19, K-14/K-18) stay with areas. No interaction Trash without owner (phase-11 :728). |
| X-04 | Two dialog systems: grey Android Alerts, spinners and clocks next to… | 38.9 (4), 38.10 (4), 38.11 (2), 38.12 (7) | Y | 38.9 converts native Alerts/spinners (102 `Alert.alert` sites per slice5). B-19 button order: keep ADR-174 unless owner reverses. |
| X-05 | Feedback after actions: a snackbar with Undo on a few writes, silence… | 38.9 (2), 38.10 (5), 38.11 (13), 38.12 (5) | Y | 38.9 builds the primitive (snackbar above sheets, A-13); each flow's feedback is fixed in its area. F-03 vs ADR-130 owner call. |
| X-06 | The + button covers content and floats above overlays on every tab | 38.9 (6), 38.11 (1), 38.12 (1) | Y (FAB visibility classification) | All FAB-overlap members in 38.9 (shell visibility/clearance). Hiding the FAB on Settings reverses ADR-173: owner. |
| X-07 | + actions and flow endings always push into the Contacts tab; Back… | 38.9 (1), 38.10 (2), 38.11 (3), 38.12 (1) | Y (cross-tab entry rule) | 38.9 owns the shell routing rule (C-02, `universal-fab-logic.ts`); area landings (B-08, G-11, H-12, D-29) stay with areas. Add Contact → new Profile stays (phase-01 §D). |
| X-08 | Android Back does not close the innermost thing first | 38.9 (5), 38.10 (3), 38.11 (7), 38.12 (1) | Y | C-01 navigator `backBehavior` in 38.9; per-screen Back handlers (A-09, B-15) in areas. |
| X-09 | Search and filter state persists invisibly, and search behaves… | 38.9 (2), 38.10 (2), 38.11 (8), 38.12 (3) | Y (reset rule) | Reset rule area-applied; A-04 resolved by D-95 (built 38.11, Batch 15). |
| X-10 | Lists, sheets and stacks show stale data after a change made elsewhere | 38.11 (6), 38.12 (2), none (1) | Y (focus-reload + replace-after-save) | D-02 fix also fixes H-23 (38.11). H-01 owns D-35. |
| X-11 | Contact frequency: five editors and three vocabularies for one setting | 38.9 (1), 38.10 (3), 38.11 (4), 38.12 (2) | N | Area unification (38.11); E-05 with D-51 in 38.11 (D-102). |
| X-12 | "Last talked about" and "Current location": overwrite in one place,… | 38.9 (1), 38.10 (5) | N | Current-state fields with 38.10 (Last Talked About section, 999.3). Keep ADR-088 history model unless owner reverses. |
| X-13 | Birthday and other dates: picker vs free text, no way to clear,… | 38.10 (1), 38.11 (6), 38.12 (2) | lite | `maximumDate` set (E-12, F-13, B-23 half) fixed together in 38.11. |
| X-14 | Dates shown raw (ISO) on many surfaces | 38.9 (2), 38.10 (3), 38.11 (1), 38.12 (2) | Y (one formatter in `utils/dates.ts`) | One formatter in `utils/dates.ts` (38.9); area-specific raw values ride along. |
| X-15 | Memories: three lists, three editors, and Profile buttons that don't… | 38.10 (14) | N (area) | 38.10 core theme (D-01 etc.). Lessons name the Profile's Things to Remember. |
| X-16 | Key people: the linked contact is never named while editing, pinning… | 38.10 (9), 40 (1) | N | Key people → 38.10 (E-14 ≡ G-16). |
| X-17 | Off Limits: four names, missing from editors and search, deleted… | 38.10 (8), 40 (1) | N | Off Limits → 38.10 (999.3); H-10/H-25 "fuel" wording there by owner rule. |
| X-18 | Contact methods: usability is judged in one place and ignored in… | 38.10 (1), 38.11 (5), 38.12 (1) | N | J-01 (D-100) in 38.11; fix shows destination, keeps ADR-133 fallback. |
| X-19 | Custom fields: raw values on three surfaces, free-text dates, a… | 38.9 (1), 38.10 (7), 38.11 (3) | N | Custom-field display; TTR surfaces in 38.10, form widgets in 38.11. |
| X-20 | Snooze and Mute: three snooze UIs, and Mute hidden | 38.9 (1), 38.11 (3), 38.12 (3) | N | Snooze unification in 38.11 (A-14, D-05, D-33); lifecycle-snooze (D-27/H-21) in 38.12. |
| X-21 | Category and photo editors | 38.9 (1), 38.10 (1), 38.11 (3), 38.12 (1) | N | Area (38.11). |
| X-22 | Five ways to create a contact, each with a different form | 38.9 (1), 38.10 (2), 38.11 (4), 38.12 (2) | N | Create paths split by area; D-51 default constant shared with I-06. |
| X-23 | The Profile ignores Archived / Unbound state, and lifecycle actions… | 38.11 (1), 38.12 (13) | lite | Lifecycle-on-Profile cluster homed in 38.12 with its H pairs (§4.1). D-09 with D-77 in 38.11. |
| X-24 | Logging: three forms, four Quick Log variants and inconsistent… | 38.9 (1), 38.11 (12) | N | Logging unification in 38.11; keep 3-channel set (phase-13 §O, D-44). |
| X-25 | Forms and pickers don't say whose record you are editing | 38.9 (2), 38.10 (3), 38.11 (2), 38.12 (1) | Y (person-scoped header rule) | Header person-name slot applied with X-26 in 38.9 (E-10, F-08); D-29/G-11 in areas. |
| X-26 | Headers and Back controls: at least eight styles | 38.9 (7), 38.10 (1), 38.11 (3), 38.12 (2), 40 (1) | Y | House header in 38.9 (ShellAppBar child; ADR-175). Update `settings-chrome-contract.test.ts` in the same plan. |
| X-27 | Overflow (⋯) menus hide primary actions, hold one item, or open far… | 38.9 (1), 38.11 (3), 38.12 (3) | lite | Area. |
| X-28 | Save / Cancel / Done / Close wording and placement | 38.9 (2), 38.10 (5), 38.11 (5), 38.12 (6) | Y | Wording standard in 38.9 glossary; applied per area. |
| X-29 | Validation errors: silent, off-screen or stale | 38.9 (4), 38.10 (3), 38.11 (3) | Y | Inline validation primitive in 38.9 (E-02 + E-X01), same pattern applied to F-12, K-08. |
| X-30 | The keyboard covers the field or sheet being typed in | 38.9 (1), 38.10 (1), 38.11 (3), 38.12 (2) | Y (shared Sheet/scroll keyboard behaviour; extends ADR-174) | Area-applied (no owner rule names it); could be a shared Sheet behaviour in 38.9. |
| X-31 | Primary actions sit in the gesture bar or below the fold | 38.9 (1), 38.10 (2), 38.11 (6), 38.12 (2) | Y (safe-area rule) | Area; large-text aspects 40. |
| X-32 | Sheets and dialogs: sizes, positions and close affordances differ | 38.10 (2), 38.11 (5), 38.12 (3) | Y | Area; lesson card is a 5th overlay variant (39). |
| X-33 | Pickers: six contact-picker designs and native vs themed option… | 38.9 (2), 38.10 (1), 38.11 (2), 38.12 (3) | Y | Area; I-08 face grid is decided (10-capture). |
| X-34 | Selected, disabled and on/off states are drawn differently on every… | 38.9 (4), 38.10 (2), 38.11 (4), 38.12 (8) | Y (tokens) | Tokens in 38.9 (E-22/K-29, K-28); E-13/D-94 in 38.11 (D-102). |
| X-35 | List rows and list management | 38.10 (1), 38.11 (5), 38.12 (7) | lite | Area. |
| X-36 | Same concept, different words | 38.9 (10), 38.10 (4), 38.11 (13), 38.12 (4), 40 (1) | Y (glossary) | Glossary + cross-area renames in 38.9. Renames of decided terms (Bound/Unbound, Transmit, Group Log, Never Contacted) are owner calls. |
| X-37 | Developer and data-model vocabulary shown to users | 38.9 (4), 38.10 (6), 38.11 (8), 38.12 (4), 40 (1) | Y (glossary) | Glossary sweep in 38.9 for vocabulary-only members; explanatory UI (legends, A-19, F-15, D-19) in areas. |
| X-38 | Menu labels vs destination titles, casing and plurals | 38.9 (7), 38.10 (2), 38.11 (1), 38.12 (3) | Y | Label/casing/plural sweep in 38.9. |
| X-39 | Screen-reader labels lose names, values and state | 38.9 (1), 38.11 (1), 40 (8) | Y | Accessibility-label sweep → 40 (owner R3, Batch 14). |
| X-40 | Background art and header surfaces differ between sibling screens | 38.9 (2), 38.11 (4), 38.12 (1) | lite | Area. |
| X-41 | Empty states: some explain and offer an action, most don't | 38.9 (3), 38.10 (4), 38.11 (6), 38.12 (3) | Y | Shared EmptyState in 38.9 (A-32, B-13); area copy in areas. D-98 tucked-away state in 38.11. |
| X-42 | Actions reachable only by an undisclosed gesture | 38.10 (1), 38.11 (2), 38.12 (2) | Y (rule) | Area; no permanent in-list gesture hint (D-48). |
| X-43 | Heatmaps have no labels and their days can't be opened | 38.9 (1), 38.11 (4), 40 (1) | lite | Area; yearly heatmap rendering is 40-CONTEXT D-01. |

## 5. Non-UX items (`NON-UX-FINDINGS.md`)

| id | home | note |
|---|---|---|
| A-X01 | 38.11 | Investigate at the start of 38.11 (owner R4 a, Batch 14: "as robust as it needs to be"); test with A-01/A-08. Perf is formally 40-CONTEXT D-01/D-05, owner moved the investigation earlier. |
| A-X02 | 38.11 | Same investigation as A-X01 (owner R4 a). Test X-05 Undo windows in list view. |
| A-X03 | 38.11 | Same handler as A-03 (`DashboardControlRow.tsx` `togglePopulation`); one change. |
| B-X01 | 38.11 | Latest-request guard in `GroupEventsScreen` with B-14/B-15 (enforces ADR-162). |
| D-X01 | 38.11 | Profile Layout editor scroll container, with D-11. |
| E-X01 | 38.9 | Half of E-02's fix (`measureLayout` ref on blocked Save, Add and Edit); same validation pass as F-12/K-08. |
| J-X01 | 38.10 | One `groupItems()` fix with J-09 in Compose → Things to Remember. |

## 6. Backlog

| Backlog | Disposition | What it absorbs here |
|---|---|---|
| 999.3 Inline knowledge inputs on the contact forms (retire Fuel editor) | **→ 38.10** (absorbed, owner 2026-10-10; ROADMAP) | E-08, E-24 (Add controls / immediate writes inside forms), E-07, E-25 (current-state inputs), Off Limits members of X-17, G-03 and G-09 Off Limits halves, H-10, H-25 ("fuel" wording); §7 999.3 note (Update Contact's list editor is the closest-to-right Off Limits editor). Also folds todo `2026-09-27-retire-old-fuel-editor.md` (38.4 D-54) per ROADMAP. |
| 999.5 Shared items get their own TTR section, with optional reminders | **→ 38.10** (absorbed; D-99 sets the flow: share → person → chosen section) | All of area I (I-01..I-14, I-16; I-15 a11y → 40), the §7 999.5 note (shares invisible; inconsistent search on shared text), the AI-egress of share rows (slice3 §6 Q2; owner direction P1: per-item Allow AI off by default). Supersedes ADR-081's share half and `10-capture.md` "lands as Conversational Fuel" (owner decision at 38.10's dossier). |
| 999.6 Move an entry between TTR sections | **→ 38.10** (absorbed) | G-01 (imported type lost on Save — the opposite direction), the §7 999.6 note ("Added by you" vs Profile filing), D-03 (edit buttons never reach the item). |
| 999.2 Markdown export format | Unchanged | — |
| 999.4 App name through one constant | Unchanged | Adjacent only: A-21 ("Tell Orbit…"), K-40, K-41 literals; X-36/X-38 sweeps in 38.9 must leave app-name literals to 999.4. |

## 7. Judgment calls

Each line: finding(s) → chosen home, the alternative, and why. These are my readings of the owner rules, not owner decisions.

1. **C-01, C-02 → 38.9** (alt 38.11). C-01 is the tab navigator's `backBehavior` (`RootNavigator.tsx`), C-02 the + routing in `universal-fab-logic.ts`/`tab-entry.ts`; both are shell code that fixes several areas at once (X-08, X-07). The X-07 "where + flows live and end" owner call (slice5 §6 #5) belongs in the 38.9 dossier. Area landings (B-08, G-11, H-12, D-29) stay with areas.
2. **Area E → 38.11** per the owner rule as relayed; ROADMAP 38.11's provisional scope omits E (lists A, B, C, D, F, J). The E items that are memory/TTR (E-07, E-08, E-14, E-15, E-24, E-25, E-29) go to 38.10 and the guard/header/wording items to 38.9.
3. **A-14, D-05, D-33 → 38.11** (alt 38.9 as X-04 members). The fix is snooze unification (X-20: reuse the bulk-snooze sheet), not a plain Alert→ConfirmDialog swap. 38.9's Alert sweep should skip `HomeScreen.tsx:1528` or expect it to be replaced.
4. **A-09, B-15 → 38.11** (alt 38.9; slice5 S2 listed them). Per-screen BackHandler logic; 38.9 sets the X-08 rule.
5. **A-13 → 38.9** (alt 38.11). Root cause is the snackbar mounting under RN Modal sheets (slice5 §3) — a feedback primitive. The bulk-sheet Continue/inline error rides along.
6. **A-32, B-13 → 38.9** (alt 38.11). One shared empty-state/truncation fix covers both (§4.1 merge). A-05, A-33, B-24 empty-state *copy* stays in 38.11.
7. **E-10, F-08 → 38.9** (alt 38.11). "Name the person" is applied in the same header pass as X-26 (X-25 standard). D-29 (Log button, owner call) and G-11 stay with areas.
8. **F-12, K-08 → 38.9** (alt 38.11 / 38.12). Same off-screen/stale validation pattern as E-02 + E-X01 (NON-UX links table); one validation pass.
9. **J-11 → 38.9** (alt 38.11). Fix is adding `ComposeResearch` to `FOCUSED_WORKFLOW_ROUTES` — a shell visibility rule.
10. **Vocabulary-only COPY → 38.9**: A-15, A-16, A-17, A-29, B-10, B-12, C-11, D-12, D-31, E-20, E-23, J-18, K-32, K-43. **Kept in areas** because the fix also changes structure or needs area logic: A-11, A-18, A-19, A-31, C-10, F-09, F-24, G-07, G-22, H-04, H-28, K-17, K-23, K-40. Renames of decided terms (Bound/Unbound, Transmit, Group Log, Dissolve, Interaction Assist, Never Contacted) remain owner calls in the 38.9 dossier.
11. **J-17 → 38.9** (alt 40). Coded A11Y, but the fix is the "1 items" plural (X-38 only).
12. **K-28 → 38.9** (alt 40, it is tagged X-39 too). Primary problem is selected-state styling (X-34).
13. **D-16 → 38.11** (alt 38.9 as X-34 member). It is one component bug (`ProfileModuleHost` chevron never flips), not a token standard.
14. **B-03 → 38.9** (alt 38.11). Fix is the house header on Edit Group Event / Edit participant (X-26); B-01, B-02 stay in 38.11.
15. **B-07, G-03, H-19, K-14, K-18 → areas** (alt 38.9 under X-03). They apply the destructive rule with area semantics; 38.9 owns the rule only.
16. **A-06 → 38.10** (alt 38.11). The search corpus gap is Last talked about / Current location / Off Limits, all of which get new homes in 38.10. Off Limits in search is an owner call (sensitive; slice1 owner call #6).
17. **E-07, E-25 (X-12), E-08, E-24 → 38.10** (alt 38.11). Owner rule names "memory/fuel/Off Limits/TTR" findings; X-12 is not named but Last Talked About is a D-99 share destination and 999.3 makes these inline form inputs. E-08's photo-remove half and E-24's phone/email rows touch 38.11.
18. **D-15, D-22, D-34 → 38.10** (alt 38.11). The TTR item sheet (same sheet as D-01) and empty TTR sections are rebuilt there.
19. **F-18 → 38.10** (alt 38.11). The Add Note sheet's memory path ("Create Memory Instead").
20. **J-09, J-10, J-X01 → 38.10** (alt 38.11). Compose's TTR rendition must follow 38.10's section model; J-X01 is the same `groupItems()` fix.
21. **[Orchestrator ruling 2026-10-10: moved to 38.12 — Settings management pages; keeps 38.10 focused on fuel.]** **Area G custom-fields and categories items kept in 38.10** (G-05, G-06, G-07, G-20, G-22; G-04 and G-21 are in 38.9) per the explicit "area G" rule. They live under Settings → Contacts & Relationships (report G-04/G-07 "Where"), so **38.12 is a real alternative**. **G-08 → 38.12** because §4.1 merges it into K-10 (one list-management fix across Settings).
22. **Lifecycle-on-Profile cluster D-06, D-07, D-25, D-27, D-28 → 38.12** (alt 38.11). §4.1 says D-06 ⊂ H-24, D-27 ⊂ H-21, D-28 ⊂ H-20 and "fix together"; 38.12 owns lifecycle outcomes (ROADMAP goal). D-07 (Archive from Profile, no feedback) and D-25 (⋯ sheet stresses Unbind, ADR-150) go with H-18/H-19. Code is in Profile files, so 38.11 is the alternative for the whole cluster.
23. **H-23 → 38.11** (alt 38.12). Same cause and one-line fix as D-02 (`EditContactScreen.tsx:1068`, §4.1).
24. **K-33 → 38.11** (alt 38.12). §4.1 merges it with C-10 (Your Week period in two places).
25. **H-26, K-34 → 38.12** (alt 38.9 glossary). §4.1 merges them; H-26 also needs an Unbound entry in Settings (structural).
26. **E-09, G-12, I-05, J-07, K-06 → 38.9** under the X-01 guard rule, although 38.10 may rework Capture (I-05) and the Memory screen (G-12), and 38.11 owns the D-76 surfaces (J-07). The other phase inherits the guard.
27. **K-19, K-20 → 38.12** (alt 39). Their general halves (no progress; "Deletions applied: 0") are restore-flow fixes. The first-run entry/exit is 39-CONTEXT D-96, which neither Batch 15 nor D-102 moved, so 39 still builds that part.
28. **J-03 → 38.11** (alt 40). It sits on the D-76 surfaces that D-102 moved to 38.11 ("Later keeps it pending"); the eligibility/lifecycle heuristic itself is 40-CONTEXT D-01, listed under touches.
29. **J-06 → 38.11** with D-76 (slice4 class D). Not in the D-102 list, but same surfaces and same phase now.
30. **I-06 → 38.10** (alt 38.11). Area I by rule; it must read the same default constant as D-51 (now built in 38.11, D-102). Showing the frequency on the share sheet is an owner call (suspected 10-capture reversal).
31. **D-20 → 40** (alt 38.11). 40-CONTEXT D-01 lists "Relationship Overview packing". F-16 stays in 38.11 with 40 under touches ("yearly heatmap rendering").
32. **[Orchestrator move to 38.9 REVERTED 2026-10-10: it contradicted owner ruling R3 (Phase 40 keeps the accessibility-label sweep). Stays in 40; 39 frame 07's TalkBack copy follows whatever label ships.]** **A-30 → 40** per the X-39 rule, though its stale FAB label ("Add / capture") is what mockup frame 07's TalkBack line depends on; a cheap early fix in 38.9/38.11 is reasonable.
33. **X-30 keyboard members stay in areas** (A-25, F-11, I-02, J-07 half, K-11, K-31). No owner rule names X-30; slice5 marks it standard-setting, so a shared Sheet keyboard behaviour in 38.9 is the alternative.


## 8. Self-check

Script check run 2026-10-10 on this file: every id A-01..A-37, B-01..B-24, C-01..C-14, D-01..D-35, E-01..E-29, F-01..F-27, G-01..G-24, H-01..H-29, I-01..I-16, J-01..J-18, K-01..K-44 (per the report's Final counts table, 297 total) appears exactly once as a row in §3: **PASS** (duplicates: none; missing: none). Home totals sum to 297 findings + 7 non-UX = 304. Report-line numbers are the `### ` heading lines from `grep -n '^### [A-K]-[0-9]' UX-AUDIT-REPORT.md`.

## Rules added/changed

None. This file records recommended placements; it adds no standing rule.
