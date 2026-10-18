import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of the Restore result (38.6 D-30/D-33, reviews IN2-02/IN3-03): photos the
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
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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
  mode?: "merge" | "replace-all";
  people?: {
    before: number;
    restored: number;
    removed: number;
    movedToBin: number;
  };
}): string[] {
  const element = RestoreResultScreen({
    navigation: { reset: vi.fn() },
    route: {
      params: {
        mode: "replace-all",
        people: { before: 1, restored: 1, removed: 0, movedToBin: 0 },
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

describe("Restore result photo copy (38.6 D-30/D-33)", () => {
  it("says restore-missing photos were not in the backup, apart from the safety-backup count", () => {
    const lines = render({
      restoredPhotosMissing: 2,
      replaceSafetySnapshotSkippedPhotos: 1,
    });
    expect(lines).toContain(
      "2 photos weren't in the backup and couldn't be restored.",
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
    ).toContain("1 photo wasn't in the backup and couldn't be restored.");
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

describe("Backup restored counts people (38.12 D-59, D-140)", () => {
  const photos = {
    restoredPhotosMissing: 0,
    replaceSafetySnapshotSkippedPhotos: 0,
  };

  it("a Replace-all result shows people before, restored and removed, and the Bin line when any moved", () => {
    const lines = render({
      ...photos,
      mode: "replace-all",
      people: { before: 12, restored: 40, removed: 3, movedToBin: 2 },
    });
    expect(lines).toContain("Contacts on this phone before: 12");
    expect(lines).toContain("Contacts restored: 40");
    expect(lines).toContain("Contacts removed: 3");
    expect(lines).toContain("2 contacts moved to the Bin");
    expect(lines.some((line) => line.startsWith("Added:"))).toBe(false);
  });

  it("a Merge result shows no removed line and no Bin line", () => {
    const lines = render({
      ...photos,
      mode: "merge",
      people: { before: 12, restored: 40, removed: 0, movedToBin: 0 },
    });
    expect(lines).toContain("Contacts on this phone before: 12");
    expect(lines).toContain("Contacts restored: 40");
    expect(lines.some((line) => line.includes("removed"))).toBe(false);
    expect(lines.some((line) => line.includes("Bin"))).toBe(false);
  });
});
