import { PROFILE_MODULE_REGISTRY } from "./module-registry";
import type {
  ProfileModuleId,
  ProfileModuleParentId,
} from "./persisted-contract";
import {
  FACTORY_PROFILE_LAYOUT,
  parseAndCanonicalizeProfileLayout,
  serializeProfileLayout,
} from "./presentation-schema";
import type {
  ProfileLayoutDocument,
  ProfileModulePlacement,
  ProfileModuleSize,
} from "./types";

type EditorBucket = "topLevel" | "overview" | "thingsToRemember";
type MoveDirection = "up" | "down";

export type ProfileLayoutEditorAction =
  | {
      type: "reorder";
      parent: ProfileModuleParentId;
      id: ProfileModuleId;
      toIndex: number;
    }
  | { type: "move"; id: ProfileModuleId; direction: MoveDirection }
  | { type: "set-visible"; id: ProfileModuleId; visible: boolean }
  | { type: "set-expanded"; id: ProfileModuleId; expanded: boolean }
  | { type: "set-size"; id: ProfileModuleId; size: ProfileModuleSize }
  | { type: "reset"; layout: unknown };

function bucketForParent(parent: ProfileModuleParentId): EditorBucket {
  switch (parent) {
    case "profile":
      return "topLevel";
    case "relationship-overview":
      return "overview";
    case "things-to-remember":
      return "thingsToRemember";
  }
}

function completeBucket(
  placements: readonly ProfileModulePlacement[],
  factory: readonly ProfileModulePlacement[],
): ProfileModulePlacement[] {
  const present = new Set(placements.map((placement) => placement.id));
  return [
    ...placements.map((placement) => ({ ...placement })),
    ...factory
      .filter((placement) => !present.has(placement.id))
      .map((placement) => ({ ...placement })),
  ];
}

/**
 * Editor drafts are always complete even if a historical document was valid
 * but omitted a newer registry module. Missing modules become factory-shaped
 * placeholders rather than silently disappearing from the focused editor.
 */
export function createProfileLayoutEditorDraft(
  value: unknown,
): ProfileLayoutDocument {
  const parsed = parseAndCanonicalizeProfileLayout(value);
  return parseAndCanonicalizeProfileLayout({
    version: parsed.version,
    topLevel: completeBucket(parsed.topLevel, FACTORY_PROFILE_LAYOUT.topLevel),
    overview: completeBucket(parsed.overview, FACTORY_PROFILE_LAYOUT.overview),
    thingsToRemember: completeBucket(
      parsed.thingsToRemember,
      FACTORY_PROFILE_LAYOUT.thingsToRemember,
    ),
  });
}

function updatePlacement(
  draft: ProfileLayoutDocument,
  id: ProfileModuleId,
  update: (placement: ProfileModulePlacement) => ProfileModulePlacement,
): ProfileLayoutDocument {
  const bucket = bucketForParent(PROFILE_MODULE_REGISTRY[id].parent);
  const placements = draft[bucket] as ProfileModulePlacement[];
  const index = placements.findIndex((placement) => placement.id === id);
  if (index < 0) return draft;
  const next = update(placements[index]);
  if (JSON.stringify(next) === JSON.stringify(placements[index])) return draft;
  return createProfileLayoutEditorDraft({
    ...draft,
    [bucket]: placements.map((placement, placementIndex) =>
      placementIndex === index ? next : placement,
    ),
  });
}

function reorder(
  draft: ProfileLayoutDocument,
  parent: ProfileModuleParentId,
  id: ProfileModuleId,
  toIndex: number,
): ProfileLayoutDocument {
  if (PROFILE_MODULE_REGISTRY[id].parent !== parent) return draft;
  const bucket = bucketForParent(parent);
  const placements = draft[bucket] as ProfileModulePlacement[];
  const fromIndex = placements.findIndex((placement) => placement.id === id);
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    toIndex >= placements.length ||
    toIndex === fromIndex
  ) {
    return draft;
  }
  const reordered = [...placements];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return createProfileLayoutEditorDraft({ ...draft, [bucket]: reordered });
}

/**
 * The canonical editor state machine. Drag drops and named accessibility moves
 * both resolve through the same `reorder` branch, so neither interaction can
 * create a distinct persistent layout grammar.
 */
export function profileLayoutEditorReducer(
  state: ProfileLayoutDocument,
  action: ProfileLayoutEditorAction,
): ProfileLayoutDocument {
  const draft = createProfileLayoutEditorDraft(state);
  switch (action.type) {
    case "reorder":
      return reorder(draft, action.parent, action.id, action.toIndex);
    case "move": {
      const parent = PROFILE_MODULE_REGISTRY[action.id].parent;
      const bucket = bucketForParent(parent);
      const index = (draft[bucket] as ProfileModulePlacement[]).findIndex(
        (placement) => placement.id === action.id,
      );
      return reorder(
        draft,
        parent,
        action.id,
        index + (action.direction === "up" ? -1 : 1),
      );
    }
    case "set-visible":
      return updatePlacement(draft, action.id, (placement) => ({
        ...placement,
        visible: action.visible,
      }));
    case "set-expanded":
      if (!PROFILE_MODULE_REGISTRY[action.id].collapsible) return state;
      return updatePlacement(draft, action.id, (placement) => ({
        ...placement,
        expanded: action.expanded,
      }));
    case "set-size": {
      const definition = PROFILE_MODULE_REGISTRY[action.id];
      if (
        definition.parent !== "relationship-overview" ||
        !definition.supportedSizes.includes(action.size)
      ) {
        return state;
      }
      return updatePlacement(draft, action.id, (placement) => ({
        ...placement,
        size: action.size,
      }));
    }
    case "reset":
      return createProfileLayoutEditorDraft(action.layout);
  }
}

/** Preview mode reveals all editable sections without changing their saved visibility. */
export function createAllSectionsPreview(
  draft: ProfileLayoutDocument,
): ProfileLayoutDocument {
  const complete = createProfileLayoutEditorDraft(draft);
  return createProfileLayoutEditorDraft({
    ...complete,
    topLevel: complete.topLevel.map((placement) => ({
      ...placement,
      visible: true,
    })),
    overview: complete.overview.map((placement) => ({
      ...placement,
      visible: true,
    })),
    thingsToRemember: complete.thingsToRemember.map((placement) => ({
      ...placement,
      visible: true,
    })),
  });
}

export function isMeaningfulLayoutChange(
  before: ProfileLayoutDocument,
  after: ProfileLayoutDocument,
): boolean {
  return (
    serializeProfileLayout(createProfileLayoutEditorDraft(before)) !==
    serializeProfileLayout(createProfileLayoutEditorDraft(after))
  );
}
