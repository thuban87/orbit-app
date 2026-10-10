# Slice 1 — Areas A (Contacts tab), C (Digest), D (Profile) vs Phase 39

Baseline: `.planning/phases/39-onboarding/39-CONTEXT.md` (D-01..D-93) + accepted mockup frames 01–08, A–D. Code read at HEAD d148ed47 (`git diff 05b85252..HEAD -- src` empty per BRIEF). Labels used: **[audit]** = the report's claim, **[code]** = what I read on disk, **[inference]** = my judgement.

**Findings: 86** (A 37 · C 14 · D 35, incl. D-35 which H-01 supersedes).

| Class | Count | Ids |
|---|---:|---|
| A | 2 | A-02, A-23 (borderline) |
| B | 1 | A-04 |
| C | 7 | A-19, A-30, A-36, C-11, C-13, D-16, D-22 |
| D | 1 | D-09 |
| E | 75 | everything else |

Plus **2 new items not in the audit** (found while verifying; see Gaps G-1, G-2). I recommend class A for both.

Tag counts: fix QW 36 · NI 46 · none 4 (D-31..D-34) · owner-call Y 10 · reversal Y 7 (2 confirmed, 5 suspected) · backlog 999.4 ×1 (A-21) · p40 Y 4 (A-01 partial, A-30, C-12, D-30).

## Table

| id | sev | class | D-IDs | tags | why |
|---|---|---|---|---|---|
| A-01 | M | E | — | NI; p40 partial (A-X01/X02 link); — | Blank list during reads. Fixing it *enforces* ADR-100 ("keep current rows visible"). Not on a lesson path. |
| A-02 | **H** | **A** | D-57, D-71, D-81, D-12 | QW; theme X-08/X-09 | On Orient replay after Restart, the Contacts step can open on a list silently filtered by an old search. The tucked-away/D-81 branch also misfires, because search-empty takes precedence. CONFIRMED. |
| A-03 | M | E | — | QW; reversal suspected ADR-093 (OR-union) / phase-05 dossier; X-? (none) | Population union. Orient does not teach populations (D-12). |
| A-04 | M | **B** | D-12, D-81 (mockup 05, A) | NI; owner-call Y; reversal **confirmed** ADR-093 §Decision ("Empty population selection means … Active Contacts"; rejected alt "Include never-contacted in Active") and phase-05 dossier :235/:239; X-09/X-36 | Both fixes the audit offers reverse a recorded decision. "None = All Contacts" would also void the D-12/D-81 premise. |
| A-05 | M | E | (D-81 sibling) | QW; X-09/X-41 | Filter-empty copy. Not reached on a fresh install (precedence at `dashboard-empty-logic.ts`). |
| A-06 | M | E | — | NI; owner-call Y (search scope); reversal suspected ADR-094/ADR-100 ("visible-surface-safe corpus"); X-09 | — |
| A-07 | M | E | — | NI; X-09 | — |
| A-08 | M | E | — | NI; reversal suspected ADR-100 ("keep current rows visible") if the fix blanks rows; X-09/X-10 | — |
| A-09 | M | E | — | QW; X-08 | Note: feeds A-02. |
| A-10 | M | E | D-68 | NI; X-06 | The + floats over the Contacts panels. The + lesson (D-68, frame 07) is pointed at on Digest, not over a panel. |
| A-11 | M | E | — | QW; X-27/X-37 | — |
| A-12 | M | E | — | NI; X-11 | — |
| A-13 | M | E | — | QW; X-05/X-11/X-29 | — |
| A-14 | M | E | D-30 | QW; X-04/X-05/X-20 | Snooze is not taught (D-30), so its UI must explain itself (D-02). |
| A-15 | L | E | D-30 | QW; X-36 | — |
| A-16 | L | E | — | QW; X-38 | — |
| A-17 | L | E | — | QW; X-36 | Lesson copy must not say "Dashboard" (none of the mockup copy does). |
| A-18 | L | E | — | QW | — |
| A-19 | L | **C** | D-65, D-12 | NI; owner-call Y (legend); X-37 | Status names differ: the app uses "Rogue/Wobbling/Decaying" (only in a11y), the D-65 lesson says Stable/Wobble/Decay, and the mockup says "Wobbly". Any legend or rename must use the same words. |
| A-20 | L | E | — | QW | — |
| A-21 | L | E | — | NI; backlog 999.4 ("Tell Orbit a little more…", `list-row-selection.ts:14`); X-35/X-41 | — |
| A-22 | L | E | D-77 (vocab) | NI; X-35 | "No interacti…" truncation. Pick the term together with C-11 and D-77. |
| A-23 | L | **A** (borderline) | D-71, D-53, D-16 | QW; X-42 | The taught right swipe (D-71) and the first-Quick-Log intercept (D-53, frame A) both leave the row stuck open on a dead "Log" panel. CONFIRMED. |
| A-24 | L | E | D-17, D-53 | QW; X-25/X-28/X-33 | The same "Choose contact" picker sits in front of the + Quick Log intercept. It is not taught behaviour. A title is a cheap win. |
| A-25 | L | E | D-17 | NI; X-30/X-33 | First-run users have one contact and don't need to type. |
| A-26 | L | E | — | NI; X-34 | — |
| A-27 | L | E | — | NI | — |
| A-28 | L | E | — | NI; X-21/X-32/X-38 | — |
| A-29 | L | E | D-17 | QW; X-24/X-27/X-36/X-38 | "Add Contact" opens a screen titled "New contact". Mockup frame 03 already says "New contact form". |
| A-30 | M | **C** | D-32, D-68 (frame 07 TalkBack) | NI; p40 Y; X-39 | The FAB is labelled "Add / capture" (`UniversalFab.tsx:455`), but the mockup's TalkBack line says focus lands on "Add, button". Tab labels read the icon glyph, which affects Orient's tab cutouts. |
| A-31 | L | E | — | NI; X-37 | — |
| A-32 | L | E | — | QW; X-09/X-41 | — |
| A-33 | L | E | — | QW; X-41 | — |
| A-34 | L | E | — | NI | — |
| A-35 | L | E | D-16/D-53 (frame A "usual 'Logged' snackbar") | QW; X-05 | Note: F-03 (other slice) says Quick Log's channel follows the last pick. That may make the intercept copy "saves a Message" false. |
| A-36 | L | **C** | D-71, D-48 | NI; owner-call Y (visible row actions); reversal suspected D-48/phase-06 :350 if made permanent; X-42 | D-71 already supplies the one-time hint. But the swipe line is false in card view, which has no swipe. |
| A-37 | L | E | — | NI; X-35 | — |
| C-01 | M | E | D-68 (planning note) | QW; X-08 | CONFIRMED `RootNavigator.tsx:240` (no `backBehavior`). Planning note: with `history`, Orient's tab hops go into the Back history. |
| C-02 | M | E | D-17, D-86 (planning note) | NI; X-07 | CONFIRMED `universal-fab-logic.ts:190` + `tab-entry.ts:66` `initial:false`. |
| C-03 | M | E | D-12, D-81 (planning note) | NI; owner-call Y; reversal **confirmed** ADR-147 ("every scalable drill persisting the canonical Contacts query axes"); X-07/X-09 | CONFIRMED `DigestScreen.tsx:111-124`. A drill switches Contacts' saved view; a later Restart → Orient then shows that population instead of tucked-away. |
| C-04 | M | E | D-12 | QW; X-43 | Your Week is taught conceptually only. |
| C-05 | M | E | D-12 | QW; X-35/X-43 | — |
| C-06 | M | E | — | QW; X-14 | — |
| C-07 | L | E | — | QW; X-34/X-43 | — |
| C-08 | L | E | — | QW; X-35 | — |
| C-09 | L | E | — | NI | — |
| C-10 | L | E | — | NI; owner-call Y (one home); X-36/X-37 | — |
| C-11 | L | **C** | D-12, D-77, D-81 (frames 04/05) | QW; X-36 | Three names for one group, and the lesson copy uses two of them ("Never Contacted" on Digest, "Not yet contacted" on Contacts). D-77's still-open copy should take the single chosen term. |
| C-12 | L | E | — | QW; p40 Y; X-37/X-39 | — |
| C-13 | L | **C** | D-12 (frame 04) | NI; X-37 | Frame 04 says "Horizon: birthdays, and people you haven't contacted yet". It leaves out Overlooked, the very section C-13 says nobody explains. |
| C-14 | L | E | — | NI; X-06 | — |
| D-01 | **H** | E | D-14 (excludes pin/hide) | NI; owner-call Y (wire or remove); X-15/X-16 | CONFIRMED (`ContactProfileScreen.tsx:361-394` never reads `intent.action`; `ThingsToRemember.tsx:101-110`). Prepare runs on a new person's empty Things to Remember, which has no item sheets, and pin/hide are not taught, so this is not A. Strongly recommend fixing before 39's device pass (D-02 spirit). |
| D-02 | M | E | D-14 (planning note) | QW; X-08/X-10 (≡ H-23) | CONFIRMED `EditContactScreen.tsx:1068` `navigate("Profile")`. Prepare's trigger detection must decide whether a Profile pushed by an Edit save counts as "normal". Fixing it with `popTo` removes the ambiguity. |
| D-03 | M | E | — | NI; X-12/X-15/X-16 | — |
| D-04 | M | E | — | QW; X-15 | — |
| D-05 | M | E | D-30 | QW; X-05/X-20/X-32/X-36 | — |
| D-06 | M | E | D-30 | QW; X-04/X-23 | — |
| D-07 | M | E | D-30 | NI; X-03/X-05/X-23 | — |
| D-08 | M | E | D-14 (Contact Methods), D-15 | QW; X-18 | CONFIRMED `relationship-sheet-model.ts:241-247`. A manual first contact usually has no phone, so the header claim is true then. |
| D-09 | M | **D** | D-77 | NI; X-23/X-36 | CONFIRMED `profile-metrics.ts:154-167`: one "Not tracked / Set a contact frequency" branch covers Unbound, no cadence and no contact. D-77 splits this same branch, so add the Unbound reason there. |
| D-10 | M | E | — | NI; X-02/X-11/X-36 | — |
| D-11 | M | E | D-31, D-14 | NI | The layout save rewrites the collapse flags. A new contact still starts collapsed (`presentation-schema.ts:124-128` CONFIRMED). |
| D-12 | M | E | D-31 | NI; X-37 | Profile presentation is not taught, so its UI copy must explain itself (D-02). |
| D-13 | M | E | D-31 | NI; owner-call Y (scope); X-03/X-26 | — |
| D-14 | M | E | — | NI; X-40 | — |
| D-15 | L | E | — | QW; X-28/X-32 | — |
| D-16 | L | **C** | D-14 (frame B), D-67 (frame D) | NI; X-34 | CONFIRMED `ProfileModuleHost.tsx:119-122` always draws `chevron-down`. Prepare says "Sections start closed. Tap one to open it", and frame D draws open History as ⌃, which the app never shows. |
| D-17 | L | E | — | NI; X-26/X-40 | — |
| D-18 | L | E | D-67 | NI; X-06/X-43 | The + half-covers today's heatmap cell mid-scroll, right where the History hint points. Fix with X-06. |
| D-19 | L | E | D-14 | NI; X-37 | Overview sheets don't explain their terms. D-14 rightly does not teach Gravity/Intensity, so the fix is the sheet copy (D-02). |
| D-20 | L | E | — | NI | — |
| D-21 | L | E | — | QW; X-14/X-20 | — |
| D-22 | L | **C** | D-14 (frame B) | QW; X-19/X-41 | Prepare says "Keep what you know about Maya here". For a new person, opening Things to Remember shows rows of "Nothing added yet" with only a small pencil. The step copy must say how to add, or D-22's "Add…" action lands first. |
| D-23 | M | E | — | NI; X-15 | — |
| D-24 | M | E | — | NI; owner-call Y (where birthday shows); X-13 | — |
| D-25 | L | E | — | NI; X-03/X-23/X-27/X-28/X-32 | — |
| D-26 | L | E | — | NI; X-04 | — |
| D-27 | L | E | D-30 | NI; X-20/X-23 | — |
| D-28 | L | E | D-30 | NI; X-23/X-34 | — |
| D-29 | M | E | D-16, D-53 | NI; owner-call Y (Log button on Profile); reversal suspected (Profile header action set, unverified); X-07/X-25 | If a Log button is added, it becomes a new Record/D-53 entry point. |
| D-30 | L | E | — | QW; p40 Y; X-17/X-36/X-39 | — |
| D-31 | L | E | — | none; X-12/X-36/X-38 | — |
| D-32 | L | E | — | none; X-26 | — |
| D-33 | L | E | D-30 | none; X-02/X-04/X-13/X-20/X-31 | — |
| D-34 | L | E | — | none; X-17 | — |
| D-35 | M | E | D-30 | QW (→ H-01); X-10 | Superseded by H-01. |

## Class A detail

**A-02 — the Orient Contacts step can open on a list silently filtered by an old search (D-57 replay, D-71/D-81 step).**
- What's broken [code, CONFIRMED]: the search term lives in the module-level session store (`HomeScreen.tsx:671`, `src/stores/dashboard-session-store.ts`; it is never persisted, but it outlives the screen). `searchExpanded` starts `useState(false)` (`HomeScreen.tsx:675`). Only `onToggleSearch` clears the term on collapse (`:737-744`). When the Activity is recreated but the JS process survives (Back-exit, then reopen), the list stays filtered and the box is closed. The empty-state gate puts `hasTerm` before the population branch (`dashboard-empty-logic.ts`, step 2), so it shows `No matches for "…"` instead of "Everyone's tucked away".
- Lesson/frame: Orient step 2 (frame 05; D-71, D-81) on the D-57 "Orient replays on the next app open" path. A fresh install is unaffected, because a cold process starts with an empty store. [inference] The lesson would say "Search, sort and filter the people you keep in touch with" over a list that has been secretly searched, and D-81's variant selection (no rows) would read the wrong state.
- Minimal fix: the audit's one-liner. Either clear the session term on HomeScreen mount, or initialise `searchExpanded` from `searchText !== ""`. The Orient trigger could also clear the session search before showing step 2.

**A-23 — after a right swipe the row stays open on a dead "Log" panel (D-71 teaching, D-53 intercept entry). Borderline.**
- What's broken [code, CONFIRMED]: `SwipeableListRow.onSwipeableOpen` (`HomeScreen.tsx:365-374`) fires `onLogInteraction`, or Edit on a left swipe, and never calls `swipeableRef.current?.close()`. `SwipeActionSurface` is not pressable. This does not depend on list size; the 1,000-contact caveat does not apply to this half.
- Lesson/frame: the D-71 swipe line (frame 05) and the Quick Log intercept (frame A, "here a right swipe on Maya"). The intercept will be wired into this exact handler (D-53 lists the row swipe as an entry). As the code stands, after "Log it" the user sees a leftover "Log" button that does nothing. [inference] That teaches a gesture whose result looks unfinished (D-02).
- Why only borderline: the write itself is correct, and the leftover is visual. The orchestrator may downgrade it to E and fold it into whichever plan wires the D-53 intercept, since it touches the same handler.
- Minimal fix: call `swipeableRef.current?.close()` in `onSwipeableOpen` on both directions, or in the intercept's continue path.

## Class B detail

**A-04 — the default Contacts population is a hidden "Active Contacts"; Reset lands there too.**
- Verification [code, CONFIRMED]:
  - `AXIS_DEFAULT_LABELS.population = "Active Contacts"` (`control-labels.ts:17`).
  - An empty selection resolves to `ACTIVE_SEGREGATION_WHERE`, which excludes `last_contact IS NULL` (`dashboard-query-logic.ts`, `buildPopulationWhere`).
  - The fresh-install default is `dashboard_populations '[]'` (`migrations/019-dashboard-prefs.ts:19`; the store's fallback is also `[]`).
  - `resetDashboardView` sets `populations: []`.
  - So **every new user starts here**, and Maya (Bound, Not yet) is invisible in Contacts. This is exactly the state D-12, D-81 and frame 05 rely on.
- Why it is B: the audit offers two fixes, and each reverses a recorded decision:
  - (a) "None selected = All Contacts" reverses **ADR-093** §Decision ("Empty population selection means status-bearing Active Contacts"; its rejected alternative is "Include never-contacted contacts in Active Contacts"). It would also void D-12's "not in the default Active population", D-81's first-run trigger and frame 05. The first-run Contacts step would then show Maya as a row, so the swipe line gets a real target.
  - (b) "List Active Contacts as a real option" reverses phase-05 dossier :235 `[DECIDED]` "Active Contacts is not shown as an explicit selectable population" and touches :239. It leaves D-12/D-81 intact.
- D-02 angle [inference]: the fresh-install audit flagged this disappearance (F11/F15, `phase-39-fresh-install-foundation-audit.md:286`), and the owner chose D-81 knowing it (Q-32). So this is not a lesson unknowingly covering bad UX. A-04 is new evidence that the default is itself unselectable and unexplained, though.
- Proposed amendment (only if the owner picks (a)): "D-94: The Contacts default population is All Contacts. Orient step 2 shows the first person as a row and D-71's line applies as written. D-81's variant applies only when no Bound person exists (e.g. adapted Orient)."
- Recommendation: decide A-04 **before** 39 planning. For 39's sake, (b) or leaving it alone keeps D-12/D-81 unchanged. Product-wise, (a) removes the "I added someone and they vanished" problem that D-81 currently explains away. That is the owner's call.

## Class C/D detail

- **A-19 (C)** — The status vocabulary must be one set. The app says Rogue/Wobbling/Decaying (`status-display-label.ts:5-17`) and "rogue status" (`UpNextSection.tsx:63`). D-65's copy says Stable/Wobble/Decay, and the mockup says "Wobbly". If A-19/C-12 rename or add a legend, the Orrery lesson copy must follow.
- **A-30 (C)** — The frame 07 TalkBack note expects "Add, button". The real label is "Add / capture" (`UniversalFab.tsx:455`). Either fix the label (recommended; "capture" is a leftover word) or change the mockup note. The tab glyph noise matters for Orient's tab-cutout narration (D-32). Phase 40 owns the broader a11y audit.
- **A-36 (C)** — The default view is list (`019-dashboard-prefs.ts:15`), so the D-71 line is true for new users. After Restart, a user in card view hears a swipe line for a view with no swipe. Make the line conditional on the view mode (within the Claude's-discretion copy latitude). Visible row actions instead would be an owner call against D-48.
- **C-11 (C)** — "Never Contacted" (`HorizonSection.tsx:140`), "Not Contacted" (`control-labels.ts:12`), "Not yet contacted" (`status-display-label.ts:17`; the tucked-away line at `HomeScreen.tsx:1741`). The D-77 status copy is still open ("exact copy at planning"). Pick one term and use it in the D-77 label, the Orient step 1/2 copy and the UI.
- **C-13 (C)** — Frame 04's Horizon line omits Overlooked. Make the copy accurate, or fix C-13's missing reason line first.
- **D-16 (C)** — The chevron never flips, yet frame D draws ⌃ and Prepare teaches open/closed sections. Recommend landing D-16 with Prepare, or keep the copy from relying on the chevron.
- **D-22 (C)** — On Prepare's emphasised section, a new person shows only "Nothing added yet" cards (`knowledge-presentation.ts:123,243,325,351`). Either the step copy names the way to add (pencil or + → Memory), or D-22's Add action lands first.
- **D-09 (D)** — Fold into D-77: both change the same `resolveProfileStatus` branch (`profile-metrics.ts:154-167`). Give one reason per branch (Unbound / no cadence / Bound + not contacted yet). This slightly widens D-77, which is the orchestrator's call; it touches only this function.

## Hidden owner calls

1. **A-04 default population** (B above). Rec: decide before planning; (b) keeps 39 as is.
2. **G-1: what should "N not yet contacted →" do when tapped?** It is the D-81 / frame 05 target, and today it is inert text with an arrow. Rec: open the Not Contacted population as a *temporary* view. Note that a persistent switch is what ADR-147 does for Digest drills (C-03), so making it temporary is a design choice.
3. **C-03 drill persistence** reverses ADR-147. Rec: a temporary "From Digest" view. This is owner-bucket because of the ADR.
4. **D-01 pin/unpin/hide on the Profile sheet:** wire them up, or remove them? Rec: wire them (the editor's services exist). Fix before the 39 device pass regardless.
5. **D-29 Log button on the Profile header?** If yes, it adds a Record entry point; check it against D-16/D-53. Rec: yes, but log it as a new D-53 entry.
6. **A-06 search scope** (Off Limits / current-state in search). It touches ADR-094/ADR-100. Rec: include current-state, keep Off Limits out (it is sensitive).
7. **A-19 status legend.** Rec: a small "What do these mean?" row using the same words as D-65. No lesson, per D-12.
8. **A-36 visible row actions vs the D-71 one-time line.** Rec: keep D-71 and D-48 as they are.
9. **C-10 Your Week setting home**, **D-13 Background scope**, **D-24 birthday placement:** not 39-relevant. Rec per the audit.
10. **D-30 ruled out Favourite/Snooze/Archive lessons, and D-31 ruled out Profile presentation lessons.** The audit shows those surfaces are inconsistent: three snooze UIs, archive with no feedback or restore, developer-term layout copy (A-14, D-05..D-07, D-12, D-13, D-27, D-28). Under D-02 the "no lesson" rulings are still sound, but only if these UX fixes happen. Rec: no change to D-30/D-31. Prioritise X-20, X-23 and X-37 in fix planning.

## Suspected recorded-decision reversals

- A-04 → **ADR-093** §Decision + rejected alternative (confirmed) / phase-05 dossier :235, :239 (confirmed text).
- C-03 → **ADR-147** "every scalable drill persisting the canonical Contacts query axes atomically" (confirmed text).
- A-03 → ADR-093 "explicit populations combine as a deduplicated OR-union" (suspected; All Contacts exclusivity changes the union rule for that one option).
- A-06 → ADR-094 / ADR-100 search corpus scope (suspected).
- A-08 → ADR-100 "ordinary local query changes keep current rows visible" (suspected, if the fix blanks rows; A-01's fix instead *enforces* ADR-100).
- A-36 → D-48 / phase-06 dossier :350 "no permanent in-list gesture tutorial" (suspected, if the fix is permanent row hints).
- D-29 → the Profile header action set (suspected, unverified; no ADR located).

## Gaps (39 depends on these; the audit did not verify them)

- **G-1 — The "Everyone's tucked away" empty state was never reached on device (§8). [code] It is not fit to be a lesson target as it stands.** At `HomeScreen.tsx:1734-1755`:
  - `${counts.neverContacted} not yet contacted →` is a plain `<Text>` with an arrow and **no press handler**. Frame 05 spotlights exactly this line, and users will tap it and get nothing (a DEAD-class defect).
  - Unbound people are never mentioned: the counts list never-contacted, snoozed and archived, but not `counts.unbound`. In D-52's adapted Orient, where everyone is Unbound, the Contacts step shows a bare heading with no explanation and no pointer to Unbound Contacts. The fresh-install audit already noted this (F11/F15).
  - The gate logic is sound for Maya-only: live=0, neverContacted=1, so the state is "hidden" (`dashboard-empty-logic.ts`; counts at `dashboard-read.ts:540-555, 612-617`).
  - The "firstrun" state (button only, no heading) appears only after Skip Tutorials with no people.
  - **Recommend class A for D-81/frame 05:** make the line a real control, or don't style it as a link, and add an Unbound line before adapted Orient points here. What the tap does is owner call #2.
- **G-2 — NEW: the list-row TalkBack action named "Log Interaction" actually runs the right-swipe action, which is Quick Log by default.** `ListRow.tsx:231-245` labels it "Log Interaction". `HomeScreen.tsx:627-642` `onLogInteraction` reads `dashboardRightSwipeAction` and calls `logQuickly` unless it is "log-contact". The grid card labels the two correctly (`GridCard.tsx:190-192`; card "Log Interaction" goes to `LogContact`, `HomeScreen.tsx:1443-1445`).
  - D-71's non-gesture equivalent and frame 05's TalkBack text ("use a person's actions to Log Interaction or Edit Contact") send TalkBack users into the Quick Log intercept (D-53). That card then says "use Log Interaction … instead", which contradicts the action they just chose. This undercuts the distinction D-16 teaches.
  - **Recommend class A** (before the D-71/D-16 lessons): label the action from the preference ("Quick Log" or "Log Interaction"), or expose both, as the grid does.
- **G-3 — D-14 Prepare trigger vs D-02.** A Profile pushed by an Edit save (`EditContactScreen.tsx:1068`) is a second Profile instance whose Back goes to the stale Edit form. The planner must decide whether that counts as a "normal" visit. Fixing D-02 first removes the ambiguity.
- **G-4 — D-86 first-run landing vs C-02.** `Create` lives in the Contacts stack, and `+` targets push with `initial:false` (`tab-entry.ts:66`). D-86's "save lands on Digest" must not leave Create or Profile stacked in the Contacts tab, or the first post-Orient visit to Contacts or + lands on a stale screen.
- **G-5 — C-01 vs Orient tab hops.** If C-01 is fixed with `backBehavior="history"`, Orient's programmatic Digest → Contacts → Orrery → Digest switches enter the Back history. After Done, Android Back on Digest would walk back through Orrery and Contacts. Plan the two together.
- **G-6 — Mockup frame A** says "here a right swipe on Maya". Under the current default population, Maya is not in the Contacts list (A-04), so no such swipe is possible in first run. This is mockup copy only (C).
- **G-7 — Digest empty/error states and Your Week empty** ("You're all caught up", "A quiet week") were code-read only (§8). Frame 04 relies on "You're all caught up". The copy exists at `UpNextSection.tsx:43` (checked). Low risk.
