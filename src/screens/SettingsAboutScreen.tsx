import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { useTheme } from "@/theme";
import {
  ABOUT_APP_NAME,
  resolveAboutVersion,
} from "./settings-about-model";

// The app icon (app.json `icon`). A static require resolves at bundle time; the
// same asset the launcher shows, so About needs no separate artwork.
const APP_ICON = require("../../assets/icon.png");

interface SettingsAboutScreenProps {
  onBack: () => void;
}

/**
 * About Orbit category screen (§K / D-09). A BASIC surface: it shows ONLY fields
 * with a genuine runtime source — the product name (`ABOUT_APP_NAME`, a real
 * name, NOT `app.json`'s scaffold `"orbit-scaffold"` — OWNER FLAG F-1), the app
 * icon, and the semantic version (`expo-constants`, with a module-constant
 * fallback). Per §K "omit unavailable rows" it renders NO build-number row (no
 * `android.versionCode` on disk), NO dependency licenses/acknowledgements (no
 * runtime source/generator this phase — OWNER FLAG F-2), and NO support/feedback
 * or Privacy/Terms rows (no real destinations). No dead placeholders; Phase 40
 * may add release/legal destinations later.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsAboutScreen({ onBack }: SettingsAboutScreenProps) {
  const { colors } = useTheme();
  const bottomClearance = useBottomClearance();
  const version = resolveAboutVersion();

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="About Orbit" />
      <ScrollView
        testID="settings-about-screen"
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
          <Text style={[styles.backLinkText, { color: colors.accent }]}>
            Back
          </Text>
        </Pressable>

        <View
          testID="settings-about-identity"
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Image
            source={APP_ICON}
            accessibilityLabel="Orbit app icon"
            contentFit="contain"
            style={styles.icon}
          />
          <Text
            accessibilityRole="header"
            testID="settings-about-name"
            style={[styles.appName, { color: colors.textPrimary }]}
          >
            {ABOUT_APP_NAME}
          </Text>
          <Text
            testID="settings-about-version"
            accessibilityLabel={`Version ${version}`}
            style={[styles.version, { color: colors.textSecondary }]}
          >
            Version {version}
          </Text>
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
  backLinkText: {
    fontSize: 13,
    fontWeight: "400",
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 24,
    gap: 12,
    alignItems: "center",
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 20,
  },
  appName: {
    fontSize: 22,
    fontWeight: "700",
  },
  version: {
    fontSize: 14,
    fontWeight: "400",
  },
});
