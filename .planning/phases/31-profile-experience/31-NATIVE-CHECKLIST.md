# Phase 31 Profile — Physical Pixel acceptance checklist

**Target:** Physical Pixel only; do not substitute the desktop emulator for accessibility, crop, gesture, or performance evidence.

**Build/runtime:** package `com.bwales.orbit`; Metro tmux session `orbit`; use `emu-connect`, then resolve exactly one authorized serial with `~/.local/bin/adb devices -l`.

**Status:** Complete. Standalone-release evidence, focused automation/code audit, the seven bounded owner-smoke journeys, and targeted post-fix owner approvals collectively cover all rows. Automated evidence is not represented as physical observation.

## Evidence header

Recorded 2026-09-09T16:38:10-05:00:

- `emu-connect status`: `device`; exactly one authorized USB target.
- Authorized physical serial/model: `1A071FDEE002BU` / Pixel 6 Pro (`raven`).
- APK/runtime: `com.bwales.orbit` debug `1.0.0` (versionCode 1); Orbit Metro listened on host `8082`, with device `tcp:8082` reverse-mapped to it.
- Theme/mode observed: Galaxy dark.
- Seed contact exercised: bound Andrew Wales; existing UAT contacts remain available for the owner scenarios.

## Plan 31-11 focused debug evidence (not final UAT sign-off)

Recorded 2026-09-09 on the authorized physical Pixel 6 Pro. These inspected
screenshots close only the five renderer/presentation gaps addressed by Plan
31-11; the remaining rows below remain owner-facing release verification.

| Gap | Evidence | Observation |
|---|---|---|
| G01 Profile readability/background host | [ordinary Profile](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-11-debug/06-profile-background-factory-collapse.png) | Galaxy's local theme background fills behind the Profile with no intrinsic-size black tile or opaque grey wash. The Hero, section labels, and controls remain legible. The seeded contact has no saved app-owned background, so this records the reachable theme-backed resolution rather than fabricating an image assignment. |
| G02 Layout chooser/editor geometry | [chooser](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-11-debug/01-layout-chooser.png), [editor top](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-11-debug/02-layout-editor-top.png), [editor scrolled](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-11-debug/03-layout-editor-scrolled-footer.png) | The chooser is bounded to its content. The editor uses the available sheet body; after scrolling through sections, Cancel, Save as template, and Save layout remain persistent above navigation. |
| G03 Background manager | [empty manager](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-11-debug/05-background-manager-empty.png) | The reachable empty state visibly exposes the Back and Choose photo actions plus explanatory copy; it is no longer an empty expanded shell. The focused `background-manager-model` suite covers loading, error/retry, and populated list contracts. Those artificial states were not mutated into the owner's local contact data. |
| G04 Factory collapse | [ordinary Profile](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-11-debug/04-profile-compact-header-factory-collapse.png) | Relationship Overview, Things to Remember, Contact Methods, and Interaction History render collapsed for the factory presentation. |
| G05 Compact Profile bar | [ordinary Profile](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-11-debug/04-profile-compact-header-factory-collapse.png), [1.30x font scale](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-11-debug/08-profile-large-text-clean.png) | One compact row contains icon-only Back and overflow controls. At 1.30x system font scale, both controls and all collapsed section affordances remain reachable; the prior 1.15 scale was restored after capture. |

Focused automated gate: 9 Vitest files / 78 tests passed, followed by `npx tsc --noEmit` and `npm run check:colors` (2026-09-09). The existing resolver/schema tests cover factory defaults and stored-presentation precedence; no contact state was changed for debug capture.

## Plan 31-12 standalone-release evidence (not owner acceptance)

Recorded 2026-09-09 on the same authorized physical Pixel 6 Pro. A droid-built
standalone `com.bwales.orbit` release APK was installed after the
`react-native-screens` generated-code source-set repair. The first release launch
failed with the missing generated `RNSScreenContainerManagerInterface` class; the
repair was rebuilt cleanly, verified in the final APK, and the final APK launched
to Orbit. The repaired launch, rather than the transient initial failure, is the
recorded release evidence; no failure is waived.

The following final-release screenshots were inspected directly (uiautomator was
used only for control bounds):

| Repaired state | Inspected evidence | Observation |
|---|---|---|
| Galaxy factory Profile | [Galaxy factory Profile](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-12-release/release-profile-galaxy-factory.png) | Local Galaxy art is full bleed behind Profile. No intrinsic black tile or opaque page wash appeared; the compact Back/overflow row and all four factory sections are readable and collapsed. |
| Standard factory Profile | [Standard factory Profile](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-12-release/release-profile-standard-factory.png) | Standard also rendered full bleed with readable content and the compact factory presentation, without a tile or opaque wash. Galaxy was restored afterward. |
| Overflow | [release overflow](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-12-release/release-profile-overflow.png) | The inherited-layout menu visibly ordered Edit Contact, Snooze, Archive, a separator, Profile Layout, Background, then Reset. |
| Layout chooser at 1.15x font | [fixed chooser](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-12-release/release-layout-chooser-fixed.png) | After the shared Sheet height repair, `Edit layout` has a visible 161-pixel target (`[85,2567][1355,2728]`), rather than the prior clipped 47-pixel target; Close is also fully visible above navigation. |
| Layout editor at 1.15x font | [fixed editor](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-12-release/release-layout-editor-fixed.png) | The scrollable editor shows its live preview and controls while Cancel layout changes, Save as template, and Save layout remain visible/reachable above system navigation. |
| Background manager empty state | [empty manager](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-12-release/release-background-manager-empty.png) | The real local state showed Back, Choose photo, and explanatory copy—not a blank drawer. No loaded/error/populated state was injected into owner data; `background-manager-model` automated coverage exercises those safe model contracts. |

Final automated gate: the nine focused Vitest files passed all 78 tests, then
`npx tsc --noEmit` and `npm run check:colors` passed (2026-09-09). The final
standalone release is left at the documented droid output path:
`C:\\Users\\bwales\\projects\\orbit-app\\android\\app\\build\\outputs\\apk\\release\\app-release.apk`.

## Final focused automation reconciliation (2026-09-10)

The Profile/background/crop suite passed **31 files / 170 tests** after restoring
the ADR-074 widget Reach-out consumed-once route. `npx tsc --noEmit`, targeted
Biome, and `npm run check:colors` also passed. Rows credited below by automation
cover deterministic data, state-model, persistence, ordering, and local-read
contracts. They do not claim visual, gesture, screen-reader, or native-intent
behavior that only a person using the release build can establish.

The final owner-smoke APK was rebuilt from commit `a1e15e5` after those checks.
Gradle reported `BUILD SUCCESSFUL`; the artifact remains at
`C:\Users\bwales\projects\orbit-app\android\app\build\outputs\apk\release\app-release.apk`
(201,088,487 bytes, SHA-256
`50791b48c4feb5b786736cd5deb0fa95e8cf5df87f370404aa51fa2f3220f318`).

## Post-review-fix release addendum (2026-09-10)

The four reviewed findings (`e7db666`, `3c4ac77`, `341ce5c`, and `86929cf`)
were rebuilt from current HEAD with a clean droid `npm ci` (which applied
`react-native-screens@4.26.2`), clean Expo Android prebuild, and
`assembleRelease --console=plain --no-daemon`. The resulting standalone APK is
at `C:\\Users\\bwales\\projects\\orbit-app\\android\\app\\build\\outputs\\apk\\release\\app-release.apk`
and has SHA-256
`fdda5f69ba95b794b847bc78e9b821c6b4fbbcf38671bbf11d48f08eaf60532d`.

- The current APK installed successfully on the same authorized Pixel 6 Pro,
  launched standalone, and rendered Orbit's home shell. The shell was directly
  inspected at [release-post-review-home.png](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-12-release/release-post-review-home.png).
- The focused review regression suite passed all current 74 tests across 10
  files, followed by `npx tsc --noEmit`, `npm run check:colors`, and
  `git diff --check`.
- The first post-review and final-release picker attempts returned the manager's
  safe retryable error state. Immediate retries and repeated debug-client runs
  opened Android's local-only system picker normally.
- Real portrait and landscape sources reached the repaired crop editor. After a
  focused review caught the first redesign clipping its preview, `91cc837`
  separated the header, measured preview region, and controls. The final release
  rendered the complete 838×1816 Profile-aspect canvas between those controls,
  exposed every named pan/zoom action through the horizontal strip, and kept
  Cancel and Use background reachable at 1.15x font. Cancel followed by Discard
  closed the draft without creating or assigning a new background. Evidence:
  [final crop](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-12-release/release-final-crop-ui.xml)
  and [scrolled controls](/home/bwales/projects/orbit-app/.planning/phases/31-profile-experience/evidence/31-12-release/release-final-crop-controls-ui.xml).

## Post-Plan-31-13 crop reconciliation (2026-09-10)

Plan 31-13 supplied physical-Pixel evidence for direct drag and bounded
portrait/landscape selection. The owner then directly exercised and explicitly
approved the final editor's genuine touch/pinch behavior: “amazing and exactly
what I was looking for.” That approval closes only the crop interaction rows
below. It is not evidence for the independent pending accessibility, varied-data,
navigation, assignment-hierarchy, or theme rows.

## Checklist

Mark every row PASS/FAIL with a short observation. A failed row is a gap for planning, not an implicit waiver.

| # | Area | Verification | PASS/FAIL + evidence |
|---:|---|---|---|
| 1 | Target | `emu-connect` selects `device`, not remote emulator; exactly one authorized physical Pixel is listed. | PASS — `emu-connect status` reported `device`; `adb devices -l` reported only Pixel 6 Pro serial `1A071FDEE002BU`. |
| 2 | Shell | Dashboard → Profile → Back returns to the same Dashboard state. | PASS — Dashboard card opened Andrew Wales Profile; Android Back returned to the same populated Dashboard grid. |
| 3 | Shell | Orrery → Profile → Back returns to Orrery without changing its selected system. | PASS — OWNER-OBSERVED in owner-smoke Journey 1. |
| 4 | Shell | Settings/Archived → Profile → Back returns to its source stack. | PASS — OWNER-OBSERVED in owner-smoke Journey 1. |
| 5 | Shell | Widget contact deep link opens Profile and Back returns to Dashboard. | PASS — OWNER-OBSERVED in owner-smoke Journey 1. |
| 6 | Shell | Notification Profile/reach entry returns through its reset Dashboard stack; Reach Out opens once. | PASS — OWNER-OBSERVED where available in Journey 1; reset and consumed-once behavior additionally pass automated route tests. |
| 7 | Hero | Bound contact shows fixed avatar/name/Category/Favorite/Message/Call/one overflow in both themes. | PASS — standalone-release Galaxy and Standard factory captures show Andrew Wales's avatar/name/Family Category/Favorite/Message/Call and one overflow control. |
| 8 | Hero | Missing phone/email retains Message and Call geometry, with accurate disabled reasons. | PASS — OWNER-OBSERVED in Journey 2; capability/reason model additionally automated. |
| 9 | Hero | Long name/category at large text wraps/reflows without overlap or a shrunk semantic role. | PASS — OWNER-OBSERVED in Journey 2. |
| 10 | Hero | Favorite changes only after its committed write and survives focus/relaunch. | PASS — OWNER-OBSERVED in Journey 2. |
| 11 | Methods | Complete long phone/email values are readable/accessibly named; malformed values are explained and not actionable. | PASS — OWNER-OBSERVED in Journey 2; value/actionability/a11y-label shaping additionally automated. |
| 12 | Methods | Call/Message/Email opens the expected user-triggered native handoff; no interaction is falsely logged as completed. | PASS — OWNER-OBSERVED in Journey 2. |
| 13 | Lifecycle | Bound contact shows truthful Status/Frequency/Snooze behavior. | PASS — AUTOMATED: Profile lifecycle, metric, frequency, and snooze models plus DAO tests. |
| 14 | Lifecycle | Unbound dormant cadence is marked inactive, never treated as Bound. | PASS — AUTOMATED: `profileLifecycleView` and dormant-cadence tests. |
| 15 | Lifecycle | Unbound null cadence has no fabricated status; Bind requires a valid selected cadence. | PASS — AUTOMATED: lifecycle and metric null-cadence cases. |
| 16 | Lifecycle | Bind/Unbind confirmation and resulting state preserve relationship data/history. | PASS — AUTOMATED: lifecycle DAO/effects contracts preserve cadence, Favorite, and relationship history. |
| 17 | Overview | All enabled factory Overview modules appear in stable order and auto-pack without holes at ordinary width. | PASS — AUTOMATED: registry and deterministic row-major packing tests. |
| 18 | Overview | Narrow width/large text reduces columns and grows tiles while retaining text and 44px targets. | PASS — OWNER-OBSERVED in Journey 2; narrow-column packing additionally automated. |
| 19 | Status | Status sheet names actual cadence/last-contact/Rarely Responds inputs and no Health/Gravity factors. | PASS — AUTOMATED: relationship explanation and metric-factor tests. |
| 20 | Gravity | Gravity explanation is textual and visual reinforces it without being the sole channel. | PASS — AUTOMATED/CODE AUDIT: explicit textual model and non-editable derived metric contract. |
| 21 | Intensity | Bound Intensity uses its cadence window; Unbound/null cadence says `This month`. | PASS — AUTOMATED: cadence-window and calendar-month boundary tests. |
| 22 | Frequency | Every frequency choice commits, refreshes Profile facts, handles pending/error/retry, and dismisses cleanly. | PASS — AUTOMATED: choice/state model and transactional DAO tests cover success, pending, failure, retry, dismissal, and revision refresh. |
| 23 | Snooze | Presets, custom future date, Unsnooze, pending/error/retry, and Back/scrim dismissal work. | PASS — AUTOMATED: preset/custom-date, transaction, dedupe, failure/retry, and dismissal tests. |
| 24 | History seam | Status → History and View all history retain the bounded Phase 31 renderer seam. | PASS — AUTOMATED/CODE AUDIT: stable History semantic identity and Profile navigation wiring. |
| 25 | Collapse | Collapse one top-level section, restart, and confirm durable readback/accessible expanded state. | PASS — AUTOMATED: database round-trip and committed-readback tests. |
| 26 | Collapse | Collapse one Things-to-Remember child, restart, and confirm it remains scoped to that child. | PASS — AUTOMATED: closed semantic collapse keys and per-child persistence tests. |
| 27 | Collapse | Simulated/observed persistence failure retains visible state and exposes Retry rather than a false update. | PASS — AUTOMATED: failure retains prior published state; Retry model is covered. |
| 28 | TTR | Empty sections retain useful summaries; partial facts do not fabricate values. | PASS — AUTOMATED: module-registry and knowledge-presentation empty/partial contracts. |
| 29 | TTR | Cards, capped counts, View all, and Show hidden use stable semantic order. | PASS — AUTOMATED: knowledge presentation order/cap/hidden-recovery tests. |
| 30 | TTR | Tap detail, long-press management, and accessibility actions reach source-owner management flows. | PASS — OWNER-OBSERVED in Journey 3. |
| 31 | Off Limits | Ordinary Off Limits uses caution semantics, no sparkle, and no inferred AI permission. | PASS — AUTOMATED/CODE AUDIT: explicit Off Limits negative-constraint test. |
| 32 | Custom fields | Invalid values expose their recovery state; long/grouped values remain understandable. | PASS — AUTOMATED: exhaustive type formatting, invalid raw-value history, and grouping tests. |
| 33 | Overflow | Exact order: Edit, Snooze/Unsnooze, Archive, separator, Profile Layout, Background, conditional Save, conditional Reset. | PASS — OWNER-OBSERVED in Journey 4; base and conditional ordering additionally automated. |
| 34 | Overflow | No Profile AI-draft action appears; Message → Compose remains available. | PASS — OWNER-OBSERVED in Journey 2; absence of Profile AI additionally code-audited. |
| 35 | Overlay | A topmost sheet makes Profile underlay inert; Android Back closes the topmost sheet before native-stack Back. | PASS — clean Profile actions sheet dimmed the underlay; first Android Back dismissed it while retaining Profile, second Back returned to Dashboard. |
| 36 | Layout | Profile Layout edit shows fixed-Hero preview, drag plus Move controls, visibility/default expansion, and legal size options. | PASS — the owner directly performed and approved the physical-Pixel press-drag-release reorder after Plan 31-14. Named Move controls remain the accessible fallback; reducer and component contracts retain legal-bucket validation. Evidence: owner `approved` response 2026-09-10; `layout-editor-reducer.test.ts`; `profile-layout-editor.contract.test.ts`. |
| 37 | Layout | Long labels retain Save/Cancel/reorder reachability at large text and screen reader. | PASS — OWNER-OBSERVED across Journeys 4 and 7 after direct-drag remediation. |
| 38 | Layout | Cancel/dirty dismissal preserves committed layout; Save commits complete layout and reloads it. | PASS — OWNER-OBSERVED in Journey 4; session/DAO failure safety additionally automated. |
| 39 | Templates | Create/rename/preview/assignment/usage/delete flows describe inherited vs contact override truthfully. | PASS — OWNER-OBSERVED in the final bounded re-test: shared discovery, functional Preview, and arbitrary-contact assignment were approved. Component/DAO tests additionally prove layout-only assignment and sibling-axis preservation. |
| 40 | Templates | Save Current Layout as Template appears only for freeform layout; Reset appears only for contact overrides. | PASS — AUTOMATED: conditional overflow entries and presentation-source resolution tests. |
| 41 | Reset | Reset confirmation says contact facts/Favorite/Snooze/AI/knowledge remain unchanged, then verifies that result. | PASS — AUTOMATED/CODE AUDIT: reset deletes only contact presentation; confirmation names preserved data. |
| 42 | Background | Template list/picker uses only local device media and keeps Cancel/error drafts/committed background safe. | PASS — the final release showed the safe retryable error on its first picker attempt, then opened Android's local system picker on immediate retry. Both source orientations reached crop in debug; final-release Cancel → Discard returned without creating or assigning a new background. |
| 43 | Crop | Portrait crop: drag, pinch, named controls, min/max bounds, preview and output aspect all agree. | PASS — Pixel artifacts `20-portrait-contained.*` → `21-portrait-horizontal-left.*` prove contained source and direct drag; `19-fine-tune-zoom.*` proves named controls/zoom. The owner then directly approved genuine touch/pinch behavior (2026-09-10). |
| 44 | Crop | Landscape crop: same bounds/aspect/reachable controls; no hidden clipping. | PASS — Pixel artifacts `17-landscape-contained.*` → `18-landscape-horizontal-left.*` prove complete landscape source, bounded selection, direct drag, and no hidden clipping. The owner then directly approved genuine touch/pinch behavior (2026-09-10). |
| 45 | Background | Assignment at contact/Category/global resolves correctly; Profile restarts with readable scrim treatment. | PASS — OWNER-OBSERVED on the authorized debug Pixel: a saved global background appeared on an unrelated inheriting Profile; Clear global background, leave, and reopen restored the active theme background rather than the saved image. Fresh-read DAO/resolver tests cover Category clear, contact inherit, exact precedence, and sibling-axis preservation (27 focused tests passed); no release build was made. |
| 46 | Theme | Galaxy and Standard, light/dark as available, retain hierarchy, contrast, and no hardcoded-color regressions. | PASS — OWNER-OBSERVED in Journey 6; Galaxy/Standard release captures and the color-token guard provide retained evidence. |
| 47 | Accessibility | TalkBack announces Hero actions, disabled reasons, section expanded state, selection, and sheet focus. | PASS — OWNER-OBSERVED in Journey 7. |
| 48 | Accessibility | Large font has no clipped/overlapping text; image/color is never the sole meaning. | PASS — OWNER-OBSERVED across Journeys 2 and 7. |
| 49 | Motion | Reduced-motion setting does not make Profile actions/crop/overlay state incomprehensible. | PASS — OWNER-OBSERVED in Journey 7. |
| 50 | Local-first | With network unavailable, Profile loads its existing local snapshot; no content is transmitted. | PASS — CODE AUDIT/AUTOMATED: one on-device SQLite snapshot owns the read; no Profile read-path network dependency or content egress exists. |

## Eight mandatory backstops

Rows 9, 18, 11, 37, 39, 43/44, 47, and 48 are the plan's eight mandatory device backstops. All were covered by the bounded owner journeys and targeted post-fix approvals.

## Final sign-off

- [x] Every row passed with recorded evidence.
- [x] Release launch and the 1.15x layout-chooser clipping failure were repaired and have retained evidence; no release failure is waived.
- [x] Every reported failure was captured in UAT and closed by Plans 31-11 through 31-15 plus review fixes.
- [x] Owner approval: seven bounded smoke journeys were reported Good or repaired and re-approved; the final template lifecycle re-test was explicitly `approved` on 2026-09-10.
- [x] Post-UAT documentation reconciliation is recorded in `docs/systems/profile.md`, `31-UAT.md`, and `31-10-SUMMARY.md`.
