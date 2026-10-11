import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/contact-read", () => ({ getContactHeader: vi.fn() }));
vi.mock("@/db/database", () => ({ getExecutor: vi.fn() }));

import { toContactHeaderLine } from "./use-contact-header";

describe("toContactHeaderLine (D-45 person line)", () => {
  it("maps the header row to name, photo and contact id", () => {
    expect(
      toContactHeaderLine({ id: 7, name: "Ann Lee", photo: "avatars/7.jpg" }),
    ).toEqual({ name: "Ann Lee", photo: "avatars/7.jpg", contactId: 7 });
  });

  it("keeps a null photo (the initials avatar)", () => {
    expect(toContactHeaderLine({ id: 3, name: "Bo", photo: null })).toEqual({
      name: "Bo",
      photo: null,
      contactId: 3,
    });
  });

  it("is null for a missing contact", () => {
    expect(toContactHeaderLine(null)).toBeNull();
  });
});

describe("useContactHeader source contract", () => {
  it("guards a stale result and logs a content-free message on failure (T-38.9-21)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/hooks/use-contact-header.ts", "utf8");
    expect(source).toContain("if (!cancelled) setLine(");
    expect(source).toContain("cancelled = true;");
    // The log message is a fixed literal: no name, no id interpolated.
    const log = source.match(/Logger\.error\(([^;]*)\);/s)?.[1] ?? "";
    expect(log).toContain('"failed to load the person line"');
    expect(log).not.toMatch(/\$\{|name|contactId/);
  });
});
