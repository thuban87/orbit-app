/**
 * Compose-local human labels for the five `FuelKind`s (A2, B3) — a PURE,
 * node-safe module (no UI-framework or DB imports) that maps a stored
 * `FuelKind` to its UI-SPEC display copy for the read-only fuel-render surfaces
 * (the compose screen now; Phases 11/12/14 render fuel too).
 *
 * WHY THIS EXISTS SEPARATELY: `KIND_OPTIONS` / `kindLabel` in `FuelEditor.tsx:72`
 * is a module-private `const` — it is NOT exported and CANNOT be imported. The
 * read-only compose/render surfaces need the same labels without the editor's
 * ordering / picker concerns, so they live here.
 *
 * NOT a repo-wide single source of truth: the shipped `FuelEditor` keeps its OWN
 * label literals + local `kindLabel` and is OUT OF SCOPE this phase. The two
 * copies duplicating the label copy is the accepted state by design (B3) — do NOT
 * refactor `FuelEditor` to consume this helper.
 *
 * The `Record<FuelKind, string>` typing makes the mapping EXHAUSTIVE at compile
 * time: adding a sixth kind to `FuelKind` without a label here is a `tsc` error.
 */
import type { FuelKind } from "@/db/fuel-dao";

/** The exhaustive kind → display-copy map (UI-SPEC Copywriting Contract). */
const KIND_LABELS: Record<FuelKind, string> = {
  recent: "Recent",
  topic: "Topic",
  fact: "Fact",
  gift: "Gift idea",
  off_limits: "Off-limits",
};

/**
 * The human display label for a fuel `kind`. Pure: same input → same output; no
 * I/O; never throws (every `FuelKind` has an entry by construction).
 */
export function fuelKindLabel(kind: FuelKind): string {
  return KIND_LABELS[kind];
}
