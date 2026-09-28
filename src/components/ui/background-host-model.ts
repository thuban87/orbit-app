import type { BackgroundSlotId } from "@/theme/theme-option-ids";
import type { ResolvedMode, ThemePackage } from "@/theme/theme-types";

/**
 * Keeps the original, validated app-owned URI separate from the URI currently
 * rendered. A render failure suppresses the latter, but must not look like a
 * new selection and clear its own fallback latch.
 *
 * The resolved mode is part of the selection key (38.5 D-23 / research Pitfall 4):
 * each mode renders its own variant file, so a decode failure on one mode's file
 * must not pin the solid fallback after a mode switch.
 */
export function backgroundHostSelection(input: {
  package: ThemePackage;
  slotId: BackgroundSlotId | null;
  mode: ResolvedMode;
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
    selectionKey: `${input.package}:${String(input.slotId)}:${input.mode}:${String(appOwnedUri)}`,
  };
}
