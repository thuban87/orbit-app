# Slice 3: G (Things to Remember), I (Sharing into the app), B (Events tab) vs Phase 39

Baseline: `39-CONTEXT.md` (D-01..D-93) at HEAD d148ed47. `git diff 05b85252..HEAD -- src` is empty, so the audit's code citations are current. Read-only. No repo file was changed.

Labels used below: **AUDIT** = what the audit report claims. **CODE** = what I read on disk (file:line). **INFER** = my own inference.

## 1. Header

Rows: 64 findings (G 24, I 16, B 24), plus 3 rows for the §7 known-item notes and 2 rows for themes. Report-wide D-01 is assessed separately in §4b, as the brief asked, and is not counted here.

| Class | Count | Ids |
|---|---|---|
| A | 3 | G-11, I-01, I-04 |
| B | 1 | §7-999.5 (the D-93 amendment; also covers D-27) |
| C | 5 | G-10, G-23, B-08, B-12, X-15 |
| D | 1 | I-06 |
| E | 59 | all others, including §7-999.3, §7-999.6 and X-17 |

Tag counts across the 64 findings:
- **fix:** QW 29 · NI 33 · both 2 · none 0. The §7 rows are "none".
- **owner-call Y:** 13 (G-03, G-08, G-10, G-11, I-03, I-06, I-08, B-05, B-07, B-12, B-23, §7-999.5, plus the AI-egress question in §6).
- **reversal Y:** 6. Confirmed wording: I-08, B-23, §7-999.5. Suspected: I-03, I-06, B-05.
- **backlog:** 9 (G-01 ~999.6, G-03 999.3, G-09 999.3, I-04, I-12, I-13 999.5, plus the three §7 rows).
- **p40 Y:** 3 (G-24, I-15, B-22: label fixes; the full accessibility audit belongs to Phase 40).

## 2. Table

| id | sev | class | D-IDs | tags | one-line why |
|---|---|---|---|---|---|
| G-01 | High | E | D-14, D-23 | fix:QW; backlog:~999.6; theme:X-15 | CONFIRMED (`MemoryEditor.tsx:184-186`). Neither lesson teaches Memory types (D-14 excludes them; D-23 is concept-only). Fix anyway before beta: first-run Import (D-52) creates imported memories (ADR-091). |
| G-02 | Med | E | D-14 | QW; X-15 | D-14 excludes hidden/pin. Not taught. |
| G-03 | Med | E | D-25 | NI; owner:Y (one delete pattern); backlog:999.3; X-03 | Delete patterns are not taught. |
| G-04 | Med | E | D-25 | QW; X-01 | Custom fields are not taught (D-25). |
| G-05 | Med | E | D-25 | NI; X-19 | Same. |
| G-06 | Med | E | D-25 | both; X-19 | Same. |
| G-07 | Med | E | D-25 | NI; X-37 | Copy only. "Quarantine" is a HANDOFF §14 concept; renaming the UI copy is not a reversal. |
| G-08 | Med | E | D-24 | NI; owner:Y (list pattern); X-35 | The Categories lesson teaches no CRUD or reorder (D-24). |
| G-09 | Med | E | D-14 | both; backlog:999.3 (Off Limits missing); X-15/X-17/X-19 | The TTR editor is not a Prepare target. ("D-24" in the audit text is audit finding D-24, not 39's D-24.) |
| G-10 | Med | C | D-23, D-14 | NI; owner:Y (which surface is the canonical memory list; should + → Memory open "add" directly); X-15 | The Memory lesson must anchor on the Profile's Things to Remember, not the "+ → Memory" list. If the lists are consolidated, the lesson's target changes. |
| G-11 | Med | **A** | D-23, D-58 | NI; owner:Y (where to land after Save); X-07/X-25 | The Memory lesson's trigger flow (`MemoryScreen.tsx:149`) ends on another person's Profile. See §3. |
| G-12 | Med | E | D-23 | NI; X-01 | A lesson never runs over an open form (D-58). Discard-on-Back is general. |
| G-13 | Med | E | — | NI; X-29/X-13 | Not taught. |
| G-14 | Low | E | — | NI; X-02 | Enforces ADR-081 (per-item AI permission waits for Save), so it is a planner fix. Not taught (D-19/D-21). |
| G-15 | Med | E | D-14 | NI; X-12 | D-14 excludes current-state fields. |
| G-16 | Low | E | D-25 | NI; X-16 | Key People are not taught. |
| G-17 | Low | E | — | QW; X-37 | Same. |
| G-18 | Low | E | — | NI; X-31/X-15 | Cosmetic. |
| G-19 | Low | E | — | NI; X-29 | Not taught. |
| G-20 | Low | E | D-24 | NI; X-37 | D-24 excludes delete. |
| G-21 | Low | E | — | NI; X-06 | Same. |
| G-22 | Low | E | — | QW; X-38 | Same. |
| G-23 | Low | C | D-14, D-23 | NI; X-36 | Prepare and the Memory lesson name these sections. The copy must use the Profile labels ("Memories", "Pinned / Featured") from `module-registry`, and follow any rename. |
| G-24 | Low | E | D-32 | QW; p40:Y; X-39 | D-32 covers lesson cards, not memory cards. |
| I-01 | High | **A** | D-93, D-58, D-61 | QW; X-07 | CONFIRMED. A cold-start share is hijacked by a modal that Back can't close. See §3. |
| I-02 | Med | E | D-93 | NI; X-30 | Becomes A if the sharing lesson mentions a note or New contact (see §5 D-93, condition 7). |
| I-03 | Med | E | D-93 | NI; owner:Y; reversal:suspected (ADR-037 rejects task removal/exitApp; `10-capture.md` Cluster 2 rejects "staying in Orbit") | Not taught. It affects lesson mechanics (see §5 D-93, condition 6). |
| I-04 | Med | **A** | D-93, D-02 | NI; backlog:999.5 | CONFIRMED. The taught step is "tap a face": it saves at once, with no Undo, a 1.5 s confirmation, and the item lands invisibly. See §3. |
| I-05 | Med | E | D-93 | QW; X-01/X-08 | Becomes A if the lesson covers a note or New contact. |
| I-06 | Med | D | D-50, D-51 (D-05 analogue) | QW; owner:Y; reversal:suspected (06-crud/10-capture "inline create is name-only", if a frequency control is added); X-11/X-22 | CODE: `CaptureScreen.tsx:94`, used at `:488`. Take the interval from the D-51 source so the two paths can't drift. |
| I-07 | Med | E | — | QW; X-22 | Moving New contact first is fine. |
| I-08 | Med | E | — | NI; owner:Y; reversal:Y (`10-capture.md:56-63` decides a face grid with demoted search and rejects search-first) | Changing picker designs reverses a recorded decision. |
| I-09 | Low | E | — | QW; X-42 | Same. |
| I-10 | Low | E | — | QW; X-35 | Same. |
| I-11 | Low | E | — | QW; X-26 | Same. |
| I-12 | Low | E | — | QW; backlog:999.5 | Same. |
| I-13 | Low | E | D-93 | QW; backlog:999.5 | Lesson copy must not repeat "Saved to N contacts" as an outcome. |
| I-14 | Low | E | — | QW; X-09 | Same. |
| I-15 | Low | E | — | QW; p40:Y; X-39 | Same. |
| I-16 | Low | E | — | QW; X-31 | Same. |
| B-01 | High | E | D-26 | QW; X-32 | CONFIRMED (`EditGroupEventScreen.tsx:375-395` is a plain View in an `expanded` Sheet; `Sheet.tsx:16-17` says consumers own scrolling). D-26 teaches no event editing ("No advanced management"). |
| B-02 | Med | E | D-26 | QW; X-36 | Same. |
| B-03 | Med | E | — | NI; X-26/X-40 | Same. |
| B-04 | Med | E | — | NI | Phase-12 dossier :62/:86 make the title required and event-only. Unverified whether it forbids renaming. |
| B-05 | Med | E | D-26 | NI; owner:Y; reversal:suspected (ADR-127 explicit child edit scope) | Not taught. |
| B-06 | Med | E | — | QW; X-10 | Same. |
| B-07 | Med | E | — | NI; owner:Y (which choice is the default); X-03 | Same. |
| B-08 | Med | C | D-26 | NI; owner:Y (fix before 39?); X-07 | CONFIRMED (`universal-fab-logic.ts:193-195`; `DashboardStack.tsx:43` is the only registration; `GroupLogScreen.tsx:99` goBack). The Group Log lesson must not imply the user is shown the event after Save. |
| B-09 | Med | E | — | QW; X-41/X-27 | Same. |
| B-10 | Med | E | D-26 | NI; X-37 | Group Log lesson copy must avoid "Dissolve/Follows event" (already implied by D-26 "no advanced management"). |
| B-11 | Med | E | — | QW; X-37 | Same. |
| B-12 | Med | C | D-17, D-26, D-89 | NI; owner:Y (one noun/verb); X-36 | The + lesson and the Group Log lesson name "Group Log". A rename changes that lesson copy and mockup frame 07. |
| B-13 | Low | E | — | QW; X-41 | Same. |
| B-14 | Med | E | — | QW; X-09 | Same. |
| B-15 | Low | E | — | NI; X-08 | Same. |
| B-16 | Med | E | — | QW; X-31 | Same. |
| B-17 | Low | E | — | QW; X-24 | Same. |
| B-18 | Med | E | — | NI; X-04 | Same. |
| B-19 | Low | E | — | NI; X-03 | Same. |
| B-20 | Low | E | — | NI; X-34 | Same. |
| B-21 | Low | E | — | NI | Same. |
| B-22 | Low | E | — | QW; p40:Y; X-39 | Same. |
| B-23 | Med | E | — | NI; owner:Y (what the Events tab is for); reversal:Y if planning/future events are added (phase-12 dossier :196, :388 "[DECIDED] future Group Events not supported") | Orient doesn't tour Events (D-12). The `maximumDate` fix enforces the decision. |
| B-24 | Low | E | D-26 | QW; X-41 | CODE `GroupEventsScreen.tsx:160` confirms the wrong copy. It is not a lesson surface, but fix it alongside B-08. |
| §7-999.3 | — | E | D-25, 999.3 out of scope | none | Off Limits and Fuel are not taught. |
| §7-999.5 | — | **B** | D-93, D-23, D-27 | none; owner:Y; reversal:Y (ADR-081 share half; 10-capture "lands as Conversational Fuel") | This is the D-93 amendment. See §4 and §5. |
| §7-999.6 | — | E | D-14 | none | Memory types are not taught. The "Added by you" mismatch is noted for 999.6. |
| X-15 | High | C | D-14, D-23 | theme | Memories appear in five places. The lessons must name one canonical place (the Profile's Things to Remember). |
| X-17 | Med | E | D-25 | theme | Off Limits is not taught. No lesson may use the word "fuel". |

## 3. Class A detail

**G-11. The Memory lesson rides a flow that lands on the wrong person.**
- What's broken (AUDIT): Digest → + → Memory → pick A → Add memory → Save. The app lands on whatever the Contacts stack had underneath, here person B's Profile. Nothing confirms the save.
- Lesson: the Memory lesson (D-23). It fires at the first deliberate Memory creation; the trigger table lists `MemoryScreen.tsx:149` (the `addMemory` call). D-58 forbids a lesson over an open form, so it has to show around the write. After a + entry, the next screen is unrelated. A card saying "a Memory is … shown in Things to Remember" would then sit over someone else's Things to Remember.
- Verification: CONFIRMED.
  - `universal-fab-logic.ts:197-206`: Memory with an origin, or after pick-then, targets `tab: "DashboardTab"` from any tab.
  - `MemoryScreen.tsx:126-128`: `useEffect(() => { if (savedTick > 0) navigation.goBack(); })`. The comment says it was built to "Return to the Update Contact chooser".
  - `MemoryScreen.tsx:141-163`: `add()` raises no success snackbar.
- Minimal fix: after a committed add from a + entry, return to the origin (or the chosen person's Profile) and show "Memory saved for <name>". Root cause shared with X-07/B-08: route + actions into the current tab, or a root modal. Alternative: the planner pins the Memory lesson to the Update Contact → Memory and TTR editor entries only. That narrows D-23's "first deliberate creation" and is an owner call.

**I-01. A cold-start share is hijacked by the resume prompt.**
- What's broken (AUDIT, retest reproduced): with an unfinished import or reconcile session, a cold-start share shows "Resume your check?" over Capture. Back is ignored. Resume abandons the share, which then resurfaces inside the Contacts tab with no tab bar. Discard destroys unrelated work.
- Lesson: the D-93 sharing lesson (any form). Its trigger is the Capture screen. D-58 blocks lessons while a dialog is open, so the lesson can't start either.
- 39-specific: a cancelled first-run import (D-61) can leave a resumable session, so a new user's first share can hit this. This combination was not audited (see Gaps).
- Verification: CONFIRMED.
  - `App.tsx:441-454` mounts the prompts based only on `resolveActiveResumePrompt(...)`, without checking the share state.
  - `ResumeImportPrompt.tsx:112` and `ResumeReconcilePrompt.tsx:65` both have `onRequestClose={() => undefined}`.
  - Capture is pushed into the Contacts stack: `linking.ts:68`, `navigateIntoTab(…, "DashboardTab", "Capture")`.
- Minimal fix: suppress both prompts while `hasShareIntent` is true (or while the focused route is Capture); they show on the next normal launch. Secondary: host Capture as a root modal.

**I-04. The taught action is irreversible and confirmed for only 1.5 s.**
- What's broken (AUDIT): one tap writes the item. "Saved to X" plus "Add a note" shows for about 1.5 s, then the activity finishes. There is no Undo, and the item is invisible afterwards (999.5), so a mis-tap in a 100-face grid can't be seen or fixed.
- Lesson: any sharing lesson teaches "pick the person". D-02 says lessons teach stable behaviour and never substitute for fixing confusing UX.
- Verification: CONFIRMED.
  - `CaptureScreen.tsx:87`: `AUTO_RETURN_MS = 1500`.
  - `onPickFace` at `:255-302` calls `addFuel` right away.
  - `armAutoReturn` at `:245-249` calls `finishActivity()`.
  - No undo path exists, although `writtenRows` is held (`:134`).
- Minimal fix: an Undo on the confirmation surface (delete the written row(s); under 999.5 the row is not fuel), and a longer window (single-number tunable).
- Not a reversal: `10-capture.md` makes the write-at-pick and the brief toast-then-return binding. An Undo and a longer window keep both. A pre-write confirm step would reverse them (owner).

## 4. Class B detail

**§7-999.5. D-93 needs its amendment, and D-27 must be reconciled.**
- D-ID changed: D-93 (the content is pinned "until … 999.5 settle how sharing works"). D-27 is changed implicitly: it says "No lesson for the Capture workflow", and Out of scope lists "Capture workflow". D-93 does not carry an `⚠ AMENDS D-27` tag, so a standalone sharing lesson would silently contradict D-27.
- Proposed amendment (recommended option O3 in §5): "D-94: Phase 39 ships no sharing content. The Memory lesson (D-23) omits the sharing line. The sharing lesson is built with 999.5, as an entry in the Phase 39 lesson registry, offered under the normal rules (D-64). ⚠ AMENDS D-93 (timing) and D-23 (sharing line). D-27 stands until 999.5 sets the sharing lesson's scope."
- Verification: see §5. CODE confirms the shares are invisible on the Profile. It also shows they reach widget tiles, Contacts search and AI prompts.

## 4b. G-01 and D-01: would Prepare or the Memory lesson teach them?

- **G-01 (High).** CONFIRMED at `MemoryEditor.tsx:184-186`: `type: item?.type === "custom" ? "custom" : DEFAULT_MEMORY_TYPE_KEY`. The `"imported"` type (`memory-registry.ts:17`) is lost on any Save.
  - Neither lesson teaches it. D-14 excludes "Memory types … pin/hide/outdated" from Prepare. D-23 is a "small lesson … No full walkthrough".
  - INFER: Prepare's emphasis on Things to Remember and an Import-first run (D-52) together put "Imported from Contacts App" in front of brand-new users. Editing an imported note then silently empties that section. Fix it before beta (one-line QW). It is not 39-gated.
- **D-01 (High, area D).** CONFIRMED: `ContactProfileScreen.tsx:361-394` `routeKnowledgeAction` routes only by `intent.target.owner` and never reads `intent.action`. The sheet passes `{action, target}` (`ThingsToRemember.tsx:101-108`).
  - Not taught: D-14 excludes pin/hide.
  - Constraint (C-level, INFER): Prepare's Things to Remember step must not invite "tap an item to pin or hide it" until D-01 is fixed. Under D-02, fixing D-01 before Prepare ships is advisable, since Prepare draws attention to these cards. Not strictly A.

## 5. D-93: the sharing lesson

### (1) What the audit and code show, end to end

| Step | Behaviour today | Source |
|---|---|---|
| Entry | Share → `ShareIntentGate` → `navigateIntoTab(DashboardTab, "Capture")` once nav is ready, regardless of tab or first-run state. A cold start with a resumable import/reconcile session shows the prompt over Capture (I-01). | CODE `linking.ts:53-75`; I-01 |
| Grid | Full-screen 3-column face grid (favourites → capture-MRU → rest, includes never-contacted, excludes archived). The header scrolls away (I-11). Tiles stretch on the last row (I-10). Close is labelled "Cancel" (I-15). | AUDIT I-08/10/11/15; decided by `10-capture.md:56-63` |
| Search | Tap to reveal. Results stay above the keyboard (positive check). The term persists across a second share (I-14). No "no match" text (I-07). | AUDIT |
| Save | A single tap writes **immediately**: `addFuel({kind:"topic", source:"share", text, url})`. "Saved to <name>". Auto-return to the source app after 1.5 s via `Activity.finish()`. No Undo. | CODE `CaptureScreen.tsx:87, 255-302, 245-249`; I-04 |
| Note | "Add a note" cancels the timer and opens a field behind the keyboard (I-02). Done rewrites the row's text to `note — base` (`:390-433`). After Done the card shows "Add a note" again (I-13). Back drops the note (I-05). | CODE/AUDIT |
| Multi-select | Long-press only, undisclosed (I-09). "Done · N" writes N independent rows in one transaction (`captureMultiAttach`). "Saved to N contacts". | CODE `:326-372` |
| New contact | Last tile after every contact (I-07). Name-only sheet behind the keyboard (I-02). Creates the person Bound with `interval_days=30` and no first interaction (`:463-517`). The search text is not carried over. Back cancels the whole share (I-05). | CODE; I-06 |
| Confirmation and return | `finish()` ends the only activity (singleTask). If the app was open, the user's place is lost (I-03). | CODE; ADR-037 |
| **Where it lands** | The `fuel` table, `kind='topic'`. The Profile reads only `kind='off_limits'` fuel (`profile-knowledge-read.ts:259-266`), so shares are **invisible in Things to Remember and History**. They **do** surface in: (a) widget tiles (`widget-render.tsx:413` via the ranked fuel line); (b) Contacts search (`dashboard-read.ts:435-437` EXISTS + snippet), which explains the audit's one "1 match · shared text" hit; the retest miss is UNVERIFIED, possibly the population scope via `searchScope`; (c) **AI prompts**: `ai-context-read.ts:288` `getRankedFuel` → `prompt-template.ts:363-384` serialises up to 8 ranked fuel lines, shares included, with no per-item permission. `ContactCard`'s fuel line is unused (no `<ContactCard` render found). | CODE |
| **Migration 017 history** | `017-knowledge-egress-datamove.ts:158-174` copied every existing `topic/share` fuel row into `memories` (`type='general'`, `provenance='share'`, `allow_ai=0`), proved it, then deleted the fuel rows. ADR-081: "The same migration copies share-capture topic fuel to share-provenance Memories … Retired rows cannot double-surface as both fuel and Memories." The UI already has a label for that provenance: `MemoryEditor.tsx:24-28` `share: "From a shared capture"`. **The live writer was never retargeted.** The 24.2 plan (`24.2-01-PLAN.md:145`) listed CaptureScreen only as the source of the rows carried over. So pre-017 shares became AI-off Memories, while every share since 017 goes back into the retired fuel population, invisible and AI-eligible by default. INFER: an unrouted 24.2 gap. The 999.3 entry's line "ADR-081 retired only AI-proposed fuel" (ROADMAP ~1597) is inaccurate. | CODE + ADR-081 |

### (2) How 999.5 (ROADMAP 1607-1617) would change it

- **Landing:** a new Things to Remember section (working name "Made Me Think of Them"), so shares become visible on the Profile. This resolves the main D-02 blocker.
- **Save-where choice:** after picking the contact, a second choice of destination: the new section by default, or a Memory. This adds a step to a flow decided as "write the moment a contact is picked" (`10-capture.md:29`) and "toast then return" (Cluster 2). Owner decision at 999.5's discuss. It also conflicts with the 1.5 s auto-return unless that timing is redesigned.
- **Optional reminder:** "Add a reminder about this?" leads into reminder setup. This brings in notifications: D-45 (permission only when the user enables reminders) and D-28 (Notifications lesson). It creates new lesson interplay, since a reminder set from a share could be the "deliberately enables" moment for D-28.
- **No fuel writes:** a new storage model. Per the backlog this likely means a new table/migration and a backup-format impact. It supersedes ADR-081's share half (share → Memory) and `10-capture.md`'s "lands as Conversational Fuel". It must also decide what happens to the existing `provenance='share'` Memories. No installed base, per owner memory, so this is test data only; flag it and ask, don't auto-cut.
- **INFER, side effects:** shares stop reaching widget tiles, Contacts search and AI prompts unless 999.5 re-adds them deliberately. Each of those is a decision for 999.5.

### (3) What must be true before a sharing lesson can be written (D-02)

1. A shared item lands somewhere the user can find on the Profile, and the lesson can name that place truthfully (999.5 landing).
2. A mis-pick can be undone or corrected (I-04 Undo, or 999.5's save-where step plus a visible item that can be deleted).
3. A cold-start share reaches Capture unobstructed: no resume prompt over it (I-01).
4. The confirmation names the outcome accurately: who, and where it went (I-13; 999.5's section name).
5. The storage model is settled and not "retired": no lesson teaches a fuel-backed flow that 999.5/999.3 will remove root and stem (owner quote in 999.5).
6. Lesson mechanics are compatible with Capture's lifecycle. `finish()` on auto-return or Close ends the session. Under D-59, "leaving the lesson's screen returns it to unseen", so a card shown after the pick would be torn down and re-offered every share. A Capture lesson must complete before the first pick (a D-83 one-step "Got it" tip on grid open), or live elsewhere (the Memory lesson line, or the 999.5 section's first view). D-58 also blocks it while the confirmation, note or New contact surfaces are open.
7. If the lesson mentions a note or New contact: the keyboard doesn't hide them (I-02), Back doesn't discard them (I-05), and a share-created person's tracking is shown (I-06 / D-51).
8. The AI exposure of shared items is decided (see §6 Q2), so a lesson never implies shares are private notes while they reach AI prompts.
9. The D-27 contradiction is resolved by an explicit amendment.

**Can a sharing lesson exist in Phase 39 without 999.5?** Not one that teaches where items go: conditions 1 and 5 fail today by construction. The only honest 39-without-999.5 variants are:
- (a) no sharing content at all; or
- (b) a pure discovery line ("You can share links and text to {APP_NAME} from other apps") that names no destination. This still fails D-02 in practice, because the user follows it and the item vanishes (AUDIT §7: none of the shares appeared anywhere on the Profile).

### (4) Options for the owner

- **O1: promote 999.5 before Phase 39 executes**, then write the sharing lesson for the final behaviour, as a Memory-lesson line or a small tip on first Capture or first view of the new section.
  - Pro: matches the owner's 999.5 note ("Wanted before Phase 39 executes if possible").
  - Con: 999.5 is a full discuss + migration + backup-format + reminders/notifications phase, so it delays 39. Recorded decisions to supersede: ADR-081 share half and 10-capture.
- **O2: promote only 999.5's landing part before 39** (new section + no fuel writes + I-01/I-04 fixes), and defer reminders and the save-where choice. Teach "share → it appears under <section>".
  - Pro: smaller.
  - Con: splits an owner-defined backlog item, and the save-where step would later change the taught flow (lesson re-identity, D-64).
- **O3 (recommended): Phase 39 ships no sharing content.** D-93 is amended (D-94) so the sharing lesson is delivered by the 999.5 phase as a registry entry in the 39 lesson system (one trigger call + copy, per the registry shape in Claude's Discretion). The Memory lesson drops its sharing pointer for now. D-27 stands until then.
  - Pro: no unstable teaching (D-02), no 39 delay, and the lesson system already supports adding lessons later (D-64: a new identity is offered under the normal rules).
  - Con: early users get no sharing discovery until 999.5 ships.
- **O4: discovery line only, no destination (variant b above).** Not recommended: it sends users into the invisible-save path, which D-93's own text rules out ("today's flow is not taught as is").

Recommendation: **O3**, plus, independent of 39, raise §6 Q2 (AI egress of shares) and fix I-01 now (one guard, no recorded decision touched). If the owner wants sharing taught at launch of 39, choose O1 and schedule 999.5 as an inserted decimal phase (insert by hand per owner memory).

## 6. Class C/D detail

- **G-10, X-15 (C):** the Memory lesson and Prepare copy say "Things to Remember on the Profile". They never point at "+ → Memory" as the place memories live. If G-10 consolidates the lists, re-check the anchor.
- **G-23 (C):** lesson copy uses the Profile labels (`src/profile/module-registry.ts`). If the labels are unified, lesson copy follows. D-64 keeps lesson identity on wording edits.
- **B-08 (C):** Group Log lesson copy (D-26) must not say "you'll see it in Events" right after Save. Better: fix B-08 together with G-11 (same root cause, X-07). Cheap, and it removes the constraint.
- **B-12 (C):** if the owner picks one noun/verb (e.g. "Log event"), the + lesson (D-17), the Group Log lesson (D-26) and mockup frame 07 change. Decide before lesson copy is finalised.
- **I-06 (D):** folds into the D-50/D-51 create-defaults work. Capture's `INLINE_CREATE_INTERVAL_DAYS` (`CaptureScreen.tsx:94`) should read the same default source as Add Contact, so D-51 and Capture can't drift. Its stale comment at `:89-93` cites `create-contact-logic`. Showing the frequency on the sheet is an owner call (it adds a field to a name-only create; suspected reversal of 06-crud/10-capture).

## 7. Hidden owner calls

1. **D-93 content and timing.** Rec: O3 (§5).
2. **AI egress of shared items (risk/security posture).** Every share since migration 017 is serialised into AI prompts by default (`getRankedFuel` → `prompt-template.ts:363-384`). Memories need explicit per-item `allow_ai` (default off, ADR-081), and pre-017 shares were migrated as AI-off Memories. Rec: shares default to AI-off, like Memories. Decide in 999.5's discuss, or sooner as a security fix. The user does see the prompt inspector before the first send per provider (prompt-template header), so it is disclosed but not opt-in per item.
3. **The live Capture writer contradicts ADR-081 / migration 017.** Rec: 999.5 records a superseding ADR for the share half, and the inaccurate 999.3 backlog line is corrected.
4. **D-27 vs D-93.** Rec: whichever option is chosen, the D-94 text names D-27 explicitly.
5. **G-11 / B-08 / X-07: where + flows land after Save.** Rec: return to the origin tab and confirm with a snackbar naming the person or event. Fix before the Memory and Group Log lessons.
6. **G-10: canonical memory list; should + → Memory open "Add" directly?** Rec: yes, open Add directly (the + menu is "the place to add" per D-17).
7. **I-06: should share-created people be Bound Monthly, and should the sheet show it?** Rec: same default as D-51, shown as a visible toggle on the sheet.
8. **I-03: keep Orbit's place after a share (moveTaskToBack / separate share activity).** Rec: investigate in 999.5. It touches ADR-037.
9. **I-08: unify the capture picker with ContactPicker.** Rec: keep the face grid (decided in `10-capture.md`); fix only I-07/I-10/I-11/I-14.
10. **B-23: what the Events tab is for.** Rec: out of 39; keep "past get-togethers" and say so in the empty state; add the `maximumDate` fix.
11. **G-03 / G-08 / B-07: one delete pattern and one list-management pattern.** Rec: a separate UX-consistency phase; not 39.

## 8. Suspected recorded-decision reversals

- **999.5 itself:** supersedes ADR-081 ("copies share-capture topic fuel to share-provenance Memories") and `10-capture.md:8` (share "lands as Conversational Fuel"). Confirmed wording.
- **I-08:** `10-capture.md:56-63` decides a face grid with demoted search and rejects search-first. Confirmed wording.
- **I-03:** ADR-037 decides a plain `finish()` and rejects exitApp/task removal; `10-capture.md` Cluster 2 rejects "staying in Orbit on the profile". Suspected (moveTaskToBack isn't named there).
- **I-04 (only if a pre-write confirm step is chosen):** `10-capture.md:29` decides "Capture writes the fuel row the moment a contact is picked". Undo or a longer window does not reverse it.
- **I-06 (frequency control on the sheet):** 06-crud / 10-capture decide "inline-create-from-capture is name-only". Suspected.
- **B-23 (planning / future events):** phase-12 dossier :196, :388. Confirmed wording.
- **B-05 (moving participant management off the edit form):** ADR-127. Suspected, unverified.
- **D-01 (removing pin/hide from the Profile sheet instead of wiring them):** phase-10 / 38.1 profile dossiers. Suspected, unverified.

## 9. Gaps (39 triggers in these routes that the audit did not verify)

- **Categories lesson trigger (D-24).** The 39 trigger table lists "CategoryChoiceSheet in Create/Edit/import". CODE: the sheet is used only when `categories.length > CATEGORY_SEARCH_THRESHOLD` (12, `category-logic.ts:4`; `CreateContactScreen.tsx:460-505`). Otherwise Category is a native `Picker`. So for most users the Create/Edit trigger never fires. Area G audited CategoryManagement only. Planner fix: add the Picker path to the trigger.
- **Memory lesson triggers via Edit Contact and PostLogNoteEditor.** Area G did not exercise Edit Contact memory add or Update Contact → Memory (left to E and F). G-11's landing applies only to the + entry. The Update entry returns to the chooser by design (`MemoryScreen.tsx:125`).
- **Sharing during first run.** Not audited (onboarding excluded): a share before Acquire completes, with zero contacts (a grid with only New contact), or with a cancelled first-run import pending (I-01 overlap with D-61). `ShareIntentGate` routes to Capture without regard to first-run state (`linking.ts:53-75`). How it interacts with D-70's focused Welcome/Acquire routes is unknown.
- **Contacts search on shared text** is inconsistent (§7) and was not investigated. It may be the population scope in `listDashboardSearch` (`dashboard-read.ts:430-433`). Unverified.
- **Allow AI with a provider configured** (G-14) and the actual prompt contents with shares present were not device-checked. The AI-egress claim in §6 Q2 rests on code reading only.
- **Group Log via bulk Log with more than one selected** (`HomeScreen.tsx:1185`): post-save landing not checked. It is the second D-26 trigger.
- **Events empty state** (B-24) was not seen on device.
- **"Discard" on the resume prompt** was not pressed, so its effect on a pending share is unknown.

## Rules added/changed
None.
