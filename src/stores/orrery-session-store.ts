import { create } from "zustand";
import type { OrrerySessionSnapshot } from "@/logic/orrery-session-logic";

type RouteIdentity = { key: string; name: string };
interface OrrerySessionState {
  generation: number;
  resume: "home" | "restore" | "active";
  departure: "profile" | "background" | "tab" | "other" | null;
  saved: OrrerySessionSnapshot | null;
  capture: (
    reason: "profile" | "background",
    saved: OrrerySessionSnapshot,
    generation?: number,
  ) => void;
  routeChanged: (routes: readonly RouteIdentity[]) => void;
  leaveTab: () => void;
  resumed: () => void;
}
/** Memory-only. Route keys establish genuine pops; focus/blur alone cannot. */
export function createOrrerySessionStore() {
  let previous: readonly RouteIdentity[] = [];
  return create<OrrerySessionState>()((set, get) => ({
    generation: 0,
    resume: "home",
    departure: null,
    saved: null,
    capture: (reason, saved, generation = get().generation) => {
      if (generation !== get().generation) return;
      set({
        saved,
        departure: reason,
        resume: reason === "background" ? "restore" : "active",
      });
    },
    leaveTab: () =>
      set({
        generation: get().generation + 1,
        resume: "home",
        departure: "tab",
        saved: null,
      }),
    resumed: () => set({ resume: "active", departure: null }),
    routeChanged: (routes) => {
      const top = routes.at(-1),
        last = previous.at(-1);
      if (top?.name === "Orrery" && last?.name === "Profile") {
        const genuinePop =
          previous.length === routes.length + 1 &&
          previous.at(-2)?.key === top.key;
        const restore =
          genuinePop && get().departure === "profile" && get().saved !== null;
        set({
          resume: restore ? "restore" : "home",
          saved: restore ? get().saved : null,
        });
      } else if (top && top.name !== "Orrery" && top.name !== "Profile") {
        set({
          generation: get().generation + 1,
          resume: "home",
          departure: "other",
          saved: null,
        });
      } else if (
        top?.name === "Profile" &&
        last?.name !== "Profile" &&
        last?.name !== "Orrery"
      ) {
        set({ resume: "home", saved: null });
      }
      previous = routes.map((route) => ({ key: route.key, name: route.name }));
    },
  }));
}
export const useOrrerySessionStore = createOrrerySessionStore();
