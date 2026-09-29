/**
 * Pinned phase records (38.5 code review IN-03).
 *
 * Several product tests and the art validators read OWNER-SIGNED records that
 * live in their phase directories: the v2/v3 scrim sign-offs, the art sign-off's
 * machine-readable allowance block (also the single source for
 * `scripts/check-background-art.py --accepted-exclusions` and
 * `scripts/background_manifest.py`), and the 38.4 / 38.5 inventories that
 * justify every proof exclusion. They are not copied into `src`, because a copy
 * would be a second source of truth for a signed record.
 *
 * So those phase directories must never be archived or moved (for example by
 * `gsd-cleanup`) until the records are relocated together with their readers,
 * which is the KB-extraction step for 38.4 / 38.5. This guard fails with that
 * instruction instead of an ENOENT deep inside a proof, and it fails if a new
 * reader starts depending on another phase directory without pinning it here.
 * See `docs/runbooks/theme-visual-system-maintenance.md` Pitfall 18.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(__dirname, "..", "..");

/** The phase directories whose records `src` and `scripts` read. */
const PINNED_PHASE_DIRS = [
  ".planning/phases/38.4-audit-remediation-ui-performance-release",
  ".planning/phases/38.5-background-art-text-contrast",
] as const;

/** The specific signed files read by tests and validators. */
const PINNED_FILES = [
  ".planning/phases/38.4-audit-remediation-ui-performance-release/38.4-RG029-INVENTORY.md",
  ".planning/phases/38.5-background-art-text-contrast/38.5-ART-SIGNOFF.md",
  ".planning/phases/38.5-background-art-text-contrast/38.5-BARE-TEXT-INVENTORY.md",
  ".planning/phases/38.5-background-art-text-contrast/38.5-scrim-signoff-v2.json",
  ".planning/phases/38.5-background-art-text-contrast/38.5-scrim-signoff-v3.json",
] as const;

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(REPO, dir))) {
    const rel = join(dir, name);
    if (statSync(join(REPO, rel)).isDirectory()) sources(rel, out);
    else if (/\.(tsx?|py)$/.test(name)) out.push(rel);
  }
  return out;
}

describe("pinned phase records (IN-03)", () => {
  it.each(PINNED_FILES)(
    "%s is present (its phase directory holds signed test inputs: do not archive it; runbook Pitfall 18)",
    (file) => {
      expect(existsSync(join(REPO, file)), file).toBe(true);
    },
  );

  it("every phase directory named in src or scripts is pinned here", () => {
    const named = new Set<string>();
    for (const file of [...sources("src"), ...sources("scripts")]) {
      const text = readFileSync(join(REPO, file), "utf8");
      for (const m of text.matchAll(/\.planning\/phases\/[A-Za-z0-9.-]+/g))
        named.add(m[0]);
    }
    expect(
      [...named].filter(
        (dir) => !(PINNED_PHASE_DIRS as readonly string[]).includes(dir),
      ),
      "phase directories read by src or scripts but not pinned",
    ).toEqual([]);
  });
});
