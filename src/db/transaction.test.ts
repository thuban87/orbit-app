import { describe, expect, it } from "vitest";
import { inReadSnapshot, inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

function executor(log: string[]): SqlExecutor {
  return {
    async execAsync(sql) { log.push(sql); },
    async runAsync(sql) { log.push(sql); return { lastInsertRowId: 0, changes: 1 }; },
    async getFirstAsync() { return null; },
    async getAllAsync() { return []; },
  };
}

describe("inReadSnapshot", () => {
  it("serializes a concurrent write behind its full read snapshot", async () => {
    const log: string[] = [];
    const exec = executor(log);
    let release!: () => void;
    const paused = new Promise<void>((resolve) => { release = resolve; });
    const read = inReadSnapshot(exec, async () => { await paused; });
    const write = inWriteTransaction(exec, async () => { await exec.runAsync("WRITE"); });
    await Promise.resolve();
    expect(log).toEqual(["BEGIN"]);
    release();
    await Promise.all([read, write]);
    expect(log).toEqual(["BEGIN", "COMMIT", "BEGIN", "WRITE", "COMMIT"]);
  });
});
