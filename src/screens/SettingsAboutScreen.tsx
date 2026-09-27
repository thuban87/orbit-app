import { Image } from "expo-image";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { useTheme } from "@/theme";
import { ABOUT_APP_NAME, resolveAboutVersion } from "./settings-about-model";

// The app icon (app.json `icon`): the owner's legacy Orbit art with its
// transparent corners (RG-041 release-readiness/AUD-REL-003, D-21). A static
// require resolves at bundle time; the same asset as the legacy launcher icon,
// so About needs no separate artwork.
const APP_ICON = require("../../assets/orbit-icon-legacy.png");

/**
 * About Orbit category screen (§K / D-09). A BASIC surface: it shows ONLY fields
 * with a genuine runtime source — the product name (`ABOUT_APP_NAME`, a module
 * constant, not read from app config — OWNER FLAG F-1), the app
 * icon, and the semantic version (`expo-constants`, with a module-constant
 * fallback). Per §K "omit unavailable rows" it renders NO build-number row (no
 * `android.versionCode` on disk), NO dependency licenses/acknowledgements (no
 * runtime source/generator this phase — OWNER FLAG F-2), and NO support/feedback
 * or Privacy/Terms rows (no real destinations). No dead placeholders; Phase 40
 * may add release/legal destinations later.
 *
 * Back is the `ShellAppBar` header Back only (RG-037 ui-accessibility/
 * AUD-UIA-016, D-15): no duplicate in-body Back.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsAboutScreen() {
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
