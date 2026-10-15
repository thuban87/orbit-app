# ADR-198: Themed Dialogs Through One Imperative Host, an Overlay Registry, and Snackbars Above Overlays

**Status:** Accepted
**Date:** 2026-10-11
**Phase:** 38.9-ux-standards
**Source decisions:** D-24, D-27, D-40, D-43, D-51, D-52, D-72 (38.9-CONTEXT.md; ledger Q-01, Q-14, Q-18, Batch 7 OQ-3/OQ-4; phase code review WR-06); carried D-06, D-10
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-221 (partial)

## Context

The app mixed 101 native `Alert.alert` calls (25 two-button decisions, 76 error/info messages) with the themed `ConfirmDialog`, so it looked like two apps. Sheets and dialogs were RN `Modal` windows that registered nowhere, so nothing could tell whether "a dialog or sheet is open", and the root `<Snackbar />` drew under every Modal: an error fired from a sheet was never seen (audit A-13). Phase 39 needed an "overlay open" signal, and Back must never close a non-dismissable destructive confirm (ADR-086).

## Decision

The system uses one themed dialog family called imperatively: `await confirm({...})` resolves true/false and `await notice({...})` resolves on acknowledgement, through a FIFO queue in `confirm-store` rendered by one `DialogHost` mounted once in `App.tsx`. Resolutions are bound to the request id, and an identical pending request shares the first dialog instead of opening a second. The declarative `ConfirmDialog` stays for its existing consumers. Every decision Alert became a themed confirm; each error/info Alert became an error snackbar where the user can carry on, or a one-button notice where they are blocked. No production `Alert.alert` remains except the snooze Alert in `HomeScreen.tsx`, which 38.11 owns (D-10); an AST source contract enforces it. Dialogs are the elevated card with a 2dp `borderStrong` border (DLG-B); the "Discard changes?" prompt has no glyph above its title, only ⚠ on its Discard button, while other destructive confirms keep the glyph (D-52). Layout and non-dismissable destructive confirms are unchanged (D-06, ADR-174, ADR-086).

Every RN `Modal` goes through `RegisteredModal`, which registers in an overlay registry while visible. The registry has no close API and is separate from the shell dismiss stack, so Back or a tab re-tap (`dismissTop()`) can never close a registered dialog; `selectAnyOverlayOpen` is the Phase 39 signal. Each registered window hosts its own snackbar, and only the topmost window's host renders, so a snackbar fired from an overlay sits above it, at the bottom above the system navigation bar without the tab-bar/+ clearance, possibly covering a sheet's bottom buttons for its 6 s (D-40, D-51). Error snackbars look distinct: a `danger` outline, a warning glyph and an assertive announcement (D-72).

## Alternatives Considered

- **Theme all 101 Alerts as dialogs** — Rejected; non-blocking errors read better as snackbars (Q-01 option b).
- **Theme decisions only, keep native error Alerts** — Rejected; it leaves the two-app look (Q-01 option c).
- **Inline errors only, or snackbar-above-sheets only** — Rejected; the owner chose both (Q-14).
- **Reuse the shell dismiss stack as the open signal** — Rejected; `dismissTop()` would then reach a non-dismissable destructive confirm (D-24, ADR-086).
- **Snackbar inside overlays with the root's tab-bar clearance** — Not chosen (OQ-3).
- **Warning glyph above the discard prompt's title** — Not chosen; the mockup was kept (OQ-4).

## Consequences

### Positive

- One look and one call shape for every confirmation; overlay state is observable without being closable.

### Negative

- Every new Modal must use `RegisteredModal`; the unused `src/components/ui/Modal.tsx` primitive (ADR-086's Modal seam) was deleted, and BaseOverlay/RegisteredModal now fill that role.
- A handler whose `false` branch acts keeps its own in-flight guard, because a duplicate request resolves at once.

### Risks

- The TalkBack checks (focus on open, assertive error snackbar) were owner-deferred on 2026-10-11 and are not passes.

## Implementation

**Key files:**
- `src/stores/confirm-store.ts` — `confirm()` / `notice()`, the queue, id-bound resolution, duplicate collapse and `effectiveDismissable`.
- `src/components/ui/DialogHost.tsx` — the one host that renders the queue.
- `App.tsx` — mounts `DialogHost` once after the root Snackbar.
- `src/components/ui/ConfirmDialog.tsx` — the DLG-B card, notice variant and `headingGlyph`.
- `src/stores/overlay-registry-store.ts` — register/unregister and `selectAnyOverlayOpen` / `selectTopOverlayId`, with no close API.
- `src/components/ui/RegisteredModal.tsx` — the only RN `Modal` wrapper; registers while visible and hosts the in-window snackbar.
- `src/components/ui/overlay-base.tsx` — BaseOverlay on `RegisteredModal`, overlay kind and in-window snackbar placement.
- `src/components/Snackbar.tsx` — renders only in the topmost registered window or the root.
- `src/components/snackbar-host.ts` — host selection, in-overlay geometry and the error presentation (D-72).
- `src/no-native-alert-contract.test.ts` — app-wide AST ban on the native Alert API outside the snooze site.
- `src/components/ui/registered-modal-contract.test.ts` — every RN `Modal` import goes through `RegisteredModal`.
- `src/components/ui/Modal.tsx` — deleted; it had no importer.
- `src/screens/HomeScreen.tsx` — keeps the one snooze `Alert.alert` (D-10).

**Depends on:** ADR-086 (Semantic Icons and Accessible Interaction Primitives); ADR-174 (Fit-to-Width Heatmaps and Large-Text Reachability for Dialogs and Sheets); ADR-173 (Universal FAB Semantic Visibility, Open-Dial Containment, Non-Collapsable Shell Overlays, Border, and Bottom Clearance)
**Required by:** ADR-199 (App-Wide Destructive-Action, Feedback and Validation Standards, and One Empty State); ADR-200 (Unsaved-Work Guard in Route, In-Screen Sub-Editor and Overlay Variants); ADR-204 (One Themed Option Sheet Replaces Every Native Picker; Native Date and Time Pickers Stay)
