# Dossier 02 — `fields` — Custom fields ✓ complete

This domain was designed in a dedicated pre-repo session and is **fully decided in
[HANDOFF.md §14](../../HANDOFF.md)**. That section is the authoritative record; this file
exists so the dossier has one file per domain and the skill can see completion state.
The load-bearing invariants are also restated in `CLAUDE.md` ("Custom fields — invariants").

Do not re-interrogate. Do not re-propose anything §14 records as rejected
(single JSON column; per-profile view options; per-profile exceptions; pairwise
type converters; a "run the conversion?" confirmation).

## Remaining [OPEN] items (inherited from HANDOFF)

- Quarantine window length, and whether it is user-configurable — 30 days is the working
  assumption (§14.5, HANDOFF open question #5).

## Cross-domain constraints exported

- [fields → data] `custom_field_defs`, `contact_custom_values`, and `field_history` ship
  in the same first migration that creates `contacts`, whenever the field phase is
  scheduled (HANDOFF §15.3).
- [fields → data] Launch-time sweep must cover quarantine expiry and history retention —
  nothing watches a timestamp (§14.5, §14.6).
- [fields → crud] New-contact form shows only `show_on_new` fields; edit form always shows
  every non-quarantined field, no configuration (§14.7).
- [fields → import] Unknown frontmatter keys found by the importer may map to custom field
  creation — decide in `import` interrogation, honoring §14.1's two-table model.
- [fields → backup] Export must include field defs, values, and (decide) `field_history`.
