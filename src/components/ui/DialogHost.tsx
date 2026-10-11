/**
 * DialogHost (38.9 D-24) — mounted ONCE in App.tsx (inside NavigationContainer,
 * after the root Snackbar). Renders the head of the imperative confirm/notice
 * queue (`confirm-store.ts`) through the shared `ConfirmDialog`, whose
 * BaseOverlay window registers as a "dialog" in the open-overlay registry.
 *
 * `key={current.id}` is required (RESEARCH Pitfall 2): `ConfirmActions`
 * decides row vs stacked once per mount, so each queued request must mount a
 * fresh dialog to re-measure its own labels.
 *
 * Every resolution is bound to the request's id, so a stale double-tap on a
 * dialog that has just closed can never resolve the request queued behind it.
 * Back/scrim go through `dismissCurrent`, which is a no-op for a destructive or
 * `dismissable: false` confirm (D-06, ADR-086).
 */
import { confirmStore } from "@/stores/confirm-store";
import { ConfirmDialog } from "./ConfirmDialog";

export function DialogHost() {
  const current = confirmStore((state) => state.queue[0]);
  const resolveCurrent = confirmStore((state) => state.resolveCurrent);
  const dismissCurrent = confirmStore((state) => state.dismissCurrent);

  if (!current) return null;

  const { id } = current;
  if (current.kind === "notice") {
    const { title, message, acknowledgeLabel = "OK" } = current.request;
    return (
      <ConfirmDialog
        key={id}
        visible
        variant="notice"
        title={title}
        message={message}
        confirmLabel={acknowledgeLabel}
        onConfirm={() => resolveCurrent(true, id)}
        onRequestClose={() => dismissCurrent(id)}
      />
    );
  }

  const {
    title,
    message,
    confirmLabel,
    cancelLabel,
    destructive,
    dismissable,
    headingGlyph,
  } = current.request;
  return (
    <ConfirmDialog
      key={id}
      visible
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      destructive={destructive}
      dismissable={dismissable}
      headingGlyph={headingGlyph}
      onConfirm={() => resolveCurrent(true, id)}
      onCancel={() => resolveCurrent(false, id)}
      onRequestClose={() => dismissCurrent(id)}
    />
  );
}
