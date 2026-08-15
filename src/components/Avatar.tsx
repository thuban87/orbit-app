/**
 * Avatar (PHOTO-04) — the ONE reusable avatar for the profile now and the
 * grid/orrery/widget later. Two states:
 *
 *   - HAS-PHOTO: renders the stored RELATIVE path resolved to a local `file://`
 *     master via `resolvePhotoUri` (never a network URL — reads stay local),
 *     cover-fit and circular. On a load error it degrades to the initials state.
 *   - NO-PHOTO / onError: a themed swatch (`colors.avatarSwatches[…]`) + centred
 *     initials (`colors.avatarSwatchText`). An empty name → the neutral swatch
 *     (index 0) with NO glyph.
 *
 * Cache correctness (review [claude/MED stale cache] + [cycle-2 MED sub-second]):
 * the derivable filename is STABLE per target, so a replace yields the SAME
 * `file://` URI and `cachePolicy="memory-disk"` would serve the cached DECODE.
 * The `cacheKey` (primary storage discriminator) and `recyclingKey` (blanks a
 * recycled view before reload) therefore fold BOTH the `cacheBust` prop (the
 * contact/profile `modified_at`, for the cross-session case) AND the per-write
 * revision from `photo-cache-bust-store` (closing the same-second `modified_at`
 * collision). Both together guarantee a fresh key — and a fresh decode — on every
 * write.
 *
 * All colours resolve through `useTheme().colors.*` — no hex/hsl (check:colors).
 */
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getInitials, swatchIndex } from "@/components/avatar-initials";
import { resolvePhotoUri } from "@/services/photos/photo-storage";
import { usePhotoCacheBust } from "@/stores/photo-cache-bust-store";
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
  /** Cross-session cache discriminator (the contact/profile `modified_at`). */
  cacheBust?: string | number;
}

export function Avatar({
  photo,
  name,
  contactId,
  size,
  cacheBust,
}: AvatarProps) {
  const { colors } = useTheme();
  // Per-write revision for THIS photo path (closes the sub-second modified_at hole).
  const rev = usePhotoCacheBust(photo);
  const [errored, setErrored] = useState(false);

  // A fresh photo/write must clear a prior load error so the image is retried
  // (e.g. a replace at the same path after an earlier onError fallback).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset keyed on identity+bust
  useEffect(() => {
    setErrored(false);
  }, [photo, cacheBust, rev]);

  const bust = [cacheBust, rev].filter((v) => v != null).join("#");
  const showPhoto = photo != null && !errored;

  if (showPhoto) {
    return (
      <Image
        testID="avatar-photo"
        accessibilityLabel={name ? `Photo of ${name}` : "Contact photo"}
        source={{
          uri: resolvePhotoUri(photo),
          cacheKey: bust ? `${photo}#${bust}` : photo,
        }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={bust ? `${contactId}#${bust}` : String(contactId)}
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
