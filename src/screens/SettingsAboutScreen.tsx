import { Image } from "expo-image";
import { ScrollView, StyleSheet, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { SettingsRow, SettingsSectionCard } from "@/components/ui";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { SPACING } from "@/theme/tokens/spacing";
import { ABOUT_APP_NAME, resolveAboutVersion } from "./settings-about-model";

// The app icon (app.json `icon`): the owner's legacy Orbit art with its
// transparent corners (RG-041 release-readiness/AUD-REL-003, D-21). A static
// require resolves at bundle time; the same asset as the legacy launcher icon,
// so About needs no separate artwork.
const APP_ICON = require("../../assets/orbit-icon-legacy.png");

/**
 * The privacy line (38.12 D-125; copy at planning, the owner reviews it at the
 * device check). It stays literally true to CLAUDE.md "Local-first":
 *   - it speaks about CONTACT data, because Orbit makes non-AI requests that
 *     carry none (a pasted image URL download, OpenRouter sign-in, the AI model
 *     list — convergence c1 L-4), so "nothing is sent anywhere" would be false;
 *   - it names the backup folder, because automatic backups write the full
 *     contact data (unencrypted when backup encryption is off) to a folder the
 *     user chooses, which may be cloud-synced (`backup-service.ts`
 *     resolveWriteEncryptionMode / writeVerified — convergence c4 E-6);
 *   - the only other egress is the user's own AI provider, on explicit use.
 */
const ABOUT_PRIVACY_LINE =
  "Your contact data stays on this phone, and in the backup folder you choose. Orbit never sends it anywhere else, except to your own AI provider when you choose to use AI.";

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
 * info-only row.
 *
 * Back is the `ShellAppBar` header Back only (RG-037 ui-accessibility/
 * AUD-UIA-016, D-15): no duplicate in-body Back.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsAboutScreen() {
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
          <SettingsRow
            testID="settings-about-privacy"
            title="Your data"
            subtitle={ABOUT_PRIVACY_LINE}
          />
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
});
