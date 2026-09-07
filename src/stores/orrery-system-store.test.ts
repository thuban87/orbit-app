import { describe, expect, it, vi } from "vitest";
import {
  MissingOrreryCategoryError,
  type OrrerySystemSnapshot,
} from "@/db/orrery-system-read";
import { parseSystemRef, systemRefId } from "@/logic/orrery-system-logic";
import {
  createOrreryIntentDispatcher,
  type OrrerySceneSnapshot,
} from "@/services/orrery-scene";
import { createOrrerySystemStore } from "@/stores/orrery-system-store";

const all = parseSystemRef("builtin:all-contacts")!;
const fav = parseSystemRef("builtin:favorites")!;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const scene = (system = all): OrrerySceneSnapshot =>
  ({
    generation: 0,
    system,
    contacts: [],
    world: [],
    systemSnapshot: { categories: [] },
  }) as unknown as OrrerySceneSnapshot;
describe("System publication ownership", () => {
  it("coalesces recovery taps while leaving newer actual reloads generation-owned", async () => {
    const read = deferred<OrrerySceneSnapshot>();
    const load = vi.fn().mockResolvedValueOnce(scene()).mockReturnValue(read.promise);
    const store = createOrrerySystemStore({ load, persist: async () => true });
    await store.getState().select(all);
    const first = store.getState().retryReload();
    const second = store.getState().retryReload();
    expect(load).toHaveBeenCalledTimes(2);
    read.reject(new Error("read"));
    await Promise.all([first, second]);
    expect(store.getState().status).toBe("stale");
    load.mockResolvedValue(scene());
    await store.getState().retryReload();
    expect(store.getState().status).toBe("ready");
  });
  it("A→B→A completion order publishes/persists only the last generation", async () => {
    const reads = [
      deferred<OrrerySceneSnapshot>(),
      deferred<OrrerySceneSnapshot>(),
      deferred<OrrerySceneSnapshot>(),
    ];
    let index = 0;
    const persist = vi.fn().mockResolvedValue(true);
    const store = createOrrerySystemStore({
      load: () => reads[index++].promise,
      persist,
    });
    const a = store.getState().select(all);
    const b = store.getState().select(fav);
    const a2 = store.getState().select(all);
    reads[2].resolve(scene());
    await a2;
    reads[1].resolve(scene(fav));
    await b;
    reads[0].resolve(scene());
    await a;
    expect(store.getState().current()?.generation).toBe(3);
    expect(persist).toHaveBeenCalledExactlyOnceWith(all);
  });
  it("keeps failed same-System refresh stale/inert, but clears prior bodies during a failed switch", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(scene())
      .mockRejectedValue(new Error("SQLite"));
    const store = createOrrerySystemStore({ load, persist: async () => true });
    await store.getState().select(all);
    await store.getState().reload();
    expect(store.getState().status).toBe("stale");
    expect(store.getState().snapshot?.system).toEqual(all);
    expect(store.getState().current()).toBeNull();
    const switchRead = store.getState().select(fav);
    expect(store.getState().requested.id).toBe("builtin:favorites");
    expect(store.getState().snapshot).toBeNull();
    await switchRead;
    expect(store.getState().status).toBe("error");
  });
  it("disposal invalidates pending publication/persistence and rejected intent validation", async () => {
    const read = deferred<OrrerySceneSnapshot>();
    const persist = vi.fn();
    const store = createOrrerySystemStore({
      load: () => read.promise,
      persist,
    });
    const pending = store.getState().select(all);
    store.getState().cancel();
    read.resolve(scene());
    await pending;
    expect(store.getState().current()).toBeNull();
    expect(persist).not.toHaveBeenCalled();
  });
  it("retains a named removed category and fresh catalog instead of silently switching", async () => {
    const category = parseSystemRef("category:gone")!;
    const store = createOrrerySystemStore({
      load: async () => {
        throw new MissingOrreryCategoryError({
          status: "missing-category",
          system: category,
          categories: [],
        } as unknown as OrrerySystemSnapshot);
      },
      persist: vi.fn(),
    });
    await store.getState().select(category, "Family");
    expect(store.getState()).toMatchObject({
      status: "missing-category",
      requested: { name: "Family", id: "category:gone" },
      snapshot: null,
      catalogLoaded: true,
    });
  });
  it("a failed persistence keeps successful membership usable and retry saves that active System", async () => {
    const persist = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const store = createOrrerySystemStore({
      load: async () => scene(fav),
      persist,
    });
    await store.getState().select(fav);
    expect(store.getState().current()?.system).toEqual(fav);
    expect(store.getState().persistence).toBe("error");
    await store.getState().retryPersistence();
    expect(store.getState().persistence).toBe("saved");
  });
  it("late save settlement cannot relabel the newer successful selection", async () => {
    const oldSave = deferred<boolean>();
    const store = createOrrerySystemStore({
      load: async (system) => scene(system),
      persist: (system) =>
        systemRefId(system) === "builtin:all-contacts"
          ? oldSave.promise
          : Promise.resolve(true),
    });
    const a = store.getState().select(all);
    await Promise.resolve();
    await store.getState().select(fav);
    oldSave.resolve(false);
    await a;
    expect(store.getState()).toMatchObject({
      status: "ready",
      requested: { id: "builtin:favorites" },
      persistence: "saved",
    });
  });
  it("revalidates current System and UID before acting even when a numeric ID is reused", async () => {
    const current = {
      ...scene(all),
      generation: 4,
      world: [{ id: 1 }],
      systemSnapshot: {
        contactIdentities: [{ id: 1, uid: "old" }],
        members: [{ id: 1, uid: "old" }],
      },
    } as unknown as OrrerySceneSnapshot;
    const fresh = {
      ...current,
      systemSnapshot: {
        contactIdentities: [{ id: 1, uid: "new" }],
        members: [{ id: 1, uid: "new" }],
      },
    } as unknown as OrrerySceneSnapshot;
    const openProfile = vi.fn();
    const dispatch = createOrreryIntentDispatcher({
      current: () => current,
      validate: async () => fresh,
      openProfile,
      focus: vi.fn(),
      clear: vi.fn(),
      group: vi.fn(),
    });
    await dispatch({ kind: "profile", ids: [1], generation: 4 });
    expect(openProfile).not.toHaveBeenCalled();
  });
});
