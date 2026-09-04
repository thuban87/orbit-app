/** Mutexed writer for typed Memory rows. */
import {
  MEMORY_TYPE_REGISTRY,
  type MemoryTypeKey,
} from "@/db/memory-registry";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

export type MemoryProvenance = "user" | "import" | "share";

export interface NewMemoryInput {
  contactId: number;
  /** Runtime validation protects direct callers and future deserializers. */
  type: string;
  customLabel?: string | null;
  value?: string | null;
  note?: string | null;
  url?: string | null;
  meaningfulDate?: string | null;
  pinned?: boolean;
  outdated?: boolean;
  hidden?: boolean | null;
  provenance?: MemoryProvenance;
  createdAt: string;
  now: string;
}

function normalizeOptional(value: string | null | undefined): string | null {
  return value === undefined || value === null || value.trim().length === 0
    ? null
    : value;
}

export function assertRegisteredMemoryType(
  type: string,
): asserts type is MemoryTypeKey {
  if (!Object.hasOwn(MEMORY_TYPE_REGISTRY, type)) {
    throw new Error("memories-dao: unregistered memory type");
  }
}

function assertCustomLabel(
  type: MemoryTypeKey,
  customLabel: string | null,
): void {
  if (type === "custom" && customLabel === null) {
    throw new Error("memories-dao: custom memory requires a label");
  }
}

/**
 * Insert one row while the caller owns the shared transaction. This core never
 * opens a mutexed transaction, preserving the non-reentrant composition rule.
 */
export async function addMemoryCore(
  exec: SqlExecutor,
  input: NewMemoryInput,
): Promise<number> {
  assertRegisteredMemoryType(input.type);
  const customLabel = normalizeOptional(input.customLabel);
  assertCustomLabel(input.type, customLabel);

  const result = await exec.runAsync(
    `INSERT INTO memories
       (uid, contact_id, type, custom_label, value, note, url, meaningful_date,
        pinned, outdated, hidden, provenance, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUid(),
      input.contactId,
      input.type,
      customLabel,
      normalizeOptional(input.value),
      normalizeOptional(input.note),
      normalizeOptional(input.url),
      normalizeOptional(input.meaningfulDate),
      input.pinned ? 1 : 0,
      input.outdated ? 1 : 0,
      input.hidden === null || input.hidden === undefined ? null : input.hidden ? 1 : 0,
      input.provenance ?? "user",
      input.createdAt,
      input.now,
    ],
  );
  return result.lastInsertRowId;
}

/** Insert one Memory and mark the database dirty for backup inside one mutex. */
export function addMemory(
  exec: SqlExecutor,
  input: NewMemoryInput,
): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await addMemoryCore(exec, input);
    await bumpDataRevisionCore(exec);
    return id;
  });
}
