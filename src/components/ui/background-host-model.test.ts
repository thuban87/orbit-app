import { describe, expect, it } from "vitest";
import { backgroundHostSelection } from "./background-host-model";

describe("BackgroundHost local render fallback", () => {
  it("latches an app-owned render failure until the original selection changes", () => {
    const selected = {
      package: "galaxy" as const,
      slotId: "galaxy-nebula" as const,
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
});
