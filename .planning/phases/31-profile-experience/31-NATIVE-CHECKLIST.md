# Phase 31 Profile — Physical Pixel acceptance checklist

**Target:** Physical Pixel only; do not substitute the desktop emulator for accessibility, crop, gesture, or performance evidence.

**Build/runtime:** package `com.bwales.orbit`; Metro tmux session `orbit`; use `emu-connect`, then resolve exactly one authorized serial with `~/.local/bin/adb devices -l`.

**Status:** Pending owner acceptance after Plan 31-10 Task 3.

## Evidence header

Record before beginning:

- Date/time:
- `emu-connect status` target:
- Authorized physical serial/model:
- APK/debug build and Metro state:
- Theme/mode:
- Seed contacts used (bound, unbound, missing-data, long-data):

## Checklist

Mark every row PASS/FAIL with a short observation. A failed row is a gap for planning, not an implicit waiver.

| # | Area | Verification | PASS/FAIL + evidence |
|---:|---|---|---|
| 1 | Target | `emu-connect` selects `device`, not remote emulator; exactly one authorized physical Pixel is listed. | |
| 2 | Shell | Dashboard → Profile → Back returns to the same Dashboard state. | |
| 3 | Shell | Orrery → Profile → Back returns to Orrery without changing its selected system. | |
| 4 | Shell | Settings/Archived → Profile → Back returns to its source stack. | |
| 5 | Shell | Widget contact deep link opens Profile and Back returns to Dashboard. | |
| 6 | Shell | Notification Profile/reach entry returns through its reset Dashboard stack; Reach Out opens once. | |
| 7 | Hero | Bound contact shows fixed avatar/name/Category/Favorite/Message/Call/one overflow in both themes. | |
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
| 33 | Overflow | Exact order: Edit, Snooze/Unsnooze, Archive, separator, Profile Layout, Background, conditional Save, conditional Reset. | |
| 34 | Overflow | No Profile AI-draft action appears; Message → Compose remains available. | |
| 35 | Overlay | A topmost sheet makes Profile underlay inert; Android Back closes the topmost sheet before native-stack Back. | |
| 36 | Layout | Profile Layout edit shows fixed-Hero preview, drag plus Move controls, visibility/default expansion, and legal size options. | |
| 37 | Layout | Long labels retain Save/Cancel/reorder reachability at large text and screen reader. | |
| 38 | Layout | Cancel/dirty dismissal preserves committed layout; Save commits complete layout and reloads it. | |
| 39 | Templates | Create/rename/preview/assignment/usage/delete flows describe inherited vs contact override truthfully. | |
| 40 | Templates | Save Current Layout as Template appears only for freeform layout; Reset appears only for contact overrides. | |
| 41 | Reset | Reset confirmation says contact facts/Favorite/Snooze/AI/knowledge remain unchanged, then verifies that result. | |
| 42 | Background | Template list/picker uses only local device media and keeps Cancel/error drafts/committed background safe. | |
| 43 | Crop | Portrait crop: drag, pinch, named controls, min/max bounds, preview and output aspect all agree. | |
| 44 | Crop | Landscape crop: same bounds/aspect/reachable controls; no hidden clipping. | |
| 45 | Background | Assignment at contact/Category/global resolves correctly; Profile restarts with readable scrim treatment. | |
| 46 | Theme | Galaxy and Standard, light/dark as available, retain hierarchy, contrast, and no hardcoded-color regressions. | |
| 47 | Accessibility | TalkBack announces Hero actions, disabled reasons, section expanded state, selection, and sheet focus. | |
| 48 | Accessibility | Large font has no clipped/overlapping text; image/color is never the sole meaning. | |
| 49 | Motion | Reduced-motion setting does not make Profile actions/crop/overlay state incomprehensible. | |
| 50 | Local-first | With network unavailable, Profile loads its existing local snapshot; no content is transmitted. | |

## Eight mandatory backstops

Rows 9, 18, 11, 37, 39, 43/44, 47, and 48 are the plan's eight mandatory device backstops. All must have concrete physical-Pixel evidence before approval.

## Final sign-off

- [ ] Every row passed with recorded evidence.
- [ ] Any failure has a numbered observation and gap-closure owner.
- [ ] Owner approval: `approved`.
- [ ] Post-UAT documentation reconciliation recorded in `docs/systems/profile.md` and the Plan 31-10 summary.
