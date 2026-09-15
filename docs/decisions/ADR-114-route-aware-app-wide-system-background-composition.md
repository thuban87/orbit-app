# ADR-114: Route-Aware App-Wide System Background Composition

**Status:** Accepted
**Date:** 2026-09-10
**Phase:** 31.1-app-wide-system-backgrounds
**Source decisions:** CONTEXT D-04–D-07, D-10–D-11, D-14–D-15, D-18–D-19, D-22–D-23
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The background renderer existed only at isolated mounts while opaque navigator scenes and screen roots hid it across production pages. App-wide adoption also needed deterministic readability tiers and explicit precedence for Profile, Orrery, and the System authoring canvas.

## Decision

The system uses one fixed shell-level `BackgroundHost` behind transparent navigation scenes and cooperating ordinary page roots. The deepest focused route selects presentation, comfortable, or dense treatment; only the actual Orrery route forces None/Solid, System Builder retains its opaque authoring canvas, and a resolved contact/Category/global Profile photo wins before Profile falls through to the selected System background.

## Alternatives Considered

- **Per-screen background hosts** — Mount and resolve a background independently on every page. Rejected because it duplicates precedence and fallback logic and cannot guarantee one fixed layer while content scrolls.
- **Exclude the entire Orrery tab** — Suppress the image by top-level tab. Rejected by the owner because ordinary browse routes must render identically regardless of which stack reached them.
- **Reveal the System Builder canvas** — Let the selected background sit behind its preview. Rejected by the owner because live app art would muddy the authoring canvas.
- **Uniform opacity across routes** — Apply one readability treatment everywhere. Rejected because browse surfaces should reveal art while forms, configuration, dialogs, loading, and error states need denser protection.
- **Direct-contact-only Profile precedence** — Ignore Category and global resolved photos. Rejected because precedence belongs to the already-resolved Profile presentation axis.

## Consequences

### Positive

- Ordinary screens share one fixed local background and remain visually consistent across navigation origins.
- Profile's independent photo-template hierarchy and specialized canvases retain their established behavior.

### Negative

- Every full-page wash and new route must cooperate with the shell host without making semantic surfaces transparent.
- Route classification is runtime shell state that must be seeded on navigation readiness and updated on navigation changes.

### Risks

- Android native-stack opacity or an unclassified state-branch wash can hide the image; physical-device route coverage is required.
- Removing the wrong `colors.background` use can weaken an input, dialog, or error surface rather than only the page wash.

## Implementation

**Key files:**
- `App.tsx` — applies the transparent navigation theme, synchronizes the focused route, and resolves status-bar contrast.
- `src/navigation/RootNavigator.tsx` — owns the single fixed shell host.
- `src/navigation/focused-route-classification.ts` — maps focused routes to density and the Orrery-only solid override.
- `src/theme/navigation-theme.ts` — makes navigator scene backgrounds transparent through the sanctioned theme boundary.
- `src/stores/focused-route-store.ts` — holds runtime-only deepest-route state.
- `src/components/ui/BackgroundHost.tsx` — renders the fixed local asset, veil, content, and safe fallback.
- `src/screens/HomeScreen.tsx` — provides the reference cooperating ordinary root.
- `src/screens/ContactProfileScreen.tsx` — owns resolved Profile-photo precedence and System fallback.
- `src/screens/OrreryScreen.tsx` — retains the specialized opaque visualization canvas.
- `src/screens/SystemBuilderScreen.tsx` — retains the owner-approved opaque authoring canvas.

**Depends on:** ADR-087 (Bundled Background Presets and Package-Specific Surface Treatment); ADR-113 (Persistent Shared System Background Selection)
**Required by:** ADR-115 (Visible Mode-Aware Background Surface Composition)
