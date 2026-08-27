---
phase: 18
slug: contact-data-normalization
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
created: 2026-08-26
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` |
| **Config file** | None — source-adjacent `*.test.ts` / `*.test.tsx` is the established convention. |
| **Quick run command** | `npm test -- src/db/migrations/009-contact-data-normalization.test.ts src/db/contact-methods-dao.test.ts` |
| **Full suite command** | `npm test && npx tsc --noEmit && npm run check:colors` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant targeted Vitest command. Because scalar and nullable-cadence contracts are deliberately migrated across plans, defer the repository-wide `npx tsc --noEmit` check to 18-08 with the full compatibility gate.
- **During Waves 1–5:** Run only the named targeted task suites. The migration retires scalar contracts before all consumers are rerouted, so a repository-wide suite/TypeScript gate is intentionally deferred until the compatibility-complete Phase 18 regression in 18-08.
- **For 18-08-01:** Run its named targeted tests as the immediate feedback step; run the approximately 90-second full-suite gate only after those tests pass.
- **Before `$gsd-verify-work`:** The full suite must be green, followed by owner-gated Android release UAT for migration-on-device, method UI, Bound/Unbound transitions, widget, and notifications.
- **Max feedback latency:** ~90 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 18-01 | 1 | CDN-01, CDN-02, CDN-04 | T-18-01 | Human ratifies schema plus actionability threshold before implementation. | Blocking decision | `node -e "process.exit(0)"` | Existing checkpoint | ⬜ pending |
| 18-01-02 | 18-01 | 1 | CDN-01 | T-18-SC | Human verifies parser provenance before install. | Blocking package gate | `node -e "const p=require('./package.json'); process.exit(p.dependencies?.['libphonenumber-js'] ? 1 : 0)"` | Existing checkpoint | ⬜ pending |
| 18-01-03 | 18-01 | 1 | CDN-01, CDN-02, CDN-04 | T-18-01 | Migration copies scalar methods as primary, applies selected actionability examples, preserves malformed data, and retires scalar authority. | Node SQLite migration + normalizer | `npm test -- src/logic/contact-method-normalization.test.ts src/db/migrations/009-contact-data-normalization.test.ts` | Created by 18-01 | ⬜ pending |
| 18-02-01 | 18-02 | 2 | CDN-01, CDN-04 | T-18-05 | DAO receives effective region, collapses same-contact canonical duplicates with typed feedback, preserves cross-contact sharing. | Node SQLite DAO | `npm test -- src/db/contact-methods-dao.test.ts` | Created by 18-02 | ⬜ pending |
| 18-02-02 | 18-02 | 2 | CDN-02, CDN-03 | T-18-06 | Lifecycle matrix preserves history/rank/cadence and rejects prohibited SQL transitions. | Node SQLite DAO/constraint | `npm test -- src/db/contact-lifecycle-dao.test.ts src/db/migrations/009-contact-data-normalization.test.ts` | Created by 18-02 | ⬜ pending |
| 18-02-03 | 18-02 | 2 | CDN-01, CDN-02 | T-18-05 | Aggregate create/edit and inline Capture creation atomically use lifecycle/method rows and typed collision result. | DAO/Capture integration | `npm test -- src/db/contacts-dao.test.ts src/db/contact-methods-dao.test.ts src/db/contact-lifecycle-dao.test.ts src/screens/CaptureScreen.test.tsx` | Existing/new owner tests | ⬜ pending |
| 18-03-01 | 18-03 | 2 | CDN-01, CDN-02 | T-18-09 | Profile and dedicated Unbound reads retain correct two-state data without scalar compatibility reads. | SQL read unit | `npm test -- src/db/contact-read.test.ts src/db/unbound-read.test.ts` | Existing/new owner tests | ⬜ pending |
| 18-03-02 | 18-03 | 2 | CDN-02, CDN-03 | T-18-09 | Dashboard/header counts, status, digest, favourites, and Orrery exclude Unbound while search remains retrieval-oriented. | SQL read unit | `npm test -- src/db/dashboard-read.test.ts src/db/orrery-read.test.ts src/db/contact-status-read.test.ts src/db/digest-read.test.ts` | Existing files extended | ⬜ pending |
| 18-03-03 | 18-03 | 2 | CDN-02, CDN-03 | T-18-11 | Impact preserves Unbound gravity/history; explicit AI uses a neutral no-intensity fallback without PII. | SQL/service read unit | `npm test -- src/db/impact-read.test.ts src/services/impact.test.ts src/db/ai-context-read.test.ts` | Existing/new owner tests | ⬜ pending |
| 18-05-01 | 18-05 | 3 | CDN-02, CDN-03 | T-18-17 | Dashboard footer and dedicated Unbound list keep neutral empty/loading/error behavior. | Screen + read test | `npm test -- src/screens/UnboundContactsScreen.test.tsx src/db/unbound-read.test.ts` | Created by 18-05 | ⬜ pending |
| 18-05-02 | 18-05 | 3 | CDN-01, CDN-02, CDN-03 | T-18-15 | Region modal/fallback, all settings defaults, non-retroactive method identity, and the persisted Never Contacted eligibility policy are proven: default Bound-only and opt-in affects both its list and dashboard count. | Settings + dashboard-read unit | `npm test -- src/db/app-settings-dao.test.ts src/db/dashboard-read.test.ts src/screens/SettingsScreen.test.tsx` | Existing/new owner tests | ⬜ pending |
| 18-05-03 | 18-05 | 3 | CDN-03 | T-18-17 | Home search renders neutral, accessibility-labeled Unbound results for zero/one/many. | Screen test | `npm test -- src/screens/HomeScreen.test.tsx src/screens/UnboundContactsScreen.test.tsx` | Created by 18-05 | ⬜ pending |
| 18-07-01 | 18-07 | 4 | CDN-01, CDN-02, CDN-04 | T-18-21 | Manifest/parser carries complete normalized graph and v1-to-v2 forward migration rejects malformed children. | Backup integration | `npm test -- src/backup/export-manifest.test.ts src/backup/backup-schema.test.ts` | Existing files extended | ⬜ pending |
| 18-07-02 | 18-07 | 4 | CDN-01, CDN-02, CDN-04 | T-18-23 | Restore reconciles normalized UID children and exhaustive entity policy without source-authoritative deletes. | Restore integration | `npm test -- src/backup/restore-apply.test.ts src/backup/backup-schema.test.ts src/backup/reconciliation.test.ts` | Existing files extended | ⬜ pending |
| 18-07-03 | 18-07 | 4 | CDN-04 | T-18-23 | Explicit tombstones alone remove normalized children; failed graph validation is atomic. | Restore/schema integration | `npm test -- src/backup/backup-schema.test.ts src/backup/restore-apply.test.ts` | Existing files extended | ⬜ pending |
| 18-09-01 | 18-09 | 4 | CDN-02, CDN-03 | T-18-28 | Decay is Bound-only and reconciling after Unbind cancels stale scheduled notifications. | Notification integration | `npm test -- src/db/notification-read.test.ts src/services/notifications/notification-schedule.test.ts` | Existing files extended | ⬜ pending |
| 18-09-02 | 18-09 | 4 | CDN-02, CDN-03 | T-18-30 | Unbind post-commit owner reconciles notifications and refreshes widgets once with failure isolation. | Service + widget unit | `npm test -- src/services/contact-lifecycle-effects.test.ts src/services/widget/widget-data.test.ts` | Created/extended by 18-09 | ⬜ pending |
| 18-09-03 | 18-09 | 4 | CDN-02, CDN-03 | T-18-29 | Stale widget quick actions fail closed while valid Bound targets still reset-navigate. | Guard + navigation test | `npm test -- src/services/widget/widget-quick-action-guard.test.ts src/navigation/widget-linking.test.ts` | Created/extended by 18-09 | ⬜ pending |
| 18-04-01 | 18-04 | 4 | CDN-01, CDN-02 | T-18-12 | Create passes saved-override/device-fallback region context into aggregate writes. | Component + form logic | `npm test -- src/components/ContactMethodsEditor.test.tsx src/screens/create-contact-logic.test.ts` | Created by 18-04 | ⬜ pending |
| 18-04-02 | 18-04 | 4 | CDN-01 | T-18-12 | Same-contact duplicate Save collapses and shows exact helper; cross-contact matches remain silent. | Component/DAO integration | `npm test -- src/components/ContactMethodsEditor.test.tsx src/screens/edit-contact-logic.test.ts src/db/contact-methods-dao.test.ts` | Existing/new owner tests | ⬜ pending |
| 18-04-03 | 18-04 | 4 | CDN-01, CDN-02 | T-18-12 | Edit retains draft on failure and round-trips typed collision/save state. | Form/DAO integration | `npm test -- src/screens/edit-contact-logic.test.ts src/db/contacts-dao.test.ts` | Created by 18-04 | ⬜ pending |
| 18-06-01 | 18-06 | 5 | CDN-01, CDN-02, CDN-03 | T-18-18 | Profile/Compose use only an actionable primary phone. | Screen logic | `npm test -- src/screens/contact-profile-logic.test.ts src/logic/compose-logic.test.ts` | Created by 18-06 | ⬜ pending |
| 18-06-02 | 18-06 | 5 | CDN-02, CDN-03 | T-18-19 | Bound/Unbound profile states retain relationship data and hide inactive cadence treatment. | Screen logic | `npm test -- src/screens/contact-profile-logic.test.ts` | Created by 18-06 | ⬜ pending |
| 18-06-03 | 18-06 | 5 | CDN-02, CDN-03 | T-18-19 | Profile dispatches confirmed Unbind through lifecycle effects and reloads state. | Screen/service integration | `npm test -- src/screens/contact-profile-logic.test.ts src/services/contact-lifecycle-effects.test.ts src/db/contact-lifecycle-dao.test.ts` | Created by 18-06/09 | ⬜ pending |
| 18-10-01 | 18-10 | 5 | CDN-01, CDN-04 | T-18-31 | Owner approves or defers the bounded Streamlined Export PII egress before implementation. | Blocking decision | `node -e "process.exit(0)"` | Existing checkpoint | ⬜ pending |
| 18-10-02 | 18-10 | 5 | CDN-01, CDN-04 | T-18-31 | If approved, streamlined share exposes only formatted actionable primaries; lossless export stays complete. | Export unit/integration | `npm test -- src/services/backup/share-export.test.ts src/services/backup/streamlined-contact-export.test.ts src/backup/export-manifest.test.ts` | Created by 18-10 | ⬜ pending |
| 18-10-03 | 18-10 | 5 | CDN-01, CDN-04 | T-18-32 | If approved, Backup screen invokes distinct Streamlined Export without changing full backup. | Screen test | `npm test -- src/screens/BackupScreen.test.tsx src/services/backup/streamlined-contact-export.test.ts` | Created by 18-10 | ⬜ pending |
| 18-08-01 | 18-08 | 6 | CDN-01, CDN-02, CDN-03, CDN-04 | T-18-02 | Final ledger covers scalar-method and nullable-cadence consumers plus Unbound AI/Logger PII boundaries. | Targeted-first then full regression | First, `npm test -- src/db/ai-context-read.test.ts src/db/contact-methods-dao.test.ts src/db/migrations/009-contact-data-normalization.test.ts src/db/contact-lifecycle-dao.test.ts src/db/digest-read.test.ts src/db/contact-status-read.test.ts src/services/impact.test.ts src/screens/CaptureScreen.test.tsx`; only after it passes, `npm test && npx tsc --noEmit && npm run check:colors` | Existing/new owner tests | ⬜ pending |
| 18-08-02 | 18-08 | 6 | CDN-01, CDN-02, CDN-03, CDN-04 | T-18-24 | Owner completes release-device migration/UI backstops. | Human UAT | `npm test && npx tsc --noEmit && npm run check:colors` | Existing checkpoint | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Planned Test Creation and Extension

- [ ] 18-01 Wave 1 creates `src/db/migrations/009-contact-data-normalization.test.ts` and `src/logic/contact-method-normalization.test.ts` for the selected parser threshold, migration fixtures, and lifecycle proof.
- [ ] 18-02 Wave 2 creates `src/db/contact-methods-dao.test.ts` and `src/db/contact-lifecycle-dao.test.ts`, then extends aggregate DAO tests for effective-region and collision results.
- [ ] 18-03/18-05/18-09 Waves 2-4 create or extend all lifecycle read, settings, Home, notification, widget, and quick-action guard owner tests; 18-05-02 specifically extends `src/db/dashboard-read.test.ts` for default Bound-only and persisted opt-in list/count parity.
- [ ] 18-07/18-10 Waves 3-4 extend backup tests and create the narrowed share/export plus Backup screen tests before changing their contracts.
- [ ] 18-08 Wave 6 extends `src/db/ai-context-read.test.ts` and its named Logger-boundary owner in `src/db/contact-methods-dao.test.ts`, then records the completed matrix.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Installed phone parser legitimacy | CDN-01 | The research audit marked the current `libphonenumber-js` release as suspicious solely because it is newly published. | Human verifies the package/release provenance before installation; record approval at the install checkpoint. |
| Android migration and contact-method UI | CDN-01, CDN-02, CDN-03 | Requires a device build and platform handoff/widget/notification refresh behavior. | Upgrade a v8 fixture on-device; create, bind, unbind, and rebind contacts; confirm Unbound is absent from proactive surfaces but retained in explicit views. |

---

## Validation Sign-Off

The following are execution-completion sign-offs, deliberately pending until 18-08 has run. This planning revision finalizes their task/wave ownership; it does not pre-approve unexecuted code.

- [ ] All tasks have `<automated>` verification.
- [ ] Sampling continuity: no three consecutive tasks without automated verification.
- [ ] Every test creation/extension is assigned to a named plan task and wave.
- [ ] No watch-mode flags.
- [ ] Feedback latency < 90 seconds.
- [ ] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
