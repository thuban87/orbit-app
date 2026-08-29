# API Coverage — Android 17 Contact Picker (system intent)

> The `api-coverage` detector fired on the literal token "SDK" inside the build-host note
> "Android **SDK** Manager on droid" — a false positive. Phase 19 integrates **no external
> service API**: it launches the on-device Android 17 privacy-preserving Contact Picker
> (`ACTION_PICK_CONTACTS`) — an OS system intent with no network, no account, and no
> multi-verb service surface. Contact data never leaves the device (local-first).
>
> For completeness, the one genuine coverage decision this phase makes is which **requestable
> contact data fields** to import. That decision is recorded in the dossier (Cluster C) and is
> reproduced here as the coverage matrix. Full coverage by default; opt-outs are explicit,
> reasoned decisions.

| capability | decision | reason |
|---|---|---|
| pick single contact | INTEGRATE | single-import review flow (IMP-02) |
| pick multiple contacts | INTEGRATE | bulk-import flow, ≤100 per pick platform cap (IMP-02) |
| SDK_INT availability gate | INTEGRATE | unsupported-state on pre-Android-17 (IMP-01) |
| field: display name | INTEGRATE | required identity field (IMP-02) |
| field: phone numbers | INTEGRATE | normalized method import (IMP-02) |
| field: email addresses | INTEGRATE | normalized method import (IMP-02) |
| field: birthday (Event) | INTEGRATE | best-effort; device-verified A1 (IMP-02) |
| field: photo (Photo blob) | INTEGRATE | best-effort; device-verified A2 (IMP-02) |
| field: postal address | OPT-OUT | explicitly out of scope — dossier Cluster C (only name/phones/emails/birthday/photo) |
| field: employer / job title | OPT-OUT | explicitly out of scope — dossier Cluster C |
| field: notes | OPT-OUT | explicitly out of scope — dossier Cluster C |
| field: websites / social profiles | OPT-OUT | explicitly out of scope — dossier Cluster C |
| field: arbitrary OS metadata | OPT-OUT | explicitly out of scope — dossier Cluster C |
| iOS contact picker | OPT-OUT | Android-only for Phase 19 (owner ruling 2026-08-28); iOS sequenced to a later milestone, not reversed |
| ongoing refresh / reconciliation from source | OPT-OUT | Phase 20 scope — deferred by the dossier and CONTEXT.md |
