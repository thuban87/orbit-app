/**
 * 38.12 D-98 reader-by-reader proof: an indefinitely snoozed person
 * (`snooze_until = INDEFINITE_SNOOZE_UNTIL`) is treated exactly like a dated
 * snooze by every snooze reader (38.12 RESEARCH §1 rows 1-12); only the end
 * date is missing. Each case seeds three overdue Bound people — indefinite,
 * dated, and an unsnoozed control — on the full migration chain and asks the
 * reader's public function.
 *
 * The dated snooze sits beyond the notification horizon so the decay-request
 * case compares like with like (both snoozes push the reminder past
 * HORIZON_DAYS, so neither schedules; the control does).
 */
import { scheduleNotificationAsync } from "expo-notifications";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
vi.mock("expo-notifications");

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { updateAppSettings } from "@/db/app-settings-dao";
import {
  countSnoozed,
  listDashboardPopulation,
  readCurrentlySnoozedIds,
} from "@/db/dashboard-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { readOverlooked } from "@/db/digest-read";
import { runMigrations } from "@/db/migrations/runner";
import { INDEFINITE_SNOOZE_UNTIL, isIndefiniteSnooze } from "@/db/snooze-dao";
import type { SqlExecutor } from "@/db/types";
import { readUpNextCandidates } from "@/db/up-next-read";
import { pickerRowMarkers } from "@/logic/contact-picker-order";
import type { DashboardQueryState } from "@/logic/dashboard-query-logic";
import {
  BUILTIN_SYSTEMS,
  buildOrrerySystemWhere,
} from "@/logic/orrery-system-logic";
import {
  type MappedSystemRules,
  resolveCandidateIds,
} from "@/logic/system-rule-resolver";
import { decayIdentifier } from "@/services/notifications/notification-ids";
import {
  __resetReconcileForTest,
  HORIZON_DAYS,
  reconcileSchedule,
} from "@/services/notifications/notification-schedule";
import { formatLocalDate, isSnoozed } from "@/utils/dates";
import { __reset as __resetExpo } from "../../__mocks__/expo-notifications";

const NOW = "2026-10-17 12:00:00";

let exec: SqlExecutor;
let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

/** Local `YYYY-MM-DD` `days` from today (the readers use the real clock). */
function dateOffset(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

const DATED_UNTIL = () => dateOffset(HORIZON_DAYS + 30);

interface Trio {
  indefinite: number;
  dated: number;
  control: number;
}

/**
 * interval 30. The default last contact (200 days ago) is overdue and rogue
 * (progress ≈ 6.7), which Overlooked needs; decay reminders exclude rogue, so
 * the notification case seeds 40 days ago (overdue, decay band).
 */
async function seedContact(
  name: string,
  snoozeUntil: string | null,
  lastContactDaysAgo = 200,
) {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, tracking_enabled, last_contact, snooze_until,
        created_at, modified_at)
     VALUES (?, ?, 30, 1, ?, ?, ?, ?)`,
    [uid(), name, dateOffset(-lastContactDaysAgo), snoozeUntil, NOW, NOW],
  );
  return Number(result.lastInsertRowId);
}

async function seedTrio(lastContactDaysAgo = 200): Promise<Trio> {
  return {
    indefinite: await seedContact(
      "Indefinite",
      INDEFINITE_SNOOZE_UNTIL,
      lastContactDaysAgo,
    ),
    dated: await seedContact("Dated", DATED_UNTIL(), lastContactDaysAgo),
    control: await seedContact("Control", null, lastContactDaysAgo),
  };
}

/** Membership of each trio member in a reader's id list. */
function membership(trio: Trio, ids: readonly number[]) {
  return {
    indefinite: ids.includes(trio.indefinite),
    dated: ids.includes(trio.dated),
    control: ids.includes(trio.control),
  };
}

const SNOOZED_LIKE_DATED = { indefinite: true, dated: true, control: false };
const HIDDEN_LIKE_DATED = { indefinite: false, dated: false, control: true };

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
  __resetExpo();
  __resetReconcileForTest();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("indefinite snooze — every snooze reader agrees with a dated snooze (D-98)", () => {
  const active: DashboardQueryState = {
    viewMode: "list",
    populations: [],
    filters: {},
    sort: "default",
  };

  it("Contacts list: Needs Attention suppresses it and the Snoozed population includes it", async () => {
    const trio = await seedTrio();
    const attention = await listDashboardPopulation(
      exec,
      { ...active, filters: { "needs-attention": ["on"] } },
      NOW,
    );
    expect(
      membership(
        trio,
        attention.map((r) => r.id),
      ),
    ).toEqual(HIDDEN_LIKE_DATED);
    const snoozed = await listDashboardPopulation(
      exec,
      { ...active, populations: ["snoozed"] },
      NOW,
    );
    expect(
      membership(
        trio,
        snoozed.map((r) => r.id),
      ),
    ).toEqual(SNOOZED_LIKE_DATED);
  });

  it("Snoozed count and the bulk sheet's currently-snoozed ids", async () => {
    const trio = await seedTrio();
    expect(await countSnoozed(exec)).toBe(2);
    expect(
      membership(
        trio,
        await readCurrentlySnoozedIds(exec, [
          trio.indefinite,
          trio.dated,
          trio.control,
        ]),
      ),
    ).toEqual(SNOOZED_LIKE_DATED);
  });

  it("the Orrery 'Snoozed' System rule and a custom System's snoozed rule", async () => {
    const trio = await seedTrio();
    const snoozedSystem = BUILTIN_SYSTEMS.find(
      (s) => s.ref.kind === "builtin" && s.ref.id === "snoozed",
    );
    expect(snoozedSystem).toBeDefined();
    const where = buildOrrerySystemWhere(
      snoozedSystem?.ref ?? { kind: "builtin", id: "snoozed" },
    );
    const builtin = await exec.getAllAsync<{ id: number }>(
      `SELECT c.id FROM contacts c WHERE ${where.sql}`,
      where.params as never[],
    );
    expect(
      membership(
        trio,
        builtin.map((r) => r.id),
      ),
    ).toEqual(SNOOZED_LIKE_DATED);

    const mapped: MappedSystemRules = {
      filters: {},
      favorite: false,
      notContacted: false,
      populationScope: false,
      snoozed: true,
      gravityTiers: [],
      broken: [],
    };
    expect(
      membership(
        trio,
        await resolveCandidateIds(exec, mapped, NOW, async () => null),
      ),
    ).toEqual(SNOOZED_LIKE_DATED);
  });

  it("Up next leaves it out", async () => {
    const trio = await seedTrio();
    const rows = await readUpNextCandidates(exec);
    expect(
      membership(
        trio,
        rows.map((r) => r.id),
      ),
    ).toEqual(HIDDEN_LIKE_DATED);
  });

  it("Digest Overlooked leaves it out", async () => {
    const trio = await seedTrio();
    const rows = await readOverlooked(exec);
    expect(
      membership(
        trio,
        rows.map((r) => r.id),
      ),
    ).toEqual(HIDDEN_LIKE_DATED);
  });

  it("decay notifications: no reminder is scheduled within HORIZON_DAYS", async () => {
    const trio = await seedTrio(40);
    await updateAppSettings(exec, { notificationsEnabled: 1 }, NOW);

    await reconcileSchedule(exec);

    const scheduled = vi
      .mocked(scheduleNotificationAsync)
      .mock.calls.map((call) => (call[0] as { identifier: string }).identifier);
    expect({
      indefinite: scheduled.includes(decayIdentifier(trio.indefinite)),
      dated: scheduled.includes(decayIdentifier(trio.dated)),
      control: scheduled.includes(decayIdentifier(trio.control)),
    }).toEqual(HIDDEN_LIKE_DATED);
  });

  it("isSnoozed and the contact picker's Snoozed marker", () => {
    const today = dateOffset(0);
    for (const until of [INDEFINITE_SNOOZE_UNTIL, DATED_UNTIL()]) {
      expect(isSnoozed(until, NOW), until).toBe(true);
      expect(
        pickerRowMarkers(
          {
            id: 1,
            name: "A",
            favourite_rank: null,
            last_contact: null,
            snooze_until: until,
            archived_at: null,
          },
          today,
        ).snoozed,
        until,
      ).toBe(true);
    }
  });
});

describe("isIndefiniteSnooze", () => {
  it("is true only for the exact sentinel", () => {
    expect(isIndefiniteSnooze(INDEFINITE_SNOOZE_UNTIL)).toBe(true);
    expect(isIndefiniteSnooze("9999-12-30")).toBe(false);
    expect(isIndefiniteSnooze("2026-11-01")).toBe(false);
    expect(isIndefiniteSnooze("")).toBe(false);
    expect(isIndefiniteSnooze(null)).toBe(false);
    expect(isIndefiniteSnooze(undefined)).toBe(false);
  });
});
