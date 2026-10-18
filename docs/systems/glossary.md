# Glossary

**Last updated:** 2026-10-17
**Updated by phase:** 38.12-lifecycle-import-settings-ux
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
| Rarely Responds | `RARELY_RESPONDS` | The per-person policy where only interactions that connected count toward their orbit (status, Gravity, Intensity). One Title Case spelling on Edit Contact's toggle and the Profile sheets (38.11-14). |
| Quarantine | `QUARANTINE` | Removing a custom field that still holds values, recoverable for a period before it is deleted. |
| Bin / Move to Bin | `BIN`, `MOVE_TO_BIN` | Where people go before permanent deletion (Settings → Bin), and the action that puts them there. They are hidden from your lists (the confirms' wording, 38.11 D-93), can be restored, and stay until restored or deleted permanently: the Bin never empties itself. Replaces "Archive" / "Archived contacts" in user-visible text; the internal name stays archive (`archived_at`, the archive DAOs, the `Archived` route, the `archive` event type) (38.11 D-69, D-70). |
| Things to Remember | `THINGS_TO_REMEMBER` | The Profile section that holds what to remember about a person: Pinned, Last Talked About, Key People, Current Location, Memories, Thought of Them, Gift Ideas, Custom Fields, Off Limits and Imported from Contacts App (38.10 D-44, D-90). |
| Off Limits | `OFF_LIMITS` | Topics to avoid bringing up with a person. Shown in full on the Profile and in Compose Research, never sent to AI (38.10 D-09, D-10, D-90). The Profile helper "Avoid bringing these up" stays (D-105). |
| Close | `CLOSE` | The button that closes a detail sheet, such as the Profile entry sheet (38.10 D-87, D-90). |
| Not set | `NOT_SET` | An empty always-show custom field on the Profile (38.10 D-87, D-90). |
| Check-in reminders | `CHECK_IN_REMINDERS` | The Notifications switch for reminders to reach out to people you're overdue with. Replaces "Decay reminders" (38.12 D-130). Only the switch label changed: the status names (Stable, Wobbly, Decaying, Rogue) are not renamed (D-05). |
| Use AI suggestions | `USE_AI_SUGGESTIONS` | The master switch on Settings → AI. Replaces "AI Enabled" (38.12 D-130). |
| Check linked contacts | `CHECK_LINKED_CONTACTS` | The flow that compares linked people with their phone contacts. One name on the grid and the detail screen; the detail screen's "Update from Contacts" title is gone (38.12 D-49). |
| Not in phone Contacts | `NOT_IN_PHONE_CONTACTS` | A linked phone contact that the phone no longer returns: the card chip, the detail chip and the Check complete count. Replaces the developer wording "Source missing" (38.12 D-103). |
| Needs your choice | `NEEDS_YOUR_CHOICE` | A Check linked contacts card the person has to decide field by field. Replaces "Manual review" (38.12 D-103). |
| Link to a different phone contact | `LINK_DIFFERENT_PHONE_CONTACT` | Points a person whose phone contact is gone at another phone contact. Replaces "Relink to another contact" (38.12 D-103). |
| Unlink from phone contact | `UNLINK_FROM_PHONE_CONTACT` | Removes the phone-contact link only; the person and their history stay. Keeps its red danger styling. Replaces "Unlink source" (38.12 D-103, amending the ADR-179 label only). |

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
| "Group Event(s)", "group event(s)", "Group event(s)" | Event(s) ("Edit Event", "Dissolve this event?") | D-22 |
| "group interaction(s)", "Group interaction(s)" | event ("Make this an event") | D-22 |
| "Archived contact(s)", "Archived Contact(s)" | Bin ("Settings → Bin", "Move to Bin") | 38.11 D-69 |

### "fuel" (38.10 D-01, D-87)

"fuel" is gone from code and wording: its table, DAOs, editor and every label were removed in
Phase 38.10, and its rows now live in Off Limits, Gift Ideas, Thought of Them, Last Talked About
or a general memory. It is not a `RETIRED_FORMS` entry, because that contract checks literals
only and the immutable shipped migrations must keep naming the table. Instead
`src/no-fuel-contract.test.ts` reads every file under `src/` and `App.tsx`, comments included,
and fails on any match outside a file-level allowlist: the shipped migrations that created,
moved or dropped the table (001, 009, 011, 016, 017, 033) and their tests, the legacy mapping
module, the v7 backup converter, and the regression tests that must name the retired table to
guard against its return. Each allowlist entry records its reason in the test.

### Developer wording (D-41)

Plain words replace developer wording in the screens Phase 38.9 converted. The contract checks
these forms only in that list of files (`DEVELOPER_WORDING_FILES`), so it does not reach
unconverted screens.

| Retired | Now reads |
|---------|-----------|
| "Follows event", "overridden", "Participant overrides", "participant record" | "Same as event", "changed for this person", "Changes for this person", "Edit for this person" |
| "Sensitive Operations" | "Careful actions" |
| "Format version", "Related rows", "Tombstones" (restore preview) | "Backup version", "Linked items", "Deleted items kept" |
| "cadence" in captions | "reach-out reminders", "reminder schedule", "Days between backups" |
| "Reset Overrides", "Overrides" badge, "Reset Membership Overrides" (Systems) | "Reset Manual Changes", "Edited", "Reset Membership Changes" |
| "Contact override", "Category override", "Batch category override" | "Set for this contact", "Set for this category", "Category for all imported contacts" |

Decided metric names (Gravity) and the canonical terms above are not changed (D-41).

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
- Three developer-only literals allowlisted by file and exact text: the backup validator's
  `fail("appSettings has invalid Dashboard filters")` and
  `fail("interactions has an invalid Group Event UID")`, and a `console.warn` in
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
- **ADR-206:** Glossary — Canonical Terms Kept, Retired Forms Enforced, Plain-Word Rewrites, and a Shared Plural Helper — the canonical terms, the enforcements (Contacts, Log Interaction, Wobbly, Event, Never Contacted, Favorite), the rule that decided terms are not renamed, "Make this an event", and `plural()` (38.9 D-21, D-22, D-41, D-42, D-49, D-56, D-63, D-74, D-75).
- **ADR-207:** Knowledge Homes After Fuel — "fuel" removed from code and wording, enforced by `src/no-fuel-contract.test.ts` (D-01).
- **ADR-214:** AI Permission for the New Knowledge Homes and Compose Research — Compose Research's "Avoid" heading becomes "Off Limits"; the Profile helper "Avoid bringing these up" stays, so "Avoid" is not a retired form (D-87, D-105).
- **ADR-218:** Things to Remember on the Profile — the Things to Remember terms, entry-sheet wording (Edit, Pin, Unpin, Close) and "Not set" (D-87, D-90).
- **ADR-226:** Archive Becomes the Bin — `BIN`, `MOVE_TO_BIN`; "Archived contact(s)" retired.
- **ADR-228:** Truthful Relationship Overview — "Never Contacted" on the Profile; `RARELY_RESPONDS`.

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
4. **A renamed label that code dispatches on must come from one constant.** The Systems
   screen dispatches row actions by label, so "Reset Manual Changes" is
   `RESET_MANUAL_CHANGES_ACTION`, used by both the button list and the handler (D-63). The
   `systems-dao` function keeps its name `resetSystemOverrides`; identifiers are not copy.
5. **Other system docs still use old names in prose** (for example "Not Contacted" in
   `dashboard.md`). They describe internals; the KB extraction for 38.9 brings them in line.

## Related Systems

- **Contacts (internal Dashboard query subsystem)** — owns the population labels.
- **Status engine** — supplies the status band each label names.
- **Widget** — renders the Favorites widget text and owns the `OrbitFavourites` provider.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-10-11 | 38.9 | Created: canonical constants (D-21, D-41), Never Contacted / Favorite / Wobbly / Log Interaction / Contacts enforced app-wide (D-22, D-42, D-49, D-56), retired-form contract. |
| 2026-10-11 | 38.9 | "Event(s)" as the user-facing noun (D-22); developer wording rewritten in plain words in the converted screens (D-41, D-63); contract extended with both. |
| 2026-10-11 | 38.9 | "group interaction" retired: the conversion entry and its prompt read "Make this an event" (D-22; fix-pass verification IN-02). |
| 2026-10-11 | 38.9 | KB extraction: the 38.9 decisions are cited as ADR-206. |
| 2026-10-13 | 38.10 | Things to Remember, Off Limits, Close and Not set added as canonical terms (D-90); the Profile's section registry, entry sheet and custom-field display read them; the contract pins their values (plan 16). |
| 2026-10-13 | 38.10 | "fuel" retired from code and wording (D-01, D-87), enforced by `src/no-fuel-contract.test.ts` with a migration allowlist rather than by `RETIRED_FORMS` (plan 18). |
| 2026-10-15 | 38.10 | KB extraction: Decisions cite ADR-207, ADR-214 and ADR-218 in place of the D-ID line. |
| 2026-10-16 | 38.11 | "Bin" and "Move to Bin" added as canonical terms; "Archive" is renamed "Bin" in user-visible text, internal names unchanged; "Archived contact(s)" / "Archived Contact(s)" added to the retired forms (D-69, D-70; plan 12). |
| 2026-10-16 | 38.11 | "Rarely Responds" added as a canonical term (one Title Case spelling on the Edit Contact toggle and the Profile sheets, pinned by the glossary contract); the Bin entry follows D-93's "hidden from your lists". |
| 2026-10-16 | 38.11 | KB extraction: Decisions link ADR-226, ADR-228. |
| 2026-10-17 | 38.12 | "Check-in reminders" (was "Decay reminders") and "Use AI suggestions" (was "AI Enabled") added as Settings switch labels, pinned by the glossary contract; status names unchanged (D-130, D-05; plan 14). |
| 2026-10-17 | 38.12 | Check linked contacts wording: one flow name (D-49) and four plain-word labels replacing developer wording ("Not in phone Contacts", "Needs your choice", "Link to a different phone contact", "Unlink from phone contact"); pinned by the glossary contract; canonical terms unchanged (D-103, D-05; plan 19). |
