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
 * 38.12 D-56: both prompts now render through the one shared
 * `ResumePromptSheet`, so the layout contract is asserted there once and each
 * prompt is checked to use it with its own copy.
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

/**
 * 38.12 D-56: both prompts share one pattern — the layout, sizes and
 * explicit-action-only exit live in `ResumePromptSheet`; each prompt supplies
 * only its heading, body copy and actions.
 */
const SHEET_PATH = "src/components/ResumePromptSheet.tsx";

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
      "left to import. Discard drops them; nothing already imported changes.",
    ],
    actions: ['"Resume import"', '"Discard import"', '"Later"', '"Not now"'],
  },
  {
    name: "ResumeReconcilePrompt",
    path: "src/components/ResumeReconcilePrompt.tsx",
    heading: "Resume your check?",
    bodyFragments: ["This saved check can’t be resumed.", "left to check."],
    actions: ['"Resume check"', '"Discard check"', '"Not now"'],
  },
];

describe("the shared resume prompt sheet keeps its buttons reachable at large text (D-49, D-56)", () => {
  const text = source(SHEET_PATH);

  it("stays an RN Modal window (through RegisteredModal, 38.9 D-24) with an explicit-action-only exit", () => {
    expect(text).toMatch(/<RegisteredModal\b/);
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
    expect(inside).toContain("{heading}");
    expect(inside).toContain("{body}");
  });

  it("renders every action after the scroll region, never inside it", () => {
    const close = text.indexOf("</ScrollView>");
    expect(close).toBeGreaterThan(-1);
    const pressables = [...text.matchAll(/<Pressable\b/g)];
    expect(pressables.length).toBeGreaterThanOrEqual(1);
    for (const pressable of pressables) {
      expect(pressable.index ?? -1).toBeGreaterThan(close);
    }
    expect(text.indexOf("actions.map(")).toBeGreaterThan(close);
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
    expect(text).toContain("backgroundColor: colors.accent");
    expect(text).toMatch(/primary:\s*colors\.onAccent\b/);
    expect(text).not.toContain("color: colors.background");
  });
});

describe("both resume prompts use the shared sheet (D-56)", () => {
  for (const prompt of PROMPTS) {
    describe(prompt.name, () => {
      const text = source(prompt.path);

      it("renders through ResumePromptSheet with no layout of its own", () => {
        expect(text).toMatch(
          /import \{[^}]*\bResumePromptSheet\b[^}]*\} from "@\/components\/ResumePromptSheet"/,
        );
        expect(text).toMatch(/<ResumePromptSheet\b/);
        expect(text).not.toMatch(/<ScrollView\b/);
        expect(text).not.toMatch(/<RegisteredModal\b/);
        expect(text).not.toContain("StyleSheet.create(");
      });

      it("keeps its heading, every body variant and every action", () => {
        expect(text).toContain(prompt.heading);
        for (const fragment of prompt.bodyFragments) {
          expect(text, fragment).toContain(fragment);
        }
        for (const action of prompt.actions) {
          expect(text, action).toContain(action);
        }
      });
    });
  }
});

describe("PendingConfirmationsSheet keeps every confirmation reachable (D-49)", () => {
  const text = source("src/components/PendingConfirmationsSheet.tsx");

  // 38.14 D-74: the list is now a sized bottom `Sheet` (ADR-255). The Sheet's
  // variant supplies the height bound (compact / detail percent caps, or the
  // 92% expanded sheet), and the list owns the one bounded scroll.
  it("height-bounds the sheet", () => {
    const sheets = text.split("<Sheet").length - 1;
    expect(sheets).toBeGreaterThan(0);
    expect(text).toMatch(/variant="expanded"/);
    expect(text).toMatch(
      /variant=\{variant === "compact" \? "compact" : "detail"\}\s+scrollBody=\{false\}/,
    );
    expect(styleBody(text, "content")).toMatch(/flexShrink:\s*1/);
    expect(styleBody(text, "scroll")).toMatch(/flexShrink:\s*1/);
  });

  it("scrolls the queue, with the title outside and every confirmation inside", () => {
    expect(text).toContain('const TITLE = "Pending confirmations";');
    // Every Sheet block puts the title before the scroll and the list inside it.
    let from = text.indexOf("<Sheet");
    expect(from).toBeGreaterThan(-1);
    while (from !== -1) {
      const end = text.indexOf("</Sheet>", from);
      const block = text.slice(from, end);
      const open = block.indexOf("<ScrollView");
      const close = block.indexOf("</ScrollView>");
      expect(open).toBeGreaterThan(-1);
      expect(close).toBeGreaterThan(open);
      expect(block.indexOf("{title}")).toBeGreaterThan(-1);
      expect(block.indexOf("{title}")).toBeLessThan(open);
      expect(block.slice(open, close)).toContain("{list}");
      expect(block.indexOf("{closeRow}")).toBeGreaterThan(close);
      from = text.indexOf("<Sheet", end);
    }
    const list = text.slice(
      text.indexOf("const list ="),
      text.indexOf("const closeRow ="),
    );
    expect(list).toContain("rows.map(");
    expect(list).toContain("<AssistConfirmation");
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

/**
 * Import Complete at large text (38.4 D-67, owner; review C WR-02). The loaded
 * summary stacks a title, the outcome cards, a notice and a retry block above
 * its actions. It takes the D-49 shape: the content scrolls in one bounded
 * ScrollView and the actions (Review possible matches, View contact, Done) sit
 * after it, outside the scroll, so they are always on screen and reachable.
 */
describe("Import Complete keeps Done and Review reachable at large text (D-67)", () => {
  const text = source("src/screens/ImportCompleteScreen.tsx");
  const screenStart = text.indexOf('testID="import-complete-screen"');
  const loaded = text.slice(screenStart);

  it("finds the loaded summary branch", () => {
    expect(screenStart).toBeGreaterThan(-1);
  });

  it("scrolls the counts, notice and retry block inside one ScrollView; the title is the shared header above it (38.9 D-16)", () => {
    const opens = [...loaded.matchAll(/<ScrollView\b/g)];
    expect(opens).toHaveLength(1);
    const open = opens[0].index ?? -1;
    const close = loaded.indexOf("</ScrollView>", open);
    expect(close).toBeGreaterThan(open);
    const opener = loaded.slice(open, loaded.indexOf(">", open) + 1);
    const styleName = /\bstyle=\{styles\.(\w+)\}/.exec(opener)?.[1];
    expect(styleName, "ScrollView style binding").toBeDefined();
    expect(styleBody(text, styleName ?? "")).toMatch(/flexShrink:\s*1\b/);
    const inside = loaded.slice(open, close);
    // The title moved into the shared header, which does not scroll.
    expect(text).toContain(
      '<ShellAppBar variant="child" title="Import complete" onBack={done} />',
    );
    const headerAt = loaded.indexOf("{header}");
    expect(headerAt).toBeGreaterThan(-1);
    expect(headerAt).toBeLessThan(open);
    for (const fragment of [
      // 38.12 D-55/D-109: every outcome card ("Imported (3)", "Skipped by
      // you (1)", …) is one mapped card with a titled-count line.
      "testID={`import-complete-outcome-",
      "bucket.count})`}",
      // The count goes through the shared plural helper (38.9 D-21).
      'plural(counts.birthdayUnreadable, "birthday")} couldn\'t be read',
      'testID="import-complete-action-notice"',
      'testID="import-complete-retry"',
      'testID="import-complete-skip-photos"',
    ]) {
      expect(inside, fragment).toContain(fragment);
    }
    expect(text).toMatch(
      /import \{[^}]*\bScrollView\b[^}]*\} from "react-native"/,
    );
  });

  it("renders Review, View contact and Done after the scroll region", () => {
    const close = loaded.indexOf("</ScrollView>");
    expect(close).toBeGreaterThan(-1);
    for (const id of [
      'testID="import-complete-review"',
      'testID="import-complete-view-contact"',
      'testID="import-complete-done"',
    ]) {
      const at = loaded.indexOf(id);
      expect(at, id).toBeGreaterThan(close);
    }
  });
});
