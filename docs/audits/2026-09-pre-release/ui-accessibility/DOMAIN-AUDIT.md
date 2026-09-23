# UI Implementation, Theming, and Accessibility Audit

## Audit Metadata

- **Date:** 2026-09-22
- **Domain code:** UIA
- **Mode:** Deep domain audit; source inspection with targeted automated checks. No implementation changes.
- **Repository:** `/home/bwales/projects/orbit-app`
- **HEAD:** `0e04c27e1d82bc3b5069bbf5adfc72281155df69`
- **Initial worktree:** untracked `docs/audits/2026-09-pre-release/`; no tracked modifications reported. Existing campaign material was not altered.
- **Output:** this file only. No commits, pushes, worktrees, graph rebuilds, or application/configuration changes.
- **Requested focus:** recurring UI implementation consistency, design-system adherence, Standard/Galaxy behavior, accessibility, and explicit separation of code-detectable issues from manual visual questions.

## Executive Summary

The repository has a substantial shared UI foundation, but its protections are inconsistently applied. Confirmed problems include incorrect foreground tokens in backup actions, unlabelled Memory switches, native controls that do not follow the selected theme, undersized actions, missing accessible selection/context, misleading failure and permission summaries, and inconsistent font and timestamp resolution.

The contrast suite passes, but its brightest-pixel-only background check does not establish the promised contrast guarantee for dark text in Standard Light. Actual shipped asset pixels produce failing calculated composites. This is a confirmed proof gap, not a claim that a particular screenshot was inspected and found unreadable.

There are **23 primary findings: 20 OPEN and 3 INVESTIGATE**. None is classified S0 or S1. Three native interaction/reflow questions require device confirmation before remediation is selected. Other confirmed findings also include device checks to validate the eventual fix. Historical adoption debt, authorized theme differences, and explicitly deferred dense visualization behavior are recorded separately rather than treated as newly discovered defects.

## Scope

Included: shell/chrome/FAB, contact list and grid, Digest, Events and group forms, Profile and history, Orrery controls and motion gates, Settings and AI screens, contact/enrichment editors, import/reconciliation, backup/restore, shared overlays and primitives, theme tokens/assets, and the Android widget's rendered accessibility contract.

Excluded: implementation, product redesign, database correctness auditing, AI transmission/security-policy auditing, performance measurement, external service calls, runtime device manipulation, and broad test-suite execution. Persistence helpers were traced where needed to distinguish loading and error states; this report makes no new table-integrity assertions.

## Repository Context Reviewed

- `HANDOFF.md`, including its recorded supersessions and local-first/theme commitments.
- Theme dossier `docs/dossier/milestone-2/phase-02-theme-visual-system-dossier.md`, especially §§B, H–M, O–Q.
- Current screen dossiers for Contacts, Profile, History, group logging, rapid capture, AI configuration, Settings, Digest, and Phase 38.1 presentation polish; related current UI specifications and decision overlays.
- ADR-084: separate accent fill/text/on-fill semantics and protected legacy contrast exceptions.
- ADR-086: semantic icons/accessible primitives; historical adoption was explicitly deferred.
- ADR-087 **as partially superseded by ADR-115**: current mode-aware translucency, visible backgrounds, protected chrome, and Android elevation exception.
- ADR-149: dedicated Orrery overlay treatment; it does not authorize globally changing ordinary card opacity.
- Phase 38.1 CONTEXT D-08: minute precision, default 12-hour explicit timestamps, one shared formatter. Relative dates remain intentional.
- Phase 37 active-package background-choice guard, and historical Phase 20 UI-SPEC's explicit legacy spacing/type/radius exceptions.
- Widget ADR-042/043 and Phase 12 UI-SPEC: headless palette and bitmap layout are intentional specialized implementations.

## Methodology and Coverage

Four investigative tracks read actual source: main browse/profile/history/Orrery; Settings/AI/forms/import/backup; theme/shared primitives; and reusable editors/widget/aggregate adjudication. Findings were checked against actual on-disk code and relevant callers, not a changed-file list. The final adjudication reopened evidence and independently reproduced the key contrast calculations and test result.

Sanctioned `npm run graph:ask -- governs …` queries covered `GlassSurface`, surface tokens, Home, Appearance, MemoryEditor, and ContactPicker. **INFERRED** edges were treated as ADR Key-files claims, not code assertions. Appearance's **EXTRACTED** ADR-047 citation was distinguished from those inferred associations. The graph correctly exposed ADR-087's partial supersession. MemoryEditor having no recorded edge was not treated as absence of governing decisions. No graph was rebuilt.

Installed React Native, expo-font, and Android-widget source was consulted for accessible labels, font registration, and bitmap click-area semantics. These are local dependency implementations, not assertions based only on remembered framework behavior.

### Comparison coverage

| Recurring concept | Reviewed implementations and conclusion |
|---|---|
| Spacing/gutters | Most ordinary forms/Settings use 16; shared sheets use 24; centered import progress uses 24. Historical Phase 20 explicitly permits 10/14/20 exceptions. Different numbers alone are not findings. Fixed heatmap width and preview gap accounting are concrete failures below. |
| Typography/headers | AppText uses five semantic roles and registered weight-specific fonts. Live list/grid bypass that registration mapping. Settings and older utility screens retain raw typography; not all are unauthorized retrofits. Heading hierarchy and duplicate metadata removed by Phase 38.1 were checked. |
| Cards/borders/radii/dividers | Shared GlassSurface, opaque utility rows, flat profile sections, and legacy review cards coexist. Conceptual differences and Phase 20 exceptions were retained. No universal requirement that every row become a glass card was invented. |
| Color/opacity/shadows | Four palettes, curated accents, matched/mismatched card treatment, host veil, ChromeScrim, Orrery overlays, and actual background assets examined. Findings distinguish semantic-token misuse from raw literals and native-default bypass. |
| Buttons/icons | Shared Button/Icon, form actions, AI links, candidate review controls, Settings directory, and FAB reviewed. Shared button label/minimum-target enforcement is good; exceptions are listed below. Unicode widget glyphs are a documented specialized renderer. |
| States | Loading/error/empty/no-match/busy paths compared across Contacts, AI, import, reconciliation, backup, and editors. Several true failure states masquerade as other states. |
| Modals/sheets | Shared BaseOverlay/Sheet/ConfirmDialog versus ContactPicker, field/type pickers, and legacy native modals. Different adoption generations alone are not defects. Native focus timing and safe-area outcomes remain device checks. |
| FAB/safe areas | Shell top SafeAreaView, measured tab-bar clearance, hidden focused-workflow FAB, keyboard handling, and shared bottom-inset Sheet examined. Fixed peripheral overlay offsets and focused forms need device verification. |
| Accessibility | Labels, values, selection, gesture alternatives, touch targets, text scaling, widget click-area names, reduced motion, and native grouping examined. No claim of a completed TalkBack run. |
| Theme-specific behavior | Appearance filters backgrounds by active package and preserves package-specific preferences. Standard glass is authorized. Orrery/star settings apply to both packages; their presence under Standard is not itself a leak. No confirmed Galaxy-only settings-control leak was established. |

Deep reads included the main browse components, Digest sections, profile module host/hero/overview/layout editor, history/heatmaps/Rolodex, Orrery screen/world/camera/switch gates and controls, group forms, AI model/permissions/connection/preview, Settings hub/AI/Orrery, backup and restore screens, all principal import/reconciliation review screens, and the reusable editors/primitives cited below. Appearance, Notifications, Create/EditContact, and AI personalization received substantial targeted inspection but not an independently verified exhaustive line-by-line pass of every large handler. This limits claims of completeness, not the cited findings.

### Checks executed

`npx vitest run src/theme/contrast.test.ts src/theme/accents.test.ts src/theme/tokens/surface.test.ts src/theme/use-reduced-motion.test.ts src/components/ui/Button.test.ts src/components/ui/overlay-base.contract.test.ts --cache=false`

Result independently reproduced: **6 test files, 165 tests passed**. These tests do not render Android layouts or exercise TalkBack. Contrast ratios were also calculated with the repository's `contrastRatio`; shipped WebP pixels were decoded read-only with Pillow. No test or image artifacts were added.

## Findings Summary

| Severity | OPEN | INVESTIGATE | Total |
|---|---:|---:|---:|
| S2 Moderate | 14 | 3 | 17 |
| S3 Minor | 6 | 0 | 6 |
| **Total** | **20** | **3** | **23** |

| ID | Finding | Severity | Confidence | Disposition |
|---|---|---|---|---|
| AUD-UIA-001 | Standard Light background contrast proof uses the wrong extremum | S2 | C3 | OPEN |
| AUD-UIA-002 | Backup/restore primary labels use a failing foreground | S2 | C3 | OPEN |
| AUD-UIA-003 | Enrichment/layout switches bypass active theme colors | S3 | C3 | OPEN |
| AUD-UIA-004 | Memory switches have no accessible names | S2 | C3 | OPEN |
| AUD-UIA-005 | Custom selectors omit current values and selected-option semantics | S2 | C3 | OPEN |
| AUD-UIA-006 | Independent actions fall below the shared touch-target floor | S2 | C3 | OPEN |
| AUD-UIA-007 | Contact row accessible summaries omit search context | S2 | C3 | OPEN |
| AUD-UIA-008 | Review cards omit selection and decision evidence from their accessible representation | S2 | C2 | OPEN |
| AUD-UIA-009 | Widget bitmap actions have no accessible names | S2 | C3 | OPEN |
| AUD-UIA-010 | Fixed heatmaps exceed available narrow-screen width | S2 | C3 | OPEN |
| AUD-UIA-011 | Shared confirmation actions need large-text reachability verification | S2 | C2 | INVESTIGATE |
| AUD-UIA-012 | Loading/read failures are presented as empty, failed, or still running inconsistently | S2 | C3 | OPEN |
| AUD-UIA-013 | AI permissions summary confuses filtered results with actual access | S2 | C3 | OPEN |
| AUD-UIA-014 | Backup encryption fields lack visible identification | S2 | C3 | OPEN |
| AUD-UIA-015 | Contact renderers bypass registered font-family mapping | S3 | C3 | OPEN |
| AUD-UIA-016 | Settings children render duplicate Back controls | S3 | C3 | OPEN |
| AUD-UIA-017 | Settings directory omits specified icons/navigation affordances | S3 | C3 | OPEN |
| AUD-UIA-018 | Explicit timestamps still bypass the shared presentation contract | S2 | C3 | OPEN |
| AUD-UIA-019 | Reconciliation cards substitute database IDs for contact identity | S2 | C3 | OPEN |
| AUD-UIA-020 | Model picker does not identify the saved selection | S3 | C3 | OPEN |
| AUD-UIA-021 | Profile layout preview uses incompatible gap/column geometry | S3 | C3 | OPEN |
| AUD-UIA-022 | Contacts groups whole interactive regions as accessible elements | S2 | C2 | INVESTIGATE |
| AUD-UIA-023 | Closed FAB actions remain mounted without accessibility hiding | S2 | C2 | INVESTIGATE |

## Findings

### AUD-UIA-001 — Standard Light background contrast proof uses the wrong extremum
**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Cross-cutting  
**Type:** A11Y, TEST, DESIGN  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE, MANUAL-VISUAL

#### Summary
The per-asset contrast guarantee is unsound for dark text on translucent light surfaces.
#### Expected Behavior / Invariant
Theme dossier §Q and ADR-115 require readable functional content while keeping selected artwork visible.
#### Observed Behavior
The tests validate only each asset's declared brightest pixel. Dark foreground text can have its worst contrast over darker pixels. Shipped Standard assets contain such pixels.
#### Evidence
`src/theme/tokens/surface.test.ts:179–207` checks `slot.brightestPixel`; chrome tests use the same bound. `surface.ts:151–155,205–212` gives matched Standard Light cards/chrome 0.5 white tint; presentation host veil is 0.05. `GridCard.tsx:210` explicitly disables blur and `:309,318,331` uses `textSecondary`. Composition therefore has effective white alpha 0.525. Decoded asset extrema against Standard Light secondary text `(86,93,107)` yield:

| Asset | Darkest decoded RGB | Composited RGB | Ratio |
|---|---|---|---:|
| standard-paper.webp | 180,153,122 | 219,207,192 | 4.316:1 |
| standard-dusk.webp | 42,38,52 | 154,152,159 | 2.321:1 |
| standard-mesh.webp | 58,80,105 | 161,172,184 | 2.870:1 |

#### Impact
Passing tests do not establish the asserted all-asset AA guarantee; valid selected artwork can place functional text over a failing composite.
#### Trigger / Preconditions
Standard Light with these assets and translucent content/chrome. Actual glyph overlap depends on crop, viewport, and scroll position.
#### Remediation Direction
Validate the relevant extrema/actual composition for each foreground and retain the owner-approved visible-background treatment.
#### Verification
Decode shipped assets; evaluate both light/dark regimes, real tints, and relevant foregrounds. Then inspect actual text positions on device. **Source proves failing available composites, not a specific observed unreadable layout.**
#### Related Findings
AUD-UIA-002.
#### Planning Notes
Changing protected hues or replacing the authorized glass treatment is an owner decision. Do not fix this by silently restoring the rejected opaque host wash.

### AUD-UIA-002 — Backup/restore primary labels use a failing foreground
**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** A11Y, DESIGN  
**Disposition:** OPEN  
**Verification:** STATIC, MANUAL-VISUAL

#### Summary
Independent primary buttons bypass the shared on-accent foreground.
#### Expected Behavior / Invariant
ADR-084 separates `accent`, `accentText`, and `onAccent`; shared Button uses `onAccent` for a primary label.
#### Observed Behavior
Backup passphrase continuation, expired-preview recovery, and restore completion render `textPrimary` on `accent`.
#### Evidence
`BackupScreen.tsx:326`; `RestorePreviewScreen.tsx:189` and its apply action at `:214`; `RestoreResultScreen.tsx:64–66`. Files are under `src/screens/`. The actual default `textPrimary/accent` ratios are Galaxy Dark **2.54**, Galaxy Light **2.78**, Standard Dark **2.56**, Standard Light **2.47**. All fail even 3:1. `components/ui/Button.tsx` obtains the correct foreground from `button-roles.ts`.
#### Impact
Important recovery/continuation actions have objectively insufficient foreground contrast at default settings.
#### Trigger / Preconditions
The relevant restore states, with an enabled button and default accent.
#### Remediation Direction
Make equivalent primary/destructive actions resolve their foreground through the semantic action treatment.
#### Verification
Check every supported palette/accent and enabled state; verify the destructive branch separately using its designated foreground.
#### Related Findings
AUD-UIA-001.
#### Planning Notes
`background` on `accent` elsewhere is semantically weaker but passes current curated combinations; it is not included as a proven contrast failure. Protected legacy Galaxy danger contrast is a separate accepted limitation.

### AUD-UIA-003 — Enrichment/layout switches bypass active theme colors
**Severity:** S3 — Minor  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DESIGN  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary
Several equivalent native switches use platform colors rather than the selected Orbit theme.
#### Expected Behavior / Invariant
HANDOFF §7 and theme dossier §C require active theme/accent to restyle controls.
#### Observed Behavior
Memory, relationship, and profile-layout switches omit track/thumb tokens.
#### Evidence
`src/components/MemoryEditor.tsx:360–408`, `RelationshipEditor.tsx:122–129`, and `profile/ProfileLayoutEditor.tsx:110–116`. Compare `field-widgets/ToggleFieldWidget.tsx:21–27` and `TouchpointRefineForm.tsx:337–343`, which explicitly set `trackColor` and `thumbColor` from `useTheme()`.
#### Impact
Changing Orbit's package/accent leaves equivalent controls following a different color source. Literal-color scanning cannot catch omitted native overrides.
#### Trigger / Preconditions
Open the corresponding editor and switch package/accent independently of Android's theme.
#### Remediation Direction
Use one consistent theme-aware switch treatment while preserving each control's state and meaning.
#### Verification
Compare these switches with correctly themed peers in all four palette combinations and multiple accents.
#### Related Findings
AUD-UIA-004.
#### Planning Notes
Native defaults are not raw hex literals, but still bypass the active app theme. No specific platform fallback color is asserted.

### AUD-UIA-004 — Memory switches have no accessible names
**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** A11Y  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary
Pin, outdated, and profile-visibility switches do not carry their visible labels into control semantics.
#### Expected Behavior / Invariant
Rapid-capture dossier §AJ explicitly requires accessible names matching visible labels; accessibility is not deferred wholesale to final hardening.
#### Observed Behavior
The labels are sibling AppText nodes, with no label association or named accessible wrapper.
#### Evidence
`src/components/MemoryEditor.tsx:358–382`. The adjacent AI switch at `:397–408` correctly has an explicit label. Live callers include `src/screens/MemoryScreen.tsx:224`, Create/Edit enrichment sections, ThingsToRemember, and PostLogNoteEditor.
#### Impact
Screen-reader users must infer which unnamed switch changes which memory property.
#### Trigger / Preconditions
Add or edit a Memory and navigate directly among controls.
#### Remediation Direction
Give each switch its visible semantic name without grouping away its independent operability.
#### Verification
TalkBack should announce name, role, checked state, and changes for each switch.
#### Related Findings
AUD-UIA-003, AUD-UIA-005.
#### Planning Notes
The AI toggle already supplies a useful local comparison; do not change consent/default behavior.

### AUD-UIA-005 — Custom selectors omit current values and selected-option semantics
**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** A11Y, DESIGN  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary
Custom dropdown/date selectors expose less information than native and shared selected-state controls.
#### Expected Behavior / Invariant
Selection must be available without color; the control's current value must be available to assistive technology.
#### Observed Behavior
Explicit trigger labels replace descendant value text, and some option lists indicate selection only through accent color.
#### Evidence
`src/components/field-widgets/DropdownFieldWidget.tsx:39–55` names only the field, with no accessibility value; `:92–108` changes selected text color without selected/checked state or a non-color mark. `MemoryEditor.tsx:133–152` and `FuelEditor.tsx` KindPicker similarly omit selected-option semantics, although their triggers do name the current type. `TriStateLastSpoke.tsx:137–148` labels a chosen date only “Pick date.” `TouchpointRefineForm.tsx:252–260` names only “Correct date and time.” Installed RN `ReactAccessibilityDelegate.kt:956–995` prioritizes explicit content descriptions over descendant aggregation.
#### Impact
Users cannot reliably inspect the current value/selection from the accessible control; dropdown selection also depends on color visually.
#### Trigger / Preconditions
A nonempty value or selected option, especially reopening a picker.
#### Remediation Direction
Expose label plus current value and explicit option selection consistently.
#### Verification
Inspect the accessibility tree and TalkBack announcements before/after selection; ensure selection remains identifiable without color.
#### Related Findings
AUD-UIA-004, AUD-UIA-020.
#### Planning Notes
Preserve out-of-list custom-field values and intentionally muted “Not yet” treatment. Native Picker branches and CategoryChoiceSheet already provide stronger semantics.

### AUD-UIA-006 — Independent actions fall below the shared touch-target floor
**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** A11Y, DESIGN  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary
Bare text actions and duration chips bypass the 44dp minimum implemented by shared buttons.
#### Expected Behavior / Invariant
ADR-086, shared `MIN_TOUCH_TARGET`, and Phase 36 UI-SPEC:50 establish the minimum target contract.
#### Observed Behavior
Text-link actions have no minimum/padding/hitSlop, and interaction duration chips use 40dp.
#### Evidence
`src/screens/AIModelPickerScreen.tsx:286–295` More Info wraps a caption whose token line height is 20. `AIPermissionsScreen.tsx:222–233` Review existing does the same. Neither has a target-expanding style. `src/components/TouchpointRefineForm.tsx:414–456,600–605` renders preset/None controls with `minHeight:40`, no vertical padding/hitSlop; shared group and individual log/edit forms reuse them.
#### Impact
Equivalent actions are harder to activate, particularly for users with motor impairments.
#### Trigger / Preconditions
Ordinary text scaling; the chips do not naturally grow to the required floor.
#### Remediation Direction
Apply the same minimum interaction area to these actions, retaining compact visual treatment where appropriate.
#### Verification
Measure native bounds at default and enlarged fonts; ensure expanded hit areas do not conflict. More Info should also announce expansion and model context.
#### Related Findings
AUD-UIA-020.
#### Planning Notes
Do not include explicitly accepted dense Year heatmap cells in this finding.

### AUD-UIA-007 — Contact row accessible summaries omit search context
**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** A11Y  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary
Visible search explanations/snippets are missing from the parent row's accessible summary.
#### Expected Behavior / Invariant
The information explaining why a contact matched should be available when navigating search results without sight.
#### Observed Behavior
The row label is constructed from identity/category/recency/status before search context is derived.
#### Evidence
`src/components/ListRow.tsx:115–140`, with separately rendered explanation/snippet/adaptive content at `:185,228,245`; `GridCard.tsx:140–178,304–338`. `list-row-content.ts`'s `buildRowAccessibilityDescription` accepts no search/context fields. Installed RN's explicit-content-description precedence corroborates the omission.
#### Impact
A search that matched a memory or other knowledge can announce only the contact summary, obscuring why that result is relevant.
#### Trigger / Preconditions
Search results or a List adaptive-context line carrying information not already in the label.
#### Remediation Direction
Give accessible users equivalent distinguishing context while keeping row navigation concise and actions available.
#### Verification
TalkBack through name, memory, and relationship matches; verify explanation/snippet access and gesture-equivalent actions.
#### Related Findings
AUD-UIA-008, AUD-UIA-022.
#### Planning Notes
Normal Grid omission of List's extra context line is intentional Phase 38.1 behavior; this finding concerns information actually rendered.

### AUD-UIA-008 — Review cards omit selection and decision evidence from their accessible representation
**Severity:** S2 — Moderate  
**Confidence:** C2 — Strong  
**Scope:** Multi-area  
**Type:** A11Y  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary
Candidate review cards do not expose their selected state, and their parent labels omit the evidence used to make review decisions.
#### Expected Behavior / Invariant
Duplicate/reconciliation review must communicate identity, recommendation/evidence, selection, and failed actions beyond borders and visual text.
#### Observed Behavior
The accessible parent is named only with `item.name`; selection changes borders, and long press enters selection without a declared accessibility action.
#### Evidence
`src/components/CandidateCardGrid.tsx:163–179,201–228`; callers include DuplicateReview and ReconcileGrid. Recommendation/chip, evidence hint, and per-card failure copy sit inside that explicitly labelled parent. Unlike FieldChoiceGroup, there is no selected-state prop.
#### Impact
Screen-reader review lacks reliable selection feedback and may omit distinguishing evidence. Exact descendant traversal requires TalkBack confirmation.
#### Trigger / Preconditions
Reviewing or selecting duplicate/reconciliation candidates, including a failed bulk action.
#### Remediation Direction
Expose decision-relevant context and selection, with an accessible way to enter/toggle selection.
#### Verification
TalkBack must identify the card, evidence, selected state, and failure, and operate review/selection without relying on a visible border.
#### Related Findings
AUD-UIA-007, AUD-UIA-019.
#### Planning Notes
Preserve advisory confidence semantics and explicit review; do not change matching or bulk-write policy.

### AUD-UIA-009 — Widget bitmap actions have no accessible names
**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** A11Y  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary
The widget draws labels into a bitmap but does not label the separate native click areas.
#### Expected Behavior / Invariant
An actionable widget must expose the action and target contact to nonvisual users.
#### Observed Behavior
All small-tile, profile, large action, and empty-state click areas omit `accessibilityLabel`.
#### Evidence
`src/services/widget/widget-render.tsx:257–274,327–360,547–549`. The installed `react-native-android-widget` `WidgetFactory.java:90–107` copies only explicit accessibility labels into ClickableView. `RNWidget.java:77–81,193–194` rasterizes the content and labels the native overlay only when such a label exists. TextWidget text is part of the bitmap, not a descendant native text node of the click area.
#### Impact
Contact-specific Mark/Log/Contact and profile actions lack authored accessible names; users cannot reliably distinguish their targets or purpose.
#### Trigger / Preconditions
Any widget size or the empty configuration state with TalkBack.
#### Remediation Direction
Provide meaningful native names for click areas, including contact identity and action; expose useful status context where appropriate.
#### Verification
Inspect actual RemoteViews accessibility nodes and activate each action in small, large, and empty layouts.
#### Related Findings
AUD-UIA-004, AUD-UIA-008.
#### Planning Notes
The fixed headless dark palette, bitmap renderer, and shortened visible labels are authorized. Do not replace the widget architecture or change its action semantics.

### AUD-UIA-010 — Fixed heatmaps exceed available narrow-screen width
**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DESIGN, A11Y  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE, MANUAL-VISUAL

#### Summary
Two seven-column heatmaps allocate more width than their containers provide at narrower viewports.
#### Expected Behavior / Invariant
Day access and shared mobile reflow should remain usable; the current history contract rejects horizontal heatmap scrolling.
#### Observed Behavior
Cell widths and gaps are fixed independently of available width.
#### Evidence
`src/components/digest/YourWeekHeatmap.tsx:8,102–103`: 7×44 + 6×4 = **332dp**. `src/screens/DigestScreen.tsx:239` removes 32dp through horizontal padding, requiring a viewport of at least **364dp** before further constraints. At 360dp, only 328dp remains. `ActivityHeatmap.tsx:50,387,413–416` allocates 7×38 + 6×4 = **290dp**; Profile's screen and section-body padding (`ContactProfileScreen.tsx:670`, `ProfileModuleHost.tsx:517`) leave 256dp at a 320dp viewport.
#### Impact
The source layout budget cannot contain the full grid at those widths. Actual clipping, overflow, and tap reachability require rendering.
#### Trigger / Preconditions
Narrow viewport or increased Android display size reducing logical width.
#### Remediation Direction
Make the grid fit the actual container while preserving usable day access and the no-horizontal-scroll decision.
#### Verification
Measure/render at 320, 360, and wider logical widths with large text/display settings. Confirm every day remains reachable.
#### Related Findings
AUD-UIA-021.
#### Planning Notes
This is not a complaint about the explicitly deferred dense Year-cell target size.

### AUD-UIA-011 — Shared confirmation actions need large-text reachability verification
**Severity:** S2 — Moderate  
**Confidence:** C2 — Strong  
**Scope:** Cross-cutting  
**Type:** A11Y, DESIGN, INVESTIGATE  
**Disposition:** INVESTIGATE  
**Verification:** STATIC, DEVICE, MANUAL-VISUAL

#### Summary
The shared confirmation layout has no adaptive action-row or content-overflow escape at large font sizes.
#### Expected Behavior / Invariant
Theme dossier §H requires text scaling/reflow; irreversible confirmations must retain accessible explicit choices.
#### Observed Behavior
Actions occupy one nonwrapping horizontal row inside a padded, bounded card; buttons have no shrink/width constraint and content has no scroll wrapper.
#### Evidence
`src/components/ui/ConfirmDialog.tsx:114–135`; `Button.tsx:115–146`; AppText correctly honors font scaling. `src/screens/RecentlyDeletedScreen.tsx:107–116` supplies “Cancel” and “Delete permanently,” a concrete long-label consumer.
#### Impact
Large text or narrow screens may push explicit choices outside usable bounds. No rendered clipping was observed in this audit.
#### Trigger / Preconditions
Large system font/display size, long confirmation labels or body text.
#### Remediation Direction
If reproduced, retain readable, reachable explicit choices through adaptive layout/scrolling.
#### Verification
Render destructive and ordinary confirmations at maximum supported text/display settings; operate both choices with touch and TalkBack.
#### Related Findings
AUD-UIA-010.
#### Planning Notes
Do not make destructive dialogs Back/scrim-dismissable as a workaround; that would reverse ADR-086.

### AUD-UIA-012 — Loading/read failures are presented as empty, failed, or still running inconsistently
**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Cross-cutting  
**Type:** BUG, DESIGN  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary
Several screens do not distinguish pending, rejected, and successfully empty reads.
#### Expected Behavior / Invariant
Users should receive truthful progress and recovery information, consistent with screens that already separate these states.
#### Observed Behavior
Failure can remain “Importing,” become “No matching contacts,” or display an empty editor; ordinary pending work can appear failed.
#### Evidence
- `src/screens/ImportProgressScreen.tsx:43–47,54–74`: fatal catch logs only; “Importing…” remains. `services/import/import-driver.ts` can reject setup/session/finalization failures independently of isolated row failures.
- `ReconcileCompleteScreen.tsx:29–37`: `counts===null` during initial loading immediately renders “Couldn't load.”
- `src/components/ContactPicker.tsx` load catch sets `failed=true` and clears rows, but ListEmptyComponent chooses only “No contacts yet” versus “No matching contacts.”
- `MemoryScreen.tsx` load catch clears memories; the editor renders without a read-error state.
- `BackupSettingsScreen.tsx:71–83` swallows initial load failure; unknown nullable settings render encryption as Off. This is a display problem, not proof encryption changed.
- `DuplicateReviewScreen.tsx:135–142,245–253` alerts on failure, then can render the success-like “Nothing to review / All picked contacts were imported” empty state.
#### Impact
Users cannot reliably tell whether work is active, completed, empty, or failed, and may wait indefinitely or trust a false configuration summary.
#### Trigger / Preconditions
Pending or rejected local reads/import setup; no network dependency is needed to reproduce.
#### Remediation Direction
Keep loading, error, true empty, and no-match outcomes distinct, with meaningful recovery that preserves durable progress.
#### Verification
Inject delayed/rejected reads and import setup failure. Verify no success/empty claims before successful reads and no eternal progress after rejection.
#### Related Findings
AUD-UIA-013.
#### Planning Notes
Do not blindly rerun partially completed imports. Hardware Back may work; this report does not claim permanent trapping or data loss.

### AUD-UIA-013 — AI permissions summary confuses filtered results with actual access
**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Local  
**Type:** BUG, DESIGN  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary
Changing search/filter controls makes the screen state misleading global AI-access claims.
#### Expected Behavior / Invariant
Permission transparency must describe enabled access accurately and distinguish it from the current review result set.
#### Observed Behavior
The global-sounding summary and empty copy derive from filtered rows, including disabled rows when Enabled only is off.
#### Evidence
`src/screens/AIPermissionsScreen.tsx:109–119,282–299`; `ai-permissions-logic.ts:23–34,55–61`. The helper counts all supplied rows. An unmatched query yields “AI can't access any contact information yet”; disabling Enabled only counts disabled items as currently accessible.
#### Impact
Users can incorrectly believe AI access is absent or broader than it is. This report does not assert any change to actual egress permissions.
#### Trigger / Preconditions
Existing permission items plus a query/type filter or Enabled only turned off.
#### Remediation Direction
Separate actual enabled-access totals, filtered review counts, no matches, and unknown/error states.
#### Verification
Exercise mixed enabled/disabled records, unmatched search, type filters, initial loading, and rejected reads.
#### Related Findings
AUD-UIA-012.
#### Planning Notes
Preserve the existing consent/write model; the defect is presentation and aggregation meaning.

### AUD-UIA-014 — Backup encryption fields lack visible identification
**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Local  
**Type:** DESIGN, A11Y  
**Disposition:** OPEN  
**Verification:** STATIC, MANUAL-VISUAL

#### Summary
Sighted users receive multiple blank secure-input boxes without labels distinguishing their purposes.
#### Expected Behavior / Invariant
Passphrase, confirmation, and current/new passphrase fields are distinct inputs in Phase 17's form contract.
#### Observed Behavior
Only accessibility labels identify the individual fields; these do not render as visible labels.
#### Evidence
`src/screens/BackupSettingsScreen.tsx:518–545` has two secure inputs; `:583–624` has current/new/confirmation inputs. Neither group supplies per-field visible Text labels or placeholders. General helper copy does not identify each box.
#### Impact
Users must infer field meaning/order, increasing errors during encryption setup or change.
#### Trigger / Preconditions
Set up or change the backup passphrase.
#### Remediation Direction
Visibly identify each field while retaining secure entry and accessible names.
#### Verification
Verify field purpose is understandable before typing and remains understandable after entry/error; test enlarged text.
#### Related Findings
AUD-UIA-002, AUD-UIA-012.
#### Planning Notes
No change to encryption behavior, passphrase persistence, or security posture is implied.

### AUD-UIA-015 — Contact renderers bypass registered font-family mapping
**Severity:** S3 — Minor  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DESIGN  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE, MANUAL-VISUAL

#### Summary
List/Grid consume semantic font-family names as native family keys instead of resolving the bundled font registration.
#### Expected Behavior / Invariant
Semantic typography must map to the same loaded font families across equivalent content.
#### Observed Behavior
Contact renderers use `TYPOGRAPHY.*.family`, whose value is “Inter,” whereas the registered native keys are weight-specific.
#### Evidence
`src/components/ListRow.tsx:297,303,333`; `GridCard.tsx:407,414,424`; `src/theme/fonts.ts:36–42` registers `Inter-Regular`/`Inter-SemiBold`; `components/ui/AppText.tsx:35–40` performs the missing mapping. Installed expo-font `FontLoaderModule.kt:59` registers the supplied family key directly with ReactFontManager.
#### Impact
The card/list typography cannot reliably select the bundled family used by AppText; it can fall back despite successful font loading.
#### Trigger / Preconditions
Normal Android rendering of those text styles.
#### Remediation Direction
Resolve role/family/weight through the same canonical mapping as other semantic text.
#### Verification
Check native font selection and compare equivalent roles on a device with bundled fonts loaded; preserve deliberate row sizes/truncation.
#### Related Findings
AUD-UIA-007.
#### Planning Notes
This is a concrete registration mismatch, not a blanket demand to retrofit every historical raw Text or change approved legacy type sizes.

### AUD-UIA-016 — Settings children render duplicate Back controls
**Severity:** S3 — Minor  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DESIGN  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary
Settings pages adopted shared child chrome while retaining independent Back links.
#### Expected Behavior / Invariant
Shared shell chrome owns the child navigation affordance.
#### Observed Behavior
The app bar and body each render a Back action.
#### Evidence
`src/screens/SettingsAIScreen.tsx:140–157`, `SettingsOrreryScreen.tsx:75–92`, `SettingsAppearanceScreen.tsx:496–513`, `SettingsNotificationsScreen.tsx:230–247`; `src/components/ShellAppBar.tsx:107–110` renders Back for `variant="child"`.
#### Impact
Redundant navigation controls occupy content space and create duplicate accessibility stops across these equivalent pages.
#### Trigger / Preconditions
Open those Settings children.
#### Remediation Direction
Use one canonical Back affordance per child surface.
#### Verification
Check visible/accessibility controls and Back behavior with transient UI open.
#### Related Findings
AUD-UIA-017.
#### Planning Notes
Preserve shell transient-dismissal behavior. This is different from an older screen that has not yet adopted ShellAppBar at all.

### AUD-UIA-017 — Settings directory omits specified icons/navigation affordances
**Severity:** S3 — Minor  
**Confidence:** C3 — Confirmed  
**Scope:** Local  
**Type:** DESIGN  
**Disposition:** OPEN  
**Verification:** STATIC, MANUAL-VISUAL

#### Summary
The current Settings directory implements only two parts of its specified row composition.
#### Expected Behavior / Invariant
`docs/dossier/milestone-2/phase-37-settings-personalization-dossier.md:47–48` specifies icon, concise title, descriptive subtitle, and navigation affordance.
#### Observed Behavior
Production rows contain only title/subtitle Text children.
#### Evidence
`src/screens/SettingsHubScreen.tsx`, `SETTINGS_HUB_ROWS.map` render block: no leading semantic icon or trailing navigation indicator. The explicit accessibility label includes only the title, omitting the descriptive subtitle.
#### Impact
The directory lacks the agreed scanning/navigation cues and does not communicate the subtitle through its button name.
#### Trigger / Preconditions
Settings root.
#### Remediation Direction
Match the authorized directory row contract and distinguish navigational rows from the widget utility action.
#### Verification
Compare production rows to the dossier and inspect accessible descriptions.
#### Related Findings
AUD-UIA-016.
#### Planning Notes
No new icon family or redesigned Settings information architecture is needed or authorized by this audit.

### AUD-UIA-018 — Explicit timestamps still bypass the shared presentation contract
**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** DESIGN, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary
Equivalent interaction/event timestamps vary between storage strings, ad-hoc 24-hour slices, and the shared minute/12-hour convention.
#### Expected Behavior / Invariant
Phase 38.1 dossier §K and CONTEXT D-08 require app-wide minute precision, default 12-hour formatting, and one shared formatter. Stored precision stays unchanged.
#### Observed Behavior
Some detail/form views expose the raw timestamp including seconds; other views independently slice HH:mm.
#### Evidence
`src/screens/GroupEventDetailScreen.tsx:183` passes raw `event.occurredAt` to an unchanged-value DetailField; `GroupEventsScreen.tsx:28–31,131` has a local formatter. `src/components/digest/DigestDayDetail.tsx:17–18,60,86` and `history/DateDetailSheet.tsx:64–65,220,254,282` slice 24-hour time. `TouchpointRefineForm.tsx:259–260` displays raw `value.occurredAt`.
#### Impact
The same event changes presentation across screens and seconds reappear contrary to the current explicit decision.
#### Trigger / Preconditions
Open the relevant event/history/details/editing surfaces.
#### Remediation Direction
Route explicit display timestamps through the shared presentation contract, preserving stored values and native editor precision.
#### Verification
Use identical AM/PM, midnight, and minute-boundary fixtures across all consumers; assert no accidental seconds.
#### Related Findings
None.
#### Planning Notes
Relative language is excluded. The future user-selectable 12/24-hour preference remains deferred; do not add it as an audit fix.

### AUD-UIA-019 — Reconciliation cards substitute database IDs for contact identity
**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** BUG, DESIGN  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary
Linked-contact reconciliation loses the recognizable identity expected of the shared candidate card.
#### Expected Behavior / Invariant
Phase 20 UI-SPEC:273–276 requires the Orbit person's name and photo, with fallback only when no photo exists.
#### Observed Behavior
Every reconciliation item is named “Contact N” and receives no photo URI.
#### Evidence
`src/screens/ReconcileGridScreen.tsx:239–246` explicitly assigns ``name: `Contact ${card.contactId}``` and `photoUri:null`. `src/components/CandidateCardGrid.tsx:166–205` uses this name for the accessible label and visible identity. `ReconcileDetailScreen.tsx:143–145` also has a generic header rather than the specified contact-name header.
#### Impact
Users cannot identify whose changes they are reviewing from the grid, unlike comparable duplicate/contact review surfaces.
#### Trigger / Preconditions
One or more linked contacts with reviewable changes.
#### Remediation Direction
Carry real contact identity into the existing review presentation without changing reconciliation semantics.
#### Verification
Review multiple named contacts with/without photos; visible and accessible identity must match each target.
#### Related Findings
AUD-UIA-008.
#### Planning Notes
Keep stable IDs as internal identity and retain genuine missing-photo fallback. This is not a matching/data-integrity finding.

### AUD-UIA-020 — Model picker does not identify the saved selection
**Severity:** S3 — Minor  
**Confidence:** C3 — Confirmed  
**Scope:** Local  
**Type:** DESIGN, A11Y  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary
Reopening the model picker gives no visible or semantic indication of the configured model.
#### Expected Behavior / Invariant
Phase 36 UI-SPEC:85,242 explicitly requires selected-model state.
#### Observed Behavior
Catalog cards render identically; manual model text initializes empty. Saving exits, but presentation never reads the saved choice.
#### Evidence
Full `src/screens/AIModelPickerScreen.tsx` state/load/choose flow and model-card render at `:239–303`; no current-model comparison, selected marker, or selected accessibility state. The config store is used to rehydrate after a write, not to render the prior selection.
#### Impact
Users cannot verify the current model from its chooser and may unnecessarily reselect or misunderstand configuration.
#### Trigger / Preconditions
A saved model followed by reopening the picker.
#### Remediation Direction
Identify the remembered model visually and semantically, including manual/unlisted IDs.
#### Verification
Select, exit, and reopen for each lane; verify persisted choice and distinct catalog-unavailable behavior.
#### Related Findings
AUD-UIA-005, AUD-UIA-006.
#### Planning Notes
Do not confuse active connection state with per-lane remembered model state or change activation policy.

### AUD-UIA-021 — Profile layout preview uses incompatible gap/column geometry
**Severity:** S3 — Minor  
**Confidence:** C3 — Confirmed  
**Scope:** Local  
**Type:** DESIGN, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, MANUAL-VISUAL

#### Summary
The editor's “Live preview” cannot reproduce the actual profile's row packing for adjacent compact tiles.
#### Expected Behavior / Invariant
A layout preview should communicate the layout users will see after applying their choices.
#### Observed Behavior
Preview column percentages consume 100% of the row before gaps are added.
#### Evidence
`src/components/profile/ProfileLayoutEditor.tsx:200–226` assigns `flexBasis=(columnSpan/columns)*100%`; `:435` adds a 4dp gap with wrapping. Two half-width tiles need 100%+4dp. `RelationshipOverview.tsx:46–52` instead subtracts gaps before deriving actual column widths.
#### Impact
The preview's row breaks can disagree with the rendered profile despite using the same packing model.
#### Trigger / Preconditions
Multiple compact tiles in a multi-column overview.
#### Remediation Direction
Make preview and actual presentation share compatible available-width/gap accounting.
#### Verification
Compare compact/auto/wide combinations at different widths and font scales; confirm the preview predicts the actual row arrangement.
#### Related Findings
AUD-UIA-010.
#### Planning Notes
Preserve the owner-retained compact/wide controls and visual-only orphan stretching; do not rewrite saved layout choices.

### AUD-UIA-022 — Contacts groups whole interactive regions as accessible elements
**Severity:** S2 — Moderate  
**Confidence:** C2 — Strong  
**Scope:** Local  
**Type:** A11Y, INVESTIGATE  
**Disposition:** INVESTIGATE  
**Verification:** STATIC, DEVICE

#### Summary
Normal Contacts mode marks large containers around independent controls as accessible groups.
#### Expected Behavior / Invariant
Opening panels should hide underlying content; normal navigation should retain meaningful individual controls/results.
#### Observed Behavior
The app-bar and search/list/grid wrappers set `accessible=true` whenever no panel is open.
#### Evidence
`src/screens/HomeScreen.tsx:1648–1651,1714–1718`: `accessible={!panelOpen}` accompanies separate `importantForAccessibility` hiding. Installed RN `ReactViewManager.kt:95–97` maps accessible to native focusability.
#### Impact
Potential giant/redundant accessibility stops and disrupted nested navigation. Source does not establish that every contact is unreachable.
#### Trigger / Preconditions
TalkBack in ordinary Contacts mode, then opening/closing filter panels.
#### Remediation Direction
If reproduced, retain individual traversal and panel isolation without making the whole interactive region a single focus target.
#### Verification
Inspect native nodes and traverse app bar, search, list/grid rows, favourite controls, and panel return focus.
#### Related Findings
AUD-UIA-007, AUD-UIA-023.
#### Planning Notes
Do not remove the correct `no-hide-descendants` behavior while a panel is open.

### AUD-UIA-023 — Closed FAB actions remain mounted without accessibility hiding
**Severity:** S2 — Moderate  
**Confidence:** C2 — Strong  
**Scope:** Cross-cutting  
**Type:** A11Y, INVESTIGATE  
**Disposition:** INVESTIGATE  
**Verification:** STATIC, DEVICE

#### Summary
The collapsed speed dial hides its actions visually and from pointer input, without an explicit accessibility-state boundary.
#### Expected Behavior / Invariant
Closed transient actions should not appear as available controls to assistive technology.
#### Observed Behavior
All action rows and the dismiss scrim remain mounted at opacity zero, with pointer events disabled. No accessibility hiding or expanded state describes the closed/open distinction.
#### Evidence
`src/components/UniversalFab.tsx`, `UniversalFabActionRow`, `scrimPointerEvents`, and unconditional `UNIVERSAL_FAB_ACTIONS.map` in its render. Installed RN `ReactViewManager.kt:300–303` and `ImportantForInteractionHelper.kt` treat pointer events separately from `BaseViewManager.java:474–483` accessibility importance.
#### Impact
Invisible actions may remain discoverable or produce confusing focus order. Native alpha visibility policy must be checked before declaring actual exposure.
#### Trigger / Preconditions
TalkBack with the dial closed/open/closing, including navigation and keyboard transitions.
#### Remediation Direction
If exposed, make the semantic tree track dial visibility and announce expansion coherently while preserving focus restoration.
#### Verification
Compare native accessibility trees and traversal in each state; no hidden action should be focusable or invokable.
#### Related Findings
AUD-UIA-022.
#### Planning Notes
Existing keyboard hiding, focus restoration, measured bottom offset, and contextual action routing should be preserved. Lack of an explicit reduced-motion hook here alone is not proof of a motion defect.

## Cross-Finding Patterns

- **Shared safeguards are optional at call sites.** Independent buttons, switches, text renderers, and candidate cards lose guarantees already present in shared primitives. The concrete losses matter more than a raw count of token imports.
- **Visual text and accessible text diverge.** Explicit parent labels often omit useful descendant state/context; sibling text does not automatically name switches, and widget bitmap text cannot name native click areas.
- **State presentation is not consistently modeled.** Pending, rejected, filtered-empty, and genuinely empty results are conflated in multiple unrelated workflows.
- **Geometry is reimplemented.** Fixed heatmap cells and percentage preview columns ignore their enclosing gutters/gaps, while the actual profile overview already measures width.
- **Passing token tests are narrower than rendered accessibility.** Tests do not prove actual text/pixel overlap, native focus behavior, or large-font action reachability; the Standard Light test bound itself is incomplete.

## Reviewed Areas With No Material Findings

- ThemeProvider resolves four package/mode palettes and curated accent tones; appearance choices are independently remembered. Package filtering of background choices is present in `settings-appearance-background.ts` and its live caller.
- Shared Button enforces icon-only labels, minimum targets, disabled state, and destructive warning glyphs. AppText retains OS scaling and resolves registered font families correctly.
- Shared Sheet uses bottom SafeAreaView; shell browse content has measured tab/FAB clearance rather than a universal guessed bottom inset. UniversalFab uses measured tab height and hides during focused workflows/keyboard use.
- Standard translucency, Galaxy Android elevation omission, and dedicated Orrery overlay tint use the current token API. These are authorized differences, not competing component families.
- Orrery mounting is gated by measurement, focus, and foreground; pause paths exist on blur/background. Twinkle and switch/camera behavior consume reduced-motion state. Rolodex offers named stepper alternatives and simplifies reduced-motion presentation.
- Profile layout reordering has named Move up/down alternatives. RelationshipOverview measures width/font scale, exposes tile values in accessible labels, and hides decorative content.
- Create/Edit and group workflows substantially reuse field dispatch, contact methods, category selection, interaction forms, and participant overrides. There is no reason to replace deliberate field-scope differences with one identical form.
- Restore preview distinguishes expired, busy, and apply-failure states. BulkReview and ImportComplete have distinct read-failure/loading handling. FieldChoiceGroup exposes value/provenance and selection; PhotoChoice has image-failure fallback.

## Accepted / Deferred / Rejected Candidates

| Candidate | Disposition | Authority / reason |
|---|---|---|
| Make Standard entirely opaque/flat again | FALSE-POSITIVE | ADR-115 partially supersedes ADR-087 and explicitly authorizes matched-mode glass. |
| Restore Android elevation on translucent Galaxy cards | FALSE-POSITIVE | ADR-115 intentionally removes it to avoid the opaque Android artifact. |
| Flag all raw Text, 10/14/20 spacing, or radius10 utility cards | DEFERRED / intentional | ADR-086 defers legacy adoption; Phase 20 UI-SPEC explicitly permits these legacy values. Specific current defects remain OPEN above. |
| Galaxy Dark onDanger/danger below normal-text AA | ACCEPTED as owner-flagged exception | ADR-084 preserves protected legacy hues rather than authorizing automatic retuning; approximately 3.91:1 is already recorded. This is not a claim of AA compliance. |
| Tiny dense Year heatmap targets | DEFERRED | Existing ActivityHeatmap/history contract explicitly defers this density/target limitation to hardening. Distinct from fixed-width overflow above. |
| Grid has less ordinary context than List | FALSE-POSITIVE | Phase 38.1 deliberately removes normal Grid excerpts. Search context that is actually displayed is covered by AUD-UIA-007. |
| Widget always uses headless dark palette | ACCEPTED | ADR-042 authorizes direct dark preset resolution. Its missing native action names are a separate defect. |
| Back/scrim cannot dismiss destructive ConfirmDialog | FALSE-POSITIVE | Explicit ADR-086 safety choice; must remain intact during reflow work. |
| Orrery uses a different background/control treatment | ACCEPTED | Theme dossier §R and ADR-149 designate an intentional visualization exception. |
| Background choices no longer show both packages together | FALSE-POSITIVE | Newer Settings D-07 active-package guard governs the live selector. |
| Future 12/24-hour preference absent | DEFERRED | Phase 38.1 D-08; current default formatter still must be used. |
| Every `background` foreground on accent fails contrast | FALSE-POSITIVE | Current curated combinations pass for that pair; AUD-UIA-002 is the independently failing `textPrimary` pair. |
| Native fade / Reanimated withTiming without a local reduced-motion hook is automatically a defect | Not admitted | Native/system and animation-library behavior must be considered; no independent failure was established. |

## Coverage Limitations / Follow-up Investigation

This is not a visual certification, a TalkBack certification, or a claim that every route was exhaustively rendered. No device, emulator, screenshots, keyboard interaction, or performance measurements were used. Manual checks should preserve the code-detectable/manual distinction:

| Follow-up | Source evidence / reason | Needed verification |
|---|---|---|
| Native focus for shared overlays | BaseOverlay focuses a non-accessible wrapper from an effect before native onShow, and has no general opener restoration. Native Modal supplies isolation, so a background-focus leak is not established. | TalkBack open/dismiss/return, nested modal cases, keyboard focus. |
| Bare chrome on newer Settings/AI routes | `focused-route-classification.ts` lists Settings root as dense but omits SettingsAppearance/Notifications/etc and AI leaves, which default to presentation. Several headings/helper lines sit outside GlassSurface/ChromeScrim. | Verify intended density and actual foreground/backdrop combinations in all four modes; do not claim a specific layout looks wrong from source alone. |
| Focused-form bottom insets and keyboard | RootNavigator provides top safe area; shared Sheet handles bottom, but focused forms and legacy modals have mixed bottom-inset/keyboard strategies. | Gesture and three-button navigation, keyboard open, last field/action, display scaling. |
| Peripheral overlay stacking | AssistBanner uses fixed top64; Snackbar uses bottom112; FAB clearance is measured. Different positioning is source-visible, but actual collision is not proven. | Banner + snackbar + FAB + tab bar, long names, large text, accessibility traversal. |
| Long completion screens | ImportComplete/ReconcileComplete use fixed View trees with multiple count/action rows and no scroll escape. | Small viewport and maximum text; confirm final actions remain reachable. |
| Broad typography/geometry polish | Several older components retain system fonts, radius8/10/14, raw spacing, unicode icons, and independent scrims. Some are explicitly historical exceptions. | Owner/design review against current screen-specific intent before admitting more migration work. |
| More repeated context labels | Events rows, history details, Settings subtitles, and participant Edit/Remove actions omit some neighboring visible context from their explicit control name. | Task-oriented TalkBack traversal, including direct button navigation; extend summaries only where information is actually lost. |
| Assets and custom profile backgrounds | Static calculations cover the named bundled Standard pixels, not every arbitrary app-owned profile photo/crop and real blur result. | Actual composited text at representative scroll positions and extreme photo luminance. |

For release verification, cover Galaxy/Standard × Light/Dark, both default and contrasting curated accents, None/Solid plus bright/dark bundled assets, empty/populated/error states, narrow widths, enlarged font/display sizes, TalkBack, reduced motion, focus/background transitions, and keyboard/safe-area interactions. These are verification dimensions, not an implementation plan or an expansion of the owner's accepted design decisions.
