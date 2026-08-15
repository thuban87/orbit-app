---
phase: 5
slug: photos
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-15
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (node env) — already present; DAO harness in `src/db/__testkit__/node-sqlite.ts` |
| **Config file** | `vitest` via `package.json` scripts (`test: vitest run`) |
| **Quick run command** | `npm test -- <file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10-20 seconds (node-pure suite) |

---

## Sampling Rate

- **After every task commit:** `npm test -- <touched test file>` + `npm run check:colors <touched file>`
- **After every plan wave:** `npm test` (full suite) + `npm run check:colors`
- **Before `/gsd-verify-work`:** full suite green + `check:colors` green
- **Max feedback latency:** ~20 seconds (node suite); native/UI paths are on-device UAT (Pixel, desktop-build pipeline)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | PHOTO-04(enable) | T-05-SC / T-05-01 | no CAMERA/RECORD_AUDIO in manifest; expo-pinned installs | config+manual | `npx tsc --noEmit` (+ Pixel rebuild UAT) | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | PHOTO-04 | — | swatch literals only in theme dir | unit+gate | `npm test -- src/theme/theme-presets.test.ts && npm run check:colors src/theme` | ❌ W0 (extend) | ⬜ pending |
| 05-02-01 | 02 | 2 | PHOTO-03 | T-05-02 / T-05-05 | derivable filenames, no user text; copy out of cache | unit | `npm test -- src/services/photos/photo-storage.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | PHOTO-03/05 | T-05-03(EoP) | `?`-bound; changes===1 guard | unit | `npm test -- src/db/photo-dao.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 3 | PHOTO-04 | T-05-07 | no colour output in logic | unit | `npm test -- src/components/avatar-initials.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 3 | PHOTO-04 | T-05-06/07 | tokens only; local file:// read | typecheck+gate (+UAT) | `npx tsc --noEmit && npm run check:colors src/components/Avatar.tsx src/screens/ContactProfileScreen.tsx` | n/a | ⬜ pending |
| 05-04-01 | 04 | 3 | PHOTO-01 | — | pure clamped geometry | unit | `npm test -- src/services/photos/crop-geometry.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-02 | 04 | 3 | PHOTO-01/03 | T-05-03/05 | 512px bound; no snapshot; no cache URI stored | typecheck (+UAT) | `npx tsc --noEmit` | n/a | ⬜ pending |
| 05-05-01 | 05 | 4 | PHOTO-01 | T-05-08 | shared-value transform, no setState/frame | typecheck+gate (+UAT) | `npx tsc --noEmit && npm run check:colors src/screens/CropPhotoScreen.tsx` | n/a | ⬜ pending |
| 05-05-02 | 05 | 4 | PHOTO-01/05 | T-05-01/05 | no camera/permission; inline delete on remove | typecheck+gate (+UAT) | `npx tsc --noEmit && npm run check:colors src/components/PhotoSourcePicker.tsx src/screens/EditContactScreen.tsx` | n/a | ⬜ pending |
| 05-06-01 | 06 | 5 | PHOTO-02 | T-05-02 / T-05-03 | https-only allowlist; one-time write path | unit | `npm test -- src/services/photos/url-image.test.ts` | ❌ W0 | ⬜ pending |
| 05-06-02 | 06 | 5 | PHOTO-02/01 | T-05-02 | SPEC error copy; self-photo via same pipeline | typecheck+gate (+UAT) | `npx tsc --noEmit && npm run check:colors src/components/PhotoSourcePicker.tsx src/screens/SettingsScreen.tsx` | n/a | ⬜ pending |
| 05-07-01 | 07 | 3 | PHOTO-05 | T-05-09 / T-05-02 | derive+delete from contactId post-commit, idempotent | unit | `npm test -- src/services/photos/purge-photo-cleanup.test.ts` | ❌ W0 | ⬜ pending |
| 05-07-02 | 07 | 3 | PHOTO-05 | T-05-09 | adapter registered; two-stage guard intact | typecheck+gate (+UAT) | `npx tsc --noEmit && npm run check:colors src/screens/ArchivedContactsScreen.tsx` | n/a | ⬜ pending |
| 05-08-01 | 08 | 5 | PHOTO-01 | T-05-02 | derivable cv- value; edit-only guard | unit | `npm test -- src/components/field-widgets/photo-field-logic.test.ts` | ❌ W0 | ⬜ pending |
| 05-08-02 | 08 | 5 | PHOTO-01/05 | T-05-02/05 | value via guarded upsert; inline delete; tokens | typecheck+gate (+UAT) | `npx tsc --noEmit && npm run check:colors src/components/field-widgets/PhotoFieldWidget.tsx` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Sampling continuity: every task has an `<automated>` verify (unit test, typecheck, or colour gate). No run of 3 consecutive tasks lacks an automated check.

---

## Wave 0 Requirements

Each test file is created by its owning task (tdd) before the implementation it covers:

- [ ] `src/theme/theme-presets.test.ts` — EXTEND: assert `avatarSwatches` non-empty + `avatarSwatchText` in every preset (PHOTO-04, plan 01)
- [ ] `src/services/photos/photo-storage.test.ts` — filename scheme + rel↔file:// resolve + target mapping (PHOTO-03, plan 02)
- [ ] `src/db/photo-dao.test.ts` — set/clear contact photo + profile set/clear/get vs real migration-1 (PHOTO-03/05, plan 02)
- [ ] `src/components/avatar-initials.test.ts` — getInitials + hash + swatchIndex determinism (PHOTO-04, plan 03)
- [ ] `src/services/photos/crop-geometry.test.ts` — transform → clamped source-pixel rect (PHOTO-01, plan 04)
- [ ] `src/services/photos/url-image.test.ts` — https-only allowlist + content-type→ext (PHOTO-02, plan 06)
- [ ] `src/services/photos/purge-photo-cleanup.test.ts` — derive+delete from contactId + surviving photo defs (PHOTO-05, plan 07)
- [ ] `src/components/field-widgets/photo-field-logic.test.ts` — derivable cv- value + edit-only guard (PHOTO-01, plan 08)

Framework install: none — Vitest + the `__testkit__` node-sqlite harness are already present.

---

## Manual-Only Verifications

On-device UAT on the physical Pixel (build+install+drive via `docs/runbooks/desktop-build-pipeline.md`). Native modules (picker, Skia, Reanimated, file-system) and render/perf are not assessable on this box or the desktop emulator.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Library picker launches with NO runtime permission prompt; no CAMERA/RECORD_AUDIO in manifest | PHOTO-01 | System Photo Picker + native manifest | Rebuild release APK; open edit → Add photo → confirm no permission dialog; inspect merged manifest |
| Skia crop pan/pinch is smooth; framed square matches the saved 512px master | PHOTO-01 | Skia render loop + crop-rect convention (A1) | Drive crop on the Pixel; compare framed region to the rendered avatar |
| Pick → crop → Use photo saves one ~30-60 KB 512×512 JPEG under `avatars/` | PHOTO-03 | Native manipulator + file-system | Set a photo; `run-as com.bwales.orbit` list `files/.../avatars`, check size/dims |
| Pasted https URL downloads once → crop → save; http/invalid shows the invalid-URL copy | PHOTO-02 | Native download + network | Paste an https image URL and an http URL; verify save vs SPEC error copy |
| Self-record photo set/remove from Settings "Your photo" | PHOTO-01 | Native + single-row DAO | Settings → Your photo → set → confirm render; Remove → confirm file gone |
| Remove photo deletes the old file inline; purge deletes contact + custom photo-field files | PHOTO-05 | Native FS unlink | Set then Remove (check file gone); archive→purge a photo'd contact, confirm `avatars/` entries removed |
| Custom `photo` field set via library + URL persists on Save; renders themed fallback when empty | PHOTO-01/05 | Native + form upsert | Add a `photo` custom field; set it on a contact; Save; reopen; purge and confirm cv- file removed |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s (node suite)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
