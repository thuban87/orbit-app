/**
 * Conservative source-record consolidation.  This is deliberately limited to
 * pre-batch pending rows: it creates one new Orbit contact from several source
 * records; it never merges two existing Orbit contacts.
 */
import { createContactFullCore } from "@/db/contacts-dao";
import {
  assertImportLifecycle,
  finalizeSessionIfTerminal,
  type ImportLifecycle,
  markRowPhotoFailed,
  retireRowStagedPhotoCore,
  setRowContactCore,
  setRowMatchOutcomeCore,
} from "@/db/import-session-dao";
import type { ImportSessionRow } from "@/db/import-session-read";
import {
  insertExternalContactLinkCore,
  insertMethodProvenanceCore,
} from "@/db/imported-contact-dao";
import { addMemoryCore } from "@/db/memories-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { isValidStoredBirthday } from "@/logic/birthday-logic";
import { normalizeContactMethod } from "@/logic/contact-method-normalization";
import { mapPickedContact } from "@/logic/picked-contact-map";
import type { BoundImportEffects } from "@/services/import/import-lifecycle-effects";
import {
  type ImportedPhotoFs,
  persistImportedPhotoPostCommit,
} from "@/services/import/import-photo";
import { Logger } from "@/utils/logger";
import type { PickedContact } from "../../../modules/orbit-contact-picker";

export interface SourceClusters {
  clusters: ImportSessionRow[][];
  ungroupedRows: ImportSessionRow[];
}

export type CombineClusterResult =
  | { combined: true; contactId: number; sessionComplete: boolean }
  | { combined: false; reason: "name-required" };

interface MappedRow {
  row: ImportSessionRow;
  picked: PickedContact;
  mapped: ReturnType<typeof mapPickedContact>;
}

function pickedFromRow(row: ImportSessionRow): PickedContact {
  return JSON.parse(row.sourcePayload) as PickedContact;
}

function canonicalMethodKeys(
  row: ImportSessionRow,
  phoneRegion: string | null,
): string[] {
  let picked: PickedContact;
  try {
    picked = pickedFromRow(row);
  } catch {
    // A corrupt source payload belongs to the normal driver's failure-isolated
    // path; it must not prevent other legitimate source rows from importing.
    return [];
  }
  const keys = new Set<string>();
  for (const method of picked.methods) {
    if (method.type !== "phone" && method.type !== "email") continue;
    const normalized = normalizeContactMethod({
      type: method.type,
      value: method.value,
      defaultPhoneRegion: phoneRegion,
    });
    if (normalized.canonicalValue) {
      keys.add(`${method.type}\u0000${normalized.canonicalValue}`);
    }
  }
  return [...keys];
}

/**
 * Find connected components among pending rows sharing a canonical phone or
 * email. Names and birthdays are intentionally never identity evidence here.
 */
export function detectSourceClusters(
  rows: ImportSessionRow[],
  params: { phoneRegion: string | null },
): SourceClusters {
  const pending = rows.filter((row) => row.rowStatus === "pending");
  const parent = pending.map((_, index) => index);
  const find = (index: number): number => {
    if (parent[index] !== index) parent[index] = find(parent[index]);
    return parent[index];
  };
  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };
  const seen = new Map<string, number>();
  for (const [index, row] of pending.entries()) {
    for (const key of canonicalMethodKeys(row, params.phoneRegion)) {
      const prior = seen.get(key);
      if (prior === undefined) seen.set(key, index);
      else union(prior, index);
    }
  }

  const groups = new Map<number, ImportSessionRow[]>();
  for (const [index, row] of pending.entries()) {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(row);
    groups.set(root, group);
  }
  const clusters: ImportSessionRow[][] = [];
  const ungroupedRows: ImportSessionRow[] = [];
  for (const group of groups.values()) {
    if (group.length > 1) clusters.push(group);
    else ungroupedRows.push(...group);
  }
  return { clusters, ungroupedRows };
}

function mapRows(
  rows: ImportSessionRow[],
  batchCategoryId: number | null,
  phoneRegion: string | null,
): MappedRow[] {
  return rows.map((row) => {
    const picked = pickedFromRow(row);
    return {
      row,
      picked,
      mapped: mapPickedContact(picked, {
        categoryId: batchCategoryId,
        effectivePhoneRegion: phoneRegion,
      }),
    };
  });
}

/**
 * Atomically create the one contact — with the batch lifecycle setup saved on
 * the session (38.4 D-57; Unbound by default, ADR-066) — every source
 * link/provenance row, and every source-row resolution. Photo import and, for
 * a Bound batch, the reminder/widget effects are intentionally post-commit.
 */
export async function combineCluster(
  exec: SqlExecutor,
  fs: ImportedPhotoFs,
  params: {
    rows: ImportSessionRow[];
    batchCategoryId: number | null;
    /** The batch lifecycle, validated before any write (D-57). */
    lifecycle: ImportLifecycle;
    phoneRegion: string | null;
    now: string;
    /**
     * Post-commit reminder/widget effects after a Bound combine (D-57). Tests
     * inject a spy; the default lazily imports `import-lifecycle-effects`.
     */
    effects?: BoundImportEffects;
  },
): Promise<CombineClusterResult> {
  if (params.rows.length < 2) {
    throw new Error("combineCluster requires at least two source rows");
  }
  if (params.rows.some((row) => row.rowStatus !== "pending")) {
    throw new Error("combineCluster requires pending source rows");
  }
  assertImportLifecycle(params.lifecycle);
  const { lifecycle } = params;

  const mappedRows = mapRows(
    params.rows,
    params.batchCategoryId,
    params.phoneRegion,
  );
  const name = mappedRows
    .map(({ mapped }) => mapped.input.name.trim())
    .find((candidate) => candidate !== "");
  if (!name) return { combined: false, reason: "name-required" };

  const methods = [] as NonNullable<
    ReturnType<typeof mapPickedContact>["input"]["methodDrafts"]
  >;
  const methodSourceRow = new Map<string, ImportSessionRow>();
  const seenMethods = new Set<string>();
  for (const mappedRow of mappedRows) {
    for (const method of mappedRow.mapped.input.methodDrafts ?? []) {
      const normalized = normalizeContactMethod({
        type: method.type,
        value: method.value,
        defaultPhoneRegion: params.phoneRegion,
      });
      const key = normalized.canonicalValue
        ? `${method.type}\u0000${normalized.canonicalValue}`
        : `${method.type}\u0000raw\u0000${method.value}`;
      if (seenMethods.has(key)) continue;
      seenMethods.add(key);
      methods.push(method);
      methodSourceRow.set(method.uid, mappedRow.row);
    }
  }
  const birthday = mappedRows
    .map(({ mapped }) => mapped.birthday)
    .find((candidate): candidate is string => isValidStoredBirthday(candidate));
  const note = mappedRows
    .map(({ mapped }) => mapped.note)
    .find(
      (candidate): candidate is string =>
        candidate !== null && candidate.trim() !== "",
    );
  const photoRow = mappedRows.find(({ row }) => row.photoRelPath !== null)?.row;

  const { contactId, retiredPaths } = await inWriteTransaction(
    exec,
    async () => {
      const created = await createContactFullCore(exec, {
        ...mappedRows[0].mapped.input,
        name,
        now: params.now,
        categoryId: params.batchCategoryId,
        trackingEnabled: lifecycle.trackingEnabled,
        intervalDays: lifecycle.intervalDays,
        methodDrafts: methods,
        methodNormalization: { effectivePhoneRegion: params.phoneRegion },
      });
      if (birthday) {
        await exec.runAsync(
          "UPDATE contacts SET birthday = ?, modified_at = ? WHERE id = ?",
          [birthday, params.now, created.contactId],
        );
      }
      if (note) {
        await addMemoryCore(exec, {
          contactId: created.contactId,
          type: "imported",
          provenance: "import",
          value: note,
          createdAt: params.now,
          now: params.now,
        });
      }

      const linksByRowId = new Map<number, number>();
      for (const { row } of mappedRows) {
        linksByRowId.set(
          row.id,
          await insertExternalContactLinkCore(exec, {
            contactId: created.contactId,
            provider: "android",
            externalContactId: row.externalContactId,
            now: params.now,
          }),
        );
      }
      for (const method of created.methods) {
        const sourceRow = methodSourceRow.get(method.uid);
        const externalContactLinkId = sourceRow
          ? linksByRowId.get(sourceRow.id)
          : undefined;
        if (externalContactLinkId !== undefined) {
          await insertMethodProvenanceCore(
            exec,
            method.id,
            externalContactLinkId,
            params.now,
          );
        }
      }
      for (const { row } of mappedRows) {
        await setRowContactCore(
          exec,
          row.id,
          created.contactId,
          "imported",
          params.now,
        );
        await setRowMatchOutcomeCore(exec, row.id, "new", null, params.now);
        if (row.id !== photoRow?.id && row.photoRelPath !== null) {
          await retireRowStagedPhotoCore(exec, row.id, params.now);
        }
      }
      return {
        contactId: created.contactId,
        retiredPaths: mappedRows.flatMap(({ row }) =>
          row.id !== photoRow?.id && row.photoRelPath !== null
            ? [row.photoRelPath]
            : [],
        ),
      };
    },
  );

  for (const path of retiredPaths) {
    try {
      await fs.deleteImportStaging(path);
    } catch (error) {
      Logger.error(
        "source-consolidation",
        "could not delete retired staging photo",
        error,
      );
    }
  }

  const photo = photoRow
    ? await persistImportedPhotoPostCommit(exec, fs, {
        contactId,
        rowId: photoRow.id,
        stagedPhotoPath: photoRow.photoRelPath,
        now: params.now,
      })
    : { ok: true, skipped: true };
  if (!photo.ok && photoRow) {
    try {
      await markRowPhotoFailed(exec, photoRow.id, params.now);
    } catch (error) {
      Logger.error(
        "source-consolidation",
        `could not mark photo failure for import row ${photoRow.id}`,
        error,
      );
    }
  }
  if (lifecycle.trackingEnabled) {
    // D-57: best-effort, post-commit; never fails the committed combine.
    try {
      const run =
        params.effects ??
        (await import("@/services/import/import-lifecycle-effects"))
          .applyBoundImportEffects;
      await run(exec);
    } catch (error) {
      Logger.error(
        "source-consolidation",
        "Bound import effects failed",
        error,
      );
    }
  }
  const sessionComplete = await finalizeSessionIfTerminal(
    exec,
    params.rows[0].sessionId,
    params.now,
  );
  return { combined: true, contactId, sessionComplete };
}
