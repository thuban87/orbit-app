import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of the Restore result (38.6 D-30, review IN2-02): photos the
 * backup left out that this phone did not have either, and photos left out of
 * the Replace-all safety backup, each read in their own words.
 */

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 0,
}));

const { RestoreResultScreen } = await import("./RestoreResultScreen");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}
function textOf(element: TestElement): string {
  const children = element.props.children;
  const parts = Array.isArray(children) ? children : [children];
  return parts
    .map((part) =>
      typeof part === "string" || typeof part === "number" ? String(part) : "",
    )
    .join("");
}

function render(params: {
  restoredPhotosMissing: number;
  replaceSafetySnapshotSkippedPhotos: number;
}): string[] {
  const element = RestoreResultScreen({
    navigation: { reset: vi.fn() },
    route: {
      params: {
        added: 1,
        updated: 0,
        newerLocalKept: 0,
        deletionsApplied: 0,
        photosNeedingAttention: 0,
        photoCleanupPending: 0,
        scheduleResyncPending: false,
        replaceSafetySnapshot: "verified",
        ...params,
      },
    },
  } as never);
  return nodes(element)
    .filter((node) => node.type === "Text")
    .map(textOf);
}

describe("Restore result photo copy (38.6 D-30)", () => {
  it("says already-missing photos were already missing, apart from the safety-backup count", () => {
    const lines = render({
      restoredPhotosMissing: 2,
      replaceSafetySnapshotSkippedPhotos: 1,
    });
    expect(lines).toContain(
      "2 photos were already missing on this phone and couldn't be restored.",
    );
    expect(lines).toContain(
      "A verified backup of this device was created first. 1 photo couldn't be included.",
    );
  });

  it("uses the singular and shows no line for zero", () => {
    expect(
      render({
        restoredPhotosMissing: 1,
        replaceSafetySnapshotSkippedPhotos: 0,
      }),
    ).toContain(
      "1 photo was already missing on this phone and couldn't be restored.",
    );
    const none = render({
      restoredPhotosMissing: 0,
      replaceSafetySnapshotSkippedPhotos: 0,
    });
    expect(none.some((line) => line.includes("missing"))).toBe(false);
    expect(none.some((line) => line.includes("couldn't be included"))).toBe(
      false,
    );
  });
});
