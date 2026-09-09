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
