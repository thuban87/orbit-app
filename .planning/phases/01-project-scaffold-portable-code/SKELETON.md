# Walking Skeleton — Orbit

**Phase:** 1
**Generated:** 2026-08-14

## Capability Proven End-to-End

A themed Orbit home shell builds on the `droid` Windows desktop from rsync'd source and opens on the
wired Pixel 6 Pro through the commit → desktop-build → `adb install` loop — the full scaffold →
build → install → launch stack, proven once.

> Note: there is **no** database round-trip and **no** backend in this skeleton. Orbit is local-first
> with on-device SQLite arriving in Phase 2 and no server ever. The "end-to-end" the skeleton proves
> is the cross-machine build/deploy pipeline plus one real themed UI render — not a data path.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Expo SDK 57 (React Native 0.86, New Architecture always-on) | PROJECT.md pins SDK 57; reuse quest-board's RN patterns (HANDOFF §2). New Arch is default since SDK 55 — no flag. |
| Repo shape | Flat single app (`src/` at repo root) | Orbit is one app, not quest-board's npm-workspaces monorepo. The monorepo build hacks (patch-build-gradle, Metro watchFolders, packages/* aliases) are deliberately NOT copied. |
| Routing | Plain `App.tsx` entry, no expo-router | A single home shell needs no router. expo-router is added when navigation lands (Phase 4+). |
| Data layer | None this phase; on-device SQLite (`expo-sqlite`) in Phase 2 | Local-first, no backend ever. `expo-sqlite` is installed + registered as a config plugin NOW so the first prebuild covers it and Phase 2 needs no second native rebuild. |
| State | Zustand + `persist` → AsyncStorage | quest-board pattern; theme preference is the first persisted store. No network. |
| Theme | Token module (`src/theme`) with `useTheme()`; one space-dark preset | Every colour resolves through tokens — CLAUDE.md forbids hardcoded colours anywhere, including future Skia. Hex literals live ONLY in `theme-presets.ts`. Finished palette is the owner's later call (HANDOFF §7). |
| Auth | None — no accounts, no backend | Local-first product commitment (HANDOFF §3). |
| Deployment / build target | `droid` (Windows desktop) over SSH/Tailscale builds the debug APK; Pixel 6 Pro is the install target | This Linux box cannot compile Android APKs by hardware (2012 Ivy Bridge). Transport is rsync/scp — NEVER git push (global deny). |
| Lint/format | Biome 2.5.8 | Pinned; quest-board convention (single tool, version-pinned schema). |
| Test runner | Vitest for pure logic (node env, co-located `src/**/*.test.ts`) | The pure functions test without an RN runtime; the plugin's own suites are ported. RN-component testing deferred until there are components worth rendering. |
| Directory layout | `src/{theme,stores,services,schemas,utils,db,components,screens}` | CLAUDE.md repo layout. `@/*` tsconfig alias → `./src/*`. |

## Stack Touched in Phase 1

- [x] Project scaffold (Expo SDK 57, Biome, tsconfig strict + `@/*`, Vitest, portrait lock) — plan 01-01
- [x] Routing — one real route: the plain `App.tsx` home shell — plan 01-03
- [ ] Database — **intentionally none this phase** (local-first; SQLite is Phase 2). The skeleton's "real interaction" is the themed render, not a DB read/write.
- [x] UI — one interactive/rendered element wired to real infrastructure: the themed home shell reading `useTheme().colors.*`, with theme state in a persisted Zustand store — plan 01-03
- [x] Deployment — the debug APK built on droid and installed/launched on the Pixel through the documented pipeline (`docs/runbooks/desktop-build-pipeline.md`) — plan 01-05

Additionally (portable-code landing, part of Phase 1 scope but not the skeleton's happy path):
the ~350 lines of pure logic/types (`calculateStatus` + helpers, schemas, `formatLocalDate`,
`logger`) and the dormant `AiService.ts` port — plans 01-02 and 01-04. These are imported, not yet
surfaced.

## Out of Scope (Deferred to Later Slices)

- SQLite schema, `PRAGMA user_version` migrations, the single-writer `last_contact` DAO, the launch sweep → **Phase 2**
- Custom fields (two-table design, 7 parsers, `field_history`, quarantine) → **Phase 3**
- Any contact CRUD, profile, or UI feature → **Phase 4+**
- Wiring `AiService.ts` to a screen, provider keys in secure-store, HTTPS-only custom endpoint enforcement → **Phase 14** (it is ported dormant now)
- expo-router / navigation → added when the first multi-screen flow lands (Phase 4+)
- Skia, Reanimated, the widget module, share-intent, notifications → their owning phases (5, 10, 11, 12, 13)
- A finished visual palette / additional theme presets → the owner's visual-design pass (HANDOFF §7)
- `expo-dev-client` on-device hot reload → deferred; a plain debug APK proves the pipeline. Add it with the first native-only feature.

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural
decisions (flat repo, Expo SDK 57, theme tokens, Zustand persist, on-device-only, droid build loop):

- Phase 2: migration-1 SQLite scaffold + single-writer recency DAO + query-time status + launch sweep
- Phase 3: custom fields subsystem + field editor
- Phase 4: contact create/edit + archive/restore/purge + profile scaffold
- Phase 5: photos (Skia crop, 512px master, initials fallback)
- Phase 6: interaction log, status/impact, rogue, "Rarely responds"
- Phase 7: conversational fuel + ranked projection + cross-contact search
- Phase 8: dashboard (home) + never-contacted screen
- Phases 9–16: compose/SMS, share-sheet capture, notifications, widget, orrery, AI suggestions, weekly digest, backup/restore
