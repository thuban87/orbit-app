/**
 * The render order of a list editor's cards, its open form and its Add
 * (Phase 38.10 D-130, card edit mode). Shared by MemoryEditor
 * (`memoryEditorSlots`) and RelationshipEditor (`relationshipEditorSlots`).
 *
 * - `cardEditMode` with an open edit: the form takes the edited row's index
 *   (that row's card is not rendered), then the Add, which the editor holds
 *   while the form is open. This is what puts the form "on the card" (fixes
 *   O1: the form opened below the whole list, often off screen).
 * - A new entry (`adding`): every card, then the add form where the Add was.
 * - Without `cardEditMode` (every other host): every card, then the open form
 *   or the Add, as before.
 * - `addOnly`: only the form while it is open.
 * - An edited row that is no longer in `items` (a reload removed it while its
 *   form was open) keeps its form, at the end, as before.
 *
 * PURE and React-free, so it is unit-tested in the node env.
 */

export type CardEditSlot<T> =
  | { kind: "card"; item: T }
  | { kind: "form" }
  | { kind: "add" };

export interface CardEditSlotsInput<T extends { id: number }> {
  items: readonly T[];
  /** The id of the row whose edit form is open; null when none is. */
  editingId: number | null;
  /** A new entry's form is open. */
  adding: boolean;
  cardEditMode: boolean;
  addOnly: boolean;
  showAdd: boolean;
}

export function cardEditSlots<T extends { id: number }>({
  items,
  editingId,
  adding,
  cardEditMode,
  addOnly,
  showAdd,
}: CardEditSlotsInput<T>): CardEditSlot<T>[] {
  const formOpen = editingId !== null || adding;
  if (addOnly) return formOpen ? [{ kind: "form" }] : [];
  const inPlace =
    cardEditMode &&
    editingId !== null &&
    items.some((item) => item.id === editingId);
  const slots: CardEditSlot<T>[] = items.map((item) =>
    inPlace && item.id === editingId
      ? { kind: "form" }
      : { kind: "card", item },
  );
  if (inPlace) {
    if (showAdd) slots.push({ kind: "add" });
  } else if (formOpen) {
    slots.push({ kind: "form" });
  } else if (showAdd) {
    slots.push({ kind: "add" });
  }
  return slots;
}
