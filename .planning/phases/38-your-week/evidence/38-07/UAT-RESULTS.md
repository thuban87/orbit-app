# Phase 38 Plan 07 — Pixel UAT Results

Run date: 2026-09-19

## Run metadata

- Build SHA: `1be318dc81114cf39f7a8d114e3f69a41834173d`
- Package: `com.bwales.orbit`
- Metro tmux session: `orbit` (host port 8082)
- Reverse: device `tcp:8081` → host `tcp:8082`
- Device: Pixel 6 Pro, serial `1A071FDEE002BU`
- Android API: 37
- Authorized topology: `device`; exactly one adb target
- Themes exercised: Galaxy and Standard
- OS font scale: 1.15 baseline; 1.5 long-text backstop; restored to 1.15
- Fixture: `Phase38_Group_UAT`, created through the app's Group Log UI with UAT Ada, UAT Grace, and ZZ-UAT-R3-Solo
- Existing-contact continuation: Andrew Wales was temporarily changed from Monthly to Daily through Update Contact to expose an overdue Up Next row, then restored to Monthly. `ZZ-UAT-Clean` was assigned Daily through Update Contact while testing whether an existing Unbound contact could enter Never Contacted; it remained Unbound and the UI does not permit clearing an assigned cadence.
- Fixture invariant check: `group_events.id=1`, uid `00b64d45-0d39-4d56-8480-8fd7370aaf67`, three linked interaction rows, and empty `PRAGMA foreign_key_check`
- No real AI suggestion/API call was triggered.

## Results

| # | Result | Direct observation | Evidence |
|---|---|---|---|
| 1 | PASS | A force-stop/launcher cold start opened Digest. After switching to Contacts, backgrounding, and reopening, Contacts and its stack remained selected rather than resetting to Digest. | `01-fresh-launch.*`, `02-contacts-before-resume.xml`, `03-resume-contacts.*` |
| 2 | PASS | All five tabs were selected by direct taps with no swipe navigation. Reselecting active Contacts from a profile returned the Contacts root. | `04-contacts-profile.xml`, `05-contacts-reselect-root.xml`, `06-tab-*.xml` |
| 3 | PASS | The original Contacts, Orrery, and Digest origin-aware Back checks passed. In the focused Plan 08 rerun, Events → `Phase38_Group_UAT` → UAT Ada Interaction Detail exposed `View profile`; activating it opened UAT Ada's Profile, and Android Back revealed the same `Phase38_Group_UAT` detail with its participant list intact. | Original evidence: `07-back-to-contacts.xml`, `08-orrery-contacts-sheet.xml`, `09-orrery-profile.xml`, `10-back-to-orrery.xml`, `23-digest-up-next.*`, `24-digest-profile.*`, `25-back-to-digest.xml`. Focused rerun: `38-08/item3-event.*`, `38-08/item3-interaction-detail.*`, `38-08/item3-profile.*`, `38-08/item3-back-event.*` |
| 4 | PASS | Digest displayed the same six FAB actions as Contacts. No Backup tab appeared. Settings opened Backup & Restore. | `11-digest-fab.xml`, `12-settings-data-backup.xml` |
| 5 | PASS | The focused DEV control read the original `includeUnboundNeverContacted` value as OFF, enabled it through the canonical app-settings writer, and Digest showed a non-zero Never Contacted preview using existing contacts (`ZZ-UAT-B4a-Add`, `ZZ-UAT-B4c-Same`, and one more). The preview opened `ZZ-UAT-B4a-Add` Profile and Back returned to Digest. The overflow drill opened the Contacts `not-contacted` population containing those existing unbound rows. The same canonical writer restored the original OFF value. No contacts were created, edited, or deleted, and no raw SQL was used. As expected, the two writes advanced `modified_at` and `data_revision` monotonically; those bookkeeping values were not rewritten or decremented. The previously recorded `ZZ-UAT-Clean` Daily cadence drift remains pre-existing and untouched. | `38-08/item5-toggle-before.*`, `38-08/item5-toggle-enabled.*`, `38-08/item5-digest-nonzero.*`, `38-08/item5-preview-profile.*`, `38-08/item5-back-digest.xml`, `38-08/item5-contacts-drill.*`, `38-08/item5-toggle-restored.*` |
| 6 | PASS | Rolling 7 and Calendar Week both drove the metrics/heatmap. Activity existed on 09/13 and 09/19. Selecting 09/19 set structural `selected=true` and expanded inline beneath the heatmap with exactly one `Phase38_Group_UAT` event record. The same empty birthday Horizon state remained across the toggle. | `14-digest-group-event.*`, `15-heatmap-group-event.*`, `16-calendar-week.*` |
| 7 | PASS | The DEV-only one-shot scheduled a real local notification under a retained `digest:uat:*` identifier, leaving the production `digest:weekly` singleton unchanged. With Orbit backgrounded, Android's shade displayed the generic title `Your week in Orbit` and body `A look back at who you reached.` Tapping the actual OS notification opened Orbit at the Digest root (`Up Next` / `Your Week`). The delivered notification was consumed/auto-dismissed; no pending probe remained to cancel. Orbit's master notification state was left as found, device time was unchanged, and the notification contained no contact content. This PASS is from physical delivery and tap evidence, not the resolver unit test. | `38-08/item7-notification-shade.*`, `38-08/item7-notification-shade-unlocked.*`, `38-08/item7-notification-expanded.png`, `38-08/item7-notification-visible.*`, `38-08/item7-tap-digest.*` |
| 8 | PASS | Galaxy and Standard exposed identical Digest IA and interaction structure. The selected heatmap day had structural `selected=true`, independent of colour. At font scale 1.5, all seven day cells, metric/status content, and five tab labels remained present with bounded UI nodes; no clipping was observed. Font scale was restored. | Galaxy `14-digest-group-event.*`; Standard `18-standard-digest.*`; selection `15-heatmap-group-event.xml`; large font `19-large-font-standard.*` |
| 9 | PASS | With Android airplane mode reporting `enabled`, a force-stop/launcher cold start rendered Digest's Up Next, Horizon, Your Week metrics, and all seven heatmap cells with no network spinner or error sentinel. Airplane mode was then disabled. | `20-offline-cold-launch.*` |

## Focused Plan 08 rerun

The focused rerun exercised only items 3, 5, and 7 on the physical Pixel 6 Pro. All three now PASS with direct evidence. The Never Contacted preference was restored to its captured OFF value, with the expected monotonic settings metadata advancement retained. The UAT notification was consumed by its successful tap, notification settings were unchanged, no contact data was edited, and React Native JS Dev Mode was restored to `false`. Plan 07's mandatory device checks are therefore closed without a waiver.
