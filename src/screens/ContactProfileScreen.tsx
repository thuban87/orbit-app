// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.

import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import type { KnowledgeActionIntent } from "@/components/profile/ThingsToRemember";
import { ReachOutRouter } from "@/components/ReachOutRouter";
import { SnoozeSheet } from "@/components/SnoozeSheet";
import { AppText } from "@/components/ui/AppText";
import { BackgroundHost } from "@/components/ui/BackgroundHost";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { MOVE_TO_BIN } from "@/constants/glossary";
import { getAppSettings } from "@/db/app-settings-dao";
import { archiveContact, setContactBirthday } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { clearFavouriteRank, setFavouriteRank } from "@/db/favourites-dao";
import { deriveReachRoutes } from "@/db/interaction-assist-read";
import { getLinkedInteractionRefCore } from "@/db/linked-entry-dao";
import { editMemory } from "@/db/memories-dao";
import { type ProfileSnapshot, readProfileSnapshot } from "@/db/profile-read";
import {
  setProfileContactFrequency,
  snoozeProfileContact,
  unsnoozeProfileContact,
} from "@/db/profile-relationship-actions";
import { editRelationship } from "@/db/relationships-dao";
import { linkedEntryRoute } from "@/logic/linked-entry-route";
import { useBackActsAsDone } from "@/navigation/back-acts-as-done";
import { returnFromProfileToTab } from "@/navigation/flow-host";
import { openBinFromProfile } from "@/navigation/tab-entry";
import type { RootStackScreenProps } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import type { KnowledgeEntryLink } from "@/profile/knowledge-presentation";
import { resolveProfilePresentation } from "@/profile/resolve-presentation";
import { describeCurrentLayout } from "@/profile/template-manager-model";
import type { ProfileLayoutDocument } from "@/profile/types";
import {
  binnedProfileBanner,
  closeTopmostProfileOverlay,
  consumeProfileReachOutIntent,
  createHeroNameTracker,
  createProfileSnapshotLoader,
  editDestination,
  type HeroNameLayoutPart,
  knowledgeNavigateParams,
  PROFILE_APP_BAR,
  PROFILE_APP_BAR_SCROLL_SCRIM,
  type ProfileKnowledgeDestination,
  type ProfileOverlay,
  pinSnackbar,
  pinUndoneSnackbar,
  profileAppBarScrimOpacity,
  profileAppBarScrolled,
  profileAppBarShowsName,
  profileErrorPlacement,
  profileKnowledgeCollectionDestination,
  profileKnowledgeDestination,
  profileKnowledgeEmptyDestination,
  profileLifecycleView,
  profileOverflowEntries,
  profileScrollA11yOffset,
  profileScrollContentTopPadding,
  profileScrollTargetY,
  profileStarView,
  runMoveToBin,
  shouldRunProfileShellRefresh,
  unbindConfirmation,
  unboundStarExplanation,
} from "@/screens/contact-profile-logic";
import {
  bindWithLifecycleEffects,
  unbindWithLifecycleEffects,
} from "@/services/contact-lifecycle-effects";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import { resolveBackgroundUri } from "@/services/photos/background-storage";
import { performReachOut } from "@/services/reach-out/handoff";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { confirm } from "@/stores/confirm-store";
import {
  useForegroundRefresh,
  useShellRefresh,
} from "@/stores/shell-refresh-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { useReducedMotion } from "@/theme/use-reduced-motion";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "contact-profile";

/** The dim of an unavailable control (matches `Button`'s disabled 0.5). */
const UNAVAILABLE_OPACITY = 0.5;

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
  favouriteUnavailable = false,
  favouriteHint,
  scrolled,
  title = null,
  onBack,
  onToggleFavourite,
  onOpenOverflow,
}: {
  name: string;
  favourite: boolean;
  favouriteDisabled: boolean;
  /**
   * The star is unavailable for this person (in the Bin, 38.12 D-34): drawn
   * dimmed (38.9 D-26 via 38.12 D-06).
   */
  favouriteUnavailable?: boolean;
  /** Why the star is unavailable, read by a screen reader (38.12 D-36). */
  favouriteHint?: string;
  /** Content is scrolled under the bar (drives the token scrim). */
  scrolled: boolean;
  /**
   * The person's name once the hero name has scrolled under the bar (38.11
   * D-57); null hides it.
   */
  title?: string | null;
  onBack: () => void;
  onToggleFavourite: () => void;
  onOpenOverflow: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View pointerEvents="box-none" style={styles.appBar}>
      {/* 38.11 D-92: solid while the name shows (the name implies the bar
          is scrolled; it also forces the scrim on), else 0.92 (38.6 D-36). */}
      {scrolled || title !== null ? (
        <View
          testID="profile-app-bar-scrim"
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.background,
              opacity: profileAppBarScrimOpacity(title !== null),
            },
          ]}
        />
      ) : null}
      <Button
        role="iconOnly"
        icon="back"
        accessibilityLabel="Back"
        onPress={onBack}
      />
      {title !== null ? (
        <AppText
          testID="profile-app-bar-title"
          role="heading"
          accessibilityRole="header"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={styles.appBarTitle}
        >
          {title}
        </AppText>
      ) : null}
      <View style={styles.appBarEnd}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            favourite
              ? `Remove ${name} from Favorites`
              : `Add ${name} to Favorites`
          }
          accessibilityHint={favouriteHint}
          disabled={favouriteDisabled}
          onPress={onToggleFavourite}
          style={[
            styles.appBarStar,
            favouriteUnavailable ? styles.unavailable : null,
          ]}
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
  // 38.12 D-110: a Profile a flow opened from Settings (or Phase 39's Digest)
  // carries `returnTab`; header Back, system Back and leaving after Move to
  // Bin return to that tab and pop this Profile off-screen, instead of
  // landing on Contacts Home. Without it, Back stays the native pop.
  const returnTab = route.params.returnTab;
  const leaveProfile = useCallback(() => {
    if (returnTab !== undefined) {
      returnFromProfileToTab(navigation, returnTab);
      return;
    }
    navigation.goBack();
  }, [navigation, returnTab]);
  useBackActsAsDone(leaveProfile, returnTab !== undefined);
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
  // WR-06: the hero photo failed to load (initials showing) — no lightbox entry.
  const [heroPhotoFailed, setHeroPhotoFailed] = useState(false);
  const [assistEnabled, setAssistEnabled] = useState(false);
  // 38.3 RG-021 (D-10): History actions scroll this ScrollView to the
  // in-Profile History section — instant under reduced motion.
  const scrollRef = useRef<ScrollView>(null);
  const reducedMotion = useReducedMotion();
  // 38.6 D-17: the overlay app bar shows its token scrim once content scrolls
  // under it. State changes only on a threshold crossing, never per frame.
  const [barScrolled, setBarScrolled] = useState(false);
  const barScrolledRef = useRef(false);
  // 38.11 D-57: the bar shows the name once the hero name scrolls under it.
  // The same threshold-boolean pattern: state changes only on a crossing.
  const [barShowsName, setBarShowsName] = useState(false);
  const barShowsNameRef = useRef(false);
  const scrollYRef = useRef(0);
  const nameBottomRef = useRef<number | null>(null);
  const [heroNameTracker] = useState(createHeroNameTracker);
  const updateBarName = useCallback(() => {
    const next = profileAppBarShowsName(
      scrollYRef.current,
      nameBottomRef.current,
    );
    if (next === barShowsNameRef.current) return;
    barShowsNameRef.current = next;
    setBarShowsName(next);
  }, []);
  const onHeroNameLayout = useCallback(
    (part: HeroNameLayoutPart, y: number, height: number) => {
      nameBottomRef.current = heroNameTracker.set(part, y, height);
      updateBarName();
    },
    [heroNameTracker, updateBarName],
  );
  // Wired unconditionally (review T-17): the name threshold does not depend on
  // the scrim flag; only the scrim stays behind PROFILE_APP_BAR_SCROLL_SCRIM.
  const onContentScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollYRef.current = y;
      updateBarName();
      const next = profileAppBarScrolled(y);
      if (next === barScrolledRef.current) return;
      barScrolledRef.current = next;
      setBarScrolled(next);
    },
    [updateBarName],
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
  // 38.12 D-93, D-34: a person in the Bin gets the banner and no live actions.
  const archived = snapshot?.identity.archivedAt != null;
  const star = profileStarView({
    favouriteRank: snapshot?.identity.favouriteRank ?? null,
    bound: lifecycle.kind === "bound",
    archived,
    pending: pendingFavourite,
  });
  const todayLocal = formatLocalDate(new Date());
  const snoozed =
    snapshot?.identity.snoozeUntil != null &&
    snapshot.identity.snoozeUntil > todayLocal;
  const freeformLayout =
    presentation?.layout.source === "contact-freeform"
      ? presentation.layout.document
      : null;
  // The layout axis alone (38.11 D-65): Reset in Profile Layout shows when the
  // person has a layout template, their own layout or an open/closed override.
  const hasContactLayoutOverride = Boolean(
    snapshot &&
      (snapshot.presentation.contact.layoutTemplateUid !== null ||
        snapshot.presentation.contact.freeformLayout !== null ||
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

  // Every Profile knowledge route goes through one forwarding step, so
  // openAdd, type, origin, fieldKey and editId all reach their screens.
  const navigateKnowledge = useCallback(
    (destination: ProfileKnowledgeDestination) => {
      const target = knowledgeNavigateParams(destination, contactId);
      if (target === null) return;
      switch (target[0]) {
        case "MemoryHistory":
          navigation.navigate("MemoryHistory", target[1]);
          return;
        case "Memory":
          navigation.navigate("Memory", target[1]);
          return;
        case "SectionEditor":
          navigation.navigate("SectionEditor", target[1]);
          return;
        case "KeyPeopleEditor":
          navigation.navigate("KeyPeopleEditor", target[1]);
          return;
        case "OffLimitsEditor":
          navigation.navigate("OffLimitsEditor", target[1]);
          return;
        case "Edit":
          navigation.navigate("Edit", target[1]);
      }
    },
    [contactId, navigation],
  );

  // D-21, D-22: Pin / Unpin through the scoped partial-patch writers, then a
  // snackbar naming the person with Undo (38.9 D-39/D-46 via D-19).
  const writePin = useCallback(
    async (
      target: KnowledgeActionIntent["target"],
      pinned: boolean,
    ): Promise<boolean> => {
      try {
        const now = localDateTime();
        if (target.owner === "memory") {
          await editMemory(getExecutor(), {
            id: target.id,
            contactId,
            pinned,
            now,
          });
        } else if (target.owner === "relationship") {
          await editRelationship(getExecutor(), {
            id: target.id,
            contactId,
            pinned,
            now,
          });
        } else {
          return false;
        }
      } catch (cause) {
        Logger.error(
          LOG_SCOPE,
          "failed to pin or unpin from the Profile",
          cause,
        );
        return false;
      }
      void load();
      return true;
    },
    [contactId, load],
  );

  const togglePin = useCallback(
    (target: KnowledgeActionIntent["target"], pinned: boolean) => {
      const name = snapshot?.identity.name ?? null;
      void (async () => {
        if (!(await writePin(target, pinned))) {
          showSnackbar({
            kind: "error",
            label: "Couldn't save. Please try again.",
          });
          return;
        }
        showSnackbar({
          kind: "success",
          label: pinSnackbar(pinned, name),
          action: {
            label: "Undo",
            accessibilityLabel: pinned ? "Undo pin" : "Undo unpin",
            onPress: () => {
              void (async () => {
                if (!(await writePin(target, !pinned))) {
                  showSnackbar({
                    kind: "error",
                    label: pinned
                      ? "Couldn't undo the pin."
                      : "Couldn't undo the unpin.",
                  });
                  return;
                }
                showSnackbar({
                  kind: "success",
                  label: pinUndoneSnackbar(pinned, name),
                });
              })();
            },
          },
        });
      })();
    },
    [snapshot?.identity.name, writePin],
  );

  const routeKnowledgeAction = useCallback(
    (intent: KnowledgeActionIntent) => {
      if (intent.childId) {
        // A section-level control: the heading action or an empty "Add …".
        navigateKnowledge(
          intent.affordance === "empty"
            ? profileKnowledgeEmptyDestination(intent.childId)
            : profileKnowledgeDestination(intent.childId),
        );
        return;
      }
      switch (intent.action) {
        case "pin":
        case "unpin":
          togglePin(intent.target, intent.action === "pin");
          return;
        case "edit":
          navigateKnowledge(
            editDestination(
              intent.target,
              snapshot?.knowledge.status === "ready"
                ? snapshot.knowledge.data
                : null,
            ),
          );
      }
    },
    [navigateKnowledge, snapshot, togglePin],
  );

  // D-107: tapping a linked entry opens its interaction.
  const openLinkedEntry = useCallback(
    (link: KnowledgeEntryLink) => {
      void (async () => {
        let target: ReturnType<typeof linkedEntryRoute>;
        try {
          const ref = await getLinkedInteractionRefCore(
            getExecutor(),
            link.interactionId,
          );
          target = linkedEntryRoute(
            ref === null ? null : { ...ref, linkSource: link.linkSource },
          );
        } catch (cause) {
          Logger.error(LOG_SCOPE, "failed to open the interaction", cause);
          return;
        }
        if (target === null) {
          // The interaction is gone; the entry is standalone now.
          void load();
          return;
        }
        switch (target.name) {
          case "GroupEventDetail":
            navigation.navigate("GroupEventDetail", target.params);
            return;
          case "EditParticipant":
            navigation.navigate("EditParticipant", target.params);
            return;
          case "EditInteraction":
            navigation.navigate("EditInteraction", target.params);
            return;
        }
      })();
    },
    [load, navigation],
  );

  const toggleFavourite = useCallback(async () => {
    if (!snapshot) return;
    // 38.12 D-36: an Unbound star explains itself and writes nothing; the
    // dormant rank is kept (D-21).
    if (star.onPress === "explain") {
      // A notice (the `success` accent pill, 38.10 D-132).
      showSnackbar({
        kind: "success",
        label: unboundStarExplanation(snapshot.identity.name),
      });
      return;
    }
    if (pendingFavourite || star.onPress !== "toggle") return;
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
      showSnackbar({
        kind: "error",
        label: "Couldn't update favorite. Please try again.",
      });
    } finally {
      setPendingFavourite(false);
    }
  }, [contactId, load, pendingFavourite, snapshot, star.onPress]);

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

  // 38.11 D-69, D-71 (review U-04): Move to Bin asks first — `runMoveToBin`
  // calls `confirm({ ...binConfirmation(name), destructive: true })` — then
  // archives. The raw write rejects on failure, so the success snackbar can
  // only follow a write that resolved. No Undo snackbar (D-71). Review WR-01:
  // after the write resolves the widget refreshes and the schedule reconciles
  // (its population is live contacts only), so a binned person's reminders
  // stop firing.
  const moveToBin = useCallback(
    (name: string) =>
      runMoveToBin({
        name,
        confirm,
        archive: () =>
          archiveContact(getExecutor(), contactId, localDateTime()),
        afterArchive: () => {
          notifyWidgetDataChanged();
          void reconcileSchedule(getExecutor()).catch((cause) =>
            Logger.error(
              LOG_SCOPE,
              "failed to reconcile after Move to Bin",
              cause,
            ),
          );
        },
        closeOverlay,
        goBack: leaveProfile,
        showSnackbar,
        logError: (cause) =>
          Logger.error(
            LOG_SCOPE,
            "failed to move Profile contact to the Bin",
            cause,
          ),
      }),
    [closeOverlay, contactId, leaveProfile],
  );

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
  // The Birthday sheet (38.11 D-59): one single-column write, then the
  // birthday notification and the widget follow it. A rejection reaches the
  // sheet, which stays open and shows the error.
  const saveBirthday = useCallback(
    async (birthday: string | null) => {
      await commitAndReload(() =>
        setContactBirthday(getExecutor(), {
          contactId,
          birthday,
          now: localDateTime(),
        }),
      );
      void reconcileSchedule(getExecutor()).catch((cause) =>
        Logger.error(LOG_SCOPE, "failed to reconcile birthday", cause),
      );
      notifyWidgetDataChanged();
    },
    [commitAndReload, contactId],
  );

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
        showSnackbar({
          kind: "error",
          label: "Couldn't update contact. Please try again.",
        });
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

  const errorPlacement = profileErrorPlacement(
    error,
    snapshot !== null && presentation !== null,
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
            favourite={star.favourite}
            favouriteDisabled={star.disabled}
            favouriteUnavailable={star.unavailable}
            favouriteHint={
              star.onPress === "explain"
                ? unboundStarExplanation(snapshot.identity.name)
                : undefined
            }
            scrolled={PROFILE_APP_BAR_SCROLL_SCRIM && barScrolled}
            title={barShowsName ? snapshot.identity.name : null}
            onBack={leaveProfile}
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
          onScroll={onContentScroll}
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
          {errorPlacement === "top" ? <AppText>{error}</AppText> : null}
          {snapshot && presentation ? (
            <>
              <ProfileHero
                identity={snapshot.identity}
                actionableMethods={snapshot.actionableMethods}
                methodGroups={snapshot.methods}
                messageContext={{
                  archived: snapshot.identity.archivedAt !== null,
                  settingsHosted: host === "settings",
                }}
                photoOpenable={!heroPhotoFailed}
                onPhotoLoadErrorChange={setHeroPhotoFailed}
                onNameLayout={onHeroNameLayout}
                onOpenPhoto={() => setOverlay("photo")}
                // 38.11 D-63: Edit Contact moved from ⋯ to the Hero.
                onEdit={() => navigation.navigate("Edit", { contactId })}
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
              {errorPlacement === "below-hero" ? (
                // WR-04: a failed refresh over a loaded Profile — kept out of
                // the overlay bar and off the D-04 photo/name lines.
                <AppText testID="profile-refresh-error">{error}</AppText>
              ) : null}
              {archived ? (
                // 38.12 D-93: the binned Profile's banner. Restore and
                // permanent delete live only in the Bin list (D-20), so the
                // banner's one action opens it.
                <View
                  testID="profile-bin-banner"
                  style={[
                    styles.lifecycle,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <AppText role="heading">
                    {binnedProfileBanner(snapshot.identity.name).title}
                  </AppText>
                  <Button
                    role="secondary"
                    label={
                      binnedProfileBanner(snapshot.identity.name).actionLabel
                    }
                    onPress={() => openBinFromProfile(navigation)}
                  />
                </View>
              ) : lifecycle.kind !== "bound" ? (
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
                onSaveBirthday={saveBirthday}
                onKnowledgeAction={routeKnowledgeAction}
                // View all, "See all (N)" and Show hidden have their own
                // destinations (D-75, D-52, D-53); Show hidden is a retarget
                // only (D-71 deferred).
                onKnowledgeViewAll={(intent) =>
                  navigateKnowledge(
                    profileKnowledgeCollectionDestination(intent.id),
                  )
                }
                onOpenLinked={openLinkedEntry}
                // Temporal history owns its full add/edit screen; the stable
                // field key remains serializable across every host stack.
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
              // The Profile action list (up to six entries, 38.11 D-65) keeps
              // the expanded sheet so the bottom presentation actions stay
              // reachable on a physical phone without clipping below the safe
              // area, including at large font sizes.
              variant="expanded"
            >
              <View style={styles.menu}>
                <AppText role="heading">Profile actions</AppText>
                {profileOverflowEntries({
                  bound: lifecycle.kind === "bound",
                  archived,
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
                  // 38.11 D-63/D-65: Edit Contact is on the Hero; Save as
                  // template and Reset live in the Layout and Background sheets.
                  const labels = {
                    // 38.11 D-64: one entry; Unsnooze lives in the sheet.
                    snooze: "Snooze…",
                    unbind: "Unbind contact",
                    // 38.11 D-69: Archive reads Move to Bin.
                    archive: MOVE_TO_BIN,
                    layout: "Profile Layout",
                    background: "Background",
                  } as const;
                  const onPress = () => {
                    switch (entry) {
                      case "snooze":
                        setOverlay("snooze");
                        return;
                      case "unbind": {
                        const confirmation = unbindConfirmation(
                          snapshot.identity.name,
                        );
                        // Unbind stays confirmed (D-09, D-32, ADR-150);
                        // destructive → not dismissable (D-06, ADR-086).
                        void confirm({
                          title: confirmation.title,
                          message: confirmation.message,
                          cancelLabel: "Keep contact bound",
                          confirmLabel: "Unbind contact",
                          destructive: true,
                        }).then((ok) => {
                          if (ok) void transitionLifecycle("unbind");
                        });
                        return;
                      }
                      case "archive":
                        void moveToBin(snapshot.identity.name);
                        return;
                      case "layout":
                        setOverlay("layout");
                        return;
                      case "background":
                        setOverlay("background");
                        return;
                    }
                  };
                  return (
                    <Button
                      key={entry}
                      // 38.11 D-68: Unbind is plain (its confirm stays);
                      // D-69: Move to Bin is red with the warning glyph.
                      role={entry === "archive" ? "destructive" : "secondary"}
                      label={labels[entry]}
                      onPress={onPress}
                    />
                  );
                })}
              </View>
            </Sheet>
            <SnoozeSheet
              // 38.11 D-45, D-64 (review T-06, X-01): the ⋯ "Snooze…" entry
              // opens the same sheet as the Overview tile, wired to the same
              // snooze / unsnooze callbacks; Undo maps onto them too.
              visible={overlay === "snooze"}
              title={`Snooze ${snapshot.identity.name}`}
              snoozedUntil={snoozed ? snapshot.identity.snoozeUntil : null}
              showUnsnooze={snoozed}
              todayLocal={todayLocal}
              onPreset={(preset) => snooze({ preset })}
              onUntil={(until) => snooze({ until })}
              onUnsnooze={unsnooze}
              confirmName={snapshot.identity.name}
              onRestore={(previousUntil) =>
                previousUntil ? snooze({ until: previousUntil }) : unsnooze()
              }
              onClose={closeOverlay}
            />
            <ProfileLayoutEditor
              visible={overlay === "layout"}
              contactId={contactId}
              contactName={snapshot.identity.name}
              // 38.11-13: plain words, never the raw source id.
              currentLayout={describeCurrentLayout(
                presentation.layout.source,
                null,
              )}
              layout={presentation.layout.document}
              onRequestClose={closeOverlay}
              onCommitted={() => void load()}
              onSaveAsTemplate={(draft) => {
                setPendingTemplateLayout(draft);
                setOverlay("templates");
              }}
              onManageTemplates={() => setOverlay("templates")}
              hasLayoutOverride={hasContactLayoutOverride}
            />
            <ProfileTemplateManager
              visible={overlay === "templates"}
              contactId={contactId}
              contactName={snapshot.identity.name}
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
              contactBackgroundTemplateUid={
                snapshot.presentation.contact.backgroundTemplateUid
              }
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
  appBarEnd: { alignItems: "center", flexDirection: "row" },
  // Between Back and the star; shrinks and ellipsizes on a long name.
  appBarTitle: { flex: 1, marginHorizontal: SPACING.sm },
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
  // 38.9 D-26 via 38.12 D-06: an unavailable control is dimmed.
  unavailable: { opacity: UNAVAILABLE_OPACITY },
  separator: { height: StyleSheet.hairlineWidth },
});
