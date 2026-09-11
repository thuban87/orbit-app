import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { remapLegacyChannel } from "@/db/interaction-vocabulary";
import { rejectFutureOccurredAt } from "@/db/log-guards";
import {
  insertInteractionCore,
  recomputeLastContactCore,
} from "@/db/recency-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

export type InteractionAssistChannel = "call" | "text" | "email";

type PendingAssistRow = {
  id: number;
  contact_id: number;
  channel: InteractionAssistChannel;
  handoff_at: string;
  status: "pending" | "logged" | "dismissed" | "expired" | "failed";
};

const ASSIST_SELECT = `SELECT id, contact_id, channel, handoff_at, status
  FROM interaction_assists
 WHERE uid = ?`;

/** Persist a pending native handoff, retaining at most the five newest pending rows. */
export function createPendingAssist(
  exec: SqlExecutor,
  input: {
    contactId: number;
    channel: InteractionAssistChannel;
    endpointValue: string | null;
    now: string;
  },
): Promise<string> {
  return inWriteTransaction(exec, async () => {
    const uid = newUid();
    await exec.runAsync(
      `INSERT INTO interaction_assists
         (uid, contact_id, channel, endpoint_value, status, handoff_at, created_at, modified_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        uid,
        input.contactId,
        input.channel,
        input.endpointValue,
        input.now,
        input.now,
        input.now,
      ],
    );
    await exec.runAsync(
      `UPDATE interaction_assists
          SET status = 'expired', resolved_at = ?, modified_at = ?
        WHERE status = 'pending'
          AND id NOT IN (
            SELECT id
              FROM interaction_assists
             WHERE status = 'pending'
             ORDER BY created_at DESC, id DESC
             LIMIT 5
          )`,
      [input.now, input.now],
    );
    return uid;
  });
}

/**
 * Confirm an assist through the recency DAO's non-mutexed cores in one atomic
 * transaction. The pre-read only applies the LOG-06 guard; writes use the row
 * re-read inside the transaction so merges and purges cannot leave a stale FK.
 */
export function markAssistLogged(
  exec: SqlExecutor,
  input: {
    assistUid: string;
    connected: 0 | 1;
    note?: string | null;
    now: string;
  },
): Promise<void> {
  return (async () => {
    const assist = await exec.getFirstAsync<PendingAssistRow>(ASSIST_SELECT, [
      input.assistUid,
    ]);
    if (assist?.status !== "pending") return;

    // Match every sibling interaction writer: validate before opening a txn.
    rejectFutureOccurredAt(assist.handoff_at, input.now);

    await inWriteTransaction(exec, async () => {
      const transactionAssist = await exec.getFirstAsync<PendingAssistRow>(
        ASSIST_SELECT,
        [input.assistUid],
      );
      if (transactionAssist?.status !== "pending") return;

      await insertInteractionCore(
        exec,
        transactionAssist.contact_id,
        input.now,
        {
          uid: newUid(),
          occurredAt: transactionAssist.handoff_at,
          // Route the assist TRANSPORT channel through the single shared vocabulary
          // map (D-06): call->Call, text->Message, AND email->Message. The 014
          // transport CHECK permits 'email', so without this remap an email assist
          // would persist a retired 'email' value into a v25 interactions row
          // (review cycle-2 HIGH, T-32-03). interaction_assists.channel keeps its
          // call|text|email transport CHECK — it is NOT rebuilt.
          channel: remapLegacyChannel(transactionAssist.channel),
          direction: "outbound",
          connected: input.connected,
          note: input.note ?? null,
          source: "assist",
        },
      );
      await recomputeLastContactCore(
        exec,
        transactionAssist.contact_id,
        input.now,
      );
      await bumpDataRevisionCore(exec);
      await exec.runAsync(
        `UPDATE interaction_assists
            SET status = 'logged', resolved_at = ?, modified_at = ?
          WHERE uid = ? AND status = 'pending'`,
        [input.now, input.now, input.assistUid],
      );
    });
  })();
}

/**
 * Dismissal records no interaction, preserving an explicit no-contact outcome.
 * Wrapped in the shared write transaction (DATA-04) so a status flip cannot be
 * captured and lost by a concurrent launch-sweep transaction on the shared
 * connection. Callers are top-level UI handlers, never inside inWriteTransaction.
 */
export function markAssistDismissed(
  exec: SqlExecutor,
  input: { assistUid: string; now: string },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await exec.runAsync(
      `UPDATE interaction_assists
          SET status = 'dismissed', resolved_at = ?, modified_at = ?
        WHERE uid = ? AND status = 'pending'`,
      [input.now, input.now, input.assistUid],
    );
  });
}

/**
 * A failed native handoff is terminal and can never surface as a prompt.
 * Wrapped in the shared write transaction (DATA-04) for the same reason as
 * markAssistDismissed; the caller (performReachOut's catch) runs after
 * createPendingAssist's transaction has already committed, so there is no nesting.
 */
export function markAssistFailed(
  exec: SqlExecutor,
  input: { assistUid: string; now: string },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await exec.runAsync(
      `UPDATE interaction_assists
          SET status = 'failed', resolved_at = ?, modified_at = ?
        WHERE uid = ? AND status = 'pending'`,
      [input.now, input.now, input.assistUid],
    );
  });
}
