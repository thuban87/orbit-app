# ADR-121: Rolodex Month/Day/Year History Browser (Reanimated, No Skia)

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 32-interaction-history-insights
**Source decisions:** HIST-08, HIST-09, HIST-18 from dossier §O, §P, §Q, §R, §S, §AA
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The conventional vertical timeline is replaced by a specialized date browser for precise chronological navigation. It needs three synchronized Month/Day/Year wheels with Day as the primary axis, conventional leap-aware invalid-date clamping, today as the maximum (no future browsing), pre-selection markers distinguishing interaction-bearing from lifecycle-only dates, a summary drawer that never auto-opens the detail sheet, full accessibility, and reduced-motion support — all without a per-frame `setState` or an undefined-on-device Hermes worklet crash.

## Decision

`RolodexBrowser` composes three wheels (Day primary); scrolling Day rolls Month/Year across boundaries via local-`Date` arithmetic, while Month/Year carry the year through modular month math. `clampDate` is the leap-aware conventional clamp (Aug 31 → Feb → 28/29; a 31st in a 30-day month → 30th) and `clampToToday` enforces today-as-max by `YYYY-MM-DD` string comparison; the Year wheel browses 30 years back capped at today's year. Each `RolodexWheel` is a Gesture-Handler pan driving a Reanimated shared `offset`, with per-row depth in one `useAnimatedStyle`; the committed selection is lifted to parent state only on settle (`runOnJS`) or a stepper press — never per-frame. Markers are silhouette-primary plain Views (filled dot = interaction, ring = lifecycle-only, filled + count = multiple) with counts/types in the accessibility label (no colour-only encoding), derived from `history-read`'s date markers. The drawer summary is lifecycle-inclusive and its explicit `See details` / `Log interaction` actions are the **only** path to the sheet. The browser owns the pause-on-blur lifecycle (`useIsFocused` + `AppState` + measure) and conditionally mounts the animated subtree; leaf wheels never infer focus. Reduced motion (read from `useReducedMotionShared().value` inside the worklet) flattens depth/inertia without removing navigation, and explicit +/- steppers give the non-gesture path. The optional Galaxy Skia glow is dropped so mechanics are identical across themes and no second worklet-forward-ref surface is introduced; the depth worklet is defined above its caller (Hermes forward-ref hazard).

## Alternatives Considered

- **A fourth Events column in the browser** — Rejected; a compact drawer beneath the wheels summarizes the selected date instead.
- **A Skia-drawn Galaxy wheel** — Rejected (UI-SPEC "MAY add"); it risks a colour-literal in a draw and a second worklet-forward-ref surface for no mechanical gain.
- **Per-frame `setState` on scroll / an animated settle snap** — Rejected; per-frame React updates crawl, and an animated snap races the offset reset against the async state commit, risking a visible double-count.
- **Auto-opening the detail sheet on scroll or selection** — Rejected; the sheet opens only from an explicit drawer action (HIST-09).
- **Colour-only interaction-vs-lifecycle markers** — Rejected; markers are silhouette-primary with counts/types exposed accessibly.

## Consequences

### Positive

- Precise date navigation with pre-selection markers, full keyboard/stepper and screen-reader paths, and reduced-motion support, all theme-token-driven.
- No per-frame re-render and no Skia surface keep the wheel cheap and free of the render-loop hazards.

### Negative

- Wheel feel (inertia, visible-neighbor count) is device-tuning only; it cannot be judged in vitest or the emulator.

### Risks

- A Reanimated worklet calling a helper defined later in the file crashes undefined-on-device on Hermes and vitest cannot catch it; the depth worklet is defined above its caller and device UAT confirmed no crash.

## Implementation

**Key files:**
- `src/components/history/rolodex-logic.ts` — pure `rollDate`/`clampDate`/`clampToToday`, `markerFor`, and `formatDrawerSummary`.
- `src/components/history/RolodexWheel.tsx` — one gesture-driven roller: shared-offset pan, single depth worklet, reduced-motion, steppers, silhouette markers.
- `src/components/history/RolodexBrowser.tsx` — three synchronized wheels (Day primary) plus the lifecycle-inclusive drawer; owns the pause-on-blur lifecycle and conditional mount.

**Depends on:** ADR-119 (Reusable Count-Only History Aggregation and Canonical History Read); ADR-085 (Live Reduced-Motion Signal for Skia Ambient Animation); ADR-086 (Semantic Icons and Accessible Interaction Primitives)
**Required by:** None
