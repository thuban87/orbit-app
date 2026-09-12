import { describe, expect, it } from "vitest";
import { FUTURE_DATETIME_MESSAGE as SHIPPED } from "@/components/touchpoint-refine-logic";
import type { TouchpointRefineValue } from "@/components/TouchpointRefineForm";
import { rejectFutureOccurredAt } from "@/db/log-guards";
import type { InteractionForEdit } from "@/db/interaction-edit-read";
import {
  buildEditInput,
  canSave,
  FUTURE_DATETIME_MESSAGE,
  isOccurredAtRejected,
  resolveSave,
  SAVE_FAILED_MESSAGE,
  seedRefineValue,
} from "@/screens/edit-interaction-logic";

const NOW = "2026-09-11 12:00:00";

const baseValue: TouchpointRefineValue = {
  occurredAt: "2026-09-01 09:30:00",
  channel: "Message",
  direction: "outbound",
  connected: 1,
  quality: "Positive",
  note: "coffee catch-up",
  duration: null,
  allowAi: 0,
};

describe("edit-interaction-logic — pure edit save/validate model", () => {
  it("maps the form value + ids into the editTouchpointFull input (duration null)", () => {
    const input = buildEditInput(baseValue, {
      interactionId: 7,
      contactId: 3,
      now: NOW,
    });
    expect(input).toEqual({
      interactionId: 7,
      contactId: 3,
      occurredAt: "2026-09-01 09:30:00",
      now: NOW,
      channel: "Message",
      direction: "outbound",
      connected: 1,
      quality: "Positive",
      note: "coffee catch-up",
      duration: null,
      allowAi: 0,
    });
  });

  it("carries a set duration and allow_ai=1 through unchanged", () => {
    const input = buildEditInput(
      { ...baseValue, duration: 1800, allowAi: 1 },
      { interactionId: 7, contactId: 3, now: NOW },
    );
    expect(input.duration).toBe(1800);
    expect(input.allowAi).toBe(1);
  });

  it("flags a future occurred_at and AGREES with the DAO's rejectFutureOccurredAt", () => {
    const future = { ...baseValue, occurredAt: "2999-01-01 00:00:00" };
    expect(isOccurredAtRejected(future, NOW)).toBe(true);
    // The UI guard is UX-only; the DAO guard remains the authority — they AGREE.
    expect(() => rejectFutureOccurredAt(future.occurredAt, NOW)).toThrow();
  });

  it("does not flag a past or equal occurred_at (agrees with the DAO guard)", () => {
    expect(isOccurredAtRejected(baseValue, NOW)).toBe(false);
    expect(() => rejectFutureOccurredAt(baseValue.occurredAt, NOW)).not.toThrow();
    const equal = { ...baseValue, occurredAt: NOW };
    expect(isOccurredAtRejected(equal, NOW)).toBe(false);
    expect(() => rejectFutureOccurredAt(equal.occurredAt, NOW)).not.toThrow();
  });

  it("re-exports the single shipped future-date copy (no divergent string)", () => {
    expect(FUTURE_DATETIME_MESSAGE).toBe(SHIPPED);
  });

  it("gates save on a valid, non-future occurred_at and not-in-flight", () => {
    expect(canSave(baseValue, NOW, false)).toBe(true);
    // Saving in flight blocks re-entry.
    expect(canSave(baseValue, NOW, true)).toBe(false);
    // A future occurred_at is unsavable.
    expect(
      canSave({ ...baseValue, occurredAt: "2999-01-01 00:00:00" }, NOW, false),
    ).toBe(false);
  });

  it("preserves the full form state and never completes on a failed save", () => {
    const result = resolveSave(baseValue, false);
    // Same reference — the form value is never cleared on failure.
    expect(result.value).toBe(baseValue);
    expect(result.completed).toBe(false);
    expect(result.error).toBe(SAVE_FAILED_MESSAGE);
  });

  it("completes and clears the error on a successful save", () => {
    const result = resolveSave(baseValue, true);
    expect(result.completed).toBe(true);
    expect(result.error).toBeNull();
    expect(result.value).toBe(baseValue);
  });

  it("seeds the refine value from a loaded interaction (every editable field)", () => {
    const loaded: InteractionForEdit = {
      id: 5,
      contactId: 3,
      occurredAt: "2026-08-20 18:00:00",
      channel: "Call",
      direction: "inbound",
      connected: 0,
      quality: "Neutral",
      note: "quick call",
      duration: 900,
      allowAi: 1,
    };
    expect(seedRefineValue(loaded)).toEqual({
      occurredAt: "2026-08-20 18:00:00",
      channel: "Call",
      direction: "inbound",
      connected: 0,
      quality: "Neutral",
      note: "quick call",
      duration: 900,
      allowAi: 1,
    });
  });
});
