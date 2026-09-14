/** Durable, non-secret AI connection definitions and active-lane pointer. */
import { updateAppSettingsCore } from "@/db/app-settings-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { inWriteTransaction, type ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { AI_PROVIDER_IDS, type AiCloudProviderId } from "@/services/ai-types";

export interface AiConnection {
  id: number;
  uid: string;
  lane: AiCloudProviderId;
  rememberedModel: string;
  customEndpoint: string;
  customModel: string;
  configuredAt: string | null;
  createdAt: string;
  modifiedAt: string;
}

export interface ResolvedAiConnection {
  lane: AiCloudProviderId;
  model: string;
  customEndpoint: string;
}

interface AiConnectionRow {
  id: number;
  uid: string;
  lane: AiCloudProviderId;
  remembered_model: string;
  custom_endpoint: string;
  custom_model: string;
  configured_at: string | null;
  created_at: string;
  modified_at: string;
}

function mapConnection(row: AiConnectionRow): AiConnection {
  return {
    id: row.id,
    uid: row.uid,
    lane: row.lane,
    rememberedModel: row.remembered_model,
    customEndpoint: row.custom_endpoint,
    customModel: row.custom_model,
    configuredAt: row.configured_at ?? null,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };
}

function assertOneChange(operation: string, changes: number): void {
  if (changes !== 1) {
    throw new Error(`${operation}: expected one changed row, got ${changes}`);
  }
}

export async function getAiConnection(
  exec: ReadOnlyExecutor,
  lane: AiCloudProviderId,
): Promise<AiConnection | null> {
  const row = await exec.getFirstAsync<AiConnectionRow>(
    "SELECT * FROM ai_connections WHERE lane = ?",
    [lane],
  );
  return row ? mapConnection(row) : null;
}

export async function listAiConnections(
  exec: ReadOnlyExecutor,
): Promise<AiConnection[]> {
  const rows = await exec.getAllAsync<AiConnectionRow>(
    "SELECT * FROM ai_connections ORDER BY id",
  );
  return rows.map(mapConnection);
}

export function upsertAiConnection(
  exec: SqlExecutor,
  input: {
    lane: AiCloudProviderId;
    rememberedModel: string;
    customEndpoint?: string;
    customModel?: string;
    now: string;
  },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `INSERT INTO ai_connections
         (uid, lane, remembered_model, custom_endpoint, custom_model,
          configured_at, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(lane) DO UPDATE SET
         remembered_model = excluded.remembered_model,
         custom_endpoint = excluded.custom_endpoint,
         custom_model = excluded.custom_model,
         configured_at = excluded.configured_at,
         modified_at = excluded.modified_at`,
      [
        newUid(),
        input.lane,
        input.rememberedModel,
        input.customEndpoint ?? "",
        input.customModel ?? "",
        input.now,
        input.now,
        input.now,
      ],
    );
    assertOneChange("upsertAiConnection", result.changes);
    await bumpDataRevisionCore(exec);
  });
}

export function setRememberedModel(
  exec: SqlExecutor,
  lane: AiCloudProviderId,
  model: string,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE ai_connections SET remembered_model = ?, modified_at = ? WHERE lane = ?",
      [model, now, lane],
    );
    assertOneChange("setRememberedModel", result.changes);
    await bumpDataRevisionCore(exec);
  });
}

export async function getActiveConnectionLane(
  exec: ReadOnlyExecutor,
): Promise<AiCloudProviderId | null> {
  const row = await exec.getFirstAsync<{ ai_active_connection: string }>(
    "SELECT ai_active_connection FROM app_settings WHERE id = 1",
  );
  if (!row)
    throw new Error("getActiveConnectionLane: app_settings id=1 missing");
  const lane = row.ai_active_connection;
  if (
    lane === "" ||
    lane === "none" ||
    !(AI_PROVIDER_IDS as readonly string[]).includes(lane)
  ) {
    return null;
  }
  return lane as AiCloudProviderId;
}

export function activateAiConnection(
  exec: SqlExecutor,
  lane: AiCloudProviderId,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    if (!(await getAiConnection(exec, lane))) {
      throw new Error(`activateAiConnection: ${lane} is not configured`);
    }
    await updateAppSettingsCore(exec, { aiActiveConnection: lane }, now);
    await bumpDataRevisionCore(exec);
  });
}

export async function resolveActiveAiConnection(
  exec: ReadOnlyExecutor,
): Promise<ResolvedAiConnection | null> {
  const lane = await getActiveConnectionLane(exec);
  if (lane === null) return null;
  const connection = await getAiConnection(exec, lane);
  if (!connection) return null;
  return {
    lane: connection.lane,
    model: connection.rememberedModel,
    customEndpoint: connection.customEndpoint,
  };
}
