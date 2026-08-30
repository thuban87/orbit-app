import { describe, expect, it, vi } from "vitest";

const { isContactPickerAvailable } = vi.hoisted(() => ({
  isContactPickerAvailable: vi.fn(),
}));

vi.mock("../../modules/orbit-contact-picker", () => ({
  isContactPickerAvailable,
}));

import { contactImportMode } from "./use-contact-import-mode";

describe("contactImportMode", () => {
  it("uses the system picker when Android makes it available", () => {
    isContactPickerAvailable.mockReturnValue(true);

    expect(contactImportMode()).toBe("system");
  });

  it("uses the legacy picker when the system picker is unavailable", () => {
    isContactPickerAvailable.mockReturnValue(false);

    expect(contactImportMode()).toBe("legacy");
  });
});
