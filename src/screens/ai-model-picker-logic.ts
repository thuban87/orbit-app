import type {
  CuratedModelRef,
  ModelRecommendationReason,
} from "@/ai/model-registry";
import type { OpenRouterModel } from "@/ai/openrouter-catalog";

export interface ModelPickerCard {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly recommendation: ModelRecommendationReason | null;
  readonly pricing: string | null;
  readonly context: string | null;
}

function stableKey(model: Pick<OpenRouterModel, "id" | "name">): string {
  return `${model.name.toLocaleLowerCase()}\u0000${model.id.toLocaleLowerCase()}`;
}

export function orderOpenRouterModels(
  models: readonly OpenRouterModel[],
  curated: readonly CuratedModelRef[],
): readonly OpenRouterModel[] {
  const byId = new Map(models.map((model) => [model.id, model]));
  const curatedIds = new Set(curated.map((entry) => entry.id));
  const orderedCurated = curated
    .map((entry) => byId.get(entry.id))
    .filter((model): model is OpenRouterModel => model !== undefined);
  const rest = models
    .filter((model) => !curatedIds.has(model.id))
    .sort((a, b) => stableKey(a).localeCompare(stableKey(b)));
  return [...orderedCurated, ...rest];
}

export function filterModelCards(
  cards: readonly ModelPickerCard[],
  query: string,
): readonly ModelPickerCard[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === "") return cards;
  return cards.filter((card) =>
    [card.id, card.name, card.provider, card.recommendation ?? ""].some(
      (value) => value.toLocaleLowerCase().includes(needle),
    ),
  );
}

function dollarsPerMillion(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return `$${(value * 1_000_000).toFixed(2)}`;
}

export function openRouterCards(
  models: readonly OpenRouterModel[],
  curated: readonly CuratedModelRef[],
): readonly ModelPickerCard[] {
  const recommendation = new Map(
    curated.map((entry) => [entry.id, entry.reason]),
  );
  return orderOpenRouterModels(models, curated).map((model) => {
    const slash = model.id.indexOf("/");
    const input = dollarsPerMillion(model.pricing.prompt);
    const output = dollarsPerMillion(model.pricing.completion);
    return {
      id: model.id,
      name: model.name,
      provider: slash > 0 ? model.id.slice(0, slash) : "OpenRouter",
      recommendation: recommendation.get(model.id) ?? null,
      pricing:
        input && output
          ? `${input} input · ${output} output per 1M tokens`
          : null,
      context:
        model.contextLength === null
          ? null
          : `${model.contextLength.toLocaleString()} token context`,
    };
  });
}

export function directCards(
  ids: readonly string[],
  curated: readonly CuratedModelRef[],
): readonly ModelPickerCard[] {
  const curatedById = new Map(curated.map((entry) => [entry.id, entry.reason]));
  const curatedIds = new Set(curated.map((entry) => entry.id));
  const ordered = [
    ...curated.map((entry) => entry.id).filter((id) => ids.includes(id)),
    ...ids
      .filter((id) => !curatedIds.has(id))
      .sort((a, b) => a.localeCompare(b)),
  ];
  return ordered.map((id) => ({
    id,
    name: id,
    provider: "Direct connection",
    recommendation: curatedById.get(id) ?? null,
    pricing: null,
    context: null,
  }));
}
