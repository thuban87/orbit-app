import { describe, expect, it } from "vitest";
import {
  filterPicker,
  orderPickerRows,
  type PickerOrderRow,
  pickerRowMarkers,
} from "@/logic/contact-picker-order";

const row = (
  overrides: Partial<PickerOrderRow> & Pick<PickerOrderRow, "id" | "name">,
): PickerOrderRow => ({
  favourite_rank: null,
  last_contact: null,
  snooze_until: null,
  archived_at: null,
  ...overrides,
});

describe("contact picker ordering and visibility", () => {
  it("orders favourite membership, then interaction recency, then name", () => {
    const favouriteOlder = row({
      id: 1,
      name: "Zeta",
      favourite_rank: 1,
      last_contact: "2026-08-01 09:00:00",
    });
    const favouriteNewer = row({
      id: 2,
      name: "Alpha",
      favourite_rank: 99,
      last_contact: "2026-08-14 09:00:00",
    });
    const recent = row({
      id: 3,
      name: "Recent",
      last_contact: "2026-08-15 09:00:00",
    });
    const alpha = row({ id: 4, name: "alpha" });
    const beta = row({ id: 5, name: "Beta" });

    expect(
      orderPickerRows([
        favouriteOlder,
        recent,
        beta,
        favouriteNewer,
        alpha,
      ]).map(({ id }) => id),
    ).toEqual([
      favouriteNewer.id,
      favouriteOlder.id,
      recent.id,
      alpha.id,
      beta.id,
    ]);
  });

  it("marks a snoozed row without removing it", () => {
    const snoozed = row({ id: 1, name: "Snoozed", snooze_until: "2026-08-20" });

    expect(pickerRowMarkers(snoozed, "2026-08-15")).toEqual({
      snoozed: true,
      archived: false,
    });
    expect(filterPicker([snoozed], "")).toEqual([snoozed]);
  });

  it("hides archived contacts by default and exposes a matching archived search result", () => {
    const archived = row({
      id: 1,
      name: "Ada Lovelace",
      archived_at: "2026-08-10 10:00:00",
    });
    const live = row({ id: 2, name: "Grace Hopper" });

    expect(filterPicker([archived, live], "")).toEqual([live]);
    expect(filterPicker([archived, live], "ada")).toEqual([archived]);
    expect(pickerRowMarkers(archived, "2026-08-15")).toEqual({
      snoozed: false,
      archived: true,
    });
  });

  it("returns no contacts for a zero-match search", () => {
    expect(filterPicker([row({ id: 1, name: "Ada" })], "nobody")).toEqual([]);
  });
});

describe("filterPicker keepOrder (38.10 D-80, D-30; convergence c11)", () => {
  // Favourites, then share recency: an order orderPickerRows would change,
  // since Older has an older last_contact than Newer but comes first.
  const favourite = row({ id: 1, name: "Fav", favourite_rank: 0 });
  const older = row({
    id: 2,
    name: "Ann Older",
    last_contact: "2026-01-01 09:00:00",
  });
  const newer = row({
    id: 3,
    name: "Ann Newer",
    last_contact: "2026-09-01 09:00:00",
  });
  const never = row({ id: 4, name: "Ann Never" });
  const source = [favourite, older, newer, never];

  it("keeps the source order with an empty term", () => {
    expect(filterPicker(source, "", { keepOrder: true })).toEqual(source);
  });

  it("keeps the source order with a term that matches several rows", () => {
    expect(filterPicker(source, "ann", { keepOrder: true })).toEqual([
      older,
      newer,
      never,
    ]);
  });

  it("reorders as before without the option", () => {
    expect(filterPicker(source, "")).toEqual([favourite, newer, older, never]);
    expect(filterPicker(source, "ann")).toEqual([newer, older, never]);
  });

  it("never offers an archived contact when allowArchived is false, even on a match (T-38.10-35)", () => {
    const archived = row({
      id: 5,
      name: "Ann Archived",
      archived_at: "2026-05-01 09:00:00",
    });
    expect(
      filterPicker([...source, archived], "ann archived", {
        keepOrder: true,
        allowArchived: false,
      }),
    ).toEqual([]);
    expect(
      filterPicker([...source, archived], "ann archived", { keepOrder: true }),
    ).toEqual([archived]);
  });
});
