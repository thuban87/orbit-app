import type {
  ProfileCollapseMap,
  ProfileModuleId,
  ProfileOverviewModuleId,
} from "./persisted-contract";

export type ProfileModuleSize = "1x1" | "2x1";

export interface ProfileModulePlacement {
  id: ProfileModuleId;
  visible: boolean;
  expanded: boolean;
  size?: ProfileModuleSize;
}

export interface ProfileLayoutDocument {
  version: 1;
  topLevel: ProfileModulePlacement[];
  overview: Array<
    ProfileModulePlacement & {
      id: ProfileOverviewModuleId;
      size: ProfileModuleSize;
    }
  >;
  thingsToRemember: ProfileModulePlacement[];
}

export interface ProfileLayoutTemplateValue {
  uid: string;
  layout: unknown;
}

export interface ProfileBackgroundTemplateValue {
  uid: string;
  imagePath: string;
}

export interface ProfilePresentationAssignment {
  layoutTemplateUid: string | null;
  backgroundTemplateUid: string | null;
}

export interface ProfileContactPresentationAssignment
  extends ProfilePresentationAssignment {
  freeformLayout: unknown | null;
  collapse: ProfileCollapseMap;
}

export interface ProfilePresentationInputs {
  factoryLayout: ProfileLayoutDocument;
  themeBackground: string;
  layoutTemplates: readonly ProfileLayoutTemplateValue[];
  backgroundTemplates: readonly ProfileBackgroundTemplateValue[];
  global: ProfilePresentationAssignment;
  category: ProfilePresentationAssignment | null;
  contact: ProfileContactPresentationAssignment;
}

export type ProfilePresentationSource =
  | "contact-template"
  | "contact-freeform"
  | "contact"
  | "category"
  | "global"
  | "factory"
  | "theme";

export interface MissingProfilePresentationReference {
  axis: "layout" | "background";
  source: "contact" | "category" | "global";
  uid: string;
}

export interface ProfilePresentation {
  layout: {
    source: Extract<
      ProfilePresentationSource,
      | "contact-template"
      | "contact-freeform"
      | "category"
      | "global"
      | "factory"
    >;
    templateUid: string | null;
    document: ProfileLayoutDocument;
  };
  background: {
    source: Extract<
      ProfilePresentationSource,
      "contact" | "category" | "global" | "theme"
    >;
    templateUid: string | null;
    imagePath: string;
  };
  collapse: ProfileCollapseMap;
  missingReferences: MissingProfilePresentationReference[];
}
