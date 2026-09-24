/** Commit-aware Edit Contact save sequence. The two DAO transactions remain separate. */
import {
  applyLinkDiff,
  type ContactLinkRow,
  type DraftLink,
} from "@/db/contact-links-dao";
import {
  type UpdateContactFullInput,
  updateContactFull,
} from "@/db/contacts-dao";
import type { SqlExecutor } from "@/db/types";
import { advanceBaseline } from "@/logic/committed-baseline";
import type {
  CurrentStateSeed,
  EditFormState,
  FuelDraftRow,
  MemoryDraftRow,
  RelationshipDraftRow,
} from "./edit-contact-logic";

export interface EditContactBaselines {
  form: EditFormState;
  memories: MemoryDraftRow[];
  relationships: RelationshipDraftRow[];
  offLimits: FuelDraftRow[];
  currentState: CurrentStateSeed;
  links: ContactLinkRow[];
  linksDraft: DraftLink[];
  initialTrackingEnabled: boolean;
  neverContacted: boolean;
}

type MetadataResult = Awaited<ReturnType<typeof updateContactFull>>;
type LinkResult = Awaited<ReturnType<typeof applyLinkDiff>>;

export type EditContactSaveOutcome =
  | { status: "metadataFailed"; error: unknown }
  | {
      status: "linksFailed";
      error: unknown;
      baseline: EditContactBaselines;
      metadata: MetadataResult;
    }
  | {
      status: "refreshFailed";
      error: unknown;
      stale: true;
      baseline: EditContactBaselines;
      metadata: MetadataResult;
    }
  | {
      status: "canonicalDuplicate";
      baseline: EditContactBaselines;
      metadata: MetadataResult;
    }
  | {
      status: "saved";
      baseline: EditContactBaselines;
      metadata: MetadataResult;
    };

export interface EditContactSaveArgs {
  exec: SqlExecutor;
  input: UpdateContactFullInput;
  submittedForm: EditFormState;
  getCurrentForm: () => EditFormState;
  submittedLinks: DraftLink[];
  getCurrentLinks: () => DraftLink[];
  seededLinks: ContactLinkRow[];
  seededMemories: MemoryDraftRow[];
  seededRelationships: RelationshipDraftRow[];
  seededOffLimits: FuelDraftRow[];
  initialTrackingEnabled: boolean;
  neverContacted: boolean;
  toMemoryDraft: (row: MetadataResult["memories"][number]) => MemoryDraftRow;
  toRelationshipDraft: (
    row: MetadataResult["relationships"][number],
  ) => RelationshipDraftRow;
  toOffLimitsDraft: (row: MetadataResult["offLimits"][number]) => FuelDraftRow;
  afterMetadataCommit?: () => void | Promise<void>;
  refresh: () => Promise<unknown>;
  writeMetadata?: typeof updateContactFull;
  writeLinks?: typeof applyLinkDiff;
}

function mapAdded(
  tempIds: number[] | undefined,
  committedIds: number[],
): Map<number, number> {
  const map = new Map<number, number>();
  if (tempIds && tempIds.length !== committedIds.length) {
    throw new Error("committed add ids did not match submitted draft ids");
  }
  tempIds?.forEach((tempId, index) => {
    map.set(tempId, committedIds[index]);
  });
  return map;
}

/** Advance from returned committed rows even when a later write or refresh fails. */
export async function runEditContactSave(
  args: EditContactSaveArgs,
): Promise<EditContactSaveOutcome> {
  const writeMetadata = args.writeMetadata ?? updateContactFull;
  const writeLinks = args.writeLinks ?? applyLinkDiff;
  let metadata: MetadataResult;
  try {
    metadata = await writeMetadata(args.exec, args.input);
  } catch (error) {
    return { status: "metadataFailed", error };
  }

  // The first transaction committed. All baselines below come from its return,
  // never from a post-commit refresh that can fail independently.
  const memorySeed = metadata.memories.map(args.toMemoryDraft);
  const relationshipSeed = metadata.relationships.map(args.toRelationshipDraft);
  const offLimitsSeed = metadata.offLimits.map(args.toOffLimitsDraft);
  const currentForm = args.getCurrentForm();
  const memories = advanceBaseline({
    submittedDraft: args.submittedForm.memories ?? [],
    currentDraft: currentForm.memories ?? [],
    committedRows: memorySeed,
    idMap: mapAdded(
      args.input.memories?.addTempIds,
      metadata.addedIds.memories,
    ),
    keyOf: (row) => row.id,
  });
  const relationships = advanceBaseline({
    submittedDraft: args.submittedForm.relationships ?? [],
    currentDraft: currentForm.relationships ?? [],
    committedRows: relationshipSeed,
    idMap: mapAdded(
      args.input.relationships?.addTempIds,
      metadata.addedIds.relationships,
    ),
    keyOf: (row) => row.id,
  });
  const offLimits = advanceBaseline({
    submittedDraft: args.submittedForm.offLimits ?? [],
    currentDraft: currentForm.offLimits ?? [],
    committedRows: offLimitsSeed,
    idMap: mapAdded(
      args.input.offLimits?.addTempIds,
      metadata.addedIds.offLimits,
    ),
    keyOf: (row) => row.id,
  });
  const currentState: CurrentStateSeed = {};
  for (const key of ["last_talked_about", "current_location"] as const) {
    const value = metadata.currentState[key]?.value;
    if (value !== undefined) currentState[key] = value;
  }
  const form: EditFormState = {
    ...currentForm,
    memories: memories.draft,
    relationships: relationships.draft,
    offLimits: offLimits.draft,
    lastSpoke:
      args.neverContacted && args.input.firstInteraction
        ? { kind: "not-yet" }
        : currentForm.lastSpoke,
  };
  const baseline: EditContactBaselines = {
    form,
    memories: memories.seed,
    relationships: relationships.seed,
    offLimits: offLimits.seed,
    currentState,
    links: args.seededLinks,
    linksDraft: args.getCurrentLinks(),
    initialTrackingEnabled:
      args.input.trackingEnabled ?? args.initialTrackingEnabled,
    neverContacted: args.neverContacted && !args.input.firstInteraction,
  };
  const mergeLatestForm = () => {
    const latest = args.getCurrentForm();
    baseline.form = {
      ...latest,
      memories: advanceBaseline({
        submittedDraft: args.submittedForm.memories ?? [],
        currentDraft: latest.memories ?? [],
        committedRows: memorySeed,
        idMap: mapAdded(
          args.input.memories?.addTempIds,
          metadata.addedIds.memories,
        ),
        keyOf: (row) => row.id,
      }).draft,
      relationships: advanceBaseline({
        submittedDraft: args.submittedForm.relationships ?? [],
        currentDraft: latest.relationships ?? [],
        committedRows: relationshipSeed,
        idMap: mapAdded(
          args.input.relationships?.addTempIds,
          metadata.addedIds.relationships,
        ),
        keyOf: (row) => row.id,
      }).draft,
      offLimits: advanceBaseline({
        submittedDraft: args.submittedForm.offLimits ?? [],
        currentDraft: latest.offLimits ?? [],
        committedRows: offLimitsSeed,
        idMap: mapAdded(
          args.input.offLimits?.addTempIds,
          metadata.addedIds.offLimits,
        ),
        keyOf: (row) => row.id,
      }).draft,
      lastSpoke:
        args.neverContacted && args.input.firstInteraction
          ? { kind: "not-yet" }
          : latest.lastSpoke,
    };
  };
  try {
    await args.afterMetadataCommit?.();
  } catch {
    // OS side effects cannot roll back a committed edit.
  }

  let links: LinkResult;
  try {
    links = await writeLinks(args.exec, {
      contactId: args.input.id,
      seeded: args.seededLinks,
      current: args.submittedLinks,
      now: args.input.now,
    });
  } catch (error) {
    mergeLatestForm();
    baseline.linksDraft = args.getCurrentLinks();
    return { status: "linksFailed", error, baseline, metadata };
  }
  mergeLatestForm();
  const linkIdByUid = new Map<string, number>();
  args.submittedLinks
    .filter((row) => row.id == null)
    .forEach((row, index) => {
      const id = links.addedIds[index];
      if (id !== undefined) linkIdByUid.set(row.uid, id);
    });
  baseline.links = links.links;
  baseline.linksDraft = args.getCurrentLinks().map((row) => {
    const id = row.id ?? linkIdByUid.get(row.uid);
    return id === undefined ? row : { ...row, id };
  });
  try {
    await args.refresh();
  } catch (error) {
    return { status: "refreshFailed", error, stale: true, baseline, metadata };
  }
  return metadata.methodSaveResult?.status === "canonicalDuplicate"
    ? { status: "canonicalDuplicate", baseline, metadata }
    : { status: "saved", baseline, metadata };
}
