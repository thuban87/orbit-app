import type { OverflowAction } from "@/components/OverflowMenu";
import { BIN, EVENTS } from "@/constants/glossary";

/** The navigation surface used by Dashboard's fixed overflow destinations. */
export interface DashboardOverflowNavigation {
  navigate: (route: "UnboundContacts" | "Archived") => void;
  openEvents: () => void;
}

interface BuildDashboardOverflowActionsInput {
  navigation: DashboardOverflowNavigation;
  onReset: () => void;
  onSelectContacts: () => void;
  /**
   * Selection mode is on. D-76 hides the controls that change the query while
   * selecting, enforcing ADR-102's frozen universe; the overflow likewise drops
   * Select Contacts and Reset Contacts View, since Reset rewrites the query
   * and clears the search (38.13 review A-WR-02).
   */
  selectionMode: boolean;
}

/**
 * Builds Dashboard's deliberately fixed, five-row overflow menu (three rows
 * while selecting: no Select Contacts or Reset Contacts View).
 *
 * The screen owns persistence and error handling for Reset; this module only
 * translates that callback and navigation targets into presentation actions.
 */
export function buildDashboardOverflowActions({
  navigation,
  onReset,
  onSelectContacts,
  selectionMode,
}: BuildDashboardOverflowActionsInput): OverflowAction[] {
  const destinations: OverflowAction[] = [
    {
      label: EVENTS,
      onPress: navigation.openEvents,
      testID: "dashboard-group-events-overflow-entry",
    },
    {
      label: "Unbound Contacts",
      onPress: () => navigation.navigate("UnboundContacts"),
      testID: "dashboard-unbound-overflow-entry",
    },
    {
      label: BIN,
      onPress: () => navigation.navigate("Archived"),
      testID: "dashboard-archived-overflow-entry",
    },
  ];
  if (selectionMode) return destinations;
  return [
    ...destinations,
    {
      label: "Select Contacts",
      onPress: onSelectContacts,
      testID: "dashboard-select-contacts-entry",
    },
    {
      label: "Reset Contacts View",
      onPress: onReset,
      testID: "dashboard-reset-view-entry",
    },
  ];
}
