import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every group-event write publishes (38.14 D-27, D-81): after the write
 * commits, `publishInteractionWrite()` tells the widget and bumps the shell
 * refresh, so Home, Profile, History, Digest and the widget converge. This
 * source scan pins each site so a refactor cannot drop one. The seam cases in
 * group-event-refresh.test.ts prove a failed participant write never reaches
 * the call (it sits inside `onCommitted`).
 */
const ROOT = join(__dirname, "..", "..");
const read = (file: string) =>
  readFileSync(join(ROOT, file), "utf8").replace(/\r\n/g, "\n");

const SITES: readonly { file: string; min: number; sites: string }[] = [
  {
    file: "src/screens/GroupEventDetailScreen.tsx",
    min: 4,
    // participant add (onCommitted), participant remove — detach and delete
    // share onCommitted — dissolve, delete event.
    sites: "add, remove (detach + delete), dissolve, delete event",
  },
  {
    file: "src/screens/EditGroupEventScreen.tsx",
    min: 3,
    // Edit Event save, participant add (onCommitted), participant remove
    // (detach + delete, onCommitted).
    sites: "save, add, remove (detach + delete)",
  },
  {
    file: "src/screens/GroupLogScreen.tsx",
    min: 1,
    // after createGroupEvent resolves.
    sites: "Group Log save",
  },
  {
    file: "src/screens/EditParticipantScreen.tsx",
    min: 1,
    // after saveParticipantEdits resolves.
    sites: "participant save",
  },
  {
    file: "src/components/history/HistorySection.tsx",
    min: 1,
    // the conversion's onCreated (Make this an event).
    sites: "convert an interaction into an event",
  },
];

describe("group-event writes publish (38.14 D-27, D-81)", () => {
  it.each(SITES)("$file publishes at $sites", ({ file, min }) => {
    const source = read(file);
    expect(source).toContain(
      'import { publishInteractionWrite } from "@/services/publish-interaction-write";',
    );
    expect(
      source.match(/publishInteractionWrite\(\);/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(min);
  });

  it("the participant seams publish inside onCommitted, never before the write", () => {
    for (const file of [
      "src/screens/GroupEventDetailScreen.tsx",
      "src/screens/EditGroupEventScreen.tsx",
    ]) {
      const source = read(file);
      for (const seam of ["runParticipantAdd({", "runParticipantRemove({"]) {
        const start = source.indexOf(seam);
        expect(start, `${file} ${seam}`).toBeGreaterThan(-1);
        const body = source.slice(
          start,
          source.indexOf("refresh", start + seam.length + 1) + 200,
        );
        const committed = body.indexOf("onCommitted");
        const publish = body.indexOf("publishInteractionWrite();");
        expect(committed, `${file} ${seam} onCommitted`).toBeGreaterThan(-1);
        expect(publish, `${file} ${seam} publish`).toBeGreaterThan(committed);
      }
    }
  });

  it("Edit Event and EditParticipant publish after the awaited save", () => {
    const edit = read("src/screens/EditGroupEventScreen.tsx");
    const save = edit.slice(edit.indexOf("async function saveEvent("));
    expect(save.indexOf("publishInteractionWrite();")).toBeGreaterThan(
      save.indexOf("await updateGroupEvent("),
    );
    const participant = read("src/screens/EditParticipantScreen.tsx");
    expect(participant.indexOf("publishInteractionWrite();")).toBeGreaterThan(
      participant.indexOf("await saveParticipantEdits("),
    );
    const log = read("src/screens/GroupLogScreen.tsx");
    expect(log.indexOf("publishInteractionWrite();")).toBeGreaterThan(
      log.indexOf("await createGroupEvent("),
    );
  });
});
