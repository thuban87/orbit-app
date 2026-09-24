import { themeSelectionFromSettings } from "@/stores/theme-store";
import type { ThemeSelection } from "@/theme/theme-types";
import { Logger } from "@/utils/logger";

type CommittedThemeSettings = Parameters<typeof themeSelectionFromSettings>[0];

/** Publish the committed database selection; a publication error cannot undo restore. */
export async function publishCommittedRestore(deps: {
  readSettings: () => Promise<CommittedThemeSettings>;
  hydrate: (selection: ThemeSelection) => void;
}): Promise<void> {
  try {
    deps.hydrate(themeSelectionFromSettings(await deps.readSettings()));
  } catch (error) {
    Logger.error(
      "restore-completion",
      "committed theme publication failed",
      error,
    );
  }
}
