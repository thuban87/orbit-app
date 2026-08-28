# Deferred Items

## 18.1-05

- `src/screens/ComposeScreen.tsx` has pre-existing Biome findings outside this plan's changed behavior: an unused `AI_REQUEST_TIMEOUT_MS` import and an array-index key in the AI inspector truncation list. The focused profile/Compose tests, TypeScript check, color check, and whitespace check pass; do not fold this unrelated AI cleanup into contact-method normalization.
- `state.update-progress` cannot recalculate the project-wide bar because the legacy global `STATE.md` body has no fully derivable phase scope. Plan 05's canonical plan counters were restored and advanced to 6/6; do not rework unrelated historical phase prose in this plan.
