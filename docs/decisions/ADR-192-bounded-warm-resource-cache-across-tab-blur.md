# ADR-192: Bounded Warm Resource Cache Across Tab Blur

**Status:** Accepted
**Date:** 2026-10-05
**Phase:** 38.7-orrery-v2
**Source decisions:** D-58, D-79 (MEM-1) (dossier `phase-38.7-orrery-v2-dossier.md`)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

ADR-170 retires settled switch resources, so memory never grows with the number of switches. ADR-048 and ADR-077 keep one unmountable ambient clock that releases on blur and background. Tab return was slow in production and in every lab, because the canvas unmounts on blur and every return rebuilt photos, text and sky. Main took 6.72 s at Size 120.

## Decision

We will keep two lifecycles.

**The active render lifecycle stops on blur.** That covers the canvas, the ambient clock and the GPU surfaces, including the base bake. They stop and release on blur and background, as before.

**A warm cache survives an ordinary tab blur.** It holds CPU-backed objects only: decoded Orrery photo derivatives, `OrreryTextService` Paragraphs and CPU-baked sky/nebula images. It never holds GPU-texture-backed images.
- **Bounds.** `ORRERY_WARM_MAX_BYTES` 64 MiB, 128 Paragraphs and 4 sky images, with LRU trimming at the hand-off.
- **Release.** It is released on app background (either event order), after 5 minutes without a visit, and on a memory warning. Android RN emits no memory warning.
- **Safety.** It never pins anything. Disposal never touches an object a recorded picture still references.

**Tab return.** A warm return mounts on the retained snapshot, already at Home. Profile Back and background keep the session-restore path. The System Preview no longer clears the Orrery's warm entries.

**Relationship to other decisions.** This clarifies ADR-170, which stays fully in force. The cache is bounded by 38.6 D-11's flat-memory gate, measured with the 38.6 fixed method.

## Alternatives Considered

- **Keep everything forever across blur.** Rejected by D-58: a faster tab return must not become "the Orrery keeps everything forever".
- **Keep the canvas or clock mounted across blur.** Rejected, because it breaks ADR-077's unmount-on-blur and the cool-idle rule (D-40).
- **Rebuild everything on every return (the status quo).** Rejected as the main cause of the slow tab return.

## Consequences

### Positive

- Tab return at Size 120 is 0.451 s against main's 6.72 s. The All Contacts tab return is 1.008 s against a 1.0 s gate, accepted as a near miss (D-79).

### Negative

- At a blur the cache held 30.0 MiB of its 64 MiB. The cache is empty at a cold start and released on background. The measured Graphics/GL growth comes from the opaque canvas and the base bake, not the cache. The owner accepted it (MEM-1). TOTAL PSS fell 26–31 %.

### Risks

- A drawn warm photo may keep a GPU texture attached. `ORRERY_WARM_MAX_BYTES` is the lever if memory grows.

## Implementation

**Key files:**
- `src/components/orrery/resources/orrery-warm-cache.ts` — the one warm owner, its caps, LRU and release triggers.
- `src/components/orrery/resources/orrery-text-service.ts` — Paragraph entries held warm.
- `src/components/orrery/resources/orrery-photo-cache.ts` — photo derivatives held warm.
- `src/components/orrery/v2/nebula-bake.ts` — CPU-baked sky images held warm.
- `src/components/orrery/system-preview-resources.ts` — the Preview no longer clears warm entries.
- `src/screens/OrreryScreen.tsx` — warm tab return on the retained snapshot.

**Depends on:** ADR-170 (Bounded Your Week Reads and Settled Orrery Resource Retirement); ADR-077 (Single Canonical Orrery with a Constrained Inspection Camera); ADR-186 (Orrery V2 Imperative Picture Renderer Behind a Platform Render Host)
**Required by:** None
