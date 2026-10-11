import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// DialogHost reads the real confirm queue; the Zustand hook is swapped for a
// plain selector call so the component runs as a function (render-free).
vi.mock("@/stores/confirm-store", async (original) => {
  const actual = await original<typeof import("@/stores/confirm-store")>();
  const hook = (selector: (s: unknown) => unknown) =>
    selector(actual.confirmStore.getState());
  return {
    ...actual,
    confirmStore: Object.assign(hook, actual.confirmStore),
  };
});
vi.mock("./ConfirmDialog", () => ({ ConfirmDialog: "ConfirmDialog" }));

const { confirm, confirmStore, notice } = await import(
  "@/stores/confirm-store"
);
const { DialogHost } = await import("./DialogHost");

type DialogProps = Record<string, unknown> & {
  onConfirm: () => void;
  onCancel?: () => void;
  onRequestClose: () => void;
};
const render = () => DialogHost() as ReactElement<DialogProps> | null;

beforeEach(() => {
  confirmStore.setState({ queue: [] });
});

describe("DialogHost (D-24)", () => {
  it("renders nothing with an empty queue", () => {
    expect(render()).toBeNull();
  });

  it("renders the head confirm keyed by its id and wires its buttons", async () => {
    const result = confirm({
      title: "Delete photo?",
      confirmLabel: "Delete photo",
      destructive: true,
    });
    const head = confirmStore.getState().queue[0];
    const element = render();
    expect(element?.key).toBe(String(head.id));
    expect(element?.props).toMatchObject({
      visible: true,
      title: "Delete photo?",
      confirmLabel: "Delete photo",
      destructive: true,
    });
    // Back on a destructive confirm does nothing.
    element?.props.onRequestClose();
    expect(confirmStore.getState().queue).toHaveLength(1);
    element?.props.onCancel?.();
    await expect(result).resolves.toBe(false);
  });

  it("a stale press on a closed dialog cannot resolve the request behind it", async () => {
    const first = confirm({ title: "First", confirmLabel: "OK" });
    void confirm({ title: "Second", confirmLabel: "OK" });
    const firstDialog = render();
    firstDialog?.props.onConfirm();
    firstDialog?.props.onConfirm();
    await expect(first).resolves.toBe(true);
    expect(confirmStore.getState().queue).toHaveLength(1);
    expect(render()?.props.title).toBe("Second");
  });

  it("renders a notice as the one-button variant with the OK default", async () => {
    const result = notice({ title: "Couldn't save" });
    const element = render();
    expect(element?.props).toMatchObject({
      variant: "notice",
      title: "Couldn't save",
      confirmLabel: "OK",
    });
    element?.props.onRequestClose();
    await expect(result).resolves.toBeUndefined();
  });
});
