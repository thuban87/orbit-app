# Phase 36 Backup Handoff: Group Events

Phase 33 adds durable local Group Event parents and canonical interaction
children. Phase 36 owns the coordinated backup-format bump and restore work.
**Phase 33 must not edit** `src/backup/export-manifest.ts`,
`src/backup/restore-apply.ts`, `src/backup/reconciliation.ts`, or
`src/backup/backup-schema.ts` for this feature.

## Wire Entity Shape

Add a top-level `groupEvents[]` array. Each row is keyed by durable `uid` and
contains the parent entity fields:

```ts
{
  uid: string;
  title: string;
  occurredAt: string;
  channel: string | null;
  quality: string | null;
  duration: number | null;
  groupNote: string | null;
  createdAt: string;
  modifiedAt: string;
}
```

Extend the existing interaction wire row with:

```ts
{
  groupEventUid: string | null;
  geFollowChannel: 0 | 1 | null;
  geFollowQuality: 0 | 1 | null;
  geFollowDuration: 0 | 1 | null;
  duration: number | null;
  allowAi: 0 | 1;
}
```

`groupEventUid` is the parent durable UID, exported with a join such as
`group_events ge ON ge.id = i.group_event_id`. This mirrors the existing
interaction `contactUid` export: local foreign-key integers are not portable.
`interactions.group_event_id` is **never** placed on the wire, because a local
parent row id can differ after restore and would corrupt or flatten links.

There are exactly three follow flags: Channel, Tone/Quality, and Duration.
Direction and Connected are ordinary interaction fields and never acquire a
follow flag. The shared values remain materialized on each child; export and
restore must preserve both those values and each follow flag without flattening
overrides. `duration` and `allowAi` close the current interaction-export gap.

## Restore Ordering and Tombstones

1. Upsert `groupEvents` parents by durable `uid`.
2. Build a `groupEventUid -> local group_events.id` map.
3. Upsert interactions, resolving `groupEventUid` through that map before
   writing their local `group_event_id` and the three follow flags.

The generic tombstone export already selects `entity_type`, `entity_uid`, and
`deleted_at`. Phase 33 adds the `group_event` type; Phase 36 must carry and
honor that tombstone so a dissolved or deleted parent is never resurrected by a
merge restore.

## Locked Orphan Disposition

**Owner decision (2026-09-12): detach-to-standalone.** If an imported child
has a `groupEventUid` absent from `groupEvents[]`, preserve the interaction as
a standalone row. In one operation set `group_event_id = NULL` and clear
`ge_follow_channel`, `ge_follow_quality`, and `ge_follow_duration` to `NULL`.
Never drop the child. Linkage and follow flags are always cleared together; a
NULL link with any set follow flag is invalid.

## Phase 36 Registry Checklist

Phase 36 must extend all of these coordinated registries:

- `MergeableEntityType` and the per-type merge/reconcile policies in
  `src/backup/reconciliation.ts` (currently around lines 8 and 46).
- The restore `entities` list, `tableOf` mapping, and tombstone-entity
  mappings in `src/backup/restore-apply.ts` (currently around line 50).
- Backup-schema validation and the tombstone type allowlist in
  `src/backup/backup-schema.ts` (currently around lines 197 and 322).
- Replace-all reset/insert order in `src/backup/restore-apply.ts` (currently
  around lines 254 and 267): reset and insert parents before interactions so
  the foreign key resolves safely.

Required Phase 36 tests:

1. Merge-restore round trip for parents, children, materialized values, and
   overrides.
2. Replace-all restore round trip with parent-before-child linkage.
3. Deleted/dissolved-parent `group_event` tombstone honoring during restore.
4. The locked orphan detach-to-standalone outcome, including clearing all three
   follow flags atomically.
