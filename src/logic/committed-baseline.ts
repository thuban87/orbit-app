/** Advance an editor collection after a committed write without re-reading it. */
export function advanceBaseline<Row extends { id?: number }>(input: {
  submittedDraft: Row[];
  currentDraft: Row[];
  committedRows: Row[];
  idMap: Map<number, number>;
  keyOf: (row: Row) => number | undefined;
}): { seed: Row[]; draft: Row[] } {
  const { submittedDraft, currentDraft, committedRows, idMap, keyOf } = input;
  const submittedByKey = new Map(
    submittedDraft.map((row) => [keyOf(row), row]),
  );
  const committedByKey = new Map(committedRows.map((row) => [keyOf(row), row]));
  const signature = (row: Row) => {
    const { id: _id, ...rest } = row;
    return JSON.stringify(rest);
  };
  return {
    seed: committedRows,
    draft: currentDraft.map((row) => {
      const key = keyOf(row);
      const mappedKey = key === undefined ? undefined : (idMap.get(key) ?? key);
      const submitted = submittedByKey.get(key);
      const committed = committedByKey.get(mappedKey);
      // A row untouched during the awaited save takes the canonical committed
      // projection. An in-flight edit keeps its new content and gets the real id.
      if (submitted && committed && signature(submitted) === signature(row)) {
        return committed;
      }
      return mappedKey === key ? row : ({ ...row, id: mappedKey } as Row);
    }),
  };
}
