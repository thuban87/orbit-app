# Phase 21 — UI Review

**Audited:** 2026-08-31
**Baseline:** `.planning/phases/21-interaction-assist-reach-out/21-UI-SPEC.md` (approved)
**Screenshots:** device UAT captures reviewed (R01 router, R02 endpoint selector, R06 banner, R20 long-name / long-note backstop). No dev server capture — RN app driven on the Pixel.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every string matches the contract verbatim, including channel-specific questions, "{N} more pending", neutral action labels, and the empty state. |
| 2. Visuals | 4/4 | Primary emphasis correct on all three surfaces; a11y labels on every control. Minor: banner overlays the nav header. |
| 3. Color | 4/4 | 100% theme tokens, no hex literals; accent reserved exactly per contract; neutral outlines (not danger) on "No answer"/"Don't log". |
| 4. Typography | 3/4 | Banner/sheet question renders 16px/700 vs spec's Body 15px/400; "N more pending" typography is a no-op (props on a View). |
| 5. Spacing | 4/4 | Matches the shipped idiom (12/16/8/10/24, radius 8/12); 44px min touch targets on every tappable control. |
| 6. Experience Design | 4/4 | Empty, error (native Alert), overflow ("N more pending" + review sheet), optional-note, non-modal Back-passthrough all covered. |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **Banner question typography diverges from contract (WARNING)** — `AssistBanner.tsx:117-120` and `PendingConfirmationsSheet.tsx:153` render the question at `fontSize:16 / fontWeight:"700"`, but UI-SPEC Typography assigns "banner question text" to the **Body** role (15px / 400). Reads well on-device (bolder hierarchy is arguably better), but it is an unapproved deviation from the approved contract. Either amend the spec's Body row or drop to 15/400.
2. **"{N} more pending" type styles are dead code (WARNING)** — `AssistBanner.tsx:121-126`: `fontSize` and `fontWeight` sit on `styles.pendingCount`, which is applied to a `Pressable`/`View`; RN ignores text-style props on a View, and the child `<Text>` (line 82) sets only `color`. The count therefore renders at the RN default (~14px/400) rather than the intended Meta/Body role. Move `fontSize:15, fontWeight:"600"` onto the inner `<Text>`.
3. **Banner overlaps the navigation header (minor)** — `AssistBanner.tsx:104` positions the overlay at `top:64`, which sits over the screen's own header. In R06/R20 the profile title wraps behind the banner (the trailing "n"/"lo" pokes out below). It is `pointerEvents="box-none"` so Back stays tappable, and a persistent app-global banner is per-contract (Cluster H), but the visual collision with the header title is avoidable — consider seating it below the header or adding top inset.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
Exhaustive match against the Copywriting Contract, verified in source and on-device:
- Questions `questionFor()` — "Did you reach/text/email {name}?" (`AssistBanner.tsx:14-23`, mirrored `PendingConfirmationsSheet.tsx:19-28`).
- "Yes" / "No answer" (call-only, gated `channel === "call"`) / "Don't log" (`AssistConfirmation.tsx:39,57,71`).
- "Add a note" / "Optional note…" (`AssistConfirmation.tsx:84,91`).
- "{N} more pending" (`AssistBanner.tsx:83`); "Pending confirmations" title, "You're all caught up" / "No confirmations waiting." empty state (`PendingConfirmationsSheet.tsx:95,99-103`).
- "Choose a number" / "Choose an email" + "Primary" marker (`EndpointSelector.tsx:27,63`).
- "Reach out" profile entry (`ContactProfileScreen.tsx:852`); Settings "Interaction Assist" label + exact helper (`SettingsScreen.tsx:1322,1336`).
No generic labels, no delivery-verification wording ("Yes" attestation preserved). Nothing to fix.

### Pillar 2: Visuals (4/4)
- Primary emphasis correct: filled-accent primary route (`ReachOutRouter.tsx:78`), accent-filled primary endpoint (`EndpointSelector.tsx:41`), filled "Yes" (`AssistConfirmation.tsx:35`) — confirmed in R01 (Call filled, Text/Email outlined) and R02 (primary number filled).
- Every control carries `accessibilityRole` + `accessibilityLabel`; the review-sheet title is `accessibilityRole="header"`.
- Minor: banner/header overlap (see Fix 3). No focal-point or icon-label gaps (text-label idiom, no icon dependency added — matches spec).

### Pillar 3: Color (3→4/4, no violations)
- All colours resolve through `useTheme().colors.*`; grep of the six surfaces found **zero** hex/rgb literals. `check:colors` idiom upheld.
- Accent reserved exactly as contracted: primary route/endpoint fills, "Yes", the "N more pending" link, the "Add a note" disclosure, and the Settings `Switch` track-on (`trackColor.true: accent`, `thumbColor: surfaceElevated`, `SettingsScreen.tsx:1331-1332`).
- Neutral outlines on "No answer" / "Don't log" use `border` + `textSecondary` — NOT danger, NOT accent (`AssistConfirmation.tsx:50-56,66-72`), matching the explicit "NOT danger" rule.
- Scrims are `background` @ 0.85 opacity (`ReachOutRouter.tsx:156`, `PendingConfirmationsSheet.tsx:138`).
- Light theme falls back to dark (dark-only milestone) — no separate light path to audit. Theme-switch completeness holds because nothing is hardcoded.

### Pillar 4: Typography (3/4)
- Deviation: banner and sheet question at 16/700 vs spec Body 15/400 (Fix 1).
- Dead type styles on the pending-count View (Fix 2) — renders at RN default rather than the Meta/Body role.
- Everything else conforms: route/confirmation buttons 16/700 (Action role), endpoint label 15/lineHeight21 (Body), "Primary" 13/600 (Meta), selector heading 24/700 (Title), sheet title 20/700. Weight set stays within the sanctioned 400/600/700.

### Pillar 5: Spacing (4/4)
- Banner `padding:12`, `gap:8`; panel `gap:10`; sheet `padding:16`, `gap:12`; modal inset `paddingHorizontal:24`; radii 8 (buttons/inputs) and 12 (banner/sheet) — all within the declared idiom incl. the accepted 10px exception.
- **Touch targets:** `minHeight:44` (+`minWidth:44` on buttons) on route buttons, endpoint rows, confirmation buttons, note toggle, cancel, and the pending-count pressable. Mandatory 44px rule satisfied everywhere.
- No arbitrary/`[px]` values; note input `minHeight:88` is a deliberate multiline field.

### Pillar 6: Experience Design (4/4)
- **Empty:** review sheet renders "You're all caught up" when `queue.length === 0`; Reach out entry hides entirely when `routes.hidden` / `!reachRoutes.hidden` gate (`ReachOutRouter.tsx:32`, `ContactProfileScreen.tsx:840`) — no dead entry point (Cluster A).
- **Error:** failed handoffs surface via native `Alert` in the handoff service (out of these six files); the assist is marked failed and never becomes a prompt.
- **Overflow:** newest assist + "{N} more pending" → review sheet with capped scrolling `ScrollView` (`maxHeight:"80%"`).
- **Non-modal / Back:** banner root is `pointerEvents="box-none"` with no `Modal` and no `onRequestClose` — Android Back passes through (Cluster H). Confirmed the banner clears only on resolve/dismiss/refresh.
- **Optional note:** empty note confirms normally (`note.trim() || undefined`, `AssistConfirmation.tsx:23`).
- **No destructive confirm:** toggle-OFF is a plain `Switch` with no dialog (Cluster G); "Don't log" writes nothing — matches "Destructive confirmation: None".
- **Animation rule:** transient state via `useState`/`Modal animationType="fade"` only; no per-frame React-driven animation. Compliant with CLAUDE.md.
- **Loading:** N/A (synchronous SQLite reads) — correctly no skeleton.

---

## Long-Text Backstop (held-out check)
- **R20 long name:** banner question is `numberOfLines={1}` (`AssistBanner.tsx:70`) — truncates cleanly; no clipping of action buttons. PASS.
- **R20 long note:** the optional-note `TextInput` is `multiline` with `minHeight:88` and wraps the full deliberately-long string without clipping. PASS.
- Endpoint labels are `numberOfLines={1}` (`EndpointSelector.tsx:47`) with "Primary" on its own line. PASS.

Backstop resolved — no truncation/clipping regressions.

---

## Registry Safety
Not applicable — `components.json` absent; RN core primitives only, no third-party registry. No audit performed.

---

## Files Audited
- `src/components/AssistBanner.tsx`
- `src/components/AssistConfirmation.tsx`
- `src/components/ReachOutRouter.tsx`
- `src/components/EndpointSelector.tsx`
- `src/components/PendingConfirmationsSheet.tsx`
- `src/screens/SettingsScreen.tsx` (Interaction Assist section, ~1307-1339)
- `src/screens/ContactProfileScreen.tsx` (Reach out entry ~840-855, router mount ~1332-1338)
- Device UAT screenshots: R01, R02, R06, R20 (banner-longname, long-note)
