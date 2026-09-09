import {
  createProfileLayoutEditorDraft,
  isMeaningfulLayoutChange,
} from "./layout-editor-reducer";
import type { ProfileLayoutDocument } from "./types";

export type LayoutEditorDismissIntent =
  | "close"
  | "confirm-discard"
  | "keep-editing";

/** The shell asks for confirmation only for a meaningful, non-saving draft. */
export function requestLayoutEditorDismissal(input: {
  initial: ProfileLayoutDocument;
  draft: ProfileLayoutDocument;
  saving: boolean;
}): LayoutEditorDismissIntent {
  if (input.saving) return "keep-editing";
  return isMeaningfulLayoutChange(input.initial, input.draft)
    ? "confirm-discard"
    : "close";
}

/** Saving delegates one complete canonical draft to the atomic presentation DAO. */
export async function saveLayoutEditorDraft(input: {
  draft: ProfileLayoutDocument;
  save: (draft: ProfileLayoutDocument) => Promise<void>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await input.save(input.draft);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Couldn’t save this layout.",
    };
  }
}

/** Template creation receives an intent only; it cannot persist from this editor. */
export function createLayoutTemplateIntent(
  draft: ProfileLayoutDocument,
): ProfileLayoutDocument {
  return createProfileLayoutEditorDraft(draft);
}
