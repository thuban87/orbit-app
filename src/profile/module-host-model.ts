import { PROFILE_MODULE_REGISTRY } from "./module-registry";
import type {
  ProfileCollapseMap,
  ProfileCollapsibleModuleId,
  ProfileModuleId,
} from "./persisted-contract";

/** Useful collapsed summaries remain visible even while their owning renderer is empty. */
export const PROFILE_MODULE_EMPTY_SUMMARIES: Readonly<
  Partial<Record<ProfileModuleId, string>>
> = Object.freeze({
  "things-to-remember": "Things to Remember · Nothing added yet",
  "contact-methods": "Contact Methods · None",
  "interaction-history": "Interaction History · No interactions yet",
});

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
