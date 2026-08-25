---
schema_version: 1
open_count: 0
waived_count: 0
fixed_count: 2
total_count: 2
last_updated: 2026-08-25T21:10:24.189Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 17 | deviation | app.config.ts |  | Registered RNQC Expo config plugin because dynamic config required manual native wiring. | fixed |  | 2026-08-25T21:10:17.988Z | 2026-08-25T21:10:23.978Z |
| 2 | 17 | deviation | .planning/REQUIREMENTS.md |  | Kept BKP-01 and BKP-03 pending because this dependency gate does not implement the product requirements. | fixed |  | 2026-08-25T21:10:18.202Z | 2026-08-25T21:10:24.189Z |

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
  }
]
````
