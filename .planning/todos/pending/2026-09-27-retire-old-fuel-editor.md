---
created: 2026-09-27T12:00:00.000Z
title: Retire the old Fuel editor — Create Contact, Edit Contact and Profile Off Limits use the new Off Limits entry editor (FAB → Update Contact → Off Limits)
area: ui
severity: minor
files:

  - src/components/FuelEditor.tsx
  - src/screens/CreateContactScreen.tsx
  - src/screens/EditContactScreen.tsx
  - src/screens/OffLimitsEditorScreen.tsx
  - src/screens/off-limits-editor-controller.ts
  - src/screens/off-limits-draft-adapter.ts
  - src/screens/UpdateContactScreen.tsx

source: 38.4 D-54 (owner, 2026-09-27); descoped from 38.4 Plan 21 (former Tasks 7-8, D-46)
---

## Problem

Off Limits entries are edited through two different editors:

- **New:** FAB → Update Contact → Off Limits (`UpdateContactScreen.tsx` `OffLimitsFocusedEditor`, ~:391). A list of
  topics (tap to edit, Remove), one text field and Add/Save. No Kind picker.
- **Old:** the general `FuelEditor` (`src/components/FuelEditor.tsx`), which shows a Kind picker (Recent / Topic / Fact /
  Gift idea / Off-limits) even though every write from these hosts is forced to `off_limits`. The picker is misleading,
  not unsafe.

The owner wants the old Fuel editor retired everywhere and every Off Limits entry point to use the new entry editor.

Live hosts of the old editor (verified on disk 2026-09-27; re-verify before planning):

| Host | Where | Notes |
|---|---|---|
| Create Contact | `CreateContactScreen.tsx` ~:777 (Show More → Off Limits) | kind-scoped to `off_limits` (ADR-131) |
| Edit Contact | `EditContactScreen.tsx` ~:1661 (Off Limits section) | kind-scoped; a DATA-LOSS guard comment at ~:32 explains the scoping |
| Profile → Off Limits | `OffLimitsEditorScreen.tsx` ~:86, the `OffLimitsEditor` route | reached from `ContactProfileScreen.tsx` ~:230 / ~:250 (`routeKnowledgeChild` / `routeKnowledgeAction`); registered in all five tab stacks (`src/navigation/types.ts`); `UpdateContact` exists only in the Dashboard stack, so a reroute would jump tabs |

Type-only importers of `FuelEditor`: `src/screens/off-limits-editor-controller.ts` (`FuelDraft`, `FuelEditPatch`) and
`src/screens/off-limits-draft-adapter.ts`. `src/components/control-a11y-contract.test.ts` reads `FuelEditor.tsx` source.

Nearby fuel files that are **not** Fuel-editor helpers (checked 2026-09-27, so they are not in scope by default):

- `src/components/RankedFuelLine.tsx` is the display-side promoted fuel line. Its only renderer is `ContactCard.tsx`, and the
  `ContactCard` component itself has no JSX consumer (only its `ringVisual` export is imported, by the Digest sections).
- `src/services/fuel-kind-label.ts` (`fuelKindLabel`) has no importer in `src/`.
- Both look like dead or near-dead code. Confirm that, and decide whether to delete them, as a separate question.

## Decisions this touches

- **ADR-150** chose "Off Limits uses a scoped `FuelEditor` wrapper" for the Profile action, and rejected a dedicated Off
  Limits editor model. Retiring the Fuel editor on that path **supersedes ADR-150's editor-UI choice** and needs a new
  ADR. Its safety half must stay: `off-limits-editor-controller.ts` filters reads to `off_limits`, forces the kind on add
  and edit, validates edit and delete ids against the scoped collection, reloads after each write, and its mixed-kind test
  guards that.
- **ADR-131** (progressive creation and complete-record editing) puts Off Limits on the Fuel editor in Create/Edit Contact.
  That part is superseded too.
- **ADR-081** retired only **AI-proposed** fuel. Fuel itself is live: Off Limits entries are stored as `fuel` rows with
  `kind = 'off_limits'`, so the fuel model, `fuel-dao.ts`, `fuel-read.ts` and the fuel kinds stay. ADR-107 (Off Limits
  never reaches AI) is untouched.
- 38.4 D-46 (superseded by D-54) holds the planner's earlier design: extract the Update Contact editor body into a shared
  presentational `OffLimitsEntryEditor`, render it on the `OffLimitsEditor` route through the existing scoped controller,
  and keep the route name and params.

## Solution

Plan it as its own phase or plan once the owner schedules it:

1. Extract the Update Contact Off Limits editor into a shared component. Keep Update Contact's own write path (source
   `manual`, the single-flight guard, `onSaved`).
2. Use it in `OffLimitsEditorScreen` behind the existing scoped controller, and in the Off Limits sections of Create and
   Edit Contact (Create's draft rows are committed inside `createContactFull`; Edit's go through its save coordinator).
3. Once nothing renders `FuelEditor`, retire it and move the draft types the off-limits modules import.
4. Write the ADR that supersedes ADR-150's editor choice and the relevant part of ADR-131.
5. Test-first. Pin with a contract that no Off Limits host imports `FuelEditor`, and keep the mixed-kind safety test green.
