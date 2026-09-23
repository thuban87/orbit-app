# Pre-release Audit Campaign Synthesis

## Campaign inputs and validation

Synthesis date: **2026-09-22**. Repository: `/home/bwales/projects/orbit-app`. All eight completed packets identify **`0e04c27e1d82bc3b5069bbf5adfc72281155df69`**. Current HEAD matches. The campaign directory was untracked at synthesis start; there were no tracked modifications. There is no supplied campaign manifest enumerating expected domains: all eight discovered `*/DOMAIN-AUDIT.md` packets were read in full, and none presents itself as incomplete. This validates the discovered input set, not an unrecorded campaign plan.

All packets have metadata, primary finding blocks, classifications, evidence, verification expectations and limitations. **85 finding records contain only 82 distinct bare IDs:** reliability-testing and release-readiness both use domain code REL, colliding at AUD-REL-001, 002 and 003. These collisions are unrelated defects, not duplicates. Throughout synthesis, the authoritative identity is **packet path + original ID**. In particular, use `reliability-testing/AUD-REL-001` for Replace-all photo deletion and `release-readiness/AUD-REL-001` for startup cleanup failure. Original packets and IDs remain unchanged.

There is no material application-revision mismatch between inputs. Their differently described dirty states reflect accumulating untracked audit outputs. Historical APKs and generated Android manifests cited by SEC/REL are older than HEAD; source agreement does not turn them into current-release artifacts. Packet-local test runs overlap and must not be summed. Reliability reports 411 files / 3,840 tests passing; synthesis did not rerun that suite or certify those results independently.

Method: packet reconciliation, conservative duplicate/relationship mapping, and bounded authority checks. This is not another repository-wide audit. Existing packet evidence is attributed to its originating packet, not represented as newly reproduced here. Targeted source reads covered the full notification gate and assist confirmation/picker components, their relevant state/DAO/read/migration or selection boundaries, plus governing authority. Read-only `graph:ask` queries preceded those checks; returned governance was **INFERRED** from Key-files lists, not code assertions. No graph rebuild, native run, external request, implementation change or GSD phase was made.

## Interpretation

The campaign's main concern is **incomplete contracts between otherwise protective subsystems**. Serialized SQLite writes and passing unit tests do not by themselves prove exporter-to-restorer fidelity, filesystem ownership, native authorization, committed-write retry safety, or live UI publication.

No S0 finding was admitted. The S1 records concern native widget disclosure, restore/merge integrity, imported-note consent, credential recipient ownership, broken primary navigation/interactivity, repeated contact-save writes and startup availability. One S1 is still an investigation hypothesis (SEC-006). Severity describes consequence, not an owner-approved release priority.

Seven duplicate sets remove eight repeated records. All original evidence survives; broader duplicate members contribute additional triggers and verification. One RN finding is reconciled to an existing DEFERRED disposition. The result is **76 distinct OPEN/INVESTIGATE candidates across 43 remediation groups**, plus one distinct deferred finding. Groups are bounded review/planning affinities, **not GSD phases, implementation authorization, release gates or an execution sequence**.

## Cross-domain themes

1. **Ownership must survive identity and lifecycle changes.** Exported custom-photo metadata, reused integer filenames, restore delete/finalize journals, merge adoption and later user edits interact (RG-009/010). An overbroad cleanup fix could worsen data loss. Conversely, workflow snapshots, image derivatives, export staging and presented notifications need cleanup without touching still-owned data (RG-012–015). They are different copies, not one generic purge task.
2. **Commit truth must survive presentation failure.** Complete-contact and participant editors can replay successful mutations after failed readback; restore hides pending recovery. Group edits can lose drafts while refreshing unrelated committed state (RG-011/018/019). Verification must execute commit → failed read → retry rather than only validating a correct DAO payload.
3. **Durable writes need explicit publication to every relevant reader.** Assist producers omit different signals; Digest ignores existing signals; Profile owns two partially refreshed snapshots; restored theme remains boot-hydrated (RG-011/023/024/026). Fixing only producers or only consumers cannot establish end-to-end freshness. This does not imply a universal event bus or new state library.
4. **Native boundaries precede JavaScript safety.** Widget provider access, two native share consumers, response-body lifetime, notification readback and widget semantic nodes escape guarantees in JS mocks (RG-001–004/015/032). Final manifests, actual native serialization and attacker/provider/device checks are essential to those specific claims.
5. **One asynchronous owner is not enough when several entry paths exist.** Dashboard reload sources compete and duplicate work; notification cold/warm paths disagree about chronology; launch failures cross otherwise unrelated responsibilities (RG-016/022/042). Shared symptoms do not imply identical implementation.
6. **Consent and credential safety include their writers and UI.** Filtered prompt readers can correctly enforce flags created with the wrong default; SecureStore can correctly namespace a key after an accordion assigned it to the wrong provider (RG-005–008). Presentation errors in permission summaries do not themselves prove egress.
7. **Accessible state differs from visible pixels.** Parent labels can hide meaningful context, widget text is bitmap content, native defaults bypass theme tokens, and hidden/grouped controls need native confirmation. Contrast tests must match actual compositing, while geometry must account for available width (RG-020/029–039). Accepted styling exceptions remain intact.
8. **Verification needs composition and cost invariants.** Green tests coexist with missing shared-filesystem models, actual native readback, mounted lifecycle behavior, settled Orrery cardinality and bounded-period access plans. Carry those checks with the relevant groups; do not create a generic “test everything” group.

## Disposition and factual reconciliation

### CF-01 — Assist error handling: existing deferral preserved

**CONFLICT:** react-native/AUD-RN-013 is OPEN, while Architecture excludes the same confirm/dismiss error handling as DEFERRED. The behavior is real in the full current AssistBanner, PendingConfirmationsSheet and AssistConfirmation sources: rejection has no user-facing handler. ADR-071 still requires the future-date guard's rejection to be surfaced.

The archived [Phase 21 review](../../../../.planning/milestones/v1.0-phases/21-interaction-assist-reach-out/21-REVIEW.md), line 111, explicitly says **“IN-03 / IN-04 / IN-05 (LOW) — deferred (backlog)”**. [Interaction Assist system documentation](../../../systems/interaction-assist.md), Gotcha 4, preserves that backlog entry and names the same clock-rollback case. Synthesis therefore carries **AUD-RN-013 as DEFERRED**, retaining original S2/C3 and the unmet behavior; the RN packet itself is not edited. This is a scheduling deferral, not repeal of ADR-071 or acceptance of silent errors. Reopening it belongs to the owner. RG-023 addresses distinct successful-write publication and does not silently absorb the deferred item.

### CF-02 — One UIA-012 subclaim conflicts with a recorded picker contract

UIA-012 includes ContactPicker read failure becoming an empty/no-match state. Full current picker inspection confirms that path, but [Phase 22 UI-SPEC](../../../../.planning/phases/22-app-shell-navigation/22-UI-SPEC.md), line 131, explicitly prescribes **“on an unexpected query exception the picker renders the empty state rather than a broken sheet”**; [22-06-PLAN](../../../../.planning/phases/22-app-shell-navigation/22-06-PLAN.md), lines 33 and 138, repeats it. ADR-127 and current app-shell docs require visible **multi-select mutation** failure, which is a different boundary and does not explicitly supersede that read fallback.

**Hold only this subclaim for authority clarification.** Keep the recorded behavior until the owner resolves it or a later explicit supersession is found. UIA-012 remains OPEN for its five other screen branches and maps to RG-035; it is not wholly rejected or deferred. No new finding ID or extra finding count is created. The synthesis does not choose a new picker UX.

### CF-03 — Confidence differences and scope-limited clean claims

- SEC-004/PERF-003 agree on early photo-response rejection and continued native buffering. SEC uses C3 for repository control flow; PERF uses C2 for end-to-end resource consequences. Retain each classification and require native verification; repetition is not a confidence upgrade.
- ARCH-004 and RN-008 identify the same Profile snapshot coordination defect. ARCH covers inline deletion; RN additionally covers Quick Log. The duplicate mapping preserves the union of both verification scopes.
- Security's clean consent-reader observation does not disprove DPI-005's imported-flag writer defect. Its current endpoint-binding observation does not disprove SEC-006's legacy-only hypothesis or RN-003's pre-storage draft error.
- Performance's description of notification request diffing is qualified by reliability-testing/AUD-REL-010: the installed Android readback shape differs from the test double. That specific native evidence narrows the generic clean-area statement; no separate finding is manufactured.
- Startup reconciliation has a legitimate before-paint purpose (PERF). That is compatible with release-readiness/AUD-REL-001's recoverable-failure propagation. Likewise, coalescing exists even though a rejecting sweep loses its queued rerun.
- DPI's bounded data-layer safeguards do not certify all file-recovery interleavings; reliability's newer-avatar and Replace-all cases remain independently admitted.

### CF-04 — Evidence-reference caveat

The reliability packet's AUD-REL-012 cites older line offsets for `src/navigation/notification-gate.tsx` despite declaring the same HEAD. Synthesis opened the full current gate: the default predicate is at **149–152**, warm freshness at **233–252**, and the cold unguarded call at **263–281**, agreeing with RN-012. The functions and alleged behavior match; this is a reference defect, not evidence of a second bug or a different application revision. Other packet line references remain original source evidence, not individually recertified by synthesis.

## Constraints that must survive remediation

Local/offline reads, no Orbit backend or content telemetry; explicit configured AI invocation; approved egress exceptions; SecureStore and endpoint binding; optional backup encryption and Android backup opt-out; raw-TEXT normalized custom values with stable pairs; immutable shipped migrations; transactional history/recency and deletion evidence; non-reentrant write composition; foreground-only sweeps; recovery ownership before canonical file mutation; preserved user-controlled external backups; independent tab histories; current theme/visual authority and destructive confirmation rules.

Existing deferrals remain outside selected work: production signing/distribution obligations, onboarding and final hardening, contact-scoped field creation, parked theme-axis changes, dense Year-cell targets, general native performance calibration, and future 12/24-hour preference. A known deferral is not release clearance. Explicitly accepted widget fuel, headless widget palette, readable backups, scoped TypeScript search, coherent snapshot cost, release KDF benchmark and session-only Compose drafts are not new defects.

## Unresolved questions and verification limits

- SEC-006 needs the integrated supported legacy upgrade/restore/transport reproduction.
- UIA-011, 022 and 023 need native large-text/accessibility observation before their suspected behavior becomes a remediation conclusion.
- CF-02 needs authority clarification; CF-01 stays deferred unless reopened.
- Imported consent flags already enabled in stored data cannot be blanket-reset without resolving deliberate-opt-in ambiguity. Filename-policy, protected-hue/glass, permission posture and launcher artwork changes also belong to the owner where proposed.
- Campaign follow-ups remain leads, not extra primary findings: API-37 birthday subtype handling, repeated source review, additional restore caches, decoded image/fallback limits, widget host trust/implicit navigation, overlay focus/safe areas, and native resource measurements. They have no automatically selected remediation group.
- No final current-HEAD APK/AAB, physical-device UAT, TalkBack certification, provider attack demonstration, power-loss test, Play-account check or performance certification was performed here. Historical artifacts and Node fixtures support only their stated boundaries.
- Security's advisory scan is a packet-time signal, not a fresh synthesis scan or 27 demonstrated exploits. Do not prescribe broad dependency changes from propagation counts.

## How to use the outputs

[REMEDIATION-GROUPS.md](REMEDIATION-GROUPS.md) defines outcomes, constraints, affinity and verification per group. [TRIAGE.md](TRIAGE.md) leaves every candidate group awaiting an owner decision; no priority, fix, phase, estimate or release approval is assigned. Original packets remain the detailed evidence source. Use packet-qualified IDs in downstream work, especially for REL.

## Input inventory and finding distribution

| Packet | S1 | S2 | S3 | OPEN | INVESTIGATE | Total |
|---|---:|---:|---:|---:|---:|---:|
| [architecture](../architecture/DOMAIN-AUDIT.md) | 0 | 7 | 2 | 9 | 0 | 9 |
| [data-privacy](../data-privacy/DOMAIN-AUDIT.md) | 5 | 8 | 0 | 13 | 0 | 13 |
| [performance](../performance/DOMAIN-AUDIT.md) | 0 | 3 | 1 | 4 | 0 | 4 |
| [react-native](../react-native/DOMAIN-AUDIT.md) | 3 | 10 | 0 | 13 | 0 | 13 |
| [release-readiness](../release-readiness/DOMAIN-AUDIT.md) | 1 | 0 | 2 | 3 | 0 | 3 |
| [reliability-testing](../reliability-testing/DOMAIN-AUDIT.md) | 2 | 12 | 0 | 14 | 0 | 14 |
| [security](../security/DOMAIN-AUDIT.md) | 2 | 4 | 0 | 5 | 1 | 6 |
| [ui-accessibility](../ui-accessibility/DOMAIN-AUDIT.md) | 0 | 17 | 6 | 20 | 3 | 23 |
| **Original packet records** | **13** | **61** | **11** | **81** | **4** | **85** |

S0 and S4 are zero throughout. Original confidence distribution: C2: 10; C3: 75.

| Accounting view | S1 | S2 | S3 | OPEN | INVESTIGATE | DEFERRED | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Distinct after duplicate collapse | 13 | 53 | 11 | 72 | 4 | 1 | 77 |
| Remediation/investigation candidates | 13 | 52 | 11 | 72 | 4 | 0 | 76 |

Counts collapse only the seven declared duplicate sets. They do not collapse shared files, analogous bugs, the three bare-ID collisions, or UIA-012’s separate screen branches. CF-02 holds one subclaim, not the whole finding. Confidence is not averaged or raised by duplicate agreement.

## Duplicate and overlap register

| Relationship | Original findings | Reconciliation |
|---|---|---|
| DUPLICATE | [architecture/AUD-ARCH-003](../architecture/DOMAIN-AUDIT.md#aud-arch-003--active-memory-editors-still-derive-ai-enablement-from-the-retired-provider-setting); [react-native/AUD-RN-005](../react-native/DOMAIN-AUDIT.md#aud-rn-005--memory-permission-controls-use-retired-ai-configuration-state) | Same four legacy AI-enable consumers; preserve both test matrices. |
| DUPLICATE | [architecture/AUD-ARCH-004](../architecture/DOMAIN-AUDIT.md#aud-arch-004--inline-history-deletion-refreshes-only-one-of-two-profile-projections); [react-native/AUD-RN-008](../react-native/DOMAIN-AUDIT.md#aud-rn-008--profile-history-and-relationship-metrics-refresh-independently) | Same two Profile read owners. ARCH is the deletion subset; retain RN’s additional Quick Log case. |
| DUPLICATE | [architecture/AUD-ARCH-007](../architecture/DOMAIN-AUDIT.md#aud-arch-007--launch-maintenance-relies-on-inconsistent-per-hook-failure-containment); [react-native/AUD-RN-011](../react-native/DOMAIN-AUDIT.md#aud-rn-011--an-early-sweep-rejection-skips-unrelated-lifecycle-work); [reliability-testing/AUD-REL-009](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-009--one-launch-hook-rejection-skips-unrelated-recovery-and-maintenance) | Same sequential launch runner, uncaught hook failures and lost queued rerun; combine real-hook evidence. |
| DUPLICATE | [data-privacy/AUD-DPI-008](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-008--photo-only-import-failures-cannot-retry-and-lose-their-staged-input); [reliability-testing/AUD-REL-004](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-004--imported-photo-failures-lose-their-retry-input-at-the-next-sweep) | Same imported-row/photo-failure retry and staging-liveness mismatch; preserve interruption coverage. |
| DUPLICATE | [security/AUD-SEC-004](../security/DOMAIN-AUDIT.md#aud-sec-004--rejected-photo-responses-continue-native-buffering); [performance/AUD-PERF-003](../performance/DOMAIN-AUDIT.md#aud-perf-003--rejected-photo-responses-continue-consuming-transfer-resources) | Same early-rejected Expo fetch response; PERF adds cache-preparation/navigation exits. C3/C2 differ in evidence scope, not facts. |
| DUPLICATE | [react-native/AUD-RN-006](../react-native/DOMAIN-AUDIT.md#aud-rn-006--digest-misses-same-route-writes-and-foreground-refresh); [reliability-testing/AUD-REL-013](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-013--digest-ignores-successful-quick-log-and-undo-while-it-remains-focused) | Same focus-only Digest/Your Week consumers; retain same-route writes and foreground/date cases. |
| DUPLICATE | [react-native/AUD-RN-012](../react-native/DOMAIN-AUDIT.md#aud-rn-012--delayed-cold-notification-navigation-can-override-a-newer-tap); [reliability-testing/AUD-REL-012](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-012--cold-notification-routing-can-overwrite-a-newer-warm-tap-destination) | Same cold/warm notification chronology race; use current gate offsets from CF-04 and retain C2. |

Historical identity: security/AUD-SEC-001 corresponds to SEC-001 in [the August 21 security audit](../../2026-08-21/SECURITY-PRIVACY.md). It is outside this campaign’s counts. The older SEC-004 photo concern is RELATED historical context, not automatically an exact duplicate of the installed-SDK-specific rejection path. These historical mappings are reported by the security packet; synthesis did not reopen that earlier audit.

## Other material finding relationships

| Type | Findings | Why / boundary |
|---|---|---|
| SHARED_ROOT_CAUSE | [architecture/AUD-ARCH-006](../architecture/DOMAIN-AUDIT.md#aud-arch-006--compose-assist-confirmation-omits-shared-queuewidget-publication); [react-native/AUD-RN-007](../react-native/DOMAIN-AUDIT.md#aud-rn-007--assist-confirmations-do-not-invalidate-the-foreground-view) | Entry-specific assist confirmation omits different parts of post-commit publication. Neither is a duplicate of the other. |
| SHARED_ROOT_CAUSE | [performance/AUD-PERF-002](../performance/DOMAIN-AUDIT.md#aud-perf-002--dashboard-schedules-redundant-and-background-refresh-bundles); [react-native/AUD-RN-010](../react-native/DOMAIN-AUDIT.md#aud-rn-010--dashboard-refresh-owners-can-publish-obsolete-query-results) | Multiple Dashboard reload owners lack unified scheduling/publication ownership; work-count and latest-result guarantees remain distinct. |
| DEPENDENT | [react-native/AUD-RN-007](../react-native/DOMAIN-AUDIT.md#aud-rn-007--assist-confirmations-do-not-invalidate-the-foreground-view); [react-native/AUD-RN-008](../react-native/DOMAIN-AUDIT.md#aud-rn-008--profile-history-and-relationship-metrics-refresh-independently); [react-native/AUD-RN-006](../react-native/DOMAIN-AUDIT.md#aud-rn-006--digest-misses-same-route-writes-and-foreground-refresh) | End-to-end assist freshness on Profile/Digest requires both producer publication and consumer refresh. No mandatory implementation order: existing Quick Log can exercise consumers. |
| RELATED | [data-privacy/AUD-DPI-001](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-001--successful-restore-silently-loses-exported-custom-field-photos); [data-privacy/AUD-DPI-004](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-004--contact-merge-transfers-photo-references-without-safe-asset-ownership); [data-privacy/AUD-DPI-010](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-010--canonical-photos-survive-deletion-paths-that-omit-ownership-cleanup); [reliability-testing/AUD-REL-001](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-001--replace-all-photo-cleanup-deletes-newly-restored-canonical-files); [reliability-testing/AUD-REL-003](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-003--restore-photo-recovery-can-overwrite-a-newer-successful-avatar-edit) | Different photo target, ownership, deletion and recovery defects meet at canonical byte ownership. Fixing only one does not close the rest. |
| RELATED | [data-privacy/AUD-DPI-002](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-002--merge-omits-required-global-custom-field-pairs-and-creates-unrestorable-exports); [data-privacy/AUD-DPI-003](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-003--restore-applies-stale-winners-over-newer-committed-local-writes); [data-privacy/AUD-DPI-006](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-006--tombstone-only-merge-discards-deletion-evidence) | Pair completeness, authoritative winner selection and deletion-evidence persistence share restore but have different causes. |
| RELATED | [data-privacy/AUD-DPI-007](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-007--permanent-contact-purge-retains-sensitive-import-session-payloads); [data-privacy/AUD-DPI-008](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-008--photo-only-import-failures-cannot-retry-and-lose-their-staged-input) | Session cleanup must distinguish purged content from unfinished photo work. |
| RELATED | [data-privacy/AUD-DPI-011](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-011--generated-image-cache-copies-survive-successful-photo-removal); [data-privacy/AUD-DPI-013](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-013--manual-export-leaves-unbounded-app-owned-snapshot-copies-in-cache); [data-privacy/AUD-DPI-012](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-012--already-presented-notifications-survive-permanent-contact-purge) | Copies survive canonical deletion, but cache, shared-file and OS-presentation owners differ. |
| RELATED | [reliability-testing/AUD-REL-002](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-002--edit-contact-retries-replay-collections-that-already-committed); [reliability-testing/AUD-REL-008](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-008--participant-add-refresh-failures-cause-retries-of-an-already-committed-write) | Committed-write/failed-read retries replay operations in independent editors. |
| RELATED | [reliability-testing/AUD-REL-006](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-006--editing-an-existing-participant-override-silently-drops-the-new-value); [reliability-testing/AUD-REL-007](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-007--participant-actions-erase-unsaved-group-event-drafts); [reliability-testing/AUD-REL-008](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-008--participant-add-refresh-failures-cause-retries-of-an-already-committed-write) | Group edit and participant flows share draft/commit coordination. |
| RELATED | [architecture/AUD-ARCH-005](../architecture/DOMAIN-AUDIT.md#aud-arch-005--restored-appearance-settings-never-publish-into-the-live-theme-store); [reliability-testing/AUD-REL-005](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-005--restore-completion-hides-outstanding-photo-and-schedule-recovery) | Restore completion includes live-state publication and truthful outstanding-work reporting. |
| RELATED | [release-readiness/AUD-REL-001](../release-readiness/DOMAIN-AUDIT.md#aud-rel-001--recoverable-background-cleanup-failure-blocks-application-startup); [architecture/AUD-ARCH-007](../architecture/DOMAIN-AUDIT.md#aud-arch-007--launch-maintenance-relies-on-inconsistent-per-hook-failure-containment) | Fatal bootstrap cleanup and foreground-hook starvation have separate entry points and severity. |
| RELATED | [security/AUD-SEC-001](../security/DOMAIN-AUDIT.md#aud-sec-001--widget-snapshots-readable-by-unrelated-apps); [ui-accessibility/AUD-UIA-009](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-009--widget-bitmap-actions-have-no-accessible-names) | Native widget authorization and native accessibility are independent controls. |
| RELATED | [react-native/AUD-RN-003](../react-native/DOMAIN-AUDIT.md#aud-rn-003--unsaved-provider-credentials-cross-connection-cards); [security/AUD-SEC-006](../security/DOMAIN-AUDIT.md#aud-sec-006--legacy-custom-key-may-bind-to-a-restored-replacement-endpoint) | Confirmed UI draft crossover versus unconfirmed legacy restore binding; never merge their confidence or triggers. |
| RELATED | [data-privacy/AUD-DPI-009](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-009--multi-source-birthday-selection-writes-null-instead-of-the-selected-value); [ui-accessibility/AUD-UIA-019](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-019--reconciliation-cards-substitute-database-ids-for-contact-identity); [ui-accessibility/AUD-UIA-008](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-008--review-cards-omit-selection-and-decision-evidence-from-their-accessible-representation) | Review must identify the person, expose decision context and transport the selected value faithfully. |
| CONFLICT | [react-native/AUD-RN-013](../react-native/DOMAIN-AUDIT.md#aud-rn-013--assist-write-failures-have-no-user-facing-recovery-state) | OPEN in RN versus explicitly deferred IN-03 excluded by ARCH; resolved to existing DEFERRED status in CF-01. |
| CONFLICT | [ui-accessibility/AUD-UIA-012](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-012--loadingread-failures-are-presented-as-empty-failed-or-still-running-inconsistently) | Picker read-error subclaim versus explicit Phase 22 fallback; hold that subclaim per CF-02, retain five other OPEN branches. |

SHARED_ROOT_CAUSE denotes a bounded ownership problem supported by the packet flows. Broader themes such as “missing cleanup” or “older consumer” are not proof of one universal root cause.

## Remediation-group summary

Group numbering follows boundary organization, not priority. Highest severity is the maximum constituent severity, never an average. Counts are original finding records, including duplicate aliases.

| Group | Boundary | Highest | Records | Status |
|---|---|---|---:|---|
| [RG-001](REMEDIATION-GROUPS.md#rg-001) | Widget image access boundary | S1 | 1 | OPEN |
| [RG-002](REMEDIATION-GROUPS.md#rg-002) | Bounded and defensive Android backup ingress | S2 | 2 | OPEN |
| [RG-003](REMEDIATION-GROUPS.md#rg-003) | Photo download cancellation and resource bounds | S2 | 2 | OPEN |
| [RG-004](REMEDIATION-GROUPS.md#rg-004) | Custom AI native response ownership | S2 | 1 | OPEN |
| [RG-005](REMEDIATION-GROUPS.md#rg-005) | Legacy credential binding across restore investigation | S1 | 1 | INVESTIGATE |
| [RG-006](REMEDIATION-GROUPS.md#rg-006) | Provider-scoped credential drafts | S1 | 1 | OPEN |
| [RG-007](REMEDIATION-GROUPS.md#rg-007) | Imported-note consent provenance | S1 | 1 | OPEN |
| [RG-008](REMEDIATION-GROUPS.md#rg-008) | Current AI configuration and truthful permission presentation | S2 | 4 | OPEN |
| [RG-009](REMEDIATION-GROUPS.md#rg-009) | Restore reconciliation and committed graph integrity | S1 | 3 | OPEN |
| [RG-010](REMEDIATION-GROUPS.md#rg-010) | Canonical photo ownership across restore, merge and deletion | S1 | 5 | OPEN |
| [RG-011](REMEDIATION-GROUPS.md#rg-011) | Restore publication and partial-success reporting | S2 | 2 | OPEN |
| [RG-012](REMEDIATION-GROUPS.md#rg-012) | Import workflow retention, purge and photo retry | S2 | 3 | OPEN |
| [RG-013](REMEDIATION-GROUPS.md#rg-013) | Generated photo derivative lifetime | S2 | 1 | OPEN |
| [RG-014](REMEDIATION-GROUPS.md#rg-014) | Manual export staging lifetime | S2 | 1 | OPEN |
| [RG-015](REMEDIATION-GROUPS.md#rg-015) | Notification scheduling, readback and deletion lifecycle | S2 | 3 | OPEN |
| [RG-016](REMEDIATION-GROUPS.md#rg-016) | Bootstrap and foreground maintenance failure boundaries | S1 | 4 | OPEN |
| [RG-017](REMEDIATION-GROUPS.md#rg-017) | Consistent history semantics for contact edits | S2 | 2 | OPEN |
| [RG-018](REMEDIATION-GROUPS.md#rg-018) | Committed contact-editor baselines and retry | S1 | 1 | OPEN |
| [RG-019](REMEDIATION-GROUPS.md#rg-019) | Group-event draft, override and post-commit recovery | S2 | 3 | OPEN |
| [RG-020](REMEDIATION-GROUPS.md#rg-020) | Dashboard panel settlement and accessible traversal | S1 | 2 | INVESTIGATE + OPEN |
| [RG-021](REMEDIATION-GROUPS.md#rg-021) | Semantic tab roots and shared Profile destinations | S1 | 3 | OPEN |
| [RG-022](REMEDIATION-GROUPS.md#rg-022) | Dashboard refresh scheduling and latest-result ownership | S2 | 2 | OPEN |
| [RG-023](REMEDIATION-GROUPS.md#rg-023) | Assist post-commit publication | S2 | 2 | OPEN |
| [RG-024](REMEDIATION-GROUPS.md#rg-024) | Profile history, metrics and calendar coherence | S2 | 3 | OPEN |
| [RG-025](REMEDIATION-GROUPS.md#rg-025) | Profile relationship selector retry settlement | S3 | 1 | OPEN |
| [RG-026](REMEDIATION-GROUPS.md#rg-026) | Live Digest and truthful day-detail results | S2 | 3 | OPEN |
| [RG-027](REMEDIATION-GROUPS.md#rg-027) | Orrery settled resource retirement | S2 | 1 | OPEN |
| [RG-028](REMEDIATION-GROUPS.md#rg-028) | Bounded-period Your Week query access | S3 | 1 | OPEN |
| [RG-029](REMEDIATION-GROUPS.md#rg-029) | Theme contrast proof and semantic action foregrounds | S2 | 2 | OPEN |
| [RG-030](REMEDIATION-GROUPS.md#rg-030) | Accessible and themed editor controls | S2 | 4 | OPEN |
| [RG-031](REMEDIATION-GROUPS.md#rg-031) | Contact and review row identity, typography and accessible context | S2 | 4 | OPEN |
| [RG-032](REMEDIATION-GROUPS.md#rg-032) | Native widget action accessibility | S2 | 1 | OPEN |
| [RG-033](REMEDIATION-GROUPS.md#rg-033) | Heatmap and layout-preview width accounting | S2 | 2 | OPEN |
| [RG-034](REMEDIATION-GROUPS.md#rg-034) | Large-text confirmation reachability investigation | S2 | 1 | INVESTIGATE |
| [RG-035](REMEDIATION-GROUPS.md#rg-035) | Truthful asynchronous workflow presentation | S2 | 1 | OPEN |
| [RG-036](REMEDIATION-GROUPS.md#rg-036) | Backup passphrase field identification | S2 | 1 | OPEN |
| [RG-037](REMEDIATION-GROUPS.md#rg-037) | Settings directory and child chrome consistency | S3 | 2 | OPEN |
| [RG-038](REMEDIATION-GROUPS.md#rg-038) | Shared explicit timestamp presentation | S2 | 1 | OPEN |
| [RG-039](REMEDIATION-GROUPS.md#rg-039) | Collapsed FAB accessibility investigation | S2 | 1 | INVESTIGATE |
| [RG-040](REMEDIATION-GROUPS.md#rg-040) | Production overlay permission inventory | S3 | 1 | OPEN |
| [RG-041](REMEDIATION-GROUPS.md#rg-041) | Orbit launcher identity | S3 | 1 | OPEN |
| [RG-042](REMEDIATION-GROUPS.md#rg-042) | Cold/warm notification navigation chronology | S2 | 2 | OPEN |
| [RG-043](REMEDIATION-GROUPS.md#rg-043) | Source-reconciliation choice identity | S2 | 1 | OPEN |

Group dependency/affinity edges are in REMEDIATION-GROUPS.md. No cross-group **BLOCKS** edge is established by the present evidence; source/build/device availability are verification prerequisites, not invented implementation dependencies.

## Complete source-to-triage index

Every original record appears once below. Duplicate aliases stay attached to the same group.

| Original finding | Original classification | Synthesis destination |
|---|---|---|
| [architecture/AUD-ARCH-001](../architecture/DOMAIN-AUDIT.md#aud-arch-001--rapid-custom-field-edits-bypass-retained-value-history) | S2 / C3 / OPEN | [RG-017](REMEDIATION-GROUPS.md#rg-017) |
| [architecture/AUD-ARCH-002](../architecture/DOMAIN-AUDIT.md#aud-arch-002--complete-contact-edits-bypass-bindunbind-event-recording) | S2 / C3 / OPEN | [RG-017](REMEDIATION-GROUPS.md#rg-017) |
| [architecture/AUD-ARCH-003](../architecture/DOMAIN-AUDIT.md#aud-arch-003--active-memory-editors-still-derive-ai-enablement-from-the-retired-provider-setting) | S2 / C3 / OPEN | [RG-008](REMEDIATION-GROUPS.md#rg-008) |
| [architecture/AUD-ARCH-004](../architecture/DOMAIN-AUDIT.md#aud-arch-004--inline-history-deletion-refreshes-only-one-of-two-profile-projections) | S2 / C3 / OPEN | [RG-024](REMEDIATION-GROUPS.md#rg-024) |
| [architecture/AUD-ARCH-005](../architecture/DOMAIN-AUDIT.md#aud-arch-005--restored-appearance-settings-never-publish-into-the-live-theme-store) | S2 / C3 / OPEN | [RG-011](REMEDIATION-GROUPS.md#rg-011) |
| [architecture/AUD-ARCH-006](../architecture/DOMAIN-AUDIT.md#aud-arch-006--compose-assist-confirmation-omits-shared-queuewidget-publication) | S2 / C3 / OPEN | [RG-023](REMEDIATION-GROUPS.md#rg-023) |
| [architecture/AUD-ARCH-007](../architecture/DOMAIN-AUDIT.md#aud-arch-007--launch-maintenance-relies-on-inconsistent-per-hook-failure-containment) | S2 / C3 / OPEN | [RG-016](REMEDIATION-GROUPS.md#rg-016) |
| [architecture/AUD-ARCH-008](../architecture/DOMAIN-AUDIT.md#aud-arch-008--profile-interaction-history-actions-still-route-to-contact-knowledge) | S3 / C3 / OPEN | [RG-021](REMEDIATION-GROUPS.md#rg-021) |
| [architecture/AUD-ARCH-009](../architecture/DOMAIN-AUDIT.md#aud-arch-009--selector-retry-duplicates-submission-but-omits-successful-settlement) | S3 / C3 / OPEN | [RG-025](REMEDIATION-GROUPS.md#rg-025) |
| [data-privacy/AUD-DPI-001](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-001--successful-restore-silently-loses-exported-custom-field-photos) | S1 / C3 / OPEN | [RG-010](REMEDIATION-GROUPS.md#rg-010) |
| [data-privacy/AUD-DPI-002](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-002--merge-omits-required-global-custom-field-pairs-and-creates-unrestorable-exports) | S1 / C3 / OPEN | [RG-009](REMEDIATION-GROUPS.md#rg-009) |
| [data-privacy/AUD-DPI-003](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-003--restore-applies-stale-winners-over-newer-committed-local-writes) | S1 / C3 / OPEN | [RG-009](REMEDIATION-GROUPS.md#rg-009) |
| [data-privacy/AUD-DPI-004](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-004--contact-merge-transfers-photo-references-without-safe-asset-ownership) | S1 / C3 / OPEN | [RG-010](REMEDIATION-GROUPS.md#rg-010) |
| [data-privacy/AUD-DPI-005](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-005--imported-notes-inherit-ai-permission-contrary-to-their-mandatory-off-default) | S1 / C3 / OPEN | [RG-007](REMEDIATION-GROUPS.md#rg-007) |
| [data-privacy/AUD-DPI-006](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-006--tombstone-only-merge-discards-deletion-evidence) | S2 / C3 / OPEN | [RG-009](REMEDIATION-GROUPS.md#rg-009) |
| [data-privacy/AUD-DPI-007](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-007--permanent-contact-purge-retains-sensitive-import-session-payloads) | S2 / C3 / OPEN | [RG-012](REMEDIATION-GROUPS.md#rg-012) |
| [data-privacy/AUD-DPI-008](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-008--photo-only-import-failures-cannot-retry-and-lose-their-staged-input) | S2 / C3 / OPEN | [RG-012](REMEDIATION-GROUPS.md#rg-012) |
| [data-privacy/AUD-DPI-009](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-009--multi-source-birthday-selection-writes-null-instead-of-the-selected-value) | S2 / C3 / OPEN | [RG-043](REMEDIATION-GROUPS.md#rg-043) |
| [data-privacy/AUD-DPI-010](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-010--canonical-photos-survive-deletion-paths-that-omit-ownership-cleanup) | S2 / C3 / OPEN | [RG-010](REMEDIATION-GROUPS.md#rg-010) |
| [data-privacy/AUD-DPI-011](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-011--generated-image-cache-copies-survive-successful-photo-removal) | S2 / C3 / OPEN | [RG-013](REMEDIATION-GROUPS.md#rg-013) |
| [data-privacy/AUD-DPI-012](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-012--already-presented-notifications-survive-permanent-contact-purge) | S2 / C3 / OPEN | [RG-015](REMEDIATION-GROUPS.md#rg-015) |
| [data-privacy/AUD-DPI-013](../data-privacy/DOMAIN-AUDIT.md#aud-dpi-013--manual-export-leaves-unbounded-app-owned-snapshot-copies-in-cache) | S2 / C3 / OPEN | [RG-014](REMEDIATION-GROUPS.md#rg-014) |
| [performance/AUD-PERF-001](../performance/DOMAIN-AUDIT.md#aud-perf-001--orrery-retains-obsolete-geometry-and-scene-resources-after-settlement) | S2 / C3 / OPEN | [RG-027](REMEDIATION-GROUPS.md#rg-027) |
| [performance/AUD-PERF-002](../performance/DOMAIN-AUDIT.md#aud-perf-002--dashboard-schedules-redundant-and-background-refresh-bundles) | S2 / C3 / OPEN | [RG-022](REMEDIATION-GROUPS.md#rg-022) |
| [performance/AUD-PERF-003](../performance/DOMAIN-AUDIT.md#aud-perf-003--rejected-photo-responses-continue-consuming-transfer-resources) | S2 / C2 / OPEN | [RG-003](REMEDIATION-GROUPS.md#rg-003) |
| [performance/AUD-PERF-004](../performance/DOMAIN-AUDIT.md#aud-perf-004--your-week-scans-lifetime-history-for-bounded-period-reads) | S3 / C3 / OPEN | [RG-028](REMEDIATION-GROUPS.md#rg-028) |
| [react-native/AUD-RN-001](../react-native/DOMAIN-AUDIT.md#aud-rn-001--dashboard-panel-dismissal-leaves-underlying-content-inert) | S1 / C3 / OPEN | [RG-020](REMEDIATION-GROUPS.md#rg-020) |
| [react-native/AUD-RN-002](../react-native/DOMAIN-AUDIT.md#aud-rn-002--first-nested-workflow-entry-can-omit-a-tabs-semantic-root) | S1 / C3 / OPEN | [RG-021](REMEDIATION-GROUPS.md#rg-021) |
| [react-native/AUD-RN-003](../react-native/DOMAIN-AUDIT.md#aud-rn-003--unsaved-provider-credentials-cross-connection-cards) | S1 / C3 / OPEN | [RG-006](REMEDIATION-GROUPS.md#rg-006) |
| [react-native/AUD-RN-004](../react-native/DOMAIN-AUDIT.md#aud-rn-004--settings-hosted-profile-omits-reachable-child-routes-and-context) | S2 / C3 / OPEN | [RG-021](REMEDIATION-GROUPS.md#rg-021) |
| [react-native/AUD-RN-005](../react-native/DOMAIN-AUDIT.md#aud-rn-005--memory-permission-controls-use-retired-ai-configuration-state) | S2 / C3 / OPEN | [RG-008](REMEDIATION-GROUPS.md#rg-008) |
| [react-native/AUD-RN-006](../react-native/DOMAIN-AUDIT.md#aud-rn-006--digest-misses-same-route-writes-and-foreground-refresh) | S2 / C3 / OPEN | [RG-026](REMEDIATION-GROUPS.md#rg-026) |
| [react-native/AUD-RN-007](../react-native/DOMAIN-AUDIT.md#aud-rn-007--assist-confirmations-do-not-invalidate-the-foreground-view) | S2 / C3 / OPEN | [RG-023](REMEDIATION-GROUPS.md#rg-023) |
| [react-native/AUD-RN-008](../react-native/DOMAIN-AUDIT.md#aud-rn-008--profile-history-and-relationship-metrics-refresh-independently) | S2 / C3 / OPEN | [RG-024](REMEDIATION-GROUPS.md#rg-024) |
| [react-native/AUD-RN-009](../react-native/DOMAIN-AUDIT.md#aud-rn-009--historys-current-date-is-frozen-for-the-component-lifetime) | S2 / C3 / OPEN | [RG-024](REMEDIATION-GROUPS.md#rg-024) |
| [react-native/AUD-RN-010](../react-native/DOMAIN-AUDIT.md#aud-rn-010--dashboard-refresh-owners-can-publish-obsolete-query-results) | S2 / C2 / OPEN | [RG-022](REMEDIATION-GROUPS.md#rg-022) |
| [react-native/AUD-RN-011](../react-native/DOMAIN-AUDIT.md#aud-rn-011--an-early-sweep-rejection-skips-unrelated-lifecycle-work) | S2 / C3 / OPEN | [RG-016](REMEDIATION-GROUPS.md#rg-016) |
| [react-native/AUD-RN-012](../react-native/DOMAIN-AUDIT.md#aud-rn-012--delayed-cold-notification-navigation-can-override-a-newer-tap) | S2 / C2 / OPEN | [RG-042](REMEDIATION-GROUPS.md#rg-042) |
| [react-native/AUD-RN-013](../react-native/DOMAIN-AUDIT.md#aud-rn-013--assist-write-failures-have-no-user-facing-recovery-state) | S2 / C3 / OPEN | [Deferred: CF-01](TRIAGE.md#deferred) |
| [release-readiness/AUD-REL-001](../release-readiness/DOMAIN-AUDIT.md#aud-rel-001--recoverable-background-cleanup-failure-blocks-application-startup) | S1 / C3 / OPEN | [RG-016](REMEDIATION-GROUPS.md#rg-016) |
| [release-readiness/AUD-REL-002](../release-readiness/DOMAIN-AUDIT.md#aud-rel-002--production-generation-retains-unused-overlay-permission) | S3 / C3 / OPEN | [RG-040](REMEDIATION-GROUPS.md#rg-040) |
| [release-readiness/AUD-REL-003](../release-readiness/DOMAIN-AUDIT.md#aud-rel-003--active-android-launcher-artwork-still-uses-the-expo-scaffold-mark) | S3 / C3 / OPEN | [RG-041](REMEDIATION-GROUPS.md#rg-041) |
| [reliability-testing/AUD-REL-001](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-001--replace-all-photo-cleanup-deletes-newly-restored-canonical-files) | S1 / C3 / OPEN | [RG-010](REMEDIATION-GROUPS.md#rg-010) |
| [reliability-testing/AUD-REL-002](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-002--edit-contact-retries-replay-collections-that-already-committed) | S1 / C3 / OPEN | [RG-018](REMEDIATION-GROUPS.md#rg-018) |
| [reliability-testing/AUD-REL-003](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-003--restore-photo-recovery-can-overwrite-a-newer-successful-avatar-edit) | S2 / C3 / OPEN | [RG-010](REMEDIATION-GROUPS.md#rg-010) |
| [reliability-testing/AUD-REL-004](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-004--imported-photo-failures-lose-their-retry-input-at-the-next-sweep) | S2 / C3 / OPEN | [RG-012](REMEDIATION-GROUPS.md#rg-012) |
| [reliability-testing/AUD-REL-005](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-005--restore-completion-hides-outstanding-photo-and-schedule-recovery) | S2 / C3 / OPEN | [RG-011](REMEDIATION-GROUPS.md#rg-011) |
| [reliability-testing/AUD-REL-006](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-006--editing-an-existing-participant-override-silently-drops-the-new-value) | S2 / C3 / OPEN | [RG-019](REMEDIATION-GROUPS.md#rg-019) |
| [reliability-testing/AUD-REL-007](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-007--participant-actions-erase-unsaved-group-event-drafts) | S2 / C3 / OPEN | [RG-019](REMEDIATION-GROUPS.md#rg-019) |
| [reliability-testing/AUD-REL-008](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-008--participant-add-refresh-failures-cause-retries-of-an-already-committed-write) | S2 / C3 / OPEN | [RG-019](REMEDIATION-GROUPS.md#rg-019) |
| [reliability-testing/AUD-REL-009](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-009--one-launch-hook-rejection-skips-unrelated-recovery-and-maintenance) | S2 / C3 / OPEN | [RG-016](REMEDIATION-GROUPS.md#rg-016) |
| [reliability-testing/AUD-REL-010](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-010--notification-tests-model-the-wrong-android-date-trigger-readback) | S2 / C3 / OPEN | [RG-015](REMEDIATION-GROUPS.md#rg-015) |
| [reliability-testing/AUD-REL-011](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-011--after-slot-reconciliation-adds-a-next-day-reminder-to-the-weekly-cadence) | S2 / C3 / OPEN | [RG-015](REMEDIATION-GROUPS.md#rg-015) |
| [reliability-testing/AUD-REL-012](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-012--cold-notification-routing-can-overwrite-a-newer-warm-tap-destination) | S2 / C2 / OPEN | [RG-042](REMEDIATION-GROUPS.md#rg-042) |
| [reliability-testing/AUD-REL-013](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-013--digest-ignores-successful-quick-log-and-undo-while-it-remains-focused) | S2 / C3 / OPEN | [RG-026](REMEDIATION-GROUPS.md#rg-026) |
| [reliability-testing/AUD-REL-014](../reliability-testing/DOMAIN-AUDIT.md#aud-rel-014--digest-day-detail-read-failures-are-presented-as-no-activity) | S2 / C3 / OPEN | [RG-026](REMEDIATION-GROUPS.md#rg-026) |
| [security/AUD-SEC-001](../security/DOMAIN-AUDIT.md#aud-sec-001--widget-snapshots-readable-by-unrelated-apps) | S1 / C3 / OPEN | [RG-001](REMEDIATION-GROUPS.md#rg-001) |
| [security/AUD-SEC-002](../security/DOMAIN-AUDIT.md#aud-sec-002--backup-intake-consumes-unbounded-provider-streams-and-payloads) | S2 / C3 / OPEN | [RG-002](REMEDIATION-GROUPS.md#rg-002) |
| [security/AUD-SEC-003](../security/DOMAIN-AUDIT.md#aud-sec-003--native-share-handler-trusts-malformed-provider-metadata) | S2 / C2 / OPEN | [RG-002](REMEDIATION-GROUPS.md#rg-002) |
| [security/AUD-SEC-004](../security/DOMAIN-AUDIT.md#aud-sec-004--rejected-photo-responses-continue-native-buffering) | S2 / C3 / OPEN | [RG-003](REMEDIATION-GROUPS.md#rg-003) |
| [security/AUD-SEC-005](../security/DOMAIN-AUDIT.md#aud-sec-005--custom-ai-body-consumption-loses-cancellation-and-has-no-size-bound) | S2 / C3 / OPEN | [RG-004](REMEDIATION-GROUPS.md#rg-004) |
| [security/AUD-SEC-006](../security/DOMAIN-AUDIT.md#aud-sec-006--legacy-custom-key-may-bind-to-a-restored-replacement-endpoint) | S1 / C2 / INVESTIGATE | [RG-005](REMEDIATION-GROUPS.md#rg-005) |
| [ui-accessibility/AUD-UIA-001](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-001--standard-light-background-contrast-proof-uses-the-wrong-extremum) | S2 / C3 / OPEN | [RG-029](REMEDIATION-GROUPS.md#rg-029) |
| [ui-accessibility/AUD-UIA-002](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-002--backuprestore-primary-labels-use-a-failing-foreground) | S2 / C3 / OPEN | [RG-029](REMEDIATION-GROUPS.md#rg-029) |
| [ui-accessibility/AUD-UIA-003](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-003--enrichmentlayout-switches-bypass-active-theme-colors) | S3 / C3 / OPEN | [RG-030](REMEDIATION-GROUPS.md#rg-030) |
| [ui-accessibility/AUD-UIA-004](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-004--memory-switches-have-no-accessible-names) | S2 / C3 / OPEN | [RG-030](REMEDIATION-GROUPS.md#rg-030) |
| [ui-accessibility/AUD-UIA-005](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-005--custom-selectors-omit-current-values-and-selected-option-semantics) | S2 / C3 / OPEN | [RG-030](REMEDIATION-GROUPS.md#rg-030) |
| [ui-accessibility/AUD-UIA-006](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-006--independent-actions-fall-below-the-shared-touch-target-floor) | S2 / C3 / OPEN | [RG-030](REMEDIATION-GROUPS.md#rg-030) |
| [ui-accessibility/AUD-UIA-007](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-007--contact-row-accessible-summaries-omit-search-context) | S2 / C3 / OPEN | [RG-031](REMEDIATION-GROUPS.md#rg-031) |
| [ui-accessibility/AUD-UIA-008](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-008--review-cards-omit-selection-and-decision-evidence-from-their-accessible-representation) | S2 / C2 / OPEN | [RG-031](REMEDIATION-GROUPS.md#rg-031) |
| [ui-accessibility/AUD-UIA-009](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-009--widget-bitmap-actions-have-no-accessible-names) | S2 / C3 / OPEN | [RG-032](REMEDIATION-GROUPS.md#rg-032) |
| [ui-accessibility/AUD-UIA-010](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-010--fixed-heatmaps-exceed-available-narrow-screen-width) | S2 / C3 / OPEN | [RG-033](REMEDIATION-GROUPS.md#rg-033) |
| [ui-accessibility/AUD-UIA-011](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-011--shared-confirmation-actions-need-large-text-reachability-verification) | S2 / C2 / INVESTIGATE | [RG-034](REMEDIATION-GROUPS.md#rg-034) |
| [ui-accessibility/AUD-UIA-012](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-012--loadingread-failures-are-presented-as-empty-failed-or-still-running-inconsistently) | S2 / C3 / OPEN | [RG-035](REMEDIATION-GROUPS.md#rg-035); picker subclaim held by CF-02 |
| [ui-accessibility/AUD-UIA-013](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-013--ai-permissions-summary-confuses-filtered-results-with-actual-access) | S2 / C3 / OPEN | [RG-008](REMEDIATION-GROUPS.md#rg-008) |
| [ui-accessibility/AUD-UIA-014](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-014--backup-encryption-fields-lack-visible-identification) | S2 / C3 / OPEN | [RG-036](REMEDIATION-GROUPS.md#rg-036) |
| [ui-accessibility/AUD-UIA-015](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-015--contact-renderers-bypass-registered-font-family-mapping) | S3 / C3 / OPEN | [RG-031](REMEDIATION-GROUPS.md#rg-031) |
| [ui-accessibility/AUD-UIA-016](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-016--settings-children-render-duplicate-back-controls) | S3 / C3 / OPEN | [RG-037](REMEDIATION-GROUPS.md#rg-037) |
| [ui-accessibility/AUD-UIA-017](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-017--settings-directory-omits-specified-iconsnavigation-affordances) | S3 / C3 / OPEN | [RG-037](REMEDIATION-GROUPS.md#rg-037) |
| [ui-accessibility/AUD-UIA-018](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-018--explicit-timestamps-still-bypass-the-shared-presentation-contract) | S2 / C3 / OPEN | [RG-038](REMEDIATION-GROUPS.md#rg-038) |
| [ui-accessibility/AUD-UIA-019](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-019--reconciliation-cards-substitute-database-ids-for-contact-identity) | S2 / C3 / OPEN | [RG-031](REMEDIATION-GROUPS.md#rg-031) |
| [ui-accessibility/AUD-UIA-020](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-020--model-picker-does-not-identify-the-saved-selection) | S3 / C3 / OPEN | [RG-008](REMEDIATION-GROUPS.md#rg-008) |
| [ui-accessibility/AUD-UIA-021](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-021--profile-layout-preview-uses-incompatible-gapcolumn-geometry) | S3 / C3 / OPEN | [RG-033](REMEDIATION-GROUPS.md#rg-033) |
| [ui-accessibility/AUD-UIA-022](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-022--contacts-groups-whole-interactive-regions-as-accessible-elements) | S2 / C2 / INVESTIGATE | [RG-020](REMEDIATION-GROUPS.md#rg-020) |
| [ui-accessibility/AUD-UIA-023](../ui-accessibility/DOMAIN-AUDIT.md#aud-uia-023--closed-fab-actions-remain-mounted-without-accessibility-hiding) | S2 / C2 / INVESTIGATE | [RG-039](REMEDIATION-GROUPS.md#rg-039) |

## Input integrity

SHA-256 values recorded during synthesis; originals are checked unchanged during final validation.

Final validation passed: all local links and anchors resolve; all 43 groups contain the required sections; all 85 original records appear exactly once in the source index; 84 records map exactly once to groups and RN-013 maps to the preserved deferral; all eight packet hashes match. HEAD and tracked files remain unchanged. Only the three synthesis artifacts were added; application tests were not rerun for this documentation-only transformation.

| Packet | SHA-256 |
|---|---|
| architecture | `71af03b29527afbb90224e6b1082b5eb217afa69306d6856681f30eb517c282e` |
| data-privacy | `47c6c7c30c4dc003c84940106772337b2a528739f9e77a0d28454e84200f9750` |
| performance | `fdd86018a433d6f1b47f4a489e1eb939c6a252bdac93bd70fc1457f8564e4989` |
| react-native | `f32ffd8485ff6ba1dbae656a81a2a0b3362df65a88a300dff2ddb64a44217e3c` |
| release-readiness | `e33d179b8abb55ed93da987912f4413a48ed18b9e405521b18860013f675a1a3` |
| reliability-testing | `bd85a4aa4cfbbd4c0bc6a6a98657fb1a9f95c45976b6ef2f8ce007a787635430` |
| security | `6001d747bb4966aa173cc0a8de2a60969bfb2e3fd0088cd9aa337b4cf779410c` |
| ui-accessibility | `b26005d6be014f5dd6fc12d39cefdb501301e51109d1cec72f49715c6c4e5569` |
