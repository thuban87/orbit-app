---
phase: 30
slug: orrery-systems
status: verified
threats_open: 0
threats_below_threshold: 2
blocking_threshold: high
asvs_level: 1
created: 2026-09-09
---

# Phase 30 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| UI intent → SQLite writers | Builder, member-management, selector, and management actions enter the sole Systems DAO. | Local contact identifiers, rules, overrides, and System metadata |
| Stored rules → rendered membership | Bound SQL predicates and the TypeScript Gravity pass resolve contacts into an Orrery scene. | On-device contact rows and derived geometry |
| Zustand scene publication → UI-thread renderer | Discrete System/lifecycle state becomes continuously sampled Reanimated/Skia geometry. | Local identifiers, geometry, camera state, and animation progress |
| Local source → droid build host | Source is transported through the documented SSH pipeline without a git push. | Application source and native build output |
| Linux adb → physical Pixel | Debug installation, reverse-port changes, animation settings, and recordings affect the owner's device. | APK, local Metro traffic, and local visual evidence |
| Phase 30 → Phase 36 backup format | Phase 30 declares stable entities and token validation without emitting the future wire format. | Portable System identifiers and future backup contract |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation / evidence | Status |
|-----------|----------|-----------|----------|-------------|-----------------------|--------|
| T-30-01 | Tampering | Override writes | high | mitigate | Bound parameters and closed override-mode validation in `systems-dao.ts` | closed |
| T-30-02 | Denial of Service | Migration 022 | high | mitigate | Ordered migration transaction includes the `user_version` bump | closed |
| T-30-03 | Tampering | System names | medium | mitigate | NOCASE uniqueness plus cross-catalog create/rename preflight | closed |
| T-30-04 | Tampering | Last-System token | medium | mitigate | Closed built-in/category/custom grammar and write validation | closed |
| T-30-05 | Tampering | Rule resolver | high | mitigate | Closed rule mapping, bound Category UID lookup, canonical predicates | closed |
| T-30-06 | Tampering | Invalid rules | medium | mitigate | Invalid/missing rules become visible `BrokenRule` values | closed |
| T-30-07 | Information Disclosure | Resolver scope | medium | mitigate | Active-segregation scope is the default; widening is explicit | closed |
| T-30-08 | Tampering | Systems writers | high | mitigate | Mutations confined to transactional DAO with guards and `changes===1` checks | closed |
| T-30-09 | Elevation of Privilege | Immutable bases | high | mitigate | Custom/base reference guards at both DAO and UI boundaries | closed |
| T-30-10 | Tampering | Rename collisions | medium | mitigate | Same case-insensitive cross-catalog checks on create and rename | closed |
| T-30-11 | Repudiation / data loss | Delete and Undo | high | mitigate | Delete touches only Systems metadata and captures a portable transactional Undo snapshot | closed |
| T-30-12 | Tampering | Restore preference | medium | mitigate | Restore parser validates `orreryLastSystem` grammar | closed |
| T-30-13 | Tampering | Premature backup emission | high | mitigate | Format remains 4; export emits no Phase-36 Systems entities | closed |
| T-30-14 | Denial of Service | Missing restored custom ref | low | accept | Phase-36 repair is documented; runtime safely falls back to All Contacts | closed |
| T-30-15 | Tampering | Management rename | medium | mitigate | UI routes to guarded DAO; empty/colliding names rejected | closed |
| T-30-16 | Repudiation / data loss | Management delete | medium | mitigate | Confirmation plus short-lived committed Undo snapshot | closed |
| T-30-17 | Elevation of Privilege | Base management actions | high | mitigate | Base rows expose only sanctioned actions; DAO rechecks authority | closed |
| T-30-18 | Tampering | Member search/add | medium | mitigate | Canonical active predicates and bound IDs | closed |
| T-30-19 | Information Disclosure | Member population | medium | mitigate | Member reads apply canonical Dashboard population scope | closed |
| T-30-20 | Denial of Service | Manage Members grid | medium | mitigate | Same-axis nested `ScrollView`/`FlatList` can defeat virtualization; remediation deferred | open — below high threshold |
| T-30-21 | Denial of Service | Animation lifecycle | medium | mitigate | UI-thread sampling pauses on blur/background and resumes from held state | closed |
| T-30-22 | Tampering | Worklet closure ordering | high | mitigate | Helpers precede callers and compiled mapper tests pass | closed |
| T-30-23 | Denial of Service | Stale System reference | low | accept | Missing custom references safely select All Contacts | closed |
| T-30-24 | Information Disclosure | Hidden Systems | low | mitigate | Hidden catalog entries are removed before selector projection | closed |
| T-30-25 | Denial of Service | Catalog counts | low | accept | Count-on-open cost is bounded and passed physical-device UAT | closed |
| T-30-26 | Accessibility | Empty/broken distinction | medium | mitigate | Distinct icons, visible text, and accessibility labels | closed |
| T-30-27 | Tampering | Builder rules | high | mitigate | Closed draft mapping and DAO-side rule revalidation | closed |
| T-30-28 | Tampering | Builder save | medium | mitigate | Empty names blocked and all writes use guarded DAO composites | closed |
| T-30-29 | Repudiation | Unsaved changes | low | mitigate | Discard/Keep guard is wired to meaningful draft changes | closed |
| T-30-30 | Denial of Service | Preview rendering | medium | mitigate | Preview eagerly maps all rails/markers; viewport culling/LOD remediation deferred | open — below high threshold |
| T-30-31 | Elevation of Privilege | Preview input | low | mitigate | Preview taps only focus bodies; no Profile navigation path exists | closed |
| T-30-32 | Tampering | Preview worklets | high | mitigate | Worklet helpers precede callers and preview suites pass | closed |
| T-30-SC | Tampering | Supply chain | n/a | accept | Phase 30 adds no dependency or manifest change | closed |
| T-30-11-01 | Denial of Service | Choreography sampler | high | mitigate | Pure bounded pass over fixed entries; no React frame state or growing cache | closed |
| T-30-11-02 | Tampering | Re-target generations | medium | mitigate | Stable keys, generation ownership, and displayed-sample re-targeting | closed |
| T-30-11-03 | Elevation of Privilege | Departing hit targets | medium | mitigate | Departures become immediately inert; shared frame owns hit authority | closed |
| T-30-11-04 | Information Disclosure | Animation state | low | accept | Geometry is local-only, already rendered, and neither persisted nor transmitted | closed |
| T-30-12-01 | Denial of Service | Live UI-thread animation | high | mitigate | One SharedValue driver/derived frame plus physical Pixel evidence | closed |
| T-30-12-02 | Tampering | Scene publication | high | mitigate | Generation guards, persistence-publication filter, and exact re-target/completion tests | closed |
| T-30-12-03 | Tampering | Droid artifact provenance | medium | mitigate | Marker check, scoped transport, Gradle evidence, timestamp, size, and SHA-256 recorded | closed |
| T-30-12-04 | Denial of Service | Shared adb topology | medium | mitigate | SDK adb, single live Pixel, scoped reverse, and verified 8081 restoration | closed |
| T-30-12-05 | Information Disclosure | Device recordings | low | accept | Owner-authorized local-only recordings; no upload or telemetry | closed |
| T-30-12-06 | Spoofing | Device evidence | medium | mitigate | Live serial/model/product prove physical Pixel; no emulator evidence used | closed |

*Only open threats at or above `workflow.security_block_on: high` count toward `threats_open`.*

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-30-01 | T-30-14 | Full orphan repair belongs to the already-decided Phase 36 backup implementation; Phase 30 safely falls back. | Phase plan / owner-approved scope | 2026-09-09 |
| AR-30-02 | T-30-23 | A stale local reference falls back safely rather than blocking startup. | Phase plan / owner-approved scope | 2026-09-09 |
| AR-30-03 | T-30-25 | Bounded local count-on-open cost passed physical-device UAT. | Phase plan / owner-approved scope | 2026-09-09 |
| AR-30-04 | T-30-SC | No supply-chain surface was added. | Phase plan / owner-approved scope | 2026-09-09 |
| AR-30-05 | T-30-11-04 | Rendered local geometry introduces no new disclosure channel. | Phase plan / owner-approved scope | 2026-09-09 |
| AR-30-06 | T-30-12-05 | Test recordings stay local and were explicitly authorized for device verification. | Owner-approved device test | 2026-09-09 |

## Non-Blocking Remediation

- `T-30-20`: remove same-axis nested virtualized lists or give the member grid independent bounded scrolling before very large contact sets are a release target.
- `T-30-30`: add viewport culling or level-of-detail behavior to Preview before very large Systems are a release target.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open Below Threshold | Blocking Open | Run By |
|------------|---------------|--------|----------------------|---------------|--------|
| 2026-09-09 | 43 | 41 | 2 | 0 | `gsd-security-auditor` |

The threat-oriented audit ran 14 suites / 100 tests successfully.

## Sign-Off

- [x] All threats have a disposition.
- [x] Accepted risks are documented.
- [x] `threats_open: 0` confirmed at the configured `high` threshold.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-09-09
