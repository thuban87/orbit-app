# ADR-005: AiService Port Omits the Local/LAN (Ollama) Provider

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 01-project-scaffold-portable-code
**Source decisions:** 01-CONTEXT.md `<decisions>` — "AI provider port — Ollama OMITTED" (owner decision, 2026-08-14); 01-04-SUMMARY
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The Obsidian plugin's `AiService.ts` shipped five provider implementations behind one interface, including an `OllamaProvider` whose default endpoint is an `http://` LAN address. HANDOFF §4 said to "port all 5 provider implementations," but PROJECT.md's Out-of-Scope / Key Decisions record "No Ollama/local AI on mobile; custom endpoint HTTPS-only" — an `http://` LAN endpoint reopens the rejected LAN path and forces app-wide cleartext (dossier `03-fuel` / `13-ai`, `[REJECTED]`). A cross-AI review (Codex + Claude) surfaced the conflict, and the owner resolved it.

## Decision

The `AiService` port **omits `OllamaProvider` entirely** — the class, its `'ollama'` id, its registration, and its head-comment reference are all dropped as a decoupling edit (in the same spirit as `requestUrl`→`fetch`). Only the four cloud providers ship: OpenAI, Anthropic, Google (Gemini), and the **HTTPS-only** custom endpoint. `'ollama'` is excluded from the `AiProviderId` union so a local/LAN provider cannot enter the type system, and **no `http://` cleartext path lands in `src/`**. This enforces the `[REJECTED]` mobile-local-AI decision in the code itself, not merely in a comment.

## Alternatives Considered

- **Port all five providers per HANDOFF §4** — Rejected. Re-introducing Ollama reopens the rejected LAN path and forces app-wide cleartext networking; the owner resolved the conflict in favour of the later, more specific mobile decision.
- **Keep the Ollama class but disable it behind a flag / comment** — Rejected. A commented-out or flag-gated local provider still ships an `http://` default and a local id in the type system; enforcing the decision in code means removing the code, not annotating it.

## Consequences

### Positive

- No cleartext `http://` transport or local-provider id exists anywhere in `src/` — the `[REJECTED]` decision is structurally enforced, and the `! grep -q 'http://'` gate holds by construction rather than by convention.
- The provider layer is dormant (wired to no screen) but compiles standalone, ready for Phase 14 to wire keys, settings UI, HTTPS-scheme enforcement on the custom endpoint, and prompt-builder redaction.

### Negative

- Orbit diverges from the plugin's provider set; anyone expecting local/offline AI must know it was deliberately excluded on mobile.

### Risks

- **Re-adding Ollama is a decision reversal, not a bug fix.** Any future change that re-introduces a local/LAN provider, an `http://` endpoint, or a local id in `AiProviderId` reopens the rejected LAN path and is an **owner-gated** decision — it must not be made as an "engineering call." A reviewer flagging the omission by name is an escalation trigger, not a finding to close.

## Implementation

**Key files:**
- `src/services/AiService.ts` — ported four-cloud-provider service on `fetch` with an explicit `if (!response.ok) throw` before each `await response.json()`; `OllamaProvider` and its registration removed.
- `src/services/ai-types.ts` — local `AiSettings` interface and the `AiProviderId` union (`none | openai | anthropic | google | custom`), excluding any local/LAN id.
- `src/services/AiService.test.ts` — mocked-fetch tests proving the ok-guard runs before the body parse for each of the four providers.

**Depends on:** None
**Required by:** None

---
