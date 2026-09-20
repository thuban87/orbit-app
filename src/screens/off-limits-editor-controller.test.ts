import { describe, expect, it, vi } from "vitest";
import type { FuelItem } from "@/db/fuel-read";
import { createOffLimitsEditorController } from "./off-limits-editor-controller";

const contactId = 42;
const row = (id: number, kind: FuelItem["kind"]): FuelItem => ({
  id,
  contact_id: contactId,
  kind,
  label: null,
  text: `${kind}-${id}`,
  url: null,
  created_at: "2026-09-20 12:00:00",
  source: "user",
});

describe("Off Limits editor write-path guard", () => {
  it("forces kind, scopes ids/contact, preserves other fuel, refreshes items, and keeps a failed add draft", async () => {
    const fixture = [
      row(1, "off_limits"),
      row(2, "recent"),
      row(3, "topic"),
      row(4, "fact"),
      row(5, "gift"),
    ];
    const listFuelForEditor = vi.fn(async () => fixture);
    const addFuel = vi.fn(async (input) => {
      fixture.push({
        id: 6,
        contact_id: input.contactId,
        kind: input.kind,
        label: input.label ?? null,
        text: input.text ?? null,
        url: input.url ?? null,
        created_at: input.createdAt,
        source: input.source,
      });
      return 6;
    });
    const editFuel = vi.fn(async (input) => {
      const target = fixture.find((item) => item.id === input.id);
      if (target) Object.assign(target, input);
    });
    const deleteFuel = vi.fn(async (input) => {
      const index = fixture.findIndex((item) => item.id === input.id);
      if (index >= 0) fixture.splice(index, 1);
    });
    const onItems = vi.fn();
    const onError = vi.fn();
    const controller = createOffLimitsEditorController({
      contactId,
      dao: { listFuelForEditor, addFuel, editFuel, deleteFuel },
      now: () => "2026-09-20 12:00:00",
      newUid: () => "new-off-limits",
      onItems,
      onError,
    });

    expect(
      await controller.onAdd({
        kind: "topic",
        label: null,
        text: "Avoid",
        url: null,
      }),
    ).toBe(true);
    await controller.onEdit(1, { kind: "gift", text: "Still avoid" });
    await controller.onDelete(1);
    await controller.onDelete(2);

    expect(addFuel).toHaveBeenCalledWith(
      expect.objectContaining({ contactId, kind: "off_limits" }),
    );
    expect(editFuel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, contactId, kind: "off_limits" }),
    );
    expect(deleteFuel).toHaveBeenCalledWith({
      id: 1,
      contactId,
      now: "2026-09-20 12:00:00",
    });
    expect(deleteFuel).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
    );
    expect(listFuelForEditor.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(onItems).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 6, kind: "off_limits" }),
    ]);
    expect(fixture.filter((item) => item.kind !== "off_limits")).toEqual([
      row(2, "recent"),
      row(3, "topic"),
      row(4, "fact"),
      row(5, "gift"),
    ]);
    expect(onError).toHaveBeenCalled();

    addFuel.mockRejectedValueOnce(new Error("write failed"));
    expect(
      await controller.onAdd({
        kind: "recent",
        label: null,
        text: "Keep draft",
        url: null,
      }),
    ).toBe(false);
    expect(onItems).not.toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ text: "Keep draft" })]),
    );
  });
});
