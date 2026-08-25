---
phase: 17
slug: backup-export-restore
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-25
---

# Phase 17 — UI Design Contract

> Visual and interaction contract for Backup & Restore: automatic local backup health, manual
> export, backup settings, and previewed restore. It implements BKP-01…04 and the locked Phase-17
> context. The supplied landing-page mockup is the intended calm, dark space-themed hierarchy, not
> a pixel-for-pixel or bottom-navigation requirement.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — React Native / Expo, so the shadcn gate is not applicable |
| Preset | not applicable |
| Component library | none — bespoke React Native primitives and in-repo components |
| Icon library | none — use the app's established text glyph / simple RN-icon treatment; do not add a package for this phase |
| Font | System default; retain the system typography used by existing screens |
| Colour source of truth | `src/theme/theme-presets.ts`, shipped `space-dark` palette. No colour literal in implementation outside that source. |
| Navigation | Additive native-stack routes: `Backup`, `BackupSettings`, `RestorePreview`; temporary Dashboard entry only. No bottom navigation implementation. |
| Existing patterns | `useTheme()`, `useFocusEffect` with cancellation guard, `Pressable`, native `Alert` confirmations, themed `Modal`/sheet, and 44px minimum targets. |

All phase-owned screen roots use `colors.background`; cards and rows use `surface` with a `border`
outline. Reuse the app's native-stack convention of `headerShown: false` and in-screen Back control.

---

## Screen Anatomy

### Backup & Restore landing (`Backup`)

The permanent health-and-action surface is a vertically scrollable screen, in this fixed order:

1. In-screen Back control and `Backup & Restore` page title.
2. **Health hero:** one large `surface` card, with a state icon/status dot, short state headline,
   last successful automatic-backup detail, destination/retention detail when available, divider,
   and a single row affordance. It is the visual anchor; do not add charts, progress history, or
   a backup scoreboard.
3. **Two equal action cards:** `Export now` and `Restore a backup`, each icon above a heading and
   one-line helper. At narrow widths the cards remain two columns only when each retains a 44px
   target and readable labels; otherwise stack vertically.
4. **Encryption row:** compact full-width `surface` row, lock glyph, current status and short
   explanation, chevron → `BackupSettings` encryption section.
5. **Privacy note:** subdued shield icon plus: `Backups include your contacts, notes, photos, and
   settings. API keys are never included.` It is static reassurance, not a CTA.

The mockup's large title, protective hero, paired actions, encryption row, generous dark-space
background, and quiet footer define hierarchy. Do not implement its illustrated planet art or its
shown bottom navigation in this phase.

### Backup settings (`BackupSettings`)

One scrollable configuration screen reached from the hero's `Manage backups` row. Use grouped,
outlined settings rows in this order:

1. **Automatic backups:** folder row (`Choose backup folder` / selected folder summary / `Change
   folder`), cadence integer input, and retention integer input. Automatic backup is explicitly
   foreground-only; helper copy must never imply clock-exact or background scheduling.
2. **Encryption:** status row and setup/change/forgotten/disable flows below. Do not show a
   passphrase hint or the stored passphrase.
3. **About automatic backups:** helper `Orbit writes a new backup after you open the app when
   your schedule is due and your data has changed.` This is informational, not an active status.

### Restore (`RestorePreview`)

The Restore action opens the Android file picker; it never applies a backup directly. After an
encrypted-file passphrase prompt, full decrypt/parse/validation, and forward migration succeed,
show a dedicated scrollable preview with:

- source date, format version, encryption status, and aggregate counts (contacts, related rows,
  photos, and tombstones), with no personal names or per-record audit;
- a `Merge` choice selected by default, with its concise reconciliation explanation;
- a `Replace all` choice marked destructive, with its impact summary;
- a final primary action whose label reflects the selected mode.

Keep a visible Back/Cancel path through selection and preview. During the actual apply, use a
non-dismissable progress treatment; after it resolves, replace it with the success state or return
to the correct recoverable step. Restore always returns to the Backup landing once dismissed.

---

## Spacing Scale

All new layout measurements are multiples of four and follow the existing screen/card conventions.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Status-dot/icon-to-label and inline helper gaps |
| sm | 8px | Compact card/row internals and paired-action gutter |
| md | 16px | Default page inset, row/card padding, action-card internal spacing |
| lg | 24px | Separation between hero, action group, encryption row, and privacy note |
| xl | 32px | Top breathing room below page header and compact empty/error blocks |
| 2xl | 48px | Major break before a standalone restore outcome |
| 3xl | 64px | Only for the landing's page-level visual breathing room; not required on short screens |

Exceptions: every pressable row, action card, Back control, checkbox/radio row, and icon-only
control has a **44px minimum touch target**. Use 8px radius for inputs/compact controls, 10px for
cards and rows, and 12px only for a modal/sheet; these match existing app geometry. The hero may
use its existing-card 10px radius; no new oversized-radius design language is introduced.

---

## Typography

This phase uses exactly four sizes and two weights; no custom font, bold (700), or all-caps backup
labels are introduced. Long body text wraps rather than shrinking below 14px.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Compact helper / metadata / status detail | 14px | 400 regular | 21px (1.5) |
| Body / row label / action-card helper | 16px | 400 regular | 24px (1.5) |
| Card heading / confirmation heading | 20px | 600 semibold | 24px (1.2) |
| Screen title / hero status headline | 24px | 600 semibold | 29px (about 1.2) |

Use `textPrimary` for screen titles, state headings, and action titles; `textSecondary` for
metadata, helpers, privacy copy, and non-destructive status explanation. One-line labels may
tail-ellipsis only when the full value is exposed through the accessibility label; explanatory and
error copy always wraps in the scroll view.

---

## Color

All values below are existing `space-dark` tokens. The 60/30/10 split describes the Backup surface;
semantic status does not consume the interactive accent budget.

| Role | Token (current value) | Usage |
|------|------------------------|-------|
| Dominant (60%) | `background` (`#0B0E1A`) | Screen roots and the quiet space around cards |
| Secondary (30%) | `surface` (`#141828`) | Health hero, export/restore action cards, settings rows, and preview metadata groups |
| Secondary support | `surfaceElevated` (`#1D2235`) | Modal/sheet and selected non-destructive choice background only |
| Accent (10%) | `accent` (`#6C8CFF`) | Primary action fill, selected restore mode outline/indicator, focused input/press feedback, linked `Manage backups`/`Change` affordance, and enabled Switch track only |
| Healthy status | `statusStable` (`#45B98A`) | Healthy hero dot/shield only; it is a state, never a general CTA colour |
| Attention status | `statusWobble` (`#E8C15C`) | Stale/no-success automatic-backup or lost-folder attention icon/dot only |
| Destructive | `danger` (`#E5484D`) | Replace-all choice and its final native-alert destructive action only |
| Primary / secondary text | `textPrimary` / `textSecondary` | Headings and labels / metadata, helpers, calm reassurance |
| Borders | `border` / `borderStrong` | Card outlines / selected or focused non-destructive outlines |

Accent is reserved for: **Export now primary confirmation, selected restore mode, input focus,
enabled Switch track, and explicit Manage/Change links.** Do not tint every action card, health
status, chevron, or success state accent. A stale/lost backup is attention (`statusWobble`), while
Replace-all alone uses `danger`.

---

## Interaction and State Contract

| State | Trigger | Required presentation and behaviour |
|-------|---------|-------------------------------------|
| Landing loading | Backup settings/health reads pending on focus | Render page chrome immediately and reserve the hero/action layout with neutral `surface` placeholders; do not show a healthy or not-configured conclusion until reads complete. Cancel stale focus work on blur. |
| **Not configured** | No valid SAF destination has been saved | Hero heading **`Backups aren't set up`**; body **`Choose a folder to start protecting your data.`** Hero affordance **`Set up backups`** → `BackupSettings` folder picker. Export and Restore remain available. Do not call this data-protected. |
| **Healthy** | A valid destination is accessible and the most recent successful automatic file represents current exportable data | `statusStable` hero: **`Your data is protected`**; show **`Automatic backup: {relative local time}`** and **`{N} backups kept in {folder name}`** (singular-aware). Hero affordance **`Manage backups`** → settings. Only a verified automatic-folder write earns this state; a manual share-sheet export never does. |
| **Stale / no successful automatic backup** | Destination exists but has no successful automatic write, or data changed since last success and the due window has elapsed | `statusWobble` hero: **`Your backup needs attention`**. For no success: **`No automatic backup has finished yet. Open Orbit again after choosing a folder.`** For stale: **`Your data has changed since the last automatic backup.`** Show last success if known and `Manage backups` → settings. No alarm, badge, or guilt language. |
| **Lost folder** | Saved SAF permission/folder cannot be opened or verified | `statusWobble` hero: **`Backup folder needs reconnecting`**; body **`Orbit can't access your chosen folder. Pick it again to resume automatic backups.`** Affordance **`Choose folder`** → folder picker. Retain the local configuration for diagnosis but do not promise a next auto backup. |
| Manual export ready | User presses `Export now` | If encryption is off, prepare readable JSON then open the share sheet. If encryption is on, default to encrypted; show an explicit portability override before preparation. Disable duplicate presses while export/share preparation is in flight. Successful share-sheet opening is not a health change. |
| Readable-JSON override | Encryption enabled and user chooses portability override | Confirmation: heading **`Export readable JSON?`**, body **`Anyone with this file can read its contents. Use this only when you need a portable JSON backup.`**, actions `Cancel` / `Export readable JSON`. No silent downgrade. |
| Export recoverable failure | Serialization/file/share preparation fails or Android cancels/rejects share | Stay on landing and show native alert **`Couldn't create export`** / **`Nothing was shared. Please try again.`** A picker cancellation is quiet; log only. No state, health, or data change claim. |
| Positive-integer validation | Cadence or retention input is blank, non-integer, zero/negative, or above 3650 | Keep the offending field focused and show inline `Enter a whole number from 1 to 3650 days.` Do not coerce decimals, zero, or text; retain the last saved value until a valid Save. The range permits arbitrary whole-day choices, not preset-only selection. |
| Encryption off | No passphrase cached | Encryption row: **`Encryption`** / **`Off — backups are readable JSON`**. Its tap opens the encryption setup; manual exports are plaintext by default. |
| Encryption enabled | Valid encryption configuration and cached passphrase exist | Row: **`Encryption`** / **`On — new backups are protected with your passphrase`**. Never reveal or echo the passphrase; setting screen exposes Change, forgotten-passphrase, and Turn off actions only. |
| Set encryption | User chooses encryption | Two secure inputs, `Passphrase` and `Confirm passphrase`; show **`If you forget this passphrase, Orbit can't recover encrypted backups.`** and gentle helper **`Use a long, unique passphrase you can keep safely.`** Mismatch: **`Passphrases don't match.`** Primary: `Turn on encryption`, enabled only for a match. |
| Change encryption | User supplies the correct current passphrase | Default choice `Re-encrypt accessible automatic backups`; alternate `Use the new passphrase for future backups only`. Explain that manually shared files retain their old passphrase. A wrong current passphrase leaves settings unchanged and says **`That passphrase doesn't match your current backup protection.`** |
| Forgotten passphrase | User explicitly takes `I forgot my passphrase` | State plainly: **`Old encrypted backups can't be opened or re-encrypted without their passphrase.`** Allow `Set a new passphrase for future backups`; never imply recovery or delete old files. |
| Turn encryption off | User selects disable | Native confirmation: **`Turn off encryption?`** / **`New backups will be readable JSON. Existing encrypted files will keep their passphrase.`** Actions `Cancel` / `Turn off`. On confirm, delete cached secret only; do not alter old files. |
| Restore selection / encrypted prompt | User taps `Restore a backup` | File picker accepts Orbit backup files. Encrypted selection asks for passphrase before preview, with `Cancel` and `Continue`; never expose its encrypted content or counts before a successful decrypt/validation. |
| Restore preview | Entire selected file decrypts, parses, validates, and forward-migrates | Show the Preview anatomy above. Default `Merge`, final CTA `Merge backup`. `Replace all` changes CTA to `Replace and restore`; it is not the default and it never uses a typed phrase. |
| Replace-all confirmation | User presses `Replace and restore` | Native confirmation includes concise impact totals. With a configured folder: **`Orbit will first create and verify a fresh automatic backup of this device.`** Without one: **`Your current local data will be lost and no automatic backup destination is configured.`** Actions `Cancel` / destructive `Replace and restore`. |
| Restore applying | User confirmed Merge or Replace-all | Non-dismissable progress: **`Restoring backup…`** / **`This can take a moment. Orbit will only change local data after this backup is ready to apply.`** Disable Back and duplicate confirmation while apply runs. |
| Restore success | Reconciliation or Replace-all committed | Outcome heading **`Backup restored`**. Show only totals: **`Added: {n} · Updated: {n} · Newer local kept: {n} · Deletions applied: {n}`**. Replace-all also says either **`A verified backup of this device was created first.`** or **`No automatic backup destination was configured.`** Primary `Done` returns to landing and refreshes health. |
| Wrong passphrase | Decrypt fails due to passphrase | Return to passphrase prompt: **`That passphrase doesn't unlock this backup. Your local data hasn't changed.`** Action `Try again`. |
| Damaged/incomplete/invalid backup | Parse, checksum/envelope, structural, duplicate, or parent-reference validation fails | Return to selection: **`This backup is damaged or incomplete. Your local data hasn't changed.`** Action `Choose another file`. Do not offer partial restore. |
| Newer-app backup | Backup format/user version exceeds installed app capability | Return to selection: **`This backup was made by a newer version of Orbit. Update Orbit, then try again. Your local data hasn't changed.`** |
| Other recoverable restore failure | Picker/provider/read/apply precondition fails before commit | Return to selection or preview according to the failed step, with **`Couldn't restore this backup. Your local data hasn't changed. Please try again.`** Log technical detail privately; do not show DB, file-path, encryption, or schema internals. |

**Dashboard nudge:** show only when meaningful exportable data exists — at least one non-seed
relationship record (a contact, interaction, event, fuel item, link, custom-field definition/value,
or profile name/photo), not merely default categories/settings — and either (a) no successful
automatic backup exists, or (b) exportable data changed since the last success and at least 14 days
have passed. It is a single dismissible `surface` row, not a permanent dashboard card. Copy:
**`Protect your Orbit data`** / **`Set up automatic backups`** → `Backup`; persist dismissal until
the health condition changes. Never show it on the first empty install.

**Accessibility and motion:** every control provides `accessibilityRole`, descriptive label,
selected/checked/disabled state where applicable, and a stable `testID`. Surface health state in the
hero's label, not colour alone. Announce restore progress/outcome accessibly; do not use an
unbounded animation or a success-only colour cue. Native Android picker/share/Alert chrome remains
platform-owned.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Landing primary action | **Export now** |
| Restore action | **Restore a backup** — helper: **Preview before changing anything** |
| Healthy hero | **Your data is protected** |
| Healthy metadata | **Automatic backup: {relative local time}** / **{N} backups kept in {folder name}** |
| Not-configured empty heading | **Backups aren't set up** |
| Not-configured empty body | **Choose a folder to start protecting your data.** |
| Stale heading | **Your backup needs attention** |
| Lost-folder heading/body | **Backup folder needs reconnecting** / **Orbit can't access your chosen folder. Pick it again to resume automatic backups.** |
| Encryption off | **Off — backups are readable JSON** |
| Encryption enabled | **On — new backups are protected with your passphrase** |
| Restore preview primary | **Merge backup** (default) / **Replace and restore** (selected Replace-all) |
| Restore success | **Backup restored**; **Added: {n} · Updated: {n} · Newer local kept: {n} · Deletions applied: {n}** |
| Restore failure promise | Use the state-specific copy above and always include **Your local data hasn't changed.** |
| Integer validation | **Enter a whole number from 1 to 3650 days.** |
| Privacy note | **Backups include your contacts, notes, photos, and settings. API keys are never included.** |
| Destructive confirmation | **Replace all local data?**: impact summary + `Cancel` / destructive **Replace and restore**; **Turn off encryption?**: `Cancel` / **Turn off** |

Tone is direct, calm, private, and specific. Never call a manual export a backup-health success,
promise cloud safety, say an operation happened before it verifies, expose individual records in a
restore outcome, or shame a user for stale backup health.

---

## UI Considerations

Applicable state considerations resolved: **25 explicit, 3 backstop, 0 unresolved.** Confirmed
element kinds: health/action landing (`static-content`, `interactive-control`), automatic-file
metadata (`list-collection`), settings (`form`, `interactive-control`), restore preview
(`static-content`, `form`, `interactive-control`), and selected backup file (`media`/file input).

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| loading | Landing health/action surface | ✅ explicit | Neutral placeholder layout persists until focus reads resolve; health does not flash a false conclusion. |
| error | Landing health and export actions | ✅ explicit | Lost-folder, stale, and export-preparation failures use the exact calm copy and recovery affordances above. |
| populated | Automatic-backup metadata | ✅ explicit | Healthy hero shows last verified automatic success, singular-aware count, and folder name only when available. |
| partial | Landing health | ✅ explicit | Destination without a verified automatic backup and a now-inaccessible destination are distinct states, not silently collapsed to healthy. |
| overflow | Landing and settings | 🧪 backstop | Device UAT verifies 320dp width, long folder names, long localized dates, and the privacy note wrap without clipped controls. |
| long-text | Hero/status/error/static reassurance | 🧪 backstop | Explanations wrap in the vertical scroll view; a11y labels expose elided folder values. Device UAT covers longest failure message. |
| loading | Backup settings form | ✅ explicit | Disable save/mutation controls until settings load; preserve last saved values on rejected mutations. |
| empty | Folder configuration form | ✅ explicit | No destination is the documented not-configured state with `Set up backups`/folder picker, never a blank unexplained row. |
| error | Positive-integer and encryption forms | ✅ explicit | Inline integer validation and passphrase mismatch/current-passphrase errors retain input and prevent the unsafe mutation. |
| partial | Encryption change | ✅ explicit | Accessible automatic files may be re-encrypted; manual files retain old protection and future-only is an explicit alternate choice. |
| long-text | Settings inputs and helper text | ✅ explicit | Inputs scroll horizontally as native text fields; helper/error text wraps; no smaller type is introduced. |
| loading | Restore file/decrypt/validation/apply flow | ✅ explicit | Distinct picker, decrypt/validation, and non-dismissable apply progress prevent an empty preview or duplicate apply. |
| error | Restore flow | ✅ explicit | Wrong passphrase, damaged/invalid file, newer-app file, and generic recoverable failure return to the appropriate prior step and always state local data is unchanged. |
| populated | Restore preview | ✅ explicit | Aggregate date/version/encryption/counts plus Merge default and Replace-all impact summary; no sensitive audit list. |
| partial | Restore preview | ✅ explicit | Older compatible files forward-migrate; newer files stop before preview; no best-effort partial restore. |
| overflow | Restore preview | 🧪 backstop | Device UAT covers largest supported aggregate counts and long date/version metadata in a scrollable preview with final CTA reachable. |
| long-text | Restore confirmation/error copy | ✅ explicit | Scroll/wrap text; native alert copy stays concise and does not use typed confirmation. |
| empty | Dashboard nudge eligibility | ✅ explicit | Zero meaningful user-created data suppresses the nudge; no first-run backup pressure. |
| zero-one-many | Automatic backup count / restore totals | ✅ explicit | Use singular-aware `1 backup` vs `{N} backups`; aggregate outcome retains zero categories without per-row listings. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none (no shadcn or external UI registry) | none — bespoke React Native primitives and existing in-repo patterns only | not applicable |

No third-party UI registry is declared or used. The registry vetting gate is not triggered.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
