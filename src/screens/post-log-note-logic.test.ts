import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MEMORY_TYPE_KEY } from "@/db/memory-registry";
import {
  commitThenReReadMemory,
  type PostLogSaveResult,
  resolvePostCreateMemoryTarget,
  resolvePostLogSave,
} from "./post-log-note-logic";

describe("resolvePostLogSave", () => {
  it("note branch seeds the interaction note and creates no memory", () => {
    const result = resolvePostLogSave({
      kind: "note",
      text: "Talked about the new job",
      interactionId: 12,
      interactionExists: true,
    });

    expect(result).toEqual<PostLogSaveResult>({
      target: "note",
      interactionId: 12,
      note: "Talked about the new job",
    });
    // Mutual exclusion: a note result never carries an addMemory intent.
    expect(result).not.toHaveProperty("type");
    expect(result).not.toHaveProperty("value");
  });

  it("memory branch creates a memory of the default type and no note patch", () => {
    const result = resolvePostLogSave({
      kind: "memory",
      text: "Loves hiking",
    });

    expect(result).toEqual<PostLogSaveResult>({
      target: "memory",
      type: DEFAULT_MEMORY_TYPE_KEY,
      value: "Loves hiking",
    });
    // Mutual exclusion: a memory result never carries a note patch.
    expect(result).not.toHaveProperty("note");
    expect(result).not.toHaveProperty("interactionId");
  });

  it("requests the memory by DEFAULT_MEMORY_TYPE_KEY, not a literal name", () => {
    const result = resolvePostLogSave({ kind: "memory", text: "anything" });

    expect(result.target).toBe("memory");
    if (result.target === "memory") {
      expect(result.type).toBe(DEFAULT_MEMORY_TYPE_KEY);
      // Guard against a regression to a hardcoded display name / type ID.
      expect(result.type).not.toBe("Memory");
      expect(result.type).not.toBe("General");
    }
  });

  it("treats empty / whitespace text as a no-op on both branches", () => {
    expect(
      resolvePostLogSave({
        kind: "note",
        text: "   ",
        interactionId: 12,
        interactionExists: true,
      }),
    ).toEqual({ target: "noop" });

    expect(resolvePostLogSave({ kind: "memory", text: "" })).toEqual({
      target: "noop",
    });
  });

  it("returns 'missing' for a note when the interaction was undone/deleted", () => {
    // Add-Note-after-Undo race (Review MEDIUM 34-06): no note patch is produced.
    const result = resolvePostLogSave({
      kind: "note",
      text: "Should not persist",
      interactionId: 12,
      interactionExists: false,
    });

    expect(result).toEqual({ target: "missing" });
    expect(result).not.toHaveProperty("note");
  });

  it("leaves the memory branch unaffected by interaction existence", () => {
    const result = resolvePostLogSave({ kind: "memory", text: "still saves" });
    expect(result.target).toBe("memory");
  });

  it("trims surrounding whitespace from the saved text", () => {
    const note = resolvePostLogSave({
      kind: "note",
      text: "  padded note  ",
      interactionId: 3,
      interactionExists: true,
    });
    expect(note).toMatchObject({ target: "note", note: "padded note" });

    const memory = resolvePostLogSave({ kind: "memory", text: "  padded  " });
    expect(memory).toMatchObject({ target: "memory", value: "padded" });
  });
});

describe("resolvePostCreateMemoryTarget (WR-02)", () => {
  it("offers inline edit when the created Memory is re-read", () => {
    const row = { id: 7, value: "coffee" };
    expect(resolvePostCreateMemoryTarget(row)).toEqual({
      target: "edit",
      row,
    });
  });

  it("closes (never re-opens Add Note) when the re-read misses the fresh row", () => {
    // The addMemory write already committed; a null re-read must NOT route back
    // to the re-submittable Add-Note surface, which would allow a duplicate.
    expect(resolvePostCreateMemoryTarget<null>(null)).toEqual({
      target: "close",
    });
  });
});

describe("commitThenReReadMemory — a committed Memory is never reported as failed (38.3 review B-CR-01, D-04)", () => {
  it("reports write-failed only when the write itself rejects, and never publishes or re-reads", async () => {
    const publish = vi.fn();
    const reRead = vi.fn();
    const outcome = await commitThenReReadMemory({
      write: () => Promise.reject(new Error("disk")),
      publish,
      reRead,
    });
    expect(outcome.kind).toBe("write-failed");
    expect(publish).not.toHaveBeenCalled();
    expect(reRead).not.toHaveBeenCalled();
  });

  it("returns committed with the re-read row on the happy path, publishing before the re-read", async () => {
    const order: string[] = [];
    const outcome = await commitThenReReadMemory({
      write: async () => {
        order.push("write");
        return 7;
      },
      publish: () => order.push("publish"),
      reRead: async (id) => {
        order.push(`reRead:${id}`);
        return { id, value: "coffee" };
      },
    });
    expect(order).toEqual(["write", "publish", "reRead:7"]);
    expect(outcome).toEqual({
      kind: "committed",
      row: { id: 7, value: "coffee" },
    });
  });

  it("returns committed with a null row (never write-failed) when the post-commit re-read throws", async () => {
    const outcome = await commitThenReReadMemory({
      write: async () => 7,
      publish: () => {},
      reRead: () => Promise.reject(new Error("read failed")),
    });
    expect(outcome.kind).toBe("committed");
    if (outcome.kind === "committed") {
      expect(outcome.row).toBeNull();
      expect(outcome.reReadFailed).toBe(true);
    }
    // A null committed row closes the editor — terminal, no re-submittable surface.
    if (outcome.kind === "committed") {
      expect(resolvePostCreateMemoryTarget(outcome.row)).toEqual({
        target: "close",
      });
    }
  });

  it("returns committed even when the publisher throws", async () => {
    const reRead = vi.fn(async () => ({ id: 3 }));
    const outcome = await commitThenReReadMemory({
      write: async () => 3,
      publish: () => {
        throw new Error("publisher");
      },
      reRead,
    });
    expect(outcome).toEqual({ kind: "committed", row: { id: 3 } });
    expect(reRead).toHaveBeenCalledTimes(1);
  });
});
