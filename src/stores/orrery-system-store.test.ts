import { describe, expect, it, vi } from "vitest";

// The store's reader types traverse database.ts; node tests use injected readers.
vi.mock("expo-sqlite", () => ({}));

import { systemDisplayName } from "@/components/orrery/orrery-controls-logic";
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
  it("marks an explicit same-System selection for durable preference revisioning, but not a reload", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const store = createOrrerySystemStore({
      load: async (system) => scene(system),
      persist,
    });
    await store.getState().select(all, undefined, true);
    await store.getState().reload();
    expect(persist.mock.calls).toEqual([[all, true], [all]]);
  });
  it("coalesces recovery taps while leaving newer actual reloads generation-owned", async () => {
    const read = deferred<OrrerySceneSnapshot>();
    const load = vi
      .fn()
      .mockResolvedValueOnce(scene())
      .mockReturnValue(read.promise);
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
    await switchRead;
    expect(store.getState()).toMatchObject({ status: "error", snapshot: null });
  });
  it("keeps the prior world mounted while a different System loads, then clears it if the switch fails", async () => {
    const switchRead = deferred<OrrerySceneSnapshot>();
    const store = createOrrerySystemStore({
      load: vi
        .fn()
        .mockResolvedValueOnce(scene(all))
        .mockReturnValueOnce(switchRead.promise),
      persist: async () => true,
    });
    await store.getState().select(all);

    const pending = store.getState().select(fav);
    expect(store.getState()).toMatchObject({
      status: "loading",
      snapshot: { system: all },
    });

    switchRead.reject(new Error("SQLite"));
    await pending;
    expect(store.getState()).toMatchObject({ status: "error", snapshot: null });
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
  it("falls back an already-open removed category to All Contacts", async () => {
    const category = parseSystemRef("category:gone")!;
    const persist = vi.fn().mockResolvedValue(true);
    const store = createOrrerySystemStore({
      load: async (system) => {
        if (system.kind === "category")
          throw new MissingOrreryCategoryError({
            status: "missing-category",
            system: category,
            categories: [],
          } as unknown as OrrerySystemSnapshot);
        return scene(system);
      },
      persist,
    });
    await store.getState().select(category, "Family");
    expect(store.getState()).toMatchObject({
      status: "ready",
      requested: { name: "All Contacts", id: "builtin:all-contacts" },
    });
    expect(persist).toHaveBeenCalledWith(all);
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

describe("38.7-04 D-52: custom System name after a cold restore", () => {
  const work = parseSystemRef("custom:work-uid")!;
  const category = parseSystemRef("category:friends")!;
  const withCategories = (system: typeof all) =>
    ({
      ...scene(system),
      systemSnapshot: { categories: [{ uid: "friends", name: "Friends" }] },
    }) as unknown as OrrerySceneSnapshot;

  it("resolves the real name after the load (cold restore passes no name)", async () => {
    const resolveName = vi.fn().mockResolvedValue("Work");
    const store = createOrrerySystemStore({
      load: async (system) => scene(system),
      persist: async () => true,
      resolveName,
    });
    await store.getState().select(work, undefined, false);
    expect(store.getState().status).toBe("ready");
    expect(store.getState().requested.name).toBe("Work");
    expect(resolveName).toHaveBeenCalledWith(work);
  });

  it("38.7-15: a cold restore of a custom System never shows another System's name", async () => {
    const load = deferred<OrrerySceneSnapshot>();
    const name = deferred<string | undefined>();
    const store = createOrrerySystemStore({
      load: () => load.promise,
      persist: async () => true,
      resolveName: () => name.promise,
    });
    const shown: (string | null)[] = [];
    const catalog: { id: string; name: string }[] = [];
    const record = () =>
      shown.push(systemDisplayName(store.getState(), catalog));
    const unsubscribe = store.subscribe(record);
    // The store's initial request is a placeholder, not "All Contacts".
    record();
    expect(store.getState().nameKnown).toBe(false);
    const selecting = store.getState().select(work, undefined, false);
    expect(store.getState().status).toBe("loading");
    expect(store.getState().requested.name).toBe("");
    load.resolve(scene(work));
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getState().status).toBe("ready");
    expect(systemDisplayName(store.getState())).toBeNull();
    name.resolve("Work");
    await selecting;
    unsubscribe();
    expect(store.getState().nameKnown).toBe(true);
    // Every name ever shown is the requested System's own, or the neutral
    // placeholder (null) — never "All Contacts", never "Unavailable System".
    expect(shown.length).toBeGreaterThan(2);
    expect(new Set(shown)).toEqual(new Set([null, "Work"]));
    expect(shown.at(-1)).toBe("Work");
  });

  it("38.7-15: the screen's Systems catalog names a pending System before its own read settles", async () => {
    const load = deferred<OrrerySceneSnapshot>();
    const store = createOrrerySystemStore({
      load: () => load.promise,
      persist: async () => true,
      resolveName: () => new Promise<string | undefined>(() => {}),
    });
    const catalog = [
      { id: "builtin:all-contacts", name: "All Contacts" },
      { id: systemRefId(work), name: "Work" },
    ];
    // Initial: the placeholder request is never looked up.
    expect(systemDisplayName(store.getState(), catalog)).toBeNull();
    void store.getState().select(work, undefined, false);
    expect(systemDisplayName(store.getState(), catalog)).toBe("Work");
    expect(systemDisplayName(store.getState(), [])).toBeNull();
  });

  it("38.7-15: a reload while the name is still a placeholder never adopts the previous System's name", async () => {
    const load = deferred<OrrerySceneSnapshot>();
    const store = createOrrerySystemStore({
      load: () => load.promise,
      persist: async () => true,
    });
    void store.getState().select(work, undefined, false);
    const reloading = store.getState().reload();
    load.resolve(scene(work));
    await reloading;
    // No resolver: the unknown name settles on the fallback, not "All Contacts".
    expect(store.getState().requested.name).toBe("Unavailable System");
  });

  it("never applies a stale name after a newer select", async () => {
    const name = deferred<string | undefined>();
    const store = createOrrerySystemStore({
      load: async (system) => scene(system),
      persist: async () => true,
      resolveName: () => name.promise,
    });
    const first = store.getState().select(work, undefined, false);
    await Promise.resolve();
    await Promise.resolve();
    await store.getState().select(fav, undefined, true);
    name.resolve("Work");
    await first;
    expect(store.getState().requested.id).toBe(systemRefId(fav));
    expect(store.getState().requested.name).toBe("Favorites");
  });

  it("falls back exactly as before when the name cannot be resolved", async () => {
    for (const resolveName of [
      vi.fn().mockRejectedValue(new Error("catalog read")),
      vi.fn().mockResolvedValue(undefined),
    ]) {
      const store = createOrrerySystemStore({
        load: async (system) => scene(system),
        persist: async () => true,
        resolveName,
      });
      await store.getState().select(work, undefined, false);
      expect(store.getState().status).toBe("ready");
      expect(store.getState().requested.name).toBe("Unavailable System");
    }
  });

  it("leaves category and built-in naming unchanged (no resolveName call)", async () => {
    const resolveName = vi.fn().mockResolvedValue("Wrong");
    const store = createOrrerySystemStore({
      load: async (system) => withCategories(system),
      persist: async () => true,
      resolveName,
    });
    await store.getState().select(category, undefined, false);
    expect(store.getState().requested.name).toBe("Friends");
    await store.getState().select(fav, undefined, false);
    expect(store.getState().requested.name).toBe("Favorites");
    expect(resolveName).not.toHaveBeenCalled();
  });
});
