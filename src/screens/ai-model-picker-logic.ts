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

export function filterModelCards<T extends ModelPickerCard>(
  cards: readonly T[],
  query: string,
): readonly T[] {
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

/** A picker card plus whether it is the lane's saved (remembered) model. */
export type MarkedModelPickerCard = ModelPickerCard & {
  readonly isCurrent: boolean;
};

export interface RememberedModelMarks {
  readonly cards: readonly MarkedModelPickerCard[];
  /** The saved id when no catalog card matches it (e.g. a manual id). */
  readonly manualCurrent: string | null;
}

/**
 * Mark the lane's saved model (38.4 RG-008; ui-accessibility/AUD-UIA-020;
 * D-17). The remembered id is trimmed, then matched on EXACT string equality —
 * no case folding or fuzzy match, because the id is what `choose()` saved and
 * what a request would send. A saved id with no matching card (a manual id, or
 * a model missing from the current catalog) surfaces as `manualCurrent` so it
 * is still visibly identified. Pure: it reads and writes nothing.
 */
export function markRememberedModel(
  cards: readonly ModelPickerCard[],
  remembered: string | null,
): RememberedModelMarks {
  const id = remembered?.trim() ?? "";
  const marked = cards.map((card) => ({
    ...card,
    isCurrent: id !== "" && card.id === id,
  }));
  const matched = marked.some((card) => card.isCurrent);
  return { cards: marked, manualCurrent: id !== "" && !matched ? id : null };
}

/**
 * The saved model id to show in the standalone "Current model" row: the manual
 * id, or a matching catalog card's id when that card is not in the visible list
 * (recommendations-only view or a search), so the mark never disappears.
 */
export function currentModelRowId(
  marks: RememberedModelMarks,
  visibleCards: readonly Pick<ModelPickerCard, "id">[],
): string | null {
  if (marks.manualCurrent !== null) return marks.manualCurrent;
  const current = marks.cards.find((card) => card.isCurrent);
  if (!current) return null;
  return visibleCards.some((card) => card.id === current.id)
    ? null
    : current.id;
}
