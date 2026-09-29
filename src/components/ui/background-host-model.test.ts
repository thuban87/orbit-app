import { describe, expect, it } from "vitest";
import { backgroundHostSelection } from "./background-host-model";

describe("BackgroundHost local render fallback", () => {
  it("latches an app-owned render failure until the original selection changes", () => {
    const selected = {
      package: "galaxy" as const,
      slotId: "galaxy-aurora" as const,
      mode: "dark" as const,
      appOwnedBackgroundUri: "file:///documents/profile-backgrounds/first.jpg",
      forceRenderError: false,
    };
    const beforeFailure = backgroundHostSelection({
      ...selected,
      renderFailed: false,
    });
    const afterFailure = backgroundHostSelection({
      ...selected,
      renderFailed: true,
    });

    expect(beforeFailure.localUri).toBe(selected.appOwnedBackgroundUri);
    expect(afterFailure.localUri).toBeNull();
    expect(afterFailure.selectionKey).toBe(beforeFailure.selectionKey);

    const nextSelection = backgroundHostSelection({
      ...selected,
      appOwnedBackgroundUri: "file:///documents/profile-backgrounds/second.jpg",
      renderFailed: true,
    });
    expect(nextSelection.selectionKey).not.toBe(beforeFailure.selectionKey);
  });

  it("a failed variant does not stick across a light -> dark mode switch (Pitfall 4 / T-38.5-02-02)", () => {
    const base = {
      package: "galaxy" as const,
      slotId: "galaxy-aurora" as const,
      appOwnedBackgroundUri: null,
      forceRenderError: false,
    };
    const lightFailed = backgroundHostSelection({
      ...base,
      mode: "light",
      renderFailed: true,
    });
    const lightRetry = backgroundHostSelection({
      ...base,
      mode: "light",
      renderFailed: false,
    });
    const darkSelection = backgroundHostSelection({
      ...base,
      mode: "dark",
      renderFailed: true,
    });
    // Same package, slot and URI: the render failure alone never changes the key
    // (the latch holds within a mode)...
    expect(lightFailed.selectionKey).toBe(lightRetry.selectionKey);
    // ...but the mode switch does, so BackgroundHost resets its latch and the
    // dark variant gets a fresh render attempt.
    expect(darkSelection.selectionKey).not.toBe(lightFailed.selectionKey);
  });
});
