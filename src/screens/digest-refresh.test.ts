/**
 * Digest refresh controller + load-state reducers (38.3 RG-026, D-13, D-14;
 * react-native/AUD-RN-006, reliability-testing/AUD-REL-013).
 *
 * Proves: a focus request is accepted and reads once; shell/foreground requests
 * while Digest is hidden never read (the next focus covers them); two reads
 * resolving out of order publish only the latest, and a stale failure is
 * ignored; invalidate() retires an in-flight read. The reducers keep a loaded
 * body mounted across a failed refresh. Hand-rolled deferred promises, no
 * timers.
 */
import { describe, expect, it, vi } from "vitest";
import {
  createDigestRefreshController,
  type DigestRefreshLoadState,
  digestLoadStateOnFail,
  digestLoadStateOnPublish,
} from "@/screens/digest-refresh";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function harness(visible = true) {
  const reads: Array<ReturnType<typeof deferred<string>>> = [];
  const deps = {
    read: vi.fn(() => {
      const next = deferred<string>();
      reads.push(next);
      return next.promise;
    }),
    publish: vi.fn(),
    fail: vi.fn(),
    isVisible: vi.fn(() => visible),
    onAccepted: vi.fn(),
  };
  return {
    deps,
    reads,
    controller: createDigestRefreshController<string>(deps),
    setVisible: (value: boolean) => {
      visible = value;
    },
  };
}

describe("createDigestRefreshController", () => {
  it("accepts a focus request once, reads once and publishes the result", async () => {
    const { controller, deps, reads } = harness();
    const done = controller.request("focus");
    expect(deps.onAccepted).toHaveBeenCalledTimes(1);
    expect(deps.read).toHaveBeenCalledTimes(1);
    reads[0].resolve("A");
    await done;
    expect(deps.publish).toHaveBeenCalledWith("A");
    expect(deps.fail).not.toHaveBeenCalled();
  });

  it("reports a failed read through fail, never publish", async () => {
    const { controller, deps, reads } = harness();
    const done = controller.request("focus");
    const cause = new Error("read failed");
    reads[0].reject(cause);
    await done;
    expect(deps.publish).not.toHaveBeenCalled();
    expect(deps.fail).toHaveBeenCalledTimes(1);
    expect(deps.fail).toHaveBeenCalledWith(cause);
  });

  it("does not read or accept shell/foreground requests while hidden", async () => {
    const { controller, deps } = harness(false);
    await controller.request("shell");
    await controller.request("foreground");
    expect(deps.read).not.toHaveBeenCalled();
    expect(deps.onAccepted).not.toHaveBeenCalled();
  });

  it("reads shell and foreground requests while visible", () => {
    const { controller, deps } = harness(true);
    void controller.request("shell");
    void controller.request("foreground");
    expect(deps.read).toHaveBeenCalledTimes(2);
    expect(deps.onAccepted).toHaveBeenCalledTimes(2);
  });

  it("always accepts focus, even when the visibility ref still reads hidden", () => {
    const { controller, deps } = harness(false);
    void controller.request("focus");
    expect(deps.read).toHaveBeenCalledTimes(1);
  });

  it("publishes only the latest of two out-of-order reads", async () => {
    const { controller, deps, reads } = harness();
    const first = controller.request("focus");
    const second = controller.request("shell");
    reads[1].resolve("B");
    await second;
    reads[0].resolve("A");
    await first;
    expect(deps.publish).toHaveBeenCalledTimes(1);
    expect(deps.publish).toHaveBeenCalledWith("B");
  });

  it("ignores a stale failure that lands after a newer success", async () => {
    const { controller, deps, reads } = harness();
    const first = controller.request("focus");
    const second = controller.request("foreground");
    reads[1].resolve("B");
    await second;
    reads[0].reject(new Error("stale"));
    await first;
    expect(deps.fail).not.toHaveBeenCalled();
    expect(deps.publish).toHaveBeenCalledWith("B");
  });

  it("ignores an in-flight result after invalidate()", async () => {
    const { controller, deps, reads } = harness();
    const pending = controller.request("focus");
    controller.invalidate();
    reads[0].resolve("A");
    await pending;
    expect(deps.publish).not.toHaveBeenCalled();
    expect(deps.fail).not.toHaveBeenCalled();
  });
});

describe("Digest load-state reducers", () => {
  const loading: DigestRefreshLoadState<string> = { phase: "loading" };

  it("loading + fail → error", () => {
    expect(digestLoadStateOnFail(loading)).toEqual({ phase: "error" });
  });

  it("error + fail stays error", () => {
    expect(digestLoadStateOnFail({ phase: "error" })).toEqual({
      phase: "error",
    });
  });

  it("loaded + fail → loaded with refreshError and the SAME data", () => {
    const data = "A";
    const loaded = digestLoadStateOnPublish(loading, data);
    const failed = digestLoadStateOnFail(loaded);
    expect(failed).toEqual({ phase: "loaded", data, refreshError: true });
    if (failed.phase !== "loaded") throw new Error("expected loaded");
    expect(failed.data).toBe(data);
  });

  it("loaded+refreshError + publish → loaded with refreshError cleared", () => {
    const failed = digestLoadStateOnFail(digestLoadStateOnPublish(loading, "A"));
    expect(digestLoadStateOnPublish(failed, "B")).toEqual({
      phase: "loaded",
      data: "B",
      refreshError: false,
    });
  });

  it("error + publish → loaded", () => {
    expect(digestLoadStateOnPublish({ phase: "error" }, "A")).toEqual({
      phase: "loaded",
      data: "A",
      refreshError: false,
    });
  });
});
