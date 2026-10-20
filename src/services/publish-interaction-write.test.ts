import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * publishInteractionWrite (38.14 D-27, D-81): after a committed interaction or
 * group-event write, the widget is told and the shell refreshes. Each step is
 * isolated, so one failure never suppresses the other and nothing rethrows
 * into a write that already committed (T-38.14-07-05).
 */
const calls = vi.hoisted(() => ({ order: [] as string[] }));
const { notifyWidgetDataChanged, bumpShellRefresh, loggerError } = vi.hoisted(
  () => ({
    notifyWidgetDataChanged: vi.fn(() => {
      calls.order.push("widget");
    }),
    bumpShellRefresh: vi.fn(() => {
      calls.order.push("shell");
    }),
    loggerError: vi.fn(),
  }),
);
vi.mock("@/services/widget/widget-refresh", () => ({
  notifyWidgetDataChanged,
}));
vi.mock("@/stores/shell-refresh-store", () => ({ bumpShellRefresh }));
vi.mock("@/utils/logger", () => ({ Logger: { error: loggerError } }));

const { publishInteractionWrite } = await import("./publish-interaction-write");

beforeEach(() => {
  calls.order = [];
  notifyWidgetDataChanged.mockClear();
  bumpShellRefresh.mockClear();
  loggerError.mockClear();
});

describe("publishInteractionWrite", () => {
  it("notifies the widget, then bumps the shell refresh, once each", () => {
    publishInteractionWrite();
    expect(calls.order).toEqual(["widget", "shell"]);
    expect(notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
    expect(bumpShellRefresh).toHaveBeenCalledTimes(1);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("a widget failure is logged, never rethrown, and the shell still refreshes", () => {
    notifyWidgetDataChanged.mockImplementationOnce(() => {
      throw new Error("widget");
    });
    expect(() => publishInteractionWrite()).not.toThrow();
    expect(bumpShellRefresh).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it("a shell failure is logged, never rethrown, after the widget was told", () => {
    bumpShellRefresh.mockImplementationOnce(() => {
      throw new Error("shell");
    });
    expect(() => publishInteractionWrite()).not.toThrow();
    expect(notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it("logs a content-free message for each failed step", () => {
    notifyWidgetDataChanged.mockImplementationOnce(() => {
      throw new Error("widget");
    });
    bumpShellRefresh.mockImplementationOnce(() => {
      throw new Error("shell");
    });
    publishInteractionWrite();
    const messages = loggerError.mock.calls.map((call) => call[1]);
    expect(messages).toEqual([
      "widget notify after a write failed",
      "shell refresh after a write failed",
    ]);
  });
});
