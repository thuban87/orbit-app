# Remediation Groups

These 43 groups preserve 84 source records representing 76 distinct OPEN/INVESTIGATE candidates. The separately deferred RN-013 stays in TRIAGE.md. No group is a phase or selected work. Original IDs are qualified by packet to avoid the REL collision. Source links carry the detailed evidence; synthesis has not re-audited every subsystem.

Each group retains its constituent confidence and disposition. Verification requirements below combine, rather than replace, the source requirements. A mixed group does not promote its INVESTIGATE member to OPEN. All changes remain subject to recorded invariants; reversing an ADR/HANDOFF decision requires the owner. No effort estimates or numeric priorities are assigned.

## Group dependency map

**ENABLES** means useful but nonmandatory sequencing. **RELATED** means coordination without order. No **BLOCKS** edge is justified by the present evidence. Investigation before deciding its own remedy is an internal gate, not a new group dependency.

| From | Type | To | Rationale |
|---|---|---|---|
| [RG-001](#rg-001) | RELATED | [RG-032](#rg-032) | Same widget native artifact and launcher matrix; access authorization and accessible names are independent. |
| [RG-001](#rg-001) | RELATED | [RG-013](#rg-013) | Both involve widget images; provider access and private ImageManipulator cache lifetime are separate copies and controls. |
| [RG-002](#rg-002) | RELATED | [RG-009](#rg-009) | Untrusted acquisition precedes restore, but valid-input reconciliation defects reproduce independently. |
| [RG-002](#rg-002) | RELATED | [RG-014](#rg-014) | Incoming acquisition and outgoing share staging have distinct lifetime owners. |
| [RG-003](#rg-003) | RELATED | [RG-004](#rg-004) | Shared resource-boundary pattern, independent Expo fetch and Custom native implementations. |
| [RG-005](#rg-005) | RELATED | [RG-006](#rg-006) | Both preserve credential recipient identity; upgrade/restore hypothesis differs from confirmed accordion draft leakage. |
| [RG-005](#rg-005) | RELATED | [RG-009](#rg-009) | Portable AI metadata crosses restore; credential binding remains a separate nonportable boundary. |
| [RG-007](#rg-007) | RELATED | [RG-008](#rg-008) | Stored consent provenance and truthful permission UI complement each other without replacing generation gates. |
| [RG-007](#rg-007) | RELATED | [RG-012](#rg-012) | Imported notes have both consent and workflow-retention obligations. |
| [RG-009](#rg-009) | RELATED | [RG-010](#rg-010) | Shared restore planning/staging/commit boundary; coordinate transaction and media ownership changes. |
| [RG-010](#rg-010) | RELATED | [RG-011](#rg-011) | Correct media recovery and truthful restore outcomes are independently actionable and jointly verified. |
| [RG-010](#rg-010) | RELATED | [RG-013](#rg-013) | Canonical masters and generated cache copies have different ownership and cleanup APIs. |
| [RG-012](#rg-012) | RELATED | [RG-043](#rg-043) | Import/consolidation creates multi-source inputs; later explicit review selection is independently broken. |
| [RG-013](#rg-013) | RELATED | [RG-014](#rg-014) | Unmanaged temporary-copy pattern; image processing and cross-app sharing need different safe lifetimes. |
| [RG-015](#rg-015) | RELATED | [RG-042](#rg-042) | Same notification subsystem, separate scheduling/presentation and navigation responsibilities. |
| [RG-016](#rg-016) | ENABLES | [RG-010](#rg-010) | Reliable launch recovery makes pending photo ownership verification repeatable; direct recovery tests remain possible first. |
| [RG-016](#rg-016) | ENABLES | [RG-012](#rg-012) | Failure-contained maintenance supports durable import retry/sweep verification; no forced implementation order. |
| [RG-016](#rg-016) | ENABLES | [RG-015](#rg-015) | Prevents unrelated early hooks starving notification reconciliation; scheduler defects still require independent fixes. |
| [RG-017](#rg-017) | RELATED | [RG-018](#rg-018) | Both touch complete edit orchestration; atomic writer semantics and committed form baselines are distinct. |
| [RG-018](#rg-018) | RELATED | [RG-019](#rg-019) | Committed-write/failed-read retry pattern across different editor coordinators. |
| [RG-020](#rg-020) | RELATED | [RG-022](#rg-022) | Same Home owner, but panel settlement and async reload authority are independent. |
| [RG-020](#rg-020) | RELATED | [RG-031](#rg-031) | Contacts traversal and row-level accessible context need joint TalkBack checks. |
| [RG-021](#rg-021) | RELATED | [RG-042](#rg-042) | Navigation topology and ingress chronology interact in tests without sharing an implementation prerequisite. |
| [RG-023](#rg-023) | ENABLES | [RG-024](#rg-024) | Complete producer publication supports Profile consumer integration tests; consumer work can use existing Quick Log first. |
| [RG-023](#rg-023) | ENABLES | [RG-026](#rg-026) | Complete producer publication supports Digest assist refresh; existing Quick Log already supplies a signal. |
| [RG-024](#rg-024) | RELATED | [RG-025](#rg-025) | Same Profile host, separate snapshot/calendar and retry-state defects. |
| [RG-026](#rg-026) | RELATED | [RG-028](#rg-028) | Digest correctness and bounded query cost share readers but are independently testable. |
| [RG-026](#rg-026) | RELATED | [RG-033](#rg-033) | Digest heatmap visibility and data freshness require different checks. |
| [RG-029](#rg-029) | RELATED | [RG-030](#rg-030) | Shared UI contracts; contrast and names/targets/native colors are separate acceptance dimensions. |
| [RG-029](#rg-029) | RELATED | [RG-036](#rg-036) | Backup action and passphrase presentation can share visual verification without changing encryption. |
| [RG-030](#rg-030) | RELATED | [RG-034](#rg-034) | Shared buttons and large text; expanding targets must preserve confirmation reachability. |
| [RG-031](#rg-031) | RELATED | [RG-043](#rg-043) | Recognizable review context and faithful chosen-value transport are both needed for trustworthy reconciliation. |
| [RG-033](#rg-033) | RELATED | [RG-034](#rg-034) | Common narrow-width/large-text test dimensions, not one shared root cause. |
| [RG-035](#rg-035) | RELATED | [RG-012](#rg-012) | Import fatal-state feedback must distinguish completed contacts from unfinished photo work. |
| [RG-035](#rg-035) | RELATED | [RG-019](#rg-019) | Read-error presentation must not replay an already committed participant write; picker read fallback remains held. |
| [RG-039](#rg-039) | RELATED | [RG-020](#rg-020) | Native accessibility investigation of shell transients; outcomes are not assumed from opacity/group props. |
| [RG-040](#rg-040) | RELATED | [RG-001](#rg-001) | Both require final manifest inspection but different permission/provider controls. |
| [RG-040](#rg-040) | RELATED | [RG-041](#rg-041) | Active scaffold defaults; independent security and artwork decisions. |

<a id="rg-001"></a>

## RG-001 — Widget image access boundary

**Highest Severity:** S1 — Major  
**Scope:** Multi-area  
**Domains:** security  
**Constituent Findings:** 1 source record (S1: 1)  
**Disposition:** OPEN

### Problem

Unrelated apps can read predictable widget bitmaps containing relationship information.

### Shared Root Cause / Remediation Affinity

The native provider and launcher grants form one authorization boundary.

### Constituent Findings

- [security/AUD-SEC-001](../security/DOMAIN-AUDIT.md#aud-sec-001--widget-snapshots-readable-by-unrelated-apps) — Widget snapshots readable by unrelated apps (S1, C3, OPEN).

### Desired Outcome

Only intended widget hosts can read rendered snapshots.

### Constraints / Invariants

Preserve owner-approved home-screen fuel, repeated actions, and working RemoteViews. Do not remove the widget to avoid the boundary.

### Dependencies

- RG-001 **RELATED** RG-032: Same widget native artifact and launcher matrix; access authorization and accessible names are independent.
- RG-001 **RELATED** RG-013: Both involve widget images; provider access and private ImageManipulator cache lifetime are separate copies and controls.
- RG-040 **RELATED** RG-001: Both require final manifest inspection but different permission/provider controls.

### Verification Expectations

Inspect a freshly built release manifest; an ordinary unprivileged app must be denied even a known URI. Check launcher rendering, resize, refresh and reboot.

Required source verification dimensions: DEVICE, STATIC.

### Planning Notes

Native dependency/configuration work and fresh artifact verification are necessary; historical APK corroboration is not current-release clearance.

### Explicitly Out of Scope

Changing visible widget content, launcher trust policy beyond this defect, or adding an app lock.

<a id="rg-002"></a>

## RG-002 — Bounded and defensive Android backup ingress

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** security  
**Constituent Findings:** 2 source records (S2: 2)  
**Disposition:** OPEN

### Problem

External backup streams and general share metadata can exhaust resources or fail before safe JavaScript handling.

### Shared Root Cause / Remediation Affinity

Both native receivers see backup intents; stream ownership and defensive dispatch must be considered together, but neither finding alone fixes the other.

### Constituent Findings

- [security/AUD-SEC-002](../security/DOMAIN-AUDIT.md#aud-sec-002--backup-intake-consumes-unbounded-provider-streams-and-payloads) — Backup intake consumes unbounded provider streams and payloads (S2, C3, OPEN).
- [security/AUD-SEC-003](../security/DOMAIN-AUDIT.md#aud-sec-003--native-share-handler-trusts-malformed-provider-metadata) — Native share handler trusts malformed provider metadata (S2, C2, OPEN).

### Desired Outcome

Cold/warm acquisition rejects malformed, oversized or stalled inputs safely and leaves bounded temporary state.

### Constraints / Invariants

Preserve valid text capture, JSON backup sharing, preview-before-write, optional encryption, and all supported formats.

### Dependencies

- RG-002 **RELATED** RG-009: Untrusted acquisition precedes restore, but valid-input reconciliation defects reproduce independently.
- RG-002 **RELATED** RG-014: Incoming acquisition and outgoing share staging have distinct lifetime owners.

### Verification Expectations

Use controlled providers with missing cursor/type/columns, revoked grants, oversized/endless/stalled streams and encrypted expansion. Assert cancellation, cleanup, responsive errors and no DB mutation.

Required source verification dimensions: DEVICE, STATIC.

### Planning Notes

The general share dependency is already patched. Agree supported size/time limits through concrete compatibility evidence; do not treat MIME or reported file size as a resource bound.

### Explicitly Out of Scope

Restore conflict semantics, blanket dependency upgrades, or mandatory encryption.

<a id="rg-003"></a>

## RG-003 — Photo download cancellation and resource bounds

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** performance, security  
**Constituent Findings:** 2 source records (S2: 2)  
**Disposition:** OPEN

### Problem

Early rejection reports failure while the native response continues pumping and buffering.

### Shared Root Cause / Remediation Affinity

DUPLICATE reports identify the same unowned response body; performance adds cache-preparation failure and navigation-away coverage.

### Constituent Findings

- [security/AUD-SEC-004](../security/DOMAIN-AUDIT.md#aud-sec-004--rejected-photo-responses-continue-native-buffering) — Rejected photo responses continue native buffering (S2, C3, OPEN).
- [performance/AUD-PERF-003](../performance/DOMAIN-AUDIT.md#aud-perf-003--rejected-photo-responses-continue-consuming-transfer-resources) — Rejected photo responses continue consuming transfer resources (S2, C2, OPEN).

### Desired Outcome

Every terminal acquisition path stops its transport and releases resources within the supported limits.

### Constraints / Invariants

Keep HTTPS/final-URL/raster policy, the existing byte cap, and locally rendered photos.

### Dependencies

- RG-003 **RELATED** RG-004: Shared resource-boundary pattern, independent Expo fetch and Custom native implementations.

### Verification Expectations

Observe cancellation after non-2xx, bad MIME/final URL, cache-preparation failure and navigation away; test accepted and over-cap streams on Android.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

SEC reports C3 for source omission; PERF reports C2 for native consequences. Preserve both assessments; no memory or battery magnitude is measured.

### Explicitly Out of Scope

Relaxing destination controls, increasing limits without justification, or redesigning photo storage.

<a id="rg-004"></a>

## RG-004 — Custom AI native response ownership

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** security  
**Constituent Findings:** 1 source record (S2: 1)  
**Disposition:** OPEN

### Problem

Native cancellation ownership ends at headers, before unbounded body buffering and possible read failure.

### Shared Root Cause / Remediation Affinity

One native request lifecycle must cover headers, body, cancellation and bridge settlement.

### Constituent Findings

- [security/AUD-SEC-005](../security/DOMAIN-AUDIT.md#aud-sec-005--custom-ai-body-consumption-loses-cancellation-and-has-no-size-bound) — Custom AI body consumption loses cancellation and has no size bound (S2, C3, OPEN).

### Desired Outcome

Bounded bodies, effective post-header cancellation, exactly-once sanitized settlement and cleanup.

### Constraints / Invariants

Keep public HTTPS, approved address/DNS checks, no redirects/proxies, explicit invocation and endpoint-bound credentials.

### Dependencies

- RG-003 **RELATED** RG-004: Shared resource-boundary pattern, independent Expo fetch and Custom native implementations.

### Verification Expectations

Exercise real native transport with delayed headers/body, cancel after headers, oversized success/error bodies and truncation; assert no stranded promise or tombstone.

Required source verification dimensions: DEVICE, STATIC.

### Planning Notes

JavaScript timeout and stale-result suppression are useful but cannot prove native cancellation.

### Explicitly Out of Scope

LAN support, weaker security controls or changes to allowed prompt content.

<a id="rg-005"></a>

## RG-005 — Legacy credential binding across restore investigation

**Highest Severity:** S1 — Major  
**Scope:** Multi-area  
**Domains:** security  
**Constituent Findings:** 1 source record (S1: 1)  
**Disposition:** INVESTIGATE

### Problem

A dormant legacy Custom key may bind to restored endpoint metadata rather than its original recipient.

### Shared Root Cause / Remediation Affinity

INVESTIGATE only: the supported upgrade/restore/readiness sequence has not been reproduced end to end.

### Constituent Findings

- [security/AUD-SEC-006](../security/DOMAIN-AUDIT.md#aud-sec-006--legacy-custom-key-may-bind-to-a-restored-replacement-endpoint) — Legacy Custom key may bind to a restored replacement endpoint (S1, C2, INVESTIGATE).

### Desired Outcome

Establish reachability; if confirmed, preserve recipient provenance or obtain a concrete owner decision on reconfiguration.

### Constraints / Invariants

Secrets stay outside SQLite, backups and logs; ordinary bound keys must continue failing closed on endpoint mismatch.

### Dependencies

- RG-005 **RELATED** RG-006: Both preserve credential recipient identity; upgrade/restore hypothesis differs from confirmed accordion draft leakage.
- RG-005 **RELATED** RG-009: Portable AI metadata crosses restore; credential binding remains a separate nonportable boundary.

### Verification Expectations

Seed synthetic legacy and versioned keys, run migration, both restore modes and generation with recording transport; never send real credentials.

Required source verification dimensions: RUNTIME, STATIC.

### Planning Notes

This is distinct from provider-card draft leakage. Credential compatibility/security policy requires owner review after evidence is concrete.

### Explicitly Out of Scope

Assuming actual theft occurred or silently deleting all stored credentials.

<a id="rg-006"></a>

## RG-006 — Provider-scoped credential drafts

**Highest Severity:** S1 — Major  
**Scope:** Multi-area  
**Domains:** react-native  
**Constituent Findings:** 1 source record (S1: 1)  
**Disposition:** OPEN

### Problem

One masked UI draft can be saved under a different provider and later sent there.

### Shared Root Cause / Remediation Affinity

The connection accordion owns the draft identity and asynchronous save destination.

### Constituent Findings

- [react-native/AUD-RN-003](../react-native/DOMAIN-AUDIT.md#aud-rn-003--unsaved-provider-credentials-cross-connection-cards) — Unsaved provider credentials cross connection cards (S1, C3, OPEN).

### Desired Outcome

Switching cards or saving asynchronously never transfers a credential draft between providers.

### Constraints / Invariants

Preserve separate SecureStore namespaces, existing saved keys and explicit provider invocation.

### Dependencies

- RG-005 **RELATED** RG-006: Both preserve credential recipient identity; upgrade/restore hypothesis differs from confirmed accordion draft leakage.

### Verification Expectations

Use distinct synthetic keys; switch before save and while saving. Assert storage and transport recipients remain correct.

Required source verification dimensions: RUNTIME, STATIC.

### Planning Notes

Storage isolation is already present; this defect originates before storage. No live provider request is needed.

### Explicitly Out of Scope

Legacy restore binding, provider activation redesign or credential-format guessing.

<a id="rg-007"></a>

## RG-007 — Imported-note consent provenance

**Highest Severity:** S1 — Major  
**Scope:** Multi-area  
**Domains:** data-privacy  
**Constituent Findings:** 1 source record (S1: 1)  
**Disposition:** OPEN

### Problem

General Memory defaults can mark imported notes AI-allowed contrary to ADR-091.

### Shared Root Cause / Remediation Affinity

Imported creation paths share the default resolver but have a narrower consent contract.

### Constituent Findings

- [data-privacy/AUD-DPI-005](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-005--imported-notes-inherit-ai-permission-contrary-to-their-mandatory-off-default) — Imported notes inherit AI permission contrary to their mandatory off default (S1, C3, OPEN).

### Desired Outcome

Single, bulk and consolidated imported notes begin AI-off and remain excluded until deliberately enabled.

### Constraints / Invariants

Preserve ordinary new-Memory defaults, later explicit opt-in and permission-filtered generation.

### Dependencies

- RG-007 **RELATED** RG-008: Stored consent provenance and truthful permission UI complement each other without replacing generation gates.
- RG-007 **RELATED** RG-012: Imported notes have both consent and workflow-retention obligations.

### Verification Expectations

Set general defaults ON, run each actual import path, inspect flags and projected context before/after opt-in.

Required source verification dimensions: RUNTIME, STATIC.

### Planning Notes

Existing enabled imported rows mix possible accidental defaults with deliberate opt-ins; any retrospective policy is an owner decision.

### Explicitly Out of Scope

Automatic permission resets, widened egress or removal of general defaults.

<a id="rg-008"></a>

## RG-008 — Current AI configuration and truthful permission presentation

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** architecture, react-native, ui-accessibility  
**Constituent Findings:** 4 source records (S2: 3, S3: 1)  
**Disposition:** OPEN

### Problem

Legacy enablement reads, filtered permission summaries and missing saved-model markers make current AI configuration misleading.

### Shared Root Cause / Remediation Affinity

Strong remediation affinity across modern AI settings and its live editor consumers; only A3/N5 are duplicates.

### Constituent Findings

- [architecture/AUD-ARCH-003](../architecture/DOMAIN-AUDIT.md#aud-arch-003--active-memory-editors-still-derive-ai-enablement-from-the-retired-provider-setting) — Active Memory editors still derive AI enablement from the retired provider setting (S2, C3, OPEN).
- [react-native/AUD-RN-005](../react-native/DOMAIN-AUDIT.md#aud-rn-005--memory-permission-controls-use-retired-ai-configuration-state) — Memory permission controls use retired AI configuration state (S2, C3, OPEN).
- [ui-accessibility/AUD-UIA-013](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-013--ai-permissions-summary-confuses-filtered-results-with-actual-access) — AI permissions summary confuses filtered results with actual access (S2, C3, OPEN).
- [ui-accessibility/AUD-UIA-020](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-020--model-picker-does-not-identify-the-saved-selection) — Model picker does not identify the saved selection (S3, C3, OPEN).

### Desired Outcome

Memory controls reflect the canonical master; access totals differ from filtered results; each lane shows its remembered model.

### Constraints / Invariants

Master enablement, active connection, readiness, per-item consent and remembered model are distinct. No UI repair may change permission as a side effect.

### Dependencies

- RG-007 **RELATED** RG-008: Stored consent provenance and truthful permission UI complement each other without replacing generation gates.

### Verification Expectations

Test all four Memory hosts with legacy/current setting combinations; mixed permission filters, unmatched search, failed loads; model save/reopen including manual IDs.

Required source verification dimensions: RUNTIME, STATIC.

### Planning Notes

Use current configuration contracts without removing compatibility fields or rewriting migrations.

### Explicitly Out of Scope

Imported-note default policy, credential migration or redesign of connection activation.

<a id="rg-009"></a>

## RG-009 — Restore reconciliation and committed graph integrity

**Highest Severity:** S1 — Major  
**Scope:** Cross-cutting  
**Domains:** data-privacy  
**Constituent Findings:** 3 source records (S1: 2, S2: 1)  
**Disposition:** OPEN

### Problem

Merge can omit required pairs or deletion evidence and apply stale winners over newer local commits.

### Shared Root Cause / Remediation Affinity

These distinct defects meet at reconciliation, transaction entry and the post-merge graph invariant.

### Constituent Findings

- [data-privacy/AUD-DPI-002](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-002--merge-omits-required-global-custom-field-pairs-and-creates-unrestorable-exports) — Merge omits required global custom-field pairs and creates unrestorable exports (S1, C3, OPEN).
- [data-privacy/AUD-DPI-003](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-003--restore-applies-stale-winners-over-newer-committed-local-writes) — Restore applies stale winners over newer committed local writes (S1, C3, OPEN).
- [data-privacy/AUD-DPI-006](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-006--tombstone-only-merge-discards-deletion-evidence) — Tombstone-only Merge discards deletion evidence (S2, C3, OPEN).

### Desired Outcome

Every successful Merge keeps complete global pairs, durable deletion evidence and authoritative newer local writes; its next export remains restorable.

### Constraints / Invariants

Keep stable pair UIDs, explicit NULL clears, indefinite typed tombstones, current conflict policy and non-reentrant transactions.

### Dependencies

- RG-002 **RELATED** RG-009: Untrusted acquisition precedes restore, but valid-input reconciliation defects reproduce independently.
- RG-005 **RELATED** RG-009: Portable AI metadata crosses restore; credential binding remains a separate nonportable boundary.
- RG-009 **RELATED** RG-010: Shared restore planning/staging/commit boundary; coordinate transaction and media ownership changes.

### Verification Expectations

Both directions of graph union; archived/quarantined populations; tombstone-only merges followed by older backups; real writes/deletes/settings interleaved with staging; export and restore the result.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

Existing incomplete databases may need forward repair. Consistency may use revalidation or equivalent ownership; no implementation is prescribed.

### Explicitly Out of Scope

Weakening completeness guards, adding cloud sync or editing shipped migrations.

<a id="rg-010"></a>

## RG-010 — Canonical photo ownership across restore, merge and deletion

**Highest Severity:** S1 — Major  
**Scope:** Cross-cutting  
**Domains:** data-privacy, reliability-testing  
**Constituent Findings:** 5 source records (S1: 3, S2: 2)  
**Disposition:** OPEN

### Problem

Photos can be omitted, overwritten, deleted while still owned, or retained after references disappear.

### Shared Root Cause / Remediation Affinity

Strong ownership affinity across SQL identities, ID-derived filenames and durable file work. Distinct mechanisms require distinct regression cases; this is not one duplicate defect.

### Constituent Findings

- [data-privacy/AUD-DPI-001](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-001--successful-restore-silently-loses-exported-custom-field-photos) — Successful restore silently loses exported custom-field photos (S1, C3, OPEN).
- [data-privacy/AUD-DPI-004](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-004--contact-merge-transfers-photo-references-without-safe-asset-ownership) — Contact merge transfers photo references without safe asset ownership (S1, C3, OPEN).
- [data-privacy/AUD-DPI-010](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-010--canonical-photos-survive-deletion-paths-that-omit-ownership-cleanup) — Canonical photos survive deletion paths that omit ownership cleanup (S2, C3, OPEN).
- [reliability-testing/AUD-REL-001](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-001--replace-all-photo-cleanup-deletes-newly-restored-canonical-files) — Replace-all photo cleanup deletes newly restored canonical files (S1, C3, OPEN).
- [reliability-testing/AUD-REL-003](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-003--restore-photo-recovery-can-overwrite-a-newer-successful-avatar-edit) — Restore-photo recovery can overwrite a newer successful avatar edit (S2, C3, OPEN).

### Desired Outcome

Actual exported photos restore; merge retains sole/selected photos safely under ID reuse; cleanup deletes only unowned files; old recovery cannot overwrite newer edits.

### Constraints / Invariants

Preserve UID portability, raw TEXT after type change, staged commit-before-finalization, journal recovery, reference safety, and accepted cancel-path tradeoffs.

### Dependencies

- RG-009 **RELATED** RG-010: Shared restore planning/staging/commit boundary; coordinate transaction and media ownership changes.
- RG-010 **RELATED** RG-011: Correct media recovery and truthful restore outcomes are independently actionable and jointly verified.
- RG-010 **RELATED** RG-013: Canonical masters and generated cache copies have different ownership and cleanup APIs.
- RG-016 **ENABLES** RG-010: Reliable launch recovery makes pending photo ownership verification repeatable; direct recovery tests remain possible first.

### Verification Expectations

Real exporter/parser/apply plus shared filesystem model; both restore modes, changed/reused IDs, sole-absorbed photos, duplicate delete intents, type-change/expiry/purge, cascades, failed finalize/delete then newer crop and restart. Inspect bytes and references.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

This bounded ownership group can later split across restore and ordinary media lifecycle. A filename-policy reversal needs owner approval. Do not fix by loop reordering alone.

### Explicitly Out of Scope

Derivative caches, forensic erasure, arbitrary filesystem sweeps or loss of raw custom values.

<a id="rg-011"></a>

## RG-011 — Restore publication and partial-success reporting

**Highest Severity:** S2 — Moderate  
**Scope:** Cross-cutting  
**Domains:** architecture, reliability-testing  
**Constituent Findings:** 2 source records (S2: 2)  
**Disposition:** OPEN

### Problem

Committed restore settings are absent from the live theme, and outstanding photo/schedule recovery disappears from the result UI.

### Shared Root Cause / Remediation Affinity

The application-level restore completion boundary owns committed-state publication and truthful outcome reporting.

### Constituent Findings

- [architecture/AUD-ARCH-005](../architecture/DOMAIN-AUDIT.md#aud-arch-005--restored-appearance-settings-never-publish-into-the-live-theme-store) — Restored appearance settings never publish into the live theme store (S2, C3, OPEN).
- [reliability-testing/AUD-REL-005](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-005--restore-completion-hides-outstanding-photo-and-schedule-recovery) — Restore completion hides outstanding photo and schedule recovery (S2, C3, OPEN).

### Desired Outcome

Live appearance matches committed settings; results distinguish successful SQL commit from remaining recovery work.

### Constraints / Invariants

Publish only committed/winning settings; retain navigation context, recovery evidence, and the parked theme-axis decision.

### Dependencies

- RG-010 **RELATED** RG-011: Correct media recovery and truthful restore outcomes are independently actionable and jointly verified.

### Verification Expectations

Restore differing themes without restart; failed/retained-settings cases must not publish incoming values. Inject nonzero photo/cleanup counts and schedule flags through the actual result adapter.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

A clear outcome can ship independently of media repair; it must not claim rollback or replay a committed restore.

### Explicitly Out of Scope

Auditing every cache, merging theme package/mode or redesigning backup policy.

<a id="rg-012"></a>

## RG-012 — Import workflow retention, purge and photo retry

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** data-privacy, reliability-testing  
**Constituent Findings:** 3 source records (S2: 3)  
**Disposition:** OPEN

### Problem

Completed imports retain sensitive source payloads after purge, while incomplete photo work can lose the source it still needs.

### Shared Root Cause / Remediation Affinity

Durable session liveness is the shared boundary: retention must distinguish genuinely unfinished work from deleted content.

### Constituent Findings

- [data-privacy/AUD-DPI-007](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-007--permanent-contact-purge-retains-sensitive-import-session-payloads) — Permanent contact purge retains sensitive import-session payloads (S2, C3, OPEN).
- [data-privacy/AUD-DPI-008](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-008--photo-only-import-failures-cannot-retry-and-lose-their-staged-input) — Photo-only import failures cannot retry and lose their staged input (S2, C3, OPEN).
- [reliability-testing/AUD-REL-004](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-004--imported-photo-failures-lose-their-retry-input-at-the-next-sweep) — Imported-photo failures lose their retry input at the next sweep (S2, C3, OPEN).

### Desired Outcome

Photo failure/interruption remains retryable without duplicate contacts; permanent purge retires that contact's workflow copies while preserving unrelated pending work.

### Constraints / Invariants

Keep per-contact commits, failure-isolated photos, explicit review/discard and narrowly justified deletion evidence.

### Dependencies

- RG-007 **RELATED** RG-012: Imported notes have both consent and workflow-retention obligations.
- RG-012 **RELATED** RG-043: Import/consolidation creates multi-source inputs; later explicit review selection is independently broken.
- RG-016 **ENABLES** RG-012: Failure-contained maintenance supports durable import retry/sweep verification; no forced implementation order.
- RG-035 **RELATED** RG-012: Import fatal-state feedback must distinguish completed contacts from unfinished photo work.

### Verification Expectations

Import note markers, complete/purge and inspect workflow tables; photo failure or process interruption after contact commit, restart/sweep/retry; linked, consolidated and merged origins.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

D8/T4 are duplicates; D7 is a separate privacy obligation whose cleanup must not undo the retry fix.

### Explicitly Out of Scope

Batch-wide atomic rollback or arbitrary blanket expiry of all sessions.

<a id="rg-013"></a>

## RG-013 — Generated photo derivative lifetime

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** data-privacy  
**Constituent Findings:** 1 source record (S2: 1)  
**Disposition:** OPEN

### Problem

ImageManipulator creates cache files even for widget base64 output; successful removal leaves those copies.

### Shared Root Cause / Remediation Affinity

One bounded derivative lifecycle spans photo encoding and widget thumbnail generation.

### Constituent Findings

- [data-privacy/AUD-DPI-011](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-011--generated-image-cache-copies-survive-successful-photo-removal) — Generated image-cache copies survive successful photo removal (S2, C3, OPEN).

### Desired Outcome

Temporary derivatives have explicit completion/failure/restart cleanup consistent with photo removal.

### Constraints / Invariants

Protect active operations, canonical masters and crash-recovery sidecars; logical cleanup is sufficient.

### Dependencies

- RG-001 **RELATED** RG-013: Both involve widget images; provider access and private ImageManipulator cache lifetime are separate copies and controls.
- RG-010 **RELATED** RG-013: Canonical masters and generated cache copies have different ownership and cleanup APIs.
- RG-013 **RELATED** RG-014: Unmanaged temporary-copy pattern; image processing and cross-app sharing need different safe lifetimes.

### Verification Expectations

Enumerate Android cache before/after crop/import/widget refresh/remove/purge, with failed copy/encoding and restart.

Required source verification dimensions: DEVICE, STATIC.

### Planning Notes

Packet evidence contradicts the photos system doc's no-extra-file claim; installed native behavior is the relevant mechanism. Documentation correction belongs with later remediation.

### Explicitly Out of Scope

Deleting user exports, filesystem forensic erasure or changing widget imagery.

<a id="rg-014"></a>

## RG-014 — Manual export staging lifetime

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** data-privacy  
**Constituent Findings:** 1 source record (S2: 1)  
**Disposition:** OPEN

### Problem

Readable internal export snapshots remain indefinitely after successful, failed or dismissed sharing.

### Shared Root Cause / Remediation Affinity

The share-file owner needs a bounded staging lifecycle separate from external backup retention.

### Constituent Findings

- [data-privacy/AUD-DPI-013](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-013--manual-export-leaves-unbounded-app-owned-snapshot-copies-in-cache) — Manual export leaves unbounded app-owned snapshot copies in cache (S2, C3, OPEN).

### Desired Outcome

App-owned staging retires after a safe sharing lifecycle, including failure and restart.

### Constraints / Invariants

Preserve user-selected external backups, optional encryption and receiving-app access while legitimately needed.

### Dependencies

- RG-002 **RELATED** RG-014: Incoming acquisition and outgoing share staging have distinct lifetime owners.
- RG-013 **RELATED** RG-014: Unmanaged temporary-copy pattern; image processing and cross-app sharing need different safe lifetimes.

### Verification Expectations

Inspect export cache for success, unavailable/failed/dismissed sharing and relaunch; verify encrypted and readable variants.

Required source verification dimensions: DEVICE, STATIC.

### Planning Notes

Safe sharing grace/lifetime needs platform validation; the audit does not invent a duration.

### Explicitly Out of Scope

Deleting external backups on contact purge or making encryption mandatory.

<a id="rg-015"></a>

## RG-015 — Notification scheduling, readback and deletion lifecycle

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** data-privacy, reliability-testing  
**Constituent Findings:** 3 source records (S2: 3)  
**Disposition:** OPEN

### Problem

Presented reminders survive purge, native DATE readback forces unnecessary rescheduling, and after-slot reconciliation violates weekly cadence.

### Shared Root Cause / Remediation Affinity

Strong native notification lifecycle affinity, with three distinct scheduling/presentation invariants.

### Constituent Findings

- [data-privacy/AUD-DPI-012](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-012--already-presented-notifications-survive-permanent-contact-purge) — Already-presented notifications survive permanent contact purge (S2, C3, OPEN).
- [reliability-testing/AUD-REL-010](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-010--notification-tests-model-the-wrong-android-date-trigger-readback) — Notification tests model the wrong Android DATE-trigger readback (S2, C3, OPEN).
- [reliability-testing/AUD-REL-011](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-011--after-slot-reconciliation-adds-a-next-day-reminder-to-the-weekly-cadence) — After-slot reconciliation adds a next-day reminder to the weekly cadence (S2, C3, OPEN).

### Desired Outcome

Unchanged alarms remain; next reminders stay on the approved weekly grid; purged contacts have neither future nor currently presented reminders.

### Constraints / Invariants

Keep stateless scheduling, date-specific birthdays, owned-ID isolation, private defaults and post-commit OS cleanup.

### Dependencies

- RG-015 **RELATED** RG-042: Same notification subsystem, separate scheduling/presentation and navigation responsibilities.
- RG-016 **ENABLES** RG-015: Prevents unrelated early hooks starving notification reconciliation; scheduler defects still require independent fixes.

### Verification Expectations

Use actual Android serialized trigger shape; reconcile twice; simulate fired morning alarm then afternoon launch; quiet-hours/birthday cases; deliver then purge via app icon and inspect shade/native list.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

The existing input-echoing mock must not define native truth. Schedule cancellation does not equal notification dismissal.

### Explicitly Out of Scope

Changing reminder frequency/privacy posture, last-notified persistence or deleting unrelated notifications.

<a id="rg-016"></a>

## RG-016 — Bootstrap and foreground maintenance failure boundaries

**Highest Severity:** S1 — Major  
**Scope:** Cross-cutting  
**Domains:** architecture, react-native, release-readiness, reliability-testing  
**Constituent Findings:** 4 source records (S1: 1, S2: 3)  
**Disposition:** OPEN

### Problem

Optional image cleanup can block all startup; an escaping sweep rejection can starve unrelated work and discard queued reruns.

### Shared Root Cause / Remediation Affinity

Distinct boot and foreground paths share recovery orchestration but need separate failure policies. A7/N11/T9 are duplicates; R1 is not.

### Constituent Findings

- [architecture/AUD-ARCH-007](../architecture/DOMAIN-AUDIT.md#aud-arch-007--launch-maintenance-relies-on-inconsistent-per-hook-failure-containment) — Launch maintenance relies on inconsistent per-hook failure containment (S2, C3, OPEN).
- [react-native/AUD-RN-011](../react-native/DOMAIN-AUDIT.md#aud-rn-011--an-early-sweep-rejection-skips-unrelated-lifecycle-work) — An early sweep rejection skips unrelated lifecycle work (S2, C3, OPEN).
- [reliability-testing/AUD-REL-009](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-009--one-launch-hook-rejection-skips-unrelated-recovery-and-maintenance) — One launch-hook rejection skips unrelated recovery and maintenance (S2, C3, OPEN).
- [release-readiness/AUD-REL-001](../release-readiness/DOMAIN-AUDIT.md#aud-rel-001--recoverable-background-cleanup-failure-blocks-application-startup) — Recoverable background cleanup failure blocks application startup (S1, C3, OPEN).

### Desired Outcome

Healthy relationship data stays accessible under recoverable image faults, and safe independent foreground responsibilities still run after a local failure.

### Constraints / Invariants

Keep migrations fail-closed, owned pending bytes, fallback, sequential prerequisites such as background reconciliation before backup, foreground-only work and coalescing.

### Dependencies

- RG-016 **ENABLES** RG-010: Reliable launch recovery makes pending photo ownership verification repeatable; direct recovery tests remain possible first.
- RG-016 **ENABLES** RG-012: Failure-contained maintenance supports durable import retry/sweep verification; no forced implementation order.
- RG-016 **ENABLES** RG-015: Prevents unrelated early hooks starving notification reconciliation; scheduler defects still require independent fixes.

### Verification Expectations

Cold-start orphan delete/copy/after-finalize failures; real first/middle sweep hook failures; queued return during failure; migration failures still block unsafe access.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

No blanket catch, unconditional continuation or parallelization. Establish which dependency failure must hold dependent backup work.

### Explicitly Out of Scope

Background schedulers, generic observability uploads or weaker restore integrity.

<a id="rg-017"></a>

## RG-017 — Consistent history semantics for contact edits

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** architecture  
**Constituent Findings:** 2 source records (S2: 2)  
**Disposition:** OPEN

### Problem

Rapid custom-value edits omit retained prior values; complete contact edits omit Bind/Unbind events.

### Shared Root Cause / Remediation Affinity

Different user-entry writers apply only part of established atomic domain semantics.

### Constituent Findings

- [architecture/AUD-ARCH-001](../architecture/DOMAIN-AUDIT.md#aud-arch-001--rapid-custom-field-edits-bypass-retained-value-history) — Rapid custom-field edits bypass retained-value history (S2, C3, OPEN).
- [architecture/AUD-ARCH-002](../architecture/DOMAIN-AUDIT.md#aud-arch-002--complete-contact-edits-bypass-bindunbind-event-recording) — Complete contact edits bypass Bind/Unbind event recording (S2, C3, OPEN).

### Desired Outcome

All equivalent user edits preserve retained values and exactly one lifecycle event when state changes.

### Constraints / Invariants

Raw TEXT, stable value identity, one outer transaction, unchanged-save no-op, import/seed/restore semantics and dormant cadence remain intact.

### Dependencies

- RG-017 **RELATED** RG-018: Both touch complete edit orchestration; atomic writer semantics and committed form baselines are distinct.

### Verification Expectations

Compare rapid/full edits for first/unchanged/changed/cleared values, retained/current-only fields and rollback; dedicated/full Bind/Unbind with event/state atomicity.

Required source verification dimensions: RUNTIME, STATIC.

### Planning Notes

Do not add events/history indiscriminately to every metadata primitive; the callers have distinct intents.

### Explicitly Out of Scope

Activating contact-scoped fields, inventing imported events or backfilling guessed historical events.

<a id="rg-018"></a>

## RG-018 — Committed contact-editor baselines and retry

**Highest Severity:** S1 — Major  
**Scope:** Multi-area  
**Domains:** reliability-testing  
**Constituent Findings:** 1 source record (S1: 1)  
**Disposition:** OPEN

### Problem

A save that commits yet stays on screen can replay synthetic additions and stale link diffs.

### Shared Root Cause / Remediation Affinity

The complete editor must track which collections committed before subsequent correction/retry.

### Constituent Findings

- [reliability-testing/AUD-REL-002](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-002--edit-contact-retries-replay-collections-that-already-committed) — Edit Contact retries replay collections that already committed (S1, C3, OPEN).

### Desired Outcome

Repeated saves after canonical method collisions or partial failure retain stable identities without duplicating knowledge or links.

### Constraints / Invariants

Preserve separate metadata/knowledge and link transactions, collision checks and the existing first-interaction clearing guard.

### Dependencies

- RG-017 **RELATED** RG-018: Both touch complete edit orchestration; atomic writer semantics and committed form baselines are distinct.
- RG-018 **RELATED** RG-019: Committed-write/failed-read retry pattern across different editor coordinators.

### Verification Expectations

Run the actual save coordinator twice with new knowledge/link additions/removals and duplicate methods; inject link failure and failed reseed; inspect row counts/UIDs.

Required source verification dimensions: RUNTIME, STATIC.

### Planning Notes

Read recovery failure must not restore permission to replay committed additions. This is not a reason to merge established transaction boundaries.

### Explicitly Out of Scope

Changing contact merge rules or broad editor redesign.

<a id="rg-019"></a>

## RG-019 — Group-event draft, override and post-commit recovery

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** reliability-testing  
**Constituent Findings:** 3 source records (S2: 3)  
**Disposition:** OPEN

### Problem

Already-overridden values fail to save, participant refresh discards parent drafts, and failed readback retries an already-committed addition.

### Shared Root Cause / Remediation Affinity

These separate defects share group edit/participant orchestration and its parent-versus-child ownership boundary.

### Constituent Findings

- [reliability-testing/AUD-REL-006](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-006--editing-an-existing-participant-override-silently-drops-the-new-value) — Editing an existing participant override silently drops the new value (S2, C3, OPEN).
- [reliability-testing/AUD-REL-007](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-007--participant-actions-erase-unsaved-group-event-drafts) — Participant actions erase unsaved group-event drafts (S2, C3, OPEN).
- [reliability-testing/AUD-REL-008](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-008--participant-add-refresh-failures-cause-retries-of-an-already-committed-write) — Participant-add refresh failures cause retries of an already committed write (S2, C3, OPEN).

### Desired Outcome

Persist explicit value edits, preserve unsaved parent fields during participant work, and recover readback without repeating committed insertions.

### Constraints / Invariants

Keep atomic membership validation, duplicate-participant guard, child Allow-AI and explicit follow/override identity.

### Dependencies

- RG-018 **RELATED** RG-019: Committed-write/failed-read retry pattern across different editor coordinators.
- RG-035 **RELATED** RG-019: Read-error presentation must not replay an already committed participant write; picker read fallback remains held.

### Verification Expectations

Both participant editors: false-to-false edits including null/equal-parent values; parent draft plus add/remove/edit; committed add then failed reload and retry.

Required source verification dimensions: RUNTIME, STATIC.

### Planning Notes

A reload that reseeds every field is not safe draft preservation. Test actual coordinator sequences rather than source-string presence.

### Explicitly Out of Scope

Weakening DAO validation, implicit edit scope or combining parent/child consent.

<a id="rg-020"></a>

## RG-020 — Dashboard panel settlement and accessible traversal

**Highest Severity:** S1 — Major  
**Scope:** Multi-area  
**Domains:** react-native, ui-accessibility  
**Constituent Findings:** 2 source records (S1: 1, S2: 1)  
**Disposition:** INVESTIGATE + OPEN

### Problem

Panel dismissal drops its callback before restoring Home interactivity; ordinary container grouping may separately impair TalkBack traversal.

### Shared Root Cause / Remediation Affinity

Both concern panel/background semantic ownership, but U22 remains INVESTIGATE until native traversal is observed.

### Constituent Findings

- [react-native/AUD-RN-001](../react-native/DOMAIN-AUDIT.md#aud-rn-001--dashboard-panel-dismissal-leaves-underlying-content-inert) — Dashboard panel dismissal leaves underlying content inert (S1, C3, OPEN).
- [ui-accessibility/AUD-UIA-022](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-022--contacts-groups-whole-interactive-regions-as-accessible-elements) — Contacts groups whole interactive regions as accessible elements (S2, C2, INVESTIGATE).

### Desired Outcome

Every dismissal restores touch/accessibility; normal controls remain individually traversable with correct panel isolation.

### Constraints / Invariants

Preserve in-tree floating panels, transient-first Back and no-hide-descendants while open.

### Dependencies

- RG-020 **RELATED** RG-022: Same Home owner, but panel settlement and async reload authority are independent.
- RG-020 **RELATED** RG-031: Contacts traversal and row-level accessible context need joint TalkBack checks.
- RG-039 **RELATED** RG-020: Native accessibility investigation of shell transients; outcomes are not assumed from opacity/group props.

### Verification Expectations

All panel dismiss paths and tab returns; inspect native nodes and traverse header, search, list/grid and panel-return focus.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

N1 is confirmed independently of U22. Do not require the uncertain grouping issue to be confirmed before selecting the dismissal fix.

### Explicitly Out of Scope

Replacing panels with native modals or removing background isolation.

<a id="rg-021"></a>

## RG-021 — Semantic tab roots and shared Profile destinations

**Highest Severity:** S1 — Major  
**Scope:** Cross-cutting  
**Domains:** architecture, react-native  
**Constituent Findings:** 3 source records (S1: 1, S2: 1, S3: 1)  
**Disposition:** OPEN

### Problem

First nested entry can omit a tab root; Settings exposes unregistered Profile children; named History actions route into knowledge.

### Shared Root Cause / Remediation Affinity

Strong navigation-contract affinity across lazy initialization, host registration and destination identity, without assuming one root cause.

### Constituent Findings

- [react-native/AUD-RN-002](../react-native/DOMAIN-AUDIT.md#aud-rn-002--first-nested-workflow-entry-can-omit-a-tabs-semantic-root) — First nested workflow entry can omit a tab's semantic root (S1, C3, OPEN).
- [react-native/AUD-RN-004](../react-native/DOMAIN-AUDIT.md#aud-rn-004--settings-hosted-profile-omits-reachable-child-routes-and-context) — Settings-hosted Profile omits reachable child routes and context (S2, C3, OPEN).
- [architecture/AUD-ARCH-008](../architecture/DOMAIN-AUDIT.md#aud-arch-008--profile-interaction-history-actions-still-route-to-contact-knowledge) — Profile interaction-history actions still route to contact knowledge (S3, C3, OPEN).

### Desired Outcome

All supported entries preserve semantic roots and Back/reselect behavior; shared actions resolve in every host; History actions reveal interaction history.

### Constraints / Invariants

Preserve independent five-tab histories, initial Digest, deliberate external resets, archived-message restrictions and Profile origin.

### Dependencies

- RG-021 **RELATED** RG-042: Navigation topology and ingress chronology interact in tests without sharing an implementation prerequisite.

### Verification Expectations

Fresh and already-mounted FAB flows, cold text/backup share, AI repair navigation, all five Profile hosts, Recently Deleted, FAB preselection and both History actions.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

Actual runtime registrations/state matter more than compatibility types. Do not fix host parity by enabling prohibited archived messaging.

### Explicitly Out of Scope

Broad stack resets, new top-level tabs, repurposing knowledge or reintroducing the retired timeline.

<a id="rg-022"></a>

## RG-022 — Dashboard refresh scheduling and latest-result ownership

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** performance, react-native  
**Constituent Findings:** 2 source records (S2: 2)  
**Disposition:** OPEN

### Problem

Refresh sources duplicate/background work and lack a common freshness authority for publication.

### Shared Root Cause / Remediation Affinity

SHARED_ROOT_CAUSE at the multi-owner reload boundary: scheduling and publication need coordinated ownership but separate acceptance checks.

### Constituent Findings

- [performance/AUD-PERF-002](../performance/DOMAIN-AUDIT.md#aud-perf-002--dashboard-schedules-redundant-and-background-refresh-bundles) — Dashboard schedules redundant and background refresh bundles (S2, C3, OPEN).
- [react-native/AUD-RN-010](../react-native/DOMAIN-AUDIT.md#aud-rn-010--dashboard-refresh-owners-can-publish-obsolete-query-results) — Dashboard refresh owners can publish obsolete query results (S2, C2, OPEN).

### Desired Outcome

One relevant refresh per event, no animation-only/background-entry reads, and no old query overwriting newer rows/counts/errors.

### Constraints / Invariants

Keep local reads, headless-write freshness, pull/query refresh, selection fences and shell subscribers.

### Dependencies

- RG-020 **RELATED** RG-022: Same Home owner, but panel settlement and async reload authority are independent.

### Verification Expectations

Count reads for bulk/Undo/resume/animation changes; defer A, change query and complete B, then resolve/reject A. Include search/view changes and unmount.

Required source verification dimensions: RUNTIME, STATIC.

### Planning Notes

N10 remains C2 on timing; coalescing alone does not prove latest-result correctness, and suppressing stale publication alone does not prevent wasted work.

### Explicitly Out of Scope

New caches, SQLite observers or dropping required refresh events.

<a id="rg-023"></a>

## RG-023 — Assist post-commit publication

**Highest Severity:** S2 — Moderate  
**Scope:** Cross-cutting  
**Domains:** architecture, react-native  
**Constituent Findings:** 2 source records (S2: 2)  
**Disposition:** OPEN

### Problem

Compose omits queue/widget refresh; banner/sheet omit foreground invalidation after a committed assist.

### Shared Root Cause / Remediation Affinity

SHARED_ROOT_CAUSE: entry-specific confirmation orchestration implements inconsistent portions of one publication contract.

### Constituent Findings

- [architecture/AUD-ARCH-006](../architecture/DOMAIN-AUDIT.md#aud-arch-006--compose-assist-confirmation-omits-shared-queuewidget-publication) — Compose assist confirmation omits shared queue/widget publication (S2, C3, OPEN).
- [react-native/AUD-RN-007](../react-native/DOMAIN-AUDIT.md#aud-rn-007--assist-confirmations-do-not-invalidate-the-foreground-view) — Assist confirmations do not invalidate the foreground view (S2, C3, OPEN).

### Desired Outcome

All confirmation entries publish the committed interaction to queue, widget and relevant foreground consumers.

### Constraints / Invariants

Keep sole recency writer, idempotent pending-state recheck, handoff-time timestamp, Not yet semantics and no replay after publication failure.

### Dependencies

- RG-023 **ENABLES** RG-024: Complete producer publication supports Profile consumer integration tests; consumer work can use existing Quick Log first.
- RG-023 **ENABLES** RG-026: Complete producer publication supports Digest assist refresh; existing Quick Log already supplies a signal.

### Verification Expectations

Preload eligible assists and confirm from all three entries over Home/Orrery/Profile; assert exactly one interaction and queue/widget/view convergence; inject publication failure.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

RN-013 remains recorded deferred work, not silently included. Consumer-side History/Digest fixes are separately necessary for those surfaces.

### Explicitly Out of Scope

Changing attestation to delivery detection, future-date guard removal or automatically reopening deferred error handling.

<a id="rg-024"></a>

## RG-024 — Profile history, metrics and calendar coherence

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** architecture, react-native  
**Constituent Findings:** 3 source records (S2: 3)  
**Disposition:** OPEN

### Problem

History and parent metrics refresh independently; retained History also freezes the definition of today.

### Shared Root Cause / Remediation Affinity

Profile's independent data/date owners need coherent visible state; A4 is the deletion subset of duplicate N8.

### Constituent Findings

- [architecture/AUD-ARCH-004](../architecture/DOMAIN-AUDIT.md#aud-arch-004--inline-history-deletion-refreshes-only-one-of-two-profile-projections) — Inline history deletion refreshes only one of two Profile projections (S2, C3, OPEN).
- [react-native/AUD-RN-008](../react-native/DOMAIN-AUDIT.md#aud-rn-008--profile-history-and-relationship-metrics-refresh-independently) — Profile History and relationship metrics refresh independently (S2, C3, OPEN).
- [react-native/AUD-RN-009](../react-native/DOMAIN-AUDIT.md#aud-rn-009--historys-current-date-is-frozen-for-the-component-lifetime) — History's current date is frozen for the component lifetime (S2, C3, OPEN).

### Desired Outcome

Quick Log/deletion updates history and metrics together; current-day windows advance on relevant lifecycle events while selected historical browsing persists.

### Constraints / Invariants

Preserve canonical recency, intentional renderer seam, local-date formatting and ephemeral selection.

### Dependencies

- RG-023 **ENABLES** RG-024: Complete producer publication supports Profile consumer integration tests; consumer work can use existing Quick Log first.
- RG-024 **RELATED** RG-025: Same Profile host, separate snapshot/calendar and retry-state defects.

### Verification Expectations

Mounted Quick Log/delete with known counts; collapsed/reopened History; overnight/month/year resume and tab return; verify counts, heatmap, Intensity, Last Interaction and logging prefill.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

No evidence requires storing derived scores or changing SQLite. Date freshness is a distinct obligation from interaction invalidation.

### Explicitly Out of Scope

New persistence, UTC date slicing or resetting all historical selections.

<a id="rg-025"></a>

## RG-025 — Profile relationship selector retry settlement

**Highest Severity:** S3 — Minor  
**Scope:** Local  
**Domains:** architecture  
**Constituent Findings:** 1 source record (S3: 1)  
**Disposition:** OPEN

### Problem

A successful Retry leaves both selectors pending and unusable on reopening.

### Shared Root Cause / Remediation Affinity

One duplicated submit/retry state machine fails to settle its owned operation.

### Constituent Findings

- [architecture/AUD-ARCH-009](../architecture/DOMAIN-AUDIT.md#aud-arch-009--selector-retry-duplicates-submission-but-omits-successful-settlement) — Selector Retry duplicates submission but omits successful settlement (S3, C3, OPEN).

### Desired Outcome

Frequency and snooze recover from failure and remain usable after success and reopening.

### Constraints / Invariants

Keep pending double-submit protection and legitimate repeated Snooze events.

### Dependencies

- RG-024 **RELATED** RG-025: Same Profile host, separate snapshot/calendar and retry-state defects.

### Verification Expectations

Mounted failure → successful retry → reopen for each selector; choices, Close and Back must work; repeated retry failure stays recoverable.

Required source verification dimensions: RUNTIME, STATIC.

### Planning Notes

Do not generalize this local fix into a Profile rewrite.

### Explicitly Out of Scope

Changing snooze semantics or suppressing legitimate repeated actions.

<a id="rg-026"></a>

## RG-026 — Live Digest and truthful day-detail results

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** react-native, reliability-testing  
**Constituent Findings:** 3 source records (S2: 3)  
**Disposition:** OPEN

### Problem

Digest misses in-place writes/resume; day details present pending or failed reads as no activity.

### Shared Root Cause / Remediation Affinity

Shared Digest read owners need both valid triggers and explicit outcomes; N6/T13 are duplicates, T14 is independent.

### Constituent Findings

- [react-native/AUD-RN-006](../react-native/DOMAIN-AUDIT.md#aud-rn-006--digest-misses-same-route-writes-and-foreground-refresh) — Digest misses same-route writes and foreground refresh (S2, C3, OPEN).
- [reliability-testing/AUD-REL-013](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-013--digest-ignores-successful-quick-log-and-undo-while-it-remains-focused) — Digest ignores successful Quick Log and Undo while it remains focused (S2, C3, OPEN).
- [reliability-testing/AUD-REL-014](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-014--digest-day-detail-read-failures-are-presented-as-no-activity) — Digest day-detail read failures are presented as “No activity” (S2, C3, OPEN).

### Desired Outcome

Suggestions, week counts and day details reflect committed state and current local day; errors never masquerade as empty history.

### Constraints / Invariants

Keep live derived local reads, no persisted Digest cache, selected period intent and stale-result guards.

### Dependencies

- RG-023 **ENABLES** RG-026: Complete producer publication supports Digest assist refresh; existing Quick Log already supplies a signal.
- RG-026 **RELATED** RG-028: Digest correctness and bounded query cost share readers but are independently testable.
- RG-026 **RELATED** RG-033: Digest heatmap visibility and data freshness require different checks.

### Verification Expectations

Quick Log/Undo without blur; overnight resume; delayed/rejected selected-day queries; switch dates while pending and recover.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

Existing hook-mocked tests cannot prove mounted lifecycle. WR-01 is known but not explicitly accepted/deferred.

### Explicitly Out of Scope

Changing outreach scoring, persistent snapshots or tab reset on resume.

<a id="rg-027"></a>

## RG-027 — Orrery settled resource retirement

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** performance  
**Constituent Findings:** 1 source record (S2: 1)  
**Disposition:** OPEN

### Problem

Completed transitions retain invisible geometry; same-System updates retain old React/image scene resources.

### Shared Root Cause / Remediation Affinity

UI-thread choreography and React resources share a settled-scene ownership invariant.

### Constituent Findings

- [performance/AUD-PERF-001](../performance/DOMAIN-AUDIT.md#aud-perf-001--orrery-retains-obsolete-geometry-and-scene-resources-after-settlement) — Orrery retains obsolete geometry and scene resources after settlement (S2, C3, OPEN).

### Desired Outcome

After every settled publication, retained bodies/resources correspond to the current scene rather than prior membership.

### Constraints / Invariants

Preserve interruption continuity, keyed media, hit authority, coherent snapshots, reduced motion and focus/background pausing.

### Dependencies

No established cross-group dependency.

### Verification Expectations

Assert cardinality after complete/interrupted switches, same-System removals and reduced-motion completion; inspect old-scene references. Measure native consequences on a physical phone.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

Packet reproduction proves excess work, not frame rate or battery loss. Keep accepted Phase 40 profiling distinctions.

### Explicitly Out of Scope

General high-count rewrite, truncated history or per-frame React state.

<a id="rg-028"></a>

## RG-028 — Bounded-period Your Week query access

**Highest Severity:** S3 — Minor  
**Scope:** Multi-area  
**Domains:** performance  
**Constituent Findings:** 1 source record (S3: 1)  
**Disposition:** OPEN

### Problem

Weekly/day reads scan lifetime history even when the requested period is empty.

### Shared Root Cause / Remediation Affinity

One reader family lacks an access path matching its bounded calendar queries.

### Constituent Findings

- [performance/AUD-PERF-004](../performance/DOMAIN-AUDIT.md#aud-perf-004--your-week-scans-lifetime-history-for-bounded-period-reads) — Your Week scans lifetime history for bounded period reads (S3, C3, OPEN).

### Desired Outcome

Exclude unrelated history while preserving canonical results.

### Constraints / Invariants

Keep group deduplication, archived-participant semantics, local date boundaries and no persisted Digest cache.

### Dependencies

- RG-026 **RELATED** RG-028: Digest correctness and bounded query cost share readers but are independently testable.

### Verification Expectations

Real migrated-schema query plans and fixed-result growing-history fixtures; boundary/correctness tests and physical-device measurements before latency claims.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

Any index/schema change must be a new forward-only migration. Node timings are diagnostic, not Android benchmarks.

### Explicitly Out of Scope

Weakening security parameters, truncating retained history or changing gravity inputs.

<a id="rg-029"></a>

## RG-029 — Theme contrast proof and semantic action foregrounds

**Highest Severity:** S2 — Moderate  
**Scope:** Cross-cutting  
**Domains:** ui-accessibility  
**Constituent Findings:** 2 source records (S2: 2)  
**Disposition:** OPEN

### Problem

The asset proof checks the wrong luminance extreme for dark text; backup actions choose a failing foreground token.

### Shared Root Cause / Remediation Affinity

One contrast acceptance boundary joins actual compositing and semantic foreground selection, with independent defects.

### Constituent Findings

- [ui-accessibility/AUD-UIA-001](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-001--standard-light-background-contrast-proof-uses-the-wrong-extremum) — Standard Light background contrast proof uses the wrong extremum (S2, C3, OPEN).
- [ui-accessibility/AUD-UIA-002](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-002--backuprestore-primary-labels-use-a-failing-foreground) — Backup/restore primary labels use a failing foreground (S2, C3, OPEN).

### Desired Outcome

Functional content meets the approved contrast contract under real compositions; primary/destructive actions use correct role foregrounds.

### Constraints / Invariants

Preserve visible artwork, ADR-115 glass, protected hues/accepted exceptions and active theme/accent resolution.

### Dependencies

- RG-029 **RELATED** RG-030: Shared UI contracts; contrast and names/targets/native colors are separate acceptance dimensions.
- RG-029 **RELATED** RG-036: Backup action and passphrase presentation can share visual verification without changing encryption.

### Verification Expectations

Evaluate relevant extrema and actual composition across palettes/assets/accents, then render actual glyph positions; separately verify backup primary/destructive labels.

Required source verification dimensions: DEVICE, MANUAL-VISUAL, STATIC.

### Planning Notes

U1 establishes failing available composites, not an observed unreadable screenshot. Taste/security decisions cannot be silently replaced by an opaque wash.

### Explicitly Out of Scope

Retuning protected hues or reversing authorized translucency.

<a id="rg-030"></a>

## RG-030 — Accessible and themed editor controls

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** ui-accessibility  
**Constituent Findings:** 4 source records (S2: 3, S3: 1)  
**Disposition:** OPEN

### Problem

Native switches bypass theme/names; selectors omit values/selection; independent actions undershoot the shared target floor.

### Shared Root Cause / Remediation Affinity

Strong shared-control adoption affinity across repeated switch, selector and action contracts; no single root cause is asserted.

### Constituent Findings

- [ui-accessibility/AUD-UIA-003](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-003--enrichmentlayout-switches-bypass-active-theme-colors) — Enrichment/layout switches bypass active theme colors (S3, C3, OPEN).
- [ui-accessibility/AUD-UIA-004](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-004--memory-switches-have-no-accessible-names) — Memory switches have no accessible names (S2, C3, OPEN).
- [ui-accessibility/AUD-UIA-005](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-005--custom-selectors-omit-current-values-and-selected-option-semantics) — Custom selectors omit current values and selected-option semantics (S2, C3, OPEN).
- [ui-accessibility/AUD-UIA-006](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-006--independent-actions-fall-below-the-shared-touch-target-floor) — Independent actions fall below the shared touch-target floor (S2, C3, OPEN).

### Desired Outcome

Equivalent controls expose names, current values, selected state, theme colors and usable targets.

### Constraints / Invariants

Preserve consent and data semantics, out-of-list values, allowed legacy style exceptions and compact visual intent.

### Dependencies

- RG-029 **RELATED** RG-030: Shared UI contracts; contrast and names/targets/native colors are separate acceptance dimensions.
- RG-030 **RELATED** RG-034: Shared buttons and large text; expanding targets must preserve confirmation reachability.

### Verification Expectations

TalkBack and native bounds across affected hosts, palettes and enlarged text; non-color selection; ensure expanded hit areas do not overlap.

Required source verification dimensions: DEVICE, STATIC.

### Planning Notes

Includes Memory/Fuel kind pickers, date controls, AI text actions and duration chips. Existing stronger primitives are reference behavior.

### Explicitly Out of Scope

Blanket legacy component migration or the accepted dense Year-cell limitation.

<a id="rg-031"></a>

## RG-031 — Contact and review row identity, typography and accessible context

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** ui-accessibility  
**Constituent Findings:** 4 source records (S2: 3, S3: 1)  
**Disposition:** OPEN

### Problem

Rows omit visible search/decision context from accessible names; reconciliation substitutes IDs for people; list/grid miss registered fonts.

### Shared Root Cause / Remediation Affinity

Bounded remediation affinity in contact/review renderers and their projection inputs, not a claim all issues share a root cause.

### Constituent Findings

- [ui-accessibility/AUD-UIA-007](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-007--contact-row-accessible-summaries-omit-search-context) — Contact row accessible summaries omit search context (S2, C3, OPEN).
- [ui-accessibility/AUD-UIA-008](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-008--review-cards-omit-selection-and-decision-evidence-from-their-accessible-representation) — Review cards omit selection and decision evidence from their accessible representation (S2, C2, OPEN).
- [ui-accessibility/AUD-UIA-015](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-015--contact-renderers-bypass-registered-font-family-mapping) — Contact renderers bypass registered font-family mapping (S3, C3, OPEN).
- [ui-accessibility/AUD-UIA-019](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-019--reconciliation-cards-substitute-database-ids-for-contact-identity) — Reconciliation cards substitute database IDs for contact identity (S2, C3, OPEN).

### Desired Outcome

Visible and accessible rows identify the real person and relevant displayed context/selection; semantic typography resolves registered fonts.

### Constraints / Invariants

Keep stable internal IDs, advisory matching confidence, explicit review, genuine photo fallbacks and intentional Grid/List content differences.

### Dependencies

- RG-020 **RELATED** RG-031: Contacts traversal and row-level accessible context need joint TalkBack checks.
- RG-031 **RELATED** RG-043: Recognizable review context and faithful chosen-value transport are both needed for trustworthy reconciliation.

### Verification Expectations

Named/photo/missing-photo review cases; TalkBack search matches, recommendations, selected state and failures; native font comparison.

Required source verification dimensions: DEVICE, MANUAL-VISUAL, RUNTIME, STATIC.

### Planning Notes

U8 remains C2 for exact native traversal. Fixing visible identity alone does not resolve accessible selection or font mapping.

### Explicitly Out of Scope

Matching-policy changes, raw database IDs as user identity or blanket typography redesign.

<a id="rg-032"></a>

## RG-032 — Native widget action accessibility

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** ui-accessibility  
**Constituent Findings:** 1 source record (S2: 1)  
**Disposition:** OPEN

### Problem

Bitmap text does not name the native widget click areas.

### Shared Root Cause / Remediation Affinity

The RemoteViews action-overlay boundary needs authored semantic names.

### Constituent Findings

- [ui-accessibility/AUD-UIA-009](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-009--widget-bitmap-actions-have-no-accessible-names) — Widget bitmap actions have no accessible names (S2, C3, OPEN).

### Desired Outcome

Each action identifies both its purpose and contact, including empty/configuration states.

### Constraints / Invariants

Keep authorized headless dark palette, bitmap architecture, short visible labels and action semantics.

### Dependencies

- RG-001 **RELATED** RG-032: Same widget native artifact and launcher matrix; access authorization and accessible names are independent.

### Verification Expectations

Inspect actual RemoteViews nodes and use TalkBack to activate small/large/empty-layout actions.

Required source verification dimensions: DEVICE, STATIC.

### Planning Notes

Related to widget authorization only through shared native build/device verification; neither repair proves the other.

### Explicitly Out of Scope

Widget redesign or changed home-screen disclosure choices.

<a id="rg-033"></a>

## RG-033 — Heatmap and layout-preview width accounting

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** ui-accessibility  
**Constituent Findings:** 2 source records (S2: 1, S3: 1)  
**Disposition:** OPEN

### Problem

Heatmaps exceed narrow containers and the Profile preview adds gaps after consuming the full row width.

### Shared Root Cause / Remediation Affinity

Strong layout-verification affinity around measured available width and gap accounting; independent renderer fixes.

### Constituent Findings

- [ui-accessibility/AUD-UIA-010](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-010--fixed-heatmaps-exceed-available-narrow-screen-width) — Fixed heatmaps exceed available narrow-screen width (S2, C3, OPEN).
- [ui-accessibility/AUD-UIA-021](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-021--profile-layout-preview-uses-incompatible-gapcolumn-geometry) — Profile layout preview uses incompatible gap/column geometry (S3, C3, OPEN).

### Desired Outcome

All days remain reachable and preview row packing matches the actual Profile at supported sizes.

### Constraints / Invariants

Preserve no horizontal heatmap scrolling, retained compact/wide controls, saved choices and visual-only orphan stretching.

### Dependencies

- RG-026 **RELATED** RG-033: Digest heatmap visibility and data freshness require different checks.
- RG-033 **RELATED** RG-034: Common narrow-width/large-text test dimensions, not one shared root cause.

### Verification Expectations

Render 320/360/wider widths and large font/display settings; verify every day and compare compact/auto/wide preview to actual rows.

Required source verification dimensions: DEVICE, MANUAL-VISUAL, STATIC.

### Planning Notes

Source establishes impossible budgets, not the exact clipping outcome. Dense Year targets remain separately deferred.

### Explicitly Out of Scope

Changing saved layouts or removing layout controls.

<a id="rg-034"></a>

## RG-034 — Large-text confirmation reachability investigation

**Highest Severity:** S2 — Moderate  
**Scope:** Cross-cutting  
**Domains:** ui-accessibility  
**Constituent Findings:** 1 source record (S2: 1)  
**Disposition:** INVESTIGATE

### Problem

A fixed horizontal action row may put long destructive choices out of reach at large text/display sizes.

### Shared Root Cause / Remediation Affinity

INVESTIGATE: native rendered reachability has not been demonstrated.

### Constituent Findings

- [ui-accessibility/AUD-UIA-011](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-011--shared-confirmation-actions-need-large-text-reachability-verification) — Shared confirmation actions need large-text reachability verification (S2, C2, INVESTIGATE).

### Desired Outcome

Establish the supported failure case; if confirmed, both explicit choices remain readable and operable.

### Constraints / Invariants

Retain OS scaling and non-dismissable-by-Back/scrim destructive confirmations.

### Dependencies

- RG-030 **RELATED** RG-034: Shared buttons and large text; expanding targets must preserve confirmation reachability.
- RG-033 **RELATED** RG-034: Common narrow-width/large-text test dimensions, not one shared root cause.

### Verification Expectations

Maximum supported text/display settings, narrow viewport and long labels/body; operate both choices by touch and TalkBack.

Required source verification dimensions: DEVICE, MANUAL-VISUAL, STATIC.

### Planning Notes

Choose a concrete adaptive treatment only after observing the native behavior.

### Explicitly Out of Scope

Making destructive dialogs implicitly dismissable or choosing a visual redesign now.

<a id="rg-035"></a>

## RG-035 — Truthful asynchronous workflow presentation

**Highest Severity:** S2 — Moderate  
**Scope:** Cross-cutting  
**Domains:** ui-accessibility  
**Constituent Findings:** 1 source record (S2: 1)  
**Disposition:** OPEN

### Problem

Several read/import owners confuse pending, failed and empty states, producing misleading progress or configuration summaries.

### Shared Root Cause / Remediation Affinity

Bounded state-presentation remediation across the six named owners; common outcome semantics do not imply one shared implementation.

### Constituent Findings

- [ui-accessibility/AUD-UIA-012](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-012--loadingread-failures-are-presented-as-empty-failed-or-still-running-inconsistently) — Loading/read failures are presented as empty, failed, or still running inconsistently (S2, C3, OPEN).

### Desired Outcome

Import setup failure stops progress truthfully; reconciliation distinguishes pending/error; Memory, backup settings and duplicate review avoid false success/empty claims.

### Constraints / Invariants

Preserve durable progress and partial commits. ContactPicker read-error empty fallback is held for authority clarification, not automatically changed.

### Dependencies

- RG-035 **RELATED** RG-012: Import fatal-state feedback must distinguish completed contacts from unfinished photo work.
- RG-035 **RELATED** RG-019: Read-error presentation must not replay an already committed participant write; picker read fallback remains held.

### Verification Expectations

Delay/reject each cited read and import setup/finalization; verify retry does not replay committed work and unknown encryption settings never display a known Off state.

Required source verification dimensions: RUNTIME, STATIC.

### Planning Notes

Five uncontested screen branches remain OPEN. The ContactPicker subclaim conflicts with Phase 22 UI-SPEC/PLAN; newer multi-select write-failure feedback is a different requirement.

### Explicitly Out of Scope

Blindly rerunning imports or reversing the picker contract without owner adjudication.

<a id="rg-036"></a>

## RG-036 — Backup passphrase field identification

**Highest Severity:** S2 — Moderate  
**Scope:** Local  
**Domains:** ui-accessibility  
**Constituent Findings:** 1 source record (S2: 1)  
**Disposition:** OPEN

### Problem

Secure inputs have accessible names but no visible per-field identification.

### Shared Root Cause / Remediation Affinity

One backup encryption form contract distinguishes current/new/confirmation inputs.

### Constituent Findings

- [ui-accessibility/AUD-UIA-014](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-014--backup-encryption-fields-lack-visible-identification) — Backup encryption fields lack visible identification (S2, C3, OPEN).

### Desired Outcome

Field purpose stays clear before entry, after entry and on error.

### Constraints / Invariants

Keep secure entry, accessible names, encryption behavior and credential persistence policy.

### Dependencies

- RG-029 **RELATED** RG-036: Backup action and passphrase presentation can share visual verification without changing encryption.

### Verification Expectations

Setup/change-passphrase flows at ordinary/enlarged text; verify each field remains visibly distinguishable.

Required source verification dimensions: MANUAL-VISUAL, STATIC.

### Planning Notes

This is presentation only; no encryption or passphrase-lifetime change is indicated.

### Explicitly Out of Scope

Mandatory encryption, new persistence or security-policy changes.

<a id="rg-037"></a>

## RG-037 — Settings directory and child chrome consistency

**Highest Severity:** S3 — Minor  
**Scope:** Multi-area  
**Domains:** ui-accessibility  
**Constituent Findings:** 2 source records (S3: 2)  
**Disposition:** OPEN

### Problem

Child screens duplicate Back controls while root rows omit specified icons/navigation cues and subtitle semantics.

### Shared Root Cause / Remediation Affinity

Shared Settings navigation presentation has an established directory/chrome contract.

### Constituent Findings

- [ui-accessibility/AUD-UIA-016](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-016--settings-children-render-duplicate-back-controls) — Settings children render duplicate Back controls (S3, C3, OPEN).
- [ui-accessibility/AUD-UIA-017](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-017--settings-directory-omits-specified-iconsnavigation-affordances) — Settings directory omits specified icons/navigation affordances (S3, C3, OPEN).

### Desired Outcome

One canonical Back action per child; directory rows expose specified scanning and navigation context.

### Constraints / Invariants

Keep shell transient dismissal, current information architecture and distinction between navigation and widget utility action.

### Dependencies

No established cross-group dependency.

### Verification Expectations

Inspect visible/accessibility controls in root and children; Back with transient UI open; compare rows to the current dossier.

Required source verification dimensions: DEVICE, MANUAL-VISUAL, STATIC.

### Planning Notes

No new icon family or navigation redesign is required by the findings.

### Explicitly Out of Scope

Changing Settings scope or historical screens not yet using shared child chrome.

<a id="rg-038"></a>

## RG-038 — Shared explicit timestamp presentation

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** ui-accessibility  
**Constituent Findings:** 1 source record (S2: 1)  
**Disposition:** OPEN

### Problem

Equivalent event/history/form timestamps mix raw storage strings, seconds and ad-hoc 24-hour slices.

### Shared Root Cause / Remediation Affinity

One shared presentation contract has incomplete consumer adoption.

### Constituent Findings

- [ui-accessibility/AUD-UIA-018](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-018--explicit-timestamps-still-bypass-the-shared-presentation-contract) — Explicit timestamps still bypass the shared presentation contract (S2, C3, OPEN).

### Desired Outcome

All explicit displays use approved minute precision and default 12-hour formatting.

### Constraints / Invariants

Preserve stored precision, native editing precision, local-date handling and intentional relative text.

### Dependencies

No established cross-group dependency.

### Verification Expectations

Use identical AM/PM, midnight and minute-boundary fixtures across event, Digest, History and form consumers.

Required source verification dimensions: RUNTIME, STATIC.

### Planning Notes

Future selectable 12/24-hour preference remains deferred.

### Explicitly Out of Scope

Timestamp data migration or adding that preference.

<a id="rg-039"></a>

## RG-039 — Collapsed FAB accessibility investigation

**Highest Severity:** S2 — Moderate  
**Scope:** Cross-cutting  
**Domains:** ui-accessibility  
**Constituent Findings:** 1 source record (S2: 1)  
**Disposition:** INVESTIGATE

### Problem

Opacity-zero, pointer-disabled action rows may remain in native accessibility traversal.

### Shared Root Cause / Remediation Affinity

INVESTIGATE: alpha and native accessibility behavior must be observed.

### Constituent Findings

- [ui-accessibility/AUD-UIA-023](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-023--closed-fab-actions-remain-mounted-without-accessibility-hiding) — Closed FAB actions remain mounted without accessibility hiding (S2, C2, INVESTIGATE).

### Desired Outcome

The semantic tree matches dial visibility with coherent expansion/focus behavior.

### Constraints / Invariants

Keep keyboard hiding, contextual routing, measured bottom offset and opener restoration.

### Dependencies

- RG-039 **RELATED** RG-020: Native accessibility investigation of shell transients; outcomes are not assumed from opacity/group props.

### Verification Expectations

Compare native nodes/TalkBack closed/open/closing, keyboard and navigation transitions; hidden actions must not be invokable.

Required source verification dimensions: DEVICE, STATIC.

### Planning Notes

Absence of an explicit hiding prop is evidence for investigation, not proof of actual native exposure.

### Explicitly Out of Scope

Removing the universal FAB or declaring a motion defect without evidence.

<a id="rg-040"></a>

## RG-040 — Production overlay permission inventory

**Highest Severity:** S3 — Minor  
**Scope:** Multi-area  
**Domains:** release-readiness  
**Constituent Findings:** 1 source record (S3: 1)  
**Disposition:** OPEN

### Problem

An unused Expo template overlay permission remains in the production manifest.

### Shared Root Cause / Remediation Affinity

Authored configuration must own the generated permission inventory.

### Constituent Findings

- [release-readiness/AUD-REL-002](../release-readiness/DOMAIN-AUDIT.md#aud-rel-002--production-generation-retains-unused-overlay-permission) — Production generation retains unused overlay permission (S3, C3, OPEN).

### Desired Outcome

The production permission set matches implemented, owner-approved functionality.

### Constraints / Invariants

Security posture is owner-owned; preserve required READ_CONTACTS and justified development behavior.

### Dependencies

- RG-040 **RELATED** RG-001: Both require final manifest inspection but different permission/provider controls.
- RG-040 **RELATED** RG-041: Active scaffold defaults; independent security and artwork decisions.

### Verification Expectations

Fresh generated merged release manifest and final artifact; ordinary release launch and development operation.

Required source verification dimensions: RUNTIME, STATIC.

### Planning Notes

Do not edit ignored generated manifests. No automatic grant or Play rejection is asserted.

### Explicitly Out of Scope

Unrelated permission removal, signing or distribution.

<a id="rg-041"></a>

## RG-041 — Orbit launcher identity

**Highest Severity:** S3 — Minor  
**Scope:** Local  
**Domains:** release-readiness  
**Constituent Findings:** 1 source record (S3: 1)  
**Disposition:** OPEN

### Problem

Active Android adaptive foreground still uses the Expo scaffold mark.

### Shared Root Cause / Remediation Affinity

One asset/configuration identity boundary requires owner-approved artwork.

### Constituent Findings

- [release-readiness/AUD-REL-003](../release-readiness/DOMAIN-AUDIT.md#aud-rel-003--active-android-launcher-artwork-still-uses-the-expo-scaffold-mark) — Active Android launcher artwork still uses the Expo scaffold mark (S3, C3, OPEN).

### Desired Outcome

Launcher and applicable icon variants present the approved Orbit identity.

### Constraints / Invariants

Taste is the owner's decision; preserve stable package identity and supported icon modes.

### Dependencies

- RG-040 **RELATED** RG-041: Active scaffold defaults; independent security and artwork decisions.

### Verification Expectations

Resolved config, generated resources and final device launcher, including themed icons; check About icon consistency.

Required source verification dimensions: DEVICE, MANUAL-VISUAL, STATIC.

### Planning Notes

No replacement artwork is selected by synthesis.

### Explicitly Out of Scope

Package renaming, broader branding redesign or generating assets now.

<a id="rg-042"></a>

## RG-042 — Cold/warm notification navigation chronology

**Highest Severity:** S2 — Moderate  
**Scope:** Local  
**Domains:** react-native, reliability-testing  
**Constituent Findings:** 2 source records (S2: 2)  
**Disposition:** OPEN

### Problem

An old cold response can reset navigation after a newer warm tap.

### Shared Root Cause / Remediation Affinity

DUPLICATE reports of two ingress paths lacking one freshness authority.

### Constituent Findings

- [react-native/AUD-RN-012](../react-native/DOMAIN-AUDIT.md#aud-rn-012--delayed-cold-notification-navigation-can-override-a-newer-tap) — Delayed cold notification navigation can override a newer tap (S2, C2, OPEN).
- [reliability-testing/AUD-REL-012](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-012--cold-notification-routing-can-overwrite-a-newer-warm-tap-destination) — Cold notification routing can overwrite a newer warm-tap destination (S2, C2, OPEN).

### Desired Outcome

Latest accepted body-tap destination wins across cold/warm lookup completion.

### Constraints / Invariants

Preserve readiness, action deduplication, cold-response clearing and separate widget/native intent sources.

### Dependencies

- RG-015 **RELATED** RG-042: Same notification subsystem, separate scheduling/presentation and navigation responsibilities.
- RG-021 **RELATED** RG-042: Navigation topology and ingress chronology interact in tests without sharing an implementation prerequisite.

### Verification Expectations

Delay cold retrieval and contact lookup independently; navigate newer warm B then settle A; duplicate delivery and teardown; corroborate on device.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

Both packets retain C2. Synthesis verified the full current gate and corrected the stale reliability packet line anchors.

### Explicitly Out of Scope

Changing notification action semantics or merging native intent consumers.

<a id="rg-043"></a>

## RG-043 — Source-reconciliation choice identity

**Highest Severity:** S2 — Moderate  
**Scope:** Multi-area  
**Domains:** data-privacy  
**Constituent Findings:** 1 source record (S2: 1)  
**Disposition:** OPEN

### Problem

Distinct source birthdays share one choice ID, so applying a selected alternative can write NULL.

### Shared Root Cause / Remediation Affinity

The multi-source UI-to-apply boundary must preserve the exact chosen source option.

### Constituent Findings

- [data-privacy/AUD-DPI-009](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-009--multi-source-birthday-selection-writes-null-instead-of-the-selected-value) — Multi-source birthday selection writes NULL instead of the selected value (S2, C3, OPEN).

### Desired Outcome

Each chosen birthday/name option reaches storage and reviewed-source snapshots unchanged; ambiguity never becomes a clear.

### Constraints / Invariants

Keep source-only explicit review, scalar stale-baseline guards and bounded destructive history.

### Dependencies

- RG-012 **RELATED** RG-043: Import/consolidation creates multi-source inputs; later explicit review selection is independently broken.
- RG-031 **RELATED** RG-043: Recognizable review context and faithful chosen-value transport are both needed for trustworthy reconciliation.

### Verification Expectations

Select each differing source birthday, keep Orbit, and cover blank/conflicting local values; inspect canonical values and reviewed snapshots.

Required source verification dimensions: DEVICE, RUNTIME, STATIC.

### Planning Notes

Stored history is not a recovery UI. Group 31 can improve contact identity independently; correct labels do not fix lost option identity.

### Explicitly Out of Scope

Matching-policy changes, automatic source sync or treating source ambiguity as deletion.

