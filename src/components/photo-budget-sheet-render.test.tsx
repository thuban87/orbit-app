import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Shallow render of the D-133 photo-budget sheet: four choices in order, the
 * "Continue anyway" backup warning, the projected size, the unknown-size
 * variant (convergence c4 E-1), and `usePhotoBudgetPrompt`'s promise lifecycle
 * (a tiny hook harness keeps `useState` values across "renders").
 */

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  index: 0,
  refIndex: 0,
  cleanups: [] as (() => void)[],
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: (fn: unknown) => fn,
  useRef: (value: unknown) => {
    const slot = hooks.refIndex++;
    if (!(slot in hooks.refs)) hooks.refs[slot] = { current: value };
    return hooks.refs[slot];
  },
  useState: (value: unknown) => {
    const slot = hooks.index++;
    if (!(slot in hooks.states)) hooks.states[slot] = value;
    return [
      hooks.states[slot],
      (next: unknown) => {
        hooks.states[slot] = next;
      },
    ];
  },
  useEffect: (effect: () => (() => void) | undefined) => {
    const cleanup = effect();
    if (cleanup) hooks.cleanups.push(cleanup);
  },
}));
vi.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
vi.mock("@/components/ui/Sheet", () => ({ Sheet: "Sheet" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("expo-sqlite", () => ({}));
vi.mock("expo-file-system", () => ({
  Paths: { document: { uri: "file:///doc" } },
  File: class {},
  Directory: class {},
}));

const {
  PHOTO_BUDGET_CONTINUE_WARNING,
  PHOTO_BUDGET_TITLE,
  PhotoBudgetSheet,
  usePhotoBudgetPrompt,
} = await import("./PhotoBudgetSheet");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

/** Expand the top-level function component one level (PhotoBudgetSheet). */
function expand(element: TestElement): TestElement[] {
  const render = element.type as (props: unknown) => ReactNode;
  return nodes(render(element.props));
}

const LABELS = [
  "Import with smaller photos",
  "Import without photos",
  "Continue anyway",
  "Go back",
];

function renderSheet(estimate: { projectedBytes: number } | null) {
  const onChoose = vi.fn();
  const onRequestClose = vi.fn();
  const tree = nodes(
    PhotoBudgetSheet({ visible: true, estimate, onChoose, onRequestClose }),
  );
  return { tree, onChoose, onRequestClose };
}

beforeEach(() => {
  hooks.states = [];
  hooks.refs = [];
  hooks.index = 0;
  hooks.refIndex = 0;
  hooks.cleanups = [];
});

describe("PhotoBudgetSheet (D-133)", () => {
  it("offers the four choices in order, smaller as primary", () => {
    const { tree, onChoose } = renderSheet({
      projectedBytes: 9.25 * 1024 * 1024,
    });
    const buttons = tree.filter((n) => n.type === "Button");
    expect(buttons.map((b) => b.props.label)).toEqual(LABELS);
    expect(buttons[0].props.role).toBe("primary");
    const choices = ["smaller", "without", "continue", "back"];
    buttons.forEach((button, i) => {
      (button.props.onPress as () => void)();
      expect(onChoose).toHaveBeenLastCalledWith(choices[i]);
    });
  });

  it("shows the title, the projected MB and the 8 MB cap", () => {
    const { tree } = renderSheet({ projectedBytes: 9.25 * 1024 * 1024 });
    const texts = tree.filter((n) => n.type === "AppText");
    expect(texts[0].props.children).toBe(PHOTO_BUDGET_TITLE);
    expect(
      tree.find((n) => n.props.testID === "photo-budget-body")?.props.children,
    ).toBe(
      "Importing these photos would make your backup about 9.3 MB. Backups can't be bigger than 8 MB.",
    );
  });

  it("puts the backup warning with Continue anyway", () => {
    const { tree } = renderSheet({ projectedBytes: 9_000_000 });
    const warning = tree.find(
      (n) => n.props.testID === "photo-budget-continue-warning",
    );
    expect(warning?.props.children).toBe(
      "Backups will stop working until some photos are removed.",
    );
    expect(warning?.props.children).toBe(PHOTO_BUDGET_CONTINUE_WARNING);
    const labels = tree
      .filter(
        (n) =>
          n.type === "Button" ||
          n.props.testID === "photo-budget-continue-warning",
      )
      .map((n) => n.props.label ?? "warning");
    expect(labels.indexOf("warning")).toBe(
      labels.indexOf("Continue anyway") + 1,
    );
  });

  it("renders the unknown-size variant with the same four choices (c4 E-1)", () => {
    const { tree } = renderSheet(null);
    expect(
      tree.find((n) => n.props.testID === "photo-budget-body")?.props.children,
    ).toBe(
      "Orbit couldn't check whether these photos fit in your backups. Backups can't be bigger than 8 MB.",
    );
    expect(
      tree.filter((n) => n.type === "Button").map((b) => b.props.label),
    ).toEqual(LABELS);
  });
});

describe("usePhotoBudgetPrompt", () => {
  function render() {
    hooks.index = 0;
    hooks.refIndex = 0;
    // biome-ignore lint/correctness/useHookAtTopLevel: react is mocked; the hook runs as a plain function here.
    return usePhotoBudgetPrompt();
  }

  it("is hidden until asked, then resolves with the chosen option", async () => {
    let prompt = render();
    expect((prompt.sheet as TestElement).props.visible).toBe(false);
    const answer = prompt.ask({ projectedBytes: 9_000_000 });
    prompt = render();
    const sheet = prompt.sheet as TestElement;
    expect(sheet.props.visible).toBe(true);
    expect(sheet.props.estimate).toEqual({ projectedBytes: 9_000_000 });
    const buttons = expand(sheet).filter((n) => n.type === "Button");
    (buttons[1].props.onPress as () => void)();
    await expect(answer).resolves.toBe("without");
    expect((render().sheet as TestElement).props.visible).toBe(false);
  });

  it("dismissing (scrim or Back) resolves Go back", async () => {
    let prompt = render();
    const answer = prompt.ask(null);
    prompt = render();
    const sheet = prompt.sheet as TestElement;
    expect(sheet.props.estimate).toBeNull();
    (sheet.props.onRequestClose as () => void)();
    await expect(answer).resolves.toBe("back");
  });

  it("leaving the screen with the sheet up resolves Go back", async () => {
    const prompt = render();
    const answer = prompt.ask({ projectedBytes: 9_000_000 });
    for (const cleanup of hooks.cleanups) cleanup();
    await expect(answer).resolves.toBe("back");
  });
});
