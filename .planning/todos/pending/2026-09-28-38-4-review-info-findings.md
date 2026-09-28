---
created: 2026-09-28T12:00:00.000Z
title: Triage the 38.4 code review's Info findings that have no disposition (21 items)
area: ui
severity: minor
files:

  - src/components/control-surface/DashboardControlRow.tsx
  - src/db/import-session-read.ts
  - src/services/import/import-lifecycle-effects.ts
  - src/services/import/import-driver.ts
  - src/services/import/import-acquire.ts
  - src/screens/DuplicateReviewScreen.tsx
  - src/components/UniversalFab.tsx
  - src/navigation/RootNavigator.tsx
  - src/components/digest/YourWeekHeatmap.tsx
  - src/components/ListRow.tsx
  - src/components/GridCard.tsx
  - src/components/ui/ConfirmDialog.tsx
  - src/components/field-widgets/DropdownFieldWidget.tsx
  - src/components/field-widgets/NumberFieldWidget.tsx
  - src/components/field-widgets/TextFieldWidget.tsx
  - src/components/field-widgets/TextAreaFieldWidget.tsx
  - src/components/history/DateDetailSheet.tsx
  - src/theme/theme-provider.tsx
  - src/components/history/ActivityHeatmap.tsx
  - src/screens/bulk-import-setup-logic.ts
  - src/screens/RestorePreviewScreen.tsx
  - src/screens/ai-permissions-logic.ts
  - src/screens/HomeScreen.tsx
  - src/screens/dashboard-refresh-scheduler.ts
  - src/screens/EditContactScreen.tsx
  - src/screens/MemoryScreen.tsx
  - src/screens/AIPermissionsScreen.tsx
  - src/screens/ai-model-picker-logic.ts
  - src/screens/AIModelPickerScreen.tsx

source: owner 2026-09-28, from the 38.4 verification warning (38.4-VERIFICATION.md, "About 20 Info-level findings with no recorded disposition"). Findings are from 38.4-REVIEW.md (Lanes A, B1, B2, C, D). Each file:line below was re-checked against the code on 2026-09-28; all 21 are still present.
---

## Problem

The 38.4 code review raised Info-level findings that nobody fixed, ruled on or filed. None of them breaks a 38.4
requirement, but they need a decision (fix, or leave on purpose) so they are not lost. One per line: lane + id,
file:line, what the user would see.

1. **B1 IN-02** — `DashboardControlRow.tsx:177, 199, 223` (with `dashboard-panel-store.ts`): if you tap Population,
   Filters or Sort and switch tabs within about one frame, the panel can open on the Contacts screen you just left.
   The hidden panel then swallows your next Back or tab re-tap. This is the D-62 symptom, reachable through a narrow race.
2. **A IN-02** — `import-session-read.ts:81-93`: nothing today (every writer is correct). If a future change broke a
   writer, a Bound import batch would quietly import as Unbound with no error.
3. **A IN-04** — `import-lifecycle-effects.ts:38`, `import-driver.ts:259-262`, `import-acquire.ts:199-211`,
   `DuplicateReviewScreen.tsx:260`: after a Bound import, Import Progress can sit at 100% while reminders are
   recalculated. Duplicate Review does not wait for that. The same helper code is copied in three places.
4. **A IN-05** — `import-lifecycle-effects.ts:11`: with birthday reminders for Unbound contacts turned on, an Unbound
   import's birthdays are not scheduled until the next app launch or return to the foreground.
5. **A IN-07** — `UniversalFab.tsx:217, 231` (no close on unmount), `RootNavigator.tsx:139-143`: nothing today. If the
   + button were ever remounted while its menu was open, the whole app would stay hidden from TalkBack.
6. **B1 IN-03** — `YourWeekHeatmap.tsx:21, 75-76`: nothing visible. On narrow screens a debug log fires on every layout
   pass.
7. **B1 IN-04** — `ListRow.tsx:141-150`, `GridCard.tsx:164-173`: in search results, TalkBack reads the category and
   "last contact" text before the match. The screen does not show that text in search mode.
8. **B2 IN-01** — `ConfirmDialog.tsx:170` (key `ConfirmActions` at `:130`): no current screen triggers it. If a
   dialog's button labels got longer, or the font size changed while it was open, the side-by-side buttons could spill
   out of the card.
9. **B2 IN-02** — `NumberFieldWidget.tsx:25`, `TextFieldWidget.tsx:26`, `TextAreaFieldWidget.tsx:26`,
   `DropdownFieldWidget.tsx:62`: the three text fields set a placeholder colour but have no placeholder. On a glass
   card, an empty dropdown's "Select…" would look like a chosen value. No glass host exists today.
10. **B2 IN-03** — `DateDetailSheet.tsx:252-255`: on the history date sheet, TalkBack reads a lifecycle row (e.g.
    "Archived") and its time as separate pieces, not as the combined "Archived, 2:30 PM" label.
11. **B2 IN-04** — `theme-provider.tsx:89-90`: on the Orrery, after a background image fails, and for glass cards inside
    opaque sheets, secondary text looks the same as primary text and status/accent text is darker than intended.
    Contrast still passes. The review suggests handling it in Phase 38.5.
12. **B2 IN-06** — `ActivityHeatmap.tsx:438` (Year grid), `:303`, `:324`: the Profile History Year view sits to the
    left with empty space on the right (Day and Cycles are centred), and TalkBack says "1 interactions".
13. **B2 IN-07** — `DropdownFieldWidget.tsx:77`: TalkBack announces a dropdown's tap-outside-to-close area with no
    "button" role. The dropdown also skips the shared sheet's focus handling.
14. **C IN-02** — `bulk-import-setup-logic.ts:99` vs `import-session-read.ts:81-93`: nothing today. A damaged Bound
    session would show Bound + Monthly on the setup screen but resume from the prompt as Unbound.
15. **C IN-03** — `import-driver.ts:259-262`, `import-acquire.ts:199-211`: if closing the import session fails after
    contacts were created, reminders are not refreshed until the next launch. A single import also says "Couldn't
    import contact" for a contact that was in fact created.
16. **C IN-04** — `RestorePreviewScreen.tsx:304`: for a hand-edited or non-Orbit backup whose export time ends in "Z" or
    has milliseconds, Restore shows "Source date: Unknown time" instead of the date.
17. **D IN-03** — `ai-permissions-logic.ts:168-173`: on AI Data Permissions, when nothing is enabled yet, a search or
    type filter that matches nothing says "AI can't access any contact information yet." It should say "No information
    matches these filters."
18. **D IN-04** — `HomeScreen.tsx:1382`, `dashboard-refresh-scheduler.ts:59-62`: star a contact and leave Home at once,
    and a full Home reload runs in the background. Nothing is visible, only wasted work, and a code comment says this
    cannot happen.
19. **D IN-05** — `EditContactScreen.tsx:95`, `MemoryScreen.tsx:83`: nothing visible. Two Biome warnings (unused import
    `applyLinkDiff`, unused `saving`), still reported by `biome lint` on 2026-09-28.
20. **D IN-06** — `AIPermissionsScreen.tsx:251`: the enable confirmation reads "This will make 1 items across 1 contacts
    available to AI."
21. **D IN-07** — `ai-model-picker-logic.ts:134, 146`, `AIModelPickerScreen.tsx:286-288`: before the model catalog loads,
    the picker briefly shows a "Current model: <raw id>" row that disappears when the card arrives. The row always
    shows the raw id, never the model's name.

## Already dispositioned (not in the list above)

- Fixed in fix pass 1: A IN-03 (`01a7295`), C IN-05 (`8298d13`).
- Fixed by D-63 (fix pass 2, `6407fb1`): B1 IN-01, D IN-01, D IN-02.
- Ruled by D-65 (switch OFF state left for the owner's look): B2 IN-05.
- Owner copy check OWN-D57 passed with the review's caveat in front of him (UAT owner row 23): A IN-06, C IN-01.
- Accepted in Plan 01's threat register as T-38.4-01-04 (restore-only offset timestamps, recorded in `digest.md`):
  A IN-01. Its optional follow-up, rewording the "keeps results exact" header comment in `your-week-read.ts`, was not done.

## Solution

Triage with the owner: fix, or mark as left on purpose. Items 1, 7, 10, 12, 13, 17 and 20 change what a user sees or
hears. Items 2, 5, 8, 14 and 15 are hardening against states that cannot happen today. Item 11 belongs with Phase 38.5.
