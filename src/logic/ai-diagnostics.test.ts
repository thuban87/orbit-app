import { describe, expect, it } from "vitest";
import {
  buildAiDiagnostic,
  classifyAiFailure,
  failureMessage,
  type AiDiagnosticInput,
} from "@/logic/ai-diagnostics";

describe("AI diagnostics — strict safe-metadata allowlist", () => {
  it("copies only allowlisted metadata even when private fields exist at runtime", () => {
    const privateValues = {
      contactName: "PRIVATE CONTACT NAME",
      prompt: "PRIVATE PROMPT BODY",
      output: "PRIVATE GENERATED OUTPUT",
      credential: "sk-private-credential",
      notes: "PRIVATE INTERACTION NOTE",
    };
    const input = {
      operation: "Rewrite",
      lane: "openrouter",
      modelId: "vendor/model",
      status: 429,
      category: "rate-limit",
      correlationId: "corr-safe-123",
      appBuildVersion: "42",
      osVersion: "Android 16",
      approxTokenCount: 321,
      itemCount: 7,
      elapsedMs: 850,
      ...privateValues,
    } as AiDiagnosticInput & typeof privateValues;

    const event = buildAiDiagnostic(input);
    expect(Object.keys(event)).toEqual([
      "operation",
      "lane",
      "modelId",
      "status",
      "category",
      "correlationId",
      "appBuildVersion",
      "osVersion",
      "approxTokenCount",
      "itemCount",
      "elapsedMs",
    ]);
    const serialized = JSON.stringify(event);
    for (const value of Object.values(privateValues)) {
      expect(serialized).not.toContain(value);
    }
  });
});

describe("AI failures — eight human-readable categories", () => {
  const cases = [
    [{ code: "unauthorized" }, "openai", "connection"],
    [{ status: 404, code: "model_not_found" }, "openrouter", "model-unavailable"],
    [{ status: 429 }, "anthropic", "rate-limit"],
    [{ status: 402 }, "openrouter", "billing"],
    [{ code: "context_length_exceeded" }, "google", "context"],
    [{ status: 503 }, "openai", "provider-down"],
    [{ code: "invalid_endpoint" }, "custom", "custom-endpoint"],
    [{ code: "invalid_response" }, "google", "generic"],
  ] as const;

  for (const [error, lane, category] of cases) {
    it(`maps ${JSON.stringify(error)} to ${category}`, () => {
      const actual = classifyAiFailure(error, lane);
      expect(actual.category).toBe(category);
      expect(failureMessage(actual.category)).toBeTruthy();
    });
  }

  it("maps an unknown failure to generic without exposing its message", () => {
    const failure = classifyAiFailure(
      new Error("PRIVATE RAW PROVIDER RESPONSE"),
      "openai",
    );
    expect(failure).toEqual({ category: "generic", status: "unknown" });
    expect(JSON.stringify(failure)).not.toContain("PRIVATE RAW PROVIDER RESPONSE");
  });
});
