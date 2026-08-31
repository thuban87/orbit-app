import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { relinkExternalSource, unlinkExternalSource } from "@/db/reconcile-relink-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-30 12:00:00";
let exec: SqlExecutor;
let uidCount = 0;
const uid = () => `relink-${++uidCount}`;

beforeEach(async () => {
  uidCount = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid: uid });
});

async function contact(name: string): Promise<number> {
  return (await exec.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at)
     VALUES (?, ?, 0, ?, ?)`,
    [uid(), name, NOW, NOW],
  )).lastInsertRowId;
}

async function link(contactId: number, externalContactId: string): Promise<number> {
  return (await exec.runAsync(
    `INSERT INTO external_contact_links
       (uid, contact_id, provider, external_contact_id, is_active, created_at, modified_at)
     VALUES (?, ?, 'android', ?, 1, ?, ?)`,
    [uid(), contactId, externalContactId, NOW, NOW],
  )).lastInsertRowId;
}

describe("reconcile-relink-dao", () => {
  it("retires a stale source before attaching an equal replacement identity", async () => {
    const contactId = await contact("Orbit-owned");
    const staleLinkId = await link(contactId, "vanished-source");

    await expect(relinkExternalSource(exec, {
      contactId, staleLinkId, newProvider: "android", newExternalContactId: "vanished-source", now: NOW,
    })).resolves.toMatchObject({ kind: "relinked" });

    expect(await exec.getAllAsync<{ external_contact_id: string; is_active: number }>(
      "SELECT external_contact_id, is_active FROM external_contact_links WHERE contact_id = ? ORDER BY id", [contactId],
    )).toEqual([
      { external_contact_id: "vanished-source", is_active: 0 },
      { external_contact_id: "vanished-source", is_active: 1 },
    ]);
    expect(await exec.getFirstAsync<{ name: string }>("SELECT name FROM contacts WHERE id = ?", [contactId])).toEqual({ name: "Orbit-owned" });
  });

  it("returns a non-destructive duplicate outcome when another Orbit contact owns the source", async () => {
    const first = await contact("First");
    const second = await contact("Second");
    const staleLinkId = await link(first, "missing");
    await link(second, "already-linked");

    await expect(relinkExternalSource(exec, {
      contactId: first, staleLinkId, newProvider: "android", newExternalContactId: "already-linked", now: NOW,
    })).resolves.toEqual({ kind: "duplicate-active-link", otherContactId: second });

    expect(await exec.getAllAsync<{ contact_id: number; external_contact_id: string; is_active: number }>(
      "SELECT contact_id, external_contact_id, is_active FROM external_contact_links ORDER BY id",
    )).toEqual([
      { contact_id: first, external_contact_id: "missing", is_active: 1 },
      { contact_id: second, external_contact_id: "already-linked", is_active: 1 },
    ]);
  });

  it("unlinks only the stale external source and leaves Orbit-owned data intact", async () => {
    const contactId = await contact("Keep me");
    const staleLinkId = await link(contactId, "missing");
    await unlinkExternalSource(exec, { staleLinkId, now: NOW });

    expect(await exec.getFirstAsync<{ is_active: number }>("SELECT is_active FROM external_contact_links WHERE id = ?", [staleLinkId])).toEqual({ is_active: 0 });
    expect(await exec.getFirstAsync<{ name: string }>("SELECT name FROM contacts WHERE id = ?", [contactId])).toEqual({ name: "Keep me" });
  });
});
