---
created: 2026-10-11
source: 38.9-REVIEW-FIXES-4.md CR-01
area: widget
---
Widget/notification tap while a guarded save is held (e.g. Duplicate-name dialog open), then Cancel → the parked jump is replayed without the "Discard changes?" prompt (React Navigation skips already-asked screens on re-dispatch of the same action object; discard-keep-guard.ts:261/:303). Owner 2026-10-11: obscure edge case, leave as is; revisit in the widget phase. Fix if wanted: re-dispatch a fresh action copy (type/payload/source/target).

## Moved to backlog 999.7 (backlog cleanup, owner-approved 2026-10-16)

Not done. Merged into ROADMAP Backlog "Phase 999.7: Widget overhaul", which now carries this item.
