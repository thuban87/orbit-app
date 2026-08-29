/**
 * Atomic system-contact import writers. Each public writer enters the shared
 * non-reentrant transaction exactly once and composes only DAO cores inside it.
 */
import {
  type CreateContactFullInput,
  createContactFullCore,
} from "@/db/contacts-dao";
import {
  type ImportMatchOutcome,
  setRowContactCore,
  setRowMatchOutcomeCore,
} from "@/db/import-session-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { isValidStoredBirthday } from "@/logic/birthday-logic";

export class NameRequiredError extends Error {
  constructor() {
    super("A contact name is required before importing");
    this.name = "NameRequiredError";
  }
}

export class InvalidImportBirthdayError extends Error {
  constructor() {
    super("A valid birthday is required before importing");
    this.name = "InvalidImportBirthdayError";
  }
}

export interface ExternalContactLinkInput {
  provider: "android";
  externalContactId: string;
  /** UIDs of source methods attributed to this source record, when known. */
  methodDraftUids?: string[];
}

export interface ResolveImportRowInput {
  rowId: number;
  matchOutcome?: ImportMatchOutcome;
}

export interface ImportContactRecordInput {
  input: CreateContactFullInput;
  externalLinks: ExternalContactLinkInput[];
  birthday: string | null;
  now: string;
  resolveRow?: ResolveImportRowInput;
}

export interface LinkExistingContactToRowInput {
  rowId: number;
  contactId: number;
  provider: "android";
  externalContactId: string;
  matchOutcome: ImportMatchOutcome | null;
  now: string;
  /** Optional method IDs newly observed while linking an existing contact. */
  methodIds?: number[];
}

export async function insertExternalContactLinkCore(
  exec: SqlExecutor,
  params: {
    contactId: number;
    provider: "android";
    externalContactId: string;
    now: string;
  },
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO external_contact_links
       (uid, contact_id, provider, external_contact_id, is_active, created_at, modified_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [
      newUid(),
      params.contactId,
      params.provider,
      params.externalContactId,
      params.now,
      params.now,
    ],
  );
  return result.lastInsertRowId;
}

export async function insertMethodProvenanceCore(
  exec: SqlExecutor,
  methodId: number,
  externalContactLinkId: number,
  now: string,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO contact_method_provenance
       (uid, method_id, external_contact_link_id, source_method_id, created_at, modified_at)
     VALUES (?, ?, ?, NULL, ?, ?)`,
    [newUid(), methodId, externalContactLinkId, now, now],
  );
}

/**
 * Create an Unbound contact and all of its system-contact evidence atomically.
 * The blank-name check intentionally runs before opening a transaction so every
 * create-from-picked caller has a hard no-blank-name backstop.
 */
export function importContactRecord(
  exec: SqlExecutor,
  params: ImportContactRecordInput,
): Promise<{ contactId: number }> {
  if (params.input.name.trim() === "") {
    return Promise.reject(new NameRequiredError());
  }
  if (
    params.birthday !== null &&
    !isValidStoredBirthday(params.birthday)
  ) {
    return Promise.reject(new InvalidImportBirthdayError());
  }

  return inWriteTransaction(exec, async () => {
    // `params.now` is the import operation's authoritative timestamp; callers
    // may have mapped the snapshot earlier.
    const created = await createContactFullCore(exec, {
      ...params.input,
      now: params.now,
      trackingEnabled: false,
      intervalDays: null,
    });

    if (params.birthday !== null) {
      await exec.runAsync(
        "UPDATE contacts SET birthday = ?, modified_at = ? WHERE id = ?",
        [params.birthday, params.now, created.contactId],
      );
    }

    const links: Array<ExternalContactLinkInput & { id: number }> = [];
    for (const externalLink of params.externalLinks) {
      links.push({
        ...externalLink,
        id: await insertExternalContactLinkCore(exec, {
          contactId: created.contactId,
          provider: externalLink.provider,
          externalContactId: externalLink.externalContactId,
          now: params.now,
        }),
      });
    }
    const fallbackLink = links[0];
    for (const method of created.methods) {
      const sourceLink =
        links.find((link) => link.methodDraftUids?.includes(method.uid)) ??
        fallbackLink;
      if (sourceLink) {
        await insertMethodProvenanceCore(
          exec,
          method.id,
          sourceLink.id,
          params.now,
        );
      }
    }

    if (params.resolveRow) {
      await setRowContactCore(
        exec,
        params.resolveRow.rowId,
        created.contactId,
        "imported",
        params.now,
      );
      if (params.resolveRow.matchOutcome !== undefined) {
        await setRowMatchOutcomeCore(
          exec,
          params.resolveRow.rowId,
          params.resolveRow.matchOutcome,
          null,
          params.now,
        );
      }
    }

    return { contactId: created.contactId };
  });
}

/**
 * Attach a selected source record to an existing Orbit contact without ever
 * modifying the existing contact's metadata or name.
 */
export function linkExistingContactToRow(
  exec: SqlExecutor,
  params: LinkExistingContactToRowInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const externalContactLinkId = await insertExternalContactLinkCore(exec, {
      contactId: params.contactId,
      provider: params.provider,
      externalContactId: params.externalContactId,
      now: params.now,
    });
    for (const methodId of params.methodIds ?? []) {
      await insertMethodProvenanceCore(
        exec,
        methodId,
        externalContactLinkId,
        params.now,
      );
    }
    await setRowContactCore(
      exec,
      params.rowId,
      params.contactId,
      "linked",
      params.now,
    );
    await setRowMatchOutcomeCore(
      exec,
      params.rowId,
      params.matchOutcome,
      null,
      params.now,
    );
  });
}
