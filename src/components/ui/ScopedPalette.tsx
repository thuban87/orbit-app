/**
 * ScopedPalette (D-34 scoped-read helper; RG-029 `ui-accessibility/AUD-UIA-001`).
 *
 * THE RULE: only a hook called INSIDE a `GlassSurface` card, a `ChromeScrim` or
 * a `ShellAppBar` `trailing` subtree sees the glass foreground palette
 * (`GlassForegroundScope` re-provides the theme there). A host that calls
 * `useTheme()` once at its top and then reads `colors.*` inside its own card
 * renders the ROOT tone, so the D-24 Standard-Light glass variants (and the
 * secondary -> primary override) never reach those pixels.
 *
 * `ScopedPalette` is mounted as a child INSIDE the scope. It calls `useTheme()`
 * where it mounts, so it sees the scoped palette, and hands that palette to its
 * render prop:
 *
 *   <GlassSurface>
 *     <ScopedPalette>
 *       {(scoped) => <Text style={{ color: scoped.danger }}>…</Text>}
 *     </ScopedPalette>
 *   </GlassSurface>
 *
 * It adds no wrapper node, style or colour: it returns the render prop's output
 * directly. `src/theme/glass-scope-read-contract.test.ts` fails on any
 * glass-overridden token read through a binding resolved above the scope.
 *
 * Import it by module path (`@/components/ui/ScopedPalette`), not through the
 * `@/components/ui` barrel, so a harness mock of this path is unambiguous.
 */
import type { ReactNode } from "react";
import { type ThemePalette, useTheme } from "@/theme";

export interface ScopedPaletteProps {
  /** Receives the palette resolved where this component mounts. */
  children: (colors: ThemePalette) => ReactNode;
}

export function ScopedPalette({ children }: ScopedPaletteProps): ReactNode {
  const { colors } = useTheme();
  return children(colors);
}
