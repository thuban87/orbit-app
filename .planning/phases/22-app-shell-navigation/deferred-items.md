# Deferred Items

## Pre-existing ComposeScreen Biome findings

- `src/screens/ComposeScreen.tsx:72` — unused `AI_REQUEST_TIMEOUT_MS` import.
- `src/screens/ComposeScreen.tsx:604` — `noArrayIndexKey` for inspector truncation rows.

Observed while running Task 2's scoped formatter on 2026-09-02. Both findings predate
the navigation reset changes and are outside this plan's external-navigation scope.
