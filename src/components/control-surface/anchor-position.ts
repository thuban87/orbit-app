export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanelDimensions {
  width: number;
  height: number;
}

export interface ViewportDimensions {
  width: number;
  height: number;
}

/** Positions a panel directly below its trigger without crossing screen gutters. */
export function clampAnchorPosition(
  anchorRect: AnchorRect,
  panelSize: PanelDimensions,
  viewport: ViewportDimensions,
  gutter: number,
): { top: number; left: number; width: number } {
  const width = Math.min(panelSize.width, viewport.width - 2 * gutter);
  const minimumLeft = gutter;
  const maximumLeft = viewport.width - width - gutter;

  return {
    top: anchorRect.y + anchorRect.height,
    left: Math.max(minimumLeft, Math.min(anchorRect.x, maximumLeft)),
    width,
  };
}
