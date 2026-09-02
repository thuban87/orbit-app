---
phase: 17
slug: backup-export-restore
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-25
reviewed_at: 2026-08-25T03:23:15-05:00
---

# Phase 17 — UI Design Contract

> Visual and interaction contract for Backup & Restore: automatic local backup health, manual
> export, backup settings, previewed restore, and restore result. It implements BKP-01…04 and the locked Phase-17
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
| Navigation | Additive native-stack routes: `Backup`, `BackupSettings`, `RestorePreview`, `RestoreResult`; temporary Dashboard entry only. No bottom navigation implementation. |
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
   folder`), then, only after a valid folder selection, the `Open backup folder` link/row, cadence
   integer input, and retention integer input. `Open backup folder` launches the saved folder in
   Android's native Files/file-explorer experience only when the provider/platform exposes a
   supported open action. It is not a backup-history list or in-app folder browser. Automatic backup
   is explicitly foreground-only; helper copy must never imply clock-exact or background scheduling.
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
non-dismissable progress treatment; after a successful commit navigate to `RestoreResult`; return
recoverable pre-commit failures to the correct selection or preview step. Restore returns to the
Backup landing only from the result screen's final action.

### Restore result (`RestoreResult`)

`RestoreResult` is a distinct static route reached only after Merge or Replace-all has committed.
It presents the existing concise aggregate outcome: added, updated from backup, newer local retained,
and tombstone deletions applied. For Replace-all it also presents exactly one disclosure: either a
verified pre-restore automatic backup was created or no automatic destination was configured. It
does not re-read or reapply the backup, list individual records, expose a backup-history browser, or
offer a second restore action. Its sole primary action, `Return to Backup & Restore`, navigates to
`Backup` and refreshes health.

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
| Open backup folder | A valid automatic-backup folder is selected and the user presses `Open backup folder` | Launch the saved folder using the native Android Files/file-explorer open action when the selected SAF provider/platform supports it. Disable duplicate presses while the launch request is pending. Do not enumerate files in Orbit or add a backup-history list. |
| Open-folder unavailable/rejected | The provider/platform has no supported open action, disables it, or rejects the request | Keep folder settings unchanged; show **`This folder can be opened from the Files app.`** The row is disabled when capability is known unavailable, with `accessibilityState.disabled`; a rejected attempt shows the same calm message and remains retryable only when capability permits. |
| Manual export ready | User presses `Export now` | If encryption is off, prepare readable JSON then open the share sheet. If encryption is on, default to encrypted; show an explicit portability override before preparation. Disable duplicate presses while export/share preparation is in flight. Successful share-sheet opening is not a health change. |
| Readable-JSON override | Encryption enabled and user chooses portability override | Confirmation: heading **`Export readable JSON?`**, body **`Anyone with this file can read its contents. Use this only when you need a portable JSON backup.`**, actions `Keep encrypted export` / `Export readable JSON`. No silent downgrade. |
| Export recoverable failure | Serialization/file/share preparation fails or Android cancels/rejects share | Stay on landing and show native alert **`Couldn't create export`** / **`Nothing was shared. Please try again.`** A picker cancellation is quiet; log only. No state, health, or data change claim. |
| Positive-integer validation | Cadence or retention input is blank, non-integer, zero/negative, or above 3650 | Keep the offending field focused and show inline `Enter a whole number from 1 to 3650 days.` Do not coerce decimals, zero, or text; retain the last saved value until a valid Save. The range permits arbitrary whole-day choices, not preset-only selection. |
| Encryption off | No passphrase cached | Encryption row: **`Encryption`** / **`Off — backups are readable JSON`**. Its tap opens the encryption setup; manual exports are plaintext by default. |
| Encryption enabled | Valid encryption configuration and cached passphrase exist | Row: **`Encryption`** / **`On — new backups are protected with your passphrase`**. Never reveal or echo the passphrase; setting screen exposes Change encryption, forgotten-passphrase, and Turn off encryption actions only. |
| Set encryption | User chooses encryption | Two secure inputs, `Passphrase` and `Confirm passphrase`; show **`If you forget this passphrase, Orbit can't recover encrypted backups.`** and gentle helper **`Use a long, unique passphrase you can keep safely.`** Mismatch: **`Passphrases don't match.`** Primary: `Turn on encryption`, enabled only for a match. |
| Change encryption | User supplies the correct current passphrase | Default choice `Re-encrypt accessible automatic backups`; alternate `Use the new passphrase for future backups only`. Explain that manually shared files retain their old passphrase. A wrong current passphrase leaves settings unchanged and says **`That passphrase doesn't match your current backup protection.`** |
| Forgotten passphrase | User explicitly takes `I forgot my passphrase` | State plainly: **`Old encrypted backups can't be opened or re-encrypted without their passphrase.`** Allow `Set a new passphrase for future backups`; never imply recovery or delete old files. |
| Turn encryption off | User selects disable | Native confirmation: **`Turn off encryption?`** / **`New backups will be readable JSON. Existing encrypted files will keep their passphrase.`** Actions `Keep encryption on` / `Turn off encryption`. On confirm, delete cached secret only; do not alter old files. |
| Restore selection / encrypted prompt | User taps `Restore a backup` | File picker accepts Orbit backup files. Encrypted selection asks for passphrase before preview, with `Choose another backup` and `Continue to preview backup`; never expose its encrypted content or counts before a successful decrypt/validation. |
| Restore preview | Entire selected file decrypts, parses, validates, and forward-migrates | Show the Preview anatomy above. Default `Merge`, final CTA `Merge backup`. `Replace all` changes CTA to `Replace and restore`; it is not the default and it never uses a typed phrase. |
| Replace-all confirmation | User presses `Replace and restore` | Native confirmation includes concise impact totals. With a configured folder: **`Orbit will first create and verify a fresh automatic backup of this device.`** Without one: **`Your current local data will be lost and no automatic backup destination is configured.`** Actions `Keep local data` / destructive `Replace and restore`. |
| Restore applying | User confirmed Merge or Replace-all | Non-dismissable progress: **`Restoring backup…`** / **`This can take a moment. Orbit will only change local data after this backup is ready to apply.`** Disable Back and duplicate confirmation while apply runs. |
| Restore success | Reconciliation or Replace-all committed | Navigate to `RestoreResult`, whose heading is **`Backup restored`**. Show only totals: **`Added: {n} · Updated: {n} · Newer local kept: {n} · Deletions applied: {n}`**. Replace-all also says either **`A verified backup of this device was created first.`** or **`No automatic backup destination was configured.`** Its sole primary `Return to Backup & Restore` returns to landing and refreshes health. |
| Wrong passphrase | Decrypt fails due to passphrase | Return to passphrase prompt: **`That passphrase doesn't unlock this backup. Your local data hasn't changed.`** Action `Try passphrase again`. |
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
selected/checked/disabled state where applicable, and a stable `testID`. The folder launcher label
includes the selected folder name and its disabled state/reason when unavailable. Surface health
state in the hero's label, not colour alone. Announce restore progress and route-result outcome
accessibly; do not use an unbounded animation or a success-only colour cue. Native Android
picker/share/Files/Alert chrome remains platform-owned.

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
| Open-folder row / unavailable message | **Open backup folder** / **This folder can be opened from the Files app.** |
| Encryption off | **Off — backups are readable JSON** |
| Encryption enabled | **On — new backups are protected with your passphrase** |
| Restore preview primary | **Merge backup** (default) / **Replace and restore** (selected Replace-all) |
| Restore result | **Backup restored**; **Added: {n} · Updated: {n} · Newer local kept: {n} · Deletions applied: {n}**; **Return to Backup & Restore** |
| Restore failure promise | Use the state-specific copy above and always include **Your local data hasn't changed.** |
| Integer validation | **Enter a whole number from 1 to 3650 days.** |
| Privacy note | **Backups include your contacts, notes, photos, and settings. API keys are never included.** |
| Destructive confirmation | **Replace all local data?**: impact summary + `Keep local data` / destructive **Replace and restore**; **Turn off encryption?**: `Keep encryption on` / **Turn off encryption** |

Tone is direct, calm, private, and specific. Never call a manual export a backup-health success,
promise cloud safety, say an operation happened before it verifies, expose individual records in a
restore outcome, or shame a user for stale backup health.

---

## UI Considerations

The user confirmed these element kinds: health/action landing (`static-content`,
`interactive-control`), automatic-file metadata (`list-collection`, `static-content`), settings
(`form`, `interactive-control`), restore preview (`static-content`, `form`,
`interactive-control`), selected backup file (`media`/file input), restore result
(`static-content`, `interactive-control`), and native folder launcher (`interactive-control`).

Applicable state considerations resolved: **26 explicit, 6 backstop, 2 dismissed, 0 unresolved.**
`Backstop` rows require the stated device UAT evidence; `dismissed` rows are intentionally
inapplicable to a committed, parameter-driven result route.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| loading | Landing health/action surface | ✅ explicit | Neutral placeholders persist until focus reads resolve; health never flashes a false conclusion. |
| error | Landing health/action surface | ✅ explicit | Lost-folder and export-preparation failures use the exact calm copy and recovery affordances above. |
| overflow | Landing health/action surface | 🧪 backstop | Device UAT at 320dp verifies no clipped action controls and a vertical scroll path. |
| long-text | Landing health/action surface | 🧪 backstop | Hero, privacy, and error copy wrap; elided values are exposed through accessibility labels. |
| empty | Automatic-backup metadata | ✅ explicit | Zero verified automatic files becomes the documented not-configured or no-success health state, not a blank metadata list. |
| loading | Automatic-backup metadata | ✅ explicit | The landing placeholder is shown until metadata reads complete. |
| error | Automatic-backup metadata | ✅ explicit | An unreadable folder is the distinct lost-folder state with a reconnect affordance. |
| populated | Automatic-backup metadata | ✅ explicit | Healthy hero shows the last verified success, singular-aware count, and folder name only when available. |
| partial | Automatic-backup metadata | ✅ explicit | A folder without a verified automatic backup and an inaccessible saved folder are distinct, not collapsed to healthy. |
| overflow | Automatic-backup metadata | 🧪 backstop | Device UAT covers long folder names and localized dates without clipping the hero. |
| zero-one-many | Automatic-backup metadata | ✅ explicit | Use `1 backup` versus `{N} backups`; no separate history list is introduced. |
| long-text | Automatic-backup metadata | 🧪 backstop | Long folder names tail-ellipsis only with a full accessibility label; explanatory copy wraps. |
| empty | Backup settings form | ✅ explicit | No destination is the documented folder-picker setup state, never a blank unexplained row. |
| loading | Backup settings form | ✅ explicit | Disable save/mutation controls until settings load and retain the last saved value on rejected mutations. |
| error | Backup settings form | ✅ explicit | Integer validation and passphrase errors retain input and prevent unsafe mutation. |
| partial | Backup settings form | ✅ explicit | Encryption change supports accessible-file re-encryption while manual files retain old protection; future-only is explicit. |
| long-text | Backup settings form | ✅ explicit | Native inputs scroll horizontally; helper/error text wraps with no smaller type. |
| empty | Restore preview | ✅ explicit | No preview is rendered until a selected file decrypts, validates, and forward-migrates; selection remains available. |
| loading | Restore preview | ✅ explicit | Picker, decrypt/validation, and non-dismissable apply progress are distinct so preview never appears empty or permits duplicate apply. |
| error | Restore preview | ✅ explicit | Wrong passphrase, damaged/invalid file, newer-app file, and recoverable failure return to the right prior step and say local data is unchanged. |
| partial | Restore preview | ✅ explicit | Compatible older files forward-migrate; newer files stop before preview; no best-effort partial restore. |
| overflow | Restore preview | 🧪 backstop | Device UAT covers largest aggregate counts and long date/version metadata with the final CTA reachable. |
| long-text | Restore preview | ✅ explicit | Confirmation and error copy wraps; native-alert content stays concise and needs no typed phrase. |
| empty | Selected backup file | ✅ explicit | No file is the file-picker selection state; it has no blank preview or implicit restore. |
| loading | Selected backup file | ✅ explicit | Decrypt, parse, validation, and migration show progress before any preview. |
| error | Selected backup file | ✅ explicit | Invalid, damaged, unreadable, and newer-version files return to selection with the state-specific recovery copy. |
| populated | Selected backup file | ✅ explicit | A valid file is represented only by the aggregate restore preview; no file thumbnail, paths, or record browser are shown. |
| loading | Restore result | ◌ dismissed | This parameter-driven route is reached only after a committed apply and performs no independent content load. |
| error | Restore result | ◌ dismissed | Pre-commit failures return to selection/preview; committed results have no retry/apply control. |
| overflow | Restore result | 🧪 backstop | Device UAT verifies long aggregate values and the Replace-all disclosure with `Return to Backup & Restore` reachable. |
| long-text | Restore result | ✅ explicit | Totals/disclosure wrap at the established body size; no record names, audit list, or truncated final action. |
| loading | Native folder launcher | ✅ explicit | Disable `Open backup folder` while the best-effort Android launch request is pending; Orbit never lists folder contents. |
| error | Native folder launcher | ✅ explicit | Unsupported, disabled, and rejected actions keep settings intact and show the documented Files-app message; no in-app browser. |
| long-text | Native folder launcher | ✅ explicit | The row's selected-folder name follows the documented ellipsis/accessibility treatment; unavailable copy wraps. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none (no shadcn or external UI registry) | none — bespoke React Native primitives and existing in-repo patterns only | not applicable |

No third-party UI registry is declared or used. The registry vetting gate is not triggered.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-08-25T03:23:15-05:00
