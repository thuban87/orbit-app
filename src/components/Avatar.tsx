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
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getInitials, swatchIndex } from "@/components/avatar-initials";
import { usePhotoDisplay } from "@/components/photo-display";
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
  /** Unused since 38.6-01 (the display revision replaced it); 38.6-03 removes it with every consumer. */
  cacheBust?: string | number;
}

export function Avatar({ photo, name, contactId, size }: AvatarProps) {
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
