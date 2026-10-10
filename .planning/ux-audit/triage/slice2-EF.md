# Slice 2: areas E (Add / Edit / Update Contact) and F (Logging and history) vs Phase 39

Baseline: `39-CONTEXT.md` D-01..D-93 plus mockup frames 03, 07, A and D. Code read at HEAD d148ed47 (`git diff 05b85252..HEAD -- src` is empty). Read-only. Labels used below: **audit** = the report's claim, **code** = what I read on disk, **inference** = my own judgement.

**Findings: 56** (E 29, F 27).
- **By class:** A 4 · B 1 · C 7 · D 1 · E 43.
- **fix tag:** QW 26 · NI 27 · both 3.
- **Other tags:** owner-call Y 9 · reversal Y/suspected 9 · backlog 2 (999.3) · p40 3 (E-22 partial).

| id | sev | class | D-IDs | tags | one-line why |
|---|---|---|---|---|---|
| E-01 | High | **A** | D-03, D-02, D-61, D-86, D-70 | QW; theme X-01; enforces phase-13 §AF | First-run Acquire runs on the `Create` route. Back after the tip silently throws away typed work and returns to Acquire. CONFIRMED |
| E-02 | Med | **A** | D-03, D-51 ("Name stays the only required field") | QW; X-29 | First-run Save with an empty name does nothing on a focused route that has no other way forward. CONFIRMED |
| E-03 | Med | E | — | QW; X-13 | Birthday can't be cleared. Not taught. |
| E-04 | Med | E | (D-87 sequencing) | NI; owner-call Y; reversal suspected ADR-016/ADR-131 (lean create form); X-22 | Which fields belong on Add is a product call. If Add becomes "Edit in new mode", frame 03 must be redrawn. |
| E-05 | Med | **D** | D-51 | QW; X-11 | Seeding `intervalDays=30` under D-51 makes the "Custom… 0" path unreachable. Add it as an acceptance check. CONFIRMED |
| E-06 | Med | E | — | NI; X-18 | Draft phone and email rows show no actionability warning. |
| E-07 | Med | E | (D-25) | NI; owner-call Y; reversal suspected ADR-090 (value history); X-12 | Overwrite vs history model. Current-state fields are not taught (D-25). |
| E-08 | Med | E | (D-17 copy) | NI; owner-call Y; backlog 999.3 (Off Limits); X-02 | Mixed commit rules. The Orient "+" copy ("some save straight away, others when you tap Save") stays true. |
| E-09 | Med | E | (D-17) | QW; X-01/X-08; enforces phase-13 §AF | Update Contact sub-editor Back skips a level and drops text. Update Contact is not taught beyond being named in "+". |
| E-10 | Med | E | — | QW; X-25 | Update Contact doesn't name the person. |
| E-11 | Med | **C** | D-51, D-14 | NI; X-11/X-36 | The frame 03 card says "Monthly". Relationship Overview (taught in Prepare) shows "Every 30 days" (`RelationshipOverview.tsx:29`). Lesson vocabulary must match whichever display wins. |
| E-12 | Med | E | (D-50 keeps Pick date) | QW; X-13/X-14 | Last spoke "Pick date" offers future days and shows a raw ISO label. Not part of the tip copy. |
| E-13 | Med | **B** | D-50, D-74 | QW; owner-call Y; **reversal Y**: 34-UI-SPEC :115 and 38.4-06 RG-030 "intentionally muted Not yet"; X-34/X-22 | Under D-50 the form opens with nothing that looks selected. The fix reverses a recorded design rule that the mockup already silently breaks. CONFIRMED |
| E-14 | Med | E | — | QW; X-16 | Linked key person isn't named. |
| E-15 | Low | E | — | QW; X-37 | "AH" typo; "Presentation only" wording. |
| E-16 | Med | E | — | NI; X-04 | Native Alerts and spinners. Note: E-01's guard inherits the native "Discard changes?" Alert (`discard-keep-guard.ts:29`). |
| E-17 | Low | E | — | NI; X-13/X-19 | Custom date field is free text. |
| E-18 | Low | E | — | NI; X-19 | Duplicate "Custom Fields" row. |
| E-19 | Low | E | — | NI; X-18 | Links only on Edit. |
| E-20 | Low | **C** | D-10, D-74 (frames 02/03) | NI; X-26/X-38 | The mockup and Acquire copy name the "New contact" form. A rename to "Add Contact" changes frame 03's header and the Acquire caption. |
| E-21 | Low | E | — | QW; X-10 | Update "Updated" badge. |
| E-22 | Low | E | — | NI; p40 partial (contrast); X-34 | Off switches hard to see in dark themes. |
| E-23 | Low | **C** | D-51, D-87, D-91, frame 03 | QW; owner-call Y; reversal suspected ADR-062 / ADR-171 vocabulary; X-37/X-36 | The frame 03 card uses "Bound" / "active orbit" / "cadence". Renaming Bound/Unbound/"Orbit participation" rewrites the tip and D-91's literal list. |
| E-24 | Low | E | — | NI; backlog 999.3; X-18 | "Add" control styles differ. |
| E-25 | Low | E | — | QW; X-12 | Single-line Last talked about box. |
| E-26 | Low | E | — | NI; p40 Y; X-39 | A11y labels lack names and values. |
| E-27 | Low | E | — | NI; X-22 | Duplicate-name dialog. Irrelevant on a first run (no contacts yet). |
| E-28 | Low | E | — | NI; X-19 | "PP" initials avatar on an empty photo field. |
| E-29 | Low | E | (D-23) | NI; X-15 | MemoryScreen (a D-23 trigger) lists hidden memories unmarked. The lesson doesn't touch hidden memories. |
| F-01 | High | **A** | D-16, D-03, D-02, D-17 | QW; X-01; enforces phase-13 §AF | Record's Log Interaction branch teaches this form's commit model ("nothing saves until Save"). The form silently discards on Back while its siblings ask first. CONFIRMED |
| F-02 | Med | **C** | D-16 ("close the loop"), Discretion item 6 | both; owner-call Y (Undo on detailed log?); X-05 | Log Interaction save is silent and a backdated log hides behind "Show older". The Record close-the-loop copy and mockup frame A's "the usual 'Logged' snackbar" must match whatever ships. |
| F-03 | Med | **C** | D-16, D-53, D-34, frame A | both; **owner-call Y** (as asked); reversal Y if Quick Log stops following: ADR-130 :18, phase-13 §P :338-346; X-24/X-05 | Frame A says "Quick Log saves a **Message**". Code uses the resolved and remembered channel, so the intercept copy must name the channel actually used. |
| F-04 | Med | **C** | D-53, D-16, frame A | QW; owner-call Y; reversal suspected ADR-103 :18 ("canonical outbound manual shape"); X-24 | Bulk Quick Log (a D-53 intercept entry) writes channel `unspecified` with no Add Note. The intercept copy can't name a channel for bulk unless F-04 is fixed. |
| F-05 | Med | **A** | D-26, D-02, D-03 | NI; owner-call Y (label); reversal only if routing changes (ADR-102 :18); X-24 | A Group Log lesson trigger is the bulk "Log Interaction" button, which silently becomes Group Log. That isn't a "deliberate Group Log", and the screen shows only a participant count where the lesson says "choose participants". CONFIRMED |
| F-06 | Med | E | (D-44) | NI; **reversal Y** if X-24's "5 channels everywhere" direction is taken: phase-13 dossier §O and D-44; X-24/X-26/X-28 | Three logging forms differ. Unify on the 3-channel set, not 5. |
| F-07 | Low | E | — | QW; X-40 | Group Log flat background. |
| F-08 | Med | E | — | QW; X-25 | Logging forms don't name the person. Frame A copy names the person, which is fine. |
| F-09 | Low | E | — | QW; X-36 | Lowercase raw values. |
| F-10 | Low | E | — | QW; X-24 | "Connected / Connected" row. |
| F-11 | Med | E | — | NI; X-30; enforces phase-13 §AG | Keyboard covers the field. |
| F-12 | Med | E | (D-26 rides on Group Log form) | QW; X-29/X-31 | Stale, misplaced title error. Validation feedback, not taught behaviour. CONFIRMED (`GroupLogScreen.tsx:78-81,125`) |
| F-13 | Med | E | (D-27) | QW; X-13 | Future date offered then rejected. Backdating is not taught (D-27). |
| F-14 | Low | E | (D-67) | QW | Empty day/month Log uses midnight or today. Separate from the hint's jump. |
| F-15 | Med | E | (D-14 excludes Intensity) | NI; X-37 | Intensity numbers unexplained. |
| F-16 | Med | E | (D-67) | NI; X-43 | Heatmaps unlabelled. See the extra C note N-1 on the hint copy. |
| F-17 | Low | E | (D-67, D-32) | NI; p40 Y; X-39/X-43 | Year dots about 13 dp. The hint teaches tapping cells. Year isn't the default lens, so Phase 40's a11y audit owns it. |
| F-18 | Med | E | (D-23) | NI; X-05/X-15 | Add Note sheet layout. See Gaps G-2 on the D-23 trigger inside this sheet. |
| F-19 | Med | E | (D-27) | NI; X-31 | Edit/Delete below the fold. Not taught. |
| F-20 | Low | **C** | D-26 | NI; X-24/X-36 | "Group interaction" vs "group event". The D-26 lesson copy must use whichever name wins. |
| F-21 | Low | E | (D-16; Q-50 rejection) | QW; X-05 | Undo is silent. Frame A copy already avoids promising Undo, and the 6 s window matches Q-50. |
| F-22 | Low | E | — | QW; X-31 | Save sits in the gesture bar. |
| F-23 | Low | E | — | both; reversal suspected ADR-123 (stream composition) for the filter half; X-24 | Lifecycle rows interleaved; In Person icon shared with Bound/Unbound. |
| F-24 | Low | E | — | QW; X-36/X-39 | Small label slips. |
| F-25 | Low | E | — | QW; X-09 | Picker keeps the previous search. |
| F-26 | Low | E | — | NI; X-06 | Cards reorder after bulk Quick Log. |
| F-27 | Low | E | — | NI | Long-history controls are out of reach. |

---

## Class A detail

### E-01: Add Contact loses typed work on Back (High)
- **What's broken (code):**
  - `CreateContactScreen.tsx` has no `useDiscardKeepGuard`, `beforeRemove` or `BackHandler`.
  - The on-screen Back is `onPress={() => navigation.goBack()}` (:413-418).
  - Save is `navigation.replace("Profile", …)` (:394).
  - Edit Contact has the guard.
- **Recorded rule it breaks:** phase-13 dossier §AF ("Leaving after meaningful unsaved edits prompts Discard changes / Keep editing", `[DECIDED]`). The fix *enforces* a recorded decision; it reverses nothing.
- **Lesson/frame:** frame 03, the Add Contact teaching step, is first-run Acquire. Its trigger row is "`Create` route" (39-CONTEXT trigger table).
  - The mockup says Android Back acts as Skip while the tip card is open. After Got it, Back is ordinary `goBack()` to Acquire (D-61), and the name and anything else typed are lost silently.
  - Answer to the brief's question: **yes, first-run Acquire inherits E-01** if it reuses the `Create` route, as the trigger table and D-70 imply.
- **Verification:** CONFIRMED, `src/screens/CreateContactScreen.tsx:413-418` (Back), `:394` (replace). A grep for the guard in the file matches nothing.
- **Minimal fix shape:**
  - Add `useDiscardKeepGuard({ hasUnsavedChanges, bypassRef })`.
  - Compute the dirty snapshot against the **D-50/D-51 defaults** (Bound, 30, Not yet), not the current Unbound/Today defaults.
  - Set `bypassRef` before *both* exits: the normal `replace("Profile")` and the D-86 first-run landing on Digest.
  - Back on an untouched form still leaves at once.

### E-02: empty-name Save does nothing (Med)
- **What's broken (code):**
  - `handleSave` calls `collectBlockingErrors`, then `revealAndFocus(sectionId)` and `return` (:360-364).
  - The message "Enter a name to save." (`create-contact-logic.ts:152`) is never rendered. `collectBlockingErrors` is referenced only at :360.
  - `revealAndFocus` passes `findNodeHandle(scroll)`, a number, to `measureLayout` (:256-262), so the scroll fails silently.
  - Identity is already open, so nothing visible changes.
- **Lesson/frame:** frame 03's own button note says Got it "leaves the user on the form to type a name and save", and D-51 keeps Name as the only required field. On the focused first-run route (no tab bar, D-70), a Save that silently does nothing is a dead end on the one forward path of first run.
  - **Inference:** this is a narrow A. It hits only users who skip the name, but it lands exactly on first run's gating action.
- **Verification:** CONFIRMED, `src/screens/CreateContactScreen.tsx:357-365`, `:256-262`; `src/screens/create-contact-logic.ts:146-159`.
- **Minimal fix shape:**
  - Render the name error inline under Name.
  - Pass the ScrollView's native ref to `measureLayout`.
  - The same fix applies to Edit (`EditContactScreen.tsx:496-503`, per audit, not opened). Quick win.

### F-01: Log Interaction loses typed work on Back (High)
- **What's broken (code):**
  - `LogInteractionScreen.tsx` has no guard. Save ends with `notifyWidgetDataChanged(); navigation.goBack();` (:240-242).
  - The header is a plain `ShellAppBar` child (:285), whose back is unguarded.
  - Group Log has the guard (`GroupLogScreen.tsx:72-75`, read).
- **Recorded rule it breaks:** phase-13 §AF (enforce).
- **Lesson/frame:** Record (D-16), Log Interaction-first branch. The lesson explains "nothing saves until Save, Quick Log is the fast alternative".
  - Today the only way to leave without Save is a silent discard. Sibling forms ask, and the Orient "+" step (D-17) tells the user some actions wait for Save.
  - Teaching this form's commit model while it silently drops input is the D-02 case: the lesson would describe confusing behaviour instead of it being fixed.
- **Verification:** CONFIRMED, `src/screens/LogInteractionScreen.tsx:240-242`, `:285`. No `useDiscardKeepGuard` or `beforeRemove` anywhere in the file.
- **Minimal fix shape:**
  - Add the guard and seed its snapshot after `setValue` in `seed()` (:113-155).
  - Set the bypass before `goBack()` at :242.
  - Keep the guard off in the `contactId === null` picker branch (:250-258).

### F-05: bulk "Log Interaction" (2+) silently becomes Group Log, participants shown only as a count (Med)
- **What's broken (code):**
  - The selection bar label is "Log Interaction" (`BulkActionSurface.tsx:58`).
  - `HomeScreen.tsx:1181-1186` routes 2+ selected to `GroupLog`.
  - Group Log renders only "`N participant(s) selected`" with an "Add participants" button (`GroupLogScreen.tsx:~170-185`).
- **Lesson/frame:**
  - D-26's Group Log lesson fires at the "first deliberate Group Log". The 39 trigger table lists "bulk Log with >1 selected" as an entry.
  - A user who tapped "Log Interaction" did not deliberately choose Group Log, so the lesson would be explaining away a silent mode switch (D-02).
  - Its "choose participants" point would aim at a block that names nobody.
- **Verification:** CONFIRMED (files and lines above).
- **Recorded decision:** ADR-102 :18 records the count-aware *routing* (2+ → Group Log). Relabelling the button does **not** reverse that; changing the routing would.
- **Minimal fix shape (two options, owner picks the label; see Hidden owner calls #4):**
  - (a) Relabel the bulk button "Group Log" when 2+ are selected, and list participant names or avatars in Group Log. Then the bulk path is a legitimate D-26 trigger.
  - (b) Leave the UX as is and drop the bulk path from D-26's triggers. That would be a D-26 trigger amendment, so B.
  - **Recommendation:** (a).

---

## Class B detail

### E-13: "Not yet" never looks selected (Med) → amend D-50
- **Verification:** CONFIRMED. `src/components/TriStateLastSpoke.tsx:101-110`: `segmentColors` returns muted colours for `not-yet` whatever `selected` is. The comment says so explicitly: "'Not yet' is muted even when selected".
- **Why B, not just D:** the muting is a **recorded design decision**, not an accident:
  - `.planning/phases/34-rapid-capture-update-flows/34-UI-SPEC.md:115-117`: "'Not yet' … stays muted … never accent-filled even when selected — the never-contacted backlog case reads honestly."
  - Re-affirmed as a constraint in 38.4-06-PLAN :27 and :126 ("keep the intentionally muted 'Not yet' treatment") and in pre-release audit AUD-UIA planning notes (`docs/audits/2026-09-pre-release/ui-accessibility/DOMAIN-AUDIT.md:258`).
  - The accepted mockup frame 03 draws Not yet with `class="solid"`, the accent fill (`onboarding-mockup.html:372`, style :123). So D-74 already conflicts with the 34 rule, and nobody named the conflict.
  - Under D-50, Not yet becomes the default, so every new Add form opens with no visible Last spoke choice while the tip says "Last spoke stays at **Not yet**".
- **Proposed amendment (D-94-style):** "D-50 amended: the selected Not yet segment uses the same selected style as Today and Pick date (as drawn in frame 03). This supersedes 34-UI-SPEC :115 (muted-even-when-selected) and the 38.4-06 RG-030 constraint. An unselected Not yet keeps the neutral style."
- **Recommendation:** approve. The rule was written when Today was the default and Not yet was an exception, and D-50 flips that premise. One selected-chip style for these segments and the FrequencyPicker (the audit's "ideally") is a separate taste call. Not required for 39, and the frame 03 caption already says Monthly is drawn "outlined, matching the app's chip style".

---

## Class C / D detail

- **E-05 (D → D-51):**
  - CONFIRMED. `coordinateBoundToggle` keeps `intervalDays=null` (`create-contact-logic.ts:176-197`), the screen passes `intervalDays ?? 0` (`CreateContactScreen.tsx:592`), and `FrequencyPicker` opens custom mode for non-presets (`FrequencyPicker.tsx:66-71`).
  - If D-51 seeds `intervalDays=30` as state, not only `trackingEnabled`: Unbound keeps 30 dormant, and re-Bound is valid Monthly.
  - **Acceptance check:** Bound → Unbound → Bound shows Monthly with no red text.
  - Also fix the stale header at `CreateContactScreen.tsx:15-17` (D-51 already says so).
- **E-11 (C):**
  - The tip says "checking in Monthly". The Profile's Relationship Overview, a Prepare (D-14) section, renders "Every 30 days" (`RelationshipOverview.tsx:29`, code).
  - Either the display change ships first (show "Monthly" when a preset matches), or the Prepare and Add copy avoid relying on one label.
- **E-20 (C):** frame 02/03 captions and header say "New contact". If the naming pass renames the Add form's title, update the mockup and the Acquire wording together.
- **E-23 (C, owner-call):**
  - The tip copy and the form caption use "Bound", "active orbit", "cadence reminders" (`CreateContactScreen.tsx:531,579-581`; frame 03).
  - Any rename lands in the lesson. D-91 lists "Orbit participation" as a term lesson copy keeps literal, and a rename makes that list stale.
  - Bound/Unbound is ADR-062-era product vocabulary (suspected reversal; not traced line by line).
- **F-02 (C):**
  - Detailed Log save is silent (`LogInteractionScreen.tsx:240-242`) and does not bump the shell tick (Discretion item 6, confirmed).
  - The Record close-the-loop copy must not promise visible feedback that doesn't exist, or "it appears at the top of History": a backdated log lands under "Show older".
  - If the F-02 snackbar ships first, the copy can point at it.
- **F-03 (C, owner-call):**
  - `runQuickLog` writes `channel: resolveInitialChannel(pref, remembered)` (`quick-log-command.ts:139-152`). The factory pref is `'remember'` (`migrations/027…:35`), and only `LogInteractionScreen.tsx:225` writes the remembered value.
  - On a fresh install the first Quick Log is a Message, which matches frame A's draft. It stops being a Message once the user saved a Log Interaction or set a fixed preference.
  - The intercept copy must interpolate the resolved channel.
  - **Code vs ADR mismatch (code fact):** ADR-130 :18 says Quick Log also *updates* the remembered value, but the code deliberately does not ("do NOT write remembered back", `quick-log-command.ts:147-148`).
- **F-04 (C):**
  - `bulkQuickLog` hard-codes `channel: "unspecified"` (`bulk-actions-dao.ts:63`, confirmed). Bulk is a D-53 intercept entry, so channel-naming intercept copy is false there.
  - Either fix F-04 first (owner-call) or give the bulk intercept channel-free copy.
- **F-20 (C):** pick one of "group event" / "group interaction" (also B-12, X-36) before writing the D-26 lesson copy.
- **N-1 (C, not an audit finding; code fact from reading for D-67):**
  - Cycles is the default History lens (`ActivityHeatmap.tsx:152`), and its cells are cycle *ranges*, not days (`renderCycleCell`, :376-400). Day cells exist only on 7 Days, Month and Year.
  - Both jump the stream (`HistorySection.tsx:781-807`), so D-67's behaviour is stable. But "Tap any day in the chart" is inaccurate on the default lens, which is also the lens frame D draws.
  - **Suggested copy:** "Tap any square in the chart to jump to it."
  - Mockup TalkBack text ("Oct 2, 1 interaction") is a day-lens label.

---

## Hidden owner calls

1. **E-13: Not yet selected style.** Supersede the 34-UI-SPEC "muted even when selected" rule so the D-50 default is visibly chosen? **Rec: yes** (Class B above).
2. **F-03: should Quick Log follow the "Remember last choice" channel?** It does today, per ADR-130 and phase-13 §P. **Rec:**
   - Keep it (don't reverse ADR-130).
   - Put the channel and name in the Quick Log snackbar ("Logged In Person with Maya"; this also covers A-35).
   - Make the intercept copy name the resolved channel.
   - Separately, decide whether the In Person direction mismatch (Quick Log Outbound vs form Mutual) matters.
3. **F-04: bulk Quick Log channel.** Use the same resolved channel as single Quick Log (amend the ADR-103 "canonical shape" note) or keep `unspecified`? **Rec:** same channel as single, so the D-53 intercept can describe one Quick Log.
4. **F-05: bulk 2+ button label.** **Rec:** label it "Group Log" at 2+ and list participant names in Group Log. Keep ADR-102 routing.
5. **F-02: feedback after a detailed Log Interaction save.** Add a "Logged for <name>" snackbar, and should it carry Undo? **Rec:** a snackbar without Undo for now (Undo on a detailed log is a new destructive-reversal path). The Record copy follows whatever is chosen.
6. **E-04: which Edit-only fields belong on Add.** **Rec:**
   - Add Birthday (with Clear, E-03) only.
   - Keep the lean form (ADR-016/ADR-131).
   - Do not restructure Create into "Edit in new mode" before the D-50/D-51/D-87 work and frame 03 land, or the teaching step would be redesigned twice.
7. **E-23: plain words for Bound/Unbound / Orbit participation.** **Rec:** decide before final lesson copy (Discretion item 1). If the terms stay, the frame 03 tip already explains them in plain words. Keep them and improve only the form caption.
8. **E-07 / E-08: one model for current-state fields; one commit rule for deletes inside forms.** **Rec:** not 39-blocking (D-25 doesn't teach these). Owner picks during UX-fix planning.
9. **F-06 / X-24: unify the logging forms.** The cross-cutting "5 channels everywhere" direction would put Other/Unspecified on new entries, which reverses phase-13 dossier §O and conflicts with D-44. **Rec:** unify on 3 channels for new entries. Edit shows extra values only when the record already holds one.
10. **D-58 vs lessons that sit on a form (39-internal, surfaced while checking my triggers):**
    - D-58 says no lesson starts while a form, sheet or dialog is open, and D-84 excepts only the Systems sheet.
    - But frame 03 (Add Contact tip) sits on the Create form, Record's Log Interaction branch sits on the LogContact form, and one D-23 Memory trigger is `PostLogNoteEditor.tsx:187`, inside the Add Note sheet.
    - **Rec:** amend D-84 to "a lesson may attach to the form or sheet whose opening (or whose action) is its own trigger". Otherwise those three triggers can never fire as designed.

## Suspected recorded-decision reversals

- **E-13 fix: VERIFIED collision.** It reverses 34-UI-SPEC :115-117 (muted Not yet) and the 38.4-06 PLAN :27/:126 constraint. The mockup (D-74) already contradicts that rule. Needs owner sign-off (Class B).
- **F-03, if Quick Log stops following the preference: VERIFIED text.** That would reverse ADR-130 :18 ("owner-approved Quick Log adoption in 34-UAT") and phase-13 dossier §P :338-346.
- **ADR-130 :18 vs code (not a reversal, a doc/code mismatch):** the ADR says Quick Log updates the remembered channel. The code says it never does (`quick-log-command.ts:147-148`; the only writer is `LogInteractionScreen.tsx:225`). One of them is wrong; flag it for KB or fix planning.
- **F-04 fix (suspected):** ADR-103 :18 "Bulk Quick Log writes the canonical outbound manual interaction shape" (channel `unspecified` today).
- **F-05:** relabelling is safe. Changing the routing would reverse ADR-102 :18 (VERIFIED text).
- **F-06 / X-24 "5-channel" direction (VERIFIED text):** reverses phase-13 dossier §O, where new-entry chooser = Message/Call/In Person and historical `unspecified/email/other` stay representable only internally. Also conflicts with 39 D-44.
- **E-04 (suspected):** ADR-016 :18 (lean fixed-first create form) and ADR-131 (progressive creation), if Add becomes the full Edit form.
- **E-23 (suspected):** Bound/Unbound / "Orbit participation" vocabulary in ADR-062 and ADR-171 :22.
- **E-07 (suspected):** ADR-090 additive value history, if the chosen model is "overwrite".
- **F-23 filter half (suspected):** ADR-123 stream composition.
- **Enforcing, not reversing (VERIFIED):** E-01, F-01 and E-09 enforce phase-13 dossier §AF ("Leaving after meaningful unsaved edits prompts Discard changes / Keep editing", `[DECIDED]`). F-11 enforces §AG (keyboard-aware forms).

## D-27 / D-25 check: were the "no lesson" calls covering confusing UX?

**Inference:** D-27 (no lesson for backdating, editing/deleting interactions, group conversion) is untouched in substance, but the findings show those areas *are* confusing:
- backdated log hidden behind "Show older" (F-02);
- future dates offered then rejected (F-13);
- midnight prefill (F-14);
- silent delete (F-02);
- Edit/Delete below the fold (F-19);
- keyboard over the field (F-11);
- Save in the gesture bar (F-22);
- the single-item ⋯ "Make this a group interaction" with two names (F-20).

D-27 does not teach around any of them, so D-02 is not violated. They belong in UX-fix planning, not new lessons. The same holds for D-25 and E-07 (current-state fields).

The one place they reach into 39 is copy:
- Record's close-the-loop line must not imply a new log always appears at the top of History (F-02).
- D-26's copy must not use the contested group name (F-20).

No D-27 amendment recommended.

## Gaps (39 triggers in my routes the audit did not verify; report §8 and area "Could not check")

- **G-1. Create on a fresh install.** The audit only opened Create from + on an 88-contact app. The Contacts first-run empty state was "not reachable" (§8). First-run Acquire's form state is unchecked: no categories, no custom fields, `Create` as a focused route without a tab bar.
- **G-2. Add Note sheet** (`PostLogNoteEditor`, a D-23 Memory trigger): whether the keyboard opens on a real tap is unchecked (§8). Combined with D-58 (owner call #10), this trigger can't currently host a lesson.
- **G-3. Quick Log on an Unbound contact** was not attempted (§8). That's relevant to the adapted-Orient path (D-52, an import-first user with nobody Bound) and to whether the Record intercept fires there.
- **G-4. Contacts selection with exactly 1 → Log Interaction** was not reached (§8). It is a Record trigger in the 39 table.
- **G-5. D-53 entries not exercised in area F:**
  - row and grid TalkBack "Quick Log" actions (`ListRow.tsx:234`, `GridCard.tsx:191`);
  - the swipe-right preference set to "log-contact" (Record trigger table).
- **G-6. History hint on a contact with no cadence:** History falls back to Month (38.8 D-27 note in `ActivityHeatmap.tsx:210`). The hint copy would then be accurate, but it is untested on device.

## Rules added/changed
None.
