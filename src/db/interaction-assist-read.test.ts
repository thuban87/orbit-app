import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import type { ContactMethodRow } from "@/db/contact-methods-dao";
import { selectActionablePrimaryMethods } from "@/db/contact-methods-read";
import {
  deriveReachRoutes,
  listEligiblePendingAssists,
} from "@/db/interaction-assist-read";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { migration012 } from "@/db/migrations/012-import-sessions";
import { migration013 } from "@/db/migrations/013-reconciliation-and-merge";
import { migration014 } from "@/db/migrations/014-interaction-assists";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-31 12:00:00";
const MIGRATIONS = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
  migration013,
  migration014,
];
let exec: SqlExecutor;
let counter = 0;
const uid = () => `read-${++counter}`;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, 14, { now: NOW, newUid: uid });
});

async function contact(name: string, archived = false): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, archived_at, created_at, modified_at)
     VALUES (?, ?, 30, ?, ?, ?)`,
    [uid(), name, archived ? NOW : null, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function assist(
  contactId: number,
  handoffAt: string,
  createdAt: string,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO interaction_assists
       (uid, contact_id, channel, status, handoff_at, created_at, modified_at)
     VALUES (?, ?, 'call', 'pending', ?, ?, ?)`,
    [uid(), contactId, handoffAt, createdAt, createdAt],
  );
}

function method(overrides: Partial<ContactMethodRow>): ContactMethodRow {
  return {
    id: 1,
    uid: "method-1",
    contact_id: 1,
    method_type: "phone",
    raw_value: "+15551234567",
    display_value: "+15551234567",
    canonical_value: "+15551234567",
    canonical_region: "US",
    extension: null,
    label: null,
    is_actionable: 1,
    is_primary: 1,
    display_order: 0,
    created_at: NOW,
    modified_at: NOW,
    ...overrides,
  };
}

describe("interaction assist queue reads", () => {
  it("returns eligible rows newest-first with archived contact names, and hides purged rows", async () => {
    const archived = await contact("Archived Alex", true);
    const current = await contact("Current Casey");
    const purged = await contact("Purged Pat");
    await assist(archived, "2026-08-31 11:00:00", "2026-08-31 11:00:00");
    await assist(current, "2026-08-31 11:30:00", "2026-08-31 11:30:00");
    await assist(current, "2026-08-31 11:30:00", "2026-08-31 11:30:00");
    await assist(current, "2026-08-31 11:59:50", "2026-08-31 11:59:50");
    await assist(current, "2026-08-30 11:59:59", "2026-08-30 11:59:59");
    await assist(purged, "2026-08-31 11:00:00", "2026-08-31 11:00:00");
    await exec.runAsync("DELETE FROM contacts WHERE id = ?", [purged]);

    const rows = await listEligiblePendingAssists(exec, NOW);

    expect(rows.map((row) => row.contact_name)).toEqual([
      "Current Casey",
      "Current Casey",
      "Archived Alex",
    ]);
    expect(rows.map((row) => row.created_at)).toEqual([
      "2026-08-31 11:30:00",
      "2026-08-31 11:30:00",
      "2026-08-31 11:00:00",
    ]);
    expect(rows[0].id).toBeGreaterThan(rows[1].id);
  });

  it("selects actionable primaries and derives routes with no database read", () => {
    const phone = method({ id: 2, is_primary: 0 });
    const email = method({
      id: 3,
      method_type: "email",
      raw_value: "alex@example.com",
    });
    const actionable = selectActionablePrimaryMethods({
      phone: [method({ is_actionable: 0 }), phone],
      email: [email],
    });

    expect(actionable).toEqual({ phone, email });
    expect(deriveReachRoutes(actionable)).toEqual({
      call: true,
      text: true,
      email: true,
      primaryPhone: phone,
      primaryEmail: email,
      hidden: false,
    });
    expect(deriveReachRoutes({ phone: null, email: null })).toMatchObject({
      call: false,
      text: false,
      email: false,
      hidden: true,
    });
  });
});
