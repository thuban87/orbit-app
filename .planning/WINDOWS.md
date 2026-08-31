---
schema_version: 1
open_count: 4
waived_count: 0
fixed_count: 5
total_count: 9
last_updated: 2026-08-31T22:23:05.470Z
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
| 7 | 19 | unrun-verify | .planning/phases/19-system-contact-import/19-04-PLAN.md |  | Android 17 device UAT was not run; native picker and UI behavior remain to verify. | open |  | 2026-08-29T13:53:24.136Z |  |
| 8 | 19 | unrun-verify | .planning/phases/19-system-contact-import/19-10-PLAN.md |  | Android 17 photo and birthday import UAT was not run; picker-provided photo/birthday behavior remains to verify. | open |  | 2026-08-29T14:15:53.733Z |  |
| 9 | 21 | deviation | src/screens/ContactProfileScreen.tsx | 1336 | Router receives already-loaded complete method groups so the required multi-endpoint selector can function. | open |  | 2026-08-31T22:23:05.470Z |  |

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
    "file": ".planning/phases/19-system-contact-import/19-04-PLAN.md",
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
    "file": ".planning/phases/19-system-contact-import/19-10-PLAN.md",
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
  }
]
````
