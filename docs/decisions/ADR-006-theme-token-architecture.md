# ADR-006: Theme-Token Architecture

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 01-project-scaffold-portable-code
**Source decisions:** SKELETON.md "Theme"; 01-03-SUMMARY; 01-REVIEW WR-01
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

CLAUDE.md forbids hardcoded colours anywhere in the app, including future Skia draw calls, and requires that changing the active theme profile restyle the entire app. The scaffold had to stand up the token architecture that guarantees this before any UI lands — without pre-empting the owner's later visual-design pass (HANDOFF §7), which owns the finished palette and any additional presets.

## Decision

Every colour resolves through theme tokens read via `useTheme().colors.*`. Hex literals live in exactly one file, `src/theme/theme-presets.ts`, which ships a **single space-dark preset** and the pure resolvers `resolveMode` / `resolvePalette`. The resolvers import no `react-native`, so they are node-testable in Vitest; the system colour scheme is resolved only at the app boundary via `useColorScheme()` and passed into `resolveMode`. A persisted Zustand store (`theme-store.ts`, key `orbit-theme`, AsyncStorage) **drives** the provider, so a rehydrated selection restyles the tree. A repo-wide gate, `scripts/check-colors.sh` (`npm run check:colors`), fails the build on any colour literal outside `src/**/theme/**`. `ThemePreset.light` is optional, so `resolvePalette` deterministically falls back to the dark palette — `light`/`system` are defined without shipping a finished light palette.

## Alternatives Considered

- **Inline colour values / `useColorScheme` in components** — Rejected. Hardcoded colours violate CLAUDE.md and defeat whole-app restyling.
- **Ship a full finished palette (light + multiple presets) now** — Rejected. The finished visual design is the owner's later call (HANDOFF §7); the scaffold ships infrastructure, not a committed palette.
- **Resolvers coupled to `react-native`** — Rejected. Coupling `resolveMode`/`resolvePalette` to RN would make the FND-05 behaviour (system/unspecified/light fallback) untestable in the node Vitest environment.

## Consequences

### Positive

- The token architecture the entire app — including future Skia draw calls — reads from is in place and enforced by a gate from phase 01 on.
- The pure resolvers are unit-tested (system → `useColorScheme`, `unspecified`/`null` → dark default) without an RN runtime.
- The owner can design the real palette later by editing one presets file; nothing downstream hardcodes colour.

### Negative

- Only a single dark preset exists; there is no real light mode until the owner's visual-design pass.

### Risks

- **The colour gate's `/theme/` exclusion is content-substring, not path-anchored (review WR-01).** `scripts/check-colors.sh` strips sanctioned matches with `grep -vE '/theme/'` against the whole `file:line:content` output, so a forbidden literal on a line that also contains the substring `/theme/` (e.g. a trailing comment) can evade the gate. Accepted for phase 01 (unlikely to trigger by accident); the documented fix is to anchor the exclusion to the path field (`grep -vE '^[^:]*/theme/'`). Harden when the gate is next touched.

## Implementation

**Key files:**
- `src/theme/theme-presets.ts` — the single space-dark preset (sole hex location) plus the pure `resolveMode` / `resolvePalette` resolvers (no `react-native` import).
- `src/theme/theme-types.ts` — `ThemeMode` / `ResolvedMode` / `SystemScheme` / `ThemePalette` / `ThemePreset` type unions.
- `src/theme/theme-provider.tsx` — `ThemeProvider` subscribes to the store and resolves `system` via `useColorScheme()`; `useTheme()` falls back to dark outside a provider.
- `src/theme/index.ts` — the `@/theme` barrel re-exporting provider, types, and presets.
- `src/stores/theme-store.ts` — the persisted Zustand store (`orbit-theme`, AsyncStorage) that drives the provider.
- `src/screens/HomeScreen.tsx` — the themed home shell reading every colour from `useTheme().colors.*`.
- `App.tsx` — wraps the shell in `ThemeProvider` + `SafeAreaProvider` with a themed `StatusBar`.
- `scripts/check-colors.sh` — the repo-wide no-hardcoded-colour gate (`npm run check:colors`).

**Depends on:** None
**Required by:** ADR-018 (Archive-Gated Contact Purge with Explicit Fan-Out); ADR-019 (Native Stack Contact Lifecycle Navigation); ADR-020 (Library-Only Photo Capture with Themed In-App Cropping and One-Time URL Download); ADR-022 (Tokenized Deterministic Initials Avatars)

---
