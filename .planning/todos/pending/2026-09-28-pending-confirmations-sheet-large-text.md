---
created: 2026-09-28T12:00:00.000Z
title: Pending-confirmations sheet — four large-text / dismissal problems (38.4 OAD3-c findings)
area: ui
severity: minor
files:

  - src/components/assist/ (pending-confirmations sheet and its rows)

source: 38.4 OAD3-c device test (Pixel 3a, font 2.0 + density 540), 2026-09-28; owner chose a todo instead of more 38.4 fixes. Evidence: uat-shots/OAD3-1..10, xml/OAD3-*.xml
---

## Problems

1. **Names cut off.** Each question is limited to one line, so at large text it reads "Did you text ZZ…". With several
   different people pending, a large-text user can't tell who each row is about.
2. **Keyboard covers the note.** While typing a note, the keyboard hides the note field and that row's Yes. Closing the
   keyboard makes both reachable again (same pattern as G1-l).
3. **Title breaks mid-word** at the very largest size ("Pending con / firmations"); fine at font 1.3.
4. **Sheet closes too easily.** Back, ESC and tapping the backdrop close the whole sheet and drop an unsaved note (the
   assists stay pending). 38.4 D-49 said these prompts stay Modals with explicit-action-only exits; this sheet does not
   match that yet (Plan 21 left it unchanged). Decide whether to make it explicit-action-only or keep the note on dismiss.

## Solution

Let the question wrap (or show the name on its own line); keep the note field and row actions above the keyboard (the
shared Sheet keyboard lift from D-72 may already cover it if this sheet adopts it); allow the title to wrap by word;
align dismissal with D-49 or preserve the draft note.
