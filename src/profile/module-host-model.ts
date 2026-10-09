import { PROFILE_MODULE_REGISTRY } from "./module-registry";
import type {
  ProfileCollapseMap,
  ProfileCollapsibleModuleId,
  ProfileModuleId,
} from "./persisted-contract";

/**
 * Section headers are identifiers only. Content state belongs in the rendered
 * section body, so no module may supply header-adjacent empty-state metadata.
 */
export const PROFILE_MODULE_EMPTY_SUMMARIES: Readonly<
  Partial<Record<ProfileModuleId, string>>
> = Object.freeze({});

/** Render-free contract shared by the section header and its accessibility state. */
export function resolveProfileModuleHostState(input: {
  id: ProfileCollapsibleModuleId;
  defaultExpanded: boolean;
  collapse: ProfileCollapseMap;
}): { expanded: boolean; accessibilityLabel: string } {
  const expanded = input.collapse[input.id] ?? input.defaultExpanded;
  const label = PROFILE_MODULE_REGISTRY[input.id].label;
  return {
    expanded,
    accessibilityLabel: `${expanded ? "Collapse" : "Expand"} ${label}`,
  };
}

/** The History reveal the Profile offers from Last Interaction and Status. */
export interface HistoryReveal {
  /** The resolved layout shows History; otherwise neither action is offered (D-11). */
  available: boolean;
  /** History is currently collapsed and must expand before it is useful. */
  needsExpand: boolean;
  /** The placement default the persisted collapse toggle is resolved against. */
  defaultExpanded: boolean;
}

/**
 * 38.3 RG-021 (D-10, D-11, D-28). Whether the Profile can reveal its in-Profile
 * History section, and whether the reveal must expand it first. A hidden or
 * absent History placement makes the actions unavailable — the reveal never
 * mutates layout visibility. Expanded semantics are the section header's own
 * (`resolveProfileModuleHostState`), so the reveal and a header tap agree.
 */
export function resolveHistoryReveal(input: {
  topLevel: ReadonlyArray<{ id: string; visible: boolean; expanded: boolean }>;
  collapse: ProfileCollapseMap;
}): HistoryReveal {
  const placement = input.topLevel.find(
    (candidate) => candidate.id === "interaction-history" && candidate.visible,
  );
  if (!placement) {
    return { available: false, needsExpand: false, defaultExpanded: false };
  }
  const { expanded } = resolveProfileModuleHostState({
    id: "interaction-history",
    defaultExpanded: placement.expanded,
    collapse: input.collapse,
  });
  return {
    available: true,
    needsExpand: !expanded,
    defaultExpanded: placement.expanded,
  };
}

/** Scroll bookkeeping for the History reveal; one instance per mounted host. */
export interface HistoryRevealScroll {
  /** The host root's y inside the Profile ScrollView content. */
  hostLayout(y: number): void;
  /** The History section's y inside the host, with its current expanded state. */
  historyLayout(y: number, expanded: boolean): void;
  /** Start a reveal; an expanding reveal defers its scroll to the expanded layout. */
  reveal(needsExpand: boolean): void;
  /** The expand write settled; `expanded` false (write failed) scrolls at once. */
  expandSettled(expanded: boolean): void;
  /**
   * 38.8 D-72: History's loaded content (stream, empty state or read error)
   * laid out — never its "Loading history…" placeholder. An expanding reveal
   * scrolls once more here and is then settled.
   */
  historyContentLayout(): void;
  /**
   * 38.8 D-19/D-20: scroll to a point INSIDE History, `offsetY` below the
   * History anchor (a heatmap jump target). A plain additive scroll: it holds
   * no request or generation state (a HistorySection remounts on every collapse
   * and contact change, so the caller owns staleness — `completeHistoryScroll`)
   * and never touches a pending expand reveal (D-61).
   */
  scrollWithinHistory(offsetY: number): void;
}

/**
 * D-10 scroll target: the History header, at host offset + section offset.
 * The header's own y does not move when History expands, but a ScrollView
 * clamps `scrollTo` to its current content height — a collapsed History at the
 * bottom of the Profile could not be brought up until its body exists. So an
 * expanding reveal scrolls on the first expanded History layout (or at once if
 * the expand write failed, landing on the header's Retry).
 *
 * 38.8 D-72 (G1): History mounts fresh on every expand and first shows
 * "Loading history…", so that first scroll can still be clamped short. The
 * expanding reveal therefore stays pending until History's loaded content
 * lays out, scrolls once more there, and is settled; a collapse before that
 * drops it. A reveal of an already open History scrolls once, at once.
 * Plain callbacks, no timers and no animation state (the screen owns
 * reduced-motion).
 */
export function createHistoryRevealScroll(
  scrollTo: (y: number) => void,
): HistoryRevealScroll {
  let hostY = 0;
  let historyY = 0;
  // idle → (expanding reveal) expand → (expanded layout) content → idle.
  let pending: "idle" | "expand" | "content" = "idle";
  const scroll = () => scrollTo(hostY + historyY);
  return {
    hostLayout(y) {
      hostY = y;
    },
    historyLayout(y, expanded) {
      historyY = y;
      if (pending === "expand" && expanded) {
        pending = "content";
        scroll();
      } else if (pending === "content" && !expanded) {
        pending = "idle";
      }
    },
    reveal(needsExpand) {
      if (needsExpand) {
        pending = "expand";
        return;
      }
      pending = "idle";
      scroll();
    },
    expandSettled(expanded) {
      if (pending === "expand" && !expanded) {
        pending = "idle";
        scroll();
      }
    },
    historyContentLayout() {
      if (pending === "idle") return;
      pending = "idle";
      scroll();
    },
    scrollWithinHistory(offsetY) {
      scrollTo(hostY + historyY + offsetY);
    },
  };
}

/**
 * 38.8 D-19/D-20 (RESEARCH Pattern 3; C2-01): the measure-success step of a
 * History jump. The request carries its own `isCurrent()` (a closure over the
 * requesting HistorySection mount's generation), checked right before the
 * scroll: a superseded or cancelled request, or one whose mount is gone,
 * neither scrolls nor reports a result, and returns false. Otherwise it scrolls
 * `offsetY` below the History anchor, less `leadIn` (38.8 D-73: the empty-day
 * note lands that far below the visible top, so it scrolls only far enough to
 * show it; 0 for a jump), reports success and returns true.
 */
export function completeHistoryScroll(
  scroller: HistoryRevealScroll,
  offsetY: number,
  isCurrent: () => boolean,
  onResult: (ok: boolean) => void,
  leadIn = 0,
): boolean {
  if (!isCurrent()) return false;
  scroller.scrollWithinHistory(offsetY - leadIn);
  onResult(true);
  return true;
}
