/**
 * Settings AI pure helpers — node-tested off-device (C2-M4).
 *
 * These prove the privacy-relevant contracts of the Settings AI section without a
 * renderer: the non-secret settings patch NEVER carries an API key (T-14-12), the
 * Custom endpoint is rejected before persistence when invalid (H2), model
 * discovery falls back to free-text on any failure (C4-M1), and the
 * inspector/acknowledgement builders surface the EXACT immutable ResolvedPrompt
 * they were handed — never a rebuilt one (H5 / T-14-13).
 */
import { describe, expect, it } from "vitest";
import { SEED_CATALOG } from "@/ai/model-registry";
import { resolvePrompt, STATIC_INSTRUCTION } from "@/ai/prompt-template";
import type { PromptContext, ResolvedPrompt } from "@/ai/prompt-types";
import {
  AI_PREVIEW_COPY,
  buildAiSettingsPatch,
  buildContactPromptReview,
  buildInspectorViewState,
  buildPreviewContactCard,
  buildProviderAckViewState,
  buildWholePromptPreview,
  describeAiDataPath,
  discoverModelsForField,
  previewSectionTitle,
  shouldShowFirstUseDisclosure,
  validateEndpointForSave,
} from "@/screens/settings-ai-logic";

const EMPTY_CONTEXT: PromptContext = {
  contactName: "Casey",
  category: "Friend",
  gravityTier: "steady",
  intensity: {
    currentCount: 0,
    intendedPerPeriod: 1,
    multiple: 0,
    trailingAvgGapDays: null,
  },
  quality: { good: 0, fine: 0, hard: 0 },
  cadence: { totalCount: 0, connectedCount: 0 },
  newestChannel: "unspecified",
  sharedFields: [],
  sharedMemories: [],
  recentInteractions: [],
};

function frozenPrompt(text: string): ResolvedPrompt {
  return Object.freeze({
    prompt: text,
    inspectorDisplay: text,
    truncations: Object.freeze([
      Object.freeze({ category: "shared field: City", detail: "2 trimmed" }),
    ]),
    payload: text,
  }) as ResolvedPrompt;
}

describe("buildAiSettingsPatch — non-secret only, never a key (T-14-12)", () => {
  it("maps the non-secret provider config and omits any entered key", () => {
    const patch = buildAiSettingsPatch({
      provider: "openai",
      model: "gpt-x",
      customModel: "",
      customEndpoint: "",
      promptTemplate: "Be warm.",
      apiKey: "sk-super-secret-value",
    });
    expect(patch).toEqual({
      aiProvider: "openai",
      aiModel: "gpt-x",
      aiCustomModel: "",
      aiCustomEndpoint: "",
      aiPromptTemplate: "Be warm.",
    });
    // The entered key never appears in the persisted patch or its serialization.
    expect(patch).not.toHaveProperty("apiKey");
    expect(JSON.stringify(patch)).not.toContain("sk-super-secret-value");
  });
});

describe("validateEndpointForSave — reject before persistence (H2)", () => {
  it("rejects a non-https Custom endpoint before it can be saved", () => {
    const result = validateEndpointForSave("http://example.com/v1");
    expect(result.ok).toBe(false);
  });

  it("rejects a private/reserved IP-literal endpoint", () => {
    const result = validateEndpointForSave("https://127.0.0.1/v1");
    expect(result.ok).toBe(false);
  });

  it("accepts a valid public https endpoint", () => {
    const result = validateEndpointForSave("https://api.example.com/v1");
    expect(result.ok).toBe(true);
  });

  it("accepts an empty endpoint as the unconfigured state", () => {
    const result = validateEndpointForSave("");
    expect(result.ok).toBe(true);
  });
});

describe("discoverModelsForField — scope-filtered, free-text fallback (C4-M1)", () => {
  it("in frontier scope resolves the latest-per-tier winners (tier order)", async () => {
    const state = await discoverModelsForField(
      "google",
      "frontier",
      async () => ({
        kind: "list",
        models: [
          "gemini-2.5-flash", // older flash → loses to 3.5-flash
          "gemini-3.5-flash", // flash tier winner
          "gemini-embedding-001", // no tier → drop
          "gemini-3.1-pro-preview", // pro tier winner
        ],
      }),
    );
    // 14-11: <=3 latest-per-tier winners, in FRONTIER_TIERS order (pro, flash).
    expect(state).toEqual({
      kind: "list",
      models: ["gemini-3.1-pro-preview", "gemini-3.5-flash"],
    });
  });

  it("in all scope keeps the full discovered list (deduped, order preserved)", async () => {
    const state = await discoverModelsForField("google", "all", async () => ({
      kind: "list",
      models: ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-2.5-flash"],
    }));
    expect(state).toEqual({
      kind: "list",
      models: ["gemini-2.5-flash", "gemini-3.5-flash"],
    });
  });

  it("degrades a list with NO resolvable tier to manual in frontier scope", async () => {
    const state = await discoverModelsForField(
      "google",
      "frontier",
      async () => ({
        kind: "list",
        // Neither id belongs to a pro/flash/flash-lite tier → no winner.
        models: ["gemini-embedding-001", "text-embedding-004"],
      }),
    );
    expect(state).toEqual({ kind: "manual" });
  });

  it("falls back to manual when discovery reports manual", async () => {
    const state = await discoverModelsForField("openai", "all", async () => ({
      kind: "manual",
    }));
    expect(state).toEqual({ kind: "manual" });
  });

  it("falls back to manual on an empty list", async () => {
    const state = await discoverModelsForField("openai", "all", async () => ({
      kind: "list",
      models: [],
    }));
    expect(state).toEqual({ kind: "manual" });
  });

  it("falls back to manual if the discovery call throws (advisory — C4-M1)", async () => {
    const state = await discoverModelsForField(
      "anthropic",
      "frontier",
      async () => {
        throw new Error("boom");
      },
    );
    expect(state).toEqual({ kind: "manual" });
  });

  it("the seed's google frontier set is a subset a real discovery would keep", () => {
    // Sanity: SEED_CATALOG is bundled and non-empty so the frontier path has data.
    expect(SEED_CATALOG.models.google.length).toBeGreaterThan(0);
  });
});

describe("inspector / ack builders — surface the EXACT prompt, never rebuild (H5)", () => {
  it("inspector view-state returns the SAME inspectorDisplay string it was given", () => {
    const rp = frozenPrompt("EXACT PROMPT BYTES");
    const view = buildInspectorViewState(rp);
    expect(view.display).toBe(rp.inspectorDisplay);
    expect(view.truncations).toBe(rp.truncations);
  });

  it("ack view-state returns the SAME prompt string it was given", () => {
    const rp = frozenPrompt("EXACT PROMPT BYTES");
    const view = buildProviderAckViewState("openai", rp);
    expect(view.prompt).toBe(rp.prompt);
    expect(view.isCustom).toBe(false);
    expect(view.retentionCaveat).toBeNull();
  });

  it("names the Custom retention caveat for the custom provider", () => {
    const rp = frozenPrompt("EXACT PROMPT BYTES");
    const view = buildProviderAckViewState("custom", rp);
    expect(view.isCustom).toBe(true);
    expect(view.retentionCaveat).not.toBeNull();
    expect(view.prompt).toBe(rp.prompt);
  });
});

describe("whole-system and contact-specific prompt previews", () => {
  it("keeps the whole preview byte-identical to the resolved provider payload", () => {
    const resolved = resolvePrompt("Be kind.", EMPTY_CONTEXT);
    const preview = buildWholePromptPreview(resolved);
    expect(preview.display).toBe(resolved.payload);
    expect(preview.raw).toBe(resolved.payload);
    expect(preview.display).toContain(STATIC_INSTRUCTION);
  });

  it("sends no guidance text in the whole preview when no Writing Style choice is custom (38.12 D-127)", () => {
    const context: PromptContext = {
      ...EMPTY_CONTEXT,
      writingStyle: {
        tone: "casual",
        length: "concise",
        directness: "gentle",
        freeform: "PRIVATE GLOBAL STYLE",
      },
    };
    const resolved = resolvePrompt("", context);
    const whole = buildWholePromptPreview(resolved);
    expect(whole.display).toBe(resolved.payload);
    expect(whole.display).toContain("===== DATA: WRITING STYLE =====");
    expect(whole.display).not.toContain("PRIVATE GLOBAL STYLE");
    expect(whole.display).not.toContain("Custom guidance");
  });

  it("derives contact review blocks from that exact resolved prompt and omits global boilerplate", () => {
    const context: PromptContext = {
      ...EMPTY_CONTEXT,
      sharedFields: [{ label: "City", value: "Madison" }],
      sharedMemories: [{ label: "Trip", value: "Coast" }],
      recentInteractions: [
        {
          occurredAt: "2026-09-01 10:00:00",
          channel: "Message",
          tone: "Positive",
          note: "Talked about tomatoes",
        },
      ],
      writingStyle: {
        tone: "casual",
        length: "concise",
        // One custom choice, so the guidance line is sent (38.12 D-127).
        directness: "custom",
        freeform: "PRIVATE GLOBAL STYLE",
      },
      personalizationSections: [
        {
          uid: "section-1",
          title: "Global context",
          body: "PRIVATE GLOBAL PERSONALIZATION",
          enabled: true,
          displayOrder: 0,
        },
      ],
      messageFocus: [{ label: "Priority", value: "Ask about the garden" }],
    };
    const resolved = resolvePrompt("", context);
    const review = buildContactPromptReview(resolved, context);
    const whole = buildWholePromptPreview(resolved);
    expect(whole.display).toContain("PRIVATE GLOBAL STYLE");
    expect(whole.display).toContain("PRIVATE GLOBAL PERSONALIZATION");
    expect(review.heading).toBe("Sharing 3 items with AI about Casey");
    expect(review.display).toContain("Madison");
    expect(review.display).toContain("Coast");
    expect(review.display).toContain("Talked about tomatoes");
    expect(review.display).toContain("===== DATA: MESSAGE FOCUS =====");
    expect(review.display).toContain("Ask about the garden");
    expect(review.display).not.toContain(STATIC_INSTRUCTION);
    expect(review.display).not.toContain("PRIVATE GLOBAL STYLE");
    expect(review.display).not.toContain("PRIVATE GLOBAL PERSONALIZATION");
    for (const block of review.blocks) {
      expect(resolved.payload).toContain(block);
    }
  });

  it("uses correct zero/one grammar and an explicit nothing-shared resolution", () => {
    const empty = buildContactPromptReview(
      resolvePrompt("", EMPTY_CONTEXT),
      EMPTY_CONTEXT,
    );
    expect(empty.heading).toBe("Sharing 0 items with AI about Casey");
    expect(empty.emptyMessage).toBeTruthy();

    const oneContext: PromptContext = {
      ...EMPTY_CONTEXT,
      sharedFields: [{ label: "City", value: "Madison" }],
    };
    const one = buildContactPromptReview(
      resolvePrompt("", oneContext),
      oneContext,
    );
    expect(one.heading).toBe("Sharing 1 item with AI about Casey");
    expect(one.emptyMessage).toBeNull();
  });

  it("cannot expose credentials supplied as excess runtime properties", () => {
    const withSecret = {
      ...EMPTY_CONTEXT,
      credential: "sk-PRIVATE-CREDENTIAL",
      apiKey: "PRIVATE-API-KEY",
    } as PromptContext & { credential: string; apiKey: string };
    const resolved = resolvePrompt("", withSecret);
    const views = JSON.stringify({
      whole: buildWholePromptPreview(resolved),
      contact: buildContactPromptReview(resolved, withSecret),
    });
    expect(views).not.toContain("sk-PRIVATE-CREDENTIAL");
    expect(views).not.toContain("PRIVATE-API-KEY");
  });
});

describe("first-use AI disclosure", () => {
  it("names OpenRouter plus the selected model's underlying provider", () => {
    expect(
      describeAiDataPath({
        lane: "openrouter",
        model: "anthropic/claude-sonnet",
        customEndpoint: "",
      }),
    ).toBe("OpenRouter and Anthropic");
  });

  it("names a direct provider and a configured custom endpoint", () => {
    expect(
      describeAiDataPath({
        lane: "google",
        model: "gemini-pro",
        customEndpoint: "",
      }),
    ).toBe("Google Gemini");
    expect(
      describeAiDataPath({
        lane: "custom",
        model: "custom-model",
        customEndpoint: "https://ai.example.com/v1",
      }),
    ).toBe("your configured custom endpoint (ai.example.com)");
  });

  it("shows only after successful local setup and only until acknowledged", () => {
    const connection = {
      lane: "openai" as const,
      model: "gpt-test",
      customEndpoint: "",
    };
    expect(
      shouldShowFirstUseDisclosure({
        aiEnabled: true,
        connection,
        credentialPresent: true,
        disclosed: false,
      }),
    ).toBe(true);
    expect(
      shouldShowFirstUseDisclosure({
        aiEnabled: true,
        connection,
        credentialPresent: false,
        disclosed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowFirstUseDisclosure({
        aiEnabled: true,
        connection,
        credentialPresent: true,
        disclosed: true,
      }),
    ).toBe(false);
  });
});

describe("AI Preview reads in plain words (38.12 D-89, D-88)", () => {
  const RICH: PromptContext = {
    ...EMPTY_CONTEXT,
    sharedFields: [{ label: "City", value: "Madison" }],
    sharedMemories: [{ label: "Trip", value: "Coast" }],
    writingStyle: {
      tone: "custom",
      length: "concise",
      directness: "gentle",
      freeform: "Warm",
    },
    personalizationSections: [
      {
        uid: "s-1",
        title: "Me",
        body: "I garden.",
        enabled: true,
        displayOrder: 0,
      },
    ],
  };

  it("section titles are plain words, never the payload's delimiter names", () => {
    const whole = buildWholePromptPreview(resolvePrompt("", RICH));
    const titles = whole.sections.map((section) => section.title);
    expect(titles).toContain("About this person");
    expect(titles).toContain("Your style");
    expect(titles).toContain("Memory 1");
    expect(titles).toContain("Your context 1");
    expect(titles[0]).toBe("Orbit's instructions");
    for (const title of titles) {
      expect(title, title).not.toMatch(/^[A-Z0-9 ]+$/);
      expect(title).not.toMatch(/contract/i);
    }
  });

  it("plain titles change nothing sent: every section is still an exact slice of the payload", () => {
    const resolved = resolvePrompt("Be kind.", RICH);
    const whole = buildWholePromptPreview(resolved);
    expect(whole.display).toBe(resolved.payload);
    expect(whole.raw).toBe(resolved.payload);
    for (const section of whole.sections) {
      expect(resolved.payload).toContain(section.content);
    }
  });

  it("maps each payload block to a plain title, with a readable fallback", () => {
    expect(previewSectionTitle("CONTACT CONTEXT")).toBe("About this person");
    expect(previewSectionTitle("WRITING STYLE")).toBe("Your style");
    expect(previewSectionTitle("SHARED MEMORY 2")).toBe("Memory 2");
    expect(previewSectionTitle("RECENT INTERACTION 3")).toBe(
      "Recent interaction 3",
    );
    expect(previewSectionTitle("PERSONALIZATION CONTEXT 4")).toBe(
      "Your context 4",
    );
    expect(previewSectionTitle("MESSAGE FOCUS")).toBe("What to focus on");
    expect(previewSectionTitle("SOMETHING NEW")).toBe("Something new");
  });

  it("with no contact chosen the card says so instead of hiding by name", () => {
    const card = buildPreviewContactCard(
      null,
      resolvePrompt("", EMPTY_CONTEXT),
    );
    expect(card).toEqual({
      kind: "none",
      message: AI_PREVIEW_COPY.noContact,
    });
  });

  it("a contact literally named 'Example contact' still gets its card", () => {
    const context = { ...RICH, contactName: "Example contact" };
    const card = buildPreviewContactCard(context, resolvePrompt("", context));
    expect(card.kind).toBe("contact");
    if (card.kind !== "contact") return;
    expect(card.heading).toBe("Sharing 2 items with AI about Example contact");
  });

  it("the contact card carries the contact's context, byte-for-byte from the payload", () => {
    const resolved = resolvePrompt("", RICH);
    const card = buildPreviewContactCard(RICH, resolved);
    if (card.kind !== "contact") throw new Error("no contact card");
    expect(card.display).toContain("===== DATA: CONTACT CONTEXT =====");
    expect(card.display).toContain("Madison");
    expect(card.display).toBe(buildContactPromptReview(resolved, RICH).display);
    for (const block of card.display.split("\n\n")) {
      expect(resolved.payload).toContain(block);
    }
  });

  it("the page copy says where the contact's part appears", () => {
    expect(AI_PREVIEW_COPY.contactIntro).toMatch(/first/i);
  });
});
