/**
 * Avatar (PHOTO-04) — the ONE reusable avatar for the profile now and the
 * grid/orrery/widget later. Two states:
 *
 *   - HAS-PHOTO: renders the stored RELATIVE path resolved to a local `file://`
 *     master via `usePhotoDisplay` (never a network URL — reads stay local),
 *     cover-fit and circular. On a load error it degrades to the initials state.
 *   - NO-PHOTO / onError: a themed swatch (`colors.avatarSwatches[…]`) + centred
 *     initials (`colors.avatarSwatchText`). An empty name → the neutral swatch
 *     (index 0) with NO glyph.
 *
 * Cache correctness (38.6 D-01/D-19/D-21): the filename is identity-derived and
 * STABLE per target, so a replace overwrites the SAME file. On Android expo-image
 * turns a `file://` source into a raw Glide model and IGNORES `cacheKey`, so the
 * in-process display revision (bumped by the ownership layer's
 * `notifyPhotoBytesChanged`) travels in the URI as `?v=<revision>` — or, under the
 * `no-cache` fallback strategy, caching is off entirely. The image cache is
 * in-memory only, so a restart starts clean. `usePhotoDisplay` supplies the
 * source, cache policy and revision; `recyclingKey` folds the revision so a
 * recycled view blanks before reloading.
 *
 * All colours resolve through `useTheme().colors.*` — no hex/hsl (check:colors).
 */
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getInitials, swatchIndex } from "@/components/avatar-initials";
import { usePhotoDisplay } from "@/components/photo-display";
import { isUnusablePhotoReference } from "@/db/photo-relative-path";
import { useTheme } from "@/theme";

interface AvatarProps {
  /** The stored RELATIVE photo path (`avatars/…`), or null for the initials state. */
  photo: string | null;
  /** Contact/profile display name — source of the initials and swatch hash. */
  name: string;
  /** Stable identity for expo-image's recyclingKey (contact id / "profile"). */
  contactId?: number | string;
  /** Rendered diameter; the circle is `borderRadius: size / 2`. */
  size: number;
  /**
   * Told whether the photo currently fails to load (true after `onError`, false
   * again once a new photo or revision retries it). Lets a parent drop a
   * photo-only affordance — e.g. the Profile lightbox entry (38.6 review WR-06)
   * — while the initials are showing. A value that is not a stored photo path
   * (38.6 D-34: text in a photo field) reports true: it never loads.
   */
  onLoadErrorChange?: (errored: boolean) => void;
}

export function Avatar({
  photo,
  name,
  contactId,
  size,
  onLoadErrorChange,
}: AvatarProps) {
  const { colors } = useTheme();
  // Display source for THIS canonical photo: the per-write revision rides in the
  // URI (or a cacheKey bump with caching off), with an in-memory-only cache.
  const display = usePhotoDisplay(photo);
  const [errored, setErrored] = useState(false);

  // A fresh photo/write must clear a prior load error so the image is retried
  // (e.g. a replace at the same path after an earlier onError fallback).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset keyed on identity+revision
  useEffect(() => {
    setErrored(false);
  }, [photo, display?.revision]);

  // Report the load state; a ref keeps an inline parent callback from re-firing.
  // D-34: a non-path value (text) never reaches a resolver (`display` is null)
  // and is reported as a failure, so the parent says "Photo unavailable".
  const failed = errored || isUnusablePhotoReference(photo);
  const onLoadErrorChangeRef = useRef(onLoadErrorChange);
  onLoadErrorChangeRef.current = onLoadErrorChange;
  useEffect(() => {
    onLoadErrorChangeRef.current?.(failed);
  }, [failed]);

  if (display && !errored) {
    return (
      <Image
        testID="avatar-photo"
        accessibilityLabel={name ? `Photo of ${name}` : "Contact photo"}
        source={display.source}
        contentFit="cover"
        cachePolicy={display.cachePolicy}
        recyclingKey={`${contactId}#${display.revision}`}
        onError={() => setErrored(true)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  const initials = getInitials(name);
  const index = swatchIndex(name, colors.avatarSwatches.length);

  return (
    <View
      testID="avatar-initials"
      accessibilityLabel={name ? `${name} avatar` : "Contact avatar"}
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.avatarSwatches[index],
        },
      ]}
    >
      {initials ? (
        <Text
          style={{
            color: colors.avatarSwatchText,
            fontSize: size * 0.4,
            fontWeight: "700",
          }}
        >
          {initials}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
