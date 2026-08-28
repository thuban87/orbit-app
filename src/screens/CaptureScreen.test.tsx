import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { createContactFull } from "@/db/contacts-dao";
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
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-28 12:00:00";
const CAPTURE_SOURCE = readFileSync(
  fileURLToPath(new URL("./CaptureScreen.tsx", import.meta.url)),
  "utf8",
);

let exec: SqlExecutor;
let uidCounter = 0;
const newUid = () => `capture-uid-${++uidCounter}`;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(
    exec,
    [
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
    ],
    11,
    { now: NOW, newUid, defaultPhoneRegion: "US" },
  );
});

describe("CaptureScreen inline create lifecycle contract", () => {
  it("passes the explicit Bound cadence and an empty normalized method list without scalar compatibility inputs", () => {
    const call = CAPTURE_SOURCE.match(
      /createContactFull\(getExecutor\(\),\s*\{(?<input>[\s\S]*?)\n\s*\}\);/,
    );

    expect(call?.groups?.input).toContain(
      "intervalDays: INLINE_CREATE_INTERVAL_DAYS",
    );
    expect(call?.groups?.input).toContain("methodDrafts: []");
    expect(call?.groups?.input).not.toMatch(/\b(phone|email)\s*:/);
  });

  it("persists the inline Bound contract through the v11 default with no methods or contact event", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: newUid(),
      name: "Capture inline",
      intervalDays: 30,
      methodDrafts: [],
      now: NOW,
    });

    expect(
      await exec.getFirstAsync<{
        interval_days: number | null;
        tracking_enabled: number;
        last_contact: string | null;
      }>(
        "SELECT interval_days, tracking_enabled, last_contact FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({
      interval_days: 30,
      tracking_enabled: 1,
      last_contact: null,
    });
    const methods = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM contact_methods WHERE contact_id = ?",
      [contactId],
    );
    const interactions = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM interactions WHERE contact_id = ?",
      [contactId],
    );
    expect(methods?.n).toBe(0);
    expect(interactions?.n).toBe(0);
  });
});
