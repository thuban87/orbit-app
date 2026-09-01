# Capture

**Last updated:** 2026-08-16
**Updated by phase:** 10-share-sheet-capture
**Owners:** `src/db/capture-read.ts`, `src/db/capture-dao.ts`, `src/logic/capture-logic.ts`, `src/screens/CaptureScreen.tsx`

## Purpose

Capture lets another Android app file shared text or a link as Conversational Fuel for a chosen contact. It keeps the whole path local: the picker reads on-device SQLite, writes durable fuel before optional refinement, and returns the user to the sharing app without recording an interaction.

## Architecture

### Data Model

Capture owns no table or migration. It composes existing local SQLite data: `contacts` supplies live picker targets, while `fuel` stores one independently owned captured row per chosen contact.

**Tables:**

- `contacts` — supplies picker identity, archived state, favourite rank, avatar, and name.
  - `archived_at` (`TEXT nullable`) — excludes archived contacts while retaining never-contacted people.
  - `favourite_rank` (`INTEGER nullable`) — creates the first picker band.
- `fuel` — stores the captured items.
  - `contact_id` (`INTEGER`) — remains non-null; capture has no inbox.
  - `kind` (`TEXT`) — capture writes `topic`.
  - `text` (`TEXT nullable`) — holds the resolved title or shared prose, optionally recomposed with a note.
  - `url` (`TEXT nullable`) — retains the canonical first shared URL independently from editable prose.
  - `source` (`TEXT`) — capture writes `share`.
  - `created_at` (`TEXT`) — supplies the derived capture-MRU ordering.

**Types** (`src/db/capture-read.ts`, `src/db/capture-dao.ts`, and `src/logic/capture-logic.ts`):

- `CapturePickRow` — one non-archived contact tile, including the derived last-captured timestamp.
- `CaptureInput` and `CapturePayload` — the pure payload boundary between Android share data and a fuel row.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Pure logic | `src/logic/capture-logic.ts` | Resolves display text and canonical URL, including `note — base` composition and blank normalization. |
| DAO reader | `src/db/capture-read.ts` | Lists favourites, then capture-MRU, then remaining non-archived contacts without a write mutex. |
| DAO writer | `src/db/capture-dao.ts` | Atomically fans out independent fuel rows and applies multi-row text-only notes. |
| UI | `src/screens/CaptureScreen.tsx` | Drains the pending intent, renders the picker, and coordinates single, multi, note, and inline-create paths. |
| Native integration | `app.config.ts`, `patches/expo-share-intent+8.0.1.patch`, `modules/orbit-share-finish/` | Registers the narrow Android share target, exposes Chrome titles, and returns to the source app. |

### Key Files

| File | Role |
|---|---|
| `src/logic/capture-logic.ts` | Pure title/prose/note to `{ displayText, url }` resolver. |
| `src/db/capture-read.ts` | Favourites → capture-MRU → rest query, with archived contacts excluded. |
| `src/db/capture-dao.ts` | One-transaction multi-attach and multi-note composers over fuel cores. |
| `src/screens/CaptureScreen.tsx` | In-app grid picker, confirmation, search, multi-select, and inline name-only create. |
| `app.config.ts` | Registers the `text/plain` plugin tuple and `orbit` scheme. |
| `src/navigation/linking.ts` | Ready-gated, single-owner pending-share navigation to Capture. |
| `modules/orbit-share-finish/android/src/main/java/expo/modules/orbitsharefinish/OrbitShareFinishModule.kt` | Calls plain `Activity.finish()` after capture. |

## How It Works

### Receiving and routing a share

1. Android sends a `text/plain` intent to the patched `expo-share-intent` integration; the patch reads `EXTRA_SUBJECT` before `EXTRA_TITLE`.
2. `ShareIntentProvider` retains the pending payload while the app finishes migrations.
3. `ShareIntentGate` waits for the navigator readiness state and navigates to Capture as the sole share-intent consumer.
4. `CaptureScreen` resolves the payload locally; an empty display and URL produces a cancel-only error state.

### Picking one or more contacts

1. `listCapturePickContacts` reads contacts with `archived_at IS NULL`, so never-contacted contacts remain eligible.
2. The query sorts favourites first, then `MAX(fuel.created_at)` capture-MRU, then names; no rank column is stored.
3. A tap writes one `topic`/`share` fuel row before any note surface appears. A long-press selects several contacts and `captureMultiAttach` writes one independent row per contact in one transaction.
4. Capture never writes `last_contact` or an interaction row, so it does not affect relationship status.

### Refining or creating after selection

1. An optional note recomposes the display text as `note — base`; it changes `fuel.text` only and leaves `url` and `created_at` intact.
2. `captureMultiNote` applies the same note atomically to every selected row; the single-row path uses the scoped fuel editor.
3. The New contact tile uses the existing name-only contact create path with no first interaction, then writes the captured fuel row to the new never-contacted contact.
4. Confirmation uses a short timeout before the native finish bridge returns to the app that shared the content.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `AUTO_RETURN_MS` | `1500` | `src/screens/CaptureScreen.tsx` | Confirmation window before return to the source app. |
| Android intent filter | `text/plain` only | `app.config.ts` | Limits capture to supported payloads and leaves multi-item capture unregistered. |

## Decisions

- **ADR-037:** Text-Only Android Share Intent Integration — keeps the native filter, title patch, ready gate, and return path explicit.
- **ADR-038:** Contact-Owned Share Capture Fuel — preserves non-null ownership, canonical URLs, immediate fuel writes, and no-touchpoint semantics.

## Gotchas

1. **Do not use the dashboard base predicate.** It excludes `last_contact IS NULL` contacts; capture must use only the archived filter.
2. **Write before prompting.** The pending share can be reset when the app backgrounds, so the fuel row must exist before an optional note is opened.
3. **Do not nest the write mutex.** Multi-attach and multi-note compose non-mutexed fuel cores inside one outer transaction.
4. **Keep URLs canonical and separate.** Notes and editable display text must never overwrite `fuel.url`.
5. **Rebuild and device-test native changes.** The manifest filter, Kotlin title patch, and finish bridge are invisible to a Metro reload; the optional-note controls can be obscured by the soft keyboard and remain a deferred polish item.

## Related Systems

- **Conversational fuel** — owns the durable rows and ranked projections capture composes.
- **Contacts** — supplies picker targets and the name-only, never-contacted creation path.
- **App shell** — preserves the migration gate and hosts the ready-gated Capture route.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-16 | 10 | Created Android share-sheet capture with local contact selection and fuel writes. |
