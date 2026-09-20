import type { FuelDraft, FuelEditPatch } from "@/components/FuelEditor";
import type { EditFuelInput, NewFuelItem } from "@/db/fuel-dao";
import type { FuelItem } from "@/db/fuel-read";
import {
  filterOffLimitsWrite,
  forceOffLimitsKind,
  seedOffLimitsDraft,
} from "./off-limits-draft-adapter";

export interface OffLimitsEditorDao {
  listFuelForEditor: (contactId: number) => Promise<FuelItem[]>;
  addFuel: (input: NewFuelItem) => Promise<number>;
  editFuel: (input: EditFuelInput) => Promise<void>;
  deleteFuel: (input: {
    id: number;
    contactId: number;
    now: string;
  }) => Promise<void>;
}

export interface OffLimitsEditorControllerOptions {
  contactId: number;
  dao: OffLimitsEditorDao;
  now: () => string;
  newUid: () => string;
  onItems: (items: FuelItem[]) => void;
  onError: (error: unknown) => void;
}

/**
 * The screen's write boundary. Every mutation re-reads the contact's general
 * fuel collection, scopes it to Off Limits, and only then passes a forced-kind
 * input to the kind-agnostic fuel DAO.
 */
export function createOffLimitsEditorController({
  contactId,
  dao,
  now,
  newUid,
  onItems,
  onError,
}: OffLimitsEditorControllerOptions) {
  const reload = async (): Promise<FuelItem[]> => {
    const rows = await dao.listFuelForEditor(contactId);
    const items = filterOffLimitsWrite(seedOffLimitsDraft(rows)).flatMap(
      (row) => {
        const source = rows.find((candidate) => candidate.id === row.id);
        return source ? [source] : [];
      },
    );
    onItems(items);
    return items;
  };

  const allowedId = async (id: number): Promise<boolean> => {
    const rows = await dao.listFuelForEditor(contactId);
    return filterOffLimitsWrite(seedOffLimitsDraft(rows)).some(
      (row) => row.id === id,
    );
  };

  return {
    reload,
    async onAdd(draft: FuelDraft): Promise<boolean> {
      try {
        const timestamp = now();
        const forced = forceOffLimitsKind(draft);
        await dao.addFuel({
          ...forced,
          uid: newUid(),
          contactId,
          createdAt: timestamp,
          source: "user",
          now: timestamp,
        });
        await reload();
        return true;
      } catch (error) {
        onError(error);
        return false;
      }
    },
    async onEdit(id: number, patch: FuelEditPatch): Promise<void> {
      try {
        if (!(await allowedId(id))) {
          throw new Error("Off Limits edit target is not in this collection");
        }
        await dao.editFuel({
          ...forceOffLimitsKind(patch),
          id,
          contactId,
          now: now(),
        });
        await reload();
      } catch (error) {
        onError(error);
      }
    },
    async onDelete(id: number): Promise<void> {
      try {
        if (!(await allowedId(id))) {
          throw new Error("Off Limits delete target is not in this collection");
        }
        await dao.deleteFuel({ id, contactId, now: now() });
        await reload();
      } catch (error) {
        onError(error);
      }
    },
  };
}
