# ADR-044: Headless Widget Actions and Dashboard-Rooted Deep Links

**Status:** Accepted
**Date:** 2026-08-16
**Phase:** 12-home-screen-widget
**Source decisions:** dossier `12-widget.md` Cluster B; 12-CONTEXT “Widget Interaction Affordances”
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

RemoteViews supports single taps, not a literal long press, while the small widget must keep mark-contacted inexpensive and un-undoable. Widget broadcasts are headless and bounded to roughly 30 seconds, yet every route must preserve Orbit's existing interaction history and Dashboard-rooted Back behavior.

## Decision

The small widget tile marks contacted through a headless task and exposes a distinct name/chevron profile link. The larger layout exposes Mark, Log, and Message; Log opens the existing Profile log surface and Message opens Compose. All accepted `orbit://` links are strictly parsed in JavaScript and reset navigation to Dashboard plus the target.

## Alternatives Considered

- **Literal long press for profile** — rejected because RemoteViews click regions are single-tap only.
- **Avatar mark with half-tile profile target** — rejected because too much of the tile would bypass the primary mark action.
- **Profile primary with an explicit mark icon** — rejected because it adds a tap to the intended fast action.
- **Message on every size or no Message action** — rejected because the small grid remains simple while the larger surface must support sending.

## Consequences

### Positive

- Widget marks retain the existing serialized recency write and users get consistent Compose/Profile destinations.

### Negative

- The layout must maintain separate mark and open regions rather than a gesture recognizer.

### Risks

- OS-delivered contact IDs and URIs are untrusted and must remain narrowly validated; the foreground sweep must never run in a headless widget task.

## Implementation

**Key files:**
- `src/services/widget/widget-mark.ts` — delegates the widget one-tap defaults to the existing recency writer.
- `src/services/widget/widget-task-handler.tsx` — validates widget clicks, bootstraps SQLite, commits the mark, and performs a best-effort rerender.
- `src/services/widget/widget-render.tsx` — assigns mark and `OPEN_URI` click regions for each widget layout.
- `src/navigation/widget-linking.ts` — strictly resolves allowed widget URIs and applies Dashboard-rooted resets.
- `App.tsx` — mounts the ready-gated widget linking bridge.

**Depends on:** ADR-010 (Single-Writer Interaction Recency Spine); ADR-019 (Native Stack Contact Lifecycle Navigation); ADR-023 (Structured Touchpoints and One-Tap Defaults); ADR-036 (Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails)
**Required by:** None
