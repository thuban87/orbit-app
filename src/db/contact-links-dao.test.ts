/**
 * contact_links child-table CRUD — behavioural proof (CRUD-04).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * (which already ships the `contact_links` table — no migration this phase) and
 * the REAL DAO:
 *   - `addLink` appends at MAX(display_order)+1 per contact (first row → 0);
 *   - `listLinks` returns a contact's links ORDER BY display_order;
 *   - `updateLink`/`removeLink` are scoped by BOTH (id, contact_id) and assert
 *     exactly one change — a mismatched contact_id changes 0 rows → throws
 *     (the WR-04 both-keys precedent);
 *   - `applyLinkDiff` applies a seeded-vs-current diff (INSERT id-less, DELETE
 *     seeded-absent, UPDATE changed) in ONE transaction, and a mid-diff failure
 *     rolls the WHOLE diff back (no partial link state).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  addLink,
  applyLinkDiff,
  type ContactLinkRow,
  listLinks,
  removeLink,
  updateLink,
} from "@/db/contact-links-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-15 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

/** Insert a bare contact row and return its id. */
async function makeContact(name = "Linkable"): Promise<number> {
  const r = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return r.lastInsertRowId;
}

describe("addLink — appends at MAX(display_order)+1 (first row → 0)", () => {
  it("assigns display_order 0 to the first link, then MAX+1", async () => {
    const cid = await makeContact();
    await addLink(exec, {
      uid: uid(),
      contactId: cid,
      url: "https://a.example",
      label: null,
      now: NOW,
    });
    await addLink(exec, {
      uid: uid(),
      contactId: cid,
      url: "https://b.example",
      label: "B",
      now: NOW,
    });
    const links = await listLinks(exec, cid);
    expect(links.map((l) => l.display_order)).toEqual([0, 1]);
    expect(links.map((l) => l.url)).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
    expect(links[1].label).toBe("B");
  });

  it("scopes append order per contact (each contact starts at 0)", async () => {
    const a = await makeContact("A");
    const b = await makeContact("B");
    await addLink(exec, {
      uid: uid(),
      contactId: a,
      url: "https://a1",
      label: null,
      now: NOW,
    });
    await addLink(exec, {
      uid: uid(),
      contactId: b,
      url: "https://b1",
      label: null,
      now: NOW,
    });
    expect((await listLinks(exec, a))[0].display_order).toBe(0);
    expect((await listLinks(exec, b))[0].display_order).toBe(0);
  });
});

describe("listLinks — ORDER BY display_order", () => {
  it("returns links in display_order", async () => {
    const cid = await makeContact();
    for (let i = 0; i < 3; i++) {
      await addLink(exec, {
        uid: uid(),
        contactId: cid,
        url: `https://l${i}`,
        label: null,
        now: NOW,
      });
    }
    const links = await listLinks(exec, cid);
    expect(links.map((l) => l.url)).toEqual([
      "https://l0",
      "https://l1",
      "https://l2",
    ]);
  });
});

describe("updateLink — both-key scoped + assertOneChange (WR-04)", () => {
  it("updates url/label for the matching (id, contact_id)", async () => {
    const cid = await makeContact();
    await addLink(exec, {
      uid: uid(),
      contactId: cid,
      url: "https://old",
      label: null,
      now: NOW,
    });
    const [link] = await listLinks(exec, cid);
    await updateLink(exec, {
      id: link.id,
      contactId: cid,
      url: "https://new",
      label: "New",
      now: NOW,
    });
    const [updated] = await listLinks(exec, cid);
    expect(updated.url).toBe("https://new");
    expect(updated.label).toBe("New");
  });

  it("throws (0 rows) when the contact_id does not match the link's owner", async () => {
    const a = await makeContact("A");
    const b = await makeContact("B");
    await addLink(exec, {
      uid: uid(),
      contactId: a,
      url: "https://a",
      label: null,
      now: NOW,
    });
    const [link] = await listLinks(exec, a);
    await expect(
      updateLink(exec, {
        id: link.id,
        contactId: b, // wrong owner
        url: "https://hijack",
        label: null,
        now: NOW,
      }),
    ).rejects.toThrow();
    // A's link is untouched.
    expect((await listLinks(exec, a))[0].url).toBe("https://a");
  });
});

describe("removeLink — both-key scoped + assertOneChange (WR-04)", () => {
  it("deletes the matching (id, contact_id)", async () => {
    const cid = await makeContact();
    await addLink(exec, {
      uid: uid(),
      contactId: cid,
      url: "https://x",
      label: null,
      now: NOW,
    });
    const [link] = await listLinks(exec, cid);
    await removeLink(exec, { id: link.id, contactId: cid });
    expect(await listLinks(exec, cid)).toEqual([]);
  });

  it("throws (0 rows) when the contact_id does not match the link's owner", async () => {
    const a = await makeContact("A");
    const b = await makeContact("B");
    await addLink(exec, {
      uid: uid(),
      contactId: a,
      url: "https://a",
      label: null,
      now: NOW,
    });
    const [link] = await listLinks(exec, a);
    await expect(
      removeLink(exec, { id: link.id, contactId: b }),
    ).rejects.toThrow();
    expect((await listLinks(exec, a)).length).toBe(1);
  });
});

describe("applyLinkDiff — one atomic seeded-vs-current diff", () => {
  it("INSERTs id-less rows, DELETEs seeded-absent rows, UPDATEs changed rows", async () => {
    const cid = await makeContact();
    // Seed two links.
    await addLink(exec, {
      uid: uid(),
      contactId: cid,
      url: "https://l1",
      label: "one",
      now: NOW,
    });
    await addLink(exec, {
      uid: uid(),
      contactId: cid,
      url: "https://l2",
      label: "two",
      now: NOW,
    });
    const seeded = await listLinks(exec, cid);

    // Current draft: keep L1 with a changed url, drop L2, add a brand-new row.
    const current = [
      {
        id: seeded[0].id,
        uid: seeded[0].uid,
        url: "https://l1-edited",
        label: "one",
      },
      { uid: uid(), url: "https://l3", label: null },
    ];

    await applyLinkDiff(exec, { contactId: cid, seeded, current, now: NOW });

    const after = await listLinks(exec, cid);
    // L1 updated, L2 gone, L3 appended at MAX+1.
    expect(after.map((l) => l.url)).toEqual([
      "https://l1-edited",
      "https://l3",
    ]);
    expect(after[0].label).toBe("one");
    expect(after[1].label).toBeNull();
    // Append order preserved: L3 sits after the surviving L1.
    expect(after[0].display_order).toBeLessThan(after[1].display_order);
  });

  it("rolls the WHOLE diff back on a mid-diff failure (no partial link state)", async () => {
    const cid = await makeContact();
    await addLink(exec, {
      uid: uid(),
      contactId: cid,
      url: "https://real",
      label: null,
      now: NOW,
    });
    const [real] = await listLinks(exec, cid);

    // Seeded claims a PHANTOM link (id 9999) that no longer exists → its DELETE
    // matches 0 rows and throws mid-diff, after a successful INSERT.
    const seeded: ContactLinkRow[] = [
      real,
      {
        id: 9999,
        uid: "phantom",
        url: "https://gone",
        label: null,
        display_order: 1,
      },
    ];
    const current = [{ uid: uid(), url: "https://new", label: null }];

    await expect(
      applyLinkDiff(exec, { contactId: cid, seeded, current, now: NOW }),
    ).rejects.toThrow();

    // Nothing changed: the real link survives and the new insert was rolled back.
    const after = await listLinks(exec, cid);
    expect(after.map((l) => l.url)).toEqual(["https://real"]);
  });
});
