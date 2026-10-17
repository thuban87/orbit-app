// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit's visual/typography domain prop.
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { resolvePrompt } from "@/ai/prompt-template";
import type { PromptContext, ResolvedPrompt } from "@/ai/prompt-types";
import { ContactPicker } from "@/components/ContactPicker";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, Button } from "@/components/ui";
import { SettingsSectionCard } from "@/components/ui/SettingsSectionCard";
import { readPromptContext } from "@/db/ai-context-read";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor } from "@/db/database";
import {
  getWritingStyle,
  listPersonalizationSections,
} from "@/db/personalization-dao";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import {
  AI_PREVIEW_COPY,
  buildPreviewContactCard,
  buildWholePromptPreview,
  EXAMPLE_PREVIEW_CONTEXT,
} from "@/screens/settings-ai-logic";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "ai-preview";

interface PreviewState {
  resolved: ResolvedPrompt;
  context: PromptContext;
  /** The chosen contact's context, or null while no contact is chosen. */
  chosen: PromptContext | null;
}

/**
 * Local-only whole-prompt preview with an optional real-contact example.
 *
 * Back is the shared header's only (38.9 D-16, D-07). No opaque screen fill:
 * the theme art shows behind the content, as on the other Settings screens
 * (D-17).
 */
export function AIPreviewScreen() {
  const { colors } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolveFor = useCallback(async (contactContext: PromptContext) => {
    const exec = getExecutor();
    const [settings, writingStyle, personalizationSections] = await Promise.all(
      [
        getAppSettings(exec),
        getWritingStyle(exec),
        listPersonalizationSections(exec),
      ],
    );
    const context = {
      ...contactContext,
      writingStyle,
      personalizationSections,
    };
    return {
      context,
      resolved: resolvePrompt(settings.aiPromptTemplate, context),
    };
  }, []);

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPreview({
        ...(await resolveFor(EXAMPLE_PREVIEW_CONTEXT)),
        chosen: null,
      });
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to resolve preview", caught);
      setError("Couldn't build the AI preview. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [resolveFor]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  const chooseContact = useCallback(
    async (contactId: number) => {
      setLoading(true);
      setError(null);
      try {
        const context = await readPromptContext(getExecutor(), contactId);
        const next = await resolveFor(context);
        setPreview({ ...next, chosen: next.context });
      } catch (caught) {
        Logger.error(LOG_SCOPE, "failed to resolve contact preview", caught);
        setError("Couldn't preview that contact. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [resolveFor],
  );

  const whole = preview ? buildWholePromptPreview(preview.resolved) : null;
  const contact = preview
    ? buildPreviewContactCard(preview.chosen, preview.resolved)
    : null;

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Preview What Orbit Sends" />
      <ScrollView
        testID="ai-preview-screen"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        <AppText role="body">{AI_PREVIEW_COPY.intro}</AppText>
        <AppText role="body" style={{ color: colors.textSecondary }}>
          {AI_PREVIEW_COPY.contactIntro}
        </AppText>
        <View style={styles.actions}>
          <Button
            testID="ai-preview-contact"
            role="secondary"
            label="Preview with contact…"
            accessibilityLabel="Preview what Orbit sends with a contact"
            onPress={() => setPickerOpen(true)}
          />
          <Button
            testID="ai-preview-raw-toggle"
            role="tertiary"
            label={rawOpen ? "Readable view" : "Raw resolved view"}
            accessibilityLabel={
              rawOpen ? "Show readable prompt view" : "Show raw resolved prompt"
            }
            onPress={() => setRawOpen((open) => !open)}
          />
        </View>

        {loading ? <AppText role="caption">Resolving preview…</AppText> : null}
        {error ? <AppText role="caption">{error}</AppText> : null}

        {/* The contact's part comes first, where the copy above says. */}
        {contact && !loading ? (
          <View testID="ai-preview-contact-summary">
            <SettingsSectionCard title={AI_PREVIEW_COPY.contactTitle}>
              {contact.kind === "none" ? (
                <View key="none" style={styles.card}>
                  <AppText role="caption">{contact.message}</AppText>
                </View>
              ) : (
                <View key="contact" style={styles.card}>
                  <AppText role="label">{contact.heading}</AppText>
                  {contact.emptyMessage ? (
                    <AppText
                      role="caption"
                      style={{ color: colors.textSecondary }}
                    >
                      {contact.emptyMessage}
                    </AppText>
                  ) : null}
                  <AppText role="caption">{contact.display}</AppText>
                </View>
              )}
            </SettingsSectionCard>
          </View>
        ) : null}

        {whole && !loading ? (
          rawOpen ? (
            <View testID="ai-preview-raw">
              <SettingsSectionCard title={AI_PREVIEW_COPY.wholeTitle}>
                <View key="raw" style={styles.card}>
                  <AppText role="caption">{whole.raw}</AppText>
                </View>
              </SettingsSectionCard>
            </View>
          ) : (
            <SettingsSectionCard title={AI_PREVIEW_COPY.wholeTitle}>
              {whole.sections.map((section) => (
                <View key={section.content} style={styles.card}>
                  <AppText role="label">{section.title}</AppText>
                  <AppText role="caption">{section.content}</AppText>
                </View>
              ))}
            </SettingsSectionCard>
          )
        ) : null}
      </ScrollView>
      <ContactPicker
        visible={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
        onSelect={(contactId) => void chooseContact(contactId)}
        allowArchivedSearch={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  actions: {
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  card: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
});
