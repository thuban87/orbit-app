# AI Platform Providers — Current API Facts

> **Verified 2026-08-14** against live official documentation. Reachable: OpenAI
> (`developers.openai.com` — `platform.openai.com/docs` 301-redirects there),
> Anthropic (`platform.claude.com/docs` — `docs.claude.com` 302-redirects there),
> Google (`ai.google.dev`). One page 403'd on first attempt
> (`platform.openai.com/docs/api-reference/chat`) and was retrieved from its
> `developers.openai.com` equivalent instead. Every claim below is from a page
> fetched live on this date; no claim rests on training-data recall. Where a
> value came from a marketing/blog page it is NOT recorded here — official docs
> only.

---

## OpenAI

**Docs verified:**
- Models catalog: https://developers.openai.com/api/docs/models
- Chat Completions reference: https://developers.openai.com/api/docs/api-reference/chat
- Pricing: https://developers.openai.com/api/docs/pricing
- Models list endpoint: https://developers.openai.com/api/docs/api-reference/models

### 1. Endpoint & shape
`POST https://api.openai.com/v1/chat/completions` is **still current and fully
supported.** It is **not deprecated.** OpenAI's stated recommendation: *"Starting
a new project? We recommend trying Responses to take advantage of the latest
OpenAI platform features."* — a recommendation for the newer **Responses API**
(`/v1/responses`), not a deprecation of Chat Completions.

Request/response contract is unchanged and matches the ported layer:
- Request: `{ model, messages: [{role, content}], temperature }`
- Response: `choices[0].message.content`

Auth unchanged: `Authorization: Bearer <API_KEY>`.

### 2. Current cheap/mid text models (from official pricing table)
All three hardcoded IDs **still appear in the official pricing table and are
still served** — none are retired:
| Model ID | Input $/1M | Output $/1M |
|---|---|---|
| `gpt-5-nano` | 0.05 | 0.40 |
| `gpt-4.1-nano` | 0.10 | 0.40 |
| `gpt-4o-mini` | 0.15 | 0.60 |
| `gpt-5-mini` | 0.25 | 2.00 |
| `gpt-4.1-mini` | 0.40 | 1.60 |

Note: the **models catalog** page now foregrounds the `gpt-5.6-*` family
(`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, plus `gpt-5.6-cyber`) as the
frontier tier (knowledge cutoff Feb 16, 2026), but the older mini/nano IDs
remain live and are the correct cost-tier choice for short message generation.
`gpt-5-nano` is the cheapest.

### 3. List-models endpoint
`GET https://api.openai.com/v1/models` — "Lists the currently available models."
Returns **all** model types (no text-only filter). Response: `{ object: "list",
data: [{ id, created, object: "model", owned_by }] }`.

### 4. Mobile gotchas
Standard bearer-token auth; no regional endpoint requirement for the public API.
No key-format change noted in docs.

---

## Anthropic (Claude)

**Docs verified:**
- Models overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Versioning: https://platform.claude.com/docs/en/api/versioning
- List Models: https://platform.claude.com/docs/en/api/models/list

### 1. Endpoint & shape
`POST https://api.anthropic.com/v1/messages` — **current and supported.**
Contract unchanged: headers `x-api-key` + `anthropic-version`; body `{ model,
max_tokens, messages }`; response `content[0].text`.

**anthropic-version header:** `2023-06-01` is **still the current, valid, and
documented value.** The versioning page still gives `anthropic-version:
2023-06-01` as the example and lists only `2023-06-01` (current) and `2023-01-01`
(initial release, superseded) in its version history. No newer date-version has
been introduced. New HTTP features arrive via `anthropic-beta` headers, not a new
`anthropic-version`. **No change needed.**

### 2. Current models — ONE HARDCODED ID IS DEAD
| Hardcoded ID | Status |
|---|---|
| `claude-haiku-4-5-20251001` | **Still current.** Listed in the *Latest models* table (alias `claude-haiku-4-5`). $1/$5 per 1M in/out. |
| `claude-sonnet-4-20250514` | **GONE.** Not in current OR legacy tables. Sonnet 4 (May 2025) has aged out; the current Sonnet is `claude-sonnet-5`. Oldest Sonnet still listed is `claude-sonnet-4-5-20250929` (legacy). |

Current family (Aug 2026): `claude-fable-5`, `claude-opus-5`, `claude-sonnet-5`,
`claude-haiku-4-5-20251001`. Recommended cheap/fast tier for short generation:
**`claude-haiku-4-5`** ($1/$5). Next step up: `claude-sonnet-5` ($2/$10).
Model IDs from the 4.6 generation onward are dateless but still pinned snapshots
(e.g. `claude-sonnet-5`), not evergreen pointers.

### 3. List-models endpoint
`GET https://api.anthropic.com/v1/models` (headers `anthropic-version` +
`x-api-key`). Returns text/vision chat models with a rich `capabilities` object,
`display_name`, `max_input_tokens`, `max_tokens`, `created_at`; cursor
pagination (`after_id`/`before_id`/`limit`, `has_more`). Text-model oriented (no
separate embedding product to filter out).

### 4. Mobile gotchas
`x-api-key` (not bearer) + mandatory `anthropic-version`. No regional-endpoint
requirement for the first-party API (Bedrock/Vertex have regional variants, not
relevant here). No key-format change noted.

---

## Google Gemini

**Docs verified:**
- Models: https://ai.google.dev/gemini-api/docs/models (page "Last updated 2026-08-13 UTC")
- List models API: https://ai.google.dev/api/models
- Pricing: https://ai.google.dev/gemini-api/docs/pricing (page "Last updated 2026-08-13 UTC")

### 1. Endpoint & shape
`POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
— **current.** Body `{ contents: [{ parts: [{ text }] }] }`; response
`candidates[0].content.parts[0].text`. Contract matches the ported layer.
Auth: `?key={API_KEY}` query param **or** `x-goog-api-key` header.

### 2. Current models — both hardcoded IDs still valid
| Hardcoded ID | Status | Input $/1M | Output $/1M |
|---|---|---|---|
| `gemini-2.5-flash` | **Still listed & served.** | 0.30 (text) | 2.50 |
| `gemini-3-flash-preview` | **Still listed**, in *preview* status. | 0.50 (text) | 3.00 |

Current stable Gemini 3 Flash is **`gemini-3.6-flash`** (input $0.75, output
$3.75 through 2026-12-31; doubles 2027-01-01). For short message generation the
cost-effective stable choice is `gemini-2.5-flash`; `gemini-3-flash-preview`
works but is preview (subject to change) — prefer `gemini-3.6-flash` for a stable
Gemini-3-class option.

### 3. List-models endpoint
`GET https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}`.
Returns **all** model types (text generation AND embeddings, etc.); each entry
carries `supportedGenerationMethods` (e.g. `generateContent`, `embedContent`) so
the app must filter to `generateContent` to get text models. Response:
`{ models: [{ name, baseModelId, version, displayName, description,
inputTokenLimit, outputTokenLimit, supportedGenerationMethods, thinking,
temperature, ... }], nextPageToken }`. Up to 50/page default.

### 4. Mobile gotchas
Model ID goes in the URL path, not the body. Key can ride as a query param
(fine for native fetch; avoid logging the URL with the key in it). No regional
endpoint requirement for the `generativelanguage.googleapis.com` API.

---

## OpenAI-compatible custom endpoint

The `{model, messages, temperature}` → `choices[0].message.content` shape of
`/v1/chat/completions` **remains the de-facto interop standard in 2026.**
OpenAI still documents and supports it unchanged, and the ecosystem
(OpenRouter, LM Studio, self-hosted servers) continues to target this exact
contract, so the app's "point at any OpenAI-compatible URL" feature stays valid.
(Verified via the OpenAI Chat Completions reference above; per-provider server
support was not individually re-fetched.)
