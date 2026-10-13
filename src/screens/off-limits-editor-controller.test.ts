/**
 * Off Limits editor write boundary (38.10 plan 15; D-11 re-expressed against
 * the off_limits DAO, D-69 delete + Undo). The fakes model the table across
 * two contacts so the cross-contact cases are real: a foreign or unknown id is
 * refused before any write, the other contact's rows are untouched, every
 * successful write triggers a reload, and a failed add keeps the draft.
 */
import { describe, expect, it, vi } from "vitest";
import type {
  EditOffLimitsInput,
  NewOffLimitsInput,
  OffLimitsSnapshot,
} from "@/db/off-limits-dao";
import type { OffLimitsRow } from "@/db/off-limits-read";
import {
  createOffLimitsEditorController,
  OffLimitsScopeError,
  offLimitsAddedSnackbar,
  offLimitsDeletedSnackbar,
  offLimitsRestoredSnackbar,
  offLimitsSavedSnackbar,
} from "./off-limits-editor-controller";

const CONTACT = 42;
const OTHER = 7;
const NOW = "2026-10-13 12:00:00";

function row(id: number, contactId: number, text: string): OffLimitsRow {
  return {
    id,
    uid: `uid-${id}`,
    contact_id: contactId,
    label: null,
    text,
    url: null,
    group_note_copy: 0,
    from_share: 0,
    created_at: "2026-10-01 09:00:00",
    modified_at: "2026-10-01 09:00:00",
  };
}

/** An in-memory off_limits table across two contacts, scoped like the DAO. */
function fakeTable() {
  const rows: OffLimitsRow[] = [
    row(1, CONTACT, "Their divorce"),
    row(2, OTHER, "Other contact's item"),
    row(3, CONTACT, "Work"),
  ];
  let nextId = 10;
  const list = vi.fn(async (contactId: number) =>
    rows.filter((r) => r.contact_id === contactId).map((r) => ({ ...r })),
  );
  const add = vi.fn(async (input: NewOffLimitsInput) => {
    const id = nextId++;
    rows.push({
      ...row(id, input.contactId, input.text ?? ""),
      uid: input.uid,
      label: input.label ?? null,
      text: input.text ?? null,
      url: input.url ?? null,
      created_at: input.now,
      modified_at: input.now,
    });
    return id;
  });
  const edit = vi.fn(async (input: EditOffLimitsInput) => {
    const target = rows.find(
      (r) => r.id === input.id && r.contact_id === input.contactId,
    );
    if (!target) throw new Error("no row");
    if (input.text !== undefined) target.text = input.text;
    if (input.label !== undefined) target.label = input.label;
    if (input.url !== undefined) target.url = input.url;
  });
  const del = vi.fn(
    async (input: {
      id: number;
      contactId: number;
      now: string;
    }): Promise<OffLimitsSnapshot> => {
      const index = rows.findIndex(
        (r) => r.id === input.id && r.contact_id === input.contactId,
      );
      if (index < 0) throw new Error("no row");
      const [removed] = rows.splice(index, 1);
      return { ...removed, tombstoned_at: input.now };
    },
  );
  const undo = vi.fn(async (snapshot: OffLimitsSnapshot) => {
    const { tombstoned_at: _stamp, ...restored } = snapshot;
    rows.push(restored);
    return snapshot.id;
  });
  return { rows, dao: { list, add, edit, delete: del, undo } };
}

function setup() {
  const table = fakeTable();
  const onChanged = vi.fn();
  const onError = vi.fn();
  const controller = createOffLimitsEditorController({
    contactId: CONTACT,
    dao: table.dao,
    now: () => NOW,
    newUid: () => "new-uid",
    onChanged,
    onError,
  });
  return { ...table, onChanged, onError, controller };
}

const fields = (text: string) => ({ text, label: null, url: null });

describe("Off Limits editor write boundary (D-11 against off_limits)", () => {
  it("lists only this contact's rows", async () => {
    const { controller } = setup();
    expect((await controller.list()).map((r) => r.id)).toEqual([1, 3]);
  });

  it("refuses a foreign-contact id for edit and delete, before any write", async () => {
    const { controller, dao, onError, onChanged, rows } = setup();
    expect(await controller.onEdit(2, fields("Hijack"))).toBe(false);
    expect(await controller.onDelete(2)).toBeNull();
    expect(dao.edit).not.toHaveBeenCalled();
    expect(dao.delete).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(OffLimitsScopeError);
    expect(onError.mock.calls[0]?.[1]).toBe("edit");
    expect(onError.mock.calls[1]?.[1]).toBe("delete");
    expect(rows.find((r) => r.id === 2)?.text).toBe("Other contact's item");
  });

  it("refuses an unknown or invalid id", async () => {
    const { controller, dao, onError } = setup();
    expect(await controller.onEdit(999, fields("x"))).toBe(false);
    expect(await controller.onDelete(999)).toBeNull();
    expect(await controller.onDelete(0)).toBeNull();
    expect(await controller.onEdit(1.5, fields("x"))).toBe(false);
    expect(dao.edit).not.toHaveBeenCalled();
    expect(dao.delete).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(4);
  });

  it("re-reads the collection before every edit and delete", async () => {
    const { controller, dao } = setup();
    await controller.onEdit(1, fields("Edited"));
    expect(dao.list).toHaveBeenCalledTimes(1);
    await controller.onDelete(3);
    expect(dao.list).toHaveBeenCalledTimes(2);
  });

  it("writes scoped to this contact, leaves the other contact's rows untouched and reloads after each write", async () => {
    const { controller, dao, onChanged, rows } = setup();
    const before = rows.filter((r) => r.contact_id === OTHER);

    expect(
      await controller.onAdd({ text: "Politics", label: "Topic", url: null }),
    ).toBe(true);
    expect(dao.add).toHaveBeenCalledWith({
      uid: "new-uid",
      contactId: CONTACT,
      text: "Politics",
      label: "Topic",
      url: null,
      now: NOW,
    });
    expect(onChanged).toHaveBeenCalledTimes(1);

    expect(
      await controller.onEdit(1, {
        text: "Edited",
        label: null,
        url: "https://example.com",
      }),
    ).toBe(true);
    expect(dao.edit).toHaveBeenCalledWith({
      id: 1,
      contactId: CONTACT,
      text: "Edited",
      label: null,
      url: "https://example.com",
      now: NOW,
    });
    expect(onChanged).toHaveBeenCalledTimes(2);

    const snapshot = await controller.onDelete(3);
    expect(snapshot).toMatchObject({
      id: 3,
      contact_id: CONTACT,
      text: "Work",
    });
    expect(dao.delete).toHaveBeenCalledWith({
      id: 3,
      contactId: CONTACT,
      now: NOW,
    });
    expect(onChanged).toHaveBeenCalledTimes(3);

    expect(rows.filter((r) => r.contact_id === OTHER)).toEqual(before);
  });

  it("Undo puts this contact's deleted row back and reloads", async () => {
    const { controller, dao, onChanged, rows } = setup();
    const snapshot = await controller.onDelete(1);
    if (snapshot === null) throw new Error("expected a snapshot");
    expect(rows.some((r) => r.id === 1)).toBe(false);
    expect(await controller.onUndo(snapshot)).toBe(true);
    expect(dao.undo).toHaveBeenCalledWith(snapshot, NOW);
    expect(rows.find((r) => r.id === 1)?.text).toBe("Their divorce");
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it("Undo refuses another contact's snapshot", async () => {
    const { controller, dao, onError, onChanged } = setup();
    const foreign: OffLimitsSnapshot = {
      ...row(2, OTHER, "Other contact's item"),
      tombstoned_at: NOW,
    };
    expect(await controller.onUndo(foreign)).toBe(false);
    expect(dao.undo).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.any(OffLimitsScopeError),
      "undo",
    );
  });

  it("a failed add reports, returns false so the form keeps its draft, and does not reload", async () => {
    const { controller, dao, onError, onChanged, rows } = setup();
    dao.add.mockRejectedValueOnce(new Error("write failed"));
    expect(await controller.onAdd(fields("Keep draft"))).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "add");
    expect(onChanged).not.toHaveBeenCalled();
    expect(rows.some((r) => r.text === "Keep draft")).toBe(false);
  });

  it("a failed edit returns false and does not reload", async () => {
    const { controller, dao, onError, onChanged } = setup();
    dao.edit.mockRejectedValueOnce(new Error("write failed"));
    expect(await controller.onEdit(1, fields("x"))).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "edit");
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("Off Limits snackbars (proposed wording, plan-19 review; F-U8)", () => {
  it("delete is verb first and names the person", () => {
    expect(offLimitsDeletedSnackbar("Ann")).toBe(
      "Deleted Off Limits item for Ann",
    );
    expect(offLimitsDeletedSnackbar(null)).toBe("Deleted Off Limits item");
  });

  it("Undo confirms the restore, naming the person", () => {
    expect(offLimitsRestoredSnackbar("Ann")).toBe(
      "Off Limits item restored for Ann",
    );
    expect(offLimitsRestoredSnackbar("  ")).toBe("Off Limits item restored");
  });

  it("add and save name the person", () => {
    expect(offLimitsAddedSnackbar("Ann")).toBe("Added Off Limits item for Ann");
    expect(offLimitsSavedSnackbar("Ann")).toBe("Saved Off Limits item for Ann");
  });
});
