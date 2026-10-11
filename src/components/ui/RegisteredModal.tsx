/**
 * RegisteredModal (38.9 D-24, D-40, D-51) — the ONLY component in the app that
 * renders React Native's `Modal` (`registered-modal-contract.test.ts`).
 *
 * An RN `Modal` on Android is a separate native window drawn above the app
 * window, so anything the app window renders (the root Snackbar) sits under it.
 * This wrapper takes the same props as RN `Modal` (spread through unchanged)
 * and adds two things:
 *
 *   1. While `visible`, it registers its window in the open-overlay registry
 *      (`overlay-registry-store.ts`) and unregisters on hide/unmount. The
 *      registry holds no close callback, so nothing outside the window can
 *      close it through the registry (D-24, ADR-086).
 *   2. It renders an in-window snackbar host, `<Snackbar host={id} />`, as the
 *      last child, so a snackbar fired while this window is on top renders
 *      inside it (D-40), just above the system navigation bar (D-51).
 *
 * Host placement mechanism (render prop). By default the host is appended
 * after `children`. A caller that must place the host deeper in its own tree
 * (BaseOverlay places it inside its `GestureHandlerRootView`, as the last child
 * of the root View) passes `renderSnackbarHost={false}` and a FUNCTION child:
 * `{(hostId) => …<Snackbar host={hostId} />…}`. The function receives this
 * window's registry id, which is the host id the Snackbar must use.
 *
 * Every Modal window is edge-to-edge on this RN build; nothing here changes the
 * window's own layout or props.
 */
import { type ReactNode, useEffect, useId } from "react";
import { Modal, type ModalProps } from "react-native";
import { Snackbar } from "@/components/Snackbar";
import {
  type OverlayKind,
  registerOverlay,
  unregisterOverlay,
} from "@/stores/overlay-registry-store";

export interface RegisteredModalProps extends Omit<ModalProps, "children"> {
  /** Registry kind; plain RN Modal sites default to "modal". */
  overlayKind?: OverlayKind;
  /**
   * Append `<Snackbar host={id} />` after the children (default true). Pass
   * false only when a function child places the host itself.
   */
  renderSnackbarHost?: boolean;
  /** Content, or a render prop receiving this window's snackbar host id. */
  children?: ReactNode | ((hostId: string) => ReactNode);
}

export function RegisteredModal({
  overlayKind = "modal",
  renderSnackbarHost = true,
  children,
  ...modalProps
}: RegisteredModalProps) {
  const id = useId();
  const visible = modalProps.visible ?? true;

  useEffect(() => {
    if (!visible) return;
    registerOverlay(id, overlayKind);
    return () => unregisterOverlay(id);
  }, [id, overlayKind, visible]);

  return (
    <Modal {...modalProps}>
      {typeof children === "function" ? children(id) : children}
      {renderSnackbarHost ? <Snackbar host={id} /> : null}
    </Modal>
  );
}
