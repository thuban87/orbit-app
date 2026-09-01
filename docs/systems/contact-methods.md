# Contact Methods

**Last updated:** 2026-08-24
**Updated by phase:** 17-backup-export-restore
**Owners:** `src/screens/ComposeScreen.tsx`, `src/logic/compose-logic.ts`, `src/db/contact-read.ts`, `src/db/fuel-read.ts`, `src/db/contact-links-dao.ts`

## Purpose

The contact-methods system gives a user one local compose surface for turning conversational fuel into a message. It hands a user-authored draft to the OS SMS composer when possible and always provides a clipboard fallback; it neither sends silently nor records a contact interaction.

## Architecture

### Data Model

This system consumes a contact's nullable `contacts.phone` through the lightweight header read and eligible fuel through the existing ranked-fuel projection. It also owns the ordered, user-managed `contact_links` reachability records.

**Tables:**
- `contact_links` — uid-bearing, ordered web links belonging to a contact.

**Types** (`src/logic/compose-logic.ts` and `src/navigation/types.ts`):
- `ComposeControls` — resolved Send, Copy, add-number, and SMS-unavailable presentation state.
- `RootStackParamList["Compose"]` — serializable `{ contactId, requestAiSuggestion? }` route contract.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Screen | `src/screens/ComposeScreen.tsx` | Self-fetches the contact and eligible fuel, holds the in-memory draft, and invokes native handoffs. |
| Logic | `src/logic/compose-logic.ts` | Purely resolves the phone/SMS capability matrix. |
| AI lifecycle | `src/logic/ai-suggestion-logic.ts` | Owns one cancellable, acknowledgement-gated suggestion request. |
| Contact read | `src/db/contact-read.ts` | Supplies the lightweight header, including phone and archive state. |
| Fuel read | `src/db/fuel-read.ts` | Supplies the ranked projection whose SQL excludes off-limits, unconfirmed-AI, and blank rows. |
| Link DAO | `src/db/contact-links-dao.ts` | Owns ordered link create, edit, and merge-safe removal. |

### Key Files

| File | Role |
|---|---|
| `src/screens/ComposeScreen.tsx` | Read-only fuel reference, blank draft, handoff actions, and dashboard-directed Back behavior. |
| `src/logic/compose-logic.ts` | Node-tested Send/Copy emphasis and availability resolver. |
| `src/logic/ai-suggestion-logic.ts` | Timeout, cancellation, stale-result, acknowledgement, and replacement-confirmation lifecycle. |
| `src/db/contact-read.ts` | Lightweight contact header source for phone and archive gating. |
| `src/db/fuel-read.ts` | Structural eligible-fuel boundary consumed unchanged by Compose. |
| `src/navigation/types.ts` | Serializable Compose-route parameter contract. |
| `src/navigation/RootNavigator.tsx` | Additive native-stack Compose registration. |
| `src/screens/ContactProfileScreen.tsx` | Initial Message entry point. |
| `src/db/contact-links-dao.ts` | Persists contact-owned web links and tombstones a hard removal. |

## How It Works

### Composing and handing off a message

1. `ContactProfileScreen` navigates to `Compose` with only the contact id.
2. `ComposeScreen` reloads the header and all rows from `getRankedFuel()` on focus, while separately probing SMS availability.
3. Missing or archived contacts reset to Home; the ranked read keeps off-limits, unconfirmed-AI, and blank fuel out of the reference cards in SQL.
4. The user types a blank-starting local draft. With a phone and SMS capability, Send opens the OS composer with `expo-sms`; Copy uses `expo-clipboard` in every state.
5. Software and Android hardware Back both reset the stack to dashboard Home. Send and Copy never create a touchpoint or change `last_contact`.

### Turning an AI suggestion into a draft

1. Compose can be opened with a profile-originated `requestAiSuggestion` intent, which it consumes once after loading the live contact.
2. The AI lifecycle reads only approved context, resolves one immutable prompt, and displays it before a provider's first request. A durable acknowledgement completes before the request begins.
3. One lifecycle owns the abort controller and timeout. Cancel, navigation, configuration changes, and stale completion leave the editor unchanged; a failed request offers only deliberate retry.
4. A returned suggestion fills an empty draft. If a local draft already has text, Compose asks before replacement, then retains the normal user-controlled Send and Copy handoffs.

### Entering Compose from a reminder

1. A decay notification body tap resets navigation onto Dashboard and `Compose { contactId }`.
2. Compose still performs its normal self-fetch and archive/phone gates; notification content carries no fuel snapshot.
3. Back retains the same Dashboard destination as every other Compose entry point.

### Reconciling contact links

1. A link removal captures its stable UID, inserts `contact_link` deletion evidence, then removes the row in its existing transaction.
2. Backup restoration applies a link only when its contact UID survives reconciliation.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `smsAvailable` | `boolean \| null` | `src/screens/ComposeScreen.tsx` | Distinguishes an unknown capability probe from unavailable SMS so no wrong-state helper flashes. |

## Decisions

- **ADR-035:** Native SMS Handoff with Guaranteed Clipboard Copy — native SMS is best effort while Copy is always available.
- **ADR-036:** Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails — route reuse, structural fuel exclusions, archive gate, and Home-directed Back behavior.
- **ADR-040:** Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing — adds the decay reminder as a deterministic Compose entry point.
- **ADR-052:** Compose-Owned AI Draft Lifecycle and Acknowledged Egress — makes AI output an acknowledged, cancellable, editable draft without a contact write.
- **ADR-056:** Tombstone-Backed UID Reconciliation for Portable Restores — protects hard-deleted contact links from older snapshots.
- **ADR-057:** Full-State Versioned Backups with Verified Manual and Foreground SAF Snapshots — includes contact links in the complete portable manifest.

## Gotchas

1. **Do not construct an `sms:` URI.** `expo-sms` performs native recipient/body marshalling; a hand-built URI can corrupt the draft and has unreliable capability detection.
2. **Compose is not a touchpoint.** Do not write an interaction or `last_contact` after Send or Copy because Android cannot reliably confirm that the user sent the message.
3. **Use `getRankedFuel()`, not the editor read or a UI filter.** The compose surface is transmittable, so its privacy exclusion belongs in SQL.
4. **Native handoff needs a release rebuild.** `expo-sms` and `expo-clipboard` autolink without an app-config plugin, but a Metro reload cannot verify them.
5. **Notification bodies are not fuel previews.** A reminder opens Compose for live fuel instead of freezing fuel text into the OS shade.
6. **An AI result is not proof of contact.** Generation, acknowledgement, Cancel, replacement confirmation, Send, and Copy must not create a touchpoint or alter `last_contact`.
7. **Do not overwrite a non-empty draft silently.** The result-time confirmation protects user text even when the request began from an empty-state expectation.
8. **Remove links with a tombstone.** The compositional edit-form diff path must use the same caller-supplied timestamp and transaction as standalone removal.

## Related Systems

- **Contacts** — supplies phone and archive state for the live compose gate.
- **Conversational fuel** — supplies the eligible reference rows without exposing private material.
- **App shell** — owns the typed stack registration and dashboard Home destination.
- **AI suggestions** — provides the privacy-bounded context, provider request, and exact-prompt acknowledgement that Compose owns as its draft flow.
- **Backup & Restore** — exports link identity and applies it only beneath a surviving contact.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-16 | 09 | Created the reusable Compose/SMS handoff surface with Copy fallback and structural privacy guards. |
| 2026-08-16 | 11 | Added decay-notification entry with Dashboard-rooted Back behavior. |
| 2026-08-18 | 14 | Added the acknowledged, cancellable AI suggestion flow as an editable Compose draft. |
| 2026-08-24 | 17 | Added tombstone-backed removal and portable reconciliation for contact links. |
