# Contact Methods

**Last updated:** 2026-08-16
**Updated by phase:** 11-actionable-notifications
**Owners:** `src/screens/ComposeScreen.tsx`, `src/logic/compose-logic.ts`, `src/db/contact-read.ts`, `src/db/fuel-read.ts`

## Purpose

The contact-methods system gives a user one local compose surface for turning conversational fuel into a message. It hands a user-authored draft to the OS SMS composer when possible and always provides a clipboard fallback; it neither sends silently nor records a contact interaction.

## Architecture

### Data Model

This system owns no SQLite table. It consumes a contact's nullable `contacts.phone` through the lightweight header read and eligible fuel through the existing ranked-fuel projection.

**Tables:**
- _None._

**Types** (`src/logic/compose-logic.ts` and `src/navigation/types.ts`):
- `ComposeControls` — resolved Send, Copy, add-number, and SMS-unavailable presentation state.
- `RootStackParamList["Compose"]` — serializable `{ contactId: number }` route contract.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Screen | `src/screens/ComposeScreen.tsx` | Self-fetches the contact and eligible fuel, holds the in-memory draft, and invokes native handoffs. |
| Logic | `src/logic/compose-logic.ts` | Purely resolves the phone/SMS capability matrix. |
| Contact read | `src/db/contact-read.ts` | Supplies the lightweight header, including phone and archive state. |
| Fuel read | `src/db/fuel-read.ts` | Supplies the ranked projection whose SQL excludes off-limits, unconfirmed-AI, and blank rows. |

### Key Files

| File | Role |
|---|---|
| `src/screens/ComposeScreen.tsx` | Read-only fuel reference, blank draft, handoff actions, and dashboard-directed Back behavior. |
| `src/logic/compose-logic.ts` | Node-tested Send/Copy emphasis and availability resolver. |
| `src/db/contact-read.ts` | Lightweight contact header source for phone and archive gating. |
| `src/db/fuel-read.ts` | Structural eligible-fuel boundary consumed unchanged by Compose. |
| `src/navigation/types.ts` | Serializable Compose-route parameter contract. |
| `src/navigation/RootNavigator.tsx` | Additive native-stack Compose registration. |
| `src/screens/ContactProfileScreen.tsx` | Initial Message entry point. |

## How It Works

### Composing and handing off a message

1. `ContactProfileScreen` navigates to `Compose` with only the contact id.
2. `ComposeScreen` reloads the header and all rows from `getRankedFuel()` on focus, while separately probing SMS availability.
3. Missing or archived contacts reset to Home; the ranked read keeps off-limits, unconfirmed-AI, and blank fuel out of the reference cards in SQL.
4. The user types a blank-starting local draft. With a phone and SMS capability, Send opens the OS composer with `expo-sms`; Copy uses `expo-clipboard` in every state.
5. Software and Android hardware Back both reset the stack to dashboard Home. Send and Copy never create a touchpoint or change `last_contact`.

### Entering Compose from a reminder

1. A decay notification body tap resets navigation onto Dashboard and `Compose { contactId }`.
2. Compose still performs its normal self-fetch and archive/phone gates; notification content carries no fuel snapshot.
3. Back retains the same Dashboard destination as every other Compose entry point.

## Configuration

| Constant | Value | File | Purpose |
|---|---|---|---|
| `smsAvailable` | `boolean \| null` | `src/screens/ComposeScreen.tsx` | Distinguishes an unknown capability probe from unavailable SMS so no wrong-state helper flashes. |

## Decisions

- **ADR-035:** Native SMS Handoff with Guaranteed Clipboard Copy — native SMS is best effort while Copy is always available.
- **ADR-036:** Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails — route reuse, structural fuel exclusions, archive gate, and Home-directed Back behavior.
- **ADR-040:** Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing — adds the decay reminder as a deterministic Compose entry point.

## Gotchas

1. **Do not construct an `sms:` URI.** `expo-sms` performs native recipient/body marshalling; a hand-built URI can corrupt the draft and has unreliable capability detection.
2. **Compose is not a touchpoint.** Do not write an interaction or `last_contact` after Send or Copy because Android cannot reliably confirm that the user sent the message.
3. **Use `getRankedFuel()`, not the editor read or a UI filter.** The compose surface is transmittable, so its privacy exclusion belongs in SQL.
4. **Native handoff needs a release rebuild.** `expo-sms` and `expo-clipboard` autolink without an app-config plugin, but a Metro reload cannot verify them.
5. **Notification bodies are not fuel previews.** A reminder opens Compose for live fuel instead of freezing fuel text into the OS shade.

## Related Systems

- **Contacts** — supplies phone and archive state for the live compose gate.
- **Conversational fuel** — supplies the eligible reference rows without exposing private material.
- **App shell** — owns the typed stack registration and dashboard Home destination.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-16 | 09 | Created the reusable Compose/SMS handoff surface with Copy fallback and structural privacy guards. |
| 2026-08-16 | 11 | Added decay-notification entry with Dashboard-rooted Back behavior. |
