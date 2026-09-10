import type { ProfileTemplateUsage } from "@/db/profile-presentation-read";
import type { ProfileLayoutDocument, ProfilePresentationSource } from "./types";

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
 * A layout-editor handoff wins over the last persisted freeform layout. It is
 * already a canonical copy, and is never mutated by the template manager.
 */
export function templateLayoutForNewTemplate(input: {
  pendingTemplateLayout: ProfileLayoutDocument | null;
  freeformLayout: ProfileLayoutDocument | null;
}): ProfileLayoutDocument | null {
  return input.pendingTemplateLayout ?? input.freeformLayout;
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
      text: `Contact override: ${input.templateName ?? "saved template"}`,
    };
  }
  if (input.source === "contact-freeform") {
    return { kind: "override", text: "Contact override: freeform layout" };
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
