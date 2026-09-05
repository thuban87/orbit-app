import {
  CONTACT_FREQUENCY_BANDS,
  NEEDS_ATTENTION_VALUE,
  SOCIAL_BATTERY_VALUES,
  type DashboardFilters,
} from "@/logic/dashboard-query-logic";
import { GRAVITY_TIERS } from "@/services/impact";
import { filterOptionLabel } from "./control-labels";

type Category = { id: number; name: string };

/** Returns selected filter labels in the control row's stable display order. */
export function selectedFilterLabels(
  filters: DashboardFilters,
  categories: Category[],
): string[] {
  const categoryNames = new Map(categories.map((category) => [String(category.id), category.name]));
  const selected = (family: keyof DashboardFilters) => filters[family] ?? [];
  const labels: string[] = [];

  for (const id of selected("category")) {
    const name = categoryNames.get(id);
    if (name) labels.push(name);
  }

  for (const value of SOCIAL_BATTERY_VALUES) {
    if (selected("social-battery").includes(value)) {
      labels.push(filterOptionLabel("social-battery", value) ?? value);
    }
  }

  if (selected("needs-attention").includes(NEEDS_ATTENTION_VALUE)) {
    labels.push(filterOptionLabel("needs-attention", NEEDS_ATTENTION_VALUE) ?? NEEDS_ATTENTION_VALUE);
  }

  for (const { name } of GRAVITY_TIERS) {
    if (selected("gravity").includes(name)) {
      labels.push(filterOptionLabel("gravity", name) ?? name);
    }
  }

  for (const value of Object.keys(CONTACT_FREQUENCY_BANDS)) {
    if (selected("contact-frequency").includes(value)) {
      labels.push(filterOptionLabel("contact-frequency", value) ?? value);
    }
  }

  return labels;
}
