import { describe, expect, it, vi } from "vitest";

// The store module transitively imports the DAO/database layer (expo-sqlite →
// react-native). Stub expo-sqlite so this node-env test loads the pure store
// logic without the native chain — mirrors orrery-preferences-store.test.ts.
vi.mock("expo-sqlite", () => ({}));

import type { SqlExecutor } from "@/db/types";
import {
  createOrreryPreferencesStore,
  DEFAULT_ORRERY_PREFERENCES,
  type OrreryPreferences,
} from "./orrery-preferences-store";

/**
 * Cross-surface shared-source test (§H). The Settings Orrery Display controls
 * and the Orrery itself must read/write ONE preference source — the
 * `useOrreryPreferencesStore` Zustand store whose single serialized `save()`
 * writes SQLite and publishes `committed`. A DAO round-trip test cannot observe
 * cross-surface AGREEMENT (review cycle-1 HIGH + Codex MEDIUM); this store-level
 * test proves a Settings-style `save` publishes `committed` that ANY consumer
 * reading `committed` observes, through exactly ONE adapter write, and that a
 * Settings write never touches `lastSystem` (§C/§H — session state, not a
 * Setting).
 */

const exec = {} as SqlExecutor;

function mockIo(initial?: Partial<OrreryPreferences>) {
  const stored: Partial<OrreryPreferences> = {
    ...DEFAULT_ORRERY_PREFERENCES,
    ...initial,
  };
  const write = vi.fn(
    async (_exec: SqlExecutor, intent: Partial<OrreryPreferences>) => {
      Object.assign(stored, intent);
    },
  );
  const read = vi.fn(async () => ({ ...stored }));
  return { io: { read, write }, write, read, stored };
}

describe("orrery preferences — cross-surface shared source (§H)", () => {
  it("publishes a Settings-style density save to every committed reader via one serialized write", async () => {
    const { io, write } = mockIo({ density: "balanced" });
    const store = createOrreryPreferencesStore(io);

    // Mirror the Orrery's read (OrreryScreen.tsx:218 —
    // `useOrreryPreferencesStore((s) => s.committed)`): a foreign consumer
    // reading the SAME store must observe a Settings write.
    const observed: OrreryPreferences[] = [];
    const unsubscribe = store.subscribe((s) => observed.push(s.committed));

    await store.getState().hydrate(exec);
    // A Settings Orrery Display write — density only, no lastSystem.
    await store.getState().save(exec, { density: "compact" });

    expect(store.getState().committed.density).toBe("compact");
    // The foreign (Orrery-side) reader observed the same committed value.
    expect(observed.at(-1)?.density).toBe("compact");
    // Single serialized writer: exactly one adapter write for one change.
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[1]).toEqual({ density: "compact" });

    unsubscribe();
  });

  it("publishes a Settings-style satellites save through one write", async () => {
    const { io, write } = mockIo({ satellitesEnabled: 0 });
    const store = createOrreryPreferencesStore(io);

    await store.getState().hydrate(exec);
    await store.getState().save(exec, { satellitesEnabled: 1 });

    expect(store.getState().committed.satellitesEnabled).toBe(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[1]).toEqual({ satellitesEnabled: 1 });
  });

  it("never writes lastSystem for any Settings-style save (§C/§H)", async () => {
    const { io, write } = mockIo();
    const store = createOrreryPreferencesStore(io);

    await store.getState().hydrate(exec);
    await store.getState().save(exec, { density: "spacious" });
    await store.getState().save(exec, { satellitesEnabled: 1 });

    for (const call of write.mock.calls) {
      expect(call[1]).not.toHaveProperty("lastSystem");
    }
    // The store's lastSystem is untouched by Settings writes.
    expect(store.getState().committed.lastSystem).toBe(
      DEFAULT_ORRERY_PREFERENCES.lastSystem,
    );
  });

  it("shares one source both ways — an Orrery-origin lastSystem save is observed by a committed reader while Settings prefs persist", async () => {
    const { io } = mockIo({ density: "balanced", satellitesEnabled: 0 });
    const store = createOrreryPreferencesStore(io);

    await store.getState().hydrate(exec);
    // Settings writes a Display pref…
    await store.getState().save(exec, { density: "compact" });
    // …and the Orrery writes its session lastSystem to the SAME store.
    await store.getState().save(exec, { lastSystem: "builtin:favorites" }, {});

    // Both land in the single committed source, observable cross-surface.
    expect(store.getState().committed.density).toBe("compact");
    expect(store.getState().committed.lastSystem).toBe("builtin:favorites");
  });
});
