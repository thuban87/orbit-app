# Slice 5: Cross-cutting themes X-01..X-43, NON-UX findings, §5/§6 summary

Read-only triage at HEAD d148ed47. The unit is the **theme**. Baseline: `39-CONTEXT.md` D-01..D-93 plus the accepted mockup (D-74).
Sources: `untracked/artifacts/ux-audit/cross-cutting.md`. Report §4 (`UX-AUDIT-REPORT.md:3760-4497`) was diffed against it and is **byte-identical**. Also read: `NON-UX-FINDINGS.md` and report §5/§6/§7.
Labels used below:
- **[code]**: a fact I verified in the file.
- **[audit]**: a claim from the audit.
- **[inf]**: my own inference.
- **[rec]**: my recommendation. It is not a decision.

## Header

**Classes (one per theme):**

| Class | Count | Themes |
|---|---|---|
| A | 0 | none. X-18 (via J-01) is an A-candidate for D-15 and is recorded here as C. |
| B | 1 | X-34 (E-13 "Not yet" drawn as unselected, against D-50 and the mockup) |
| C | 22 | X-04, 05, 06, 07, 08, 09, 10, 15, 18, 21, 24, 26, 28, 31, 32, 36, 37, 38, 39, 40, 41, 43 |
| D | 7 | X-01, 11, 13, 22, 23, 29, 42 |
| E | 13 | X-02, 03, 12, 14, 16, 17, 19, 20, 25, 27, 30, 33, 35 |

**Tags:**
- Standard-setting: Y on 23 themes, plus 6 "lite" themes (one small shared helper).
- At least one member direction would reverse a recorded decision: 21 themes (listed in §7).
- Backlog overlap: 5 themes (X-12, X-15, X-17 → 999.3, 999.5, 999.6; X-36 and X-38 sit next to 999.4).
- Phase 40: Y on 1 (X-39). Partly Phase 40 on 3 (X-31, X-34, X-43). Non-UX A-X01 and A-X02 are Phase 40 perf by ownership, but see §5.

**Coverage:** the 43 themes cite about 269 distinct finding ids out of 297 findings. So a theme-based fix plan covers about 90% of the audit.
- §5 Quick wins: 122 findings. By area: A18 B11 C8 D10 E13 F16 G8 H6 I12 J6 K14.
- §6 Needs investigation: 175 findings. By area: A19 B13 C6 D21 E16 F12 G18 H24 I4 J12 K30.
- §6 names some owner calls itself: B-23, K-22, E-04.

**Theme-level verification of the High themes:**

| Theme | Finding | Result |
|---|---|---|
| X-01 | — | CONFIRMED. `src/navigation/discard-keep-guard.ts:29` uses `Alert.alert`. It has 6 consumers: SystemBuilder:279, EditInteraction:110, EditParticipant:71, EditContact:1103, GroupLog:72, EditGroupEvent:118. Create and LogInteraction have none. |
| X-04 | — | CONFIRMED. There are 102 `Alert.alert` calls in 37 files. |
| X-07 | — | CONFIRMED. `src/components/universal-fab-logic.ts:190,195,203` always targets `DashboardTab`. |
| X-09 | A-02 | CONFIRMED. `HomeScreen.tsx:675` has `useState(false)`, while the term lives in the in-memory session store (comment :666). |
| X-10 | H-01 | CONFIRMED. `ArchivedContactsScreen.tsx:121-123` loads in a mount-only `useEffect`. |
| X-10 | D-02 | CONFIRMED. `EditContactScreen.tsx:1068` calls `navigation.navigate("Profile")`. |
| X-15 | D-01 | CONFIRMED. `ContactProfileScreen.tsx` `routeKnowledgeAction` switches on `intent.target.owner` only and never reads `intent.action`. "pin"/"unpin"/"Hide from Profile" (`ThingsToRemember.tsx:105`) therefore just navigate to an editor. |
| X-18 | J-01 | CONFIRMED. `ComposeScreen.tsx:975-985` transmits via `resolveUsableMode` (`compose-logic.ts:173-185`), which falls back text→email while the UI keeps the session `mode`. |
| X-03 | B-07 | UNVERIFIED here (slice B). |

---

## 1. Theme table

Column key:
- **Std** = standard-setting (needs one shared component, rule or ADR).
- **Rev** = a likely recorded-decision reversal in the *audit's proposed direction*. "enf" = the direction enforces a recorded decision instead.
- **BL** = backlog overlap.

| X | Sev | Title (short) | n | Areas | Class vs 39 (D-IDs) | Std | Rev (suspected, cited) | BL | p40 |
|---|---|---|---|---|---|---|---|---|---|
| 01 | H | Back with unsaved input: some forms ask, ≥10 drop it | 10 | BEFGIJK | **D**: E-01 Add Contact folds into the D-50/51/87 Create plan. First-run Back Create→Acquire (D-61, D-70) must be designed with the guard. Rest E. | Y | enf phase-01 dossier §B "[DECIDED] Meaningful unsaved changes require … Discard changes / Keep editing". B-05 guarding participant edits collides with ADR-167 (rejected "Prompt save/discard before participant actions"). J-04 per-contact drafts touch ADR-133 (rejected *durable* per-contact drafts). | — | N |
| 02 | M | Immediate writes inside Save forms | 7 | BDEGK | E. G-14 is privacy-relevant: "Allow AI" survives Cancel. | Y (draft rule) | B-05 vs ADR-167 (participant writes commit on their own, by decision) | — | N |
| 03 | H | Destructive actions follow no rule | 16 | BDEGHJK | E. D-30 keeps these out of lessons. Note D-92 "Restart tutorials" needs a place in the rule (see §3). | Y (rule + ADR) | Recoverable interaction delete reverses phase-11 dossier :135/:728/:730 (irreversible hard delete, "no interaction Trash"). Key-person Recently Deleted extends ADR-089. Archive confirm is N-10 (ledger, deferred). B-07 missing confirm = enf phase-11 :730. | — | N |
| 04 | H | Two dialog systems (native vs themed) | 17 | ABDEGHK | **C**: the lesson card should share the ConfirmDialog surface and action row. D-58 cannot detect native Alerts. | Y | enf phase-02 dossier §O "[DECIDED] standardized through shared variants". Not a reversal of ADR-176, which only made native dialogs follow mode. B-19 "pick one button order" reverses ADR-174 (fit→row, else stack Cancel-first). | — | N |
| 05 | M | Feedback after actions mostly silent | 25 | ABDFGHIJK | **C**: D-16 "close the loop" copy; the intercept's "usual Logged snackbar follows"; D-92 Restart needs feedback. | Y | F-03 "stop remembering channel" reverses ADR-130 | — | N (A-X02 lag shrinks the 6 s window; test in list view) |
| 06 | M | + covers content / floats over overlays | 8 | ACDFGJK | **C**: the Tutorials screen (D-92) is FAB-bearing and needs `useBottomClearance`. Restore entered from Acquire (D-63) has a live FAB (K-20). | Y (FAB visibility classification) | Hiding the FAB on Settings reverses phase-01 §B ("visible: … ordinary Settings child pages"), §E, and ADR-173 (FAB screens = tab stacks minus focused routes). K-20 restore-as-focused = enf phase-01 §B. | — | N |
| 07 | H | + flows / flow ends land in the Contacts tab | 7 | BCDGHI | **C**: decides where Create is hosted for D-70/D-86 first run. Owner call. | Y (cross-tab entry rule) | "Return to origin after save" for Add Contact reverses phase-01 §D ("Add Contact completed → newly created contact Profile") and phase-13 :607 (D-86 amends first run only). C-03 reverses ADR-147. Back before save → origin = enf phase-01 §C. | — | N |
| 08 | M | Back doesn't close the innermost thing | 16 | ABCDEGHIJ | **C**: lesson-card Back vs Android Back. C-01 `backBehavior="history"` would record Orient's programmatic tab switches (D-12/D-68). | Y | enf phase-01 §C "[DECIDED] Back dismisses the topmost transient layer" and "Android system Back and visible app Back have identical logical results" | — | N |
| 09 | H | Search/filter persists invisibly | 16 | ABCFHIK | **C**: Orient Contacts step (frame 05: "Population Active Cont…", "Everyone's tucked away", D-81). It becomes **B** for D-12/D-81 if the owner makes "none selected" = All Contacts. | Y (reset rule) | A-02 fix = enf ADR-092 (search memory-only, a fresh launch is cleared). A-04 "none = All Contacts" reverses ADR-093 ("Empty population selection means … Active Contacts"; rejected including never-contacted). C-03 temporary view reverses ADR-147. B-X01 = enf ADR-162. | — | N |
| 10 | H | Stale lists / stacks | 9 | ABDEHJ | **C**: D-14 "normal Profile visit" detection must cope with the extra Profile pushed after an Edit save (D-02) until D-02 is fixed. | Y (focus-reload + replace-after-save) | enf phase-01 §C "Completed workflows must be removed/replaced … Profile → Edit → Save → Profile → Back → Edit must not occur" | — | N |
| 11 | M | Five frequency editors | 11 | ADEGHIJ | **D**: E-05 folds into D-51 (audit agrees). I-06's silent 30 days should share D-51's default constant. | N | none | — | N |
| 12 | M | Last talked about / location models | 6 | ADEG | E (D-25) | N | An "overwrite" model reverses ADR-088 (current-state entries retain history) | 999.3 | N |
| 13 | M | Dates: picker vs text, future then reject | 9 | BDEFGH | **D**: E-12 (`maximumDate` on TriStateLastSpoke) folds into the D-50 plan, same control | lite | none | — | N |
| 14 | M | Raw ISO dates | 8 | CDEGHJK | E | Y (one formatter in `utils/dates.ts`) | none | — | N |
| 15 | H | Memories: 3 lists, 3 editors, dead Profile buttons | 14 | DEFGJ | **C**: Prepare D-14, Memory D-23 and D-93 sharing use the TTR section names. D-93 waits on 999.5. | N (area) | none found | 999.3/.5/.6 | N |
| 16 | M | Key people: link unnamed, delete differs | 10 | DEG | E (D-25) | N | key-person Recently Deleted extends ADR-089 | — | N |
| 17 | M | Off Limits: 4 names | 9 | ADEGHJ | E (D-25) | N | none. The Update editor as the single editor is 999.3. | 999.3 | N |
| 18 | H | Contact-method usability judged inconsistently | 7 | DEHJ | **C** (A-candidate): J-01. The D-15 first-Transmit explanation would sit on a screen that hides where the message goes. | N | Removing the email fallback would reverse ADR-133 / phase-14 :134. The fix must *show* the destination, not remove the fallback. | — | N |
| 19 | M | Custom fields raw / free-text | 11 | DEGJ | E (D-25) | N | none | — | N |
| 20 | M | Snooze ×3, Mute hidden | 7 | ADH | E (D-30) | N | none | — | N |
| 21 | L | Category & photo editors | 6 | AEH | **C / Gap**: D-24 lists "CategoryChoiceSheet in Create/Edit" as a trigger. It renders only when categories > 12 (`category-logic.ts:4`, `CreateContactScreen.tsx:460`); a fresh install seeds 4 (`001-initial.ts:197`), so a native Picker shows instead. | N | photo on Add vs ADR-131 progressive create (suspected) | — | N |
| 22 | M | Five create paths, five forms | 11 | DEHI | **D**: E-05, E-13 and E-20 fold into the D-50/51/87 plan (E-13 is the B item under X-34) | N | "Add = Edit form in new mode" (E-04) reverses ADR-131 / ADR-016 and phase-13 §D progressive creation (just amended by D-87) | — | N |
| 23 | M | Profile ignores Archived/Unbound; lifecycle placement | 14 | DHK | **D**: D-09 ("Not tracked" while Unbound) is the same branch as D-77 (`profile-metrics.ts:154-167`). Fix both in one change. | lite | Moving Unbind out of ⋯ reverses ADR-150 ("Unbind moves … to the confirmed Profile overflow action") | — | N |
| 24 | M | Logging: 3 forms, 4 Quick Log variants | 13 | ABFJ | **C**: D-16 Record copy, D-26 Group Log, the intercept's "saves a Message with Maya", F-05 bulk label | N | F-03 vs ADR-130. J-05 "email logged as Message" is ADR-116 + D-44 (decided mapping). ADR-132 rejects merging forms; unifying presentation is fine. | — | N |
| 25 | M | Forms don't name the person | 8 | ADEFGHI | E | Y (person-scoped header rule) | none | — | N |
| 26 | M | ≥8 header/Back styles | 14 | BDEFGHIJK | **C**: Welcome/Acquire (D-70) and Tutorials (D-92) must use one header standard. Mockup frames 02/03 draw plain "Back". | Y | enf phase-01 §I and ADR-175. `settings-chrome-contract.test.ts` `HEADERLESS_SCREENS_KEEPING_IN_BODY_BACK` (21 screens) is a regression guard, not a decision, but it must be updated in the same plan. | — | N |
| 27 | L | ⋯ menus: one item / hide primaries | 7 | ABDFGK | E | lite | none | — | N |
| 28 | M | Save/Cancel/Close wording & placement | 18 | ABDEFGHJK | **C**: lesson button order (Skip · Back · Next, primary on the right) and the D-76 answer-set order must follow the same rule | Y | none. D-76 labels are owner-ruled; their order is not. | — | N |
| 29 | M | Validation silent / off-screen | 11 | AEFGK | **D**: E-02 / E-X01 blocked Save on Add Contact fold into the D-87 Create plan (same file, same function) | Y | none | — | N |
| 30 | M | Keyboard covers field/sheet | 7 | ABFIJK | E | Y (shared Sheet/scroll keyboard behaviour; extends ADR-174) | none | — | N |
| 31 | L | Primary actions in gesture bar / below fold | 11 | BDFGHIJ | **C**: the lesson card must respect the bottom inset ("grows upward", mockup Part 3) | Y (safe-area rule) | none | — | partial |
| 32 | M | Sheet/dialog sizes & close affordances | 10 | ABDFHJK | **C**: the lesson card is a 5th overlay variant under phase-02 §O | Y | "Expanded Sheet scrolls by default" revisits the ADR-174 / Sheet.tsx contract (consumers own scroll); minor, suspected | — | N |
| 33 | M | Six contact pickers | 8 | ABEHIK | E | Y | enf phase-01 §G "[DECIDED] one reusable canonical contact-picker" | — | N |
| 34 | M | Selected/disabled/on-off drawn differently | 18 | ACDEGHIK | **B**: E-13. "Not yet" is muted by design (`TriStateLastSpoke.tsx:10-12,103-109`; 34-UI-SPEC:115; pre-release audit DOMAIN-AUDIT:258 "preserve"). D-50 makes it the default, so the new form shows nothing selected. The accepted mockup draws it `class="solid"` (mockup:372). Also: frame-03 frequency chip outline vs an accent-fill standard, and K-29 switch tokens for the D-92 switch. | Y (tokens) | Selecting "Not yet" visibly reverses the 34-UI-SPEC:115 visual spec | — | partial (contrast) |
| 35 | L | List rows & list management | 13 | ACGHIK | E | lite | none | — | N |
| 36 | M | Same concept, different words | 32 | ABCDEFGHJK | **C**: see §2 | Y (glossary) | several renames reverse decided terms (§2) | 999.4-adj | N |
| 37 | M | Developer vocabulary shown to users | 23 | ABCDEFGHK | **C**: frame 03 Bound/Unbound/Orbit participation/cadence; D-52; D-65 status names | Y (glossary) | Bound/Unbound: dossier 18 :18. Dissolve: phase-12 :374. Rogue/Wobbly: phase-07 :99, ADR-026. | — | N |
| 38 | L | Menu label ≠ destination title; casing; plurals | 13 | ABDEGHJK | **C**: + "Add Contact" opens "New contact" (mockup frame 03 title) | Y | none | 999.4-adj | N |
| 39 | L | Screen-reader labels lose names/state | 10 | ABCDEFGIK | **C**: D-32 needs card text that names targets. "rogue status" / "Wobbling" labels sit under Orient. | Y | none | — | **Y** (40 a11y audit); cheap fixes earlier |
| 40 | L | Background art differs on siblings | 7 | BDFJK | **C** (minor): Welcome/Acquire art per ADR-114/115/177 | lite | enf the art-treatment ADRs | — | N |
| 41 | M | Empty states inconsistent | 16 | ABDGHIJK | **C**: Orient tours empty states ("You're all caught up", "Everyone's tucked away", "A quiet week"); adapted Orient D-52 | Y | enf phase-02 "[DECIDED] Routine empty states use icon + concise copy + CTA" | — | N |
| 42 | L | Gesture-only actions | 5 | AHIK | **D**: H-03 is D-75's territory. A-36 swipe is taught by D-71. | Y (rule) | A permanent visible in-list gesture hint reverses D-48 / phase-06 :350 | — | N |
| 43 | L | Heatmaps unlabelled / days inert | 6 | CDF | **C**: D-67's hint stays true (History). The Digest Your Week day panel behaves differently. | lite | heatmap ADRs 120/152/174 govern | — | partial (40 D-01 yearly heatmap) |

---

## 2. Glossary (X-36 / X-37) vs Phase 39 copy

Terms come from 39-CONTEXT D-09..D-93 and the mockup text (tags stripped with python).

| Term family | Phase 39 copy uses | What the audit asks | Recorded status | Lesson impact |
|---|---|---|---|---|
| **Never contacted** | Frame 04 "Never Contacted" (Horizon) and "people you haven't contacted yet"; frame 05 "1 not yet contacted →" and "New people wait under **Not yet contacted**"; frame C "Not Contacted — 0" (System); D-77 adds a new Orbit Status label | C-11: pick one term ("Not contacted yet" suggested) | phase-38 dossier :72 "[DECIDED] subgroups are … **Never Contacted**". Code: `control-labels.ts:12` "Not Contacted"; `status-display-label.ts:17` "Not yet contacted". | **Must settle before Orient copy and D-77 copy.** The mockup reproduces all three names. [rec] "Never Contacted" everywhere. That enforces phase-38 :72 and is a planner call. "Not contacted yet" would rename a decided label: owner. |
| **Status names** | D-65 "solid Stable, dashed Wobble, faded Decay". Mockup "Stable / Wobbly / Decaying". Cards and a11y say "Wobbling" (`status-display-label.ts:9`, `ContactCard.tsx:84`); Profile says "Wobbly" (`profile-metrics.ts:105`). | X-37 lists Rogue/Wobbling/decay as jargon. C-12 wants a11y labels as plain phrases. A-19 wants a legend. | phase-07 dossier :99 "Stable/Wobbly/Decaying/Rogue"; ADR-026 rogue | Unify to **Wobbly** (enforcement). Renaming the statuses themselves reverses phase-07/ADR-026 and rewrites D-65: owner. |
| **Bound / Unbound / Orbit participation / cadence / active orbit** | Frame 03 field "Orbit participation: Bound / Unbound"; caption "…appear in your active orbit and receive cadence reminders"; card "New people start as Bound"; D-52 import "participation (Bound/Unbound) step"; adapted Orient "explains Unbound" | E-23: plain words ("Remind me to keep in touch: Yes / No"). H-26/K-34: "active orbit" means both Archived and Unbound. | dossier 18 :18 "[DECIDED] Working user-facing lifecycle terminology is Bound / Unbound". D-91 lists "Orbit participation" and "your active orbit" as terms lesson copy keeps literal. | **Owner call before frame 03 / D-52 copy.** Renaming Bound/Unbound reverses dossier 18 :18 and reworks D-91's list. "cadence" in the caption is uncontested copy (rename freely). Fixing "active orbit" for Archived (H-26) is cheap and does not touch the lessons. |
| **Logging verbs** | D-16/D-17/D-53 "Quick Log", "Log Interaction", "Group Log"; intercept "Quick Log saves right away… use Log Interaction"; D-34 "Settings → Interactions" | K-32: swipe option "Log Contact" → "Log Interaction". F-05: bulk "Log Interaction" (2+) opens Group Log. B-12: one noun "Event", one verb "Log event". | ADR-132 names "Log Interaction"; phase-01 :34 and phase-12 :165 decided "Group Log" | "Log Contact" → "Log Interaction" is enforcement and must land before D-34 copy points users at that setting. Renaming "Group Log" (B-12) reverses phase-01/12 and renames D-26 / D-17: owner. |
| **Events / Group Event** | D-26 "one shared event"; Orient tab bar "Events" | B-12, F-20 ("group interaction" vs "group event") | EVENTS constant (`product-labels.ts`); phase-38 tab | D-26 copy should say "event" whatever is chosen. The wording waits on B-12. |
| **Memory / Things to Remember** | D-14 Prepare "Things to Remember (knowledge vs interactions)"; D-23 "a Memory … shown in Things to Remember"; + label "Memory" | G-23: section labels "Memories" vs "Memory", "Pinned / Featured" vs "Featured & current". The audit does **not** ask to rename the + action or the section. | phase-14 :250 "Things to Remember" decided. The + "Memory" was a working title (phase-01 §F). | Low risk. Only section-label unification, which Prepare step copy may quote. D-93 waits on 999.5 regardless. |
| **Favourite spelling** | Frame C System "Favorites — 1"; D-30 does not teach the star | A-15 / D-30 / K-43: one spelling (match `POPULATION_LABELS` "Favourite") | No recorded spelling decision found (grep docs/dossier, docs/decisions, HANDOFF) | Taste call, cheap. Affects only the Systems tip (D-66). |
| **Transmit** | D-15 "Copy versus Transmit; on first Transmit…" | J-18: rename to "Send" / "Open in Messages" | phase-14 :156 "[DECIDED] … labeled **Transmit**" (and :158 meaning) | Renaming reverses phase-14 and rewrites the D-15 trigger copy: owner. [rec] keep "Transmit"; the D-15 lesson exists to explain it. |
| **"Did you send it?" / Interaction Assist** | D-76 "Did you send it?" answers | J-18: setting name "Interaction Assist" → "Ask if I sent it" | dossier 21 :171 "global Interaction Assist toggle" (feature name) | No lesson uses "Interaction Assist", so no impact on 39. A settings rename is a mild reversal (suspected). |
| **Channels** | D-44 Message / Call / In Person; intercept "saves a Message" | K-32: Compose mode "Text" vs channel "Message". J-05: email logged as Message. | phase-13 :317; D-44; ADR-116 (text/email → Message) | No change to lesson copy unless the owner reverses ADR-116. |
| **Dashboard → Contacts** | — | A-17, K-32 | phase-38 :36 "[DECIDED] Dashboard terminology retired" | Enforcement. No lesson impact. |
| **Population "Active Contacts"** | Frame 05 shows "Population Active Cont…" | A-04: hidden option | ADR-093 | Orient step 2 copy depends on how A-04 is resolved (§6 #7). |
| Small items | Frame 03 "Identity", "Relationship Basics"; frame 02 Acquire; frame 07 + | A-31 "Identity" (dev word, in X-37) | — | Minor copy. |

**Does lesson copy have to wait on a glossary?**

No, not the whole glossary, and not planning.
- Phase 39 copy is draft (D-74; Claude's Discretion item 1). Lesson copy is registry data, and D-64 means wording edits keep each lesson's identity.
- Six term rulings must be made before the **final copy** is signed off on the device:
  1. the never-contacted term;
  2. Wobbly vs Wobbling;
  3. Bound/Unbound + Orbit participation;
  4. Transmit;
  5. Group Log / event noun;
  6. Favourite spelling.
- Ideally those six land before 39 planning, so the planner writes them once.
- 1, 2 and the "Log Contact" label are enforcement or planner calls.
- 3, 4 and 5 are owner calls because each reverses a recorded term.
- 6 is taste.

---

## 3. Dialog / header / Back / destructive standards vs the lesson presenter and new screens

**Closest-to-right components, verified by opening them:**

- **ConfirmDialog** (`src/components/ui/ConfirmDialog.tsx`). The audit's choice (B Dissolve dialog). [code]:
  - card `backgroundColor: colors.surfaceElevated`, `borderColor: colors.border`, `borderWidth: hairlineWidth`, `RADII.lg`, `SPACING.lg`, `maxWidth 420`;
  - destructive variant: warning glyph, Destructive button, non-dismissable;
  - `ConfirmActions`: Cancel (secondary) on the left, confirm on the right; stacks Cancel-first at large text (ADR-174).
  - Built on `BaseOverlay` (`overlay-base.tsx`):
    - RN Modal;
    - a11y focus moves into the content on open (:84-92);
    - `dismissable` policy;
    - scrim `colors.background` @ `SCRIM_OPACITY = 0.85`.
  - **Match for D-80/D-32:** the lesson card is the same recipe (opaque `surfaceElevated`, focus-on-open, labelled dialog), with `colors.borderStrong` (already a token, used in `TriStateLastSpoke.tsx:106`) and a pointer.
    - [rec] Generalise `ConfirmActions` to an N-button action row with the same fit/stack rule (ADR-174), for Skip (tertiary) · Back (secondary) · Next/Done/Got it/Log it (primary, right).
    - That keeps D-32 large-text behaviour and the X-28 "primary on the right" order, which the mockup already uses: "Skip · Log it", "Skip · Back · Next".
  - **Collisions:**
    - (a) D-82 asks for a cutout scrim. BaseOverlay's scrim is a plain fill, so the spotlight needs a new mask layer. [rec] Reuse `SCRIM_OPACITY` as the spotlight token (0.85 vs mockup ~0.80) and add one lighter tip token (~0.5).
    - (b) The pointer is a new primitive.
    - (c) The lesson card becomes a 5th overlay variant. phase-02 §O requires it to share radius, scrim, spacing and typography.
- **Option picker.** The audit names the custom-field "Met via" sheet (`field-widgets/DropdownFieldWidget.tsx`). [code] That one is a raw RN `Modal` + FlatList, **not** the shared `Sheet`. The better precedent is **`category/CategoryChoiceSheet.tsx`**, which is built on `Sheet` with search. [rec] Generalise it into the single OptionSheet. The same change fixes the D-24 trigger gap: Category becomes one control at every count.
- **Header.** `ShellAppBar variant="child"` (`src/components/ShellAppBar.tsx`). Recommended independently by B-03, H-08 and K-04. ADR-175 already makes the header Back the only Back under a child bar.
  - **Welcome:** no Back.
  - **Acquire:** should be `ShellAppBar variant="child"` (plain "Back", which matches mockup frame 02) on a focused route (D-70; phase-01 §I "Focused workflows: Back/Cancel + clear workflow title").
  - **Tutorials (D-92):** a Settings child, so `ShellAppBar` child is mandatory. `settings-chrome-contract.test.ts` enumerates Settings children, and the new screen is caught by it. Settings is a FAB-bearing stack (ADR-173), so the screen also needs `useBottomClearance`.
  - **Collision:** frame 03 draws the real New contact form with a plain "Back". Today Add/Edit use a boxed in-body Back (E-20). Either X-26 lands first or frame 03 ships with today's header. This is C only.
- **Back semantics (X-08), a real collision with the mockup.**
  - Mockup Part 3 says "Android Back acts as Skip". D-85 puts a visible **Back** (previous step) on multi-step cards.
  - phase-01 §C says "[DECIDED] Android system Back and visible app Back have identical logical results." A card with "Back" = previous and system Back = Skip breaks that.
  - [rec] (C, mockup note only, no D-ID change): on steps ≥2, system Back = the card's Back. On step 1, one-step tips and the intercept, system Back = Skip/Got it, and it never cancels the underlying action (D-16, D-18).
  - Also C-01: if the X-08 fix sets the tab navigator to `backBehavior="history"`, Orient's programmatic tab switches (Digest→Contacts→Orrery→Digest, frames 04-07) become tab history. Orient must leave the history clean.
- **Unsaved-changes guard (X-01).** `useDiscardKeepGuard` is the right hook. Its prompt is a native `Alert` (`discard-keep-guard.ts:29`). [rec] Switch it to ConfirmDialog first: one change themes all 6 guarded forms.
  - For 39: Create has no guard. The first-run Back from Create to Acquire (D-61/D-70) and the D-58 "lesson never starts while a form … is open" rule both need a reliable form/overlay-open signal.
- **D-58 detection (X-04, X-32).** [code] `shellTransientStore` is registered only by the FAB, ContactPicker, AnchoredPanel and the Orrery overlays. `BaseOverlay` (every Modal/Sheet/ConfirmDialog) does **not** register, and native `Alert`s cannot.
  - [rec] Have `BaseOverlay` register with the transient store, and move `Alert` confirms to ConfirmDialog. That makes D-58's coordinator rule enforceable. If this is not done, the 39 coordinator has blind spots: 102 native Alert sites.
  - D-84 is feasible as specified: "Choose System" is an in-tree panel, not a Modal (`OrreryScreen.tsx:1630`, `onOpenChange`).
- **Destructive rule (X-03).** [rec] Adopt: reversible → act at once + Undo snackbar; irreversible → destructive ConfirmDialog; destructive buttons are never the loudest control at rest. That is consistent with phase-02 §P and ADR-086.
  - 39 touchpoint: D-92 **Restart tutorials** resets all per-lesson state. Under the rule it is "irreversible but non-destructive to data". [rec] A non-destructive ConfirmDialog, or no confirm plus a snackbar "Tutorials restarted; the tour plays next time you open the app". Either way it needs feedback (X-05), because D-57 replays Orient only on the next open, so the tap is otherwise silent. This is a planner call inside D-57.
- **Feedback (X-05).** [code] `<Snackbar/>` is mounted in the main window (`App.tsx:441`). Sheets are RN Modals, so a snackbar fired from inside a sheet renders underneath (A-13, confirmed structurally).
  - The Quick Log intercept must close before the "Logged" snackbar shows. The mockup already says so.
  - Restore entered from Acquire (D-63) runs in the Settings stack: tab bar visible, FAB live (K-20), which breaks first-run containment (D-61). Planning must route it as focused.
- **Selected state (X-34).** E-13 versus D-50 and mockup frame 03 is the B item (§6 #15). Also: the D-92 switch inherits K-29's near-invisible off state in dark themes (`thumbColor={colors.surfaceElevated}`). Fix the switch tokens before or with D-92.

---

## 4. Proposed grouping for fix planning

### (a) By product area

| Area | Findings (area file) | Main themes | Notes |
|---|---|---|---|
| Contacts tab (A) | 37 + A-X01/2/3 | X-09, X-35, X-41, X-42, X-20, X-05 | List-view perf (A-X01/2) first; A-01/A-08 may share its cause |
| Events (B) | 24 + B-X01 | X-24, X-03 (B-07), X-26 (B-03), X-13 | B-05 is ADR-167 territory |
| Digest (C) | 14 | X-43, X-09 (C-03), X-41, X-36 (C-11) | C-03 vs ADR-147 |
| Profile (D) | 35 + D-X01 | X-15, X-23, X-20, X-11 (D-10) | D-09 → D-77 |
| Add/Edit/Update (E) | 29 + E-X01 | X-22, X-11, X-13, X-29, X-34 (E-13) | E-01/02/05/12/13/X01 → 39 Create plan |
| Logging & history (F) | 27 | X-24, X-05, X-13, X-43, X-31 | Record lesson screen |
| Things to Remember (G) | 24 | X-15, X-16, X-17, X-19, X-12 | 999.3/999.5/999.6 |
| Lifecycle & import (H) | 29 | X-23, X-10 (H-01), X-03, X-33 | H-02/H-03 → D-75 |
| Sharing (I) | 16 | X-07 (I-01), X-08 (I-03/05), X-30, X-11 (I-06) | D-93 / 999.5 |
| Compose & confirmations (J) | 18 + J-X01 | X-18 (J-01), X-05 (J-02), X-28 (J-05) | J-02/05/08 → D-76 |
| Settings (K) | 44 | X-26 (K-04), X-03, X-06 (K-30), X-34, X-37 | K-22 backup format is an owner call |

### (b) By cross-cutting standard

| Standard | Themes |
|---|---|
| Dialogs & overlays | X-04, X-32, X-03, X-28 (dialog half) |
| Navigation chrome & Back | X-01, X-07, X-08, X-26, X-06, X-40, X-10 (replace-after-save) |
| Feedback & validation | X-05, X-29, X-10 (focus reload) |
| Controls & states | X-34, X-13, X-30, X-31, X-33, X-02 |
| Vocabulary & labels | X-36, X-37, X-38, X-14, X-39 |
| List/search/empty | X-09, X-35, X-41, X-42, X-43, X-25 |
| Domain unification (area-bound by nature) | X-11, X-12, X-15–X-24 |

### Recommended hybrid: 1 standards phase + 5 area phases, about 22–26 plans

**Phase S: UX standards and shared primitives.** It sets the rules and builds the shared pieces; the area phases apply them.
- **Rulings / ADRs** (owner decisions first, see §6):
  - dialog rule;
  - destructive rule;
  - unsaved-changes and Back rule;
  - header standard;
  - Save/Cancel wording and primary-button side;
  - feedback rule;
  - selected/disabled tokens;
  - glossary (one page, plus the six lesson terms in §2).
- **Plans (each one coherent change to one subsystem):**
  - **S1 Overlays:**
    - ConfirmDialog everywhere the guard is used: `discard-keep-guard.ts` → ConfirmDialog;
    - generalised N-button action row;
    - OptionSheet from CategoryChoiceSheet;
    - BaseOverlay registering with `shellTransientStore`.
    - Files: `src/components/ui/*`, `navigation/discard-keep-guard.ts`, `stores/shell-transient-store.ts`. About 8 files plus tests.
  - **S2 Chrome:**
    - `ShellAppBar` child as the house header;
    - `backBehavior="history"` (C-01) with an Orient-safe history;
    - Back closes innermost state for search and sheets (A-09, B-15);
    - FAB visibility classification (the non-reversal parts: restore as focused, panels);
    - apply `useDiscardKeepGuard` to the unguarded forms: E-01, F-01, G-12, K-06, I-05. About 3 lines each; one verification path (beforeRemove tests).
    - About 12–15 files.
  - **S3 Feedback/validation/state primitives:**
    - snackbar above sheets (A-13);
    - person and channel named in snackbars (A-35/F-03);
    - inline validation + scroll-to-field (fixes E-X01's `measureLayout` pattern);
    - switch/selected/disabled tokens (K-29/E-22);
    - date formatter (X-14);
    - EmptyState component (X-41).
    - About 10 files plus theme tokens.
  - **S4 Glossary:** a glossary doc, label constants (`product-labels.ts`, `control-labels.ts`), a pluralise helper, and the decided-term renames. The per-screen string sweep happens in the area phases, or as one mechanical copy plan with grep tests.
- **Size:** about 35–45 files and 3–5 ADRs. It directly closes ~30 findings and sets the rules for ~150.
- **Timing:**
  - The **rulings** should precede Phase 39 planning. The presenter, Welcome, Acquire, Tutorials, the D-58 coordinator and the lesson copy consume them (§3, §2).
  - S1 and S3 should precede or run alongside 39's presenter plan. Otherwise 39 builds the action row and overlay registry and S adopts them.
  - S2 and S4 can run alongside 39.

**Area phases.** Each applies the S rules plus its own domain-unification themes:

| # | Phase | Scope | Size | Timing |
|---|---|---|---|---|
| A1 | Lists, search and Digest | A + C (51) + A-X03. Themes X-09, X-35, X-42, X-43 (Digest half), X-41 (application). | 3–4 plans. HomeScreen, control-surface, dashboard logic, digest/*. | Gate: A-X01/A-X02 investigation first. Can run alongside or after 39. Orient Contacts copy re-checked after. |
| A2 | Logging, history and events | F + B (51) + B-X01. Themes X-24, X-13 (log pickers), X-43 (History), X-31. | 3–4 plans. TouchpointRefineForm, Log/Edit/GroupLog, GroupEvent*, history/*. | Prefer **before the 39 device pass**: the Record and Group Log lessons point at these screens. Otherwise after 39. |
| A3 | People: Profile, contact forms, Things to Remember | D + E + G (88) + D-X01. Themes X-11, X-12, X-15, X-16, X-17 (with 999.3), X-19, X-20, X-21, X-22, X-23 (Profile half). | Large: 5–7 plans, split Profile / forms / TTR (different files). | Create-path items fold into 39 now (E-01, E-02, E-05, E-12, E-13, E-X01, D-09 → D-77). The rest after 39. D-93 waits on 999.5. |
| A4 | Capture and reach-out | J + I (34) + J-X01. Themes X-18, X-05 (J-02), X-07 (I-01), X-30. | 2–3 plans. | J-02/J-05/J-08 fold into the 39 D-76 plan. J-01's destination line before the Reach Out lesson (fold into 39, or a tiny pre-39 fix). The rest after 39. Sharing after 999.5. |
| A5 | Lifecycle, import and Settings | H + K (73). Themes X-23 (lifecycle), X-10 (H-01), X-27, X-33, X-26 (K-04 application). | 4–5 plans. | H-02/H-03 fold into the 39 D-75 plan. The rest any time after S. |

**Phase 40 keeps:**
- X-39 audit-level a11y (cheap label fixes may land earlier);
- A-X02 latency (40 D-05 already notes it);
- yearly heatmap (F-16 part);
- large-text reflow aspects of X-31/X-34 (contrast).

**Why 6 phases, not 11 or 3:**
- 11 single-area phases repeat the same shared-component work and scatter the decided rules.
- 3 phases would each exceed one executor's budget across unrelated files.
- Pairing areas that share files or verification paths keeps each phase at 3–7 plans: A+C share the dashboard list/query stack; F+B share TouchpointRefineForm and Group Log; D+E+G share contact knowledge; J+I share capture and reach-out; H+K share Settings-hosted admin.
- A 5-phase variant merges A4 into A2, giving one "recording" phase of about 85 findings.

**Plan-sizing gates (CLAUDE.md "Plan sizing"):** no plan exists yet, so neither gate applies.

---

## 5. Non-UX items

| Id | Class vs 39 | Verification | Routing [rec] |
|---|---|---|---|
| **A-X01** list-view memory growth (≈1.6 GB release; debug OOM 4×) | E (but see note) | UNVERIFIED cause; not reproducible by reading. CONFIRMED side claim: `HomeScreen.tsx:1551-1578` `onSelectContacts` switches list→card first. [code] The **default view is List** (`019-dashboard-prefs.ts:15` DEFAULT 'list'; `dashboard-query-store.ts:70`). So Orient step 2 (D-71) and the swipe Quick Log intercept (D-53) ride on this view. | **Investigate now** (a gsd-debug session, release build, on both the 100-contact and the full set). Fix in A1 or a small decimal phase. Perf is formally Phase 40 (40 D-01/D-05), but a 1.6 GB release footprint is a beta stability risk on mid-range phones, and an import-first user can have a large address book. Priority is an owner call. |
| **A-X02** list-view tap latency 1.7–2 s release | E | UNVERIFIED (perf). 40-CONTEXT D-05 already records Population lag on the 3a debug build. | Same investigation as A-X01. The fix belongs to Phase 40 unless A-X01's fix removes it. Test X-05 Undo in list view. |
| **A-X03** Population taps dropped while saving | E | CONFIRMED: `DashboardControlRow.tsx:116` `if (pending) return;` inside `togglePopulation` (:114-134) | A1, same change as A-03 |
| **B-X01** Events search shows an older term's results | E | CONFIRMED: `GroupEventsScreen.tsx:43-61`. `load()` has no latest-request guard and runs on every `term` change. That violates ADR-162 (latest-request publication authority). | A2 with B-14/B-15, or **now** as a ≤10-line fix using `createLatestRequestAuthority` |
| **D-X01** nested VirtualizedList warning in Profile Layout editor | E | PARTIAL. `ProfileLayoutEditor.tsx` renders `NestedReorderableList` (:200) inside `ScrollViewContainer` (:411), inside a `Sheet` (:381; "detail" on the chooser, "expanded" on edit). The exact outer ScrollView causing the warning is UNVERIFIED. | A3 (Profile plan), with D-11 |
| **E-X01** `measureLayout` warning; blocked Save doesn't scroll | **D** (Add Contact half folds into the D-87 Create plan, same function) | CONFIRMED: `CreateContactScreen.tsx:253-262` and `EditContactScreen.tsx:493-502` pass `findNodeHandle(scroll)` (a number) to `node.measureLayout`. The node is a plain `View` (`AccordionSection.tsx:73`). [inf] Fabric requires a component ref, not a handle: pass `scroll` (the ref). | Add: fold into 39 D-87. Edit: same commit, since the code is identical. Pattern also in S3. |
| **J-X01** duplicate React key "Memory" in Compose → TTR | E | CONFIRMED: `ComposeResearchScreen.tsx:77-87` `groupItems` folds only consecutive runs; the group is keyed by `group.name` at :183 | **Now** (one-function fix; also fixes J-09's doubled groups) or A4 |
| (cross-ref) K-22 favourites not in backup | E | Not verified here (slice K) | Owner call. A backup-format bump is an owner decision (40-CONTEXT D-03; D-62 kept format 7 for 39). |
| (cross-ref) H-01 stale Archived list | E | CONFIRMED (§Header) | A5, or now (small `useFocusEffect` fix) |

---

## 6. Hidden owner calls at theme level, each with a recommendation

1. **Dialog standard scope (X-04).** Should all 102 native Alerts and the native spinners become ConfirmDialog / OptionSheet? [rec] Yes. Keep the native date/time pickers (ADR-176 already makes them follow mode). Do the shared discard guard first.
2. **Destructive rule and recoverability (X-03).** [rec] Adopt the rule. Keep interaction delete irreversible but always confirmed (enforces phase-11 :730; fixes B-07). Do **not** add interaction Trash (that would reverse phase-11 :728). Defer Recently Deleted for key people and Off Limits (it adds storage).
3. **House header (X-26).** ShellAppBar text "Back" vs the Profile chevron. [rec] ShellAppBar child for every pushed screen. The Profile hero (ADR-109) keeps its own chrome but uses the same Back glyph and text.
4. **FAB on Settings (X-06)** reverses phase-01 §B/§E and ADR-173. [rec] Keep it (decided). Fix the overlap with bottom clearance on the screens K-30 lists, and hide it during restore and open panels (enforcement).
5. **Where + flows live and end (X-07).** [rec] Host + forms in the origin tab's stack (or a root modal) so Back before save returns to the origin (enforcement). Keep "Add Contact → new Profile" (phase-01 §D, phase-13 :607). Rule this before 39 plans D-70/D-86 hosting.
6. **Digest drill-through overwriting the Contacts view (C-03 vs ADR-147).** [rec] Keep ADR-147 and make the applied population visible, with a one-tap clear (A-05). No temporary view.
7. **Empty population = "Active Contacts" (A-04 vs ADR-093).** [rec] Keep ADR-093 and expose "Active Contacts" as a named, explained option. Then frame 05 and D-81 stay valid. If the owner picks "All Contacts", D-12, D-81 and frame 05 change (a B amendment).
8. **Renames that reverse decided terms (X-36/X-37):**
   - Bound/Unbound (dossier 18 :18; D-91)
   - Transmit (phase-14 :156; D-15)
   - Group Log / event noun (phase-01 :34, phase-12 :165)
   - Dissolve (phase-12 :374)
   - Interaction Assist (dossier 21 :171)
   - status names (phase-07 :99, ADR-026)
   - [rec] Keep the decided product nouns. Explain them in place (legend, caption). Fix spelling/casing variants and developer leaks ("fuel", "Tombstones", "retrospective", "Dashboard", "Sensitive Operations", "Log Contact"). Choose "Never Contacted" (phase-38 :72) for the never-contacted family.
9. **Email logged as "Message" (J-05 vs ADR-116/D-44).** [rec] Keep. Optionally show "Message · email" in the History detail.
10. **Quick Log using the remembered channel (F-03 vs ADR-130).** [rec] Keep ADR-130. Name the channel and person in the snackbar (truthful feedback). The intercept copy "saves a Message with Maya" must then show the resolved channel.
11. **Add Contact = Edit form (E-04/X-22 vs ADR-131, ADR-016, D-87).** [rec] No. Keep progressive create. Optionally add Birthday/Photo under Show More.
12. **Last talked about model (X-12 vs ADR-088).** [rec] Keep the history model. The Edit box writes through history and says so.
13. **Participant writes commit immediately (B-05/X-01/X-02 vs ADR-167).** [rec] Keep. Label the participant list as "saved immediately" rather than guarding it.
14. **ConfirmDialog button layout (B-19 vs ADR-174).** [rec] Keep fit→row / stack Cancel-first. It is already Cancel-first in reading order.
15. **"Not yet" selected state (E-13 / X-34).** This is the B item. The accepted mockup (D-74) draws it solid; 34-UI-SPEC:115 and `TriStateLastSpoke` mute it by design; D-50 makes it the default. [rec] Amend by D-94: "Not yet" renders visibly selected when chosen (accent outline, not fill), superseding 34-UI-SPEC:115 for the selected case.
16. **Lesson Back vs system Back (§3).** [rec] System Back mirrors the card's Back on steps ≥2. It acts as Skip on step 1, one-step tips and the intercept. This is a mockup note only; D-85's labels stay.
17. **Sequencing.** [rec] Rule items 1–8, 10 and 15 before 39 planning. Implement Phase S alongside 39. Run A2 before the 39 device pass if capacity allows. Run the other area phases after 39.
18. **A-X01 priority.** [rec] Investigate before beta, not at Phase 40 (default view, large imports).
19. **G-14: "Allow AI" survives Cancel on a memory (X-02).** This is AI-egress consent, so it sits in the owner's risk/security bucket (CLAUDE.md "Whose decision"; AI exception in "Local-first"). [rec] Fix early: make the toggle part of the draft.
20. **I-06: share-created contacts silently tracked Monthly.** [rec] Tie them to D-51's default constant and show it on the New-contact sheet, or create Unbound. The owner picks; it touches D-93's sharing lesson.

---

## 7. Suspected recorded-decision reversals (in the audit's proposed directions)

| Item | Reversal | Status |
|---|---|---|
| X-01/X-02 B-05 | ADR-167 (rejected "prompt save/discard before participant actions") | confirmed text |
| X-01 J-04 | ADR-133 (rejected durable per-contact drafts) | partial; in-memory is not rejected |
| X-03 | phase-11 dossier :135/:728/:730 (interaction hard delete, no Trash) if made recoverable; ADR-089 extended for key people | confirmed text |
| X-04 B-19 | ADR-174 (ConfirmDialog row-when-fits / stack Cancel-first) | confirmed text |
| X-05/X-24 F-03 | ADR-130 (Quick Log updates and uses the remembered channel) | confirmed text |
| X-06 | phase-01 §B/§E + ADR-173 (FAB on ordinary Settings child pages) | confirmed text |
| X-07 | phase-01 §D + phase-13 :607 (Add Contact → new Profile); ADR-147 (drill persists canonical axes) | confirmed text |
| X-09 A-04 | ADR-093 (empty selection = Active Contacts) | confirmed text |
| X-12 | ADR-088 (retained current-state history), if switched to overwrite | confirmed text |
| X-18 | ADR-133 / phase-14 :134 (fallback), only if the fix removes the fallback | conditional |
| X-21 | ADR-131 (progressive create), photo on Add | suspected |
| X-22 | ADR-131 / ADR-016 / phase-13 §D (Add = Edit form) | confirmed text |
| X-23 H-19 | ADR-150 (Unbind in the confirmed overflow) | confirmed text |
| X-24 J-05 | ADR-116 + D-44 (email/text → Message) | confirmed text |
| X-32 | ADR-174 / Sheet contract (expanded sheet consumers own scroll) | suspected, minor |
| X-34 E-13 | 34-UI-SPEC:115 ("Not yet" muted, never accent) | confirmed text, design spec |
| X-36/X-37 | dossier 18 :18 (Bound/Unbound); phase-14 :156 (Transmit); phase-01 :34 + phase-12 :165 (Group Log); phase-12 :374 (Dissolve); dossier 21 :171 (Interaction Assist); phase-38 :72 (Never Contacted, if renamed away); phase-07 :99 + ADR-026 (status names) | confirmed text |
| X-42 | D-48 / phase-06 :350 (no permanent in-list gesture tutorial), if a visible permanent hint is chosen | confirmed |

Directions that **enforce** recorded decisions (planner calls, not reversals):

| Theme | Decision enforced |
|---|---|
| X-01 | phase-01 §B |
| X-08 | phase-01 §C |
| X-10 | phase-01 §C; ADR-162 |
| X-26 | phase-01 §I; ADR-175 |
| X-33 | phase-01 §G |
| X-41 | phase-02 empty states |
| X-04 / X-32 | phase-02 §O |
| A-02 | ADR-092 |
| B-X01 | ADR-162 |
| A-17 / K-32 "Dashboard" | phase-38 :36 |
| B-07 confirm | phase-11 :730 |
| Status "Wobbly" | phase-07 :99 |

## 8. Gaps: 39 triggers or flows this slice depends on that the audit did not verify

1. **D-24 Categories trigger.** "CategoryChoiceSheet in Create/Edit" does not render below 13 categories; a fresh install has 4. The native Picker hosts no anchor or trigger. [code] `CreateContactScreen.tsx:460`, `category-logic.ts:4`, `001-initial.ts:197`.
2. **D-58 coordinator blind spots.** BaseOverlay overlays and native Alerts are not registered anywhere (`shellTransientStore` registrants are listed in §3).
3. **Orient tab switching vs a future `backBehavior="history"`** (C-01 fix): no test or decision covers it.
4. **D-63 restore entered from Acquire** runs in the Settings-hosted tree (ADR-141/146), with the tab bar and FAB visible. First-run containment (D-61, D-70) is unverified. The audit's restore checks (K-18/K-20/K-21) were not run from a first-run state.
5. **Tutorials switch (D-92) in dark themes.** It inherits K-29's off-state contrast. Not checked on a Settings switch in a new screen.
6. **List-view memory at first-run scale** (A-X01). This is the default view. The audit measured only ~1,016 contacts; it is unknown at 1–100 contacts and after a large first-run import.
7. **Prepare "normal visit" detection (D-14)** with the D-02 duplicate Profile push after an Edit save. Not exercised by the audit as a lesson-trigger case.

## Rules added/changed
None.
