// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, View } from "react-native";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { ProfileBackgroundManager } from "@/components/profile/ProfileBackgroundManager";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileLayoutEditor } from "@/components/profile/ProfileLayoutEditor";
import { ProfileModuleHost } from "@/components/profile/ProfileModuleHost";
import { ProfileTemplateManager } from "@/components/profile/ProfileTemplateManager";
import { AppText } from "@/components/ui/AppText";
import { BackgroundHost } from "@/components/ui/BackgroundHost";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { getAppSettings } from "@/db/app-settings-dao";
import { archiveContact } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { clearFavouriteRank, setFavouriteRank } from "@/db/favourites-dao";
import { resetProfilePresentation } from "@/db/profile-presentation-dao";
import { type ProfileSnapshot, readProfileSnapshot } from "@/db/profile-read";
import {
  setProfileContactFrequency,
  snoozeProfileContact,
  unsnoozeProfileContact,
} from "@/db/profile-relationship-actions";
import type { RootStackScreenProps } from "@/navigation/types";
import { resolveProfilePresentation } from "@/profile/resolve-presentation";
import {
  closeTopmostProfileOverlay,
  type ProfileOverlay,
  profileLifecycleView,
  profileOverflowEntries,
  unbindConfirmation,
} from "@/screens/contact-profile-logic";
import {
  bindWithLifecycleEffects,
  unbindWithLifecycleEffects,
} from "@/services/contact-lifecycle-effects";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import { resolveBackgroundUri } from "@/services/photos/background-storage";
import { performReachOut } from "@/services/reach-out/handoff";
import { useShellRefresh } from "@/stores/shell-refresh-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "contact-profile";

/** One local coherent snapshot drives the fixed Hero and resolved module host. */
export function ContactProfileScreen({
  navigation,
  route,
}: RootStackScreenProps<"Profile">) {
  const { colors, package: themePackage } = useTheme();
  const contactId = route.params.contactId;
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<ProfileOverlay>(null);
  const [pendingFavourite, setPendingFavourite] = useState(false);
  const [bindIntervalDays, setBindIntervalDays] = useState(30);
  const [bindIntervalValid, setBindIntervalValid] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await readProfileSnapshot(getExecutor(), contactId, {
        now: localDateTime(),
        themeBackground: `theme:${themePackage}`,
      });
      if (!next) {
        setSnapshot(null);
        setError("This contact is no longer available.");
        return;
      }
      setSnapshot(next);
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to load Profile snapshot", cause);
      setError("Couldn't load this contact. Please go back and retry.");
    } finally {
      setLoading(false);
    }
  }, [contactId, themePackage]);

  useShellRefresh(load);
  useFocusEffect(useCallback(() => void load(), [load]));

  const presentation = useMemo(
    () => (snapshot ? resolveProfilePresentation(snapshot.presentation) : null),
    [snapshot],
  );
  const lifecycle = profileLifecycleView({
    trackingEnabled: snapshot?.identity.trackingEnabled ?? 0,
    intervalDays: snapshot?.identity.intervalDays ?? null,
  });
  const todayLocal = formatLocalDate(new Date());
  const snoozed =
    snapshot?.identity.snoozeUntil != null &&
    snapshot.identity.snoozeUntil > todayLocal;
  const freeformLayout =
    presentation?.layout.source === "contact-freeform"
      ? presentation.layout.document
      : null;
  const hasContactPresentationOverride = Boolean(
    snapshot &&
      (snapshot.presentation.contact.layoutTemplateUid !== null ||
        snapshot.presentation.contact.freeformLayout !== null ||
        snapshot.presentation.contact.backgroundTemplateUid !== null ||
        Object.keys(snapshot.presentation.contact.collapse).length > 0),
  );

  const closeOverlay = useCallback(
    () => setOverlay((current) => closeTopmostProfileOverlay(current)),
    [],
  );
  const commitAndReload = useCallback(
    async (operation: () => Promise<void>) => {
      await operation();
      await load();
    },
    [load],
  );

  const toggleFavourite = useCallback(async () => {
    if (!snapshot || pendingFavourite || lifecycle.kind !== "bound") return;
    setPendingFavourite(true);
    try {
      const now = localDateTime();
      if (snapshot.identity.favouriteRank === null) {
        await setFavouriteRank(getExecutor(), contactId, now);
      } else {
        await clearFavouriteRank(getExecutor(), contactId, now);
      }
      await load();
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to update favourite", cause);
      Alert.alert("Couldn't update favorite", "Please try again.");
    } finally {
      setPendingFavourite(false);
    }
  }, [contactId, lifecycle.kind, load, pendingFavourite, snapshot]);

  const launchMethod = useCallback(
    async (
      method:
        | ProfileSnapshot["methods"]["phone"][number]
        | ProfileSnapshot["methods"]["email"][number],
      action: "call" | "message" | "email",
    ) => {
      if (method.is_actionable !== 1 || method.canonical_value === null) return;
      try {
        const settings = await getAppSettings(getExecutor());
        await performReachOut(getExecutor(), {
          contactId,
          channel: action === "message" ? "text" : action,
          endpoint: method.canonical_value,
          assistEnabled: settings.interactionAssistEnabled === 1,
          now: localDateTime(),
        });
      } catch (cause) {
        Logger.error(LOG_SCOPE, "failed Profile method handoff", cause);
      }
    },
    [contactId],
  );

  const archive = useCallback(async () => {
    try {
      await archiveContact(getExecutor(), contactId, localDateTime());
      closeOverlay();
      navigation.goBack();
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to archive Profile contact", cause);
      Alert.alert("Couldn't archive", "Please try again.");
    }
  }, [closeOverlay, contactId, navigation]);

  const setFrequency = useCallback(
    (intervalDays: number) =>
      commitAndReload(() =>
        setProfileContactFrequency(getExecutor(), {
          contactId,
          intervalDays,
          now: localDateTime(),
        }),
      ),
    [commitAndReload, contactId],
  );
  const snooze = useCallback(
    async (request: { preset: "3d" | "1w" | "1m" } | { until: string }) => {
      await commitAndReload(() =>
        snoozeProfileContact(getExecutor(), {
          contactId,
          now: localDateTime(),
          ...request,
        }),
      );
      void reconcileSchedule(getExecutor()).catch((cause) =>
        Logger.error(LOG_SCOPE, "failed to reconcile snooze", cause),
      );
    },
    [commitAndReload, contactId],
  );
  const unsnooze = useCallback(async () => {
    await commitAndReload(() =>
      unsnoozeProfileContact(getExecutor(), {
        contactId,
        now: localDateTime(),
      }),
    );
    void reconcileSchedule(getExecutor()).catch((cause) =>
      Logger.error(LOG_SCOPE, "failed to reconcile unsnooze", cause),
    );
  }, [commitAndReload, contactId]);

  const transitionLifecycle = useCallback(
    async (direction: "bind" | "unbind") => {
      if (!snapshot || transitioning) return;
      setTransitioning(true);
      try {
        const now = localDateTime();
        if (direction === "bind") {
          await bindWithLifecycleEffects(
            getExecutor(),
            contactId,
            now,
            lifecycle.showFrequencyPicker ? bindIntervalDays : undefined,
          );
        } else {
          await unbindWithLifecycleEffects(getExecutor(), contactId, now);
        }
        await load();
      } catch (cause) {
        Logger.error(
          LOG_SCOPE,
          `failed to ${direction} Profile contact`,
          cause,
        );
        Alert.alert("Couldn't update contact", "Please try again.");
      } finally {
        setTransitioning(false);
      }
    },
    [
      bindIntervalDays,
      contactId,
      lifecycle.showFrequencyPicker,
      load,
      snapshot,
      transitioning,
    ],
  );

  const backgroundUri =
    presentation && presentation.background.source !== "theme"
      ? resolveBackgroundUri(presentation.background.imagePath)
      : null;

  return (
    <BackgroundHost density="presentation">
      <View testID="contact-profile-screen" style={styles.root}>
        {backgroundUri ? (
          <>
            <Image
              source={{ uri: backgroundUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.surface, opacity: 0.72 },
              ]}
            />
          </>
        ) : null}
        <ScrollView contentContainerStyle={styles.content}>
          <Button
            role="tertiary"
            label="Back"
            onPress={() => navigation.goBack()}
          />
          {loading && !snapshot ? <AppText>Loading Profile…</AppText> : null}
          {error ? <AppText>{error}</AppText> : null}
          {snapshot && presentation ? (
            <>
              <ProfileHero
                identity={snapshot.identity}
                actionableMethods={snapshot.actionableMethods}
                pendingFavourite={
                  pendingFavourite || lifecycle.kind !== "bound"
                }
                onToggleFavourite={() => void toggleFavourite()}
                onMessage={() => navigation.navigate("Compose", { contactId })}
                onCall={() => {
                  const phone = snapshot.actionableMethods.phone;
                  if (phone) void launchMethod(phone, "call");
                }}
                onOpenOverflow={() => setOverlay("overflow")}
              />
              {lifecycle.kind !== "bound" ? (
                <View
                  style={[
                    styles.lifecycle,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <AppText role="heading">Unbound</AppText>
                  <AppText>
                    This contact is outside your active orbit. Their details and
                    history stay here.
                  </AppText>
                  {lifecycle.showFrequencyPicker ? (
                    <FrequencyPicker
                      value={bindIntervalDays}
                      onChange={setBindIntervalDays}
                      onValidityChange={setBindIntervalValid}
                    />
                  ) : null}
                  <Button
                    role="primary"
                    label="Bind contact"
                    disabled={
                      transitioning ||
                      (lifecycle.showFrequencyPicker && !bindIntervalValid)
                    }
                    onPress={() => void transitionLifecycle("bind")}
                  />
                </View>
              ) : (
                <Button
                  role="tertiary"
                  label="Unbind contact"
                  disabled={transitioning}
                  onPress={() => {
                    const confirmation = unbindConfirmation(
                      snapshot.identity.name,
                    );
                    Alert.alert(confirmation.title, confirmation.message, [
                      { text: "Keep contact bound", style: "cancel" },
                      {
                        text: "Unbind contact",
                        style: "destructive",
                        onPress: () => void transitionLifecycle("unbind"),
                      },
                    ]);
                  }}
                />
              )}
              <ProfileModuleHost
                snapshot={snapshot}
                presentation={presentation}
                todayLocal={todayLocal}
                onOpenHistory={() =>
                  navigation.navigate("ThingsToRemember", { contactId })
                }
                onSetFrequency={setFrequency}
                onSnooze={snooze}
                onUnsnooze={unsnooze}
                onKnowledgeAction={() =>
                  navigation.navigate("ThingsToRemember", { contactId })
                }
                onKnowledgeViewAll={() =>
                  navigation.navigate("ThingsToRemember", { contactId })
                }
                // Value-history remains owned by the Knowledge flow. Profile
                // deliberately carries only a stable detail intent and never
                // coerces a custom-field id into the current-state route key.
                onOpenValueHistory={() =>
                  navigation.navigate("ThingsToRemember", { contactId })
                }
                onContactMethodAction={(method, action) =>
                  void launchMethod(method, action)
                }
                onCollapseCommitted={() => void load()}
              />
            </>
          ) : null}
        </ScrollView>
        {snapshot && presentation ? (
          <>
            <Sheet
              visible={overlay === "overflow"}
              onRequestClose={closeOverlay}
              variant="detail"
            >
              <View style={styles.menu}>
                <AppText role="heading">Profile actions</AppText>
                {profileOverflowEntries({
                  snoozed,
                  hasFreeformLayout: freeformLayout !== null,
                  hasContactPresentationOverride,
                }).map((entry) => {
                  if (entry === "separator") {
                    return (
                      <View
                        key={entry}
                        style={[
                          styles.separator,
                          { backgroundColor: colors.border },
                        ]}
                      />
                    );
                  }
                  const labels = {
                    edit: "Edit Contact",
                    snooze: "Snooze",
                    unsnooze: "Unsnooze",
                    archive: "Archive",
                    layout: "Profile Layout",
                    background: "Background",
                    "save-layout-template": "Save Current Layout as Template",
                    reset: "Reset",
                  } as const;
                  const onPress = () => {
                    switch (entry) {
                      case "edit":
                        closeOverlay();
                        navigation.navigate("Edit", { contactId });
                        return;
                      case "snooze":
                        setOverlay("snooze");
                        return;
                      case "unsnooze":
                        void unsnooze().then(closeOverlay);
                        return;
                      case "archive":
                        void archive();
                        return;
                      case "layout":
                        setOverlay("layout");
                        return;
                      case "background":
                        setOverlay("background");
                        return;
                      case "save-layout-template":
                        setOverlay("templates");
                        return;
                      case "reset":
                        Alert.alert(
                          "Reset Profile presentation?",
                          "This clears only this contact’s layout, collapse, and background overrides. Contact data stays unchanged.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Reset",
                              style: "destructive",
                              onPress: () =>
                                void commitAndReload(() =>
                                  resetProfilePresentation(
                                    getExecutor(),
                                    contactId,
                                    localDateTime(),
                                  ),
                                ).then(closeOverlay),
                            },
                          ],
                        );
                    }
                  };
                  return (
                    <Button
                      key={entry}
                      role={entry === "archive" ? "destructive" : "secondary"}
                      label={labels[entry]}
                      onPress={onPress}
                    />
                  );
                })}
              </View>
            </Sheet>
            <Sheet
              visible={overlay === "snooze"}
              onRequestClose={closeOverlay}
              variant="compact"
            >
              <View style={styles.menu}>
                <AppText role="heading">Snooze reminders</AppText>
                {(["3d", "1w", "1m"] as const).map((preset) => (
                  <Button
                    key={preset}
                    role="secondary"
                    label={
                      { "3d": "3 days", "1w": "1 week", "1m": "1 month" }[
                        preset
                      ]
                    }
                    onPress={() => void snooze({ preset }).then(closeOverlay)}
                  />
                ))}
              </View>
            </Sheet>
            <ProfileLayoutEditor
              visible={overlay === "layout"}
              contactId={contactId}
              contactName={snapshot.identity.name}
              effectiveSource={presentation.layout.source}
              layout={presentation.layout.document}
              onRequestClose={closeOverlay}
              onCommitted={() => void load()}
              onSaveAsTemplate={() => setOverlay("templates")}
            />
            <ProfileTemplateManager
              visible={overlay === "templates"}
              contactId={contactId}
              contactName={snapshot.identity.name}
              effectiveSource={presentation.layout.source}
              effectiveLayoutSource={presentation.layout.source}
              freeformLayout={freeformLayout}
              presentation={snapshot.presentation}
              onRequestClose={closeOverlay}
              onCommitted={() => void load()}
            />
            <ProfileBackgroundManager
              visible={overlay === "background"}
              contactId={contactId}
              contactName={snapshot.identity.name}
              presentation={snapshot.presentation}
              onRequestClose={closeOverlay}
              onCommitted={() => void load()}
            />
          </>
        ) : null}
      </View>
    </BackgroundHost>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    gap: SPACING.base,
    padding: SPACING.base,
    paddingBottom: SPACING.xl,
  },
  lifecycle: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
    padding: SPACING.base,
  },
  menu: { gap: SPACING.sm },
  separator: { height: StyleSheet.hairlineWidth },
});
