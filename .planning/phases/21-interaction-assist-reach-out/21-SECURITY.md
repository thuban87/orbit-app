---
phase: 21-interaction-assist-reach-out
gate: security
verdict: SECURED
threats_total: 20
threats_open: 0
asvs_level: 1
block_on: high
audited_at: 2026-08-31
auditor: gsd-security-auditor (read-only); persisted by orchestrator
---

# Phase 21 Security Verification — SECURED

Retroactive verification that the phase's threat-model mitigations (T-21-01 … T-21-19,
across the 6 plans) exist in the implemented code on disk. Read-only audit; no source
modified. **20/20 threats closed, 0 open.** ASVS L1, block_on=high — no high threat is open.

## Threat register (verified against code)

| Threat ID | Category | Severity | Disposition | Evidence |
|-----------|----------|----------|-------------|----------|
| T-21-01 | Tampering | medium | mitigate | All params `?`-bound (`interaction-assist-dao.ts:37-63,118-123`); `channel`/`status` CHECK-constrained (`014-interaction-assists.ts:12,15`); no string interpolation |
| T-21-02 | Repudiation/Integrity | high | mitigate | Confirmation routes `insertInteractionCore`+`recomputeLastContactCore`+`bumpDataRevisionCore` in ONE `inWriteTransaction` (`interaction-assist-dao.ts:91-124`); `rejectFutureOccurredAt` pre-txn; sole `last_contact` writer verified (only `recency-dao.ts:166` repo-wide) |
| T-21-02b | Integrity (TOCTOU) | low | mitigate | Writes bind to the row re-read INSIDE the txn, never the pre-read cache |
| T-21-03 | DoS | low | accept | Cap-5 at write + 24h expiry; local-only. Accepted-risk (see below) |
| T-21-04 | Info disclosure | low | accept | Rows local-only; egress scan clean. Accepted-risk |
| T-21-05 | Info disclosure | low | accept | `tel:`/`sms:`/`mailto:` OS intents only (`handoff.ts:61-65`), no server path. Accepted-risk |
| T-21-06 | Spoofing (UX) | medium | mitigate | Attestation-only copy ("Did you reach/text/email {name}?"), buttons Yes/No answer/Don't log; no delivered/sent/read claim |
| T-21-07 | Tampering | low | mitigate | Plain `position:absolute` overlay, no `Modal`; Back passes through |
| T-21-08 | Elevation | high | mitigate | No CALL_PHONE/READ_SMS/SEND_SMS/READ_CALL_LOG in config/manifest; managed Expo; phase JS-only (git-diff-verified); `expo-sms` uses permissionless `sms:` intent |
| T-21-09 | Info disclosure | low | accept | `endpoint_value` is transient handoff context. Accepted-risk |
| T-21-10 | Integrity | medium | mitigate | Compose Send calls only `performReachOut` (pending assist, no interaction); interaction written solely on banner confirm |
| T-21-11 | Info disclosure/privacy | high | mitigate | Toggle-OFF expires all pending in one txn (`app-settings-dao.ts:634-641`); SettingsScreen awaits set then banner refresh — clears without an AppState transition |
| T-21-12 | DoS | low | mitigate | 24h expiry + 30d retention sweep; cap-5 |
| T-21-13 | Tampering | medium | mitigate | Sweep is a factory with no import-time side effect; registered foreground-only via `registerSweepHook`; headless `widgetTaskHandler` never reaches it |
| T-21-14 | Tampering/DoS | high | mitigate | Anchored `^orbit://reach/([0-9]+)$` + `parseWidgetId` (`Number.isSafeInteger` + `id>0`) + non-string reject (`widget-linking.ts:105-130`) |
| T-21-15 | Tampering (resurrection) | high | mitigate | `guardWidgetIntent` discriminated live-check: missing→Dashboard+Alert, archived→silent drop; merge reparents `interaction_assists`; FK ON DELETE CASCADE. No orphan/resurrection |
| T-21-16 | Elevation | high | mitigate | Widget emits only URI; OPEN_URI/non-CLICK_MARK returns without writing |
| T-21-17 | Info disclosure | low | accept | Deep-link nav is local; egress scan clean. Accepted-risk |
| T-21-18 | Integrity | high | mitigate | Code enforces handoff-time `occurred_at` + sole recency writer; device UAT DB-verified on Pixel (7 assist interactions `occurred_at===handoff_at`, migration 014 applied 13→14, owner sign-off) |
| T-21-19 | Spoofing | high | mitigate | Strict parse (T-21-14) + lifecycle guard (T-21-15) + consume-once param clear (`ContactProfileScreen.tsx:319-321`); UAT drove spoof/purged cases, no crash/resurrection |

## Local-first posture

Network-egress grep across every phase path (`handoff.ts`, `interaction-assist-dao.ts`,
`interaction-assist-read.ts`, `widget-linking.ts`, `widget-quick-action-guard.ts`,
`assist-store.ts`, `assist-eligibility.ts`, `AssistBanner.tsx`, `AssistConfirmation.tsx`,
`ReachOutRouter.tsx`, `ComposeScreen.tsx`) — **zero** `fetch`/XHR/axios/WebSocket/`http(s)://`
hits. The only outbound calls are `SMS.sendSMSAsync` and `Linking.openURL('tel:'|'mailto:')` —
permissionless OS handoffs; no content leaves the device. Keys/secrets: N/A this phase.

## Accepted risks (low; rationale from the plan `<threat_model>` blocks)

- **T-21-03 (DoS):** pending queue capped at 5 with 24h expiry — bounded local growth.
- **T-21-04 / T-21-09 / T-21-17 (Info disclosure):** assist rows, `endpoint_value`, and deep-link
  navigation are all device-local; no egress path exists.
- **T-21-05 (Info disclosure):** reach-out is OS intents only; content the user hands to the
  dialer/SMS/mail app is the user's own action, not app egress.

## Unregistered flags

None. No executor declared a `## Threat Flags` section in any 21-0x-SUMMARY.md; no new
unmapped attack surface.

**Verdict: SECURED (threats_open: 0).**
