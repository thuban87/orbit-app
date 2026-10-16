# Archived: Update Contact

**Archived in Phase 38.11 (Profile & Contact Forms UX). Reference only. Not production code.**

## What these files were

| File | What it did |
|---|---|
| `UpdateContactScreen.tsx` | The `UpdateContact` route, opened from the universal + ("Update Contact"). After a contact was picked it showed a compact chooser of rows (Last Talked About, Current Location, Key People, Memory, Off Limits, Contact Method, Contact Frequency, named custom fields and a generic Custom Fields path). Each row opened a focused editor; a successful save persisted on its own and returned to the chooser with the same contact, and the user left with Done. It owned the row save slot, the `EditorFrame` Cancel hold and the Back/Cancel discard guard over the open row. |
| `update-contact-chooser-logic.ts` | The pure chooser model: built-in rows, which custom-field definitions applied, the repeated-update session (target contact, open row, completed save, cancel, finish), the per-row dirty comparison and the editor close rule. |
| `update-contact-chooser-logic.test.ts` | Its vitest suite. |

The design was recorded in ADR-132 (Focused Rapid Capture Workflows) and the + action in ADR-082 (Universal Capture FAB, Canonical Picker, and Truthful Quick Log).

## Why it was archived, not deleted

- **38.11 D-62** (owner, ledger Q-23): Edit Contact is the single contact form. Update Contact leaves the universal +, its route is unregistered, and its screen, chooser logic and their tests move here. The owner's words: "move Update to the archived features area so we don't lose the code". This partly supersedes ADR-132 (the Update Contact chooser) and ADR-082 (the Update Contact + action). Quick Log and Log Interaction stay separate forms.
- **38.11 D-66** (owner, ledger Q-30): Memory left the + in the same change. The `Memory` add route itself stays live: the Profile's add-memory actions open it in every tab.
- The archive follows the 38.8 History Rolodex pattern (`docs/archive/history-rolodex/`).

## Status

- **No production imports.** Nothing under `src/` imports these files, no stack registers an `UpdateContact` route, and the route has no param-list key in `src/navigation/types.ts`. Metro bundles only what `src/` imports, so none of this ships.
- **Excluded from every tool, by directory (no per-file config):**
  - **tsc:** `tsconfig.json` `exclude` lists `docs/archive`.
  - **vitest:** `vitest.config.ts` includes only `src/**/*.test.ts(x)`, so `update-contact-chooser-logic.test.ts` is kept but never run.
  - **Biome:** `biome.json` `files.includes` has `"!docs/archive"`. The screen's own a11y override line was removed from `biome.json`.
  - **graphify:** `.graphifyignore` lists `docs/archive/`.
  - **check:colors** scans `src` and `App.tsx` only.
- **Not expected to compile.** The screen still types its props as `RootStackScreenProps<"UpdateContact">`, a route key that no longer exists, and its imports point at `src/` modules (`@/components/MemoryEditor`, `@/db/current-state-history-read`, `./section-editor-logic`, and so on) that keep changing. Read it; do not import it.
- **Shared code kept.** The DAOs, editors and helpers the screen used (`MemoryEditor`, `RelationshipEditor`, `OffLimitsForm`, `ContactMethodsEditor`, `FrequencyPicker`, `FieldValueInput` and the rest) are still used by other production code in `src/` and were left in place. The one exception is `getCurrentStateValue` (`src/db/current-state-history-read.ts`): at archive time this screen was its only production caller, but `contacts-dao.test.ts` still reads through it, so it was kept (38.11-02). `UpdateContactFullInput` is the Edit Contact DAO input type, not part of this screen, and is unaffected.
- **Contract tests retired with it.** The `src/` contract tests that read this screen from disk (editor Cancel, save hold, card edit mode) lost those blocks in 38.11-02; naming-only mentions in other tests and comments were left.
