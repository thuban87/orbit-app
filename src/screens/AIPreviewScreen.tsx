// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit's visual/typography domain prop.
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { resolvePrompt } from "@/ai/prompt-template";
import type { PromptContext, ResolvedPrompt } from "@/ai/prompt-types";
import { ContactPicker } from "@/components/ContactPicker";
import { AppText, Button, GlassSurface } from "@/components/ui";
import { readPromptContext } from "@/db/ai-context-read";
import { getAppSettings } from "@/db/app-settings-dao";
import { getExecutor } from "@/db/database";
import {
  getWritingStyle,
  listPersonalizationSections,
} from "@/db/personalization-dao";
import {
  buildContactPromptReview,
  buildWholePromptPreview,
} from "@/screens/settings-ai-logic";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "ai-preview";

const EMPTY_PREVIEW_CONTEXT: PromptContext = {
  contactName: "Example contact",
  category: "",
  rankedFuel: [],
  gravityTier: "",
  intensity: {
    currentCount: 0,
    intendedPerPeriod: 0,
    multiple: 0,
    trailingAvgGapDays: null,
  },
  quality: { good: 0, fine: 0, hard: 0 },
  cadence: { totalCount: 0, connectedCount: 0 },
  newestChannel: "unspecified",
  sharedFields: [],
  sharedMemories: [],
  recentInteractions: [],
};

interface PreviewState {
  resolved: ResolvedPrompt;
  context: PromptContext;
}

export interface AIPreviewScreenProps {
  onBack: () => void;
}

/** Local-only whole-prompt preview with an optional real-contact example. */
export function AIPreviewScreen({ onBack }: AIPreviewScreenProps) {
  const { colors } = useTheme();
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
      setPreview(await resolveFor(EMPTY_PREVIEW_CONTEXT));
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
        setPreview(await resolveFor(context));
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
    ? buildContactPromptReview(preview.resolved, preview.context)
    : null;

  return (
    <>
      <ScrollView
        testID="ai-preview-screen"
        contentContainerStyle={[
          styles.content,
          { backgroundColor: colors.background },
        ]}
      >
        <View style={styles.header}>
          <Button
            role="tertiary"
            label="Back"
            accessibilityLabel="Back"
            onPress={onBack}
          />
          <AppText role="heading">Preview What Orbit Sends</AppText>
        </View>
        <AppText role="body">
          This is the complete resolved prompt. API keys and credentials are
          never part of it.
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
        {whole && !loading ? (
          rawOpen ? (
            <View testID="ai-preview-raw">
              <GlassSurface style={styles.card}>
                <AppText role="caption">{whole.raw}</AppText>
              </GlassSurface>
            </View>
          ) : (
            whole.sections.map((section) => (
              <GlassSurface key={section.content} style={styles.card}>
                <AppText role="label">{section.title}</AppText>
                <AppText role="caption">{section.content}</AppText>
              </GlassSurface>
            ))
          )
        ) : null}

        {contact && preview?.context.contactName !== "Example contact" ? (
          <View testID="ai-preview-contact-summary">
            <GlassSurface style={styles.card}>
              <AppText role="label">{contact.heading}</AppText>
              {contact.emptyMessage ? (
                <AppText role="caption">{contact.emptyMessage}</AppText>
              ) : null}
            </GlassSurface>
          </View>
        ) : null}
      </ScrollView>
      <ContactPicker
        visible={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
        onSelect={(contactId) => void chooseContact(contactId)}
        allowArchivedSearch={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  header: {
    gap: SPACING.md,
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
