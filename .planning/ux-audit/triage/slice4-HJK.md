# Slice 4: H (People lifecycle and import), J (Compose and confirmations), K (Settings) vs Phase 39

Baseline: `.planning/phases/39-onboarding/39-CONTEXT.md` (D-01..D-93). Code read at HEAD d148ed47 (`src` is unchanged since the audit commit 05b85252). Read-only. Labels used below: **[audit]** = the audit's claim, **[code]** = what I checked in the source, **[inf]** = my own inference.

**Findings: 91** (H 29, J 18, K 44).
**By class:** A 2 · B 2 · C 8 · D 7 · E 72.
**Tags:**
- fix: QW 25 · NI 65 · both 1 · none 0
- owner-call Y: 10
- reversal Y or suspected: 7
- backlog overlap: 4 (999.3 ×2, 999.4 ×2)
- p40: 3
- High findings verified: 4/4 (H-01, H-02, J-01 and K-22 all CONFIRMED). One sub-claim REFUTED (H-14, frequency).

## Table

| id | sev | class | D-IDs | tags | one-line why |
|---|---|---|---|---|---|
| H-01 | High | E | D-30 | QW; X-10,X-03,X-04 | Archive and Restore are not taught. CONFIRMED: mount-only load at `ArchivedContactsScreen.tsx:121-123`, and the catch blocks don't reload (:134-137, :189-192). |
| H-02 | High | D | D-75, D-06 | QW; X-32,X-33,X-31 | D-75's tap opens Link to Existing / Import as New / Skip. Link to Existing opens this broken sheet, so a D-75 fix would lead straight into it. CONFIRMED: `ExistingContactChoice.tsx:40-92` has no ScrollView and no Cancel. |
| H-03 | Med | D | D-75, D-06 | NI; X-42,X-35 | The no-op tap is D-75 itself. Showing the matched Orbit name on each card is new scope for the same plan. |
| H-04 | Med | E | D-30 | QW; X-36 | Reconciliation is not taught. |
| H-05 | Med | E | D-30 | NI; X-10 | Same. |
| H-06 | Med | E | D-30 | both; X-18 | Same. |
| H-07 | Med | E | D-30 | NI; X-05,X-34 | Same. |
| H-08 | Med | E | (D-61 gap) | NI; X-26,X-08 | Header styles. First-run import needs a defined cancel path back to Acquire (see Gaps). |
| H-09 | Med | E | D-30 | NI; X-23 | Merge is not taught. Adding the Profile entry **enforces** a recorded decision (20-dossier Cluster U :375-379, [DECIDED] merge from the profile overflow); it does not reverse one. |
| H-10 | Med | E | D-30 | NI; 999.3; X-37,X-17 | "fuel items" wording. |
| H-11 | Med | E | D-30 | NI; X-33,X-25 | |
| H-12 | Med | E | (D-86 note) | NI; X-07 | Settings flows end on the Contacts tab. A fix must leave room for D-86 (a first-run import lands on Digest). |
| H-13 | Med | E | — | NI; X-22 | An already-linked contact can't occur on a fresh install. |
| H-14 | Med | C | D-52, D-05 | NI; reversal suspected (38.4-CONTEXT D-57 put Unbound first on bulk); X-22,X-11 | The D-52 lesson teaches the participation step on both import screens, which order the choices oppositely (`ImportReviewScreen.tsx:442` Bound first; `BulkImportSetupScreen.tsx:68-71` Unbound first). Sub-claim "no frequency" REFUTED: a FrequencyPicker shows when Bound is selected (`ImportReviewScreen.tsx:536-541`, `BulkImportSetupScreen.tsx:543-548`). |
| H-15 | Low | E | (D-86) | NI; X-41 | ImportComplete is reached in first run (see Gaps). |
| H-16 | Med | E | (D-61 gap) | NI; X-28 | The resume-import prompt and D-61's relaunch-at-Acquire are unordered (see Gaps). |
| H-17 | Med | E | D-30 | NI; X-03,X-35 | |
| H-18 | Med | E | D-30 | NI; X-05,X-23 | |
| H-19 | Med | E | D-30 | NI; owner-call; X-03,X-04,X-23 | The confirmation rule is a product call. Unconfirmed Archive is N-10, which is out of 39 scope. |
| H-20 | Med | E | D-30 | NI; owner-call; reversal suspected (ADR-062 keeps data through Unbind) if the chosen fix is "clear the favourite"; X-23 | |
| H-21 | Low | E | D-30 | NI; X-20,X-23 | |
| H-22 | Med | E | D-30 | NI; X-20 | |
| H-23 | Med | E | (D-14 gap) | QW; X-10,X-08 | Same cause as D-02. The extra pushed Profile can confound Prepare's "normal Profile visit" detection (see Gaps). |
| H-24 | Low | E | D-30 | NI; X-23 | |
| H-25 | Low | E | D-30 | NI; 999.3; X-17,X-36 | |
| H-26 | Low | C | D-52, D-65, D-91 | QW; X-23,X-36 | Adapted Orient explains Unbound, and D-91 keeps "your active orbit" literal. Settings uses near-identical wording for Archived, so the lesson copy must not collide with it. |
| H-27 | Low | E | — | NI; X-09,X-35 | |
| H-28 | Low | E | D-30 | NI; X-13,X-14,X-37,X-38 | |
| H-29 | Low | E | (D-52) | NI; reversal suspected (ADR-062 dormant cadence) only if the fix clears it; X-05,X-11 | The adapted-Orient "start tracking" path (never-bound person: chips + Bind) works. The flaw is only on re-bind. |
| J-01 | High | **A** | D-15 | QW; X-18 | Reach Out teaches Copy vs Transmit. Compose shows text mode and then emails. CONFIRMED (detail below). |
| J-02 | Med | D | D-76 | NI; X-05 | No feedback after Yes, and the banner doesn't say which handoff it is about. |
| J-03 | Med | D | D-76 | NI; owner-call (ambiguity in "like today"); p40 (40-CONTEXT D-01 lifecycle heuristics); X-10 | D-76: "Later keeps it pending, like today's 'Not yet'". Today that means it is invisible until relaunch (15 s eligibility, no refresh). |
| J-04 | Med | E | (D-15) | NI; X-01 | D-15's "consult Things to Remember without losing the draft" still holds. The loss happens only when you open another person's Compose. |
| J-05 | Med | D | D-76, D-44 | NI; owner-call; reversal suspected: "log email as email" vs D-44 / phase-13 dossier :692-694 (Message covers text and email); X-24,X-28 | The mirrored buttons fold into D-76's one-answer model. The channel half is not a bug under D-44. |
| J-06 | Med | D | D-76 | NI; X-03,X-05,X-32 | D-76 keeps this sheet. Rows that look identical are the same "which handoff" gap as J-02. |
| J-07 | Med | E | — | NI; X-01,X-30 | |
| J-08 | Med | D | D-76, D-15 | NI; X-31,X-32 | D-76 already skips the panel's record on the banner. Older records still push Copy/Transmit, the Reach Out spotlight targets, into the gesture bar. |
| J-09 | Med | E | (D-15, D-14) | QW; X-15,X-17,X-36 | Reach Out points at this page. Recommended pre-39 quick win, but the taught behaviour works. |
| J-10 | Low | E | — | NI; X-14,X-19 | |
| J-11 | Low | E | (D-15) | QW; X-06,X-26,X-40 | Tabs and + on ComposeResearch. The draft survives, so the D-15 claim stays true. |
| J-12 | Low | E | — | NI; X-40 | |
| J-13 | Low | E | (D-76) | QW; X-05 | Transmit on an empty body creates an assist. |
| J-14 | Low | E | — | NI; X-05 | |
| J-15 | Low | E | (D-15 gap) | NI; X-18 | First-run manual people often have only a name, so the first Compose has no destination (see Gaps). |
| J-16 | Low | E | — | NI; X-31 | |
| J-17 | Low | E | — | QW; p40 partial; X-38 | |
| J-18 | Low | C | D-15 | QW; owner-call; **reversal Y**: phase-14 dossier :156 [DECIDED] "labeled Transmit" (D-14-031); "Interaction Assist" rename suspected vs 21 dossier; X-36 | D-15 copy names "Transmit". A rename changes the lesson copy. |
| K-01 | Med | E | (D-28) | QW; X-34 | The lesson fires on enabling. The master description disappears when the master turns on (:266), so the page shifts at the trigger: anchor after layout settles. |
| K-02 | Med | E | — | QW; X-34 | |
| K-03 | Med | E | — | NI | |
| K-04 | Med | C | D-92 | NI; X-26 | Header standard for the new Tutorials screen: hub children use `ShellAppBar` (variant child). |
| K-05 | Med | C | D-92 | NI; X-34,X-35 | Row standard for the D-92 hub row (icon, title, subtitle, chevron; `settings-hub-model.ts:88-162`) and for the Tutorials screen. |
| K-06 | Med | E | (D-92) | NI; X-01,X-02,X-05 | The Tutorials switch should save on change, like most of Settings. |
| K-07 | Med | E | (D-66) | QW | The Systems tip says "make your own in Manage Systems", and the builder is flawed (see D-02 check). |
| K-08 | Med | E | (D-66) | NI; X-29 | |
| K-09 | Med | E | (D-66) | NI; X-34,X-37 | |
| K-10 | Med | E | (D-66) | NI; X-03,X-04,X-35 | |
| K-11 | Med | E | — | QW; X-09,X-30,X-41 | Phone region feeds phone actionability (`SettingsContactsScreen.tsx:128`), which widens J-01. |
| K-12 | Med | E | D-30 | QW | |
| K-13 | Med | E | D-30, D-73 | NI | |
| K-14 | Med | E | D-30 | QW; X-03,X-04 | |
| K-15 | Med | E | D-30, D-63 | QW; X-14 | A first-run restorer picks the file by these names. |
| K-16 | Med | E | D-30, D-63 | NI | |
| K-17 | Med | E | D-30, D-63 | QW; X-37 | |
| K-18 | Med | E | D-30 | NI; X-03,X-04 | On an empty phone Replace removes nothing. |
| K-19 | Med | **B** | D-63, D-62 | NI; owner-call | The restore flow's only exit is "Return to Settings" / "Backup", which is wrong when entered from Acquire. |
| K-20 | Med | **B** | D-63, D-70 | NI; owner-call; X-06 | Restore routes are not focused routes, so the tab bar and + are live during a multi-minute restore in the middle of first run. |
| K-21 | Low | E | D-63 | NI; X-28,X-34 | |
| K-22 | High | E | D-63 (exposure), D-62 | NI; owner-call | CONFIRMED. Favourites are lost on every restore, including the new-phone scenario D-63 invites. A product/data call, not a lesson dependency. |
| K-23 | Low | E | — | QW; X-38 | |
| K-24 | Low | E | — | NI | |
| K-25 | Med | E | D-31, D-72 | NI; X-36 | |
| K-26 | Med | E | D-31 | NI | |
| K-27 | Med | E | — | NI; X-04,X-33 | |
| K-28 | Med | E | — | NI; p40 partial; X-34,X-39 | |
| K-29 | Med | E | (D-92) | QW; X-34 | The Tutorials on/off switch will inherit the `thumbColor={colors.surfaceElevated}` problem unless fixed. |
| K-30 | Med | E | (D-92, D-80) | NI; X-06 | Restart sits at the bottom of the Tutorials screen, and lesson cards point at targets: the + can cover both. |
| K-31 | Med | E | — | NI; X-02,X-05,X-30 | |
| K-32 | Low | C | D-34, D-16, D-44 | QW; owner-call (Text/Message half); reversal suspected for that half (D-44); X-36 | Record names Settings → Interactions and the right-swipe default. The setting is labelled "Dashboard right swipe", and the option "Log Contact" vs D-16's "Log Interaction" (`settings-interactions-logic.ts:49-52`, `SettingsInteractionsScreen.tsx:183-184`). |
| K-33 | Low | E | (D-12) | NI; X-36 | Orient teaches Your Week conceptually. No copy dependency. |
| K-34 | Low | C | D-28, D-52 | QW; owner-call; reversal suspected (Bound/Unbound is the product vocabulary D-52 teaches, ADR-062); X-23,X-36 | Notifications lesson vocabulary. Renaming "unbound" collides with the import step's Bound/Unbound. |
| K-35 | Med | C | D-20, D-69 | NI; X-38 | AI guided setup anchors on these rows: "AI Enabled" label; Writing Style and Personalization Context both open one page. |
| K-36 | Med | **A** | D-69, D-20 | NI; X-03 | Guided setup leads with "Connect with OpenRouter". Once connected, the primary still says Connect, and Choose model is a tertiary link next to a red Disconnect. CONFIRMED. |
| K-37 | Med | E | — | NI | Writing style is outside D-20 setup scope. |
| K-38 | Med | E | — | QW; X-27,X-35,X-42 | |
| K-39 | Low | E | — | NI | |
| K-40 | Low | E | (D-20) | NI; 999.4 (title literal); X-37 | |
| K-41 | Low | E | (D-88) | NI; 999.4; owner-call minor | About could echo Welcome's "stored on this phone" line. |
| K-42 | Low | E | D-31 | NI | |
| K-43 | Low | E | (D-66) | NI; X-36,X-37 | |
| K-44 | Low | E | — | QW | |

## Class A detail

**J-01: Compose looks like a text, and Transmit sends an email. It blocks Reach Out (D-15): the editor step, the Copy-vs-Transmit step, and the first-Transmit explanation.**
- **Verified, CONFIRMED [code]:**
  - The mode-switch label uses the session `mode` (`ComposeScreen.tsx:1340-1342`), and so does the Subject field (`:1271`).
  - `onTransmit` sends to `resolveUsableMode(mode, hasPhone, hasEmail)` (`:975-985`), with subject only on the email arm (`:1004`).
  - `resolveUsableMode` falls back from text to email when there is no actionable phone (`compose-logic.ts:173-185`).
  - No destination is rendered anywhere.
- **[inf] Reach:** wider than the audit's 7-digit case. Any contact with an email but no actionable phone, while the default mode is Text, gets a text-looking Compose that emails. Imported contacts are often email-only. Phone actionability also depends on the effective region (`phoneRegionOverride ?? getDeviceRegion()`, `SettingsContactsScreen.tsx:128`; K-11).
- **Why A:** under D-02 the lesson would point at an editor and a Transmit button whose channel the screen misstates. The truthful copy "hands the message to another Android app" would then be followed by "Did you email…?" for what looked like a text. Per D-03 the fix lands before Reach Out.
- **Minimal fix (audit QW, matches X-18):** compute `usable` once in render and drive the switch label and the Subject from it. Add a destination line such as "Email to x@y" above the action row.

**K-36: AI Connections shows no clear connected state. It blocks AI guided setup (D-20, D-69: lead with "Connect with OpenRouter", then model and validation).**
- **Verified, CONFIRMED [code]:** the primary label is "Connecting…" or "Connect with OpenRouter" and never reflects active (`AIConnectionScreen.tsx:362-371`). When connected, "Choose model" is `role="tertiary"` next to `role="destructive"` "Disconnect" (`:316-330`). The only connected cue is the card's accent top border plus an "Active" marker.
- **Why A (borderline):** the guided setup's "connected, now choose a model" step would have to explain away a primary button that still says Connect, and a model step that is the weakest control next to the loudest destructive one. That is teaching around confusing UX (D-02). The owner may downgrade it to C if the setup copy can carry it.
- **Minimal fix:** when the lane is active, show "Connected", make "Change model" the primary, demote Disconnect to secondary, and hide or relabel the Connect button.

## Class B detail

**K-19 + K-20: D-63 restore entry. "into the existing restore flow" does not fit as a first-run route.**
- **D-ID changed:** D-63 (and D-62's completion rule, which it feeds).
- **Proposed amendment (D-94+):** "A restore entered from Acquire runs as a focused first-run route (tab bar and + hidden, per D-70), blocks leaving while applying, and ends into first-run completion (Digest, plus whatever D-62's 'completes first run' means for Orient), not 'Return to Settings'. Restore stays untaught (D-30)."
- **Verification:**
  - K-20 CONFIRMED [code]: `Backup`, `RestorePreview` and `RestoreResult` are absent from `FOCUSED_WORKFLOW_ROUTES` (`focused-route-classification.ts:7-37`). `RestorePreviewScreen.tsx:186-191` blocks only stack removal (`beforeRemove`) while applying. Tab switches are not blocked [inf].
  - K-19 CONFIRMED [code]: `RestoreResultScreen.tsx:96-104` resets to `restoreReturnRouteName(host)`, which is only ever "Backup" or "Settings" (`backup-dualhome-logic.ts:29-33`).
  - The device run for K-19/K-20 was the audit's subset restore (RESTORE-REPORT), not re-run.
- **[inf] Ease:** an origin-aware `host` mechanism already exists, so a first-run host is cheap.
- **Recommendation:** approve. Also answer hidden owner call 1 (does Orient run after a first-run restore?).

## Class C/D detail

- **D: fold into D-75 (H-02, H-03).**
  - [code] Possible matches can occur in a fresh-install first-run import. Rows are scored one by one against `contacts`, which already holds earlier rows of the same batch (`import-driver.ts:203-239`). A single shared name token scores 20, above the possible threshold of 15 (`duplicate-evidence.ts:27-33, 119-131, 234-237`). So family members sharing a surname go to review. That matches H-02's "all 11 rows say Similar name".
  - So the D-75 plan should also take H-02's quick win (ScrollView, Cancel, sort phone/email matches first) and show the matched Orbit name (H-03), under D-03.
- **D: fold into D-76 (J-02, J-03, J-05, J-06, J-08).**
  - These are the one-asker plan's surfaces. Add a "Logged" snackbar on `performExit("logged")`, give each banner/sheet row a handoff time or preview, use one confirmation component (fixes the mirrored primary), and decide what happens to the banner on Compose.
  - J-03's 15 s window is a lifecycle heuristic owned by 40-CONTEXT D-01. D-76 already binds Phase 40.
  - J-05's channel half should not be "fixed" without the owner (D-44).
- **C: vocabulary and anchors.**
  - H-14: the import order flip. The lesson must not say "the first option".
  - H-26 and K-34: "outside your active orbit" and "unbound" wording vs the adapted-Orient and Notifications copy.
  - J-18: "Transmit" in D-15 copy (a recorded label).
  - K-32: setting and option names that Record (D-34) cites.
  - K-35: AI page row labels that guided setup cites.
- **C: Tutorials screen standards (D-92)** that K-04/K-05 say to match:
  - `ShellAppBar variant="child"` header, as Settings hub children use;
  - a hub row with icon, title, subtitle and chevron, placed above About;
  - a switch that saves on change (K-06);
  - a switch thumb that doesn't repeat K-29's `thumbColor={colors.surfaceElevated}`;
  - bottom clearance for the + (K-30).

## Hidden owner calls

1. **Does Orient run after a restore that completes first run (D-62)?** Where does that user land?
   - Rec: land on Digest and skip Orient. The restorer is a returning user.
2. **Should the possible-match review be part of first-run import** (it is reachable, see Class D), or does D-86's "finishing a first-run import lands on Digest" apply with matches still pending (ImportComplete shows "Need review (N)")?
   - Rec: land on Digest. Matches stay resumable from Settings, and D-11 already says a partial import is not completion.
3. **K-22: add favourites to the backup format (a format bump) before D-63 invites new-phone restores?**
   - Rec: yes, or at minimum state "favourites aren't included" on the backup page and the preview before 39 ships. Note that D-62 cites `BACKUP_FORMAT_VERSION = 7`; that citation goes stale if the format is bumped.
4. **J-18: rename "Transmit"?** This reverses phase-14 D-14-031.
   - Rec: keep "Transmit" for 39. Let the first-Transmit explanation (D-15) carry the meaning, and decide the rename separately.
5. **J-05 / K-32: should email-originated logs or settings say "Email" rather than "Message"?**
   - Rec: no. Keep D-44.
6. **K-34: rename "unbound" in Settings?**
   - Rec: no, while D-52 teaches Bound/Unbound by name. Rename "Decay reminders" only.
7. **J-03: should "Later" re-ask on the banner as soon as Compose closes** (D-76's "like today's Not yet" is ambiguous)?
   - Rec: yes. Make it eligible immediately, so a Later'd item stays findable.
8. **D-66 Systems tip:** it says "make your own in Manage Systems", which leads into a builder with the N-10 "0 members" bug (out of 39 scope), the planet over the form (K-07) and the off-screen error (K-08).
   - Rec: fix K-07 and K-08 (quick wins), and decide whether N-10 must land before the tip ships. Bringing N-10 back into scope is the owner's call.
9. **H-19 / H-20: one confirmation/undo rule for lifecycle actions, and favourites on Unbind.**
   - Not 39 work. Keep ADR-062 data retention.
10. **Notifications lesson on a permission denial:** fire it, or wait for a grant? (D-11 says denial is not a skip, but only for Import.)
    - Rec: fire only on a grant, and keep the lesson eligible after a denial.

## Suspected recorded-decision reversals

- J-18 "Transmit" → "Send": **reverses** phase-14 dossier :156 [DECIDED] (D-14-031). Verified by grep.
- J-05 "log email as email" and K-32's "Message" channel relabel: suspected reversal of D-44 / phase-13 dossier :692-694 (Message / Call / In Person vocabulary).
- K-34 "unbound" → "people you don't track": suspected collision with the Bound/Unbound product vocabulary (ADR-062; taught under D-52).
- H-14 aligning the import choice order to Bound-first: suspected vs 38.4-CONTEXT D-57 (bulk Unbound-first, per the comment at `BulkImportSetupScreen.tsx:68`). Aligning to Unbound-first is safe.
- H-20 "clear the favourite on Unbind": suspected vs ADR-062 (Unbind preserves the record and its configuration).
- H-29 any fix that clears the dormant cadence on re-bind: reverses ADR-062. Showing the reused frequency is fine.
- Not a reversal: H-09 implements 20-dossier Cluster U's [DECIDED] Profile-overflow merge entry, which is missing in the code.

## Gaps (39 triggers that depend on routes the audit did not verify)

1. **LegacyContactPicker is the import path for most real users, not dead code.**
   - [code] `contactImportMode()` returns "legacy" whenever `Build.VERSION.SDK_INT < 37` (`use-contact-import-mode.ts:6-8`; `OrbitContactPickerModule.kt:74-76`). The audit saw "system" only because the test phone is on SDK 37. The "no in-app way to switch" note is true but misleading.
   - So D-61's "denied permission returns to the choice" is mostly the LegacyContactPicker primer/denial path (`LegacyContactPickerScreen.tsx:200-215`: "Continue", then "Grant access", then "Open Settings" after repeated denials), and the 39-CONTEXT trigger table is right to cite it.
   - On SDK 37 the only permission ask is the post-pick READ_CONTACTS notes request, and a denial there just imports without notes (`start-contact-import.ts:17-25, 83-87`). That is not a D-61 "deny" at all.
   - The audit never exercised the legacy picker's UX, header, denial or cancel. It needs a device check on an SDK < 37 phone before the D-61/D-52 lesson is built. [inf] Planners should define "denied" separately for each mode.
2. **D-86 vs the import end screens:** ImportComplete Done, View contact (`ImportCompleteScreen.tsx:407-429`), and DuplicateReview exits all route to the Contacts tab (H-12). First-run import needs its own exit to Digest. ImportProgress content was never captured.
3. **D-61 vs ResumeImportPrompt** (`App.tsx:444`): on relaunch after a partial first-run import, the ordering of "resume at Acquire" vs "Resume your import?" is undefined, and D-58 blocks lessons while that dialog is open. Cancel/Back from ImportReview and BulkImportSetup → Acquire is unverified (H-08: several import screens have no Back).
4. **D-15 Reach Out on a no-destination Compose (J-15):** first-run manual people often have only a name (D-51), so Transmit is hidden (`compose-logic.ts:101-107`) and the Copy-vs-Transmit step has no Transmit to anchor on. The SMS handoff and the method picker were not audited at all (no usable phone fixture).
5. **D-14 Prepare detection vs H-23:** Edit → Save pushes a new Profile (`EditContactScreen.tsx:1068`). Unless D-02/H-23 lands first, the push can count as a "normal" Profile visit.
6. **D-28 / D-45 permission-denied flow:** not reached. [code] Denial keeps the master off and shows a degraded note (`SettingsNotificationsScreen.tsx:177-190`). This needs device verification.
7. **D-20 / D-21 AI:** AIModelPicker, the connect/validation flow and AI Compose were not exercised (network or real AI). The guided-setup steps after "Connect" are unverified on device.
8. **D-63 / D-62:** RestoreResult and the restore in progress come only from the earlier subset restore. A restore onto a fresh install (the D-63 case) was never run.
9. **D-02 check on the "not taught" calls (D-30, D-31):**
   - The findings do show confusing UX in every untaught area: Archive H-01/H-17/H-18; merge H-09/H-10/H-11 (merge is barely reachable); reconcile H-04..H-07; restore K-15..K-22; Settings navigation K-04/K-05/K-23.
   - D-30/D-31 don't paper over these; they just don't teach them. The exception is D-63, which deliberately routes first-run users into the untaught restore flow, so restore defects become first-run exposure (hence the B items and owner call 3).
