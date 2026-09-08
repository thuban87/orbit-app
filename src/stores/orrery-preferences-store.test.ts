import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import type { SqlExecutor } from "@/db/types";
import {
  createOrreryPreferencesStore,
  type OrreryPreferences,
} from "@/stores/orrery-preferences-store";

const exec = {} as SqlExecutor;
const defaults: OrreryPreferences = {
  density: "balanced",
  satellitesEnabled: 0,
  lastSystem: "builtin:all-contacts",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const read = vi.fn(
    async (): Promise<Partial<OrreryPreferences>> => ({ ...defaults }),
  );
  const write = vi.fn(async () => {});
  const store = createOrreryPreferencesStore({ read, write });
  return { store, read, write };
}
describe("Orrery preferences commit-before-publish", () => {
  it("a successful System return to the saved choice supersedes a failed destination intent", async () => {
    const { store, write } = fixture();
    await store.getState().hydrate(exec);
    write.mockRejectedValueOnce(new Error("disk"));
    await store.getState().save(exec, { lastSystem: "builtin:favorites" });
    await store.getState().save(exec, { lastSystem: "builtin:all-contacts" });
    expect(store.getState()).toMatchObject({
      committed: defaults,
      pendingIntent: null,
      saveError: false,
    });
    await store.getState().retry(exec);
    expect(store.getState().committed.lastSystem).toBe("builtin:all-contacts");
  });
  it("a hydration started during a write cannot publish its precommit snapshot", async () => {
    const { store, read, write } = fixture();
    await store.getState().hydrate(exec);
    const writing = deferred<void>();
    const reading = deferred<Partial<OrreryPreferences>>();
    write.mockImplementationOnce(() => writing.promise);
    read.mockImplementationOnce(() => reading.promise);
    const save = store.getState().save(exec, { density: "compact" });
    const hydrate = store.getState().hydrate(exec);
    writing.resolve();
    await save;
    reading.resolve(defaults);
    await hydrate;
    expect(store.getState().committed.density).toBe("compact");
  });
  it("defaults omitted values without writing and exposes initial hydration busy", async () => {
    const { store, read, write } = fixture();
    read.mockResolvedValueOnce({});
    const loading = store.getState().hydrate(exec);
    expect(store.getState().hydration).toBe("loading");
    await loading;
    expect(store.getState()).toMatchObject({
      committed: defaults,
      hydration: "ready",
      hydrated: true,
    });
    expect(write).not.toHaveBeenCalled();
  });
  it("read failure remains retryable and never overwrites unread durable values", async () => {
    const { store, read, write } = fixture();
    read.mockRejectedValueOnce(new Error("read"));
    await store.getState().hydrate(exec);
    await store.getState().save(exec, { density: "compact" });
    expect(store.getState()).toMatchObject({
      hydration: "error",
      hydrated: false,
    });
    expect(write).not.toHaveBeenCalled();
    read.mockResolvedValueOnce({ density: "spacious", satellitesEnabled: 1 });
    await store.getState().retry(exec);
    expect(store.getState().committed).toMatchObject({
      density: "spacious",
      satellitesEnabled: 1,
    });
  });
  it("unchanged selections and duplicate pending choices make no extra write", async () => {
    const { store, write } = fixture();
    await store.getState().hydrate(exec);
    await store.getState().save(exec, { density: "balanced" });
    expect(write).not.toHaveBeenCalled();
    const gate = deferred<void>();
    write.mockImplementationOnce(() => gate.promise);
    const saving = store.getState().save(exec, { density: "compact" });
    void store.getState().save(exec, { density: "compact" });
    expect(store.getState()).toMatchObject({
      saving: true,
      committed: defaults,
    });
    gate.resolve();
    await saving;
    expect(write).toHaveBeenCalledTimes(1);
    expect(store.getState().committed.density).toBe("compact");
  });
  it("stamps an origin only when a last-System value is actually committed", async () => {
    const { store, write } = fixture();
    await store.getState().hydrate(exec);
    const localOrigin = Symbol("local");
    const initialOrigin = store.getState().committedOrigin;
    await store
      .getState()
      .save(exec, { lastSystem: "builtin:favorites" }, localOrigin);
    expect(store.getState().committedOrigin).toBe(localOrigin);

    await store
      .getState()
      .save(exec, { lastSystem: "builtin:favorites" }, localOrigin);
    expect(store.getState().committedOrigin).toBe(localOrigin);

    write.mockRejectedValueOnce(new Error("disk"));
    await store.getState().save(exec, { lastSystem: "builtin:chargers" });
    expect(store.getState().committedOrigin).toBe(localOrigin);
    expect(initialOrigin).toBeNull();
  });
  it("serializes conflicting updates including reversal to the previously saved value", async () => {
    const { store, write } = fixture();
    await store.getState().hydrate(exec);
    const gate = deferred<void>();
    write.mockImplementationOnce(() => gate.promise);
    const first = store.getState().save(exec, { density: "compact" });
    const second = store
      .getState()
      .save(exec, { density: "balanced", satellitesEnabled: 1 });
    expect(write).toHaveBeenCalledTimes(1);
    gate.resolve();
    await Promise.all([first, second]);
    expect(write).toHaveBeenCalledTimes(2);
    expect(store.getState().committed).toEqual({
      ...defaults,
      satellitesEnabled: 1,
    });
  });
  it("failed writes retain saved choice and retryable intent", async () => {
    const { store, write } = fixture();
    await store.getState().hydrate(exec);
    write.mockRejectedValueOnce(new Error("disk"));
    await store.getState().save(exec, { density: "compact" });
    await store.getState().save(exec, { density: "balanced" });
    expect(write).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({
      committed: defaults,
      saveError: true,
      pendingIntent: { density: "compact" },
      saving: false,
    });
    await store.getState().retry(exec);
    expect(store.getState()).toMatchObject({
      committed: { ...defaults, density: "compact" },
      saveError: false,
      pendingIntent: null,
    });
  });
  it("retains the last successful value if a queued conflicting write fails", async () => {
    const { store, write } = fixture();
    await store.getState().hydrate(exec);
    const gate = deferred<void>();
    write
      .mockImplementationOnce(() => gate.promise)
      .mockRejectedValueOnce(new Error("disk"));
    const saving = store.getState().save(exec, { density: "compact" });
    void store.getState().save(exec, { density: "spacious" });
    gate.resolve();
    await saving;
    expect(store.getState()).toMatchObject({
      committed: { ...defaults, density: "compact" },
      pendingIntent: { density: "spacious" },
      saveError: true,
    });
  });
  it("late hydration cannot overwrite a newer successful write", async () => {
    const { store, read } = fixture();
    await store.getState().hydrate(exec);
    const gate = deferred<Partial<OrreryPreferences>>();
    read.mockImplementationOnce(() => gate.promise);
    const reading = store.getState().hydrate(exec);
    await store.getState().save(exec, { density: "compact" });
    gate.resolve(defaults);
    await reading;
    expect(store.getState()).toMatchObject({
      committed: { ...defaults, density: "compact" },
      hydration: "ready",
    });
  });
  it("refresh failure preserves the loaded choice and does not turn it into defaults", async () => {
    const { store, read } = fixture();
    read.mockResolvedValueOnce({ density: "spacious" });
    await store.getState().hydrate(exec);
    read.mockRejectedValueOnce(new Error("read"));
    await store.getState().hydrate(exec);
    expect(store.getState()).toMatchObject({
      committed: { ...defaults, density: "spacious" },
      hydration: "error",
      hydrated: true,
    });
  });
});
