/**
 * ORRERY LAB A — ARCH PERF PASS: photo loading + SkImage custody for the
 * imperative scene renderer.
 *
 * Photos still load through `useOrreryPhoto` (D-11/D-41: 512 cap, on-disk
 * derivative, cancellation, no SkImage cache), one `LabPhotoSlot` per body,
 * rendered OUTSIDE the Skia Canvas (a photo resolving never touches the
 * Canvas tree). The renderer draws from a UI-thread copy of its specs, so an
 * image may be disposed only once the UI thread has received specs that no
 * longer reference it. Custody rule:
 *   1. a slot hands every retired image to `retire` (never disposes it);
 *   2. after each commit, the custodian disposes every retired image that
 *      the specs written in that render no longer reference — ON the UI
 *      runtime, scheduled after that spec write (the worklets UI queue is
 *      FIFO, and JS-side shared-value writes travel the same queue);
 *   3. on unmount, the canvas is gone; remaining images are disposed after a
 *      grace period that outlives the renderer's last mapper run.
 * A recorded SkPicture keeps its own reference to an image, so replaying an
 * already-recorded picture after the dispose is safe. As a last guard the
 * renderer skips (never crashes on) a disposed image.
 */
import type { SkImage } from "@shopify/react-native-skia";
import { useCallback, useEffect, useRef, useState } from "react";
import { runOnUI } from "react-native-reanimated";
import { Logger } from "@/utils/logger";
import { useOrreryPhoto } from "../use-orrery-photo";
import type { LabPhoto } from "./scene-specs";

/** Grace period before disposing images held when the renderer unmounts. */
const UNMOUNT_DISPOSE_DELAY_MS = 1500;

function disposeOnUI(images: SkImage[]): void {
  if (images.length === 0) return;
  runOnUI((list: SkImage[]) => {
    "worklet";
    for (let i = 0; i < list.length; i++) {
      try {
        list[i].dispose();
      } catch {
        // already disposed
      }
    }
  })(images);
}

export interface LabPhotoCustody {
  photos: Readonly<Record<string, LabPhoto>>;
  report: (key: string, image: SkImage | null) => void;
  retire: (image: SkImage) => void;
  /** Call in an effect after the render that wrote specs referencing `inUse`. */
  settle: (inUse: ReadonlySet<SkImage>) => void;
}

export function useLabPhotoCustody(): LabPhotoCustody {
  const [photos, setPhotos] = useState<Record<string, LabPhoto>>(() => ({}));
  const pending = useRef(new Set<SkImage>());
  const unmounted = useRef(false);
  const report = useCallback((key: string, image: SkImage | null) => {
    setPhotos((prev) => {
      const current = prev[key];
      if ((current?.image ?? null) === image) return prev;
      const next = { ...prev };
      if (image) next[key] = { image, at: Date.now() };
      else delete next[key];
      return next;
    });
  }, []);
  const retire = useCallback((image: SkImage) => {
    if (unmounted.current) {
      setTimeout(() => disposeOnUI([image]), UNMOUNT_DISPOSE_DELAY_MS);
      return;
    }
    pending.current.add(image);
  }, []);
  const settle = useCallback((inUse: ReadonlySet<SkImage>) => {
    const free: SkImage[] = [];
    for (const image of pending.current)
      if (!inUse.has(image)) {
        free.push(image);
        pending.current.delete(image);
      }
    disposeOnUI(free);
  }, []);
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      const rest = [...pending.current];
      pending.current.clear();
      if (rest.length)
        setTimeout(() => disposeOnUI(rest), UNMOUNT_DISPOSE_DELAY_MS);
    };
  }, []);
  return { photos, report, retire, settle };
}

/** Loads one body's photo (renders nothing). */
export function LabPhotoSlot({
  bodyKey,
  path,
  report,
  retire,
}: {
  bodyKey: string;
  path: string | null;
  report: (key: string, image: SkImage | null) => void;
  retire: (image: SkImage) => void;
}) {
  const image = useOrreryPhoto(path, retire);
  useEffect(() => {
    report(bodyKey, image);
  }, [bodyKey, image, report]);
  useEffect(
    () => () => {
      try {
        report(bodyKey, null);
      } catch (error) {
        Logger.warn("orrery-photo", "photo slot report failed", error);
      }
    },
    [bodyKey, report],
  );
  return null;
}
