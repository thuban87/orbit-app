export type BackIntent = "dismiss-transient" | "default";

/**
 * Decides whether shell Back first dismisses a transient overlay. Ordinary Back
 * remains origin-aware by the focused tab's native stack; this resolver never
 * redirects users to Dashboard or otherwise replaces navigation's default Back.
 */
export function resolveBackIntent({
  anyTransientOpen,
}: {
  anyTransientOpen: boolean;
}): BackIntent {
  return anyTransientOpen ? "dismiss-transient" : "default";
}
