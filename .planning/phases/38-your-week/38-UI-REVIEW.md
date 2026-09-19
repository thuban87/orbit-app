# Phase 38 — UI Review

**Audited:** 2026-09-19  
**Baseline:** approved `38-UI-SPEC.md`  
**Screenshots:** captured previously on the physical Pixel 6 Pro; reviewed from `evidence/38-07/`. No new browser screenshots were captured because the service on localhost:3000 is an unrelated Job Hunt HQ application, not Orbit.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Core headings and calm empty/error language match the contract, but the Overlooked overflow action does not use the prescribed count-bearing copy. |
| 2. Visuals | 3/4 | The Digest has a clear hierarchy and consistent shell, but the heatmap is seven unlabeled squares and its selected treatment is visually subtle. |
| 3. Color | 3/4 | All Phase 38 colors are theme-resolved and the shared heatmap ramp is reused, but drill-through text uses the fill token `accent` instead of the text-safe `accentText`. |
| 4. Typography | 2/4 | Semantic roles dominate, but the large-font Pixel capture visibly clips the `Interactions` metric and the shared segmented control bypasses `AppText`. |
| 5. Spacing | 2/4 | Token spacing is consistent at normal size, but fixed seven-cell and three-tile rows do not adapt to compact widths or large text. |
| 6. Experience Design | 2/4 | Navigation and state coverage are strong, but day-detail loading reports false emptiness and compact-width overflow can make the final heatmap day hard or impossible to tap. |

**Overall: 15/24**

No pillar scored 1 and no observed mandatory Pixel flow failed, so this audit identifies no release blocker on the tested device. Every item below is a **WARNING** requiring follow-up; the compact-width and large-text findings should be treated as accessibility readiness issues, not cosmetic polish.

---

## Top 3 Priority Fixes

1. **Make Your Week responsive at compact widths and large text** — the seven-cell row mathematically needs 364dp including screen padding, while the three metric tiles visibly split `Interactions` mid-word at 1.5× font scale — introduce a width-aware heatmap layout/scroller and let metric tiles wrap or stack at constrained width/font scale.
2. **Give selected-day detail explicit loading and error states** — populated dates currently flash `No activity on this date.` and failed reads leave that false message indefinitely — model `idle | loading | loaded | error`, preserving the existing stale-result guard.
3. **Correct the small contract deviations in affordance styling and copy** — render drill links with `colors.accentText`, emit `+{n} more →` for Overlooked, and route segmented labels through the semantic typography primitive.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- **PASS:** `Digest`, `Up Next`, `Horizon`, `Your Week`, the three metric captions, both period labels, and the prescribed calm empty/error states appear verbatim in `DigestScreen.tsx:179-189`, `UpNextSection.tsx:34-42`, `HorizonSection.tsx:60-68`, and `YourWeekSection.tsx:191-219`.
- **PASS:** Birthday labels are exposed as `Today`, `Tomorrow`, or locally derived dates by the composition layer, and visible birthday rows pair the person's name with the temporal tag (`HorizonSection.tsx:72-95`).
- **WARNING:** The approved overflow contract is `+{n} more →`, but Overlooked renders the non-counting `See everyone needing attention →` (`HorizonSection.tsx:113-118`). This obscures the amount of hidden content and differs from Never Contacted, which correctly uses the count at `HorizonSection.tsx:141-145`.
- **WARNING:** Day detail prints the database date string directly (`DigestDayDetail.tsx:35`) while the rest of the product contract emphasizes localized/user-facing dates. This is understandable but less polished than the birthday treatment; use a shared local display formatter without changing the queried date key.

### Pillar 2: Visuals (3/4)

- **PASS:** Pixel captures `14-digest-group-event.png`, `15-heatmap-group-event.png`, and `18-standard-digest.png` show a strong top-to-bottom hierarchy: screen title, three module headings, selected period, metrics, heatmap, then inline detail. The five equal tabs and ordinary centered Digest tab match the approved IA.
- **PASS:** The two theme packages preserve the same structure while applying their own surfaces/backgrounds. Metric cards, inline detail, tab selection, and FAB remain visually consistent with existing Orbit primitives.
- **WARNING:** The heatmap has no visible weekday/date labels—only seven color plates (`YourWeekHeatmap.tsx:42-95`). Accessibility labels identify dates, but sighted users must infer which square corresponds to which day. In `15-heatmap-group-event.png`, even the selected date is discoverable only after tapping and reading the panel below.
- **WARNING:** Selection is only a 1px-to-2px border change using `borderStrong` (`YourWeekHeatmap.tsx:73-79`). It is structural and therefore contract-compliant, but subtle in both reviewed themes; a clearer outline/inset or visible day label would materially improve scanability without introducing a second color language.

### Pillar 3: Color (3/4)

- **PASS:** No production Phase 38 UI file contains a hardcoded hex, RGB value, or named color. `DigestScreen`, all Digest components, the tab shell, and Settings resolve colors from `useTheme()`.
- **PASS:** The heatmap reuses `colors.heatmapScale` and `colors.heatmapCellEmpty` (`YourWeekHeatmap.tsx:43-62`); selected state uses border tokens rather than changing intensity alone (`YourWeekHeatmap.tsx:63-79`). Accent remains concentrated on the selected period, active tab, FAB, and drill affordance, matching the intended 60/30/10 distribution.
- **WARNING:** `DrillRow` applies `colors.accent` to text (`HorizonSection.tsx:219-230`). The theme contract defines `accent` as a filled background and `accentText` as the contrast-tested text/link tone. This happens to remain legible in the reviewed Galaxy capture, but it is semantically wrong and can lose contrast for other package/mode/accent combinations.
- **Registry audit:** Not applicable. `38-UI-SPEC.md` records `shadcn_initialized: false` and no third-party component registry.

### Pillar 4: Typography (2/4)

- **PASS:** Digest content uses the five semantic `AppText` roles and does not introduce raw sizes in its screen/components. Display, module heading, body, label, and caption hierarchy follows the approved four-size/two-weight system.
- **WARNING:** `19-large-font-standard.png` visibly splits and clips `Interactions` inside the fixed three-column metric row. The UI-tree presence check in UAT was insufficient to establish visual reflow: the screenshot itself shows `Interacti` / `ons` crowded against adjacent tiles. `YourWeekSection.tsx:200-204,255-263` always forces three equal-width siblings with no responsive alternative.
- **WARNING:** `SegmentedControl` uses React Native `Text`, raw `fontSize: 16`, raw `fontWeight: "600"`, and `numberOfLines={1}` (`SegmentedControl.tsx:95-105,129-132`) rather than `AppText role="label"`. Phase 38 reuses that component for both long period names, so its visible labels bypass the design system's declared font-family and role contract.
- **WARNING:** Fixed one-line period labels are likely to truncate before the rest of the screen at larger accessibility scales or narrower widths. The 1.5× Pixel capture still fits them, but it does not establish robust scaling beyond that single device/scale combination.

### Pillar 5: Spacing (2/4)

- **PASS:** The Digest screen and new components consistently use `SPACING.xs/sm/md/base/lg`; module gaps, row gaps, padding, and the 44dp touch floor align with the approved scale (`DigestScreen.tsx:238-243`, `UpNextSection.tsx:97-108`, `HorizonSection.tsx:235-247`, `DigestDayDetail.tsx:98-109`).
- **WARNING:** Seven 44dp cells plus six 4dp gaps consume 332dp (`YourWeekHeatmap.tsx:8-9,100-104`). Adding Digest's 16dp left/right padding raises the required screen width to 364dp (`DigestScreen.tsx:238-241`). There is no wrapping, scaling, or horizontal scrolling, so 360dp and 320dp layouts overflow and may clip the last target. This accurately preserves code-review warning WR-02.
- **WARNING:** The metric row also remains a rigid three-column flex layout (`YourWeekSection.tsx:255-263`). Its normal-size rhythm is clean in `14-digest-group-event.png` and `18-standard-digest.png`, but the large-font capture demonstrates that the layout budget does not expand with text.

### Pillar 6: Experience Design (2/4)

- **PASS:** The five-tab shell is complete and accessible, Digest is the fresh-launch root, all tabs retain independent stacks, active-tab reselection pops to root, and Profile Back preserves Contacts/Events/Digest/Orrery origin (`RootNavigator.tsx:193-258`; physical UAT items 1–4). The FAB and Settings Backup route remain available without a sixth tab.
- **PASS:** Major empty states remain visible, empty Horizon subgroups disappear, the root read has a calm error sentinel, future heatmap cells are inert, interactive rows expose button roles/labels, and the selected day exposes `accessibilityState.selected`.
- **WARNING:** Selecting a day sets `dayRows` to `[]` before the asynchronous read (`YourWeekSection.tsx:171-177`), while `DigestDayDetail` treats `[]` as a completed empty result (`DigestDayDetail.tsx:36-39`). Every populated date can briefly announce `No activity on this date.`; a read failure leaves it indefinitely because the catch only logs (`YourWeekSection.tsx:178-180`). This accurately preserves code-review warning WR-01.
- **WARNING:** The compact-width heatmap overflow is interaction-impacting, not merely visual: the last day's 44dp target can become partially or wholly unreachable. Add 320dp/360dp layout coverage, as recommended by WR-02.
- **WARNING:** Root Digest loading intentionally renders blank module bodies (`DigestScreen.tsx:183-198`), as approved by the UI contract, but Your Week separately renders zero-valued metric tiles while its data is unresolved (`YourWeekSection.tsx:185-204`). That mixed loading language can momentarily imply real zero activity; a neutral loading/skeleton treatment would make state semantics clearer.
- **Advisory outside the visible production UI:** code-review warning WR-03 remains accurate: repeated DEV-only notification probe scheduling can orphan UAT notifications. It does not affect production Digest UX or this pillar score, but should remain in backlog rather than being treated as resolved.

---

## Files Audited

- Contract and execution evidence: `HANDOFF.md`; `38-01` through `38-08` plans/summaries; `38-UI-SPEC.md`; `38-VALIDATION.md`; `38-REVIEW.md`; `38-VERIFICATION.md`; `evidence/38-07/UAT-RESULTS.md`; all Pixel screenshots and corresponding UI XML relevant to Digest, navigation, large text, notification routing, Events/Profile, and Never Contacted.
- Digest UI: `src/screens/DigestScreen.tsx`; all production files under `src/components/digest/`; `src/components/SegmentedControl.tsx`; `src/components/ui/AppText.tsx`; `src/components/ui/ChromeScrim.tsx`; `src/components/ContactCard.tsx`; `src/components/Avatar.tsx`.
- Shell/navigation: `src/navigation/RootNavigator.tsx`; `shell-contract.ts`; `types.ts`; `linking.ts`; `notification-gate.tsx`; `reset-intents.ts`; all five active stack files under `src/navigation/tabs/`; origin-aware Profile and Events detail implementations.
- Settings/theme: `src/screens/SettingsInteractionsScreen.tsx`; `settings-interactions-logic.ts`; theme provider/types/presets and spacing, typography, radii, icon-size, and surface tokens under `src/theme/`.
- Shared data/state behavior inspected to validate visible claims: `src/db/up-next-read.ts`; `digest-read.ts`; `dashboard-read.ts`; `your-week-read.ts`; `app-settings-dao.ts`; `src/logic/digest-composition.ts`; `src/services/history/week-window.ts`; `src/components/digest/your-week-section-logic.ts`.

