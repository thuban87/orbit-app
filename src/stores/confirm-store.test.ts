import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirm,
  confirmStore,
  effectiveDismissable,
  notice,
} from "./confirm-store";

beforeEach(() => {
  confirmStore.setState({ queue: [] });
});

const head = () => confirmStore.getState().queue[0];

describe("confirm() (D-24)", () => {
  it("resolves true when the head is confirmed", async () => {
    const result = confirm({ title: "Archive Ann?", confirmLabel: "Archive" });
    confirmStore.getState().resolveCurrent(true);
    await expect(result).resolves.toBe(true);
    expect(confirmStore.getState().queue).toEqual([]);
  });

  it("resolves false when the head is cancelled", async () => {
    const result = confirm({ title: "Archive Ann?", confirmLabel: "Archive" });
    confirmStore.getState().resolveCurrent(false);
    await expect(result).resolves.toBe(false);
  });

  it("queues FIFO with increasing ids; resolving shifts to the next request", async () => {
    const first = confirm({ title: "First", confirmLabel: "OK" });
    const second = confirm({ title: "Second", confirmLabel: "OK" });
    const [a, b] = confirmStore.getState().queue;
    expect(a.request.title).toBe("First");
    expect(b.request.title).toBe("Second");
    expect(b.id).toBeGreaterThan(a.id);
    confirmStore.getState().resolveCurrent(true);
    expect(head()?.request.title).toBe("Second");
    confirmStore.getState().resolveCurrent(false);
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(false);
  });

  it("ignores a stale resolution for a request that is no longer the head (double-tap)", async () => {
    const first = confirm({ title: "First", confirmLabel: "OK" });
    const second = confirm({ title: "Second", confirmLabel: "OK" });
    const firstId = head()?.id;
    confirmStore.getState().resolveCurrent(true, firstId);
    confirmStore.getState().resolveCurrent(true, firstId);
    confirmStore.getState().dismissCurrent(firstId);
    expect(head()?.request.title).toBe("Second");
    await expect(first).resolves.toBe(true);
    const settled = vi.fn();
    void second.then(settled);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
  });

  it("is a no-op to resolve or dismiss an empty queue", () => {
    expect(() => confirmStore.getState().resolveCurrent(true)).not.toThrow();
    expect(() => confirmStore.getState().dismissCurrent()).not.toThrow();
  });
});

describe("dismissCurrent() — Back / scrim (D-06, ADR-086)", () => {
  it("resolves a non-destructive confirm false", async () => {
    const result = confirm({ title: "Leave?", confirmLabel: "Leave" });
    confirmStore.getState().dismissCurrent();
    await expect(result).resolves.toBe(false);
    expect(confirmStore.getState().queue).toEqual([]);
  });

  it("is a no-op for a destructive confirm", () => {
    void confirm({
      title: "Delete?",
      confirmLabel: "Delete",
      destructive: true,
    });
    confirmStore.getState().dismissCurrent();
    expect(confirmStore.getState().queue).toHaveLength(1);
  });

  it("is a no-op for a confirm created with dismissable:false", () => {
    void confirm({
      title: "Export readable?",
      confirmLabel: "Export",
      dismissable: false,
    });
    confirmStore.getState().dismissCurrent();
    expect(confirmStore.getState().queue).toHaveLength(1);
  });

  it("stays a no-op when destructive and dismissable:true conflict", () => {
    void confirm({
      title: "Delete?",
      confirmLabel: "Delete",
      destructive: true,
      dismissable: true,
    });
    confirmStore.getState().dismissCurrent();
    expect(confirmStore.getState().queue).toHaveLength(1);
  });
});

describe("effectiveDismissable (D-06, ADR-086)", () => {
  it("is !destructive && (dismissable ?? true)", () => {
    expect(effectiveDismissable({})).toBe(true);
    expect(effectiveDismissable({ destructive: true })).toBe(false);
    expect(effectiveDismissable({ dismissable: false })).toBe(false);
    expect(effectiveDismissable({ dismissable: true })).toBe(true);
    expect(effectiveDismissable({ destructive: true, dismissable: true })).toBe(
      false,
    );
  });
});

describe("notice() (D-24, D-27)", () => {
  it("resolves when acknowledged", async () => {
    const result = notice({ title: "Couldn't save" });
    expect(head()?.kind).toBe("notice");
    confirmStore.getState().resolveCurrent(true);
    await expect(result).resolves.toBeUndefined();
  });

  it("is dismissable: Back acknowledges it", async () => {
    const result = notice({ title: "Couldn't save" });
    confirmStore.getState().dismissCurrent();
    await expect(result).resolves.toBeUndefined();
    expect(confirmStore.getState().queue).toEqual([]);
  });
});

describe("identical requests share one dialog (38.9-06; 38.9-05 finding)", () => {
  const merge = {
    title: "Merge contacts?",
    message: "Ann will absorb Bea.",
    confirmLabel: "Merge",
    destructive: true,
  };

  it("an identical confirm while one is pending adds no queue entry and gets the same answer", async () => {
    const first = confirm(merge);
    const second = confirm({ ...merge });
    expect(confirmStore.getState().queue).toHaveLength(1);
    expect(second).toBe(first);
    confirmStore.getState().resolveCurrent(true);
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(confirmStore.getState().queue).toEqual([]);
  });

  it("matches an identical request queued behind another one", async () => {
    const other = confirm({ title: "Other", confirmLabel: "OK" });
    const first = confirm(merge);
    const second = confirm(merge);
    expect(confirmStore.getState().queue).toHaveLength(2);
    confirmStore.getState().resolveCurrent(false);
    confirmStore.getState().resolveCurrent(false);
    await expect(other).resolves.toBe(false);
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
  });

  it("treats spelled-out defaults as identical (Cancel label, dismissable)", () => {
    void confirm({ title: "Apply?", confirmLabel: "Apply" });
    void confirm({
      title: "Apply?",
      confirmLabel: "Apply",
      cancelLabel: "Cancel",
      dismissable: true,
    });
    expect(confirmStore.getState().queue).toHaveLength(1);
  });

  it.each([
    ["title", { title: "Merge them?" }],
    ["message", { message: "Bea will absorb Ann." }],
    ["confirm label", { confirmLabel: "Combine" }],
    ["cancel label", { cancelLabel: "Keep both" }],
    ["destructive flag", { destructive: false }],
    ["warning glyph", { headingGlyph: false }],
  ])("a request differing only in its %s still queues", (_name, patch) => {
    void confirm(merge);
    void confirm({ ...merge, ...patch });
    expect(confirmStore.getState().queue).toHaveLength(2);
  });

  it("a request differing only in its dismissable flag still queues", () => {
    void confirm({ title: "Export?", confirmLabel: "Export" });
    void confirm({
      title: "Export?",
      confirmLabel: "Export",
      dismissable: false,
    });
    expect(confirmStore.getState().queue).toHaveLength(2);
  });

  it("after the dialog settles, the same request opens again", async () => {
    const first = confirm(merge);
    confirmStore.getState().resolveCurrent(false);
    await expect(first).resolves.toBe(false);
    const again = confirm(merge);
    expect(again).not.toBe(first);
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await expect(again).resolves.toBe(true);
  });

  it("an identical notice shares the pending one; a confirm with the same title does not", async () => {
    const first = notice({ title: "Couldn't load", message: "Go back." });
    const second = notice({ title: "Couldn't load", message: "Go back." });
    expect(second).toBe(first);
    void confirm({
      title: "Couldn't load",
      message: "Go back.",
      confirmLabel: "OK",
    });
    expect(confirmStore.getState().queue).toHaveLength(2);
    confirmStore.getState().dismissCurrent();
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
  });

  it("never piggybacks on the shared Discard changes? prompt", () => {
    confirmStore.getState().enqueue({
      kind: "confirm",
      discard: true,
      request: { title: "Discard changes?", confirmLabel: "Discard changes" },
      resolve: () => {},
    });
    void confirm({
      title: "Discard changes?",
      confirmLabel: "Discard changes",
    });
    expect(confirmStore.getState().queue).toHaveLength(2);
  });
});
