# ADR-074: Widget Contact Supersession and Strict Reach Deep-Link Fail-Safe

**Status:** Accepted
**Date:** 2026-08-31
**Phase:** 21-interaction-assist-reach-out
**Source decisions:** dossier `21-interaction-assist-reach-out` clusters AE, AF, AG, AH, AB (navigation half)
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-044 (partial)
**Superseded by:** None

## Context

The larger home-screen widget's `Message` action deep-linked into Compose (ADR-044). Phase 21 introduces a shared Reach Out router, so a Message-only widget path would be an immediately-inconsistent communication surface. OS-delivered widget URIs are untrusted, and a deep-link target can be archived or purged between the widget render and the tap.

## Decision

The larger widget's `Message` action becomes `Contact`, emitting only `orbit://reach/<id>` into the shared in-app Reach Out router — the widget never writes an assist or interaction, it deep-links to the authoritative flow. The URI is parsed by an anchored `^orbit://reach/([0-9]+)$` allow-list with `Number.isSafeInteger`/`>0` and non-string rejection, resolving solely to Profile with a consumed-once `openReachOut` param (cleared via `setParams`). A discriminated lifecycle guard fails safe: a purged/missing target shows "This contact is no longer available." and resets to Dashboard, while an archived target is silently dropped, consistent with existing widget policy. Small-widget behavior, favourites, ranking, grid, quick-mark, and log actions are unchanged.

## Alternatives Considered

- **Leave the widget `Message → Compose` action (ADR-044)** — rejected because it would strand a single-channel path beside the new multi-channel router and immediately need revisiting.
- **Add per-channel Call/Text/Email buttons to the widget** — rejected; the widget keeps one `Contact` entry point and the shared router owns all channel selection.
- **Let the widget write assist rows** — rejected; a second assist writer would break the single-writer contract, so the widget only emits a URI.
- **Silently retarget or crash on a stale deep-link** — rejected in favor of a friendly message + Dashboard reset (missing) or a silent drop (archived).

## Consequences

### Positive

- Every reach-out surface (profile, Compose, widget) funnels through one router, and untrusted widget intents are narrowly validated before navigation.

### Negative

- Replacing the widget action is a costly, user-visible label/deep-link change and requires regression coverage of the unchanged quick-mark/log paths.

### Risks

- A method-less contact tapped via the widget resolves but opens no router; the `openReachOut` param can then linger unless cleared unconditionally (open robustness gap, review IN-02).

## Implementation

**Key files:**
- `src/services/widget/widget-render.tsx` — the larger tile's `Contact` action emits `orbit://reach/<id>` (the former `Message`/`orbit://compose` action is removed).
- `src/navigation/widget-linking.ts` — the anchored `orbit://reach/<id>` allow-list resolving only to Profile with the stale-target Dashboard fail-safe.
- `src/services/widget/widget-quick-action-guard.ts` — the discriminated missing/archived/ineligible guard outcomes.
- `src/screens/ContactProfileScreen.tsx` — consumes `openReachOut` once, then clears the param in the same focus effect.
- `src/navigation/types.ts` — declares the serializable consumed-once `openReachOut` route param.

**Depends on:** ADR-044 (Headless Widget Actions and Dashboard-Rooted Deep Links); ADR-043 (Static Globally-Mirrored Favourites Widget)
**Required by:** None
