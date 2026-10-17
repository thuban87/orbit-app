/**
 * Check linked contacts: the one review-memory read and card builder shared by
 * the grid and the detail screen (D-45, enforcing D-22).
 *
 * Both screens read memory the same way: reviewed snapshots merged across ALL
 * active links of the contact, and the phone region from
 * `phoneRegionOverride ?? device region`. The device region is passed in by the
 * screen (`getDeviceRegion()`), so this module stays node-testable.
 *
 * Read module: the SELECTs the reconcile screens used to run inline live here
 * (CLAUDE.md "Queries go through DAOs").
 */
import { listContactMethods } from "@/db/contact-methods-dao";
import { getReviewedSnapshots } from "@/db/reconcile-snapshot-dao";
import type { SqlExecutor } from "@/db/types";
import {
  actionableReconcileFields,
  classifyReconciliation,
  type ReconcileDiffResult,
  type ReconcileFieldFamily,
  type ReconcileMethod,
  type ReconcileSource,
} from "@/logic/reconcile-diff";
import { reconcileSourceLabels } from "@/logic/reconcile-source-label";

export interface ReviewMemorySettings {
  phoneRegionOverride: string | null;
  /** `getDeviceRegion()` from the screen; null when the platform has none. */
  deviceRegion: string | null;
}

export interface ReviewMemory {
  /** Reviewed values merged across every active link (classifier `lastReviewed`). */
  snapshots: Partial<Record<ReconcileFieldFamily, string | null>>;
  /** `phoneRegionOverride ?? device region` — the one region rule (D-45). */
  effectivePhoneRegion: string | null;
}

export interface LinkedScanContact {
  id: number;
  name: string;
  birthday: string | null;
  photo: string | null;
  modified_at: string;
}

export interface LinkedScanLink {
  id: number;
  contact_id: number;
  external_contact_id: string;
  provider: string;
}

/** The provider read shape the classifier needs (a PickedContact satisfies it). */
export interface ReconcilePickedSource {
  readonly lookupKey: string;
  readonly displayName: string | null;
  readonly methods: readonly ReconcileMethod[];
  readonly birthday: string | null;
}

/** A source photo staged by the screen before classification. */
export interface StagedSourcePhoto {
  stagedRelative: string;
  /** Hash of the staged bytes. */
  contentHash: string;
}

export function effectivePhoneRegionFor(
  settings: ReviewMemorySettings,
): string | null {
  return settings.phoneRegionOverride ?? settings.deviceRegion;
}

async function listActiveLinkIds(
  exec: SqlExecutor,
  contactId: number,
): Promise<number[]> {
  const rows = await exec.getAllAsync<{ id: number }>(
    "SELECT id FROM external_contact_links WHERE contact_id = ? AND is_active = 1 ORDER BY id ASC",
    [contactId],
  );
  return rows.map((row) => row.id);
}

/** The one memory read used by the grid and the detail screen (D-45). */
export async function loadReviewMemory(
  exec: SqlExecutor,
  contactId: number,
  settings: ReviewMemorySettings,
): Promise<ReviewMemory> {
  const linkIds = await listActiveLinkIds(exec, contactId);
  const perLink: Array<Partial<Record<ReconcileFieldFamily, string | null>>> =
    [];
  for (const linkId of linkIds)
    perLink.push(await getReviewedSnapshots(exec, linkId));
  return {
    snapshots: Object.assign({}, ...perLink),
    effectivePhoneRegion: effectivePhoneRegionFor(settings),
  };
}

/** Every unarchived contact with an active link, and every active link. */
export async function listLinkedContactsForScan(exec: SqlExecutor): Promise<{
  contacts: LinkedScanContact[];
  links: LinkedScanLink[];
}> {
  const contacts = await exec.getAllAsync<LinkedScanContact>(
    `SELECT c.id, c.name, c.birthday, c.photo, c.modified_at
       FROM contacts c
      WHERE c.archived_at IS NULL
        AND EXISTS (SELECT 1 FROM external_contact_links l WHERE l.contact_id = c.id AND l.is_active = 1)
      ORDER BY c.id`,
  );
  const links = await exec.getAllAsync<LinkedScanLink>(
    `SELECT id, contact_id, external_contact_id, provider
       FROM external_contact_links WHERE is_active = 1 ORDER BY contact_id, id`,
  );
  return { contacts, links };
}

/** One contact and its active links, for the detail screen. */
export async function getReconcileContact(
  exec: SqlExecutor,
  contactId: number,
): Promise<{ contact: LinkedScanContact | null; links: LinkedScanLink[] }> {
  const contact = await exec.getFirstAsync<LinkedScanContact>(
    "SELECT id, name, birthday, photo, modified_at FROM contacts WHERE id = ?",
    [contactId],
  );
  const links = await exec.getAllAsync<LinkedScanLink>(
    "SELECT id, contact_id, external_contact_id, provider FROM external_contact_links WHERE contact_id = ? AND is_active = 1 ORDER BY id ASC",
    [contactId],
  );
  return { contact: contact ?? null, links };
}

export interface ClassifyLinkedContactInput {
  contact: LinkedScanContact;
  /** The contact's active links, in id order. */
  links: readonly LinkedScanLink[];
  pickedByKey: ReadonlyMap<string, ReconcilePickedSource>;
  /** Staged source photos keyed by external link id. */
  stagedPhotos: ReadonlyMap<number, StagedSourcePhoto>;
  memory: ReviewMemory;
}

/** Classify one linked contact exactly the same way for grid and detail. */
export async function classifyLinkedContact(
  exec: SqlExecutor,
  input: ClassifyLinkedContactInput,
): Promise<ReconcileDiffResult> {
  const { contact, links, pickedByKey, stagedPhotos, memory } = input;
  const methods = await listContactMethods(exec, contact.id);
  const readLinks = links.filter((link) =>
    pickedByKey.has(link.external_contact_id),
  );
  const labels = reconcileSourceLabels(
    readLinks.map((link) => ({
      displayName:
        pickedByKey.get(link.external_contact_id)?.displayName ?? null,
    })),
  );
  const labelByLinkId = new Map(
    readLinks.map((link, index) => [link.id, labels[index]]),
  );
  const sources: ReconcileSource[] = readLinks.map((link) => {
    const picked = pickedByKey.get(
      link.external_contact_id,
    ) as ReconcilePickedSource;
    const staged = stagedPhotos.get(link.id);
    return {
      externalContactLinkId: link.id,
      displayName: picked.displayName,
      methods: picked.methods,
      birthday: picked.birthday,
      provenanceLabel: labelByLinkId.get(link.id) ?? "Phone contact",
      ...(staged
        ? {
            stagedPhotoRelative: staged.stagedRelative,
            photoContentHash: staged.contentHash,
          }
        : {}),
    };
  });
  return classifyReconciliation({
    orbit: {
      name: contact.name,
      birthday: contact.birthday,
      photo: contact.photo,
      methods: methods.map((method) => ({
        type: method.method_type,
        value: method.raw_value,
        label: method.label,
      })),
      modifiedAt: contact.modified_at,
    },
    sources,
    lastReviewed: memory.snapshots,
    omittedCount: links.length - readLinks.length,
    effectivePhoneRegion: memory.effectivePhoneRegion,
  });
}

export interface ScanLinkedContactsInput {
  linked: { contacts: LinkedScanContact[]; links: LinkedScanLink[] };
  /** The provider read of every active link's lookup key. */
  picked: readonly ReconcilePickedSource[];
  stagedPhotos: ReadonlyMap<number, StagedSourcePhoto>;
  settings: ReviewMemorySettings;
}

export interface ScannedReconcileCard {
  contactId: number;
  /** Classifier output narrowed to the actionable fields (D-45). */
  diff: ReconcileDiffResult;
  unresolvedCount: number;
  /** The staged photo kept on the durable card, if any. */
  stagedPhotoRelPath: string | null;
}

export interface ScanLinkedContactsResult {
  cards: ScannedReconcileCard[];
  /** Staged copies no card keeps; the screen deletes them. */
  discardStaged: string[];
}

/**
 * Build the Check linked contacts cards: one per contact with at least one
 * actionable field. Reviewed, unchanged fields never reach a card, a count or
 * a chip (D-45).
 */
export async function scanLinkedContacts(
  exec: SqlExecutor,
  input: ScanLinkedContactsInput,
): Promise<ScanLinkedContactsResult> {
  const pickedByKey = new Map(
    input.picked.map((picked) => [picked.lookupKey, picked]),
  );
  const linksByContact = new Map<number, LinkedScanLink[]>();
  for (const link of input.linked.links)
    linksByContact.set(link.contact_id, [
      ...(linksByContact.get(link.contact_id) ?? []),
      link,
    ]);
  const cards: ScannedReconcileCard[] = [];
  const discardStaged: string[] = [];
  for (const contact of input.linked.contacts) {
    const links = linksByContact.get(contact.id) ?? [];
    const staged = links.flatMap((link) => {
      const photo = input.stagedPhotos.get(link.id);
      return photo ? [photo.stagedRelative] : [];
    });
    const memory = await loadReviewMemory(exec, contact.id, input.settings);
    const diff = await classifyLinkedContact(exec, {
      contact,
      links,
      pickedByKey,
      stagedPhotos: input.stagedPhotos,
      memory,
    });
    const fields = actionableReconcileFields(diff);
    if (fields.length === 0) {
      discardStaged.push(...staged);
      continue;
    }
    const [kept = null, ...rest] = staged;
    discardStaged.push(...rest);
    cards.push({
      contactId: contact.id,
      diff: { ...diff, fields },
      unresolvedCount: diff.missingSource ? 0 : fields.length,
      stagedPhotoRelPath: kept,
    });
  }
  return { cards, discardStaged };
}
