import type { ProfileTemplateUsage } from "@/db/profile-presentation-read";
import { PROFILE_MODULE_REGISTRY } from "./module-registry";
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

/**
 * The template Preview's lines (review IN-08, a 38.11-13 deferred item): each
 * visible module by its registry label, in layout order, never its raw id and
 * without the tile size, like the "currently uses" line 38.11-13 fixed.
 */
export function templatePreviewLines(layout: ProfileLayoutDocument): {
  topLevel: string[];
  overview: string[];
  thingsToRemember: string[];
} {
  const labels = (items: ProfileLayoutDocument["topLevel"]) =>
    items
      .filter((item) => item.visible)
      .map((item) => PROFILE_MODULE_REGISTRY[item.id].label);
  return {
    topLevel: labels(layout.topLevel),
    overview: labels(layout.overview),
    thingsToRemember: labels(layout.thingsToRemember),
  };
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

/**
 * After a new template is saved (38.12 D-90): the draft clears AND the create
 * page closes, so the manager is back on its template list, or on the new
 * template's assignment page when the save asked for one. Clearing the draft
 * alone left an empty create form whose name field ignored typing.
 */
export function finishTemplateCreate(
  state: TemplateManagerState,
  assignTemplateUid: string | null,
): TemplateManagerState {
  const cleared = clearTemplateDraft(state);
  const pages = cleared.pages.filter((page) => page.kind !== "create");
  const listed: TemplateManagerState = {
    ...cleared,
    pages: pages.length > 0 ? pages : [{ kind: "list" }],
  };
  return assignTemplateUid === null
    ? listed
    : openTemplateManagerPage(listed, {
        kind: "assignment",
        templateUid: assignTemplateUid,
      });
}

/** The success snackbar after a new template is saved (38.12 D-90). */
export function templateSavedSnackbar(name: string): string {
  return `Saved layout template ${name}`;
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
