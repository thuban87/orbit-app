import { describe, expect, it } from "vitest";
import type { OpenRouterModel } from "@/ai/openrouter-catalog";
import {
  directCards,
  filterModelCards,
  openRouterCards,
  orderOpenRouterModels,
} from "@/screens/ai-model-picker-logic";

const models: OpenRouterModel[] = [
  {
    id: "z/model",
    name: "Zulu",
    contextLength: 10,
    pricing: { prompt: "0.000002", completion: "0.000004" },
  },
  {
    id: "a/model",
    name: "Alpha",
    contextLength: 20,
    pricing: { prompt: "0.000001", completion: "0.000003" },
  },
  { id: "m/model", name: "Middle", contextLength: null, pricing: {} },
];

describe("curated-first model ordering", () => {
  it("is deterministic and keeps curated ids in registry order", () => {
    const curated = [{ id: "z/model", reason: "Balanced" as const }];
    const first = orderOpenRouterModels(models, curated).map(
      (model) => model.id,
    );
    const second = orderOpenRouterModels([...models].reverse(), curated).map(
      (model) => model.id,
    );
    expect(first).toEqual(["z/model", "a/model", "m/model"]);
    expect(second).toEqual(first);
  });

  it("does not invent a card for a curated id absent from the live catalog", () => {
    expect(
      orderOpenRouterModels(models, [{ id: "absent", reason: "Balanced" }]),
    ).toHaveLength(models.length);
    expect(
      openRouterCards(models, [{ id: "absent", reason: "Balanced" }]),
    ).not.toContainEqual(expect.objectContaining({ id: "absent" }));
  });

  it("derives real per-million pricing from runtime decimal strings", () => {
    expect(openRouterCards(models, [])[0].pricing).toBe(
      "$1.00 input · $3.00 output per 1M tokens",
    );
  });

  it("filters across id, name, provider, and recommendation", () => {
    const cards = openRouterCards(models, [
      { id: "z/model", reason: "Lightweight" },
    ]);
    expect(
      filterModelCards(cards, "lightweight").map((card) => card.id),
    ).toEqual(["z/model"]);
  });

  it("direct cards carry no monetary estimate", () => {
    expect(directCards(["model-b", "model-a"], [])[0].pricing).toBeNull();
  });
});
