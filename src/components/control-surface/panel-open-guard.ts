/**
 * D-50 (38.4 IN-02): a Population, Filters or Sort panel never opens on a
 * Contacts screen that lost focus between the trigger tap and the async
 * `measureInWindow` callback. The blur already closed any open panel (38.11
 * D-62, `closeDashboardPanelOnBlur`); this guard stops a late open from
 * re-presenting one on the hidden screen. React-free so it is node-testable.
 */
export function openIfStillFocused(
  isFocused: () => boolean,
  open: () => void,
): void {
  if (isFocused()) open();
}
