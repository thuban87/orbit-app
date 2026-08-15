---
phase: 5
reviewers: [codex, claude]
reviewed_at: 2026-08-15
cycle: 1
plans_reviewed: [05-01-PLAN.md, 05-02-PLAN.md, 05-03-PLAN.md, 05-04-PLAN.md, 05-05-PLAN.md, 05-06-PLAN.md, 05-07-PLAN.md, 05-08-PLAN.md]
---

# Cross-AI Plan Review — Phase 5 (Photos) — Cycle 1

Two independent reviewers: **codex** (OpenAI codex-cli 0.144.1, run over the plans + source)
and **claude** (read-only, independent). Every finding was verified against the actual code on
disk (per project rule "Review the code, not the diff"), not taken from either reviewer's summary.

Findings are tagged `[reviewer / SEVERITY]`. Severities: HIGH / MEDIUM / LOW.

---

## Verified strengths (both reviewers concur)

- **No new SQLite migration — correct.** `contacts.photo` (`src/db/migrations/001-initial.ts:72`) and
  `profile.photo` (`:56`) already exist as nullable TEXT; custom-field photo *values* reuse the
  existing Phase-3 `contact_custom_values` TEXT columns. No migration is added, correctly.
- **contactId-derivable filenames correctly reconcile with the post-commit purge hook.**
  `purgeContact` fires `onPurgeExtensions(contactId)` in a `.then()` AFTER commit
  (`src/db/purge-dao.ts:205-218`), when the `contacts`/`contact_custom_values` rows are already
  deleted — so a stored filename cannot be read. Rebuilding names from `contactId` alone is the
  right call, and the conscious supersession of the dossier's *uid* naming is valid (a
  "deferred to phase planning" item, not a decision reversal).
- **Dedicated photo DAO writers are warranted.** `updateContactMetadataCore`'s SET list
  intentionally omits `photo` (`src/db/contacts-dao.ts:244-272`); the profile single-row invariant
  (`id = 1`) is real (`001-initial.ts:51-59`). New `setContactPhoto`/`setProfilePhoto` mirroring
  `archiveContact` (`:403-419`, `changes===1` guard) is the correct shape.
- **Local-first reads preserved.** Avatar resolves a stored relative path to `file://`; the URL
  fetch is a one-time write-path event only. No network on any read path.
- **512px master via `expo-image-manipulator`, explicitly NOT a Skia `makeImageSnapshot`** (05-04).
- **Skia crop driven by Reanimated shared values via `useDerivedValue`, no per-frame `setState`**
  (05-05) — matches CLAUDE.md's render-loop rule.
- **All colours tokenised incl. Skia; `avatarSwatches` added to theme presets, not free HSL** (01/03).
- **Wave graph has no same-wave file-write collision.** 05-06 and 05-08 run parallel in wave 5 but
  touch disjoint files (PhotoSourcePicker only in 06; CropPhotoScreen only in 08). Shared files
  (PhotoSourcePicker, EditContactScreen, CropPhotoScreen) are edited in *different* waves, so
  sequential. Threat models are proportionate; the https-only allowlist is the right SSRF posture.

---

## Codex Review (full)

# Verdict: revise before execution

The set covers PHOTO-01…05 and correctly avoids a migration: `contacts.photo` and `profile.photo` already exist as nullable `TEXT` in migration 1 (src/db/migrations/001-initial.ts:51-82). The purge design also correctly follows the post-commit contract (src/db/purge-dao.ts:61-68, :178-218).

However, several implementation-critical paths are currently incomplete or unsafe. In particular, the crop screen lacks the geometry inputs it needs, the edit-screen photo state cannot compile as specified, and the custom-field remove flow cannot typecheck.

### Phase-wide concerns (codex)

- **[codex / HIGH] Crop cannot compute its rectangle from the planned route state.** Plan 04 defines `cropRectFromTransform({viewport, srcW, srcH, baseScale, scale, tx, ty})` but Plan 05 passes only `{rawUri, target, requestId?}` and never specifies how source dimensions, viewport measurement, initial cover scale, or pan bounds are derived. Add an explicit one-time image-load/layout init (intrinsic dims from the decoded Skia image, measure the square viewport, derive `baseScale`, init/clamp shared values). React state is fine for one-time init; only gesture updates must stay on shared values.
- **[codex / HIGH] Replacement destroys the existing master before the DB write and before copy success is known.** Plan 02 `dest.delete()` then `copy()` (05-02:97); Plan 04 invokes it before the caller updates SQLite. If copy or the DAO update fails, the DB still references a now-deleted/overwritten file. Suggestion: write to a target-specific temp file, validate the DAO write, then replace with compensation on failure; add failure-path UAT/tests.
- **[codex / HIGH] Custom photo purge must include quarantined field definitions.** `listDefs` requires an options arg and filters out quarantined defs unless `includeQuarantined: true` (src/db/field-defs-dao.ts:177-188). Plan 07's `listDefs(exec)` either fails to typecheck or leaks files for a quarantined former photo field, violating PHOTO-05. Use `listDefs(exec, { includeQuarantined: true })`, filter `type === "photo"`, test a quarantined photo def.
- **[codex / MEDIUM] Filename helpers trust `colName` with no runtime boundary check.** The existing dynamic-SQL boundary defensively calls `isSafeColName` (src/db/field-values-dao.ts:45-49). A public FS path helper should validate `contactId` (positive int) and `isSafeColName(colName)` inside `customFieldPhotoRelPath`/`relPathForTarget`, not only at UI call sites.

### Per-plan (codex)

- **05-01 — [codex / LOW]** Tuple plugin dedup is not guaranteed by the existing `Set`: `"expo-image-picker"` and `["expo-image-picker", options]` are distinct Set entries (app.config.ts:41-46). Normalize/filter plugins by name before adding the tuple. (Otherwise sound: modifying app.config.ts not app.json is correct; theme literals correctly centralized.)
- **05-02 — [codex / MEDIUM]** `resolvePhotoUri` is called "pure" but depends on `Paths.document.uri` with no injected argument or separate pure helper (05-02:96-100) — risks loading a native module in Node tests. Export a pure `resolvePhotoUriFromDocumentUri(documentUri, relative)` and keep the `Paths.document` wrapper separate. (Also inherits the HIGH delete-before-copy ordering.)
- **05-03 — [codex / LOW]** Update `contact-read.test.ts` as part of the plan: existing header tests assert the exposed fields (src/db/contact-read.test.ts:106-125); adding `photo` without a test (and without declaring the test file) leaves the read-contract change unverified.
- **05-04 — [codex / HIGH]** Geometry convention has no corresponding screen init/clamping contract (see crop finding); pipeline inherits the unsafe storage replacement order.
- **05-05 — [codex / HIGH] (most incomplete plan)** (1) `form.photo` does not exist — `EditFormState` has no `photo` (src/screens/edit-contact-logic.ts:37-69) and `seedEditState` never copies `result.contact.photo`; `edit-contact-logic.ts`+tests are not in `files_modified`. (2) A successful crop cannot refresh the edit surface — CropPhotoScreen writes its DAO then only `goBack()`; `EditContactScreen` loads only on mount (`:143-169`, function is `load` not `reload`) and the proposed `onChanged` callback can never reach CropPhotoScreen. The "avatar updates on edit surface" claim will not occur. (3) Crop prerequisites underspecified (no dimensional data for Plan 04). Suggestion: hold `photo` as separate targeted state in EditContactScreen, refresh only that on return via a result store/event keyed by target — do not reseed the whole edit form (would discard unsaved edits).
- **05-06 — [codex / MEDIUM ×3]** (a) Promises content-type validation without naming how headers are obtained from `File.downloadFileAsync` — name the SDK-57 return/header mechanism or split into a preflight `fetch`. (b) HTTPS validation covers only the submitted URL, not redirects — redirect policy / final-URL validation absent, so the "closing SSRF/cleartext" claim is incomplete. (c) Settings has no source for `selfName` and the profile DAO only reads `photo`; the seed supplies no name (001-initial.ts:226-231), so `name={selfName ?? ''}` yields a blank rather than a deterministic self fallback. Define `getProfile(exec): {name, photo}` or pass a stable fallback name.
- **05-07 — [codex / HIGH]** Quarantined photo fields leak unless `includeQuarantined: true` (see phase-wide). Otherwise strong: registers cleanup at the real call site (ArchivedContactsScreen.tsx:121-139), keeps FS work post-commit.
- **05-08 — [codex / HIGH ×2 + MEDIUM]** (1) `onChange(null)` conflicts with `FieldWidgetProps.onChange: (value: string) => void` (types.ts:13-24) and `FieldValueInputProps` (FieldValueInput.tsx:25-30); adding only `contactId` will not typecheck. (2) `field.col_name` is not in `FieldSpec` (Pick of type/label/options, FieldValueInput.tsx:22-24) and `colName` is not added to the widget prop contract. (3) [MEDIUM] Plan 08 claims URL support but does not `depends_on` Plan 06 (same wave) — UAT dependency undeclared. Fix: change both callback contracts to `(value: string | null) => void`, expand `FieldSpec` to include `col_name`, add `colName?` (or a photo-widget-specific prop), update widget tests, and declare `depends_on: ["05-06"]` if URL behavior is in 08's success criteria.

---

## Claude Review (independent)

Verdict: **revise before execution.** Coverage of PHOTO-01…05 and the ROADMAP goal (library picker
+ URL path, in-app Skia crop, 512px master, themed initials fallback) is complete across the 8
plans, and the data-layer reconciliations (post-commit purge, no migration, dedicated DAOs) are
correct. But four wiring/type gaps would fail the plans' own `tsc`/UAT gates, plus a
stable-filename ⇄ image-cache conflict none of the plans address.

### HIGH

- **[claude / HIGH] Plan 08 prop contracts cannot type-check as written, and the fix risks an
  undeclared file.** Confirmed on disk: `FieldWidgetProps.onChange` is `(value: string) => void`
  (`src/components/field-widgets/types.ts:17`) but Plan 08 requires `onChange(null)` for the
  customField Remove. `FieldSpec = Pick<CustomFieldDef, "type"|"label"|"options">`
  (`src/components/FieldValueInput.tsx:23`) has no `col_name`, yet the plan forwards
  `field.col_name`. The plan adds only `contactId?` to `FieldWidgetProps` — never the `colName` the
  widget needs to build `customFieldPhotoRelPath(contactId, colName)`. **And** if `col_name` is
  widened as *required* on `FieldSpec`, `FieldDefForm`'s `previewField = {type,label,options}`
  literal (`src/components/FieldDefForm.tsx:130-133`, no `col_name`) breaks `npx tsc --noEmit`, and
  `FieldDefForm.tsx` is NOT in 05-08 `files_modified`. Fix: widen `onChange` to
  `(value: string | null) => void`, add `col_name?` (optional) to `FieldSpec`, add optional
  `colName?` to the widget contract (photo is edit-only, so undefined → disabled) — this keeps the
  preview compiling without touching FieldDefForm. (Concurs with codex's two 05-08 HIGHs; adds the
  FieldDefForm breakage.)
- **[claude / HIGH] Plan 05 cannot compile/seed `form.photo`.** `EditFormState` has no `photo`
  property and `seedEditState` never copies it (`src/screens/edit-contact-logic.ts:37-69, 132-150`);
  `edit-contact-logic.ts` (+its test) is not in 05-05 `files_modified`. The plan's `photo={form
  photo}` implies an undeclared change. (Concurs with codex.)
- **[claude / HIGH] Contact & profile "avatar updates after crop" is unachievable as specified.**
  For a library/URL pick, the DAO write happens in `CropPhotoScreen`, which then only calls
  `goBack()`. `EditContactScreen` loads on mount only — no `useFocusEffect` (verified; unlike
  `ContactProfileScreen.tsx:67-77`, which does reload on focus). The `onChanged` refresh callback
  can never reach CropPhotoScreen (nav params are serializable, no callbacks). Only the customField
  path has a concrete cross-screen signal (`photo-result-store`); contact/profile have none. A core
  UAT criterion ("the avatar updates on the profile/edit surface") will not pass. Fix: give
  EditContactScreen (and SettingsScreen) a focus-reload, or extend the result-store publish/consume
  to the contact/profile targets. (Concurs with codex.)
- **[claude / HIGH] Plan 07 `listDefs(exec)` won't compile and can leak files.** Signature is
  `listDefs(exec, { includeQuarantined: boolean })` — a *required* arg
  (`src/db/field-defs-dao.ts:177-180`). Beyond the compile error, a contact purged while a photo
  custom field is quarantined-but-not-yet-expired would leak its `cv-` file if the adapter reads
  only non-quarantined defs → violates PHOTO-05 ("purge really means gone"). Use
  `{ includeQuarantined: true }`, filter `type==='photo'`, and seed a quarantined photo def in the
  test. (Independently found; concurs with codex.)

### MEDIUM / LOW

- **[claude / MEDIUM] Stale image cache on replace (not raised by codex).** The derivable filename
  is *stable* per target (`avatars/contact-${id}.jpg`), so `resolvePhotoUri` returns an identical
  `file://` URI after a replace. With `cachePolicy="memory-disk"` and `recyclingKey={contactId}`
  (05-03:116, 05-UI-SPEC:149, 05-RESEARCH:37), expo-image will serve the *cached decoded* image and
  the avatar won't visually refresh after "Change photo." The stable-filename requirement (forced by
  the post-commit purge) directly conflicts with URI-based cache invalidation, and no plan addresses
  it. Fix: vary `recyclingKey`/`cacheKey` by the contact/profile `modified_at`, or use a revalidating
  cache policy, in Avatar (03) and the replace flow (05).
- **[claude / MEDIUM] Plan 03 does not declare `contact-read.test.ts`.** Adding `photo` to
  `getContactHeader`'s returned shape (`src/db/contact-read.ts:65-86`) may break the existing
  header-shape assertion. Declare the test file and assert `photo` (a stored rel path and null).
  (Concurs with codex 05-03.)
- **[claude / LOW] Plan 01 theme-types comment drift.** `ThemePalette`'s "The 9 base dynamic
  tokens" doc comment (`src/theme/theme-types.ts:28`) becomes 11 after adding `avatarSwatches` +
  `avatarSwatchText`; update the comment when adding the tokens. (nit)

---

## Consensus Summary

Both reviewers independently reach **revise before execution**. The phase is architecturally sound
(coverage complete, no migration, purge/DAO reconciliations correct, no same-wave collisions), but
the *wiring waves* (05-05 and 05-08) carry several defects that would fail the plans' own
`npx tsc --noEmit` gate or the on-device UAT.

### Agreed concerns (2 reviewers) — highest priority

1. **[HIGH] Plan 08 prop contracts** — `onChange(null)` vs `(value:string)=>void`; `col_name` absent
   from `FieldSpec`; no `colName` on the widget contract. (claude adds: required-widening breaks the
   undeclared `FieldDefForm.tsx`.)
2. **[HIGH] Plan 05 `form.photo` / EditFormState / `edit-contact-logic.ts` undeclared** — won't
   compile or seed as written.
3. **[HIGH] Contact/profile post-crop refresh** — DAO write is in CropPhotoScreen (`goBack()` only);
   the initiating screen has no focus-reload and cannot receive `onChanged`.
4. **[HIGH] Plan 07 `listDefs` signature + quarantine leak** — required `{includeQuarantined}` arg;
   must include quarantined photo defs or leak files (PHOTO-05).
5. **[MEDIUM] Plan 03 `contact-read.test.ts` not declared / header-shape test.**

### Codex-only (worth adopting)

- [HIGH] Crop-geometry screen initialization is underspecified (obtain intrinsic dims from the
  decoded Skia image, measure the viewport, derive `baseScale`, init/clamp shared values). *(claude
  assessment: the data is obtainable on-screen, so MEDIUM-actionable rather than blocking, but the
  plan must specify it.)*
- [HIGH→MEDIUM] Delete-before-copy loses the prior master on a failed copy/DAO write (irreversible,
  no backup): copy-to-temp then rename-over with compensation; add a failure-path test.
- [MEDIUM] `resolvePhotoUri` "pure" seam — extract `resolvePhotoUriFromDocumentUri(documentUri, rel)`.
- [MEDIUM] Plan 06 URL download: name the content-type/header mechanism and add a redirect policy
  (validate the *final* URL, not just the submitted scheme) so the SSRF/cleartext claim holds.
- [MEDIUM] Plan 06 self avatar has no `name` source — add `getProfile(name, photo)` or a stable
  fallback name.
- [MEDIUM] Validate `contactId`/`colName` inside the FS path helpers (defense-in-depth).
- [MEDIUM] Plan 08 should `depends_on: ["05-06"]` if URL behavior is in its success criteria.
- [LOW] app.config `Set` won't dedupe a tuple vs string — normalize plugins by name.

### Claude-only (worth adopting)

- [MEDIUM] Stale image cache on replace (stable filename + `memory-disk` + `recyclingKey=contactId`).
- [LOW] theme-types "9 tokens" comment drift.

### Divergent views

None material. codex rated the crop-geometry-init and delete-before-copy as HIGH; claude rates both
MEDIUM-actionable (the geometry inputs are obtainable on-screen; delete-before-copy degrades to the
initials fallback and was a dossier interim recommendation). Both agree they need a plan change.
