/**
 * Recovery prompts at large text (38.4 D-49, owner; RG-034 follow-on; OA-D3).
 *
 * "Resume your import?" and "Resume your check?" are hand-built RN `Modal`s
 * (the D-42 A exemption, asserted by fab-dial-shell-overlays-contract). At
 * font_scale 2.0 on a narrow screen their card could outgrow the window and
 * push the buttons off screen. Plan 11's `ConfirmDialog` precedent fixes that:
 * the heading and body scroll in a bounded `ScrollView` (`flexGrow: 0`,
 * `flexShrink: 1`), the card shrinks (`flexShrink: 1`), the root is inset by
 * the safe area, and the actions sit OUTSIDE the scroll region so they never
 * scroll away. The exits stay explicit-action-only.
 *
 * Adjacent (ADR-084): a label on an accent fill reads `colors.onAccent`, never
 * the page `background` token.
 *
 * The assist banner's `PendingConfirmationsSheet` is pinned too: its sheet is
 * height-bounded and its queue scrolls, so every confirmation's buttons can be
 * reached.
 *
 * Render-free: these are source assertions over the component files.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** The body of `name: { … }` inside the file's `StyleSheet.create` block. */
function styleBody(text: string, name: string): string {
  const sheetStart = text.indexOf("StyleSheet.create(");
  expect(sheetStart, "StyleSheet.create block").toBeGreaterThan(-1);
  const match = new RegExp(`\\b${name}:\\s*\\{([^}]*)\\}`).exec(
    text.slice(sheetStart),
  );
  expect(match, `style ${name}`).not.toBeNull();
  return match?.[1] ?? "";
}

interface PromptCase {
  name: string;
  path: string;
  heading: string;
  /** A fragment of every body-copy variant. */
  bodyFragments: string[];
  actions: string[];
}

const PROMPTS: PromptCase[] = [
  {
    name: "ResumeImportPrompt",
    path: "src/components/ResumeImportPrompt.tsx",
    heading: "Resume your import?",
    bodyFragments: [
      "Imported contacts have photos waiting",
      "This saved import can’t be resumed.",
      "Unresolved items are saved.",
    ],
    actions: ['"Resume import"', '"Discard import"', '"Later"'],
  },
  {
    name: "ResumeReconcilePrompt",
    path: "src/components/ResumeReconcilePrompt.tsx",
    heading: "Resume your check?",
    bodyFragments: [
      "This saved check can’t be resumed.",
      "Unresolved contacts are saved.",
    ],
    actions: ['"Resume check"', '"Discard check"'],
  },
];

describe("recovery prompts keep their buttons reachable at large text (D-49)", () => {
  for (const prompt of PROMPTS) {
    describe(prompt.name, () => {
      const text = source(prompt.path);

      it("stays an RN Modal with an explicit-action-only exit", () => {
        expect(text).toMatch(/<Modal\b/);
        expect(text).toContain("onRequestClose={() => undefined}");
      });

      it("scrolls the heading and body inside one bounded ScrollView", () => {
        const opens = [...text.matchAll(/<ScrollView\b/g)];
        expect(opens).toHaveLength(1);
        const open = opens[0].index ?? -1;
        const close = text.indexOf("</ScrollView>", open);
        expect(close).toBeGreaterThan(open);
        const opener = text.slice(open, text.indexOf(">", open) + 1);
        const styleName = /style=\{styles\.(\w+)\}/.exec(opener)?.[1];
        expect(styleName, "ScrollView style binding").toBeDefined();
        const body = styleBody(text, styleName ?? "");
        expect(body).toMatch(/flexGrow:\s*0\b/);
        expect(body).toMatch(/flexShrink:\s*1\b/);
        const inside = text.slice(open, close);
        expect(inside).toContain(prompt.heading);
        for (const fragment of prompt.bodyFragments) {
          expect(inside, fragment).toContain(fragment);
        }
      });

      it("renders every action after the scroll region, never inside it", () => {
        const close = text.indexOf("</ScrollView>");
        expect(close).toBeGreaterThan(-1);
        const pressables = [...text.matchAll(/<Pressable\b/g)];
        expect(pressables.length).toBeGreaterThanOrEqual(
          prompt.actions.length - 1,
        );
        for (const pressable of pressables) {
          expect(pressable.index ?? -1).toBeGreaterThan(close);
        }
        for (const action of prompt.actions) {
          const at = text.indexOf(action);
          expect(at, action).toBeGreaterThan(close);
        }
      });

      it("shrinks the card and insets the root by the safe area", () => {
        expect(styleBody(text, "sheet")).toMatch(/flexShrink:\s*1\b/);
        expect(text).toMatch(
          /import \{[^}]*\buseSafeAreaInsets\b[^}]*\} from "react-native-safe-area-context"/,
        );
        expect(text).toMatch(/=\s*useSafeAreaInsets\(\)/);
        expect(text).toMatch(/paddingTop:\s*insets\.top\s*\+/);
        expect(text).toMatch(/paddingBottom:\s*insets\.bottom\s*\+/);
      });

      it("labels the accent-filled button in onAccent (ADR-084)", () => {
        const fill = text.indexOf("backgroundColor: colors.accent");
        expect(fill).toBeGreaterThan(-1);
        const label = /color:\s*colors\.(\w+)/.exec(text.slice(fill + 1));
        expect(label?.[1]).toBe("onAccent");
        expect(text).not.toContain("color: colors.background");
      });
    });
  }
});

describe("PendingConfirmationsSheet keeps every confirmation reachable (D-49)", () => {
  const text = source("src/components/PendingConfirmationsSheet.tsx");

  it("height-bounds the sheet", () => {
    expect(styleBody(text, "sheet")).toMatch(/maxHeight:\s*"\d+%"/);
  });

  it("scrolls the queue, with the title outside and every confirmation inside", () => {
    const open = text.indexOf("<ScrollView");
    const close = text.indexOf("</ScrollView>");
    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(open);
    const title = text.indexOf("Pending confirmations\n");
    expect(title).toBeGreaterThan(-1);
    expect(title).toBeLessThan(open);
    const inside = text.slice(open, close);
    expect(inside).toContain("queue.map(");
    expect(inside).toContain("<AssistConfirmation");
    expect(text.split("<AssistConfirmation").length - 1).toBe(1);
  });

  it("renders the empty state without a ScrollView", () => {
    const empty = text.indexOf("queue.length === 0 ?");
    const open = text.indexOf("<ScrollView");
    expect(empty).toBeGreaterThan(-1);
    const emptyBranch = text.slice(empty, open);
    expect(emptyBranch).toContain("You're all caught up");
    expect(emptyBranch).not.toMatch(/<ScrollView\b/);
  });
});
