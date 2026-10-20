/**
 * readResolvedInteractionChannel (38.14 D-59, D-63): the one never-rejecting
 * read every one-tap route uses for its channel. Driven against the real
 * schema over node:sqlite.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  readInteractionChannelPreference,
  readResolvedInteractionChannel,
} from "./resolved-interaction-channel";

const NOW = "2026-10-20 12:00:00";
let uidCounter = 0;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `resolved-uid-${++uidCounter}`,
    defaultPhoneRegion: "US",
  });
});

async function setChannels(
  pref: string,
  remembered: string = "Message",
): Promise<void> {
  await exec.runAsync(
    "UPDATE app_settings SET default_interaction_channel = ?, remembered_interaction_channel = ? WHERE id = 1",
    [pref, remembered],
  );
}

describe("readResolvedInteractionChannel", () => {
  it("returns a fixed preference as is", async () => {
    await setChannels("Call", "In Person");
    await expect(readResolvedInteractionChannel(exec)).resolves.toBe("Call");
  });

  it("reads the remembered channel for Remember last choice", async () => {
    await setChannels("remember", "In Person");
    await expect(readResolvedInteractionChannel(exec)).resolves.toBe(
      "In Person",
    );
  });

  it("falls back to Message for Remember with no remembered value", async () => {
    await setChannels("remember");
    // The column is NOT NULL; a read shape without the value stands in for a
    // corrupted row.
    const noRemembered: ReadOnlyExecutor = {
      ...exec,
      getFirstAsync: (async (sql: string, params?: unknown) => {
        const row = (await exec.getFirstAsync(sql, params as never)) as Record<
          string,
          unknown
        > | null;
        return row ? { ...row, remembered_interaction_channel: null } : row;
      }) as ReadOnlyExecutor["getFirstAsync"],
    };
    await expect(readResolvedInteractionChannel(noRemembered)).resolves.toBe(
      "Message",
    );
  });

  it("falls back to Message and never rejects when the settings row is missing", async () => {
    await exec.runAsync("DELETE FROM app_settings");
    await expect(readResolvedInteractionChannel(exec)).resolves.toBe("Message");
  });

  it("falls back to Message when the read itself throws", async () => {
    const broken: ReadOnlyExecutor = {
      ...exec,
      getFirstAsync: (() => {
        throw new Error("database closed");
      }) as ReadOnlyExecutor["getFirstAsync"],
    };
    await expect(readResolvedInteractionChannel(broken)).resolves.toBe(
      "Message",
    );
  });
});

describe("readInteractionChannelPreference (review A-IN-05)", () => {
  it("returns the stored preference and remembered channel as is", async () => {
    await setChannels("remember", "Call");
    await expect(readInteractionChannelPreference(exec)).resolves.toEqual({
      pref: "remember",
      remembered: "Call",
    });
  });

  it("falls back to Message and never rejects when the read throws", async () => {
    const broken: ReadOnlyExecutor = {
      ...exec,
      getFirstAsync: (() => {
        throw new Error("database closed");
      }) as ReadOnlyExecutor["getFirstAsync"],
    };
    await expect(readInteractionChannelPreference(broken)).resolves.toEqual({
      pref: "Message",
      remembered: null,
    });
  });

  it("single Quick Log on Home and the universal + reads through it", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of [
      "src/screens/HomeScreen.tsx",
      "src/components/UniversalFab.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(
        /readChannelPreference: \(\) =>\s*readInteractionChannelPreference\(getExecutor\(\)\)/,
      );
      expect(source).not.toContain("failed to read channel preference");
    }
  });
});
