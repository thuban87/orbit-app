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
 * (CLAUDE.md "Queries go through DAOs"). Its one write is the locked
 * `deleteReviewedSnapshot` of a link's 'source' memory when that link reads
 * again (classifyLinkedContact), so a later disappearance prompts again
 * (D-45, convergence c3 D-6). It never calls a `*Core` writer.
 */
import { listContactMethods } from "@/db/contact-methods-dao";
import {
  deleteReviewedSnapshot,
  getReviewedSnapshots,
} from "@/db/reconcile-snapshot-dao";
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
  /** Reviewed values merged across every active link (higher link id wins). */
  snapshots: Partial<Record<ReconcileFieldFamily, string | null>>;
  /**
   * Each active link's own reviewed values. The classifier merges only the
   * links that read in this check (38.12 review B-CR-02): an unread link
   * provides no source value, so its memory must not decide the comparison.
   */
  perLink: ReadonlyMap<
    number,
    Partial<Record<ReconcileFieldFamily, string | null>>
  >;
  /** `phoneRegionOverride ?? device region` — the one region rule (D-45). */
  effectivePhoneRegion: string | null;
  /** Links whose missing source the person kept as is ('source' memory). */
  missingKeptLinkIds: ReadonlySet<number>;
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
  /**
   * The bridge's phone-photo fingerprint (38.12-02). Preferred over the staged
   * bytes' hash, so a thumbnail/full-size byte switch is not a difference (D-132).
   */
  readonly photoFingerprint?: string | null;
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
  const perLink = new Map<
    number,
    Partial<Record<ReconcileFieldFamily, string | null>>
  >();
  const missingKeptLinkIds = new Set<number>();
  for (const linkId of linkIds) {
    const { source, ...fields } = await getReviewedSnapshots(exec, linkId);
    if (source !== undefined) missingKeptLinkIds.add(linkId);
    perLink.set(linkId, fields);
  }
  return {
    snapshots: Object.assign({}, ...perLink.values()),
    perLink,
    effectivePhoneRegion: effectivePhoneRegionFor(settings),
    missingKeptLinkIds,
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

/**
 * A classified card: the classifier result plus the active links the provider
 * read did not return and whose missing source was not kept as is.
 */
export type ReconcileCardDiff = ReconcileDiffResult & {
  missingLinkIds?: number[];
};

export interface ClassifyLinkedContactInput {
  contact: LinkedScanContact;
  /** The contact's active links, in id order. */
  links: readonly LinkedScanLink[];
  pickedByKey: ReadonlyMap<string, ReconcilePickedSource>;
  /** Staged source photos keyed by external link id. */
  stagedPhotos: ReadonlyMap<number, StagedSourcePhoto>;
  memory: ReviewMemory;
}

/**
 * Classify one linked contact exactly the same way for grid and detail.
 *
 * Missing sources (D-45): an unread link whose missing source was kept as is
 * is left out; a contact with nothing else to compare produces no fields. A
 * link that reads again has its 'source' memory deleted (locked wrapper).
 */
export async function classifyLinkedContact(
  exec: SqlExecutor,
  input: ClassifyLinkedContactInput,
): Promise<ReconcileCardDiff> {
  const { contact, links, pickedByKey, stagedPhotos, memory } = input;
  const readLinks = links.filter((link) =>
    pickedByKey.has(link.external_contact_id),
  );
  for (const link of readLinks)
    if (memory.missingKeptLinkIds.has(link.id))
      await deleteReviewedSnapshot(exec, link.id, "source");
  const unkeptMissing = links.filter(
    (link) =>
      !pickedByKey.has(link.external_contact_id) &&
      !memory.missingKeptLinkIds.has(link.id),
  );
  if (readLinks.length === 0 && unkeptMissing.length === 0)
    return {
      missingSource: false,
      fields: [],
      sourceLinkIds: [],
      orbitModifiedAt: contact.modified_at,
      missingLinkIds: [],
    };
  const methods = await listContactMethods(exec, contact.id);
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
      // A source has a photo when its bytes were staged; it compares by the
      // bridge fingerprint when there is one (D-132), else the bytes' hash.
      ...(staged
        ? {
            stagedPhotoRelative: staged.stagedRelative,
            photoContentHash: picked.photoFingerprint || staged.contentHash,
          }
        : {}),
    };
  });
  const diff = classifyReconciliation({
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
    // Only the links that read this time (B-CR-02); every review is written
    // to all of them, so they agree after the first review.
    lastReviewed: Object.assign(
      {},
      ...readLinks.map((link) => memory.perLink.get(link.id) ?? {}),
    ),
    omittedCount: unkeptMissing.length,
    effectivePhoneRegion: memory.effectivePhoneRegion,
  });
  return { ...diff, missingLinkIds: unkeptMissing.map((link) => link.id) };
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
  diff: ReconcileCardDiff;
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
