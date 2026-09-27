/** Render-free Sheet variant contract, kept testable outside the RN runtime. */
export const SHEET_VARIANTS = ["compact", "detail", "expanded"] as const;

export type SheetVariant = (typeof SHEET_VARIANTS)[number];

export const SHEET_HEIGHT_PERCENT: Readonly<Record<SheetVariant, string>> =
  Object.freeze({
    compact: "40%",
    detail: "60%",
    // Focused workflows need room for a scrollable editor plus reachable actions.
    expanded: "92%",
  });

/**
 * Compact and detail sheets size to their content; expanded workflows reserve
 * the remaining shell height for a scrollable workspace and fixed actions.
 */
export const SHEET_BODY_FLEX: Readonly<Record<SheetVariant, number>> =
  Object.freeze({ compact: 0, detail: 0, expanded: 1 });

/**
 * Whether a variant's body scrolls inside the sheet (38.4 D-32, the Plan 11
 * device finding next to RG-034 `ui-accessibility/AUD-UIA-011`). Compact and
 * detail sheets cap their height with a percent `maxHeight`; at large system
 * text (font_scale 2.0 on a ≈320dp phone) InteractionDetail's Edit/Delete row
 * was clipped below that cap and unreachable. Their body is therefore a bounded
 * ScrollView that stays content-sized until it hits the cap. Expanded sheets
 * keep a fixed height and a `flex: 1` workspace whose scroll the consumer owns.
 */
export const SHEET_BODY_SCROLLS: Readonly<Record<SheetVariant, boolean>> =
  Object.freeze({ compact: true, detail: true, expanded: false });
