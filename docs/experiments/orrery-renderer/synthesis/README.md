# Orrery Renderer R&D: Synthesis (Prototype D)

This is the independent evaluation of the three Orrery renderer labs. It records what worked, what didn't, and the recommended V2 direction. The authoritative contract for the production work is the **Phase 38.7 dossier**: `docs/dossier/milestone-2/phase-38.7-orrery-v2-dossier.md`.

**Bottom line:**
- V2 is **Skia 2.5D**, built fresh from main in Phase 38.7.
- Renderer foundation: **Lab A**.
- Art, switch and interaction language: **Lab B**.
- Camera and layout logic: **Lab C**.
- Lab C's 3D renderer is rejected.

## Reading order

| File | What it is |
|---|---|
| [SYNTHESIS.md](SYNTHESIS.md) | The evaluation. Dimension-by-dimension comparison, successful ideas, the compatibility and conflict matrix for the owner's chosen mix, the proposed V2 architecture, portability, transplant vs reimplement, scope, and lessons. |
| [OWNER-REVIEW.md](OWNER-REVIEW.md) | The owner's hands-on scores and decisions on a Pixel 6 Pro and a Pixel 3a, plus the chat rulings. **The primary product evidence.** |
| [HARVEST-MAP.md](HARVEST-MAP.md) | Every kept idea mapped to its decision, source lab, files, commits, evidence and lift class. |
| [DEAD-ENDS.md](DEAD-ENDS.md) | Technical, renderer and taste dead ends that must not be rediscovered. |
| [audits/](audits/) | Five read-only audits that verified the lab claims against code on disk: one per lab, one for production grounding, and one for portability. These are the evidence behind the other files. |

## Where the labs live

| Lab | Archive tag | Former branch | Package |
|---|---|---|---|
| A: Production Skia | `archive/orrery-lab-a` | `experiment/orrery-skia-production` | `docs/experiments/orrery-renderer/lab-a-production-skia/` |
| B: Skia Unleashed | `archive/orrery-lab-b` | `experiment/orrery-skia-unleashed` | `docs/experiments/orrery-renderer/lab-b-skia-unleashed/` |
| C: True 3D | `archive/orrery-lab-c` | `experiment/orrery-3d` | `docs/experiments/orrery-renderer/lab-c/` |

- **Archived 2026-10-14.** The worktrees and branches were removed after V2 shipped; each lab's final commit is kept as the annotated tag above. Paths written `A:`, `B:` or `C:` in these files resolve against that tag: `git show archive/orrery-lab-a:<path>` prints one file, `git restore --source=archive/orrery-lab-a -- <path>` copies files into the checkout, and `git worktree add ../lab-a-peek archive/orrery-lab-a` gives a temporary full checkout.
- None is to be merged.
- The shared lab brief is `docs/orrery-investigation/ORRERY-EXPERIMENT-CONTRACT.md`.

## Method

1. **Owner review.** The owner tested release builds of all three labs on both phones. A shared 120-contact cast was seeded as identical "Size 5/10/20/32/120" Systems (Lab C has only 32 and 120). He scored 12 steps per lab per phone, then answered 30 feature-level decisions.
2. **Audits.** Five read-only agents re-verified every lab claim against code on disk (CLAUDE.md "Review the code, not the diff"). Claims that failed are marked in the audits.
3. **Rulings.** Owner rulings on conflicts were taken in chat on 2026-10-02 and are recorded in OWNER-REVIEW.md.

## History

- **2026-10-02:** written (Claude). Codex review pending.
- **2026-10-14:** labs archived as tags `archive/orrery-lab-a/b/c`; the table and branch note now point at the tags.
