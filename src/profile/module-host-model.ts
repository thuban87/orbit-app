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
