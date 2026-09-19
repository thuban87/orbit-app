// biome-ignore-all lint/a11y/useValidAriaRole: AppText's role is a typography role.
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { getAppSettings, updateAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  cancelPhase38DigestUat,
  schedulePhase38DigestUat,
} from "@/services/notifications/__dev__/phase38-uat";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

type Toggle = 0 | 1;

export function Phase38UatControls() {
  const { colors } = useTheme();
  const [original, setOriginal] = useState<Toggle | null>(null);
  const [current, setCurrent] = useState<Toggle | null>(null);
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading Phase 38 UAT state…");

  useEffect(() => {
    let mounted = true;
    getAppSettings(getExecutor())
      .then((settings) => {
        if (!mounted) return;
        setOriginal(settings.includeUnboundNeverContacted);
        setCurrent(settings.includeUnboundNeverContacted);
        setStatus("Ready");
      })
      .catch(() => {
        if (mounted) setStatus("Couldn't read the Never Contacted setting.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const writeNeverContacted = async (value: Toggle) => {
    try {
      await updateAppSettings(
        getExecutor(),
        { includeUnboundNeverContacted: value },
        localDateTime(),
      );
      setCurrent(value);
      setStatus(`Never Contacted is now ${value ? "included" : "bound-only"}.`);
    } catch {
      setStatus("Couldn't update the Never Contacted setting.");
    }
  };

  const scheduleProbe = async () => {
    try {
      const identifier = await schedulePhase38DigestUat();
      setNotificationId(identifier);
      setStatus(`Scheduled ${identifier}. Background Orbit now.`);
    } catch {
      setStatus("Couldn't schedule the Digest UAT notification.");
    }
  };

  const cancelProbe = async () => {
    if (!notificationId) {
      setStatus("No retained Digest UAT notification to cancel.");
      return;
    }
    try {
      await cancelPhase38DigestUat(notificationId);
      setNotificationId(null);
      setStatus("Cancelled the retained Digest UAT notification.");
    } catch {
      setStatus("Couldn't cancel the retained Digest UAT notification.");
    }
  };

  return (
    <View style={[styles.root, { borderColor: colors.borderStrong }]}>
      <AppText role="heading">Phase 38 UAT</AppText>
      <AppText role="body">
        Never Contacted — original: {original === null ? "unknown" : original}
        {"; "}current: {current === null ? "unknown" : current}
      </AppText>
      <AppText role="caption" style={{ color: colors.textSecondary }}>
        Restore the original value here. Each canonical write intentionally
        advances modified_at and data_revision; those counters stay monotonic.
      </AppText>
      <View style={styles.actions}>
        <Button
          role="secondary"
          label="Set bound-only (0)"
          onPress={() => void writeNeverContacted(0)}
        />
        <Button
          role="secondary"
          label="Include unbound (1)"
          onPress={() => void writeNeverContacted(1)}
        />
      </View>
      <AppText role="body">
        Digest probe: {notificationId ?? "none retained"}
      </AppText>
      <View style={styles.actions}>
        <Button
          role="secondary"
          label="Schedule Digest UAT"
          onPress={() => void scheduleProbe()}
        />
        <Button
          role="tertiary"
          label="Cancel Digest UAT"
          onPress={() => void cancelProbe()}
        />
      </View>
      <AppText role="caption">{status}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
    margin: SPACING.md,
    padding: SPACING.md,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
});
