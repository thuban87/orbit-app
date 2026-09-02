# Phase 14: AI Message Suggestions — Pattern Map

## File-to-Pattern Map

| Anticipated file | Closest local analog | Pattern to preserve |
|---|---|---|
| `src/db/migrations/004-ai-settings.ts` | `002-app-settings.ts`, `003-orrery-settings.ts` | New forward-only additive migration; all seed values bound; update runner/version tests, never edit shipped migration. |
| `src/db/app-settings-dao.ts` + tests | existing `AppSettings` mapping/update validators | Add non-secret fields to row mapping, `COLUMN_OF`, typed patch, read query, and pre-write validation in lockstep. |
| `src/services/ai-key-store.ts` + tests | Expo service wrappers / injected dependencies | Narrow provider-scoped SecureStore adapter; no SQLite/navigation/draft secret representation; mock at boundary. |
| `src/services/AiService.ts` + tests | current `AiProvider` adapters and mocked-fetch tests | One typed provider interface, explicit `response.ok`, `unknown` response parsing, sanitized errors; no prompt logging. |
| `src/db/ai-context-read.ts` + tests | `fuel-read.ts`, `impact-read.ts`, `field-values-dao.ts` | SQL provides the privacy boundary. Reuse ranked fuel projection; never select interaction note/detail; safe dynamic identifiers only. |
| `src/ai/prompt-template.ts` + tests | pure `*-logic.ts` services | Pure, deterministic resolver/limits/metadata. Tests assert exact inclusion/exclusion before UI/provider layers. |
| `src/components/FieldDefForm.tsx` + custom-field DAO/tests | existing metadata editor persistence | Thread existing `share_with_ai` schema flag through draft/form/metadata update; default false; preserve quarantine behavior. |
| `src/screens/SettingsScreen.tsx` | existing focus reload and guarded write helpers | Token-only ScrollView section, async error handling, persisted non-secrets, masked key entry and prompt inspector. |
| `src/screens/ComposeScreen.tsx` + pure logic tests | its existing state machine/send latch/copy timer | Compose owns request lifecycle and draft. Use fresh controller/request id, cleanup, no-write result path, and confirmation before overwriting non-empty draft. |
| `ContactProfileScreen.tsx`, navigation types | current Compose navigation | Add serializable `{contactId, requestAiSuggestion?: true}` intent; profile routes to Compose rather than owning result UI. |

## Cross-Cutting Rules

- All colours via `useTheme().colors.*`; `npm run check:colors` remains mandatory.
- Rules/DB invariants belong in pure functions/DAO tests; `.tsx` render and native SecureStore/fetch
  cancellation behavior require Pixel release-build UAT.
- `localDateTime()` stamps any allowed settings/field metadata write; generation itself must perform
  no contact, interaction, fuel, cache, export, or analytics write.
- The existing Compose archived/missing-contact guard and SMS/Copy semantics are load-bearing.
- Provider requests cannot trust TypeScript casts: parse `unknown`, bound text, and never surface
  error bodies or secrets.

## Planning Hazards

1. Dynamic fields need `col_name` identifier validation; do not interpolate labels or take a broad
   contact object shortcut.
2. New native dependency requires config review, clean Expo prebuild, release APK, and physical UAT.
3. Never use automatic retry after a transport failure; one provider may have accepted the billable
   request.
4. Prompt preview must use the exact same immutable resolved string that reaches the adapter.
5. Do not extend the legacy Markdown placeholder resolver; it is structurally incapable of enforcing
   this phase's outbound-data boundary.
