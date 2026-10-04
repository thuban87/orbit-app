import { create } from "zustand";
import {
  MissingOrreryCategoryError,
  MissingOrreryCustomSystemError,
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
  /**
   * 38.7-15: whether `requested.name` is the requested System's own name.
   * False while it is unknown (the store's initial placeholder request, a
   * cold restore of a custom System before its name read settles, a
   * category before the catalog loads); `requested.name` is then "" — never
   * another System's name. Display through `systemDisplayName`.
   */
  nameKnown: boolean;
  snapshot: OrrerySceneSnapshot | null;
  categories: OrreryCategory[];
  catalogLoaded: boolean;
  persistence: "saved" | "saving" | "error";
  select: (
    system: OrrerySystemRef,
    name?: string,
    userInitiated?: boolean,
  ) => Promise<void>;
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
  persist: (
    system: OrrerySystemRef,
    userInitiated?: boolean,
  ) => Promise<boolean>;
  /**
   * 38.7-04 (D-52): a custom System's display name, read after its scene
   * loads. A cold restore selects with no name, so without this the selector
   * showed "Unavailable System". Undefined/throw → the existing fallback.
   */
  resolveName?: (system: OrrerySystemRef) => Promise<string | undefined>;
}

/** The selector's name for a System whose name could not be resolved. */
const UNAVAILABLE_SYSTEM_NAME = "Unavailable System";

/** Request generations, not selected names or revisions, own async publication. */
export function createOrrerySystemStore(io: OrrerySystemAdapters) {
  let active = false;
  let retrying: Promise<void> | null = null;
  let savingGeneration: number | null = null;
  return create<OrrerySystemState>()((set, get) => {
    const save = async (
      system: OrrerySystemRef,
      generation: number,
      userInitiated: boolean,
    ) => {
      if (!active || generation !== get().generation) return;
      if (savingGeneration === generation) return;
      savingGeneration = generation;
      set({ persistence: "saving" });
      let saved = false;
      try {
        saved = userInitiated
          ? await io.persist(system, true)
          : await io.persist(system);
      } catch {
        /* Successful scene remains usable. */
      }
      if (active && generation === get().generation)
        set({ persistence: saved ? "saved" : "error" });
      if (savingGeneration === generation) savingGeneration = null;
    };
    const resolveCustomName = async (
      system: OrrerySystemRef,
      generation: number,
      pending: boolean,
    ) => {
      let name: string | undefined;
      try {
        name = await io.resolveName?.(system);
      } catch {
        /* The scene is ready; keep the fallback name. */
      }
      // A newer select owns `requested`; never apply a stale name.
      if (!active || generation !== get().generation) return;
      // 38.7-15: a name still pending falls back only now, once unresolvable.
      const resolved = name ?? (pending ? UNAVAILABLE_SYSTEM_NAME : undefined);
      if (!resolved) return;
      const current = get().requested;
      if (
        current.id === systemRefId(system) &&
        (current.name !== resolved || !get().nameKnown)
      )
        set({ requested: { ...current, name: resolved }, nameKnown: true });
    };
    const select = async (
      system: OrrerySystemRef,
      name?: string,
      userInitiated = false,
    ) => {
      const id = systemRefId(system);
      const before = get();
      const generation = before.generation + 1;
      const same =
        before.snapshot && systemRefId(before.snapshot.system) === id;
      const categoryName =
        system.kind === "category"
          ? before.categories.find((row) => row.uid === system.uid)?.name
          : undefined;
      const knownName =
        system.kind === "builtin"
          ? BUILTIN_SYSTEM_LABELS[system.id]
          : (name ??
            categoryName ??
            (before.requested.id === id && before.nameKnown
              ? before.requested.name
              : undefined));
      // 38.7-15: an unknown name (a cold restore, a category before the
      // catalog loads) is "" and `nameKnown` false until the load or the name
      // read settles: never another System's name, never a transient
      // "Unavailable System".
      const requested = {
        ref: system,
        id,
        name: knownName ?? "",
      };
      active = true;
      set({
        generation,
        requested,
        nameKnown: knownName !== undefined,
        status: "loading",
        // Keep the outgoing generation mounted until the destination is ready.
        // OrreryWorld owns the sampled world transition; clearing here destroys
        // that owner before it can animate the new generation.
        snapshot: before.snapshot,
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
        const resolving = system.kind === "custom" && !!io.resolveName;
        const loadedName = currentName ?? knownName;
        set({
          status: "ready",
          snapshot: { ...result, generation },
          categories,
          catalogLoaded: true,
          requested: {
            ...requested,
            name:
              loadedName ??
              (resolving ? requested.name : UNAVAILABLE_SYSTEM_NAME),
          },
          nameKnown: loadedName !== undefined || !resolving,
        });
        const naming = resolving
          ? resolveCustomName(system, generation, knownName === undefined)
          : null;
        await Promise.all([save(system, generation, userInitiated), naming]);
      } catch (error) {
        if (!active || generation !== get().generation) return;
        if (error instanceof MissingOrreryCategoryError) {
          // Category deletion owns durable cleanup; this closes any already-open
          // stale session through the same safe token and persistence channel.
          await select(ALL_CONTACTS_SYSTEM);
        } else if (error instanceof MissingOrreryCustomSystemError) {
          // This re-enters select with a fresh generation; the generation guard
          // abandons the stale custom request, so it cannot recurse into a loop.
          void select(ALL_CONTACTS_SYSTEM);
        } else
          set({
            status: same && get().snapshot ? "stale" : "error",
            // A failed real switch must not leave the wrong System visible.
            snapshot: same ? get().snapshot : null,
            // 38.7-15: an unknown name stays unknown when the load fails.
            ...(knownName === undefined
              ? {
                  requested: { ...requested, name: UNAVAILABLE_SYSTEM_NAME },
                  nameKnown: true,
                }
              : {}),
          });
      }
    };
    return {
      status: "initial",
      generation: 0,
      // 38.7-15: a placeholder request (the real one is read from the
      // preferences): no name until a select names it.
      requested: {
        ref: ALL_CONTACTS_SYSTEM,
        id: "builtin:all-contacts",
        name: "",
      },
      nameKnown: false,
      snapshot: null,
      categories: [],
      catalogLoaded: false,
      persistence: "saved",
      select,
      reload: () =>
        select(
          get().requested.ref,
          get().nameKnown ? get().requested.name : undefined,
        ),
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
        if (snapshot) await save(snapshot.system, get().generation, false);
      },
    };
  });
}
