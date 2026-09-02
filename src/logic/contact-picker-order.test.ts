import { describe, expect, it } from "vitest";
import {
  filterPicker,
  orderPickerRows,
  pickerRowMarkers,
  type PickerOrderRow,
} from "@/logic/contact-picker-order";

const row = (overrides: Partial<PickerOrderRow> & Pick<PickerOrderRow, "id" | "name">): PickerOrderRow => ({
  favourite_rank: null,
  last_contact: null,
  snooze_until: null,
  archived_at: null,
  ...overrides,
});

describe("contact picker ordering and visibility", () => {
  it("orders favourite membership, then interaction recency, then name", () => {
    const favouriteOlder = row({ id: 1, name: "Zeta", favourite_rank: 1, last_contact: "2026-08-01 09:00:00" });
    const favouriteNewer = row({ id: 2, name: "Alpha", favourite_rank: 99, last_contact: "2026-08-14 09:00:00" });
    const recent = row({ id: 3, name: "Recent", last_contact: "2026-08-15 09:00:00" });
    const alpha = row({ id: 4, name: "alpha" });
    const beta = row({ id: 5, name: "Beta" });

    expect(orderPickerRows([favouriteOlder, recent, beta, favouriteNewer, alpha]).map(({ id }) => id)).toEqual([
      favouriteNewer.id,
      favouriteOlder.id,
      recent.id,
      alpha.id,
      beta.id,
    ]);
  });

  it("marks a snoozed row without removing it", () => {
    const snoozed = row({ id: 1, name: "Snoozed", snooze_until: "2026-08-20" });

    expect(pickerRowMarkers(snoozed, "2026-08-15")).toEqual({ snoozed: true, archived: false });
    expect(filterPicker([snoozed], "")).toEqual([snoozed]);
  });

  it("hides archived contacts by default and exposes a matching archived search result", () => {
    const archived = row({ id: 1, name: "Ada Lovelace", archived_at: "2026-08-10 10:00:00" });
    const live = row({ id: 2, name: "Grace Hopper" });

    expect(filterPicker([archived, live], "")).toEqual([live]);
    expect(filterPicker([archived, live], "ada")).toEqual([archived]);
    expect(pickerRowMarkers(archived, "2026-08-15")).toEqual({ snoozed: false, archived: true });
  });

  it("returns no contacts for a zero-match search", () => {
    expect(filterPicker([row({ id: 1, name: "Ada" })], "nobody")).toEqual([]);
  });
});
