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
 * A `choose()` entry (38.11 D-73) renders the same dialog with its third,
 * secondary choice; each button resolves its own choice through
 * `chooseCurrent`, and Back/scrim resolve "cancel" when dismissable.
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
  const chooseCurrent = confirmStore((state) => state.chooseCurrent);
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

  if (current.kind === "choice") {
    const {
      title,
      message,
      confirmLabel,
      secondaryLabel,
      secondaryDestructive,
      cancelLabel,
      dismissable,
    } = current.request;
    return (
      <ConfirmDialog
        key={id}
        visible
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        secondaryLabel={secondaryLabel}
        secondaryDestructive={secondaryDestructive}
        cancelLabel={cancelLabel}
        dismissable={dismissable}
        onConfirm={() => chooseCurrent("confirm", id)}
        onSecondary={() => chooseCurrent("secondary", id)}
        onCancel={() => chooseCurrent("cancel", id)}
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
