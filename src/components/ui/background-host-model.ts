import type { BackgroundSlotId } from "@/theme/theme-option-ids";
import type { ThemePackage } from "@/theme/theme-types";

/**
 * Keeps the original, validated app-owned URI separate from the URI currently
 * rendered. A render failure suppresses the latter, but must not look like a
 * new selection and clear its own fallback latch.
 */
export function backgroundHostSelection(input: {
  package: ThemePackage;
  slotId: BackgroundSlotId | null;
  appOwnedBackgroundUri: string | null;
  forceRenderError: boolean;
  renderFailed: boolean;
}): {
  appOwnedUri: string | null;
  localUri: string | null;
  selectionKey: string;
} {
  const appOwnedUri = input.appOwnedBackgroundUri?.startsWith("file://")
    ? input.appOwnedBackgroundUri
    : null;
  return {
    appOwnedUri,
    localUri:
      !input.forceRenderError && !input.renderFailed ? appOwnedUri : null,
    selectionKey: `${input.package}:${String(input.slotId)}:${String(appOwnedUri)}`,
  };
}
