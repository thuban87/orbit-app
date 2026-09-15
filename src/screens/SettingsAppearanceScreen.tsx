import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  type AppSettingsPatch,
  getAppSettings,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import type { RootStackParamList } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { useThemeStore } from "@/stores/theme-store";
import { useTheme } from "@/theme";
import { ACCENTS } from "@/theme/accents";
import {
  PACKAGE_DEFAULT_SLOT,
  resolveRenderableBackground,
} from "@/theme/backgrounds";
import {
  ACCENT_IDS,
  type AccentId,
  type BackgroundSlotId,
} from "@/theme/theme-option-ids";
import type {
  ThemeMode,
  ThemePackage,
  ThemePalette,
} from "@/theme/theme-types";
import { Logger } from "@/utils/logger";
import {
  backgroundChoicesForPackage,
  backgroundPatchForPackage,
} from "./settings-appearance-background";
import { persistAppearanceSetting } from "./settings-appearance-persist";

const LOG_SCOPE = "settings-appearance-screen";

interface SettingsAppearanceScreenProps {
  onBack: () => void;
}

const BACKGROUND_LABELS: Record<BackgroundSlotId, string> = {
  "galaxy-deep-space": "Deep Space",
  "galaxy-starfield": "Starfield",
  "galaxy-nebula": "Nebula",
  "galaxy-aurora": "Aurora",
  "standard-dawn": "Dawn",
  "standard-paper": "Paper",
  "standard-dusk": "Dusk",
  "standard-mesh": "Mesh",
  none: "None (Solid)",
};

type BackgroundThumbnailProps = {
  colors: ThemePalette;
  columnWidth: "23%" | "48%";
  label: string;
  onPress: (slot: BackgroundSlotId) => void;
  selected: boolean;
  slot: BackgroundSlotId;
  sourcePackage: ThemePackage;
};

function BackgroundThumbnail({
  colors,
  columnWidth,
  label,
  onPress,
  selected,
  slot,
  sourcePackage,
}: BackgroundThumbnailProps) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const resolved = resolveRenderableBackground(
    sourcePackage,
    slot,
    thumbFailed,
  );

  return (
    <Pressable
      testID={`settings-theme-background-${slot}`}
      accessibilityRole="button"
      accessibilityLabel={`${label} background`}
      accessibilityState={{ selected }}
      onPress={() => onPress(slot)}
      style={[
        styles.backgroundThumbnail,
        {
          flexBasis: columnWidth,
          backgroundColor: colors.surface,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.backgroundPreview,
          { backgroundColor: colors.background },
        ]}
      >
        {resolved.kind === "asset" ? (
          <Image
            source={resolved.source()}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setThumbFailed(true)}
          />
        ) : null}
      </View>
      <Text
        style={[styles.backgroundThumbnailLabel, { color: colors.textPrimary }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Appearance category screen (§D, D-09). Carries the Theme section migrated out
 * of the Settings monolith: theme package, appearance mode, curated accent, and
 * background. Each control reads the reactive `useThemeStore` selector and calls
 * the live store setter (instant restyle — the ThemeProvider re-renders from the
 * store), then persists the durable `app_settings` column through
 * `persistAppearanceSetting`.
 *
 * Failed-write honesty (review MEDIUM, cycle-3): unlike the monolith's `persist()`
 * — which fired the DAO write and only logged a caught error, leaving the Zustand
 * store diverged from SQLite — a failed durable write here re-reads the durable
 * settings, reconciles the live store back to them (via the store's `hydrate`),
 * and renders an inline, non-nagging save-error notice. The failure is never
 * swallowed and the store is never left diverged.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsAppearanceScreen({
  onBack,
}: SettingsAppearanceScreenProps) {
  const { colors, mode } = useTheme();
  const { fontScale } = useWindowDimensions();
  const bottomClearance = useBottomClearance();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Live theme selection from the store — the ThemeProvider re-renders from
  // these, so a change restyles the whole app instantly; persist() writes the
  // durable app_settings columns and reconciles the store on a failed write.
  const themePackage = useThemeStore((s) => s.package);
  const galaxyMode = useThemeStore((s) => s.galaxyMode);
  const standardMode = useThemeStore((s) => s.standardMode);
  const galaxyAccent = useThemeStore((s) => s.galaxyAccent);
  const standardAccent = useThemeStore((s) => s.standardAccent);
  const galaxyBackground = useThemeStore((s) => s.galaxyBackground);
  const standardBackground = useThemeStore((s) => s.standardBackground);
  const setThemePackage = useThemeStore((s) => s.setPackage);
  const setModeForActivePackage = useThemeStore(
    (s) => s.setModeForActivePackage,
  );
  const setAccentForActivePackage = useThemeStore(
    (s) => s.setAccentForActivePackage,
  );
  const setBackgroundForActivePackage = useThemeStore(
    (s) => s.setBackgroundForActivePackage,
  );

  const [saveError, setSaveError] = useState<string | null>(null);

  const activeBackground =
    themePackage === "galaxy" ? galaxyBackground : standardBackground;
  const selectedBackgroundSlot =
    activeBackground ?? PACKAGE_DEFAULT_SLOT[themePackage];
  const backgroundColumnWidth = fontScale >= 1.3 ? "48%" : "23%";

  // Persist an appearance patch to app_settings, reconciling the live store on a
  // failed durable write (review MEDIUM, cycle-3). The store setter has already
  // fired (instant restyle); this only makes a failed durable write observable
  // AND reconciled. Never inline SQL — every write routes through the DAO.
  const persist = useCallback(async (patch: AppSettingsPatch) => {
    const result = await persistAppearanceSetting(getExecutor(), patch, {
      updateAppSettings,
      getAppSettings,
      hydrateThemeStore: (selection) =>
        useThemeStore.getState().hydrate(selection),
      now: localDateTime,
    });
    if (!result.ok) {
      Logger.error(
        LOG_SCOPE,
        "failed to persist appearance setting",
        result.error,
      );
      setSaveError(
        "Couldn't save that change. Your last saved appearance was restored.",
      );
    } else {
      setSaveError(null);
    }
  }, []);

  const onSelectBackground = useCallback(
    (slot: BackgroundSlotId) => {
      setBackgroundForActivePackage(slot);
      void persist(backgroundPatchForPackage(themePackage, slot));
    },
    [persist, setBackgroundForActivePackage, themePackage],
  );

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Appearance" />
      <ScrollView
        testID="settings-appearance-screen"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.backLink}
        >
          <Text style={[styles.backLinkLabel, { color: colors.accent }]}>
            Back
          </Text>
        </Pressable>

        {saveError !== null ? (
          <View
            testID="settings-appearance-save-error"
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.danger },
            ]}
          >
            <Text style={[styles.helper, { color: colors.danger }]}>
              {saveError}
            </Text>
          </View>
        ) : null}

        {__DEV__ ? (
          <Pressable
            testID="settings-dev-theme-preview-row"
            accessibilityRole="button"
            accessibilityLabel="Open background failure test harness"
            onPress={() => navigation.navigate("__ThemePreview")}
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Background failure test harness
            </Text>
          </Pressable>
        ) : null}

        <View testID="settings-appearance-section" style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Theme
          </Text>

          {/* Theme package */}
          <View
            testID="settings-theme-package-row"
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Theme
            </Text>
            <View style={styles.themeChipRow}>
              {(
                [
                  ["galaxy", "Galaxy"],
                  ["standard", "Standard"],
                ] as [ThemePackage, string][]
              ).map(([value, label]) => {
                const selected = themePackage === value;
                return (
                  <Pressable
                    key={value}
                    testID={`settings-theme-package-${value}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Theme ${label}`}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setThemePackage(value);
                      void persist({ themePackage: value });
                    }}
                    style={[
                      styles.themeChip,
                      {
                        borderColor: selected ? colors.accent : colors.border,
                        backgroundColor: selected
                          ? colors.accent
                          : colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.themeChipLabel,
                        {
                          color: selected
                            ? colors.onAccent
                            : colors.textPrimary,
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Galaxy is glass-forward and deep-space; Standard is flatter and
              calmer. Each package remembers its own mode and accent.
            </Text>
          </View>

          {/* Appearance mode (per active package) */}
          <View
            testID="settings-theme-mode-row"
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Mode
            </Text>
            <View style={styles.themeChipRow}>
              {(
                [
                  ["light", "Light"],
                  ["dark", "Dark"],
                  ["system", "Follow System"],
                ] as [ThemeMode, string][]
              ).map(([value, label]) => {
                const activeMode =
                  themePackage === "galaxy" ? galaxyMode : standardMode;
                const selected = activeMode === value;
                return (
                  <Pressable
                    key={value}
                    testID={`settings-theme-mode-${value}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Mode ${label}`}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setModeForActivePackage(value);
                      void persist(
                        themePackage === "galaxy"
                          ? { galaxyMode: value }
                          : { standardMode: value },
                      );
                    }}
                    style={[
                      styles.themeChip,
                      {
                        borderColor: selected ? colors.accent : colors.border,
                        backgroundColor: selected
                          ? colors.accent
                          : colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.themeChipLabel,
                        {
                          color: selected
                            ? colors.onAccent
                            : colors.textPrimary,
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Accent (per active package) */}
          <View
            testID="settings-theme-accent-row"
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Accent
            </Text>
            <View style={styles.swatchRow}>
              {(() => {
                const activeAccent =
                  themePackage === "galaxy" ? galaxyAccent : standardAccent;
                const defaultSelected = activeAccent === null;
                return (
                  <>
                    {/* Package default (NULL accent) */}
                    <Pressable
                      testID="settings-theme-accent-default"
                      accessibilityRole="button"
                      accessibilityLabel="Accent package default"
                      accessibilityState={{ selected: defaultSelected }}
                      onPress={() => {
                        setAccentForActivePackage(null);
                        void persist(
                          themePackage === "galaxy"
                            ? { galaxyAccent: null }
                            : { standardAccent: null },
                        );
                      }}
                      style={[
                        styles.themeChip,
                        {
                          borderColor: defaultSelected
                            ? colors.accent
                            : colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.themeChipLabel,
                          { color: colors.textPrimary },
                        ]}
                      >
                        Default
                      </Text>
                    </Pressable>
                    {ACCENT_IDS.map((id: AccentId, index) => {
                      const selected = activeAccent === id;
                      const fill = ACCENTS[id][mode].fill;
                      return (
                        <Pressable
                          key={id}
                          testID={`settings-theme-accent-${index}`}
                          accessibilityRole="button"
                          accessibilityLabel={`Accent ${id.replace(/-/g, " ")}`}
                          accessibilityState={{ selected }}
                          onPress={() => {
                            setAccentForActivePackage(id);
                            void persist(
                              themePackage === "galaxy"
                                ? { galaxyAccent: id }
                                : { standardAccent: id },
                            );
                          }}
                          style={[
                            styles.swatch,
                            {
                              backgroundColor: fill,
                              borderColor: selected
                                ? colors.accent
                                : colors.border,
                            },
                          ]}
                        />
                      );
                    })}
                  </>
                );
              })()}
            </View>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              The accent tints buttons, links, and active states across the app.
            </Text>
          </View>

          {/* Background — only the ACTIVE package's choices are offered (D-07):
              the reactive themePackage selects backgroundChoicesForPackage, so
              the Galaxy-only slots are not shown while Standard is active (and
              vice-versa). Mode/Accent already read the active package, so only
              this grid needed the guard. A failed thumbnail silently becomes
              themed solid. */}
          <View
            testID="settings-theme-background-row"
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Background
            </Text>
            <View style={styles.backgroundGrid}>
              {backgroundChoicesForPackage(themePackage).map((slot) => (
                <BackgroundThumbnail
                  key={slot}
                  colors={colors}
                  columnWidth={backgroundColumnWidth}
                  label={BACKGROUND_LABELS[slot]}
                  onPress={onSelectBackground}
                  selected={selectedBackgroundSlot === slot}
                  slot={slot}
                  sourcePackage={themePackage}
                />
              ))}
            </View>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Backgrounds stay fixed behind your screens. Each package remembers
              its own choice.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: 16,
    gap: 12,
  },
  backLink: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  backLinkLabel: {
    fontSize: 13,
    fontWeight: "400",
  },
  section: {
    gap: 12,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  helper: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
  },
  backgroundGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  backgroundThumbnail: {
    minHeight: 44,
    flexGrow: 1,
    gap: 6,
    borderWidth: 2,
    borderRadius: 10,
    padding: 6,
  },
  backgroundPreview: {
    height: 64,
    overflow: "hidden",
    borderRadius: 6,
  },
  backgroundThumbnailLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  themeChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  themeChip: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  themeChipLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
});
