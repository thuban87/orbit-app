# AI Model Catalog Maintenance Pipeline

## Overview

Use this process when Orbit's bundled AI model choices need a new LiteLLM snapshot or its provider/tier policy changes. It regenerates the offline seed from a public catalog while retaining the app's local-first picker: a device uses its cache when present and the committed seed otherwise.

## Architecture (Phase 14)

### Catalog generation

**File:** `scripts/gen-models.ts`

The development-only generator fetches LiteLLM's public model-price catalog, applies the same filter the app uses, and writes the committed seed. It is never bundled into the app.

```typescript
filterLiteLLMCatalog(raw, new Date())
writeFileSync(SEED_PATH, renderSeedModule(catalog), "utf8")
```

### Fallback Chain / Resolution Order

1. **On-device cache** — `src/ai/model-catalog-cache.ts` reads `ai/model-catalog.json` after a user refresh.
2. **Bundled seed** — `src/ai/model-registry.seed.generated.ts` is used on first run, offline, or after an invalid cache.
3. **Free-text model id** — remains available when a model is absent from the catalog or discovery fails.

## File Locations

### Code

| File | Purpose |
|------|---------|
| `scripts/gen-models.ts` | Fetches LiteLLM and writes the seed module. |
| `src/ai/model-catalog-filter.ts` | Filters chat models, provider mappings, deprecations, and output limits. |
| `src/ai/model-registry.seed.generated.ts` | Generated offline/first-run model snapshot. |
| `src/ai/model-registry.ts` | Resolves All or latest-per-tier Frontier choices. |
| `src/ai/model-catalog-cache.ts` | Performs user-instigated refresh without replacing a good prior catalog on failure. |

## How to Refresh the Bundled Catalog

1. From the repository root, regenerate the seed. This requires network access only on the development machine:

   ```bash
   npm run gen:models
   ```

2. Review `src/ai/model-registry.seed.generated.ts`. It must remain generated data, contain non-empty `openai`, `anthropic`, and `google` model lists, and include the per-provider limits map.

3. Run the focused model-catalog checks:

   ```bash
   npx vitest run src/ai/model-catalog-filter.test.ts src/ai/model-catalog-cache.test.ts src/ai/model-registry.test.ts
   ```

4. Run the project type check before committing the regenerated seed:

   ```bash
   npx tsc --noEmit
   ```

5. Commit `src/ai/model-registry.seed.generated.ts` with any intentional filter or tier-policy changes. If a provider tier is renamed, update `FRONTIER_TIERS` in `src/ai/model-registry.ts`; never hand-list a frontier model id.

### What You Don't Need to Change

- Do not change the SecureStore key repository; catalog refresh sends no key.
- Do not change the Custom egress guard; catalog refresh is a separate public GET with no user/contact data.
- Do not add a SQLite migration; the runtime catalog cache is a fully re-derivable document-file cache.

## Pitfalls

1. **Do not hand-edit the generated seed.** Run `npm run gen:models`; the generator and runtime filter must remain aligned.
2. **Do not refresh automatically on a read path.** `refreshModelCatalog()` belongs only to an explicit user action; missing or corrupt cache falls back locally.
3. **Do not make model discovery the only entry path.** Provider discovery is advisory, may need a key, and free-text entry remains the escape hatch.
4. **Do not restore a flat output cap.** OpenAI and Gemini omit artificial caps; Anthropic alone receives the catalog maximum because its API requires `max_tokens`.

## Smoke Test

```bash
npm run gen:models && npx vitest run src/ai/model-catalog-filter.test.ts src/ai/model-catalog-cache.test.ts src/ai/model-registry.test.ts && npx tsc --noEmit
```

Expected: the generator reports non-empty provider counts, all focused tests pass, and TypeScript exits successfully.

```bash
git diff --check -- src/ai/model-registry.seed.generated.ts
```

Expected: no whitespace errors in the generated seed.
