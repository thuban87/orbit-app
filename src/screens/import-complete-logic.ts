/**
 * Import Complete Retry block (RG-035, D-26; 38.2 D-14 preserved).
 *
 * Retry already runs only `pending` and `failed` rows (committed rows are
 * filtered out by status and by `contactId`), plus unfinished photos. After a
 * fatal ImportProgress stop the session can hold pending rows with no failures,
 * so pending rows must also surface Retry.
 */
export interface ImportCompleteRetryInput {
  failed: number;
  pending: number;
  photoRows: number;
}

export interface ImportCompleteRetryState {
  visible: boolean;
  message: string | null;
}

export function importCompleteRetryState({
  failed,
  pending,
  photoRows,
}: ImportCompleteRetryInput): ImportCompleteRetryState {
  if (failed > 0)
    return { visible: true, message: "Some contacts couldn't be imported." };
  if (pending > 0)
    return {
      visible: true,
      message: "Some contacts haven't been imported yet.",
    };
  if (photoRows > 0)
    return {
      visible: true,
      message: "Some contact photos still need to be added.",
    };
  return { visible: false, message: null };
}
