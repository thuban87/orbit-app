# ADR-245: A Flagged Custom-Field Value Opens Edit at That Field, Review Now Lists the People to Fix, and View History Is a Read-Only Screen Behind "Keep Past Values"

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-70, D-121, D-139, D-153, D-106, D-159, D-71, D-72, D-74 (38.12-CONTEXT.md; ledger Q-12, Q-25, mid-execution rulings Q2, Q10, device batch HIS); carried D-24
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

HANDOFF §14.4 promises that values a type change cannot convert render as an error with tap-to-fix, and its summary says "fix now or later". In practice a flagged value showed "Needs attention" twice as a plain caption. Edit opened at the top of the form, and the field input could not show an error. "Fix now" led nowhere. "View history" opened Edit Contact, although past values are stored. Type-change summaries said "1 need", and lists showed raw type ids.

## Decision

**Tap-to-fix (D-70).** One predicate, `isFlaggedCustomValue`, decides whether a stored value fails its field's type or options. A flagged value shows one "Needs attention" marker in the danger token. Tapping the card opens Edit Contact at that field: the Edit route carries `focusFieldDefId`, Custom Fields expands, and the field scrolls into view. The input shows the stored value, the problem and the expected format, for example "This isn't a valid date" with "Use YYYY-MM-DD". The error goes as soon as the input no longer holds the saved value. Every custom-field Edit from the Profile opens at its field.

**Review now (D-121, D-153).** After a type change that flags values, the confirmation offers "Review now" or "Later". Review now lists the people whose values need fixing, and each opens Edit Contact at the field. Editing a dropdown's options offers the same when stored values are no longer options. The §14.4 summary text stays. With 0 values needing input it drops the "need your input — fix now or later" clause (D-139, D-153; amends the HANDOFF §14.4 sentence for the zero case only). Summaries count with `plural()` (D-71). There is still one pre-flight summary and no second confirm (D-24).

**History (D-106, D-159).** "View history" opens a read-only screen listing the field's past values for this person, newest first, each with when it was replaced. It reads `readValueHistory` over `custom_field_value_history` (ADR-090). The create and edit form gets a **Keep past values** switch, off by default to match the stored default, which makes history reachable.

**Field lists (D-72, D-74).** A quarantined field shows "kept until <date>", 30 days after quarantine. The Delete/Quarantine confirm says why the action differs ("has values for N contacts"). Lists show field-type labels, never raw ids, and the new-field placeholder is "e.g. Favorite coffee".

Values are never rewritten by a type change (D-24, ADR-001).

## Alternatives Considered

- **Remove "View history"** — the recommendation; the owner chose to build the screen (Q-12).
- **Reword "fix now or later"** — rejected; it would change the decided §14.4 text (Q-25 B).
- **Keep "0 need your input"** — rejected (Q2, Q10).
- **History on by default** — not chosen; the switch matches the stored default (HIS).

## Consequences

### Positive

- §14.4's tap-to-fix and "fix now" are real.
- Past values are visible when the user asks to keep them.

### Negative

- History exists only for fields where "Keep past values" was on when the value changed.

### Risks

- A new field type needs its own `customFieldValueError` copy, or its error state is generic.

## Implementation

**Key files:**
- `src/db/field-parsers.ts` — `isFlaggedCustomValue`.
- `src/db/profile-knowledge-read.ts` — the flagged state on the Profile read.
- `src/components/profile/ThingsToRemember.tsx` — one marker; tap opens Edit at the field.
- `src/components/FieldValueInput.tsx` — the `error` prop.
- `src/components/field-value-error.ts` — `customFieldValueError` copy.
- `src/components/field-widgets/DateFieldWidget.tsx` — its own caption hidden while the Edit error shows.
- `src/screens/edit-contact-custom-fields.tsx` — expand and reveal the target field.
- `src/screens/EditContactScreen.tsx` — `focusFieldDefId`.
- `src/navigation/types.ts` — `EditContactParams.focusFieldDefId`.
- `src/screens/CustomFieldReviewScreen.tsx` — the Review now list.
- `src/db/field-values-dao.ts` — `listContactsWithUnreadableValues`.
- `src/db/field-type-change.ts` — `preflightTypeChange` classifies with the one predicate.
- `src/screens/CustomFieldsScreen.tsx` — Review now offer, summaries, quarantine copy, Keep past values.
- `src/components/FieldDefForm.tsx` — `FIELD_TYPE_LABELS`, the Keep past values switch, the placeholder.
- `src/db/field-defs-dao.ts` — `countFieldValues`; the history-retained flag writer.
- `src/screens/ValueHistoryScreen.tsx` — the read-only history screen.
- `src/db/value-history-dao.ts` — `readValueHistory`.

**Depends on:** ADR-001 (Normalized Custom-Field Values); ADR-015 (Lossless Field Changes with Quarantine and Launch-Time Retention Sweep); ADR-090 (Additive Custom-Field Value History and Deferred Contact Scope)
**Required by:** None
