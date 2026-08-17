---
phase: 12
slug: home-screen-widget
status: passed
verified: 2026-08-17
method: on-device UAT (physical Pixel 6 Pro, release + debug builds) + full node suite (893/893)
---

# Phase 12 — Home Screen Widget · Verification

**Goal:** A favourites-grid widget with headless mark-contacted, status-colour avatars, and a
larger-tile action set — adding no new schema. **Verdict: PASSED** (on-device, owner-driven UAT),
with two owner-accepted follow-up device-checks (Phase-11-style closeout).

## How it was verified
- **Plan-quality gates (pre-exec):** plan-checker PASSED (18 hard-invariant + source-grounding checks);
  a 2-cycle cross-AI convergence (codex CLI + independent read-only Claude) that found and fixed **8 HIGH**
  concerns across cycles (WDG-03 freshness completeness, `orbit://favourites` reset, size-routed render,
  the reorder success-path publisher, the native boot receiver, the killed-app UAT build variant, …).
- **Automated:** `npm test` **893/893** green; `tsc --noEmit`, `check:colors`, biome clean throughout.
- **On-device (physical Pixel 6 Pro, serial 1A071FDEE002BU):** release + debug APKs built via the
  desktop pipeline (`droid`), driven with adb/uiautomator.

## Requirement verification (WDG-01/02/03)
| Req | Truth | Evidence |
|-----|-------|----------|
| WDG-01 | Favourites grid, static rank, **status-colour** base64 avatars, **no new schema** | On-device render (rings + base64 avatars + initials fallback); migrations unchanged (no migration added in any plan); `listDashboard({filter:'favourites'})` reused |
| WDG-02 | Headless mark exactly-once (DAO+mutex, `source='widget'`), name/chevron→Profile, larger tile Mark·Log·Message→Compose | **Killed-app mark independently verified in the device DB**: `source='widget'`, `outbound`, `connected=1`, distinct uids, `last_contact` recomputed → **no double-delivery, deterministic-uid backstop not required**. Deep-links (name/chevron→Profile+Back→dashboard; Message→Compose) verified. |
| WDG-03 | Event-push + launch/boot freshness (no polling), empty "Choose favourites", `requestPinWidget`, Back→dashboard JS nav | Empty state re-rendered live via event-push; **release tap-to-update ~0.6s** (0.620/0.594/0.626s — ~50× under the 30s budget; the ~20.5s debug figure was Metro-bundle-load, not representative); Add-widget pin prompt; 18 mutation-site publishers wired (reorder on the SUCCESS path). |

## Manifest hardening (regenerated on droid) — all asserted PASS
`allowBackup="false"`, portrait, `launchMode="singleTask"`, all prior plugins, `OrbitFavourites` provider,
**exactly one non-exported** widget `BOOT_COMPLETED` receiver (`.OrbitWidgetBootReceiver`, no duplicate of
the library's), `RECEIVE_BOOT_COMPLETED` permission.

## On-device UAT polish (owner-requested "polish pass")
- **"Message" button truncation → FIXED** (action buttons `width:"wrap_content"`); verified full label on the Pixel.
- **Default 4×2 placement now renders the LARGE layout** (`LARGE_MIN_WIDTH_DP` 300→280); verified on the Pixel.
- Both re-verified on a clean release rebuild (forced JS re-bundle so the fix is genuinely in the APK).

## Human-verification — owner-accepted follow-ups (NOT blockers)
Closed the phase with these deferred, mirroring the Phase-11 owner-accepted closeout:
1. **Reboot-receiver refresh** — requires a full reboot of the owner's work phone; deferred to the owner's convenience. (Force-stop → grey → manual-launch re-arm was observed.)
2. **Grid-capacity / bitmap-OOM ceiling** — needs ~15+ photo-bearing favourites; not testable on the sparse test device and not fabricated on the owner's phone. Bounded in code by the `pickLayout` capacity constants (`SMALL_CAPACITY=6`, `LARGE_CAPACITY=4`, device-tunable).

## Out-of-scope findings surfaced during UAT (NOT Phase 12 — recorded for follow-up)
- **No direct "add another contact" UI path.** The only `navigate("Create")` is `HomeScreen.tsx:411`
  (the zero-contacts empty-state button); after the first contact, the sole indirect create path is the
  Phase-10 share-sheet inline create. A **pre-existing Phase-8/10 UX gap** (verified by grep), likely masked
  by DB-injected test contacts. Worth a fix in a later phase/issue.
- **A debug-created DB does not load under a release build** ("Couldn't load your contacts"); a fresh
  release DB loads fine. Cross-build anomaly (root cause unconfirmed — possibly WAL/journal or a debug-only
  artifact). Flagged for awareness.

## Notes
- All work committed locally on `main` (44 phase commits); **nothing pushed** — owner pushes.
- The deferred **Phase-11 killed-app headless-mark device-check is now CLOSED** (verified live via the widget's identical headless path).
