import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 38.4 review Lane B2 WR-01: a Sheet host component reads its colours ABOVE
 * the overlay's `UnscopedTheme` boundary (`overlay-base.tsx`), then uses them
 * inside the opaque sheet. When the host mounts inside a glass scope (e.g. the
 * Profile History card), `useTheme()` there returns the glass palette, so the
 * sheet loses the normal text hierarchy. Such hosts read the ROOT palette with
 * `useUnscopedTheme()`, as ConfirmDialog does.
 */
const HOSTS = [
  { file: "history/DateDetailSheet.tsx", component: "DateDetailSheet" },
  {
    file: "group/GroupTitlePromptSheet.tsx",
    component: "GroupTitlePromptSheet",
  },
];

describe("opaque sheet hosts read the root palette (Lane B2 WR-01)", () => {
  for (const { file, component } of HOSTS) {
    it(`${component} reads useUnscopedTheme above its Sheet`, () => {
      const text = readFileSync(join(__dirname, file), "utf8");
      const start = text.indexOf(`export function ${component}(`);
      expect(start, component).toBeGreaterThan(-1);
      const head = text.slice(start, text.indexOf("<Sheet", start));
      expect(head).toContain("const { colors } = useUnscopedTheme();");
      expect(head).not.toMatch(/\buseTheme\(\)/);
    });
  }
});
