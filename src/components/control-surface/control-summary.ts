/** Pure summary formatting for the dashboard control row. */
export function collapseSummary(names: string[], maxShown: number): string {
  if (names.length === 0) return "";
  if (names.length <= maxShown) return names.join(", ");

  return `${names.slice(0, maxShown).join(", ")} +${names.length - maxShown}`;
}
