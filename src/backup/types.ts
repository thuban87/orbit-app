/** Wire-level records used by backup Merge before local integer IDs are mapped. */
export interface ReconciliationRow {
  uid: string;
  modified_at: string;
  [field: string]: unknown;
}

export interface ReconciliationTombstone {
  entity_uid: string;
  deleted_at: string;
}
