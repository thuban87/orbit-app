/**
 * ThemePreviewScreen (DEV-ONLY) — the in-scope mount point for Plan 23-06's
 * device-UATs (REVIEWS 23-06 cycle-5 MEDIUM).
 *
 * App-wide `BackgroundHost` mounting is deferred to Phase 15/37, so without this
 * harness the plan's on-device human-checks would have nowhere to run in-phase. It
 * mounts `BackgroundHost` with a long `ScrollView` of representative body + caption
 * text sitting on `GlassSurface`, plus dev controls to cycle package (galaxy |
 * standard), appearance mode (light | dark), and every background slot (incl.
 * None/Solid), toggle blur affordability, cycle density, and force the
 * `BackgroundHost` `onError` fallback. This exercises, on the Pixel:
 *   - fixed-behind-scroll (background stays put while the text scrolls),
 *   - density-opacity (denser scrim on the dense setting),
 *   - glass (Galaxy) vs flat (Standard) surfaces,
 *   - onError -> None/Solid fallback,
 *   - blur-unavailable -> tinted-token fallback,
 *   - per-asset brightest-region AA (body + caption over glass on each Galaxy asset).
 *
 * DEV-ONLY: this ships no production mount and adds no user-facing navigation (it is
 * NOT registered in the RootNavigator — the device-UAT wires a temporary dev route).
 * It does not reverse the deferred-adoption scope boundary. All colour resolves
 * through theme tokens; no network path.
 */
// biome-ignore-all lint/a11y/useValidAriaRole: AppText's `role` is a semantic
// typography role (display|heading|body|label|caption), NOT an ARIA role — the
// a11y lint false-fires on the prop name. Dev-only harness.
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { BackgroundHost } from "@/components/ui/BackgroundHost";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { useThemeStore } from "@/stores/theme-store";
import { useTheme } from "@/theme";
import { BACKGROUND_ORDER } from "@/theme/backgrounds";
import type { ThemeMode, ThemePackage } from "@/theme/theme-types";
import { SURFACE_DENSITIES, type SurfaceDensity } from "@/theme/tokens/surface";

/** A dev control button — token-styled, no colour literal. */
function DevButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, { borderColor: colors.borderStrong }]}
      accessibilityRole="button"
    >
      <AppText role="label" style={{ color: colors.accentText }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
const MODES: ThemeMode[] = ["light", "dark", "system"];

// A block of filler copy so the fixed background is visibly fixed while scrolling.
const PARAGRAPH =
  "The quick brown fox jumps over the lazy dog. Readability wins: body and caption text on a glass surface must stay legible over the brightest region of every background asset.";

export default function ThemePreviewScreen() {
  const { colors, mode, package: themePackage } = useTheme();
  const setPackage = useThemeStore((s) => s.setPackage);
  const setModeForActivePackage = useThemeStore(
    (s) => s.setModeForActivePackage,
  );

  const order = BACKGROUND_ORDER[themePackage];
  const [slotIndex, setSlotIndex] = useState(0);
  const [density, setDensity] = useState<SurfaceDensity>("presentation");
  const [blurAvailable, setBlurAvailable] = useState(true);
  const [forceError, setForceError] = useState(false);

  const slotId = order[slotIndex % order.length];

  const cyclePackage = () => {
    const next =
      PACKAGES[(PACKAGES.indexOf(themePackage) + 1) % PACKAGES.length];
    setPackage(next);
    setSlotIndex(0);
  };
  const cycleMode = () => {
    const next = MODES[(MODES.indexOf(mode as ThemeMode) + 1) % MODES.length];
    setModeForActivePackage(next);
  };
  const cycleSlot = () => setSlotIndex((i) => (i + 1) % order.length);
  const cycleDensity = () =>
    setDensity(
      (d) =>
        SURFACE_DENSITIES[
          (SURFACE_DENSITIES.indexOf(d) + 1) % SURFACE_DENSITIES.length
        ],
    );

  return (
    <BackgroundHost
      density={density}
      slotId={slotId}
      forceRenderError={forceError}
    >
      <View style={styles.controls}>
        <DevButton label={`pkg: ${themePackage}`} onPress={cyclePackage} />
        <DevButton label={`mode: ${mode}`} onPress={cycleMode} />
        <DevButton label={`bg: ${slotId}`} onPress={cycleSlot} />
        <DevButton label={`density: ${density}`} onPress={cycleDensity} />
        <DevButton
          label={`blur: ${blurAvailable ? "on" : "off"}`}
          onPress={() => setBlurAvailable((b) => !b)}
        />
        <DevButton
          label={`onError: ${forceError ? "on" : "off"}`}
          onPress={() => setForceError((e) => !e)}
        />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {Array.from({ length: 8 }).map((_, i) => (
          <GlassSurface
            // biome-ignore lint/suspicious/noArrayIndexKey: static dev filler cards
            key={`card-${i}`}
            blurAvailable={blurAvailable}
            density={density}
            style={styles.card}
          >
            <AppText role="heading" style={{ color: colors.textPrimary }}>
              Card {i + 1}
            </AppText>
            <AppText role="body" style={{ color: colors.textPrimary }}>
              {PARAGRAPH}
            </AppText>
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              Caption over glass — {themePackage}/{mode}, bg {slotId}.
            </AppText>
          </GlassSurface>
        ))}
      </ScrollView>
    </BackgroundHost>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
  },
  button: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scroll: {
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 16,
    gap: 8,
  },
});
