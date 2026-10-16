# Capture

**Last updated:** 2026-10-15
**Updated by phase:** 38.10-fuel-retirement-things-to-remember
**Owners:** `src/db/capture-read.ts`, `src/db/capture-dao.ts`, `src/logic/capture-logic.ts`, `src/logic/share-card-logic.ts`, `src/screens/CaptureScreen.tsx`, `src/components/ShareConfirmationCard.tsx`

## Purpose

Capture lets another Android app share text or a link into Orbit for a chosen contact. The share is saved at once to that person's Thought of Them section, then a confirmation card lets the user move it to another section, add a note, allow AI or undo it, before Orbit returns to the sharing app. Everything stays local and a share never counts as contact.

## Architecture

### Data Model

Capture owns no table or migration. It writes into the Things to Remember homes (`contact-knowledge.md`).

**Tables:**

- `contacts` — picker targets: `archived_at` (archived contacts are never offered, even in search), `favourite_rank` (first band), name and avatar.
- `memories` — a share is a `thought_of_them` row (or `gift_idea` / `general` after a chip move) with `provenance='share'`, `allow_ai = 0`, the display text in `value` and the canonical first URL in `url`.
- `current_state_entries` — a share moved to Last Talked About is a dated entry (today) with `from_share = 1` and its link kept.
- `off_limits` — a share moved there later keeps `from_share = 1`.

**Types** (`src/db/capture-read.ts`, `src/db/capture-dao.ts`, `src/logic/capture-logic.ts`):

- `CapturePickRow` — a non-archived contact with `last_contact`, `snooze_until`, `archived_at` and the share-recency timestamp (picker-order compatible).
- `CaptureInput` / `CapturePayload` — the pure payload boundary.
- `ShareRowRef`, `ShareSection` — a saved share row and the card's chip sections.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Pure logic | `src/logic/capture-logic.ts` | Resolves display text and canonical URL. |
| Card logic | `src/logic/share-card-logic.ts` | Card reducer, `SHARE_CARD_AUTO_CLOSE_MS`, share sequence and write latch, labels and Undo snackbars. |
| DAO reader | `src/db/capture-read.ts` | Favourites, then most recent share (`SHARE_RECENCY_JOIN`), then the rest; archived excluded. |
| DAO writer | `src/db/capture-dao.ts` | `shareToContacts`, `createContactAndShare`, `moveShareRows(WithAi)`, `undoShareRows`, `undoCreateContactAndShare`, `setShareRowsAllowAi`, `applyShareNote`; each one transaction and one `data_revision` bump. |
| UI | `src/screens/CaptureScreen.tsx` | Drains the intent, hosts the list picker, inline create and the card. |
| UI | `src/components/ShareConfirmationCard.tsx` | Chips, Undo, Add note (shared entry field), Allow AI, Done. |
| Native | `app.config.ts`, `patches/expo-share-intent+8.0.1.patch`, `modules/orbit-share-finish/` | `text/plain` share target, Chrome titles, return to the source app. |

### Key Files

| File | Role |
|---|---|
| `src/components/ContactPicker.tsx` | `ContactPickerList`, embedded with always-visible search and `allowArchived={false}`. |
| `src/constants/new-contact-defaults.ts` | `NEW_CONTACT_DEFAULT_INTERVAL_DAYS` (30, monthly) for inline create. |
| `src/services/resume-prompt-precedence.ts` | `resolveActiveResumePrompt` with `suppressed` while a share is pending. |
| `src/screens/capture-back-logic.ts` | Back order, innermost surface first. |
| `src/navigation/linking.ts` | Ready-gated pending-share navigation to Capture. |
| `modules/orbit-share-finish/android/src/main/java/expo/modules/orbitsharefinish/OrbitShareFinishModule.kt` | Plain `Activity.finish()` after capture. |

## How It Works

### Receiving and routing a share

1. Android sends a `text/plain` intent to the patched `expo-share-intent`; the patch reads `EXTRA_SUBJECT` before `EXTRA_TITLE`.
2. `ShareIntentProvider` holds the payload while migrations finish; `ShareIntentGate` navigates to Capture once the navigator is ready.
3. While a share is pending or Capture is focused, neither resume prompt (import or reconcile) is shown, on cold or warm starts (`App.tsx`, D-23).
4. An empty display and URL produces a cancel-only error state.

### Picking and saving

1. The list picker shows favourites, then contacts by most recent share across every home a share can live in, then the rest; never-contacted contacts are included and archived ones never offered (ADR-216).
2. Tapping a person saves the share at once: `shareToContacts` writes one Thought of Them row, AI-off, and bumps `data_revision`. Multi-select writes one independent row per person in one transaction.
3. "New contact" opens the name-only sheet, carrying the typed search text; `createContactAndShare` creates the contact (tracked, monthly) and its first share in one transaction.
4. Capture never writes `last_contact` or an interaction row.

### The confirmation card

1. The card reads "Saved to <name> · <section>" (plus "Created <name> · checking in monthly" for an inline create) and follows the chip.
2. Chips (Thought of Them · Gift Ideas · Last Talked About · Memories) move every copy together through `moveShareRowsWithAi`. The Allow AI switch starts off and is disabled while Last Talked About is chosen (D-99). Add note writes `applyShareNote`.
3. Undo removes the share and returns to the unlocked list with the same shared item (D-120). If the share created its contact, Undo removes that contact too when it owns nothing else; otherwise only the share goes and a snackbar says the contact was kept (ADR-217).
4. The card closes itself after `SHARE_CARD_AUTO_CLOSE_MS`, waiting while it is touched, then `finishActivity()` returns to the sharing app. Async handlers go through one latch keyed on the share sequence, so a new share intent never publishes into an old card.

### Going Back

`resolveCaptureBack` closes the innermost surface first: the New-contact sheet (prompting "Discard changes?" if a name is typed), then search, then multi-select, then a typed note prompts; only with nothing open does Back cancel and return to the sharing app (ADR-200). Capture keeps its own chrome.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `SHARE_CARD_AUTO_CLOSE_MS` | `5000` | `src/logic/share-card-logic.ts` | Card auto-close; waits while touched. |
| `NEW_CONTACT_DEFAULT_INTERVAL_DAYS` | `30` | `src/constants/new-contact-defaults.ts` | Monthly default for inline create. |
| Android intent filter | `text/plain` only | `app.config.ts` | Supported payloads only. |

## Decisions

- **ADR-037:** Text-Only Android Share Intent Integration — native filter, title patch, ready gate and return path; kept by D-74.
- **ADR-038:** Contact-Owned Share Capture Fuel — write-at-pick, canonical URL, no touchpoint, independent rows (its fuel destination is superseded by ADR-216).
- **ADR-045:** Event-Driven Widget Refresh and Boot Recovery — Capture no longer publishes a widget refresh, since the widget shows no knowledge line (ADR-215).
- **ADR-062:** Bound/Unbound Lifecycle and One-Way Cadence Assignment — inline create stays Bound with a positive cadence.
- **ADR-018:** Archive-Gated Contact Purge — share Undo is its one exception (ADR-217).
- **ADR-200:** Unsaved-Work Guard — Capture's Back order.
- **ADR-213:** Moving Entries Between Things to Remember Sections — chip moves and later moves keep the share marker.
- **ADR-214:** AI Permission for the New Knowledge Homes — shares always start AI-off.
- **ADR-216:** A Share Saves at Once to Thought of Them, with an Interactive Confirmation Card and the List Picker.
- **ADR-217:** Share Undo Also Removes a Contact the Share Created.
- **ADR-221:** Two Snackbar Looks — share Undo snackbars use the warning look.

## Gotchas

1. **Do not use the dashboard base predicate.** It excludes never-contacted contacts; capture filters only archived.
2. **Write before prompting.** The pending share can be reset when the app backgrounds, so the row exists before the card opens.
3. **Do not nest the write mutex.** Share wrappers compose non-mutexed cores inside one `inWriteTransaction`.
4. **Keep URLs canonical and separate.** Notes and display text never overwrite the stored URL.
5. **Rebuild and device-test native changes.** The manifest filter, Kotlin patch and finish bridge are invisible to a Metro reload.
6. **Keep inline capture Bound** with the shared monthly default.
7. **Blur before closing a focused field.** Save note, Skip and the New-contact sheet unmounted a focused field without a blur, so Android kept the keyboard and the next share's list was cut off; fixed by `Keyboard.dismiss()` before the field closes (plan 19, F1/F2).
8. **A share right after the previous card closes can be lost.** Within about 0.5 s of a card closing, a new share opens Digest and is dropped (release build, 2 of 8 tries); accepted as known (D-150).
9. **Classify every new contact-owned table for share Undo.** `SHARE_UNDO_OWNERSHIP` is checked against `pragma_foreign_key_list`; an unclassified table fails the test (ADR-217). `profile_contact_presentation` blocks only while a row holds a layout, a background or an open/closed choice; the all-default row a Profile "Reset to default" leaves reads exactly like no row and does not block (38.11 review WR-02).

## Related Systems

- **Contact knowledge** — owns the homes a share lands in and the move writer.
- **Contacts** — name-only creation and `purgeContactCore`.
- **App shell** — the migration gate, the Capture route and the resume-prompt gate.
- **Conversational fuel** — retired in 38.10; capture used to write `topic` fuel.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-16 | 10 | Created Android share-sheet capture with local contact selection and fuel writes. |
| 2026-08-16 | 12 | Added post-capture widget refresh publishing. |
| 2026-08-27 | 18.2 | Made inline name-only creation explicit about its Bound lifecycle contract. |
| 2026-10-11 | 38.9 | Back closes the innermost Capture surface first and prompts "Discard changes?" for a typed name or note instead of cancelling the share (D-33, ADR-200). |
| 2026-10-15 | 38.10 | Shares save at once to Thought of Them AI-off; interactive confirmation card (chips, Undo, Add note, Allow AI); list picker with search; share-recency over every home; atomic inline create with the monthly default; share Undo may remove a share-created contact; resume prompts suppressed during a share; no widget refresh (ADR-213..217, ADR-221). |
| 2026-10-16 | 38.11 | Share Undo: an all-default `profile_contact_presentation` row (left by a Profile "Reset to default") no longer blocks removing a share-created contact; any layout, background or open/closed choice still blocks (review WR-02/IN-02). |
