# Orbit — Hands-on UX Audit Report

Date: 2026-10-10

## Method

The audit was run by hand on the owner's Pixel 6 Pro. It used a debug build of local `main` (HEAD `05b85252`), loaded from Metro and themed Galaxy / Dark / Deep Space. Before the passes began, the phone's 1,028 contacts were swapped for a 100-contact subset taken from a backup of the same phone. The Contacts tab shows 88 of them under All Contacts. Area A is the exception: it ran first, on about 1,016 visible contacts. The four area A findings whose symptom may depend on list size are marked "(seen at ~1,000 contacts; re-check on the 100-contact set)": A-01, A-08, A-23 and A-34.

There were 11 area passes (A–K), one after another. Each went through four steps:
1. A device agent walked the area exhaustively.
2. A verifier with no device checked every screenshot, dump and code citation.
3. A device retest re-ran every DEAD or High item, and anything the evidence did not clearly show, with a second input method.
4. A finalizer kept only confirmed or retest-reproduced findings.

A non-device pass then compared the same kinds of things across all areas (§4 (Cross-cutting mismatches)). This is a UX design-consistency audit. Performance and memory are out of scope [owner, 2026-10-10]. Crashes and other non-UX problems are in a separate report (`.planning/ux-audit/NON-UX-FINDINGS.md`), which compares them with the UX findings for possible links.

## Final counts

Counts come from the `### X-NN · CODE · Severity` headings in the 11 final area files. Each area file's header gives the same counts.

| Area | Findings | High | Medium | Low |
|---|---:|---:|---:|---:|
| A · Contacts tab | 37 | 1 | 16 | 20 |
| B · Events tab | 24 | 1 | 15 | 8 |
| C · Digest | 14 | 0 | 6 | 8 |
| D · Profile | 35 | 1 | 17 | 17 |
| E · Add, Edit and Update Contact | 29 | 1 | 14 | 14 |
| F · Logging and history | 27 | 1 | 13 | 13 |
| G · Things to Remember | 24 | 1 | 14 | 9 |
| H · People lifecycle and import | 29 | 2 | 19 | 8 |
| I · Sharing into the app | 16 | 1 | 7 | 8 |
| J · Compose and confirmations | 18 | 1 | 8 | 9 |
| K · Settings | 44 | 1 | 31 | 12 |
| **Total** | **297** | **11** | **160** | **126** |

### By code

| Area | INC | HID | DEAD | LEFT | COPY | VIS | A11Y |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 7 | 7 | 3 | 0 | 9 | 10 | 1 |
| B | 6 | 7 | 2 | 0 | 6 | 2 | 1 |
| C | 3 | 6 | 0 | 0 | 2 | 2 | 1 |
| D | 6 | 8 | 5 | 0 | 10 | 5 | 1 |
| E | 9 | 7 | 3 | 1 | 3 | 5 | 1 |
| F | 6 | 12 | 1 | 0 | 2 | 5 | 1 |
| G | 5 | 7 | 3 | 1 | 5 | 2 | 1 |
| H | 5 | 11 | 4 | 0 | 8 | 1 | 0 |
| I | 2 | 6 | 1 | 0 | 2 | 4 | 1 |
| J | 3 | 7 | 1 | 0 | 2 | 4 | 1 |
| K | 8 | 16 | 0 | 0 | 13 | 7 | 0 |
| **Total** | **60** | **94** | **23** | **2** | **62** | **47** | **9** |

### By severity

| Severity | Count | Findings |
|---|---:|---|
| High | 11 | A-02, B-01, D-01, E-01, F-01, G-01, H-01, H-02 (DEAD); I-01, J-01, K-22 (HID) |
| Medium | 160 | — |
| Low | 126 | — |

Other totals:
- 122 findings carry a Proposed fix (§5 (Quick wins)).
- 175 are marked Needs investigation (§6 (Needs investigation)).
- 4 findings carry both, with a fix for one part and a pin for the rest: F-23, G-06, G-09 and H-06.
- 4 findings carry neither: D-31, D-32, D-33 and D-34.
- The cross-cutting pass groups the 297 findings into 43 themes (X-01…X-43): High 8 · Medium 26 · Low 9.
- The 297 count includes D-35, which the cross-cutting pass merged into H-01 (H-01 supersedes it). Fixing H-01 fixes D-35.

There are 7 non-UX items: A-X01, A-X02, A-X03, B-X01, D-X01, E-X01 and J-X01 (`.planning/ux-audit/NON-UX-FINDINGS.md`).

## The 10 findings that most hurt the one-polished-product impression

From §4. Each line names the theme and the area findings it covers.

1. **X-01 Back loses work on some forms and asks on others.** Back silently deletes what you typed on Add Contact, Log Interaction, Memory, Capture and two Settings pages. Their sibling forms ask first. Covers E-01, F-01, B-05, E-09, G-04, G-12, I-05, J-04, J-07 and K-06.
2. **X-07 + actions and flow endings land in the Contacts tab.** You finish a task and end up on a stale screen or on another person's Profile. Covers C-02, B-08, G-11, H-12, I-01, C-03 and D-29.
3. **X-04 Two dialog systems.** Grey, all-caps Android dialogs sit next to themed ones on the same screens, in every area. This is the plainest "built in pieces" signal. Covers A-14, B-18, B-19, D-06, D-26, D-33, E-16, G-03, G-05, G-07, H-01, H-10, H-19, K-10, K-14, K-18 and K-27.
4. **X-26 Eight or more header and Back styles.** The visual language changes one level deeper, and you can see it within a single flow. Covers B-03, D-13, D-17, D-32, E-20, F-06, G-04, G-08, H-08, I-08, I-15, J-11, K-04 and K-40.
5. **X-15 Memories behave differently in five places, and the Profile's pin/hide buttons do nothing.** Covers D-01, G-01, D-03, D-04, D-23, E-29, F-18, G-02, G-10, G-13, G-14, G-18, G-23 and J-09.
6. **X-10 Stale lists and stacks.** The app contradicts what the user just did, and H-01 traps them in "Please try again". Covers H-01 (which supersedes D-35), D-02, H-23, B-06, H-05, J-03, E-21 and A-08.
7. **X-03 Destructive actions follow no rule.** The same interaction is deleted instantly on one path and with a confirm on another, and the loudest button is often the destructive one. Covers B-07, D-07, D-13, D-25, E-08, G-03, G-20, H-01, H-10, H-17, H-19, J-06, K-10, K-14, K-18 and K-36.
8. **X-18 / J-01 Compose sends an email while presenting a text.** The Profile says the number can't be used and the header says there is none, yet Compose goes ahead on another channel without saying so. Covers J-01, D-08, E-06, E-19, E-24, H-06 and J-15.
9. **X-09 Search and filters persist invisibly.** Lists look as if data vanished, and nothing on screen explains why. Covers A-02, B-14, C-03, A-04, A-05, A-06, A-07, A-08, F-25, I-14, K-11, K-27, H-27, A-32 and B-13.
10. **X-37 + X-36 Developer vocabulary and many names for one concept.** "Quarantine", "Tombstones", "Dissolve", "Rogue", "fuel", and Log / Quick Log / Group Log / Log group make the app read as if only its builder was meant to use it. Covers A-11, A-19, A-31, B-10, B-11, C-10, C-12, C-13, D-12, D-19, E-15, E-23, F-15, G-05, G-07, G-17, G-20, H-10, H-28, K-09, K-17, K-40 and K-43. The X-36 glossary table in §4 (Cross-cutting mismatches) lists the rest.

Just outside the ten: X-05 (feedback after actions), X-06 (the + button covers controls everywhere) and X-11 (five frequency editors).

## How to read this report

- **Finding ids.** `A-01`…`K-44` are the final area findings, renumbered in each area's final file. Raw ids from the audit step do not appear here; each area's "Dropped" list maps them. `X-01`…`X-43` are cross-cutting themes, and `A-X01`-style ids are non-UX items.
- **Codes.** LEFT = leftover surface. INC = inconsistency. DEAD = dead end or broken. HID = hidden or unintuitive. COPY = wording. VIS = visual polish. A11Y = accessibility as seen in the UI. Severity: High = broken, data looks lost, or a dead end. Medium = enough to make a user hesitate. Low = polish.
- **Fixes.** A "Proposed fix" means the cause was clear from a short read-only look at one or two files. The `path:line` was checked by the verifier. "Needs investigation" means a pin for later, with a place to start. No app code was changed.
- **Markers.** "(not physically confirmed)", "(seen once)", "(confirmed from code)", "(code-read; not seen on device)" and "(seen at ~1,000 contacts …)" are carried over exactly from the area files. Treat them as limits on the claim.
- **Known items.** Known items (owner prompt §3.5: 999.3–999.6, the Phase 39 prerequisites, N-10) are not re-reported. Where an area found materially new detail, it is in §7 (Known items seen again).
- **Intent.** Nothing is excused because a document says it is intended (owner prompt §1). Whether a finding is intended is for the owner to decide.
- **Evidence.** Evidence paths are relative to each area folder under `untracked/artifacts/ux-audit/` (gitignored). Some screenshots show personal data and are listed for deletion in §9 (How the phone was left). They are not cited anywhere in this report.
## 2. Coverage

The coverage checklist (`untracked/artifacts/ux-audit/coverage-checklist.md`) lists 58 in-scope route names, all read from the navigation code. Each area's "Routes covered" section supplies the result for its routes.

**Result:** 53 routes were reached, 1 was reached only in part, and 4 were not reached in an audit pass.

- Partly reached: `ImportProgress`.
- Not reached: `LegacyContactPicker`, `RestoreResult`, `AIModelPicker` and `SettingsOrrery`.
  - `RestoreResult` was seen once, during the subset restore, outside the passes.
  - `SettingsOrrery` was skipped as Orrery-related.

| # | Route | Area | Reached | How / note |
|---|---|---|---|---|
| 1 | `Home` (Contacts tab) | A | yes | Card and list view; population, filters, sort and search; ⋯ menu; selection and every bulk action; long-press menu; row swipes; + dial. Galaxy and Standard, light and dark. Ran on ~1,016 contacts. |
| 2 | `GroupEvents` | B | yes | Events tab; also Contacts ⋯ → Group Events |
| 3 | `GroupEventDetail` | B | yes | Event row; Profile → History → group entry → View Group Event |
| 4 | `EditGroupEvent` | B | yes | Event detail ⋯ → Edit Group Event; interaction sheet → Edit |
| 5 | `EditParticipant` | B | yes | Participant ⋯ → Edit participant record; interaction sheet → Edit individual interaction |
| 6 | `Digest` | C | yes | Launch tab and tab icon; every row type, both drill links, Your Week in both modes, day panel, + from Digest. The notification "select-digest" path was not reached (it needs a clock change). |
| 7 | `Profile` | D | yes | Opened from Contacts, Digest, Unbound, Archived (Contacts stack and Settings stack). Event participant entry: area B. Orrery, widget and notification entries: out of scope or not driven. |
| 8 | `Create` (Add Contact) | E | yes | + → Add Contact. The Contacts empty-state entry is not reachable (the list is never empty). |
| 9 | `Edit` | E | yes | Profile ⋯ → Edit Contact; Contacts long-press → Edit Contact. Compose → Edit reached in area J. |
| 10 | `UpdateContact` | E | yes | + on a Profile (no picker); + on the list → picker → Update |
| 11 | `CropPhoto` | E | yes | Update → Pet photo → Add photo → "Position photo". Cancelled; photo picking not exercised (personal library). |
| 12 | `LogContact` (Log Interaction) | F | yes | + on Contacts, Profile and Digest; long-press menu; History empty-day and Jump-to-month "Log interaction". Selection with exactly 1 contact → `LogContact` was not tried. |
| 13 | `GroupLog` | F | yes | + → Group Log; Contacts selection (3) → Log Interaction. Also from the Events tab + (area B). |
| 14 | `EditInteraction` | F | yes | History → entry sheet → Edit |
| 15 | `ThingsToRemember` | G | yes | Profile → any Things to Remember pencil |
| 16 | `Memory` | G | yes | + → Memory from Profile, Digest (picker) and Contacts; also Update → Memory (area E) |
| 17 | `MemoryHistory` | G | yes | TTR editor → Last talked about / Current location → History; Profile pencils (area D) |
| 18 | `OffLimitsEditor` | G | yes | Profile → Off Limits pencil (known 999.3; looked at only lightly) |
| 19 | `RecentlyDeleted` | G | yes | TTR editor → Recently Deleted; Restore, Delete permanently and empty state |
| 20 | `CustomFields` | G | yes | Settings → Contacts & Relationships → Custom Fields; new, edit, type change, reorder, delete, quarantine, restore |
| 21 | `CategoryManagement` | G | yes | Settings → Contacts & Relationships → Categories; add, rename, ⋯, delete |
| 22 | `UnboundContacts` | H | yes | Contacts ⋯ → Unbound Contacts |
| 23 | `Archived` | H | yes | Both copies: Contacts ⋯ → Archived Contacts, and Settings → Contacts & Relationships → Archived contacts |
| 24 | `LegacyContactPicker` | H | **no** | Only when import mode is "legacy" (`start-contact-import.ts:56`); there is no in-app way to switch modes. Recorded under "Could not check"; not filed as a finding. |
| 25 | `ImportReview` | H | yes | Import contacts → pick 1 |
| 26 | `BulkImportSetup` | H | yes | Import contacts → pick 12 (retest: 2) |
| 27 | `ImportProgress` | H | **partly** | Started via "Import 12 contacts"; replaced by Import complete in under 1 s, so it was not captured |
| 28 | `DuplicateReview` | H | yes | Import complete → Review possible matches; resume prompt |
| 29 | `ImportComplete` | H | yes | Single and bulk |
| 30 | `BulkReview` | H | yes (empty only) | Settings → Review flagged items; creating a flagged item would need a phone Contacts edit |
| 31 | `ReconcileGrid` | H | yes | Settings → Check linked contacts |
| 32 | `ReconcileDetail` | H | yes | Card tap (manual-review and source-missing variants) |
| 33 | `ReconcileComplete` | H | yes | Bulk Keep Orbit Values on the last cards |
| 34 | `SurvivorSelect` | H | yes | ReconcileDetail → Merge with another contact. This is the only entry (H-09). |
| 35 | `MergeConflicts` | H | yes | Continue |
| 36 | `MergeImpactSummary` | H | yes | Continue → Merge contacts → confirm |
| 37 | `Capture` | I | yes | Chrome Incognito link share (Orbit closed and open), plus synthetic `ACTION_SEND` intents. Covered: grid, search, single save, note, multi-select, New contact, "Nothing to save", the cold-start resume prompt. |
| 38 | `Compose` | J | yes | From Contacts-hosted and Digest-hosted Profile → Message; card long-press → Message. Settings-hosted Profile shows Message disabled. Not tried from an Events-hosted Profile or a notification action. |
| 39 | `ComposeResearch` | J | yes | Compose → Things to Remember |
| 40 | `Settings` (hub) | K | yes | Settings tab |
| 41 | `SettingsAppearance` | K | yes | Every control exercised and restored |
| 42 | `SettingsContacts` | K | yes | Hub row; region picker. Import and Check linked entries audited by H. |
| 43 | `SettingsInteractions` | K | yes | Every chip and switch changed and restored |
| 44 | `SettingsNotifications` | K | yes | Master, every sub-switch, reminder time, lock-screen switch; restored |
| 45 | `SettingsOrrery` | K | **skipped** | Orrery-related; passed through only to reach Systems |
| 46 | `Backup` | K | yes | Hub "Data & Backup" |
| 47 | `BackupSettings` | K | yes | "Manage backups" and the Encryption row |
| 48 | `RestorePreview` | K | yes | Restore a backup → subset file → passphrase → preview; Replace card selected, never confirmed |
| 49 | `RestoreResult` | K | **no** (in a pass) | Needs a completed restore, which the audit forbids. Seen only during the owner-approved subset restore (`subset/restore-shots/10-restore-result.png`); K used that evidence. |
| 50 | `SettingsAI` | K | yes | AI switch off/on and restored |
| 51 | `AIConnection` | K | yes | Browse only; nothing pressed |
| 52 | `AIModelPicker` | K | **no** | Opening it starts an OpenRouter catalog fetch (`AIModelPickerScreen.tsx:112`), which is a network call |
| 53 | `AIPersonalization` | K | yes | Via Writing Style and Personalization Context |
| 54 | `AIPermissions` | K | yes | |
| 55 | `AIPreview` | K | yes | "Preview with contact" picker opened and backed out |
| 56 | `SettingsAbout` | K | yes | |
| 57 | `SystemsManagement` | K | yes | Settings → Orrery → Systems |
| 58 | `SystemBuilder` | K | yes | Create New System, Manage Members, Preview |

### Surfaces that are not routes but were not reached

- Contacts first-run empty state ("Add your first contact") and "Everyone's tucked away" (A). They need a database with no visible contacts.
- Events tab empty state (B). Checking it would mean removing the three required group events. The copy was read in code (B-24).
- Digest empty states and error states (C). They need mass edits, a clock change or a failed DB read. The copy was read in code.
- The weekly-digest notification tap → Digest (C), and Compose from a notification action (J). Both need a notification to fire, which needs a clock change.
- The SMS handoff and the "Which number/email" picker in Compose (J). No synthetic contact has a phone number the app treats as usable.
- The notification permission-denied flow (K). Permission is already granted.

### Code-only notes from the checklist (not user-visible)

- `BackupStack` registers 4 routes but is never mounted.
- The merge routes are registered in four non-Settings stacks with no way in (12 registrations).
- `DashboardStackParamList` declares 3 names that are never registered.
- The user-facing point among these (merge has no entry from the Profile or the Contacts list) is finding H-09.

## Out of scope

| Item | Why |
|---|---|
| `Orrery` route / Orrery tab, and `SettingsOrrery` | Orrery just redesigned in Phase 38.7 (owner prompt §2) |
| Home-screen widget and its deep links (`widget-linking.ts`), and the "Add Orbit widget" hub row | Widget scheduled for a full overhaul (owner prompt §2) |
| Onboarding / tutorials | Phase 39, not built yet (owner prompt §2) |
| Real AI calls: Compose Draft / Rewrite / Adjust, provider connect, key validation, `AIModelPicker` catalog fetch | No real AI provider calls (owner prompt §2); AI Settings screens were browsed only |
| `__ThemePreview` dev harness | DEV-only registration; not a user surface |
| Performance and memory | Out of this audit [owner, 2026-10-10]; such material is in `.planning/ux-audit/NON-UX-FINDINGS.md` |

**Unreachable route (a finding in its own right, owner prompt §3.4):** `LegacyContactPicker` is registered but has no user path. It opens only when the import mode is "legacy" (`start-contact-import.ts:56`), and nothing in the UI switches to that mode. Treat it as a LEFT · Low item: either expose it or remove the registration. `RestoreResult`, `AIModelPicker` and `SettingsOrrery` were not reached by audit rule (no restore over data, no network call, Orrery out of scope), not for lack of a path.

## 3. Findings by area

Each area below is the final, verified file for that area. Evidence paths are relative to `untracked/artifacts/ux-audit/<area folder>/`.

## Area A — Contacts tab — final findings

Device: Pixel 6 Pro, debug build (release build used only for the memory retest), Galaxy / Dark / default accent / Deep Space.
Sources: `findings-raw.md` (audit), `verification.md`, `recheck-list.md`, `retest-results.md`. Evidence paths are relative to `untracked/artifacts/ux-audit/A-contacts/`; retest evidence is under `retest/`.

**Contact count.** This area's pass ran on **~1,016 contacts**. The owner wanted ~100, and the rest of the audit uses a 100-contact subset. Findings whose visible symptom could depend on list size are marked **"(seen at ~1,000 contacts; re-check on the 100-contact set)"**.

**Scope.** Under the owner's 2026-10-10 scope ruling, memory, crash and timing material is in `other-findings.md` (A-X01 to A-X03), not here.

**Counts: 37 findings.**
- By code: DEAD 3 · INC 7 · HID 7 · COPY 9 · VIS 10 · A11Y 1
- By severity: High 1 · Medium 16 · Low 20

Renumbering: final A-NN = raw A-(NN+1). Raw A-01 moved to `other-findings.md`.

---

### A-01 · VIS · Medium — List goes blank for seconds after a change, with no loading indicator (seen at ~1,000 contacts; re-check on the 100-contact set)
- Where: Contacts tab (`Home`) → change Population, Sort, search or view.
- What happens: after a population change, the list area was completely empty for several seconds: no rows, no "N contacts" count, no spinner. Only the open panel and the + button were visible. On retest (list view), adding Favourites left it blank for about 7 s, and removing Favourites for about 6.5 s.
- Why it's a problem: an empty list reads as "my contacts are gone". There is no sign that anything is loading.
- Evidence: 18a-list-blank-no-loading-indicator.png, 18b-list-reloaded-after-wait.png; retest/R2-05-blank-after-favourites-add.png, retest/R2-06-blank-after-favourites-remove.png, retest/R2-blank-pair.png, retest/R2-blank-rerun.mp4
- Needs investigation: keep the old rows on screen (dimmed), or show progress while a read is in flight. The result fade runs only on publish (`src/screens/dashboard-refresh-scheduler.ts:189`), so the blank comes from somewhere else. Start in the `HomeScreen.tsx` read scheduler. Possibly linked to A-X01 / A-X02 (`other-findings.md`).

### A-02 · DEAD · High — After leaving and reopening the app, the list is silently filtered by an old search, with the search box closed
- Where: Contacts → Search a term → Back (closes keyboard) → Back (exits to launcher) → reopen Orbit → Contacts.
- What happens: search is collapsed (magnifier only), but the list shows "1 contact" with match snippets for the old term. Opening search shows the old term still in the field. Reproduced in the audit ("Zz", "Zz UX Full") and twice on retest. It also happened when reopening from Recents.
- Why it's a problem: 1 contact shown out of ~1,000, with no visible reason. It looks like data loss.
- Evidence: 36-contacts-after-relaunch.png, 36b-contacts-after-relaunch-wait.png, 37-search-reopened-shows-stale-term.png, 90-stale-search-after-relaunch-2.png; retest/R3-03-reopened.png, retest/R3-05-from-recents.png, retest/R3-06-backpath-again.png, retest/R3-07-search-reopened.png
- Proposed fix: `src/screens/HomeScreen.tsx:675` initialises `searchExpanded` with `useState(false)`. The term, however, lives in the module-level session store (`HomeScreen.tsx:671`, `src/stores/dashboard-session-store.ts`), which survives the Activity exit. Initialise it as `useState(() => useDashboardSessionStore.getState().searchText !== "")`, or clear the session term on mount (the comment near :666 says "a fresh launch starts empty"). Afterwards the user sees either the search box with its term, or the full list.

### A-03 · INC · Medium — Population options add up instead of switching; "Favourites" with "All Contacts" selected appears to do nothing
- Where: Contacts → Population → Favourites.
- What happens: "All Contacts" and "Favourites" both show "Selected", and the chip reads "All Contacts, Favourites". The count stays at 1016 because populations are OR-combined. The user must also deselect "All Contacts" to see the 4 favourites. Reproduced on retest.
- Why it's a problem: the first tap looks broken, and nothing explains the multi-select behaviour.
- Evidence: 02-population-menu.png, 03-pop-favourites.png, 04-pop-favourites-only.xml; retest/R4-01-after-favourites.png, retest/R4-02-after-all-contacts.png
- Proposed fix: in `src/components/control-surface/DashboardControlRow.tsx:114-134` (`togglePopulation`), make "all-contacts" exclusive: selecting it clears the others, and selecting any other option removes it. The list then changes on the first tap. The dropped-tap window in the same handler (`:116`) is in A-X03.

### A-04 · HID · Medium — Hidden "Active Contacts" population appears when nothing is selected, and after "Reset Dashboard View"
- Where: Population → deselect every option; or ⋯ → Reset Dashboard View.
- What happens: the chip shows "Active Contacts" (937). That option is not in the menu, and it differs from "All Contacts" (1016) by leaving out the 79 contacts never contacted. Reset lands here, not on All Contacts.
- Why it's a problem: the user ends up in a state they cannot choose or understand. Reset gives a different list from the default they had.
- Evidence: 05-pop-none-selected.png, 93-reset-dashboard-view.png
- Needs investigation: `AXIS_DEFAULT_LABELS.population` (`src/components/control-surface/control-labels.ts:17`) and `resetDashboardView` (`src/logic/dashboard-query-logic.ts:303-312`, which sets `populations: []`). Decide whether "none selected" means All Contacts, or list "Active Contacts" as a real option.

### A-05 · HID · Medium — A list filtered to nothing says only "Nothing here right now.", with no mention of filters
- Where: Filters → Charger + Needs attention + Monthly → close the panel.
- What happens: the list shows only "Nothing here right now." There is no count, no mention of filters, and no clear action in the list area. The only hint is the chip "Charger, Needs attention +1". You can recover: the Filters chip reopens the panel, and **Clear filters** at its bottom (after scrolling) brings back all 1016. Retest recoded this from DEAD to HID.
- Why it's a problem: the user may think they have no contacts. The way back is in a different panel, below the fold.
- Evidence: 13-filters-applied-closed.png, 10-filters-panel-bottom.png; retest/R5-01-filtered-empty.png, retest/R5-02-panel-clear-filters.png, retest/R5-03-after-clear.png
- Proposed fix: at `src/screens/HomeScreen.tsx:1771-1773`, when filters are active, show "No contacts match these filters" plus a "Clear filters" button wired like `dashboard-filters-clear`. The user then sees why the list is empty and can fix it in one tap.

### A-06 · INC · Medium — Search ("Search people and notes") misses Last talked about, Current location and Off Limits, though rows display the location
- Where: Contacts → Search.
- What happens: "Lisbon" (Last talked about), "Portland" (Current location) and "Politics" (Off Limits) each return no matches. "Example Town" is shown as line 3 on History Quiet Year's row, but searching it does not find that contact; it only finds an email containing "example". Memories, custom fields, phone, email and category are found.
- Why it's a problem: text the list shows cannot be searched. This contradicts "notes" in the placeholder.
- Evidence: 25-search-offlimits.png, 27-search-lasttalked.xml, 28-search-location.xml, 30-search-example-town.png, 16-list-view.png
- Needs investigation: the search corpus in `src/db/knowledge-search-read.ts` (`listKnowledgeSearchCandidates`) has no current-state or Off Limits source.

### A-07 · DEAD · Medium — Search returns a wrong match: "Denver" finds "History Dense", highlighting "Dense"
- Where: Contacts → Search "Denver".
- What happens: 1 contact, "History Dense — 1 match · Identity", with "Dense" in bold. Reproduced on retest. "Dancer" gives no matches, and "Lucas" gives 5 "Luca …" contacts, so the fuzzy match is loose on short words. The memory "Used to live in Denver" (Zz UX Full Profile) is not returned because it is marked outdated, and outdated memories are excluded on purpose (`knowledge-search-read.ts:303`). This finding is about the false match.
- Why it's a problem: the result is plainly wrong.
- Evidence: 26-search-outdated.png; retest/R6-Denver.png, retest/R6-Dancer.png, retest/R6-Lucas.png
- Needs investigation: typo tolerance in the shared scorer behind `src/logic/dashboard-search-match.ts` is too loose for short words (Denver → Dense is two edits).

### A-08 · VIS · Medium — While a search runs, the old rows stay on screen labelled "1 match" (seen at ~1,000 contacts; re-check on the 100-contact set)
- Where: Contacts → Search any term (each search took about 8–15 s on this build and data set).
- What happens: the header still says "1016 contacts", and the previous rows (History Quiet Year, Luca Fairbanks, …) each show "1 match" until the real results arrive.
- Why it's a problem: wrong results look real, and the user may tap a contact that does not match.
- Evidence: 22-search-note-jazz.png then 23-search-jazz-settled.png; 25-search-offlimits.png
- Needs investigation (cause corrected by the verifier): rows and match maps are published together (`dashboard-refresh-scheduler.ts:181-189`). The problem is that `isSearchMode` is derived from the debounced term at render time (`HomeScreen.tsx:1621-1622` → 1958-1963), while `rows` are still from the previous read. Each row therefore gets `searchResult = null`, and `ListRow.tsx:194` defaults `totalMatchCount ?? 1`. Derive search mode from the term of the read that produced `rows`, and show a searching state until it lands.

### A-09 · HID · Medium — Android Back while search is open exits the app instead of closing search
- Where: Contacts → Search, type → Back (closes keyboard) → Back.
- What happens: the second Back leaves Orbit for the launcher. The term is kept, which leads to A-02.
- Why it's a problem: Back normally closes an open search first.
- Evidence: 35-search-after-back.xml (launcher dump); retest/R3-02-after-back-back.png
- Proposed fix: the only Home BackHandler (`src/screens/HomeScreen.tsx:1601-1613`) handles selection mode only. Extend it so that, when `searchExpanded` is true, it calls `onToggleSearch()` (:737) and returns true. The user then stays on Contacts with the full list.

### A-10 · VIS · Medium — The + button floats above the open Population/Filters/Sort panel and its dim layer
- Where: open any control panel.
- What happens: the + stays bright and tappable above the dim layer. Tapping bottom-right to dismiss the panel opened the speed dial on top of it. Other overlays (⋯ menu, sheets) do dim it.
- Why it's a problem: the layers overlap, and the speed dial opens by accident.
- Evidence: 12-filters-applied-multi.png, 02-population-menu.png, 95-galaxy-light-contact-sheet.png (4th panel), 96-standard-dark-contact-sheet.png
- Needs investigation: the FAB is mounted app-wide (`App.tsx:440`, `UniversalFab`). Hide it while HomeScreen's `panelOpen` is true; this needs a shell-level flag.

### A-11 · COPY · Medium — "More" in the selection bar opens a "Sensitive Operations" sheet with one item
- Where: ⋯ → Select Contacts → select one → More.
- What happens: a sheet titled "Sensitive Operations" holds only "Change Contact Frequency". Archive, which has more consequence, sits in the main bar.
- Why it's a problem: the wording is developer language, and a one-item menu hides a useful action.
- Evidence: 46-select-more.png
- Proposed fix: at `src/components/BulkActionSurface.tsx:165`, show "Change frequency" directly in the bar, or rename the sheet "More actions". Also fix the a11y label "More sensitive operations" at `:128`.

### A-12 · INC · Medium — Bulk "Change Contact Frequency" asks for a raw number of days
- Where: Select Contacts → More → Change Contact Frequency.
- What happens: a bare "Days" field and Continue. Filters use Weekly / Monthly / Quarterly / Yearly.
- Why it's a problem: the same setting gets a different editor, and the user must translate "monthly" into 30.
- Evidence: 47-bulk-frequency.png, 10-filters-panel-bottom.png
- Needs investigation: reuse the Add/Edit Contact frequency picker (area E) in the bulk sheet (`HomeScreen.tsx:2171-2242`).

### A-13 · DEAD · Medium — Bulk frequency "Continue" with an empty field or "0" does nothing visible; the bar behind says "Working…"
- Where: Select Contacts → More → Change Contact Frequency → leave "Days" empty (or type 0) → Continue.
- What happens: nothing visible. No error appears in the sheet (watched for 6 s), and none appears after the sheet is closed. With "0", the sheet stays open showing 0, again with no error. Reproduced with both input methods on retest. Meanwhile, the selection bar behind the sheet shows "Working…" as soon as the sheet opens, before Continue is tapped, so the screen suggests something is in progress when nothing is.
- Why it's a problem: it looks like a dead button, and the "Working…" line suggests a save that never happens.
- Evidence: 48-bulk-frequency-empty-continue.png (+48.xml: Continue enabled); retest/R7-continue.mp4, retest/R7-tile.png, retest/R7-pair.png (left frame: "Working…" before Continue), retest/R7-03-after-sheet-close.png, retest/R7-04-plain-tap-empty.png, retest/R7-07-after-continue-zero.png, retest/R7-09-sheet-closed.png
- Proposed fix: `src/screens/HomeScreen.tsx:2203-2224` calls `showSnackbar({kind:"error", …})`. The Snackbar is mounted at `App.tsx:441`, beneath the Sheet modal, so the user never sees it. Disable Continue until the field holds a positive whole number, or show the error inline in the sheet. For "Working…", see A-27.

### A-14 · INC · Medium — Snoozing one contact uses a plain Android system dialog; bulk snooze uses a themed sheet
- Where: long-press a card → Snooze; vs Select Contacts → Snooze.
- What happens: for a single contact, a grey native alert "Snooze contact" offers teal 3 DAYS / 1 WEEK / 1 MONTH, with no Cancel. Bulk snooze uses a themed sheet "Snooze contacts" with the same options. Neither confirms the snooze; only a tiny moon icon appears.
- Why it's a problem: one action has two looks, and the native dialog clashes with the theme.
- Evidence: 54-ctx-snooze.png, 51-bulk-snooze.png (+51-bulk-snooze.xml), 55-after-snooze.png
- Proposed fix: at `src/screens/HomeScreen.tsx:1528-1536`, replace `Alert.alert` with the bulk-snooze `Sheet` (`:2061-2115`), then show "Snoozed until <date>" with Undo. The code passes four buttons including "Cancel", but Android `Alert` shows at most three, so Cancel is silently dropped.

### A-15 · COPY · Low — "Favorite/Favorites" and "Favourite/Favourites" are both used on the Contacts tab
- Where: Population menu; card star; long-press menu; selection bar; profile header.
- What happens: Population says "Favourites" and the card star says "Add favourite". The long-press menu says "Favorite"/"Unfavorite", the selection bar "Add to Favorites"/"Remove from Favorites", and the profile header "Add … to Favorites".
- Why it's a problem: two spellings of one concept on neighbouring surfaces.
- Evidence: 02-population-menu.png, 53-card-longpress.png, 44-select-mode.png
- Proposed fix: use one spelling. Change `src/components/CardContextMenu.tsx:79`, `src/components/BulkActionSurface.tsx:64,70` and the profile header to match `POPULATION_LABELS` ("Favourite").

### A-16 · COPY · Low — Plurals: "Archive 1 contacts?", "Set all 1 contacts…", "…for 1 contacts", "Snooze 1 contacts…"
- Where: Select Contacts (one selected) → Archive / More → Change Contact Frequency / Snooze.
- What happens: dialogs and snackbars say "1 contacts".
- Why it's a problem: a grammar slip on a common path (one contact selected).
- Evidence: 66-bulk-archive.png, 69-bulk-frequency-continue.png, 70-bulk-frequency-done.png, 51-bulk-snooze.xml
- Proposed fix: pluralise at `src/screens/HomeScreen.tsx:2250, 2257`, `:2077` (screen-reader label), `:2085` "Snoozed N contacts", `:2157` "…for N contacts", `:2248` "Log N interactions", and in the "Changed contact frequency…" snackbar.

### A-17 · COPY · Low — "Dashboard" appears in user copy; the tab is "Contacts"
- Where: ⋯ menu; bulk archive dialog.
- What happens: the ⋯ menu says "Reset Dashboard View", and the archive dialog says "Archived contacts leave the Dashboard". The "Orbit" screen title is covered by backlog 999.4 and is not repeated here.
- Why it's a problem: the user never sees a screen called "Dashboard".
- Evidence: 38-overflow-menu.png, 66-bulk-archive.png
- Proposed fix: say "Contacts" at `src/screens/HomeScreen.tsx:2255` and in the Reset label at `dashboard-overflow-actions.ts:48`.

### A-18 · COPY · Low — Filters chip reads "Filters / Filters" when nothing is set
- Where: Contacts tab control row.
- What happens: with no filters, the chip shows "Filters" twice, while Sort shows "Sort / Default".
- Why it's a problem: the label is redundant and inconsistent with the sibling chip.
- Evidence: 01-contacts-home.png
- Proposed fix: at `src/components/control-surface/control-labels.ts:18`, make the default summary "None" or "Any" (like "Sort / Default").

### A-19 · HID · Medium — Status colours/icons and filter words are unexplained jargon
- Where: Contacts list and cards; Filters panel.
- What happens: the orange ring with ⊖, the green ring with ✓, the moon and so on are explained nowhere. Their names ("Rogue", "Wobbling", "Stable") exist only in screen-reader labels. Filter words have no descriptions: "Gravity: Thin / Building / Solid / Deep" and "Social Battery: Charger / Neutral / Drain".
- Why it's a problem: a new user cannot read the main status signal on the list.
- Evidence: 01-contacts-home.png (+01-contacts-home.xml "Rogue"), 09-filters-panel.png, 10-filters-panel-bottom.png
- Needs investigation: add a legend (badge long-press, or a "What do these mean?" row) and a one-line description for each filter family.

### A-20 · COPY · Low — Sort offers "Default" and "Status", which give the same order for All Contacts
- Where: Contacts → Sort.
- What happens: choosing "Status" gives the same order as "Default" for All Contacts.
- Why it's a problem: two options look different but do the same thing.
- Evidence: 14-sort-panel.png, 15-sort-status.png vs 01-contacts-home.png (same first rows)
- Proposed fix (corrected by the verifier): `resolveDefaultSort` (`src/logic/dashboard-query-logic.ts:315-335`) maps Default to status for All Contacts, Favourites and multi-population, but to a different natural order for Not Contacted, Snoozed and Birthdays. Label Default by the order it resolves to for the current population, or hide "Status" when it equals Default.

### A-21 · INC · Low — List rows rotate between different filler prompts in line 3; all are truncated and none is tappable
- Where: Contacts → List view.
- What happens: rows show "Add something to remember about…", "Add a note, detail, or memory about…", "Nothing remembered about … yet", "What's useful to know ab…", "Tell Orbit a little more ab…", "Save something worth re…" and "Fill in a little more about…". Tapping one opens the profile.
- Why it's a problem: there are seven wordings for one empty state. They are cut off mid-word, and they look like calls to action but are not.
- Evidence: 16-list-view.png, 91-list-end-fab.png, 93-reset-dashboard-view.png
- Needs investigation: the prompt pool in `src/logic/list-row-selection.ts` (~:10-20). Use one short, consistent prompt, or leave the line empty.

### A-22 · VIS · Low — Card view truncates "No interactions yet" to "No interacti…"
- Where: Contacts → card view (e.g. Sort Least recent).
- What happens: the recency line on never-contacted cards is cut off.
- Why it's a problem: truncated text on the main grid.
- Evidence: 15-sort-least-recent.png
- Needs investigation: the recency text in `src/components/list-row-content.ts:15,31`. Use a shorter word ("Never").

### A-23 · VIS · Low — After swipe-right to log, the row stays slid open showing a "Log" panel that does nothing (seen at ~1,000 contacts; re-check on the 100-contact set)
- Where: list view → swipe a row right.
- What happens: the interaction is logged ("Logged · Undo · Add Note" for about 3 s), but the row stays offset with a "Log" panel. Tapping "Log" does nothing, and tapping the row only closes it. The Undo was gone before a tap 3 s later.
- Why it's a problem: the leftover panel looks like a second action waiting, and Undo is hard to reach.
- Evidence: 75-row-swipe-right-fast.png, 76-after-undo.png, 77-row-stays-open.png, 78-tap-revealed-log.png
- Proposed fix: `onSwipeableOpen` (`src/screens/HomeScreen.tsx:365-374`) logs the interaction but never calls `swipeableRef.current?.close()`, and `SwipeActionSurface` is not pressable. Close the swipeable right after the right-swipe action fires. Consider a longer snackbar so Undo can be reached.

### A-24 · HID · Low — One identical "Choose contact" picker serves four different + actions
- Where: + → Quick Log / Log Interaction / Update Contact / Memory.
- What happens: every picker has the same title and no hint of which action follows. There is no Cancel button; only the backdrop dismisses it.
- Why it's a problem: the user cannot tell which action they started.
- Evidence: 81-fab-quick-log.png, 82-fab-log-interaction.png, 84-fab-update-contact.png, 85-fab-memory.png
- Proposed fix (citation corrected by the verifier): the title is hard-coded at `src/components/ContactPicker.tsx:204`. Add a `title` prop and pass the action in from `UniversalFab.tsx:373`, e.g. "Quick log — choose contact".

### A-25 · VIS · Medium — Contact picker: the keyboard hides the whole sheet, including the search field and results
- Where: + → Update Contact (or any picker) → tap "Search contacts" → type.
- What happens: the sheet sits behind the keyboard, so only the dimmed Contacts screen is visible while typing. Results appear only after the keyboard closes.
- Why it's a problem: the user types blind.
- Evidence: 86-picker-search-keyboard.png, 87-picker-after-keyboard.png
- Needs investigation: `src/components/ContactPicker.tsx` (a `Modal` bottom sheet with no keyboard avoidance). Add keyboard avoidance, or use a full-height sheet with search at the top.

### A-26 · INC · Low — Selection: "Select All" never becomes "Deselect all", and irrelevant actions stay enabled
- Where: ⋯ → Select Contacts.
- What happens: after Select All (1016 selected), the button still says "Select All"; only Done exits. With one contact selected that is already a favourite and not snoozed, "Add to Favorites" and "Unsnooze" are still enabled.
- Why it's a problem: there is no way to clear a selection, and the bar offers actions that cannot apply.
- Evidence: 71-select-all.png, 45-select-one.png (+45.xml enabled flags)
- Needs investigation: the static label at `HomeScreen.tsx:1835`, and `disabled = selectedCount === 0 || pending` at `src/components/BulkActionSurface.tsx:53`.

### A-27 · VIS · Low — Selection bar takes ~40 % of the screen; a stray "Working…" line shows while a sheet is open
- Where: ⋯ → Select Contacts; then open the frequency or archive sheet.
- What happens: 12 wrapped buttons push the list down and hide Population, Filters, Sort and Search. "Working…" appears under Select All while the frequency or archive sheet is up, before any action is taken.
- Why it's a problem: little of the list remains visible, and the status line is misleading.
- Evidence: 44-select-mode.png, 47-bulk-frequency.png, 66-bulk-archive.png; retest/R7-pair.png
- Needs investigation: `BulkActionSurface.tsx` layout. The pending label is at `:93-100`, and pending stays true while a picker holds the claim.

### A-28 · INC · Low — Bulk sheets differ: "Set category" is full-height, the others are compact; heading case is mixed
- Where: Select Contacts → Set category / Snooze / More → Change Contact Frequency.
- What happens: "Set category" is a full-height sheet, while "Snooze contacts" and "Change Contact Frequency" are compact. Headings mix sentence case ("Set category", "Snooze contacts") with Title Case ("Change Contact Frequency", "Sensitive Operations").
- Why it's a problem: sibling sheets opened from one bar look and read differently.
- Evidence: 50-bulk-set-category.png vs 51-bulk-snooze.png, 47-bulk-frequency.png, 46-select-more.png
- Needs investigation: the category picker sheet variant in `HomeScreen.tsx`.

### A-29 · COPY · Low — Menu labels don't match the screens they open
- Where: ⋯ menu; + speed dial; long-press menu; selection bar.
- What happens: "Group Events" opens the Events tab, titled "Events" (and duplicates the tab). "Archived Contacts" opens "Archived", "Unbound Contacts" opens "Unbound contacts", + "Add Contact" opens "New contact", long-press "Edit Contact" opens "Edit contact", and bulk "Log Interaction" with 2 selected opens "Group Log".
- Why it's a problem: the destination's title doesn't confirm where the user meant to go.
- Evidence: 38-overflow-menu.png, 39-overflow-group-events.png, 40-overflow-unbound.png, 41-overflow-archived.png, 80-fab-add-contact.png, 63-ctx-edit.png, 101-bulk-log-2-grouplog.png
- Proposed fix: align labels with destination titles in `dashboard-overflow-actions.ts:28,38` (and the Unbound entry) and `CardContextMenu.tsx:74`. Consider removing "Group Events" from ⋯.

### A-30 · A11Y · Medium — Screen-reader labels: icon glyphs in tab labels, nameless star buttons, stale FAB label
- Where: tab bar; cards and rows; + button (uiautomator dumps).
- What happens:
  - Tab items read ", Contacts", ", Events", and so on; the icon-font glyph is read aloud.
  - Every card star is "Add favourite", without the contact's name.
  - The status badge is a bare "Rogue".
  - The + is labelled "Add / capture" even while it shows ✕.
- Why it's a problem: screen-reader users hear noise, can't tell which star belongs to whom, and get a wrong label on the open FAB.
- Evidence: 01-contacts-home.xml, 79-fab-dial.xml
- Needs investigation:
  - Tabs: `tabBarAccessibilityLabel` in `src/navigation/RootNavigator.tsx`.
  - Stars (`ListRow.tsx:389`, `GridCard.tsx:294`): include the name, as the profile's "Add Zz UX Full Profile to Favorites" does.
  - FAB: label it "Close actions" while the dial is open.

### A-31 · COPY · Low — Search result meta uses developer terms and repeats the name
- Where: Contacts → Search a name.
- What happens: "6 matches · Identity · +3 more", with "Zz UX Full Profile" (the name again) as the snippet.
- Why it's a problem: "Identity" is internal wording, and the snippet adds nothing.
- Evidence: 55-after-snooze.png, 36-contacts-after-relaunch.png, 52-search-single-card.png
- Needs investigation: source labels in `src/logic/dashboard-search-match.ts` (change "Identity" to "Name & contact info"), and skip any snippet equal to the name.

### A-32 · VIS · Low — "No matches for "…"" echoes the whole search text without limit
- Where: Contacts → Search a long string with no match.
- What happens: the empty state repeats the whole term and fills the screen.
- Why it's a problem: the layout breaks with long input.
- Evidence: 34-search-long-text.png
- Proposed fix: at `src/screens/HomeScreen.tsx:1696`, set `numberOfLines={2}` or slice the term to ~40 chars.

### A-33 · COPY · Low — Population empty states don't explain the population
- Where: Population → Birthdays / Snoozed (when empty).
- What happens: "Nothing in Birthdays." and "Nothing in Snoozed." give no hint of what Birthdays covers or how someone gets there.
- Why it's a problem: the user can't tell whether the list is empty or broken.
- Evidence: 06-pop-birthdays.png, 08-pop-snoozed.png
- Proposed fix: at `src/screens/HomeScreen.tsx:1699-1716`, use copy like "No upcoming birthdays" and "No one is snoozed. Snooze someone from their card's long-press menu."

### A-34 · VIS · Low — Reset Dashboard View keeps the old scroll position (seen at ~1,000 contacts; re-check on the 100-contact set)
- Where: scroll down the list → ⋯ → Reset Dashboard View.
- What happens: the list stays mid-way, with the count header scrolled away.
- Why it's a problem: "reset" doesn't look like a reset.
- Evidence: 93-reset-dashboard-view.png
- Needs investigation: `resetDashboard` (`HomeScreen.tsx:484-502`) clears `scrollOffset` in the store, but nothing scrolls the list. Scroll to top on reset.

### A-35 · HID · Low — Quick Log from long-press or swipe says only "Logged", with no name or channel
- Where: long-press → Quick Log; or list row swipe right.
- What happens: the snackbar says only "Logged".
- Why it's a problem: the user can't confirm who was logged or how.
- Evidence: 59-ctx-quicklog.png, 75-row-swipe-right-fast.png
- Proposed fix (citation corrected by the verifier): at `src/services/quick-log-command.ts:156` (shared with the FAB Quick Log), change the snackbar to "Logged <channel> with <name>".

### A-36 · HID · Low — Row swipe gestures are undiscoverable and absent in card view
- Where: Contacts list view vs card view.
- What happens: in list view, swipe left opens Edit Contact and swipe right logs immediately, with no hint on screen. Card view has no swipe. Card long-press is the only list route to Message or Edit.
- Why it's a problem: key actions depend on a gesture nobody is told about, and it works in only one view.
- Evidence: 73-row-swipe-left.png, 75-row-swipe-right-fast.png, 72-card-swipe-right.png
- Needs investigation: a one-time hint, or visible row actions.

### A-37 · VIS · Low — A single search result in card view becomes one full-width card
- Where: Contacts → card view → a search with one result.
- What happens: the lone card stretches to the full width.
- Why it's a problem: the card looks different from every other card.
- Evidence: 52-search-single-card.png, 55-after-snooze.png
- Needs investigation: grid column logic for small result counts.

---

#### Dropped
- Raw A-01 (DEAD · High, memory growth / OOM crash) → moved to `other-findings.md` A-X01 under the owner's 2026-10-10 scope ruling (performance and memory are out of this audit).
- Raw A-02, "taps land seconds late" half → moved to `other-findings.md` A-X02. The visible blank-list half stays as A-01.
- Raw A-04, dropped-tap timing window half → moved to `other-findings.md` A-X03. The union half stays as A-03.
- Raw A-18, the "Orbit" title part → known backlog item 999.4 (owner prompt §3.5). The "Dashboard" wording stays as A-17.
- No other raw finding was dropped. All 38 were confirmed or reproduced on retest.

#### Routes covered
| Route / surface | Reached | How |
|---|---|---|
| `Home` (Contacts tab) | yes | tab; card + list view; Galaxy dark/light, Standard dark/light |
| Population panel (5 options + hidden "Active Contacts") | yes | all tried; restored to All Contacts |
| Filters panel (all families) + Clear filters | yes | multi-filter, empty result, clear |
| Sort panel (6 options) | yes | all tried; restored to Default |
| Search (open, type, Clear, close, long text, no match, Back) | yes | |
| ⋯ → Group Events / Unbound / Archived / Select Contacts / Reset Dashboard View | yes | each opened |
| `UnboundContacts`, `Archived` | yes (opened only; deep audit = H) | ⋯ |
| `GroupEvents` via ⋯ | yes | |
| Selection mode + every bulk action (bulk Quick Log not executed; Archive cancelled; Frequency 30 d executed on Zz UX) | yes | |
| Bulk Log 2 selected → `GroupLog` | yes (opened only) | |
| Long-press menu: View Profile, Quick Log, Log Interaction, Message, Edit Contact, Favorite, Snooze/Unsnooze, Select | yes | all on Zz UX Full Profile |
| `Profile`, `LogContact`, `Compose`, `Edit` from Contacts | yes (opened only) | long-press / swipe left |
| Row swipe right (quick log) / left (Edit) | yes | list view |
| + → Add Contact (`Create`), Quick Log, Log Interaction, Group Log (`GroupLog`), Update Contact (`UpdateContact`), Memory (`Memory`) | yes (opened only) | |
| Empty states: Birthdays, Snoozed, filter-empty, search-empty | yes | |
| Empty states "firstrun" (Add your first contact → `Create`) and "Everyone's tucked away" | no | need a database with no visible contacts |

#### Could not check
- First-run and "Everyone's tucked away" empty states: these would require removing all contacts.
- Birthdays population with content: no contact has an upcoming birthday in range.
- ⋯ menu items twice needed a second tap. This may be RN Modal plus adb; it needs a physical check before being called a bug.
- One unexplained exit to the launcher at 23:26, after a Back press during heavy lag. It was not reproduced in two attempts with the app idle. Possibly A-X01/A-X02 lag combined with A-09; see `other-findings.md`.
- Undo of a Quick Log: the snackbar disappeared before the adb tap arrived, both times.
- The whole area pass ran on ~1,016 contacts, not the ~100-contact subset the rest of the audit uses. See the marked findings.

---

## Area B — Events tab — final findings (2026-10-10)

Final list after the audit, verifier and retest passes. Device: Pixel 6 Pro (debug build), Galaxy / Dark / Deep Space. Evidence paths are relative to `untracked/artifacts/ux-audit/B-events/`. Each `*.png` has a matching `*.xml` uiautomator dump. Retest evidence is in `retest/`.

**Counts: 24 findings.** By code: DEAD 2 · INC 6 · HID 7 · COPY 6 · VIS 2 · A11Y 1. By severity: High 1 · Medium 15 · Low 8.
Retest: B-01, B-05 and B-06 reproduced (3 of 3). B-05 is recoded from DEAD to INC: the control works, and the problem is that participant changes are not covered by the form's Save and discard rules.
Non-UX items, such as the search race B-X01, are in `other-findings.md` and are not repeated here.

---

### B-01 · DEAD · High — The participant editor inside Edit Group Event can't be saved: "Save participant" is off-screen and the sheet doesn't scroll
- Where: Events → event → ⋯ → Edit Group Event → Participants → "Edit" on a participant (bottom sheet "Editing <name>").
- What happens: the sheet fills 92% of the screen. Its fields (Channel, Direction, Connected, Tone, Note, Duration, then three "Follows event" lines) run past the bottom edge. Swiping up inside the sheet does nothing. The retest tried 4 swipes (x=720 and x=300, fast and slow) plus a touchscreen swipe, and none changed the dump. "Save participant" never appears. Raising the keyboard from the Note field clips the content at the top of the keyboard, and Save is still missing. Closing the keyboard (keyevent 111) also closes the whole sheet, so the user is thrown out of the editor just by dismissing the keyboard. Changes made here can only be thrown away.
- Why it's a problem: the user changes values and has no way to keep them. The full-screen "Edit participant" screen, reached from the event detail, has the same fields and a reachable "Save changes".
- Evidence: 06-edit-event-inline-participant.png, 07-inline-participant-bottom.png, 07b-inline-participant-scroll.png (.xml: the last node is "Follows event" at y 3040–3117, and there is no Save node); retest: retest/R1-05-sheet.png, retest/R1-06…R1-09-swipe-*.png, retest/R1-10-note-ime.png, retest/R1-11-ime-swipe.png, retest/R1-12-touchscreen-swipe.png (sheet closed after closing the keyboard), retest/R1-13-reopen-touchscreen-swipe.png
- Proposed fix: `src/components/ui/Sheet.tsx:16-17` says the `expanded` variant does not scroll and its consumers own their scrolling. `src/screens/EditGroupEventScreen.tsx:375-395` puts the editor and "Save participant" (label at :390) in a plain `View`. Wrap that body in a `ScrollView` (`keyboardShouldPersistTaps="handled"`). Better (see B-02): drop the inline sheet and have "Edit" navigate to the existing `EditParticipant` route. Either way the user can reach and press Save. Dismissing the keyboard closing the sheet should also stop happening; check this after the fix.

### B-02 · INC · Medium — The same participant record has two different editors under three different names
- Where: (a) Edit Group Event → participant "Edit" → bottom sheet "Editing <name>" with "Save participant"; (b) event detail → participant ⋯ → "Edit participant record" → full screen "Edit participant" with "Save changes"; (c) event detail → tap participant → sheet "Edit" → chooser "Edit individual interaction" → the same full screen "Edit participant".
- What happens: one record has two editors (a sheet and a screen) and three labels ("Edit", "Edit participant record", "Edit individual interaction"), and the full-screen destination is titled "Edit participant".
- Why it's a problem: the user can't tell whether these are different things, and one of the two editors is broken (B-01).
- Evidence: 06-edit-event-inline-participant.png, 16-participant-overflow.png, 17-edit-participant-screen.png, 25-sheet-edit-target.png, 26-edit-individual.png
- Proposed fix: make the "Edit" button at `EditGroupEventScreen.tsx:312-319` navigate to `EditParticipant`, as `GroupEventDetailScreen.tsx:294-300` does, and remove the inline `Sheet` (`EditGroupEventScreen.tsx:375-395`). Use one label everywhere (e.g. "Edit <name>'s details") in `ParticipantCard.tsx:77` and `components/history/GroupScopePrompt.tsx:41`.

### B-03 · INC · Medium — Edit Group Event and Edit participant look like an older generation of the app, and one flow has three different Back styles
- Where: Events list → event detail → ⋯ → Edit Group Event; detail → participant ⋯ → Edit participant; detail → participant → View profile.
- What happens: the profile header has a chevron icon. The event detail header has the plain word "Back" (no chevron) next to the title. The two edit screens differ from both:
  - a boxed secondary "Back" button inside the scroll content;
  - a different heading style;
  - no background art (a solid fill in every theme);
  - the tab bar hidden.

  Their participant list is plain text with blue "Edit / Remove" links, while the detail screen shows avatar cards.
- Why it's a problem: moving one level deeper changes the whole visual language. The edit screens look unfinished next to the detail screen they come from. They also disagree with the Contacts tab and Profile headers.
- Evidence: 02-detail-dinner.png, 04-edit-event.png, 05-edit-event-bottom.png, 17-edit-participant-screen.png, 32-view-profile.png; theme-galaxy-light-3-edit.png, theme-standard-light-3-edit.png, theme-standard-dark-3-edit.png
- Needs investigation: move the headers at `EditGroupEventScreen.tsx:258-267` and `EditParticipantScreen.tsx:114-123` onto `ShellAppBar variant="child"` (as `GroupEventDetailScreen.tsx:223-231` does), and drop the opaque `colors.background` fill so the art shows. Also check whether ShellAppBar's text-only "Back" is meant to differ from Profile's chevron.

### B-04 · HID · Medium — An event's title can't be changed anywhere
- Where: Events → event → ⋯ → Edit Group Event.
- What happens: the title is shown as plain body text above "Date & time"; it is not a field. No other screen offers renaming. A typo made in the title at Group Log time is permanent, short of deleting the event and its interactions.
- Why it's a problem: every other field of the event is editable on this screen; the most visible one isn't. Titles like "Phase38_Group_UAT" stay forever.
- Evidence: 04-edit-event.png, 95-edit-long-title.png (.xml: the title node is neither clickable nor editable)
- Needs investigation: `EditGroupEventScreen.tsx:268` renders `event.title` as `AppText`. `UpdateGroupEventInput` / `updateGroupEvent` (`src/db/group-events-dao.ts:48-53`, `:383`) has no title field. This needs a DAO change plus a title `TextInput` with the same not-blank rule as `createGroupEvent` (`group-events-dao.ts:325`).

### B-05 · INC · Medium — Adding or removing participants on Edit Group Event saves at once, skipping "Save changes" and the discard prompt
- Where: Edit Group Event → "Add participants" (or "Remove"), then leave with Back.
- What happens: the audit added UAT-Row-02, and the retest added Zz UX Full Profile. In both cases Back was pressed without "Save changes". No "Discard changes?" prompt appeared, and the added person was on the event afterwards. The retest got the same result with Android Back and with the on-screen Back. For contrast, changing the date and pressing Back does show "Discard changes?", and DISCARD reverts the date. So the guard covers the event fields but not the participant list.
- Why it's a problem: the screen's form promises "edit, then Save changes or Discard", but half the screen ignores that. A user who adds the wrong person and backs out expecting a discard keeps the change.
- Evidence: 69-edit-added.png, 70b-state.png, 71-back-after-add.png, 72-detail-has-added.png; compare 14-discard-guard.png; retest: retest/R2-04-after-done.png, retest/R2-05-after-back.png, retest/R2-11-added-confirm.png, retest/R2-12-after-onscreen-back.png, retest/R2-16-discard-prompt.png, retest/R2-17-after-discard.png
- Needs investigation: participant writes happen immediately (`addSelected` / `removeParticipant` in `EditGroupEventScreen.tsx:162-219`), while `useDiscardKeepGuard` only tracks `isGroupEventDraftDirty` over the event fields. Either move participant management off this form (the detail screen already has Add / Remove) or make it part of the draft.

### B-06 · DEAD · Medium — After editing a participant from the interaction sheet, the sheet comes back showing the old values
- Where: Event detail → tap a participant card → Interaction sheet → Edit → "Edit individual interaction" → change Tone or Note → Save changes.
- What happens: on return the same "Interaction" sheet is open and still shows the pre-save values:
  - Retest with Tone: Tone was changed from Positive to Neutral. The sheet still read "Positive", while the card underneath already read "Follows event: Channel, Duration".
  - Retest with Note: a note "Zz retest" was saved. On return the sheet had no Note row at all.
  - Closing and reopening the sheet shows the saved values ("Neutral"; Note "Zz retest").
  - The same edit through the participant ⋯ → "Edit participant record" (with no sheet open) updates the card correctly. Only the sheet that stays open shows old values.
- Why it's a problem: the save looks like it didn't happen. A new note the user just typed appears to be missing.
- Evidence: 29-detail-restored.png, 30-detail-after-close.png, 31-sheet-reopened.png; retest: retest/R3-01-sheet.png, retest/R3-07-on-return.png (still "Positive"), retest/R3-08-card-after-close.png, retest/R3-09-sheet-reopened.png ("Neutral"), retest/R3-13-on-return-note.png (no Note row), retest/R3-15-sheet-reopened-note.png (Note present), retest/R3-21-restored-detail.png
- Proposed fix: `GroupEventDetailScreen.tsx:193-194` builds the sheet from the `detail` snapshot taken at tap time (set at :293). The focus refresh (:105-107) updates `event` but not `detail`. In the `onEdit` (:336-342) and `onEditParticipant` (:354-360) handlers, call `setDetail(null)` before navigating, or re-resolve `detail` from the refreshed `event.participants` by `interactionId`. The sheet then either closes or shows the saved values.

### B-07 · INC · Medium — "Remove from group → Delete interaction" deletes at once; the same delete from the interaction sheet asks for confirmation
- Where: Event detail → participant ⋯ → "Remove from group" (or Edit Group Event → "Remove") → sheet "Remove <name> from this group?" → red "Delete interaction".
- What happens: the red button is the first and most prominent choice. It deletes the person's interaction immediately, with no confirmation and no undo. The sheet doesn't explain what "Keep as individual interaction" means. Deleting the same interaction from the participant's interaction sheet shows a confirmation ("This can't be undone…").
- Why it's a problem: the destructive choice comes first, under a "remove from group" question. Many users expect that to remove the person from the list, not delete their history. The two paths to the same delete disagree.
- Evidence: 09-remove-participant-sheet.png, 74-remove-sheet-detail.png, 75-after-delete-participant.png; compare 24-interaction-delete-confirm.png
- Needs investigation: `src/components/group/RemoveParticipantSheet.tsx:33-45`. Options: put "Keep as individual interaction" first or make it the default, add one line of explanation per choice, and use the same confirmation (or an undo snackbar) as elsewhere.

### B-08 · HID · Medium — Group Log started from the Events tab ends on the Contacts tab, and the new event isn't shown
- Where: Events tab → + → Group Log → fill in the form → "Log group".
- What happens: Group Log opens with the tab bar hidden. After saving, the app lands on the Contacts tab (contact grid), with no confirmation and no event. The new event only shows after tapping the Events tab again.
- Why it's a problem: the Events empty state tells users to log events this way. The user starts on Events, saves an event, and is moved somewhere else with no feedback.
- Evidence: 36-fab-on-events.png, 37-grouplog-from-events.png, 42-after-log-group.png, 80-after-log-empty-fast.png, 43-events-with-new.png
- Needs investigation: `src/components/universal-fab-logic.ts:193-195` always targets `DashboardTab` / `GroupLog`. `GroupLog` is registered only in the Contacts stack (`DashboardStack.tsx:43`), and `GroupLogScreen.tsx:99` calls `goBack()` inside it. Options: register `GroupLog` in the Events stack and target it from Events, or open the new event's detail after saving.

### B-09 · HID · Medium — Event detail hides its main actions in ⋯, and the empty participant state has no Add button and the wrong copy
- Where: Event detail (any event; most visible on an event with 0 participants).
- What happens: Edit, Add Participant, Dissolve and Delete are only in the header ⋯ menu. An event with no participants shows "No participants yet — Add the people who were there — or save now and add them later." with no button, and there is nothing to "save" on this screen.
- Why it's a problem: the obvious next step isn't on screen, and the copy belongs to the Group Log form, which uses the same text.
- Evidence: 82-detail-no-participants.png, 03-detail-overflow.png; the same copy on the form: 79-gl-two.png
- Proposed fix: in the `ListEmptyComponent` at `GroupEventDetailScreen.tsx:281-287`, change the body to e.g. "Add the people who were there." and add a secondary "Add participants" button that calls `setPickerVisible(true)`. Users then see the action where the list is. (The form keeps its own copy at `GroupLogScreen.tsx:173`.)

### B-10 · COPY · Medium — Developer terms throughout Events: "Dissolve", "Follows event", "overridden", "participant record", "Gravity", "Intensity"
- Where: these terms appear on these screens:
  - event detail ⋯: "Dissolve", "Delete Group Event & Interactions";
  - participant cards: "Follows event: Channel, Tone, Duration", "Participant overrides";
  - participant ⋯: "Edit participant record";
  - Edit participant: "Tone: overridden", "Follow event tone";
  - delete dialogs: "may change this contact's Status, Gravity, and Intensity".
- What happens / why: these words describe the data model, not what the user does. "Dissolve" doesn't say that the event disappears and each person keeps a separate interaction; only the dialog explains that. "Gravity" and "Intensity" aren't explained anywhere on these screens.
- Evidence: 02-detail-dinner.png, 03-detail-overflow.png, 16-participant-overflow.png, 19-edit-participant-overridden.png, 24-interaction-delete-confirm.png, 76-dissolve-confirm.png
- Needs investigation: a copy pass over `GroupEventDetailScreen.tsx:45-56,223-231`, `ParticipantCard.tsx:33-38,77-78` and `ParticipantOverrideEditor.tsx:132-138`. Example wording: "Ungroup (keep each person's entry)", "Same as event: channel, tone", "Tone set just for <name>", "Use the event's tone".

### B-11 · COPY · Medium — The participant editor shows three identical "Follows event" lines, apart from the fields they describe
- Where: Edit participant (screen) and the inline sheet (B-01), at the bottom of the form.
- What happens: three lines read "Follows event / Follows event / Follows event" under Duration, with no field names. When one field is changed, the middle line becomes "Tone: overridden" with a "Follow event tone" link, still far below the Tone field.
- Why it's a problem: the user can't tell which line belongs to which field.
- Evidence: 06-edit-event-inline-participant.png, 19-edit-participant-overridden.png, 28-ep-followed.png
- Proposed fix: at `src/components/group/ParticipantOverrideEditor.tsx:132`, use `following ? \`${label}: same as event\` : \`${label}: set for this person\``. Ideally, put each state line directly under its field. The user then sees which field each line refers to.

### B-12 · COPY · Medium — One concept, many names: Events / Group Event / Group Events / Group Log / Log group
- Where: tab "Events"; detail title "Group Event"; Contacts ⋯ "Group Events" (A-29); + menu "Group Log"; form button "Log group"; menu item "Delete Group Event & Interactions" vs dialog button "Delete group & interactions"; empty state "get-together".
- Why it's a problem: nothing says that "Group Log" is how you create an Event, and the + menu has no "New event". The menu item and the dialog button for the same action also differ in case (Title Case vs sentence case).
- Evidence: 01-events-home.png, 02-detail-dinner.png, 36-fab-on-events.png, 37-grouplog-from-events.png, 03-detail-overflow.png, 77-delete-event-confirm.png
- Needs investigation: pick one noun (e.g. "Event") and one verb ("Log event"). Touch `src/constants/product-labels.ts` (EVENTS), `universal-fab-logic.ts:39`, `GroupEventDetailScreen.tsx:220,223-231` and `GroupLogScreen.tsx:116`. Related to B-23, which covers creating and planning; this finding covers naming only.

### B-13 · COPY · Low — Search with no matches shows the same sentence twice and echoes the full search text
- Where: Events → search → type something with no match.
- What happens: the heading reads "No events match "Historyqqq"." and the body below repeats the same sentence. A very long search term is echoed in full in both, filling the middle of the screen.
- Why it's a problem: it looks like a bug, and it gives no hint of what search covers. Contacts' no-match state has the same unbounded echo (A-32).
- Evidence: 46-search-nomatch.png, 60-search-long.png
- Proposed fix: `src/screens/GroupEventsScreen.tsx:64-67,148-160` uses `emptyCopy` for both the heading and the body. When `emptyCopy` is set, use a different body, e.g. "Search looks at event titles and participant names.", and truncate the echoed term (e.g. 40 chars + "…"). The user then sees one heading and a useful hint.

### B-14 · HID · Medium — Closing Events search keeps the filter: the list stays filtered with the search box hidden, even after switching tabs
- Where: Events → search icon → type → tap the search icon again.
- What happens: the field disappears but the search term stays applied. The list shows only "No events match "…"" (or a partial list) with no visible search box. This lasts after going to another tab and back. Only reopening search and clearing it brings the events back.
- Why it's a problem: it looks like events have vanished. Contacts has the same kind of problem (A-02, hidden search still filtering).
- Evidence: 48-search-closed-still-filtered.png, 49-after-tab-switch.png
- Proposed fix: at `GroupEventsScreen.tsx:82`, use `onPress={() => setSearchOpen((open) => { if (open) setTerm(""); return !open; })}`, or keep the field visible while a term is set. Closing search then shows all events again.

### B-15 · HID · Low — Android Back doesn't close Events search; it leaves the tab
- Where: Events with search open.
- What happens: the first Back hides the keyboard. The second Back switches to the Contacts tab. Coming back, the search is still open and still filtering.
- Why it's a problem: users expect Back to close the search first. Contacts has a related problem (A-09, Back exits the app).
- Evidence: 50-back-1.png, 51-back-2.png, 52-events-return.png
- Needs investigation: `GroupEventsScreen.tsx` has no `BackHandler`. Add one that closes search (and clears it, see B-14) when search is open.

### B-16 · VIS · Medium — The interaction sheet cuts "Delete" to "Delet", and its actions are hidden below the fold
- Where: Event detail → tap a participant card (also Profile → History → a group entry).
- What happens: the sheet opens showing the fields from Channel down to the Group event card. "View profile / Edit / Delete" are below the bottom edge and only appear after scrolling the sheet. Once visible, the red button reads "⚠ Delet".
- Why it's a problem: the destructive label is clipped, and the actions are hard to find.
- Evidence: 21-participant-interaction-sheet.png, 22-participant-sheet-scrolled.png, 29-detail-restored.png
- Proposed fix: in `src/components/history/InteractionDetail.tsx:296-301` (`actions` style), add `flexWrap: "wrap"`, or put "View profile" on its own row. All three buttons then fit with full labels. Consider placing the action row above the Group event card so it shows without scrolling.

### B-17 · COPY · Low — Interaction sheet: "Connected / Connected", and "View Group Event" while already on that event
- Where: Event detail → tap a participant.
- What happens: the field label and its value both read "Connected". Opened from the group event itself, the card's "View Group Event" link just closes the sheet.
- Why it's a problem: the text is redundant, and the link looks like it does nothing.
- Evidence: 21-participant-interaction-sheet.png, 23-after-view-group-event.png
- Proposed fix: in `InteractionDetail.tsx`, show e.g. "Reached them: Yes". At `GroupEventDetailScreen.tsx:350`, pass `onViewGroupEvent={undefined}` instead of `() => setDetail(null)`. `InteractionDetail.tsx:205` already hides the button when the prop is absent.

### B-18 · INC · Medium — Event editors use unthemed Android system dialogs and dropdowns next to themed ones
- Where: Edit Group Event / Edit participant / Group Log: Back with unsaved changes → "Discard changes?"; the Channel, Tone and Direction dropdowns.
- What happens: the discard dialog is the grey system AlertDialog with teal ALL-CAPS buttons. The dropdowns are grey system popups with no mark on the current value. On the same screens, Dissolve and Delete use the app's themed dialog with an icon and rounded buttons.
- Why it's a problem: two dialog styles in one flow. Contacts has the same pattern (A-14, snooze system dialog vs themed sheet).
- Evidence: 14-discard-guard.png, 63-channel-dropdown.png, 18-tone-dropdown.png; compare 76-dissolve-confirm.png
- Needs investigation: `src/navigation/discard-keep-guard.ts:29` (`Alert.alert`) and the native `Picker` at `src/components/TouchpointRefineForm.tsx:300,327,373`. Switch to `ConfirmDialog` and the app's sheet/option list.

### B-19 · INC · Low — Destructive dialogs lay out their buttons differently
- Where: Delete interaction (side by side, Cancel on the left) vs Dissolve / Delete group event (stacked, Cancel on top, red button below).
- Why it's a problem: the safe button moves between dialogs of the same kind.
- Evidence: 24-interaction-delete-confirm.png (both buttons at y≈1845), 76-dissolve-confirm.png (Cancel y 1839, confirm y 2031), 77-delete-event-confirm.png
- Needs investigation: `ConfirmDialog` probably switches to stacked when the confirm label is long. Keep one order: either always stacked with the destructive button on top, or always Cancel first.

### B-20 · VIS · Low — Duration control: a saved custom duration isn't shown on reopening, and "None" appears twice
- Where: Edit Group Event (also Edit participant and Group Log) → Duration.
- What happens: after saving 90 minutes, reopening shows no chip selected, an empty "Custom (minutes)" field and the readout "1h 30m" underneath. With no duration, the "None" chip is selected and a grey "None" readout repeats it under the field.
- Why it's a problem: the field that holds the value looks empty, and the readout looks like a stray label.
- Evidence: 64-custom-duration.png, 70b-state.png, 04-edit-event.png
- Needs investigation: `src/components/TouchpointRefineForm.tsx:193` always seeds `customMinutes` with `""`. Seed it from the saved value when that value matches no chip, and hide the readout when "None" is selected.

### B-21 · HID · Low — Participant cards don't show what's different for a person
- Where: Event detail → Participants.
- What happens: after one participant gets a different tone, their card only changes from "Follows event: Channel, Tone, Duration" to "Follows event: Channel, Duration". The person's own tone, note or direction isn't shown; you must open each card.
- Why it's a problem: the list can't answer "how did it go with each person?" at a glance.
- Evidence: 20-detail-after-override.png
- Needs investigation: `src/components/group/ParticipantCard.tsx:24-38`. Show the changed values ("Tone: Neutral") and a note snippet instead of the list of fields that follow the event.

### B-22 · A11Y · Low — Screen-reader labels on Events lose context
- Where: Events list rows; participant cards; the Edit Group Event participant list.
- What happens (uiautomator dump): each participant's ⋯ is labelled only "More actions". The Edit Group Event buttons are labelled "Edit" / "Remove" with no name. Event rows are labelled "View event <title>", and that label replaces the date and participant count shown on the row.
- Why it's a problem: a screen-reader user hears several identical "More actions", "Edit" and "Remove" labels with no person named, and doesn't hear the event date.
- Evidence: 02-detail-dinner.xml, 05-edit-event-bottom.xml, 01-events-home.xml; compare 32-view-profile.xml
- Proposed fix: in `ParticipantCard.tsx`, give the OverflowMenu (which already accepts `accessibilityLabel`, `OverflowMenu.tsx:37`) the label `More actions for ${participant.contactName}`; Profile already uses "More actions for <name>". At `EditGroupEventScreen.tsx:312-324`, label the buttons `Edit ${item.contactName}` / `Remove ${item.contactName}`. At `GroupEventsScreen.tsx:121`, include the date and participant count in the row label.

### B-23 · HID · Medium — The Events tab can't create, plan or remind: no add button, no future events, no reminders
- Where: Events tab; Edit Group Event date.
- What happens:
  - The Events tab has only a search icon. Creating an event means finding "Group Log" in the + menu.
  - Future dates are refused ("Group events can't be in the future."), even though the date picker offers them.
  - No event screen has a reminder option. The area brief lists "reminders on events", but no such control exists.
- Why it's a problem: a tab called "Events" reads as a place for upcoming events. It is really a log of past group get-togethers, and nothing on the tab says so. A date picker that offers a date and then rejects it is a small trap.
- Evidence: 01-events-home.png, 36-fab-on-events.png, 96-datepicker-future.png, 97-future-date.png
- Needs investigation: a product question for the owner: rename the tab to match what it is, or add planning and reminders. The small part: set `maximumDate` on the `DateTimePicker` at `TouchpointRefineForm.tsx:570-575` when `futureDateMessage` is set.

### B-24 · COPY · Low — The Events empty state points to "Group Log on any contact", which doesn't exist (code-read; not seen on device)
- Where: Events tab with zero events.
- What happens: the copy reads "Log a get-together with several people at once from the + button, or from Group Log on any contact." A contact's profile has no Group Log action. The only other path is selecting 2+ contacts on the Contacts tab and pressing Log (`HomeScreen.tsx:1185`).
- Why it's a problem: it sends users looking for a control that isn't there.
- Evidence: `src/screens/GroupEventsScreen.tsx:159-160`. Not observed on the phone: emptying the tab would have meant deleting the three required group events.
- Proposed fix: change the text at `GroupEventsScreen.tsx:160` to "Log a get-together with several people from the + button (Group Log), or select people on the Contacts tab and tap Log."

---

#### Dropped

None. The verifier confirmed 21 findings and sent 3 to recheck (B-01, B-05, B-06). All 3 reproduced on retest. B-05 is recoded from DEAD to INC, as the verifier suggested; the retest showed the control works and the guard just doesn't cover participants.

Related pairs kept separate because they describe different problems: B-01/B-02, B-11/B-21, B-12/B-23. Overlaps with other areas, for the cross-cutting pass: B-13 ↔ A-32, B-14 ↔ A-02, B-15 ↔ A-09, B-18 ↔ A-14.

#### Routes covered

| Route | Reached | How |
|---|---|---|
| `GroupEvents` (Events tab root) | yes | Events tab; also Contacts ⋯ → "Group Events" (86-overflow-to-events.png); re-tapping the tab from the detail screen returns to the root (109) |
| `GroupEventDetail` | yes | Tapping an event row (Events stack); Profile → History → group entry → View Group Event (88–90) |
| `EditGroupEvent` | yes | Event detail ⋯ → Edit Group Event; also offered by interaction sheet → Edit → "Edit Group Event" (25) |
| `EditParticipant` | yes | Event detail → participant ⋯ → Edit participant record (17); interaction sheet → Edit → Edit individual interaction (26) |
| Surfaces that are not routes | yes | Events search (open/close/empty/long/no match); detail ⋯ menu; participant ⋯ menu; RemoveParticipantSheet (Delete and Keep both run); Dissolve and Delete dialogs (both run on Zz events); Add Participant picker (0 and 1 selected); InteractionDetail sheet, its Delete dialog (cancelled) and its Edit chooser; inline participant sheet (B-01); discard guard; date/time pickers including a future date; Channel/Tone dropdowns; custom duration |
| Group Log (area F) | only as the create path | 3 events created from the Events tab FAB |

Theme spot-check: Events list, event detail, Edit Group Event and the interaction sheet in Galaxy Dark (the default), Galaxy Light, Standard Light and Standard Dark (`theme-*-{1-list,2-detail,3-edit,4-sheet}.png`). No theme-specific colour bugs were seen. The edit screens drop the background art in all four (B-03).

#### Could not check

- **Events tab empty state** (zero events): checking it would mean deleting or dissolving the three existing group events, which the setup marks as required data. The copy was reviewed from code only (B-24).
- **"Couldn't load events" / "Couldn't refresh this event" / write-error states**: these need a database failure and can't be produced from the UI.
- **Reminders on events**: no such feature exists in the UI (recorded as B-23).
- **Interaction sheet → "Edit Group Event" from the Edit chooser**: seen (25) but not followed; it is the same route as the ⋯ entry.
- The search-results race (B-X01 in `other-findings.md`) reproduced 1 of 4 attempts.

---

## C — Digest — final findings

Finalized 2026-10-10 from `findings-raw.md`, `verification.md` and `recheck-list.md`. No device was used. There is no retest for this area: its only recheck item (raw C-14) was moved to area E. Evidence paths are relative to `untracked/artifacts/ux-audit/C-digest/`.

**Counts: 14 findings.** By severity: High 0 · Medium 6 · Low 8. By code: HID 6 · INC 3 · COPY 2 · VIS 2 · A11Y 1 · DEAD 0.

### C-01 · HID · Medium — Android Back on Digest goes to the Contacts tab; Back after a Digest link exits the app instead of returning to Digest
- Where: Digest (launch tab) → Android Back; and Digest → "See everyone needing attention →" or "+11 more →" → Contacts tab → Android Back.
- What happens: The app opens on Digest. Back there switches to the Contacts tab, and a second Back exits. After a Digest link moves you to Contacts, Back exits the app straight away. It does not take you back to Digest, where you just were.
- Why it's a problem: Back should return to the screen you came from. Here it either jumps to a tab you never visited or leaves the app. B-15 (Back from Events search leaves the tab) has the same tab-level cause. A-09 (Back with search open exits) is similar but has a separate screen-level cause (`HomeScreen.tsx:1601`).
- Evidence: `13-see-everyone-attention.png` → `14-back-after-drill.xml` (launcher in focus); `15-relaunch.png` → `16-back-from-digest-root.png` (Contacts tab).
- Proposed fix: `src/navigation/RootNavigator.tsx:240` `<Tab.Navigator …>` sets no `backBehavior`, so React Navigation's default `firstRoute` applies. `DashboardTab` (Contacts) is the first `Tab.Screen` (`:265`), even though `initialRouteName` is `"DigestTab"` (`:241`, `shell-contract.ts:9`). Add `backBehavior="history"`. Afterwards, Back from a Digest link returns to Digest, and Back on Digest at launch exits the app instead of jumping to Contacts.

### C-02 · HID · Medium — + button actions started on Digest open on top of old Contacts-tab history; Back lands on an unrelated screen
- Where: Digest → + button → Add Contact → Android Back.
- What happens: Add Contact opens inside the Contacts tab. Back did not return to Digest. It landed on "Zz UX Full Profile", a profile opened earlier in the Contacts tab, with the Contacts tab now selected.
- Why it's a problem: The user started on Digest and pressed Back, and ended up on a stale screen from earlier. B-08 has the same root cause (Group Log started from Events ends on the Contacts tab).
- Evidence: `38-fab-from-digest.png`, `39-fab-addcontact-from-digest.png`, `40-back-from-addcontact.png` (Contacts tab selected, stale profile).
- Needs investigation: `src/components/universal-fab-logic.ts:185-205` (`resolveFabTarget`, `AddContact` at `:190`) always targets `DashboardTab`. `navigateIntoTab` (`tab-entry.ts:57-67`) uses `initial: false`, so on a stack that is already mounted the screen is pushed on top of the existing history. Fixing C-01 changes only tab switching, not this stack.

### C-03 · HID · Medium — Digest links silently replace the user's saved Contacts view and land on a hidden population
- Where: Digest → Horizon → "See everyone needing attention →"; Digest → Never Contacted → "+11 more →".
- What happens:
  - The first link opens Contacts with Population "Active Contacts" (a hidden population, see A-04) and the filter "Needs attention": 49 contacts.
  - The second link sets Population "Not Contacted": 14 contacts.
  - Either way the user's own Population, Filters and Sort are overwritten and stay that way.
  - Later, searching Contacts for "Full Profile" said `No matches for "Full Profile"`, because the search ran only inside the Not Contacted view. It worked after Reset Dashboard View.
- Why it's a problem: A "see more" link quietly changes a saved setting on another tab. Later the Contacts list and its search look broken, with nothing on screen saying why. This compounds A-02 (list silently filtered after reopening), A-04 (hidden Active Contacts) and A-05 (empty list doesn't mention filters).
- Evidence: `13-see-everyone-attention.png`, `18-plus-more-drill.png`, `20-search-full.png`, `22-reset.png`, `23-search-full2.png`.
- Needs investigation: `src/screens/DigestScreen.tsx:113-127` `runDigestDrillThrough` calls `setPopulationsAndFilters`. That function (`dashboard-query-store.ts:117-133`) saves `dashboardPopulations`/`dashboardFilters` to app settings. Options: open a temporary, clearly labelled view (for example, a "From Digest" chip with ✕), or restore the previous query when the user leaves it.

### C-04 · HID · Medium — Your Week day detail can't be closed; a busy day becomes a very long list
- Where: Digest → Your Week → tap any heatmap square.
- What happens:
  - A day panel opens below the squares. Tapping the same square again does nothing, and there is no close control. The panel only switches to another day.
  - On 10/07 the panel lists 29 entries, one name and time each. Under Standard Dark that run of identical "History Dense" rows filled the screen.
  - The panel stayed open across theme changes.
- Why it's a problem: The user can't return to the compact summary. A busy day pushes everything into a long scroll.
- Evidence: `05-day-detail-1007.png`, `06-day-detail-scrolled.png`, `08-day-detail-empty-1006.png`, `09-day-retap-deselect.png` (byte-identical to 08, so the re-tap changed nothing), `54-standard-dark-bottom-daydetail.png`.
- Proposed fix: In `src/components/digest/YourWeekSection.tsx:268-274` `onSelectDay`, when `date === controllerRef.current.selectedDay`, call `commitController(selectYourWeekDay(controllerRef.current, null))` and `clearDay()` instead of reloading. `selectYourWeekDay(state, null)` is supported (`your-week-section-logic.ts:190-195`), and `clearDay` exists (`:225-228`). Re-tapping the square then closes the panel, because the panel renders only while `selectedDay !== null` (`:351`). Optionally also cap the list (for example, "Show all 29").

### C-05 · INC · Medium — Day-detail entries can't be tapped and show only name and time
- Where: Digest → Your Week → tap a day → an entry (for example, "History Long 9:20 PM").
- What happens: Nothing happens with either plain tap or touchscreen tap, and the dump marks the rows `clickable="false"`. Each row shows only a name and a time: no channel, no note, no way to open the person or the interaction.
- Why it's a problem: Every other person row on Digest (Up Next, Birthdays, Overlooked, Never Contacted) opens the Profile. These rows look the same but do nothing.
- Evidence: `06-day-detail-scrolled.png` + `.xml`, `07-tap-day-row.png`, `07b-tap-day-row-touchscreen.png` (06, 07 and 07b are byte-identical).
- Proposed fix: In `src/components/digest/DigestDayDetail.tsx:115-137`, the interaction rows are plain `View`s with no handler. Make them `Pressable` and call a new `onOpenProfile(row.contactId)` prop, only for rows where `contactId` is not null (`contactId` is `number | null`, `src/db/your-week-read.ts:35`). `DigestScreen.tsx:214` already has `onOpenProfile`, but `YourWeekSection` accepts only `refreshSignal`, so the prop has to be threaded through `YourWeekSection` to `DigestDayDetail`. Group-event rows (`:97-114`) are inert too and could open the event detail. Tapping a row then opens that person's Profile, like the rest of Digest. Adding the channel to the caption is optional.

### C-06 · COPY · Medium — Digest shows raw numeric dates ("2026-10-13", "2026-10-07", "10/07/2026")
- Where: Horizon → Birthdays row tag; Your Week → day panel heading; screen-reader labels on the heatmap squares.
- What happens:
  - The birthday three days away is labelled "2026-10-13". Today and Tomorrow use words.
  - The day panel heading reads "2026-10-07".
  - The squares are announced as "10/07/2026, 29 activities".
- Why it's a problem: The rest of the app uses friendly dates, for example "Sep 26, 2026, 6:00 PM" on Events and "Sat, Oct 10" in pickers. Raw ISO dates look like developer output. For a birthday, a weekday or "in 3 days" is what a user needs.
- Evidence: `31-digest-birthday-top.png`, `53-standard-light-top.png`, `05-day-detail-1007.png` + `.xml` (`content-desc="10/07/2026, 29 activities"`), `06-day-detail-scrolled.png`, `50-galaxy-light-bottom-daydetail.png`.
- Proposed fix: `src/utils/dates.ts` has no date-only display formatter. It has only `formatDateTimeMinute`, with a private `MONTH_ABBREVIATIONS`. Add one (for example, `formatDisplayDate` → "Tue, Oct 13") and use it at all three sites: `src/logic/digest-composition.ts:62` (`formatLocalDate(occurrence)` used as the birthday tag); `src/components/digest/DigestDayDetail.tsx:83`, which renders `{date}` raw (`:79` also uses it in the a11y label); and `dateLabel` in `src/components/digest/YourWeekHeatmap.tsx:53-56`.

### C-07 · HID · Low — Heatmap squares have no day labels; the selected square is barely marked
- Where: Digest → Your Week heatmap.
- What happens: Seven unlabelled coloured squares. Nothing says which day each one is, or which is today, without tapping it. The selected square gets only a slightly thicker border, hard to see in either mode.
- Why it's a problem: The user has to tap squares one by one to read the chart.
- Evidence: `03-digest-bottom.png`, `04-yourweek-rolling.png`, `05-day-detail-1007.png`, `50-galaxy-light-bottom-daydetail.png`.
- Proposed fix: In `src/components/digest/YourWeekHeatmap.tsx:108-124`, the selected cell is `borderWidth 2, borderStrong` and an unselected cell is `1, border`. Render a short weekday letter or date number in or under each cell, and use a stronger selected style (for example, an accent border). Each square then shows its day.

### C-08 · INC · Low — Birthday rows have no avatar, unlike every other Digest row
- Where: Digest → Horizon → Birthdays.
- What happens: The row is a bare name, with the date at the far right. Up Next, Overlooked, Never Contacted and day-panel rows all show an avatar.
- Why it's a problem: The section looks unfinished next to the other rows in the same Horizon block.
- Evidence: `31-digest-birthday-top.png`, `50-galaxy-light-top.png`, `53-standard-light-top.png`.
- Proposed fix: `src/components/digest/HorizonSection.tsx:81-104` renders only the name and tag. Overlooked and Never Contacted rows use `CompactContactRow` (`:174-228`, avatar at `:205-217`). Reuse it for birthday rows with an optional trailing tag. The birthday candidate type has to carry `photo`; check this when implementing. Birthday rows then match their siblings.

### C-09 · VIS · Low — Switching Rolling 7 Days / Calendar Week makes the page jump
- Where: Digest → Your Week toggle.
- What happens: After the tap, the page scrolls by about 200 px. The "Your Week" header moved from y 1415 to y 1632 on each period toggle.
- Why it's a problem: The control the user just tapped moves out from under their finger.
- Evidence: `03-digest-bottom.xml` vs `04-yourweek-rolling.xml`; `44-yw.xml` vs `45-calendar-restored.xml`. (The raw report also claimed this on selecting a day. The verifier narrowed that out: dump 05 keeps the header at 1632.)
- Needs investigation: `src/components/digest/YourWeekSection.tsx:322-360`. `onPeriodChange` calls `setLoaded(null)` (`:242`). `yourWeekPresentation` then returns `body: "none"` (`your-week-section-logic.ts:294`), so the heatmap and day panel unmount and the ScrollView clamps. Keep the previous body mounted while loading.

### C-10 · INC · Low — The Your Week period is set in two places, and one is labelled with jargon
- Where: the Digest toggle, and Settings → Interactions → "Your Week period — The period used by the Digest retrospective."
- What happens: Tapping the toggle on Digest also changes the saved setting, without saying so (`YourWeekSection.tsx:244-248` saves through `updateAppSettings`). The Settings copy of the control sits under Interactions and uses the word "retrospective". Today (Saturday, 10/04–10/10) both choices show the same seven days and the same numbers, so on this day the toggle appears to do nothing.
- Why it's a problem: A duplicate control in an unexpected Settings section, with developer wording, for a choice the user can already make in place.
- Evidence: `02-digest-scroll1.png`, `03-digest-bottom.png`, `04-yourweek-rolling.png`, `47-settings-interactions.png`.
- Needs investigation: Decide on one home for the setting, or reword the Settings copy (for example, "Digest: how Your Week counts days"). Settings copy: `src/screens/SettingsInteractionsScreen.tsx:200` (section starts at `:197`). Cross-area: the Settings side also belongs to area K.

### C-11 · COPY · Low — Three names for the same group: "Never Contacted", "Not Contacted", "Not yet contacted"
- Where: Digest Horizon heading "Never Contacted"; Contacts Population "Not Contacted" (where "+11 more →" lands); status label "Not yet contacted" (screen-reader labels on Digest and Contacts cards).
- Why it's a problem: The user follows a link and arrives at a view with a different name. A-15 and A-17 show other cases of one concept with several names.
- Evidence: `02-digest-scroll1.xml` (heading "Never Contacted" and three `content-desc="Not yet contacted"`), `18-plus-more-drill.png`.
- Proposed fix: Pick one term, for example "Not contacted yet", and use it at `src/components/digest/HorizonSection.tsx:140` and `:206`, `src/components/control-surface/control-labels.ts:12` (population label "Not Contacted"), `src/components/icons/status-display-label.ts:17` and `ContactCard.tsx:90`. The link and its destination then share one name.

### C-12 · A11Y · Low — Avatars are announced with internal status names ("rogue status")
- Where: Digest → Up Next and Overlooked avatars (uiautomator content-desc).
- What happens: A screen reader hears "rogue status". The other internal names are "wobble" and "decay". Never Contacted avatars say "Not yet contacted".
- Why it's a problem: These are internal model names, not user words. This matches A-19 (status jargon) and A-30 (screen-reader labels), on a different surface.
- Evidence: `01-digest-top.xml` (six `content-desc="rogue status"`).
- Proposed fix: `src/components/digest/UpNextSection.tsx:63` and `src/components/digest/HorizonSection.tsx:206` use `${status} status`. Map each status to a plain phrase, for example "Overdue", or reuse the `upNextReason` text (`UpNextSection.tsx:20-27`). Do not just reuse the shared `statusDisplayLabel` (`status-display-label.ts`): it returns "Rogue"/"Wobbling", which is the same A-19/A-30 jargon with different casing.

### C-13 · HID · Low — "Overlooked" vs "Up Next" is unexplained; Overlooked rows give no reason
- Where: Digest → Up Next (3 rows) and Horizon → Overlooked (3 rows).
- What happens:
  - All six people have the same orange ring.
  - Each Up Next row has a reason line, and all three read "Well past their usual orbit": `upNextReason` (`UpNextSection.tsx:20-27`) maps both `overdue` and `rogue` to that one sentence.
  - Overlooked rows have no reason line at all, because `CompactContactRow` has none.
  - Nothing explains why one overdue person is "Up Next" and another is "Overlooked".
- Why it's a problem: The two lists look like one list split arbitrarily, and three identical reason lines add nothing.
- Evidence: `01-digest-top.png`, `15-relaunch.png`, `31-digest-birthday-top.png`.
- Needs investigation: The Overlooked row renderer in `src/components/digest/HorizonSection.tsx:112-135`, whether it can show a reason line (for example, "Last contact 292 days ago"), and whether `upNextReason` can tell overdue and rogue apart.

### C-14 · VIS · Low — The + button covers the Your Week day-panel rows
- Where: Digest → Your Week → tap a heatmap square → scroll through the day panel.
- What happens: The floating + button sits over the right side of the day panel and its row dividers. In the dark themes it covers part of the row under it. As the user scrolls the list, each row passes under it. Digest adds bottom space (`DigestScreen.tsx:312`, `paddingBottom: bottomClearance`), so the last row can scroll clear. The overlap is on the rows in mid-list.
- Why it's a problem: Content and a floating control overlap, and a tap near a row's right edge hits the + instead. This is the same family as A-10 (the + floats above the open Contacts panel and its dim layer).
- Evidence: `05-day-detail-1007.png`, `06-day-detail-scrolled.png`, `50-galaxy-light-bottom-daydetail.png`, `54-standard-dark-bottom-daydetail.png`. Reported by the verifier, then confirmed by the finalizer from these screenshots.
- Needs investigation: The FAB is mounted app-wide (`App.tsx:440`, `UniversalFab`; see A-10). Options: keep row content clear of the FAB column inside the day panel, or shrink or hide the FAB while the list scrolls. Handle it together with A-10 in the cross-cutting pass.

---

#### Dropped
- raw C-14 (DEAD · Medium, no way to clear a birthday on Edit Contact) → moved to area E (to be rechecked there). Full entry, the verifier's corrected fix and the recheck steps are in `C-digest/moved-to-E.md`.
- Raw C-01 to C-13 → kept as final C-01 to C-13 (same numbering). C-14 is new (verifier observation, confirmed by the finalizer).

#### Routes covered
| Route / surface | Reached | How |
|---|---|---|
| `Digest` (root) | yes | Launch tab, and the Digest tab icon |
| Up Next row → `Profile` (Digest stack) | yes | tap row; Back returns (`10`, `11`) |
| Birthdays row → `Profile` | yes | after setting a birthday on Zz UX Full Profile (`32`) |
| Overlooked row → `Profile` | yes | `12`, `12b` |
| Never Contacted row → `Profile` | yes | the row is a clickable Pressable in the dump; a second profile was not opened |
| "See everyone needing attention →" → Contacts `Home` | yes | `13` |
| "+11 more →" → Contacts `Home` | yes | `18` |
| Your Week Rolling 7 Days / Calendar Week | yes | `04`, `45` |
| Heatmap day → day panel (with entries / empty "No activity on this date.") | yes | `05`, `06`, `08` |
| + button from Digest (dial; Add Contact) | yes | `38`–`40` |
| Re-tap Digest tab pops to root | yes | `37` |
| Android Back from Digest root | yes | `16` |
| Theme spot-check: Galaxy Dark, Galaxy Light, Standard Light, Standard Dark | yes | `01`/`03`, `50-*`, `53-*`, `54-*` |
| Notification "select-digest" intent → Digest | no | see below |

#### Could not check
- **Empty states** ("You're all caught up", "Nothing on the horizon", "A quiet week"): reaching them would need every contact up to date and no activity this week, which means mass edits or a clock change. The wording was read in code only (`UpNextSection.tsx:43`, `HorizonSection.tsx:69-72`, `YourWeekSection.tsx:339-342`) and reads fine.
- **Error states** ("Couldn't load your Digest", "Couldn't refresh Up Next and Horizon", "Couldn't load Your Week", day Retry): these need a failed DB read. Not reachable without changing code.
- **Weekly-digest notification tap → Digest**: this needs the scheduled notification to fire, which needs a clock change (off limits).
- **Birthday "Today" / "Tomorrow" tags**: not set up. Only the 3-days-out tag was seen.
- **Long-name truncation on Digest rows**: no long-named contact was in these Digest lists.

#### Leads (not findings, carried over from the verifier)
- Area D/E, unverified: after Save on Edit Contact, Back from the Profile showed the same Profile again (`42-where.png`). There may be a duplicate Profile entry in the stack. It may share a cause with C-02.
- Phone state: Zz UX Full Profile still has birthday 2026-10-13, set by the audit pass and not cleared (see `moved-to-E.md`).

#### Cross-area overlaps (not merged here)
C-01 ↔ B-15 (and A-09, different cause) · C-02 ↔ B-08 · C-03 ↔ A-02/A-04/A-05 · C-10 ↔ area K · C-11 ↔ A-15/A-17 · C-12 ↔ A-30/A-19 · C-14 ↔ A-10 · raw C-14 → area E.

---

## D — Profile · final findings (finalizer, 2026-10-10)

Counts: DEAD 5 (High 1, Medium 4) · INC 6 (Medium 3, Low 3) · HID 8 (Medium 6, Low 2) · COPY 10 (Medium 3, Low 7) · VIS 5 (Medium 1, Low 4) · A11Y 1 (Low 1). Total 35: High 1, Medium 17, Low 17.
Sources: findings-raw.md (35 raw), verification.md (30 confirmed, 4 recheck, 1 drop), retest-results.md (4/4 reproduced, plus 1 new observation added as D-35). All evidence paths are relative to `untracked/artifacts/ux-audit/D-profile/`. Theme during the pass: Galaxy / Dark (default). Spot-checked in Galaxy Light (114-*), Standard Dark (115-*) and Standard Light (117-*).
Renumbering: raw D-01…D-30 keep their numbers. Raw D-32→D-31, D-33→D-32, D-34→D-33, D-35→D-34. Raw D-31 was dropped. D-35 is new, from the retest.

### D-01 · DEAD · High — "pin", "unpin" and "Hide from Profile" in a Things to Remember item sheet do nothing; they just open an editor screen
- Where: Profile → Things to Remember → tap any item card (memory, key person, last-talked entry, custom field) → item sheet
- What happens: The sheet offers "edit", "pin"/"unpin" and "Hide from Profile". Tapping "unpin" on the pinned memory "Loves jazz and old vinyl" opens the full Things to Remember editor. After Back, the memory is still pinned. "Hide from Profile" does the same, and the memory is still shown. "pin" on the key person "Zz UX Sam" opens Edit contact at the top of the form, and nothing is pinned.
- Why it's a problem: The buttons name an action and silently do something else. The user thinks they pinned or hid an item, and nothing changed.
- Evidence: 28-tap-pinned-memory.png, 36-memory-sheet-before-unpin.png, 37-after-unpin-tap.png, 38-after-unpin-back.png, 39-after-hide-tap.png, 40-after-hide-back.png, 33-tap-keyperson.png, 35-after-pin-keyperson.png
- Retest: reproduced. "unpin" with touchscreen tap opened the editor, and after Back the memory was still under Pinned / Featured, "1 shown". "Hide from Profile" did the same. The second method (plain `input tap`) gave the same result. The buttons are `clickable=true`. "pin" on Sam opened Edit contact, and Sam was not pinned. Evidence: retest/R1-03-memory-sheet.png, R1-04-after-unpin-tap.png, R1-05-profile-after-unpin-back.png, R1-07-after-hide-tap.png, R1-08-profile-after-hide-back.png, R1-09-plaintap-unpin.png, R1-10-keyperson-sheet.png, R1-11-after-pin-sam.png, R1-12-profile-pinned-after-sam.png (+ .xml)
- Needs investigation: `src/screens/ContactProfileScreen.tsx:361-394` `routeKnowledgeAction` never reads `intent.action`. It only routes by `intent.target.owner`: memory→ThingsToRemember, relationship/custom-field→Edit, fuel→OffLimitsEditor, current-state→MemoryHistory. The sheet passes `{ action, target }` from `src/components/profile/ThingsToRemember.tsx:104-108`. Start by wiring pin/unpin/hide to the same services the Things to Remember editor uses. Otherwise, remove those buttons from the Profile sheet.

### D-02 · DEAD · Medium — After Save on Edit Contact, Back shows the stale Edit form again
- Where: Profile → ⋯ More actions → Edit Contact → Save changes → Back (Android Back, and the header chevron)
- What happens: Save lands on a fresh Profile. Back then shows the old Edit contact form again, scrolled where it was left. A second Back shows the Profile, and a third returns to the list. The stack is List → Profile → Edit → Profile.
- Why it's a problem: After saving, the user is sent back into the form they just finished and may think the save didn't take. Every other editor returns to the screen it came from.
- Evidence: 64-after-save.png, 65-back-after-save-1.png, 66-back-after-save-2.png, 67-back-after-save-3.png, 68-header-back-after-save-repro2.png
- Retest: reproduced. keyevent 4 after Save → the Edit form again (the dump contains "Save changes"). A second Back → Profile. The second method (Profile header Back chevron) also returned to the Edit form. Evidence: retest/R2-03-after-save.png, R2-04-after-back-1.png, R2-05-after-back-2.png, R2-06-m2-after-save.png, R2-07-m2-after-header-back.png
- Proposed fix: `src/screens/EditContactScreen.tsx:1068` calls `navigation.navigate("Profile", { contactId })`. In React Navigation 7, `navigate` pushes a new screen instead of returning to the existing one. Use `navigation.popTo("Profile", { contactId })`, or `goBack()` when the previous route is that contact's Profile. Afterwards, Save → Back goes straight to the screen before the Profile.

### D-03 · INC · Medium — Identical pencil icons and item "edit" buttons go to different places, never to the item itself
- Where: Profile → Things to Remember subsection pencils, and item sheet → "edit"
- What happens: The Pinned / Featured, Memories and Imported pencils, and memory "edit", open the general Things to Remember editor at the top. The Key People and Custom Fields pencils, and key-person/custom-field "edit", open Edit contact at the Identity section, far from the field. Last Talked About and Current Location open a value-history screen ("Set new value"). None of them opens the tapped item. (Off Limits opening the old Fuel editor is known item 999.3 and is not reported here.)
- Why it's a problem: The same icon means different things in sibling cards. After "edit" on one memory, the user has to find that memory again in a long list.
- Evidence: 29-memory-edit.png, 30-pencil-pinned.png, 31-pencil-lasttalked.png, 34-keyperson-edit.png, 53-pencil-imported.png, 54-pencil-customfields.png, 55-pencil-memories.png, 56-pencil-keypeople.png, 57-pencil-currentlocation.png
- Needs investigation: `src/screens/ContactProfileScreen.tsx:338-394` (`routeKnowledgeChild` and `routeKnowledgeAction`) passes only `contactId`. Check whether ThingsToRemember / Edit can accept a target section or item id to scroll to and open.

### D-04 · DEAD · Medium — "Show hidden" in Memories leaves the Profile, then flips to "Hide hidden" while still showing nothing hidden
- Where: Profile → Things to Remember → Memories → "Show hidden"
- What happens: The tap opens the Things to Remember editor with its own "Show hidden items" switch OFF. Back on the Profile, the button now reads "Hide hidden", but the hidden memory is still not shown. Tapping again navigates away again and flips the label back.
- Why it's a problem: The button's label and the Profile's state disagree, and the button never shows hidden items on the Profile. "Hide hidden" is also awkward wording.
- Evidence: 41-show-hidden.png (+ .xml: switch checked=false), 42-after-show-hidden-back.png
- Retest: reproduced. A touchscreen tap opened the editor with the switch checked=false. After Back, the card still read "2 shown" with no hidden memory, and the label was "Hide hidden". The second method (plain `input tap`) gave the same editor with the switch off, and after Back the label flipped back to "Show hidden". Evidence: retest/R3-01-memories-card.png, R3-02-after-show-hidden.png (+ .xml), R3-03-after-back.png, R3-04-plaintap-hide-hidden.png, R3-05-after-back-2.png
- Proposed fix: `src/components/profile/ThingsToRemember.tsx:263-273` both toggles the local `showingHidden` and calls `onViewAll`, and the Profile's handler (`onKnowledgeViewAll={(intent) => routeKnowledgeChild(intent.id)}` in `ContactProfileScreen.tsx`) drops `includeHidden`. Either reveal the hidden items inline without navigating, or keep the label fixed ("Show hidden items…") and open the editor with its hidden switch on. Afterwards the label matches what the user sees.

### D-05 · INC · Medium — Two different Snooze sheets on the same Profile
- Where: Profile → Relationship Overview → Snooze card; and Profile → ⋯ → Snooze
- What happens: The card opens a "Snooze" sheet: left-aligned 3 days / 1 week / 1 month / Choose date, plus Close. The menu opens a "Snooze reminders" sheet: centred 3 days / 1 week / 1 month, with no custom date and no Close. Unsnooze from the menu happens silently, with no confirmation message. On the Contacts tab, single-contact snooze is a third version, a plain Android dialog (A-14).
- Why it's a problem: The same action looks and behaves differently depending on which button was used, and the custom date exists only on one path.
- Evidence: 06-tap-snooze-card.png, 12-more-snooze.png, 07-after-snooze-1week.png, 10-after-unsnooze.png
- Proposed fix: `src/screens/ContactProfileScreen.tsx:793-812` hard-codes the menu's own sheet (heading at :800). Make the menu's "snooze" entry open the same sheet the card uses (`src/profile/relationship-sheet-model.ts` ~:95-122). Afterwards both entries show one sheet with Choose date and Close.

### D-06 · DEAD · Medium — An archived contact's Profile has no Restore, still offers Archive (which errors), Snooze and Unbind, and lets you favourite it
- Where: Contacts ⋯ → Archived Contacts → open Zz UX Full Profile (also via Settings → Contacts & Relationships → Archived contacts)
- What happens: There is no "Archived" banner and no Restore button. The only clue is "Archived contacts can't be messaged." under Message. ⋯ More shows Edit / Snooze / Unbind / Archive / Profile Layout / Background / Reset. Archive shows the Android alert "Couldn't archive. Please try again.", and after OK the menu stays open. The star turns the archived contact into a favourite.
- Why it's a problem: An Unbound Profile gets a clear banner with "Bind contact", but an Archived one gives no way back from the Profile. The error message asks the user to retry something that can never work.
- Evidence: 71-archived-profile.png, 72-archived-more-menu.png, 73-archived-tap-star.png, 74-archived-archive-again.png, 103-settings-hosted-profile.png
- Retest: reproduced from both routes. Contacts route: retest/R4-02-archived-list.png, R4-03-archived-profile-top.png, R4-04-archived-more-menu.png, R4-05-archive-again-alert.png. The star flips the content-desc to "Remove … from Favorites" (R4-06-after-star-tap.xml, R4-07-after-unstar.png). Settings route: R4-08-m2-settings-archived-list.png, R4-09-m2-archived-profile-top.png (0 "restore" strings in the dump), R4-10-m2-archived-more-menu.png.
- Proposed fix: `src/screens/contact-profile-logic.ts:264-281` `profileOverflowEntries` has no `archived` input. Add one: show "Restore" in place of "Archive", and drop Snooze/Unbind when archived. Add an "Archived" banner with Restore next to the Unbound banner (`ContactProfileScreen.tsx:614`). Disable the favourite toggle when archived (`:398`, `:554`). Both check only `lifecycle.kind`, and an archived contact is still "bound". `archiveContact` matches `archived_at IS NULL`, so it throws on an already archived contact. Afterwards the user can restore from the Profile and never sees the error.

### D-07 · HID · Medium — Archive from Profile drops you on the list with no message and no undo; the person just vanishes
- Where: Profile → ⋯ → Archive
- What happens: The Profile closes immediately. There is no snackbar, no "Archived" message and no Undo. The list the user came from now says No matches for "Zz UX". (The missing confirmation is known item N-10 and is not reported here. This finding is about the missing feedback and undo after the action.)
- Why it's a problem: Logging an interaction offers Undo (the area F snackbar), but this much bigger action gives no feedback and no undo.
- Evidence: 69-after-archive.png; retest/R4-00-after-archive.png
- Needs investigation: `src/screens/ContactProfileScreen.tsx:440-449` (`archive` → `navigation.goBack()` with no snackbar). Consider the same snackbar-with-Undo pattern the post-log snackbar uses.

### D-08 · COPY · Medium — "Call unavailable. Add a phone number" on a contact that has a phone number
- Where: Profile header (Zz UX Full Profile, number 555-0101) and the Contact Methods section
- What happens: The header says "Add a phone number to call this contact." Contact Methods shows the number with "This number can't be used for calls or messages yet." and greyed-out Call/Message. The header Message button still works and opens Compose.
- Why it's a problem: The header message is false and contradicts the section below it. The user is told to add something that is already there, with no hint of what is wrong with it.
- Evidence: 01-profile-top.png, 58-contact-methods.png (+ .xml: Call/Message enabled=false)
- Proposed fix: `src/profile/relationship-sheet-model.ts:241-247` returns "Add a phone number to call this contact." whenever no dialable phone exists. When a phone exists but can't be used, return something like "This number can't be dialled. Edit it to include the full number." Afterwards the header matches Contact Methods.

### D-09 · COPY · Medium — Unbound Profile says "Not tracked. Set a contact frequency" while showing a frequency
- Where: Profile → ⋯ → Unbind contact → Relationship Overview
- What happens: Orbit Status reads "Not tracked / Set a contact frequency to see Orbit Status." The Contact Frequency card on the same screen reads "Every 30 days · Inactive while Unbound".
- Why it's a problem: The advice is wrong; the real reason is that the contact is Unbound. The known Phase 39 item covers "Not tracked" on a tracked person with no contact yet. The new detail here is an Unbound contact that has a saved frequency and history.
- Evidence: 15-profile-unbound.png (+ .xml), 17-unbound-overview.png
- Needs investigation: `src/services/profile-metrics.ts:154-167` uses one message for Unbound, no frequency, and no last contact. Fix it together with the known item: one reason message per branch, e.g. "Unbound — bind to track."

### D-10 · INC · Medium — Three different contact-frequency choosers, and the card and sheet use different words
- Where: Profile Overview → Contact Frequency card sheet; Unbound Profile banner; Contacts bulk "Change Contact Frequency" (A-12)
- What happens: The card sheet lists named presets (Daily…Yearly) with no custom option. The Unbound banner shows the same presets as chips plus "Custom…". Bulk asks for raw days. The card reads "Every 30 days", while its sheet calls the same value "Monthly". Choosing a preset applies at once with no confirmation.
- Why it's a problem: The same setting is edited three ways, and the custom interval can only be reached while Unbound.
- Evidence: 24-tap-frequency.png, 25-frequency-sheet-end.png, 26-after-quarterly.png, 100-unbound-banner.png
- Needs investigation: unify on one chooser component. The Unbound banner chips with "Custom…" are the most complete.

### D-11 · HID · Medium — Saving a profile layout collapses every section, and the editor's "Collapsed by default" contradicts what the Profile shows
- Where: Profile → ⋯ → Profile Layout → Edit layout → hide Gravity → Save layout
- What happens: The editor said "Collapsed by default" for both Relationship Overview and Things to Remember, although Things to Remember was open on the Profile. After saving with only Gravity hidden, Things to Remember and History were collapsed too. "Collapsed by default" is a state label drawn as a link-style button, next to action buttons such as "Use compact size", so it reads like a command.
- Why it's a problem: One small change rearranged the whole Profile, and the editor misreports the current state.
- Evidence: 76-profile-layout.png, 77-edit-layout.png, 78-edit-layout-scrolled.png, 79-gravity-hidden.png, 80-after-save-layout.png, 81-overview-gravity-hidden.png
- Needs investigation: `src/components/profile/ProfileLayoutEditor.tsx:141-151` (expanded label/button), and how the saved layout's `expanded` flags replace each contact's own collapse state.

### D-12 · COPY · Medium — Developer terms in Profile Layout, Background and Reset
- Where: ⋯ → Profile Layout / Edit layout / Layout templates / Background / Reset
- What happens: "Zz UX Full Profile currently uses factory.", "Every section stays in its parent.", "Profile section" / "Child module" under every row, "2 assignments · 0 global · 0 Category · 2 contact", "Background assignment", "Clear an assignment to use the next available Category, global, or active theme background", "Inherit Category, global, or theme background for …", "Background templates are separate from layout templates.", "Reset Profile presentation? … layout, collapse, and background overrides." The ⋯ menu item is just "Reset", which doesn't say what it resets.
- Why it's a problem: The text explains how settings are stored instead of what the user will see. B-10 found the same kind of terms on Events.
- Evidence: 76-profile-layout.png, 77-edit-layout.png, 78-edit-layout-scrolled.png, 91-layout-templates.png, 83-background.png, 84-after-assign-bg.png, 87-reset-dialog.png, 09-more-menu-snoozed.png
- Needs investigation: copy pass over `src/components/profile/ProfileLayoutEditor.tsx` (e.g. :113-117, :417), the template manager and the background sheet. Rename the menu item "Reset" to e.g. "Reset look".

### D-13 · HID · Medium — The Background sheet, opened from one person, puts app-wide actions first and gives no scope warning
- Where: Profile → ⋯ → Background
- What happens: "Clear global background" and "Clear category background" sit at the top, styled like the per-contact choice. After picking a template, "Set as global default" comes before "Use for Zz UX Full Profile". "Delete" (deletes the template) looks the same as "Assign". Templates are named after other people ("Andrew Wales's background"). (The sheet's top-right "Back" button is reported in D-32.)
- Why it's a problem: The user is editing one Profile, and the first and most prominent buttons affect every contact.
- Evidence: 83-background.png, 84-after-assign-bg.png, 85-after-use-bg.png
- Needs investigation: put per-contact actions first; style Delete as destructive and ask for confirmation; label the global/category actions with how far they reach.

### D-14 · VIS · Medium — A photo background makes Profile text hard to read
- Where: Profile with a contact background assigned (tested: Andrew Wales's background on Zz UX Full Profile, Galaxy Dark)
- What happens: The grey helper text ("Add a phone number to call this contact."), the disabled Call button and the light captions on the Overview cards ("0 of 30 days…", "Intensity") are nearly lost against the photo. The disabled Call button has almost no outline.
- Why it's a problem: The contrast is too low to read comfortably.
- Evidence: 86-profile-with-bg.png
- Needs investigation: add a scrim behind header and card text when a photo background is active.

### D-15 · COPY · Low — Item sheet buttons are lowercase ("edit", "pin", "unpin") next to "Hide from Profile", and the sheet closes with "Done" while sibling sheets say "Close"
- Where: Profile → Things to Remember → any item card
- What happens: The buttons read "edit" and "pin" / "unpin" in lower case, then "Hide from Profile", then "Done". The Overview sheets (Orbit Status, Gravity, Intensity, Snooze, Frequency) all end with "Close". The sheet's own invalid-value hint says "Tap Edit to fix it", capitalised, while the button reads "edit".
- Evidence: 28-tap-pinned-memory.png, 33-tap-keyperson.png, 19-tap-orbit-status.png; retest/R1-03-memory-sheet.png
- Proposed fix: `src/components/profile/ThingsToRemember.tsx:105` and `:134` print the raw action id (`label={action === "hide" ? "Hide from Profile" : action}`), and "Done" is at :112. Map each id to a label ("Edit", "Pin", "Unpin", "Hide from Profile"), and pick one close word for all Profile sheets. Afterwards all buttons are title case.

### D-16 · HID · Low — Section chevrons point down whether the section is open or closed
- Where: Profile → every section and subsection header
- What happens: "Relationship Overview" (collapsed) and "Things to Remember" (expanded) show the same down-chevron. So do the collapsed "Off Limits" and the expanded "Imported from Contacts App". Only the screen-reader label changes between Expand and Collapse.
- Why it's a problem: The user can't tell at a glance which sections are closed.
- Evidence: 01-profile-top.png, 38-after-unpin-back.png, 51-offlimits-collapsed.png, 80-after-save-layout.png
- Needs investigation: `src/components/profile/ProfileModuleHost.tsx:119-122` always uses `chevron-down` and changes only its colour state. Rotate the chevron, or switch to chevron-up when expanded.

### D-17 · VIS · Low — Content scrolls visibly behind the translucent header, and the header never shows who you're looking at
- Where: Profile, any scroll position
- What happens: Scrolled text such as section titles, "Work" and "1 shown" shows through the header behind the Back chevron, star and ⋯, in all four theme/mode combinations. Once the big name scrolls off, nothing on screen names the contact.
- Evidence: 02-scroll-1.png, 02-scroll-5.png, 38-after-unpin-back.png, 42-after-show-hidden-back.png, 47-offlimits-fab-overlap.png, 51-offlimits-collapsed.png, 114-galaxy-light-b-overview.png, 117-standard-light-real-b-overview.png
- Needs investigation: the header already has a token scrim (`PROFILE_APP_BAR_SCRIM_OPACITY`). Raise its opacity or blur it, and fade in the contact name after the hero scrolls away.

### D-18 · VIS · Low — The + button covers the "Imported from Contacts App" edit pencil and the current heatmap square (instance of the cross-area + overlap, A-10 / C-14)
- Where: Profile scrolled so Imported from Contacts App sits at the bottom; History heatmap
- What happens: Mid-scroll, the pencil at [1112,2587][1266,2741] sits under the + button at [1174,2613][1370,2809]. The current-cycle heatmap square is half covered.
- Why it's a problem: This is the same + button overlap pattern as A-10 and C-14. Report and fix it with that pattern.
- Evidence: 47-offlimits-fab-overlap.png (+ .xml), 51-offlimits-collapsed.png, 58-contact-methods.png
- Needs investigation: as part of the cross-area + overlap. The Profile already has bottom clearance (`useBottomClearance` in `ContactProfileScreen.tsx`), so the overlap only happens mid-scroll. Adding a bottom inset is not the fix.

### D-19 · COPY · Low — Relationship Overview repeats itself and uses unexplained numbers
- Where: Profile → Relationship Overview cards and their sheets
- What happens: "Last Interaction / Last interaction Oct 10, 2026, 2:05 AM" repeats the label. Other text: "0 of 30 days since the last interaction.", "Elapsed progress: 0%", and on the Gravity sheet "Tier 2 of 4". Gravity says "4 interactions" while Intensity says "2 qualifying interactions" and "2× this period vs 30-day contact frequency". The Intensity subtitle "30 days" changes to "This month" when Unbound. The Things to Remember editor shows "building" in lower case and "Intensity (closeness)". None of these sheets explains what Stable, Building or Active mean. (Gravity/Intensity terms were also flagged on Events, B-10.)
- Evidence: 04-overview-cards.png, 05-overview-cards2.png, 19-tap-orbit-status.png, 21-tap-gravity.png, 22-tap-intensity.png, 15-profile-unbound.png, 29-memory-edit.png
- Needs investigation: the copy in `src/components/profile/RelationshipOverview.tsx` and `src/services/profile-metrics.ts`. Let each sheet explain its term in a sentence instead of repeating the card.

### D-20 · VIS · Low — The Overview grid leaves an empty half-width gap beside Contact Frequency and Snooze
- Where: Profile → Relationship Overview (default layout)
- What happens: Contact Frequency and Snooze are half-width cards stacked one under the other. The right half of each row is empty, so "Contact Frequency / Every 30 days" wraps onto 4 lines.
- Evidence: 05-overview-cards2.png, 114-galaxy-light-b-overview.png
- Needs investigation: place compact cards side by side in the overview grid, or make them wide by default.

### D-21 · COPY · Low — Raw numeric dates on the Profile
- Where: Snooze card, Custom Fields, Things to Remember editor
- What happens: The Profile shows "Snoozed until 2026-10-17", "Zz UX Anniversary 2015-06-20", and the Birthday as "2026-10-13". Everywhere else on the Profile, dates read like "Oct 9, 2026, 10:59 PM". This is the same pattern as C-06.
- Evidence: 07-after-snooze-1week.png (+ .xml), 02-scroll-3.png, 47-offlimits-fab-overlap.png, 29-memory-edit.png
- Proposed fix: `src/profile/knowledge-presentation.ts:265` returns the raw value for `case "date"`, and the snooze card's "Snoozed until" text is built at `src/components/profile/RelationshipOverview.tsx:97`. Format both with the app's local date formatter. Afterwards dates read "Oct 17, 2026".

### D-22 · COPY · Low — Empty values say "Not available yet", and an empty Profile is a wall of placeholders with no Add actions
- Where: Profile of a contact with little data (Joyce Milligan), and Pet photo on Zz UX Full Profile
- What happens: Every empty custom field reads "Not available yet", which suggests the app is still loading. Seven Things to Remember cards say "Nothing added yet" with no Add button, only the small pencil. The History empty state does have a "Log interaction" button.
- Why it's a problem: Empty states on the same screen behave differently, and a mostly empty Profile is a long scroll of nothing.
- Evidence: 95-joyce-empty-wall.png, 94-joyce-empty-states.png, 96-joyce-history.png, 45-tap-petphoto.png
- Proposed fix: `src/profile/knowledge-presentation.ts:260` returns "Not available yet". Change it to "Not set", and add an "Add…" action to empty Things to Remember cards. Afterwards empty fields read as empty, and each card offers a way to fill it.

### D-23 · HID · Medium — A Link memory shows only the word "Link"; the URL can't be seen or opened from the Profile
- Where: Profile → Memories → "Coffee order / Oat flat white / Link" → tap
- What happens: Neither the card nor its sheet shows the URL (https://example.com/cafe) or offers a way to open it.
- Evidence: 02-scroll-2.png, 44-tap-link-memory.png
- Needs investigation: `src/profile/knowledge-presentation.ts:149` puts the literal word "Link" in the metadata and never the URL. The sheet is the DetailSheet in `src/components/profile/ThingsToRemember.tsx:64-115`. Show the URL and add an Open button.

### D-24 · HID · Medium — Birthday appears nowhere on the Profile
- Where: Zz UX Full Profile (birthday set)
- What happens: Scrolling the whole Profile shows no birthday (no "Birthday" in any 02-scroll-*.xml). It appears only in the Things to Remember editor ("Featured & current / Birthday") and in Edit contact.
- Why it's a problem: Birthdays are a headline fact for a relationship app, and Digest has a birthday section.
- Evidence: 02-scroll-1…6.png (+ .xml; no birthday), 29-memory-edit.png (Birthday shown), 62-edit-from-menu.png
- Needs investigation: the Featured child in `src/profile/knowledge-presentation.ts:365-374` holds only memories and relationships. Add birthday there or to the Profile header.

### D-25 · INC · Low — The ⋯ menu stresses Unbind (red, warning icon) but not Archive; the sheet is mostly empty with no Close; collapsing a section silently adds "Reset"
- Where: Profile → ⋯ More actions ("Profile actions")
- What happens: "Unbind contact" is a filled red button with a ⚠ icon. "Archive" removes the person from every list with no confirmation, yet is a plain outline button. The sheet is full height, with the bottom ~45% empty and no Close, unlike the Snooze card sheet. Its title "Profile actions" differs from the button's label "More actions". "Reset" appears only when the contact has a presentation override, and simply collapsing a section counts as one, so "Reset" shows up with no visible reason.
- Evidence: 09-more-menu-snoozed.png, 11-more-menu.png
- Needs investigation: `src/screens/ContactProfileScreen.tsx:784-788` (`role={entry === "unbind" ? "destructive" : "secondary"}`), the `variant="expanded"` sheet at :690, and `hasContactPresentationOverride` (which counts collapse state).

### D-26 · INC · Low — Profile confirmations use unthemed Android dialogs with different button layouts
- Where: ⋯ → Unbind contact; ⋯ → Reset
- What happens: Unbind shows a grey system dialog with teal capitals, stacked, with the destructive "UNBIND CONTACT" above "KEEP CONTACT BOUND". Reset shows a system dialog with "CANCEL RESET" side by side. Neither uses the app theme or a red destructive colour. Same pattern as B-18 and B-19.
- Evidence: 13-unbind-confirm.png, 87-reset-dialog.png
- Needs investigation: replace `Alert.alert` at `src/screens/ContactProfileScreen.tsx:739` and `:762` with the app's themed confirm sheet.

### D-27 · HID · Low — After Unbind the menu stays open with no Bind option; Snooze is still offered for Unbound contacts
- Where: ⋯ → Unbind contact → UNBIND CONTACT
- What happens: The Profile actions sheet stays on screen after unbinding. It now lists Edit / Snooze / Archive and no "Bind"; Bind is only in the Profile banner. Unbound contacts get no reminders, yet Snooze (of reminders) is still offered.
- Evidence: 14-after-unbind.png, 101-unbound-more.png
- Needs investigation: the unbind path (`src/screens/ContactProfileScreen.tsx:743-745`) never calls `closeOverlay`. `profileOverflowEntries` (`src/screens/contact-profile-logic.ts:271-274`) always includes snooze; it could offer "Bind contact" and drop snooze when the contact isn't bound.

### D-28 · VIS · Low — The favourite star on Unbound contacts is disabled but looks enabled
- Where: Unbound contact Profile (History Unbound) → star
- What happens: The star looks the same as on any Profile. Tapping it does nothing (dump: enabled=false, "Add History Unbound to Favorites"), and no message appears.
- Evidence: 98-unbound-profile.png, 99-unbound-tap-star.png (+ .xml)
- Needs investigation: dim the star when `favouriteDisabled` (`src/screens/ContactProfileScreen.tsx:554`), or explain on tap ("Bind to favourite").

### D-29 · HID · Medium — The Profile has no Log button, and + → Log Interaction from a Profile doesn't say who it's for
- Where: Profile (e.g. Digest → Orla Finch) → + → Log Interaction
- What happens: The Profile header offers Message and Call but no Log. Logging from a Profile needs the + menu or the History empty state. The Log Interaction screen that opens never shows the contact's name. (Back from there landing on the Contacts tab is C-02 and is not reported here.)
- Why it's a problem: The user can't confirm who they are logging for, and the most common action for a person is missing from that person's Profile.
- Evidence: 107-fab-on-profile.png, 108-fab-log-from-profile.png, 123-fab-log-from-digest-profile.png
- Needs investigation: show the contact name on Log Interaction (area F), and consider a Log button beside Message/Call. Navigation context: `src/components/universal-fab-logic.ts:196-205` always targets `tab: "DashboardTab"` (relevant to C-02).

### D-30 · A11Y · Low — Things to Remember cards are announced by type, not content; mixed Favorite/Favourite
- Where: Profile → Things to Remember (uiautomator dump)
- What happens: Cards are labelled "Memory", "Off Limits", "Most Recent", "Coffee order", "Imported note", without their text. Two Off Limits cards are both just "Off Limits", and two cards are both "Most Recent". The header star says "Add … to Favorites" (US spelling), while the list says "Not favourite" (A-15).
- Evidence: 02-scroll-2.xml, 02-scroll-4.xml, 01-profile-top.xml
- Proposed fix: `src/components/profile/ThingsToRemember.tsx:131` sets `accessibilityLabel={item.title…}`. Append `item.preview`. Afterwards a screen reader hears "Off Limits, Politics at family dinners".

### D-31 · COPY · Low — Casing differs between the Profile and the screens it opens
- Where: Profile vs its editors
- What happens: "Edit Contact" (menu) vs "Edit contact" (screen title). "Last Talked About" / "Current Location" / "MOST RECENT" (Profile) vs "Last talked about" / "Current location" / "most recent" (editor). "Snooze" vs "Snooze reminders". "Contact Frequency / Every 30 days" vs "30 days" in the Things to Remember editor.
- Evidence: 09-more-menu-snoozed.png, 11-more-menu.png, 62-edit-from-menu.png, 65-back-after-save-1.png, 02-scroll-1.png, 31-pencil-lasttalked.png, 38-after-unpin-back.png, 29-memory-edit.png

### D-32 · INC · Low — Five different Back styles across the Profile and the screens and sheets it opens
- Where: Profile and destinations
- What happens: The Profile uses a chevron icon. Things to Remember uses a bordered "Back" button above the title. Last talked about and Edit contact use a bordered "Back" inline with the title. Log Interaction uses plain "Back" text. The Background sheet has a "Back" button in its top-right corner, while every other sheet uses Close or Done at the bottom. Same issue as B-03.
- Evidence: 01-profile-top.png, 29-memory-edit.png, 37-after-unpin-tap.png, 31-pencil-lasttalked.png, 62-edit-from-menu.png, 108-fab-log-from-profile.png, 83-background.png

### D-33 · COPY · Low — The custom snooze date flow uses an unthemed picker and leaves an ambiguous "Cancel snooze"
- Where: Snooze card → Choose date
- What happens: An unthemed Android date picker opens on today, which would be a zero-length snooze. After Cancel, the sheet gains a disabled "Set snooze" and a "Cancel snooze" below the fold, and Close is no longer visible. "Cancel snooze" could mean cancel this choice or unsnooze. The preset buttons apply instantly, but a custom date needs an extra confirm.
- Evidence: 119-snooze-choose-date.png, 120-snooze-sheet-after-cancel.png

### D-34 · COPY · Low — Things to Remember counts and labels are inconsistent and repetitive
- Where: Profile → Things to Remember
- What happens: Count lines say "1 shown", "2 shown", "6 fields" and "2 saved" for the same idea. Each Off Limits entry repeats the label "Off Limits" inside the Off Limits card. The pinned memory card says "Memory … Pinned" inside the "Pinned / Featured" card. "Imported from Contacts App" wraps onto two lines and is the only subsection collapsed by default.
- Evidence: 02-scroll-1.png, 02-scroll-3.png, 02-scroll-5.png, 38-after-unpin-back.png, 42-after-show-hidden-back.png, 47-offlimits-fab-overlap.png

### D-35 · DEAD · Medium — After a restore from Settings → Archived contacts, the Archived screen in the Contacts tab still lists the contact (seen once, not retested; cross-reference area H)
- Where: Contacts ⋯ → Archived Contacts (left open in the Contacts tab stack) → restore the same contact from Settings → Contacts & Relationships → Archived contacts → go back to the Contacts tab and Back into the Archived screen
- What happens: The Settings-hosted list correctly drops to "1 archived contact". The Archived screen still in the Contacts tab stack shows "2 archived contacts", with Zz UX Full Profile still listed and its Restore and Delete permanently buttons live, even though the contact is already restored. The Profile above it in the same stack had refreshed (Message enabled). Nothing was tapped on the stale list.
- Why it's a problem: The restore looks as if it didn't happen. The stale row still offers "Delete permanently" on a contact that is now active. Area H (lifecycle) owns Archive/Restore and should check this with its other list-refresh items.
- Evidence: retest/R4-11-after-restore.png (+ .xml: "1 archived contact"), retest/R4-13-stale-archived-list-in-contacts-stack.png (+ .xml: "2 archived contacts", "Zz UX Fu…" with Restore / Delete permanently)
- Proposed fix: `src/screens/ArchivedContactsScreen.tsx:121-123` loads the list only on mount (`useEffect(() => { void load(); }, [load])`). Reload on focus with `useFocusEffect(useCallback(() => { void load(); }, [load]))`. Afterwards, returning to the Archived screen always shows the current archived set.

#### Dropped
- D-31 (raw) — The verifier found the dumps correct: 78 `Show Gravity` checked=true while shown, 79 checked=false after hiding. Misread by the auditor. Not visible in the evidence.
- D-03 (part) — Off Limits pencil → old Fuel editor is known item 999.3. Removed from D-03.
- D-07 (part) — No confirmation on Archive is known item N-10. Only the missing feedback and undo is kept.
- D-09 (part) — "Not tracked" on a tracked person with no contact yet is a known Phase 39 item. Only the Unbound-with-frequency case is kept.
- D-13 (part) — The Background sheet's top-right "Back" was merged into D-32 (raw D-33).
- D-18 (part) — Proposed fix "add a bottom inset" removed: the Profile already has bottom clearance. Kept as an instance of the cross-area + overlap (A-10 / C-14).
- D-25 (part) — "Reset listed when nothing customised" was not accurate. Rephrased: collapsing a section counts as a customisation and silently adds Reset.
- D-29 (part) — Back from + → Log Interaction landing on the Contacts tab is C-02. Removed.

#### Routes covered
- Profile from Contacts list (search result) → yes
- Profile from Digest (Up Next row) → yes (105)
- Profile from Unbound Contacts → yes (98)
- Profile from Contacts ⋯ → Archived Contacts → yes (71; retest R4-03)
- Profile from Settings → Contacts & Relationships → Archived contacts (Settings-hosted) → yes (103; retest R4-09)
- Profile from event participant → not driven (area B covered it; same screen)
- Profile from Orrery / widget / notification → out of scope / not driven
- Profile → Message → Compose → yes (59; backed out, nothing sent)
- Profile → Call → disabled on all synthetic contacts; enabled on Joyce Milligan (real-looking number), not pressed per the brief
- Profile → Edit (⋯ Edit Contact, Key People/Custom Fields pencils, item "edit") → yes
- Profile → ThingsToRemember (pencils, item edit/pin/unpin/hide, Show hidden) → yes
- Profile → MemoryHistory (Last Talked About, Current Location pencils) → yes
- Profile → OffLimitsEditor → yes (known 999.3)
- Profile → History (View history, Last Interaction card) → yes; deep audit in area F
- Profile → LogContact via + → yes (108, 123)
- Photo overlay → yes (93); Back closes it
- More actions: Edit, Snooze, Unsnooze, Unbind (+ confirm, Bind back), Archive (+ restore via the Archived list), Profile Layout (Edit layout, Save layout, Layout templates), Background (Assign → Use for contact), Save Current Layout as Template (seen in menu), Reset (+ confirm) → all opened
- Overview card sheets: Orbit Status (+ View history), Gravity, Intensity, Last Interaction (jumps to History), Contact Frequency (changed and restored), Snooze (preset, Choose date) → yes
- Collapsed/expanded behaviour of sections and subsections → yes
- Theme spot-check (Galaxy Dark default, Galaxy Light, Standard Dark, Standard Light): Profile top, Overview, Things to Remember → yes (114-*, 115-*, 117-*)

#### Could not check
- "Clear global background" / "Clear category background": not pressed. They change shared app-wide state, and the original global assignment couldn't be reliably restored.
- Background "Choose photo", template Save / Rename / Delete / Preview / Usage: not pressed. The template sheet was only browsed (91).
- Drag handles in Edit layout: reordering by gesture not tried; Move up/down seen only.
- Call / Message / Email on a real-looking number: not pressed (synthetic-only rule).
- Collapse-state persistence across an app relaunch: not tested.
- D-35 was seen once during retest cleanup and not repeated.

---

## Area E — Add, Edit and Update Contact — final findings

Final verified findings (finalizer, no device). Sources: `findings-raw.md` (audit), `verification.md` (verifier), `recheck-list.md`, `retest-results.md` (retest, device). Device: Pixel 6 Pro, debug build, Galaxy / Dark (default theme). All evidence paths are relative to `untracked/artifacts/ux-audit/E-add-edit-update/` unless prefixed. Retest evidence is in `retest/`.

**Counts: 29 findings.**
- **By code:** DEAD 3 · INC 9 · HID 7 · VIS 5 · COPY 3 · LEFT 1 · A11Y 1.
- **By severity:** High 1 · Medium 14 · Low 14.

Physical confirmation:
- E-01 and E-02 were rechecked and reproduced on the retest.
- E-03 was already retest-confirmed by the orchestrator.
- All other findings are confirmed against their screenshots, dumps and code. Nothing was dropped.

> PRIVACY: `69-*.png`, `70-*.png` and `71-*.png` show the owner's personal photos. Do not open, cite or copy them. The CropPhoto route is evidenced by `71-crop-screen.xml` only, as text.

### E-01 · DEAD · High — Add Contact throws away everything you typed on Back, with no warning
- Where: + → Add Contact (route `Create`) → fill fields → on-screen "Back" or Android Back.
- What happens:
  - **First run.** I filled in the name, Bound + Monthly, a past "Last spoke" date, a phone, an email, a long Last Talked About, a linked key person and a location. On-screen Back went straight to the Contacts list with no prompt, and everything was gone.
  - **Second run.** I typed a name and pressed Android Back. Same result.
  - **Retest.** Reproduced with both methods: Android Back (keyevent 4), and the on-screen Back (plain tap on `content-desc="Back"`). Re-opening Add Contact showed an empty Name.
- Why it's a problem: The form can hold several minutes of entry (key people, memories, Off Limits), and one stray Back loses all of it. Edit Contact asks "Discard changes?" on the same phone (`49-edit-back-discard-dialog.png`, `retest/R2-08-edit-discard-dialog.png`), so the two sibling forms disagree.
- Evidence:
  - Audit: 31-name-entered.png → 32-back-with-changes.png (list, no dialog); 33-before-android-back.xml (name present) → 34-after-android-back.png.
  - Retest: retest/R1-01-name-typed.xml → retest/R1-02-after-android-back.png/.xml → retest/R1-03-reopen-add-empty.png/.xml; retest/R1-04-name-typed-2.png/.xml → retest/R1-05-after-onscreen-back.png/.xml.
- Proposed fix: `src/screens/EditContactScreen.tsx:1103` uses `useDiscardKeepGuard({ hasUnsavedChanges, bypassRef })`, with the bypass set at :1067. `src/screens/CreateContactScreen.tsx` has no guard: a grep for `useDiscardKeepGuard|beforeRemove|BackHandler` matches nothing there.
  - Add the same hook to CreateContactScreen.
  - Make `hasUnsavedChanges` true when any field differs from its initial value: name, category, methods, drafts, last talked about, location, Bound/frequency, last spoke.
  - In `handleSave`, set `bypassRef` before `navigation.replace("Profile")` (:394).
  - Afterwards: Back with entries shows "Discard changes?", and Back on an untouched form still leaves at once.

### E-02 · DEAD · Medium — Save with an empty name does nothing: no message, no scroll (Add and Edit)
- Where:
  - Add Contact → Save contact with Name empty (also after Show More, scrolled to the bottom).
  - Edit Contact → clear Name → Save changes.
- What happens: Nothing visible happens. No error appears under Name and the page does not scroll to it. The debug build shows a LogBox "Warning: ref.measureLayout must be called with a ref to a native component".
  - The retest reproduced this on Add, on Add with Name scrolled off-screen (the view stayed put and Name never came into view), and on Edit.
  - Add's Save button looks greyed out but can still be pressed. The code comment says this is deliberate (CAPT-14). The finding stands because the "reveal" it relies on never shows anything.
- Why it's a problem: The user can't tell why Save "doesn't work", especially from the bottom of the long form. Other checks in the same form show red inline text ("Enter a whole number greater than 0.", "That date is in the future…").
- Evidence:
  - Audit: 03-save-empty-name.png, 30-save-no-name-full.png (Add, scrolled); 96-edit-save-empty-name.png, 97-edit-top-after-empty-save.png (Edit, no error by Name).
  - Retest: retest/R2-01-add-bottom-before-save.png, retest/R2-02-add-after-save-tap.png/.xml, retest/R2-03-add-long-bottom.png/.xml, retest/R2-04-add-long-after-save.png/.xml, retest/R2-05-edit-name-cleared.png/.xml, retest/R2-06-edit-bottom.png/.xml, retest/R2-07-edit-after-save.png/.xml.
- Proposed fix:
  1. **Show the error.** `collectBlockingErrors` already builds "Enter a name to save." (`src/screens/create-contact-logic.ts:152`), but nothing renders it, and `handleSave` returns silently (`src/screens/CreateContactScreen.tsx:361-364`). Render it as inline red text under the Name field, on both Add and Edit.
  2. **Fix the scroll.** `revealAndFocus` passes `findNodeHandle(scroll)` (a number) to `node.measureLayout` (`CreateContactScreen.tsx:256-262`; same at `EditContactScreen.tsx:496-503`). Pass the ScrollView's native ref instead (`scroll.getNativeScrollRef()`, available in RN 0.86.2).
  - Afterwards, Save scrolls to Name and shows the message. Non-UX twin: E-X01 in `other-findings.md`.

### E-03 · DEAD · Medium — A birthday can never be removed, and Add Contact can't set one (moved from area C, raw C-14)
- Where:
  - Profile → ⋯ → Edit Contact → Birthday (Zz UX Full Profile, 2026-10-13).
  - Add Contact → Show More.
- What happens:
  - In Edit Contact, Birthday is a box reading "2026-10-13". Tapping it opens the Android date picker with only CANCEL and OK. A long-press opens the same picker.
  - "Year unknown" only changes the display to "10-13". No Clear, Remove or "No birthday" control exists anywhere in the dump.
  - Things to Remember shows the birthday read-only.
  - Add Contact has no Birthday field, even after Show More.
  - In the same Identity section, Photo does offer "Remove photo" (`104-edit-with-photo.png`).
- Why it's a problem: A wrong birthday can be changed but never removed, so the person keeps appearing in Digest → Birthdays and in birthday reminders. Someone creating a contact also has to save it, then open Edit, to add a birthday.
- Evidence:
  - Area C: `C-digest/25-edit.xml`, `C-digest/33-edit-bday-clear.png`, `C-digest/34-bday-picker-again.png`.
  - This pass: 51-fullprofile-edit-top.xml (no clear node), 52-bday-picker.xml (CANCEL/OK only), 53-bday-longpress.xml, 54-bday-year-unknown-on.png ("10-13"), 55-back-after-toggle-restore.png (unchanged), 56-ttr-editor-from-pinned.png (read-only), 04-show-more.xml and 19-below-methods.xml (no Birthday on Add).
  - Retest-confirmed (orchestrator): still no way to clear.
- Proposed fix: Add a tertiary "Clear" button beside Birthday when `form.birthdayInput` is set. It calls `setField("birthdayInput", null)` and `setField("birthdayYearUnknown", false)`. The field UI is at `src/screens/EditContactScreen.tsx:1267-1316`. `src/screens/edit-contact-logic.ts:191` already maps null/empty to "no birthday", so this is a UI-only change. Add the same Birthday field, with Clear, to Create (see E-04).

### E-04 · INC · Medium — Add Contact lacks many of the fields Edit Contact has, and Show More can't be collapsed
- Where: Add Contact (with Show More) compared with Edit Contact.
- What happens:
  - Add Contact has Identity (Name, Category), Relationship Basics, Contact Methods (phones, emails), Last Talked About, Key People, Current Location, Memories and Off Limits.
  - Edit Contact also has Photo, Birthday, Social battery, Rarely responds and Mute reminders (all in Identity), plus Links (in Contact Methods).
  - Add has "Last spoke", which Edit doesn't.
  - Once opened, Show More cannot be collapsed again (`CreateContactScreen.tsx:632-803` has no hide control).
  - Custom fields: Create shows a custom field only when that field's "Show on new-contact form" switch is on (`defsForCreateForm`, `src/db/field-values-dao.ts:148-150`; the switch is at `src/components/FieldDefForm.tsx:324-336`). The Zz UX fixtures only have "Always show on profile" on, so this audit did not show missing custom fields to be a defect.
- Why it's a problem: The user can't enter a photo, birthday, social battery, reminder settings or links when creating someone. They must save, find the person, and open Edit, a second form with a different layout.
- Evidence: 02-add-contact-top.png, 04-show-more.xml, 19-below-methods.xml; compare 37-edit-addtest-top.png, 38-edit-scroll.xml, 45-edit-links-addresses.xml.
- Needs investigation: compare how `src/screens/CreateContactScreen.tsx` and `src/screens/EditContactScreen.tsx` put their sections together. Decide which Edit-only fields belong on Add, and add a way to collapse Show More.

### E-05 · HID · Medium — Choosing "Bound" on Add Contact pre-selects "Custom…" with 0 days and shows a red error at once
- Where: Add Contact → Relationship Basics → Bound.
- What happens: Before the user has done anything, the Frequency chips appear with:
  - "Custom…" highlighted;
  - a value box reading "0" with a red border;
  - "Enter a whole number greater than 0." in red.
  - On Edit Contact, switching the same contact to Bound pre-selects "Monthly" with no error.
- Why it's a problem: The form scolds the user for a choice they didn't make, and the two forms disagree on the default. This is a separate defect from the known "Unbound + Today" default item: it is what happens when the user taps Bound.
- Evidence: 06-bound-selected.xml, 07-bound-frequency.png; compare 48-edit-bound.png/.xml (Monthly selected).
- Proposed fix: The cause chain:
  - `coordinateBoundToggle` keeps `intervalDays = null` when binding with no cadence (`src/screens/create-contact-logic.ts:189-197`).
  - The screen passes `value={intervalDays ?? 0}` (`src/screens/CreateContactScreen.tsx:592`).
  - `FrequencyPicker` opens custom mode for any non-preset value (`src/components/FrequencyPicker.tsx:66-71`).
  - Changing only the `value` prop would not update the `intervalDays` state. Instead, in `coordinateBoundToggle`, when binding with no cadence, seed `intervalDays: 30, intervalValid: true`. Afterwards, tapping Bound shows Monthly selected with no red text.
- Phase 39 link: **D-51** (Add Contact defaults to Bound with Monthly selected) seeds a cadence at the start, and Unbound keeps it dormant. If D-51 is implemented by seeding `intervalDays = 30`, this path can no longer be reached on Create. Fold this fix into the D-51 work, and add "Unbound → Bound shows Monthly, no error" as an acceptance check.

### E-06 · HID · Medium — Bad phone numbers and emails are accepted silently on Add; Profile then says there is no number
- Where: Add Contact → Contact Methods → phone "abc", email "notanemail" → Save.
- What happens:
  - Add shows no warning.
  - Profile says "Message unavailable. Add a phone number or email…" and "Call unavailable. Add a phone number…".
  - Only Edit Contact (and Update → Contact Method) shows "This number can't be used for calls or messages yet." and "This email address can't be used yet." under the saved values.
- Why it's a problem: The user typed a number, yet the Profile claims there is none. The warning only appears in a different form, after saving. Same root as D-08 (Profile says "Add a phone number" on a contact that has one).
- Evidence: 16-phone-letters.xml, 17-email-invalid.xml (Add, no warning); 35-save-invalid-methods.png (Profile); 43-edit-methods-after-create.xml, 44-edit-email-after-create.xml (Edit warnings); 66-update-contact-method.xml.
- Needs investigation: All three forms use the same component. `src/components/ContactMethodsEditor.tsx:172-178` shows the warning only when `row.isActionable === false`, which is set for saved rows only. Direction: work out actionability live for draft rows in the editor model, and align the Profile wording with D-08.

### E-07 · INC · Medium — "Last talked about" and "Current location" are edited two different ways
- Where: Edit Contact → Last Talked About / Current Location; Update Contact → Last talked about / Current location.
- What happens:
  - Edit shows one plain text box prefilled with the current value, which you overwrite.
  - Update shows "Most recent: …" plus an empty "Set a new value" box with Save/Cancel, and keeps a history.
  - The Profile pencils open a third screen, a value history (D-03).
  - Add has the plain box.
- Why it's a problem: The same fact has two editing models, overwrite versus add-to-history. A user can't tell whether editing in Edit Contact erases the history they see elsewhere.
- Evidence: 90-edit-ltab-and-customfields.xml (Edit: the box shows "Zz UX book club"); 59-update-last-talked.png, 62-update-current-location.xml (Update: Most recent / Set a new value); D-profile D-03 (`31-pencil-lasttalked.png`).
- Needs investigation: pick one model for current-state fields. Compare Update's focused editor in `UpdateContactScreen.tsx` with the Edit inputs at `src/screens/EditContactScreen.tsx:1531-1580`.

### E-08 · INC · Medium — Some changes save the moment you tap, inside forms that otherwise wait for Save
- Where: Edit Contact, Update Contact.
- What happens:
  - **Edit Contact → Key People → Delete:** the row vanishes with no confirm. The delete is only pending: Back → "Discard changes?" → DISCARD brings it back.
  - **Update Contact → Key people → Delete:** deleted at once, with an "Undo" snackbar (code-read).
  - **Update → Off Limits → "Remove":** deleted at once, with no confirm and no undo (code-read).
  - **Edit Contact → Photo → "Remove photo":** a system dialog warns "This deletes the photo from this device and can't be undone." The write happens immediately, outside Save changes / Discard.
- Why it's a problem: Within one Edit screen, deleting a key person can be discarded but removing a photo cannot. Across Edit and Update, the same delete behaves differently. Compare B-05 (participants save at once) and B-07.
- Evidence: 93-edit-keyperson-delete.png, 94-back-after-keyperson-delete.png, 95-keyperson-still-there.xml; 105-remove-photo.png (cancelled). Code:
  - `src/components/PhotoSourcePicker.tsx:185-206`: immediate remove; confirm at :89-104; the DAO write is `clearContactPhotoCore`.
  - Wired into Edit at `src/screens/EditContactScreen.tsx:1192-1195`.
  - `src/screens/UpdateContactScreen.tsx:355-374`: relationship delete + Undo.
  - `src/screens/UpdateContactScreen.tsx:459-464`: off-limits delete, no undo.
  - The Update deletes were code-read, not pressed, to keep area G's fixtures.
- Needs investigation: decide one rule (hold until Save, or apply at once with Undo) and apply it to photo, key people and Off Limits in both screens.

### E-09 · HID · Medium — In Update Contact, Back from a single editor leaves Update Contact and silently drops what you typed
- Where: Update Contact → Current location (or any row) → type → Android Back, or the header "Back".
- What happens: Both exit all the way to the Profile (or the list), and the typed "Zz UX unsaved town" is lost with no prompt. Only the on-screen "Cancel" returns to the Update Contact list.
- Why it's a problem: The header says "Back" but skips the screen the user came from, and loses their typing. Edit Contact guards the same situation with "Discard changes?".
- Evidence: 82-location-typed-unsaved.xml → 83-android-back-typed-subeditor.png (Profile); 84-header-back-typed-subeditor.png; 81-android-back-from-update-subeditor.png.
- Proposed fix: The focused editor is `session.activeRowKey` in the main screen (`src/screens/UpdateContactScreen.tsx:815-817`, rendered at about :957-960). While `activeRowKey !== null`, catch Android Back (`beforeRemove`/BackHandler) and the ShellAppBar back, and call `cancelRow` instead of leaving. If the editor has unsaved text, show the "Discard changes?" prompt. Afterwards, Back from a focused editor returns to the Update Contact list.

### E-10 · HID · Medium — Update Contact never says who you are updating
- Where: + → Update Contact (from a Profile, or after picking a contact).
- What happens: The header just says "Update Contact", and the rows (Last talked about, Key people…) show no current values. After picking History Long in the picker, nothing on screen names History Long.
- Why it's a problem: The picker opens this screen from anywhere, so the user can't confirm they picked the right person before changing data. D-29 notes the same gap for Log Interaction from the + button.
- Evidence: 57-update-contact-from-profile.png, 86-update-history-long.xml.
- Proposed fix: The title comes from `<ShellAppBar variant="child" title="Update Contact" />` at `src/screens/UpdateContactScreen.tsx:869` and `:957`. Show the contact's name there, or as a subtitle with the avatar, e.g. "Update Zz UX Full Profile".

### E-11 · INC · Medium — Contact frequency: Add, Edit and Update agree, but the rest of the app uses three other editors and two other words
- Where: Add / Edit Relationship Basics → Frequency; Update → Contact Frequency.
- What happens:
  - These three forms share the same chips: Daily … Yearly, plus "Custom…" with a value and Days/Weeks/Months.
  - Elsewhere in the app:
    - The Profile card sheet has presets only, with no Custom (D-10).
    - The Unbound banner has chips plus Custom (D-10).
    - Bulk "Change Contact Frequency" asks for raw days (A-12).
  - Things to Remember shows the value as "30 days" and the Profile card says "Every 30 days", where the chips say "Monthly".
- Why it's a problem: Area E's chip picker is the most complete and should be used everywhere. Users meet the same setting as words in one place and as numbers in another.
- Evidence: 08-monthly.png, 48-edit-bound.png, 67-update-frequency.xml, 56-ttr-editor-from-pinned.xml ("30 days"); cross-refs A-12, D-10.
- Needs investigation: reuse `FrequencyPicker` (as used in `CreateContactScreen.tsx:590`) in the Profile frequency sheet and the bulk sheet. Show "30 days" as "Monthly" wherever a preset matches.

### E-12 · HID · Medium — "Pick date" for Last spoke lets you choose a future date, then rejects it while "Today" stays highlighted; picked dates show as raw ISO
- Where: Add Contact → Relationship Basics → Last spoke → Pick date.
- What happens: The calendar offers every future day. Picking Oct 20 shows the red error "That date is in the future. Pick today or earlier." while "Today" stays selected. Picking a valid past date shows "2026-10-05" on the button.
- Why it's a problem: The picker allows a choice the form then refuses, and the highlighted chip contradicts the error. The raw date format matches C-06 / D-21.
- Evidence: 09-pick-date.xml (future days enabled), 11-last-spoke-future.png, 12-last-spoke-past.xml ("2026-10-05").
- Proposed fix: `src/components/TriStateLastSpoke.tsx:195-200` renders `<DateTimePicker mode="date" …>` without `maximumDate`. Add `maximumDate={new Date()}` so future days are greyed out. The label is the raw value at :128; format it with the app's display date formatter. Afterwards, future days can't be tapped and the button reads e.g. "Oct 5".

### E-13 · VIS · Medium — "Not yet" never looks selected, and selected chips use two different styles on one form
- Where: Add Contact → Relationship Basics.
- What happens:
  - With "Not yet" selected (the dump says `selected=true`), none of Today / Pick date / Not yet looks selected. "Not yet" stays grey, as if disabled.
  - Today and Bound show "selected" as a solid accent fill, while the Frequency chips show it as an accent outline.
- Why it's a problem: The user can't see their choice for Last spoke, and two selection styles side by side look like two different kinds of control.
- Phase 39 link: **D-50** makes "Not yet" the default Last spoke on Add Contact. Without this fix, every new Add form would open with no Last spoke choice visibly selected, which makes this finding more important. Fold it into the D-50 work.
- Evidence: 113-not-yet-selected.png/.xml; 07-bound-frequency.png, 08-monthly.png (fill vs outline).
- Proposed fix: `segmentColors` in `src/components/TriStateLastSpoke.tsx:103-110` always mutes "not-yet", even when it is selected. Give the selected not-yet segment the same accent fill as Today. Ideally use one selected-chip style for these segments and for the FrequencyPicker chips (outline style at `src/components/FrequencyPicker.tsx:125-131`).

### E-14 · HID · Medium — On Add Contact, a key person linked to an Orbit contact never shows which contact it's linked to
- Where:
  - Add Contact → Key People → Add key person → "Link Orbit contact (optional)" → pick History Long.
  - The link button behaves the same way in the key person editor on Edit.
- What happens:
  - The picker closes. The editor now shows "Change linked Orbit contact" and "Clear linked contact", but never "History Long".
  - After the key person is saved into the Add form, the row shows only the typed name "Zz UX Kid".
  - Saved rows on an existing contact can show "Linked to <name>". Not checked: whether the Profile shows the link after the contact is created.
- Why it's a problem: While creating a contact, the user can't confirm or later see which contact they linked.
- Evidence: 24-link-orbit-contact.xml, 25-key-person-linked.png, 26-key-person-saved.xml.
- Proposed fix:
  1. **Draft rows.** `src/screens/CreateContactScreen.tsx:153` hardcodes `linked_contact_name: null`. Fill it with the picked contact's name, so the existing `Linked to …` caption in `src/components/RelationshipEditor.tsx:115-118` appears.
  2. **Link button.** It never names the contact (`RelationshipEditor.tsx:191-197`). Show "Linked to: <name>" next to Change/Clear.
  - Afterwards, both the open editor and the draft row read "Linked to History Long".

### E-15 · COPY · Low — Key person editor: "…doesn't hide it from search or AH." and an unexplained "Use default visibility"
- Where: Add/Edit Contact → Key People → Add key person.
- What happens: The caption under "Hide from Profile" reads "Presentation only — this doesn't hide it from search or AH." "AH" looks like a typo for "AI". "Presentation only" and "Use default visibility" are developer terms, and nothing explains what "default" means.
- Evidence: 23-key-person-form.png.
- Proposed fix: In `src/components/RelationshipEditor.tsx:237`, change the text to e.g. "Only hides it on the profile. It still shows in search and AI suggestions." Relabel "Use default visibility" (:246-250) or add a one-line explanation.

### E-16 · INC · Medium — Three kinds of picker and two kinds of dialog on the same forms
- Where: Add/Edit/Update Contact.
- What happens:
  - Category, phone/email label and Social battery open grey, unthemed Android dropdowns with no mark on the current value.
  - The custom "Met via" dropdown opens a themed sheet with a check mark. In Edit it has no dropdown chevron, so it looks like a text box.
  - "Discard changes?", "Duplicate name" and "Remove photo?" are grey system dialogs with ALL-CAPS teal buttons.
- Why it's a problem: The same kind of choice looks different from field to field. Matches B-18, A-14 and D-26 elsewhere.
- Evidence: 18-phone-label-dropdown.png, 98-category-dropdown.xml, 80-met-via-options.xml, 91-edit-custom-fields.png (Met via, no chevron), 49-edit-back-discard-dialog.png, 101-duplicate-name-dialog.png, 105-remove-photo.png.
- Needs investigation: Two kinds of native control to replace:
  - The native `Picker` spinners in the contact forms (Category, Social battery).
  - The `Alert.alert` calls at `src/navigation/discard-keep-guard.ts:29`, `src/components/PhotoSourcePicker.tsx:91` and `src/screens/CreateContactScreen.tsx:100` (duplicate name).
  - Move them to the themed option sheet and `ConfirmDialog`.

### E-17 · INC · Low — Custom date fields are free-text boxes that accept anything; Birthday uses a date picker
- Where: Edit Contact → Custom Fields → Zz UX Anniversary; Update Contact → Zz UX Anniversary.
- What happens: The date field is a plain text box ("2015-06-20"). In Update I saved "June 20" with no warning, then restored the value.
- Why it's a problem: The same kind of data (a date) gets a picker for Birthday and a typing box for custom dates. Typos are saved without notice.
- Evidence: 74-update-anniversary.xml, 76-anniversary-reopen.xml ("June 20" saved), 77-anniversary-restored.xml, 91-edit-custom-fields.png.
- Needs investigation: the widget is a plain TextInput at `src/components/field-widgets/DateFieldWidget.tsx:12-40`. Reuse the Birthday picker.

### E-18 · LEFT · Low — Update Contact lists every custom field and then a "Custom Fields" row with the same fields again
- Where: + → Update Contact → bottom of the list.
- What happens: Pet photo, Zz UX Nickname, Zz UX Anniversary, Zz UX Coffee friend, Zz UX Kids count and Zz UX Met via each have their own row. A final "Custom Fields" row opens a sub-list of the same six fields.
- Evidence: 58-update-contact-bottom.xml, 78-update-custom-fields-row.xml.
- Needs investigation: the generic row that is always present comes from `buildChooserRows` (`src/screens/update-contact-chooser-logic.ts:132-150`, label at :65). Keep one of the two.

### E-19 · INC · Low — Links can be edited only in Edit Contact
- Where: Edit Contact → Contact Methods has Phone, Email and Links. Update Contact → Contact Method and Add Contact → Contact Methods have Phone and Email only.
- Evidence: 45-edit-links-addresses.xml; 66-update-contact-method.xml; 14-contact-methods-full.png, 17-email-invalid.xml.
- Needs investigation: make the shared contact-methods editor include Links in all three forms.

### E-20 · COPY · Low — Titles, casing, Save labels and Back styles differ across the three forms
- Where: + → "Add Contact" opens "New contact". The menu item "Edit Contact" opens "Edit contact". The third form is titled "Update Contact".
- What happens:
  - Update rows read "Key people", "Current location", "Memory", "Contact Method", where the Edit sections read "Key People", "Current Location", "Memories", "Contact Methods".
  - Commit buttons: "Save contact" / "Save changes" / "Save" + "Cancel" / "Done", and "Add" in the Off Limits editor.
  - Back: a bordered "Back" button (Add/Edit), plain "Back" text (Update), a chevron (Profile), and none on "Position photo".
- Evidence: 02-add-contact-top.png, 37-edit-addtest-top.png, 57-update-contact-from-profile.png, 58-update-contact-bottom.xml, 65-update-offlimits.xml, 71-crop-screen.xml (text only). Related: D-32, D-33.
- Needs investigation: a shared header/back component and a naming pass.

### E-21 · INC · Low — Update Contact's "Updated" badge shows only on the most recently edited row
- Where: Update Contact list after saving two editors.
- What happens: After I saved Last talked about, its row showed "Updated". After I saved Zz UX Anniversary, only that row showed "Updated" and the first badge was gone. Screen readers don't announce the badge as part of the row.
- Evidence: 60-update-ltab-saved.xml ("Updated" on Last talked about); 75-anniversary-invalid-save.xml (no badge on Last talked about).
- Proposed fix: The badge is shown for a single key, `session.lastSavedRowKey === row.key` (`src/screens/UpdateContactScreen.tsx` around :963). Track a set of rows saved this session instead, and add "Updated" to the row's `accessibilityLabel` (currently just `row.label`). Afterwards, every row saved this session keeps its badge, and TalkBack reads it.

### E-22 · VIS · Low — Switches that are off are nearly invisible on dark backgrounds; the custom toggle sits on the left
- Where: Edit Contact → Year unknown / Rarely responds / Mute reminders; key person → Pin / Hide from Profile; Custom Fields → Zz UX Coffee friend.
- What happens:
  - Off switches are a dark thumb on a dark track, barely visible in Galaxy Dark and Standard Dark.
  - The custom-field toggle sits on the left under its label, while every other switch is on the right beside its label.
- Evidence: 37-edit-addtest-top.png, 23-key-person-form.png, 91-edit-custom-fields.png, 110-standard-dark-edit-contact.png.
- Needs investigation: The off track is `colors.border` and the thumb is `colors.surfaceElevated` (e.g. `src/screens/EditContactScreen.tsx:1305-1306`, `src/components/RelationshipEditor.tsx:229-230`). Pick off-state tokens with real contrast in dark mode, and fix the custom-field toggle layout.

### E-23 · COPY · Low — "Orbit participation", "Bound/Unbound" and "cadence" are unexplained jargon on the forms
- Where: Add/Edit → Relationship Basics.
- What happens: These labels use developer terms:
  - the label "Orbit participation";
  - the buttons "Bound" / "Unbound";
  - the captions "…receive cadence reminders" / "…without active cadence reminders";
  - in Edit, "Attempts to reach out won't reset their orbit".
- Evidence: 05-rel-basics-open.png, 07-bound-frequency.png, 37-edit-addtest-top.png. Strings at `src/screens/CreateContactScreen.tsx:531`, `:579-581`. Related: A-19 jargon.
- Proposed fix: use plain words, e.g. "Remind me to keep in touch: Yes / No", "…you'll get reminders when it's time to reach out".

### E-24 · VIS · Low — "Add" controls look different in every section of one form
- Where: Add/Edit Contact.
- What happens:
  - "+ Add phone number" and "+ Add email address" are accent text links.
  - "Add key person" and "Add memory" are full-width filled primary buttons.
  - Off Limits has "+ Add fuel" (known item 999.3).
  - Phones start with an empty row, while emails start with "No email addresses yet".
  - The "Primary" text under a single phone looks like a disabled option.
- Evidence: 14-contact-methods-full.png, 21-ltalong-keypeople.png, 16-phone-letters.xml, 28-memories-offlimits.xml, 29-offlimits-open.xml.
- Needs investigation: one "add item" button style for list sections.

### E-25 · VIS · Low — Long "Last talked about" text is squeezed into a one-line box
- Where: Add/Edit → Last Talked About (also Current Location).
- What happens: Long text scrolls sideways on a single line, with the start cut off ("den and more things still going on and on").
- Evidence: 21-ltalong-keypeople.png.
- Proposed fix: The single-line TextInputs are at `src/screens/CreateContactScreen.tsx:640-655` and `src/screens/EditContactScreen.tsx:1537-1547`, with no `multiline`. Make them multiline inputs like the key-person Note field. Afterwards, long text wraps and stays fully visible.

### E-26 · A11Y · Low — Unlabelled or context-free controls on the forms
- Where: Add/Edit/Update.
- What happens:
  - Key-person row buttons are announced as just "Edit" and "Delete", without the person's name.
  - The Birthday button is announced as "Birthday" without its value.
  - The "Paste image URL" text box has no label (`content-desc=""`).
  - Memory rows in Update → Memory are announced as "Edit Memory memory".
- Evidence: 26-key-person-saved.xml, 51-fullprofile-edit-top.xml, 73-paste-image-url.xml, 63-update-memory.xml.
- Needs investigation: add names and values to these accessibility labels (e.g. "Edit Zz UX Kid", "Birthday, October 13").

### E-27 · HID · Low — Add Contact's duplicate-name warning offers no way to open the existing person, and nothing warns while typing
- Where: Add Contact → name "Zz UX Full Profile" → Save contact.
- What happens:
  - A system dialog says "Duplicate name — You already have a Zz UX Full Profile — save anyway?" and offers only CANCEL / SAVE ANYWAY.
  - Add Contact has no possible-match list. The only duplicate check is this dialog at save time (`src/screens/CreateContactScreen.tsx:98-110`, `:378-382`), so nothing warns while the user types an existing name.
- Why it's a problem: The user learns of the duplicate only after filling in the whole form, and can't jump to the existing person to update them instead.
- Not the known item: the known "tapping a possible match does nothing" item (Phase 39 D-06/D-75) concerns Import → Review matches (`DuplicateReviewScreen.tsx`), not Add Contact. This is a standalone finding.
- Evidence: 100-dup-name-typed.xml, 101-duplicate-name-dialog.png.
- Needs investigation: add "Open existing" to the duplicate dialog, and consider an inline "You already have …" hint under Name while typing.

### E-28 · VIS · Low — The empty "Pet photo" custom field shows a person-style initials avatar "PP"
- Where: Edit Contact → Custom Fields → Pet photo; Update → Pet photo.
- What happens: The empty photo field shows a coloured circle with the field's initials "PP", like a contact avatar.
- Evidence: 68-update-pet-photo.xml, 91-edit-custom-fields.png.
- Needs investigation: `PhotoSourcePicker` customField target. Use a neutral image placeholder.

### E-29 · INC · Low — Update Contact → Memory lists hidden memories with no "hidden" marker
- Where: + → Update Contact → Memory (opens a separate "Memory" screen).
- What happens: "Hidden note about birthday plans" is listed like any other memory, while the Things to Remember editor hides it unless "Show hidden items" is on (setup report). The screen title also changes from "Update Contact" to "Memory".
- Evidence: 63-update-memory.xml.
- Needs investigation: list filter and badges in `src/screens/MemoryScreen.tsx`.

#### Known items seen again (new detail only)
- **999.3:** Add Contact → Off Limits still says "No fuel yet / + Add fuel" (29-offlimits-open.xml). New detail: Update Contact → Off Limits already has a plain list editor ("What should you avoid?", Add, Remove; 65-update-offlimits.xml), which could replace the Fuel editor on Add/Edit.
- **Add Contact defaults (Phase 39 D-04/D-50/D-51):** Unbound + Today and Relationship Basics collapsed are confirmed as known. E-05 (Bound → Custom 0) and E-13 ("Not yet" never looks selected) are separate defects that the D-51 and D-50 work should cover as acceptance checks.
- **Possible-match tap (Phase 39 D-06/D-75):** this belongs to Import → Review matches. It was not seen in area E. Add Contact's duplicate handling is reported separately as E-27.

#### Dropped
None. All 29 raw findings were confirmed. Corrections applied:
- E-04: the custom-field claim was removed.
- E-05: the fix now goes in `coordinateBoundToggle`, with the D-51 link added.
- E-06, E-08, E-17, E-21, E-22: pointers added.
- E-09, E-10, E-18: pointers corrected.
- E-13: the D-50 link was added.
- E-14: narrowed to Add Contact draft rows and the link button.
- E-27: re-scoped as a standalone finding, not new detail on the known item.

E-X01 (measureLayout warning) is a non-UX item and stays in `other-findings.md`.

#### Routes covered
| Route | Reached | How |
|---|---|---|
| `Create` | yes | + → Add Contact from the Contacts tab (02, 31, 98; retest R1/R2). The Contacts empty state was not reachable (the list is never empty). The Orrery entry is out of scope. |
| `Edit` | yes | Profile ⋯ → Edit Contact (37, 51; retest R2-05); Contacts long-press → Edit Contact (88, 89, 104). Not tried from Compose (area J) or from a Profile opened via Events/Digest/Settings. |
| `UpdateContact` | yes | + on a Profile (contact already in context, no picker; 57); + on the list → Choose contact picker → Update (85, 86). Every row was opened except Zz UX Nickname / Coffee friend / Kids count individually. |
| `CropPhoto` | yes | Update → Pet photo → Add photo → Android photo picker → "Position photo" (71-crop-screen.xml, text only); cancelled. |
| `Memory` (G) | yes | Update → Memory (63); Back returns to the Update list (64). |

#### Could not check
- "Use photo" on CropPhoto, and Add/Change photo on Edit: the phone's photo library holds the owner's personal images, so the pass stopped at the crop screen and cancelled.
- "Paste image URL" → Add from URL: this needs a network fetch, so only the field was opened (73).
- Update → Key people Delete and Off Limits Remove were code-read, not pressed, to keep area G's fixtures (E-08).
- The Social battery dropdown options were not opened (same native spinner as Category).
- The back stack after an Edit save is already covered by D-02 and was not repeated.
- E-14: not checked whether the Profile shows the key-person link after the contact is created.
- The setup note "Relationship Basics tap after picking a category opens a date picker" did not reproduce: there was no layout shift after picking a category (99-after-category-pick.xml).

#### Zz UX items created/changed, settings changed (carried from the audit and retest)
- Created through the Add Contact UI:
  - **Zz UX Add Test:** Unbound, Uncategorized, phone "abc", email "notanemail", Last spoke Today.
  - **Zz UX Maximiliana Alexandrina Konstantinopoulou-Vanderbilt Worthington the Third of Somewhere:** Unbound, category Zz UX Friends, Last spoke Today.
- Changed on **Zz UX Full Profile** via Update Contact:
  - Last talked about: changed, then restored to "Their trip to Lisbon". The value history has 2 extra entries.
  - Zz UX Anniversary: changed, then restored to "2015-06-20".
  - Birthday is unchanged (2026-10-13).
- The retest created and changed nothing.
- Appearance was changed for the theme spot check and restored to Galaxy / Dark / Deep Space / package-default accent (111-appearance-restored.xml).
- `adb reverse tcp:8081 tcp:8082` was left in place.
- Theme spot check: no theme-specific breakage beyond E-22. Update Contact's header bar is a solid band, unlike the transparent headers on Add/Edit.

---

## Area F — Logging and history — final findings

Final verified findings (finalizer, no device). Sources: `findings-raw.md` (audit), `verification.md` (verifier), `recheck-list.md`, `retest-results.md` (retest, device). Device: Pixel 6 Pro, debug build, Galaxy / Dark / Deep Space (default theme). All evidence paths are relative to `untracked/artifacts/ux-audit/F-logging-history/`. Retest evidence is in `retest/`.

**Counts: 27 findings.**
- **By code:** HID 12 · INC 6 · VIS 5 · COPY 2 · DEAD 1 · A11Y 1.
- **By severity:** High 1 · Medium 13 · Low 13.

Notes on the counts and IDs:
- IDs are the raw IDs. Nothing was dropped and no ID moved.
- The raw header's code counts (INC 7 · VIS 4) were miscounted. The raw findings themselves are INC 6 · VIS 5.
- F-12 is recoded from DEAD to HID (see F-12).
- F-22 is narrowed to Edit interaction only. Its Group Log half (the error pushing "Log group" into the gesture bar) is merged into F-12.

Physical confirmation:
- F-01, F-12 and F-26 were rechecked on the device and all reproduced.
- Every other finding is confirmed against its screenshots, dumps and code.

### F-01 · DEAD · High — Log Interaction throws away what you typed on Back, with no warning
- Where: Log Interaction (`LogContact`), opened from + → Log Interaction on a Profile. The same form also opens from the long-press menu, Digest + and History.
- What happens:
  - **Audit.** I typed a note, pressed Back once to close the keyboard and once more. The form closed at once and the note was gone.
  - **Retest, Android Back.** On Zz UX Full Profile → + → Log Interaction, I typed "Zz UX recheck note" (the dump shows the text in the field) and closed the keyboard; the form was still open with the note. One `keyevent 4` went straight back to the Profile with no dialog.
  - **Retest, app-bar Back.** I repeated the steps and tapped the on-screen app-bar "Back". It went straight back to the Profile with no dialog.
  - **Nothing was saved.** No "Zz UX recheck note" interaction exists in History.
  - **Contrast.** Edit interaction, in the same situation, shows "Discard changes? Your unsaved changes will be lost. KEEP EDITING / DISCARD". So does Group Log.
- Why it's a problem: Log Interaction, Edit interaction and Group Log are three sibling logging forms, and only the one people use most loses work silently. It is the same pattern as E-01 (Add Contact).
- Evidence:
  - Audit: 44-log-back-dirty.png (Back lands on the Profile; no note saved); 34-back-from-edit-dirty.png (Edit interaction prompt); 136-grouplog-back-dirty.png (Group Log prompt).
  - Retest, Android Back: retest/r04-log-interaction.png; retest/r05-note-typed.png/.xml; retest/r06-ime-closed.xml; retest/r07-after-back.png/.xml.
  - Retest, app-bar Back: retest/r08-second-note-typed.xml; retest/r09-after-appbar-back.png/.xml.
  - Retest, nothing saved: retest/r11-history-expanded.png/.xml; retest/r12-history-stream.xml.
  - Retest, Edit interaction contrast: retest/r14-edit-interaction.png; retest/r15-edit-back-discard-prompt.png; retest/r16-after-discard.xml.
- Proposed fix: `src/screens/LogInteractionScreen.tsx` has no `useDiscardKeepGuard` and no `beforeRemove` (a grep finds nothing). Edit interaction has the guard at `EditInteractionScreen.tsx:108-110`, and Group Log at `GroupLogScreen.tsx:72-75`. Add `useDiscardKeepGuard({ hasUnsavedChanges, bypassRef })` to Log Interaction:
  - Seed the snapshot inside `seed()` (:114-154), after `setValue`.
  - Set `bypassRef.current = true` before `navigation.goBack()` at :242.
  - Keep the guard off while the contact-picker branch is showing (:249-257, `contactId === null`).
  - Afterwards: Back with entries shows the same "Discard changes?" prompt as Edit interaction.

### F-02 · HID · Medium — Saving a full log, group log, edit or delete gives no confirmation and no Undo; a backdated log vanishes behind "Show older"
- Where: Log Interaction → Save; Group Log → Log group; Edit interaction → Save changes; interaction sheet → Delete.
- What happens:
  - Log Interaction closes and drops you back where you were, with no message.
  - I backdated a log to Oct 1. It did not appear in History until I found and tapped "Show older".
  - Group Log ends on the Contacts tab with nothing shown (B-08).
  - Delete closes the sheet silently.
  - Quick Log, by contrast, shows "Logged · Undo · Add Note".
- Why it's a problem: the detailed logging path gives weaker feedback than the one-tap path. With a backdated entry, the user can't tell whether the save worked.
- Evidence: 48-after-log-save.png; 49-backdated-in-stream.png (stream ends, "Show older"); 50-show-older.png (entry appears under "Thu Oct 1"); 85-after-group-log.png; 52-after-delete.png.
- Proposed fix:
  - In `src/screens/LogInteractionScreen.tsx:241-242`, call `showSnackbar({ kind: "success", label: "Logged for <name>", action: Undo })` (store at `src/stores/snackbar-store.ts:50`) before `navigation.goBack()`. The user then gets the same confirmation as Quick Log.
  - The delete path is `InteractionDetail.tsx:140` → `HistorySection.tsx:1258` (`onDeleted={() => setDetailId(null)}`), which closes with no message. Add a "Deleted" snackbar there.
  - Needs investigation: how to reveal a backdated entry after saving (open the stream chunk that contains it).
  - The Group Log part is B-08 (cross-area).

### F-03 · HID · Medium — Quick Log silently switches channel to whatever was last picked in Log Interaction (deepens A-35)
- Where: any Quick Log (+ → Quick Log, long-press → Quick Log, row swipe).
- What happens: my first Quick Logs were recorded as "Message". After one Log Interaction saved as "In Person", every later Quick Log was recorded as "In Person". The snackbar only says "Logged", so nothing tells the user which channel was used.
- Also seen: In Person Quick Logs are stored as "Outbound", while the Log Interaction form defaults In Person to "Mutual". The two code paths are `log-interaction-logic.ts:80-81` and `quick-log-command.ts:147`.
- Why it's a problem: the result of a one-tap action depends on an unrelated earlier form, and history fills with the wrong channel without the user noticing.
- Evidence: 96-history-today.png (4:20/4:21 Message, then 4:32–4:41 In Person); 05-quicklog-snackbar-visible.png.
- Proposed fix:
  - At minimum, put the channel and name in the snackbar label (`src/services/quick-log-command.ts:156`), e.g. "Logged In Person with <name>". This half overlaps A-35 (same fix line).
  - Needs investigation (owner call): whether Quick Log should use the remembered channel at all. Quick Log calls `resolveInitialChannel(pref, remembered)` at `quick-log-command.ts:146`, and `LogInteractionScreen.tsx:215-237` writes the remembered channel after each save. With the "remember" preference, this is how it is built.
  - The direction mismatch (Outbound vs Mutual for In Person) belongs in the same investigation.

### F-04 · INC · Medium — Bulk Quick Log records channel "unspecified" and has no Add Note, unlike single Quick Log
- Where: Contacts → long-press → Select → select several → Quick Log.
- What happens:
  - The snackbar says "Logged 3 interactions · Undo", with no Add Note.
  - Each entry is recorded with channel "unspecified". The interaction sheet then has no Channel row at all (`interaction-detail-logic.ts:94` hides "unspecified"), and the stream shows a lowercase "unspecified".
- Why it's a problem: the same action, "Quick Log", stores different data depending on how many people are selected.
- Evidence: 138-bulk-quicklog-confirm.png; 140-bulk-entry-sheet.png (no Channel row); a dump during cleanup showed "Interaction, unspecified, 4:57 AM, Outbound" on History Long, Dense and Sparse. The retest's bulk log also created "unspecified" entries (retest/r37-dense-new-interaction.png, retest/r40-long-new-interaction.xml, retest/r42-sparse-new-interaction.xml).
- Proposed fix: `src/db/bulk-actions-dao.ts:63` hard-codes `channel: "unspecified"` (caller `HomeScreen.tsx:1058`). Add a channel parameter to `bulkQuickLog` and pass in the resolved default channel, as single Quick Log does (`resolveInitialChannel`, `quick-log-command.ts:146`). The user then sees the same channel on bulk and single Quick Logs.

### F-05 · INC · Medium — Bulk "Log Interaction" with 2+ selected silently becomes a Group Log, and never lists who is in it
- Where: Contacts selection bar → Log Interaction (2+ selected); also Group Log → Add participants.
- What happens:
  - The button says "Log Interaction" but opens "Group Log", which creates a group event. Bulk "Quick Log", right beside it, creates separate interactions.
  - The Participants block only says "3 participants selected" / "2 participants selected", with no names, and its button still says "Add participants".
- Why it's a problem: the user can't predict whether they are creating one event or several interactions, and can't check who is included before saving.
- Evidence: 133-bulk-two.png; 134-bulk-log-interaction.xml; 135-bulk-grouplog-participants.xml; 83-group-log-participants.xml.
- Needs investigation:
  - `src/screens/HomeScreen.tsx:1181-1186` routes 2+ selected to `GroupLog`.
  - `src/screens/GroupLogScreen.tsx:177-180` renders only the count.
  - Consider listing participant names or avatars, and labelling the bulk button "Group Log" when 2+ are selected.

### F-06 · INC · Medium — The three logging forms (Log Interaction, Edit interaction, Group Log) are laid out and worded differently
- Where: + → Log Interaction; History → entry → Edit; + → Group Log.
- What happens:
  - **Back:** plain-text "Back" on Log Interaction; a small bordered "Back" on Edit interaction; a large bordered "Back" on Group Log.
  - **Title casing:** "Log Interaction" / "Edit interaction" / "Group Log".
  - **Save button:** "Save" / "Save changes" / "Log group".
  - **Duration:** hidden under "More Options" on Log Interaction; shown inline on Edit interaction and Group Log.
  - **Allow AI:** has the caption "Let AI use this note's text. Off by default." on Log Interaction; no caption on Edit interaction; absent on Group Log.
  - **Channel choices:** Log Interaction offers Message / Call / In Person. Edit interaction and Group Log also offer Other and Unspecified.
  - **Group Log fields:** no Direction or Connected, and its "Group Note" label is bold and larger than the other field labels.
- Why it's a problem: the same record is created and edited with forms that don't match, so it looks like several generations of the app.
- Evidence: 41-log-interaction.png; 43-log-more-options.xml; 18-edit-interaction.png; 19-edit-interaction-bottom.png; 20-channel-dropdown.png; 42-log-channel-options.xml; 78-group-log.png; 79-group-log-bottom.xml.
- Needs investigation: all three use `src/components/TouchpointRefineForm.tsx`; the differences come from each screen's settings and header:
  - **Log Interaction:** `ShellAppBar` (:285); `channelOptions` (3); `moreOptionsFields` (duration); `allowAiCaption`.
  - **Edit interaction:** a bordered `Pressable` Back (:164-172) and the full default form (5 channels, `TouchpointRefineForm.tsx:87-93`).
  - **Group Log:** a secondary `Button` Back (:111-115); `visibleFields` without direction / connected / note / allowAi (:143); its own `AppText role="label"` "Group Note" (:147-149).
  - Back styles and titles overlap B-03, D-32 and E-20 (cross-area).

### F-07 · VIS · Low — Group Log has a flat background in every theme; Log Interaction and Edit interaction show the theme background
- Where: + → Group Log, in Galaxy dark/light and Standard dark/light.
- What happens: Log Interaction shows the starfield / nebula, but Group Log is a plain flat colour in all four themes.
- Why it's a problem: sibling screens look like they come from different apps.
- Evidence: 78-group-log.png vs 41-log-interaction.png; 145-galaxy-light-grouplog.png vs 145-galaxy-light-log.png; 146b-standard-DARK-grouplog.png; 147-standard-light-real-grouplog.png.
- Proposed fix: `src/screens/GroupLogScreen.tsx:108` sets `backgroundColor: colors.background` on the root container; Log Interaction and Edit interaction set none. Remove it, and the theme art then shows behind Group Log as it does on Log Interaction.

### F-08 · HID · Medium — No logging or edit form says who it's for (extends D-29)
- Where: Log Interaction (any entry), Edit interaction, the Add Note sheet, and Quick Log started from a Profile (no picker).
- What happens: none of them name the contact. Only "Edit participant" does ("Editing Zz UX Full Profile"). When you start from the Contacts tab or Digest, you choose the person in a picker that then disappears.
- Why it's a problem: it is easy to log against the wrong person, especially after a picker. The one screen that does show the name proves it's possible.
- Evidence: 41-log-interaction.png; 109-log-from-jump.xml; 111-log-prefilled-oct5.xml; 18-edit-interaction.png; 55-add-note-editor2.png; 114-edit-individual.xml ("Editing Zz UX Full Profile").
- Proposed fix: show the contact name and avatar, as `EditParticipantScreen` does, in three places:
  - as a subtitle in the `ShellAppBar` area, `LogInteractionScreen.tsx:285`;
  - in the Edit interaction header, `EditInteractionScreen.tsx:163-179`;
  - for Add Note, in the sheet heading at `src/components/PostLogNoteEditor.tsx:356`.
  - This matches D-29 and E-10 (cross-area).

### F-09 · COPY · Low — Raw lowercase values: "outbound / inbound / mutual", "unspecified"
- Where: the Direction dropdown on all log forms; "Direction" on the interaction sheet; the stream entry for an unspecified channel.
- What happens: the dropdown options and the sheet show "outbound", "inbound", "mutual", while the stream shows "Outbound" for the same value. The stream also shows "unspecified" as a channel name.
- Why it's a problem: these look like raw database values.
- Evidence: 21-direction-dropdown.xml; 14-interaction-sheet.png ("outbound"); 140-bulk-entry-sheet.png; 18-edit-interaction.png; 41-log-interaction.png; 13-history-stream.png ("unspecified 10:56 PM"); 09-history-expanded.png ("Outbound").
- Proposed fix:
  - The stream already title-cases direction with `DIRECTION_LABEL` (`src/components/history/HistoryStreamRows.tsx:70-74`). Reuse it in `src/components/TouchpointRefineForm.tsx:339` (currently `label={o}`) and `src/components/history/interaction-detail-logic.ts:110`.
  - In the stream, show "Unspecified" (or "Logged") instead of the raw `r.channel` in the `HistoryStreamRows.tsx` interaction row (~:123).

### F-10 · INC · Low — The interaction sheet shows "Connected / Connected" for In Person and group entries the form never asked about (deepens B-17)
- Where: History → an In Person or group interaction → sheet.
- What happens: Log Interaction hides the Connected switch for In Person, and Group Log has no Connected switch, yet the sheet still lists "Connected: Connected".
- Why it's a problem: the sheet shows a meaningless field and repeats the word.
- Evidence: 51-delete-confirm.png (In Person entry; the background shows "Connected / Connected"); 112-group-entry-sheet.xml; 140-bulk-entry-sheet.png.
- Proposed fix: `src/components/history/interaction-detail-logic.ts:114-119` always adds the Connected row. Skip it when the channel's `connectedHidden` is true (`defaultsForChannel`, `src/screens/log-interaction-logic.ts:79-84`). The sheet then only shows fields the user could set. The repeated label/value wording itself is B-17 (cross-area).

### F-11 · VIS · Medium — On Edit interaction the keyboard covers the field you are typing in
- Where: Edit interaction → Custom (minutes).
- What happens: tapping Custom (minutes) opens the number keyboard over the field, and the screen doesn't scroll, so you type blind. The dump puts the focused field at y 2686-2844, and the keyboard starts at about y 1945.
- Why it's a problem: you can't see what you enter.
- Evidence: 28-custom-focused.png / 28-custom-focused.xml (field focused, hidden behind the keyboard); 25-edit-custom-duration.png.
- Needs investigation: the ScrollView at `src/screens/EditInteractionScreen.tsx:159` has no keyboard handling. The same form is used in Log Interaction and Group Log.

### F-12 · HID · Medium — Group Log: the "needs a title" error appears at the bottom, pushes the button into the gesture bar, and stays after you add a title
- Recoded from the raw DEAD: Log group itself works. The problem is a misplaced, stale message, which makes this HID rather than a dead control. This finding also absorbs the Group Log half of raw F-22.
- Where: + → Group Log → Log group with an empty title.
- What happens:
  - **Where the error appears.** The red "A group event needs a title." appears directly above the Log group button, about 2,200 px below the Title field, which is off-screen. The retest put it at [56,2910][1384,2987].
  - **Button pushed down.** The error pushes "Log group" down to [56,3043][1384,3120], the very bottom edge, into the gesture-bar zone.
  - **Error goes stale.** In the retest I scrolled up, focused Title and typed "Zz UX F retest" (the top dump shows the title filled). The bottom dump still showed the error. Moving focus to Group Note and tapping outside did not clear it either. It only goes away on the next Log group press.
- Why it's a problem: the user doesn't see which field is wrong, and then sees an error that is no longer true.
- Evidence:
  - Audit: 80-group-log-empty-save.png; 84-stale-title-error.xml.
  - Retest: retest/r20-group-log-top.png; retest/r21-group-log-bottom.png; retest/r22-log-group-no-title-error.png/.xml; retest/r23-title-filled-top.png/.xml; retest/r24-title-filled-bottom.png/.xml; retest/r25-after-focus-move.png/.xml.
- Proposed fix: in `src/screens/GroupLogScreen.tsx`, the error is set only in `save()` (:80) and cleared only by a later save (:84). The title input's `onChangeText={setTitle}` (:125) never clears it, and the error renders above the button (:188-192).
  - Render the error under the Title field.
  - Clear it in the title's `onChangeText` (`setError(null)` when the text is non-empty).
  - Add a bottom safe-area inset to the content container.
  - Afterwards the message sits beside Title, goes away as soon as the user types, and the button stays clear of the gesture bar.

### F-13 · HID · Medium — Log forms let you pick a future date, then reject it after both pickers (repeats E-12 on the log forms)
- Where: Edit interaction (and Log Interaction) → Date & time.
- What happens: the system date picker lets you choose Oct 20 (in the future), then shows the time picker. Only after both does the form say "That time is in the future. Pick now or earlier." and keep the old date.
- Why it's a problem: two dialogs of work are thrown away for a rule the picker itself could have enforced.
- Evidence: 30-date-picker.png (future days enabled); 32-after-future-date.xml (error).
- Proposed fix: `src/components/TouchpointRefineForm.tsx:570-575` passes no `maximumDate` to the date picker. Add `maximumDate={parseLocalDateTime(now)}`, and future days are then disabled in the picker. This is the same pattern as E-12 and B-23 (cross-area).

### F-14 · HID · Low — Logging from an empty month or day doesn't use the date you were looking at the way you'd expect
- Where: History → Jump to date → a month with no activity → "Log interaction"; History → an empty heatmap day → "Log interaction".
- What happens:
  - From "No activity in January 2026 · Log interaction", Log Interaction opens dated today (Oct 10, 4:46 AM).
  - From an empty day (Oct 5), it prefills "Oct 5, 2026, 12:00 AM", which is midnight.
- Why it's a problem: the button sits under "No activity in January 2026" but logs today. From a day, the default time of midnight is almost always wrong.
- Evidence: 108-jump-jan-empty.png; 109-log-from-jump.xml (Oct 10); 110-tap-empty-day.xml; 111-log-prefilled-oct5.xml (12:00 AM).
- Proposed fix:
  - `src/components/history/HistorySection.tsx:1188-1192` builds an undated route (`buildLogRoute(contactId)`). Pass the month's first day instead, or hide the Log button there.
  - `src/screens/LogInteractionScreen.tsx:85` seeds `${prefillDate} 00:00:00`. Seed the current time of day instead.
  - Afterwards the user lands in the month or day they chose, at a sensible time.

### F-15 · HID · Medium — History "Intensity" numbers are unexplained and look wrong
- Where: Profile → History → the INTENSITY block under the heatmap, on every lens.
- What happens:
  - It shows "4× this period" while the current cycle square says 6 interactions.
  - On the other lenses it reads: "10× this period" (7 Days, 14 interactions); "120×" or "121× this period" with "Weekly intended · 2-day average" (Year); "Monthly intended · 0-day average"; "7×" with "1-day average" (Month).
  - The bar under it is always full.
- Why it's a problem: the user can't tell what is multiplied by what, or what "0-day average" means.
- Evidence: 09-history-expanded.png; 105-lens-7days.xml; 127-hl-year-lens-2.png; 128-hl-month-lens.png; 140-bulk-entry-sheet.png (background "121×").
- Needs investigation: the `IntensityLine` copy in `src/components/history/IntensityChart.tsx`, and its inputs in `HistorySection.tsx`. `IntensityChart.tsx:69-71` caps the fill at 1, which is why the bar is always full once the floor is met. "Intensity" as jargon is also B-10, and see D-19 (cross-area).

### F-16 · HID · Medium — Year and Month heatmaps and the Cycles count chips have no labels
- Narrowed by the verifier: the raw claim that the Year layout is misleading was wrong. Dump 126 puts Jan 1 (a Thursday) in the 5th column, so each block of 7 dots is a Sunday–Saturday week, and each row holds two consecutive weeks. The layout is week-aligned; the problem is that nothing labels it.
- Where: History → Year lens; Month lens; Cycles lens count chips.
- What happens:
  - **Year:** tiny dots in two 7-column week blocks per row, with no month or weekday labels. The right third of the card is empty.
  - **Month:** squares with no day numbers and no weekday labels, with a large empty gap below.
  - **Cycles:** the count chips "5 / 10 / 15 / 20" have no label saying what they count.
- Why it's a problem: the user can't find a date, or tell what a chip does, by looking.
- Evidence: 126-hl-year-lens.png; 127-hl-year-lens-2.png; 126-hl-year-lens.xml (Jan 1 in column 5); 128-hl-month-lens.png; 10-history-top.png.
- Needs investigation: `src/components/history/ActivityHeatmap.tsx` / `heatmap-cell.ts` (month and weekday labels, layout width). Related to C-07 (Digest heatmap).

### F-17 · A11Y · Low — Year heatmap dots are far below touch-target size; count chips are announced as bare numbers
- Where: History → Year lens; Cycles lens count chips.
- What happens: each Year dot is 45×46 px (about 13 dp). The count chips' accessibility labels are just "5", "10", "15", "20".
- Evidence: 126-hl-year-lens.xml (e.g. `{Jan 3, 2 interactions}`, 45×46 px bounds); 10-history-top.xml (`{5}`, `{10}`).
- Needs investigation: the Year-lens cell size in `ActivityHeatmap.tsx`. Give the chips labels such as "Show 10 cycles".

### F-18 · INC · Medium — Add Note sheet: notes and memories behave differently, and the memory path stacks three sets of buttons
- Where: Quick Log snackbar → Add Note.
- What happens:
  - **Note branch.** Save closes the sheet with no message, and an empty Save also just closes it.
  - **Memory branch.** "Create Memory Instead" saves at once and shows a "Memory saved" sheet with Edit Memory / Done.
  - **Edit Memory.** It opens a sheet headed "Edit Memory", with a card "Memory", then "Edit memory" again, Cancel + Save inside, and Done below.
  - **Move to Recently Deleted.** From Edit Memory it closes everything with no message.
  - **Button rows.** In the Add Note sheet, Cancel and "Create Memory Instead" are text links on one row, and Save sits alone on a second row.
- Why it's a problem: one small sheet mixes three button styles and two styles of feedback, and the memory branch can't be undone from where it started.
- Evidence: 55-add-note-editor2.png; 56-add-note-empty-save.xml; 70-after-add-note-save.xml; 71-create-memory-instead.png; 72-edit-memory-from-note.png; 73-edit-memory-bottom.png; 74-after-move-deleted.xml.
- Needs investigation: `src/components/PostLogNoteEditor.tsx`:
  - Done under the memory editor: :335.
  - Edit Memory / Done: :346-351.
  - Cancel / Create Memory Instead / Save, wrapping onto two rows: :378-389.

### F-19 · VIS · Medium — Once an interaction has a note, the sheet hides Edit/Delete below the fold and the note comes last (B-16 on a single interaction)
- Where: History → an interaction with tone, duration and note → sheet.
- What happens: Channel, When, Direction, Connected, Tone and Duration come first. The note is cut off at the bottom of the sheet, and Edit/Delete only appear after scrolling. In the default state, the red Delete is the most prominent button. "Delete" was not truncated on single interactions (unlike B-16's event case).
- Why it's a problem: the content people care about and the main actions are the hardest to reach.
- Evidence: 38-sheet-full-entry.png; 39-sheet-scrolled.xml; 14-interaction-sheet.png.
- Needs investigation: `buildDetailRows` puts the note last (`src/components/history/interaction-detail-logic.ts:133-135`), and the actions follow the rows (`src/components/history/InteractionDetail.tsx:221-236`). Consider moving the note up and making the action bar sticky. This is the single-interaction instance of B-16 (cross-area).

### F-20 · HID · Low — "Make this a group interaction" is the only item behind ⋯, and it uses two names for one thing
- Where: History → interaction sheet → ⋯.
- What happens: the menu holds a single item, "Make this a group interaction". The sheet it opens then asks you to "Give this group event a title", with a "Create group event" button.
- Why it's a problem: the only action behind ⋯ is hidden, and it calls the same thing both a "group interaction" and a "group event".
- Evidence: 15-interaction-sheet-more.png; 16-make-group.png.
- Needs investigation: `src/components/history/InteractionDetail.tsx:159-168` (single-item OverflowMenu). The naming overlaps B-12.

### F-21 · HID · Low — Undo removes a Quick Log silently (bulk Undo, by contrast, confirms)
- Where: any single-contact Quick Log snackbar → Undo.
- What happens:
  - **Undo works.** It was verified for + Quick Log, long-press Quick Log and swipe. The snackbar just disappears, with no "Undone" message.
  - **Window length.** Measured visibility was about 6 s (visible at 2.0–5.1 s, gone by 6.5 s). The code agrees: `src/stores/snackbar-store.ts:38-41` dismisses every snackbar after 6000 ms.
  - **Bulk differs.** Bulk Quick Log Undo shows a confirmation, "Undid N logged interactions" (`HomeScreen.tsx`, `performBulkQuickLog` Undo → `commitBulkOutcome`, ~:1036-1046 and ~:1070).
- Why it's a problem: the user can't tell whether Undo or the timeout closed the snackbar, and single and bulk Undo already disagree.
- Evidence: 05-quicklog-snackbar-visible.png; 96-history-today.xml (the undone 3rd log is absent); 97-swipe2-snackbar.png / 98-swipe2-after-undo.png; 102-longpress3-snackbar.png / 103-longpress3-after-undo.png; 104-history-after-lp-undo.xml.
- Proposed fix: `src/services/quick-log-command.ts:108-112` only refreshes after the undo succeeds. Show a short "Log removed" snackbar there once the deletion resolves, matching bulk Undo's confirmation. The user then sees that Undo worked.

### F-22 · VIS · Low — "Save changes" on Edit interaction sits in the gesture bar
- Narrowed by the verifier: the Group Log half (error pushing "Log group" into the gesture bar) is merged into F-12.
- Where: Edit interaction, scrolled to the end.
- What happens: "Save changes" spans [56,2895][1384,3064] of a 3120 px screen, and the gesture handle overlaps its bottom edge.
- Why it's a problem: the main button shares space with the system gesture area, so a tap there can trigger a gesture instead.
- Evidence: 19-edit-interaction-bottom.png; 19-edit-interaction-bottom.xml.
- Proposed fix: `src/screens/EditInteractionScreen.tsx:227-230` gives the content container 16 padding and no safe-area inset. Add the bottom safe-area inset, and the button then sits fully above the gesture bar.

### F-23 · INC · Low — The stream interleaves lifecycle events with interactions with no filter, and "In Person" shares the Bound/Unbound icon
- Corrected by the verifier: the raw finding said lifecycle rows have equal weight. They don't: they render muted, with a grey `textSecondary` icon and dimmer text (`HistoryStreamRows.tsx:160-168`; visible in 13).
- Where: Profile → History stream.
- What happens:
  - **Interleaving.** Snoozed, Unsnoozed, Archived, Restored, Bound and Unbound rows sit between real interactions, and there is no way to filter them out. On a busy test contact, 10 of 18 rows on one day were lifecycle events.
  - **Shared icon.** "In Person" uses the same two-people icon as Bound/Unbound.
- Why it's a problem: real interactions are hard to scan among lifecycle rows, and the shared icon makes an In Person meeting look like a status change.
- Evidence: 13-history-stream.png; 37-edited-entry.png; 44-log-back-dirty.png; 107-jump-to-date.png (In Person rows with the people icon).
- Proposed fix for the icon: `src/components/history/HistoryStreamRows.tsx:52` maps "In Person" to `group-events`, and :61-62 map bind/unbind to the same icon. Give bind/unbind their own icon at :61-62.
- Needs investigation: a filter for lifecycle rows.

### F-24 · COPY · Low — Small wording and label slips on the logging forms
- Where: Log Interaction, Group Log, snackbars.
- What happens:
  - The date field on a new log is announced "Correct date and time, …".
  - The "More Options" toggle keeps the accessibility label "More Options" after its text changes to "Hide options".
  - Group Log's Title placeholder is "What happened?", the same as the note placeholder in Add Note.
  - The bulk snackbar says "Logged 3 interactions", while single Quick Log says only "Logged".
- Why it's a problem: screen-reader users hear labels that don't match the screen, and the same placeholder is used for a title and for a note.
- Evidence: 41-log-interaction.xml; 43-log-more-options.xml; 78-group-log.png; 55-add-note-editor2.png; 138-bulk-quicklog-confirm.png vs 05-quicklog-snackbar-visible.png.
- Proposed fix:
  - `src/components/TouchpointRefineForm.tsx:265`: the "Correct date and time" label.
  - :552: make the toggle's label follow its text (the text flips at :558).
  - Give Group Log's Title (`GroupLogScreen.tsx:126`) its own placeholder, distinct from `PostLogNoteEditor.tsx:361`.

### F-25 · HID · Low — The Quick Log contact picker keeps the previous search between opens
- Corrected by the verifier: 64-picker-kb.png/.xml was dropped from the evidence because it shows the Contacts grid, not the picker. The raw report that a query typed in one open was still there on the next is supported by the code reading below, not by a captured screen.
- Where: + → Quick Log → Choose contact.
- What happens: when the picker opened, the search box already contained "Full Profile" from an earlier session, so only one contact was listed.
- Why it's a problem: the picker looks like it has only one contact, and the user has to notice and clear a search they didn't type this time.
- Evidence: 02-quicklog-picker.png.
- Proposed fix: in `src/components/ContactPicker.tsx`, `term` (:69) is never reset when `visible` turns true (effects :88-129), and the FAB keeps the picker mounted (`UniversalFab.tsx:372-377`). Call `setTerm("")` in the `wasVisible` effect (:124-129) when the picker opens, and each open then starts with an empty search.

### F-26 · VIS · Low — After a bulk Quick Log, selected cards change position while selection mode stays
- Narrowed by the retest: the raw claim that logged contacts jump to the top is not what happens. Two cards swap places.
- Where: Contacts card view, selection mode → Quick Log.
- What happens:
  - **Setup.** I searched "History" (7 results). The order was Quiet Year, Sparse, Long / Dense, Empty, Notes Only / Zz UX Full Profile. I selected History Long, Sparse and Dense ("3 selected"; order unchanged).
  - **Reorder.** After Quick Log in the selection bar, a screenshot about 0.3 s later still showed the old order. The dump taken right after it showed Quiet Year, Dense, Long / Sparse, Empty, Notes Only: History Sparse moved from slot 2 to slot 4, and History Dense from slot 4 to slot 2. "3 selected" and the selection bar stayed.
  - **Snackbar overlap.** The "Logged 3 interactions · Undo" snackbar, about [275,2558][1167,2727] with Undo at [932,2567][1166,2721], covers the top of the second card row (cards begin at y=2623) and sits right next to the + FAB.
  - **Late tap.** In the audit and again in the retest, a tap meant for Undo that arrived after the snackbar was gone landed on a card and selected it ("4 selected"). The late timing was the automation's, but it shows what a slightly late tap does here.
- Why it's a problem: selected cards move under the user's finger within about a second, and the area where Undo was becomes a card that a tap selects.
- Evidence:
  - Audit: 133-bulk-two.png; 138-bulk-quicklog-confirm.png; 139-bulk-undo.xml.
  - Retest: retest/r30-history-search-cards.png/.xml; retest/r33-three-selected.png/.xml; retest/r34-after-bulk-quicklog.png/.xml; retest/r35-after-undo.png/.xml.
- Needs investigation: `src/screens/HomeScreen.tsx` `performBulkQuickLog` (~:1054-1080) refreshes the shell (`bumpShellRefresh`) while selection mode stays active, so the list re-sorts. Consider freezing the order until selection mode ends. Related to A-27.

### F-27 · HID · Low — In a long history the History controls are a long scroll away, and History has no Log button
- Where: History Long (912 interactions) → History, after expanding years or jumping deep.
- What happens: the lens chips and Jump to date sit only at the top of the section. After jumping or expanding a year, the only way back is a long scroll. Logging from History requires an empty-day or empty-month note (D-29).
- Why it's a problem: in a long history, the controls and the Log action are out of reach exactly when the user needs them.
- Evidence: 121-hl-deep.png; 123-hl-2021-view.xml; 130-after-jan3-jump.xml.
- Needs investigation: `HistorySection.tsx` (a sticky control row or "back to top").

---

#### Repeats of earlier findings, seen from logging and history (evidence notes for the cross-cutting pass)
These were not given verdicts item by item. They are kept as evidence for the cross-cutting pass.
- **A-35:** confirmed for every single-contact Quick Log. Bulk differs ("Logged 3 interactions"); see F-03 and F-24.
- **A-23:** the row stays slid open after swipe-log and after Undo (91-swipe-right.png, 93-after-swipe-undo.xml).
  - **Verifier note:** the Undo window is **6 s**, not ~3 s. `src/stores/snackbar-store.ts:41` dismisses every snackbar after 6000 ms, and the audit measured it at about 6 s (visible 2.0–5.1 s, gone by 6.5 s).
  - A-23's "~3 s" came from adb taps arriving too late, not from the app. Read A-23's "consider a longer snackbar" against 6 s. Undo is reachable (F-21).
- **Single vs bulk Undo confirmation (verifier note):** single Quick Log Undo is silent, while bulk Undo shows "Undid N logged interactions" with a Dismiss action (`HomeScreen.tsx` `commitBulkOutcome`). See F-21.
- **B-16:** on single interactions "Delete" is not truncated, but the actions fall below the fold once a note exists (F-19).
- **B-17:** "Connected / Connected" also appears on single In Person entries (F-10).
- **B-18:** the same Android system dropdowns for Channel, Direction and Tone appear on Log Interaction, Edit interaction and Group Log (20-channel-dropdown.png, 21-direction-dropdown.xml, 23-tone-dropdown.xml). Date and time use system pickers (30-date-picker.png, 31-time-picker.png).
- **B-20:** confirmed on Edit interaction. After saving a custom 45 m and reopening, no chip was selected, the Custom box was empty, and the readout said "45m" (142-restore-edit.xml, 143-restore-before-save.xml). "None" appears twice (chip + readout).
- **D-29:** extended to every log and edit form (F-08).
- **C-02:** Back from a Log Interaction started on Digest lands on the Contacts tab (77-back-from-log-digest.xml). Quick Log from Digest stays on Digest (70-after-add-note-save.xml).
- **A-02 / A-09:** the Contacts search filter survived an app relaunch (95-contacts-relaunch.xml), and Back with search open exited the app (twice during the audit). At the retest start, the search was still open with "Zz UX Full" from an earlier pass (retest-results.md, "State restored").
- **E-12:** the future-date pattern repeats on the log forms (F-13).
- **Other cross-area overlaps (verifier):**
  - F-01 ↔ E-01; F-03/F-21 ↔ A-35/A-23; F-08 ↔ D-29, E-10; F-10 ↔ B-17.
  - F-13 ↔ E-12, B-23; F-15 ↔ B-10, D-19; F-16 ↔ C-07; F-19 ↔ B-16.
  - F-06 ↔ B-03, D-32, E-20 (Back styles and titles); F-20 ↔ B-12; F-25 ↔ A-24/A-25 (picker).
  - F-02 ↔ B-08, D-07 (no feedback after an action); F-26 ↔ A-27.

#### Dropped
- None. Nothing was dropped.
- Merges and corrections:
  - **Raw F-22's Group Log half:** merged into F-12 (same observation as 80-group-log-empty-save.png). F-22 keeps the Edit interaction half.
  - **Raw F-12:** recoded from DEAD to HID (the control works; the message is stale and misplaced).
  - **Raw F-16:** narrowed (the layout is week-aligned, but unlabeled).
  - **Raw F-23:** corrected (lifecycle rows are muted, not equal weight).
  - **Raw F-25:** 64-picker-kb.png/.xml removed from the evidence (it shows the Contacts grid).
  - **Raw F-26:** narrowed by the retest (Sparse/Dense swap, not "jump to top").
  - **Raw F-03:** citations corrected (`quick-log-command.ts:146` / :156).
- Not findings:
  - The stray "45 45 ft" in dump/screenshot 32 is an automation typing artifact.
  - The two debug JS reloads (typed "rr") during the audit were automation artifacts.
  - There is no `other-findings.md` for area F.

#### Routes covered
- **`LogContact` (Log Interaction): yes.** Reached from + on Contacts (picker), + on Profile (context), + on Digest (picker), the long-press card menu (seen), the History empty-day "Log interaction" (prefilled) and the Jump-to-month empty note "Log interaction".
- **`GroupLog`: yes.** Reached from + → Group Log, and from Contacts selection (3 selected) → Log Interaction.
- **`EditInteraction`: yes.** Reached from History → entry sheet → Edit. A group entry → Edit → "Edit individual interaction" opens `EditParticipant` (area B).
- **Quick Log: yes.** Reached from + (picker), + on Profile (no picker), + on Digest, long-press → Quick Log, row swipe right (list view) and bulk selection.
- **Post-log snackbar: yes.** Undo from 3 entry points; Add Note (Save, empty Save, Create Memory Instead → Edit Memory → Move to Recently Deleted).
- **Interaction detail sheet: yes.** ⋯ → Make this a group interaction (cancelled), Edit, Delete + confirm, and the group entry sheet (View Group Event, Edit choice).
- **History section: yes.** Cycles / 7 Days / Month / Year lenses, count chips, prev/next, heatmap day tap (jump), empty-day note, Jump to date (months with and without records), Show older, expanding year rows, knowledge-change rows (→ MemoryHistory), and a long history (History Long).
- **Not reached:** Contacts selection with exactly 1 selected → Log Interaction (`LogContact`). This was not tried; per the code, `HomeScreen.tsx:1181-1186` routes 1 selected to `LogContact`.

#### Could not check
- **Add Note keyboard.** Whether the Add Note text field opens the keyboard on its own on a real tap is unknown. Under adb, the field was focused but the keyboard didn't show. Twice, `input text` reached the app window, and a typed "rr" triggered a debug JS reload (an automation artifact, not an app bug; only that unsent note was lost). This needs a physical check.
- **Physical feel.** The 6 s snackbar window and the ~13 dp Year dots were only tried through adb, not by hand.
- **Quick Log on an Unbound or archived contact:** not attempted.
- **Photo picking:** not part of this area.

#### Zz UX items created / changed, and settings changed and restored (carried from the audit and retest)
- **Audit, Quick Logs and logs.** Interactions created on Zz UX Full Profile and then deleted: 9 Quick Logs (4:20–4:41); 1 backdated log (Oct 1, deleted); 1 Message log at 5:11, made only to reset the remembered channel to Message (deleted). 3 Quick Logs were undone and left nothing behind.
- **Audit, group event.** "Zz UX F group log test" (Full Profile + Zz UX Add Test) was created, then deleted via Events → ⋯ → Delete Group Event & Interactions.
- **Audit, bulk Quick Log.** The 4:57 bulk Quick Log on History Long, History Dense and History Sparse: all three entries deleted.
- **Audit, edited interaction.** The existing Full Profile interaction at 12:03 AM (Message, outbound) was edited to Call / inbound / Positive / 45m / note, then restored to Message / outbound / no tone / no duration / no note (connected on).
- **Audit, memory.** "Zz UX memo instead test" on Zz UX Full Profile was created via Create Memory Instead and moved to Recently Deleted. **It is still in Recently Deleted.**
- **Audit, note.** "Zz UX snack note via the Add Note sheet" was attached to a Quick Log that was later deleted.
- **Audit, settings.**
  - Theme went Galaxy dark → Galaxy light → Standard (its stored mode, Dark) → Standard light → back. The final state is Galaxy / Dark / Default accent / Deep Space, and Standard's stored mode is Dark again (149-appearance-final.xml).
  - The Contacts view went to list and back to card.
  - The History lens went to Year and back to Cycles.
  - The remembered log channel was restored to Message.
- **Audit, profile sections.**
  - History was expanded and collapsed again on Zz UX Full Profile and Ximena Hargrove.
  - Things to Remember on Full Profile was accidentally collapsed, then re-expanded.
  - If toggling sections adds the "Reset" item in ⋯ (D-25), it may now be present on those two profiles.
- **Retest.**
  - No interaction or group event was saved by R1 or R2.
  - R3's bulk Quick Log (6:15 AM, "unspecified") on History Dense, Long and Sparse was missed by Undo, so each entry was deleted through History; the cards show their original ages and order again (retest/r44-contacts-after-cleanup.xml).
  - Selection mode was left with Done.
  - The Contacts tab was restored to card view, All Contacts, no filters, Default sort, search cleared, 88 contacts (retest/r45-contacts-restored.png/.xml).
  - No settings were changed.
- **Left in place:** adb reverse `tcp:8081 tcp:8082`.
- **Screenshot labels.** Files `146-standard-light-*.png` are actually Standard **dark**. Correctly labelled copies are `146b-standard-DARK-*.png`, and real Standard light is `147-standard-light-real-*.png`.

---

## G — Things to Remember · final findings (finalizer, 2026-10-10)

**Counts:** DEAD 3 (High 1, Medium 2) · INC 5 (Medium 4, Low 1) · HID 7 (Medium 5, Low 2) · COPY 5 (Medium 2, Low 3) · LEFT 1 (Medium 1) · VIS 2 (Low 2) · A11Y 1 (Low 1). **Total 24: High 1, Medium 14, Low 9.**

Sources: `findings-raw.md` (audit), `verification.md` (21 confirmed, 2 dropped, 3 recheck), `retest-results.md` (3 of 3 reproduced, 0 inconclusive). Device: Pixel 6 Pro 1A071FDEE002BU, debug build. Default theme: Galaxy / Dark / Deep Space. Spot-checks: `T-*` files. All evidence paths are relative to `untracked/artifacts/ux-audit/G-things-to-remember/`. Retest evidence is under `retest/`.
Main fixture: **Zz UX Full Profile**.
- "TTR editor" means Profile → any Things to Remember pencil (route `ThingsToRemember`).
- "Memory screen" means + → Memory (route `Memory`).

**Raw → final ids:**

| Raw | Final | Raw | Final | Raw | Final |
|---|---|---|---|---|---|
| G-01 | G-01 | G-11 + G-26 | G-10 | G-19 | G-18 |
| G-03 | G-02 | G-12 | G-11 | G-20 | G-19 |
| G-04 | G-03 | G-13 | G-12 | G-21 | G-20 |
| G-05 | G-04 | G-14 | G-13 | G-22 | G-21 |
| G-06 | G-05 | G-15 | G-14 | G-23 | G-22 |
| G-07 | G-06 | G-16 | G-15 | G-24 | G-23 |
| G-08 | G-07 | G-17 | G-16 | G-25 | G-24 |
| G-09 | G-08 | G-18 | G-17 | | |
| G-10 | G-09 | | | | |

Raw G-02 is dropped (see "Dropped").

---

### G-01 · DEAD · High — Editing an "Imported from Contacts App" memory silently turns it into a plain Memory, even when you change nothing
- Where: Profile → "Imported from Contacts App" pencil → TTR editor → Imported from Contacts App group → tap "Met at the 2019 conference" → Edit memory
- What happens:
  1. The edit form opens with Memory type = "Memory", not "Imported from Contacts App". The card above the form is still labelled "Imported from Contacts App".
  2. Press Save memory without touching anything. The memory moves out of the "Imported from Contacts App" group into the "Memory" group and is now labelled "Memory".
  3. The Imported group disappears from the editor.
  4. Back on the Profile, the "Imported from Contacts App" section is still there, but it now reads "Nothing added yet". The memory has moved to Memories.

  Retest confirmed this with plain taps (reproduced). It was restored afterwards by setting the type back by hand.
- Why it's a problem: The user never asked to change anything, and the record of where the memory came from is lost silently. The Profile section the memory came from is left empty, which suggests something was deleted.
- Evidence:
  - Raw pass: 123-edit-imported-memory-type.png, 124-imported-edit-before-save.png, 125-imported-after-unchanged-save.png
  - Retest: retest/R1-01-profile-imported-before.png, retest/R1-02-ttr-editor-imported-group-before.png, retest/R1-03-edit-memory-form-type.png (dump: "Memory type, Memory"), retest/R1-04-before-unchanged-save.png, retest/R1-05-after-unchanged-save-groups.png, retest/R1-06-profile-after-unchanged-save.png
  - Restore: retest/R1-07-restored-editor.png, retest/R1-08-profile-restored.png
- Proposed fix:
  - Cause: `src/components/MemoryEditor.tsx:184-186`. `initialDraft` maps every type that isn't custom to `DEFAULT_MEMORY_TYPE_KEY` (`type: item?.type === "custom" ? "custom" : DEFAULT_MEMORY_TYPE_KEY`).
  - `MemoryRow.type` is a `string`, so `item?.type ?? DEFAULT…` would not type-check.
  - Use `type: item && isMemoryTypeKey(item.type) ? item.type : DEFAULT_MEMORY_TYPE_KEY`. `isMemoryTypeKey` is exported from `src/db/memory-registry.ts:66`.
  - Afterwards, an imported memory keeps its type and stays under "Imported from Contacts App" after any edit.

### G-02 · HID · Medium — In the TTR editor, a hidden memory has no "Hidden" badge, and its "Show on Profile" button floats below a different memory
- Where: TTR editor → "Show hidden items" on → Memory group (then "View all")
- What happens:
  - "Hidden note about birthday plans" looks exactly like a normal memory. "Pinned" and "Outdated" get badges; hidden gets none.
  - The only clue is a "Show on Profile" button placed after the whole group. After "View all" it sits directly under "Used to live in Denver", which is not hidden.
  - Tapping it unhides the birthday note with no confirmation.
- Why it's a problem: The user can't tell which memory is hidden or which one the button acts on. This adds to D-04 (Profile "Show hidden" doesn't work) and E-29 (hidden memories unmarked in Update → Memory). The same item is unmarked here too.
- Evidence: 24-show-hidden-on.png, 25-hidden-memory-in-editor.png, 26-view-all.png, 27-after-show-on-profile.png
- Proposed fix:
  - The Pinned/Outdated badges live in `src/components/MemoryCard.tsx:55-85`. Add a "Hidden" badge there.
  - "Show on Profile" is rendered after the group's list in `src/screens/ThingsToRememberScreen.tsx:649-668`. Move the per-card unhide action into `MemoryEditor`/`MemoryCard` so it sits inside the hidden memory's own card.
  - Afterwards each hidden memory is labelled, and its button acts visibly on that card.

### G-03 · INC · Medium — Each kind of item in this area is deleted a different way
- Where: TTR editor, Off Limits editor, Recently Deleted, Custom Fields, Categories
- What happens:

  | Item | Delete control | Confirmation | Undo / recovery |
  |---|---|---|---|
  | Memory | "Move to Recently Deleted" | None | Snackbar with Undo; recoverable for 30 days |
  | Key person | "Delete" (next to "Edit") | None | Snackbar "Relationship removed" with Undo; no Recently Deleted entry |
  | Off Limits item | ✕ | Unthemed Android dialog "Delete off-limits item? This can't be undone." (CANCEL / DELETE in caps) | None |
  | Recently Deleted entry | "Delete permanently" | Themed red dialog | None |
  | Custom field | Delete / Quarantine | Unthemed Android dialog "Delete field" or "Quarantine field" | Quarantine only |
  | Category | Delete | Themed sheet, then a second themed dialog | None |

- Why it's a problem: Similar items in one area differ in confirmation, undo, recoverability and look, so the user can't predict whether a tap is final. This extends E-08 and D-26 into Things to Remember.
- Evidence: 35-after-move-to-recently-deleted.png (+ .xml shows the snackbar), 46-keyperson-delete-tap.png (+ .xml "Relationship removed / Undo"), 63-offlimits-x-tap.png, 31-delete-permanently-confirm.png, 101-delete-field-confirm.png, 102-quarantine-confirm.png, 119-delete-category.png, 120-delete-category-with-contacts.png
- Needs investigation: choose one delete pattern for Things to Remember items (e.g. recoverable delete + Undo snackbar). Start in:
  - `src/screens/ThingsToRememberScreen.tsx` (remove / removeKeyPerson, ~344-436)
  - `OffLimitsEditorScreen.tsx`
  - `src/screens/CustomFieldsScreen.tsx:285-299`
  - `src/screens/CategoryManagementScreen.tsx`

### G-04 · DEAD · Medium — Android Back from "Edit field" / "New field" leaves Custom Fields altogether and silently drops your changes
- Where: Settings → Contacts & Relationships → Custom Fields → Edit (or New field)
- What happens:
  - The field editor has an in-app **Cancel** button at the bottom of the form, which returns to the Custom Fields list. It has no header Back; the header shows only the title "Edit field".
  - With an unsaved label change ("Zz UX Met via X"), Android Back (keyevent 4) jumps straight to Contacts & Relationships, skipping the Custom Fields list. There is no discard prompt.
  - Reopening Custom Fields shows the label unchanged ("Zz UX Met via"): the edit was silently dropped.
  - The retest reproduced this on Edit field with keyevent 4. It reproduced it again on New field ("Zz UX G05 new") with the system back gesture, which also landed on Contacts & Relationships with no prompt and created no field.
- Why it's a problem: Back should go one level back, to the list, as the in-app Cancel does. Instead, Android Back and the back gesture skip a level and discard the user's work without a warning. This is another unwarned discard, like E-01 / F-01. The missing header Back also differs from sibling Settings screens.
- Evidence:
  - Raw pass: 81-custom-field-edit-dropdown.png, 82-custom-field-edit-bottom.png (Cancel), 96-new-field-form.png (Cancel), 106-back-from-edit-field-unsaved.png
  - Retest, Edit field: retest/R2-00-custom-fields-list.png, retest/R2-01-edit-field-label-X.png, retest/R2-02-after-back-from-edit-field.png, retest/R2-03-list-label-after-back.png
  - Retest, New field: retest/R2-04-new-field-typed.png, retest/R2-05-after-back-gesture-new-field.png
  - Retest, in-app Cancel for contrast: retest/R2-06-after-in-app-cancel.png
- Proposed fix:
  - Cause: `src/screens/CustomFieldsScreen.tsx:109` holds the editor as local `editor` state (rendered at ~324-348), and the screen has no back handler, so Back pops the whole route.
  - While `editor !== null`, add a `BackHandler` / `usePreventRemove` that calls `setEditor(null)`, with a discard prompt if the form is dirty. Optionally add a header Back to match sibling screens.
  - Afterwards, Back returns to the Custom Fields list and warns before dropping changes.

### G-05 · HID · Medium — The field-type change dialog hides what will happen to existing values
- Where: Custom Fields → Edit "Zz UX Kids count" (Number) → Toggle → Save; and "Zz UX Nickname" (Text) → Number → Save
- What happens:
  - **Number → Toggle:** the dialog says "1 of 1 will convert automatically". Afterwards the Profile shows Kids count "2" as "Yes".
  - **Text → Number:** the dialog says "0 of 1 will convert automatically. 1 need your input — fix now or later." The only buttons are CANCEL / APPLY; there is no "fix now". After Apply, the Custom Fields list shows no warning.
  - The dialog is an unthemed Android alert, and "1 need" is ungrammatical.
  - The raw values survived: switching back restored "2" and "Fullie".
- Why it's a problem: The user can't see what the conversion does ("2" → "Yes"), and is offered a "fix now" that doesn't exist.
- Evidence: 85-type-change-save.png, 87-profile-kids-count-as-toggle.png, 90-text-to-number-dialog.png, 91-after-apply-needs-input.png
- Needs investigation: show before/after examples in the dialog and a real "Review now" path. Code locations, all in `src/screens/CustomFieldsScreen.tsx`:
  - The dialog text is built in `typeSummary` (73-78); the same "need your input — fix now or later" also appears in `optionsSummary` (81-86).
  - The dialog is raised in `handleEdit` (192-196) through `confirmSummary`, an `Alert.alert` wrapper (89-101).

### G-06 · HID · Medium — A value that "Needs attention" says so twice, and the Edit it points to shows no problem
- Where: Profile → Custom Fields after the Text → Number change → tap "Zz UX Nickname" → sheet → edit
- What happens:
  - The Profile card shows "Fullie / Needs attention / Needs attention" in plain grey caption text.
  - The sheet says "This value needs attention. Tap Edit to fix it."
  - Its "edit" opens Edit contact at the top (D-03). The Nickname field there shows "Fullie" with no error, hint or allowed format.
- Why it's a problem: The user is told to fix something but never told what is wrong, and the fix screen doesn't mark the field. "Needs attention" isn't styled as an error.
- Evidence: 92b-profile-needs-attention-twice.png, 93-needs-attention-sheet.png, 95-edit-contact-nickname-needs-fix.png
- Proposed fix (duplicate label):
  - `src/profile/knowledge-presentation.ts:298` puts "Needs attention" into `metadata`.
  - `src/components/profile/ThingsToRemember.tsx:159` renders `item.invalid` again.
  - Drop one of them and give the other an error colour.
- Needs investigation: an error state on the Edit contact custom-field input.

### G-07 · COPY · Medium — "Quarantine" is developer wording, and the same button reads "Delete" or "Quarantine" depending on hidden data
- Where: Settings → Custom Fields list
- What happens:
  - Each field shows Up / Down / Edit / **Quarantine**. A field nobody has filled shows **Delete** in the same place. The list never explains the difference.
  - Quarantined fields go to a "QUARANTINED" section labelled "quarantined · toggle" with Restore. It gives no date for when they will be removed. Only the confirm dialog mentions 30 days.
- Why it's a problem: "Quarantine" is a technical term. The button's meaning changes for a reason the user can't see.
- Evidence: 79-custom-fields-list.png, 99-new-field-in-list.png, 102-quarantine-confirm.png, 103-after-quarantine.png
- Needs investigation: plain wording, e.g. "Remove" plus "Removed fields (kept 30 days, until <date>)". Code in `src/screens/CustomFieldsScreen.tsx`: the Quarantine/Delete button is at 466-478; the "quarantined · <type>" row is at 511-513.

### G-08 · INC · Medium — Custom Fields and Categories, side by side under "Relationship Structure", manage lists completely differently
- Where: Settings → Contacts & Relationships → Custom Fields vs Categories
- What happens:

  | | Custom Fields | Categories |
  |---|---|---|
  | Reorder | Up / Down buttons | Long-press drag handle, or ⋯ → "Move earlier" |
  | Item actions | Edit / Quarantine buttons on each card | ⋯ menu: Rename / Move earlier / Delete |
  | Edit form | Full-screen editor with no header Back | Bottom sheet |
  | Dialogs | Unthemed Android | Themed |
  | Back button | Boxed "Back" | Plain "Back" |
  | Cancel wording | "Cancel" | "Keep current name" / "Discard new category" / "Keep category" |

- Why it's a problem: Two sibling settings screens for the same kind of job feel like different apps.
- Evidence: 79-custom-fields-list.png, 81-custom-field-edit-dropdown.png, 108-categories.png, 109-category-options.png, 110-category-rename.png, 113-add-category-sheet.png
- Needs investigation: pick one list-management pattern for both. Start in `src/screens/CustomFieldsScreen.tsx` and `src/screens/CategoryManagementScreen.tsx`.

### G-09 · INC · Medium — The TTR editor shows read-only and raw values for things it can't edit, and leaves out Off Limits
- Where: TTR editor → "Featured & current" and "Custom fields"
- What happens:
  - "Featured & current" lists Birthday "2026-10-13" (raw ISO), Contact Frequency, Category, Gravity "building" and "Intensity (closeness) 2× this period". None of them can be edited.
  - "Custom fields" is read-only and shows raw stored values: "Zz UX Coffee friend 1" where the Profile says "Yes", and "Pet photo" blank where the Profile says "Not available yet".
  - Off Limits isn't in this editor at all.
  - Birthday appears here (and in Digest → Horizon) but not on the Profile, which contradicts D-24.
- Why it's a problem: This screen is called the editor for Things to Remember, but half of what it shows can't be edited, values disagree with the Profile, and one Profile section is missing.
- Evidence: 10-ttr-editor-top.png, 11-ttr-editor-s1.png, 11-ttr-editor-s2.png, 05-profile-ttr-5.png, 92b-profile-needs-attention-twice.png, 71-picker-from-digest.png (Digest birthday)
- Proposed fix (raw values):
  - The screen builds `customValues` without the field type (`src/screens/ThingsToRememberScreen.tsx:214-218`), and 602-616 renders `item.value` raw.
  - Carry `definition.type` into `customValues` and render through `formatCustomFieldValue` (`src/profile/knowledge-presentation.ts:256`), which the Profile already uses. An unparseable value should show the same error state as on the Profile.
- Needs investigation: whether the read-only rows should be editable here or link to their editor.

### G-10 · LEFT · Medium — Three different memory lists for one person
- Where: (1) Profile → Memories card; (2) TTR editor; (3) + → Memory screen
- What happens:
  - **Profile:** groups as Pinned / Featured, Memories, Imported from Contacts App.
  - **TTR editor:** groups by type into separate cards ("Memory", "Imported from Contacts App", "Coffee order"; a custom label becomes its own section). It has "Show hidden items" and Recently Deleted.
  - **Memory screen:**
    - It is a flat list titled just "Memory" and never names the person.
    - It shows hidden memories unmarked (known E-29).
    - "Add memory" sits below every existing memory, so on Full Profile it is off-screen.
    - It offers "Move to Recently Deleted" with an Undo snackbar but has no link to Recently Deleted. The only way in is Profile → a section pencil → TTR editor → "Recently Deleted". After the snackbar disappears, a user who started from + → Memory has no clear way to find the deleted item. (Merged from raw G-26.)
- Why it's a problem: The same data is shown and edited three ways with different abilities. "+ → Memory" sounds like "add a memory", but it opens a list with the Add button at the bottom.
- Evidence: 03-profile-ttr-3.png, 04-profile-ttr-4.png, 11-ttr-editor-s3.png, 65-fab-memory-screen.png, 66-fab-memory-bottom.png, 72-memory-screen-empty.png, 76-memory-screen-after-delete.png, 10-ttr-editor-top.png
- Needs investigation: one memory list component, including a way into Recently Deleted. Start in `src/screens/MemoryScreen.tsx` and `src/screens/ThingsToRememberScreen.tsx`.

### G-11 · HID · Medium — After saving from + → Memory, you land on a different person's Profile
- Where: Digest → + → Memory → pick "Zz UX Add Test" → Add memory → type → Add memory
- What happens:
  - Save closes the Memory screen and drops you on whatever the Contacts tab had underneath. Here that was **Zz UX Full Profile**'s Profile.
  - Nothing confirms where the memory went. It was correctly saved to Zz UX Add Test.
  - The memory form never names the person either.
- Why it's a problem: The user saved something about one person and is now looking at another, so it seems the memory went to the wrong contact.
- Evidence: 69-fab-memory-from-digest-picker.png, 71-picker-from-digest.png, 72-memory-screen-empty.png, 73-after-fab-memory-saved.png, 74-memory-screen-addtest-after-save.png
- Needs investigation:
  - Cause pinned: `src/components/universal-fab-logic.ts:198-206` pushes `Memory` onto the **DashboardTab** (Contacts) stack, even from Digest.
  - `src/screens/MemoryScreen.tsx` then calls `navigation.goBack()` after Save (`savedTick` effect) without a success snackbar, so the user lands on whatever that stack had underneath.
  - Fix direction: after Save, stay on the Memory screen (or go to the chosen person's Profile) and show a snackbar naming the person.

### G-12 · DEAD · Medium — Back on the Memory screen throws away a typed new memory without warning
- Where: Profile → + → Memory → Add memory → type text → Android Back (or the header Back)
- What happens:
  - With "Zz UX G13 draft" typed into "What should you remember?", Android Back (keyevent 4) returns to the Profile with no prompt.
  - Reopening + → Memory shows no saved draft, and the add form has been reset to the "Add memory" button.
  - The in-app header Back does the same: it lands on the Profile with no prompt and the draft is lost.
  - Reproduced on retest by both methods.
- Why it's a problem: This is the same silent discard as E-01 / F-01, in a new place.
- Evidence:
  - Raw pass: 67-fab-memory-add-form.png, 68-back-with-unsaved-memory.png
  - Retest, keyevent 4: retest/R3-01-typed-draft-visible.png (typed text visible), retest/R3-02-after-back.png, retest/R3-03-memory-screen-no-draft.png
  - Retest, header Back: retest/R3-04-typed-draft-method2.png, retest/R3-05-after-header-back.png, retest/R3-06-memory-screen-no-draft-method2.png
- Needs investigation: `src/screens/MemoryScreen.tsx` has no `beforeRemove` / `usePreventRemove`, and the draft lives in `MemoryEditor` state. Add a discard confirmation when the draft isn't empty.

### G-13 · HID · Medium — Memory "Link" and "Meaningful date" accept anything; a bad link opens a browser error page
- Where: TTR editor → Add memory → Link "not a url", Meaningful date "banana" → Add memory
- What happens:
  - Both values save with no warning.
  - The card shows "banana" as an unlabelled grey line under the memory text, and the same on the Profile and the Memory screen.
  - "Open link" opens Chrome on "This site can't be reached / not%20a%20url".
  - The Profile shows only the word "Link" (known D-23).
- Why it's a problem: A typo becomes a broken link and a meaningless "date", and the date has no label to explain it. Custom date fields have the same free-text problem (E-17).
- Evidence: 21-add-memory-filled.png, 22b-saved-banana-date.png, 23-open-invalid-link.png, 57-profile-long-memory-sheet.png
- Needs investigation: validate the URL (or add https://) and use a date picker for the meaningful date. Start in `src/components/MemoryEditor.tsx`: the link and date inputs have no validation, only `keyboardType="url"`.

### G-14 · HID · Low — "Allow AI to use this" saves the moment you tap it, even if you then press Cancel
- Where: TTR editor → tap the pinned memory → Edit memory → toggle "Allow AI to use this" → Cancel → reopen
- What happens:
  - After Cancel the toggle is still on.
  - The other toggles in the same form (Pin, Mark outdated, Hide) wait for Save.
  - The Add memory form has no AI toggle at all.
  - It was turned back off afterwards.
- Why it's a problem: Cancel doesn't cancel everything, and this change concerns what the AI may read. This is E-08's pattern in the memory form.
- Evidence: 126-allow-ai-toggle.png, 127-allow-ai-after-cancel.png
- Needs investigation:
  - Cause: in `src/components/MemoryEditor.tsx:451-460`, the Switch's `onValueChange` calls `onSetAllowAi` immediately (the write is at 459). Pin, Outdated and Hide only `update()` the draft.
  - Fix direction: fold Allow AI into the draft and save it with Save.

### G-15 · INC · Medium — "Last talked about" values: two different "Set new value" forms, duplicate entries, and entries can never be deleted
- Where: TTR editor → Last talked about → "Set new value" / "History" (MemoryHistory route)
- What happens:
  - **Inline in the editor:** a one-line box + Save, with no Cancel. Save is enabled when the box is empty and then does nothing.
  - **History screen:** Save is disabled when empty, and there is a Cancel.
  - **Duplicates:** setting a value adds a new history entry even if that value already exists ("Their trip to Lisbon" appears 3 times).
  - **No delete:** an entry can be edited but not deleted, and Save is disabled if you clear it. The test entry "Zz UX G topic" is now stuck in the history.
  - **Wording:** the current value is labelled "MOST RECENT" (Profile), "Most recent" (editor) and "most recent" (history).
- Why it's a problem: The same action behaves differently on two screens, and the user can't clean up mistakes. This adds detail to E-07.
- Evidence: 47-set-new-last-talked.png, 48-save-empty-current-value.png, 50-memory-history-last-talked.png, 51-after-make-current.png, 52-history-entry-edit.png, 53-history-entry-emptied.png, 54-history-set-new-value.png, 02-profile-ttr-1.png
- Needs investigation: start in `src/screens/ThingsToRememberScreen.tsx` and `src/screens/MemoryHistoryScreen.tsx`.
  - The inline Save has no `disabled` prop (`ThingsToRememberScreen.tsx:583-595`), and `saveCurrentValue` returns silently on empty (277-279).
  - The History screen disables Save when empty (`MemoryHistoryScreen.tsx:211, 269`).

### G-16 · INC · Low — Key person: the linked contact's name isn't shown while editing, and pinning isn't marked
- Where: TTR editor → Add key person → "Link Orbit contact (optional)" → pick "Zz UX Add Test"; and Edit → Pin → Save
- What happens:
  - **Linking:**
    - After picking a contact, the form shows only "Change linked Orbit contact" / "Clear linked contact". It never names the contact.
    - The Name field isn't filled in, and Save stays disabled until you type a name.
    - The list shows "Linked to Zz UX Add Test" only after saving (same as E-14 on Add Contact).
  - **Pinning:** a pinned key person appears under the Profile's "Pinned / Featured" with no "Pinned" badge, while memories get one. In the editor it has no badge either, and "Featured & current" doesn't list it.
- Why it's a problem: The user can't confirm the link before saving, and pinned key people look the same as unpinned ones.
- Evidence: 43-after-link-pick.png, 45-keypeople-with-linked.png, 39-keyperson-after-pin-in-ttr.png, 40-profile-pinned-after-keyperson-pin.png
- Needs investigation: `src/components/RelationshipEditor.tsx`.

### G-17 · COPY · Low — Pin/hide help text is developer wording and differs between memories and key people
- Where: Memory form; key person form
- What happens:
  - Memory form: "Hide from Profile — This is presentation only."
  - Key person form: "Presentation only — this doesn't hide it from search or AH." (the "AH" is known E-15), plus an unexplained "Use default visibility".
  - The memory toggle says "Pin memory"; the key person toggle just "Pin".
- Why it's a problem: "Presentation only" means nothing to a user, and the same control is explained differently.
- Evidence: 14-memory-inline-edit-bottom.png, 37-keyperson-edit-bottom.png
- Proposed fix: replace the text at `src/components/MemoryEditor.tsx:426` and `src/components/RelationshipEditor.tsx:237` with one shared sentence, e.g. "Still saved and searchable; just not shown on the Profile." Afterwards both forms read the same.

### G-18 · VIS · Low — Inline edit forms open away from the tapped card, and the Memory screen's buttons wrap badly
- Where: TTR editor → tap any memory; Memory screen → tap a memory
- What happens:
  - The "Edit memory" form appears at the bottom of the group, not under the tapped card. Tapping the 1st of 3 opens the form below the 3rd.
  - On the Memory screen, "Move to Recently Deleted" and "Cancel" share a row, and "Save" drops alone to the next row, at the bottom edge near the gesture bar.
- Why it's a problem: The user loses track of which item they are editing, and the main action is the hardest to reach.
- Evidence: 12-memory-edit-sheet.png, 28-edit-form-placement.png, 75-memory-screen-edit-buttons.png, 75b-memory-screen-edit-buttons-bottom.png
- Needs investigation: in `src/components/MemoryEditor.tsx`, the form renders after `items.map(...)` (~283-290), and the `actions` row is `flexWrap: "wrap"` (line 548).

### G-19 · HID · Low — Choosing "Custom" memory type disables Save without saying why
- Where: TTR editor → edit a memory → Memory type → Custom
- What happens:
  - An empty "Memory label" field appears, and Save turns grey.
  - The field is scrolled off-screen when you reach Save, and there's no message.
  - Tapping the grey Save does nothing.
  - By contrast, Add Category says "Enter a category name."
- Why it's a problem: The user can't tell what is missing.
- Evidence: 16-memory-type-custom.png, 17-custom-empty-label-save-disabled.png, 17b-after-tap-disabled-save.png, 114-add-category-empty.png
- Needs investigation: `canSave` (`src/components/MemoryEditor.tsx:276-280`) requires a custom label, and no message is rendered. Show "Enter a label" under the field, and keep Save tappable so a tap reveals the message.

### G-20 · COPY · Medium — Deleting a category shows a wall of internal jargon and needs two "Keep" taps to back out
- Where: Settings → Categories → ⋯ on "Zz UX Friends" (2 contacts) → Delete
- What happens:
  - The sheet says: "Pending, completed, and discarded imports move to the same target. Only this category's rule or reference is removed from each custom System; unrelated rules stay. An emptied invalid System becomes Needs Attention. Profile and saved presentation settings are removed, not transferred."
  - "Review deletion" opens a second dialog. "Keep category" there returns to the first sheet, which needs another "Keep category".
  - For an empty category, the dialog body just repeats the title ("Delete X? Delete X? This can't be undone.").
  - Only the wording was judged; the Systems builder itself is known item N-10.
- Why it's a problem: Users can't judge the consequences from this text, and backing out takes two taps.
- Evidence: 120-delete-category-with-contacts.png, 121-review-deletion.png, 122-after-keep-category.png, 119-delete-category.png
- Needs investigation: `src/screens/CategoryManagementScreen.tsx` (~770-830, the delete preview copy and the two-step flow).

### G-21 · VIS · Low — The + button covers "Create field" and the AI explanation on the field editor
- Where: Settings → Custom Fields → New field / Edit field
- What happens: The + button sits over the right half of "Create field" and over the end of the "Share with AI suggestions" explanation. This is the same cross-area overlap as A-10 / C-14 / D-18; flag it for the cross-cutting merge.
- Why it's a problem: The form's main action and its explanation are partly hidden.
- Evidence: 96-new-field-form.png, 81-custom-field-edit-dropdown.png
- Needs investigation: hide the + button on focused editors, as on other form routes (focused-route classification).

### G-22 · COPY · Low — New-field hints and type names
- Where: Settings → Custom Fields
- What happens:
  - The label placeholder is "e.g. Birthday", but Birthday is already a built-in field.
  - Field types show lowercase in the list ("dropdown", "toggle", "quarantined · toggle") but capitalised in the editor chips ("Dropdown").
- Why it's a problem: The hint suggests creating a field that already exists, and the same type is written two ways.
- Evidence: 96-new-field-form.png, 79-custom-fields-list.png, 81-custom-field-edit-dropdown.png, 103-after-quarantine.png
- Proposed fix:
  - Change the placeholder at `src/components/FieldDefForm.tsx:228` to something like "e.g. Favourite food".
  - The list renders the raw lowercase `field.type` at `src/screens/CustomFieldsScreen.tsx:418` and 512. Reuse the editor's capitalised type labels there.

### G-23 · COPY · Low — Section names and small labels differ between the Profile and its editor
- Where: Profile Things to Remember vs TTR editor vs Recently Deleted
- What happens:
  - Profile vs editor labels: "Pinned / Featured" vs "Featured & current"; "Memories" vs "Memory"; "Key People" vs "Key people"; "Custom Fields" vs "Custom fields".
  - The key-person delete snackbar says "Relationship removed".
  - Recently Deleted shows raw timestamps ("Deleted 2026-10-10 04:38:09"). The 30-day auto-removal is explained only when the list is empty.
- Why it's a problem: The same sections have different names on the two screens, the snackbar uses yet another term, and the auto-removal rule is hidden while the list has items.
- Evidence: 02-profile-ttr-1.png, 10-ttr-editor-top.png, 11-ttr-editor-s2.png, 11-ttr-editor-s3.png, 30-recently-deleted.png, 33-after-restore.png, 46-keyperson-delete-tap.xml
- Needs investigation: shared labels from `src/profile/module-registry.ts`; date formatting in `src/screens/RecentlyDeletedScreen.tsx`.

### G-24 · A11Y · Low — Memory cards are announced as "Edit Memory memory" in the editor and Memory screen
- Where: TTR editor; Memory screen (uiautomator content-desc)
- What happens:
  - Every general memory card reads "Edit Memory memory": twice in the editor dump, four times in the Memory screen dump.
  - Other types read e.g. "Edit Coffee order memory".
  - The memory's text isn't announced.
  - This extends D-30 (Profile) into both editors.
- Why it's a problem: A screen-reader user hears the same meaningless label for every memory and can't tell them apart.
- Evidence: 11-ttr-editor-s3.xml, 65-fab-memory-screen.xml (dumps saved with the matching .png names)
- Proposed fix: the label is set in `src/components/MemoryCard.tsx:139` (`` `Edit ${memoryTypeLabel(memory)} memory` ``). Change it to "Edit memory: <value>", optionally with the type. Afterwards each card announces its own text.

---

#### Known items seen again
- **999.6 (moving entries between Things to Remember sections):**
  - Not re-reported (raw G-02): the Memory type picker offers Memory / Imported from Contacts App / Custom, so a user can file their own memory as "Imported from Contacts App" (15-memory-type-picker.png, 08-profile-imported-expanded.png).
  - **New detail:** after a user picks "Imported…", the memory's own edit form still says "Added by you" (124-imported-edit-before-save.png, 14-memory-inline-edit-bottom.png), while the Profile files it under "Imported from Contacts App". The Profile therefore misstates where the memory came from.
  - Related: G-01 is the opposite direction, where a real imported memory loses its type on an unchanged Save.
- **999.3:** the Off Limits editor was seen. "Add fuel" defaults Kind to Topic, and deleting uses an unthemed Android dialog (part of G-03). No other new detail.

#### Notes on earlier findings seen again (evidence notes, not re-reported)
- **D-01, D-03:** the Profile item sheet's "edit" on custom fields and key people still opens Edit contact at the top (58-, 59-, 94-). "pin" and "Hide from Profile" were not re-tested.
- **D-04:** Profile "Show hidden" is unchanged. G-02 shows the editor side of the same problem.
- **D-23:** confirmed that the Profile shows only "Link" (56-, 57-).
- **D-24:** Birthday is shown in the TTR editor and in Digest, but not on the Profile (see G-09).
- **E-07:** see G-15.
- **E-08:** see G-14.
- **E-14:** see G-16.
- **E-15:** "AH" also appears in the TTR editor's key person form (37-).
- **E-17:** the custom date preview is free text "YYYY-MM-DD" (97-).
- **E-29:** the Memory screen (+ → Memory) shows hidden memories unmarked too (65-). See G-10.
- **F-25:** the + → Memory contact picker also keeps the previous search ("Zz UX Add") between opens (71-).

#### Note for the cross-cutting pass (not a finding; not verified on device)
- **Possible Uncategorized count mismatch:**
  - Categories shows "Uncategorized 100 contacts" next to "Zz UX Friends 2 contacts" (108-categories.png), on a 100-contact subset where the Contacts tab shows 88 under All Contacts.
  - `countUncategorizedContacts` (`src/db/categories-dao.ts:105-112`) counts every `contacts` row with a NULL category, including archived, deleted and Unbound contacts.
  - So the number may not match what the Contacts tab shows. Worth comparing during the cross-cutting pass.

---

#### Dropped
- **Raw G-02** (INC Medium, "users can file their own memory as Imported"): known item 999.6 (owner prompt §3.5). The new "Added by you" detail is under "Known items seen again".
- **Raw G-26** (HID Low, "Recently Deleted reachable only from the TTR editor"): duplicate within the area. Merged into G-10 (raw G-11), keeping evidence 76.

#### Routes covered
- **ThingsToRemember** — yes (Profile → any Things to Remember pencil).
- **Memory** — yes (+ → Memory from the Profile, from Digest via the contact picker, and from the Contacts list).
- **MemoryHistory** — yes (TTR editor → Last talked about / Current location → History).
- **OffLimitsEditor** — yes (Profile → Off Limits pencil).
- **RecentlyDeleted** — yes (TTR editor → Recently Deleted). Restore, Delete permanently and the empty state were all exercised.
- **CustomFields** — yes (Settings → Contacts & Relationships → Custom Fields). New, edit, type change ×4, reorder, delete, quarantine and restore were all exercised.
- **CategoryManagement** — yes (Settings → Contacts & Relationships → Categories). Add (empty and long names), rename (duplicate name), the options menu and delete (empty, and with contacts → Review → Keep) were all exercised.
- Not checked through the Update Contact → Memory entry (covered by area E).

#### Could not check
- **Photo-type custom fields:** photo picking was not exercised (personal library). Stopped at the "Add photo" / "Paste image URL" buttons in Edit contact; the Pet photo field was not filled.
- **Category drag-reorder** (long-press the ⇅ handle): `adb input touchscreen swipe` can't do a long press followed by a drag. "Move earlier" in the ⋯ menu was used instead. Custom-field Up worked.
- **Allow AI toggle with AI configured:** not tested, because no AI provider may be connected (audit rule).
- **Off Limits editor:** looked at only lightly (known 999.3).
- **Swipe and long-press gestures** on Things to Remember cards: none are disclosed. Long-press on cards was not tried.
- **Automation artifact (not a finding):** twice, `adb input text` sent while no field had focus reloaded the debug JS bundle (the app went back to Digest). This is likely the dev "RR" reload key, not a user-facing bug. Once, Google Clock came to the foreground during a stray `input text`; nothing in Clock was tapped.

---

## Area H — People lifecycle and import — final findings

Finalizer (no device), 2026-10-10. Sources: `findings-raw.md` (audit), `verification.md`, `recheck-list.md`, `retest-results.md` (5 of 5 reproduced). Device: Pixel 6 Pro, debug build, Galaxy / Dark / Deep Space. Evidence paths are relative to `untracked/artifacts/ux-audit/H-people-lifecycle-import/`; retest evidence is in `retest/`.

**Counts: 29 findings.** By code: DEAD 4 · INC 5 · HID 11 · COPY 8 · VIS 1. By severity: High 2 · Medium 19 · Low 8.

Overlaps with other areas, for the cross-cutting pass:
- H-01 **supersedes D-35** (Profile area). The cross-cutting pass should keep H-01 and fold D-35 into it.
- H-23 extends D-02, and fixing D-02 also fixes H-23.
- H-24 extends D-06.
- H-20 extends D-28.
- H-21 extends D-27.
- H-03 carries only new detail beyond the known §3.5 item "tapping a possible match does nothing".

---

### H-01 · DEAD · High — The Archived list on the Contacts tab never refreshes, and stale rows then fail Restore and Delete forever with "Please try again"
- Where: Contacts → ⋯ → Archived Contacts (`Archived`, Contacts stack).
- What happens:
  - (a) I opened Archived, used + → Add Contact to create a person, bound them and archived them from their Profile. Archive returned to the Archived list, which still said "1 archived contact" and didn't show the person. Leaving and reopening showed 2.
  - (b) With Archived left open on the Contacts tab, I restored the person from Settings → Contacts & Relationships → Archived contacts. Back on the Contacts tab, the list still showed them.
  - (c) Restore on that stale row shows "Couldn't restore / Please try again", and the row stays after OK. Delete permanently shows the confirm dialog, then "Couldn't delete / Please try again". The row never goes away, so retrying leads nowhere. No data is harmed: `restoreContact` (`contacts-dao.ts:959-972`) and `purgeContact` (`purge-dao.ts:356-380`) both refuse a contact that is no longer archived.
- Why it's a problem: the list shows the wrong set of archived people, and its error text invites endless retries. The sibling Unbound list (`UnboundContactsScreen`) does refresh on focus.
- Supersedes D-35, which covers only case (b), seen once, with nothing tapped.
- Retest (reproduced, all 4 checks):
  - The archive done from this list is not shown: `retest/R1-02-after-archive-landing.png/.xml` (still 1). Reopening shows 2: `R1-03`.
  - After the restore in Settings (`R1-04`), the Contacts-tab list still shows "2 archived contacts": `R1-05-contacts-tab-archived-stale.png/.xml`.
  - Restore on the stale row → "Couldn't restore": `R1-06-stale-restore.png/.xml`.
  - Delete permanently → confirm (`R1-07`) → "Couldn't delete": `R1-08-stale-delete-result.png/.xml`.
  - Plain taps fired every time.
- Evidence: 21-archive-immediate.png, 22-after-archive.png (.xml), 23-archived-reopened.png (.xml), 36-settings-archived-after-restore.png, 37-contacts-tab-archived-stale.png, 38-restore-stale-row.png, 39-after-restore-error-ok.png, 40-delete-permanently-confirm.png, 41-after-delete-stale.png, 30-after-archive-from-unbound-stack.png; retest/R1-01 … R1-08 (.png/.xml).
- Proposed fix: in `src/screens/ArchivedContactsScreen.tsx:121-123`, load on focus instead of on mount: `useFocusEffect(useCallback(() => { void load(); }, [load]))`, as `UnboundContactsScreen.tsx:43` does. Also call `load()` in the catch blocks of `doRestore` (:134-137) and `doPurge` (:189-192). A row that is no longer archived then disappears instead of erroring. The user will see the list match reality every time it is shown, and will no longer hit a dead "Please try again".

### H-02 · DEAD · High — "Link to Existing" in Review matches opens a list that runs off the screen, with no title, no scrolling and no Cancel; the real match can't be reached
- Where: Settings → Contacts & Relationships → Import contacts → pick `ZZ-UAT-*` contacts → Import → Review possible matches (`DuplicateReview`) → long-press "ZZ-UAT-R3-Renamed" ("Matching phone number") → "1 selected · Choose action" → Link to Existing.
- What happens:
  - A centred sheet opens that is taller than the screen. Its first row starts at y=0 under the status bar, and its title ("Choose an existing contact", `ExistingContactChoice.tsx:58`) is laid out off-screen.
  - Swiping does not scroll it.
  - There is no Cancel; only Android Back closes it, and Back also clears the selection.
  - Every visible row says "Similar name". The phone-number match that the card advertised is not among them, so the card can't be linked to the right person.
- Why it's a problem: this is the main action of the possible-match screen, and it can't be completed correctly.
- Retest (reproduced):
  - The link sheet (`retest/R2-04-link-sheet.png/.xml`) has no title node and no Cancel/Close node. Its first row has bounds `[144,0][1297,205]`, and its last row ends at y=3094, in the gesture zone.
  - Four swipes, two with `input swipe` and two with `input touchscreen swipe`, left the row bounds identical (`R2-05…R2-08-*.xml`).
  - All 11 visible rows say "Similar name".
  - Back closes the sheet (`R2-09-after-back.png/.xml`).
- Evidence: 66-dup-choose-action-sheet.png, 67-after-link-to-existing.png (.xml), 68-link-picker-top.png (.xml), 69-link-picker-bottom.png; retest/R2-03-review-matches.png, R2-04 … R2-09.
- Proposed fix:
  - In `src/components/ExistingContactChoice.tsx:47-90` (the component imports no `ScrollView`, :16), wrap the `choices.map` in a `ScrollView` with a `maxHeight` (for example 70% of the window), and add a Cancel button that calls `onClose`.
  - In `choicesForRow` (`src/screens/DuplicateReviewScreen.tsx:63-82`), sort the phone- or email-match candidate first. The candidates currently come in matcher order (`existing-contact-choices.ts`, no sort).
  - The user will see a titled, scrollable list with the matching person at the top and a way out.
  - Minor: the sheet uses raw `Text`, not `AppText`.

### H-03 · HID · Medium — Review-match cards don't say which Orbit contact they match, and the only way to act is an undisclosed long-press
- Where: `DuplicateReview` ("Review matches").
- Scope: the known §3.5 item "tapping a possible match does nothing" is excluded. This finding covers only the new detail.
- What happens:
  - A long-press is the only way to act on a card. It selects the card and shows a "1 selected · Choose action" bar, which leads to Link to Existing / Import as New / Skip. Nothing on screen hints at the long-press. In code, `CandidateCardGrid.tsx:204-207` sends `onPress` to `onInspect`, which `DuplicateReviewScreen.tsx` sets to `() => undefined`.
  - The card never names the Orbit person it might match. It renders only the phone contact's name, a "Needs review" chip and a truncated reason ("Matching phone num…").
  - After Skip or Import as New, the card disappears with no message.
  - A lone card stretches to full width (`card: { flex: 1 }`).
- Why it's a problem: the user can't judge a match without seeing both sides, and can't find the actions.
- Evidence: 63-duplicate-review.png, 65-dup-card-longpress.png, 66-dup-choose-action-sheet.png, 71-after-skip.png, 72-after-import-as-new.png.
- Needs investigation: `src/screens/DuplicateReviewScreen.tsx` with `src/components/CandidateCardGrid.tsx`. Show the matched Orbit name on the card, and give each card visible actions.

### H-04 · COPY · Medium — "Check complete" counts contacts as "interactions"
- Where: Settings → Contacts & Relationships → Check linked contacts → resolve all → `ReconcileComplete`.
- What happens: the screen reads "Checked 14 interactions, Changed 11 interactions, Updated 0 interactions, Kept Orbit values 9 interactions, Source missing 2 interactions". The counts are per card, which means per contact (`reconcile-session-read.ts:200-244`).
- Why it's a problem: the word is wrong, and it collides with the app's main meaning of "interaction", a logged conversation.
- Evidence: 105-after-bulk-keep.png; retest/R3-08-after-keep.png.
- Proposed fix: in `src/screens/ReconcileCompleteScreen.tsx:24-26`, change `interactionLabel` to return `${count} contact${count === 1 ? "" : "s"}`. The user will see "14 contacts" and so on.

### H-05 · DEAD · Medium — Check linked contacts doesn't keep decisions: the next check lists every card again, and "Updated" says 0 after an Apply
- Where: Check linked contacts (`ReconcileGrid`) → resolve the cards → Check complete → Done → open Check linked contacts again.
- What happens:
  - I resolved every card: Apply on one contact's detail screen, "Keep as is" on a Source-missing card, and bulk "Keep Orbit Values" on the rest.
  - The summary showed "Updated 0", even though I had applied a change.
  - Reopening Check linked contacts straight away showed the same cards with the same "N differences left", including the ones just resolved.
- Why it's a problem: the user's work seems to vanish, and the check can never be finished.
- Retest (both parts reproduced):
  - Starting grid: 11 cards (`retest/R3-01-grid.png/.xml`).
  - A detail Apply on ZZ-UAT-Clean (`R3-04`), then bulk Keep Orbit Values on the other 10 (`R3-07`), gave "Checked 13 · Changed 11 · **Updated 0** · Kept Orbit values 10 · Source missing 2" (`R3-08-after-keep.png/.xml`).
  - Done, then reopening Check linked contacts: **all 11 cards are back**, including ZZ-UAT-Clean, each with the same difference count (`R3-09-recheck-grid.png/.xml`).
- Evidence: 97b-apply-moved-after-select.png, 102-after-keep-as-is.png, 105-after-bulk-keep.png, 107-check-linked-empty.png, 108-smoke-ada-reappears.png; retest/R3-01 … R3-09.
- Partial cause (verifier, code): the detail-screen Apply (`src/screens/ReconcileDetailScreen.tsx:377-392`) marks the card's status but never writes `completionDisposition`. Only the grid's bulk path does (`src/screens/ReconcileGridScreen.tsx:400-407`), so a detail Apply can never count as "Updated".
- Needs investigation: why resolved and kept cards come back on the next check. Start with the reviewed-snapshot comparison in `src/logic/reconcile-diff.ts` and `src/db/reconcile-snapshot-dao.ts`.

### H-06 · INC · Medium — Choosing the phone's email in "Update from Contacts" adds it instead of replacing, and the Orbit option then shows a garbled value
- Where: Check linked contacts → ZZ-UAT-Smoke-Ada → Email addresses (Orbit "zzuat.ada@zzuat.test" vs phone "zzuat.ada2@zzuat.test") → select the phone value → Apply.
- What happens:
  - After Apply, the Profile's Contact Methods lists both emails.
  - The card stays at "1 difference left".
  - The Orbit option renders as a run-together "emailzzuat.ada@zzuat.testemailzzuat.ada2@zzuat.test": type words and values glued together with no separator.
- Why it's a problem: picking one value looks like "use this one", but the app keeps both. The Orbit side then becomes unreadable, so the user can't tell what they have.
- Evidence: 96-reconcile-detail-smoke-ada.png, 99-after-reconcile-apply2.png, 108-smoke-ada-reappears.png, 109-apply-once.png, 111-smoke-ada-contact-methods.png.
- Cause (verifier, corrected citation): for phones and emails, `orbitBaseline` is the internal serialization from `serializeMethodFamily(...)` (`src/logic/reconcile-diff.ts:102-122`, used at :277 and :303). `ChoiceRow` renders that raw string as the option text (`src/screens/ReconcileDetailScreen.tsx:600-605`).
- Proposed fix: render the Orbit option for method families from the parsed methods, one value per line. The user will see the existing email(s) as readable addresses.
- Needs investigation: the add-instead-of-replace Apply behaviour, in `reconcile-apply.ts`.

### H-07 · HID · Medium — Apply in "Update from Contacts" gives weak feedback, stays enabled and jumps; Keep as is behaves differently
- Where: `ReconcileDetail`.
- What happens:
  - Apply starts disabled with no reason given. It enables only once every field has a choice.
  - After Apply, the screen stays put with a small grey "Changes applied." line, and Apply is still enabled, so it can be pressed again. I applied more than once by accident.
  - That message renders above Apply and pushes it down about 130 px, so a second tap aimed at the old spot misses.
  - "Keep as is" on a Source-missing card returns straight to the grid instead.
  - Options don't look selectable (no radio) until tapped.
- Why it's a problem: the user can't tell when they're done, and it's easy to apply twice.
- Evidence: 83-reconcile-tap-card.png, 84-reconcile-pick-name.png, 85-reconcile-both-picked.png, 96-reconcile-detail-smoke-ada.png vs 97b-apply-moved-after-select.png, 99-after-reconcile-apply2.png, 101-source-missing-detail.png, 102-after-keep-as-is.png.
- Code (verifier, corrected citations):
  - Selecting an option does not move Apply (83→84→85). The jump comes from the message at `ReconcileDetailScreen.tsx:564-566`.
  - Apply stays put after success (:399).
  - Keep as is calls `keepMissingSource` → `goBack` (:267-279).
- Needs investigation: `src/screens/ReconcileDetailScreen.tsx`. Return to the grid after a successful Apply, as Keep as is does.

### H-08 · INC · Medium — Import, reconcile and merge screens each use a different header and Back style, and several have no Back at all
- Where: the Settings → Contacts & Relationships sub-flows, plus the Unbound and Archived lists.
- What happens:
  - Review import, Import contacts and Review matches use a boxed "Back" button beside the title.
  - Review flagged items (`BulkReview`) puts a boxed Back on its own line above the title. (Merged from raw H-29. Its empty state, "Nothing to review / No flagged items right now.", is fine.)
  - Update from Contacts uses plain grey "Back" text on its own full-width line.
  - These screens have no Back or Cancel at all; only Android Back works: Check linked contacts, Import complete, Check complete, "Choose a contact to merge", "Which contact survives?", "Resolve merge conflicts" and "Merge … into …".
  - The Unbound and Archived lists use yet another style, the `ShellAppBar` "Back".
- Why it's a problem: there are six or more header patterns in one area, and no on-screen way out of the merge and check screens.
- Evidence: 54-import-review-single.png, 60-bulk-import-setup.png, 63-duplicate-review.png, 80-review-flagged.png, 81-check-linked.png, 83-reconcile-tap-card.png, 86-merge-entry.png, 88-survivor-select.png, 89-merge-conflicts.png, 90-merge-impact-summary.png, 105-after-bulk-keep.png, 02-unbound-list.png, 19-archived-list.png.
- Needs investigation: move these screens, including the `src/screens/BulkReviewScreen.tsx` header, onto the shared `ShellAppBar` used by `ArchivedContactsScreen`.

### H-09 · HID · Medium — Merging two people is reachable only from Settings → Check linked contacts → a card → grey "Merge with another contact" text
- Where: `ReconcileDetail` → `SurvivorSelect` → `MergeConflicts` → `MergeImpactSummary`.
- What happens:
  - There is no merge entry on the Profile, its ⋯ menu, the Contacts list, selection mode, or the Review matches actions.
  - The one visible entry is a grey line of text under the contact name on "Update from Contacts" that doesn't look tappable.
  - It exists only for phone-linked contacts that currently have differences, so an Orbit-only duplicate can't be merged at all.
  - The only `navigate("SurvivorSelect")` callers are `ReconcileDetailScreen.tsx:322` (the relink alert) and :508 (the grey text).
- Why it's a problem: duplicate cleanup is a core CRM task, and it is effectively hidden.
- Evidence: 83-reconcile-tap-card.png, 32-settings-contacts-bottom.png, 07-unbound-profile-menu.png, 11-bound-profile-menu.png.
- Needs investigation: add a "Merge with…" entry to the Profile ⋯ menu that routes to `SurvivorSelect`.

### H-10 · COPY · Medium — Merge flow wording is developer language and contradicts itself
- Where: `SurvivorSelect`, `MergeConflicts`, `MergeImpactSummary` and the confirm dialog.
- What happens:
  - "Which contact survives?" shows a "Recommended" chip, a ✓ and a "✓ Will survive" line on one card. The other card says "Keep this contact", although it won't be kept unless chosen (`SurvivorSelectScreen.tsx:113-117`).
  - Conflict options repeat the value as "From ZZ-UAT-Clean".
  - The impact summary lists "0 interactions, 0 fuel items, 0 events, 1 contact method, 1 external link" (`MergeImpactSummary.tsx:105`, :108). "Fuel" is the retired name for Off Limits, and "external link" is jargon.
  - It then says "… will be retired. This can't be simply undone." (:136-138), and the final dialog says "This cannot be undone." (:72).
  - "Merge contacts" uses the normal accent colour (:148), not a destructive style.
  - The survivor screen shows no photo or details to compare the two people.
- Why it's a problem: the user can't tell what happens to the other person or their data.
- Evidence: 88-survivor-select.png, 89-merge-conflicts.png, 90-merge-impact-summary.png, 92-merge-confirm-dialog.png.
- Needs investigation: `src/screens/SurvivorSelectScreen.tsx`, `src/components/MergeImpactSummary.tsx`. Use "Keep" / "Merge into", "Off Limits", "phone link", one undo sentence, and a destructive button style.

### H-11 · HID · Medium — The merge contact picker is the whole contact list, with no search, no Cancel and an unexplained order
- Where: Update from Contacts → Merge with another contact → "Choose a contact to merge".
- What happens:
  - A full-screen list of every contact. A few appear first (Joyce Milligan, UAT-Row-02, UAT test%20Row%201, Andrew Wales), then the rest alphabetically.
  - There is no search, no line saying whom you're merging with, and no Cancel.
  - Finding a `ZZ-…` entry took about 12 swipes.
- Why it's a problem: with a real address book (1,000+ contacts) this is unusable.
- Evidence: 86-merge-entry.png, 87-merge-picker-bottom.png.
- Code (verifier, corrected citation): this picker is not a separate component opened from ReconcileDetail. It is the `!second` branch of `src/screens/SurvivorSelectScreen.tsx:55-80`: a plain `FlatList` of `listMergeCandidates`.
- Needs investigation: reuse the app's searchable contact picker in that branch, with a subject line and Cancel.

### H-12 · HID · Medium — Flows started in Settings end on the Contacts tab; Back then lands on unrelated screens, and Settings forgets where you were
- Where: Import → Import complete → View contact / Done; Check complete → Done; finishing a merge.
- What happens:
  - "View contact" opens the person on the Contacts tab. Back from there went to the Contacts tab's Archived screen, left over from earlier, not to Import complete.
  - Import "Done", Check complete "Done" and finishing a merge all jump to the Contacts tab.
  - Returning to Settings afterwards shows the Settings root, not Contacts & Relationships.
- Why it's a problem: the user loses their place in a multi-step admin task.
- Evidence: 57-import-view-contact.png, 58-back-from-import-view-lands-archived.png, 74-import-done-with-pending.png, 75-settings-after-import-done.png, 93-after-merge-landing.png, 106-reconcile-done-landing.png. The retest saw the same landing (`retest/R2-10`, `R3-10`).
- Code (corrected citations):
  - `src/screens/ImportCompleteScreen.tsx:407-415`: `navigateIntoTab(…, "DashboardTab", "Profile", …)`; Done at :429.
  - `src/screens/ReconcileCompleteScreen.tsx:153`: `reset(resetToDashboardRoot())`.
  - `src/components/MergeImpactSummary.tsx:85-86`: `reset(resetToDashboardWith({ name: "Profile", … }))`.
- Needs investigation: return to Contacts & Relationships instead, or keep these flows inside the Settings stack.

### H-13 · HID · Medium — Importing a phone contact that's already linked shows a full editable review form, then reports "Already in Orbit (1)" and throws the edits away
- Where: Import contacts → pick only "ZZ-UAT-M-Anne", which is already linked to Orbit's "ZZ-UAT-M-Ann" → `ImportReview`.
- What happens:
  - A full "Review import" form appears (name, Bound/Unbound, category, phone, email, birthday) with an Import button. Nothing warns that the person is already in Orbit.
  - Only after Import does Import complete say "Imported (0) · Already in Orbit (1)".
  - Code confirms that the link is detected only when Import is pressed (`src/screens/ImportReviewScreen.tsx:263-288`). `resolveAlreadyLinked(exec, rowId, contactId, now)` takes no form data, so anything edited on the form is discarded.
  - A single pick always routes to ImportReview (`import-acquire.ts:232`).
- Why it's a problem: the user does work that is silently thrown away, and only learns afterwards that the person was already there.
- Evidence: 54-import-review-single.png, 55-import-review-single-2.png, 56-after-single-import.png.
- Needs investigation: check the existing link before showing the form (`import-acquire.ts:232` / `ImportReviewScreen.tsx`), and show "Already in Orbit as …" with an Open button instead.

### H-14 · INC · Medium — The import editors differ from Add/Edit Contact and from each other
- Where: `ImportReview`, `BulkImportSetup`.
- What happens:
  - Review import is one long unsectioned form, unlike the sectioned Add/Edit Contact.
  - Its Birthday is a free-text box ("1991-04-04"), while Edit Contact uses a date picker.
  - "Primary" shows as plain grey text, not a control.
  - Review import orders the choices "Bound, Unbound"; Bulk import setup orders them "Unbound, Bound".
  - Bulk setup says "Category override", and its a11y label is "Batch category override".
  - Neither import form offers contact frequency.
- Why it's a problem: the same data is edited three different ways, and the order of the same two choices flips between sibling screens.
- Evidence: 54-import-review-single.png, 55-import-review-single-2.png, 60-bulk-import-setup.png.
- Needs investigation: `src/screens/ImportReviewScreen.tsx`, `src/screens/BulkImportSetupScreen.tsx`.

### H-15 · COPY · Low — Import complete is six near-identical count cards, mostly zeros, and the user's own Skip is counted as "Failed / skipped"
- Where: `ImportComplete`.
- What happens:
  - Every card repeats its number: "Imported (0) / 0 contacts".
  - "0 skipped — no name" and "0 birthdays couldn't be read" use a different heading pattern.
  - The cards look tappable but aren't, and they never list who.
  - Deliberate Skips from Review matches raised "Failed / skipped" to 1, then 2.
- Why it's a problem: noise, and the user's own choice is reported as if it were a failure.
- Evidence: 56-after-single-import.png, 62-import-after-bulk.png, 73-dup-review-back.png, 79-after-last-skip.png; retest/R2-10-after-skip-both.png.
- Needs investigation: `src/screens/ImportCompleteScreen.tsx` (copy around :302-328). Hide zero rows, split "Skipped by you" from "Failed", and list names.

### H-16 · HID · Medium — An unfinished import gives no sign that work is pending, and neither resume prompt says what Discard loses
- Where: Import complete with "Need review (1)" → Done.
- What happens:
  - Done went to the Contacts tab with no warning.
  - Settings → Contacts & Relationships showed no pending item.
  - "Resume your import?" appeared only after a force-stop and relaunch (prompt mounted at `App.tsx:444`). It doesn't say how many items are pending or which ones.
  - The reconcile equivalent, "Resume your check?", appears instead when you reopen Check linked contacts. The two prompts differ in timing and button wording ("Resume import" / "Discard import" vs "Resume" / "Discard").
  - Both prompts do say what is kept ("Contacts already imported stay in Orbit" / "Changes you already applied stay applied"). Neither says what Discard throws away.
- Why it's a problem: the user can't tell that work is pending, where to finish it, or what discarding costs.
- Evidence: 73-dup-review-back.png, 74-import-done-with-pending.png, 76-contacts-settings-pending.png, 77-relaunch-resume-prompt.png, 94-check-linked-second.png; retest/R3-00-resume-prompt.png.
- Needs investigation: `ResumeImportPrompt.tsx` (`App.tsx:444`) and `ResumeReconcilePrompt.tsx`. Show a "Resume import" row on Contacts & Relationships, name the pending items, and state what Discard drops.

### H-17 · INC · Medium — Archived rows cut the name short to fit two large buttons, and look nothing like Unbound rows
- Where: Archived (from both entries).
- What happens:
  - Each row is the name plus outlined Restore and red "Delete permanently" buttons.
  - The name is cut to about 8 characters ("History …", "Zz UX H …"; `numberOfLines={1}` at `ArchivedContactsScreen.tsx:263`).
  - There is no avatar and no archived date.
  - The destructive button is the same size as Restore and sits right beside it (:268-289).
  - Unbound rows, by contrast, are avatar + full name + subtitle, with no inline actions.
  - The Archived list has no search; the Unbound list does.
- Why it's a problem: you can't tell who you are about to delete permanently, and it is easy to hit the wrong button. The two sibling lists are styled differently.
- Evidence: 19-archived-list.png, 40-delete-permanently-confirm.png, 02-unbound-list.png, 113-galaxy-light-archived.png, 114-standard-light-archived.png, 115-standard-dark-archived.png.
- Needs investigation: `src/screens/ArchivedContactsScreen.tsx` row. Use the Unbound row layout, and move the actions to a row menu or the Profile.

### H-18 · HID · Medium — Restore gives no feedback and doesn't say where the person went
- Where: Archived → Restore.
- What happens:
  - The row disappears instantly, with no confirmation, toast or undo.
  - The person goes back to whatever state they had before: the Unbound list for one test contact, All Contacts for another. Nothing tells the user which.
  - `doRestore` (`ArchivedContactsScreen.tsx:124-139`) only reloads the list.
- Why it's a problem: the person just vanishes again. Archive has the same problem (D-07).
- Evidence: 29-restore-tapped.png (and the Unbound count rising from 13 to 14 in the session).
- Needs investigation: add a snackbar to `doRestore`, such as "Restored to Unbound contacts · Open".

### H-19 · INC · Medium — Lifecycle actions are confirmed inconsistently, and Bind and Unbind live in different places
- Where: Profile.
- What happens:
  - Unbind (⋯ menu) asks first, in an unthemed system dialog ("UNBIND CONTACT / KEEP CONTACT BOUND").
  - Bind is a "Bind contact" button on the Profile card, and acts instantly with no message.
  - Restore acts instantly. (Archive also acts instantly, but that is known, N-10, and listed here only for comparison.)
  - Permanent delete asks. Bulk archive from selection mode asks ("Archive 1 contacts?", A-16).
- Why it's a problem: the user can't predict which taps are reversible or confirmed. Of the opposite pair, Bind is on the page while Unbind is in a menu.
- Evidence: 08-unbound-profile-bind-card.png, 09-after-bind.png, 11-bound-profile-menu.png, 12-unbind-tapped.png, 29-restore-tapped.png.
- Needs investigation: the Profile ⋯ actions in `ContactProfileScreen.tsx`. Pick one rule: confirm only irreversible actions, and give undo snackbars for the rest.

### H-20 · COPY · Medium — The Unbind dialog says favourites are removed, but the star stays filled (and disabled), and the favourite comes back on Bind
- Where: Profile of a favourited contact → ⋯ → Unbind contact.
- What happens:
  - The dialog reads "This removes them from your active orbit, reminders, favourites, and widgets…".
  - After Unbind, the star is still filled, labelled "Remove … from Favorites", and enabled=false.
  - After Bind, the person is still a favourite.
  - This extends D-28 (star disabled on Unbound) with a contradiction between the dialog text and what the app does.
- Why it's a problem: the dialog promises something the app doesn't do, and the user can't unfavourite while the contact is Unbound.
- Evidence: 42-card-favourited.png, 12-unbind-tapped.png, 43-unbound-favourite-star.png.
- Needs investigation: the Unbind copy versus the favourite behaviour. Either clear the favourite or change the dialog text.

### H-21 · HID · Low — Snooze on an Unbound contact really applies, and the Overview then shows snoozed reminders for someone who has none
- Where: Unbound Profile → ⋯ → Snooze ("Snooze reminders") → 1 week.
- What happens:
  - The snooze is applied. The Overview then shows "Snooze: Snoozed until …" next to "Orbit Status: Not tracked" and "Contact Frequency: Every 30 days · Inactive while Unbound".
  - Minor polish: tapping the Snooze card opens its sheet with Unsnooze partly clipped and Close below the fold. The sheet is a `ScrollView` (`ProfileRelationshipSheets.tsx:176-328`, Close at :326), so both can be reached by scrolling.
  - This extends D-27 (Snooze offered on Unbound). The difference between the two Snooze sheets is D-05, and the raw date is D-21; both are left to those findings.
- Why it's a problem: the Profile shows a state that can't mean anything for an Unbound person.
- Evidence: 14-snooze-from-menu-unbound.png, 15-after-snooze-unbound.png, 17-unbound-snoozed-overview2.png, 18-snooze-card-sheet.png.
- Needs investigation: hide Snooze for Unbound contacts in the ⋯ menu, and size the Snooze card sheet so Close is visible on open.

### H-22 · HID · Medium — "Mute reminders" exists only as a switch deep inside Edit Contact, and a muted person looks no different anywhere
- Where: Profile → ⋯ → Edit Contact → Identity → (scroll) "Mute reminders".
- What happens:
  - I turned it on and saved. The Profile, the Overview and the Snooze card ("Not snoozed") show no sign of muting.
  - No Contacts filter or list marker was found. Only `EditContactScreen.tsx` reads `reminders_off` in any `.tsx` file.
  - Snooze (⋯ menu, timed) and Mute (Edit form, permanent) are two "no reminders" features in unrelated places, with different words.
- Why it's a problem: the user can't see why reminders stopped, or find where to undo it.
- Evidence: 44-edit-contact-mute-toggle.png, 45-muted-profile-overview.png, 46-muted-overview-no-indicator.png.
- Needs investigation: show "Reminders muted" in the Overview Snooze card (`ContactProfileScreen` overview), and offer Mute next to Snooze.

### H-23 · DEAD · Medium — Archiving from a Profile you've just edited lands on the stale Edit form for the now-archived person
- Where: Profile → ⋯ → Edit Contact → Save changes → ⋯ → Archive.
- What happens:
  - Archive returns to the old "Edit contact" form (Save changes visible, no tab bar), not the list.
  - Pressing Save changes there succeeds and stacks another Profile of the archived person.
  - Back then alternates between the Edit form and the Profile before reaching Contacts.
- Why it's a problem: it lets you edit and save an archived person without realising it.
- Cause: same as D-02. `EditContactScreen.tsx:1068` `navigate("Profile")` pushes a new Profile, leaving the Edit form underneath, and Archive's `goBack()` then lands on it.
- Retest (reproduced):
  - Archive after Edit → Save showed the Edit form (`edit-contact-save` visible): `retest/R4-02-after-archive.png/.xml`.
  - Save there opened a Profile reading "Archived contacts can't be messaged.": `R4-03-stale-save.png/.xml`.
  - Back ×3 went Edit form → archived Profile → Contacts list: `R4-04-back-1/2/3`.
  - Control: Save → Back returns to the Edit form, showing the extra push (`R4-05`). Archive from the base Profile lands correctly on Contacts (`R4-07`).
- Evidence: 47-after-archive-contacts-list.png, 48-save-stale-edit-after-archive.png; retest/R4-01 … R4-07.
- Proposed fix: the D-02 fix. Edit Contact's save should `goBack()` / `popTo("Profile")` instead of `navigate("Profile")` at `src/screens/EditContactScreen.tsx:1068`. The user will then return to the original Profile, and Archive will land on the list.

### H-24 · COPY · Low — An archived person's Profile shows them as "Stable", and Unbind still works on them
- Where: Archived → open an archived person (from either stack).
- What happens:
  - The Overview shows "Orbit Status: Stable · 0 of 30 days since the last interaction" for an archived person.
  - The ⋯ menu offers Unbind, and it actually works on the archived person.
  - The rest of the archived-Profile gaps (no banner, no Restore, Archive errors) are D-06.
- Why it's a problem: the status line tells the user an archived person is in good standing, and a lifecycle action runs on someone who isn't in the active app.
- Evidence: 35-archived-profile-overview-stable.png, 25-archived-profile-menu.png, 26-unbind-on-archived.png.
- Needs investigation: archived-state handling in the `ContactProfileScreen` Overview and ⋯ menu.

### H-25 · COPY · Low — The permanent-delete dialog counts "events" the user never created
- Where: Archived → Delete permanently.
- What happens:
  - The dialog reads "Permanently delete Zz UX H Archive and 1 interaction, 7 events? This cannot be undone." After a few more bind/archive actions it read "10 events". The retest saw "1 interaction, 3 events" for a contact a minute old.
  - These are internal lifecycle records from the `events` table, not Events-tab group events (`purge-dao.ts:326-343` `impactSummaryLines`).
  - The "1 interaction" is the automatic "Last spoke Today" entry from Add Contact.
  - The same function also uses the retired label "fuel item" (:339).
- Why it's a problem: the numbers alarm the user and mean nothing to them.
- Evidence: 40-delete-permanently-confirm.png; retest/R1-07-stale-delete-confirm.png.
- Needs investigation: `impactSummaryLines` (used at `ArchivedContactsScreen.tsx:147`). Leave out lifecycle events or call them "history entries", and rename "fuel item".

### H-26 · COPY · Low — Settings describes Archived in Unbound wording, and has no Unbound entry
- Where: Settings → Contacts & Relationships → CONTACT MANAGEMENT → "Archived contacts — People you've moved out of your active orbit."
- What happens:
  - The Unbound Profile card says "This contact is outside your active orbit.", almost the same words for a different state.
  - Settings lists Archived but not Unbound. The Contacts ⋯ menu lists both.
- Why it's a problem: Archive and Unbind blur together.
- Evidence: 32-settings-contacts-bottom.png, 06-unbound-row-tap.png.
- Proposed fix: change the description in `src/screens/settings-contacts-model.ts:184` to something like "People you've archived. Restore them or delete them permanently." The user will see a description that differs from Unbound.

### H-27 · VIS · Low — In the Unbound list, the first match after a search is hidden above the fold, and every row repeats "Unbound"
- Where: Contacts → ⋯ → Unbound Contacts → scroll down → type "uat".
- What happens:
  - The list keeps its old scroll position, so the first match (ZZ-UAT-B4a-Add) is clipped off the top under "8 matching".
  - Each row's subtitle is just "Unbound", on a screen titled "Unbound contacts", with no last-contact or other useful line.
- Why it's a problem: the user misses a result, and every row wastes a line.
- Retest (reproduced):
  - After scrolling to the bottom and searching "uat", the first match's bounds are `[56,767][1384,782]`: only 15 px of a 262 px row is visible (`retest/R5-02-search-after-scroll.png/.xml`).
  - One swipe down shows it in full (`R5-03`).
  - Control: searching from the top shows it in full (`R5-04`).
- Evidence: 02-unbound-list.png, 03-unbound-bottom.png, 04-unbound-search-uat.png, 05-unbound-search-empty.png; retest/R5-01 … R5-04.
- Needs investigation: `src/screens/UnboundContactsScreen.tsx`. Scroll to the top when the query changes, and use a useful subtitle (for example, last contact).

### H-28 · COPY · Low — Linked-contact check wording and values
- Where: Check linked contacts, Update from Contacts, and its bulk sheet.
- What happens:
  - The entry is called "Check linked contacts", but the detail screen's title is "Update from Contacts" (compare A-29).
  - Dates are raw ("1990-05-14").
  - An impossible phone birthday, "2021-02-29", is offered as a normal choice.
  - The bulk sheet offers "Apply recommendation" though no recommendation is ever shown, and its case is inconsistent ("Keep Orbit Values"; labels at `CandidateCardGrid.tsx:90-91`).
  - Jargon: "Source missing", "Unlink source", "Relink to another contact", "Manual review".
  - The grid has no intro text explaining what the check is.
- Evidence: 81-check-linked.png, 83-reconcile-tap-card.png, 101-source-missing-detail.png, 103-reconcile-bulk-actions.png.
- Needs investigation: the copy in `ReconcileGridScreen.tsx` and `ReconcileDetailScreen.tsx`.

### H-29 · HID · Low — The Unbound Profile shows frequency chips with Bind only for a never-bound person; after an Unbind there is just "Bind contact"
- Where: Unbound Profile.
- What happens:
  - A never-bound person shows Daily…Yearly/Custom chips (Monthly preselected) above "Bind contact".
  - After a Bind then Unbind, the card shows only "Bind contact", and the old frequency is silently reused.
  - After Bind, every Profile section collapses and no message appears.
- Why it's a problem: the user doesn't see what frequency they are re-binding with.
- Evidence: 06-unbound-row-tap.png, 08-unbound-profile-bind-card.png, 09-after-bind.png, 15-after-snooze-unbound.png.
- Needs investigation: the Unbound card in `ContactProfileScreen`.

---

#### Dropped
- raw H-29 → merged into H-08 (the same header inconsistency, on `BulkReview`; screenshot 80 was already H-08 evidence).
- raw H-21, the "Close is cut off" claim → wrong: the sheet scrolls. The remainder is a below-the-fold note in H-21. The two-sheets part (D-05) and the raw-date part (D-21) belong to those findings.
- raw H-24, the no-banner / no-Restore / Archive-error part → already D-06.
- raw H-03, the "tap does nothing" part → known (§3.5).

(Raw → final id map: raw H-01…H-28 keep their numbers; raw H-30 → H-29.)

#### Routes covered
| Route | Reached | How |
|---|---|---|
| UnboundContacts | yes | Contacts ⋯ → Unbound Contacts |
| Archived (D stack) | yes | Contacts ⋯ → Archived Contacts |
| Archived (S stack) | yes | Settings → Contacts & Relationships → Archived contacts; a Profile was also opened from it |
| LegacyContactPicker | no | Only when import mode is "legacy" (`start-contact-import.ts:56`). The normal path opens the Android system picker, and there is no in-app way to switch modes |
| ImportReview | yes | Import contacts → pick 1 (ZZ-UAT-M-Anne) |
| BulkImportSetup | yes | Import contacts → pick 12 ZZ-UAT entries (retest: 2) |
| ImportProgress | partly | Started via "Import 12 contacts"; replaced by Import complete in under 1 s, so not captured |
| DuplicateReview | yes | Import complete → Review possible matches; also via the resume prompt |
| ImportComplete | yes | Single and bulk |
| BulkReview | yes (empty only) | Settings → Review flagged items; no flagged items exist, and creating one would need a phone Contacts edit |
| ReconcileGrid | yes | Settings → Check linked contacts |
| ReconcileDetail | yes | Card tap (manual-review and source-missing variants) |
| ReconcileComplete | yes | Bulk Keep Orbit Values on the last cards |
| SurvivorSelect | yes | ReconcileDetail → Merge with another contact → pick |
| MergeConflicts | yes | Continue |
| MergeImpactSummary | yes | Continue → Merge contacts → confirm |
| ResumeImportPrompt (surface) | yes | Relaunch with 1 unresolved match |
| ResumeReconcilePrompt (surface) | yes | Reopening Check linked contacts |
| Favourite / Snooze / Mute / Archive / Unbind / Bind / Restore / Permanent delete (not routes) | yes | Profile, card star, Edit Contact, Archived list |

#### Could not check
- LegacyContactPicker: not reachable from the UI (legacy mode is not exposed).
- ImportProgress content: the screen flashed by too fast with 12 contacts.
- Review flagged items with content: there are no flagged items, and creating one needs a new phone contact (editing Android Contacts is forbidden).
- Linking a possible match to the correct existing contact: the picker overflow (H-02) hid the candidates, so the audit and the retest both skipped instead.
- No "Recently Deleted" exists for contacts: permanent delete is immediate. Recently Deleted is per-contact memories, area G.
- Photo picking: not exercised (it would open the personal photo library).

---

## Area I — Sharing into the app — final findings

Device: Pixel 6 Pro, debug build, Galaxy / Dark / default accent / Deep Space. Dates: audit, verification and retest all on 2026-10-10.

**Counts: 16 findings.** High 1, Medium 7, Low 8. By code: HID 6, VIS 4, INC 2, COPY 2, DEAD 1, A11Y 1.

Sources:
- **Audit:** `findings-raw.md` (18 raw findings).
- **Verification:** `verification.md` (14 confirmed, 2 recheck, 2 dropped).
- **Retest:** `retest-results.md`. Both recheck items reproduced: R1 for I-01, and R2-A and R2-B for I-05. None was inconclusive.

How the audit shared into Orbit:
- **Real app:** a link share from Chrome Incognito, done once with Orbit closed and once with Orbit open.
- **Synthetic `ACTION_SEND` text/plain intents:** text, a URL, long text, blank text, and two shares in a row.

What Orbit shows after the share is the same either way. Chrome Incognito blocks screenshots, so only Orbit's screens have images.

Known item 999.5 (shared items are invisible) is not re-reported. The evidence about it is under "Where shared items ended up".

---

### I-01 · HID · High — A cold-start share shows "Resume your check?" over the capture screen; Back can't dismiss it, and both buttons wreck the share or unrelated work
- Where: Capture (`Save to…`), reached by sharing into Orbit while Orbit is not running. The audit used Chrome Incognito → Share → Orbit, then repeated it with an intent; the retest used an intent. It happens whenever an import or "Check linked contacts" session is unfinished, not only in this audit. `resolveActiveResumePrompt` shows `ResumeImportPrompt` or `ResumeReconcilePrompt` on every cold start while such a session exists.
- What happens:
  - The "Save to…" screen opens. A modal then covers it: "Resume your check? Unresolved contacts are saved. Changes you already applied stay applied", with Resume and Discard.
  - Android Back does nothing. **Both** resume prompts ignore Back: `src/components/ResumeReconcilePrompt.tsx:65` and `src/components/ResumeImportPrompt.tsx:112` each set `onRequestClose={() => undefined}`.
  - **Resume** leaves the capture and opens Settings → Check linked contacts. Back from there goes to Settings, and the share seems gone. It is actually still pending, hidden. Tapping the Contacts tab shows the old "Save to…" screen inside that tab, with no tab bar; the only way out is Close. This last step was merged in from raw I-16.
  - **Discard** would throw away an unrelated contact-check session just to finish saving a link.
  - The audit reproduced this 2/2 (a Chrome cold share and an intent cold share).
- Retest (R1, reproduced):
  - Setup: a fresh unfinished check session (id 10), left pending.
  - Cold intent "Zz UX recheck cold share": after about 8 s the prompt appeared over a dimmed Save to… showing that preview.
  - One Back press left the prompt unchanged; the dump was identical.
  - A plain tap on Resume opened the Check linked contacts grid, and the dump had no "Save to" node.
  - Back went to the Settings hub.
  - The Contacts tab icon then showed "Save to…" with the "Zz UX recheck cold share" preview and no tab-bar nodes.
  - Close cancelled the share, and no row was saved.
- Why it's a problem: the user came to save one link and is asked about a "check" they don't connect with this action. Neither button lets them continue the share. The share then turns up later, unexplained, inside the Contacts tab, in place of the contact list.
- Evidence:
  - Audit: 17-chrome-link-share-orbit-closed.png, 18-cold-share-resume-prompt.png (+.xml), 19-after-resume-from-capture.png, 20-back-from-check-linked.png, 21-contacts-tab-after-abandoned-share.png, 63-cold-share-retry.png (+.xml), 64-back-on-resume-prompt.png, 65b-capture-still-under-contacts-tab.png (+.xml).
  - Retest: retest/R1-01-prompt.png (+.xml), retest/R1-02-after-back.png (+.xml), retest/R1-03-after-resume.png (+.xml), retest/R1-04-back.png (+.xml), retest/R1-05-contacts-tab.png (+.xml).
- Proposed fix:
  - `App.tsx:441-454` mounts `ResumeImportPrompt` / `ResumeReconcilePrompt` whenever a resumable session exists, without checking how the app was opened.
  - Skip **both** prompts while a share is pending. For example, read `hasShareIntent` from `useShareIntentContext()`, the context `ShareIntentGate` already uses, or skip them while the focused route is `Capture`. They then appear on the next normal launch.
  - The user then sees only "Save to…" and can finish the share.
  - Secondary note (from raw I-16): Capture is pushed into the Contacts tab stack (`src/navigation/linking.ts:68`, `navigateIntoTab(…, "DashboardTab", "Capture")`). Hosting Capture as a root-level modal instead would stop an unfinished share from hiding inside a tab.

### I-02 · VIS · Medium — On the capture screen, the keyboard covers the "New contact" name sheet and the "Add a note" field, buttons included
- Where: two routes. Capture → tap the "New contact" tile (the name field autofocuses). Capture → tap a face → "Add a note" → tap the note field.
- What happens: both sheets sit at the bottom of the screen, behind the keyboard. While typing, the user sees the grid but not the Name field, the "Create & save" button, the note field, or Skip/Done. They appear only after the keyboard closes. The capture **search** is fine: its results stay visible above the keyboard (29-search-zzux-keyboard.png).
- Why it's a problem: the user types blind into both text fields in this flow, and with the keyboard up there is no visible way to submit. It is the same problem as A-25 (the + contact picker) on a different surface.
- Evidence: 31-new-contact-inline.png, 32-new-contact-sheet-kb-closed.png, 07-note-field-keyboard.png (+.xml: the note field is focused at y 2501–2809, under the keyboard), 08-note-typed-keyboard.png, 09-note-typed-kb-closed.png, 35-new-contact-typed-kb.png
- Needs investigation:
  - In `src/screens/CaptureScreen.tsx`, `confirmSurface` (~:1092) and `inlineSurface` (~:1151) are `position: "absolute", bottom: 16`, with no keyboard avoidance. The manifest's `adjustResize` does not lift them.
  - Start with a keyboard-height offset on those two surfaces.
  - `onSubmitEditing` already submits the name. The note field is multiline and has no submit.

### I-03 · HID · Medium — Sharing into Orbit while you're using it closes Orbit afterwards; reopening loses your place
- Where: Orbit open on a Profile → switch to Chrome → Share → Orbit → Save (or Close / Back).
- What happens:
  - After saving or cancelling, the Orbit activity finishes and the user is back in Chrome.
  - Reopening Orbit starts fresh on the Digest tab. The Profile and the Contacts tab state are gone.
  - The same happens with an intent share while Orbit is in front: Back or Close drops to the launcher, and the relaunch opens on Digest.
- Why it's a problem: a share should be a quick side-trip, but it costs the user whatever they were doing in Orbit, with no warning.
- Evidence: 23-contacts-before-open-share.png, 24-profile-open-before-share.png (+.xml), 25-chrome-share-orbit-open.png, 26-orbit-reopened-after-close.png. Intent version: 00-start.png, then 01-intent-text-open-app.png, then 03-relaunch-after-capture-back.png.
- Needs investigation:
  - `CaptureScreen.tsx:176-179` (`cancelCapture`) and `:245-249` (`armAutoReturn`) call `finishActivity()`, which is a plain `Activity.finish()` in `modules/orbit-share-finish`.
  - MainActivity is Orbit's only activity (`singleTask`, `AndroidManifest.xml:24`), so finishing it ends the whole app session.
  - Start with whether the share can run in a separate share activity or task, or use `moveTaskToBack` instead of `finish` when Orbit was already running.

### I-04 · HID · Medium — One tap saves at once, with no Undo; the confirmation and "Add a note" stay for only 1.5 seconds
- Where: Capture → tap any face.
- What happens:
  - The tap writes the item immediately.
  - A "Saved to <name>" card with "Add a note" appears. About 1.5 s later the app closes and returns to the source app.
  - There is no Undo and no confirmation step. A slip in a dense grid of about 100 avatars saves to the wrong person, and nothing on screen lets the user see or remove it (999.5).
  - Note: the missed taps on "Add a note" during the audit were automation timing. The 1.5 s window itself is confirmed in code.
- Why it's a problem: there is no time to read the confirmation, add a note, or catch a mistake. Elsewhere in the app, saves either wait for an explicit Save or offer Undo (the Quick Log snackbar, area F).
- Evidence: 04-saved-toast.png, 05-add-note-attempt.png, 05c-add-note-attempt2.png, 22-link-saved-toast.png, 41-multi-saved.png
- Needs investigation:
  - `AUTO_RETURN_MS = 1500` is at `src/screens/CaptureScreen.tsx:87`, and the commit happens in `onPickFace` (:255-302). Lengthening the window is a one-number change.
  - An Undo is feasible: the written row ids are kept in `writtenRows` (:134), and `deleteFuel` exists in `src/db/fuel-dao.ts`.

### I-05 · DEAD · Medium — Back throws away a typed note, or an open New-contact sheet, and leaves the app with no warning
- Where: two routes. Capture → tap a face → Add a note → type → Android Back. Capture → New contact → Android Back.
- What happens:
  - In both cases Back cancels the whole capture and returns to the source app.
  - A typed note is silently lost; the item stays saved without the note.
  - With the New contact sheet open, Back cancels the share entirely, so the link is not saved at all. The New contact sheet has no Cancel or close button of its own.
- Retest (R2, reproduced both parts):
  - **Part A:** a share "Zz UX recheck note share" was saved to Zz UX Add Test, and the note "Zz UX recheck note dropped" was typed (the field was confirmed focused). One Back press moved the foreground to Chrome. A read-only copy of the database shows one row for the share (id 16, source `share`) whose text is the bare shared text. `onNoteDone` would have rewritten it to "note — base", so the note was discarded.
  - **Part B:** with the New contact sheet open (empty Name, Create & save, no Cancel), one Back press moved the foreground to Chrome. The database copy shows no row for "recheck newcontact" and no new contact.
- Why it's a problem: Back is expected to close the innermost thing (the sheet), not discard work and leave the app. This matches the discard-on-Back findings elsewhere (E-01, F-01, G-12).
- Evidence:
  - Audit: 43-note-typed-before-back.png, 42-note-typed-before-back.png (+.xml), 32-new-contact-sheet-kb-closed.png.
  - Retest: retest/R2-01-note-typed.png (+.xml), retest/R2-03-sheet-open.png (+.xml), and the database copies in retest/db-copy-A/ and retest/db-copy-B/.
- Proposed fix:
  - `src/screens/CaptureScreen.tsx:214-225`: the BackHandler handles only `multiSelect` and otherwise calls `cancelCapture()`.
  - Add two earlier branches. If `inlineOpen`, call `setInlineOpen(false)` and return true. If `noteOpen` and the note is not empty, save it the way `onNoteDone` (~:390-433) does, or ask first.
  - Afterwards, Back closes the sheet and keeps a typed note.

### I-06 · INC · Medium — New contact from a share is silently set to Monthly tracking, with no choice shown
- Where: Capture → New contact → type "Zz UX Share New" → Create & save → open that Profile.
- What happens:
  - The contact is created with "Contact Frequency: Every 30 days".
  - The New contact sheet shows no frequency and offers no choice; it has only a Name field and Create & save.
  - Today this differs from the manual Add Contact form, which starts Unbound.
  - Phase 39 (D-51) changes the Add Contact default to Bound with Monthly preselected and shown on the form. So the share path's 30 days matches the coming default, but here it is applied without being shown.
  - The Profile's "Not tracked" wording is the known Phase 39 item (D-77) and is not part of this finding.
- Why it's a problem: a person added just to hold a link becomes a tracked monthly obligation, which will later show as overdue, without the user seeing or choosing that. This second create path is not tied to the Add Contact default, so the two can drift apart.
- Evidence: 36-new-contact-saved.png, 48-share-new-profile.png, 49-share-new-overview.png, 50-share-new-overview-2.png (+.xml: "Contact Frequency Every 30 days")
- Proposed fix:
  - `INLINE_CREATE_INTERVAL_DAYS = 30` is at `src/screens/CaptureScreen.tsx:94` and used at :488. Take the interval from the same source the Add Contact form uses, so the two paths cannot drift.
  - Show the frequency on the New contact sheet, or a "Track every month" toggle.
  - The comment at :89-93 ("the value the standard create form ships") is stale.
  - Which default to use, and whether to show it on the sheet, is an owner call.

### I-07 · HID · Medium — "New contact" is the last tile after every contact, and the search text isn't carried into the name
- Where: Capture with no search → scroll down. Capture → search "Zz UXqqq" (no match) → New contact.
- What happens:
  - Without a search, the New contact tile appears only after all ~100 contacts.
  - A search with no matches shows only the New contact tile, with no "No one matches" text.
  - Tapping the tile opens an empty Name field; the text just typed in search is not carried over.
- Why it's a problem: the common case, "this is about someone new", is buried at the bottom of a long grid. When the user has already typed the name in search, they must type it again, blind (I-02).
- Evidence: 34-grid-bottom.png, 30-search-no-match.png, 31-new-contact-inline.png, 32-new-contact-sheet-kb-closed.png
- Proposed fix:
  - In `src/screens/CaptureScreen.tsx:459-461` (`onOpenInlineCreate`), call `setInlineName(searchText.trim())` when search is open.
  - Consider putting the `{ kind: "new" }` item first rather than last (:569-572).
  - Show a short "No one matches '…'" line when `visibleRows` is empty and a query is set.
  - A search for a new name then carries straight into New contact.

### I-08 · INC · Medium — The capture picker is a completely different design from every other contact picker in the app
- Where: Capture ("Save to…") compared with + → Quick Log / Update Contact / Memory → "Choose contact" (A-24, A-25), and with the Contacts tab.
- What happens:
  - Capture is a full-screen 3-column grid of 64 px faces.
  - It has a bordered "Close" pill instead of the app's Back control, and a colour 🔍 emoji instead of the app's icons.
  - Search appears only after a tap, multi-select uses a "Done · N" bar, and the order is unlabelled (favourites, then recently shared, then the rest).
  - The grid order changes after each share. Zz UX Add Test and Zz UX Share New moved to the second row; compare 01 with 45 and 60.
  - The other pickers are bottom-sheet lists with an always-visible search field.
- Why it's a problem: the same task, choosing a person, looks and works differently depending on the entry point.
- Evidence: 01-intent-text-open-app.png (+.xml), 17-chrome-link-share-orbit-closed.png, 45-second-share-while-capture-open.png, 60-theme-galaxy-light-grid.png. Compare with A-contacts 86-picker-search-keyboard.png and 87-picker-after-keyboard.png.
- Needs investigation: compare `src/screens/CaptureScreen.tsx` (header :574-596, grid :745-757) with `src/components/ContactPicker.tsx`. Which picker becomes the single standard is a design decision.

### I-09 · HID · Low — Multi-select is long-press only, and with nothing selected there's no way out except Back
- Where: Capture → long-press a face.
- What happens:
  - Nothing on screen says a long-press selects several people.
  - In multi-select the title still says "Save to…", and the bar says "Done · N".
  - After unselecting everyone, a dimmed "Done · 0" stays. There is no Cancel control; the Close pill always cancels the whole capture (:536).
  - Only Android Back leaves the mode, and it works.
- Why it's a problem: sharing to several people is a hidden feature, and getting out of it is unclear.
- Evidence: 38-multiselect-two.png (+.xml), 40-multiselect-zero.png (+.xml), 39-back-exits-multiselect.png (+.xml)
- Proposed fix:
  - In `src/screens/CaptureScreen.tsx`, while `multiSelect` is on, replace the Close pill with a "Cancel selection" control that calls `exitMultiSelect` (:182), and change the title to "Select people".
  - Add a hint line ("Long-press to pick several") so the feature can be found.

### I-10 · VIS · Low — Tiles change size and position: the last row stretches, and selected tiles shift their avatar
- Where: Capture with a search that leaves one or two items in the last row; multi-select.
- What happens:
  - On a partial last row the tiles stretch. Two tiles on the last row each become about 1.5 columns wide, and a lone "New contact" tile becomes full-width.
  - Selecting a face adds a border and padding, which pushes its avatar and name lower than its neighbours'.
- Why it's a problem: the grid looks unstable while the user searches or selects.
- Evidence: 29-search-zzux-keyboard.png, 30-search-no-match.png, 37-search-zzux-kb-closed.png, 38-multiselect-two.png, 41-multi-saved.png, 42-note-typed-before-back.png
- Proposed fix:
  - In `src/screens/CaptureScreen.tsx`, the `tile` style (~:1016) has `flex: 1`. Give it a fixed share instead, e.g. `flexBasis: "30%", flexGrow: 0`, or `maxWidth: "33.33%"`.
  - Give `tileSelected` (~:1022) the same padding and border as an unselected tile, with a transparent border on unselected tiles, so selecting doesn't move anything.

### I-11 · VIS · Low — The header (Close, search, preview) scrolls away with the grid
- Where: Capture → scroll down the grid.
- What happens: the Close pill, the "Save to…" title, the search button and the preview of the shared item all scroll off with the faces. At the bottom of the list the user can't cancel or search without scrolling back up.
- Why it's a problem: the user loses sight of what they are saving and of the way out.
- Evidence: 34-grid-bottom.png
- Proposed fix:
  - `src/screens/CaptureScreen.tsx:755` puts the header in `ListHeaderComponent`. Render the header above the `FlatList` instead, inside the root `View` (:744), and keep the revealed search field with it.
  - Close, search and the preview then stay pinned.

### I-12 · COPY · Low — The preview of what's being saved is one truncated line
- Where: Capture with a long text or a long URL.
- What happens: the preview shows a single line ending in "…", and it can't be expanded. For a bare URL share it repeats the address: the URL, then the host again below it.
- Why it's a problem: the user can't check what they are about to save, and can't check it afterwards either (999.5).
- Evidence: 33-intent-long-text.png (+.xml), 33b-intent-long-text.png, 27-intent-url.png (+.xml)
- Proposed fix: in `src/screens/CaptureScreen.tsx`, change `numberOfLines={1}` at :610 to allow 3 lines, or add tap to expand. Hide the host line (:615-622) when `displayText` is the URL itself.

### I-13 · COPY · Low — Confirmation wording leaves out what happened
- Where: Capture confirmations and the empty-share state.
- What happens:
  - Multi-select says "Saved to 2 contacts" without naming them.
  - A new contact says "Saved to Zz UX Share New", with no hint that a person was just created.
  - After Done on a note, the card shows "Add a note" again, as if nothing was saved: `noteOpen` becomes false while `savedLabel` stays set.
  - A blank share shows a lone "Nothing to save" in the danger colour, with no explanation.
- Why it's a problem: the user can't confirm the outcome, and the item can't be found afterwards to check (999.5).
- Evidence: 41-multi-saved.png, 36-new-contact-saved.png, 10-note-done-pressed.png, 44-intent-blank-text.png (+.xml)
- Proposed fix, all in `src/screens/CaptureScreen.tsx`:
  - :358: list the first names ("Saved to Ann and Bo").
  - :506: "Created Zz UX Share New and saved".
  - After `onNoteDone` succeeds (:436-438), set a "note added" flag and show "Note added" instead of the "Add a note" affordance (:917-934).
  - :553: "Nothing to save — the shared item was empty", in neutral text colour.

### I-14 · HID · Low — A second share arriving while Capture is open keeps the old search filter
- Where: Capture open with the search "Zz UX Full" → share something else into Orbit.
- What happens: the new item replaces the preview, but the search still says "Zz UX Full" and is focused with the keyboard up. Only one person is listed. This is the capture-screen version of F-25.
- Why it's a problem: the user may think only one contact is available, or save to the filtered person by habit.
- Evidence: 46-third-share-search-persists.png (+.xml)
- Proposed fix: in `src/screens/CaptureScreen.tsx`, add an effect on `shareIntent` that resets `searchText`, `searchOpen`, `multiSelect`/`selected`, `inlineOpen`/`inlineName` and `noteOpen`/`noteText`. At present only `payload` is memoised (:121-129). Each share then starts clean.

### I-15 · A11Y · Low — Close is announced as "Cancel"; search is an emoji glyph
- Where: Capture header.
- What happens:
  - The visible "Close" pill has the accessibility label "Cancel", although after a save it cancels nothing.
  - The search button's only content is the 🔍 colour emoji (`&#128269;` in the dump). Its label, "Search contacts", is fine.
  - The emoji looks unlike the vector icons used everywhere else in the app.
- Why it's a problem: what a screen reader says doesn't match what is shown, and the icon styles don't match.
- Evidence: 01-intent-text-open-app.xml, 01-intent-text-open-app.png
- Proposed fix: in `src/screens/CaptureScreen.tsx`, change the label at :535 to "Close". At :594, replace the emoji Text with the search icon component the Contacts tab header uses.

### I-16 · VIS · Low — The note sheet's Skip/Done and the confirmation card sit in the bottom gesture area
- Where: Capture → face → Add a note.
- What happens: the confirmation card is anchored 16 px from the bottom. Skip and Done span y 2851–3005, just above the gesture bar (3036). They can be tapped, but they are crowded against the home handle.
- Why it's a problem: minor polish; the same gesture-area issue as F-22. It concerns the same two surfaces as I-02 but is a different problem.
- Evidence: 05d-note-field.png (+.xml), 09-note-typed-kb-closed.png
- Proposed fix: add the bottom safe-area inset to the `bottom` of `confirmSurface` and `inlineSurface` (`src/screens/CaptureScreen.tsx` ~:1092, ~:1151). CaptureScreen does not currently import safe-area insets.

---

#### Where shared items ended up (evidence for 999.5, not a finding)
- Items were saved to Zz UX Full Profile, Zz UX Add Test and Zz UX Share New: texts, the Example Domain link, and notes. None of them appears on the Profile: not in Memories, Last Talked About, Pinned/Featured or the History stream. The newest History entry that day is a 5:32 AM "Last talked about" change, while the shares were saved between 7:15 and 7:33. Evidence: 13-profile-scrolled.png, 14-profile-ttr.png, 15-profile-ttr-top.png.
- Whether Contacts search matches shared-item text is **inconsistent and unresolved**:
  - In the audit, a search for "shared text" (12-/12b-search-shared-text.png, 12b.xml) shows one match: "Zz UX Full Profile · 1 match · Zz UX shared text two".
  - In the retest, searches for "recheck", "recheck note share" and "recheck note dropped" did **not** find Zz UX Add Test, although the database copy shows the shared row "Zz UX recheck note share" (id 16) exists. Evidence: retest/R2-02-search-note.png, retest/R2-02b-search-note-share.png, retest/R2-02c-search-recheck.png ("No matches for "recheck"").
  - Neither result was investigated further.

#### Positive checks (no finding)
- Close returns to the source app without saving. In multi-select, Android Back only leaves multi-select.
- Capture search: the results stay visible above the keyboard, so the A-25 problem does not occur here.
- A second share while Capture is open replaces the preview correctly (45).
- Theme spot-check: the grid and the note sheet look correct in Galaxy Light, Standard Light, Standard Dark and Galaxy Dark (60-/61-theme-*.png).

#### Dropped
- Raw I-16 (HID, Low; the unfinished share sits in the Contacts tab with no tab bar): merged into I-01. It has the same root cause and the same evidence (21, 65b). Its fix, hosting Capture as a root-level modal (`linking.ts:68`), is kept as a secondary fix note on I-01.
- Raw I-17 (HID, Low; a contact created to hold a share shows nothing about it): duplicate of known item 999.5, with no new detail. The silent-tracking part is I-06.
- Raw I-18 was not dropped; it is renumbered I-16.

#### Routes covered
- `Capture`: reached, yes.
  - How: a real Chrome Incognito link share (with Orbit closed and with Orbit open), and synthetic `ACTION_SEND` intents (text, URL, long text, blank text, shares in a row).
  - States reached: grid; search with a match and with no match; single save; Add a note (Done, Skip, Back); multi-select (2 selected, 0 selected, Back, Done); New contact (empty, typed, Back, Create & save); "Nothing to save"; the cold-start resume prompt.
  - The retest re-ran the cold-start prompt and both Back cases.

#### Could not check
- **Sharing selected text from Chrome:** in Incognito, the text-selection toolbar was not exposed to `uiautomator`, and Incognito blocks screenshots. Text shares were exercised with intents instead.
- **Chrome-side screenshots** (the share sheet, the Incognito page): not taken. The system share sheet shows the owner's personal direct-share targets, and Incognito blocks screenshots.
- **Google Keep, Messages and other apps:** not opened, under the privacy rule.
- **Image and file shares:** Orbit registers text/plain only. Photo picking was not exercised because it would expose the personal photo library.
- **Pressing Discard on the resume prompt:** not pressed, because it would destroy an unfinished check session that was being kept on purpose.

---

## J — Compose and confirmations — final findings

Final after audit, verification and retest (2026-10-10). Device: Pixel 6 Pro, debug build, Galaxy / Dark. All evidence paths are relative to `untracked/artifacts/ux-audit/J-compose/`. No AI button was pressed. Every handoff went to the synthetic address `zzux.full@example.com`.

**Counts: 18 findings.** By code: HID 7, INC 3, VIS 4, COPY 2, DEAD 1, A11Y 1. By severity: High 1, Medium 8, Low 9.
Raw → final: 18 raw → 17 confirmed by the verifier + 1 rechecked and reproduced (J-01). No raw finding was dropped whole; the sub-claims dropped or merged are listed under "Dropped". Numbering is unchanged from the raw file.

Known item (owner prompt §3.5): the double "Did you send it?" in Compose is not re-reported. J-02, J-05 and J-08 keep only what is new beyond it.

---

### J-01 · HID · High — A message Compose presents as a text is sent as an email, and Compose never says where it is going
- Where: Profile (Zz UX Full Profile) → Message → Compose (route `Compose`, origin profile); also Contacts card long-press → Message.
- What happens: Compose opens in text mode. The switch link reads "Make this an email" and there is no Subject field. Nothing on the screen shows the number or address it will use. Pressing Transmit opened Gmail with `mailto:zzux.full@example.com?body=…` (seen 4 times). On return, the banner asks "Did you **email** Zz UX Full Profile?". The contact's only phone (555-0101) is one the Profile's Contact Methods row calls unusable ("This number can't be used for calls or messages yet"), so Compose quietly fell back to email.
- Retest (reproduced, no new handoff): on the Profile's Contact Methods, the phone "Main · 555-0101" carries "This number can't be used for calls or messages yet." Its Call and Message controls are `enabled="false"`. The email "Main · zzux.full@example.com" has no helper text and its Email control is enabled. The header Message button is enabled and opens Compose in text mode ("Make this an email", no Subject), offering Things to Remember · 18, Draft with AI, Copy and **Transmit**. The dump contains no "555", "0101", "zzux.full" or "example.com", so no destination is shown. After "Make this an email", Subject and Copy subject appear, but the address still appears nowhere (0 matches). Side observation, not part of this finding: the Profile header's Call says "Add a phone number to call this contact." although the contact has a number; it just can't be used.
- Why it's a problem: the user believes they are texting and lands in their email app with no warning. The Profile greys out Message for this number, yet Compose's Transmit goes ahead on another channel. This is new detail on known item D-08.
- Evidence: 06-compose-open.png (text mode, no recipient), 28-before-transmit.png, 29-after-transmit-return.png, 32-banner-after-foreground.png ("Did you email"); dumps 06-compose-open.xml, 28-before-transmit.xml. Retest: retest/R1-a-contact-methods.png/.xml, retest/R1-b-compose.png/.xml, retest/R1-c-email-mode.png/.xml.
- Proposed fix: in src/screens/ComposeScreen.tsx the mode-switch label (:1340-1342) and the controls use the session `mode`, while `onTransmit` (:975-985) uses `resolveUsableMode(...)` (src/logic/compose-logic.ts:173-185). `resolveComposeControls` shows Transmit when only an email is usable (compose-logic.ts:115-122). Compute the usable mode once in render, then (a) show a destination line above the action row, e.g. "Email to zzux.full@example.com", and (b) label the switch from the usable mode. Afterwards the user sees "Email to …" before pressing Transmit, and the screen no longer looks like a text.

### J-02 · HID · Medium — After "Yes, log interaction" Compose closes silently, and the banner still asks about an older handoff without saying so
- Where: Compose → Transmit → back to Orbit → in-screen "Did you send it?" → "Yes, log interaction".
- What happens: Compose closes straight to the previous screen with no "Logged" message. A banner "Did you email Zz UX Full Profile?" stays on top. It belongs to an earlier handoff to the same person, but nothing says so. The interaction was in fact logged (History showed it).
- Why it's a problem: the user gets no confirmation and appears to be asked again. The natural reaction is to tap Yes again and log twice. Quick Log shows a snackbar (A-35/F-02); this path shows nothing. New beyond the known double prompt: there is no feedback on this path, and the remaining banner does not say which handoff it is about. See also J-06 (the same "which handoff?" gap in the pending list).
- Evidence: 34-double-confirmation.png (both prompts), 35-after-yes-log-compose.png (list + banner still asking), 49-history-logged-as-message.png.
- Needs investigation: show a confirmation snackbar on `performExit("logged")` (ComposeScreen.tsx:1146-1149, which has no snackbar). Decide how the banner should identify its handoff (time or message preview).

### J-03 · HID · Medium — After "Not yet", the reminder disappears until the app is closed and reopened
- Where: Compose → Transmit → back → "Not yet".
- What happens: the panel closes and nothing else appears: no banner on Compose, Profile or the list. The "Did you email …?" banner appeared only after Orbit went to the background and was opened again.
- Why it's a problem: "Not yet" suggests the question will come back. For the rest of the session it doesn't, and the user cannot find the pending item.
- Evidence: 30-not-yet.png, 31-banner-on-list.png (no banner), 32-banner-after-foreground.png (banner after reopening).
- Needs investigation: the queue refreshes only on launch, on background→active and on publications (src/stores/assist-store.ts:51-66). Returning inside the 15 s window (src/logic/assist-eligibility.ts:2, :25-33) leaves the item ineligible, and `onConfirmNotYet` (ComposeScreen.tsx:1155-1157) does not refresh. Start by refreshing the queue on Not yet and making a just-deferred item eligible right away.

### J-04 · HID · Medium — A typed draft is silently discarded when you start a message to someone else
- Where: Compose for Zz UX Full Profile (long text typed, switched to email) → Back → Contacts → Zz UX Share New → Message → Back → Zz UX Full Profile → Message.
- What happens: Back keeps the draft (reopening showed it intact). Opening Compose for another person, even briefly and without typing, wipes the first draft and its email mode with no warning.
- Why it's a problem: within Compose, a draft survives one way of leaving and is lost another way, and the user is told about neither. Sibling forms lose input on Back (E-01, F-01, G-12, I-05); Compose keeps it on Back but loses it here. That is a third behaviour.
- Evidence: 13-email-mode-top.png (draft), 20-reopen-compose.png (kept after Back), 22-compose-no-destination.png (other contact), 27-draft-lost-after-other-contact.png (empty).
- Needs investigation: `startSession` in src/stores/compose-session-store.ts:121-127 resets the whole draft when the contact differs. Either keep one draft per contact or warn before replacing it.

### J-05 · INC · Medium — The two confirmation surfaces mirror their primary button, and an email is logged as "Message"
- Where: Compose's in-screen panel vs the app-wide banner and the Pending confirmations dialog.
- What happens (new detail beyond the known double prompt only): (a) the button order is mirrored. Compose puts "Not yet" on the left and the primary "Yes, log interaction" on the right. The banner and dialog put the primary "Yes" on the left. (b) An entry logged from "Did you email…?" appears as Channel "Message" in History and in the interaction sheet, not email.
- Why it's a problem: mirrored primary positions mean muscle memory hits the wrong button. Calling an email a "Message" hides how the person was reached.
- Evidence: 29-after-transmit-return.png, 32-banner-after-foreground.png, 39-pending-sheet.png, 49-history-logged-as-message.png, 65-interaction-sheet.xml (Channel "Message").
- Needs investigation: compare the Compose panel (ComposeScreen.tsx:1757-1787; buttons :1769-1784) with `AssistConfirmation` (src/components/AssistConfirmation.tsx:59-111, used by the banner and the sheet). Unify on one component. Check which channel the email path writes when logging.

### J-06 · HID · Medium — Pending confirmations: identical rows, no way to tell them apart, no Close, and actions with no feedback
- Where: banner → "1 more pending" → "Pending confirmations".
- What happens: two rows read exactly "Did you email Zz UX Full Profile?", with no time, message preview or channel detail. The dialog is centred (other sheets in the app are bottom sheets) and has no Close or Done button; only Back or a tap outside closes it. "Yes" and "Don't log" act at once: the row vanishes with no message and no Undo. "Don't log" discards without asking, although the app asks before other deletions. The empty state "You're all caught up" then stays until dismissed.
- Why it's a problem: the user cannot know which handoff they are confirming, and a wrong tap can't be reversed. See also J-02.
- Evidence: 39-pending-sheet.png, 46-pending-after-yes.png, 47-after-dont-log.png, 57-galaxy-light-pending-sheet.png.
- Needs investigation: src/components/PendingConfirmationsSheet.tsx. Rows render only an avatar plus `questionFor(channel, name)` (:206-226). The dialog is centred (`modalRoot justifyContent:"center"`, :246). Dismiss writes immediately (:131-150). Add the handoff time and a body preview per row, a Close button, and an Undo snackbar.

### J-07 · DEAD · Medium — A note typed under "Add a note" is thrown away without warning when the dialog closes (confirmed from code; not physically rechecked)
- Where: Pending confirmations → "Add a note" → type → tap outside the dialog (or keyboard Escape).
- What happens: the dialog closes. On reopening, the note field is gone and the text is lost. With the keyboard up, the dialog also slides so the second row and its buttons sit behind the keyboard.
- Why it's a problem: silent loss of typed text, the same pattern as E-01, F-01, G-12 and I-05.
- Evidence: 41-pending-note-keyboard.png, 43-note-after-back1.png (text present), 44-note-lost-after-backdrop.png (gone). Code: the note lives in `AssistConfirmation` local state (src/components/AssistConfirmation.tsx:27-28), inside an RN `Modal` whose children unmount when `visible` is false (PendingConfirmationsSheet.tsx:153-158). The device recheck was waived because it needs two more email handoffs.
- Needs investigation: keep note drafts per assist in state outside the modal, or confirm before dismissing with unsaved text.

### J-08 · VIS · Medium — The app-wide banner pushes Compose's Copy and Transmit to the gesture bar, where a stray tap fires Transmit
- Where: Compose while a confirmation is pending (banner with "1 more pending").
- What happens (new detail beyond the known double prompt only): the banner takes about 830 px (27%) at the top of every screen. On Compose it pushes the action row to the bottom edge: Transmit text at [1081,3075][1328,3120] and Copy at [776,3075][924,3120], inside the gesture area. Compose has no tab bar, so a tap where the Settings tab sits on other screens hit Transmit and opened a new email handoff. This happened once during the audit; it was backed out and nothing was sent.
- Why it's a problem: the main actions become hard to hit on purpose and easy to hit by accident.
- Evidence: 34-double-confirmation.png + 34-double-confirmation.xml (bounds above), 55-panel-after-accidental-transmit.png (no dump exists for 55), 57-galaxy-light-compose.png.
- Needs investigation: AssistBanner renders in flow above every screen (src/components/AssistBanner.tsx:51-61, root style :227-231). Consider hiding it on Compose while Compose's own panel shows, and a compact one-line banner.

### J-09 · INC · Medium — Compose's "Things to Remember" is a different, read-only rendition with doubled headings and renamed sections
- Where: Compose → "Things to Remember · 18" (route `ComposeResearch`).
- What happens: memories are split into two separate "Memory" groups with "Imported from Contacts App" between them. Every item repeats its group as its own label ("Memory / Memory", "Coffee order / Coffee order", "Avoid / Avoid"). Off Limits is called "Avoid" here. The outdated memory "Used to live in Denver" has no outdated marker, and the pinned memory has no pinned marker. Nothing can be tapped.
- Why it's a problem: it disagrees with the Profile's Things to Remember and its editor on section names and markers (see G-10, G-23), and the doubled group looks broken.
- Evidence: 16-research.png, 17-research-scroll1.png, 17-research-scroll2.png; dumps 16-research.xml, 17-research-scroll1.xml.
- Root cause: `groupItems()` (src/screens/ComposeResearchScreen.tsx:77-88) merges only consecutive items. Memories are read `ORDER BY pinned DESC, …` (src/db/memories-read.ts:39), so same-type memories are not adjacent and one group name appears twice. The repeated label comes from the read model, which sets `label: memoryGroupLabel(row)`, identical to `group` (src/db/compose-research-read.ts:203-206). The duplicate group name also produces the duplicate React key at ComposeResearchScreen.tsx:183 (other-findings J-X01).
- Proposed fix: group by name with a Map in first-seen order in `groupItems()`, which also removes the duplicate key at :183. Drop the per-item label when it equals the group name (:190), or stop setting it in compose-research-read.ts:205. Afterwards there is one "Memory" group and no repeated label lines.

### J-10 · COPY · Low — Compose's Things to Remember shows raw values
- Where: Compose → Things to Remember.
- What happens: the toggle field "Zz UX Coffee friend" shows "1". Dates show as "2026-10-13" and "2015-06-20". "Contact frequency" shows "30 days" where the Profile says "Monthly". The empty state reads "nothing to remember yet" in lowercase (ComposeResearchScreen.tsx:178, from code).
- Why it's a problem: developer-format values sit next to a message the user is writing. They are inconsistent with D-21 and the Profile.
- Evidence: 16-research.png, 17-research-scroll1.png, 17-research-scroll2.png; Profile "Monthly" in 66-after-cleanup-history.xml.
- Needs investigation: format with the same helpers the Profile uses. Start where ResearchItem values are built (src/db/compose-research-read.ts).

### J-11 · INC · Low — Compose and its own Things to Remember page differ in chrome: tab bar, + button, background, Back
- Where: Compose vs Compose → Things to Remember (`ComposeResearch`), and the Profile that opens Compose.
- What happens: Compose hides the tab bar and the + button and shows the theme background art. Its Things to Remember page shows the tab bar and the + button (covering list text) on a flat background (`colors.background`, ComposeResearchScreen.tsx:146). Compose has no title. Back differs on all three screens. Compose has a text "Back" on a pill, announced "Back" (ComposeScreen.tsx:1166-1167). The child page has plain text "Back", announced "Back to compose" (ComposeResearchScreen.tsx:157-161). The Profile has a chevron icon. (The Back-label point is merged from raw J-17.)
- Why it's a problem: two halves of one task look like screens from different apps. From the child page, the + and the tabs can take the user out of a half-written message. Adds to D-32 / H-08 (Back styles).
- Evidence: 06-compose-open.png, 16-research.png, 05-profile.png; tab/FAB presence in 06-compose-open.xml (none) vs 16-research.xml (both); Back labels in 22-compose-no-destination.xml and 16-research.xml.
- Proposed fix: add `"ComposeResearch"` to `FOCUSED_WORKFLOW_ROUTES` in src/navigation/focused-route-classification.ts:7-37 (next to `"Compose"`, :11). This set is what hides the tab bar and FAB for `Compose` (`isFocusedWorkflow`, :39-41). Optionally also give it `"dense"` in `ROUTE_DENSITY`. Afterwards the Things to Remember page opens without tabs or the + button, like Compose. Separately, align the Back control and label with Compose's (ComposeResearchScreen.tsx:157-161).

### J-12 · VIS · Low — Compose labels sit on visible patches in light themes and in Standard Dark
- Where: Compose in Galaxy Light, Standard Light and Standard Dark.
- What happens: "Back", the contact name and "Your message" each sit on a separate rounded rectangle over the background art, so they look like stray chips. Standard Dark shows this clearly, not faintly.
- Why it's a problem: polish; no sibling screen shows label patches like this.
- Evidence: 57-galaxy-light-compose.png, 57-standard-light2-compose.png, 57-standard-dark-compose.png. (The `57-standard-light-*` files are mislabelled duplicates of Standard Dark; use `light2`.)
- Needs investigation: `ChromeScrim` draws `colors.surface` at `chromeScrimOpacity(package, mode)` (src/components/ui/ChromeScrim.tsx:56-71), and Compose wraps each label separately (ComposeScreen.tsx:1161-1170, 1256, 1273, 1308). Check the opacity per package and mode against the mode-aware card glass.

### J-13 · HID · Low — Copy, Copy subject and Transmit all "work" with nothing to send
- Where: Compose with an empty message or an empty Subject.
- What happens: Copy on an empty message shows "Message copied". "Copy subject" with an empty Subject shows "Subject copied". Transmit with an empty message opens the email app and then creates a "Did you email …?" confirmation.
- Why it's a problem: false success messages, and a confirmation for a message that was never written.
- Evidence: 07-copy-empty.png/.xml, 15-subject-copied-feedback.png/.xml, 37-empty-transmit-panel.png.
- Proposed fix: `onCopy` and `onTransmit` never check `body`, and `resolveCopyTargets` returns `""` (not null) for an empty subject (src/logic/compose-logic.ts:230-236), so `onCopySubject` (ComposeScreen.tsx:1058-1070) proceeds. In src/screens/ComposeScreen.tsx, disable Copy and Transmit when `body.trim() === ""` (buttons at :1796-1816; testIDs compose-copy :1800, compose-transmit :1810), and disable or hide "Copy subject" when the subject is empty. Afterwards the buttons look disabled until there is text.

### J-14 · VIS · Low — "Subject copied" appears far from "Copy subject", often off-screen
- Where: Compose in email mode with a long message → tap "Copy subject" (near the top).
- What happens: Orbit's confirmation appears beside the Copy button at the bottom of the form, below the fold with a long message. Nothing from Orbit changes where the user tapped. Android's own "Copied" chip does appear, so there is a system hint.
- Why it's a problem: the feedback is detached from the control the user tapped.
- Evidence: 14-copy-subject-empty.png (nothing near the control after the tap), 15-subject-copied-feedback.png (feedback found after scrolling down).
- Needs investigation: `copyFeedback` renders only in the action row (ComposeScreen.tsx:1790-1795). Show it next to the tapped control, or as a toast.

### J-15 · HID · Low — No-destination Compose offers an email switch for a person with no email, and "Add a phone number or email" lands at the top of Edit Contact
- Where: Contacts → Zz UX Share New (no phone, no email) → Message.
- What happens: "Make this an email" is still offered and switches to a Subject form that can't be sent. "Add a phone number or email" opens Edit contact scrolled to Identity/Photo, not to the phone and email fields.
- Why it's a problem: it offers a mode that can't work, then drops the user far from the field they were sent to fill.
- Evidence: 22-compose-no-destination.png, 23-no-dest-email-mode.png, 25-edit-from-compose.png.
- Needs investigation: the mode switch is unconditional (ComposeScreen.tsx:1336-1346). Hide it when neither mode is usable (`controls.addNumber`, :1711). The Edit navigation passes only `contactId` (:1724); pass a section or scroll target.

### J-16 · VIS · Low — A long message makes the whole screen scroll: header gone, actions pushed down, no length hint
- Where: Compose with about 1,000 characters typed.
- What happens: the message box grows without limit. Back and the contact name scroll off the top, and Copy and Transmit end at the bottom edge in the gesture area. There is no character count, although the default mode is a text.
- Why it's a problem: the user loses the header and context, and the main actions drift into the gesture area.
- Evidence: 10-long-text.png, 11-long-text-scrolled.png.
- Needs investigation: `draftInput` has `minHeight: 120` and no `maxHeight` (ComposeScreen.tsx:1852-1859), and the whole screen is one ScrollView. Cap the input height (internal scroll) and keep the action row fixed at the bottom.

### J-17 · A11Y · Low — "Things to Remember, 1 items" plural slip
- Where: Compose, the Things to Remember link (contact with one item).
- What happens: the screen reader announces "Things to Remember, 1 items".
- Why it's a problem: a grammatical slip heard by screen-reader users.
- Evidence: 22-compose-no-destination.xml.
- Proposed fix: pluralise in src/screens/ComposeScreen.tsx:1359 (`${researchCount} item${researchCount === 1 ? "" : "s"}`). Afterwards it reads "1 item".

### J-18 · COPY · Low — "Transmit" and "Interaction Assist" are unusual words for Send and for the confirmation prompts
- Where: Compose action row; Settings → Interactions (the switch that controls these prompts) and the Settings hub row text.
- What happens: the send button says "Transmit", and the feature that asks "Did you send it?" is called "Interaction Assist". Neither word appears in the prompts themselves. The caption under the switch ("Ask me to log calls, texts and emails started from Orbit.") does explain it.
- Why it's a problem: jargon. Users looking for "send", or for the prompts' setting, won't recognise either word.
- Evidence: 06-compose-open.png; "Interaction Assist" at src/screens/SettingsInteractionsScreen.tsx:215, 220 and src/screens/settings-hub-model.ts:105 (hub row "Message defaults, dashboard swipe, and Interaction Assist").
- Cross-cutting note: the "Interaction Assist" half likely overlaps area K's (Settings) finding on the same wording. The cross-cutting pass should dedupe it there and keep "Transmit" here.
- Proposed fix: rename the button to "Send" or "Open in Messages/Email" (ComposeScreen.tsx:1812-1813). Rename the setting to "Ask if I sent it" (SettingsInteractionsScreen.tsx:215, 220; settings-hub-model.ts:105).

---

#### Comparisons with sibling areas
- **Back and discard:** Compose keeps a draft on Back (unlike E-01, F-01, G-12, I-05) but loses it on a contact switch (J-04). The Pending-confirmations note is lost on dismiss like the siblings (J-07). That makes three behaviours in the app.
- **Sheets and dialogs:** Pending confirmations is a centred dialog with no Close (J-06). The app's other sheets are mostly bottom sheets (A-28, D-25, B-16).
- **Headers:** Compose uses a text "Back" on a pill with no title, its child page a plain text "Back", and the Profile a chevron (J-11; adds to D-32 / H-08).
- **Wording:** mirrored primary buttons, and email logged as "Message" (J-05); "Transmit" and "Interaction Assist" (J-18).
- **Banner:** in flow at the top of every screen, about 27% of the height with "more pending" (J-08). It pushes screen headers and content down everywhere (seen on Contacts, Digest, Appearance).
- **Raw dates:** Compose's Things to Remember repeats D-21 / C-06 (J-10).
- **D-08 / E-06:** the Profile says the number can't be used, then Compose silently uses email (J-01).

#### Dropped
No raw finding was dropped whole. Sub-claims dropped, merged or corrected:
- J-02: recoded DEAD → HID. The write succeeds, so it is not a dead control.
- J-05: "two surfaces, different words and answers / no note / no Not yet" removed as the known double prompt (§3.5). Kept: mirrored buttons and the "Message" channel.
- J-08: "the banner stacks on top of Compose's own question instead of replacing it" removed as the known double prompt. Evidence corrected: there is no 55 dump; the bounds come from 34-double-confirmation.xml.
- J-09: "the 18 count matches nothing visible" dropped. The page lists exactly 18 items (2+3+1+2+1+1+1+5+2). Root cause added.
- J-17: "1 more pending looks like plain muted text with no button look" dropped. It is `accentText` with `accessibilityRole="button"` (AssistBanner.tsx:198-207), styled like the sibling "Add a note" link. The Back-label point was merged into J-11.
- J-12: "faintly in Standard Dark" corrected to "clearly".
- J-07: device recheck waived (it needs two more email handoffs). Kept as confirmed from code.

#### Routes covered
| Route / surface | Reached | How |
|---|---|---|
| `Compose` from Contacts-hosted Profile → Message | yes | 05→06; retest R1-b |
| `Compose` from Contacts card long-press → Message | yes | 21→22, 27 |
| `Compose` from Digest-hosted Profile → Message | yes | 50 (Back returns to Digest Profile) |
| `Compose` from Events-hosted Profile | no | not tried (same screen; time) |
| `Compose` from notification action | no | needs a live reminder notification; device clock may not be changed |
| Settings-hosted Profile Message (Archived) | yes | disabled with reason, 51; same on Contacts-hosted Archived profile, 53 |
| `ComposeResearch` | yes | 16, 17-* |
| Compose → Edit ("Add a phone number or email") | yes | 25 |
| Copy / Copy subject | yes | 07, 14, 15 |
| Text/email switch | yes | 12, 13, 23; retest R1-c |
| Transmit (email handoff) | yes | 4 deliberate + 1 accidental, all to zzux.full@example.com; backed out each time |
| Transmit (SMS handoff) | no | no Zz UX contact has a phone the app treats as usable |
| "Did you send it?" panel: Not yet / Yes | yes | 30, 35 |
| App-wide banner, "1 more pending" | yes | 32, 38 |
| Pending confirmations: Add a note / Yes / Don't log / empty state | yes | 40-47 |
| Theme spot-check (Galaxy L/D, Standard L/D) | yes | 54, 57-galaxy-light-*, 57-standard-dark-*, 57-standard-light2-* (57-standard-light-* are mislabelled duplicates of Standard Dark) |

#### Could not check
- Every AI control (Draft with AI, Rewrite with AI, Adjust): not pressed (owner rule).
- "Add to AI" toggles and the "Message focus" summary: no Things to Remember item on the Zz UX contact is AI-eligible (Share with AI off), and turning it on was not attempted.
- SMS handoff, the "This device can't send texts" helper, and the "Which number/email should Orbit use?" picker: these need a contact with a usable phone or several usable methods. None exists (D-08/E-06), and editing a real contact was not allowed. Zz UX Full Profile's only phone is 555-0101 (7 digits), which the Profile rejects for calls and messages.
- Behaviour with Interaction Assist switched off: skipped to avoid more email handoffs.
- Compose from a notification action and from the Events-hosted Profile.
- Physical Back gesture (keyevent 4 used instead). Keyboard Escape (keyevent 111) closes the Pending dialog, which a real user would rarely do.
- J-07 physical recheck: waived; confirmed from code.

---

## Area K — Settings — final findings (finalizer, 2026-10-10)

Sources: `findings-raw.md` (audit), `verification.md` (42 confirmed, 1 recheck), `recheck-list.md`, `retest-results.md` (K-11 reproduced 1/1). Evidence paths are relative to `untracked/artifacts/ux-audit/K-settings/` unless they say otherwise. The `zz-*-montage.png` files are side-by-side crops built from the numbered screenshots (see the raw file header).

**Counts: 44 findings.** HID 16 · COPY 13 · INC 8 · VIS 7 · A11Y 0 · LEFT 0 · DEAD 0. **High 1 · Medium 31 · Low 12.**

Numbering: the raw ids K-01…K-43 are kept unchanged, because nothing was dropped. K-44 is a new item from the verifier's observation, kept because screenshots 80 and 81 clearly show it.

---

### K-01 · HID · Medium — With "Allow notifications" off, every reminder switch still shows On and nothing says the settings are paused
- Where: Settings → Notifications (`SettingsNotifications`)
- What happens:
  - The master switch "Allow notifications" is off, which is the phone's current state.
  - Decay reminders, Birthday alerts, Birthday alerts for unbound contacts and Weekly digest still show filled On switches. They are disabled, but their titles are only slightly dimmed.
  - Reminder time, Quiet hours start and Quiet hours end are disabled and dimmed: their label and value turn to the secondary text colour, and the value loses its accent colour. Nothing explains why.
  - No line says these settings are paused. The master switch's explanation ("Get a calm morning reminder…") disappears once it is turned on, so the page jumps up.
- Why it's a problem: The switches say reminders are on while nothing will fire. A user who taps a dimmed row gets no response and no reason.
- Evidence: `32-notifications-top.png`, `33-notifications-bottom.png`, `34-notifications-master-on.png`, `37-reminder-time-inside-quiet-hours.png` (accent value when enabled, compare with 33), `zz-n-montage.png` (off vs on), `38-notifications-restored-off.png`; dumps `32-notif.xml`, `33-notif-b.xml` (every sub-switch is `checked=true enabled=false`).
- Proposed fix: In `src/screens/SettingsNotificationsScreen.tsx`, the sub-controls at :387, :435, :477, :528, :560, :597, :634 and :714 only set `disabled={!masterOn}`. When `!masterOn`, show the switches as off, or dim the whole group, and add one line under the master: "Turn on Allow notifications to use these settings." Keep the master description visible in both states (it is conditional at :266). The user will then see at a glance that reminders are paused and why.

### K-02 · HID · Medium — "Birthday alerts for unbound contacts" stays on and changeable when Birthday alerts is off
- Where: Settings → Notifications → BIRTHDAYS
- What happens: With Birthday alerts turned off, the child switch "Birthday alerts for unbound contacts" stays On and stays enabled. The scheduler ignores it when the parent is off (`services/notifications/notification-schedule.ts:472` gates on `birthdayEnabled`).
- Why it's a problem: The child setting can't do anything without its parent, but the page suggests it still works.
- Evidence: `35-notif-subs-off.png` (dump at that step: Birthday alerts `checked=false`, unbound `checked=true`, enabled).
- Proposed fix: `src/screens/SettingsNotificationsScreen.tsx:477` → `disabled={!masterOn || settings?.birthdayEnabled !== 1}`, styled as dependent (indented or dimmed). The child switch will then grey out when its parent is off.

### K-03 · HID · Medium — The reminder time can be set inside quiet hours with no warning
- Where: Settings → Notifications → DELIVERY TIME → Reminder time
- What happens: Reminder time was set to 10:00 PM while quiet hours run 9:00 PM to 8:00 AM. It was accepted silently (`onPickTime`, :199–216, saves with no check). The only hint is the static helper line "Reminders that would land inside quiet hours wait until the next morning" (:664–667).
- Why it's a problem: Every reminder would then always be held back, and nothing on the page says so.
- Evidence: `37-reminder-time-inside-quiet-hours.png`. Restored to 9:00 AM afterwards.
- Needs investigation: add an inline warning when the reminder time falls inside quiet hours (e.g. "Reminders will arrive at 8:00 AM, when quiet hours end"). Start at the delivery-time block in `SettingsNotificationsScreen.tsx` (around :560–:640).

### K-04 · INC · Medium — Settings pages use at least six different header and Back styles (deepens H-08)
- Where: Settings sub-pages
- What happens:
  1. Plain grey "Back" text inline with a title, in a full-width header. Used by Appearance, Contacts & Relationships, Interactions, Notifications, Orrery, Systems, AI, About, Categories and Archived (`01`, `21`, `29`, `32`, `40`, `73`, `88`).
  2. Backup & Restore uses the same text in an inset band, with Back lower and further right under a short divider. In Standard Light and Dark the band shows as a separate box that doesn't span the width (`59`, `zz-m5-montage.png` panels 3 and 6).
  3. A boxed "Back" button on its own line above a large title: Backup settings, Restore preview, Review flagged items (`60`, `70`, `25`). Custom Fields has a boxed Back beside its title (`26`).
  4. An accent-coloured "Back" with a large display-typeface title: AI Connections, AI Data Permissions (`75`, `83`).
  5. A full-width centred "Back" above the title: AI Personalization, Preview What Orbit Sends (`77`, `86`).
  6. No app header at all. The System builder shows a boxed "Cancel" inside a card (`43`). Its member list has a boxed "Back" plus a "Back to Definition" button (`57`). The restore result is a floating card with no title bar (`subset/restore-shots/10-restore-result.png`).
  - Typeface: Systems card titles, the builder, AI Connections, AI Data Permissions and the Interactions section headings use a geometric display face. The other Settings pages use the body face (`29`, `40`, `42`, `75`).
- Why it's a problem: These are sibling pages one tap apart, and each looks like a different app. H-08 found the same in import/merge. Settings shows the problem is app-wide.
- Evidence: listed inline above.
- Needs investigation: move every Settings page onto the `ShellAppBar` header that the hub's direct children already use. Start with `BackupScreen.tsx`, `BackupSettingsScreen.tsx`, `RestorePreviewScreen.tsx`, `AIConnectionScreen.tsx`, `AIPermissionsScreen.tsx`, `AIPersonalizationScreen.tsx`, `AIPreviewScreen.tsx` and `SystemBuilderScreen.tsx`.

### K-05 · INC · Medium — Settings pages use different row and page layouts, and tappable rows look the same as information cards
- Where: hub, Contacts & Relationships, Interactions, AI
- What happens:
  - Hub rows have an icon, a title, a subtitle and an icon-font chevron (`02`).
  - Contacts & Relationships rows are cards with no chevron and no icon. The non-tappable "Contacts access" information card looks identical to the tappable "Import contacts" and "Check linked contacts" cards (`21`; the dump shows "Contacts access" is not clickable).
  - AI rows show a title only, with a text "›" glyph (`73`).
  - Interactions has no cards and no section containers: bare headings and chips sit on the background (`29`). Every other sub-page uses cards.
  - Selected chips fill with the accent on Interactions, Appearance and AI Personalization. The Settings → Orrery Density list appends "— Selected" to the text instead (`39`, comparison only).
- Why it's a problem: The user can't tell what is tappable, and pages one level apart look unrelated.
- Evidence: `02-settings-hub-root.png`, `21-contacts-relationships-top.png`, `73-ai-top.png`, `29-interactions-top.png`, `39-settings-orrery-comparison-only.png`.
- Needs investigation: one row component (title, optional value, chevron) and one card layout for every Settings sub-page. Start with `SettingsContactsScreen.tsx`, `SettingsInteractionsScreen.tsx` and `SettingsAIScreen.tsx`.

### K-06 · INC · Medium — Four ways to save a setting; two of them silently throw away edits on Back
- Where: Backup settings (`BackupSettings`), AI Personalization, System builder, and the rest of Settings
- What happens:
  - Most settings save the moment you tap them.
  - Backup settings needs "Save schedule". Changing "Keep backups for" from 7 to 8 and pressing Back gave no warning, and the value was 7 again on return (verified by dump). A valid Save gives no "Saved" confirmation (`BackupSettingsScreen.saveDays`, :196–215).
  - AI Personalization needs "Save Writing Style", which sits mid-page below the fold (:494–499). Changing Tone to Casual and pressing Back gave no warning, and the change was gone on return.
  - The System builder does warn: "Discard changes? / KEEP EDITING / DISCARD" (`useDiscardKeepGuard`, `SystemBuilderScreen.tsx:279`).
- Why it's a problem: The same Back gesture keeps, discards or asks, depending on the page. Two pages lose input without telling the user. The siblings in other areas are E-01, F-01 and G-12.
- Evidence: `60-manage-backups.png`, `62-backup-save-schedule-valid.png` (no confirmation); `77-ai-writing-style.png`, `80-ai-personalization-context-row.png`; `58-builder-back-with-typed-name.png`.
- Needs investigation: either save these fields on change, like the rest of Settings, or add the builder's discard prompt and a "Saved" toast. Start in `BackupSettingsScreen.tsx` (Save schedule at :591) and `AIPersonalizationScreen.tsx`.

### K-07 · VIS · Medium — The System builder draws a decorative planet on top of its form
- Where: Settings → Orrery → Systems → Create New System, or Manage Members (`SystemBuilder`)
- What happens: A filled accent circle and a large ring sit over the Favorite, Needs Attention, Gravity and Social Battery rows. They stay fixed while the form scrolls, so the shape covers whatever field is under it.
- Why it's a problem: It looks like a rendering glitch over the text the user is reading.
- Evidence: `43-system-builder-new.png`, `43b-system-builder-after-wait.png`, `46-builder-save-empty-name.png`, also visible in `44`, `47`, `48`, `55`, `56`.
- Proposed fix: `src/screens/SystemBuilderScreen.tsx:200-221` (`BuilderBackgroundCanvas`, mounted at :506 on the root behind the scrolling translucent HUD) draws `Circle cx=160 cy=270 r=42` and `r=120`. Remove the two circles (keep the `Fill`), or give the HUD surface an opaque background. The form will then read cleanly.

### K-08 · HID · Medium — The System builder's "name required" error appears off-screen, and stays after you type a name
- Where: SystemBuilder → Save System (at the bottom) with an empty name
- What happens: Nothing visible happens. The error "Give this System a name." is inserted at the top of the form, out of view. After a name is typed, the error is still shown: `setError(null)` runs only at the start of `save` (:432–436), and nothing clears it when the name changes.
- Why it's a problem: Save appears to be dead. It repeats E-02 (Add/Edit Contact).
- Evidence: `46-builder-save-empty-name.png` (no message in view), `47-builder-top-after-save.png`, `48-builder-long-name.png` (error still present with a name).
- Needs investigation: on a failed validation, scroll to and focus the name field, and clear the error on change. Start in the `SystemBuilderScreen.tsx` save handler.

### K-09 · HID · Medium — "Manage Members" opens an editor, which has its own "Manage Members" button
- Where: Systems → (any system) → Manage Members
- What happens:
  - The button opens a screen titled "Edit Favorites". It is the full builder with a disabled name field and every filter row disabled, though the filters' "+" glyphs look the same as when enabled (dump 55: `enabled=false`).
  - A second "Manage Members" button at the bottom opens the actual member list.
  - That list has both a "Back" button and a "Back to Definition" button.
  - Built-in systems also offer "Reset Membership Overrides".
- Why it's a problem: The user needs two taps through an unrelated-looking screen, and "Definition" and "Overrides" are developer words.
- Evidence: `55-manage-members-favorites.png`, `56-manage-members-bottom.png`, `57-manage-members-list.png`; dump `55.xml`.
- Needs investigation: open the member list directly from the Systems card (`SystemsManagementScreen.tsx:467–469` routes to `SystemBuilder`), and rename "Back to Definition" (`SystemBuilderScreen.tsx:654`) to "Back" or "Done".

### K-10 · INC · Medium — The Systems list uses yet another way to manage a list, and makes Delete the loudest button on every card (extends G-08)
- Where: Settings → Orrery → Systems (`SystemsManagement`)
- What happens:
  - Each custom system shows Edit, Rename and Duplicate, plus a red filled "⚠ Delete" button.
  - "Overrides" sits next to an empty circle that looks like a radio button. It is actually a status indicator (`SystemsManagementScreen.tsx:227–232`, icon `status-neutral`) and can't be tapped.
  - Built-in systems show a reorder icon. On All Contacts it is disabled ("All Contacts is pinned first", dump 40) but looks the same as the others.
  - Delete uses an unthemed native dialog with all-caps CANCEL / DELETE (:434).
  - So Settings now has four list patterns:
    - Custom Fields: Up/Down buttons.
    - Categories: drag handle plus a ⋯ menu.
    - Systems: drag handle plus inline buttons.
    - AI Personalization sections: sort handle plus Move up/down plus ⋯ (K-38).
- Why it's a problem: The same job, managing a list of named things, works differently on every page. A destructive action is the most prominent control on each card.
- Evidence: `40-systems-management.png`, `42-systems-bottom.png`, `51-systems-with-new.png`, `52-system-delete-confirm.png`; dump `40-systems.xml`.
- Needs investigation: one list-management pattern for Custom Fields, Categories, Systems and AI sections, with Delete behind ⋯. Start in `SystemsManagementScreen.tsx`. ("0 members" with every filter Any, and the unconfirmed Archive, are known item N-10 and are not re-reported.)

### K-11 · COPY · Medium — The phone number region picker is close to unusable: bare codes, name search finds nothing, the sheet hides behind the keyboard, and stale search text survives
- Where: Settings → Contacts & Relationships → Phone number region
- What happens:
  - Every row reads like "AC (AC)", "AD (AD)", "AE (AE)".
  - Tap "Search regions" and the keyboard opens over the whole sheet. The sheet sits at y 2377–3120 and the keyboard top is at about y 1830, so the user sees only the Contacts & Relationships page and can't see what they type.
  - Typing "Germany" gives an empty list with no "No matches" message. Only "DE" finds "DE (DE)", and even that row ends up behind the keyboard.
  - Closing the sheet without picking a region keeps the search text. Reopening shows "Germany" still in the field over an empty list.
- Why it's a problem: Most people don't know ISO region codes, they can't see the search they are typing, and a reopened picker looks broken (empty) for no visible reason.
- Evidence: `23-phone-region-picker.png`, dump `23-region.xml`. Retest (reproduced): `retest/K-R1-01-sheet-open.png` + `retest/K-R1-01.xml` (code-only rows); `retest/K-R1-02-germany-ime-open.png` + `retest/K-R1-02.xml` (sheet entirely behind the keyboard); `retest/K-R1-04-reopened-germany-prefilled.png` (search text kept, no results, no empty state); `retest/K-R1-05-DE-code-search.png` + `retest/K-R1-05.xml` (code search works, row behind the keyboard). Raw `24-region-search-germany.png` shows only the page behind the keyboard, which is consistent with the hidden sheet.
- Proposed fix in `src/screens/SettingsContactsScreen.tsx`. Afterwards rows read "Germany (DE)", searching "Germany" works, the sheet stays visible while typing, and each opening starts clean.
  - Names (:56–62): `Intl.DisplayNames` is missing on Hermes, so the code falls back to `name = code`. Bundle a static code→English-name table (or the names shipped with the phone-number library) instead.
  - Empty state: the `FlatList` (:451–469) has no `ListEmptyComponent`. Add "No regions match".
  - Keyboard: the `Modal` (:400–413; style `regionModal` ~:536–545, `justifyContent: flex-end`) has no keyboard handling. Wrap the sheet in a `KeyboardAvoidingView`, or anchor it to the top of the screen.
  - Stale search: `onRequestClose` (:404) only closes the sheet. Clear the search there too (`setPhoneRegionSearch("")` today runs only after a selection, :181).

### K-12 · COPY · Medium — Backup settings never says which folder is selected
- Where: Data & Backup → Manage backups → Backup folder
- What happens: The folder name always reads "Selected backup folder". The real folder is `/sdcard/Documents/Orbit backups/`.
- Why it's a problem: The user can't confirm where backups go without opening a file browser.
- Evidence: `60-manage-backups.png`.
- Proposed fix: `src/screens/BackupSettingsScreen.tsx:148` stores the literal `backupFolderName: "Selected backup folder"`, and :483 renders it. Derive a display name from the SAF tree URI by decoding its last segment (e.g. `primary:Documents/Orbit backups` → "Documents › Orbit backups"). The row will then show the real folder.

### K-13 · HID · Medium — "Your backup needs attention" offers no way to back up now
- Where: Data & Backup (`Backup`)
- What happens:
  - A yellow-dot card says "Your backup needs attention. Your data has changed since the last automatic backup" (`backup-health-logic.ts:98–104`). Its only action is "Manage backups".
  - Export now opens the share sheet, which (per setup) has no save-to-device target. Exporting doesn't clear the warning.
  - An automatic backup runs only at app launch, once the cadence has passed. No "back up now" action exists anywhere in `src/screens`.
- Why it's a problem: The app raises a warning the user can't resolve from the screen.
- Evidence: `59-backup-top.png`, `66-after-export-share-cancelled.png`; `setup/SETUP-REPORT.md`.
- Needs investigation: add "Back up now" (write to the selected folder) to the warning card. Start in `BackupScreen.tsx`.

### K-14 · HID · Medium — Export asks "Export readable JSON?" as if that were the choice you made, with no Cancel
- Where: Data & Backup → Export now (encryption on)
- What happens: An unthemed native dialog opens, titled "Export readable JSON?", with "Anyone with this file can read its contents…". Its two all-caps buttons are "EXPORT READABLE JSON" on top and "KEEP ENCRYPTED EXPORT" below. There is no Cancel.
- Why it's a problem: The user pressed "Export now", but the dialog frames the unsafe option as the question and shows it as the primary button. There is no way to back out, and the style differs from the app's own dialogs.
- Evidence: `65-export-now-step1.png`; dump `65.xml`.
- Proposed fix: `src/screens/BackupScreen.tsx:240–252`. The code already lists "Keep encrypted export" first, but Android's native Alert renders the last button as the positive (top) one, so reordering the array alone is fragile. Use the themed `ConfirmDialog` (already used at `AIPersonalizationScreen.tsx:697`) with title "Export backup" and options "Encrypted (recommended)" / "Readable JSON" / "Cancel". With a native Alert, add a `style: "cancel"` button and put the safe choice last. The safe choice will then be the prominent one, and the user can back out.

### K-15 · COPY · Medium — Backup files have unreadable names: a raw number for exports, UTC times for automatic backups
- Where: Data & Backup → Restore a backup → system file picker (Orbit backups folder)
- What happens:
  - An exported file is named `orbit-backup-1791610749112.json`, a millisecond timestamp.
  - Automatic backups are named like `orbit-auto-2026-10-10T06-47-00-060Z.json`, in UTC. The picker shows this one as made at 1:47 AM local time.
  - Only the pushed `orbit-subset-100.json` has a readable name.
- Why it's a problem: When restoring, the user picks by file name, and these names don't say when the backup was made in their own time (the root of RESTORE-REPORT K-raw-1).
- Evidence: `65b-restore-system-picker-dump-no-screenshot.xml` (dump of the picker; no screenshot because it is system UI).
- Proposed fix: name files with the local date and time, e.g. `Orbit backup 2026-10-10 00-39.json`. Afterwards the picker shows when each backup was made in the user's time. Change all of these together:
  - Exports: `src/services/backup/share-export.ts:51` builds `orbit-backup-${now()}.json`, and :44 and :70 parse the numeric stamp for cleanup.
  - Automatic backups: `src/backup/auto-backup-policy.ts:11` builds the name with `toISOString()` (UTC), and :16, :49 and :71 parse it.

### K-16 · HID · Medium — The restore flow never says which file you picked, and two different backups can show the same date
- Where: Restore a backup → passphrase step → Restore preview
- What happens:
  - After a file is picked, neither the inline "Enter backup passphrase" card nor the Restore preview shows the file name.
  - The passphrase field is `secureTextEntry` with no show/hide control (`BackupScreen.tsx:559`).
  - Per RESTORE-REPORT K-raw-1, the 100-contact subset and the full backup both showed "Source date: Oct 10, 2026, 12:39 AM", with only the counts line differing. Only the subset preview is screenshotted here; the matching date on the full backup comes from that report, not from a screenshot.
- Why it's a problem: A user choosing between backups can't confirm they picked the right one before a destructive Replace.
- Evidence: `67-restore-after-pick.png`, `70-restore-preview.png`; `subset/restore-shots/04-passphrase-prompt.png`, `06-restore-preview-100-contacts.png`; K-raw-1 and K-raw-2 in `subset/RESTORE-REPORT.md`. (The "+ button covers Continue" point moved to K-30.)
- Needs investigation: show the file name (and size) in the passphrase card and in "Backup details", and add a show/hide toggle. Start in `BackupScreen.tsx` (around `validateRestore`) and `RestorePreviewScreen.tsx:362`.

### K-17 · COPY · Medium — Restore preview speaks developer, and doesn't compare the backup with what's on the phone
- Where: Restore preview (`RestorePreview`)
- What happens: "Backup details" lists "Format version: 7", "Related rows: 1882" and "Tombstones: 696". It never says how many contacts are on the phone now, or what Replace would remove.
- Why it's a problem: The numbers mean nothing to a user, and the one number that matters is missing.
- Evidence: `70-restore-preview.png`; dump `70-preview.xml`.
- Proposed fix: `src/screens/RestorePreviewScreen.tsx:369–378`: drop "Format version" and "Tombstones", rename "Related rows" to "Notes, interactions and other details", and add "On this phone now: N contacts". The user will see a before/after.

### K-18 · HID · Medium — The Replace confirmation gives no idea of scale, in an unthemed all-caps dialog (from RESTORE-REPORT, not re-run)
- Where: Restore preview → Replace all → Replace and restore
- What happens: The dialog reads "Replace all local data? / Orbit will first create and verify a fresh automatic backup of this device." with REPLACE AND RESTORE / KEEP LOCAL DATA. It doesn't say how many contacts will be removed (in the real run, 1,028 went down to 100).
- Why it's a problem: The most destructive action in the app gives the least information.
- Evidence: `subset/restore-shots/08-replace-confirm-dialog.png`; K-raw-3 in `subset/RESTORE-REPORT.md`. Not pressed in this pass (no restore over phone data).
- Needs investigation: put the local and backup counts in the dialog, and use the app's themed destructive dialog. The dialog copy lives in `src/screens/backup-restore-logic.ts:295–304` (`replaceAllConfirmation`). Start there and at the Replace handler in `RestorePreviewScreen.tsx`.

### K-19 · COPY · Medium — After Replace, the result says "Deletions applied: 0" and is a dead end (from RESTORE-REPORT)
- Where: `RestoreResult`
- What happens:
  - The result reads "Backup restored · Added: 2305 · Updated: 0 · Newer local kept: 0 · Deletions applied: 0", although about 928 local contacts had just been removed.
  - The only button is "Return to Settings". There is no "View contacts" and no title bar (`paddingTop: 48`).
  - Nothing mentions that favourites were dropped (see K-22).
- Why it's a problem: The summary contradicts what happened, and the user is sent back to Settings rather than to their data.
- Evidence: `subset/restore-shots/10-restore-result.png`; K-raw-4 and K-raw-7 in `subset/RESTORE-REPORT.md`. Not reachable without a restore.
- Needs investigation: for Replace, report "Replaced N contacts on this phone with M from the backup", and add "View contacts". Start at `RestoreResultScreen.tsx`.

### K-20 · HID · Medium — A restore runs for minutes with no progress, and the tab bar stays usable meanwhile (from RESTORE-REPORT)
- Where: Restore preview → Replace and restore
- What happens:
  - A card says only "Restoring backup… This can take a moment…" for 7–8 minutes on 1,028 contacts. There is no step or progress indicator.
  - The tab bar and the + button stay visible and active under it.
- Why it's a problem: The user can't tell whether the app is stuck, and can wander into other screens mid-restore.
- Evidence: `subset/restore-shots/09-replace-in-progress.png`; K-raw-5 in `subset/RESTORE-REPORT.md`.
- Needs investigation: show steps (safety backup → applying) and block navigation while applying. Start in `RestorePreviewScreen.tsx`.

### K-21 · INC · Low — Restore preview: "Merge" preselected, and one option has three names
- Where: Restore preview
- What happens:
  - Merge is preselected, and the button reads "Merge backup" until you tap the Replace card. Then it becomes "Replace and restore".
  - The Replace option has three names: "Replace all" on the card, "Replace all local data" for the screen reader, and "Replace and restore" on the button.
  - The selected card is marked only by a thin border.
- Why it's a problem: It is easy to misread which action the big button will do.
- Evidence: `70-restore-preview.png`, `71-restore-preview-replace-selected.png`; `subset/restore-shots/06`, `07`; K-raw-6.
- Needs investigation: use the same verb on card and button, and a stronger selected state. The labels are in `src/screens/backup-restore-logic.ts:288–292` and `RestorePreviewScreen.tsx:401–437`.

### K-22 · HID · High — Favourites aren't in backups, so any restore silently unfavourites everyone, and Data & Backup doesn't say so
- Where: Data & Backup footer; Restore preview; Restore result
- What happens:
  - The footer says "Backups include your contacts, notes, photos, and settings. API keys are never included."
  - Favourites (`favourite_rank`) are not exported. The contacts export query at `src/backup/export-manifest.ts:149` omits the column, and nothing under `src/backup` or `src/services/backup` references it.
  - So any Replace restore unfavourites everyone, even when it restores a full backup of the same phone. Neither the backup page, the preview nor the result mentions this.
- Why it's a problem: The data is lost. A user-curated list disappears on restore with no warning, contrary to the footer's promise.
- Evidence: `59-backup-top.png` (footer); code `src/backup/export-manifest.ts:149`; `subset/SUBSET-REPORT.md` (risk "Favourites are lost and cannot be restored"); `subset/RESTORE-REPORT.md` (favourites re-marked by hand after the real restore). Not physically re-run (it needs a restore), but code-confirmed.
- Needs investigation: include favourites in the backup format, on both export and apply. Until then, list them as "not included" in the footer and on the preview. Start at `src/backup/export-manifest.ts:149` and the matching apply code in `src/backup/`. This touches the backup format and migrations, so the scope is the owner's call.

### K-23 · COPY · Low — Backup naming and navigation don't line up: "Data & Backup" vs "Backup & Restore", "Manage backups" vs "Backup settings", and the Encryption row lands at the top
- Where: hub → Data & Backup → Manage backups / Encryption
- What happens:
  - The hub row "Data & Backup" opens a page titled "Backup & Restore".
  - The link "Manage backups" opens a page titled "Backup settings".
  - The Encryption row on Backup & Restore opens Backup settings scrolled to the top. Its Encryption section is two screens down.
  - Encryption status appears on both pages.
- Why it's a problem: The labels don't predict the destination, and the Encryption tap seems to land on the wrong thing.
- Evidence: `02-settings-hub-root.png`, `59-backup-top.png`, `60-manage-backups.png`, `63-backup-settings-encryption.png`, `64-backup-encryption-row-target.png`; K-raw-8.
- Proposed fix: `BackupScreen.tsx:646` already calls `openSettings("encryption")`, which passes `{ section }`, but `BackupSettingsScreen.tsx` never reads `route.params.section`. Read it on mount and scroll to the Encryption group. Also use one name per page ("Backup & Restore" on the hub row; "Backup settings" on the link). Tapping Encryption will then land on Encryption, and the labels will match the titles.

### K-24 · VIS · Low — Backup & Restore uses text glyphs for icons, and Export and Restore both show up-arrows
- Where: Data & Backup
- What happens: Export shows "⇧", Restore shows "↥", Encryption shows "⌑" and the footer shows "⌾". These are text characters (`BackupScreen.tsx:487, 513, 652, 702`), not the icon set used on the hub. Restore has an upload-style arrow.
- Why it's a problem: It looks unfinished, and the two main actions look alike.
- Evidence: `59-backup-top.png`.
- Needs investigation: use the app icon font (e.g. download/restore and lock icons) at those lines.

### K-25 · INC · Medium — Appearance mixes the app theme with Orrery-only settings, although Settings has an Orrery page
- Where: Settings → Appearance (`SettingsAppearance`)
- What happens:
  - Below Theme, Mode, Accent and Background, the page holds "YOUR PROFILE" (Your name, Your photo) and "ORBIT APPEARANCE" (Your star, Orbit Center).
  - The help texts for Your name, Your star and Orbit Center are all about the centre of the orrery, yet Settings → Orrery is a separate page.
  - "Orbit Center" (US spelling) sits over a description that says "centre".
- Why it's a problem: A user looking for orrery options won't think of Appearance, and "Your profile" here isn't the contact Profile.
- Evidence: `04-appearance-mid.png`, `05-appearance-lower.png`, `39-settings-orrery-comparison-only.png`.
- Needs investigation: move Your name, photo, star and Orbit Center to Settings → Orrery, or rename the section. Pick one spelling. `SettingsAppearanceScreen.tsx`.

### K-26 · HID · Medium — Default profile layout and background: untitled lists of templates named after people, with no preview or explanation
- Where: Appearance → PROFILE DEFAULTS → Default profile layout / Default profile background
- What happens:
  - Each opens a floating list with no title. The options are "Default / None" plus templates such as "Test template", "Andrew Wales's background", "Dad's background" and "Joyce Milligan's background".
  - Nothing explains that templates are created from a contact's Profile → ⋯ → Background or Layout. There are no thumbnails.
  - The page now has two unrelated "Background" settings: the app backdrop (Deep Space…) and the default profile background.
  - The same global default can also be set from a Profile's Background sheet ("Set as global default").
- Why it's a problem: Users can't tell what they would be choosing, or how to make a new template.
- Evidence: `09-default-profile-layout.png`, `10-default-profile-background.png`, `04-appearance-mid.png`; dumps `09-default-layout.xml`, `10-default-bg.xml`.
- Needs investigation: add a title, thumbnails and a one-line "Create templates from any profile's ⋯ menu". Rename the two settings "App background" and "Profile background". `SettingsAppearanceScreen.tsx`.

### K-27 · INC · Medium — Five different picker designs within Settings
- Where: Appearance, Contacts & Relationships, Notifications, AI Preview
- What happens:
  - Orbit Center: a floating list with no title, a search box and no avatars. A search with no results shows an empty box with no message, and the search box jumps to mid-screen (`07`, `08`).
  - Profile defaults: an untitled floating list with no search (`09`, `10`).
  - Phone number region: a titled bottom sheet with search (`23`; see K-11 for its own problems).
  - Reminder and quiet-hours times: the unthemed native Android clock dialog, with teal and grey colours and all-caps CANCEL/OK (`36`).
  - Preview with contact: a titled "Choose contact" sheet with avatars (`87`). It differs from the Orbit Center contact list on Appearance.
- Why it's a problem: Choosing one item from a list looks different on every page. Two of these are contact pickers with different designs (compare A-24 and I-08).
- Evidence: `07-orbit-center-picker.png`, `08-orbit-center-search-nomatch.png`, `09-default-profile-layout.png`, `10-default-profile-background.png`, `23-phone-region-picker.png`, `36-reminder-time-picker.png`, `87-ai-preview-with-contact.png`.
- Needs investigation: one themed sheet picker (title, search, empty state, avatars for contacts, keyboard-aware) and a themed time picker. Start from the region picker in `SettingsContactsScreen.tsx`, which is the most complete.

### K-28 · VIS · Medium — The selected accent colour is nearly invisible, and the colour pickers mark selection differently
- Where: Appearance → Accent / Your star
- What happens:
  - A selected accent swatch differs from the others only because its ring takes on the swatch's own colour. Every other swatch has a grey ring.
  - Your star marks selection with an accent-coloured outer ring. Theme and Mode chips fill solid.
  - Accent swatches are announced by name ("Accent rose quartz", `SettingsAppearanceScreen.tsx:733`). Star swatches are announced only as "Star colour 1" … "Star colour 6" (:922).
- Why it's a problem: After tapping an accent, the user can't easily see which one is active (the whole app retints, but the picker doesn't show it). Screen-reader users can't tell the star colours apart.
- Evidence: `zz-crop2-montage.png` (rose quartz selected), `13-std-light-accent-amber.png`, `05-appearance-lower.png`; dump `05-app-lower.xml`.
- Needs investigation: give swatches a check mark or a thick contrasting ring, and name the star colours (:922). `SettingsAppearanceScreen.tsx`.

### K-29 · VIS · Medium — Switches are hard to read in Galaxy Dark: a dark thumb on a dark track, and "off" almost invisible (confirms E-22)
- Where: Interactions, Notifications, AI, AI Data Permissions
- What happens: The thumb is a dark navy circle. With the switch on, a short accent sliver shows. With it off, the switch is dark on dark.
- Why it's a problem: State is hard to read, especially for the off switches in AI Data Permissions and "Show names on lock screen".
- Evidence: `zz-sw-montage.png` (on vs off), `32-notifications-top.png`, `83-ai-permissions.png`.
- Proposed fix: the switches pass `thumbColor={colors.surfaceElevated}` (e.g. `SettingsNotificationsScreen.tsx:263`, `AIPersonalizationScreen.tsx:577`, and the other Settings switches). Use a light thumb token, such as the on-accent or text-primary colour, and a visible border-colour track for off. Every switch will then read clearly.

### K-30 · VIS · Medium — The + button covers controls throughout Settings
- Where: most Settings pages
- What happens: the + button covers:
  - the Data & Backup row chevron on the hub (`02`);
  - the Your name field and its hint on Appearance (`zz-m1-montage.png`, `zz-m2-montage.png`);
  - the Interaction Assist description (`29`);
  - "Continue to preview backup" on the restore passphrase card (`67`; merged from raw K-16);
  - the "Enabled only" switch in AI Data Permissions (`83`, `85`; merged from raw K-39);
  - the Custom guidance text on AI Personalization (`77`), and the section text on Personalization Context (`80`, `81`).
- Why it's a problem: It hides real controls on admin pages where it has no job. This is the same cross-area problem as A-10, C-14, D-18 and G-21.
- Evidence: listed inline above.
- Needs investigation: hide the + button on the Settings stack, or add bottom padding equal to its height. `App.tsx:440` (mount), `universal-fab-logic.ts`.

### K-31 · VIS · Medium — Your name: the keyboard covers the field, and the name saves silently on blur
- Where: Appearance → YOUR PROFILE → Your name
- What happens:
  - With the field focused, the keyboard covers it. The page doesn't scroll, so you type blind.
  - The name saves on blur (`onEndEditing`, `SettingsAppearanceScreen.tsx:833`) with no confirmation. (The field has `maxLength={100}` at :837; a 66-character test name was within it.)
- Why it's a problem: The user can't see what they type, and gets no sign it was saved. The same keyboard problem is F-11 on Edit interaction.
- Evidence: `18-your-name-long-typing.png`, `19-your-name-long-after-ime.png`; cleared back to empty afterwards (`20-your-name-cleared.png`).
- Needs investigation: make the scroll view keyboard-aware (scroll the focused field into view), and give a brief saved cue. `SettingsAppearanceScreen.tsx`.

### K-32 · INC · Low — Interactions page wording doesn't match itself or the rest of the app
- Where: Settings → Interactions
- What happens:
  - One page says both "Remember last" and "Remember Last Choice".
  - "Default message mode" (Text/Email) and "Default interaction channel" (Message/Call/In Person) call the same channel "Text" and "Message".
  - "Dashboard right swipe" and "a dashboard card", although the tab is called Contacts (A-17).
  - The swipe option "Log Contact" is called "Log Interaction" everywhere else.
  - Chips mix Title Case and sentence case.
- Why it's a problem: The user can't tell whether "Text" and "Message" are different things.
- Evidence: `29-interactions-top.png`.
- Proposed fix:
  - In `src/screens/settings-interactions-logic.ts`, change :30 "Remember last" and :72 "Remember Last Choice" to "Remember last choice"; change :31 "Text" to "Text message" (and the matching "Message" channel label); change :52 "Log Contact" to "Log interaction".
  - In `src/screens/SettingsInteractionsScreen.tsx:184`, change the "dashboard card" copy to "Contacts list right swipe".

### K-33 · COPY · Low — Your Week period and Weekly digest (agrees with C-10, adds detail)
- Where: Settings → Interactions → "Your Week period"; Notifications → WEEKLY DIGEST
- What happens:
  - Settings describes Your Week as "The period used by the Digest retrospective" (`SettingsInteractionsScreen.tsx:200`) and files it under Interactions, while the same toggle sits on Digest (C-10).
  - The Weekly digest notification promises "A Sunday-morning look back at your week". It is fixed to Sunday (`services/notifications/digest-schedule.ts:61`, `DIGEST_WEEKDAY = 1`) whatever "Your Week period" is set to.
  - The notification is a "weekly digest", but the Digest tab isn't weekly.
- Why it's a problem: Three Digest-related settings sit on two pages, under three different words.
- Evidence: `29-interactions-top.png`, `33-notifications-bottom.png`.
- Needs investigation: group the Digest settings (Your Week period, weekly summary notification) together, and drop "retrospective". `SettingsInteractionsScreen.tsx:197–200`.

### K-34 · COPY · Low — Notification jargon: "Decay reminders" and "unbound contacts"
- Where: Settings → Notifications
- What happens: The switches are titled "Decay reminders" and "Birthday alerts for unbound contacts" ("Keep birthday reminders on for contacts outside your active orbit"). (The Archived wording on Contacts & Relationships, "People you've moved out of your active orbit", is H-26 and is not re-reported. Together they make "outside your orbit" mean two things.)
- Why it's a problem: "Decay" and "unbound" are internal terms.
- Evidence: `32-notifications-top.png`, `22-contacts-relationships-bottom.png`.
- Proposed fix: rename to "Check-in reminders" and "Birthday alerts for people you don't track" in `SettingsNotificationsScreen.tsx`. Apply H-26's fix at `settings-contacts-model.ts:184`.

### K-35 · COPY · Medium — The AI page shows no current state, and its rows don't match the pages they open
- Where: Settings → AI (`SettingsAI`)
- What happens:
  - The rows are Connection, Model, Writing Style, Personalization Context, AI Data Permissions and Preview What Orbit Sends. None shows its current value (e.g. "OpenRouter · gemini-flash").
  - "Writing Style" and "Personalization Context" both open the same page, "AI Personalization".
  - "Connection" opens "AI Connections".
  - The switch keeps the label "AI Enabled" when it is off.
  - The hub row says "personalization", while the AI page says "Writing Style".
- Why it's a problem: The user can't see the AI setup at a glance, and two rows lead to one place.
- Evidence: `73-ai-top.png`, `74-ai-disabled.png`, `77-ai-writing-style.png`, `80-ai-personalization-context-row.png`.
- Needs investigation: show values on the rows, merge the two personalization rows, and label the switch "Use AI suggestions". Navigation is in `SettingsAIScreen.tsx` around :207–255.

### K-36 · COPY · Medium — AI Connections: an active provider still shows "Connect with OpenRouter" as its main button
- Where: AI → Connection (`AIConnection`)
- What happens:
  - The OpenRouter card is marked "Active" and still shows a large primary "Connect with OpenRouter" (`AIConnectionScreen.tsx:365–373`; the label never changes when active).
  - Under it, "Choose model" is a plain link next to a red filled "⚠ Disconnect" (:326).
  - Saved providers expand into "Paste API key / Save key / Use saved connection / Choose model / Remove key" (browsed only, nothing pressed).
- Why it's a problem: The user can't tell whether it is connected, and the destructive action is the loudest control.
- Evidence: `75-ai-connection.png`, `76-ai-openai-expanded.png`.
- Needs investigation: when active, show "Connected" with "Change model" as the primary action and Disconnect as secondary. `AIConnectionScreen.tsx`.

### K-37 · HID · Medium — AI Personalization: "Use custom guidance instead" ×3, and the preset still looks selected after you switch
- Where: AI → Writing Style
- What happens:
  - Tone, Length and Directness each have their own "Use custom guidance instead" link.
  - Tapping one flips its label to "Use Tone controls", but the "Balanced" chip stays highlighted, because the segmented value is forced to the default preset (`AIPersonalizationScreen.tsx:433, 446, 461`). Nothing else shows that custom guidance now drives Tone.
  - The Custom guidance text box is always shown, filled, even while all three presets are active (:475–493).
- Why it's a problem: The user can't tell which instructions the AI will follow.
- Evidence: `77-ai-writing-style.png`, `78-ai-use-custom-guidance-tapped.png`. Restored to "Use Tone controls"; not saved.
- Needs investigation: grey out the chips when custom is chosen, and show the guidance box only when at least one dimension uses it. `AIPersonalizationScreen.tsx`.

### K-38 · HID · Medium — AI Personalization sections: the ⋯ options open off-screen, below the section's long text
- Where: AI → Personalization Context → a section's ⋯
- What happens:
  - Tapping ⋯ seems to do nothing. "Rename / edit", "Replace from file" and "Delete section" appear inline below the whole section body, a screen further down.
  - The same row also has a sort icon and Move up / Move down buttons. The sort icon has no drag gesture: it is only an accessibility "adjustable" control (:538–556). On touch it looks like a second reorder control that does nothing.
- Why it's a problem: It looks like a dead button (it took three taps and a scroll to find the options). The duplicate reorder controls are noise. This is close to G-18 (inline editors far from the tapped card).
- Evidence: `81-ai-section-options.png`, `81b-ai-section-options.png`, `81c-ai-section-options-touchscreen.png`, `82-ai-section-options-below.png`; dumps `81.xml`, `82.xml`.
- Proposed fix: `src/screens/AIPersonalizationScreen.tsx:604–625` renders the options after the body (:557–569) and the move buttons (:590–603). Render them in a bottom sheet or menu anchored to ⋯ (as Categories does), and drop either the sort icon or the Move buttons. The options will then appear where the user tapped.

### K-39 · HID · Low — AI Data Permissions: "Review existing…" silently changes filters off-screen
- Where: AI → AI Data Permissions
- What happens: "Review existing…" under Memories doesn't scroll. It silently selects the "Memories" chip and turns off "Enabled only" in the Review section below the fold (`AIPermissionsScreen.tsx:283–288`). The summary reads "Showing 6 of 523 items from 1 contact · AI can access none of them". (The + covering "Enabled only" is in K-30.)
- Why it's a problem: The tap looks like it did nothing, and it changed a filter the user didn't touch.
- Evidence: `84-ai-review-existing-memories.png`, `85-ai-review-list.png`, `83-ai-permissions.png`; dumps `84.xml`, `85.xml`. Filters restored (All, Enabled only on).
- Needs investigation: scroll to the Review section on tap. `AIPermissionsScreen.tsx:283–288`.

### K-40 · COPY · Low — "Preview What Orbit Sends" is written for developers
- Where: AI → Preview What Orbit Sends (`AIPreview`)
- What happens:
  - The page uses "This is the complete resolved prompt", "Raw resolved view" and "Orbit instructions and output contract" (`AIPreviewScreen.tsx:146`, :160).
  - The prompt text has hard line breaks mid-sentence ("friendly, specific / only to…").
  - The page has a flat background, unlike its siblings, and a centred Back.
- Why it's a problem: The page exists to reassure users about privacy, but it reads like a debug view.
- Evidence: `86-ai-preview.png`; dump `86.xml`.
- Needs investigation: plain wording ("This is exactly what Orbit sends to your AI provider") and reflowed text. `AIPreviewScreen.tsx`.

### K-41 · HID · Low — About Orbit shows only an icon, a name and a version
- Where: Settings → About Orbit
- What happens: The page shows the app icon, "Orbit" and "Version 1.0.0". It has no privacy statement (the app's core local-first promise), licences, help or feedback link.
- Why it's a problem: About is where users look for these things. The local-first promise is a selling point and appears nowhere in Settings.
- Evidence: `88-about.png`.
- Needs investigation: add "Your data stays on this phone", open-source licences and a support link. `SettingsAboutScreen.tsx`.

### K-42 · COPY · Low — Background names don't match what they show in the other mode
- Where: Appearance → Background
- What happens: In Galaxy Light, "Deep Space" is a pale pink-lilac wash. In Standard Dark, "Dawn" is dark red and "Paper" is near-black.
- Why it's a problem: The names promise a look the tile doesn't have.
- Evidence: `zz-m2-montage.png` (Galaxy Light: Deep Space/Aurora/Starfield/None), `zz-m1-montage.png` (Standard Dark: Dawn/Paper/None).
- Needs investigation: mode-neutral names, or per-mode names. `SettingsAppearanceScreen.tsx` and the theme background registry.

### K-43 · COPY · Low — Systems vocabulary: Favorites/Favorite, "Needs Attention · Needs attention", Gravity, Social Battery, Overrides, "Hidden from switcher"
- Where: Systems list and builder (plus casing on Contacts & Relationships)
- What happens:
  - The list says "Favorites" and the filter says "Favorite", in US spelling (the Contacts tab mixes both spellings, A-15).
  - A chosen filter shows "Needs Attention · Needs attention".
  - Filter names include "Gravity" and "Social Battery" (B-10). "Not Contacted" is another name for never-contacted (C-11).
  - Card text includes "Overrides" and "Hidden from switcher".
  - Contacts & Relationships mixes Title Case "Custom Fields" with sentence-case "Import contacts" and "Archived contacts". The latter opens a page titled just "Archived".
- Why it's a problem: Inconsistent and internal words on an already complex screen.
- Evidence: `40-systems-management.png`, `44-builder-needs-attention-filter.png`, `46-builder-save-empty-name.png`, `54-systems-favorites-hidden.png`, `21-contacts-relationships-top.png`, `28-archived-from-settings.png`.
- Needs investigation: a single glossary pass. `SystemsManagementScreen.tsx`, `SystemBuilderScreen.tsx`, `settings-contacts-model.ts`.

### K-44 · VIS · Low — AI Personalization: section text wraps in a narrow column, making very tall cards
- Where: AI → Personalization Context → section cards
- What happens: Each section's title and body share a row with the sort icon on the left and the switch and ⋯ on the right. The text is squeezed into a column about 40% of the card's width, so a short paragraph wraps to two or three words per line and fills more than a screen.
- Why it's a problem: The text is hard to read and the list becomes very long to scroll. It also pushes the ⋯ options further away (K-38).
- Evidence: `80-ai-personalization-context-row.png`, `81-ai-section-options.png`, `82-ai-section-options-below.png`.
- Proposed fix: in `src/screens/AIPersonalizationScreen.tsx` (card header ~:537–589), keep the title row (sort icon, title, switch, ⋯) as is, but render the body text below the header at full card width instead of inside the narrow `cardCopy` column. The body will then read as normal paragraphs.

---

#### Cross-area overlaps (for the cross-cutting pass)
- H-08 ↔ K-04: header styles. K widens it to six header patterns inside Settings.
- G-08 ↔ K-10: list management. K widens it to four patterns (Custom Fields, Categories, Systems, AI sections; with K-38).
- E-01 / F-01 / G-12 ↔ K-06: save and discard on Back.
- E-02 ↔ K-08: an off-screen validation error that persists.
- E-22 ↔ K-29: low-contrast switches. K adds the cause (`thumbColor={colors.surfaceElevated}`) and the fix location.
- A-10 / C-14 / D-18 / G-21 ↔ K-30: the + button covering content.
- F-11 ↔ K-31: the keyboard covering a text field.
- A-24 / I-08 ↔ K-27: contact pickers with different designs. K-11 also bears on the picker comparison (a sheet that isn't keyboard-aware).
- C-10 ↔ K-33: Your Week period in two places. K adds that the Sunday digest ignores Your Week period.
- H-26 ↔ K-34: Archived wording. K keeps only "Decay reminders" and "unbound".
- A-15 / B-10 / C-11 ↔ K-43: Favorite/Favourite, Gravity and Social Battery, Not Contacted.
- A-17 ↔ K-32: "dashboard" for the Contacts tab.
- G-18 ↔ K-38: inline options rendered far from the tapped control.
- J-18: "Interaction Assist" jargon. K agrees (comparison note only, no separate K finding).
- One cross-cutting dialog item, not separate findings: native unthemed all-caps dialogs in K-10 (Delete System), K-14 (Export), K-18 (Replace) and the builder Discard (`58`), plus the native clock dialog in K-27. Categories uses themed sheets.

#### Dropped
- No raw finding was dropped. Removed sub-claims:
  - K-30: "its actions jump to the Contacts tab" was dropped as unsupported (no screenshot).
  - K-31: "no limit" was dropped as wrong; the field has `maxLength={100}`.
  - K-16: "+ covers Continue" was merged into K-30.
  - K-39: "+ covers Enabled only" was merged into K-30.
  - K-34: the Archived-wording half duplicates H-26 and is kept only as a pointer.

#### Routes covered
| Route | Reached | How |
|---|---|---|
| `Settings` (hub) | yes | Settings tab (it first reopened on Appearance, where an earlier pass left it) → Back; `02`, `03` |
| `SettingsAppearance` | yes | hub row; every control exercised; `01`, `04`–`20` |
| `SettingsContacts` | yes | hub row; `21`, `22`; region picker `23`, `24`, retest `retest/K-R1-*` |
| `SettingsInteractions` | yes | hub row; every chip and switch changed and restored; `29`–`31` |
| `SettingsNotifications` | yes | hub row; master, every sub-switch, reminder time and lock-screen switch changed and restored; `32`–`38` |
| `SettingsOrrery` | skipped (out of scope) | passed through only to reach Systems; `39` comparison only |
| `Backup` | yes | hub "Data & Backup"; `59`, `66`, `72` |
| `BackupSettings` | yes | "Manage backups" and Encryption row; `60`–`64` |
| `RestorePreview` | yes | Restore a backup → picker → orbit-subset-100.json → passphrase → preview; Replace card selected, never confirmed; `67`–`72` |
| `RestoreResult` | no | needs a completed restore (forbidden); evidence from `subset/restore-shots/10-restore-result.png` |
| `SettingsAI` | yes | hub row; AI switch off/on; `73`, `74` |
| `AIConnection` | yes | browse only; OpenAI card expanded, nothing pressed; `75`, `76` |
| `AIModelPicker` | no | not opened: it starts an OpenRouter catalog fetch on open (`AIModelPickerScreen.tsx:112`), a network call |
| `AIPersonalization` | yes | via Writing Style and Personalization Context; `77`–`82` |
| `AIPermissions` | yes | `83`–`85` |
| `AIPreview` | yes | `86`; "Preview with contact" picker `87` (backed out) |
| `SettingsAbout` | yes | `88` |
| `SystemsManagement` | yes | Settings → Orrery → Systems; `40`–`42`, `50`–`54` |
| `SystemBuilder` | yes | Create New System, Manage Members, Preview; `43`–`49`, `55`–`58` |
| `CustomFields` (G) | yes (reachability only) | C&R → Custom Fields; `26` |
| `CategoryManagement` (G) | yes (reachability only) | C&R → Categories; `27` |
| `Archived` (H, Settings copy) | yes (reachability only) | C&R → Archived contacts; `28` |
| `BulkReview` (H) | yes (hub entry) | C&R → Review flagged items; `25` |
| Import contacts / Check linked contacts (H) | entry seen, not opened | the rows are visible (`21`); Import opens the phone's contact picker (personal data); H audited both |

Theme spot-check (end of pass): hub, Interactions, Notifications and Backup in Galaxy Light (`zz-m4-montage.png`); hub, Notifications and Backup in Standard Dark and Standard Light (`zz-m5-montage.png`); Appearance in all four (`01`, `11`, `12`, `16`).

#### Could not check
- RestoreResult and the Replace dialog: they need a restore. RESTORE-REPORT material is used instead (K-18, K-19, K-20; K-22 is code-confirmed).
- AIModelPicker: opening it fetches the model catalog from the network.
- AI: Connect with OpenRouter, Save key, Use saved connection, Remove key, Disconnect and Choose model were not pressed. Import .txt/.md and Replace from file open a file picker (personal files) and were not pressed. "Preview with contact" was not run to the end.
- Your photo: Change photo opens the photo library. Remove photo would delete the owner's own photo, which can't be restored without the library. Photo picking was not exercised.
- Backup: Change folder and Open backup folder (they open a file browser, and the folder must not change). Change encryption, I forgot my passphrase and Turn off encryption (passphrase rules). The Export share sheet was opened and cancelled without a target and was not screenshotted (system UI).
- The notification permission-denied flow: permission is already granted, and the system-level permission was not changed.
- The "Add Orbit widget" hub row: the widget is out of scope.
- "Clear global background": not pressed, as instructed. It lives in the Profile Background sheet, not on Appearance.

---

## 4. Cross-cutting mismatches

After the 11 area passes, one non-device pass lined up the same kind of thing across every area and recorded each mismatch. It compared editors, Save/Cancel wording, destructive confirmations, empty states, rows and controls, headers, vocabulary, and sheets and dialogs. Its sources were the 297 final area findings and the non-UX files, and every comparison rests on evidence already cited in the area files. Ids such as `A-14` point to the area findings. `X-NN` ids are the cross-cutting themes.

The pass found **43 cross-cutting themes**:
- By severity: High 8 · Medium 26 · Low 9.
- By code: INC 22 · HID 10 · VIS 5 · COPY 4 · DEAD 1 · A11Y 1. The two LEFT findings, E-18 and G-10, are folded into INC themes.

Known items from owner prompt §3.5 are named only where they explain an instance; they are not re-reported. These are 999.3, 999.4, 999.5 and 999.6; the Phase 39 Add Contact defaults, possible-match tap, double "Did you send it?" and "Not tracked"; and N-10 (Archive with no confirmation, and Systems "0 members").

Each theme ends with a "Unifying direction". Where one existing screen already does it right, the direction names it as "closest to right".

### 4.1 Merges across areas

| Merge | Kept as | Reason |
|---|---|---|
| H-01 **supersedes** D-35 | H-01 (in X-10) | Same Archived-list staleness. D-35 saw case (b) once with nothing tapped; H-01 reproduced (a), (b) and (c) 4/4, including the dead "Please try again" on Restore/Delete. Drop D-35 from any fix list; fixing H-01 (`ArchivedContactsScreen.tsx:121-123` → `useFocusEffect`) fixes it. |
| J-18 ("Interaction Assist" half) + K's wording | J-18 for "Transmit"; "Interaction Assist" row of X-36 | K recorded no separate finding (K overlap note: "J-18 … K agrees, comparison note only"). The nearest K wording finding is K-32 (the Interactions page that hosts the switch), so the rename lands in the same copy pass as K-32 at `SettingsInteractionsScreen.tsx:215, 220` and `settings-hub-model.ts:105`. |
| F-21 **corrects** A-23 | A-23 Undo window = **6 s**, not ~3 s | `snackbar-store.ts:38-41` dismisses after 6000 ms; F measured ~6 s. A-23's ~3 s was late adb taps. A-23's "consider a longer snackbar" must be read against 6 s. A-23's other half (row stays slid open) stands. |
| "+ covers" set: A-10, C-14, D-18, G-21, K-30 | X-06 | One app-wide FAB mount (`App.tsx:440`). Add J-11 (FAB on ComposeResearch covering list text) and K-20 (FAB live during a restore). |
| D-02 ≡ H-23 (cause) | X-10 | Same `EditContactScreen.tsx:1068` `navigate("Profile")` push. One fix. |
| E-22 ≡ K-29 | X-34 | Low-contrast switches; K-29 supplies the cause (`thumbColor={colors.surfaceElevated}`). |
| E-14 ≡ G-16 (linking half) | X-16 | `RelationshipEditor.tsx` never names the linked contact. |
| E-15 ≡ G-17 ("AH", "Presentation only") | X-37 | Same string at `RelationshipEditor.tsx:237`. |
| E-29 ⊂ G-10 | X-15 | Hidden memories unmarked on the Memory screen. |
| B-17 + F-10 | X-24 | "Connected / Connected" on group and In Person sheets. |
| B-16 + F-19 | X-31 | Interaction-sheet actions below the fold (B adds the "Delet" clip). |
| E-12 + F-13 + B-23 (picker half) | X-13 | Date pickers allow future dates then reject (`maximumDate` missing). |
| A-32 + B-13 | X-41 | Unbounded echo of the search term in empty states. |
| A-02 + B-14 (+ C-03) | X-09 | Search/filter still applied with nothing visible. |
| A-09 + B-15 + C-01 | X-08 | Back with search open / Back on a tab. |
| F-25 + I-14 + K-11 (stale half) + G note | X-09 | Pickers keep the previous search. |
| A-25 + I-02 + K-11 (keyboard half) | X-30 | Bottom sheets with no keyboard avoidance. |
| D-29 + E-10 + F-08 + G-11 | X-25 | Forms don't name the person. |
| C-06 + D-21 + J-10 (+ E-12, G-09, G-23, H-28) | X-14 | Raw ISO dates. |
| D-28 ⊂ H-20, D-27 ⊂ H-21, D-06 ⊂ H-24 | X-23 | H extends each D finding; fix together. |
| A-35 ⊂ F-03 | X-05 / X-24 | Same snackbar line `quick-log-command.ts:156`. |
| G-08 ⊂ K-10; H-08 ⊂ K-04 | X-35 / X-26 | K widens each to the whole of Settings. |
| A-15 + D-30 + K-43 (Favorite/Favourite) | X-36 | One spelling pass. |
| A-17 + K-32 ("Dashboard") | X-36 | Same word. |
| C-10 + K-33 | X-36 | Your Week period in two places; K adds the Sunday digest ignoring it. |
| H-26 + K-34 | X-36 | "outside your active orbit" means both Archived and Unbound. |
| A-37 + H-03 (lone card) + I-10 | X-35 | A single tile stretches to full width on three surfaces. |


### 4.2 Editor matrix — where each fact about a person is edited

"—" = not editable there. Every cell cites the finding that observed it. The rows with the most variants are the strongest INC findings in this audit.

| Fact | Add Contact | Edit Contact | Update Contact | Profile (direct) | Elsewhere | Theme |
|---|---|---|---|---|---|---|
| Contact frequency | FrequencyPicker chips; Bound pre-selects "Custom… 0" with a red error (E-05) | FrequencyPicker, Monthly default (E-05, E-11) | FrequencyPicker (E-11) | Card sheet: presets only, no Custom, applies at once (D-10); Unbound banner: chips + Custom (D-10); after rebind: silent reuse (H-29) | Bulk: raw "Days" field (A-12); Import: none (H-14); Share → New contact: silent 30 days (I-06) | X-11 |
| Last talked about / Current location | Single-line box (E-25) | Single-line overwrite box (E-07) | "Most recent" + "Set a new value", adds history (E-07) | Pencil → MemoryHistory value screen (D-03) | TTR editor inline Save, no Cancel, Save enabled when empty (G-15); MemoryHistory Save + Cancel, no delete (G-15) | X-12 |
| Birthday | Absent, even after Show More (E-03, E-04) | Native date picker, no Clear (E-03) | — | Not shown anywhere (D-24) | TTR editor: read-only raw ISO (G-09); Import: free text (H-14); Compose: raw (J-10); Digest: raw tag (C-06) | X-13 |
| Memories | Memories section (E-04) | — | "Memory" row → separate Memory screen, hidden ones unmarked (E-29) | Item sheet pin / unpin / Hide do nothing but open editors (D-01); "Show hidden" leaves the Profile (D-04); Link shows only "Link" (D-23) | TTR editor grouped by type (G-10); + → Memory flat list, Add at bottom (G-10); Add Note → "Create Memory Instead" (F-18); Compose read-only, doubled groups (J-09) | X-15 |
| Key people | Editor; linked contact never named (E-14) | Delete held until Save (E-08) | Delete immediate + Undo (E-08) | "pin" opens Edit at the top (D-01); pencil → Edit at Identity (D-03) | TTR editor: link unnamed, pin unmarked (G-16); delete → "Relationship removed" + Undo, no Recently Deleted (G-03) | X-16 |
| Off Limits | "+ Add fuel" (known 999.3) | Fuel editor (known 999.3) | Plain list, Remove immediate, no undo (E-08) | Pencil → OffLimitsEditor (999.3) | ✕ with native confirm, no undo (G-03); missing from TTR editor (G-09); "Avoid" in Compose (J-09); "fuel items" in merge / purge (H-10, H-25) | X-17 |
| Contact methods | Phone + email, no validation (E-06), no Links (E-19) | Phone + email + Links, warnings shown (E-06) | Phone + email, no Links (E-19) | Header "Add a phone number" although one exists (D-08) | Reconcile: garbled Orbit value, adds instead of replacing (H-06); Compose silently switches to email (J-01) | X-18 |
| Custom fields | Only fields with "Show on new-contact form" (E-04) | Widgets; date is free text (E-17); toggle on the left (E-22) | One row per field + a duplicate "Custom Fields" row (E-18) | Formatted; "Not available yet" (D-22); "Needs attention" twice (G-06) | TTR editor raw "1" (G-09); Compose raw "1" (J-10) | X-19 |
| Category | Native spinner (E-16) | Native spinner (E-16) | — | — | Bulk "Set category" full-height sheet (A-28); Import "Category override" (H-14) | X-21 |
| Photo | Absent (E-04) | "Remove photo" writes at once, native confirm (E-08) | Photo custom field shows "PP" initials (E-28) | — | — | X-21 |
| Snooze | — | — | — | Card sheet with Choose date + Close vs ⋯ "Snooze reminders" sheet without (D-05); offered on Unbound (D-27/H-21) | Long-press: native alert, Cancel silently dropped (A-14); bulk: themed sheet (A-14) | X-20 |
| Mute | — | Switch deep in Identity (H-22) | — | No indicator anywhere (H-22) | — | X-20 |
| Social battery / Rarely responds | Absent (E-04) | Native spinner / switch (E-04, E-16) | — | — | Filter word "Social Battery" unexplained (A-19) | X-22 |
| Favourite | — | — | — | Star; disabled on Unbound but looks enabled (D-28/H-20); works on Archived (D-06) | Card star, long-press, bulk bar, Population (A-15 spellings) | X-23, X-36 |


### 4.3 Themes

#### X-01 · DEAD · High — Back with unsaved changes: five forms ask "Discard changes?", at least ten lose the input silently

| Area finding | Screen | What Back does with unsaved input |
|---|---|---|
| E-01 (High) | Add Contact | Leaves at once; everything lost |
| E-01 (contrast) | Edit Contact | "Discard changes?" (`useDiscardKeepGuard`, `EditContactScreen.tsx:1103`) |
| F-01 (High) | Log Interaction | Leaves at once; note lost |
| F-01 (contrast) | Edit interaction, Group Log | "Discard changes?" (`EditInteractionScreen.tsx:108-110`, `GroupLogScreen.tsx:72-75`) |
| B-05 | Edit Group Event | Guard covers event fields but participant adds/removes are already written |
| E-09 | Update Contact focused editor | Skips the Update list and drops the typed value |
| G-04 | Custom field New / Edit | Skips the Custom Fields list and drops changes |
| G-12 | + → Memory, new memory | Leaves; draft lost |
| I-05 | Capture note / New-contact sheet | Cancels the whole share and leaves the app |
| J-04 | Compose | Keeps the draft on Back (a third behaviour) but wipes it when Compose opens for someone else |
| J-07 | Pending confirmations → Add a note | Note lost when the dialog closes |
| K-06 | Backup settings, AI Personalization | Leaves; edits dropped |
| K-06 (contrast) | System builder | "Discard changes?" (`SystemBuilderScreen.tsx:279`) |

- Why it hurts: Back is the most-used gesture on Android. Whether it costs the user several minutes of typing depends on which form they happen to be in, and the two sibling forms of each pair (Add vs Edit, Log vs Edit interaction) disagree. That reads as several apps stitched together, and it loses data.
- Unifying direction: the existing `useDiscardKeepGuard` hook on Edit Contact / Edit interaction / Group Log / System builder is right (E-01 and F-01 cite it). Apply it to every form above, with the same bypass on Save. For focused sub-editors (E-09, G-04) and sheets (I-05, J-07), Back first closes the sub-editor/sheet and only prompts if there is unsaved text. The prompt itself should be the themed dialog (X-04), not the native Alert it is today (`discard-keep-guard.ts:29`).
- Needs investigation: J-04 — whether Compose should keep one draft per contact or prompt before replacing; this is a product choice, not just a guard.

#### X-02 · INC · Medium — Some edits save the moment you tap, inside forms that otherwise wait for Save

| Area finding | Screen | Immediate write | Held until Save, on the same screen |
|---|---|---|---|
| E-08 | Edit Contact | Remove photo | Key-person delete (discardable) |
| E-08 | Update Contact | Key-person delete (+Undo); Off Limits Remove (no undo) | Other rows (Save/Cancel per editor) |
| B-05 | Edit Group Event | Add / Remove participants | Date, channel, tone, note, duration |
| G-14 | Memory editor | "Allow AI to use this" (survives Cancel) | Pin, Mark outdated, Hide |
| D-10 | Profile frequency sheet | Preset applies on tap | — (but Add/Edit/Update hold frequency until Save) |
| D-33 | Profile snooze sheet | Presets apply on tap | Custom date needs "Set snooze" |
| K-06 | Settings | Most toggles save on tap | Backup "Save schedule", "Save Writing Style" |
| K-31 | Appearance → Your name | Saves on blur, silently | — |

- Why it hurts: Cancel and Discard stop meaning what they say. G-14 is a privacy-relevant case: Cancel does not undo granting AI access to a memory.
- Unifying direction: inside a form with a Save button, every control is part of the draft (the Pin/Outdated/Hide pattern in `MemoryEditor`, G-14). Outside forms (Settings toggles, Profile sheets), apply at once and confirm with a snackbar (X-05). Move B-05 participant management to the detail screen, which already has Add/Remove.
- Needs investigation: whether Settings pages that need a Save (K-06) should become save-on-change like the rest of Settings.

#### X-03 · INC · High — Destructive actions: confirmation, undo, recoverability and visual weight follow no rule

| Area finding | Action | Confirm? | Undo / recovery | Weight |
|---|---|---|---|---|
| B-07 | Remove from group → "Delete interaction" | **None** | None | Red, first option |
| B-07 (contrast) | Delete interaction from its sheet | Themed confirm | None | — |
| G-03 | Memory delete | None | Undo snackbar + Recently Deleted 30 days | — |
| G-03 | Key-person delete | None | Undo snackbar, no Recently Deleted | — |
| G-03 / E-08 | Off Limits delete | Native "can't be undone" (editor) / none (Update) | None | — |
| G-03 | Custom field Delete / Quarantine | Native dialog | Quarantine only | — |
| G-03, G-20 | Category delete | Themed sheet + second dialog; two "Keep" taps to back out | None | — |
| E-08 | Remove photo | Native dialog | None, outside Save | — |
| J-06 | Pending confirmation "Don't log" | None | None | — |
| H-17, H-01 | Delete permanently (Archived) | Themed dialog | None | Same size as Restore, beside it |
| H-19 | Unbind / Bind / Restore / bulk Archive | Native confirm / none / none / confirm | — | — |
| (N-10 known) | Archive from Profile | None (known) | None (D-07 adds: no feedback, no undo) | Plain outline, while Unbind is red (D-25) |
| H-10 | Merge contacts | Native dialog | "can't be simply undone" vs "cannot be undone" | Accent, not destructive |
| K-10 | Delete System | Native dialog | None | Red filled "⚠ Delete", loudest on every card |
| K-36 | Disconnect AI provider | — | — | Red filled, loudest |
| K-14 | Export readable JSON | Native, no Cancel; unsafe choice is the primary | — | — |
| K-18 | Replace all local data | Native; no counts | Safety backup | — |
| D-13 | Delete background template | None | None | Looks like "Assign" |

- Why it hurts: the user cannot predict whether a tap is final. The same record (an interaction) is deleted with a confirm on one path and instantly on another (B-07), and the safest action is often the quietest button.
- Unifying direction: one rule, as G-03 and H-19 propose — reversible deletes act at once with an Undo snackbar (the memory pattern, G-03, is closest to right: Undo plus Recently Deleted); irreversible ones use the themed `ConfirmDialog` (B Dissolve/Delete, `76-dissolve-confirm.png`) with the destructive button styled destructive and never the loudest control at rest. Put destructive actions behind ⋯ on list cards (K-10).
- Needs investigation: the owner decides which deletes become recoverable (Off Limits, key people, interactions) — that adds storage, and N-10 (Archive confirm) is already decided.

#### X-04 · INC · High — Two dialog systems: grey Android Alerts, spinners and clocks next to the app's themed dialogs and sheets

| Area finding | Screen | Native control |
|---|---|---|
| A-14 | Contacts long-press → Snooze | Native Alert; 4 buttons passed, Android drops Cancel |
| B-18, F (repeat note) | Edit Group Event, Edit participant, Group Log, Log Interaction, Edit interaction | Discard Alert; Channel / Tone / Direction native dropdowns |
| D-26 | Profile Unbind, Reset | Native, different button layouts |
| D-06 | Archived Profile → Archive | Native "Couldn't archive" |
| D-33 | Snooze → Choose date | Unthemed date picker |
| E-16 | Add / Edit / Update | Category, phone label, Social battery spinners; Discard, Duplicate name, Remove photo Alerts |
| G-03, G-05, G-07 | Off Limits delete, custom field delete / quarantine / type change | Native |
| H-01, H-19 | Archived "Couldn't restore", Unbind | Native |
| H-10 | Merge confirm | Native |
| K-10, K-14, K-18, K-27, K (builder discard `58`) | Delete System, Export, Replace, time pickers, builder Discard | Native, all-caps teal |
| Themed (contrast) | B Dissolve / Delete event, G Recently Deleted, G Categories, E "Met via" option sheet, A bulk snooze sheet, AI Personalization `ConfirmDialog` (K-14) | — |

- Why it hurts: this is the single most visible "two apps" signal. Every area hit it; in Galaxy Dark a grey Material dialog with teal capitals interrupts the themed art on the same screen as a themed dialog (B-18). Native Alerts also misbehave: Android silently drops a 4th button (A-14) and promotes the last button to "positive" (K-14).
- Unifying direction: `ConfirmDialog` for every confirm/alert (closest to right: B's Dissolve dialog, B-18), and the themed option sheet with a check mark (E's "Met via", E-16) for every single-choice dropdown. Replace the shared `Alert.alert` in `discard-keep-guard.ts:29` first; that one change fixes the discard prompt on every guarded form.
- Needs investigation: whether to theme the system date/time pickers (D-33, K-27) or accept them; and B-19 — `ConfirmDialog` itself switches between side-by-side and stacked button order, so pick one order before rolling it out.

#### X-05 · HID · Medium — Feedback after actions: a snackbar with Undo on a few writes, silence on most

| Area finding | Action | Feedback |
|---|---|---|
| A-35, F-03 | Quick Log (single) | "Logged · Undo · Add Note", 6 s (F-21), no name or channel |
| F-04, F-24 | Bulk Quick Log | "Logged 3 interactions · Undo", no Add Note |
| F-21 | Undo (single) vs Undo (bulk) | Silent vs "Undid N logged interactions" |
| F-02 | Log Interaction save, Edit save, interaction delete | Silent; backdated entry hidden behind "Show older" |
| B-08, F-02 | Group Log save | Silent, lands on Contacts |
| D-07 | Archive from Profile | Silent, no undo |
| H-18, H-29 | Restore, Bind | Silent |
| D-05, A-14 | Snooze / Unsnooze | Silent (tiny moon icon) |
| G-03 | Memory delete, key-person delete | Snackbar + Undo |
| F-18 | Add Note save vs "Create Memory Instead" | Silent vs a "Memory saved" sheet |
| G-11 | + → Memory save | Silent, and lands on a different person |
| J-02, J-06 | "Yes, log interaction"; pending Yes / Don't log | Silent |
| J-13, J-14 | Copy with nothing to copy; Copy subject | False "copied"; feedback far from the control |
| I-04, I-13 | Share save | 1.5 s card, no Undo; vague wording |
| K-06, K-31 | Save schedule, Your name | Silent |
| H-07 | Reconcile Apply | Small grey line that shifts the button |
| A-13 | Bulk frequency with an empty field | Error snackbar rendered **under** the Sheet modal (`App.tsx:441`), so never seen |

- Why it hurts: the one-tap path (Quick Log) confirms better than the deliberate paths (Log Interaction, Archive, Restore). Users learn to distrust saves.
- Unifying direction: the post-log snackbar is closest to right (F-21, `snackbar-store.ts`, 6 s): every write gets one, naming the person ("Logged In Person with Ann", A-35/F-03), with Undo where reversible, and Undo itself confirms ("Log removed", as bulk already does, F-21). Fix the mount order so snackbars render above sheets (A-13), or errors inside sheets go inline.
- Needs investigation: whether the 1.5 s share window (I-04) and the 6 s snackbar should share one duration constant.

#### X-06 · VIS · Medium — The + button covers content and floats above overlays on every tab

| Area finding | Screen | What the + covers |
|---|---|---|
| A-10 | Contacts Population / Filters / Sort panel | Sits bright above the dim layer; a dismiss tap opens the speed dial |
| C-14 | Digest Your Week day panel | Right side of mid-list rows |
| D-18 | Profile | "Imported from Contacts App" pencil, current heatmap square |
| G-21 | Custom field editor | "Create field" and the AI explanation |
| K-30 | Settings hub, Appearance, Interactions, restore passphrase card, AI Data Permissions, AI Personalization | Chevron, Your name field, "Continue to preview backup", "Enabled only" switch, guidance text |
| J-11 | Compose → Things to Remember | List text (Compose itself hides the FAB) |
| K-20 | Restore in progress | FAB live and usable mid-restore |
| F-26 | Contacts after bulk Quick Log | Undo snackbar sits right next to it |

- Why it hurts: a floating control that covers real controls on admin pages, where it has no job, looks unplanned. Bottom padding is not the fix (D-18: the Profile already has it; overlap happens mid-scroll).
- Unifying direction: Compose's behaviour is closest to right (J-11): `FOCUSED_WORKFLOW_ROUTES` in `focused-route-classification.ts` hides the tab bar and FAB. Extend that classification to focused editors (G-21), ComposeResearch (J-11), and the Settings stack (K-30); hide the FAB while a Contacts panel is open (A-10) and during a restore (K-20).
- Needs investigation: whether the FAB belongs on Settings at all, and whether it should hide on scroll for long lists (C-14, D-18).

#### X-07 · HID · High — + actions and flow endings always push into the Contacts tab; Back then lands on stale or unrelated screens

| Area finding | Started on | Ends on / Back lands on |
|---|---|---|
| C-02 | Digest → + → Add Contact | Back lands on an old Profile in the Contacts tab |
| F (C-02 repeat), D-29 | Digest / Profile → + → Log Interaction | Back lands on the Contacts tab |
| B-08 | Events → + → Group Log | Saves, then shows the Contacts grid; no event |
| G-11 | Digest → + → Memory for person A | Lands on person B's Profile |
| H-12 | Settings → Import / Check linked / Merge | "Done" / "View contact" jump to the Contacts tab; Back lands on its old Archived screen; Settings forgets its page |
| I-01 | Share into Orbit (cold) | Capture is pushed into the Contacts tab stack (`linking.ts:68`); an abandoned share later replaces the contact list |
| C-03 | Digest "See everyone…" links | Overwrite the saved Contacts population/filters |

- Why it hurts: the user starts on one tab and is moved to another, often onto a screen about someone else. G-11 makes a correct save look like it went to the wrong person.
- Unifying direction: Quick Log from Digest is closest to right (F repeat note: it stays on Digest). Root cause is shared: `universal-fab-logic.ts:185-206` always targets `DashboardTab`, and `navigateIntoTab` pushes with `initial: false` (C-02). Route + actions into the current tab's stack (or a root modal), return to the origin after save, and end Settings flows inside Settings (H-12). Host Capture as a root modal (I-01).
- Needs investigation: whether + forms should be root-level modals (which removes the per-tab registration problem in B-08: `GroupLog` exists only in the Contacts stack).

#### X-08 · HID · Medium — Android Back does not close the innermost thing first

| Area finding | Screen | Back does |
|---|---|---|
| A-09 | Contacts with search open | Exits the app |
| B-15 | Events with search open | Switches to the Contacts tab |
| C-01 | Digest (launch tab) | Goes to Contacts (tab `backBehavior` defaults to first route); after a Digest link, exits the app |
| B-01 | Inline participant sheet | Closing the keyboard closes the whole sheet |
| E-09, G-04 | Update focused editor; custom field editor | Skips a level |
| I-01 | Resume prompt over Capture | Does nothing (`onRequestClose={() => undefined}`) |
| I-03, I-05 | Capture | Finishes the activity; Orbit restarts on Digest |
| H-02, H-08, J-06 | Link-to-existing sheet; merge/check screens; Pending dialog | Back is the only way out (no on-screen Cancel/Back) |
| D-02, H-23 | After Edit Contact save | Back shows the stale Edit form |
| I-09 (positive) | Capture multi-select | Back leaves multi-select only — correct |

- Why it hurts: Back has no single meaning; sometimes it costs the session (A-09 → A-02, I-03).
- Unifying direction: Capture multi-select (I-09) and Contacts selection mode (`HomeScreen.tsx:1601-1613`, A-09) are right: Back closes the innermost open state. Extend that handler to search (A-09, B-15), sheets (B-01) and sub-editors (E-09, G-04); set `backBehavior="history"` on the tab navigator (C-01); every screen and sheet also gets an on-screen exit (H-08, H-02, J-06).
- Needs investigation: I-03, a share-only activity/task vs `moveTaskToBack`.

#### X-09 · HID · High — Search and filter state persists invisibly, and search behaves differently on every surface

| Area finding | Surface | Behaviour |
|---|---|---|
| A-02 (High) | Contacts | Old search re-applied after relaunch with the box closed: "1 contact" |
| B-14 | Events | Closing search keeps the filter, across tab switches |
| C-03 | Digest links | Silently replace the saved Contacts view; later search runs inside it |
| A-04, A-05 | Contacts | Hidden "Active Contacts" population; "Nothing here right now." with no mention of filters |
| F-25, G (F-25 note) | + pickers (Quick Log, Memory) | Previous search pre-filled |
| I-14 | Capture | Second share keeps the old search |
| K-11 | Phone region picker | Search text survives close |
| A-06, A-07, A-08 | Contacts search | Misses Last talked about / location / Off Limits; "Denver" finds "Dense"; stale rows labelled "1 match" |
| I ("Where shared items ended up") | Contacts search | Finds shared text once, misses it in retest |
| B-X01 (non-UX) | Events search | Older result overwrites newer |
| A-32, B-13 | Both tabs | No-match state echoes the whole term; Events says it twice |
| K-11, K-27 | Region / Orbit Center pickers | Name search finds nothing; no "no matches" line |
| H-27 | Unbound list | First match hidden above the fold |

- Why it hurts: the list looks like data has vanished (A-02 is High), and the user's mental model of "search" changes per screen.
- Unifying direction: closing a search clears it, and every picker opens with an empty search (B-14's proposed one-line fix and F-25's `setTerm("")` are the pattern). Any active filter is visible on the list with a one-tap clear (A-05). Digest drill-throughs open a labelled temporary view (C-03).
- Needs investigation: what Contacts search should cover (A-06) and the fuzzy threshold (A-07); one shared search empty-state component (X-41).

#### X-10 · HID · High — Lists, sheets and stacks show stale data after a change made elsewhere

| Area finding | Surface | Stale state |
|---|---|---|
| **H-01 (High; supersedes D-35)** | Archived list (Contacts tab) | Never refreshes; Restore/Delete on stale rows fail forever with "Please try again" |
| D-02, H-23 | Edit Contact → Save | Pushes a second Profile; Back shows the stale Edit form; archive then lands on it and lets you edit an archived person |
| B-06 | Event interaction sheet | Shows pre-save values after editing |
| H-05 | Check linked contacts | Resolved cards return on the next check; "Updated 0" after Apply |
| J-03 | "Not yet" handoff | Queue not refreshed until relaunch |
| E-21 | Update Contact "Updated" badge | Only on the last row saved |
| A-08 | Contacts search | Old rows shown as results |
| C (lead) | Edit save → Profile | Duplicate Profile (same cause as D-02) |
| Unbound list (H-01 contrast) | `UnboundContactsScreen.tsx:43` | Refreshes on focus — correct |

- Why it hurts: the app contradicts what the user just did; H-01 then invites endless retries.
- Unifying direction: the Unbound list's `useFocusEffect` reload (H-01 cites it) for every list screen; `popTo`/`goBack` instead of `navigate` after edit saves (D-02); sheets re-resolve from refreshed data (B-06).
- Needs investigation: H-05 (why reviewed cards come back) and J-03 (eligibility window).

#### X-11 · INC · Medium — Contact frequency: five editors and three vocabularies for one setting

| Area finding | Surface | Editor | Words |
|---|---|---|---|
| E-11 | Add / Edit / Update | FrequencyPicker: Daily…Yearly + Custom (value + unit) | "Monthly" |
| E-05 | Add → Bound | Pre-selects "Custom… 0" with a red error | — |
| D-10 | Profile card sheet | Presets only, no Custom, applies at once | Card "Every 30 days", sheet "Monthly" |
| D-10, H-29 | Unbound banner | Chips + Custom; after a rebind only "Bind contact", old value silently reused | — |
| A-12, A-13 | Bulk "Change Contact Frequency" | Raw "Days" field; empty/0 silently ignored | "Days" |
| H-14 | Import (single / bulk) | No frequency at all | — |
| I-06 | Share → New contact | Silently 30 days, not shown | — |
| G-09, J-10 | TTR editor, Compose research | Read-only | "30 days" |

- Why it hurts: the same setting is a word in one place and a number in another, and the only full chooser (Custom) is unreachable from the Profile.
- Unifying direction: `FrequencyPicker` (E-11; the most complete per E-11 and D-10) everywhere, including the Profile sheet and the bulk sheet; display "Monthly" whenever a preset matches. Fold E-05 into Phase 39 D-51 as E-05 says.
- Needs investigation: I-06 — whether share-created contacts are tracked at all, and from which shared default constant (owner call, I-06).

#### X-12 · INC · Medium — "Last talked about" and "Current location": overwrite in one place, history in another

| Area finding | Surface | Model |
|---|---|---|
| E-07, E-25 | Add / Edit Contact | One-line box; overwrite |
| E-07 | Update Contact | "Most recent" + "Set a new value"; adds to history |
| D-03 | Profile pencil | Opens the value-history screen |
| G-15 | TTR editor inline | Save without Cancel; Save enabled when empty and does nothing; duplicates added |
| G-15 | MemoryHistory | Save + Cancel, disabled when empty; entries cannot be deleted |
| G-15, D-31 | Labels | "MOST RECENT" / "Most recent" / "most recent" |
| A-06 | Contacts search | Not searchable, though list rows display location |

- Why it hurts: a user cannot tell whether editing in Edit Contact erases the history shown elsewhere.
- Unifying direction: MemoryHistory's form (G-15: disabled when empty, has Cancel) is closest to right. One editor component for both fields, used from every entry point.
- Needs investigation: the model choice itself (overwrite vs history) — design/owner call; and whether entries need delete.

#### X-13 · INC · Medium — Birthday and other dates: picker vs free text, no way to clear, future dates offered then rejected

| Area finding | Surface | Problem |
|---|---|---|
| E-03 | Edit Contact Birthday | Picker with no Clear; Add has no Birthday field |
| E-17 | Custom date field | Free text; "June 20" accepted |
| G-13 | Memory "Meaningful date" | Free text; "banana" accepted and shown unlabelled |
| H-14 | Import review Birthday | Free text |
| H-28 | Reconcile | Impossible "2021-02-29" offered as a normal choice |
| E-12 | Add → Last spoke → Pick date | Future days enabled, then rejected while "Today" stays highlighted |
| F-13 | Log / Edit interaction | Future date accepted through both pickers, then rejected |
| B-23 | Edit Group Event | Future date offered, then "can't be in the future" |
| D-33 | Snooze Choose date | Opens on today (a zero-length snooze) |

- Why it hurts: the same kind of data gets three entry methods, and three pickers let the user do work the form then throws away.
- Unifying direction: Edit Contact's Birthday picker (E-17 cites it) for every date, plus a Clear action (E-03 proposed fix) and `maximumDate` on all past-only pickers (`TriStateLastSpoke.tsx:195-200`, `TouchpointRefineForm.tsx:570-575`).
- Needs investigation: whether Add Contact gets the full Edit field set (X-22).

#### X-14 · COPY · Medium — Dates shown raw (ISO) on many surfaces

| Area finding | Surface | Shown as |
|---|---|---|
| C-06 | Digest birthday tag, day panel heading, heatmap a11y | "2026-10-13", "2026-10-07", "10/07/2026" |
| D-21 | Profile snooze card, custom date | "Snoozed until 2026-10-17", "2015-06-20" |
| G-09 | TTR editor Birthday | "2026-10-13" |
| G-23 | Recently Deleted | "Deleted 2026-10-10 04:38:09" |
| E-12 | Last spoke button | "2026-10-05" |
| J-10 | Compose research | "2026-10-13" |
| H-28 | Reconcile | "1990-05-14" |
| K-15 | Backup file names | Millisecond stamp; UTC ISO |
| Contrast | Events, History, pickers | "Sep 26, 2026, 6:00 PM", "Sat, Oct 10" |

- Why it hurts: half the app speaks people dates, half speaks database dates.
- Unifying direction: add one date-only display formatter beside `formatDateTimeMinute` in `src/utils/dates.ts` (C-06's proposed fix) and route all sites above through it.

#### X-15 · INC · High — Memories: three lists, three editors, and Profile buttons that don't do what they say

| Area finding | Surface | Problem |
|---|---|---|
| D-01 (High) | Profile item sheet | "pin", "unpin", "Hide from Profile" open an editor and change nothing |
| G-01 (High) | TTR editor | Unchanged Save turns an imported memory into a plain one |
| D-03 | Profile pencils | Same icon goes to three different destinations, never the item |
| D-04 | Profile "Show hidden" | Leaves the Profile and flips its label |
| G-02 | TTR editor | Hidden memory has no badge; its button sits under another memory |
| G-10, E-29 | Profile / TTR editor / + → Memory | Three groupings; the Memory screen never names the person, shows hidden ones unmarked, has Add at the bottom and no link to Recently Deleted |
| J-09 | Compose research | Read-only, doubled "Memory" groups, "Avoid", no pinned/outdated markers |
| F-18 | Add Note → Create Memory Instead | Separate stacked sheets and feedback |
| G-18 | TTR editor | Inline form opens below the last card, not the tapped one |
| D-23, G-13 | Link memory | Profile shows only "Link"; links unvalidated |
| G-23 | Section names | "Pinned / Featured" vs "Featured & current"; "Memories" vs "Memory" |
| G-14 | Allow AI toggle | Bypasses Cancel |

- Why it hurts: memories are the app's core content, and they look and behave differently in each of five places; on the Profile the visible actions are dead (D-01).
- Unifying direction: one memory list + editor component (G-10). Wire the Profile sheet actions to the same services the TTR editor uses, or remove them (D-01). The TTR editor's grouping with badges (G-02 proposes the missing "Hidden" badge) is closest to right.
- Needs investigation: which surface is the canonical editor, and whether + → Memory should open "add" directly.

#### X-16 · INC · Medium — Key people: the linked contact is never named while editing, pinning is unmarked, delete differs per screen

| Area finding | Surface | Problem |
|---|---|---|
| E-14 | Add Contact | Linked contact not shown in the editor or the draft row |
| G-16 | TTR editor | Same; also a pinned key person has no badge |
| E-08 | Edit vs Update | Delete held until Save vs immediate + Undo |
| G-03, G-23 | TTR editor | "Relationship removed" + Undo; no Recently Deleted |
| D-01, D-03 | Profile | "pin" opens Edit; pencil lands at Identity |
| E-15, G-17 | Key-person form | "AH", "Presentation only", "Use default visibility"; "Pin" vs memory "Pin memory" |
| E-26 | a11y | "Edit" / "Delete" without the name |

- Why it hurts: the user cannot confirm the link they made, on either of the two editors that offer it.
- Unifying direction: `RelationshipEditor` shows "Linked to <name>" (E-14 proposed fix, which covers G-16 too); key people get the same Pinned badge as memories.

#### X-17 · INC · Medium — Off Limits: four names, missing from editors and search, deleted three different ways

| Area finding | Surface | Problem |
|---|---|---|
| (999.3 known) | Add / Edit / Profile pencil | Old Fuel editor, "+ Add fuel" |
| E-08, E known-items note | Update Contact | Plain list "What should you avoid?" — already the better editor; Remove immediate, no undo |
| G-03 | OffLimitsEditor | ✕ → native "can't be undone" |
| G-09 | TTR editor | Missing entirely |
| J-09 | Compose | Called "Avoid" |
| H-10, H-25 | Merge / purge dialogs | "fuel items" |
| A-06 | Contacts search | Not searchable |
| D-30, D-34 | Profile | Each entry repeats "Off Limits"; a11y says only "Off Limits" |

- Why it hurts: the same concept appears under Off Limits, Avoid and fuel, and one editor surface skips it.
- Unifying direction: Update Contact's list editor (E known-items note) as the single editor, which also resolves 999.3; one name everywhere.

#### X-18 · INC · High — Contact methods: usability is judged in one place and ignored in another

| Area finding | Surface | Problem |
|---|---|---|
| **J-01 (High)** | Compose | Presents a text, transmits an email, never shows the destination |
| D-08 | Profile header | "Add a phone number" on a contact that has one |
| E-06 | Add Contact | "abc" / "notanemail" accepted silently; warning only in Edit afterwards |
| J-15 | Compose with no destination | Offers "Make this an email"; "Add a phone number or email" lands at Identity |
| E-19 | Add / Update | No Links (Edit only) |
| E-24 | Add / Edit | "+ Add phone" link vs filled "Add key person" button; phones start with an empty row, emails with a message |
| H-06 | Reconcile | Orbit value garbled; choosing the phone value adds instead of replacing |

- Why it hurts: the Profile greys out Message, the header says no number exists, and Compose sends anyway on another channel (J-01).
- Unifying direction: one actionability verdict computed once and shown everywhere: on draft rows (E-06), in the Profile header (D-08's proposed copy), and as a destination line in Compose (J-01's proposed fix). Contact Methods' row helper text is closest to right.

#### X-19 · INC · Medium — Custom fields: raw values on three surfaces, free-text dates, a duplicate Update row

| Area finding | Surface | Problem |
|---|---|---|
| G-09, J-10 | TTR editor, Compose | Raw "1" where the Profile shows "Yes" |
| G-06 | Profile | "Needs attention" twice, in caption grey; Edit shows no error |
| G-05 | Type change dialog | No preview of what converts; "fix now" that doesn't exist |
| G-07, G-22 | Custom Fields list | "Quarantine" vs "Delete" by hidden data; lowercase types |
| E-17 | Date field | Free text |
| E-18 | Update Contact | Each field, then a "Custom Fields" row listing them again |
| E-28 | Photo field | "PP" initials avatar |
| E-22 | Toggle field | Switch on the left |
| D-22 | Profile | "Not available yet" for empty |

- Unifying direction: Profile's `formatCustomFieldValue` (`knowledge-presentation.ts:256`; G-09 proposed fix) on every surface; one widget per type matching the built-in equivalents (date picker, switch on the right).

#### X-20 · INC · Medium — Snooze and Mute: three snooze UIs, and Mute hidden

| Area finding | Surface | Snooze/mute UI |
|---|---|---|
| A-14 | Contacts long-press | Native alert, no Cancel, no confirmation |
| A-14 | Bulk | Themed sheet "Snooze contacts" |
| D-05 | Profile Snooze card | Sheet with Choose date + Close |
| D-05 | Profile ⋯ | "Snooze reminders" sheet without Choose date or Close; Unsnooze silent |
| D-33 | Choose date | Unthemed picker; ambiguous "Cancel snooze" |
| D-27, H-21 | Unbound Profile | Snooze offered and applied for someone with no reminders |
| H-22 | Edit Contact | "Mute reminders" switch, no indicator anywhere |
| D-21 | Snooze card | Raw date |

- Unifying direction: the Profile Snooze card sheet (D-05) is closest to right; reuse it from ⋯, long-press and bulk; show "Reminders muted" on the same card and offer Mute beside Snooze (H-22).

#### X-21 · INC · Low — Category and photo editors

| Area finding | Surface | Problem |
|---|---|---|
| E-16 | Add / Edit | Category is a native spinner with no mark on the current value |
| A-28 | Bulk Set category | Full-height sheet while sibling bulk sheets are compact |
| H-14 | Bulk import | "Category override" |
| G (cross-cutting note) | Categories | "Uncategorized 100 contacts" while Contacts shows 88 (counts archived/Unbound/deleted rows) |
| E-04 | Add Contact | No photo |
| E-08 | Edit Contact | Remove photo writes outside Save |
| E-28 | Photo custom field | "PP" |

- Unifying direction: themed option sheet for Category (X-04); photo on Add; photo removal inside the draft (X-02).
- Needs investigation: G's Uncategorized count (`categories-dao.ts:105-112`) — not verified on device.

#### X-22 · INC · Medium — Five ways to create a contact, each with a different form

| Area finding | Path | Difference |
|---|---|---|
| E-04 | Add Contact | No Photo, Birthday, Social battery, Rarely responds, Mute, Links; has "Last spoke"; Show More can't collapse |
| E-05, E-13 | Add Contact | Bound → Custom 0 error; "Not yet" never looks selected; fill vs outline chips |
| E-27 | Add Contact | Duplicate name only at save, native dialog, no "Open existing" |
| H-13 | Import single | Full editable form for an already-linked contact; edits thrown away |
| H-14 | Import single / bulk | Unsectioned; free-text birthday; "Bound, Unbound" vs "Unbound, Bound"; no frequency |
| I-06, I-07 | Share → New contact | Name only; silent 30 days; search text not carried over |
| E-20 | Titles | + "Add Contact" opens "New contact"; "Save contact" vs "Save changes" |

- Unifying direction: Edit Contact's sectioned form is the most complete; Add should be the same form in "new" mode (E-04). Import and Share reuse its sections or a shared minimal-create component.
- Needs investigation: which fields belong on create (E-04, owner/product call; Phase 39 D-50/D-51 already touch Add defaults).

#### X-23 · INC · Medium — The Profile ignores Archived / Unbound state, and lifecycle actions are placed and confirmed inconsistently

| Area finding | State | Problem |
|---|---|---|
| D-06, H-24 | Archived | No banner or Restore; Archive errors; Snooze/Unbind offered and Unbind works; status "Stable"; star works |
| D-09 | Unbound | "Not tracked. Set a contact frequency" while showing a frequency |
| D-27, H-21 | Unbound | Snooze offered and applied |
| D-28, H-20 | Unbound | Star disabled but looks enabled; dialog promises favourites removed, they stay |
| H-19 | Bind / Unbind | Bind is a card button acting at once; Unbind is in ⋯ with a native confirm |
| H-26, K-34 | Wording | "out of your active orbit" for both Archived and Unbound |
| D-25 | ⋯ menu | Unbind red with ⚠, Archive plain |
| D-07, H-18 | Archive / Restore | Silent, no undo |
| H-09 | Merge | Only via Settings → Check linked → grey text |

- Unifying direction: the Unbound banner with "Bind contact" (D-06 contrast) is closest to right; add the Archived equivalent with Restore, and drive ⋯ entries from lifecycle state (`profileOverflowEntries`, D-06 proposed fix).
- Needs investigation: H-09 merge entry point, H-20 whether Unbind clears favourites.

#### X-24 · INC · Medium — Logging: three forms, four Quick Log variants and inconsistent channel data

| Area finding | Surface | Difference |
|---|---|---|
| F-06 | Log Interaction / Edit interaction / Group Log | Different Back, title case, Save label, Duration placement, Allow AI caption, channel list (3 vs 5) |
| F-07 | Group Log | Flat background |
| F-03 | Quick Log | Silently uses the channel last picked in Log Interaction; In Person stored Outbound vs form's Mutual |
| F-04 | Bulk Quick Log | Channel "unspecified", no Add Note |
| F-05, A-29 | Bulk "Log Interaction" (2+) | Opens Group Log without saying so; participants shown only as a count |
| J-05 | Compose confirmation | Email logged as "Message" |
| B-02, B-11 | Participant editors | Two editors, three labels; three "Follows event" lines |
| B-17, F-10 | Interaction sheet | "Connected / Connected", even for In Person |
| F-09 | Direction | "outbound" lowercase in forms vs "Outbound" in the stream |
| F-20 | ⋯ "Make this a group interaction" | Group interaction vs group event |

- Unifying direction: one `TouchpointRefineForm` configuration with one header, one Save label pattern and one channel list; Edit interaction's field set (5 channels, inline Duration) is closest to right per F-06. Quick Log variants share one channel rule and one snackbar.
- Needs investigation: F-03, whether Quick Log should follow the "remember last" preference at all (owner call, F-03).

#### X-25 · HID · Medium — Forms and pickers don't say whose record you are editing

| Area finding | Surface |
|---|---|
| D-29, F-08 | Log Interaction, Edit interaction, Add Note sheet, Quick Log from a Profile |
| E-10 | Update Contact |
| G-10, G-11 | + → Memory screen |
| A-24 | One "Choose contact" picker title for four actions |
| H-11 | Merge picker: no subject line |
| I-08 | Capture multi-select keeps "Save to…" |
| Contrast (right) | Edit participant: "Editing Zz UX Full Profile" (F-08) |

- Why it hurts: after a picker disappears, the user cannot confirm they are about to write to the right person.
- Unifying direction: Edit participant's "Editing <name>" header (F-08) on every person-scoped form; pickers titled by action (A-24's `title` prop).

#### X-26 · INC · Medium — Headers and Back controls: at least eight styles

| Area finding | Style | Screens |
|---|---|---|
| D-32, B-03, J-11 | Chevron icon | Profile |
| B-03, K-04 (1), H-08 | `ShellAppBar` plain text "Back" + title | Event detail, Archived, Unbound, most Settings children, Log Interaction, Update Contact |
| B-03, D-32, E-20, F-06, G-08, H-08, K-04 (3) | Boxed "Back" button inline or above the title | Edit Group Event, Edit participant, Add/Edit Contact, TTR editor, Edit interaction, Group Log, Custom Fields, import screens, Backup settings, Restore preview |
| K-04 (2) | Inset band, separate box in Standard | Backup & Restore |
| K-04 (4) | Accent "Back", display typeface title | AI Connections, AI Data Permissions |
| K-04 (5), K-40 | Full-width centred "Back" | AI Personalization, AI Preview |
| J-11 | "Back" on a pill, no title | Compose |
| I-08, I-15 | Bordered "Close" pill (announced "Cancel") | Capture |
| D-13 | "Back" top-right in a sheet | Background sheet |
| G-04, H-08, K-04 (6) | None | Custom field editor, merge / check screens, System builder, Restore result |
| D-17 | Translucent header with content showing through; name never shown after scroll | Profile |
| E (spot-check note) | Solid band | Update Contact |

- Why it hurts: moving one level deeper changes the visual language (B-03); this is visible on every area.
- Unifying direction: `ShellAppBar variant="child"` — recommended independently by B-03, H-08 and K-04 — on every pushed screen, with one Back treatment.
- Needs investigation: whether ShellAppBar's text "Back" or the Profile chevron is the house style (B-03 asks the same).

#### X-27 · INC · Low — Overflow (⋯) menus hide primary actions, hold one item, or open far away

| Area finding | Menu | Problem |
|---|---|---|
| A-11 | Selection bar "More" | One-item "Sensitive Operations" |
| F-20 | Interaction sheet ⋯ | One item |
| B-09 | Event detail ⋯ | Edit / Add participant / Dissolve / Delete only here |
| D-25 | Profile ⋯ | Full-height sheet, ~45 % empty, no Close; titled "Profile actions" for "More actions"; Reset appears after collapsing a section |
| K-38 | AI section ⋯ | Options render inline a screen below |
| G-08 | Categories ⋯ (contrast) | Anchored menu — closest to right |
| A-29 | Contacts ⋯ | "Group Events" duplicates the Events tab |

- Unifying direction: Categories' anchored ⋯ menu (G-08, K-38 cites it); never a one-item menu; primary actions on screen.

#### X-28 · INC · Medium — Save / Cancel / Done / Close wording and placement

| Area finding | Surface | Wording / placement |
|---|---|---|
| E-20 | Add / Edit / Update / Off Limits | "Save contact" / "Save changes" / "Save" + "Cancel" / "Done" / "Add" |
| F-06 | Log forms | "Save" / "Save changes" / "Log group" |
| B-02 | Participant | "Save participant" vs "Save changes" |
| D-15 | Profile sheets | Item sheet "Done", Overview sheets "Close"; buttons lowercase "edit" / "pin" |
| G-08, G-20 | Categories | "Keep current name" / "Discard new category" / "Keep category" vs "Cancel" |
| G-15 | Set new value | Save without Cancel vs Save + Cancel |
| F-18, G-18 | Add Note, Memory screen | Buttons wrap onto two rows; three styles in one sheet |
| J-05 | Compose panel vs banner/dialog | Primary on the right vs on the left |
| H-16 | Resume prompts | "Resume import / Discard import" vs "Resume / Discard" |
| K-06 | Backup, AI Personalization | "Save schedule" mid-page; "Save Writing Style" below the fold |
| K-21 | Restore | "Replace all" / "Replace all local data" / "Replace and restore" |
| A-24, H-02, H-11, J-06, D-25 | Pickers / dialogs / sheets | No Cancel or Close at all |

- Unifying direction: one rule — create forms "Save", edit forms "Save changes", every sheet ends with "Close", every dialog has Cancel on the same side; primary button always in the same position (J-05: pick the banner's or the panel's order once).

#### X-29 · HID · Medium — Validation errors: silent, off-screen or stale

| Area finding | Surface | Problem |
|---|---|---|
| E-02 | Add / Edit Contact empty name | Nothing visible; scroll broken (E-X01) |
| K-08 | System builder empty name | Error off-screen at the top; stays after typing |
| F-12 | Group Log empty title | Error at the bottom, far from Title; stays after typing |
| G-15 | TTR inline Save empty | Enabled, does nothing |
| G-19 | Memory type Custom | Save greyed, no message |
| A-13 | Bulk frequency empty / 0 | Silent (snackbar under modal) |
| E-05 | Add → Bound | Red error before the user acts |
| E-06, E-17, G-13 | Phone / email / dates / links | No validation |
| Contrast (right) | Add Category | "Enter a category name." inline (G-19); E frequency "Enter a whole number greater than 0." inline (E-02) |

- Unifying direction: inline red text under the field, cleared on change, with scroll-to-field on a failed save (E-02 proposed fix; F-12 proposed fix shows the same pattern).

#### X-30 · VIS · Medium — The keyboard covers the field or sheet being typed in

| Area finding | Surface |
|---|---|
| A-25 | + contact picker: whole sheet behind the keyboard |
| I-02 | Capture New-contact sheet and note field |
| K-11 | Phone region picker |
| F-11 | Edit interaction Custom minutes |
| K-31 | Appearance → Your name |
| B-01 | Inline participant sheet (clips; closing the keyboard closes the sheet) |
| J-07 | Pending confirmations note |
| Contrast (right) | Capture search: results stay above the keyboard (I positive checks) |

- Unifying direction: keyboard-aware bottom sheets (one shared `Sheet` behaviour) and keyboard-aware scroll views; Capture search is the working example.

#### X-31 · VIS · Low — Primary actions sit in the gesture bar or below the fold

| Area finding | Surface |
|---|---|
| F-22 | Edit interaction "Save changes" |
| F-12 | Group Log "Log group" (pushed by the error) |
| I-16 | Capture Skip / Done |
| J-08, J-16 | Compose Copy / Transmit (banner or long text); stray tap fired Transmit |
| G-18 | Memory screen Save |
| H-02 | Link sheet last row |
| B-16, F-19 | Interaction sheet actions below the fold; "Delet" clipped |
| D-33, H-21 | Snooze sheet Close below the fold |

- Unifying direction: bottom safe-area inset on every form container (F-22 proposed fix) and sticky action rows on sheets (F-19).

#### X-32 · INC · Medium — Sheets and dialogs: sizes, positions and close affordances differ

| Area finding | Surface | Style |
|---|---|---|
| A-28 | Bulk sheets | Full-height vs compact; Title vs sentence case headings |
| D-25 | Profile actions | Full height, half empty, no Close |
| D-05 | Snooze | Two different sheets |
| J-06 | Pending confirmations | Centred dialog, no Close |
| H-02 | Link to Existing | Centred, taller than the screen, no title visible, no scroll, no Cancel |
| K-27 | Orbit Center, profile defaults | Floating untitled lists |
| B-01 | `Sheet` expanded variant | Doesn't scroll by design (`Sheet.tsx:16-17`) |
| F-18 | Add Note → Memory | Sheet stacked on sheet |
| J-08 | Assist banner | In-flow, ~27 % of the screen on every page |

- Unifying direction: bottom sheets with title, scroll, and a Close at the bottom — the Profile Overview sheets (D-15 "Close") and the titled region sheet (K-27) are closest to right; make the `expanded` Sheet scroll by default.

#### X-33 · INC · Medium — Pickers: six contact-picker designs and native vs themed option pickers

| Area finding | Picker | Design |
|---|---|---|
| A-24, A-25 | + "Choose contact" | Bottom sheet list, search, no Cancel, keyboard hides it |
| I-08 | Capture | Full-screen 3-column face grid, emoji search, Close pill |
| K-27 | Orbit Center | Floating untitled list with search, no avatars |
| K-27 | AI Preview "Choose contact" | Titled sheet with avatars |
| H-11 | Merge picker | Full-screen FlatList, no search, no Cancel |
| H-02 | Link to existing | Centred overflowing sheet |
| B (Add participants) | Event | Picker (0 / 1 selected) |
| E-16, B-18, K-27 | Option pickers | Native spinners vs themed "Met via" sheet; native clock |

- Unifying direction: one searchable contact picker (`ContactPicker`), keyboard-aware, titled per action, with Cancel. Which design wins is a design decision (I-08 says so); K-27 rates the region sheet the most complete option picker.

#### X-34 · VIS · Medium — Selected, disabled and on/off states are drawn differently on every screen

| Area finding | Surface | Style |
|---|---|---|
| E-13 | Add Contact | "Not yet" never looks selected; fill (Today, Bound) vs outline (frequency chips) |
| K-05 | Settings | Accent-filled chips vs "— Selected" text (Orrery) |
| K-28 | Appearance | Accent swatch selected by its own colour ring; star by an accent ring |
| K-21 | Restore | Selected card = thin border |
| C-07 | Digest heatmap | Selected = slightly thicker border |
| I-10 | Capture | Selected tile shifts its avatar |
| H-07 | Reconcile | Options don't look selectable until tapped |
| E-22, K-29 | Switches | Off nearly invisible in dark themes (`thumbColor={colors.surfaceElevated}`) |
| K-01, K-02 | Notifications | Disabled switches still show On |
| D-28, K-09, K-10 | Star, builder filters, reorder | Disabled but look enabled |
| E-02 / G-19 | Save | Looks disabled but is pressable / looks disabled and isn't |
| D-16 | Section chevrons | Point down whether open or closed |
| A-26 | Selection bar | Irrelevant actions enabled; "Select All" never becomes "Deselect all" |

- Unifying direction: one selected-chip token (accent fill — the majority, E-13 and K-05), one disabled treatment (dimmed, and for switches shown off), switch thumb/track tokens per K-29's proposed fix.

#### X-35 · INC · Low — List rows and list management

| Area finding | Surface | Pattern |
|---|---|---|
| G-08, K-10, K-38 | Custom Fields / Categories / Systems / AI sections | Up/Down buttons; drag + ⋯; drag + inline buttons; sort icon + Move + ⋯ |
| H-17 | Archived vs Unbound rows | Truncated name + two big buttons vs avatar + name + subtitle |
| C-08 | Digest birthday rows | No avatar, unlike sibling rows |
| C-05 | Digest day-panel rows | Look like rows that open the Profile; don't |
| K-05 | Settings rows | Icon + chevron vs cards with none vs "›" glyph; info cards look tappable |
| A-21, A-22, H-27 | Contacts / Unbound | Seven filler prompts; truncated "No interacti…"; every subtitle "Unbound" |
| A-37, H-03, I-10 | Card grids | A lone card / tile stretches full width |

- Unifying direction: one list-management pattern (K-10 asks for it) with Delete behind ⋯; `CompactContactRow` (C-08) for every person row.

#### X-36 · COPY · Medium — Same concept, different words

| Concept | Words seen | Findings |
|---|---|---|
| Logging | Log, Log Interaction, Quick Log, Group Log, Log group, Log Contact (Settings swipe), Logged | A-29, B-12, F-05, F-24, K-32 |
| A group get-together | Events, Group Event, Group Events, Group Log, get-together, group interaction, group event; lifecycle "events" in purge | B-12, F-20, A-29, H-25 |
| Tracking | Bound / Unbound, tracked / Not tracked, Orbit participation, cadence, active orbit, Active Contacts, Inactive while Unbound | E-23, D-09, H-26, K-34, A-04 |
| Never contacted | Never Contacted, Not Contacted, Not yet contacted | C-11, K-43 |
| Favourite | Favourite(s), Favorite(s); Orbit Center vs centre | A-15, D-30, K-43, K-25 |
| Off Limits | Off Limits, Avoid, fuel | J-09, H-10, H-25, (999.3) |
| Channels | Text vs Message; email logged as Message; "unspecified"; "outbound" vs "Outbound" | K-32, J-05, F-04, F-09 |
| Confirmation prompts | "Interaction Assist" (Settings) vs "Did you send it?" (prompts); "Transmit" for Send | **J-18 + K-32 (merged, see §1)** |
| The Contacts tab | Contacts vs Dashboard | A-17, K-32 |
| Snooze | Snooze vs Snooze reminders | D-05, D-31 |
| Digest | Digest, Your Week, retrospective, weekly digest | C-10, K-33 |
| Contacts counted | "interactions" meaning contacts | H-04 |
| Archived vs Unbound | "out of your active orbit" for both | H-26, K-34 |
| Frequency | Monthly / Every 30 days / 30 days | D-10, E-11 |
| Memories sections | Pinned / Featured vs Featured & current; Memories vs Memory | G-23 |

- Unifying direction: a one-page glossary (one noun per concept) applied in a single copy pass; constants already exist for some labels (`product-labels.ts`, B-12).

#### X-37 · COPY · Medium — Developer and data-model vocabulary shown to users

| Area finding | Words |
|---|---|
| A-11, A-31 | "Sensitive Operations", "Identity" |
| A-19, C-12, C-13 | Rogue, Wobbling, decay, "rogue status", unexplained Up Next vs Overlooked |
| B-10, B-11 | Dissolve, Follows event, overridden, participant record |
| D-12, D-19, F-15 | factory, Child module, assignments, global, Tier 2 of 4, Gravity, Intensity "121× this period", "0-day average" |
| E-15, E-23, G-17 | Presentation only, AH, Orbit participation, cadence |
| G-05, G-07, G-20 | Quarantine, "1 need your input", custom System rules |
| H-10, H-28 | survives, external link, Source missing, Unlink source |
| K-09, K-17, K-40, K-43 | Definition, Overrides, Format version, Tombstones, resolved prompt, output contract, Hidden from switcher |
| C-10 | retrospective |

- Why it hurts: words that describe storage rather than what the user sees are the clearest sign of "only makes sense if you built it".
- Unifying direction: the same glossary pass as X-36, plus a one-sentence explanation in each metric sheet (D-19) and a status legend (A-19).

#### X-38 · COPY · Low — Menu labels vs destination titles, casing and plurals

| Area finding | Example |
|---|---|
| A-29, E-20 | "Add Contact" → "New contact"; "Archived Contacts" → "Archived"; "Edit Contact" → "Edit contact" |
| K-23, K-35, H-28 | "Data & Backup" → "Backup & Restore"; "Manage backups" → "Backup settings"; two AI rows → one page; "Check linked contacts" → "Update from Contacts" |
| D-31, A-28, B-12, G-22, G-23, K-43 | Title Case vs sentence case for the same labels |
| A-16, J-17 | "1 contacts", "1 items" |

- Unifying direction: the menu label equals the destination title; sentence case throughout; one pluralise helper.

#### X-39 · A11Y · Low — Screen-reader labels lose names, values and state

| Area finding | Label |
|---|---|
| A-30 | Tab glyphs read aloud; star "Add favourite" with no name; FAB "Add / capture" while showing ✕ |
| B-22, E-26 | "More actions", "Edit", "Remove", "Delete" with no name; Birthday without value |
| C-12 | "rogue status" |
| D-30, G-24 | "Memory", "Edit Memory memory" |
| F-17, F-24 | Count chips "5"; "Correct date and time"; toggle label not following text |
| I-15 | "Cancel" on a "Close" pill |
| K-28 | "Star colour 1…6" |
| Contrast (right) | Profile star "Add Zz UX Full Profile to Favorites" (A-30); Profile "More actions for <name>" (B-22) |

- Unifying direction: every repeated control includes the person's name and the current value, as the Profile header already does.

#### X-40 · VIS · Low — Background art and header surfaces differ between sibling screens

| Area finding | Screen |
|---|---|
| B-03 | Edit Group Event, Edit participant: solid fill |
| F-07 | Group Log: flat (`GroupLogScreen.tsx:108`) vs Log Interaction with art |
| J-11 | ComposeResearch: flat vs Compose with art |
| K-40 | AI Preview: flat |
| J-12 | Compose labels sit on visible patches |
| D-14, D-17 | Photo background contrast; translucent Profile header |
| E (spot-check note) | Update Contact solid header band |

- Unifying direction: drop the opaque `colors.background` fills (F-07 proposed fix) so every pushed screen shows the theme art.

#### X-41 · HID · Medium — Empty states: some explain and offer an action, most don't

| Area finding | Surface | Empty state |
|---|---|---|
| A-05 | Contacts filtered | "Nothing here right now." — no filter mention, Clear is in another panel |
| A-33 | Birthdays / Snoozed | "Nothing in Birthdays." |
| A-32, B-13 | Search no-match | Whole term echoed; Events repeats the sentence |
| A-21 | List rows | Seven different filler prompts, truncated |
| B-09 | Event, no participants | Form copy ("save now"), no Add button |
| B-24 | Events tab | Points to a "Group Log on any contact" that doesn't exist |
| D-22 | Profile | "Not available yet"; seven "Nothing added yet" with no Add |
| I-07 | Capture no-match | Only the New-contact tile, no text |
| K-11, K-27 | Region / Orbit Center | Empty list, no message |
| J-06, J-10 | Pending / Compose research | "You're all caught up" lingers; lowercase "nothing to remember yet" |
| H-15 | Import complete | Six zero-count cards |
| G-23 | Recently Deleted | 30-day rule explained only when empty |
| Contrast (right) | Profile History | Empty state with a "Log interaction" button (D-22); BulkReview "Nothing to review / No flagged items right now." (H-08) |

- Unifying direction: one empty-state component — heading saying what is empty and why, one line of help, one action — modelled on the History empty state (D-22).

#### X-42 · HID · Low — Actions reachable only by an undisclosed gesture

| Area finding | Gesture |
|---|---|
| A-36 | List-row swipes (log / edit); none in card view |
| A-23 | Swiped row stays open with a dead "Log" panel |
| H-03 | Review matches: long-press is the only way to act |
| I-09 | Capture: long-press for multi-select |
| K-38 | Sort icon that looks draggable and isn't |
| G (could not check) | Category drag handle |

- Unifying direction: every gesture has a visible equivalent (button or ⋯ entry); a one-time hint where a gesture is primary.

#### X-43 · HID · Low — Heatmaps have no labels and their days can't be opened

| Area finding | Surface |
|---|---|
| C-07 | Digest Your Week: no day labels, faint selection |
| C-04, C-05 | Digest day panel can't be closed; rows inert |
| F-16, F-17 | History Year / Month: no month or weekday labels; 13 dp dots; bare count chips |
| D-18 | Current square under the + |

- Unifying direction: one heatmap component with weekday/month labels and tappable days that open the same detail (History's day-tap jump is closest to right, F routes).

### 4.4 Top 10 and non-UX links

The cross-cutting pass's Top 10 is in the Summary. Its "Non-UX ↔ UX links" table is in the separate non-UX report (`.planning/ux-audit/NON-UX-FINDINGS.md`).

## 5. Quick wins — every finding with a Proposed fix

This list has 122 findings. A script built it from the `Proposed fix` line of every final area finding.
- **Format.** Each entry reads: id · code · severity · title — the fix, shortened to its key sentences, with the `path:line` it cites.
- **Wording.** The fix text is the area file's own wording, trimmed. The full fix, including what the user sees afterwards, is in the finding in section 3.
- **Overlap.** Four of these findings also carry a Needs investigation note for another part of the problem: F-23, G-06, G-09 and H-06.
- **Not included.** D-31, D-32, D-33 and D-34 carry neither a fix nor a pin.
- **Merged.** D-35 is superseded by H-01. Apply H-01's fix, which covers both.
- **Grouping.** Several fixes share one cause and should be done together; the cross-cutting merges table (section 4.1) lists them. For example, D-02 = H-23 (`EditContactScreen.tsx:1068`); E-22 = K-29 (switch `thumbColor`); A-35 ⊂ F-03 (`quick-log-command.ts:156`); E-05 folds into the Phase 39 D-51 work.

## A — Contacts tab

- **A-02** · DEAD · High · After leaving and reopening the app, the list is silently filtered by an old search, with the search box closed — `src/screens/HomeScreen.tsx:675` initialises `searchExpanded` with `useState(false)`. Initialise it as `useState(() => useDashboardSessionStore.getState().searchText !== "")`, or clear the session term on mount (the comment near :666 says "a fresh launch starts empty").
- **A-03** · INC · Medium · Population options add up instead of switching; "Favourites" with "All Contacts" selected appears to do nothing — in `src/components/control-surface/DashboardControlRow.tsx:114-134` (`togglePopulation`), make "all-contacts" exclusive: selecting it clears the others, and selecting any other option removes it.
- **A-05** · HID · Medium · A list filtered to nothing says only "Nothing here right now.", with no mention of filters — at `src/screens/HomeScreen.tsx:1771-1773`, when filters are active, show "No contacts match these filters" plus a "Clear filters" button wired like `dashboard-filters-clear`.
- **A-09** · HID · Medium · Android Back while search is open exits the app instead of closing search — the only Home BackHandler (`src/screens/HomeScreen.tsx:1601-1613`) handles selection mode only. Extend it so that, when `searchExpanded` is true, it calls `onToggleSearch()` (:737) and returns true.
- **A-11** · COPY · Medium · "More" in the selection bar opens a "Sensitive Operations" sheet with one item — at `src/components/BulkActionSurface.tsx:165`, show "Change frequency" directly in the bar, or rename the sheet "More actions". Also fix the a11y label "More sensitive operations" at `:128`.
- **A-13** · DEAD · Medium · Bulk frequency "Continue" with an empty field or "0" does nothing visible; the bar behind says "Working…" — `src/screens/HomeScreen.tsx:2203-2224` calls `showSnackbar({kind:"error", …})`. Disable Continue until the field holds a positive whole number, or show the error inline in the sheet.
- **A-14** · INC · Medium · Snoozing one contact uses a plain Android system dialog; bulk snooze uses a themed sheet — at `src/screens/HomeScreen.tsx:1528-1536`, replace `Alert.alert` with the bulk-snooze `Sheet` (`:2061-2115`), then show "Snoozed until <date>" with Undo.
- **A-15** · COPY · Low · "Favorite/Favorites" and "Favourite/Favourites" are both used on the Contacts tab — use one spelling. Change `src/components/CardContextMenu.tsx:79`, `src/components/BulkActionSurface.tsx:64,70` and the profile header to match `POPULATION_LABELS` ("Favourite").
- **A-16** · COPY · Low · Plurals: "Archive 1 contacts?", "Set all 1 contacts…", "…for 1 contacts", "Snooze 1 contacts…" — pluralise at `src/screens/HomeScreen.tsx:2250, 2257`, `:2077` (screen-reader label), `:2085` "Snoozed N contacts", `:2157` "…for N contacts", `:2248` "Log N interactions", and in the "Changed contact frequency…" snackbar.
- **A-17** · COPY · Low · "Dashboard" appears in user copy; the tab is "Contacts" — say "Contacts" at `src/screens/HomeScreen.tsx:2255` and in the Reset label at `dashboard-overflow-actions.ts:48`.
- **A-18** · COPY · Low · Filters chip reads "Filters / Filters" when nothing is set — at `src/components/control-surface/control-labels.ts:18`, make the default summary "None" or "Any" (like "Sort / Default").
- **A-20** · COPY · Low · Sort offers "Default" and "Status", which give the same order for All Contacts — (corrected by the verifier): `resolveDefaultSort` (`src/logic/dashboard-query-logic.ts:315-335`) maps Default to status for All Contacts, Favourites and multi-population, but to a different natural order for Not Contacted, Snoozed and Birthdays. Label Default by the order it resolves to for the current population, or hide "Status" when it equals Default.
- **A-23** · VIS · Low · After swipe-right to log, the row stays slid open showing a "Log" panel that does nothing (seen at ~1,000 contacts; re-check on the 100-contact set) — `onSwipeableOpen` (`src/screens/HomeScreen.tsx:365-374`) logs the interaction but never calls `swipeableRef.current?.close()`, and `SwipeActionSurface` is not pressable. Close the swipeable right after the right-swipe action fires.
- **A-24** · HID · Low · One identical "Choose contact" picker serves four different + actions — Add a `title` prop and pass the action in from `UniversalFab.tsx:373`, e.g. "Quick log — choose contact".
- **A-29** · COPY · Low · Menu labels don't match the screens they open — align labels with destination titles in `dashboard-overflow-actions.ts:28,38` (and the Unbound entry) and `CardContextMenu.tsx:74`. Consider removing "Group Events" from ⋯.
- **A-32** · VIS · Low · "No matches for "…"" echoes the whole search text without limit — at `src/screens/HomeScreen.tsx:1696`, set `numberOfLines={2}` or slice the term to ~40 chars.
- **A-33** · COPY · Low · Population empty states don't explain the population — at `src/screens/HomeScreen.tsx:1699-1716`, use copy like "No upcoming birthdays" and "No one is snoozed.
- **A-35** · HID · Low · Quick Log from long-press or swipe says only "Logged", with no name or channel — (citation corrected by the verifier): at `src/services/quick-log-command.ts:156` (shared with the FAB Quick Log), change the snackbar to "Logged <channel> with <name>".

## B — Events tab

- **B-01** · DEAD · High · The participant editor inside Edit Group Event can't be saved: "Save participant" is off-screen and the sheet doesn't scroll — `src/components/ui/Sheet.tsx:16-17` says the `expanded` variant does not scroll and its consumers own their scrolling. Wrap that body in a `ScrollView` (`keyboardShouldPersistTaps="handled"`).
- **B-02** · INC · Medium · The same participant record has two different editors under three different names — make the "Edit" button at `EditGroupEventScreen.tsx:312-319` navigate to `EditParticipant`, as `GroupEventDetailScreen.tsx:294-300` does, and remove the inline `Sheet` (`EditGroupEventScreen.tsx:375-395`).
- **B-06** · DEAD · Medium · After editing a participant from the interaction sheet, the sheet comes back showing the old values — `GroupEventDetailScreen.tsx:193-194` builds the sheet from the `detail` snapshot taken at tap time (set at :293). In the `onEdit` (:336-342) and `onEditParticipant` (:354-360) handlers, call `setDetail(null)` before navigating, or re-resolve `detail` from the refreshed `event.participants` by `interactionId`.
- **B-09** · HID · Medium · Event detail hides its main actions in ⋯, and the empty participant state has no Add button and the wrong copy — in the `ListEmptyComponent` at `GroupEventDetailScreen.tsx:281-287`, change the body to e.g. "Add the people who were there." and add a secondary "Add participants" button that calls `setPickerVisible(true)`.
- **B-11** · COPY · Medium · The participant editor shows three identical "Follows event" lines, apart from the fields they describe — at `src/components/group/ParticipantOverrideEditor.tsx:132`, use `following ? \`${label}: same as event\` : \`${label}: set for this person\``.
- **B-13** · COPY · Low · Search with no matches shows the same sentence twice and echoes the full search text — `src/screens/GroupEventsScreen.tsx:64-67,148-160` uses `emptyCopy` for both the heading and the body. When `emptyCopy` is set, use a different body, e.g. "Search looks at event titles and participant names.", and truncate the echoed term (e.g. 40 chars + "…").
- **B-14** · HID · Medium · Closing Events search keeps the filter: the list stays filtered with the search box hidden, even after switching tabs — at `GroupEventsScreen.tsx:82`, use `onPress={() => setSearchOpen((open) => { if (open) setTerm(""); return !open; })}`, or keep the field visible while a term is set.
- **B-16** · VIS · Medium · The interaction sheet cuts "Delete" to "Delet", and its actions are hidden below the fold — in `src/components/history/InteractionDetail.tsx:296-301` (`actions` style), add `flexWrap: "wrap"`, or put "View profile" on its own row. Consider placing the action row above the Group event card so it shows without scrolling.
- **B-17** · COPY · Low · Interaction sheet: "Connected / Connected", and "View Group Event" while already on that event — in `InteractionDetail.tsx`, show e.g. "Reached them: Yes". At `GroupEventDetailScreen.tsx:350`, pass `onViewGroupEvent={undefined}` instead of `() => setDetail(null)`.
- **B-22** · A11Y · Low · Screen-reader labels on Events lose context — in `ParticipantCard.tsx`, give the OverflowMenu (which already accepts `accessibilityLabel`, `OverflowMenu.tsx:37`) the label `More actions for ${participant.contactName}`; Profile already uses "More actions for <name>".
- **B-24** · COPY · Low · The Events empty state points to "Group Log on any contact", which doesn't exist (code-read; not seen on device) — change the text at `GroupEventsScreen.tsx:160` to "Log a get-together with several people from the + button (Group Log), or select people on the Contacts tab and tap Log."

## C — Digest

- **C-01** · HID · Medium · Android Back on Digest goes to the Contacts tab; Back after a Digest link exits the app instead of returning to Digest — `src/navigation/RootNavigator.tsx:240` `<Tab.Navigator …>` sets no `backBehavior`, so React Navigation's default `firstRoute` applies. Add `backBehavior="history"`.
- **C-04** · HID · Medium · Your Week day detail can't be closed; a busy day becomes a very long list — In `src/components/digest/YourWeekSection.tsx:268-274` `onSelectDay`, when `date === controllerRef.current.selectedDay`, call `commitController(selectYourWeekDay(controllerRef.current, null))` and `clearDay()` instead of reloading.
- **C-05** · INC · Medium · Day-detail entries can't be tapped and show only name and time — Make them `Pressable` and call a new `onOpenProfile(row.contactId)` prop, only for rows where `contactId` is not null (`contactId` is `number | null`, `src/db/your-week-read.ts:35`).
- **C-06** · COPY · Medium · Digest shows raw numeric dates ("2026-10-13", "2026-10-07", "10/07/2026") — Add one (for example, `formatDisplayDate` → "Tue, Oct 13") and use it at all three sites: `src/logic/digest-composition.ts:62` (`formatLocalDate(occurrence)` used as the birthday tag); `src/components/digest/DigestDayDetail.tsx:83`, which renders `{date}` raw (`:79` also uses it in the a11y label); and `dateLabel` in `src/components/digest/YourWeekHeatmap.tsx:53-56`.
- **C-07** · HID · Low · Heatmap squares have no day labels; the selected square is barely marked — In `src/components/digest/YourWeekHeatmap.tsx:108-124`, the selected cell is `borderWidth 2, borderStrong` and an unselected cell is `1, border`. Render a short weekday letter or date number in or under each cell, and use a stronger selected style (for example, an accent border).
- **C-08** · INC · Low · Birthday rows have no avatar, unlike every other Digest row — `src/components/digest/HorizonSection.tsx:81-104` renders only the name and tag. Reuse it for birthday rows with an optional trailing tag.
- **C-11** · COPY · Low · Three names for the same group: "Never Contacted", "Not Contacted", "Not yet contacted" — Pick one term, for example "Not contacted yet", and use it at `src/components/digest/HorizonSection.tsx:140` and `:206`, `src/components/control-surface/control-labels.ts:12` (population label "Not Contacted"), `src/components/icons/status-display-label.ts:17` and `ContactCard.tsx:90`.
- **C-12** · A11Y · Low · Avatars are announced with internal status names ("rogue status") — Map each status to a plain phrase, for example "Overdue", or reuse the `upNextReason` text (`UpNextSection.tsx:20-27`).

## D — Profile

- **D-02** · DEAD · Medium · After Save on Edit Contact, Back shows the stale Edit form again — `src/screens/EditContactScreen.tsx:1068` calls `navigation.navigate("Profile", { contactId })`. In React Navigation 7, `navigate` pushes a new screen instead of returning to the existing one.
- **D-04** · DEAD · Medium · "Show hidden" in Memories leaves the Profile, then flips to "Hide hidden" while still showing nothing hidden — `src/components/profile/ThingsToRemember.tsx:263-273` both toggles the local `showingHidden` and calls `onViewAll`, and the Profile's handler (`onKnowledgeViewAll={(intent) => routeKnowledgeChild(intent.id)}` in `ContactProfileScreen.tsx`) drops `includeHidden`. Either reveal the hidden items inline without navigating, or keep the label fixed ("Show hidden items…") and open the editor with its hidden switch on.
- **D-05** · INC · Medium · Two different Snooze sheets on the same Profile — Make the menu's "snooze" entry open the same sheet the card uses (`src/profile/relationship-sheet-model.ts` ~:95-122). (`src/screens/ContactProfileScreen.tsx:793-812`)
- **D-06** · DEAD · Medium · An archived contact's Profile has no Restore, still offers Archive (which errors), Snooze and Unbind, and lets you favourite it — `src/screens/contact-profile-logic.ts:264-281` `profileOverflowEntries` has no `archived` input. Add one: show "Restore" in place of "Archive", and drop Snooze/Unbind when archived.
- **D-08** · COPY · Medium · "Call unavailable. Add a phone number" on a contact that has a phone number — `src/profile/relationship-sheet-model.ts:241-247` returns "Add a phone number to call this contact." whenever no dialable phone exists. When a phone exists but can't be used, return something like "This number can't be dialled.
- **D-15** · COPY · Low · Item sheet buttons are lowercase ("edit", "pin", "unpin") next to "Hide from Profile", and the sheet closes with "Done" while sibling sheets say "Close" — `src/components/profile/ThingsToRemember.tsx:105` and `:134` print the raw action id (`label={action === "hide" ? "Hide from Profile" : action}`), and "Done" is at :112. Map each id to a label ("Edit", "Pin", "Unpin", "Hide from Profile"), and pick one close word for all Profile sheets.
- **D-21** · COPY · Low · Raw numeric dates on the Profile — `src/profile/knowledge-presentation.ts:265` returns the raw value for `case "date"`, and the snooze card's "Snoozed until" text is built at `src/components/profile/RelationshipOverview.tsx:97`. Format both with the app's local date formatter.
- **D-22** · COPY · Low · Empty values say "Not available yet", and an empty Profile is a wall of placeholders with no Add actions — `src/profile/knowledge-presentation.ts:260` returns "Not available yet". Change it to "Not set", and add an "Add…" action to empty Things to Remember cards.
- **D-30** · A11Y · Low · Things to Remember cards are announced by type, not content; mixed Favorite/Favourite — `src/components/profile/ThingsToRemember.tsx:131` sets `accessibilityLabel={item.title…}`. Append `item.preview`.
- **D-35** · DEAD · Medium · After a restore from Settings → Archived contacts, the Archived screen in the Contacts tab still lists the contact (seen once, not retested; cross-reference area H) — `src/screens/ArchivedContactsScreen.tsx:121-123` loads the list only on mount (`useEffect(() => { void load(); }, [load])`). Reload on focus with `useFocusEffect(useCallback(() => { void load(); }, [load]))`.

## E — Add, Edit and Update Contact

- **E-01** · DEAD · High · Add Contact throws away everything you typed on Back, with no warning — `src/screens/EditContactScreen.tsx:1103` uses `useDiscardKeepGuard({ hasUnsavedChanges, bypassRef })`, with the bypass set at :1067. Add the same hook to CreateContactScreen.
- **E-02** · DEAD · Medium · Save with an empty name does nothing: no message, no scroll (Add and Edit) — Render it as inline red text under the Name field, on both Add and Edit. 2. **Fix the scroll.** `revealAndFocus` passes `findNodeHandle(scroll)` (a number) to `node.measureLayout` (`CreateContactScreen.tsx:256-262`; same at `EditContactScreen.tsx:496-503`).
- **E-03** · DEAD · Medium · A birthday can never be removed, and Add Contact can't set one (moved from area C, raw C-14) — Add a tertiary "Clear" button beside Birthday when `form.birthdayInput` is set. Add the same Birthday field, with Clear, to Create (see E-04). (`src/screens/EditContactScreen.tsx:1267-1316`)
- **E-05** · HID · Medium · Choosing "Bound" on Add Contact pre-selects "Custom…" with 0 days and shows a red error at once — The cause chain: `coordinateBoundToggle` keeps `intervalDays = null` when binding with no cadence (`src/screens/create-contact-logic.ts:189-197`). Instead, in `coordinateBoundToggle`, when binding with no cadence, seed `intervalDays: 30, intervalValid: true`.
- **E-09** · HID · Medium · In Update Contact, Back from a single editor leaves Update Contact and silently drops what you typed — The focused editor is `session.activeRowKey` in the main screen (`src/screens/UpdateContactScreen.tsx:815-817`, rendered at about :957-960). If the editor has unsaved text, show the "Discard changes?" prompt.
- **E-10** · HID · Medium · Update Contact never says who you are updating — The title comes from `<ShellAppBar variant="child" title="Update Contact" />` at `src/screens/UpdateContactScreen.tsx:869` and `:957`. Show the contact's name there, or as a subtitle with the avatar, e.g. "Update Zz UX Full Profile".
- **E-12** · HID · Medium · "Pick date" for Last spoke lets you choose a future date, then rejects it while "Today" stays highlighted; picked dates show as raw ISO — `src/components/TriStateLastSpoke.tsx:195-200` renders `<DateTimePicker mode="date" …>` without `maximumDate`. Add `maximumDate={new Date()}` so future days are greyed out.
- **E-13** · VIS · Medium · "Not yet" never looks selected, and selected chips use two different styles on one form — `segmentColors` in `src/components/TriStateLastSpoke.tsx:103-110` always mutes "not-yet", even when it is selected. Give the selected not-yet segment the same accent fill as Today.
- **E-14** · HID · Medium · On Add Contact, a key person linked to an Orbit contact never shows which contact it's linked to — 1. **Draft rows.** `src/screens/CreateContactScreen.tsx:153` hardcodes `linked_contact_name: null`. Show "Linked to: <name>" next to Change/Clear.
- **E-15** · COPY · Low · Key person editor: "…doesn't hide it from search or AH." and an unexplained "Use default visibility" — In `src/components/RelationshipEditor.tsx:237`, change the text to e.g. "Only hides it on the profile.
- **E-21** · INC · Low · Update Contact's "Updated" badge shows only on the most recently edited row — The badge is shown for a single key, `session.lastSavedRowKey === row.key` (`src/screens/UpdateContactScreen.tsx` around :963). Track a set of rows saved this session instead, and add "Updated" to the row's `accessibilityLabel` (currently just `row.label`).
- **E-23** · COPY · Low · "Orbit participation", "Bound/Unbound" and "cadence" are unexplained jargon on the forms — use plain words, e.g. "Remind me to keep in touch: Yes / No", "…you'll get reminders when it's time to reach out".
- **E-25** · VIS · Low · Long "Last talked about" text is squeezed into a one-line box — The single-line TextInputs are at `src/screens/CreateContactScreen.tsx:640-655` and `src/screens/EditContactScreen.tsx:1537-1547`, with no `multiline`. Make them multiline inputs like the key-person Note field.

## F — Logging and history

- **F-01** · DEAD · High · Log Interaction throws away what you typed on Back, with no warning — `src/screens/LogInteractionScreen.tsx` has no `useDiscardKeepGuard` and no `beforeRemove` (a grep finds nothing). Add `useDiscardKeepGuard({ hasUnsavedChanges, bypassRef })` to Log Interaction: Seed the snapshot inside `seed()` (:114-154), after `setValue`. (`EditInteractionScreen.tsx:108-110`)
- **F-02** · HID · Medium · Saving a full log, group log, edit or delete gives no confirmation and no Undo; a backdated log vanishes behind "Show older" — In `src/screens/LogInteractionScreen.tsx:241-242`, call `showSnackbar({ kind: "success", label: "Logged for <name>", action: Undo })` (store at `src/stores/snackbar-store.ts:50`) before `navigation.goBack()`.
- **F-03** · HID · Medium · Quick Log silently switches channel to whatever was last picked in Log Interaction (deepens A-35) — At minimum, put the channel and name in the snackbar label (`src/services/quick-log-command.ts:156`), e.g. "Logged In Person with <name>".
- **F-04** · INC · Medium · Bulk Quick Log records channel "unspecified" and has no Add Note, unlike single Quick Log — Add a channel parameter to `bulkQuickLog` and pass in the resolved default channel, as single Quick Log does (`resolveInitialChannel`, `quick-log-command.ts:146`).
- **F-07** · VIS · Low · Group Log has a flat background in every theme; Log Interaction and Edit interaction show the theme background — `src/screens/GroupLogScreen.tsx:108` sets `backgroundColor: colors.background` on the root container; Log Interaction and Edit interaction set none. Remove it, and the theme art then shows behind Group Log as it does on Log Interaction.
- **F-08** · HID · Medium · No logging or edit form says who it's for (extends D-29) — show the contact name and avatar, as `EditParticipantScreen` does, in three places: as a subtitle in the `ShellAppBar` area, `LogInteractionScreen.tsx:285`; in the Edit interaction header, `EditInteractionScreen.tsx:163-179`; for Add Note, in the sheet heading at `src/components/PostLogNoteEditor.tsx:356`.
- **F-09** · COPY · Low · Raw lowercase values: "outbound / inbound / mutual", "unspecified" — Reuse it in `src/components/TouchpointRefineForm.tsx:339` (currently `label={o}`) and `src/components/history/interaction-detail-logic.ts:110`. In the stream, show "Unspecified" (or "Logged") instead of the raw `r.channel` in the `HistoryStreamRows.tsx` interaction row (~:123).
- **F-10** · INC · Low · The interaction sheet shows "Connected / Connected" for In Person and group entries the form never asked about (deepens B-17) — Skip it when the channel's `connectedHidden` is true (`defaultsForChannel`, `src/screens/log-interaction-logic.ts:79-84`).
- **F-12** · HID · Medium · Group Log: the "needs a title" error appears at the bottom, pushes the button into the gesture bar, and stays after you add a title — in `src/screens/GroupLogScreen.tsx`, the error is set only in `save()` (:80) and cleared only by a later save (:84). Render the error under the Title field. Clear it in the title's `onChangeText` (`setError(null)` when the text is non-empty).
- **F-13** · HID · Medium · Log forms let you pick a future date, then reject it after both pickers (repeats E-12 on the log forms) — `src/components/TouchpointRefineForm.tsx:570-575` passes no `maximumDate` to the date picker. Add `maximumDate={parseLocalDateTime(now)}`, and future days are then disabled in the picker.
- **F-14** · HID · Low · Logging from an empty month or day doesn't use the date you were looking at the way you'd expect — `src/components/history/HistorySection.tsx:1188-1192` builds an undated route (`buildLogRoute(contactId)`). Pass the month's first day instead, or hide the Log button there.
- **F-21** · HID · Low · Undo removes a Quick Log silently (bulk Undo, by contrast, confirms) — `src/services/quick-log-command.ts:108-112` only refreshes after the undo succeeds. Show a short "Log removed" snackbar there once the deletion resolves, matching bulk Undo's confirmation.
- **F-22** · VIS · Low · "Save changes" on Edit interaction sits in the gesture bar — `src/screens/EditInteractionScreen.tsx:227-230` gives the content container 16 padding and no safe-area inset. Add the bottom safe-area inset, and the button then sits fully above the gesture bar.
- **F-23** · INC · Low · The stream interleaves lifecycle events with interactions with no filter, and "In Person" shares the Bound/Unbound icon — for the icon: `src/components/history/HistoryStreamRows.tsx:52` maps "In Person" to `group-events`, and :61-62 map bind/unbind to the same icon. Give bind/unbind their own icon at :61-62.
- **F-24** · COPY · Low · Small wording and label slips on the logging forms — Give Group Log's Title (`GroupLogScreen.tsx:126`) its own placeholder, distinct from `PostLogNoteEditor.tsx:361`.
- **F-25** · HID · Low · The Quick Log contact picker keeps the previous search between opens — in `src/components/ContactPicker.tsx`, `term` (:69) is never reset when `visible` turns true (effects :88-129), and the FAB keeps the picker mounted (`UniversalFab.tsx:372-377`). Call `setTerm("")` in the `wasVisible` effect (:124-129) when the picker opens, and each open then starts with an empty search.

## G — Things to Remember

- **G-01** · DEAD · High · Editing an "Imported from Contacts App" memory silently turns it into a plain Memory, even when you change nothing — Cause: `src/components/MemoryEditor.tsx:184-186`. Use `type: item && isMemoryTypeKey(item.type) ? item.type : DEFAULT_MEMORY_TYPE_KEY`.
- **G-02** · HID · Medium · In the TTR editor, a hidden memory has no "Hidden" badge, and its "Show on Profile" button floats below a different memory — The Pinned/Outdated badges live in `src/components/MemoryCard.tsx:55-85`. Add a "Hidden" badge there. "Show on Profile" is rendered after the group's list in `src/screens/ThingsToRememberScreen.tsx:649-668`.
- **G-04** · DEAD · Medium · Android Back from "Edit field" / "New field" leaves Custom Fields altogether and silently drops your changes — Cause: `src/screens/CustomFieldsScreen.tsx:109` holds the editor as local `editor` state (rendered at ~324-348), and the screen has no back handler, so Back pops the whole route. While `editor !== null`, add a `BackHandler` / `usePreventRemove` that calls `setEditor(null)`, with a discard prompt if the form is dirty.
- **G-06** · HID · Medium · A value that "Needs attention" says so twice, and the Edit it points to shows no problem — (duplicate label): `src/profile/knowledge-presentation.ts:298` puts "Needs attention" into `metadata`. Drop one of them and give the other an error colour.
- **G-09** · INC · Medium · The TTR editor shows read-only and raw values for things it can't edit, and leaves out Off Limits — Carry `definition.type` into `customValues` and render through `formatCustomFieldValue` (`src/profile/knowledge-presentation.ts:256`), which the Profile already uses.
- **G-17** · COPY · Low · Pin/hide help text is developer wording and differs between memories and key people — replace the text at `src/components/MemoryEditor.tsx:426` and `src/components/RelationshipEditor.tsx:237` with one shared sentence, e.g. "Still saved and searchable; just not shown on the Profile." Afterwards both forms read the same.
- **G-22** · COPY · Low · New-field hints and type names — Change the placeholder at `src/components/FieldDefForm.tsx:228` to something like "e.g. Favourite food". Reuse the editor's capitalised type labels there.
- **G-24** · A11Y · Low · Memory cards are announced as "Edit Memory memory" in the editor and Memory screen — the label is set in `src/components/MemoryCard.tsx:139` (`` `Edit ${memoryTypeLabel(memory)} memory` ``). Change it to "Edit memory: <value>", optionally with the type.

## H — People lifecycle and import

- **H-01** · DEAD · High · The Archived list on the Contacts tab never refreshes, and stale rows then fail Restore and Delete forever with "Please try again" — in `src/screens/ArchivedContactsScreen.tsx:121-123`, load on focus instead of on mount: `useFocusEffect(useCallback(() => { void load(); }, [load]))`, as `UnboundContactsScreen.tsx:43` does.
- **H-02** · DEAD · High · "Link to Existing" in Review matches opens a list that runs off the screen, with no title, no scrolling and no Cancel; the real match can't be reached — In `src/components/ExistingContactChoice.tsx:47-90` (the component imports no `ScrollView`, :16), wrap the `choices.map` in a `ScrollView` with a `maxHeight` (for example 70% of the window), and add a Cancel button that calls `onClose`.
- **H-04** · COPY · Medium · "Check complete" counts contacts as "interactions" — in `src/screens/ReconcileCompleteScreen.tsx:24-26`, change `interactionLabel` to return `${count} contact${count === 1 ? "" : "s"}`.
- **H-06** · INC · Medium · Choosing the phone's email in "Update from Contacts" adds it instead of replacing, and the Orbit option then shows a garbled value — render the Orbit option for method families from the parsed methods, one value per line.
- **H-23** · DEAD · Medium · Archiving from a Profile you've just edited lands on the stale Edit form for the now-archived person — the D-02 fix. Edit Contact's save should `goBack()` / `popTo("Profile")` instead of `navigate("Profile")` at `src/screens/EditContactScreen.tsx:1068`.
- **H-26** · COPY · Low · Settings describes Archived in Unbound wording, and has no Unbound entry — change the description in `src/screens/settings-contacts-model.ts:184` to something like "People you've archived. Restore them or delete them permanently." The user will see a description that differs from Unbound.

## I — Sharing into the app

- **I-01** · HID · High · A cold-start share shows "Resume your check?" over the capture screen; Back can't dismiss it, and both buttons wreck the share or unrelated work — `App.tsx:441-454` mounts `ResumeImportPrompt` / `ResumeReconcilePrompt` whenever a resumable session exists, without checking how the app was opened. Skip **both** prompts while a share is pending.
- **I-05** · DEAD · Medium · Back throws away a typed note, or an open New-contact sheet, and leaves the app with no warning — `src/screens/CaptureScreen.tsx:214-225`: the BackHandler handles only `multiSelect` and otherwise calls `cancelCapture()`. Add two earlier branches. If `inlineOpen`, call `setInlineOpen(false)` and return true.
- **I-06** · INC · Medium · New contact from a share is silently set to Monthly tracking, with no choice shown — `INLINE_CREATE_INTERVAL_DAYS = 30` is at `src/screens/CaptureScreen.tsx:94` and used at :488. Show the frequency on the New contact sheet, or a "Track every month" toggle.
- **I-07** · HID · Medium · "New contact" is the last tile after every contact, and the search text isn't carried into the name — In `src/screens/CaptureScreen.tsx:459-461` (`onOpenInlineCreate`), call `setInlineName(searchText.trim())` when search is open. Consider putting the `{ kind: "new" }` item first rather than last (:569-572).
- **I-09** · HID · Low · Multi-select is long-press only, and with nothing selected there's no way out except Back — In `src/screens/CaptureScreen.tsx`, while `multiSelect` is on, replace the Close pill with a "Cancel selection" control that calls `exitMultiSelect` (:182), and change the title to "Select people". Add a hint line ("Long-press to pick several") so the feature can be found.
- **I-10** · VIS · Low · Tiles change size and position: the last row stretches, and selected tiles shift their avatar — In `src/screens/CaptureScreen.tsx`, the `tile` style (~:1016) has `flex: 1`. Give it a fixed share instead, e.g. `flexBasis: "30%", flexGrow: 0`, or `maxWidth: "33.33%"`.
- **I-11** · VIS · Low · The header (Close, search, preview) scrolls away with the grid — `src/screens/CaptureScreen.tsx:755` puts the header in `ListHeaderComponent`. Render the header above the `FlatList` instead, inside the root `View` (:744), and keep the revealed search field with it.
- **I-12** · COPY · Low · The preview of what's being saved is one truncated line — in `src/screens/CaptureScreen.tsx`, change `numberOfLines={1}` at :610 to allow 3 lines, or add tap to expand. Hide the host line (:615-622) when `displayText` is the URL itself.
- **I-13** · COPY · Low · Confirmation wording leaves out what happened — all in `src/screens/CaptureScreen.tsx`: :358: list the first names ("Saved to Ann and Bo"). :506: "Created Zz UX Share New and saved". After `onNoteDone` succeeds (:436-438), set a "note added" flag and show "Note added" instead of the "Add a note" affordance (:917-934). :553: "Nothing to save — the shared item was empty", in neutral text colour.
- **I-14** · HID · Low · A second share arriving while Capture is open keeps the old search filter — in `src/screens/CaptureScreen.tsx`, add an effect on `shareIntent` that resets `searchText`, `searchOpen`, `multiSelect`/`selected`, `inlineOpen`/`inlineName` and `noteOpen`/`noteText`.
- **I-15** · A11Y · Low · Close is announced as "Cancel"; search is an emoji glyph — in `src/screens/CaptureScreen.tsx`, change the label at :535 to "Close".
- **I-16** · VIS · Low · The note sheet's Skip/Done and the confirmation card sit in the bottom gesture area — add the bottom safe-area inset to the `bottom` of `confirmSurface` and `inlineSurface` (`src/screens/CaptureScreen.tsx` ~:1092, ~:1151).

## J — Compose and confirmations

- **J-01** · HID · High · A message Compose presents as a text is sent as an email, and Compose never says where it is going — in src/screens/ComposeScreen.tsx the mode-switch label (:1340-1342) and the controls use the session `mode`, while `onTransmit` (:975-985) uses `resolveUsableMode(...)` (src/logic/compose-logic.ts:173-185). Compute the usable mode once in render, then (a) show a destination line above the action row, e.g. "Email to zzux.full@example.com", and (b) label the switch from the usable mode.
- **J-09** · INC · Medium · Compose's "Things to Remember" is a different, read-only rendition with doubled headings and renamed sections — group by name with a Map in first-seen order in `groupItems()`, which also removes the duplicate key at :183. Drop the per-item label when it equals the group name (:190), or stop setting it in compose-research-read.ts:205.
- **J-11** · INC · Low · Compose and its own Things to Remember page differ in chrome: tab bar, + button, background, Back — add `"ComposeResearch"` to `FOCUSED_WORKFLOW_ROUTES` in src/navigation/focused-route-classification.ts:7-37 (next to `"Compose"`, :11).
- **J-13** · HID · Low · Copy, Copy subject and Transmit all "work" with nothing to send — In src/screens/ComposeScreen.tsx, disable Copy and Transmit when `body.trim() === ""` (buttons at :1796-1816; testIDs compose-copy :1800, compose-transmit :1810), and disable or hide "Copy subject" when the subject is empty. (`src/logic/compose-logic.ts:230-236`)
- **J-17** · A11Y · Low · "Things to Remember, 1 items" plural slip — pluralise in src/screens/ComposeScreen.tsx:1359 (`${researchCount} item${researchCount === 1 ? "" : "s"}`).
- **J-18** · COPY · Low · "Transmit" and "Interaction Assist" are unusual words for Send and for the confirmation prompts — rename the button to "Send" or "Open in Messages/Email" (ComposeScreen.tsx:1812-1813). Rename the setting to "Ask if I sent it" (SettingsInteractionsScreen.tsx:215, 220; settings-hub-model.ts:105).

## K — Settings

- **K-01** · HID · Medium · With "Allow notifications" off, every reminder switch still shows On and nothing says the settings are paused — In `src/screens/SettingsNotificationsScreen.tsx`, the sub-controls at :387, :435, :477, :528, :560, :597, :634 and :714 only set `disabled={!masterOn}`. When `!masterOn`, show the switches as off, or dim the whole group, and add one line under the master: "Turn on Allow notifications to use these settings." Keep the master description visible in both states (it is conditional at :266).
- **K-02** · HID · Medium · "Birthday alerts for unbound contacts" stays on and changeable when Birthday alerts is off — `src/screens/SettingsNotificationsScreen.tsx:477` → `disabled={!masterOn || settings?.birthdayEnabled !== 1}`, styled as dependent (indented or dimmed). The child switch will then grey out when its parent is off.
- **K-07** · VIS · Medium · The System builder draws a decorative planet on top of its form — `src/screens/SystemBuilderScreen.tsx:200-221` (`BuilderBackgroundCanvas`, mounted at :506 on the root behind the scrolling translucent HUD) draws `Circle cx=160 cy=270 r=42` and `r=120`. Remove the two circles (keep the `Fill`), or give the HUD surface an opaque background.
- **K-11** · COPY · Medium · The phone number region picker is close to unusable: bare codes, name search finds nothing, the sheet hides behind the keyboard, and stale search text survives — in `src/screens/SettingsContactsScreen.tsx`. Add "No regions match". Wrap the sheet in a `KeyboardAvoidingView`, or anchor it to the top of the screen. Clear the search there too (`setPhoneRegionSearch("")` today runs only after a selection, :181).
- **K-12** · COPY · Medium · Backup settings never says which folder is selected — `src/screens/BackupSettingsScreen.tsx:148` stores the literal `backupFolderName: "Selected backup folder"`, and :483 renders it. Derive a display name from the SAF tree URI by decoding its last segment (e.g. `primary:Documents/Orbit backups` → "Documents › Orbit backups").
- **K-14** · HID · Medium · Export asks "Export readable JSON?" as if that were the choice you made, with no Cancel — Use the themed `ConfirmDialog` (already used at `AIPersonalizationScreen.tsx:697`) with title "Export backup" and options "Encrypted (recommended)" / "Readable JSON" / "Cancel".
- **K-15** · COPY · Medium · Backup files have unreadable names: a raw number for exports, UTC times for automatic backups — Change all of these together: Exports: `src/services/backup/share-export.ts:51` builds `orbit-backup-${now()}.json`, and :44 and :70 parse the numeric stamp for cleanup.
- **K-17** · COPY · Medium · Restore preview speaks developer, and doesn't compare the backup with what's on the phone — `src/screens/RestorePreviewScreen.tsx:369–378`: drop "Format version" and "Tombstones", rename "Related rows" to "Notes, interactions and other details", and add "On this phone now: N contacts".
- **K-23** · COPY · Low · Backup naming and navigation don't line up: "Data & Backup" vs "Backup & Restore", "Manage backups" vs "Backup settings", and the Encryption row lands at the top — `BackupScreen.tsx:646` already calls `openSettings("encryption")`, which passes `{ section }`, but `BackupSettingsScreen.tsx` never reads `route.params.section`. Read it on mount and scroll to the Encryption group.
- **K-29** · VIS · Medium · Switches are hard to read in Galaxy Dark: a dark thumb on a dark track, and "off" almost invisible (confirms E-22) — the switches pass `thumbColor={colors.surfaceElevated}` (e.g. `SettingsNotificationsScreen.tsx:263`, `AIPersonalizationScreen.tsx:577`, and the other Settings switches). Use a light thumb token, such as the on-accent or text-primary colour, and a visible border-colour track for off.
- **K-32** · INC · Low · Interactions page wording doesn't match itself or the rest of the app — In `src/screens/settings-interactions-logic.ts`, change :30 "Remember last" and :72 "Remember Last Choice" to "Remember last choice"; change :31 "Text" to "Text message" (and the matching "Message" channel label); change :52 "Log Contact" to "Log interaction". (`src/screens/SettingsInteractionsScreen.tsx:184`)
- **K-34** · COPY · Low · Notification jargon: "Decay reminders" and "unbound contacts" — rename to "Check-in reminders" and "Birthday alerts for people you don't track" in `SettingsNotificationsScreen.tsx`. Apply H-26's fix at `settings-contacts-model.ts:184`.
- **K-38** · HID · Medium · AI Personalization sections: the ⋯ options open off-screen, below the section's long text — `src/screens/AIPersonalizationScreen.tsx:604–625` renders the options after the body (:557–569) and the move buttons (:590–603). Render them in a bottom sheet or menu anchored to ⋯ (as Categories does), and drop either the sort icon or the Move buttons.
- **K-44** · VIS · Low · AI Personalization: section text wraps in a narrow column, making very tall cards — in `src/screens/AIPersonalizationScreen.tsx` (card header ~:537–589), keep the title row (sort icon, title, switch, ⋯) as is, but render the body text below the header at full card width instead of inside the narrow `cardCopy` column.

## 6. Needs investigation — every pinned finding

This list has 175 findings. A script built it from the `Needs investigation` line of every final area finding.
- **Format.** Each entry reads: id · title — where to start, shortened to the key sentences of the area file's own note, with the `path:line` it cites where it gives one.
- **Detail.** The full note is in the finding in section 3.
- **Overlap.** F-23, G-06, G-09 and H-06 also appear in Quick wins, for a different part of the same finding.
- **Owner calls.** Some pins are product or owner decisions rather than code questions, and the note says so. Examples: B-23 (what the Events tab is for), K-22 (adding favourites to the backup format) and E-04 (which fields belong on Add Contact).

## A — Contacts tab

- **A-01** · List goes blank for seconds after a change, with no loading indicator (seen at ~1,000 contacts; re-check on the 100-contact set) — keep the old rows on screen (dimmed), or show progress while a read is in flight. Start in the `HomeScreen.tsx` read scheduler. (Start: `src/screens/dashboard-refresh-scheduler.ts:189`)
- **A-04** · Hidden "Active Contacts" population appears when nothing is selected, and after "Reset Dashboard View" — `AXIS_DEFAULT_LABELS.population` (`src/components/control-surface/control-labels.ts:17`) and `resetDashboardView` (`src/logic/dashboard-query-logic.ts:303-312`, which sets `populations: []`). Decide whether "none selected" means All Contacts, or list "Active Contacts" as a real option.
- **A-06** · Search ("Search people and notes") misses Last talked about, Current location and Off Limits, though rows display the location — the search corpus in `src/db/knowledge-search-read.ts` (`listKnowledgeSearchCandidates`) has no current-state or Off Limits source.
- **A-07** · Search returns a wrong match: "Denver" finds "History Dense", highlighting "Dense" — typo tolerance in the shared scorer behind `src/logic/dashboard-search-match.ts` is too loose for short words (Denver → Dense is two edits).
- **A-08** · While a search runs, the old rows stay on screen labelled "1 match" (seen at ~1,000 contacts; re-check on the 100-contact set) — (cause corrected by the verifier): rows and match maps are published together (`dashboard-refresh-scheduler.ts:181-189`). Derive search mode from the term of the read that produced `rows`, and show a searching state until it lands.
- **A-10** · The + button floats above the open Population/Filters/Sort panel and its dim layer — the FAB is mounted app-wide (`App.tsx:440`, `UniversalFab`). Hide it while HomeScreen's `panelOpen` is true; this needs a shell-level flag.
- **A-12** · Bulk "Change Contact Frequency" asks for a raw number of days — reuse the Add/Edit Contact frequency picker (area E) in the bulk sheet (`HomeScreen.tsx:2171-2242`).
- **A-19** · Status colours/icons and filter words are unexplained jargon — add a legend (badge long-press, or a "What do these mean?" row) and a one-line description for each filter family.
- **A-21** · List rows rotate between different filler prompts in line 3; all are truncated and none is tappable — the prompt pool in `src/logic/list-row-selection.ts` (~:10-20). Use one short, consistent prompt, or leave the line empty.
- **A-22** · Card view truncates "No interactions yet" to "No interacti…" — the recency text in `src/components/list-row-content.ts:15,31`. Use a shorter word ("Never").
- **A-25** · Contact picker: the keyboard hides the whole sheet, including the search field and results — `src/components/ContactPicker.tsx` (a `Modal` bottom sheet with no keyboard avoidance). Add keyboard avoidance, or use a full-height sheet with search at the top.
- **A-26** · Selection: "Select All" never becomes "Deselect all", and irrelevant actions stay enabled — the static label at `HomeScreen.tsx:1835`, and `disabled = selectedCount === 0 || pending` at `src/components/BulkActionSurface.tsx:53`.
- **A-27** · Selection bar takes ~40 % of the screen; a stray "Working…" line shows while a sheet is open — `BulkActionSurface.tsx` layout. The pending label is at `:93-100`, and pending stays true while a picker holds the claim.
- **A-28** · Bulk sheets differ: "Set category" is full-height, the others are compact; heading case is mixed — the category picker sheet variant in `HomeScreen.tsx`.
- **A-30** · Screen-reader labels: icon glyphs in tab labels, nameless star buttons, stale FAB label — Tabs: `tabBarAccessibilityLabel` in `src/navigation/RootNavigator.tsx`. Stars (`ListRow.tsx:389`, `GridCard.tsx:294`): include the name, as the profile's "Add Zz UX Full Profile to Favorites" does.
- **A-31** · Search result meta uses developer terms and repeats the name — source labels in `src/logic/dashboard-search-match.ts` (change "Identity" to "Name & contact info"), and skip any snippet equal to the name.
- **A-34** · Reset Dashboard View keeps the old scroll position (seen at ~1,000 contacts; re-check on the 100-contact set) — `resetDashboard` (`HomeScreen.tsx:484-502`) clears `scrollOffset` in the store, but nothing scrolls the list. Scroll to top on reset.
- **A-36** · Row swipe gestures are undiscoverable and absent in card view — a one-time hint, or visible row actions.
- **A-37** · A single search result in card view becomes one full-width card — grid column logic for small result counts.

## B — Events tab

- **B-03** · Edit Group Event and Edit participant look like an older generation of the app, and one flow has three different Back styles — move the headers at `EditGroupEventScreen.tsx:258-267` and `EditParticipantScreen.tsx:114-123` onto `ShellAppBar variant="child"` (as `GroupEventDetailScreen.tsx:223-231` does), and drop the opaque `colors.background` fill so the art shows.
- **B-04** · An event's title can't be changed anywhere — `EditGroupEventScreen.tsx:268` renders `event.title` as `AppText`. `UpdateGroupEventInput` / `updateGroupEvent` (`src/db/group-events-dao.ts:48-53`, `:383`) has no title field.
- **B-05** · Adding or removing participants on Edit Group Event saves at once, skipping "Save changes" and the discard prompt — participant writes happen immediately (`addSelected` / `removeParticipant` in `EditGroupEventScreen.tsx:162-219`), while `useDiscardKeepGuard` only tracks `isGroupEventDraftDirty` over the event fields. Either move participant management off this form (the detail screen already has Add / Remove) or make it part of the draft.
- **B-07** · "Remove from group → Delete interaction" deletes at once; the same delete from the interaction sheet asks for confirmation — `src/components/group/RemoveParticipantSheet.tsx:33-45`. Options: put "Keep as individual interaction" first or make it the default, add one line of explanation per choice, and use the same confirmation (or an undo snackbar) as elsewhere.
- **B-08** · Group Log started from the Events tab ends on the Contacts tab, and the new event isn't shown — `src/components/universal-fab-logic.ts:193-195` always targets `DashboardTab` / `GroupLog`. `GroupLog` is registered only in the Contacts stack (`DashboardStack.tsx:43`), and `GroupLogScreen.tsx:99` calls `goBack()` inside it.
- **B-10** · Developer terms throughout Events: "Dissolve", "Follows event", "overridden", "participant record", "Gravity", "Intensity" — a copy pass over `GroupEventDetailScreen.tsx:45-56,223-231`, `ParticipantCard.tsx:33-38,77-78` and `ParticipantOverrideEditor.tsx:132-138`. Example wording: "Ungroup (keep each person's entry)", "Same as event: channel, tone", "Tone set just for <name>", "Use the event's tone".
- **B-12** · One concept, many names: Events / Group Event / Group Events / Group Log / Log group — pick one noun (e.g. "Event") and one verb ("Log event"). (Start: `universal-fab-logic.ts:39`)
- **B-15** · Android Back doesn't close Events search; it leaves the tab — `GroupEventsScreen.tsx` has no `BackHandler`. Add one that closes search (and clears it, see B-14) when search is open.
- **B-18** · Event editors use unthemed Android system dialogs and dropdowns next to themed ones — `src/navigation/discard-keep-guard.ts:29` (`Alert.alert`) and the native `Picker` at `src/components/TouchpointRefineForm.tsx:300,327,373`. Switch to `ConfirmDialog` and the app's sheet/option list.
- **B-19** · Destructive dialogs lay out their buttons differently — Keep one order: either always stacked with the destructive button on top, or always Cancel first.
- **B-20** · Duration control: a saved custom duration isn't shown on reopening, and "None" appears twice — `src/components/TouchpointRefineForm.tsx:193` always seeds `customMinutes` with `""`. Seed it from the saved value when that value matches no chip, and hide the readout when "None" is selected.
- **B-21** · Participant cards don't show what's different for a person — `src/components/group/ParticipantCard.tsx:24-38`. Show the changed values ("Tone: Neutral") and a note snippet instead of the list of fields that follow the event.
- **B-23** · The Events tab can't create, plan or remind: no add button, no future events, no reminders — a product question for the owner: rename the tab to match what it is, or add planning and reminders. The small part: set `maximumDate` on the `DateTimePicker` at `TouchpointRefineForm.tsx:570-575` when `futureDateMessage` is set.

## C — Digest

- **C-02** · + button actions started on Digest open on top of old Contacts-tab history; Back lands on an unrelated screen — `src/components/universal-fab-logic.ts:185-205` (`resolveFabTarget`, `AddContact` at `:190`) always targets `DashboardTab`. `navigateIntoTab` (`tab-entry.ts:57-67`) uses `initial: false`, so on a stack that is already mounted the screen is pushed on top of the existing history.
- **C-03** · Digest links silently replace the user's saved Contacts view and land on a hidden population — `src/screens/DigestScreen.tsx:113-127` `runDigestDrillThrough` calls `setPopulationsAndFilters`. That function (`dashboard-query-store.ts:117-133`) saves `dashboardPopulations`/`dashboardFilters` to app settings.
- **C-09** · Switching Rolling 7 Days / Calendar Week makes the page jump — `src/components/digest/YourWeekSection.tsx:322-360`. Keep the previous body mounted while loading.
- **C-10** · The Your Week period is set in two places, and one is labelled with jargon — Decide on one home for the setting, or reword the Settings copy (for example, "Digest: how Your Week counts days"). (Start: `src/screens/SettingsInteractionsScreen.tsx:200`)
- **C-13** · "Overlooked" vs "Up Next" is unexplained; Overlooked rows give no reason — The Overlooked row renderer in `src/components/digest/HorizonSection.tsx:112-135`, whether it can show a reason line (for example, "Last contact 292 days ago"), and whether `upNextReason` can tell overdue and rogue apart.
- **C-14** · The + button covers the Your Week day-panel rows — The FAB is mounted app-wide (`App.tsx:440`, `UniversalFab`; see A-10). Options: keep row content clear of the FAB column inside the day panel, or shrink or hide the FAB while the list scrolls.

## D — Profile

- **D-01** · "pin", "unpin" and "Hide from Profile" in a Things to Remember item sheet do nothing; they just open an editor screen — `src/screens/ContactProfileScreen.tsx:361-394` `routeKnowledgeAction` never reads `intent.action`. Start by wiring pin/unpin/hide to the same services the Things to Remember editor uses.
- **D-03** · Identical pencil icons and item "edit" buttons go to different places, never to the item itself — `src/screens/ContactProfileScreen.tsx:338-394` (`routeKnowledgeChild` and `routeKnowledgeAction`) passes only `contactId`. Check whether ThingsToRemember / Edit can accept a target section or item id to scroll to and open.
- **D-07** · Archive from Profile drops you on the list with no message and no undo; the person just vanishes — `src/screens/ContactProfileScreen.tsx:440-449` (`archive` → `navigation.goBack()` with no snackbar). Consider the same snackbar-with-Undo pattern the post-log snackbar uses.
- **D-09** · Unbound Profile says "Not tracked. Set a contact frequency" while showing a frequency — `src/services/profile-metrics.ts:154-167` uses one message for Unbound, no frequency, and no last contact. Fix it together with the known item: one reason message per branch, e.g. "Unbound — bind to track."
- **D-10** · Three different contact-frequency choosers, and the card and sheet use different words — unify on one chooser component.
- **D-11** · Saving a profile layout collapses every section, and the editor's "Collapsed by default" contradicts what the Profile shows — `src/components/profile/ProfileLayoutEditor.tsx:141-151` (expanded label/button), and how the saved layout's `expanded` flags replace each contact's own collapse state.
- **D-12** · Developer terms in Profile Layout, Background and Reset — copy pass over `src/components/profile/ProfileLayoutEditor.tsx` (e.g. :113-117, :417), the template manager and the background sheet. Rename the menu item "Reset" to e.g. "Reset look".
- **D-13** · The Background sheet, opened from one person, puts app-wide actions first and gives no scope warning — put per-contact actions first; style Delete as destructive and ask for confirmation; label the global/category actions with how far they reach.
- **D-14** · A photo background makes Profile text hard to read — add a scrim behind header and card text when a photo background is active.
- **D-16** · Section chevrons point down whether the section is open or closed — `src/components/profile/ProfileModuleHost.tsx:119-122` always uses `chevron-down` and changes only its colour state. Rotate the chevron, or switch to chevron-up when expanded.
- **D-17** · Content scrolls visibly behind the translucent header, and the header never shows who you're looking at — the header already has a token scrim (`PROFILE_APP_BAR_SCRIM_OPACITY`). Raise its opacity or blur it, and fade in the contact name after the hero scrolls away.
- **D-18** · The + button covers the "Imported from Contacts App" edit pencil and the current heatmap square (instance of the cross-area + overlap, A-10 / C-14) — as part of the cross-area + overlap. The Profile already has bottom clearance (`useBottomClearance` in `ContactProfileScreen.tsx`), so the overlap only happens mid-scroll.
- **D-19** · Relationship Overview repeats itself and uses unexplained numbers — the copy in `src/components/profile/RelationshipOverview.tsx` and `src/services/profile-metrics.ts`. Let each sheet explain its term in a sentence instead of repeating the card.
- **D-20** · The Overview grid leaves an empty half-width gap beside Contact Frequency and Snooze — place compact cards side by side in the overview grid, or make them wide by default.
- **D-23** · A Link memory shows only the word "Link"; the URL can't be seen or opened from the Profile — `src/profile/knowledge-presentation.ts:149` puts the literal word "Link" in the metadata and never the URL. Show the URL and add an Open button.
- **D-24** · Birthday appears nowhere on the Profile — the Featured child in `src/profile/knowledge-presentation.ts:365-374` holds only memories and relationships. Add birthday there or to the Profile header.
- **D-25** · The ⋯ menu stresses Unbind (red, warning icon) but not Archive; the sheet is mostly empty with no Close; collapsing a section silently adds "Reset" — `src/screens/ContactProfileScreen.tsx:784-788` (`role={entry === "unbind" ? "destructive" : "secondary"}`), the `variant="expanded"` sheet at :690, and `hasContactPresentationOverride` (which counts collapse state).
- **D-26** · Profile confirmations use unthemed Android dialogs with different button layouts — replace `Alert.alert` at `src/screens/ContactProfileScreen.tsx:739` and `:762` with the app's themed confirm sheet.
- **D-27** · After Unbind the menu stays open with no Bind option; Snooze is still offered for Unbound contacts — the unbind path (`src/screens/ContactProfileScreen.tsx:743-745`) never calls `closeOverlay`. `profileOverflowEntries` (`src/screens/contact-profile-logic.ts:271-274`) always includes snooze; it could offer "Bind contact" and drop snooze when the contact isn't bound.
- **D-28** · The favourite star on Unbound contacts is disabled but looks enabled — dim the star when `favouriteDisabled` (`src/screens/ContactProfileScreen.tsx:554`), or explain on tap ("Bind to favourite").
- **D-29** · The Profile has no Log button, and + → Log Interaction from a Profile doesn't say who it's for — show the contact name on Log Interaction (area F), and consider a Log button beside Message/Call. (Start: `src/components/universal-fab-logic.ts:196-205`)

## E — Add, Edit and Update Contact

- **E-04** · Add Contact lacks many of the fields Edit Contact has, and Show More can't be collapsed — compare how `src/screens/CreateContactScreen.tsx` and `src/screens/EditContactScreen.tsx` put their sections together. Decide which Edit-only fields belong on Add, and add a way to collapse Show More.
- **E-06** · Bad phone numbers and emails are accepted silently on Add; Profile then says there is no number — All three forms use the same component. `src/components/ContactMethodsEditor.tsx:172-178` shows the warning only when `row.isActionable === false`, which is set for saved rows only.
- **E-07** · "Last talked about" and "Current location" are edited two different ways — pick one model for current-state fields. Compare Update's focused editor in `UpdateContactScreen.tsx` with the Edit inputs at `src/screens/EditContactScreen.tsx:1531-1580`.
- **E-08** · Some changes save the moment you tap, inside forms that otherwise wait for Save — decide one rule (hold until Save, or apply at once with Undo) and apply it to photo, key people and Off Limits in both screens.
- **E-11** · Contact frequency: Add, Edit and Update agree, but the rest of the app uses three other editors and two other words — reuse `FrequencyPicker` (as used in `CreateContactScreen.tsx:590`) in the Profile frequency sheet and the bulk sheet. Show "30 days" as "Monthly" wherever a preset matches.
- **E-16** · Three kinds of picker and two kinds of dialog on the same forms — Move them to the themed option sheet and `ConfirmDialog`. (Start: `src/navigation/discard-keep-guard.ts:29`)
- **E-17** · Custom date fields are free-text boxes that accept anything; Birthday uses a date picker — the widget is a plain TextInput at `src/components/field-widgets/DateFieldWidget.tsx:12-40`. Reuse the Birthday picker.
- **E-18** · Update Contact lists every custom field and then a "Custom Fields" row with the same fields again — the generic row that is always present comes from `buildChooserRows` (`src/screens/update-contact-chooser-logic.ts:132-150`, label at :65). Keep one of the two.
- **E-19** · Links can be edited only in Edit Contact — make the shared contact-methods editor include Links in all three forms.
- **E-20** · Titles, casing, Save labels and Back styles differ across the three forms — a shared header/back component and a naming pass.
- **E-22** · Switches that are off are nearly invisible on dark backgrounds; the custom toggle sits on the left — The off track is `colors.border` and the thumb is `colors.surfaceElevated` (e.g. `src/screens/EditContactScreen.tsx:1305-1306`, `src/components/RelationshipEditor.tsx:229-230`). Pick off-state tokens with real contrast in dark mode, and fix the custom-field toggle layout.
- **E-24** · "Add" controls look different in every section of one form — one "add item" button style for list sections.
- **E-26** · Unlabelled or context-free controls on the forms — add names and values to these accessibility labels (e.g. "Edit Zz UX Kid", "Birthday, October 13").
- **E-27** · Add Contact's duplicate-name warning offers no way to open the existing person, and nothing warns while typing — add "Open existing" to the duplicate dialog, and consider an inline "You already have …" hint under Name while typing.
- **E-28** · The empty "Pet photo" custom field shows a person-style initials avatar "PP" — Use a neutral image placeholder.
- **E-29** · Update Contact → Memory lists hidden memories with no "hidden" marker — list filter and badges in `src/screens/MemoryScreen.tsx`.

## F — Logging and history

- **F-05** · Bulk "Log Interaction" with 2+ selected silently becomes a Group Log, and never lists who is in it — `src/screens/HomeScreen.tsx:1181-1186` routes 2+ selected to `GroupLog`. Consider listing participant names or avatars, and labelling the bulk button "Group Log" when 2+ are selected.
- **F-06** · The three logging forms (Log Interaction, Edit interaction, Group Log) are laid out and worded differently — all three use `src/components/TouchpointRefineForm.tsx`; the differences come from each screen's settings and header: **Log Interaction:** `ShellAppBar` (:285); `channelOptions` (3); `moreOptionsFields` (duration); `allowAiCaption`. **Edit interaction:** a bordered `Pressable` Back (:164-172) and the full default form (5 channels, `TouchpointRefineForm.tsx:87-93`). **Group Log:** a secondary `Button` Back (:111-115); `visibleFields` without direction / connected / note / allowAi (:143); its own `AppText role="label"` "Group Note" (:147-149).
- **F-11** · On Edit interaction the keyboard covers the field you are typing in — the ScrollView at `src/screens/EditInteractionScreen.tsx:159` has no keyboard handling. The same form is used in Log Interaction and Group Log.
- **F-15** · History "Intensity" numbers are unexplained and look wrong — the `IntensityLine` copy in `src/components/history/IntensityChart.tsx`, and its inputs in `HistorySection.tsx`. `IntensityChart.tsx:69-71` caps the fill at 1, which is why the bar is always full once the floor is met.
- **F-16** · Year and Month heatmaps and the Cycles count chips have no labels — `src/components/history/ActivityHeatmap.tsx` / `heatmap-cell.ts` (month and weekday labels, layout width). Related to C-07 (Digest heatmap).
- **F-17** · Year heatmap dots are far below touch-target size; count chips are announced as bare numbers — the Year-lens cell size in `ActivityHeatmap.tsx`. Give the chips labels such as "Show 10 cycles".
- **F-18** · Add Note sheet: notes and memories behave differently, and the memory path stacks three sets of buttons — `src/components/PostLogNoteEditor.tsx`: Done under the memory editor: :335. Cancel / Create Memory Instead / Save, wrapping onto two rows: :378-389.
- **F-19** · Once an interaction has a note, the sheet hides Edit/Delete below the fold and the note comes last (B-16 on a single interaction) — `buildDetailRows` puts the note last (`src/components/history/interaction-detail-logic.ts:133-135`), and the actions follow the rows (`src/components/history/InteractionDetail.tsx:221-236`). Consider moving the note up and making the action bar sticky.
- **F-20** · "Make this a group interaction" is the only item behind ⋯, and it uses two names for one thing — `src/components/history/InteractionDetail.tsx:159-168` (single-item OverflowMenu). The naming overlaps B-12.
- **F-23** · The stream interleaves lifecycle events with interactions with no filter, and "In Person" shares the Bound/Unbound icon — a filter for lifecycle rows.
- **F-26** · After a bulk Quick Log, selected cards change position while selection mode stays — `src/screens/HomeScreen.tsx` `performBulkQuickLog` (~:1054-1080) refreshes the shell (`bumpShellRefresh`) while selection mode stays active, so the list re-sorts. Consider freezing the order until selection mode ends.
- **F-27** · In a long history the History controls are a long scroll away, and History has no Log button — `HistorySection.tsx` (a sticky control row or "back to top").

## G — Things to Remember

- **G-03** · Each kind of item in this area is deleted a different way — choose one delete pattern for Things to Remember items (e.g. recoverable delete + Undo snackbar). Start in: `src/screens/ThingsToRememberScreen.tsx` (remove / removeKeyPerson, ~344-436) `OffLimitsEditorScreen.tsx` `src/screens/CustomFieldsScreen.tsx:285-299` `src/screens/CategoryManagementScreen.tsx`
- **G-05** · The field-type change dialog hides what will happen to existing values — show before/after examples in the dialog and a real "Review now" path. (Start: `src/screens/CustomFieldsScreen.tsx`)
- **G-06** · A value that "Needs attention" says so twice, and the Edit it points to shows no problem — an error state on the Edit contact custom-field input.
- **G-07** · "Quarantine" is developer wording, and the same button reads "Delete" or "Quarantine" depending on hidden data — plain wording, e.g. "Remove" plus "Removed fields (kept 30 days, until <date>)". Code in `src/screens/CustomFieldsScreen.tsx`: the Quarantine/Delete button is at 466-478; the "quarantined · <type>" row is at 511-513.
- **G-08** · Custom Fields and Categories, side by side under "Relationship Structure", manage lists completely differently — pick one list-management pattern for both. Start in `src/screens/CustomFieldsScreen.tsx` and `src/screens/CategoryManagementScreen.tsx`.
- **G-09** · The TTR editor shows read-only and raw values for things it can't edit, and leaves out Off Limits — whether the read-only rows should be editable here or link to their editor.
- **G-10** · Three different memory lists for one person — Start in `src/screens/MemoryScreen.tsx` and `src/screens/ThingsToRememberScreen.tsx`.
- **G-11** · After saving from + → Memory, you land on a different person's Profile — Cause pinned: `src/components/universal-fab-logic.ts:198-206` pushes `Memory` onto the **DashboardTab** (Contacts) stack, even from Digest. `src/screens/MemoryScreen.tsx` then calls `navigation.goBack()` after Save (`savedTick` effect) without a success snackbar, so the user lands on whatever that stack had underneath.
- **G-12** · Back on the Memory screen throws away a typed new memory without warning — `src/screens/MemoryScreen.tsx` has no `beforeRemove` / `usePreventRemove`, and the draft lives in `MemoryEditor` state. Add a discard confirmation when the draft isn't empty.
- **G-13** · Memory "Link" and "Meaningful date" accept anything; a bad link opens a browser error page — Start in `src/components/MemoryEditor.tsx`: the link and date inputs have no validation, only `keyboardType="url"`.
- **G-14** · "Allow AI to use this" saves the moment you tap it, even if you then press Cancel — Cause: in `src/components/MemoryEditor.tsx:451-460`, the Switch's `onValueChange` calls `onSetAllowAi` immediately (the write is at 459). Fix direction: fold Allow AI into the draft and save it with Save.
- **G-15** · "Last talked about" values: two different "Set new value" forms, duplicate entries, and entries can never be deleted — start in `src/screens/ThingsToRememberScreen.tsx` and `src/screens/MemoryHistoryScreen.tsx`. (Start: `ThingsToRememberScreen.tsx:583-595`)
- **G-16** · Key person: the linked contact's name isn't shown while editing, and pinning isn't marked — `src/components/RelationshipEditor.tsx`.
- **G-18** · Inline edit forms open away from the tapped card, and the Memory screen's buttons wrap badly — in `src/components/MemoryEditor.tsx`, the form renders after `items.map(...)` (~283-290), and the `actions` row is `flexWrap: "wrap"` (line 548).
- **G-19** · Choosing "Custom" memory type disables Save without saying why — `canSave` (`src/components/MemoryEditor.tsx:276-280`) requires a custom label, and no message is rendered. Show "Enter a label" under the field, and keep Save tappable so a tap reveals the message.
- **G-20** · Deleting a category shows a wall of internal jargon and needs two "Keep" taps to back out — `src/screens/CategoryManagementScreen.tsx` (~770-830, the delete preview copy and the two-step flow).
- **G-21** · The + button covers "Create field" and the AI explanation on the field editor — hide the + button on focused editors, as on other form routes (focused-route classification).
- **G-23** · Section names and small labels differ between the Profile and its editor — shared labels from `src/profile/module-registry.ts`; date formatting in `src/screens/RecentlyDeletedScreen.tsx`.

## H — People lifecycle and import

- **H-03** · Review-match cards don't say which Orbit contact they match, and the only way to act is an undisclosed long-press — `src/screens/DuplicateReviewScreen.tsx` with `src/components/CandidateCardGrid.tsx`. Show the matched Orbit name on the card, and give each card visible actions.
- **H-05** · Check linked contacts doesn't keep decisions: the next check lists every card again, and "Updated" says 0 after an Apply — Start with the reviewed-snapshot comparison in `src/logic/reconcile-diff.ts` and `src/db/reconcile-snapshot-dao.ts`.
- **H-06** · Choosing the phone's email in "Update from Contacts" adds it instead of replacing, and the Orbit option then shows a garbled value — the add-instead-of-replace Apply behaviour, in `reconcile-apply.ts`.
- **H-07** · Apply in "Update from Contacts" gives weak feedback, stays enabled and jumps; Keep as is behaves differently — `src/screens/ReconcileDetailScreen.tsx`. Return to the grid after a successful Apply, as Keep as is does.
- **H-08** · Import, reconcile and merge screens each use a different header and Back style, and several have no Back at all — move these screens, including the `src/screens/BulkReviewScreen.tsx` header, onto the shared `ShellAppBar` used by `ArchivedContactsScreen`.
- **H-09** · Merging two people is reachable only from Settings → Check linked contacts → a card → grey "Merge with another contact" text — add a "Merge with…" entry to the Profile ⋯ menu that routes to `SurvivorSelect`.
- **H-10** · Merge flow wording is developer language and contradicts itself — `src/screens/SurvivorSelectScreen.tsx`, `src/components/MergeImpactSummary.tsx`. Use "Keep" / "Merge into", "Off Limits", "phone link", one undo sentence, and a destructive button style.
- **H-11** · The merge contact picker is the whole contact list, with no search, no Cancel and an unexplained order — reuse the app's searchable contact picker in that branch, with a subject line and Cancel.
- **H-12** · Flows started in Settings end on the Contacts tab; Back then lands on unrelated screens, and Settings forgets where you were — return to Contacts & Relationships instead, or keep these flows inside the Settings stack.
- **H-13** · Importing a phone contact that's already linked shows a full editable review form, then reports "Already in Orbit (1)" and throws the edits away — check the existing link before showing the form (`import-acquire.ts:232` / `ImportReviewScreen.tsx`), and show "Already in Orbit as …" with an Open button instead.
- **H-14** · The import editors differ from Add/Edit Contact and from each other — `src/screens/ImportReviewScreen.tsx`, `src/screens/BulkImportSetupScreen.tsx`.
- **H-15** · Import complete is six near-identical count cards, mostly zeros, and the user's own Skip is counted as "Failed / skipped" — `src/screens/ImportCompleteScreen.tsx` (copy around :302-328). Hide zero rows, split "Skipped by you" from "Failed", and list names.
- **H-16** · An unfinished import gives no sign that work is pending, and neither resume prompt says what Discard loses — `ResumeImportPrompt.tsx` (`App.tsx:444`) and `ResumeReconcilePrompt.tsx`. Show a "Resume import" row on Contacts & Relationships, name the pending items, and state what Discard drops.
- **H-17** · Archived rows cut the name short to fit two large buttons, and look nothing like Unbound rows — `src/screens/ArchivedContactsScreen.tsx` row. Use the Unbound row layout, and move the actions to a row menu or the Profile.
- **H-18** · Restore gives no feedback and doesn't say where the person went — add a snackbar to `doRestore`, such as "Restored to Unbound contacts · Open".
- **H-19** · Lifecycle actions are confirmed inconsistently, and Bind and Unbind live in different places — the Profile ⋯ actions in `ContactProfileScreen.tsx`. Pick one rule: confirm only irreversible actions, and give undo snackbars for the rest.
- **H-20** · The Unbind dialog says favourites are removed, but the star stays filled (and disabled), and the favourite comes back on Bind — Either clear the favourite or change the dialog text.
- **H-21** · Snooze on an Unbound contact really applies, and the Overview then shows snoozed reminders for someone who has none — hide Snooze for Unbound contacts in the ⋯ menu, and size the Snooze card sheet so Close is visible on open.
- **H-22** · "Mute reminders" exists only as a switch deep inside Edit Contact, and a muted person looks no different anywhere — show "Reminders muted" in the Overview Snooze card (`ContactProfileScreen` overview), and offer Mute next to Snooze.
- **H-24** · An archived person's Profile shows them as "Stable", and Unbind still works on them — archived-state handling in the `ContactProfileScreen` Overview and ⋯ menu.
- **H-25** · The permanent-delete dialog counts "events" the user never created — `impactSummaryLines` (used at `ArchivedContactsScreen.tsx:147`). Leave out lifecycle events or call them "history entries", and rename "fuel item".
- **H-27** · In the Unbound list, the first match after a search is hidden above the fold, and every row repeats "Unbound" — `src/screens/UnboundContactsScreen.tsx`. Scroll to the top when the query changes, and use a useful subtitle (for example, last contact).
- **H-28** · Linked-contact check wording and values — the copy in `ReconcileGridScreen.tsx` and `ReconcileDetailScreen.tsx`.
- **H-29** · The Unbound Profile shows frequency chips with Bind only for a never-bound person; after an Unbind there is just "Bind contact" — the Unbound card in `ContactProfileScreen`.

## I — Sharing into the app

- **I-02** · On the capture screen, the keyboard covers the "New contact" name sheet and the "Add a note" field, buttons included — In `src/screens/CaptureScreen.tsx`, `confirmSurface` (~:1092) and `inlineSurface` (~:1151) are `position: "absolute", bottom: 16`, with no keyboard avoidance. Start with a keyboard-height offset on those two surfaces.
- **I-03** · Sharing into Orbit while you're using it closes Orbit afterwards; reopening loses your place — `CaptureScreen.tsx:176-179` (`cancelCapture`) and `:245-249` (`armAutoReturn`) call `finishActivity()`, which is a plain `Activity.finish()` in `modules/orbit-share-finish`. Start with whether the share can run in a separate share activity or task, or use `moveTaskToBack` instead of `finish` when Orbit was already running.
- **I-04** · One tap saves at once, with no Undo; the confirmation and "Add a note" stay for only 1.5 seconds — `AUTO_RETURN_MS = 1500` is at `src/screens/CaptureScreen.tsx:87`, and the commit happens in `onPickFace` (:255-302). Lengthening the window is a one-number change. An Undo is feasible: the written row ids are kept in `writtenRows` (:134), and `deleteFuel` exists in `src/db/fuel-dao.ts`.
- **I-08** · The capture picker is a completely different design from every other contact picker in the app — compare `src/screens/CaptureScreen.tsx` (header :574-596, grid :745-757) with `src/components/ContactPicker.tsx`.

## J — Compose and confirmations

- **J-02** · After "Yes, log interaction" Compose closes silently, and the banner still asks about an older handoff without saying so — show a confirmation snackbar on `performExit("logged")` (ComposeScreen.tsx:1146-1149, which has no snackbar). Decide how the banner should identify its handoff (time or message preview).
- **J-03** · After "Not yet", the reminder disappears until the app is closed and reopened — the queue refreshes only on launch, on background→active and on publications (src/stores/assist-store.ts:51-66). Start by refreshing the queue on Not yet and making a just-deferred item eligible right away.
- **J-04** · A typed draft is silently discarded when you start a message to someone else — `startSession` in src/stores/compose-session-store.ts:121-127 resets the whole draft when the contact differs. Either keep one draft per contact or warn before replacing it.
- **J-05** · The two confirmation surfaces mirror their primary button, and an email is logged as "Message" — compare the Compose panel (ComposeScreen.tsx:1757-1787; buttons :1769-1784) with `AssistConfirmation` (src/components/AssistConfirmation.tsx:59-111, used by the banner and the sheet).
- **J-06** · Pending confirmations: identical rows, no way to tell them apart, no Close, and actions with no feedback — src/components/PendingConfirmationsSheet.tsx. Add the handoff time and a body preview per row, a Close button, and an Undo snackbar.
- **J-07** · A note typed under "Add a note" is thrown away without warning when the dialog closes (confirmed from code; not physically rechecked) — keep note drafts per assist in state outside the modal, or confirm before dismissing with unsaved text.
- **J-08** · The app-wide banner pushes Compose's Copy and Transmit to the gesture bar, where a stray tap fires Transmit — AssistBanner renders in flow above every screen (src/components/AssistBanner.tsx:51-61, root style :227-231). Consider hiding it on Compose while Compose's own panel shows, and a compact one-line banner.
- **J-10** · Compose's Things to Remember shows raw values — format with the same helpers the Profile uses. Start where ResearchItem values are built (src/db/compose-research-read.ts).
- **J-12** · Compose labels sit on visible patches in light themes and in Standard Dark — `ChromeScrim` draws `colors.surface` at `chromeScrimOpacity(package, mode)` (src/components/ui/ChromeScrim.tsx:56-71), and Compose wraps each label separately (ComposeScreen.tsx:1161-1170, 1256, 1273, 1308). Check the opacity per package and mode against the mode-aware card glass.
- **J-14** · "Subject copied" appears far from "Copy subject", often off-screen — `copyFeedback` renders only in the action row (ComposeScreen.tsx:1790-1795). Show it next to the tapped control, or as a toast.
- **J-15** · No-destination Compose offers an email switch for a person with no email, and "Add a phone number or email" lands at the top of Edit Contact — the mode switch is unconditional (ComposeScreen.tsx:1336-1346). Hide it when neither mode is usable (`controls.addNumber`, :1711).
- **J-16** · A long message makes the whole screen scroll: header gone, actions pushed down, no length hint — `draftInput` has `minHeight: 120` and no `maxHeight` (ComposeScreen.tsx:1852-1859), and the whole screen is one ScrollView. Cap the input height (internal scroll) and keep the action row fixed at the bottom.

## K — Settings

- **K-03** · The reminder time can be set inside quiet hours with no warning — add an inline warning when the reminder time falls inside quiet hours (e.g. "Reminders will arrive at 8:00 AM, when quiet hours end"). Start at the delivery-time block in `SettingsNotificationsScreen.tsx` (around :560–:640).
- **K-04** · Settings pages use at least six different header and Back styles (deepens H-08) — move every Settings page onto the `ShellAppBar` header that the hub's direct children already use. Start with `BackupScreen.tsx`, `BackupSettingsScreen.tsx`, `RestorePreviewScreen.tsx`, `AIConnectionScreen.tsx`, `AIPermissionsScreen.tsx`, `AIPersonalizationScreen.tsx`, `AIPreviewScreen.tsx` and `SystemBuilderScreen.tsx`.
- **K-05** · Settings pages use different row and page layouts, and tappable rows look the same as information cards — Start with `SettingsContactsScreen.tsx`, `SettingsInteractionsScreen.tsx` and `SettingsAIScreen.tsx`.
- **K-06** · Four ways to save a setting; two of them silently throw away edits on Back — either save these fields on change, like the rest of Settings, or add the builder's discard prompt and a "Saved" toast. Start in `BackupSettingsScreen.tsx` (Save schedule at :591) and `AIPersonalizationScreen.tsx`.
- **K-08** · The System builder's "name required" error appears off-screen, and stays after you type a name — Start in the `SystemBuilderScreen.tsx` save handler.
- **K-09** · "Manage Members" opens an editor, which has its own "Manage Members" button — open the member list directly from the Systems card (`SystemsManagementScreen.tsx:467–469` routes to `SystemBuilder`), and rename "Back to Definition" (`SystemBuilderScreen.tsx:654`) to "Back" or "Done".
- **K-10** · The Systems list uses yet another way to manage a list, and makes Delete the loudest button on every card (extends G-08) — Start in `SystemsManagementScreen.tsx`.
- **K-13** · "Your backup needs attention" offers no way to back up now — add "Back up now" (write to the selected folder) to the warning card. Start in `BackupScreen.tsx`.
- **K-16** · The restore flow never says which file you picked, and two different backups can show the same date — show the file name (and size) in the passphrase card and in "Backup details", and add a show/hide toggle. Start in `BackupScreen.tsx` (around `validateRestore`) and `RestorePreviewScreen.tsx:362`.
- **K-18** · The Replace confirmation gives no idea of scale, in an unthemed all-caps dialog (from RESTORE-REPORT, not re-run) — put the local and backup counts in the dialog, and use the app's themed destructive dialog. Start there and at the Replace handler in `RestorePreviewScreen.tsx`. (Start: `src/screens/backup-restore-logic.ts:295–304`)
- **K-19** · After Replace, the result says "Deletions applied: 0" and is a dead end (from RESTORE-REPORT) — Start at `RestoreResultScreen.tsx`.
- **K-20** · A restore runs for minutes with no progress, and the tab bar stays usable meanwhile (from RESTORE-REPORT) — show steps (safety backup → applying) and block navigation while applying. Start in `RestorePreviewScreen.tsx`.
- **K-21** · Restore preview: "Merge" preselected, and one option has three names — use the same verb on card and button, and a stronger selected state. (Start: `src/screens/backup-restore-logic.ts:288–292`)
- **K-22** · Favourites aren't in backups, so any restore silently unfavourites everyone, and Data & Backup doesn't say so — include favourites in the backup format, on both export and apply. Until then, list them as "not included" in the footer and on the preview. Start at `src/backup/export-manifest.ts:149` and the matching apply code in `src/backup/`.
- **K-24** · Backup & Restore uses text glyphs for icons, and Export and Restore both show up-arrows — use the app icon font (e.g. download/restore and lock icons) at those lines.
- **K-25** · Appearance mixes the app theme with Orrery-only settings, although Settings has an Orrery page — move Your name, photo, star and Orbit Center to Settings → Orrery, or rename the section. Pick one spelling. (Start: `SettingsAppearanceScreen.tsx`)
- **K-26** · Default profile layout and background: untitled lists of templates named after people, with no preview or explanation — add a title, thumbnails and a one-line "Create templates from any profile's ⋯ menu". Rename the two settings "App background" and "Profile background". (Start: `SettingsAppearanceScreen.tsx`)
- **K-27** · Five different picker designs within Settings — Start from the region picker in `SettingsContactsScreen.tsx`, which is the most complete.
- **K-28** · The selected accent colour is nearly invisible, and the colour pickers mark selection differently — give swatches a check mark or a thick contrasting ring, and name the star colours (:922). (Start: `SettingsAppearanceScreen.tsx`)
- **K-30** · The + button covers controls throughout Settings — hide the + button on the Settings stack, or add bottom padding equal to its height. (Start: `App.tsx:440`)
- **K-31** · Your name: the keyboard covers the field, and the name saves silently on blur — make the scroll view keyboard-aware (scroll the focused field into view), and give a brief saved cue. (Start: `SettingsAppearanceScreen.tsx`)
- **K-33** · Your Week period and Weekly digest (agrees with C-10, adds detail) — group the Digest settings (Your Week period, weekly summary notification) together, and drop "retrospective". (Start: `SettingsInteractionsScreen.tsx:197–200`)
- **K-35** · The AI page shows no current state, and its rows don't match the pages they open — show values on the rows, merge the two personalization rows, and label the switch "Use AI suggestions". (Start: `SettingsAIScreen.tsx`)
- **K-36** · AI Connections: an active provider still shows "Connect with OpenRouter" as its main button — when active, show "Connected" with "Change model" as the primary action and Disconnect as secondary. (Start: `AIConnectionScreen.tsx`)
- **K-37** · AI Personalization: "Use custom guidance instead" ×3, and the preset still looks selected after you switch — grey out the chips when custom is chosen, and show the guidance box only when at least one dimension uses it. `AIPersonalizationScreen.tsx`.
- **K-39** · AI Data Permissions: "Review existing…" silently changes filters off-screen — scroll to the Review section on tap. (Start: `AIPermissionsScreen.tsx:283–288`)
- **K-40** · "Preview What Orbit Sends" is written for developers — plain wording ("This is exactly what Orbit sends to your AI provider") and reflowed text. `AIPreviewScreen.tsx`.
- **K-41** · About Orbit shows only an icon, a name and a version — add "Your data stays on this phone", open-source licences and a support link. (Start: `SettingsAboutScreen.tsx`)
- **K-42** · Background names don't match what they show in the other mode — mode-neutral names, or per-mode names. `SettingsAppearanceScreen.tsx` and the theme background registry.
- **K-43** · Systems vocabulary: Favorites/Favorite, "Needs Attention · Needs attention", Gravity, Social Battery, Overrides, "Hidden from switcher" — a single glossary pass. `SystemsManagementScreen.tsx`, `SystemBuilderScreen.tsx`, `settings-contacts-model.ts`.

## 7. Known items seen again (new detail only)

These items are already known (owner prompt §3.5) and were not re-reported as findings. This section lists only the cases where a pass found materially new detail. Known items seen again with nothing new are left out; for example, the "Orbit" title (999.4) was seen in area A and dropped.

### 999.3 — old Fuel editor for Off Limits; inline Memory / Off Limits inputs on the contact forms
- **A better editor already exists (area E).** Add Contact → Off Limits still says "No fuel yet / + Add fuel" (`E-add-edit-update/29-offlimits-open.xml`). Update Contact → Off Limits already has a plain list editor ("What should you avoid?", with Add and Remove; `E-add-edit-update/65-update-offlimits.xml`). It could replace the Fuel editor on Add and Edit. The cross-cutting pass names it the closest-to-right Off Limits editor (X-17).
- **Default kind and delete dialog (area G, also noted at setup).** "Add fuel" opens with Kind = Topic, even inside the Off Limits screen. Deleting an entry uses an unthemed Android dialog; that dialog is part of finding G-03.
- **The word "fuel" outside the editor.** It also reaches users in the merge and permanent-delete dialogs ("fuel items"). This was filed as findings H-10 and H-25 and grouped under X-17 / X-36.

### 999.5 — things shared into the app are saved invisibly
- **Where the shares went (area I).** Items were saved to Zz UX Full Profile, Zz UX Add Test and Zz UX Share New. None appears anywhere on the Profile: not in Memories, Last Talked About or Pinned/Featured, and not in the History stream. The newest History entry that day was a 5:32 AM "Last talked about" change; the shares were saved between 7:15 and 7:33. This confirms the known item.
- **Search behaves inconsistently on shared items (seen once, not reproduced).** Contacts search matched shared-item text once: `I-sharing/12-` / `12b-search-shared-text.png` shows "1 match · Zz UX shared text two". On the area I retest it did not match: a share containing "recheck" was not found (`I-sharing/retest/R2-02*`), although the row exists in the database. This is reported as inconsistent search behaviour on shared items, seen once and not reproduced. No stronger claim is made.
- **Related share-flow findings.** These are filed as findings because they concern the flow itself, not where the item ends up: I-04 (a 1.5 s confirmation with no Undo), I-06 (a share-created contact is silently tracked Monthly) and I-13 (vague confirmation wording).

### 999.6 — moving entries between Things to Remember sections
- **New detail (area G): a memory's form contradicts the Profile.** The Memory type picker offers Memory / Imported from Contacts App / Custom, so a user can file their own memory as "Imported…". That part is the known item. After they do, the memory's own edit form still says "Added by you", while the Profile files it under "Imported from Contacts App". The Profile therefore misstates where the memory came from (`G-things-to-remember/124-imported-edit-before-save.png`, `14-memory-inline-edit-bottom.png`).
- **The opposite direction is a finding.** G-01 (High): a real imported memory loses its type on an unchanged Save.

### Phase 39 prerequisite fixes (`39-CONTEXT.draft.md`)
- **Add Contact defaults (Unbound + Today; Relationship Basics collapsed).** Confirmed as known. Two separate defects are linked to Phase 39 (orchestrator note, from the E verifier):
  - **E-05** (Bound → "Custom… 0" with a red error) would be unreachable on Add once D-51 (Bound + Monthly default) lands. Fold it in as an acceptance check.
  - **E-13** ("Not yet" never looks selected) collides with D-50 (Not yet default): new Add forms would open with no visible Last spoke choice.
  - Flag both for Phase 39.
- **Tapping a possible match does nothing.** Known. H-03 carries the new detail: Review-match cards don't say which Orbit contact they match, and the only way to act is an undisclosed long-press. H-02 (High) adds that "Link to Existing" opens a list that runs off the screen with no Cancel.
- **The double "Did you send it?" in Compose.** Known. J-02, J-05 and J-08 keep only what is new:
  - J-02: after "Yes" Compose closes silently, while the banner still asks about an older handoff.
  - J-05: the two surfaces mirror their primary button, and an email is logged as "Message".
  - J-08: the banner pushes Copy and Transmit into the gesture bar, where a stray tap fired Transmit.
- **"Not tracked" on a tracked person with no contact yet.** Known. D-09 adds the Unbound case: "Not tracked. Set a contact frequency" is shown on a person who has a frequency but is Unbound. The real reason is never given (`src/services/profile-metrics.ts:154-167`).

### N-10 — Archive with no confirmation; Systems builder "0 members"
- **Archive.** D-07 adds that Archive from the Profile gives no feedback and no Undo; the person just vanishes. H-18 and H-29 add that Restore and Bind are equally silent. H-19 adds that lifecycle actions are confirmed inconsistently, and that Bind and Unbind live in different places. The cross-cutting pass groups these under X-03, X-05 and X-23.
- **Systems "0 members".** Seen again in area K. Nothing new.

## 8. What could not be checked, and why

This section merges every area's "Could not check" section, with duplicates removed and items grouped by reason. Area letters are in brackets.

### It would need a clock change or a notification to fire (device clock is off limits)
- The weekly-digest notification tap → Digest [C].
- Compose opened from a reminder notification action [J], and the Profile opened from a notification [D].
- Digest empty states "You're all caught up", "Nothing on the horizon" and "A quiet week" [C]. These need every contact up to date and no activity this week, which means a clock change or mass edits. The wording was read in code (`UpNextSection.tsx:43`, `HorizonSection.tsx:69-72`, `YourWeekSection.tsx:339-342`) and reads fine.

### It would destroy required data, or needs a restore
- The Contacts first-run empty state ("Add your first contact") and "Everyone's tucked away" [A, E]. They need a database with no visible contacts.
- The Events tab empty state [B]. Checking it would mean deleting the three required group events. The copy was reviewed from code only (B-24).
- `RestoreResult` and the Replace confirm dialog [K]. Both need a completed restore. Area K used the owner-approved subset restore instead (K-18, K-19, K-20; K-22 is code-confirmed).
- Pressing Discard on the "Resume your check?" prompt [I]. It was not pressed, to keep an unfinished check session that was being kept on purpose.

### It would need a database failure (not reachable without changing code)
- "Couldn't load events", "Couldn't refresh this event" and write-error states [B].
- "Couldn't load your Digest", "Couldn't refresh Up Next and Horizon", "Couldn't load Your Week" and the day Retry [C].

### It would need an edit to the phone's Android Contacts (forbidden)
- Review flagged items with content [H]. No flagged items exist; creating one needs a new phone contact.

### Privacy: the phone's personal photo library, files and other apps
- Photo picking anywhere was not exercised:
  - "Use photo" on CropPhoto, and Add/Change photo on Edit Contact [E].
  - Photo-type custom fields; the Pet photo field was not filled [G].
  - Photo picking during lifecycle and import [H].
  - Background "Choose photo" [D].
  - Appearance → Your photo: Change photo; Remove photo would delete the owner's own photo [K].
- Image and file shares into Orbit [I]. Orbit registers text/plain only.
- AI Personalization Import .txt/.md and Replace from file [K]. These open a file picker.
- Backup Change folder and Open backup folder [K]. These open a file browser, and the folder must not change.
- Google Keep, Messages and other apps as share sources [I]. Chrome-side screenshots were not taken [I]: the system share sheet shows the owner's direct-share targets, and Incognito blocks screenshots.
- Sharing *selected* text from Chrome [I]. In Incognito the selection toolbar was not exposed to `uiautomator`, so text shares used synthetic intents instead.

### No real AI calls, and no network calls
- Draft with AI, Rewrite with AI and Adjust were not pressed [J].
- "Add to AI" toggles and the "Message focus" summary [J]. No item on the Zz UX contact is AI-eligible, and turning that on was not attempted.
- The Allow AI toggle with AI configured [G]. No provider may be connected.
- The `AIModelPicker` screen [K]. It fetches the model catalog from the network on open.
- In AI Settings, these were not pressed [K]: Connect with OpenRouter, Save key, Use saved connection, Remove key, Disconnect and Choose model. "Preview with contact" was not run to the end.
- "Paste image URL" → Add from URL [E]. Only the field was opened, because it needs a network fetch.

### No real calls or messages, and no synthetic contact with a usable phone number
- Call, Message and Email on a real-looking number were not pressed [D].
- The SMS handoff, the "This device can't send texts" helper and the "Which number/email should Orbit use?" picker [J]. No Zz UX contact has a phone the app treats as usable: Zz UX Full Profile's `555-0101` has 7 digits (D-08, E-06).
- Behaviour with Interaction Assist switched off [J]. Skipped to avoid more email handoffs.
- The J-07 physical recheck [J]. Waived because it needs two more email handoffs; J-07 is confirmed from code.

### App-wide or security settings that must not change
- "Clear global background" and "Clear category background" [D, K]. They change shared app-wide state, and the original assignment could not be reliably restored.
- Background template Save, Rename, Delete, Preview and Usage [D]. The template sheet was only browsed.
- Change encryption, I forgot my passphrase and Turn off encryption [K]. These touch passphrase rules. The passphrase was reset once during setup; see §9 (How the phone was left).
- The notification permission-denied flow [K]. Permission is already granted, and the system permission was not changed.

### adb and automation limits (a physical check is needed)
- The ⋯ menu items twice needed a second tap [A]. This may be an RN Modal plus adb issue, and it needs a physical check before it is called a bug.
- Undo on a single Quick Log [A]. The snackbar was gone before the adb tap arrived, both times. Area F later showed that the window is 6 s and that Undo is reachable (F-21).
- Whether the Add Note field opens the keyboard on a real tap [F]. Under adb the field was focused but the keyboard did not show.
- The physical feel of the 6 s snackbar window and the ~13 dp Year-heatmap dots [F].
- Drag-reorder for categories [G] and in Edit layout [D]. adb cannot do a long press followed by a drag. "Move earlier", Move up/down and custom-field Up were used instead.
- The physical Back gesture [J]. `keyevent 4` was used instead.
- `ImportProgress` content [H]. With 12 contacts it was replaced by Import complete in under 1 s.
- Linking a possible match to the correct existing contact [H]. The picker overflow in H-02 hid the candidates, so both the audit and the retest skipped instead.

### Automation artifacts, not findings
- Twice, `adb input text` sent while no field had focus reloaded the debug JS bundle; this is likely the dev "RR" key [F, G]. Only one unsent test note was lost.
- Stray input brought Google Clock to the foreground [A, G, H], and once the Camera [A]. Nothing was changed as far as the agents could tell; see §9 (How the phone was left).
- One unexplained exit to the launcher, after a Back press during heavy lag at ~1,016 contacts [A]. It was not reproduced in two attempts with the app idle. It is possibly A-X01 / A-X02 lag combined with A-09.

### Not set up, not tried, or seen only once
- The Birthdays population with content [A]. No contact had an upcoming birthday in range at the time.
- The birthday "Today" / "Tomorrow" tags [C]. Only the 3-days-out tag was seen.
- Long-name truncation on Digest rows [C]. No long-named contact was in those lists.
- Interaction sheet → "Edit Group Event" from the Edit chooser [B]. Seen but not followed; it is the same route as the ⋯ entry.
- Update Contact → Key people Delete and Off Limits Remove [E]. These were code-read, not pressed, to keep area G's fixtures (E-08).
- The Social battery dropdown options [E]. Not opened; it is the same native spinner as Category.
- Whether the Profile shows the key-person link after the contact is created [E] (E-14).
- Quick Log on an Unbound or archived contact [F].
- Contacts selection with exactly 1 contact → Log Interaction [F]. Per the code (`HomeScreen.tsx:1181-1186`), this opens `LogContact`.
- Compose from an Events-hosted Profile [J].
- Collapse-state persistence across an app relaunch [D].
- Swipe and long-press gestures on Things to Remember cards [G]. None are disclosed, and long-press was not tried.
- The Off Limits editor was looked at only lightly [G], because it is known item 999.3.
- `LegacyContactPicker` [H]. It cannot be reached from the UI, because legacy import mode is not exposed.
- D-35 was seen once during retest cleanup and not repeated [D]. H-01 later reproduced the same staleness 4/4.
- B-X01 (Events search race) reproduced in 1 of 4 attempts [B].
- A setup note did not reproduce [E]: "Relationship Basics tap after picking a category opens a date picker". There was no layout shift after picking a category.
- There is no "Recently Deleted" for contacts [H]. Permanent delete is immediate, and the existing Recently Deleted screen holds memories only (area G).

### Contact count
- All of area A ran on ~1,016 contacts, not the 100-contact subset used by every other area. Findings whose symptom could depend on list size are marked (A-01, A-08, A-23, A-34), and should be re-checked on the 100-contact set before they are fixed as pure UX. See also A-X01 / A-X02 in the non-UX report.

## 9. How the phone was left

Phone: Pixel 6 Pro `1A071FDEE002BU`, package `com.bwales.orbit`. The Pixel 3a (`943AY0JR4P`) was attached but never touched.

### Build and connection
- **Build.** A debug build of local `main` (HEAD `05b85252`) is installed and loads JS from Metro on host port 8082. It replaced the release build by `adb install -r` with data kept; both builds are signed with the same debug cert. The debug build shows an extra "Background failure test harness" row at the top of Settings.
- **adb reverse.** `adb reverse tcp:8081 tcp:8082` is **left in place**.
- **Where the app was left.** The last pass (K) left the app on the Settings hub.

### Settings
Every setting the passes changed was restored:
- **Appearance:** Galaxy / Dark / package-default accent / Deep Space, the same as before the audit. The Standard package's own remembered values are Dark / Default / Dusk; area K restored these last. Your name is empty (it shows "You"), and the star colour is back to 1.
- **Notifications:** master switch off (the phone's state before the audit); sub-switches and reminder time (9:00 AM) restored.
- **Interactions:** every option restored, including Calendar Week and Interaction Assist on.
- **AI:** Area K lists, under "settings changed and restored", "AI Enabled off → on" and "Allow AI for new Memories on → off". Its notes don't record the original values, so check these two if they matter. No provider was connected, and no key was entered.
- **Backup:** cadence 1 day and retention 7, unchanged; the folder is unchanged. Encryption is On with the new passphrase (below).
- **Contacts tab view:** card view, All Contacts, no filters, Sort Default, search closed and empty.

### Data: the phone runs on the 100-contact subset
- **What loaded.** On 2026-10-10 (owner-approved), the phone's 1,028 contacts were replaced with a 100-contact subset of the same data, using Settings → Data & Backup → Restore → Replace. The subset file is `untracked/artifacts/ux-audit/subset/orbit-subset-100.json`, and a copy with the same sha256 was pushed to the phone.
- **Contact counts.**
  - After the restore, All Contacts showed 88; 11 Unbound and 1 archived were hidden.
  - Audit data has since added two Unbound contacts and one tracked contact. The Unbound list now shows 13, and All Contacts shows 89 (seen by area J). Zz UX Share New is the extra tracked contact.
- **Before the subset.** Area A (and its retest) ran on the full data before the subset was loaded.

### `Zz UX` and test items created or changed, per area
These are all synthetic, all made through the app UI, and all are allowed to stay (it is a test phone).

- **Setup (before the subset):** Zz UX Full Profile and its fixtures, the five `Zz UX` custom fields and the category Zz UX Friends. These are carried into the subset. See `setup/SETUP-REPORT.md`.
- **A (full data, before the subset):**
  - Zz UX Full Profile got 2 extra Quick Logs: 2026-10-09 23:54 and about 2026-10-10 00:03. The full backup was taken at 00:39, so these are probably in the subset too. Not verified.
  - A snooze, a favourite and the bulk frequency were all net unchanged.
- **B:**
  - Three `Zz UX Event …` group events were created, then dissolved or deleted.
  - The audit left individual interactions behind: Zz UX Full Profile and History Unbound (Oct 10 2:05 AM, Call, 1 h 30 m), and Zz UX Full Profile (Oct 10 2:16 AM, In Person).
  - The B retest says it deleted "Zz UX Full Profile's two temporary interactions". It is not clear whether those are the audit's leftovers or the retest's own.
  - Synthetic group dinner was restored to its original state.
- **C:**
  - Zz UX Full Profile's **birthday is set to 2026-10-13 and cannot be cleared.** Edit Contact has no clear control (see E-03). It will show under Digest → Birthdays until that date passes.
  - Your Week period restored to Calendar Week.
- **D:**
  - Zz UX Full Profile → Last Talked About has an extra history entry, "Zz UX long text – their plans for a three month road trip…", under Previous. The current value is "Their trip to Lisbon" again.
  - Snooze, Unbind, frequency, Archive, favourite, layout and background were all restored. Edit Contact was saved twice with no changes.
- **E:**
  - Two new contacts, both Unbound:
    - **Zz UX Add Test** (phone "abc", email "notanemail", Uncategorized, Last spoke Today).
    - **Zz UX Maximiliana Alexandrina Konstantinopoulou-Vanderbilt Worthington the Third of Somewhere** (category Zz UX Friends).
  - Zz UX Full Profile: 2 extra Last-talked-about history entries (value restored); Zz UX Anniversary changed and restored to 2015-06-20.
- **F:**
  - All test interactions, the test group event and the bulk Quick Logs were deleted. The existing 12:03 AM interaction on Zz UX Full Profile was edited, then restored.
  - "Zz UX memo instead test" was left in Recently Deleted; area G later deleted it permanently.
  - Expanding and collapsing History on Zz UX Full Profile and Ximena Hargrove may have added the "Reset" entry to their ⋯ menu (D-25).
- **G:**
  - On Zz UX Full Profile: a memory "Zz UX G long memory – they told me about a very long story…" (link "not a url", meaningful date "banana") is left as evidence for G-14. Last Talked About history has an extra "Zz UX G topic" entry that cannot be deleted. "Met at the 2019 conference" has a new edited timestamp.
  - On Zz UX Add Test: memory "Zz UX G fab memory" is in its Recently Deleted.
  - Everything else was created and removed, or toggled and restored: custom fields, a category, key person "Zz UX G Linked Pal", pins, hidden state, Allow AI and the quarantine.
- **H:**
  - **Permanently deleted:** Zz UX H Archive, Zz UX H Recheck A and Zz UX H Recheck B.
  - **Zz UX Add Test** ends Unbound, at 30 days, not snoozed, with extra lifecycle history. **History Archived** was restored and re-archived; it is still the only archived contact.
  - **Import:** ZZ-UAT-B4b-Renamed was imported, then **merged into ZZ-UAT-Clean** (the survivor kept its name and phone; B4b's phone method and link moved over). ZZ-UAT-Ignore and ZZ-UAT-R3-Renamed were skipped. No import is pending.
  - **Check linked contacts:** **ZZ-UAT-Smoke-Ada now has two emails** (`zzuat.ada2@zzuat.test` was added by Apply). Other cards used Keep Orbit Values, with no data change.
  - Android Contacts were only read.
- **I:**
  - New contact **Zz UX Share New**, created through Capture → New contact and silently tracked every 30 days.
  - Shared items are saved as Off Limits ("fuel") rows with source `share`:
    - on Zz UX Full Profile: texts "two", "four", "five" (possibly "three"), a note on "five", and the example.com link;
    - on Zz UX Add Test: "multi", "back with note", "back with note 2", three `zz-ux-theme-*` URLs and "Zz UX recheck note share";
    - on Zz UX Share New: the long text and "multi".
  - None of these is visible in the app (known 999.5).
- **J:**
  - Five email handoffs to `zzux.full@example.com`; nothing was sent.
  - Two test interactions were logged, then deleted. No pending confirmations and no Compose draft are left.
- **K:** a test System was created, then deleted; a builder draft was discarded. Nothing is left.

**"Resume your check?" session.**
- The orchestrator's note says area H left an unresolved Check linked contacts session. The area files show it was later cleared:
  - H's retest discarded that session, then completed two new ones.
  - I's retest started session 10 and left it pending.
  - J's audit discarded session 10 at launch.
- Nothing later records a new session, so **none should be pending**. This was not re-checked after area J.

### Backups and the passphrase
- **The backup passphrase is now `orbit-ux-test-2026`.** At setup it was reset in Settings → Data & Backup → Encryption → I forgot my passphrase. The old passphrase is still unknown.
- **Full data, 1,028 contacts** (taken 2026-10-10 00:39 CDT, before passes B–K):
  - Phone: `/sdcard/Documents/Orbit backups/orbit-backup-1791610749112.json` (9,114,751 B).
  - Local: `untracked/artifacts/ux-audit/baseline/orbit-backup-1791610749112.json`.
  - The sha256 matches on both: `e2c2e055…60ac05b1`.
  - It is encrypted with `orbit-ux-test-2026`. The app does not prune it, because it is not named `orbit-auto-*`.
- **Full data, the app's own pre-restore safety backup** (written just before the subset Replace): `/sdcard/Documents/Orbit backups/orbit-auto-2026-10-10T06-47-00-060Z.json` (sha256 `f44dc235…`). It was written after the passphrase reset, so it should use the new passphrase; this was not tested. The app may prune it like any other `orbit-auto-*` file.
- **Subset, 100 contacts:** `untracked/artifacts/ux-audit/subset/orbit-subset-100.json`, plus the copy on the phone. Encrypted with `orbit-ux-test-2026`.
- **Older automatic backups** (`orbit-auto-…` from 10-03, 10-04, 10-09 and 10-10T03-43) use the old, unknown passphrase.
- **Raw database copies** can be restored only by file copy, not through the app:
  - `untracked/artifacts/ux-audit/baseline/orbit.db{,-wal,-shm}`: pre-audit data.
  - `untracked/artifacts/ux-audit/subset/pre-replace-db/orbit.db{,-wal,-shm}`: full data just before the subset Replace.

### Loading the full 1,028-contact backup back
1. In Orbit, go to Settings → Data & Backup → Restore a backup. Pick `orbit-backup-1791610749112.json` and enter `orbit-ux-test-2026`.
2. Check the preview. It must read **Contacts 1028**. The subset shows the same "Source date: Oct 10, 2026, 12:39 AM", so the count is the only way to tell them apart on screen.
3. Tap the **Replace** card. The button changes from "Merge backup" to "Replace and restore". Confirm "Replace and restore".
4. **Use Replace only, never Merge.** The subset Replace wrote a tombstone, dated with the subset's export time, for every removed row. Merge would let those tombstones win, and the ~928 removed contacts would not come back. Replace clears tombstones whose rows come back.
5. Expect the following:
   - Replace first writes and checks a safety backup of the current (subset) data.
   - The last restore took about 7–8 minutes with only "Restoring backup…" on screen.
   - The result screen says "Deletions applied: 0" even though rows are removed (K-19).
   - Everything created on the subset during passes B–K is removed. That includes Zz UX Share New, Zz UX Add Test and the shared items.
6. **Re-mark favourites by hand.** Favourites are not part of the backup format (K-22), so any Replace leaves everyone unfavourited. Before the audit they were Andrew Wales, Joyce Milligan, UAT-Row-02 and `UAT test%20Row%201`. Their earlier order was not recorded.

### Checks the owner asked for
- **Clock alarms.** Stray adb input brought Google Clock to the front in areas A, G and H.
  - A: only the Stopwatch, Bedtime and Alarms tabs were viewed (`A-contacts/98-clock-alarms-state-after-stray-taps.png`).
  - G: nothing was tapped.
  - H: one tap switched to the Bedtime tab.
  - A and G both saw the alarms as disabled (G: 4 alarms). Neither could tell whether that was their state beforehand. Please check your alarms. Area A also opened the Camera once; no photo was taken.
- **Gmail drafts.** Up to 2 drafts with the body "Zz UX J transmit test", addressed to `zzux.full@example.com`, may be in the phone's Gmail account (area J handoffs, backed out, nothing sent). The three empty-body handoffs were probably discarded by Gmail.
- **Privacy screenshots for you to delete.** They were never opened or cited by the report; the agents never delete under `untracked/`.
  - `untracked/artifacts/ux-audit/E-add-edit-update/69-photo-source-picker.png`: personal photos.
  - `untracked/artifacts/ux-audit/E-add-edit-update/70-crop-photo.png`: personal photo.
  - `untracked/artifacts/ux-audit/E-add-edit-update/71-crop-screen.png`: shows a vehicle registration. (The matching `71-crop-screen.xml` dump was checked: it holds only the UI labels "Position photo", "Cancel" and "Use photo".)
  - `untracked/artifacts/ux-audit/I-sharing/02-after-back-from-capture.png`: your launcher home screen, with a calendar event and app icons.
- **Plaintext backups for you to delete when done.** These hold unencrypted contact data:
  - `untracked/artifacts/ux-audit/subset/full-decrypted.json` (all 1,028 contacts).
  - `untracked/artifacts/ux-audit/subset/subset-plain.json`.

### Other notes
- **Two files were deleted under `untracked/`, against the never-delete rule; each agent reported its own slip.** Area A's audit deleted a mislabelled Camera-viewfinder screenshot before re-taking it. Area B's retest deleted its own scratch dump (`retest/x.png` / `x.xml`). Nothing else was removed.
- **Mislabelled screenshots:**
  - `F-logging-history/146-standard-light-*.png` actually show Standard **dark**. The correct copies are `146b-…` and `147-standard-light-real-*`.
  - `J-compose/57-standard-light-*` are duplicates of Standard Dark. Use `57-standard-light2-*`.
