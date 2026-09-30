// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.

import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { Icon } from "@/components/icons/Icon";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { ProfileBackgroundManager } from "@/components/profile/ProfileBackgroundManager";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileLayoutEditor } from "@/components/profile/ProfileLayoutEditor";
import { ProfileModuleHost } from "@/components/profile/ProfileModuleHost";
import { ProfileTemplateManager } from "@/components/profile/ProfileTemplateManager";
import type {
  KnowledgeActionIntent,
  KnowledgeChildId,
} from "@/components/profile/ThingsToRemember";
import { ReachOutRouter } from "@/components/ReachOutRouter";
import { AppText } from "@/components/ui/AppText";
import { BackgroundHost } from "@/components/ui/BackgroundHost";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { getAppSettings } from "@/db/app-settings-dao";
import { archiveContact } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { clearFavouriteRank, setFavouriteRank } from "@/db/favourites-dao";
import { deriveReachRoutes } from "@/db/interaction-assist-read";
import type { CurrentStateFieldKey } from "@/db/memory-registry";
import { resetProfilePresentation } from "@/db/profile-presentation-dao";
import { type ProfileSnapshot, readProfileSnapshot } from "@/db/profile-read";
import {
  setProfileContactFrequency,
  snoozeProfileContact,
  unsnoozeProfileContact,
} from "@/db/profile-relationship-actions";
import type { RootStackScreenProps } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { resolveProfilePresentation } from "@/profile/resolve-presentation";
import type { ProfileLayoutDocument } from "@/profile/types";
import {
  closeTopmostProfileOverlay,
  consumeProfileReachOutIntent,
  createProfileSnapshotLoader,
  PROFILE_APP_BAR,
  PROFILE_APP_BAR_SCRIM_OPACITY,
  PROFILE_APP_BAR_SCROLL_SCRIM,
  type ProfileOverlay,
  profileAppBarScrolled,
  profileKnowledgeDestination,
  profileLifecycleView,
  profileOverflowEntries,
  profileScrollA11yOffset,
  profileScrollContentTopPadding,
  profileScrollTargetY,
  shouldRunProfileShellRefresh,
  unbindConfirmation,
} from "@/screens/contact-profile-logic";
import {
  bindWithLifecycleEffects,
  unbindWithLifecycleEffects,
} from "@/services/contact-lifecycle-effects";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import { resolveBackgroundUri } from "@/services/photos/background-storage";
import { performReachOut } from "@/services/reach-out/handoff";
import {
  useForegroundRefresh,
  useShellRefresh,
} from "@/stores/shell-refresh-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { useReducedMotion } from "@/theme/use-reduced-motion";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "contact-profile";

/**
 * Which navigator hosts this Profile, passed explicitly by the host's route
 * wrapper (no nav-state inference). `"settings"` disables hero Message because
 * Compose is never registered under Settings (D-25, RG-021).
 */
export type ContactProfileHost = "settings";

/**
 * The Profile's top app bar (38.6 D-17): back, then the favourite star, then ⋮.
 * It OVERLAYS the scroll content so the D-04 photo can rise into its middle
 * band; `box-none` passes touches on its empty area through to the photo, and
 * its scroll scrim is `pointerEvents="none"` so a full-bleed backing never
 * swallows a tap or drag on the photo under the bar strip.
 */
export function ProfileAppBar({
  name,
  favourite,
  favouriteDisabled,
  scrolled,
  onBack,
  onToggleFavourite,
  onOpenOverflow,
}: {
  name: string;
  favourite: boolean;
  favouriteDisabled: boolean;
  /** Content is scrolled under the bar (drives the token scrim). */
  scrolled: boolean;
  onBack: () => void;
  onToggleFavourite: () => void;
  onOpenOverflow: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View pointerEvents="box-none" style={styles.appBar}>
      {scrolled ? (
        <View
          testID="profile-app-bar-scrim"
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.appBarScrim,
            { backgroundColor: colors.background },
          ]}
        />
      ) : null}
      <Button
        role="iconOnly"
        icon="back"
        accessibilityLabel="Back"
        onPress={onBack}
      />
      <View style={styles.appBarEnd}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            favourite
              ? `Remove ${name} from Favorites`
              : `Add ${name} to Favorites`
          }
          disabled={favouriteDisabled}
          onPress={onToggleFavourite}
          style={styles.appBarStar}
        >
          <Icon name="favorite" state={favourite ? "active" : "default"} />
        </Pressable>
        <Button
          role="iconOnly"
          icon="overflow"
          accessibilityLabel={`More actions for ${name}`}
          onPress={onOpenOverflow}
        />
      </View>
    </View>
  );
}

/** One local coherent snapshot drives the fixed Hero and resolved module host. */
export function ContactProfileScreen({
  navigation,
  route,
  host,
}: RootStackScreenProps<"Profile"> & { host?: ContactProfileHost }) {
  const { colors, package: themePackage } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  // WR-03: the ScrollView's one-pixel accessibility-order offset.
  const { scale: pixelRatio } = useWindowDimensions();
  const contactId = route.params.contactId;
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<ProfileOverlay>(null);
  const [pendingTemplateLayout, setPendingTemplateLayout] =
    useState<ProfileLayoutDocument | null>(null);
  const [pendingFavourite, setPendingFavourite] = useState(false);
  const [bindIntervalDays, setBindIntervalDays] = useState(30);
  const [bindIntervalValid, setBindIntervalValid] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [reachOutOpen, setReachOutOpen] = useState(false);
  const [assistEnabled, setAssistEnabled] = useState(false);
  // 38.3 RG-021 (D-10): History actions scroll this ScrollView to the
  // in-Profile History section — instant under reduced motion.
  const scrollRef = useRef<ScrollView>(null);
  const reducedMotion = useReducedMotion();
  // 38.6 D-17: the overlay app bar shows its token scrim once content scrolls
  // under it. State changes only on a threshold crossing, never per frame.
  const [barScrolled, setBarScrolled] = useState(false);
  const barScrolledRef = useRef(false);
  const onContentScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = profileAppBarScrolled(event.nativeEvent.contentOffset.y);
      if (next === barScrolledRef.current) return;
      barScrolledRef.current = next;
      setBarScrolled(next);
    },
    [],
  );

  // The Profile is the single invalidation owner for its two projections
  // (38.3 RG-024): every current snapshot publication bumps `historyRevision`,
  // and HistorySection re-reads on it, so metrics and History converge from one
  // trigger. The loader is latest-request gated — an older read never
  // overwrites a newer snapshot or error.
  const [historyRevision, setHistoryRevision] = useState(0);
  const readInputs = useRef({ contactId, themePackage });
  readInputs.current = { contactId, themePackage };
  const [loader] = useState(() =>
    createProfileSnapshotLoader({
      read: () => {
        const { contactId: id, themePackage: pkg } = readInputs.current;
        return Promise.all([
          readProfileSnapshot(getExecutor(), id, {
            now: localDateTime(),
            themeBackground: `theme:${pkg}`,
          }),
          getAppSettings(getExecutor()),
        ]);
      },
      publish: ([next, settings], revision) => {
        setAssistEnabled(settings.interactionAssistEnabled === 1);
        if (!next) {
          setSnapshot(null);
          setError("This contact is no longer available.");
        } else {
          setSnapshot(next);
        }
        setHistoryRevision(revision);
      },
      fail: (cause) => {
        Logger.error(LOG_SCOPE, "failed to load Profile snapshot", cause);
        setError("Couldn't load this contact. Please go back and retry.");
      },
      settle: () => setLoading(false),
    }),
  );
  useEffect(() => () => loader.invalidate(), [loader]);

  // `source` feeds the content-free debug read marker only (38.4 Plan 15,
  // W3/O-1 fan-out measurement; mirrors Home's "dashboard read bundle").
  // biome-ignore lint/correctness/useExhaustiveDependencies: contactId/themePackage re-key the focus read; the loader reads them through `readInputs`.
  const load = useCallback(
    async (source = "local") => {
      Logger.debug(LOG_SCOPE, "profile snapshot read", source);
      setLoading(true);
      setError(null);
      await loader.load();
    },
    [loader, contactId, themePackage],
  );

  // 38.3 VERIFICATION W2 (D-10): a shell tick delivered while the app is
  // backgrounded (warm notification Mark/Snooze) reads nothing; the focus and
  // post-sweep resume reads cover it. Synchronous AppState, never a mirror.
  const onShellRefresh = useCallback(() => {
    if (!shouldRunProfileShellRefresh(AppState.currentState)) return;
    void load("shell");
  }, [load]);
  useShellRefresh(onShellRefresh);
  // D-14: the resume read runs after the launch/foreground sweep settles.
  const onForegroundRefresh = useCallback(
    () => void load("foreground"),
    [load],
  );
  useForegroundRefresh(onForegroundRefresh);
  useFocusEffect(useCallback(() => void load("focus"), [load]));

  const presentation = useMemo(
    () => (snapshot ? resolveProfilePresentation(snapshot.presentation) : null),
    [snapshot],
  );
  const reachRoutes = useMemo(
    () =>
      deriveReachRoutes(
        snapshot?.actionableMethods ?? { phone: null, email: null },
      ),
    [snapshot?.actionableMethods],
  );

  useEffect(() => {
    if (loading || (snapshot && snapshot.identity.id !== contactId)) return;
    const intent = consumeProfileReachOutIntent({
      openReachOut: route.params.openReachOut,
      hasReachRoute: !reachRoutes.hidden,
    });
    if (!intent.clear) return;
    navigation.setParams({ openReachOut: undefined });
    if (intent.open) setReachOutOpen(true);
  }, [
    contactId,
    loading,
    navigation,
    reachRoutes.hidden,
    route.params.openReachOut,
    snapshot,
  ]);
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

  const routeKnowledgeChild = useCallback(
    (id: KnowledgeChildId) => {
      const destination = profileKnowledgeDestination(id);
      switch (destination.screen) {
        case "MemoryHistory":
          navigation.navigate("MemoryHistory", {
            contactId,
            fieldKey: destination.fieldKey,
          });
          return;
        case "OffLimitsEditor":
          navigation.navigate("OffLimitsEditor", { contactId });
          return;
        case "Edit":
          navigation.navigate("Edit", { contactId });
          return;
        case "ThingsToRemember":
          navigation.navigate("ThingsToRemember", { contactId });
      }
    },
    [contactId, navigation],
  );

  const routeKnowledgeAction = useCallback(
    (intent: KnowledgeActionIntent) => {
      if (intent.childId) {
        routeKnowledgeChild(intent.childId);
        return;
      }
      switch (intent.target.owner) {
        case "fuel":
          navigation.navigate("OffLimitsEditor", { contactId });
          return;
        case "relationship":
        case "custom-field":
          navigation.navigate("Edit", { contactId });
          return;
        case "memory":
          navigation.navigate("ThingsToRemember", { contactId });
          return;
        case "current-state": {
          const currentState =
            snapshot?.knowledge.status === "ready"
              ? snapshot.knowledge.data.currentState
              : {};
          const fieldKey = (Object.entries(currentState).find(
            ([, entry]) =>
              entry?.id === intent.target.id ||
              entry?.previous.some(
                (previous) => previous.id === intent.target.id,
              ),
          )?.[0] ?? "last_talked_about") as CurrentStateFieldKey;
          navigation.navigate("MemoryHistory", { contactId, fieldKey });
        }
      }
    },
    [contactId, navigation, routeKnowledgeChild, snapshot],
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
    <BackgroundHost
      density="presentation"
      appOwnedBackgroundUri={backgroundUri}
      readability="profile"
    >
      <View testID="contact-profile-screen" style={styles.root}>
        {snapshot && presentation ? (
          // 38.6 D-17 overlay app bar, first in child order (WR-03) so any
          // index-ordered accessibility traversal reads Back, the star and ⋮
          // before the Profile, as before 38.6; its `zIndex` still draws and
          // hit-tests it above the scroll content. Android sorts by bounds —
          // see profileScrollA11yOffset on the ScrollView. Same parent and
          // top edge as before, so no inset changes.
          <ProfileAppBar
            name={snapshot.identity.name}
            favourite={snapshot.identity.favouriteRank !== null}
            favouriteDisabled={pendingFavourite || lifecycle.kind !== "bound"}
            scrolled={PROFILE_APP_BAR_SCROLL_SCRIM && barScrolled}
            onBack={() => navigation.goBack()}
            onToggleFavourite={() => void toggleFavourite()}
            onOpenOverflow={() => setOverlay("overflow")}
          />
        ) : null}
        <ScrollView
          ref={scrollRef}
          // WR-03: start one pixel below the bar so Android's bounds-sorted
          // accessibility order reads the app bar first.
          style={{ marginTop: profileScrollA11yOffset(pixelRatio) }}
          // Sheets opened from this Profile (e.g. the group title prompt) are
          // React descendants of this ScrollView even though they render in a
          // Modal window; without "handled" its responder capture swallows
          // the first tap on their buttons while the keyboard is up (D-72).
          keyboardShouldPersistTaps="handled"
          onScroll={PROFILE_APP_BAR_SCROLL_SCRIM ? onContentScroll : undefined}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.content,
            // 38.6 D-04: the app bar overlays the content and the photo grows
            // upward into it, keeping the name at its pre-38.6 line. The
            // ScrollView's WR-03 offset is taken out of this padding.
            {
              paddingTop: profileScrollContentTopPadding(pixelRatio),
              paddingBottom: bottomClearance,
            },
          ]}
        >
          {loading && !snapshot ? <AppText>Loading Profile…</AppText> : null}
          {error ? <AppText>{error}</AppText> : null}
          {snapshot && presentation ? (
            <>
              <ProfileHero
                identity={snapshot.identity}
                actionableMethods={snapshot.actionableMethods}
                messageContext={{
                  archived: snapshot.identity.archivedAt !== null,
                  settingsHosted: host === "settings",
                }}
                onOpenPhoto={() => setOverlay("photo")}
                onMessage={() =>
                  navigation.navigate("Compose", {
                    contactId,
                    origin: "profile",
                  })
                }
                onCall={() => {
                  const phone = snapshot.actionableMethods.phone;
                  if (phone) void launchMethod(phone, "call");
                }}
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
              ) : null}
              <ProfileModuleHost
                snapshot={snapshot}
                presentation={presentation}
                todayLocal={todayLocal}
                historyRevision={historyRevision}
                // The overlay app bar would cover a target scrolled to y
                // itself (38.6 D-17), so land it just below the bar.
                onRequestScrollTo={(y) =>
                  scrollRef.current?.scrollTo({
                    y: profileScrollTargetY(y),
                    animated: !reducedMotion,
                  })
                }
                onSetFrequency={setFrequency}
                onSnooze={snooze}
                onUnsnooze={unsnooze}
                onKnowledgeAction={routeKnowledgeAction}
                onKnowledgeViewAll={(intent) => routeKnowledgeChild(intent.id)}
                // Temporal history owns its full add/edit/promote screen; the
                // stable field key remains serializable across every host stack.
                onOpenKnowledgeChange={(fieldKey) =>
                  navigation.navigate("MemoryHistory", { contactId, fieldKey })
                }
                // Custom-field history is managed through the existing complete
                // contact editor, never coerced into a current-state field key.
                onOpenValueHistory={() =>
                  navigation.navigate("Edit", { contactId })
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
              // The Profile action list can contain eight entries. It needs the
              // expanded sheet so the bottom presentation actions stay reachable
              // on a physical phone without clipping below the safe area.
              variant="expanded"
            >
              <View style={styles.menu}>
                <AppText role="heading">Profile actions</AppText>
                {profileOverflowEntries({
                  snoozed,
                  bound: lifecycle.kind === "bound",
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
                    unbind: "Unbind contact",
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
                      case "unbind": {
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
                        return;
                      }
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
                      role={entry === "unbind" ? "destructive" : "secondary"}
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
              onSaveAsTemplate={(draft) => {
                setPendingTemplateLayout(draft);
                setOverlay("templates");
              }}
              onManageTemplates={() => setOverlay("templates")}
            />
            <ProfileTemplateManager
              visible={overlay === "templates"}
              contactId={contactId}
              contactName={snapshot.identity.name}
              effectiveSource={presentation.layout.source}
              effectiveLayoutSource={presentation.layout.source}
              freeformLayout={freeformLayout}
              pendingTemplateLayout={pendingTemplateLayout}
              presentation={snapshot.presentation}
              onRequestClose={() => {
                setPendingTemplateLayout(null);
                closeOverlay();
              }}
              onCommitted={() => void load()}
              onPendingTemplateResolved={() => setPendingTemplateLayout(null)}
            />
            <ProfileBackgroundManager
              visible={overlay === "background"}
              contactId={contactId}
              contactName={snapshot.identity.name}
              onRequestClose={closeOverlay}
              onCommitted={() => void load()}
            />
            <PhotoLightbox
              visible={overlay === "photo"}
              photo={snapshot.identity.photo}
              name={snapshot.identity.name}
              onClose={closeOverlay}
            />
            <ReachOutRouter
              visible={reachOutOpen}
              contactId={contactId}
              routes={reachRoutes}
              methodGroups={snapshot.methods}
              assistEnabled={assistEnabled}
              onClose={() => setReachOutOpen(false)}
            />
          </>
        ) : null}
      </View>
    </BackgroundHost>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  appBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    alignItems: "center",
    flexDirection: "row",
    height: PROFILE_APP_BAR.height,
    justifyContent: "space-between",
    paddingHorizontal: SPACING.base,
  },
  appBarScrim: { opacity: PROFILE_APP_BAR_SCRIM_OPACITY },
  appBarEnd: { alignItems: "center", flexDirection: "row" },
  appBarStar: {
    minWidth: PROFILE_APP_BAR.touchTarget,
    minHeight: PROFILE_APP_BAR.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
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
