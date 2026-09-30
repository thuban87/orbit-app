/**
 * Avatar load-error reporting (38.6 review WR-06), shallow.
 *
 * Hooks are stubbed: `useState` returns the hoisted `errored` value and records
 * its setter calls, and `useEffect` runs its effect immediately, so one call of
 * `Avatar(...)` is one render with its effects flushed.
 */
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

const h = vi.hoisted(() => ({
  errored: false,
  setErrored: [] as unknown[],
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({ current: value }),
  useEffect: (effect: () => undefined | (() => void)) => {
    effect();
  },
  useState: () => [
    h.errored,
    (next: unknown) => {
      h.setErrored.push(next);
    },
  ],
}));
vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  View: "View",
}));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("@/components/photo-display", () => ({
  usePhotoDisplay: (relative: string | null) =>
    relative
      ? {
          source: { uri: `file:///docs/${relative}?v=3` },
          cachePolicy: "memory",
          revision: 3,
        }
      : null,
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));

import { Avatar } from "./Avatar";

interface Node {
  readonly type: string;
  readonly props: Record<string, unknown>;
}

function root(node: ReactNode): Node {
  const element = node as ReactElement<Record<string, unknown>>;
  return { type: element.type as string, props: element.props };
}

beforeEach(() => {
  h.errored = false;
  h.setErrored.length = 0;
});

describe("Avatar onLoadErrorChange (WR-06)", () => {
  it("reports false while the photo renders, and its onError flags the error", () => {
    const onLoadErrorChange = vi.fn();
    const image = root(
      Avatar({
        photo: "avatars/contact-7.jpg",
        name: "Alex",
        contactId: 7,
        size: 224,
        onLoadErrorChange,
      }),
    );
    expect(image.type).toBe("Image");
    expect(onLoadErrorChange).toHaveBeenLastCalledWith(false);
    h.setErrored.length = 0;
    (image.props.onError as () => void)();
    expect(h.setErrored).toEqual([true]);
  });

  it("reports true while the initials stand in for an unloadable photo", () => {
    h.errored = true;
    const onLoadErrorChange = vi.fn();
    const fallback = root(
      Avatar({
        photo: "avatars/contact-7.jpg",
        name: "Alex",
        size: 224,
        onLoadErrorChange,
      }),
    );
    expect(fallback.props.testID).toBe("avatar-initials");
    expect(onLoadErrorChange).toHaveBeenLastCalledWith(true);
  });

  it("works without a listener", () => {
    expect(() =>
      Avatar({ photo: "avatars/contact-7.jpg", name: "Alex", size: 48 }),
    ).not.toThrow();
  });
});
