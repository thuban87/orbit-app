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
}

/**
 * D-10 scroll target: the History header, at host offset + section offset.
 * The header's own y does not move when History expands, but a ScrollView
 * clamps `scrollTo` to its current content height — a collapsed History at the
 * bottom of the Profile could not be brought up until its body exists. So an
 * expanding reveal scrolls on the first expanded History layout (or at once if
 * the expand write failed, landing on the header's Retry). Plain callbacks, no
 * timers and no animation state (the screen owns reduced-motion).
 */
export function createHistoryRevealScroll(
  scrollTo: (y: number) => void,
): HistoryRevealScroll {
  let hostY = 0;
  let historyY = 0;
  let awaitingExpand = false;
  const scroll = () => {
    awaitingExpand = false;
    scrollTo(hostY + historyY);
  };
  return {
    hostLayout(y) {
      hostY = y;
    },
    historyLayout(y, expanded) {
      historyY = y;
      if (awaitingExpand && expanded) scroll();
    },
    reveal(needsExpand) {
      if (needsExpand) {
        awaitingExpand = true;
        return;
      }
      scroll();
    },
    expandSettled(expanded) {
      if (awaitingExpand && !expanded) scroll();
    },
  };
}
