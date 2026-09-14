// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit's visual/typography domain prop.
import { useEffect, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { AppText, Button, GlassSurface } from "@/components/ui";
import { resolveActiveAiConnection } from "@/db/ai-connections-dao";
import { getAppSettings, markAiFirstUseDisclosed } from "@/db/app-settings-dao";
import { getExecutor } from "@/db/database";
import {
  describeAiDataPath,
  shouldShowFirstUseDisclosure,
} from "@/screens/settings-ai-logic";
import { aiKeyStore } from "@/services/ai-key-store";
import { useAiConfigStore } from "@/stores/ai-config-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "ai-first-use";

/** One-time disclosure after a complete local AI setup. It never gates egress. */
export function AIFirstUseDisclosure() {
  const { colors } = useTheme();
  const aiEnabled = useAiConfigStore((state) => state.aiEnabled);
  const activeLane = useAiConfigStore((state) => state.activeConnection);
  const hydrated = useAiConfigStore((state) => state.hydrated);
  const hydrate = useAiConfigStore((state) => state.hydrate);
  const [visible, setVisible] = useState(false);
  const [path, setPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated) return;
    void hydrate(getExecutor()).catch((caught) => {
      Logger.error(LOG_SCOPE, "failed to hydrate AI settings", caught);
    });
  }, [hydrate, hydrated]);

  useEffect(() => {
    let cancelled = false;
    if (!hydrated || !aiEnabled || activeLane === null) {
      setVisible(false);
      return;
    }
    const exec = getExecutor();
    void Promise.all([
      getAppSettings(exec),
      resolveActiveAiConnection(exec),
      aiKeyStore.getKey(activeLane),
    ])
      .then(([settings, connection, credential]) => {
        if (cancelled || connection === null) return;
        const show = shouldShowFirstUseDisclosure({
          aiEnabled,
          connection,
          credentialPresent: credential !== null,
          disclosed: settings.aiFirstUseDisclosed === 1,
        });
        setPath(show ? describeAiDataPath(connection) : "");
        setVisible(show);
      })
      .catch((caught) => {
        Logger.error(LOG_SCOPE, "failed to resolve disclosure state", caught);
        if (!cancelled) setVisible(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeLane, aiEnabled, hydrated]);

  async function acknowledge() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await markAiFirstUseDisclosed(getExecutor());
      setVisible(false);
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to persist disclosure", caught);
      setError("Couldn't save that yet. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => void acknowledge()}
    >
      <View
        accessibilityViewIsModal
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <GlassSurface style={styles.card}>
          <AppText role="heading">Before you use AI</AppText>
          <AppText role="body">
            Orbit only sends information you've allowed for AI. Your request is
            sent through {path}. You can review exactly what Orbit sends at any
            time.
          </AppText>
          {error ? (
            <AppText role="caption" style={{ color: colors.danger }}>
              {error}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button
              testID="ai-first-use-done"
              role="primary"
              label={saving ? "Saving…" : "Got it"}
              accessibilityLabel="Acknowledge AI data path disclosure"
              disabled={saving}
              onPress={() => void acknowledge()}
            />
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    padding: SPACING.xl,
  },
  card: {
    gap: SPACING.lg,
    padding: SPACING.lg,
  },
  actions: {
    alignItems: "flex-start",
  },
});
