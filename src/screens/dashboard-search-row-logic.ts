export interface DashboardSearchRowInput {
  id: number;
  name: string;
  trackingEnabled: number;
}

/** Search is retrieval: contacts outside the active orbit stay reachable but neutral. */
export function dashboardSearchRowPresentation(
  rows: readonly DashboardSearchRowInput[],
): Array<{ id: number; neutral: true; accessibilityLabel: string }> {
  return rows
    .filter((row) => row.trackingEnabled === 0)
    .map((row) => ({
      id: row.id,
      neutral: true as const,
      accessibilityLabel: `${row.name}, Unbound`,
    }));
}

export function isNeutralDashboardSearchRow(
  row: Pick<DashboardSearchRowInput, "trackingEnabled">,
): boolean {
  return row.trackingEnabled === 0;
}
