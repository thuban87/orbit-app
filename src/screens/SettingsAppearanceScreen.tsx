import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { PhotoSourcePicker } from "@/components/PhotoSourcePicker";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  type AppSettingsPatch,
  getAppSettings,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import { getProfile } from "@/db/profile-dao";
import { listSunCandidates, type SunCandidate } from "@/db/sun-picker-read";
import { sunOccupantIsSelf } from "@/logic/sun-occupant-logic";
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

  // Owner profile (migrated from the Settings monolith's "Your photo" row). The
  // self record's `name` is nullable — the "You" display fallback keeps the
  // initials avatar deterministic ("Y") until a self-name editor sets it.
  const [selfPhoto, setSelfPhoto] = useState<string | null>(null);
  const [selfName, setSelfName] = useState<string | null>(null);
  const [selfModifiedAt, setSelfModifiedAt] = useState<string | undefined>(
    undefined,
  );

  // "Orbit Appearance" / Orbit Center (migrated from the monolith's "Your
  // orbit" group). `selfSunColour` is the raw stored self-star hex or NULL; NULL
  // resolves to `starPalette[0]` (gold) at RENDER — no stored hex default. The
  // centre occupant is the raw stored id (NULL = You), the RESOLVED display name
  // (archived/missing → "You"), the favourites-first candidate list, the picker
  // modal's open state, and its search term.
  const [selfSunColour, setSelfSunColour] = useState<string | null>(null);
  const [sunContactId, setSunContactId] = useState<number | null>(null);
  const [sunOccupantName, setSunOccupantName] = useState("You");
  const [sunCandidates, setSunCandidates] = useState<SunCandidate[]>([]);
  const [sunPickerOpen, setSunPickerOpen] = useState(false);
  const [sunSearch, setSunSearch] = useState("");

  // Reload the self record so a photo set/removed on the crop screen refreshes
  // when it goBack()s here (mirrors ContactProfileScreen's reload-on-focus).
  const reloadProfile = useCallback(async () => {
    try {
      const profile = await getProfile(getExecutor());
      setSelfPhoto(profile?.photo ?? null);
      setSelfName(profile?.name ?? null);
      setSelfModifiedAt(profile?.modified_at);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load self profile", err);
    }
  }, []);

  // Load the Orbit Center settings (self-star colour + centre occupant). Read on
  // focus so a change made elsewhere refreshes when this screen regains focus.
  const reloadOrbit = useCallback(async () => {
    const exec = getExecutor();
    try {
      const next = await getAppSettings(exec);
      setSelfSunColour(next.selfSunColour);
      setSunContactId(next.sunContactId);
      setSunCandidates(await listSunCandidates(exec));
      // Resolve the occupant name through the SAME self-fallback predicate the
      // canvas uses (sunOccupantIsSelf) so Settings and the orrery can never
      // disagree about a hidden occupant. NULL → "You"; a stored id whose
      // contact is missing OR archived also shows "You"; else the live name.
      const header =
        next.sunContactId === null
          ? null
          : await getContactHeader(exec, next.sunContactId);
      const isSelf = sunOccupantIsSelf({
        sunContactId: next.sunContactId,
        occupant: header
          ? {
              archived: header.archived_at !== null,
              trackingEnabled: header.trackingEnabled,
            }
          : null,
      });
      setSunOccupantName(isSelf ? "You" : (header?.name ?? "You"));
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load orbit settings", err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reloadProfile();
      void reloadOrbit();
    }, [reloadProfile, reloadOrbit]),
  );

  // Persist the tapped self-star token (a themed starPalette entry). ADR-047 /
  // D-02: only the self-star colour is user-configurable — a contact at centre
  // keeps its status-derived glow, so this control is NOT conditioned on the
  // current centre and never assigns a colour to a contact centre.
  const onPickStarColour = useCallback(
    async (token: string) => {
      try {
        await updateAppSettings(
          getExecutor(),
          { selfSunColour: token },
          localDateTime(),
        );
        await reloadOrbit();
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to persist star colour", err);
      }
    },
    [reloadOrbit],
  );

  // Persist the chosen centre occupant (a candidate id, or NULL for "You").
  // Closes the picker and reloads the displayed occupant from the write.
  const onPickSunOccupant = useCallback(
    async (id: number | null) => {
      try {
        await updateAppSettings(
          getExecutor(),
          { sunContactId: id },
          localDateTime(),
        );
        setSunPickerOpen(false);
        setSunSearch("");
        await reloadOrbit();
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to persist sun occupant", err);
      }
    },
    [reloadOrbit],
  );

  // The picker list: a synthetic "You" (NULL id) first, then the favourites-first
  // candidates (already archived-excluded by listSunCandidates), filtered by the
  // search term. Choosing the centre lives in Settings by owner decision — NOT an
  // orrery gesture (the orrery long-press was rejected, ADR-047).
  const sunOptions = useMemo<Array<{ id: number | null; name: string }>>(() => {
    const all: Array<{ id: number | null; name: string }> = [
      { id: null, name: "You" },
      ...sunCandidates.map((c) => ({
        id: c.id as number | null,
        name: c.name,
      })),
    ];
    const term = sunSearch.trim().toLocaleLowerCase();
    if (term === "") return all;
    return all.filter((o) => o.name.toLocaleLowerCase().includes(term));
  }, [sunCandidates, sunSearch]);

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

        {/* Owner profile — the self record's photo (migrated from the monolith's
            "Your photo" row). The self-name editor is added alongside it. */}
        <View testID="settings-owner-profile-section" style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Your profile
          </Text>

          <View
            testID="settings-your-photo-row"
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Your photo
            </Text>
            <PhotoSourcePicker
              target={{ kind: "profile" }}
              photo={selfPhoto}
              name={selfName ?? "You"}
              cacheBust={selfModifiedAt}
              onChanged={() => void reloadProfile()}
            />
          </View>
        </View>

        {/* Orbit Appearance / Orbit Center (§D, migrated from the monolith's
            "Your orbit" group). Per ADR-047 / D-02 the self-star colour is the
            ONLY user-configurable colour: it stays available regardless of the
            current centre, and a contact at centre keeps its status-derived glow
            (no user-chosen colour for a contact centre). */}
        <View testID="settings-orbit-appearance-section" style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionHeading, { color: colors.textSecondary }]}
          >
            Orbit Appearance
          </Text>

          {/* "Your star" — the self-sun colour, picked from the themed
              starPalette. The selected swatch = selfSunColour, or starPalette[0]
              (gold) when unset (NULL resolves to gold at RENDER — no stored hex
              default). Swatch fills ARE starPalette TOKENS (legitimate token
              use, not hardcoded hex); the accent ring marks the selection. */}
          <View
            testID="settings-your-star-row"
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Your star
            </Text>
            <View style={styles.swatchRow}>
              {colors.starPalette.map((token, index) => {
                const isSelected =
                  token === (selfSunColour ?? colors.starPalette[0]);
                return (
                  <Pressable
                    key={token}
                    testID={`settings-star-swatch-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Star colour ${index + 1}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => void onPickStarColour(token)}
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: token,
                        borderColor: isSelected ? colors.accent : colors.border,
                      },
                    ]}
                  />
                );
              })}
            </View>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Pick the colour of your star at the centre of your orbit.
            </Text>
          </View>

          {/* "Orbit Center" — the occupant picker (You / favourites / all
              contacts), writing sun_contact_id (NULL = You). Relocated to
              Settings by owner decision (ADR-047). Shows the resolved occupant
              name ("You" when the stored occupant is archived/missing). */}
          <Pressable
            testID="settings-sun-centre-row"
            accessibilityRole="button"
            accessibilityLabel={`Orbit Center, ${sunOccupantName}`}
            onPress={() => setSunPickerOpen(true)}
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.toggleRow}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                Orbit Center
              </Text>
              <Text style={[styles.rowValue, { color: colors.accent }]}>
                {sunOccupantName}
              </Text>
            </View>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              Choose who sits at the centre — you, or someone you orbit around.
            </Text>
          </Pressable>

          <Modal
            visible={sunPickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setSunPickerOpen(false)}
          >
            <View style={styles.modalRoot}>
              <Pressable
                accessibilityLabel="Dismiss Orbit Center options"
                style={StyleSheet.absoluteFill}
                onPress={() => setSunPickerOpen(false)}
              >
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    styles.scrim,
                    { backgroundColor: colors.background },
                  ]}
                />
              </Pressable>

              <View
                testID="settings-sun-picker"
                style={[
                  styles.sheet,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TextInput
                  testID="settings-sun-picker-search"
                  accessibilityLabel="Search Orbit Center contacts"
                  value={sunSearch}
                  onChangeText={setSunSearch}
                  placeholder="Search contacts"
                  placeholderTextColor={colors.textSecondary}
                  autoCorrect={false}
                  style={[
                    styles.searchInput,
                    {
                      color: colors.textPrimary,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <FlatList
                  data={sunOptions}
                  keyExtractor={(item) =>
                    item.id === null ? "me" : String(item.id)
                  }
                  renderItem={({ item }) => {
                    const isSelected = item.id === sunContactId;
                    return (
                      <Pressable
                        testID={`settings-sun-option-${item.id === null ? "me" : item.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={item.name}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => void onPickSunOccupant(item.id)}
                        style={[styles.option, { borderColor: colors.border }]}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            color: isSelected
                              ? colors.accent
                              : colors.textPrimary,
                          }}
                        >
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scrim: {
    opacity: 0.85,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 12,
    maxHeight: "60%",
    overflow: "hidden",
  },
  searchInput: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
