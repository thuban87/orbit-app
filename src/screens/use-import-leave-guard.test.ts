import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  discardSession: vi.fn(),
  listSessionRows: vi.fn(),
}));

vi.mock("react", () => ({
  useEffect: (effect: () => undefined | (() => void)) => {
    effect();
  },
  useRef: <T>(value: T) => ({ current: value }),
  useCallback: <T>(callback: T) => callback,
}));
vi.mock("react-native", () => ({ Alert: { alert: mocks.alert } }));
vi.mock("@/db/database", () => ({
  getExecutor: () => ({}),
  localDateTime: () => "2026-09-27 12:00:00",
}));
vi.mock("@/db/import-session-dao", () => ({
  discardSession: mocks.discardSession,
}));
vi.mock("@/db/import-session-read", () => ({
  listSessionRows: mocks.listSessionRows,
}));
vi.mock("@/services/photos/photo-storage", () => ({
  deleteImportStaging: vi.fn(),
}));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { useImportLeaveGuard } = await import("./use-import-leave-guard");

type BeforeRemove = (event: {
  preventDefault: () => void;
  data: { action: unknown };
}) => void;

function mountGuard(hasMeaningfulEdits: boolean) {
  let listener: BeforeRemove | null = null;
  const navigation = {
    addListener: vi.fn((_name: string, callback: BeforeRemove) => {
      listener = callback;
      return () => {};
    }),
    dispatch: vi.fn(),
  };
  // biome-ignore lint/correctness/useHookAtTopLevel: react is mocked; the hook runs as a plain function here.
  const markComplete = useImportLeaveGuard(
    navigation as never,
    7,
    hasMeaningfulEdits,
  );
  const fire = () => {
    const event = { preventDefault: vi.fn(), data: { action: "RESET" } };
    listener?.(event);
    return event;
  };
  return { markComplete, fire, navigation };
}

describe("useImportLeaveGuard (D-72)", () => {
  beforeEach(() => {
    mocks.alert.mockReset();
    mocks.listSessionRows.mockReset().mockResolvedValue([]);
    mocks.discardSession.mockReset().mockResolvedValue([]);
  });

  it("still prompts Leave import? when an edited review is left uncommitted", () => {
    const { fire } = mountGuard(true);
    const event = fire();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledWith(
      "Leave import?",
      expect.any(String),
      expect.any(Array),
    );
  });

  it("lets the post-import navigation through once the import is marked complete", () => {
    const { markComplete, fire } = mountGuard(true);
    expect(typeof markComplete).toBe("function");
    markComplete();
    const event = fire();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(mocks.discardSession).not.toHaveBeenCalled();
  });
});

describe("import screens mark the guard complete before post-commit navigation (D-72)", () => {
  const read = (file: string) =>
    readFileSync(join(__dirname, file), "utf8").replace(/\r\n/g, "\n");

  it.each(["ImportReviewScreen.tsx", "BulkImportSetupScreen.tsx"])(
    "%s: every reset-to-Profile / ImportComplete follows markImportComplete()",
    (file) => {
      const source = read(file);
      const sites = [
        ...source.matchAll(
          /navigationRef\.current\?\.reset\(|navigation\.replace\("ImportComplete"/g,
        ),
      ];
      expect(sites.length).toBeGreaterThan(0);
      for (const site of sites) {
        const before = source.slice(0, site.index).trimEnd();
        expect(before.endsWith("markImportComplete();")).toBe(true);
      }
    },
  );
});

describe("bulk setup stops guarding once its batch has started (D-73c)", () => {
  const source = readFileSync(
    join(__dirname, "BulkImportSetupScreen.tsx"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  // Import Complete's Done resets the root, which removes the setup screen
  // still in the stack. Unmarked, the guard then asked "Leave import?" (after a
  // Bound batch) or silently discarded the batch's Need-review rows.
  it("every navigation into ImportProgress follows markImportComplete()", () => {
    const sites = [
      ...source.matchAll(/navigation\.navigate\("ImportProgress"/g),
    ];
    expect(sites.length).toBe(2);
    for (const site of sites) {
      const before = source.slice(0, site.index).trimEnd();
      expect(before.endsWith("markImportComplete();")).toBe(true);
    }
  });

  it("the stopped view's Discard discards explicitly before leaving", () => {
    const start = source.indexOf("function onDiscardStopped(");
    const body = source.slice(start, source.indexOf("\n  }\n", start));
    expect(body).toContain(
      "await discardUnresolvedSession(route.params.sessionId)",
    );
    expect(body.indexOf("discardUnresolvedSession")).toBeLessThan(
      body.indexOf("navigation.goBack()"),
    );
  });
});
