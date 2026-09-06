# Deferred Items

## 2026-09-06 — DEBUG device UAT blocked by missing native dependency

- **Discovered during:** Plan 27-02 physical migration verification.
- **Evidence:** The current source imports `expo-web-browser` from `src/services/auth.ts`, but `npm ls expo-web-browser --depth=0` is empty. A fresh DEBUG APK rendered `Cannot find native module 'ExpoWebBrowser'` after Metro loaded.
- **Impact:** The app cannot finish startup, so the on-device `run-as` readback of `user_version = 20` and `dashboard_right_swipe_action = 'quick-log'` was not run.
- **Scope:** Pre-existing and unrelated to migration 020 / its DAO changes. Do not add or substitute a package without an owner-approved dependency change.
- **Tracking:** `.planning/WINDOWS.md` entry 35.
