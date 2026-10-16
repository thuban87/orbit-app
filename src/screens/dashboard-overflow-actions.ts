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
}

/**
 * Builds Dashboard's deliberately fixed, five-row overflow menu.
 *
 * The screen owns persistence and error handling for Reset; this module only
 * translates that callback and navigation targets into presentation actions.
 */
export function buildDashboardOverflowActions({
  navigation,
  onReset,
  onSelectContacts,
}: BuildDashboardOverflowActionsInput): OverflowAction[] {
  return [
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
