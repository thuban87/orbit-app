// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  type HorizonDrillTarget,
  HorizonSection,
} from "@/components/digest/HorizonSection";
import { UpNextSection } from "@/components/digest/UpNextSection";
import { YourWeekSection } from "@/components/digest/YourWeekSection";
import { AppText } from "@/components/ui/AppText";
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
import type { DigestStackParamList, TabParamList } from "@/navigation/types";
import { useDashboardQueryStore } from "@/stores/dashboard-query-store";
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

export type DigestLoadState =
  | { phase: "loading" }
  | { phase: "loaded"; data: DigestData }
  | { phase: "error" };

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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
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
          if (!cancelled) {
            setState({
              phase: "loaded",
              data: {
                upNextCandidates,
                overlooked,
                birthdayCandidates,
                neverContactedCount,
                neverContactedRows,
              },
            });
          }
        } catch (cause) {
          Logger.error(LOG_SCOPE, "failed to load Digest", cause);
          if (!cancelled) setState({ phase: "error" });
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const onDrillThrough = useCallback(
    (target: HorizonDrillTarget) => {
      const parent =
        navigation.getParent<BottomTabNavigationProp<TabParamList>>();
      void runDigestDrillThrough(target, {
        setPopulationsAndFilters:
          useDashboardQueryStore.getState().setPopulationsAndFilters,
        navigateToContacts: () =>
          parent?.navigate("DashboardTab", { screen: "Home" }),
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
      onOpenProfile={(contactId) =>
        navigation.navigate("Profile", { contactId })
      }
      onDrillThrough={onDrillThrough}
    />
  );
}

export function DigestContent({
  state,
  onOpenProfile,
  onDrillThrough,
}: {
  state: DigestLoadState;
  onOpenProfile: (contactId: number) => void;
  onDrillThrough: (target: HorizonDrillTarget) => void;
}) {
  const { colors } = useTheme();
  return (
    <View testID="digest-root" style={styles.root}>
      <ChromeScrim style={styles.header} radius={RADII.md}>
        <AppText accessibilityRole="header" role="display">
          {DIGEST}
        </AppText>
      </ChromeScrim>
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
        <DigestLoadedBody
          data={state.data}
          onOpenProfile={onOpenProfile}
          onDrillThrough={onDrillThrough}
        />
      ) : null}
    </View>
  );
}

export function DigestLoadedBody({
  data,
  onOpenProfile,
  onDrillThrough,
}: {
  data: DigestData;
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
      <YourWeekSection />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: SPACING.base, gap: SPACING.md },
  header: { padding: SPACING.md, overflow: "hidden" },
  body: { gap: SPACING.lg, paddingBottom: SPACING.base },
  messageScrim: { padding: SPACING.base, overflow: "hidden" },
  message: { gap: SPACING.sm },
});
