---
schema_version: 1
open_count: 0
waived_count: 0
fixed_count: 4
total_count: 4
last_updated: 2026-08-28T07:45:03.119Z
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
  }
]
````
