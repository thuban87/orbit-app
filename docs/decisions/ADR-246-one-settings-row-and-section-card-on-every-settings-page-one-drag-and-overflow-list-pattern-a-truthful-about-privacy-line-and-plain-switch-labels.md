# ADR-246: One Settings Row and Section Card on Every Settings Page, One Drag-and-⋯ List Pattern, a Truthful About Privacy Line, and Plain Switch Labels

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-119, D-120, D-86 (list half), D-73, D-75, D-76, D-125, D-151, D-130, D-83, D-79, D-80, D-81, D-82 (38.12-CONTEXT.md; ledger Q-23, Q-24, Q-26b, Q-31, mid-execution ruling R7); carried D-02, D-05, D-25
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Each Settings sub-page drew its rows its own way, some with chevrons on rows that opened nothing. Custom Fields, Categories, Systems and AI sections were managed four different ways, some with rows of inline buttons and destructive actions at rest. Deleting an in-use category took two Keep taps to back out. About said nothing about where data goes. "Decay reminders" and "AI Enabled" were developer words. The phone-region picker showed bare codes.

## Decision

**One row and card (D-119).** Every Settings sub-page uses one shared `SettingsRow` and `SettingsSectionCard`: Appearance, Contacts & Relationships, Interactions, Notifications, Orrery, every AI page, About, Profile backgrounds and Backup where rows fit. A row has a title and an optional subtitle or right-aligned value. It shows a chevron only when it opens something and has no trailing control. Info-only rows are plain, non-tappable Views, and a disabled row dims. The card owns surface, border and dividers. It takes `surface="plain"` (the default) or `"glass"`, which Profile backgrounds keeps. The look was checked on device against a mockup. Phase 39's Tutorials row is built on it.

**One list pattern (D-120).** Custom Fields, Categories, Systems and AI sections each have a drag handle plus a ⋯ `AnchoredMenu` holding the row's actions (Edit, Rename, Duplicate, Move up, Move down, then Delete or Quarantine last as danger). There are no rows of inline buttons, and destructive actions sit only inside ⋯ (D-02). Categories is the reference and keeps its drag handles (D-25). Category delete is one non-dismissable destructive confirm with plain counts ("2 people move to Uncategorized"), the detail behind a toggle and one Cancel (D-73). The System builder loses its decorative circles but keeps the Fill (D-75). "Manage Members" opens the builder on its members page, and the membership reset has one label, "Reset Membership Changes" (D-76).

**About (D-125, D-151).** About shows one plain privacy line that stays true to the local-first rule. Contact data stays on the phone and in the chosen backup folder. Orbit sends it nowhere else, except to the user's own AI provider when they use AI, and when they use Export, which hands the full data to an app they pick. That Export clause is visually highlighted.

**Labels (D-130, D-83).** "Decay reminders" reads "Check-in reminders" and Settings → AI's "AI Enabled" reads "Use AI suggestions", both as glossary constants. Status names are unchanged (D-05). "Unbound" is capitalised as the product term in Notifications.

**Other pages (D-79–D-82).** The phone-region picker shows country names from a bundled CLDR English table, since Hermes lacks `Intl.DisplayNames`. It has an empty state, sits in the shared sheet above the keyboard and clears its search on close. Appearance keeps Orbit Center, Your star and Your name, retitles "Your profile" and spells "Center" one way. The default-layout picker gets a title and the option sheet. The Orbit Center picker reuses `ContactPickerList`. Your name scrolls clear of the keyboard and confirms "Saved your name".

## Alternatives Considered

- **Shared row only on pages this phase touched**, or **no shared row** — rejected for every page (Q-23 B, C).
- **Keep each list's own management style** — rejected for one pattern (Q-24).
- **No About line** — rejected (Q-26b); Export was added to it at R7 ("it goes against our ethos kind of").
- **Keep "Decay reminders" / "AI Enabled"** — rejected (Q-31).

## Consequences

### Positive

- Every Settings page reads the same, and a chevron always means "this opens".
- No list shows a destructive action at rest.

### Negative

- Pages that used glass cards (the AI pages) now draw plain cards.

### Risks

- A new Settings page that draws its own rows will drift; the settings chrome contract test checks only the header.

## Implementation

**Key files:**
- `src/components/ui/SettingsRow.tsx` — the shared row.
- `src/components/ui/SettingsSectionCard.tsx` — the shared card, plain or glass.
- `src/components/ui/AnchoredMenu.tsx` — the row ⋯ menu.
- `src/screens/SettingsAboutScreen.tsx` — rows and the privacy line.
- `src/screens/settings-about-model.ts` — `ABOUT_PRIVACY_LINE`, `ABOUT_PRIVACY_EXPORT_CLAUSE`.
- `src/screens/SettingsContactsScreen.tsx` — rows; the phone-region sheet.
- `src/constants/country-names.ts` — `COUNTRY_NAMES`, `countryName`.
- `src/screens/SettingsInteractionsScreen.tsx` — rows.
- `src/screens/SettingsOrreryScreen.tsx` — rows.
- `src/screens/ProfileBackgroundsScreen.tsx` — glass cards.
- `src/screens/SettingsNotificationsScreen.tsx` — rows, labels.
- `src/screens/SettingsAppearanceScreen.tsx` — rows, pickers, name cue.
- `src/db/sun-picker-read.ts` — Orbit Center rows shaped for `ContactPickerList`.
- `src/constants/glossary.ts` — `CHECK_IN_REMINDERS`, `USE_AI_SUGGESTIONS`.
- `src/screens/CustomFieldsScreen.tsx` — drag and ⋯ list.
- `src/screens/CategoryManagementScreen.tsx` — the reference list; one-step delete confirm.
- `src/components/ui/ConfirmDialog.tsx` — a children slot for the category confirm.
- `src/screens/SystemsManagementScreen.tsx` — ⋯ menus, `systemMenuItems`.
- `src/screens/SystemBuilderScreen.tsx` — no circles; `initialPage`.
- `src/logic/orrery-system-logic.ts` — `RESET_MEMBERSHIP_CHANGES`.
- `src/screens/AIPersonalizationScreen.tsx` — sections on the list pattern.

**Depends on:** ADR-140 (Navigation-First Settings Directory and Canonical Sub-Routes); ADR-143 (Lock-Time-Revalidated Atomic Category Deletion and System Fallout); ADR-199 (App-Wide Destructive-Action, Feedback and Validation Standards, and One Empty State); ADR-206 (Glossary — Canonical Terms Kept, Retired Forms Enforced, Plain-Word Rewrites, and a Shared Plural Helper)
**Required by:** None
