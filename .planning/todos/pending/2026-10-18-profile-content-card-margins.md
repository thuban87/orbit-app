---
created: 2026-10-18
title: Profile content sections — less inset (content cards ~90% of screen width), and discuss dropping the inner cards
area: profile
severity: minor
files:
  - src/components/profile/ProfileModuleHost.tsx
  - src/screens/ContactProfileScreen.tsx
  - src/components/profile/ThingsToRemember.tsx
target_phase: 38.14
source: owner request, 2026-10-18 (raised during the 38.13 dossier session; routed to 38.14 by the owner)
---

**Owner's request (paraphrased from the 38.13 dossier session, 2026-10-18).** On the Profile, the content cards inside each section card look overly contained. There is a small margin between the section cards and the screen edge, then more margin between the section card border and the content cards inside it. On a test contact's Last Talked About section the content card takes up maybe 70–80% of the screen width. The owner wants less margin, so things sit closer to the screen edge and the content cards take up **closer to 90% of the screen width**. This applies to **every content section inside the section cards**, not just Last Talked About.

**Owner also wants to discuss (bigger change, not decided):** dropping cards for the content sections only. Keep the section cards, but render each section's content as a flatter, list-like layout, with more pronounced headings to tell sections apart. The owner expects this to be a considerably bigger change than a padding tweak, so it needs discussing at the dossier, not assuming.

**Evidence, from code on main @ 8b018e4f (orchestrator read, not yet a full audit):**
- Section body padding: `sectionBody: { gap: SPACING.sm, padding: SPACING.base }` (16 dp), `src/components/profile/ProfileModuleHost.tsx:700`. Section header `paddingHorizontal: SPACING.base` (`:680`).
- Screen-level padding `SPACING.base` (16 dp) in `src/screens/ContactProfileScreen.tsx:1345, 1352` (not confirmed which container holds the section stack).
- Content card style in `ThingsToRemember.tsx:465` (`card: { gap: SPACING.xs, paddingVertical: SPACING.sm }`); other sections' content-card styles not yet surveyed.
- Rough arithmetic: about 32 dp inset per side before the content card edge on a ~410 dp wide phone, which puts the content card at ~80–85% width and its text nearer 75%.

**Agent's suggestions (not decisions):**
- Take most of the reduction from the section card's inner side padding rather than the screen gutter, since the 16 dp gutter is shared app-wide and trimming it only on the Profile may look inconsistent across tabs.
- Treat it as a look decision: render 2–3 variants on a test phone for the owner to choose from screenshots.
- Before planning, check whether 38.11's Profile backgrounds rework, the mode-aware glassy-card decisions or any ADR records these margins or the card-in-card structure. If one does, the change (and especially the no-inner-cards option) amends a recorded decision and must be named as one.
- The padding change is small (probably folds into an existing 38.14 plan). The no-inner-cards option is larger: flag its size at the dossier once surveyed.
