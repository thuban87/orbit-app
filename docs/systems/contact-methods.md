# Contact Methods

**Last updated:** 2026-08-31
**Updated by phase:** 21-interaction-assist-reach-out
**Owners:** `src/db/contact-methods-dao.ts`, `src/db/contact-methods-read.ts`, `src/logic/contact-method-normalization.ts`, `src/screens/ComposeScreen.tsx`, `src/logic/compose-logic.ts`

## Purpose

The contact-methods system stores ordered phone and email endpoints as local-first, mergeable contact data. It separates presentation from canonical actionability, retains incomplete values for editing, and supplies the selected actionable primary phone to the existing Compose/SMS handoff without sending or recording an interaction.

## Architecture

### Data Model

Migration 009 retires scalar contact phone/email storage. Migration 010 adds nullable durable labels; `contact_links` remains the separate ordered web-link collection.

**Tables:**
- `contact_links` — uid-bearing, ordered web links belonging to a contact.
- `contact_methods` — uid-bearing phone/email rows owned by a contact.
  - `type`, `label`, `display_order`, `is_primary` — method grouping, optional durable label, stable order, and one primary per type.
  - `raw_value`, `canonical_value`, `canonical_region`, `extension`, and `actionable` — retained presentation, machine identity/provenance, and safe handoff eligibility.

**Types** (`src/logic/compose-logic.ts` and `src/navigation/types.ts`):
- `ComposeControls` — resolved Send, Copy, add-number, and SMS-unavailable presentation state.
- `RootStackParamList["Compose"]` — serializable `{ contactId, requestAiSuggestion? }` route contract.

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|---|---|---|
| Screen | `src/screens/ComposeScreen.tsx` | Self-fetches the contact and eligible fuel, holds the in-memory draft, and invokes native handoffs. |
| Normalizer | `src/logic/contact-method-normalization.ts` | Produces conservative phone/email canonical and actionability outcomes. |
| Method DAO | `src/db/contact-methods-dao.ts` | Applies transactional ordered drafts, primary promotion, collision handling, and tombstones. |
| Method read | `src/db/contact-methods-read.ts` | Returns ordered groups and the selected actionable effective primary. |
| Logic | `src/logic/compose-logic.ts` | Resolves the actionable-primary/SMS capability matrix. |
| AI lifecycle | `src/logic/ai-suggestion-logic.ts` | Owns one cancellable, acknowledgement-gated suggestion request. |
| Contact read | `src/db/contact-read.ts` | Supplies the scalar-free lightweight header and archive state. |
| Fuel read | `src/db/fuel-read.ts` | Supplies the ranked projection whose SQL excludes off-limits, unconfirmed-AI, and blank rows. |
| Link DAO | `src/db/contact-links-dao.ts` | Owns ordered link create, edit, and merge-safe removal. |

### Key Files

| File | Role |
|---|---|
| `src/screens/ComposeScreen.tsx` | Read-only fuel reference, blank draft, handoff actions, and dashboard-directed Back behavior. |
| `src/logic/compose-logic.ts` | Node-tested Send/Copy emphasis and availability resolver. |
| `src/logic/contact-method-normalization.ts` | Shared canonicalization, extension, and actionability boundary. |
| `src/db/contact-methods-dao.ts` | Transactional normalized method write boundary. |
| `src/db/contact-methods-read.ts` | Ordered method-group and actionable-primary read boundary. |
| `src/logic/ai-suggestion-logic.ts` | Timeout, cancellation, stale-result, acknowledgement, and replacement-confirmation lifecycle. |
| `src/db/contact-read.ts` | Lightweight scalar-free contact header and archive gate. |
| `src/db/fuel-read.ts` | Structural eligible-fuel boundary consumed unchanged by Compose. |
| `src/navigation/types.ts` | Serializable Compose-route parameter contract. |
| `src/navigation/RootNavigator.tsx` | Additive native-stack Compose registration. |
| `src/screens/ContactProfileScreen.tsx` | Initial Message entry point. |
| `src/db/contact-links-dao.ts` | Persists contact-owned web links and tombstones a hard removal. |

## How It Works

### Composing and handing off a message

1. `ContactProfileScreen` navigates to `Compose` with only the contact id.
2. `ComposeScreen` reloads the header, the DAO-selected actionable primary phone, and all rows from `getRankedFuel()` on focus, while separately probing SMS availability.
3. Missing or archived contacts reset to Home; the ranked read keeps off-limits, unconfirmed-AI, and blank fuel out of the reference cards in SQL.
4. The user types a blank-starting local draft. With an actionable primary phone and SMS capability, Send routes through the shared `performReachOut` (`src/services/reach-out/handoff.ts`), which — when Interaction Assist is enabled — writes a pending assist before opening the OS composer with `expo-sms`; Copy uses `expo-clipboard` in every state.
5. Software and Android hardware Back both reset the stack to dashboard Home. Send and Copy never create a touchpoint or change `last_contact`; the interaction, if any, is written later when the user confirms the assist banner (see `interaction-assist.md`).

The actionable-primary selection (`selectActionablePrimaryMethods` in `src/db/contact-methods-read.ts`) is exported as a pure function so the Reach Out router reuses it directly from already-loaded method groups, with no second query.

### Writing and selecting methods

1. Create and edit forms submit ordered method drafts to the contact aggregate writer, which composes the method DAO inside the outer contact transaction.
2. The normalizer retains nonblank invalid values as non-actionable, canonicalizes valid phones and conservative emails, and records a phone's canonicalization region without auto-rewriting it later.
3. The DAO clears a changing primary before promotion, promotes the next ordered row when a primary is removed, and returns same-contact canonical collisions as typed feedback; shared canonical values across contacts remain legal.
4. Profile displays stored formatted values, labels, extensions, and invalid helpers. It does not reparse raw input; Compose receives only the read owner's actionable primary destination.

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

### Matching imported source methods

1. Contact Import canonicalizes an accepted phone or email with the stored session region before it queries `canonical_value` evidence.
2. An active external source link is deterministic identity; every other endpoint match remains advisory, and correlated signals from one source record contribute only their strongest signal.
3. An explicit import create or link writes source link and method provenance in the same transaction as the resolved import row.

### Consolidating methods during a contact merge

1. `mergeContacts()` compares method type plus canonical value, collapses identical endpoints, and reparents distinct endpoints to the chosen survivor.
2. When both contacts contribute competing primary methods of one type, the merge-conflict surface requires an explicit primary selection; otherwise the surviving ordering rules select the primary.
3. Reconciliation uses the same canonical identity for source comparison, but a v1 reconciliation-added method does not create a provenance row.

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
- **ADR-059:** Normalized Contact Methods, Canonical Actionability, and Local Provenance — establishes ordered, mergeable phone/email methods as the sole endpoint authority.
- **ADR-061:** DAO-Selected Actionable Primary SMS Handoff — gates native SMS on the stored actionable primary while retaining Copy fallback.
- **ADR-067:** Conservative Advisory Identity Matching and Explicit Source Consolidation — makes canonical endpoint evidence advisory unless an active source link identifies the contact.
- **ADR-068:** User-Triggered, Source-Only Reconciliation with Durable Review — compares methods canonically without making a source authoritative.
- **ADR-069:** Atomic Tombstone-Backed Orbit Contact Merge — deduplicates compatible methods and requires a choice for competing primaries.
- **ADR-072:** Shared Actionable Reach Out Router with Native Channel Handoff — reuses the actionable-primary selection and routes Compose Send through the shared handoff without a send-time interaction write.

## Gotchas

1. **Do not construct an `sms:` URI.** `expo-sms` performs native recipient/body marshalling; a hand-built URI can corrupt the draft and has unreliable capability detection.
2. **Compose is not a touchpoint.** Do not write an interaction or `last_contact` after Send or Copy because Android cannot reliably confirm that the user sent the message. Send now creates a pending Interaction Assist and hands off; the interaction is written only if the user later confirms the assist banner.
3. **Use `getRankedFuel()`, not the editor read or a UI filter.** The compose surface is transmittable, so its privacy exclusion belongs in SQL.
4. **Native handoff needs a release rebuild.** `expo-sms` and `expo-clipboard` autolink without an app-config plugin, but a Metro reload cannot verify them.
5. **Notification bodies are not fuel previews.** A reminder opens Compose for live fuel instead of freezing fuel text into the OS shade.
6. **An AI result is not proof of contact.** Generation, acknowledgement, Cancel, replacement confirmation, Send, and Copy must not create a touchpoint or alter `last_contact`.
7. **Do not overwrite a non-empty draft silently.** The result-time confirmation protects user text even when the request began from an empty-state expectation.
8. **Remove links with a tombstone.** The compositional edit-form diff path must use the same caller-supplied timestamp and transaction as standalone removal.
9. **Do not reparse at an action surface.** Profile and Compose consume stored DAO actionability; a raw value can be visible yet remain non-actionable.
10. **Do not treat a shared canonical value as identity proof.** Same-contact duplicates collapse, but different contacts may retain the same phone or email.
11. **Import evidence is not a primary-method selection.** Canonical matching informs an explicit import resolution but does not rewrite an existing contact's ordered methods.
12. **Resolve primaries before reparenting a merge.** The partial primary-per-type index rejects a naïve child update when both contacts own a primary.

## Related Systems

- **Contacts** — owns the aggregate create/edit transaction and scalar-free archive gate.
- **Conversational fuel** — supplies the eligible reference rows without exposing private material.
- **App shell** — owns the typed stack registration and dashboard Home destination.
- **AI suggestions** — provides the privacy-bounded context, provider request, and exact-prompt acknowledgement that Compose owns as its draft flow.
- **Backup & Restore** — exports link identity and applies it only beneath a surviving contact.
- **Contact Import** — uses canonical endpoints, source links, and provenance for conservative selected-contact import.
- **Contact Reconciliation** — compares canonical endpoint families and consolidates compatible methods during an explicit merge.
- **Interaction Assist & Reach Out** — reuses the actionable-primary selection for its router and takes Compose Send through the shared native handoff.

## Changelog

| Date | Phase | What Changed |
|---|---|---|
| 2026-08-16 | 09 | Created the reusable Compose/SMS handoff surface with Copy fallback and structural privacy guards. |
| 2026-08-16 | 11 | Added decay-notification entry with Dashboard-rooted Back behavior. |
| 2026-08-18 | 14 | Added the acknowledged, cancellable AI suggestion flow as an editable Compose draft. |
| 2026-08-24 | 17 | Added tombstone-backed removal and portable reconciliation for contact links. |
| 2026-08-27 | 18.1 | Added normalized phone/email methods, durable labels, provenance, and actionable-primary Compose gating. |
| 2026-08-26 | 19 | Added canonical source-method evidence and transactional import provenance. |
| 2026-08-26 | 20 | Added canonical reconciliation comparison and explicit primary-method merge resolution. |
| 2026-08-31 | 21 | Compose Send routes through the shared `performReachOut` (pending assist, no send-time interaction); the actionable-primary selection is reused by the Reach Out router. |
