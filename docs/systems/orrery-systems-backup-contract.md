# Orrery Systems Backup Contract

**Last updated:** 2026-09-08

**Updated by phase:** 30-orrery-systems (declare-only)

## Purpose

Custom Orrery Systems are durable user-authored state. Phase 36 owns their
portable backup wire format, export queries, restore application, and the
coordinated backup-format bump. Phase 30 deliberately emits no Systems data:
format 4 and its `FORWARD_MIGRATIONS` remain unchanged.

This document is the consumer contract for that Phase 36 work. It does not
authorize an earlier format bump or an additive format-4 export shape.

## Phase 36 entity list

Phase 36 must serialize these durable entities using stable UIDs and portable
references, never SQLite integer IDs:

| SQLite owner | Portable entity / fields | Restore identity and notes |
| --- | --- | --- |
| `systems` | Custom definition: `uid`, `name`, `createdAt`, `modifiedAt` | `uid` is the durable custom identity; do not export the local `id`. |
| `system_rules` | Custom-System rule: `uid`, owning System UID, `family`, `value`, `createdAt` | Restore resolves the owning System UID to its destination local ID. |
| `system_overrides` | Manual inclusion/exclusion: `uid`, `systemRef`, contact UID, `mode`, `createdAt` | `mode` is exactly `include` or `exclude`; restore resolves the contact UID to its destination local ID. `systemRef` stays ref-keyed across built-in, Category, and custom Systems. |
| `system_prefs` | Per-System customization: `uid`, `systemRef`, `displayOrder`, `hidden`, `createdAt`, `modifiedAt` | Carries ordering and visibility for every System kind, including built-in and Category refs. |
| `app_settings.orrery_last_system` | Last-active System token | Travels as the portable `orreryLastSystem` preference and accepts a valid `custom:<uid>` token. |

The Phase 36 manifest must preserve the table semantics above rather than
serializing a resolved contact-membership snapshot. Rules and overrides are
the authored state; membership remains a local derived read.

## Regenerated bases and user customization

Built-in System definitions and Category-generated System definitions are not
user-authored portable entities. They regenerate from the receiving build and
the already-portable Category records. Phase 36 serializes only their user
customization: `system_overrides`, `system_prefs`, and any applicable
last-active reference. It must not manufacture rows in `systems` for a
built-in or Category base.

## Restore validation

Before a restore transaction mutates SQLite, Phase 36 validates the Systems
payload with the same closed, parameter-bound grammar used by live writers:

- Each System, rule, override, and preference UID is unique in its own entity
  list; custom System names remain case-insensitively unique across custom,
  built-in, and live Category names.
- `systemRef` and `orreryLastSystem` are closed tokens: a known
  `builtin:<id>`, `category:<uid>`, or `custom:<uid>` with a nonblank,
  non-control-character UID. Values are always SQL `?` bindings, never
  interpolated identifiers.
- Rule families and their closed values are validated before writes. In
  particular, a `category` rule stores and serializes the **portable Category
  UID**, never a local integer Category ID.
- Override modes are exactly `include` or `exclude`; `hidden` is binary; and
  a custom rule resolves its owner by durable custom System UID before local
  `system_id` insertion.

## Orphan repair and attention states

Restore resolves contacts, Categories, and custom Systems by their portable
UIDs after their parent entities are available. It must perform the following
repairs explicitly and report them through the normal restore diagnostics;
it must never leave an FK-invalid local row behind.

- An override whose contact UID is absent from the restored contact set is an
  orphaned manual membership row. Do not insert it; record the repair so the
  receiving database has no dangling `system_overrides.contact_id`.
- A custom System rule whose `category` value UID is absent is **not** an
  orphan to discard. Preserve its stored portable UID and surface that rule as
  broken / needs attention. Category deletion has the same outcome: remaining
  rules and manual inclusions continue resolving, while the unavailable rule
  stays visible for the user to repair. Never silently discard, substitute,
  or rewrite that UID.
- If a `custom:<uid>` `orreryLastSystem` token names no restored custom System,
  the System read returns `status: "missing-custom"`; the Plan 30-10 launch
  path falls back to All Contacts. Phase 36 must repair the stale preference
  to All Contacts after that safe fallback, rather than assuming an earlier
  fallback or retaining a permanently orphaned active choice.

## Related systems

- [Orrery](orrery.md) owns live System resolution, including missing custom
  and missing Category read outcomes.
- [Backup & Restore](backup-restore.md) owns the shared portable-manifest,
  parse-before-mutate, and reconciliation conventions that Phase 36 extends.
- Migration 022 owns the four Systems table shapes; later migrations must be
  forward-only and must not alter this already-shipped migration.

## Changelog

| Date | Phase | What Changed |
| --- | --- | --- |
| 2026-09-08 | 30 | Declared the Phase 36 Systems serialization, validation, and orphan-repair contract without changing the format-4 wire. |
