---
schema_version: 1
open_count: 43
waived_count: 0
fixed_count: 6
total_count: 49
last_updated: 2026-09-07T09:03:24.375Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 17 | deviation | app.config.ts |  | Registered RNQC Expo config plugin because dynamic config required manual native wiring. | fixed |  | 2026-08-25T21:10:17.988Z | 2026-08-25T21:10:23.978Z |
| 2 | 17 | deviation | .planning/REQUIREMENTS.md |  | Kept BKP-01 and BKP-03 pending because this dependency gate does not implement the product requirements. | fixed |  | 2026-08-25T21:10:18.202Z | 2026-08-25T21:10:24.189Z |
| 3 | 17 | deviation | src/db/migrations/007-tombstones.ts |  | Added local-only backup_folder_accessible to preserve SAF access-probe health. | fixed |  | 2026-08-25T21:42:36.632Z | 2026-08-25T21:43:06.513Z |
| 4 | 18.1 | deviation | src/screens/ComposeScreen.tsx | 438 | Closed undefined SMS destination path with an explicit null guard. | fixed |  | 2026-08-28T07:44:01.382Z | 2026-08-28T07:45:03.119Z |
| 5 | 18.2 | deviation | src/db/ai-context-read.test.ts |  | Corrected future-dated Unbound test touchpoint fixture before RED verification. | fixed |  | 2026-08-29T00:27:47.044Z | 2026-08-29T00:28:30.525Z |
| 6 | 19 | stub | src/navigation/RootNavigator.tsx |  | Intentional import route placeholders await plans 06–08. | open |  | 2026-08-29T13:53:23.947Z |  |
| 7 | 19 | unrun-verify | .planning/milestones/v1.0-phases/19-system-contact-import/19-04-PLAN.md |  | Android 17 device UAT was not run; native picker and UI behavior remain to verify. | open |  | 2026-08-29T13:53:24.136Z |  |
| 8 | 19 | unrun-verify | .planning/milestones/v1.0-phases/19-system-contact-import/19-10-PLAN.md |  | Android 17 photo and birthday import UAT was not run; picker-provided photo/birthday behavior remains to verify. | open |  | 2026-08-29T14:15:53.733Z |  |
| 9 | 21 | deviation | src/screens/ContactProfileScreen.tsx | 1336 | Router receives already-loaded complete method groups so the required multi-endpoint selector can function. | open |  | 2026-08-31T22:23:05.470Z |  |
| 10 | 22 | stub | src/screens/GroupEventsScreen.tsx | 14 | Intentional Coming soon placeholder; Phase 33 replaces it with Group Events data and workflow UI. | open |  | 2026-09-02T22:06:32.115Z |  |
| 11 | 22 | unrun-verify | src/components/ShellAppBar.tsx |  | Pixel visual, TalkBack focus, and gesture/three-button clearance UAT require the desktop-build-to-Pixel workflow. | open |  | 2026-09-02T22:06:32.315Z |  |
| 12 | 22 | stub | src/components/UniversalFab.tsx | 186 | Quick Log and global contact-specific actions retain their explicit Plan-06 picker/transaction seam. | fixed |  | 2026-09-02T22:19:36.941Z | 2026-09-02T22:33:22.858Z |
| 13 | 22 | stub | src/screens/placeholders/FabActionPlaceholders.tsx | 22 | Log Contact remains a themed placeholder until Phase 34 Rapid Capture. | open |  | 2026-09-02T22:19:37.126Z |  |
| 14 | 22 | stub | src/screens/placeholders/FabActionPlaceholders.tsx | 22 | Group Log remains a themed placeholder until Phase 33 Group Events. | open |  | 2026-09-02T22:19:37.319Z |  |
| 15 | 22 | stub | src/screens/placeholders/FabActionPlaceholders.tsx | 22 | Update Contact remains a themed placeholder until Phase 34 Rapid Capture. | open |  | 2026-09-02T22:19:37.507Z |  |
| 16 | 22 | stub | src/screens/placeholders/FabActionPlaceholders.tsx | 22 | Memory remains a themed placeholder until Phase 24 Contact Knowledge. | open |  | 2026-09-02T22:19:37.725Z |  |
| 17 | 22 | unrun-verify | src/components/ContactPicker.tsx |  | Pixel UAT remains: picker search/archived/snoozed markers, TalkBack modal focus, Quick Log commit truth, Undo/Retry, haptics, widget refresh, and shell refresh without refocus. | open |  | 2026-09-02T22:33:27.282Z |  |
| 18 | 23 | stub | src/theme/theme-presets.ts |  | standard package palette is a placeholder; finished four-palette authoring is Plan 03 (accents.ts) | open |  | 2026-09-03T16:10:52.068Z |  |
| 19 | 23 | stub | src/stores/theme-store.ts |  | setPackage/setModeForActivePackage have no runtime caller yet; Settings UI (later plan) wires them | open |  | 2026-09-03T16:10:52.253Z |  |
| 20 | 23 | unmet-truth | src/theme/theme-presets.ts |  | galaxy-dark onDanger(#FFFFFF)/danger(#E5484D) = 3.91:1 (<AA 4.5) — owner decision (23-03-SUMMARY Owner Escalations); do not auto-retune owner hue | open |  | 2026-09-03T17:10:03.552Z |  |
| 21 | 23 | unmet-truth | src/theme/theme-presets.ts |  | galaxy-dark danger-as-text(#E5484D)/surfaceElevated(#1D2235) = 4.03:1 (<AA 4.5) — owner decision (23-03-SUMMARY); still >= AA-large 3.0 | open |  | 2026-09-03T17:10:03.761Z |  |
| 22 | 23 | stub | assets/backgrounds/README.md |  | Background assets are placeholder uniform-fill webps (8 slots); final curated art deferred, must stay <= declared brightest pixel (23-06) | open |  | 2026-09-03T17:58:48.467Z |  |
| 23 | 23 | unrun-verify | src/components/ui/__dev__/ThemePreviewScreen.tsx |  | Per-asset brightest-region text-over-glass AA on each Galaxy asset (shipped .webp bytes) — device-UAT deferred to end-of-phase Pixel pass (23-06 Task 2) | open |  | 2026-09-03T17:58:56.134Z |  |
| 24 | 23 | unrun-verify | src/components/orrery/SunBody.tsx |  | Reduced-motion live toggle halts OrreryCanvas twinkle + SunBody glow pulse + bg motion — device-UAT deferred to end-of-phase Pixel pass (23-06 Task 3) | open |  | 2026-09-03T17:58:56.315Z |  |
| 25 | 24.1 | stub | src/navigation/tabs/DashboardStack.tsx | 43 | The universal-FAB MemoryPlaceholderScreen intentionally remains until Phase 34; this plan adds the separate profile-owned Things-to-Remember route. | open |  | 2026-09-04T06:26:08.728Z |  |
| 26 | 24.1 | deviation | src/db/current-state-history-dao.test.ts |  | Kept current-state DAO test fixtures node-pure by avoiding the Expo database bootstrap. | open |  | 2026-09-04T06:52:03.142Z |  |
| 27 | 24.1 | stub | src/screens/placeholders/KnowledgePlaceholders.tsx | 31 | Recently Deleted placeholder is intentionally replaced by Plan 24.1-07. | open |  | 2026-09-04T07:11:24.241Z |  |
| 28 | 24.1 | stub | src/screens/placeholders/KnowledgePlaceholders.tsx | 41 | Memory History placeholder is intentionally replaced by Plan 24.1-07. | open |  | 2026-09-04T07:11:24.422Z |  |
| 29 | 24.2 | unrun-verify | modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt |  | On-device Pixel Note-MIME UAT remains required after the successful desktop assembleDebug build. | open |  | 2026-09-04T19:42:12.035Z |  |
| 30 | 25 | unrun-verify | .planning/phases/25-dashboard-data-state-foundation/25-04-PLAN.md |  | Physical Pixel large-eligible-set search performance validation remains required; desktop fixtures cannot assess the N+1 corpus read. | open |  | 2026-09-05T04:07:55.132Z |  |
| 31 | 26 | unrun-verify | .planning/phases/26-dashboard-control-surface/26-02-SUMMARY.md |  | Pixel Filter and Sort anchored-panel interaction verification remains pending. | open |  | 2026-09-05T12:27:40.703Z |  |
| 32 | 26 | unrun-verify | src/screens/HomeScreen.tsx |  | Pixel verification pending for 200% header fallback, disabled overflow press, and Reset view-mode retention | open |  | 2026-09-05T12:46:17.277Z |  |
| 33 | 26 | unrun-verify | src/screens/ArchivedContactsScreen.tsx |  | Pixel Archived route, origin-aware Back, Restore, and purge-confirmation UAT pending | open |  | 2026-09-05T12:51:17.723Z |  |
| 34 | 27 | unrun-verify | src/components/ListRow.tsx |  | Pixel null-status/never-contacted visual UAT remains unrun because prepared data had no fixture and Add Contact dismissed its sheet. | open |  | 2026-09-06T01:58:00.188Z |  |
| 35 | 27 | unrun-verify | package.json |  | Plan 27-02 physical DEBUG database readback could not run because existing source imports expo-web-browser but the locked dependencies do not include expo-web-browser. | open |  | 2026-09-06T02:32:39.320Z |  |
| 36 | 27 | unrun-verify | src/screens/HomeScreen.tsx |  | Plan 27-04 Pixel/TalkBack UAT for line-three content and optimistic favourite success/failure remains pending end-of-phase device verification. | open |  | 2026-09-06T03:32:24.036Z |  |
| 37 | 27 | unrun-verify | src/screens/HomeScreen.tsx |  | Physical Pixel swipe, TalkBack, and FAB regression UAT remains unrun because the existing expo-web-browser dependency fault prevents the DEBUG app from starting. | open |  | 2026-09-06T03:40:48.457Z |  |
| 38 | 27 | unrun-verify | src/screens/HomeScreen.tsx |  | Phase 27 List search/motion Pixel UAT remains unrun because the pre-existing DEBUG expo-web-browser dependency prevents app launch; no dependency change was authorized. | open |  | 2026-09-06T03:53:22.374Z |  |
| 39 | 28 | stub | src/components/GridCard.tsx | 158 | Third card row is intentionally reserved for Plan 28-04 adaptive context and search content. | open |  | 2026-09-06T08:31:30.372Z |  |
| 40 | 28 | deviation | src/screens/HomeScreen.tsx |  | Corrected stale renderer documentation after CardGrid replacement. | open |  | 2026-09-06T08:31:30.547Z |  |
| 41 | 28 | unrun-verify | src/components/CardGrid.tsx |  | Pixel UAT remains required for card-grid layout, text scaling, status visuals, navigation, and optimistic favourite feedback. | open |  | 2026-09-06T08:31:42.020Z |  |
| 42 | 28 | deviation | .planning/phases/28-dashboard-card-view/28-03-PLAN.md |  | Plan verification's grep -Lq status was inverted; executor used an equivalent no-match assertion. | open |  | 2026-09-06T08:50:50.786Z |  |
| 43 | 28 | unrun-verify | src/components/GridCard.tsx |  | Pixel UAT still required for adaptive/search card ellipsis and highlight appearance | open |  | 2026-09-06T09:01:56.888Z |  |
| 44 | 28 | stub | src/screens/HomeScreen.tsx | 1261 | Selection bulk-actions placeholder region; Plan 07 owns the controls. | open |  | 2026-09-06T09:20:03.702Z |  |
| 45 | 29 | unrun-verify | src/screens/OrreryScreen.tsx |  | Native tracer pan-to-moved-body focus-to-Profile, Skia rendering and gesture arbitration remain pending the approved end-of-phase device session. | open |  | 2026-09-07T07:48:39.216Z |  |
| 46 | 29 | unrun-verify | src/components/orrery/OrrerySystemSelector.tsx |  | Native System selector, Skia neutral bodies, TalkBack focus return and scaled-text layout await the approved end-of-phase device session. | open |  | 2026-09-07T08:24:38.350Z |  |
| 47 | 29 | unrun-verify | src/components/orrery/OrreryWorld.tsx |  | Plan 29-04 native Gravity mass, density/Home calibration, projected rings and gesture observations remain pending final Plan 12 device session; FIFO wait and hold latency unmeasured. | open |  | 2026-09-07T08:43:44.951Z |  |
| 48 | 29 | lint-warning | src/db/lifecycle-consumer-ledger.test.ts |  | Pre-existing Biome formatter drift outside the new 29-04 cadence-owner entry; baseline HEAD reproduces the same formatting findings. | open |  | 2026-09-07T08:44:02.538Z |  |
| 49 | 29 | unrun-verify | src/components/orrery/OrreryWorld.tsx |  | Plan 29-05 native billboard sun occlusion, glyph shaping, layer visibility and scaled-text fit await Plan 12 device verification. | open |  | 2026-09-07T09:03:24.375Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "17",
    "file": "app.config.ts",
    "line": null,
    "description": "Registered RNQC Expo config plugin because dynamic config required manual native wiring.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-25T21:10:17.988Z",
    "resolved_at": "2026-08-25T21:10:23.978Z"
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "17",
    "file": ".planning/REQUIREMENTS.md",
    "line": null,
    "description": "Kept BKP-01 and BKP-03 pending because this dependency gate does not implement the product requirements.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-25T21:10:18.202Z",
    "resolved_at": "2026-08-25T21:10:24.189Z"
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "17",
    "file": "src/db/migrations/007-tombstones.ts",
    "line": null,
    "description": "Added local-only backup_folder_accessible to preserve SAF access-probe health.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-25T21:42:36.632Z",
    "resolved_at": "2026-08-25T21:43:06.513Z"
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "18.1",
    "file": "src/screens/ComposeScreen.tsx",
    "line": 438,
    "description": "Closed undefined SMS destination path with an explicit null guard.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-28T07:44:01.382Z",
    "resolved_at": "2026-08-28T07:45:03.119Z"
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "18.2",
    "file": "src/db/ai-context-read.test.ts",
    "line": null,
    "description": "Corrected future-dated Unbound test touchpoint fixture before RED verification.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-29T00:27:47.044Z",
    "resolved_at": "2026-08-29T00:28:30.525Z"
  },
  {
    "id": 6,
    "kind": "stub",
    "phase": "19",
    "file": "src/navigation/RootNavigator.tsx",
    "line": null,
    "description": "Intentional import route placeholders await plans 06–08.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-29T13:53:23.947Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "19",
    "file": ".planning/milestones/v1.0-phases/19-system-contact-import/19-04-PLAN.md",
    "line": null,
    "description": "Android 17 device UAT was not run; native picker and UI behavior remain to verify.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-29T13:53:24.136Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "unrun-verify",
    "phase": "19",
    "file": ".planning/milestones/v1.0-phases/19-system-contact-import/19-10-PLAN.md",
    "line": null,
    "description": "Android 17 photo and birthday import UAT was not run; picker-provided photo/birthday behavior remains to verify.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-29T14:15:53.733Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "21",
    "file": "src/screens/ContactProfileScreen.tsx",
    "line": 1336,
    "description": "Router receives already-loaded complete method groups so the required multi-endpoint selector can function.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-31T22:23:05.470Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "stub",
    "phase": "22",
    "file": "src/screens/GroupEventsScreen.tsx",
    "line": 14,
    "description": "Intentional Coming soon placeholder; Phase 33 replaces it with Group Events data and workflow UI.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T22:06:32.115Z",
    "resolved_at": null
  },
  {
    "id": 11,
    "kind": "unrun-verify",
    "phase": "22",
    "file": "src/components/ShellAppBar.tsx",
    "line": null,
    "description": "Pixel visual, TalkBack focus, and gesture/three-button clearance UAT require the desktop-build-to-Pixel workflow.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T22:06:32.315Z",
    "resolved_at": null
  },
  {
    "id": 12,
    "kind": "stub",
    "phase": "22",
    "file": "src/components/UniversalFab.tsx",
    "line": 186,
    "description": "Quick Log and global contact-specific actions retain their explicit Plan-06 picker/transaction seam.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-02T22:19:36.941Z",
    "resolved_at": "2026-09-02T22:33:22.858Z"
  },
  {
    "id": 13,
    "kind": "stub",
    "phase": "22",
    "file": "src/screens/placeholders/FabActionPlaceholders.tsx",
    "line": 22,
    "description": "Log Contact remains a themed placeholder until Phase 34 Rapid Capture.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T22:19:37.126Z",
    "resolved_at": null
  },
  {
    "id": 14,
    "kind": "stub",
    "phase": "22",
    "file": "src/screens/placeholders/FabActionPlaceholders.tsx",
    "line": 22,
    "description": "Group Log remains a themed placeholder until Phase 33 Group Events.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T22:19:37.319Z",
    "resolved_at": null
  },
  {
    "id": 15,
    "kind": "stub",
    "phase": "22",
    "file": "src/screens/placeholders/FabActionPlaceholders.tsx",
    "line": 22,
    "description": "Update Contact remains a themed placeholder until Phase 34 Rapid Capture.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T22:19:37.507Z",
    "resolved_at": null
  },
  {
    "id": 16,
    "kind": "stub",
    "phase": "22",
    "file": "src/screens/placeholders/FabActionPlaceholders.tsx",
    "line": 22,
    "description": "Memory remains a themed placeholder until Phase 24 Contact Knowledge.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T22:19:37.725Z",
    "resolved_at": null
  },
  {
    "id": 17,
    "kind": "unrun-verify",
    "phase": "22",
    "file": "src/components/ContactPicker.tsx",
    "line": null,
    "description": "Pixel UAT remains: picker search/archived/snoozed markers, TalkBack modal focus, Quick Log commit truth, Undo/Retry, haptics, widget refresh, and shell refresh without refocus.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T22:33:27.282Z",
    "resolved_at": null
  },
  {
    "id": 18,
    "kind": "stub",
    "phase": "23",
    "file": "src/theme/theme-presets.ts",
    "line": null,
    "description": "standard package palette is a placeholder; finished four-palette authoring is Plan 03 (accents.ts)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T16:10:52.068Z",
    "resolved_at": null
  },
  {
    "id": 19,
    "kind": "stub",
    "phase": "23",
    "file": "src/stores/theme-store.ts",
    "line": null,
    "description": "setPackage/setModeForActivePackage have no runtime caller yet; Settings UI (later plan) wires them",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T16:10:52.253Z",
    "resolved_at": null
  },
  {
    "id": 20,
    "kind": "unmet-truth",
    "phase": "23",
    "file": "src/theme/theme-presets.ts",
    "line": null,
    "description": "galaxy-dark onDanger(#FFFFFF)/danger(#E5484D) = 3.91:1 (<AA 4.5) — owner decision (23-03-SUMMARY Owner Escalations); do not auto-retune owner hue",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T17:10:03.552Z",
    "resolved_at": null
  },
  {
    "id": 21,
    "kind": "unmet-truth",
    "phase": "23",
    "file": "src/theme/theme-presets.ts",
    "line": null,
    "description": "galaxy-dark danger-as-text(#E5484D)/surfaceElevated(#1D2235) = 4.03:1 (<AA 4.5) — owner decision (23-03-SUMMARY); still >= AA-large 3.0",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T17:10:03.761Z",
    "resolved_at": null
  },
  {
    "id": 22,
    "kind": "stub",
    "phase": "23",
    "file": "assets/backgrounds/README.md",
    "line": null,
    "description": "Background assets are placeholder uniform-fill webps (8 slots); final curated art deferred, must stay <= declared brightest pixel (23-06)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T17:58:48.467Z",
    "resolved_at": null
  },
  {
    "id": 23,
    "kind": "unrun-verify",
    "phase": "23",
    "file": "src/components/ui/__dev__/ThemePreviewScreen.tsx",
    "line": null,
    "description": "Per-asset brightest-region text-over-glass AA on each Galaxy asset (shipped .webp bytes) — device-UAT deferred to end-of-phase Pixel pass (23-06 Task 2)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T17:58:56.134Z",
    "resolved_at": null
  },
  {
    "id": 24,
    "kind": "unrun-verify",
    "phase": "23",
    "file": "src/components/orrery/SunBody.tsx",
    "line": null,
    "description": "Reduced-motion live toggle halts OrreryCanvas twinkle + SunBody glow pulse + bg motion — device-UAT deferred to end-of-phase Pixel pass (23-06 Task 3)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T17:58:56.315Z",
    "resolved_at": null
  },
  {
    "id": 25,
    "kind": "stub",
    "phase": "24.1",
    "file": "src/navigation/tabs/DashboardStack.tsx",
    "line": 43,
    "description": "The universal-FAB MemoryPlaceholderScreen intentionally remains until Phase 34; this plan adds the separate profile-owned Things-to-Remember route.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-04T06:26:08.728Z",
    "resolved_at": null
  },
  {
    "id": 26,
    "kind": "deviation",
    "phase": "24.1",
    "file": "src/db/current-state-history-dao.test.ts",
    "line": null,
    "description": "Kept current-state DAO test fixtures node-pure by avoiding the Expo database bootstrap.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-04T06:52:03.142Z",
    "resolved_at": null
  },
  {
    "id": 27,
    "kind": "stub",
    "phase": "24.1",
    "file": "src/screens/placeholders/KnowledgePlaceholders.tsx",
    "line": 31,
    "description": "Recently Deleted placeholder is intentionally replaced by Plan 24.1-07.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-04T07:11:24.241Z",
    "resolved_at": null
  },
  {
    "id": 28,
    "kind": "stub",
    "phase": "24.1",
    "file": "src/screens/placeholders/KnowledgePlaceholders.tsx",
    "line": 41,
    "description": "Memory History placeholder is intentionally replaced by Plan 24.1-07.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-04T07:11:24.422Z",
    "resolved_at": null
  },
  {
    "id": 29,
    "kind": "unrun-verify",
    "phase": "24.2",
    "file": "modules/orbit-contact-picker/android/src/main/java/expo/modules/orbitcontactpicker/OrbitContactPickerModule.kt",
    "line": null,
    "description": "On-device Pixel Note-MIME UAT remains required after the successful desktop assembleDebug build.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-04T19:42:12.035Z",
    "resolved_at": null
  },
  {
    "id": 30,
    "kind": "unrun-verify",
    "phase": "25",
    "file": ".planning/phases/25-dashboard-data-state-foundation/25-04-PLAN.md",
    "line": null,
    "description": "Physical Pixel large-eligible-set search performance validation remains required; desktop fixtures cannot assess the N+1 corpus read.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-05T04:07:55.132Z",
    "resolved_at": null
  },
  {
    "id": 31,
    "kind": "unrun-verify",
    "phase": "26",
    "file": ".planning/phases/26-dashboard-control-surface/26-02-SUMMARY.md",
    "line": null,
    "description": "Pixel Filter and Sort anchored-panel interaction verification remains pending.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-05T12:27:40.703Z",
    "resolved_at": null
  },
  {
    "id": 32,
    "kind": "unrun-verify",
    "phase": "26",
    "file": "src/screens/HomeScreen.tsx",
    "line": null,
    "description": "Pixel verification pending for 200% header fallback, disabled overflow press, and Reset view-mode retention",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-05T12:46:17.277Z",
    "resolved_at": null
  },
  {
    "id": 33,
    "kind": "unrun-verify",
    "phase": "26",
    "file": "src/screens/ArchivedContactsScreen.tsx",
    "line": null,
    "description": "Pixel Archived route, origin-aware Back, Restore, and purge-confirmation UAT pending",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-05T12:51:17.723Z",
    "resolved_at": null
  },
  {
    "id": 34,
    "kind": "unrun-verify",
    "phase": "27",
    "file": "src/components/ListRow.tsx",
    "line": null,
    "description": "Pixel null-status/never-contacted visual UAT remains unrun because prepared data had no fixture and Add Contact dismissed its sheet.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T01:58:00.188Z",
    "resolved_at": null
  },
  {
    "id": 35,
    "kind": "unrun-verify",
    "phase": "27",
    "file": "package.json",
    "line": null,
    "description": "Plan 27-02 physical DEBUG database readback could not run because existing source imports expo-web-browser but the locked dependencies do not include expo-web-browser.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T02:32:39.320Z",
    "resolved_at": null
  },
  {
    "id": 36,
    "kind": "unrun-verify",
    "phase": "27",
    "file": "src/screens/HomeScreen.tsx",
    "line": null,
    "description": "Plan 27-04 Pixel/TalkBack UAT for line-three content and optimistic favourite success/failure remains pending end-of-phase device verification.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T03:32:24.036Z",
    "resolved_at": null
  },
  {
    "id": 37,
    "kind": "unrun-verify",
    "phase": "27",
    "file": "src/screens/HomeScreen.tsx",
    "line": null,
    "description": "Physical Pixel swipe, TalkBack, and FAB regression UAT remains unrun because the existing expo-web-browser dependency fault prevents the DEBUG app from starting.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T03:40:48.457Z",
    "resolved_at": null
  },
  {
    "id": 38,
    "kind": "unrun-verify",
    "phase": "27",
    "file": "src/screens/HomeScreen.tsx",
    "line": null,
    "description": "Phase 27 List search/motion Pixel UAT remains unrun because the pre-existing DEBUG expo-web-browser dependency prevents app launch; no dependency change was authorized.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T03:53:22.374Z",
    "resolved_at": null
  },
  {
    "id": 39,
    "kind": "stub",
    "phase": "28",
    "file": "src/components/GridCard.tsx",
    "line": 158,
    "description": "Third card row is intentionally reserved for Plan 28-04 adaptive context and search content.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T08:31:30.372Z",
    "resolved_at": null
  },
  {
    "id": 40,
    "kind": "deviation",
    "phase": "28",
    "file": "src/screens/HomeScreen.tsx",
    "line": null,
    "description": "Corrected stale renderer documentation after CardGrid replacement.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T08:31:30.547Z",
    "resolved_at": null
  },
  {
    "id": 41,
    "kind": "unrun-verify",
    "phase": "28",
    "file": "src/components/CardGrid.tsx",
    "line": null,
    "description": "Pixel UAT remains required for card-grid layout, text scaling, status visuals, navigation, and optimistic favourite feedback.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T08:31:42.020Z",
    "resolved_at": null
  },
  {
    "id": 42,
    "kind": "deviation",
    "phase": "28",
    "file": ".planning/phases/28-dashboard-card-view/28-03-PLAN.md",
    "line": null,
    "description": "Plan verification's grep -Lq status was inverted; executor used an equivalent no-match assertion.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T08:50:50.786Z",
    "resolved_at": null
  },
  {
    "id": 43,
    "kind": "unrun-verify",
    "phase": "28",
    "file": "src/components/GridCard.tsx",
    "line": null,
    "description": "Pixel UAT still required for adaptive/search card ellipsis and highlight appearance",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T09:01:56.888Z",
    "resolved_at": null
  },
  {
    "id": 44,
    "kind": "stub",
    "phase": "28",
    "file": "src/screens/HomeScreen.tsx",
    "line": 1261,
    "description": "Selection bulk-actions placeholder region; Plan 07 owns the controls.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T09:20:03.702Z",
    "resolved_at": null
  },
  {
    "id": 45,
    "kind": "unrun-verify",
    "phase": "29",
    "file": "src/screens/OrreryScreen.tsx",
    "line": null,
    "description": "Native tracer pan-to-moved-body focus-to-Profile, Skia rendering and gesture arbitration remain pending the approved end-of-phase device session.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-07T07:48:39.216Z",
    "resolved_at": null
  },
  {
    "id": 46,
    "kind": "unrun-verify",
    "phase": "29",
    "file": "src/components/orrery/OrrerySystemSelector.tsx",
    "line": null,
    "description": "Native System selector, Skia neutral bodies, TalkBack focus return and scaled-text layout await the approved end-of-phase device session.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-07T08:24:38.350Z",
    "resolved_at": null
  },
  {
    "id": 47,
    "kind": "unrun-verify",
    "phase": "29",
    "file": "src/components/orrery/OrreryWorld.tsx",
    "line": null,
    "description": "Plan 29-04 native Gravity mass, density/Home calibration, projected rings and gesture observations remain pending final Plan 12 device session; FIFO wait and hold latency unmeasured.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-07T08:43:44.951Z",
    "resolved_at": null
  },
  {
    "id": 48,
    "kind": "lint-warning",
    "phase": "29",
    "file": "src/db/lifecycle-consumer-ledger.test.ts",
    "line": null,
    "description": "Pre-existing Biome formatter drift outside the new 29-04 cadence-owner entry; baseline HEAD reproduces the same formatting findings.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-07T08:44:02.538Z",
    "resolved_at": null
  },
  {
    "id": 49,
    "kind": "unrun-verify",
    "phase": "29",
    "file": "src/components/orrery/OrreryWorld.tsx",
    "line": null,
    "description": "Plan 29-05 native billboard sun occlusion, glyph shaping, layer visibility and scaled-text fit await Plan 12 device verification.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-07T09:03:24.375Z",
    "resolved_at": null
  }
]
````
