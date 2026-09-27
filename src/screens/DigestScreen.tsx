// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  type HorizonDrillTarget,
  HorizonSection,
} from "@/components/digest/HorizonSection";
import { UpNextSection } from "@/components/digest/UpNextSection";
import { YourWeekSection } from "@/components/digest/YourWeekSection";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { DIGEST } from "@/constants/product-labels";
import {
  type BirthdayCandidate,
  countNeverContacted,
  type DashboardRow,
  listBirthdayCandidates,
  listDashboardPopulation,
} from "@/db/dashboard-read";
import { getExecutor, localDateTime } from "@/db/database";
import { type OverlookedRow, readOverlooked } from "@/db/digest-read";
import {
  readUpNextCandidates,
  type UpNextCandidateRow,
} from "@/db/up-next-read";
import {
  dedupOverlooked,
  filterUpcomingBirthdays,
  neverContactedConditional,
  pickUpNext,
} from "@/logic/digest-composition";
import { navigateIntoTab } from "@/navigation/tab-entry";
import type { DigestStackParamList, TabParamList } from "@/navigation/types";
import {
  createDigestRefreshController,
  type DigestRefreshController,
  type DigestRefreshLoadState,
  digestLoadStateOnFail,
  digestLoadStateOnPublish,
} from "@/screens/digest-refresh";
import { useDashboardQueryStore } from "@/stores/dashboard-query-store";
import {
  useForegroundRefresh,
  useShellRefresh,
} from "@/stores/shell-refresh-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "digest";
const NEVER_CONTACTED_QUERY = {
  viewMode: "list" as const,
  populations: ["not-contacted" as const],
  filters: {},
  sort: "default" as const,
};

interface DigestData {
  upNextCandidates: UpNextCandidateRow[];
  overlooked: OverlookedRow[];
  birthdayCandidates: BirthdayCandidate[];
  neverContactedCount: number;
  neverContactedRows: DashboardRow[];
}

export type DigestLoadState = DigestRefreshLoadState<DigestData>;

/** The five Digest reads, unchanged; one bundle per accepted refresh. */
async function readDigestData(): Promise<DigestData> {
  const exec = getExecutor();
  const now = localDateTime();
  const [
    upNextCandidates,
    overlooked,
    birthdayCandidates,
    neverContactedCount,
    neverContactedRows,
  ] = await Promise.all([
    readUpNextCandidates(exec),
    readOverlooked(exec),
    listBirthdayCandidates(exec),
    countNeverContacted(exec),
    listDashboardPopulation(exec, NEVER_CONTACTED_QUERY, now),
  ]);
  return {
    upNextCandidates,
    overlooked,
    birthdayCandidates,
    neverContactedCount,
    neverContactedRows,
  };
}

interface DrillThroughDeps {
  setPopulationsAndFilters: ReturnType<
    typeof useDashboardQueryStore.getState
  >["setPopulationsAndFilters"];
  navigateToContacts: () => void;
}

/** Persist the complete Contacts query before crossing the tab boundary. */
export async function runDigestDrillThrough(
  target: HorizonDrillTarget,
  deps: DrillThroughDeps,
): Promise<void> {
  const exec = getExecutor();
  if (target === "never-contacted") {
    await deps.setPopulationsAndFilters(exec, ["not-contacted"], {});
  } else {
    await deps.setPopulationsAndFilters(exec, [], {
      "needs-attention": ["on"],
    });
  }
  deps.navigateToContacts();
}

type DigestScreenProps = NativeStackScreenProps<DigestStackParamList, "Digest">;

export function DigestScreen({ navigation }: DigestScreenProps) {
  const [state, setState] = useState<DigestLoadState>({ phase: "loading" });
  // Your Week follows this Digest-owned signal (one trigger owner, RG-026). It
  // bumps on ACCEPTANCE, not success: Your Week owns its own reads and must
  // still re-window on a new day even when the outer read fails (D-13/D-15).
  const [yourWeekSignal, setYourWeekSignal] = useState(0);
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  const controllerRef = useRef<DigestRefreshController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createDigestRefreshController<DigestData>({
      read: readDigestData,
      publish: (data) =>
        setState((current) => digestLoadStateOnPublish(current, data)),
      fail: (cause) => {
        Logger.error(LOG_SCOPE, "failed to load Digest", cause);
        // Nothing loaded → the full error; a loaded body stays mounted with a
        // compact refresh notice (never back to `loading` on a refresh).
        setState((current) => digestLoadStateOnFail(current));
      },
      isVisible: () => isFocusedRef.current,
      onAccepted: () => setYourWeekSignal((signal) => signal + 1),
    });
  }
  const controller = controllerRef.current;

  // D-13: committed in-process writes (Quick Log/Undo, assist, warm
  // notification actions) re-read while Digest stays focused.
  const onShellRefresh = useCallback(() => {
    void controller.request("shell");
  }, [controller]);
  useShellRefresh(onShellRefresh);

  // D-14: every foreground resume re-reads AFTER the launch/foreground sweep
  // settles (post-sweep tick), so Digest reflects its purges and expiry.
  const onForegroundRefresh = useCallback(() => {
    void controller.request("foreground");
  }, [controller]);
  useForegroundRefresh(onForegroundRefresh);

  // Every focus reads; hidden shell/foreground triggers are covered here.
  useFocusEffect(
    useCallback(() => {
      void controller.request("focus");
    }, [controller]),
  );

  // Unmount: nothing outstanding may publish into a dead screen.
  useEffect(() => () => controller.invalidate(), [controller]);

  const onRetry = useCallback(() => {
    void controller.request("focus");
  }, [controller]);

  const onDrillThrough = useCallback(
    (target: HorizonDrillTarget) => {
      const parent =
        navigation.getParent<BottomTabNavigationProp<TabParamList>>();
      void runDigestDrillThrough(target, {
        setPopulationsAndFilters:
          useDashboardQueryStore.getState().setPopulationsAndFilters,
        navigateToContacts: () =>
          navigateIntoTab(parent, "DashboardTab", "Home"),
      }).catch((cause) => {
        Logger.error(LOG_SCOPE, "failed to open Contacts population", cause);
        showSnackbar({
          kind: "error",
          label: "Couldn't open that Contacts view. Try again.",
        });
      });
    },
    [navigation],
  );

  return (
    <DigestContent
      state={state}
      refreshSignal={yourWeekSignal}
      onRetry={onRetry}
      onOpenProfile={(contactId) =>
        navigation.navigate("Profile", { contactId })
      }
      onDrillThrough={onDrillThrough}
    />
  );
}

export function DigestContent({
  state,
  refreshSignal,
  onRetry,
  onOpenProfile,
  onDrillThrough,
}: {
  state: DigestLoadState;
  refreshSignal: number;
  onRetry: () => void;
  onOpenProfile: (contactId: number) => void;
  onDrillThrough: (target: HorizonDrillTarget) => void;
}) {
  const { colors } = useTheme();
  return (
    <View testID="digest-root" style={styles.root}>
      {/* The shared tab-root header row, full-bleed above the padded body in
          every phase (D-23, RG-037 ui-accessibility/AUD-UIA-016). */}
      <ShellAppBar variant="root" title={DIGEST} />
      <View testID="digest-body" style={styles.content}>
        {state.phase === "error" ? (
          <ChromeScrim style={styles.messageScrim} radius={RADII.md}>
            <View testID="digest-error" style={styles.message}>
              <AppText role="heading">Couldn't load your Digest</AppText>
              <AppText role="body" style={{ color: colors.textSecondary }}>
                Try opening it again in a moment.
              </AppText>
            </View>
          </ChromeScrim>
        ) : state.phase === "loaded" ? (
          <>
            {state.refreshError ? (
              <ChromeScrim style={styles.noticeScrim} radius={RADII.md}>
                <View testID="digest-refresh-error" style={styles.notice}>
                  <AppText role="caption" style={{ color: colors.danger }}>
                    Couldn't refresh Up Next and Horizon
                  </AppText>
                  <Button
                    role="tertiary"
                    label="Retry"
                    accessibilityLabel="Retry refreshing Up Next and Horizon"
                    onPress={onRetry}
                  />
                </View>
              </ChromeScrim>
            ) : null}
            <DigestLoadedBody
              data={state.data}
              refreshSignal={refreshSignal}
              onOpenProfile={onOpenProfile}
              onDrillThrough={onDrillThrough}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

export function DigestLoadedBody({
  data,
  refreshSignal,
  onOpenProfile,
  onDrillThrough,
}: {
  data: DigestData;
  refreshSignal: number;
  onOpenProfile: (contactId: number) => void;
  onDrillThrough: (target: HorizonDrillTarget) => void;
}) {
  const upNext = pickUpNext(data.upNextCandidates);
  const upNextIds = upNext.map((row) => row.id);
  const birthdays = filterUpcomingBirthdays(
    data.birthdayCandidates,
    new Date(),
  );
  const overlooked = dedupOverlooked(data.overlooked, upNextIds);
  const never = neverContactedConditional(data.neverContactedCount);

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <UpNextSection candidates={upNext} onOpenProfile={onOpenProfile} />
      <HorizonSection
        birthdays={birthdays}
        overlooked={overlooked}
        neverContactedRows={data.neverContactedRows}
        neverContactedCount={never.count}
        upNextIds={upNextIds}
        onOpenProfile={onOpenProfile}
        onDrillThrough={onDrillThrough}
      />
      <YourWeekSection refreshSignal={refreshSignal} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, padding: SPACING.base, gap: SPACING.md },
  body: { gap: SPACING.lg, paddingBottom: SPACING.base },
  messageScrim: { padding: SPACING.base, overflow: "hidden" },
  noticeScrim: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    overflow: "hidden",
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  message: { gap: SPACING.sm },
});
