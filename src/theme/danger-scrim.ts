import type { ResolvedMode, ThemePackage, ThemePalette } from "./theme-types";

/**
 * The persistent red `danger` strings that get a scrim (38.5 D-50, the owner's
 * D25-B). Galaxy Dark `danger` (#E5484D) reaches only 3.58-4.00:1 over the
 * shipped Galaxy Dark art, so these four strings, which stay on screen as normal
 * content (not a transient error), sit on an OPAQUE root-`background` backing
 * there: 4.91:1, where an opaque `surface` would be 4.50:1 with no margin. The
 * transient error strings stay accepted under `E-1-bare` (D25-A). Every other
 * package × mode already clears 4.5:1 bare, so it draws nothing extra there.
 * Opaque, so the art beneath never enters the ratio.
 */
export const PERSISTENT_DANGER_SCRIM_SITES = [
  "src/screens/BulkImportSetupScreen.tsx",
  "src/screens/ReconcileDetailScreen.tsx",
  "src/components/PhotoSourcePicker.tsx",
  "src/components/MergeImpactSummary.tsx",
] as const;

/** The backing style for a persistent danger string, or `undefined` (no scrim). */
export function persistentDangerScrim(theme: {
  package: ThemePackage;
  mode: ResolvedMode;
  colors: Pick<ThemePalette, "background">;
}): { backgroundColor: string } | undefined {
  return theme.package === "galaxy" && theme.mode === "dark"
    ? { backgroundColor: theme.colors.background }
    : undefined;
}
