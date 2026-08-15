---
phase: 5
reviewers: [codex, claude]
reviewed_at: 2026-08-15
cycle: 3
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

---
---

# Cross-AI Plan Review — Phase 5 (Photos) — Cycle 2

Re-review after the cycle-1 replan (commit `3080eb1`). Two independent reviewers again: **codex**
(OpenAI codex-cli 0.144.1, run over the revised plans + source) and **claude** (read-only,
independent). Every cycle-1 finding was re-verified against the ACTUAL code on disk, and each plan's
claims were traced to the file:line it cites — not taken from the plan's own prose.

`reviewed_at: 2026-08-15` · `cycle: 2` · `plans_reviewed: [05-01..05-08]`

## Cycle-1 verification (both reviewers concur)

All four cycle-1 HIGHs and the actionable set are **RESOLVED in the plans AND consistent with the
real source**:

| Cycle-1 finding | Status | Disk evidence |
|---|---|---|
| **[HIGH] 05-08 prop contracts** (`onChange(null)`, `col_name`, widget `contactId`/`colName`) | **RESOLVED** | `types.ts:17` is still `onChange:(value:string)=>void`; `FieldValueInput.tsx:23` `FieldSpec` still excludes `col_name`; `EditContactScreen.tsx:608` `<FieldValueInput>` passes no `contactId` — 05-08 widens `onChange` to `string\|null`, adds OPTIONAL `col_name` (so `FieldDefForm.tsx:130` `previewField` + `setPreviewValue:335` and `CreateContactScreen.tsx:89` `Record<string,string\|null>` all still compile UNCHANGED — verified), and threads `contactId`+`colName` to the photo case only. |
| **[HIGH] 05-05 `form.photo` / EditFormState** | **RESOLVED** | `edit-contact-logic.ts:38-69` EditFormState has NO `photo`; 05-05 holds photo as SEPARATE screen state seeded from `getContactForEdit` (`contact-read.ts:96,106` ContactEditRow already carries `photo`+`modified_at`), leaving `edit-contact-logic.ts` correctly out of `files_modified`. |
| **[HIGH] contact/profile post-crop refresh** | **RESOLVED** | `ContactProfileScreen.tsx:21,32,59,73` already reloads via `useFocusEffect`→`getContactHeader`; 05-03 adds `photo`+`modified_at` to that header read; 05-05 adds a photo-ONLY `refreshPhoto` `useFocusEffect` to `EditContactScreen` (which today has mount-only `load` at `:143`, no focus effect) that does NOT reseed the form → unsaved edits survive. Serializable nav params only (no callback). |
| **[HIGH] 05-07 `listDefs` signature + quarantine leak** | **RESOLVED** | `field-defs-dao.ts:177-180` `listDefs(exec,{includeQuarantined:boolean})` is a required arg; 05-07 calls it with `{includeQuarantined:true}`, filters `type==='photo'`, and its test seeds a QUARANTINED photo def to prove the cv- file is deleted (PHOTO-05 quarantine window). |
| [MED] 05-02 copy-to-temp-then-rename + failure test | RESOLVED (with caveat, see below) | 05-02 action/behavior fully specify copy→tmp then rename-over + a mocked-FS failure-path test. |
| [MED] `resolvePhotoUriFromDocumentUri` pure seam | RESOLVED | 05-02 exports the pure `(documentUri, relative)` composer + thin `resolvePhotoUri` wrapper. |
| [MED] 05-06 final-URL/redirect + content-type SSRF | RESOLVED (with caveat) | 05-06 drops `downloadFileAsync` for `fetch`, re-validates the redirect-resolved `response.url` via https-only `isImageUrl`, requires `image/*`, caps size. |
| [MED] `getProfile` self-name source | RESOLVED | 05-02 adds `getProfile→{name,photo,modified_at}`; 05-06 uses it with a stable `'You'` fallback. |
| [MED] FS path-helper validation | RESOLVED (partial — see New MED-3) | 05-02 validates the filename BUILDERS (positive-int `contactId`, `isSafeColName`). |
| [MED] cacheBust via `modified_at` (stale-image-on-replace) | RESOLVED (with caveat — see New MED-1) | 05-03/05/06 thread `cacheBust={modified_at}` into `Avatar` `cacheKey`/`recyclingKey`. |
| [MED] 05-03 `contact-read.test.ts` | RESOLVED | declared in `files_modified`; asserts `photo` (rel + null) + `modified_at`. |
| [HIGH→MED] crop-geometry screen init | RESOLVED | 05-05 Task 1 specifies one-time init: intrinsic dims from decoded Skia image, viewport measure, `baseScale=viewport/min(srcW,srcH)`, shared-value seed; `crop-geometry.ts` header is the matching contract. |
| [LOW] 05-01 plugin dedupe-by-name + comment | RESOLVED | 05-01 dedupes plugins BY NAME before appending the tuple; updates the `9→11 tokens` doc comment. |

**Deferrals reviewed and judged reasonable:** (a) 05-08 keeps `depends_on:["05-03","05-04","05-05"]`
and does NOT add 05-06 — correct, since 05-06 is itself wave 5 and there is no compile-time coupling
(adding it would illegally push 05-08 to wave 6 for a purely integration-time relationship). (b) The
"add photo to EditFormState" cycle-1 suggestion was deliberately reworked to separate screen state,
with a sound rationale (keeps the metadata Save path / `buildEditInput` clean; photo writes through
its own dedicated DAO per 05-RESEARCH Pitfall 6).

**Non-negotiables (both reviewers, verified):** no new migration (`001-initial.ts:56,72` both `photo TEXT`
exist); DAOs in `src/db`, FS work post-commit (`purge-dao.ts:67,205`); tokenised colour incl. Skia
(`check-colors.sh` gate, swatches in `src/theme`); 512px master via `expo-image-manipulator`, never a
Skia snapshot; relative→`file://` at read only, no network on any read path; Reanimated shared values
for the crop (no per-frame setState); **acyclic wave graph with NO same-wave `files_modified`
collision** (wave 3 = 05-03/04/07 disjoint; wave 5 = 05-06/08 disjoint — confirmed by file scan).

## Codex Review (Cycle 2, full)

Verdict: **revise before execution.** 6 of 7 cycle-1 items RESOLVED; one STILL-OPEN (replacement
atomicity), plus 5 new concerns. (Full text preserved below.)

- **[codex / HIGH] Replacement is not transactionally compensated.** The new temp-first copy protects
  only against a *copy* failure, but persistMaster then explicitly deletes `dest` before
  `tmp.move(dest)` (`05-02-PLAN.md:101`), and the crop flow persists the file BEFORE the DAO write
  (`05-05-PLAN.md:102`); DAO failures are loud, normal paths here (`contacts-dao.ts:267`). A move/DAO
  failure can leave the DB path pointing at new bytes despite reporting failure, or leave no master.
  Keep the old master as a backup until the DAO/form write succeeds; restore on failure; test the
  move/DAO-failure compensation.
- **[codex / MEDIUM] Cache-bust not reliably unique.** The fix keys the image cache on `modified_at`
  (`05-03-PLAN.md:119`) but timestamps are second-resolution (`database.ts:41` `localDateTime` →
  `YYYY-MM-DD HH:MM:SS`). Two replaces in one second reuse the same stable path AND cache key → stale
  decode persists. Use a per-write revision token independent of the timestamp.
- **[codex / MEDIUM] Generic relative-path FS APIs accept unvalidated paths.** 05-02 validates the
  filename BUILDERS only; the exported generic `resolvePhotoUri`/`persistMaster`/`deletePhoto` take a
  raw `relative` string, and `photo TEXT` has no schema constraint (`001-initial.ts:61`). Add an
  allowlisted relative-path validator at the generic FS boundary and test traversal rejection.
- **[codex / MEDIUM] URL size cap trusts an optional/spoofable header.** 05-06 caps only
  `content-length` before reading (`05-06-PLAN.md:90`); a chunked or falsely-small response is read
  fully into memory. Enforce the cap while streaming, or reject absent/invalid `content-length`.
- **[codex / MEDIUM] Custom-field crop can orphan a file on Cancel/failed Save.** The crop screen
  persists the cv- file but does NO DB write (`05-05-PLAN.md:102`); 05-08 only updates in-memory form
  state, and values persist only inside the form's Save transaction (`contacts-dao.ts:301`).
  Navigating away or a failed Save leaks the `cv-*` bytes. Stage the file until Save, or add
  deterministic cancel/save-failure cleanup.
- **[codex / LOW] 05-08 should declare its behavioral dependency on 05-07.** It documents that
  custom-field purge cleanup is provided by 05-07 (`05-08-PLAN.md:52`) but omits it from `depends_on`.
  Adding `05-07` is graph-legal (it is wave 3, no file collision).

## Claude Review (Cycle 2, independent)

Verdict: **one HIGH worth an owner risk-posture call, else revise-lite.** I independently re-traced
every cycle-1 fix to disk and concur they are genuinely RESOLVED (table above). On the new concerns I
agree with codex's MEDIUMs and add mechanism corrections; I part company on the *framing* of the HIGH.

- **[claude / HIGH — concur, corrected mechanism] Replacement has an irreversible-loss window on
  crash — owner risk-posture call.** codex's DAO-centric framing is partly off: because the master
  path is STABLE and derivable (`avatars/contact-${id}.jpg`), a *DAO-write* failure after the file
  replace is NON-destructive — the DB path is byte-identical before/after and the new bytes ARE the
  user's just-cropped image; the only fallout is `modified_at` not bumping (a stale-decode cosmetic).
  The REAL hazard is inside `persistMaster` (`05-02-PLAN.md:101`): it **deletes `dest` before**
  `tmp.move(dest)`. If the process is killed between the delete and the move (or the rename fails),
  the prior master is gone, the new bytes are stranded at `*.tmp`, and there is NO launch-time sweep
  to reconcile — permanent loss with no backup, exactly the doctrine this project treats as sacred
  ("no server, no backup; treat every write as irreversible"). The plan's "compensate by re-attempting
  the move" does not survive a process kill. Cheap fix: NEVER pre-delete `dest` — use an atomic
  move/replace if `expo-file-system`'s `File.move` supports overwrite (confirm the `.d.ts`), OR
  rename `dest→dest.bak` then `tmp→dest` then delete `.bak`, with a launch-time `.tmp`/`.bak`
  reconciliation. **This is a risk/safety-posture decision (owner's bucket): the owner should decide
  whether the narrow crash window is acceptable or the .bak/atomic-replace fix ships.** Also: the
  stale "delete-before-copy" wording (New LOW-1) actively invites an executor to reintroduce the
  pre-delete.
- **[claude / MEDIUM — concur] Sub-second cache-bust collision.** Verified `localDateTime` is
  second-resolution; the cycle-1 stale-image fix therefore has a residual sub-second hole. A monotonic
  per-write counter or a random token as the `cacheBust` closes it.
- **[claude / MEDIUM — concur] Custom-field orphan on Cancel/failed-Save.** Confirmed values persist
  only in the form Save `inWriteTransaction`. Mitigating context worth recording: the cv- path is
  derivable and STABLE, so a re-crop overwrites the orphan and a later purge (05-07) cleans it — the
  leak is self-healing and bounded (~one 40 KB file), not permanent. Still worth a stage-until-save or
  a cancel-cleanup, but this is MEDIUM-bounded, not data corruption.
- **[claude / MEDIUM — concur] URL size cap.** Proportionate given user-initiated, write-path-only,
  evictable-cache download bounded by the 512px re-encode — but the plan's own claim to "bound DoS"
  is only as strong as a present, honest `content-length`. Stream-enforce or reject-absent.
- **[claude / LOW-1] Stale "delete-before-copy" phrasing contradicts the fixed design.** The
  copy-to-temp-then-rename rewrite left three stale phrases that still say the old, rejected approach:
  `05-02-PLAN.md:182` (success_criteria "persistMaster delete-before-copies into the document dir"),
  `05-05-PLAN.md:169` (T-05-05 "delete-before-copy on replace prevents orphan accumulation"), and
  `05-08-PLAN.md:172` (T-05-05 "delete-before-copy on replace"). Given the project's data-loss
  sensitivity, these should be corrected so no executor reintroduces the pre-delete.
- **[claude / LOW-2 — concur] 05-08 `depends_on` 05-07.** Semantic-accuracy only; graph-legal (05-07
  is wave 3). Optional.

## Consensus Summary (Cycle 2)

The cycle-1 replan **landed cleanly**: all four HIGHs and the full actionable set are resolved in the
plans and consistent with the real source, deferrals are sound, and every non-negotiable holds
(no migration, DAO placement, tokenised Skia, 512px manipulator master, local-first reads, shared-value
crop, acyclic collision-free wave graph). The phase is close to executable.

One item survives, and it is the same one both reviewers independently surface: **replacement
atomicity.** codex rates it HIGH on transactional grounds; claude concurs it is HIGH but relocates the
real hazard to the `persistMaster` pre-delete crash window (the DAO-ordering half is non-destructive
thanks to stable paths) and flags it as an **owner risk-posture decision** — the narrow window vs. the
cheap atomic-replace / `.bak`-reconcile fix. The remaining four MEDIUMs (sub-second cache-bust, generic
FS-path validation, URL size cap, custom-field orphan) and two LOWs (stale delete-before-copy wording,
05-08→05-07 dep) are small, largely proportionate hardening/clarity edits.

### Agreed concerns (2 reviewers) — priority order

1. **[HIGH] Replacement atomicity** — `persistMaster` pre-deletes `dest` before the rename; crash/failure
   window can irreversibly lose the prior master (no backup, no launch sweep). Owner risk-posture call:
   accept the window or ship atomic move-replace / `.bak`+reconcile.
2. **[MEDIUM] Sub-second cache-bust collision** — `modified_at` is second-resolution; use a per-write token.
3. **[MEDIUM] Custom-field orphan** on Cancel/failed-Save (self-healing + purge-cleaned, but a bounded leak).
4. **[MEDIUM] URL download size cap** trusts `content-length` (chunked/spoof bypass).
5. **[MEDIUM] Generic FS APIs** accept an unvalidated `relative` string (builders are validated; add a boundary guard).

### Codex-only

- [LOW] 05-08 add 05-07 to `depends_on` (graph-legal, wave 3).

### Claude-only

- [LOW] Stale "delete-before-copy" phrasing in 05-02:182 / 05-05:169 / 05-08:172 — correct the text so
  the rejected pre-delete is not reintroduced.

### Divergent views

Only on the HIGH's *mechanism/severity framing*, not its existence: codex frames it as a transactional
DAO-ordering failure (HIGH); claude shows the DAO half is non-destructive under stable paths and pins
the true irreversible-loss risk to the `persistMaster` pre-delete crash window (HIGH, and an owner
risk-posture decision). Both agree a plan change to `persistMaster` is warranted.

---

### Codex Cycle-2 raw output (preserved)

```
# Phase 5 review — revise before execution

`npx tsc --noEmit` passes on the current baseline. I reviewed the real source, not only the revised plans.

## Cycle-1 findings
- 05-08 prop contracts — RESOLVED (types.ts:17, FieldValueInput.tsx:23, EditContactScreen.tsx:608; 05-08-PLAN.md:133)
- 05-05 undeclared form.photo / reload — RESOLVED (edit-contact-logic.ts:38, EditContactScreen.tsx:143; 05-05-PLAN.md:134)
- Contact/profile refresh after crop — RESOLVED (ContactProfileScreen.tsx:73; 05-03-PLAN.md:120, 05-05-PLAN.md:135)
- 05-07 listDefs signature + quarantined purge leak — RESOLVED (field-defs-dao.ts:177; 05-07-PLAN.md:88)
- 05-03 missing header-read test coverage — RESOLVED (contact-read.ts:65, contact-read.test.ts:106; 05-03-PLAN.md:120)
- Crop-screen geometry initialization — RESOLVED (05-05-PLAN.md:100)
- Replacement safety on failed copy/DAO write — STILL-OPEN (05-02-PLAN.md:101, 05-05-PLAN.md:102, contacts-dao.ts:267)

## New concerns
- HIGH — replacement is not transactionally compensated (keep old master as backup until DAO/form write succeeds).
- MEDIUM — cache bust not reliably unique (modified_at second-resolution, database.ts:41).
- MEDIUM — generic relative-path FS APIs accept unvalidated paths (001-initial.ts:61).
- MEDIUM — URL size cap trusts optional/spoofable content-length (05-06-PLAN.md:90).
- MEDIUM — custom-field crop can orphan a file on Cancel/failed Save (contacts-dao.ts:301, 05-05-PLAN.md:102, 05-08-PLAN.md:131).
- LOW — 05-08 should declare its behavioral dependency on 05-07 (graph-legal, wave 3).

## Non-negotiable checks
- No migration needed (001-initial.ts:51). DAO placement correct; FS work post-commit (purge-dao.ts:205).
- Colour tokenised incl. Skia (check-colors.sh:37). Manipulator output not Skia snapshot; relative paths stored.
- Wave graph acyclic, no same-wave files_modified collision. Missing 05-08→05-07 dep is semantic, not a cycle/collision.
```

---
---

# Cross-AI Plan Review — Phase 5 (Photos) — Cycle 3 (final)

Re-review after the cycle-2 replan (commit `e8fb645`), which claimed all of cycle-2's **1 HIGH + 6
actionable** items shipped. Two independent reviewers again: **codex** (OpenAI codex-cli 0.144.1, run
over the revised plans + source) and **claude** (read-only, independent). Every cycle-2 item was
re-verified against the ACTUAL code on disk — including, this cycle, the **installed Android native
source** of `expo-file-system`, which turned out to be decisive.

`reviewed_at: 2026-08-15` · `cycle: 3` · `plans_reviewed: [05-01..05-08]`

## Headline: the HIGH is STILL-OPEN — and both reviewers independently verified why

The cycle-2 HIGH (replacement atomicity) was fixed on a **false premise**. The plan ships
`tmp.move(dest, { overwrite: true })` as the PRIMARY persist strategy, asserting it is a "single
atomic overwrite move" ("VERIFIED SDK-57 semantics"), and demotes the recoverable `.bak` swap to a
*conditional* fallback gated on "IF build-time verification shows `File.move(..,{overwrite:true})` is
NOT atomic". **It is not atomic on Android.** The installed `expo-file-system@57.0.4` native
implementation does **delete-then-rename**, verified on disk:

- `FileSystemPath.move()` → `file.moveTo(asCopyOrMoveDestination(overwrite))`
  (`node_modules/expo/node_modules/expo-file-system/android/src/main/java/expo/modules/filesystem/FileSystemPath.kt:174-187`).
- `CopyMoveStrategy.moveTo(spec)`: `val resolved = spec.resolve(file)` runs BEFORE `tryNativeMove`
  (`.../fsops/CopyMoveStrategy.kt:37-46`).
- `DestinationSpec.resolve()` delegates straight to `prepareAsDestination`
  (`.../fsops/DestinationSpec.kt:27-29`).
- `LocalFile.prepareAsDestination()` for an existing File→File target with `overwrite=true` calls
  **`it.deleteRecursively()`** — the prior master is DELETED during resolve
  (`.../fsops/CopyMoveStrategy.kt:88-91`) — and only THEN `tryNativeMove` does `file.renameTo(target)`
  (`:96-104`).

So a process kill between the delete and the rename leaves `dest` **gone** and the new bytes
stranded at `*.tmp`. Worse, the launch reconcile as specified would **complete the data loss**:
`reconcilePhotoDir` treats an orphan `*.tmp` as "delete it — the canonical dest is authoritative and
untouched" (`05-02-PLAN.md:108,116`), but here dest is NOT untouched — it was deleted — so the sweep
deletes the only surviving copy. Net: on a crash mid-replace the user loses BOTH the old photo and
the new crop (DB points at a missing file → Avatar falls back to initials). This is the exact
irreversible-no-backup loss the cycle-2 HIGH was raised to close, and the `.d.ts` the plan tells the
executor to verify against (`05-02-PLAN.md:92,114`) only exposes `overwrite?: boolean`
(`File.types.d.ts:17-23`) — it cannot reveal the native delete-then-rename, so an executor following
the plan literally would ship the unsafe path.

The `.bak` swap (currently the *conditional* fallback) IS crash-safe even under delete-then-rename,
because the destructive step becomes a *rename of dest → dest.bak* (preserving the prior master)
before `tmp → dest`, and the reconcile restores `.bak → dest` if interrupted. **The fix is to make
the `.bak` swap the UNCONDITIONAL, shipped strategy** (not gated on a `.d.ts` check that can't see the
truth), and to correct the plan's atomicity claims accordingly.

## Cycle-2 re-verification (both reviewers, verified against disk)

| Cycle-2 item | Status | Disk evidence |
|---|---|---|
| **[HIGH] Replacement atomicity** (persistMaster copy→tmp then `tmp.move(dest,{overwrite:true})` no pre-delete; `photo-reconcile-sweep.ts` on the Phase-2 registry; failure tests) | **STILL-OPEN** | Wiring is real and correct: `registerSweepHook(fn: SweepHook)` (`src/services/launch-sweep.ts:44-47`), `registerPhotoReconcileSweep` mirrors `registerFieldSweep` (`src/services/field-sweep.ts:83`), App.tsx registers it ready-gated under a one-shot guard beside `registerFieldSweep`, before `installSweepTrigger`, no timer (`App.tsx:73-83`; `05-02-PLAN.md:180-193`). **But the atomicity premise is false**: the shipped PRIMARY `tmp.move(dest,{overwrite:true})` is delete-then-rename on the installed Android impl (`FileSystemPath.kt:174-187`, `CopyMoveStrategy.kt:37-46,88-91,96-104`, `DestinationSpec.kt:27-29`), so it can still permanently lose the prior master; the `.bak` swap must be made unconditional. must_haves truth (`05-02-PLAN.md:22`) + T-05-10 (`:213`) still assert the atomic-overwrite move is safe. |
| **[MED] Per-write monotonic cache-bust token** (`photo-cache-bust-store.ts`) | **RESOLVED** | Net-new store with a per-path MONOTONIC counter (`05-03-PLAN.md:125-126`, not `Date.now`), folded into `cacheKey`+`recyclingKey`; contact/profile writes bump it (`05-05-PLAN.md:103`), custom-field writes bump it (`05-08-PLAN.md:137`). Justified by real second-resolution `localDateTime` (`src/db/database.ts:41-45`). |
| **[MED] Custom-field staged-file orphan cleanup** (staged ledger + reconcile on cancel/unmount, never deletes a saved photo) | **RESOLVED** | `markPhotoStaged`/`takeStagedPhotos` ledger (`05-08-PLAN.md:78,97,102`); teardown deletes only staged files NOT referenced by the COMMITTED values, keeps re-crop-in-place (equal→referenced→kept), "if uncertain DO NOT delete" (`05-08-PLAN.md:142`) — mirrors purge's "delete only files no committed row references" invariant; form value model is nullable + persists via guarded upsert (`EditContactScreen.tsx` / `field-values-dao.ts`). |
| **[MED] URL size cap stream-enforced / reject absent-invalid content-length + byteLength recheck** | **RESOLVED** | `fetch` (not `downloadFileAsync`); stream-abort at cap via `response.body.getReader`, fallback rejects absent/non-numeric/over-cap `content-length` up front AND re-verifies actual `byteLength` after read; redirect final-URL re-validated via `isImageUrl(response.url)` (`05-06-PLAN.md:86,90,99`). |
| **[MED] Generic FS boundary guard `assertSafeRelative`** (allowlist `avatars/<name>.<ext>`; reject `..`/absolute/backslash/nullbyte/bad-ext) on resolve/persist/delete + traversal test | **RESOLVED** | Private `assertSafeRelative` at the top of `resolvePhotoUriFromDocumentUri`/`persistMaster`/`deletePhoto`, allowlisted shape, independent of + additive to the builder throws; traversal test enumerated (`05-02-PLAN.md:106,112-113,118,125`); builder `col_name` guard reuses the real `isSafeColName` boundary (`src/db/col-name.ts`, `field-values-dao.ts:45-49`). (See New LOW re: null-byte test input.) |
| **[LOW] Stale "delete-before-copy" phrasing fixed everywhere** | **PARTIAL** | Fixed in all three flagged PLAN files (`05-02`/`05-05`/`05-08` now read atomic-overwrite-move / "never a pre-delete"; grep finds no stale phrasing in any `05-0X-PLAN.md`). STILL present in phase docs the plan directs executors to READ: `05-RESEARCH.md:13,59,169,300,483,497` and `05-PATTERNS.md:182` ("Delete-before-copy; store relative…"). Not PLAN.md, but actionable doc-hygiene — scrub alongside the HIGH replan since 05-02 read_first points executors at RESEARCH. |
| **[LOW] 05-08 `depends_on` includes 05-07** | **RESOLVED** | `05-08-PLAN.md:6` = `["05-03","05-04","05-05","05-07"]`; graph-legal — 05-07 is wave 3, so `max(3,3,4,3)+1 = 5` keeps 05-08 in wave 5, files disjoint (`purge-photo-cleanup.*`/`ArchivedContactsScreen.tsx` vs 05-08's set). |

## New concerns (Cycle 3)

- **[codex / LOW → claude concur] Null-byte test input missing from the boundary-guard test
  enumeration.** `05-02-PLAN.md:106,113,125` REQUIRE null-byte rejection, but the enumerated test
  inputs at `:118` (`../../etc/passwd`, `/abs/path`, `avatars/../secret.jpg`, backslash, bad ext) omit
  an explicit null-byte string. Add one so the required behavior is actually exercised.
- **[claude / note — not a plan change] `expo-file-system` is installed at a NESTED path**
  (`node_modules/expo/node_modules/expo-file-system@57.0.4`), not top-level — the atomicity truth is
  in its Android `.kt` sources, NOT the `.d.ts`. The plan's "confirm against the installed SDK-57
  `.d.ts`" instruction (`05-02-PLAN.md:92,114`) points at an artifact that cannot reveal the
  delete-then-rename behavior; the HIGH remediation should redirect that verification to the native
  source and record the finding so it is not re-derived wrong.

## Non-negotiable checks (both reviewers, verified)

| Check | Result | Evidence |
|---|---|---|
| PHOTO-01…05 coverage | PASS | Distributed across 05-01..08; ROADMAP §Phase 5. PHOTO-01 (05-05 library+crop, 05-06 URL, 05-08 custom), PHOTO-02 (05-06), PHOTO-03 (05-02/04 master), PHOTO-04 (05-03 initials), PHOTO-05 (05-07 purge + 05-05/08 remove/clear). |
| Acyclic graph, correct waves, NO same-wave file collision | PASS | Wave 3 (05-03/04/07) and wave 5 (05-06/08) have disjoint `files_modified` (frontmatter scan); all deps point to earlier waves. |
| Theme-token colours incl. Skia | PASS | `avatarSwatches`/`avatarSwatchText` in theme (`05-01`); Avatar + crop token-only, `check:colors` gate (`05-03:126`, `05-05:102`). |
| No network on read path; relative→`file://` | PASS | `resolvePhotoUri` yields local `file://` only; URL fetch is write-path-only (`05-06:86,90`). |
| 512px master via image-manipulator, not Skia snapshot | PASS | `05-04:40-42,109` — manipulate original URI, forbids `makeImageSnapshot`. |
| Reanimated shared values (no per-frame setState) | PASS | One-time init only; gesture/render via shared values (`05-05:101-103,110-113`). |
| DAOs in `src/db`; no new migration | PASS | `contacts.photo`+`profile.photo` pre-exist (`001-initial.ts:56,72`); dedicated writers mirror `archiveContact`'s `changes!==1` guard; `updateContactMetadataCore` verified to omit `photo`. |
| Proportionate threat model | **FAIL (the HIGH)** | T-05-10 (`05-02-PLAN.md:213`) mitigates the irreversible-write threat with the atomic-overwrite-move claim disproved by `CopyMoveStrategy.kt:88-91,96-104`. Fix rides with the HIGH. |

## Consensus Summary (Cycle 3)

The cycle-2 replan landed **5 of 6** actionable items cleanly (cache-bust, custom-field orphan
ledger, URL size cap, FS boundary guard, 05-08→05-07 dep) and all non-negotiables except the HIGH.
**But the HIGH — replacement atomicity — is STILL-OPEN, and both reviewers independently converged on
the same disk evidence:** the shipped PRIMARY `tmp.move(dest,{overwrite:true})` is delete-then-rename
on the installed `expo-file-system@57.0.4` Android implementation, so it retains the irreversible
prior-master-loss window the fix was meant to close, and the reconcile sweep would complete the loss.
The remedy is already written into the plan as the *conditional* `.bak` swap fallback — it simply must
be made the **unconditional, shipped** strategy, with the plan's atomicity claims (must_haves truth
`:22`, action `:107,114`, success_criteria `:127`, T-05-10 `:213`) and its verification target
(`.d.ts` → native `.kt`) corrected. Not yet executable.

### Agreed concerns (2 reviewers) — priority order

1. **[HIGH] Replacement atomicity STILL-OPEN.** `File.move({overwrite:true})` on Android LocalFile is
   delete-then-rename (`FileSystemPath.kt:174-187`, `CopyMoveStrategy.kt:37-46,88-91,96-104`,
   `DestinationSpec.kt:27-29`). Mandate the `.bak` swap unconditionally; fix the atomicity claims and
   redirect verification to the native source.
2. **[LOW] Null-byte input missing from the 05-02 boundary-guard test enumeration** (`:118`).
3. **[LOW] Stale "delete-before-copy" wording** in `05-RESEARCH.md` + `05-PATTERNS.md:182` (executor is
   directed to read RESEARCH) — scrub with the HIGH replan.

### Divergent views

None. codex rated the HIGH STILL-OPEN with a `FAIL` on the threat model; claude independently
re-traced the native Kotlin and concurs fully (correcting its own cycle-2 "RESOLVED with caveat"
lean — the caveat is now a confirmed defect). Both agree a real `05-02-PLAN.md` change is required
before execution.

### Codex Cycle-3 raw output (preserved)

```
## Verdict
**Revise before execution.** The replacement-atomicity fix is not valid against the installed Android `expo-file-system` implementation.

## Cycle-2 re-verification
- Replacement atomicity + reconcile sweep — STILL-OPEN. Plan specifies temp-copy, reconciliation, ready-gated registration, no timer (05-02-PLAN.md:114-118,180-193; launch-sweep.ts:44-47,92-115; App.tsx:70-83). But typings only promise overwrite (File.types.d.ts:17-23) while the installed Android impl deletes the destination before the move (CopyMoveStrategy.kt:88-103). tmp.move(dest,{overwrite:true}) can still lose dest; require the .bak swap unconditionally.
- Per-write monotonic cache bust — RESOLVED (05-03:125-126; 05-05:103; 05-08:137; database.ts:41-50).
- Custom-field staged-file orphan cleanup — RESOLVED (05-08:100-103,136-137,142-143; EditContactScreen.tsx:235-253; field-values-dao.ts:99-144).
- URL download size cap — RESOLVED (05-06:86,90,99).
- Generic FS boundary guard — RESOLVED (05-02:106,112-113,118,125; col-name.ts / field-values-dao.ts:45-49).
- Stale delete-before-copy wording; 05-08→05-07 dep — STILL-OPEN (dep fixed 05-08:6; stale guidance remains in 05-RESEARCH.md:13,59,169,300,483,497 and 05-PATTERNS.md:182).

## New concerns
- LOW — add an explicit null-byte input to the boundary-guard unit tests (05-02:118 omits it though :106,113,125 require null-byte rejection).

## Non-negotiable checks
- PHOTO-01…05 coverage PASS; acyclic/waves/no collision PASS; theme tokens incl Skia PASS; no network on read / relative→file:// PASS; 512px manipulator not snapshot PASS; Reanimated shared values PASS; DAOs in src/db, no migration PASS.
- Proportionate threat model FAIL — the high-risk irreversible-write mitigation relies on the false atomic-overwrite claim (05-02:213); the installed Android source disproves it (CopyMoveStrategy.kt:88-103).
```
