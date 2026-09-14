import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  activateAiConnection,
  getActiveConnectionLane,
  listAiConnections,
  resolveActiveAiConnection,
  setRememberedModel,
  upsertAiConnection,
} from "@/db/ai-connections-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-13T10:00:00.000Z";
const LATER = "2026-09-13T11:00:00.000Z";

let db: ReturnType<typeof openTestDb>;
let exec: SqlExecutor;

beforeEach(async () => {
  db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => crypto.randomUUID(),
  });
});

afterEach(() => db.close());

describe("ai-connections-dao — active lane and remembered model", () => {
  it("zero configured and a dangling pointer both resolve to no active connection", async () => {
    expect(await getActiveConnectionLane(exec)).toBeNull();
    expect(await resolveActiveAiConnection(exec)).toBeNull();

    await exec.runAsync(
      "UPDATE app_settings SET ai_active_connection = 'anthropic' WHERE id = 1",
    );
    expect(await getActiveConnectionLane(exec)).toBe("anthropic");
    expect(await resolveActiveAiConnection(exec)).toBeNull();
  });

  it("switches one pointer while retaining each connection's remembered model", async () => {
    await upsertAiConnection(exec, {
      lane: "openai",
      rememberedModel: "model-a",
      now: NOW,
    });
    await activateAiConnection(exec, "openai", NOW);
    expect(await resolveActiveAiConnection(exec)).toMatchObject({
      lane: "openai",
      model: "model-a",
    });

    await upsertAiConnection(exec, {
      lane: "anthropic",
      rememberedModel: "model-b",
      now: LATER,
    });
    await activateAiConnection(exec, "anthropic", LATER);
    expect(await getActiveConnectionLane(exec)).toBe("anthropic");
    expect(await listAiConnections(exec)).toHaveLength(2);

    await setRememberedModel(exec, "openai", "model-a2", LATER);
    await activateAiConnection(exec, "openai", LATER);
    expect(await resolveActiveAiConnection(exec)).toMatchObject({
      lane: "openai",
      model: "model-a2",
    });
    expect(await listAiConnections(exec)).toHaveLength(2);
  });

  it("rolls back activation when the pointer write fails", async () => {
    await upsertAiConnection(exec, {
      lane: "openai",
      rememberedModel: "model-a",
      now: NOW,
    });
    await upsertAiConnection(exec, {
      lane: "anthropic",
      rememberedModel: "model-b",
      now: NOW,
    });
    await activateAiConnection(exec, "openai", NOW);

    const failing = {
      ...exec,
      runAsync: (sql: string, params?: unknown[]) => {
        if (/UPDATE app_settings SET/i.test(sql)) {
          throw new Error("forced pointer failure");
        }
        return exec.runAsync(sql, params);
      },
    } as SqlExecutor;

    await expect(
      activateAiConnection(failing, "anthropic", LATER),
    ).rejects.toThrow("forced pointer failure");
    expect(await getActiveConnectionLane(exec)).toBe("openai");
  });

  it("refuses to activate an unconfigured lane", async () => {
    await expect(activateAiConnection(exec, "google", NOW)).rejects.toThrow(
      /not configured/,
    );
    expect(await getActiveConnectionLane(exec)).toBeNull();
  });
});
