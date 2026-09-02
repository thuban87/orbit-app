# Phase 5: Photos - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 13 (11 net-new, 2 modified) + 1 config
**Analogs found:** 10 / 13 (3 net-new-with-no-in-repo-analog: the Skia crop surface, the URL download, the crop geometry — all first-of-kind for this repo)

> Authority for the file list: `05-RESEARCH.md` "Recommended Project Structure" (lines 188-209) + Architecture Patterns 1-6, cross-checked against `docs/dossier/07-photos.md` and `05-UI-SPEC.md`. There is NO CONTEXT.md by design.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/photos/crop-geometry.ts` | utility (pure) | transform | `src/screens/create-contact-logic.ts` (pure `-logic.ts` convention) | role-match (pure/unit-tested) |
| `src/services/photos/url-image.ts` | service | file-I/O (write path) | legacy `~/projects/Orbit/src/utils/ImageScraper.ts` (reference only — re-port) | partial (no in-repo analog) |
| `src/services/photos/photo-storage.ts` | service | file-I/O | (net-new FS wrapper — no analog) + `col-name.ts` for whitelisting posture | partial |
| `src/services/photos/photo-pipeline.ts` | service | file-I/O / orchestration | `src/services/field-sweep.ts` / `launch-sweep.ts` (service orchestration) | role-match |
| `src/services/photos/purge-photo-cleanup.ts` | service | event-driven (post-commit) | `src/db/purge-dao.ts` `onPurgeExtensions` hook | exact (the hook it registers into) |
| `src/components/avatar-initials.ts` | utility (pure) | transform | `src/components/frequency-picker-logic.ts` / `tri-state-last-spoke-logic.ts` | exact (pure sibling-`logic` convention) |
| `src/components/Avatar.tsx` | component | request-response (render) | `src/components/field-widgets/PhotoFieldWidget.tsx` (theme-token component) | role-match |
| `src/components/PhotoSourcePicker.tsx` | component | event-driven | `src/components/field-widgets/*Widget.tsx` + `OverflowMenu.tsx` | role-match |
| `src/screens/CropPhotoScreen.tsx` | screen | event-driven (Skia/gesture) | (net-new Skia surface — NO in-repo analog) + `ContactProfileScreen.tsx` for screen scaffold | partial |
| `src/db/contacts-dao.ts` (MODIFY) | model/DAO | CRUD | `updateContactMetadataCore` / `archiveContact` in same file | exact (add sibling methods) |
| `src/db/profile-dao.ts` (NET-NEW) | model/DAO | CRUD | `src/db/contacts-dao.ts` (archive/restore single-column writers) | exact |
| `src/theme/theme-types.ts` (MODIFY) | config | — | the `danger` token addition (same file, lines 38-47) | exact |
| `src/theme/theme-presets.ts` (MODIFY) | config | — | the `danger: "#E5484D"` population (same file, line 31) | exact |
| `app.json` + `babel.config.js` (MODIFY) | config | — | existing `plugins: ["expo-sqlite","expo-status-bar"]` | n/a (additive) |

---

## Pattern Assignments

### `src/db/contacts-dao.ts` — ADD `setContactPhoto` / `clearContactPhoto` (DAO, CRUD)

**Analog:** same file — `archiveContact` (lines 403-419) and `updateContactMetadataCore` (lines 244-272).

**Why here:** RESEARCH Pitfall 6 (lines 406-410, VERIFIED) — `updateContactMetadataCore` writes every mutable column **except `last_contact` and except `photo`** (see the SET list, lines 249-252: no `photo`). The edit form therefore never persists the photo; a dedicated atomic writer is required, decoupled from the metadata save.

**Copy the single-column-writer shape from `archiveContact` (lines 403-419):**
```typescript
export function archiveContact(exec: SqlExecutor, id: number, now: string): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE contacts SET archived_at = ?, modified_at = ? WHERE id = ?",
      [now, now, id],
    );
    if (result.changes !== 1) {
      throw new Error(`archiveContact: no contact matched id=${id} (changed ${result.changes})`);
    }
  });
}
```
- New methods mirror this exactly: `UPDATE contacts SET photo = ?, modified_at = ? WHERE id = ?` (set) and `photo = NULL` (clear).
- **Assert `result.changes === 1`** and throw → rollback on a bad id (loud-failure guard — the repo-wide convention, used in every writer in this file).
- Store the **relative filename** in `photo` (never absolute, never a cache URI — RESEARCH Anti-Patterns, line 351).
- Every value `?`-bound; no interpolation (SECURITY T-04-02, module contract).
- **The inline old-file `File.delete()` on replace/clear is NOT in the DAO** — the DAO is node-pure (imports only `@/db/*`, no expo). The delete pairs with the DB write in `photo-pipeline.ts` / the calling screen. Keep the FS side effect out of the transaction (same reasoning as purge's post-commit hook).

---

### `src/db/profile-dao.ts` — NET-NEW (DAO, CRUD)

**Analog:** `src/db/contacts-dao.ts` archive/restore single-column writers (lines 403-443).

**Why net-new:** RESEARCH line 410 — "no profile DAO in src/db" (VERIFIED). The self/profile record is a separate single-row table (`profile.photo` TEXT exists, migration 001).

**Copy the module header + import + writer conventions verbatim from `contacts-dao.ts` (lines 40-58 pattern):**
```typescript
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
```
- `exec: SqlExecutor` as first arg (node-pure DAO convention — every DAO in `src/db/`).
- `setProfilePhoto(exec, relative, now)` / `clearProfilePhoto(exec, now)` and a `getProfilePhoto(exec)` read.
- Single-row table → the WHERE targets the single self row (confirm the profile row's key against `migrations/001-initial.ts`); assert exactly one row changed, same loud-failure guard.

---

### `src/services/photos/purge-photo-cleanup.ts` — NET-NEW (service, event-driven)

**Analog / registration target:** `src/db/purge-dao.ts` — the `onPurgeExtensions` hook (VERIFIED, the load-bearing finding).

**The hook signature (purge-dao.ts lines 61-68):**
```typescript
export interface PurgeOptions {
  onPurgeExtensions?: (contactId: number) => Promise<void> | void;
}
```

**When it fires (purge-dao.ts lines 205-218) — POST-COMMIT, only `contactId`:**
```typescript
}).then(async () => {
  try {
    await opts?.onPurgeExtensions?.(contactId);
  } catch (err) {
    Logger.error(LOG_SCOPE, `post-commit purge cleanup failed for contact id=${contactId} (best-effort)`, err);
  }
});
```

**The load-bearing constraint (purge-dao.ts module header lines 25-32 + fan-out lines 178-194):** by the time the adapter runs, the `contacts` row AND all `contact_custom_values` rows are **already deleted**. The adapter receives only `contactId` — it **cannot read the stored filename from the DB**. Therefore:
- **Filenames MUST be derivable from `contactId`** — `avatars/contact-${contactId}.jpg` for the main photo, `avatars/cv-${contactId}-${col_name}.jpg` for each custom photo-field file. A random-uid-per-file scheme is un-deletable on purge without an owner-level change to the Phase-4 adapter signature. (RESEARCH Pattern 6, lines 330-348; Pitfall 2, lines 384-389.)
- **Custom photo-field files:** `custom_field_defs` is a **global table and SURVIVES purge** (it is not in the fan-out delete list, lines 180-194). So read the surviving `type='photo'` defs and rebuild each derivable filename. Read pattern from `field-defs-dao.ts` `listDefs` (line 183: `SELECT * FROM custom_field_defs`); `col_name` and `type` are on `CustomFieldDef` (`field-types.ts` lines 31, 35).
- Each `File.delete()` is **idempotent** — a missing file is fine (best-effort, matches the try/catch-logged posture of the hook).
- **Registration:** the caller of `purgeContact` (the Archived-list purge screen from Phase 4/9) passes `{ onPurgeExtensions }`. Phase 4 passes none (header line 32) — Phase 5 supplies it.

---

### `src/components/avatar-initials.ts` — NET-NEW (pure utility, transform)

**Analog (convention):** `src/components/frequency-picker-logic.ts`, `tri-state-last-spoke-logic.ts` — the sibling-`logic`/pure-`.ts` + `.test.ts` node-tested convention (RESEARCH lines 472-473; these load in node Vitest, the `.tsx` cannot).

**Ported verbatim from legacy `~/projects/Orbit/src/components/ContactCard.tsx` (lines 22-42) — but the HSL output is BARRED:**
```typescript
// getInitials — ports VERBATIM (ContactCard.tsx:22-29):
function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
// hash — ports VERBATIM (ContactCard.tsx:35-38):
//   let hash = 0; for (...) hash = str.charCodeAt(i) + ((hash << 5) - hash);
// but the legacy `return hsl(hash % 360, 65%, 45%)` (line 42) is BARRED by CLAUDE.md
// and would FAIL check:colors (bans hsl()). Replace with an INDEX into the swatch array:
//   index = Math.abs(hash) % avatarSwatches.length
```
- Empty/whitespace name → blank swatch (index 0 or dedicated neutral), **no glyph** (dossier "Decisions made without you"; UI-SPEC Avatar states).
- This module returns `{ initials: string, swatchIndex: number }` — pure, no theme import; the component resolves index → token. (Keeps colour resolution in the component, geometry/hash in the tested module.)

---

### `src/components/Avatar.tsx` — NET-NEW (component, render)

**Analog:** `src/components/field-widgets/PhotoFieldWidget.tsx` (full file, 45 lines) — the theme-token-component shape.

**Copy the theme-token access + StyleSheet pattern (PhotoFieldWidget.tsx lines 10-30):**
```typescript
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";
// ...
const { colors } = useTheme();
// style uses { backgroundColor: colors.surface, borderColor: colors.border }
```
- **Has-photo state:** `expo-image` with `contentFit="cover"`, `cachePolicy="memory-disk"`, `recyclingKey={contactId}` (dossier; UI-SPEC Avatar). Resolves the stored **relative** filename → `file://` via the single `photo-storage.ts` helper (never a network URL — no network on read path).
- **No-photo / onError state:** themed swatch (`colors.avatarSwatches[index]`) + initials text (`colors.avatarSwatchText`, ~40% diameter, weight 700) — from `avatar-initials.ts`.
- Circular: `borderRadius = size / 2` (UI-SPEC Spacing).
- **All colours via `useTheme().colors.*`** — including the swatch and initials text; NO hex/hsl (check:colors gate, Pitfall 4).

---

### `src/components/PhotoSourcePicker.tsx` — NET-NEW (component, event-driven)

**Analog:** the `*Widget.tsx` family + `OverflowMenu.tsx` (button/action surfaces with theme tokens and 44px targets).

- Edit-only affordance (never on create form — dossier / 06-crud Cluster A).
- States per UI-SPEC "Photo source picker" table: "Add photo"/"Change photo" (accent), "Remove photo" (danger), "Paste image URL" input + "Add from URL" submit (44px).
- Launches `launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 })` (RESEARCH Pattern 1) — no permission request. Canceled → silent.
- Copy strings verbatim from UI-SPEC "Copywriting Contract" (lines 198-215).

---

### `src/screens/CropPhotoScreen.tsx` — NET-NEW (screen, Skia/gesture — NO in-repo analog)

**Analog for the SCREEN SCAFFOLD only:** `src/screens/ContactProfileScreen.tsx` (lines 21-77) — `RootStackScreenProps` typing, `useTheme`, `Logger`, `Alert` error surfacing.

**No analog for the Skia/Reanimated body** — `grep -rl "react-native-skia|reanimated|useSharedValue" src` returns **nothing**. This is the first Skia render-loop surface in the repo (the orrery, Phase 13, is later). Build from RESEARCH Pattern 2 (lines 228-263), honouring:
- **CLAUDE.md render-loop rule (non-negotiable):** transform driven by Reanimated **shared values**, read into Skia via `useDerivedValue`. NEVER `setState` per frame.
- Confirm → compute crop rect in **source-pixel coords** via the pure `crop-geometry.ts`, then hand to `expo-image-manipulator` on the **original URI** (never `makeImageSnapshot` — Anti-Patterns line 352).
- All Skia draw colours via tokens (`background`, `surface`-dim mask, `borderStrong` frame) — check:colors applies inside Skia calls (CLAUDE.md; Pitfall 4).
- Focused modal → the pause-on-blur rule is satisfied by construction (UI-SPEC).

---

### `src/services/photos/crop-geometry.ts` — NET-NEW (pure utility)

**Analog (convention only):** the `-logic.ts` pure modules. No behavioural analog — this is net-new math. Build from RESEARCH Pattern 2 `cropRectFromTransform` (lines 244-261). Keep pure + unit-tested (`crop-geometry.test.ts`, Wave 0); one on-device visual check (Assumption A1).

### `src/services/photos/url-image.ts` — NET-NEW (service, reference-port)

**Analog:** legacy `~/projects/Orbit/src/utils/ImageScraper.ts` (reference only — NOT vendored). Re-port **only** `CONTENT_TYPE_MAP`, `getExtensionFromContentType`, `getExtensionFromUrl`, and the `VALID_IMAGE_EXTENSIONS`/`DEFAULT_EXTENSION` constants. **DROP** `requestUrl` (→ `File.downloadFileAsync`/`fetch`), the wikilink return, `sanitizeFileName`/`resolveFilename` vault-conflict logic, `ensureFolderExists`, `createBinary` (no vault on mobile — HANDOFF §4). Pure `isUrl` + ext-map is the unit-tested part (`url-image.test.ts`, Wave 0). Error copy from UI-SPEC lines 210-213.

### `src/services/photos/photo-storage.ts` — NET-NEW (service, file-I/O)

**No behavioural analog** — first `expo-file-system` class-API user. Build from RESEARCH Pattern 4 (lines 281-305). This is the **single place** the relative↔`file://` mapping and the `contactId`-derivable filename scheme are observable (keep FS calls here so a signature drift is one-file — Open Question 1). Delete-before-copy; store relative, resolve `${Paths.document.uri}${relative}` at read.

### `src/services/photos/photo-pipeline.ts` — NET-NEW (service, orchestration)

**Analog:** `src/services/field-sweep.ts` / `launch-sweep.ts` — service-layer orchestration shape (module header + `Logger` scope + async orchestration). Orchestrates pick/download → crop → manipulate → persist → DAO write + inline old-file delete.

---

## Shared Patterns

### Node-pure DAO contract
**Source:** `src/db/purge-dao.ts` (lines 36-42), `contacts-dao.ts` (lines 48-58).
**Apply to:** `contacts-dao.ts` new methods, `profile-dao.ts`.
```typescript
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
// every DAO fn: (exec: SqlExecutor, ...) ; every value ?-bound; assert changes===1 → throw → rollback
```

### Post-commit OS side-effect hook (never inside the transaction)
**Source:** `src/db/purge-dao.ts` header lines 25-32 + lines 205-218.
**Apply to:** `purge-photo-cleanup.ts`, and the inline old-file delete on replace/clear.
Rationale: OS side effects (file unlink) must NOT be awaited inside the write mutex — non-transactional, non-rollbackable. Run post-commit, idempotent, best-effort try/catch-logged.

### Theme-token colour resolution (check:colors gate)
**Source:** `theme-presets.ts` (the ONLY hex-literal file, lines 10-34); every component reads `useTheme().colors.*` (PhotoFieldWidget.tsx line 15).
**Apply to:** `Avatar.tsx`, `PhotoSourcePicker.tsx`, `CropPhotoScreen.tsx` (incl. Skia draws), and the new swatch tokens.
The legacy `hsl(...)` avatar hash is barred here — swatch literals live only in `theme-presets.ts`.

### Adding a theme token (exact precedent)
**Source:** the `danger` token — declared in `theme-types.ts` `ThemePalette` (lines 38-47, with a doc comment) and populated in every preset in `theme-presets.ts` (line 31).
**Apply to:** add `avatarSwatches: readonly string[]` + `avatarSwatchText: string` to `ThemePalette` the same way, populate in `space-dark.dark` (8 swatches + text token, UI-SPEC recommended seeds lines 134-135). Extend `theme-presets.test.ts` to assert both present in every preset.

### Pure sibling-`logic`/`.ts` + node `.test.ts` convention
**Source:** `frequency-picker-logic.ts`, `create-contact-logic.ts` (header lines 1-22 explain the split — the `.tsx` imports react-native and cannot load in node Vitest).
**Apply to:** `crop-geometry.ts`, `avatar-initials.ts`, `url-image.ts` (pure parts), `photo-storage.ts` (filename scheme / rel↔uri).

---

## No Analog Found

Files with no behavioural in-repo analog (planner: use RESEARCH patterns + cited docs):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/screens/CropPhotoScreen.tsx` (Skia body) | screen | event-driven | No Skia/Reanimated/gesture-handler usage exists anywhere in `src/` yet — first render-loop surface. Scaffold analog only (ContactProfileScreen). |
| `src/services/photos/photo-storage.ts` | service | file-I/O | First `expo-file-system` class-API (`File`/`Paths`) user; package not yet installed. |
| `src/services/photos/url-image.ts` | service | file-I/O | Reference-port from legacy `ImageScraper.ts` (Obsidian-coupled); no mobile analog. |
| `src/services/photos/crop-geometry.ts` | utility | transform | Net-new crop-rect math; convention analog only. |

---

## Metadata

**Analog search scope:** `src/db/`, `src/components/`, `src/components/field-widgets/`, `src/screens/`, `src/services/`, `src/theme/`, and legacy `~/projects/Orbit/src/` (reference).
**Files scanned (read on disk):** `purge-dao.ts`, `contacts-dao.ts`, `theme-types.ts`, `theme-presets.ts`, `create-contact-logic.ts`, `PhotoFieldWidget.tsx`, `ContactProfileScreen.tsx`, `field-defs-dao.ts`, `field-types.ts`, legacy `ImageScraper.ts` + `ContactCard.tsx`; directory listings for role discovery; grep for Skia/Reanimated (none found).
**Pattern extraction date:** 2026-08-15
</content>
</invoke>
