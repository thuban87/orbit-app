import { create } from "zustand";
import {
  MissingOrreryCategoryError,
  type OrreryCategory,
} from "@/db/orrery-system-read";
import {
  ALL_CONTACTS_SYSTEM,
  BUILTIN_SYSTEM_LABELS,
  type OrrerySystemRef,
  type SystemDescriptor,
  systemRefId,
} from "@/logic/orrery-system-logic";
import type { OrrerySceneSnapshot } from "@/services/orrery-scene";

export interface OrrerySystemState {
  status:
    | "initial"
    | "loading"
    | "ready"
    | "stale"
    | "error"
    | "missing-category";
  generation: number;
  requested: SystemDescriptor;
  snapshot: OrrerySceneSnapshot | null;
  categories: OrreryCategory[];
  catalogLoaded: boolean;
  persistence: "saved" | "saving" | "error";
  select: (system: OrrerySystemRef, name?: string) => Promise<void>;
  reload: () => Promise<void>;
  retryReload: () => Promise<void>;
  cancel: () => void;
  current: () => OrrerySceneSnapshot | null;
  retryPersistence: () => Promise<void>;
}
export interface OrrerySystemAdapters {
  load: (
    system: OrrerySystemRef,
    generation: number,
  ) => Promise<OrrerySceneSnapshot>;
  /** Uses the serialized preference writer; false retains retryable unsaved intent. */
  persist: (system: OrrerySystemRef) => Promise<boolean>;
}

/** Request generations, not selected names or revisions, own async publication. */
export function createOrrerySystemStore(io: OrrerySystemAdapters) {
  let active = false;
  let retrying: Promise<void> | null = null;
  let savingGeneration: number | null = null;
  return create<OrrerySystemState>()((set, get) => {
    const save = async (system: OrrerySystemRef, generation: number) => {
      if (!active || generation !== get().generation) return;
      if (savingGeneration === generation) return;
      savingGeneration = generation;
      set({ persistence: "saving" });
      let saved = false;
      try {
        saved = await io.persist(system);
      } catch {
        /* Successful scene remains usable. */
      }
      if (active && generation === get().generation)
        set({ persistence: saved ? "saved" : "error" });
      if (savingGeneration === generation) savingGeneration = null;
    };
    const select = async (system: OrrerySystemRef, name?: string) => {
      const id = systemRefId(system);
      const before = get();
      const generation = before.generation + 1;
      const same =
        before.snapshot && systemRefId(before.snapshot.system) === id;
      const categoryName =
        system.kind === "category"
          ? before.categories.find((row) => row.uid === system.uid)?.name
          : undefined;
      const requested = {
        ref: system,
        id,
        name:
          system.kind === "builtin"
            ? BUILTIN_SYSTEM_LABELS[system.id]
            : (name ??
              categoryName ??
              (before.requested.id === id
                ? before.requested.name
                : "Unavailable System")),
      };
      active = true;
      set({
        generation,
        requested,
        status: "loading",
        snapshot: same ? before.snapshot : null,
      });
      try {
        const result = await io.load(system, generation);
        if (!active || generation !== get().generation) return;
        if (systemRefId(result.system) !== id)
          throw new Error("Mismatched System snapshot");
        const categories = result.systemSnapshot.categories;
        const currentName =
          system.kind === "category"
            ? categories.find((row) => row.uid === system.uid)?.name
            : undefined;
        set({
          status: "ready",
          snapshot: { ...result, generation },
          categories,
          catalogLoaded: true,
          requested: { ...requested, name: currentName ?? requested.name },
        });
        await save(system, generation);
      } catch (error) {
        if (!active || generation !== get().generation) return;
        if (error instanceof MissingOrreryCategoryError) {
          set({
            status: "missing-category",
            snapshot: null,
            categories: error.snapshot.categories,
            catalogLoaded: true,
          });
        } else set({ status: get().snapshot ? "stale" : "error" });
      }
    };
    return {
      status: "initial",
      generation: 0,
      requested: {
        ref: ALL_CONTACTS_SYSTEM,
        id: "builtin:all-contacts",
        name: "All Contacts",
      },
      snapshot: null,
      categories: [],
      catalogLoaded: false,
      persistence: "saved",
      select,
      reload: () => select(get().requested.ref, get().requested.name),
      retryReload: () => {
        if (retrying) return retrying;
        retrying = get()
          .reload()
          .finally(() => {
            retrying = null;
          });
        return retrying;
      },
      cancel: () => {
        active = false;
        set({ generation: get().generation + 1 });
      },
      current: () =>
        active &&
        get().status === "ready" &&
        get().snapshot?.generation === get().generation
          ? get().snapshot
          : null,
      retryPersistence: async () => {
        const snapshot = get().current();
        if (snapshot) await save(snapshot.system, get().generation);
      },
    };
  });
}
