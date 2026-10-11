import { beforeEach, describe, expect, it } from "vitest";
import {
  overlayRegistryStore,
  registerOverlay,
  selectAnyOverlayOpen,
  selectTopOverlayId,
  unregisterOverlay,
} from "./overlay-registry-store";
import { shellTransientStore } from "./shell-transient-store";

beforeEach(() => {
  overlayRegistryStore.setState({ entries: [] });
  shellTransientStore.setState({ entries: [] });
});

const ids = () => overlayRegistryStore.getState().entries.map((e) => e.id);

describe("overlayRegistryStore (D-24)", () => {
  it("lists open overlays in open order; the last one is on top", () => {
    registerOverlay("a", "sheet");
    registerOverlay("b", "dialog");
    expect(overlayRegistryStore.getState().entries).toEqual([
      { id: "a", kind: "sheet" },
      { id: "b", kind: "dialog" },
    ]);
    expect(selectTopOverlayId(overlayRegistryStore.getState())).toBe("b");
    expect(selectAnyOverlayOpen(overlayRegistryStore.getState())).toBe(true);
  });

  it("keeps an overlay's position when it re-registers", () => {
    registerOverlay("a", "sheet");
    registerOverlay("b", "dialog");
    registerOverlay("a", "sheet");
    expect(ids()).toEqual(["a", "b"]);
    expect(selectTopOverlayId(overlayRegistryStore.getState())).toBe("b");
  });

  it("unregistering moves the top back down, and an empty registry has no top", () => {
    registerOverlay("a", "sheet");
    registerOverlay("b", "modal");
    unregisterOverlay("b");
    expect(selectTopOverlayId(overlayRegistryStore.getState())).toBe("a");
    unregisterOverlay("a");
    expect(selectTopOverlayId(overlayRegistryStore.getState())).toBeNull();
    expect(selectAnyOverlayOpen(overlayRegistryStore.getState())).toBe(false);
  });

  it("unregistering an unknown id changes nothing", () => {
    registerOverlay("a", "sheet");
    const before = overlayRegistryStore.getState().entries;
    unregisterOverlay("missing");
    expect(overlayRegistryStore.getState().entries).toBe(before);
  });

  it("exposes no dismiss or close callback of any kind (D-24, ADR-086)", () => {
    const state = overlayRegistryStore.getState() as unknown as Record<
      string,
      unknown
    >;
    const functionKeys = Object.keys(state).filter(
      (key) => typeof state[key] === "function",
    );
    expect(functionKeys.sort()).toEqual(["register", "unregister"]);
    expect(functionKeys.filter((key) => /dismiss|close/i.test(key))).toEqual(
      [],
    );
    registerOverlay("a", "dialog");
    for (const entry of overlayRegistryStore.getState().entries) {
      expect(Object.keys(entry).sort()).toEqual(["id", "kind"]);
    }
  });

  it("is separate from the shell dismiss stack: dismissTop() cannot reach a registered overlay", () => {
    registerOverlay("destructive-confirm", "dialog");
    expect(shellTransientStore.getState().dismissTop()).toBe(false);
    expect(ids()).toEqual(["destructive-confirm"]);
  });
});
