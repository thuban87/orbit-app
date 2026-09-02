# Phase 36: AI Configuration & Prompting - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning (shim — phase pre-discussed externally; the dossier is the decision record)

<domain>
## Phase Boundary

Deliver Orbit's AI Configuration & Prompting subsystem: one coherent, connection-agnostic layer that supplies a reliable AI available / unavailable / needs-attention capability to Compose and the Contact Knowledge privacy model, and that owns connection and model setup, prompt assembly, personalization, permission administration, transparency surfaces, and privacy-safe diagnostics. AI is an optional capability layer — set-and-forget rather than a per-generation decision.

This phase was fully interrogated outside GSD (milestone-2 dossier process, amended per the 2026-09-01 cross-dossier audit). The dossier in canonical_refs is the authoritative decision record; this CONTEXT.md is a shim pointing at it, not a substitute.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and process
- **D-01:** Read the phase dossier (canonical_refs) IN FULL before planning. Where present, its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED] and [REJECTED] items are settled: reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask, never "fix" it.
- **D-02:** Read the phase planning-notes file (canonical_refs) as a binding appendix: every REPLAN finding must be reflected in the plan, and every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema (at least two migrations: the AI configuration model, and any remaining `app_settings` preference columns it owns). Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time (numbers drift every schema phase). Milestone order is schema → consumers → backup; the backup v4 bump is this phase's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.
- **D-03b:** Phase 36 owns the backup wire-format v4 bump as its **FINAL** plan, sequenced after every other schema-bearing phase in the milestone; it must serialize every entity and portable preference the milestone added, carry Phase 33's restore validation/orphan-repair rules, keep all credentials out (ADR-049), and give every retired portable key a decided restore-compat behavior.

### Phase-specific constraints
- **D-04:** ADR-049 is honored without exception: **API keys live only in SecureStore** and must never land in `app_settings` or in the backup (R-07 trip-wire). The `SECRET_SHAPED_KEY` screening that rejects key-shaped values stays in place, and a restored install must never falsely appear Ready without valid local credentials.
- **D-05:** ADR-051's egress guards are present with **no host allowlist**: adding one is additive and permitted; **removing a guard is not** (R-07 trip-wire). OpenRouter adds a new egress host and a browser-OAuth path — a security-posture item already decided in the dossier; do not widen it further without asking. LAN/private-network/local-model endpoints stay deferred and the private-address/SSRF safeguards are not casually removed.
- **D-06:** ADR-078 governs what may be transmitted (E-05, owner-ratified): AI-enabled Off Limits content is sent as **negative avoidance constraints**, never positive fuel; AI-disabled Off Limits items are never secretly transmitted; the contact's three most recent Interactions are included as a compact projection, with an interaction **note** included only when that interaction's Allow AI toggle is ON (a toggle-OFF note is withheld entirely while the rest of that interaction's structured context may still be sent). ADR-050 and ADR-036 are superseded by ADR-078 — confirm the superseding ADR before widening `PromptContext`, and treat any further widening as an owner decision.
- **D-07:** **Group Notes are never transmitted to AI**, regardless of any participant's Allow AI state, and never appear in the permission manager. This phase owns the type default for the per-interaction Allow AI toggle: **default OFF, new-items-only**, with interaction notes as a covered, reviewable, withdrawable type.
- **D-08:** ADR-079 governs transparency (E-06, owner-ratified): a **lightweight first-use disclosure** naming the active connection's real data path, with full prompt/context review available on demand — replacing ADR-052's exact-prompt first-send acknowledgement. The live gate is `ai-suggestion-logic.ts` with per-provider `ai_ack_*` columns (migration 004); the other half of E-06 is Phase 31's removal of the Profile AI-draft entry. No other disclosure behavior changes.
- **D-09:** The master toggle, three-lane multi-connection model, OpenRouter, Personalization Context, Writing Style, and permission defaults are **all unbuilt** (R-07) — verify on disk: there is no `ai_enabled` column (`provider='none'` is the sole disable), one SecureStore item per fixed provider with no bulk accessor, single `ai_provider`/`ai_model`/`ai_custom_*` columns, zero hits for openrouter/WebBrowser/AuthSession, a catalog that reads no pricing fields, and a prompt template that is a user "style note" in a fixed prompt.
- **D-10:** Enumerate in the plan **every** edit point that adding OpenRouter as a fixed provider touches (R-07): the closed `AiProviderId` union, a new `ai_ack_<id>` column, the exhaustive `never` switch in `acknowledgeProvider`, `PROVIDER_NAMES`, `token-budget`, and `CatalogProvider`.
- **D-11:** No silent substitution and no silent truncation: exactly one connection is active at a time, an unavailable model leaves AI in **Needs Attention** with explicit reselection guidance rather than falling back during generation, and an over-capacity request is reported explicitly and requires deliberate resolution. Failure diagnostics are sanitized — safe metadata only, and never contact names, methods, memories, interaction notes, Group Notes, Off Limits text, personalization or Writing Style text, Message Focus text, prompt bodies, credentials, raw request bodies, generated output, or raw provider responses.
- **D-12:** As owner of the v4 bump, verify the **whole milestone preference inventory** landed portably (R-16): theme package/accent/background, dashboard population/view/sort, right-swipe, orrery density/satellites/last-active System, History lens + cycle preset, Channel preference + remembered, Compose mode + remembered — plus this phase's own AI Enabled and permission type-defaults. Format 3's entity set omits duration, group events, orrery systems, profile templates, personalization, and memories/relationships/location (R-09); all must be serialized.

### Claude's Discretion
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decision record (ground truth)
- `docs/dossier/milestone-2/phase-16-ai-configuration-prompting-dossier.md` — the phase's full decision record; the 2026-09-01 amendment section (where present) overrides older text
- `docs/dossier/milestone-2/planning-notes/phase-16-planning-notes.md` — REPLAN findings, trip-wires, migration/sequencing constraints (binding appendix)

### Milestone context
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` — cross-phase seams, exported constraints (§6–7)
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` — milestone-wide decisions and watch items

### Decisions (ADRs)
- `docs/decisions/ADR-078-negative-constraint-off-limits-and-gated-recent-interaction-ai-context.md` — the transmission boundary: Off Limits as avoidance constraints, gated recent-interaction context, no Group Notes; supersedes ADR-050 and ADR-036
- `docs/decisions/ADR-079-on-demand-ai-transparency-and-compose-only-three-suggestion-invocation.md` — lightweight first-use disclosure with on-demand review; supersedes ADR-052
- `docs/decisions/ADR-049-byo-key-ai-configuration-and-credential-boundary.md` — credentials live only in SecureStore, never in `app_settings` or the backup
- `docs/decisions/ADR-051-public-https-custom-ai-egress-guard.md` — public-HTTPS-only custom endpoints and the private-address/SSRF egress guards

*(Optional local cross-check, gitignored and possibly absent: `docs/dossier/milestone-2/audit/LEDGER.md` — the audit's lossless decision ledger.)*
</canonical_refs>

<deferred>
## Deferred Ideas

See the dossier's [DEFERRED] and out-of-scope sections — they are boundaries, not gaps; do not plan them. Specifically do NOT build: an Orbit-hosted AI proxy, Orbit-funded shared keys, or any auth-backed AI service (AI stays BYO-connection); automatic model/provider fallback, multiple simultaneously active connections, or per-generation provider switching; an arbitrary HTTP API builder or LAN/local-model endpoints; per-contact persistent AI personalization documents; and a full app-wide Sentry installation — this phase establishes only the sanitized diagnostic seam.
</deferred>

---
*Phase: 36-ai-configuration-prompting*
*Context gathered: 2026-09-02 (shim; source: milestone-2 dossier set)*
