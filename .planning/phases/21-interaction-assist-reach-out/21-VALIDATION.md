---
phase: 21
slug: interaction-assist-reach-out
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-31
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled from 21-RESEARCH.md §Validation Architecture; commands verified against package.json on disk.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (`[VERIFIED: package.json devDependencies]`) |
| **Config file** | `vitest.config.ts` (`[VERIFIED: exists at repo root]`) |
| **Quick run command** | `npx vitest run <file>` (single/touched suite) |
| **Full suite command** | `npm test` (`[VERIFIED: package.json scripts.test = "vitest run"]`) |
| **Colour gate** | `npm run check:colors` (`[VERIFIED: scripts.check:colors = "bash scripts/check-colors.sh"]`) |
| **Type gate** | `npx tsc --noEmit` |
| **Estimated runtime** | full node suite ~20–40s (estimate — node-pure DAO/logic suites against the `__testkit__` executor, no device); single touched file <5s |

**DAO contract (node-pure):** every DAO takes `exec: SqlExecutor` and is tested node-side against the
`__testkit__` executor (`recency-dao.test.ts`, `merge-dao.test.ts`, `purge-dao.test.ts` are the shipped
precedents). The new `interaction-assist-dao.ts` follows the same shape, so cap-5 / expiry / resolve /
merge-reparent logic is node-testable without a device.

**What Vitest CANNOT cover (device-UAT only, per 21-RESEARCH.md + project MEMORY):** `expo-sms` / `Linking`
native handoff, Hermes crypto runtime behavior, the RemoteViews widget render, and the AppState
return-banner timing on-device. These are verified in Plan 06 on the Pixel (run-as, WAL-aware) — see
Manual-Only Verifications below.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file(s)>`
- **After every plan wave:** Run `npm test` (full `vitest run`)
- **Before `/gsd-verify-work`:** Full suite must be green, then **device UAT on the Pixel** (Plan 06) for the
  native-handoff / banner / widget flows
- **Max feedback latency:** <5s per touched file; ~40s full suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | IAS-02, IAS-03 | T-21-02 | Confirmation routes only through `recordTouchpoint` (single-writer of `contacts.last_contact`); deterministic interaction uid blocks double-insert | unit (tracer, RED-first) | `npx vitest run src/db/interaction-assist-dao.test.ts` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | IAS-01, IAS-02 | T-21-01 | 15s/24h thresholds shared between SQL filter + client re-check; no timer | unit | `npx vitest run src/db/interaction-assist-read.test.ts src/logic/assist-eligibility.test.ts` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 2 | IAS-02 | T-21-05 | Assist row written BEFORE native launch (durability); refresh gated to background→active only | unit | `npx vitest run src/stores/assist-store.test.ts` | ❌ W0 | ⬜ pending |
| 21-02-02 | 02 | 2 | IAS-01, IAS-03 | T-21-06 | No delivery/read-status claim; banner is a plain overlay, not a Modal (Back passes through) | type + colour | `npm run check:colors && npx tsc --noEmit` | ✅ (tooling) | ⬜ pending |
| 21-02-03 | 02 | 2 | IAS-01 | T-21-07 | Banner mounted app-global, non-Modal; Reach Out entry only when reachable | type + colour | `npx tsc --noEmit && npm run check:colors` | ✅ (tooling) | ⬜ pending |
| 21-03-01 | 03 | 3 | IAS-01 | T-21-09 | Chosen endpoint is transient handoff context; ≤3-tap routing depth | type + colour | `npx tsc --noEmit && npm run check:colors` | ✅ (tooling) | ⬜ pending |
| 21-03-02 | 03 | 3 | IAS-02 | T-21-10 | Compose Send writes NO interaction at Send time (grep-enforced) | type | `npx tsc --noEmit` | ✅ (tooling) | ⬜ pending |
| 21-04-01 | 04 | 3 | IAS-02 | T-21-11 | Toggle OFF clears pending in ONE txn ("off means off"); no interaction written | unit | `npx vitest run src/db/app-settings-dao.test.ts` | ✅ (extend) | ⬜ pending |
| 21-04-02 | 04 | 3 | IAS-02 | T-21-11 | Review sheet is transient (no new nav route); accent reserved for disclosure | type + colour | `npx tsc --noEmit && npm run check:colors` | ✅ (tooling) | ⬜ pending |
| 21-04-03 | 04 | 3 | IAS-02 | T-21-12, T-21-13 | 24h expiry + 30d prune as wall-clock deltas; no timer; foreground-only sweep | unit | `npx vitest run src/services/interaction-assist-sweep.test.ts` | ❌ W0 | ⬜ pending |
| 21-05-01 | 05 | 3 | IAS-03 | T-21-15 | Merge reparents assist to survivor (no resurrection); purge cascade removes it | unit | `npx vitest run src/db/merge-dao.test.ts src/db/purge-dao.test.ts` | ✅ (extend) | ⬜ pending |
| 21-05-02 | 05 | 3 | IAS-03, IAS-04 | T-21-14, T-21-16 | `orbit://reach/<id>` strict anchored allow-list rejects spoof/oversized; widget writes nothing | unit + type | `npx vitest run src/navigation/widget-linking.test.ts && npx tsc --noEmit` | ✅ (extend) | ⬜ pending |
| 21-06-01 | 06 | 4 | IAS-01, IAS-02, IAS-03, IAS-04 | T-21-18 | Full node suite green before an irreversible migration reaches a real device | gate | `npm test && npx tsc --noEmit && npm run check:colors` | ✅ (tooling) | ⬜ pending |
| 21-06-02 | 06 | 4 | IAS-01, IAS-02, IAS-03, IAS-04 | T-21-18, T-21-19 | Native handoff / banner timing / widget render DB-verified on-device (run-as, WAL-aware) | manual (device UAT) | `MISSING — device-only` + `<human-check>` owner sign-off | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test files to author RED-first before implementation (from 21-RESEARCH.md §Wave 0 Gaps):

- [ ] `src/db/interaction-assist-dao.test.ts` — create/cap-5/resolve/toggle-off (IAS-02, IAS-03)
- [ ] `src/db/interaction-assist-read.test.ts` — route derivation + eligible-queue query (IAS-01, IAS-02)
- [ ] `src/logic/assist-eligibility.test.ts` — pure ≥15s/≤24h/newest+count eligibility (IAS-01, IAS-02)
- [ ] `src/stores/assist-store.test.ts` — refresh mapping + background→active gating (IAS-02)
- [ ] `src/services/interaction-assist-sweep.test.ts` — 24h expire + 30d prune (IAS-02)

Existing suites to extend (already present on disk):

- [ ] `src/db/app-settings-dao.test.ts` — off-clears-pending + round-trip (IAS-02)
- [ ] `src/db/merge-dao.test.ts` — assist reparented to survivor (IAS-03)
- [ ] `src/db/purge-dao.test.ts` — assist removed on purge cascade (IAS-03)
- [ ] `src/navigation/widget-linking.test.ts` — `orbit://reach/<id>` accepted, malformed rejected (IAS-04)

---

## Manual-Only Verifications

Device-UAT-only (not node-testable); driven and DB-verified on the Pixel in Plan 06 (Task 2 matrix).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native Call/Text/Email handoff (`tel:`/`sms:`/`mailto:`) fires + failure → `failed` + per-channel Alert | IAS-01, IAS-02 | `expo-sms`/`Linking` intents need a real OS + apps; no node surface | Drive Reach Out on-device; confirm handoff and thrown-launch → assist `failed`, no prompt |
| App-global banner appears on foreground return (>15s), Back passes THROUGH it | IAS-02 | AppState return-banner timing is a real-runtime behavior | Return after >15s → banner; press Back → banner persists (not dismissed) |
| Confirmed interaction row invariants (occurred_at === handoff_at, direction=outbound, source=assist, connected per action) | IAS-03 | Verified against the on-device DB, not a screen render | run-as WAL-aware DB read per confirmation row |
| Larger widget's "Contact" RemoteViews render + deep-link into the router; purged target → "no longer available" → Dashboard | IAS-04 | RemoteViews render + launcher deep-link are device-only | Tap widget Contact action; drive purged/merged/archived targets |
| Process death / reboot preserves non-expired pending assists | IAS-02, IAS-03 | Requires killing the process on a real device | Kill/reboot with pending assists; confirm resume via banner + DB |
| Hermes crypto runtime (`newUid` fallback) | IAS-02 | Node has WebCrypto so tests never exercise the Hermes path | Verified implicitly by on-device assist creation |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (21-06-02 is the one documented device-only manual verification, with a `<human-check>` owner gate)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (waves 1–3 are node/type/colour gated end-to-end)
- [x] Wave 0 covers all MISSING references (5 new suites + 4 extended suites enumerated above)
- [x] No watch-mode flags (all commands are `vitest run`, never `vitest --watch`)
- [x] Feedback latency < ~40s full suite / <5s per file
- [ ] `nyquist_compliant: true` — NOT set; see note

**Approval:** pending (validate-phase promotes `status` + `nyquist_compliant` after Wave 0 lands)

> **Note — nyquist_compliant left false:** every phase requirement (IAS-01…IAS-04) has node-automated
> coverage for its core logic (DAO / read / eligibility / allow-list), but each requirement also has
> genuinely device-only behavior — native `expo-sms`/`Linking` handoff, AppState banner timing, the
> RemoteViews widget render, and Hermes crypto — that Vitest cannot exercise. Those are captured as the
> Plan 06 device-UAT matrix (Manual-Only Verifications above) with an owner sign-off gate, not as
> automated `<automated>` verifies. `nyquist_compliant` is therefore honestly false until validate-phase
> confirms the Wave 0 suites are green and records the device-UAT evidence.
