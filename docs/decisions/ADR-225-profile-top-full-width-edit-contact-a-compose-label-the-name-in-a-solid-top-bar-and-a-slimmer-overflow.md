# ADR-225: Profile Top — a Full-Width Edit Contact Button, a "Compose" Label, the Name in a Solid Top Bar, and a Slimmer ⋯

**Status:** Accepted
**Date:** 2026-10-16
**Phase:** 38.11-everyday-screens-ux
**Source decisions:** D-63, D-47, D-91, D-46, D-57, D-92, D-68, D-28, D-27 (38.11-CONTEXT.md; ledger Q-04, Q-09, Q-12, Q-19, Q-24, Q-28; 38.11-14 device rulings A2, A3); ⋯ entries from D-64, D-65, D-69
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-109 (partial — the Hero's direct actions "Message, Call" gain a full-width Edit Contact above them and the message action is labelled "Compose"; the fixed-structure Hero, identity, Favorite, the one overflow and "unavailable direct actions remain visible with an explanation" survive)
**Superseded by:** ADR-233 (partial)

## Context

Edit Contact sat in a crowded ⋯ menu that also held Snooze, Unsnooze, Archive, Save as template and Reset. The top "Message" button opened Compose while the Contact Methods Message opened SMS, so the two looked the same and did different things. Once the name scrolled away the Profile gave no sign of whose page it was, and a saved-but-unusable phone number got "Add a phone number".

## Decision

The Profile top shows a full-width **Edit Contact** button above the message and Call pair (D-63). The message button reads **Compose**, one line, centred, and its accessibility label names the person (D-47 as amended by D-91). It still opens Compose, and the Contact Methods row's Message keeps the direct SMS handoff (D-46, ADR-166). The Hero's unavailable reason tells "no number" apart from "a saved number that can't be used" (D-27).

Once the Hero name scrolls under the top bar, the bar shows the person's name and is fully opaque while it does; otherwise it keeps the 0.92 scrim (D-57 as amended by D-92). An open section's chevron points up (D-28).

The ⋯ for a bound contact is Snooze… · Unbind contact · Move to Bin · separator · Profile Layout · Background. Snooze… opens the shared snooze sheet (D-64, ADR-227). Unbind is a plain entry that keeps its confirm (D-68). Move to Bin is the red entry (D-69, ADR-226). Save as template and Reset moved into the Layout and Background sheets (D-65, ADR-231). Edit Contact left ⋯, and there is no Delete on the Profile (D-67, ADR-018).

## Alternatives Considered

- **Pencil in the top bar, or keep Edit in ⋯** — rejected for a button at the top (Q-24).
- **"Compose Message"** — the first choice (Q-19); it wrapped to two lines at large font, so the owner chose "Compose" (D-91).
- **Route the Contact Methods Message through Compose** — rejected; keep both behaviours, rename the button (Q-04).
- **Keep the 0.92 bar under the name** — rejected at the device review; scrolled text showed through (D-92).
- **A Log button on the Profile** — deferred to an owner research todo (D-52).

## Consequences

### Positive

- The most-used admin action is one tap from the Profile; ⋯ holds lifecycle and presentation only.

### Negative

- The Hero is taller by one button row.

### Risks

- After a successful Unbind the ⋯ sheet stays open over the new menu (F-03, routed to 38.12).

## Implementation

**Key files:**
- `src/components/profile/ProfileHero.tsx` — Edit Contact, Compose and Call; reasons from saved method kinds.
- `src/profile/relationship-sheet-model.ts` — `profileHeroActionState`, `savedMethodKinds`.
- `src/screens/ContactProfileScreen.tsx` — `ProfileAppBar` name and scrim; ⋯ wiring.
- `src/screens/contact-profile-logic.ts` — `profileOverflowEntries`, `profileAppBarShowsName`, `profileAppBarScrimOpacity`.
- `src/components/profile/ProfileModuleHost.tsx` — section chevron direction.
- `src/components/icons/icon-registry.ts` — `chevron-up`.

**Depends on:** ADR-109 (Fixed-Hero Semantic Profile Composition and Focused Accessible Editors); ADR-183 (224 Profile Photo Growing Upward, App-Bar Favourite Star and a Reusable Profile Photo Lightbox); ADR-150 (Semantic Profile Hierarchy and Source-Owned Knowledge Editing)
**Required by:** ADR-233 (The Profile ⋯ Follows Lifecycle State, Bind and Unbind Show Undo, and Unbound People Get a Bind-Card Frequency, a Disabled Star and a Settings Row)
