import type { ProfileTemplateUsage } from "@/db/profile-presentation-read";
import { parseAndCanonicalizeProfileLayout } from "./presentation-schema";
import { completeProfileLayoutChildren } from "./resolve-presentation";
import type {
  ProfileLayoutDocument,
  ProfilePresentationInputs,
  ProfilePresentationSource,
} from "./types";

export type TemplateManagerPage =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; templateUid: string }
  | { kind: "preview"; templateUid: string }
  | { kind: "assignment"; templateUid: string }
  | { kind: "usage"; templateUid: string }
  | { kind: "delete"; templateUid: string };

export interface TemplateDraft {
  name: string;
  layout: ProfileLayoutDocument | unknown;
}

export interface TemplateUsageState extends ProfileTemplateUsage {
  stale: boolean;
}

export interface TemplateManagerState {
  pages: readonly TemplateManagerPage[];
  draft: TemplateDraft | null;
  dirty: boolean;
  pendingTemplateUids: readonly string[];
  usage: Readonly<Record<string, TemplateUsageState>>;
  error: string | null;
}

export interface TemplateAssignmentDescription {
  kind: "inherited" | "override";
  text: string;
}

/**
 * The "currently" caption for an assignment. `kind` is a discriminator, never
 * copy: it is mapped to display words here (D-41, D-63; review C5-L10).
 */
export function describeAssignmentKind(
  kind: TemplateAssignmentDescription["kind"],
): string {
  return kind === "override"
    ? "This contact currently has its own layout."
    : "This contact currently uses an inherited layout.";
}

/** List loading has its own recovery path; mutation failures retain their page and draft. */
export interface TemplateManagerListLoadState {
  loading: boolean;
  error: string | null;
}

export function createTemplateManagerListLoadState(): TemplateManagerListLoadState {
  return { loading: false, error: null };
}

export function beginTemplateManagerListLoad(): TemplateManagerListLoadState {
  return { loading: true, error: null };
}

export function finishTemplateManagerListLoad(
  error: string | null,
): TemplateManagerListLoadState {
  return { loading: false, error };
}

/**
 * A layout-editor handoff wins over the last persisted freeform layout. It is
 * already a canonical copy, and is never mutated by the template manager.
 */
export function templateLayoutForNewTemplate(input: {
  pendingTemplateLayout: ProfileLayoutDocument | null;
  freeformLayout: ProfileLayoutDocument | null;
}): ProfileLayoutDocument | null {
  return input.pendingTemplateLayout ?? input.freeformLayout;
}

/** The resolved layout sources a Profile can show (`ProfilePresentation.layout.source`). */
export type ProfileLayoutSource = Extract<
  ProfilePresentationSource,
  "contact-template" | "contact-freeform" | "category" | "global" | "factory"
>;

/**
 * Plain words for the layout a Profile currently uses, for "{name} currently
 * uses …" (38.11-13; the 38.11-05 deferred item). Never a raw source id. A
 * template's name is used when the caller has it, else a generic phrase.
 * Exhaustive: a new source value fails tsc here.
 */
export function describeCurrentLayout(
  source: ProfileLayoutSource,
  templateName: string | null,
): string {
  switch (source) {
    case "contact-freeform":
      return "their own layout";
    case "contact-template":
      return templateName
        ? `the ${templateName} template`
        : "a layout template";
    case "category":
      return templateName
        ? `the ${templateName} template from their Category`
        : "their Category's layout template";
    case "global":
      return templateName
        ? `the ${templateName} template set for all Profiles`
        : "the layout template set for all Profiles";
    case "factory":
      return "the default layout";
    default: {
      const unreachable: never = source;
      return unreachable;
    }
  }
}

/**
 * The uid of the layout template a resolved source came from, read from the
 * same assignment the resolver used (`resolveProfilePresentation`); null for
 * the person's own layout and the factory default.
 */
export function effectiveLayoutTemplateUid(
  source: ProfileLayoutSource,
  inputs: Pick<ProfilePresentationInputs, "contact" | "category" | "global">,
): string | null {
  switch (source) {
    case "contact-template":
      return inputs.contact.layoutTemplateUid;
    case "category":
      return inputs.category?.layoutTemplateUid ?? null;
    case "global":
      return inputs.global.layoutTemplateUid;
    case "contact-freeform":
    case "factory":
      return null;
    default: {
      const unreachable: never = source;
      return unreachable;
    }
  }
}

/**
 * A stored template's layout for display and editing, completed at read time
 * with any module added since it was saved (the Birthday tile, 38.10's Things
 * to Remember sections) at its factory position, as the Profile and its layout
 * editor do (38.11 D-53, D-80). Nothing is written back; Rename keeps the raw
 * stored layout.
 */
export function templateLayoutForDisplay(
  layoutJson: unknown,
): ProfileLayoutDocument {
  return completeProfileLayoutChildren(
    parseAndCanonicalizeProfileLayout(layoutJson),
  );
}

/** Assignment labels name the durable source, never infer it from visual selection. */
export function describeTemplateAssignment(input: {
  source: Extract<
    ProfilePresentationSource,
    "contact-template" | "contact-freeform" | "category" | "global" | "factory"
  >;
  templateName: string | null;
}): TemplateAssignmentDescription {
  if (input.source === "contact-template") {
    return {
      kind: "override",
      text: `Set for this contact: ${input.templateName ?? "saved template"}`,
    };
  }
  if (input.source === "contact-freeform") {
    return { kind: "override", text: "Set for this contact: freeform layout" };
  }
  if (input.source === "category") {
    return {
      kind: "inherited",
      text: `Inherited from Category template ${input.templateName ?? "layout"}`,
    };
  }
  if (input.source === "global") {
    return {
      kind: "inherited",
      text: `Inherited from global template ${input.templateName ?? "layout"}`,
    };
  }
  return { kind: "inherited", text: "Inherited from factory layout" };
}

export type TemplateManagerBackIntent =
  | { kind: "pop-page" }
  | { kind: "confirm-discard" }
  | { kind: "close-sheet" };

export function createTemplateManagerState(): TemplateManagerState {
  return {
    pages: [{ kind: "list" }],
    draft: null,
    dirty: false,
    pendingTemplateUids: [],
    usage: {},
    error: null,
  };
}

export function activeTemplateManagerPage(
  state: TemplateManagerState,
): TemplateManagerPage {
  return state.pages.at(-1) ?? { kind: "list" };
}

export function openTemplateManagerPage(
  state: TemplateManagerState,
  page: Exclude<TemplateManagerPage, { kind: "list" }>,
): TemplateManagerState {
  return { ...state, pages: [...state.pages, page], error: null };
}

export function popTemplateManagerPage(
  state: TemplateManagerState,
): TemplateManagerState {
  return state.pages.length <= 1
    ? state
    : { ...state, pages: state.pages.slice(0, -1), error: null };
}

export function setTemplateDraft(
  state: TemplateManagerState,
  draft: TemplateDraft,
): TemplateManagerState {
  return { ...state, draft, dirty: true, error: null };
}

export function clearTemplateDraft(
  state: TemplateManagerState,
): TemplateManagerState {
  return { ...state, draft: null, dirty: false, error: null };
}

/** Inner pages always resolve before an unsaved draft guard or sheet dismissal. */
export function managerBackIntent(
  state: TemplateManagerState,
): TemplateManagerBackIntent {
  if (state.pages.length > 1) return { kind: "pop-page" };
  if (state.dirty) return { kind: "confirm-discard" };
  return { kind: "close-sheet" };
}

/** A keyed mutation gate prevents rapid presses from racing one template. */
export function beginTemplateOperation(
  state: TemplateManagerState,
  templateUid: string,
): { accepted: boolean; state: TemplateManagerState } {
  if (state.pendingTemplateUids.includes(templateUid)) {
    return { accepted: false, state };
  }
  return {
    accepted: true,
    state: {
      ...state,
      pendingTemplateUids: [...state.pendingTemplateUids, templateUid],
      usage: state.usage[templateUid]
        ? {
            ...state.usage,
            [templateUid]: { ...state.usage[templateUid], stale: true },
          }
        : state.usage,
      error: null,
    },
  };
}

export function settleTemplateOperation(
  state: TemplateManagerState,
  templateUid: string,
): TemplateManagerState {
  return {
    ...state,
    pendingTemplateUids: state.pendingTemplateUids.filter(
      (pendingUid) => pendingUid !== templateUid,
    ),
  };
}

/** Failure deliberately preserves both the page/draft and prior committed usage. */
export function retainTemplateFailure(
  state: TemplateManagerState,
  templateUid: string,
  message: string,
): TemplateManagerState {
  return {
    ...settleTemplateOperation(state, templateUid),
    error: message,
  };
}

export function setTemplateUsage(
  state: TemplateManagerState,
  templateUid: string,
  usage: ProfileTemplateUsage,
): TemplateManagerState {
  return {
    ...state,
    usage: { ...state.usage, [templateUid]: { ...usage, stale: false } },
  };
}
