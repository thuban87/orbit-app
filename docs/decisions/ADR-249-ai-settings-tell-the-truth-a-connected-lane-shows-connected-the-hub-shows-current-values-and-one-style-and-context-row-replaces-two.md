# ADR-249: AI Settings Tell the Truth — a Connected Lane Shows Connected, the Hub Shows Current Values, and One "Style and Context" Row Replaces Two

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-84, D-157, D-85, D-126, D-87, D-89, D-88, D-86 (page half), D-28 (38.12-CONTEXT.md; ledger Q-27, device batch KEY); carried D-17 (39 D-100, K-36)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

AI Connection loaded only on mount and ignored whether the lane had a saved key, so a connected lane said "Connect" (39 D-100's K-36). The AI hub rows showed no current values. "Writing Style" and "Personalization Context" were two rows that opened the same page, as phase 16's dossier §AD listed them. A custom Writing Style choice left its preset highlighted and said "use custom guidance" three times. AI Preview used developer copy, and it hid the contact card for a contact who happened to be named "Example contact".

## Decision

**Connection (D-84, D-157).** AI Connection reloads on focus and reads credential presence locally, booleans only, with no provider call. `connectionCardState` takes `hasCredential`. An active lane with a key, or an active Custom lane, whose credential is optional, shows **Connected** with "Change model" as the primary action. The lane's connect action stays as a secondary button. Disconnect on the connected card is the same filled red destructive button as "Remove key" on a saved-but-not-in-use card; neither becomes plain (D-157 amends D-84's "Disconnect demoted"). The card names the model from the local catalog cache. "Recommended" and the default OpenRouter expansion stay (D-17), and nothing about OAuth or egress changes.

**Hub (D-85, D-126).** The AI hub shows current values from data already loaded. The Connection row reads "<provider> · <model name>" with "Ready" or "Needs attention", and the Model row shows the model's name, or "Not set". One **Style and Context** row opens the personalization page at the top, replacing the two separate rows (D-126; amends phase 16 §AD's six-row list). The hub's AI row subtitle follows the merged row.

**Personalization (D-87, D-86, D-88).** Each Writing Style choice is one segmented control with its presets plus a "Custom" segment, so a custom choice never leaves a preset highlighted. "Use custom guidance" appears once, in the guidance box caption (D-87; the box shows only while a choice is custom, ADR-248). Section text spans the full width (D-86). Every personalization control locks while a save runs, with section switches held `busy` rather than disabled so they never flash Off (D-88).

**Permissions and Preview (D-86, D-88, D-89, D-28).** On AI Data Permissions, "Review existing…" scrolls to the review list, and the default captions follow their switches, including 38.10's two "new items default to Allow AI" rows (D-28). The page also has its own filter-empty copy. AI Preview uses plain page copy and section titles. Its contact card comes first with its exact blocks, shown only when a contact is chosen, with an explicit no-contact state (D-89). The model picker shows the model's name, not its raw id, and Custom Endpoint fields prefill from the saved connection (D-88).

## Alternatives Considered

- **"Writing style & personal context"** — the example title; the owner: "your title is super long. 'Style and Context' should be fine" (Q-27).
- **A plain, demoted Disconnect on the connected card** — D-84's built form; rejected at the device batch: "I do not think that button should become plain" (KEY).

## Consequences

### Positive

- The AI pages say what is actually configured, without any network request.

### Negative

- None recorded.

### Risks

- With no local catalog cache the connected card shows the model id instead of its name (by design).

## Implementation

**Key files:**
- `src/screens/ai-connection-logic.ts` — `connectionCardState` with `hasCredential`, `readLaneCredentialPresence`, `AI_LANE_NAMES`.
- `src/screens/AIConnectionScreen.tsx` — focus reload, Connected card, filled red Disconnect.
- `src/ai/openrouter-catalog-file.ts` — the local catalog read for the model name.
- `src/screens/settings-ai-hub-logic.ts` — `loadAiHubSnapshot`, `aiHubRowDisplay`.
- `src/screens/SettingsAIScreen.tsx` — the five-row hub, error cleared on a good reload.
- `src/screens/settings-hub-model.ts` — the AI row subtitle.
- `src/screens/ai-model-picker-logic.ts` — `currentModelRowLabel`.
- `src/screens/AIPersonalizationScreen.tsx` — Writing Style segments, locked controls, full-width text.
- `src/screens/ai-personalization-logic.ts` — custom choice state.
- `src/components/SegmentedControl.tsx` — the Custom segment.
- `src/screens/AIPermissionsScreen.tsx` — Review existing scroll, captions.
- `src/screens/ai-permissions-logic.ts` — filter-empty copy.
- `src/screens/AIPreviewScreen.tsx` — plain copy, contact card first.
- `src/screens/settings-ai-logic.ts` — `EXAMPLE_PREVIEW_CONTEXT`.

**Depends on:** ADR-135 (Multi-Connection AI Configuration and Fail-Closed Readiness); ADR-136 (Permission-Bounded Prompt Assembly and AI Transparency); ADR-137 (Structured Personalization and Explicit Context Capacity); ADR-248 (AI Egress Narrows — Custom Guidance Only When a Choice Uses It, Instruction Paragraphs Without Hard Breaks, and Photo Fields Never Sent or Offered)
**Required by:** None
