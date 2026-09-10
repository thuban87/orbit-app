---
phase: 31
slug: profile-experience
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-10
---

# Phase 31 — Security

> ASVS Level 1 verification of the authored Phase 31 STRIDE register against the shipped local-only Profile subsystem.

## Trust Boundaries

| Boundary | Description | Data crossing |
|----------|-------------|---------------|
| Profile UI → SQLite | Presentation actions persist through public parameter-bound DAOs | Layout/background UIDs, collapse state, relationship actions |
| SQLite → Profile snapshot | One coherent local read becomes owner-visible semantic Profile data | Contact identity, methods, knowledge, history, presentation |
| Native picker → app storage | User-selected bytes become a bounded app-owned derivative | Local image bytes and UID-derived relative path |
| Navigation intent → Profile | Cross-stack and one-shot intents select the visible contact/action | Contact ID and serializable origin/action |
| Profile → native handoff | Explicit Call/Message/Email actions may leave Orbit | User-selected endpoint only |
| Gesture/accessibility input → draft | Native interactions change validated presentation draft state | Closed semantic layout/crop operations |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation evidence | Status |
|-----------|----------|-----------|----------|-------------|---------------------|--------|
| T-31-01 | Tampering | migration | high | mitigate | ordered migration checkpoint and chain tests | closed |
| T-31-02 | Tampering/DoS | collapse write | high | mitigate | bound DAO write, outer transaction, rollback/readback tests | closed |
| T-31-04 | Tampering | reset/delete writers | high | mitigate | narrow presentation-only rows, transaction and protected-data assertions | closed |
| T-31-05 | Denial of Service | transaction mutex | high | mitigate | public wrapper/internal-core composition pattern | closed |
| T-31-06 | Tampering | SQL | medium | mitigate | bound values and closed column/order vocabulary | closed |
| T-31-07 | Tampering | cadence metrics | high | mitigate | tagged availability plus null/month-boundary tests | closed |
| T-31-08 | Tampering/DoS | relationship actions | high | mitigate | one outer transaction, canonical cores, rollback tests | closed |
| T-31-09 | Information Disclosure | Off Limits | high | mitigate | owner-facing narrow reader and projection-exclusion tests | closed |
| T-31-10 | Tampering | dynamic SQL | high | mitigate | bound IDs and closed order fragments | closed |
| T-31-11 | Information Disclosure | Profile load | high | mitigate | `inReadSnapshot` over local SQLite; no network read dependency | closed |
| T-31-12 | Tampering | tile actions | high | mitigate | composed public writers publish only after success/readback | closed |
| T-31-13 | Denial of Service | responsive grid | medium | mitigate | pure deterministic packer with width/font coverage | closed |
| T-31-14 | Spoofing | disabled actions | low | mitigate | explicit disabled state and textual reason | closed |
| T-31-15 | Information Disclosure | hidden/Off Limits | high | mitigate | source-owner filters, explicit administration, projection tests | closed |
| T-31-16 | Tampering | card actions | medium | mitigate | owning DAO delegation and publish-after-success | closed |
| T-31-17 | Tampering/DoS | editor draft | high | mitigate | closed reducer/parser and illegal-transition tests | closed |
| T-31-18 | Repudiation | unsaved changes | medium | mitigate | canonical dirty check and Discard/Keep guard | closed |
| T-31-19 | Tampering | in-use deletion | high | mitigate | usage preview, confirmation, atomic reference cleanup | closed |
| T-31-20 | Repudiation | assignment source | medium | mitigate | textual scope/source plus publish-after-success | closed |
| T-31-21 | Tampering | background paths | high | mitigate | UID-derived `profile-backgrounds/` allowlist and traversal tests | closed |
| T-31-22 | Denial of Service | image decode | high | mitigate | bounded derivative, one crop/resize/encode pass, resource release | closed |
| T-31-23 | Tampering/data loss | replacement order | high | mitigate | serialized tmp/bak replacement and interruption tests | closed |
| T-31-23A | Tampering/data loss | launch reconciliation | high | mitigate | ready-gated reference-counted sweep and multi-referrer tests | closed |
| T-31-24 | Information Disclosure | integrated Profile | high | mitigate | local aggregate, narrow Off Limits, no Profile AI/network entry | closed |
| T-31-25 | Tampering | reset/action wiring | high | mitigate | public DAOs and protected-data regression tests | closed |
| T-31-26 | Spoofing/Repudiation | sheets/actions | medium | mitigate | topmost/inert semantics, textual state/reason, owner UAT | closed |
| T-31-G02 | Tampering | layout/background drafts | high | mitigate | Save-only/dirty-guard/cancel session and manager tests | closed |
| T-31-G01 | Information Disclosure | BackgroundHost | high | mitigate | bundled or validated app-owned local sources only | closed |
| T-31-G05 | Denial of Service | Profile Back | high | mitigate | origin integration tests and physical-Pixel Back evidence | closed |
| T-31-art | Tampering | bundled asset identity | medium | mitigate | owner approval preceded slot replacement; provenance recorded | closed |
| T-31-local | Information Disclosure | background path | high | mitigate | bundled/local assets only; no download, telemetry, or backend path | closed |
| T-31-release | Repudiation | visual verification | medium | mitigate | retained screenshots, checklist observations, owner review | closed |
| T-31-13-01 | Information Disclosure | image pipeline | high | mitigate | picker-to-app-owned JPEG and safe relative paths; no egress | closed |
| T-31-13-02 | Denial of Service | crop preparation | medium | mitigate | bounded selection, derivative cap, one-pass processing, retry | closed |
| T-31-13-03 | Repudiation | gesture acceptance | medium | mitigate | Pixel artifacts and direct owner touch/pinch approval | closed |
| T-31-13-04 | Spoofing | modal gesture root | low | mitigate | `GestureHandlerRootView` at native Modal content root | closed |
| T-31-14-01 | Tampering | layout drag reducer | medium | mitigate | release index routes through closed parent-aware reducer | closed |
| T-31-14-02 | Tampering | arbitrary assignment | high | mitigate | bound selected contact ID and layout-only DAO assertions | closed |
| T-31-14-03 | Spoofing | assignment copy | medium | mitigate | selected contact named; inherited vs explicit action separated | closed |
| T-31-14-04 | Information Disclosure | contact selector | high | mitigate | active on-device contacts only; no external transport | closed |
| T-31-14-05 | Repudiation | drag acceptance | low | mitigate | bounded Pixel result and owner approval recorded | closed |
| T-31-15-01 | Tampering | global/category clear | high | mitigate | fresh axis-specific nullable writes preserve sibling layout UID | closed |
| T-31-15-02 | Tampering | contact inherit | high | mitigate | contact background writer retains layout/freeform/collapse data | closed |
| T-31-15-03 | Spoofing | assignment labels | medium | mitigate | labels name Category/global/theme inheritance result | closed |
| T-31-15-04 | Information Disclosure | background manager | high | mitigate | local media and SQLite-only path; no egress | closed |
| T-31-15-05 | Repudiation | UAT result | low | mitigate | observed Pixel result recorded in UAT Test 9/checklist row 45 | closed |

*All 46 authored threats are closed. No accepted or transferred risks were used to satisfy the gate.*

## Accepted Risks Log

No accepted risks.

## ASVS Level 1 Evidence

- The Profile read path is `readProfileSnapshot` → `inReadSnapshot`; no production Profile/background module imports a network client or adds a fetch path.
- Presentation SQL accepts parameter-bound values and closed semantic IDs. Background paths are restricted in both DAO and storage layers to app-owned `profile-backgrounds/<uid>.jpg` names.
- Destructive presentation actions are scoped to presentation rows and transaction-tested against sibling axes and protected contact/relationship facts.
- Off Limits remains owner-visible caution data and excluded from ranked/search/AI projections; no new AI invocation or widened egress exists.
- Native evidence is retained for origin Back, inert overlays, drag/pinch, artwork, assignment, clear/inherit, accessibility journeys, and the final shared-template lifecycle.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-10 | 46 | 46 | 0 | Codex orchestrator, ASVS L1 authored-register audit |

## Sign-Off

- [x] All threats have a disposition.
- [x] No accepted risks require documentation.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-09-10
