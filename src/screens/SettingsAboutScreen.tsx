// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { Image } from "expo-image";
import { ScrollView, StyleSheet, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, SettingsRow, SettingsSectionCard } from "@/components/ui";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import {
  ABOUT_APP_NAME,
  ABOUT_PRIVACY_EXPORT_CLAUSE,
  ABOUT_PRIVACY_LINE,
  resolveAboutVersion,
} from "./settings-about-model";

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
 * The rows are info-only `SettingsRow`s in one `SettingsSectionCard` (38.12
 * D-119): no chevron, no button role. The D-125 privacy line is one more
 * info-only row; its D-151 Export clause is a nested span in the primary text
 * colour and bold, so it stands out from the secondary-colour line.
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
        <View testID="settings-about-identity" style={styles.identity}>
          <Image
            source={APP_ICON}
            accessibilityLabel="Orbit app icon"
            contentFit="contain"
            style={styles.icon}
          />
        </View>
        <SettingsSectionCard testID="settings-about-card">
          <SettingsRow
            testID="settings-about-name"
            title="Name"
            value={ABOUT_APP_NAME}
          />
          <SettingsRow
            testID="settings-about-version"
            title="Version"
            value={version}
            accessibilityLabel={`Version ${version}`}
          />
          <SettingsRow testID="settings-about-privacy" title="Your data">
            <AppText
              role="caption"
              testID="settings-about-privacy-line"
              style={{ color: colors.textSecondary }}
            >
              {ABOUT_PRIVACY_LINE}{" "}
              <AppText
                role="caption"
                testID="settings-about-privacy-export"
                style={[styles.highlight, { color: colors.textPrimary }]}
              >
                {ABOUT_PRIVACY_EXPORT_CLAUSE}
              </AppText>
            </AppText>
          </SettingsRow>
        </SettingsSectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: SPACING.base,
    gap: SPACING.md,
  },
  identity: {
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 20,
  },
  highlight: { fontWeight: "700" },
});
