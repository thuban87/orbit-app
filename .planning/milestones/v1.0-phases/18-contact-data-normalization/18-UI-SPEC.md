---
phase: 18
slug: contact-data-normalization
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-26
---

# Phase 18 — Contact Data Normalization UI Design Contract

> Contract for normalized phone/email methods and the Bound/Unbound lifecycle. It extends the existing React Native interface only; source selection, import, reconciliation, generic sync, and Interaction Assist remain out of scope.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — React Native / Expo; shadcn gate is not applicable |
| Preset | not applicable |
| Component library | none — bespoke React Native primitives and shared in-repo components |
| Icon library | none — use established text glyphs only; do not add an icon package |
| Font | System default |
| Colour source | `src/theme/theme-presets.ts`, active `space-dark`; resolve all colours through `useTheme().colors.*` |
| Reuse | `FrequencyPicker`, `LinksEditor` card/draft model, `DropdownFieldWidget` modal picker, Never Contacted/Archived chrome; use `ContactCard` only for Bound status-bearing rows |

No UI registry, raw colour, custom font, or web component library. Every control has a 44px minimum touch target and descriptive accessibility label/state plus a stable `testID`.

---

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline label/badge gap |
| sm | 8px | Field-label, compact-row, and chip gaps |
| md | 16px | Row/card padding, header gap, field-group gap, and screen padding |
| lg | 24px | Major section and empty-state break |
| xl | 32px | Large section break |
| 2xl | 48px | Prominent empty-state separation |
| 3xl | 64px | Maximum planned section separation |

Use only this scale for layout spacing. The 44px minimum height/width for icon-only controls is an accessibility exception; existing input/back and modal-sheet corner radii are geometric treatment, not spacing tokens.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Helper / section label | 13px | 600 | 18px |
| Body / input / method value | 15px | 400 | 21px when multiline |
| Row label / primary action | 16px | 600 | default |
| Screen title | 24px | 600 | default |

Use only 400 (regular) and 600 (semibold). Helper/error copy wraps; do not reduce below 13px. Method values and names tail-ellipsis only when a row action requires room, with a complete accessibility label.

---

## Color

| Role | Token | Usage |
|------|-------|-------|
| Dominant (60%) | `background` | Screen roots and unfilled secondary controls |
| Secondary (30%) | `surface` | Method cards, lifecycle/settings rows, Unbound-list rows |
| Secondary support | `surfaceElevated` | Existing picker sheet and Switch thumb only |
| Accent (10%) | `accent` | Save/Bind CTA, selected primary method/picker option, add-method links, enabled Switch track |
| Destructive | `danger` | Invalid-method helper and native destructive Alert action only |
| Supporting | `textSecondary` / `border` | Labels, dormant-state marker, explanatory copy, outlines |

Accent is reserved for **Save contact**, **Bind contact**, selected primary-method state, selected region, enabled Switch track, and **+ Add phone number** / **+ Add email address**. It is not a general tint for rows. Existing status colours remain Bound-only; no status hue, `danger`, or rogue token represents Unbound.

---

## Screen and Interaction Contract

### Create contact — lifecycle choice and methods

Keep existing scroll-form chrome: Back + **New contact**, 16px padding, Name and Category first. Add **Orbit participation** before cadence and contact methods.

- **Primary create/edit focal point and scan order:** after the standard title/name/category context, lead the eye through **Orbit participation** (Bound/Unbound) → the required cadence and visible phone/email method content that choice determines → the filled **Save contact** CTA. Save contact is the sole strong action; all other controls remain secondary or quiet.
- Render 44px segmented/chip options **Bound** and **Unbound**; Bound is selected by default. Helpers: **“Bound contacts appear in your active orbit and receive cadence reminders.”** and **“Unbound contacts keep their details and history without active cadence reminders.”** Use selected accessibility state; never show `tracking_enabled`.
- Bound shows the existing FrequencyPicker and cannot save without a positive cadence. Unbound hides Frequency when it has never been assigned; it may save with no cadence and zero methods.
- Replace the singular Phone input with **Phone numbers**. Create begins with one empty phone row only where the old form showed Phone; discard that blank row on Save. A no-method contact is valid.
- The filled primary CTA is **Save contact**, enabled only for a name, valid displayed cadence requirements, and valid custom fields. Disable it while saving.

### Edit contact — ordered method groups

Replace existing Phone and Email fields in their current fixed-block position with **Phone numbers**, then **Email addresses**, before Links. Changes remain local drafts until **Save contact**; Back/cancel discards all method additions, edits, removals, and primary changes.

- Empty group copy: **“No phone numbers yet”** / **“No email addresses yet”**, followed by accent **“+ Add phone number”** / **“+ Add email address”**.
- Each populated group renders durable stored-order `surface`/`border` cards using the LinksEditor model: standard label picker (Mobile, Home, Work, Main, Other) with custom-label option, value input, 44px Remove action, and optional phone **Extension** input. Use phone-pad for phone; email keyboard with no autocorrect/capitalization for email.
- Show **Primary** selector only when two or more rows of a type exist. It selects that row and clears the local draft's other primary. With one row, show quiet **Primary** text instead. Removing current primary promotes the next displayed row automatically. No drag handle or reorder gesture ships in this phase.
- Non-actionable rows stay editable/savable. Phone helper: **“This number can’t be used for calls or messages yet.”** Email helper: **“This email address can’t be used yet.”** Do not reject, erase, or expose parsing detail. Extension is data/presentation only—never an auto-dial control.
- On Save, a canonical duplicate of the same method type on the same contact collapses to the existing draft row and retains its order. Show non-blocking copy: **“This matches an existing {phone number/email address}; only one will be kept.”** Do not warn about a matching method on another contact.
- Remove is immediate but needs no alert because it is reversible until Save, matching LinksEditor. A failed save retains the full draft for retry; removed methods create no endpoint-history UI.

### Profile — methods and lifecycle

Add **Contact methods** below **Add details** and above message actions. Show only non-empty type groups, phone first then email.

- A row has label, formatted display value, quiet **Primary** marker where applicable, and extension after phone. Long value ellipsizes with full a11y label. Non-actionable rows show the same helper and no Call/Text/Email control.
- Compose reads the primary actionable phone only. When none exists, retain its Copy-first fallback and add-number affordance. Do not add a method chooser, endpoint router, or endpoint-specific interaction history.
- Bound profiles retain current status, intensity, favourite star, snooze/cadence controls, and message/log hierarchy. Add secondary outlined 44px **Unbind contact** in the lifecycle area below active-management controls, never beside Archive.
- Unbound profiles lead with a quiet `surface` lifecycle panel: heading **“Unbound”**, body **“This contact isn’t in your active orbit. Their details and history are still here.”**, and filled **Bind contact** CTA. A dormant positive cadence binds immediately. If cadence was never assigned, reveal FrequencyPicker below the panel and disable Bind until a positive cadence is selected.
- While Unbound hide favourite star, status/rogue label, intensity, Snooze reminders, and every cadence-derived status treatment. Keep profile/history, gravity, custom fields, birthday, fuel, Archive, and explicit AI draft. Never claim a paused/reset elapsed status.
- Unbind confirmation is native Alert: **“Unbind {name}?”** / **“This removes them from your active orbit, reminders, favourites, and widgets. Their history, details, and saved cadence stay.”** Actions **Keep contact bound** and destructive-styled **Unbind contact**. On success refresh Profile. `favourite_rank` stays dormant and is restored by Bind.

### Dedicated Unbound population and search

Add **Unbound contacts** dashboard-footer sibling after **Not yet contacted** and before **Archived**. It is a 44px `surface`/`border` entry, always visible including zero, labelled **“Unbound contacts ({N})”** and routes to `UnboundContacts`.

The **Unbound contacts** screen mirrors Never Contacted/Archived: Back + 24px title, 16px root padding, and count line when populated (`1 unbound contact` / `{N} unbound contacts`). Alphabetical rows have avatar, one-line name, optional category, and quiet **Unbound** label. They use `surface`/`border`, no status ring/favourite/cadence/action button, and tap to Profile.

- Empty heading: **“No unbound contacts”**.
- Empty body: **“Contacts you unbind stay here, with their details and history ready when you want to bind them again.”**
- Dashboard search may return Unbound contacts: use the same neutral Unbound label and no status ring/favourite. Search is retrieval. Ordinary dashboard population/filters, Orrery, and favourite/widget reads remain Bound-only.

### Settings

Add these rows using the existing Settings section/row shell.

1. **Contact methods** section: **Phone number region**. Value is selected region (for example “United States (US)”) or **“Use device region”**. Helper: **“Used to format phone numbers entered without a country code.”** Tap opens the existing DropdownFieldWidget-style modal: title **“Phone number region”**, search input, scrollable region-name/code list, and top **Use device region** option. Selection closes it and affects later edits only; it never changes saved method identity.
2. **Home screen** section: Switch **Include unbound in Not yet contacted**, default OFF. Helper: **“Show unbound contacts with no history in the Not yet contacted list.”**
3. Immediately after **Birthday alerts**: master-gated Switch **Birthday alerts for unbound contacts**, default ON. Helper: **“Keep birthday reminders on for contacts outside your active orbit.”**

Switches reuse `trackColor={{ false: border, true: accent }}` and `thumbColor: surfaceElevated`. Do not expose source links, provenance, stale-source, import, merge, or reconciliation controls in Phase 18.

### Streamlined Export

On the existing Backup screen, add a separately labelled 44px `surface`/`border` row after the full recovery export controls: **Streamlined Export**. Accessibility label: **“Share a streamlined contact export”**. Helper copy: **“Share names, categories, and primary contact details. This is not a backup.”** The full recovery action keeps its existing backup/export label and state independently.

- Empty: when no contact has an actionable primary phone or email, show **“No shareable contact details yet.”** and keep the action disabled with accessibility state `disabled`.
- Loading: while the narrow artifact is being assembled or handed to the native share sheet, show **“Preparing Streamlined Export…”**, disable repeated taps, and preserve full backup controls.
- Success: after the native share request resolves, show the existing transient success posture with **“Streamlined Export ready to share.”**; do not describe it as backup or recovery.
- Error: retain screen state and show **“Couldn’t create Streamlined Export. Please try again.”** with the normal retry affordance. A share failure never changes full-backup health or availability.
- Artifact identity is fixed: filename prefix `orbit-streamlined-export-`, `.txt` extension, `text/plain` MIME type, and native share-sheet title **“Share Streamlined Export”**. None may contain **“backup”**. The content may contain only name, category, and formatted actionable primary phone/email values; it never includes secondary, invalid, raw, canonical, extension, source, provenance, or recovery-graph data.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Lifecycle options | **Bound** / **Unbound** |
| Bound helper | **Bound contacts appear in your active orbit and receive cadence reminders.** |
| Unbound helper | **Unbound contacts keep their details and history without active cadence reminders.** |
| Primary CTA | **Save contact** / **Bind contact** where lifecycle panel is active |
| Method empty / add | **No phone numbers yet** / **No email addresses yet**; **+ Add phone number** / **+ Add email address** |
| Invalid methods | **This number can’t be used for calls or messages yet.** / **This email address can’t be used yet.** |
| Duplicate helper | **This matches an existing {phone number/email address}; only one will be kept.** |
| Unbound panel | **Unbound** — **This contact isn’t in your active orbit. Their details and history are still here.** |
| Unbound-list empty | **No unbound contacts** — **Contacts you unbind stay here, with their details and history ready when you want to bind them again.** |
| Error | **Couldn’t load contacts. Please go back and retry.** / **Couldn’t save contact. Please try again.** |
| Unbind confirm | **Unbind {name}?** — **This removes them from your active orbit, reminders, favourites, and widgets. Their history, details, and saved cadence stay.** |
| Destructive confirmation | Unbind uses native **Keep contact bound** / destructive **Unbind contact**. Method removal is reversible local draft editing until Save and needs no separate confirmation. |
| Streamlined Export | **Streamlined Export** — **Share names, categories, and primary contact details. This is not a backup.** |
| Streamlined Export empty | **No shareable contact details yet.** |
| Streamlined Export loading / success / error | **Preparing Streamlined Export…** / **Streamlined Export ready to share.** / **Couldn’t create Streamlined Export. Please try again.** |

Tone is plain, kind, and specific: Unbound is valid, not an error or incomplete setup. Never expose canonical/E.164 data, opaque external IDs, parser internals, or schema terminology.

---

## UI Considerations

Applicable state considerations resolved: **30 explicit, 5 backstop, 0 unresolved.**

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Phone/email editor | ✅ covered | Type-specific no-method copy plus Add affordance; zero methods is valid. |
| loading | Create/edit form | ✅ covered | Keep existing load guard; do not show false empty methods before reads resolve. |
| error | Create/edit form | ✅ covered | Retain local drafts and show documented retry copy. |
| partial | Phone/email editor | ✅ covered | Each type is independent; invalid storable rows remain visible with helper. |
| overflow | Phone/email editor | 🧪 backstop | Device UAT: many cards, labels/extensions, keyboard scroll, Save reachable. |
| long-text | Values/custom labels | 🧪 backstop | At 320dp verify ellipsis/full a11y label and wrapped helpers. |
| empty | Profile methods | ✅ covered | Omit entire section when both types are absent. |
| loading | Profile lifecycle/methods | ✅ covered | Keep existing profile load guard until header/lifecycle/method read is ready. |
| error | Profile lifecycle actions | ✅ covered | Failed Bind/Unbind keeps confirmed state and shows retry Alert. |
| partial | Profile | ✅ covered | One type, invalid method, no cadence, or dormant cadence renders independently without invented status. |
| long-text | Profile methods/panel | ✅ covered | Values ellipsize with full label; panel/helper copy wraps. |
| empty | Unbound list | ✅ covered | Use documented no-unbound heading/body. |
| loading | Unbound list | ✅ covered | Header immediate; null-vs-loaded sentinel prevents empty flash. |
| error | Unbound list | ✅ covered | Documented load error and next-focus retry, no fabricated partial list. |
| populated | Unbound list | ✅ covered | Alphabetical neutral avatar/name/category rows, no status ring/favourite. |
| zero-one-many | Unbound list/footer | ✅ covered | Singular-aware count and stable zero-count entry. |
| overflow | Unbound list | 🧪 backstop | Device UAT: long list scroll and long name/category readability. |
| long-text | Unbound list/footer | ✅ covered | Name truncates with full label; footer follows standard row layout. |
| loading | Settings region/modal | ✅ covered | Disable write until setting/region data loads; preserve confirmed value. |
| error | Settings region/modal | ✅ covered | Retain prior choice and show existing settings retry posture; never silently change parsing policy. |
| populated | Settings region/modal | ✅ covered | Searchable modal has Use device region and selected-state row. |
| overflow | Settings region/modal | 🧪 backstop | Device UAT: long names/search/sheet scroll at 320dp. |
| long-text | Settings helper | ✅ covered | Helper wraps 13px/18px; switch/label remains reachable. |
| loading | Bind/Unbind | ✅ covered | Disable repeat transition during write; do not optimistically hide controls. |
| error | Bind/Unbind | ✅ covered | Failure retains confirmed state and retry Alert. |
| partial | Lifecycle panel | ✅ covered | Dormant cadence binds directly; never-assigned opens FrequencyPicker and blocks Bind until valid. |
| long-text | Confirmation | ✅ covered | Concise native Alert body wraps in platform chrome. |
| empty | Streamlined Export | ✅ covered | Disabled row and documented no-shareable-details copy when no actionable primary exists. |
| loading | Streamlined Export | ✅ covered | Documented preparing copy, single-flight action, and full backup remains available. |
| success | Streamlined Export | ✅ covered | Existing transient posture uses documented share-ready copy without recovery language. |
| error | Streamlined Export | ✅ covered | Documented retry copy preserves screen and backup health. |
| partial | Streamlined Export | ✅ covered | Each contact contributes at most formatted actionable primaries; secondary, invalid, extension, canonical, and provenance fields are absent. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none (no shadcn or external UI registry) | none — bespoke React Native primitives and existing in-repo patterns only | not applicable |

No third-party registry is used; registry vetting is not triggered.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-08-26
