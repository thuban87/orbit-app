# Glossary

**Last updated:** 2026-10-11
**Updated by phase:** 38.9
**Owners:** `src/constants/glossary.ts`, `src/constants/product-labels.ts`, `src/constants/glossary-contract.test.ts`

## Purpose

The glossary gives every user-facing concept one name. It records the decided terms, the
retired forms they replace, and the rule that a label change never renames a stored or
OS-registered identifier. It exists so the same person, status or action reads the same way
on every screen, the home-screen widget and the accessibility labels.

## Architecture

### Data Model

The glossary owns no table and no stored value. Every term is a display label. Persisted
identifiers keep their own spelling (see Gotchas).

### Key Files

| File | Role |
|------|------|
| `src/constants/glossary.ts` | Flat `export const` canonical labels; re-exports `DIGEST`, `CONTACTS`, `EVENTS`. |
| `src/constants/product-labels.ts` | Tab and section names `DIGEST`, `CONTACTS`, `EVENTS` (imported by Digest, Events and the root navigator). |
| `src/constants/glossary-contract.test.ts` | Retired-form contract, rename guard and identifier guard. |
| `src/components/control-surface/control-labels.ts` | Contacts population labels, built from the glossary constants. |
| `src/components/icons/status-display-label.ts` | Shared non-colour status label used by List rows. |

## Canonical terms

| Term | Constant | Meaning |
|------|----------|---------|
| Contacts | `CONTACTS` | The everyday contact browser tab (internal code name: Dashboard). |
| Digest | `DIGEST` | The daily summary tab. |
| Events | `EVENTS` | The user-facing noun for group events. |
| Never Contacted | `NEVER_CONTACTED` | A person with no logged interaction yet: the Contacts population, card and status labels, Digest Horizon, Systems and Orrery labels. |
| Favorite / Favorites | `FAVORITE`, `FAVORITES` | A starred person; American spelling in all user-visible text. |
| Log Interaction | `LOG_INTERACTION` | The detailed logging form and its action (ADR-132). |
| Stable / Wobbly / Decaying / Rogue | `STABLE`, `WOBBLY`, `DECAYING`, `ROGUE` | The four relationship status bands. Rogue is overdue or unresponsive (ADR-026). |
| Group Log | `GROUP_LOG` | Logging one event for several people at once. |
| Dissolve | `DISSOLVE` | Removing a group event while each participant's interaction stays as their own. |
| Transmit | `TRANSMIT` | Compose's send/hand-off action. |
| Bound / Unbound | `BOUND`, `UNBOUND` | Whether a contact takes part in Orbit's tracking (reminders, status, Systems). |
| Orbit participation | `ORBIT_PARTICIPATION` | The Bound/Unbound choice when adding or importing contacts. |
| Interaction Assist | `INTERACTION_ASSIST` | The pending "did you reach them?" confirmation after a hand-off. |
| Quarantine | `QUARANTINE` | Removing a custom field that still holds values, recoverable for a period before it is deleted. |

Sentence-case copy uses the same words in lower case where a label sits inside a sentence
("Add favorite", "Not favorite", "3 never contacted →").

## Retired forms

The contract fails if any of these returns to a user-visible literal in `src/` or
`app.config.ts`.

| Retired | Use instead | Decision |
|---------|-------------|----------|
| "Not Contacted", "Not contacted", "Not yet contacted", "not yet contacted" | Never Contacted | D-42, D-56 |
| "Favourite(s)", "favourite(s)" | Favorite(s) | D-49 |
| "Wobbling" | Wobbly | D-22 |
| "Log Contact" | Log Interaction | D-22, ADR-132 |
| "Dashboard(s)", "dashboard(s)" | Contacts | D-22 |

## How It Works

### Adding or changing user-visible copy

1. Use the constant from `src/constants/glossary.ts` where the label stands alone (a filter
   chip, a status name, an accessibility label).
2. In a sentence, write the same word in sentence case.
3. `glossary-contract.test.ts` parses every production file with the TypeScript compiler and
   checks only string literals, template pieces and JSX text. Comments and identifiers are
   never checked.

### What the contract skips

- Module specifiers (`import`, `export … from`, `require`, `import()`, `vi.mock`).
- Property-name keys (object, type, interface, class and enum member names).
- Literals inside a type (`"dashboard" | "x"`).
- Arguments of `Logger.*(…)` and `Error(…)` / `new Error(…)` (developer-only text).
  `super(…)` in an Error subclass is still checked, because that text can reach the screen.
- Two developer-only literals allowlisted by file and exact text: the backup validator's
  `fail("appSettings has invalid Dashboard filters")` and a `console.warn` in
  `dashboard-query-store.ts`.

### Matching rule

A retired form matches as a whole token, with an optional plural `s`. A letter, digit, `_`,
`-` or `/` right before or after it makes it part of a longer token, so `favourite_rank`,
`./dashboard-read`, `DashboardTab` and `OrbitFavourites` never match. A literal containing
`://` is a URL and is not checked. Capitalised forms match in any literal; lowercase forms
match only in a literal that contains whitespace (so a single-token code value such as
`"dashboard"` passes), and a multi-word lowercase form also matches its sentence-case variant.

## Configuration

None. The constants are the configuration.

## Decisions

- **ADR-132:** Focused Rapid-Capture Workflows — names the visible action "Log Interaction".
- **ADR-026:** Rogue Status for Unresponsive or Far-Overdue Contacts — the Rogue band.
- **Phase 38.9 D-21, D-22, D-41, D-42, D-49, D-56** (`.planning/phases/38.9-ux-standards/38.9-CONTEXT.md`)
  — the canonical terms, the enforcements and the rule that decided terms are not renamed.
  These are extracted to ADRs at milestone close.

## Gotchas

1. **Labels are not identifiers.** The population id `favourites`, the widget provider
   `OrbitFavourites`, the deep link `orbit://favourites`, the right-swipe value `log-contact`
   and every `dashboard*` setting, store and test ID keep their spelling. They are stored in
   `app_settings`, in backups, or registered with Android; renaming one breaks existing data
   or placed widgets (38.9 D-12, D-49). The contract asserts the widget and deep-link names.
2. **The widget picker label is native config.** `app.config.ts` `label` / `description`
   change at the next prebuild; placed widgets show new body text after the next
   `pushWidgetUpdate()`.
3. **A new retired form goes in the contract, not in a grep.** Add it to `RETIRED_FORMS` in
   `glossary-contract.test.ts`; the self-tests there show the caught and skipped cases.
4. **Other system docs still use old names in prose** (for example "Not Contacted" in
   `dashboard.md`). They describe internals; the KB extraction for 38.9 brings them in line.

## Related Systems

- **Contacts (internal Dashboard query subsystem)** — owns the population labels.
- **Status engine** — supplies the status band each label names.
- **Widget** — renders the Favorites widget text and owns the `OrbitFavourites` provider.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-10-11 | 38.9 | Created: canonical constants (D-21, D-41), Never Contacted / Favorite / Wobbly / Log Interaction / Contacts enforced app-wide (D-22, D-42, D-49, D-56), retired-form contract. |
