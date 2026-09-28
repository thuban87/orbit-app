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

function mountGuard(hasMeaningfulEdits: boolean, isBusy?: () => boolean) {
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
    isBusy,
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

describe("useImportLeaveGuard while the import is starting (D-74)", () => {
  beforeEach(() => {
    mocks.alert.mockReset();
    mocks.listSessionRows.mockReset().mockResolvedValue([]);
    mocks.discardSession.mockReset().mockResolvedValue([]);
  });

  it("holds the screen and discards nothing while busy", async () => {
    const { fire, navigation } = mountGuard(false, () => true);
    const event = fire();
    await Promise.resolve();
    await Promise.resolve();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mocks.listSessionRows).not.toHaveBeenCalled();
    expect(mocks.discardSession).not.toHaveBeenCalled();
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it("behaves as before once no longer busy", () => {
    const { fire } = mountGuard(false, () => false);
    const event = fire();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mocks.listSessionRows).toHaveBeenCalledWith({}, 7);
  });
});

describe("bulk setup holds Back while its Import or Combine is starting (D-74)", () => {
  const source = readFileSync(
    join(__dirname, "BulkImportSetupScreen.tsx"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const fn = (name: string) => {
    const start = source.indexOf(`async function ${name}(`);
    expect(start, `${name} exists`).toBeGreaterThan(-1);
    return source.slice(start, source.indexOf("\n  }\n", start));
  };

  it("passes a busy check to the leave guard", () => {
    expect(source.replace(/\s+/g, " ")).toMatch(
      /useImportLeaveGuard\( navigation, route\.params\.sessionId, edited && !stopped, \(\) => starting\.current,? \)/,
    );
  });

  it.each(["onImport", "onCombine"])(
    "%s marks the start before its first await",
    (name) => {
      const body = fn(name);
      const mark = body.indexOf("starting.current = true");
      expect(mark).toBeGreaterThan(-1);
      expect(mark).toBeLessThan(body.indexOf("await "));
    },
  );

  it("clears the start whenever the screen stays (prompt, failure, focus)", () => {
    expect(fn("onImport")).toMatch(
      /setConsolidationRows\(cluster\);\s*starting\.current = false;/,
    );
    expect(fn("startBatch")).toMatch(
      /catch \(error\) \{[\s\S]*starting\.current = false;/,
    );
    expect(fn("onCombine")).toMatch(
      /catch \(error\) \{[\s\S]*starting\.current = false;/,
    );
    expect(source).toMatch(
      /useFocusEffect\(\s*useCallback\(\(\) => \{\s*starting\.current = false;/,
    );
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
