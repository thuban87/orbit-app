# Phase 31 Profile — Physical Pixel acceptance checklist

**Target:** Physical Pixel only; do not substitute the desktop emulator for accessibility, crop, gesture, or performance evidence.

**Build/runtime:** package `com.bwales.orbit`; Metro tmux session `orbit`; use `emu-connect`, then resolve exactly one authorized serial with `~/.local/bin/adb devices -l`.

**Status:** Standalone-release objective evidence recorded; remaining subjective and varied-state acceptance is owner-gated.

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

## Checklist

Mark every row PASS/FAIL with a short observation. A failed row is a gap for planning, not an implicit waiver.

| # | Area | Verification | PASS/FAIL + evidence |
|---:|---|---|---|
| 1 | Target | `emu-connect` selects `device`, not remote emulator; exactly one authorized physical Pixel is listed. | PASS — `emu-connect status` reported `device`; `adb devices -l` reported only Pixel 6 Pro serial `1A071FDEE002BU`. |
| 2 | Shell | Dashboard → Profile → Back returns to the same Dashboard state. | PASS — Dashboard card opened Andrew Wales Profile; Android Back returned to the same populated Dashboard grid. |
| 3 | Shell | Orrery → Profile → Back returns to Orrery without changing its selected system. | |
| 4 | Shell | Settings/Archived → Profile → Back returns to its source stack. | |
| 5 | Shell | Widget contact deep link opens Profile and Back returns to Dashboard. | |
| 6 | Shell | Notification Profile/reach entry returns through its reset Dashboard stack; Reach Out opens once. | |
| 7 | Hero | Bound contact shows fixed avatar/name/Category/Favorite/Message/Call/one overflow in both themes. | PASS — standalone-release Galaxy and Standard factory captures show Andrew Wales's avatar/name/Family Category/Favorite/Message/Call and one overflow control. |
| 8 | Hero | Missing phone/email retains Message and Call geometry, with accurate disabled reasons. | |
| 9 | Hero | Long name/category at large text wraps/reflows without overlap or a shrunk semantic role. | |
| 10 | Hero | Favorite changes only after its committed write and survives focus/relaunch. | |
| 11 | Methods | Complete long phone/email values are readable/accessibly named; malformed values are explained and not actionable. | |
| 12 | Methods | Call/Message/Email opens the expected user-triggered native handoff; no interaction is falsely logged as completed. | |
| 13 | Lifecycle | Bound contact shows truthful Status/Frequency/Snooze behavior. | |
| 14 | Lifecycle | Unbound dormant cadence is marked inactive, never treated as Bound. | |
| 15 | Lifecycle | Unbound null cadence has no fabricated status; Bind requires a valid selected cadence. | |
| 16 | Lifecycle | Bind/Unbind confirmation and resulting state preserve relationship data/history. | |
| 17 | Overview | All enabled factory Overview modules appear in stable order and auto-pack without holes at ordinary width. | |
| 18 | Overview | Narrow width/large text reduces columns and grows tiles while retaining text and 44px targets. | |
| 19 | Status | Status sheet names actual cadence/last-contact/Rarely Responds inputs and no Health/Gravity factors. | |
| 20 | Gravity | Gravity explanation is textual and visual reinforces it without being the sole channel. | |
| 21 | Intensity | Bound Intensity uses its cadence window; Unbound/null cadence says `This month`. | |
| 22 | Frequency | Every frequency choice commits, refreshes Profile facts, handles pending/error/retry, and dismisses cleanly. | |
| 23 | Snooze | Presets, custom future date, Unsnooze, pending/error/retry, and Back/scrim dismissal work. | |
| 24 | History seam | Status → History and View all history retain the bounded Phase 31 renderer seam. | |
| 25 | Collapse | Collapse one top-level section, restart, and confirm durable readback/accessible expanded state. | |
| 26 | Collapse | Collapse one Things-to-Remember child, restart, and confirm it remains scoped to that child. | |
| 27 | Collapse | Simulated/observed persistence failure retains visible state and exposes Retry rather than a false update. | |
| 28 | TTR | Empty sections retain useful summaries; partial facts do not fabricate values. | |
| 29 | TTR | Cards, capped counts, View all, and Show hidden use stable semantic order. | |
| 30 | TTR | Tap detail, long-press management, and accessibility actions reach source-owner management flows. | |
| 31 | Off Limits | Ordinary Off Limits uses caution semantics, no sparkle, and no inferred AI permission. | |
| 32 | Custom fields | Invalid values expose their recovery state; long/grouped values remain understandable. | |
| 33 | Overflow | Exact order: Edit, Snooze/Unsnooze, Archive, separator, Profile Layout, Background, conditional Save, conditional Reset. | PENDING OWNER — release menu visibly ordered Edit Contact, Snooze, Archive, separator, Profile Layout, Background, Reset. The conditional freeform Save Current Layout as Template case remains owner-only. |
| 34 | Overflow | No Profile AI-draft action appears; Message → Compose remains available. | PENDING OWNER — no Profile AI action appeared in the Pixel menu; owner must confirm Message → Compose. |
| 35 | Overlay | A topmost sheet makes Profile underlay inert; Android Back closes the topmost sheet before native-stack Back. | PASS — clean Profile actions sheet dimmed the underlay; first Android Back dismissed it while retaining Profile, second Back returned to Dashboard. |
| 36 | Layout | Profile Layout edit shows fixed-Hero preview, drag plus Move controls, visibility/default expansion, and legal size options. | PENDING OWNER — final release at 1.15x font shows Fixed Hero/live preview and retained Cancel, Save as template, and Save layout affordances. The persisted varied-layout/legal-size exercise remains owner-only. |
| 37 | Layout | Long labels retain Save/Cancel/reorder reachability at large text and screen reader. | |
| 38 | Layout | Cancel/dirty dismissal preserves committed layout; Save commits complete layout and reloads it. | |
| 39 | Templates | Create/rename/preview/assignment/usage/delete flows describe inherited vs contact override truthfully. | |
| 40 | Templates | Save Current Layout as Template appears only for freeform layout; Reset appears only for contact overrides. | |
| 41 | Reset | Reset confirmation says contact facts/Favorite/Snooze/AI/knowledge remain unchanged, then verifies that result. | |
| 42 | Background | Template list/picker uses only local device media and keeps Cancel/error drafts/committed background safe. | PASS — the final release showed the safe retryable error on its first picker attempt, then opened Android's local system picker on immediate retry. Both source orientations reached crop in debug; final-release Cancel → Discard returned without creating or assigning a new background. |
| 43 | Crop | Portrait crop: drag, pinch, named controls, min/max bounds, preview and output aspect all agree. | PENDING OWNER — prior PASS relied on geometry/UI evidence, not direct native gestures. Plan 31-13 installed the debug build on the authorized Pixel and captured the debug device/Metro record in `evidence/31-13-debug/`; direct portrait drag/pinch still needs owner observation. |
| 44 | Crop | Landscape crop: same bounds/aspect/reachable controls; no hidden clipping. | PENDING OWNER — prior PASS did not prove direct native gestures. A genuine two-pointer pinch cannot be synthesized by the available safe adb tooling; owner must directly verify landscape drag/pinch and control reachability in the debug crop editor. |
| 45 | Background | Assignment at contact/Category/global resolves correctly; Profile restarts with readable scrim treatment. | PENDING OWNER — factory fallback is readable and full bleed in the final Galaxy and Standard release captures; contact/Category/global assignment scenarios remain unexercised. |
| 46 | Theme | Galaxy and Standard, light/dark as available, retain hierarchy, contrast, and no hardcoded-color regressions. | PENDING OWNER — inspected Galaxy and Standard final-release captures retain hierarchy and no tile/opaque wash; `check:colors` passed. Available light-mode and owner contrast judgment remain. |
| 47 | Accessibility | TalkBack announces Hero actions, disabled reasons, section expanded state, selection, and sheet focus. | |
| 48 | Accessibility | Large font has no clipped/overlapping text; image/color is never the sole meaning. | |
| 49 | Motion | Reduced-motion setting does not make Profile actions/crop/overlay state incomprehensible. | |
| 50 | Local-first | With network unavailable, Profile loads its existing local snapshot; no content is transmitted. | |

## Eight mandatory backstops

Rows 9, 18, 11, 37, 39, 43/44, 47, and 48 are the plan's eight mandatory device backstops. All must have concrete physical-Pixel evidence before approval.

## Final sign-off

- [ ] Every row passed with recorded evidence.
- [x] Release launch and the 1.15x layout-chooser clipping failure were repaired and have retained evidence; no release failure is waived.
- [ ] Any failure has a numbered observation and gap-closure owner.
- [ ] Owner approval: `approved`.
- [ ] Post-UAT documentation reconciliation recorded in `docs/systems/profile.md` and the Plan 31-10 summary.
