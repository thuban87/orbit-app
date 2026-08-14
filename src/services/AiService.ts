/**
 * AI Service — Provider abstraction layer.
 *
 * Supports 4 cloud providers: OpenAI, Anthropic, Google (Gemini), and a Custom
 * (OpenAI-compatible) HTTPS endpoint. All HTTP goes through the platform `fetch`
 * with an explicit ok-status check before every JSON body parse — `fetch`,
 * unlike the legacy plugin request helper, does NOT throw on 4xx/5xx, so a
 * non-ok body must be rejected before it is parsed as success.
 *
 * The local/LAN provider is excluded per project scope (HTTPS-only) — no
 * cleartext transport path ships in this file.
 *
 * Dormant this phase — plumbing only, wired to no screen. It must compile and
 * typecheck; it is not invoked at runtime yet.
 */
import type { OrbitContact } from "@/types";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";
import type { AiSettings } from "./ai-types";

// ─── Default Prompt Template ────────────────────────────────────

export const DEFAULT_PROMPT_TEMPLATE = `You are a personal relationship assistant. Write a short, warm check-in message for the following contact.

**Contact:** {{name}}
**Category:** {{category}}
**Days since last contact:** {{daysSinceContact}}
**Social battery:** {{socialBattery}}
**Last interaction:** {{lastInteraction}}

**Conversational Fuel:**
{{Conversational Fuel}}

**Small Talk Data:**
{{Small Talk Data}}

Guidelines:
- Keep it casual and authentic — not robotic
- Reference specific topics from their Conversational Fuel or Small Talk Data if available
- Match the tone to the relationship category (family = warm, work = professional but friendly)
- Keep it under 3-4 sentences
- Don't mention that you're an AI or that you're using data about them
- No em dashes at all`;

// ─── Context Extraction & Prompt Assembly ───────────────────────

/**
 * Structured context extracted from a contact's file for AI prompt assembly.
 */
export interface MessageContext {
  name: string;
  category: string;
  daysSinceContact: number;
  socialBattery: string;
  lastInteraction: string;
}

/**
 * Extract a named section from markdown file content.
 * Looks for a `## ...SectionName` heading (tolerates emoji prefixes and extra words)
 * and captures all content until the next `##` heading or EOF.
 *
 * @param content - Full markdown file content
 * @param sectionName - Heading text to search for (without `##` prefix)
 * @returns Section content (trimmed) or "None available"
 */
export function extractSection(content: string, sectionName: string): string {
  // Match ## headings that contain the section name anywhere in the line
  // This handles emojis, prefixes like "The", etc.
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^##\\s+.*${escaped}.*$`, "m");
  const match = content.match(pattern);
  if (!match || match.index === undefined) {
    return "None available";
  }

  const startIdx = match.index + match[0].length;
  const rest = content.slice(startIdx);

  // Find the next ## heading (end of this section)
  const nextHeading = rest.match(/^##\s+/m);
  const sectionContent =
    nextHeading && nextHeading.index !== undefined
      ? rest.slice(0, nextHeading.index)
      : rest;

  const trimmed = sectionContent.trim();
  return trimmed || "None available";
}

/**
 * Extract structured context from a contact and their file content.
 *
 * @param contact - OrbitContact with metadata
 * @param fileContent - Full markdown content of the contact's file
 * @returns MessageContext for prompt assembly
 */
export function extractContext(
  contact: OrbitContact,
  _fileContent: string,
): MessageContext {
  // Format last interaction info
  let lastInteraction = "No previous interaction recorded";
  if (contact.lastContact) {
    const dateStr = formatLocalDate(contact.lastContact);
    const type = contact.lastInteraction ?? "unknown";
    lastInteraction = `${dateStr} (${type})`;
  }

  return {
    name: contact.name,
    category: contact.category ?? "Uncategorized",
    daysSinceContact: contact.daysSinceContact,
    socialBattery: contact.socialBattery ?? "Unknown",
    lastInteraction,
  };
}

/**
 * Assemble a prompt by replacing {{placeholders}} in the template with context values.
 *
 * Known contact fields (name, category, etc.) are replaced first.
 * Any remaining {{...}} placeholders are treated as section names and
 * extracted dynamically from the contact's markdown file content.
 *
 * @param template - Prompt template with {{placeholders}}
 * @param context - MessageContext with known contact field values
 * @param fileContent - Full markdown content of the contact's file
 * @returns Assembled prompt string
 */
export function assemblePrompt(
  template: string,
  context: MessageContext,
  fileContent: string,
): string {
  // Step 1: Replace known contact fields
  let result = template
    .replace(/\{\{name\}\}/g, context.name)
    .replace(/\{\{category\}\}/g, context.category)
    .replace(/\{\{daysSinceContact\}\}/g, String(context.daysSinceContact))
    .replace(/\{\{socialBattery\}\}/g, context.socialBattery)
    .replace(/\{\{lastInteraction\}\}/g, context.lastInteraction);

  // Step 2: Dynamically resolve any remaining {{...}} placeholders as section names
  result = result.replace(/\{\{([^}]+)\}\}/g, (_match, sectionName: string) => {
    return extractSection(fileContent, sectionName.trim());
  });

  Logger.debug("AiService", `Assembled prompt:\n${result}`);
  return result;
}

// ─── Provider Interface ─────────────────────────────────────────

/**
 * Common interface for all AI providers.
 * Each provider knows how to check availability, list models, and generate text.
 */
export interface AiProvider {
  /** Unique provider ID (matches AiProviderId values) */
  id: string;
  /** Human-readable provider name */
  name: string;
  /** Check if the provider is reachable and configured */
  isAvailable(): Promise<boolean>;
  /** List available models for this provider */
  listModels(): Promise<string[]>;
  /** Generate text from a prompt using the specified model */
  generate(prompt: string, model: string): Promise<string>;
}

// ─── OpenAI Provider ────────────────────────────────────────────

/** Curated list of OpenAI budget/mid-tier models */
const OPENAI_MODELS = ["gpt-4.1-nano", "gpt-4.1-mini", "gpt-5-mini"];

/**
 * OpenAI provider — API key auth, chat completions API.
 */
export class OpenAiProvider implements AiProvider {
  readonly id = "openai";
  readonly name = "OpenAI";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async listModels(): Promise<string[]> {
    return [...OPENAI_MODELS];
  }

  async generate(prompt: string, model: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key is not configured");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data?.choices?.[0]?.message?.content) {
      throw new Error("OpenAI returned an unexpected response format");
    }
    return data.choices[0].message.content;
  }
}

// ─── Anthropic Provider ─────────────────────────────────────────

/** Curated list of Anthropic budget/mid-tier models */
const ANTHROPIC_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-20250514",
];

/**
 * Anthropic provider — x-api-key header auth, Messages API.
 */
export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic";
  readonly name = "Anthropic";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async listModels(): Promise<string[]> {
    return [...ANTHROPIC_MODELS];
  }

  async generate(prompt: string, model: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("Anthropic API key is not configured");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Anthropic request failed with status ${response.status}`,
      );
    }

    const data = await response.json();
    if (!data?.content?.[0]?.text) {
      throw new Error("Anthropic returned an unexpected response format");
    }
    return data.content[0].text;
  }
}

// ─── Google (Gemini) Provider ───────────────────────────────────

/** Curated list of Google Gemini budget/mid-tier models */
const GOOGLE_MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash"];

/**
 * Google Gemini provider — API key in query parameter, generateContent API.
 */
export class GoogleProvider implements AiProvider {
  readonly id = "google";
  readonly name = "Google (Gemini)";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async listModels(): Promise<string[]> {
    return [...GOOGLE_MODELS];
  }

  async generate(prompt: string, model: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("Google API key is not configured");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Google Gemini request failed with status ${response.status}`,
      );
    }

    const data = await response.json();
    if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("Google Gemini returned an unexpected response format");
    }
    return data.candidates[0].content.parts[0].text;
  }
}

// ─── Custom Endpoint Provider ───────────────────────────────────

/**
 * Custom endpoint provider — user-provided URL, OpenAI-compatible format.
 */
export class CustomProvider implements AiProvider {
  readonly id = "custom";
  readonly name = "Custom endpoint";
  private endpointUrl: string;
  private apiKey: string;
  private modelName: string;

  constructor(endpointUrl: string, apiKey: string, modelName: string) {
    this.endpointUrl = endpointUrl;
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async isAvailable(): Promise<boolean> {
    return this.endpointUrl.length > 0;
  }

  async listModels(): Promise<string[]> {
    // Custom endpoint uses a single user-provided model name
    return this.modelName ? [this.modelName] : [];
  }

  async generate(prompt: string, model: string): Promise<string> {
    if (!this.endpointUrl) {
      throw new Error("Custom endpoint URL is not configured");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model || this.modelName,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Custom endpoint request failed with status ${response.status}`,
      );
    }

    const data = await response.json();
    // Support OpenAI-compatible response format
    if (data?.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    // Fallback: try direct response field (some APIs use this)
    if (data?.response) {
      return data.response;
    }
    throw new Error("Custom endpoint returned an unexpected response format");
  }
}

// ─── AiService Orchestrator ─────────────────────────────────────

/**
 * Central AI service — manages provider registry and delegates generation.
 *
 * Usage:
 *   const service = new AiService();
 *   const provider = service.getActiveProvider(settings);
 *   if (provider) {
 *       const result = await service.generate(settings, 'Write a message...');
 *   }
 */
export class AiService {
  private providers: Map<string, AiProvider> = new Map();

  /**
   * Build provider instances from current settings.
   * Called when settings change to refresh provider configuration.
   */
  refreshProviders(settings: AiSettings): void {
    this.providers.clear();

    // Helper: get API key for a specific provider (per-provider → legacy fallback)
    const keyFor = (provider: string): string =>
      settings.aiApiKeys?.[provider] ?? settings.aiApiKey ?? "";

    // Cloud providers — each gets its own API key
    this.providers.set("openai", new OpenAiProvider(keyFor("openai")));
    this.providers.set("anthropic", new AnthropicProvider(keyFor("anthropic")));
    this.providers.set("google", new GoogleProvider(keyFor("google")));

    // Custom — use endpoint URL + API key + model from settings
    this.providers.set(
      "custom",
      new CustomProvider(
        settings.aiCustomEndpoint,
        keyFor("custom"),
        settings.aiCustomModel,
      ),
    );
  }

  /** Get a provider by ID */
  getProvider(id: string): AiProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get the currently active provider based on settings.
   * Returns null if provider is 'none' or not found.
   */
  getActiveProvider(settings: AiSettings): AiProvider | null {
    if (settings.aiProvider === "none") {
      return null;
    }
    return this.providers.get(settings.aiProvider) ?? null;
  }

  /**
   * Generate text using the active provider and configured model.
   * @throws Error if no provider is configured, or if generation fails
   */
  async generate(settings: AiSettings, prompt: string): Promise<string> {
    const provider = this.getActiveProvider(settings);
    if (!provider) {
      throw new Error(
        "No AI provider is configured. Go to Settings → AI provider to set one up.",
      );
    }

    const model = settings.aiModel;
    if (!model) {
      throw new Error(
        "No AI model is selected. Go to Settings → AI provider to select a model.",
      );
    }

    Logger.debug(
      "AiService",
      `Generating with ${provider.name}, model: ${model}`,
    );

    try {
      const result = await provider.generate(prompt, model);
      Logger.debug("AiService", `Generation complete (${result.length} chars)`);
      return result;
    } catch (error) {
      Logger.error("AiService", `Generation failed: ${error}`);
      throw error;
    }
  }
}
