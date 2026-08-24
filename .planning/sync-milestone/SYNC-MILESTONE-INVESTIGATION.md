# Sync Milestone (v2.0) — Investigation & Decision Register

**Status:** pre-milestone scoping. Nothing here is built or committed to the roadmap yet.
**Author:** planning session 2026-08-22.
**Purpose:** capture everything we must *investigate* (spikes) and everything we must *decide*
(owner calls) before the multi-device sync milestone can be planned. This is the input to a
future `/gsd-new-milestone`, not the milestone itself.

Related: `PHASE-16-SYNC-READINESS.md` (what changes in the v1.0 roadmap *now*), `HANDOFF.md` §3
(local-first, migration-path-stays-open), §9/§11 (E2EE was moot for local-only), §14 (custom fields).

---

## 0. Decisions already made (locked — do not relitigate)

These were settled by the owner on 2026-08-22 and are the fixed frame for everything below.

| # | Decision | Consequence |
|---|----------|-------------|
| D0.1 | **Local-first stays.** Sync is an *opt-in layer over the working local DB*, never a rewrite to cloud-first. | Matches `HANDOFF §3 [DECIDED]`. The local SQLite app remains the source of truth on-device. |
| D0.2 | **Turso is the primary sync direction.** | libSQL/Turso embedded DB + Turso sync. |
| D0.3 | **PowerSync is dropped, not a fallback — on cost.** (~$49/mo is too expensive; Turso+Supabase ≈ $17/mo is acceptable.) | If Turso proves unworkable we re-open the question fresh; we do **not** assume PowerSync waits in the wings. |
| D0.4 | **E2EE is reopened and is now REQUIRED for sync.** (`HANDOFF §11`'s "no E2EE — moot for local-only" premise no longer holds once data leaves the device.) | Content leaving the device must be ciphertext. Drives the key-management track (§C). |
| D0.5 | **Freemium; sync lives behind a paid subscription.** | Per-user infra cost is covered by the sub — resolves the `HANDOFF §3` "no server cost → no subscription" tension. Needs an entitlement model (§H) that does not break offline. |
| D0.6 | **Targets: Android (exists) + Electron desktop + a web portal.** The web portal is expected to be "a bigger deal" than the Electron app. | Three client runtimes, not two. The web portal is the hardest E2EE surface (§G). |
| D0.7 | **Privacy posture (owner's current stance, subject to §C.1 research):** metadata leaving the device is acceptable; photos leaving is acceptable *if the user is told they are not encrypted*; ciphertext leaving is fine. | Sets the *default* trust boundary; §C.1 tests it against real user expectations before it's final. |

**Still explicitly open (owner has NOT ruled):** whether the §14 custom-field storage design survives
Turso sync unchanged (§B.6), the exact E2EE scheme and what stays server-visible (§C), whether photos
are encrypted or flagged-plaintext (§D.2), and sequencing vs the design retool (§I).

---

## 1. Constraints inherited from v1.0 that sync MUST NOT break

Every spike and decision below is bounded by these. They are the v1.0 promises and invariants the
milestone has to preserve, verified against the code on 2026-08-22.

- **No network on any read path.** The dashboard renders offline. Sync must be background-only and
  never sit in front of a read. (`HANDOFF §3`, `CLAUDE.md`.)
- **Migrations are forward-only, irreversible, run in strict order** against unreachable devices.
  Sync must not require reaching back into a shipped device's schema.
- **Single-writer `last_contact`.** It is a *derived* column (MAX over interaction rows), written only
  by one mutexed DAO. It must be **recomputed after merge**, never merged as a scalar (§B.2).
- **Headless writers exist.** The widget and notification tasks write to the DB *outside the app
  process*, sharing a JS mutex. Any adapter swap or sync engine must coexist with headless writes
  (§A.4).
- **Test harness runs on `node:sqlite` through `SqlExecutor`.** 1305 tests depend on the abstraction.
  A Turso adapter must keep that surface green (§A.2).
- **User-facing dates use `localtime` wall-clock** (`formatLocalDate()` / `date('now','localtime')`).
  A sync *ordering* clock is a different concept and must not corrupt the local-date convention (§B.5).
- **The Phase-14 egress model.** Contact data leaves the device today only via the AI feature, through
  a native address-guarding module + a closed `PromptContext` allowlist + an explicit first-send ack.
  Sync is a *second, always-on, background* egress path — it has to be reconciled with that model, not
  bolted around it (§C.5).
- **All colours via theme tokens; portrait-lock; Skia render loop** — UI constraints the desktop/web
  clients inherit or consciously diverge from (§F, §G).

---

## 2. Investigation tracks (spikes)

Each item: **Q** (the question) · **why it matters** · **what would resolve it**. Ordered roughly by
what gates what. Spikes should run behind `SqlExecutor` on a throwaway branch and touch no v1.0 code.

### A. Turso viability (the go/no-go track — run FIRST)

- **A.1 — Adapter fit.** Q: Can a Turso/libSQL adapter satisfy the exact `SqlExecutor` interface
  (`execAsync`/`runAsync`/`getFirstAsync`/`getAllAsync`, array-bound params, `{lastInsertRowId,
  changes}` result shape) as a drop-in for `expoExecutor`? Why: this is the whole "swap the bottom
  adapter" premise. Resolve: build the adapter, run the app against it on-device.
- **A.2 — Test surface.** Q: Does the full node test suite (1305 tests) pass against the Turso adapter,
  or does it assume `node:sqlite` semantics? Why: the abstraction is our correctness net. Resolve:
  point the harness at Turso, diff failures.
- **A.3 — Sync maturity (the known risk).** Q: What is the *current* state of Turso offline-writes +
  bidirectional sync + conflict handling for React Native — GA, beta, or rough edges? (The handoff's
  main worry; verify at kickoff, do not trust 2026-early assumptions.) Why: determines whether this is
  "integrate" or "co-develop against a moving target." Resolve: read current Turso docs + a two-device
  write/conflict spike.
- **A.4 — Headless coexistence.** Q: Does the Turso embedded DB work inside the Android headless widget
  / notification task (30s budget, no full app), sharing the DB with the foreground process? Why: the
  widget's killed-app headless mark is a shipped, load-bearing feature. Resolve: exercise a headless
  write against the Turso DB on-device.
- **A.5 — DDL replication (the custom-fields crux).** Q: Does Turso sync replicate `ALTER TABLE ADD
  COLUMN` / `DROP COLUMN`? What happens when device A's quarantine sweep **drops a custom-field column**
  while device B still has data in it? Why: this is the *actual* question behind "are custom fields
  sync-safe," not EAV aesthetics (§B.6). Resolve: two-device schema-mutation spike.
- **A.6 — Electron runtime.** Q: Which Turso/libSQL runtime backs the Electron client, and can it reuse
  the same DAOs + migrations? Why: desktop code reuse hinges on it. Resolve: stand up the adapter under
  Node/Electron, run migrations + a smoke test.

### B. Data model & conflict semantics

- **B.1 — Tombstones.** Q: What tombstone shape do we need (entity_type, entity_uid, deleted_at,
  revision, device_id)? Why: hard-delete + sync = resurrection. Note: **we are adding a tombstone
  table in v1.0 Phase 16 already** (see `PHASE-16-SYNC-READINESS.md`) — this track decides whether the
  v2.0 shape needs `revision`/`device_id` beyond what backup needs.
- **B.2 — Derived columns.** Q: Confirm the rule "sync interaction rows, recompute `last_contact`
  locally after merge; never LWW the scalar." Any other derived/computed values? Why: LWW-ing a derived
  column corrupts recency. Resolve: enumerate derived fields; Phase 16's recompute already models this.
- **B.3 — Conflict granularity.** Q: Row-level LWW (whole contact row) vs field-level LWW vs
  additive-for-children? Which columns are safe as LWW scalars (name, birthday, interval, category) vs
  which need special handling? Why: whole-row LWW silently drops a concurrent edit to a different field.
  Resolve: classify every column on every mergeable table.
- **B.4 — Identity on the wire.** Q: How do child rows reference parents across devices, given FKs are
  local integer `id` today? (Wire format resolves by parent `uid` → local `id` at apply time.) Why: a
  synced child must not assume the parent's integer id matches. Resolve: define the uid-resolution step
  in the apply path.
- **B.5 — Sync ordering clock.** Q: Do we add a monotonic sync sequence / server revision / UTC sync
  timestamp distinct from the localtime `modified_at`? Why: device wall clocks are not a trustworthy
  global order; but `modified_at` must stay local for the UI. Resolve: decide the ordering authority
  (server revision is the usual answer) and whether it's a new column or engine-provided.
- **B.6 — Custom-field storage under sync.** Q: Does the §14 dynamic-column design survive Turso sync
  (given A.5's answer), or must values move to a row model (EAV)? Why: **this is a `[DECIDED]` design
  with load-bearing invariants — reversing it is an owner call, and only justified if A.5 proves the
  column model can't replicate.** Resolve: A.5 spike first; if it fails, design options (incl. keeping
  local dynamic columns *projected from* synced rows) before any rewrite decision.
- **B.7 — Device-local vs synced partition.** Q: Which tables/columns are *per-device* and must NOT
  sync — `app_settings` (no uid today), `ring_seq`, favourites order, `snooze_until`, notification
  schedule, widget config? Why: syncing device-local view/state creates phantom conflicts and cross-
  device surprises. Resolve: label every table synced / local / negotiable.

### C. E2EE & key management (required — D0.4)

- **C.1 — Privacy posture validation.** Q: How pedantic are the actual users? Does "photos + metadata
  leave the device, everything else is E2EE" match their expectations, or does the product promise
  ("never leaves your phone") demand stricter? Why: this is a *product/marketing* boundary as much as a
  technical one, and the owner is (self-described) not deep on this. Resolve: light user research /
  competitor-promise scan / decide the defensible public claim.
- **C.2 — Encryption granularity.** Q: Encrypt whole row-blobs vs field-level encryption? Why: blobs
  are simpler but kill server-side query/filter; field-level is complex. Given sync is dumb-pipe
  ciphertext, blob-per-row is likely enough. Resolve: pick after C.4 (what the server needs to see).
- **C.3 — What stays server-visible.** Q: Confirm the metadata the cloud may hold (account id, object
  uid, revision, tombstone/deleted flag) vs what it must never see (names, notes, birthdays, fuel,
  interaction detail). Why: defines the ciphertext boundary. Resolve: a per-column visibility table.
- **C.4 — Turso + E2EE interaction.** Q: If rows are E2E-encrypted, we lose Turso/Supabase server-side
  features (RLS on content, queries, realtime on plaintext). Does that break anything we need? Why:
  E2EE turns the cloud into a sync pipe, not a queryable DB. Resolve: confirm we need nothing
  server-side except transport + conflict metadata.
- **C.5 — Egress reconciliation.** Q: How does the always-on sync egress path relate to the Phase-14
  egress guard and the "no network on read path" rule? Is sync a separate, audited egress channel with
  its own allowlist/observer? Why: we built a strict egress model for the AI feature; sync must not
  quietly become a wide-open second pipe. Resolve: an egress-architecture note covering both paths.
- **C.6 — Key derivation & storage.** Q: Passphrase-derived key? Random key wrapped by passphrase?
  Where does the key live per device (Android Keystore / secure-store; Electron safeStorage; browser
  ???)? Why: the key is the whole ballgame. Resolve: pick a scheme; note the browser problem feeds §G.
- **C.7 — Multi-device enrollment.** Q: How does a second device get the key — QR/device-transfer,
  trusted-existing-device approval, encrypted recovery package? Why: onboarding a 2nd device is the
  first thing a sync user does. Resolve: pick a primary + fallback enrollment flow.
- **C.8 — Recovery & lost device.** Q: Recovery phrase vs recovery key vs both? What happens on lost
  device / forgotten passphrase — is data unrecoverable by design (true E2EE) and is the user warned at
  set-time? Why: this is the hardest UX, and "we can't recover your data" must be a conscious, disclosed
  choice. Resolve: define the recovery model + the loss-warning copy.

### D. Photos & object storage

- **D.1 — Store & references.** Q: Photos are local `avatars/*.jpg` files referenced by relative path
  in TEXT columns today. Where do they live cross-device — Supabase Storage? Turso? How are they
  referenced so a synced contact row resolves its photo on another device? Why: the path is device-local
  today. Resolve: object-storage design + a stable cross-device photo reference (by contact uid).
- **D.2 — Photo encryption (owner decision, flagged).** Q: Are photos E2E-encrypted like everything
  else, or stored flagged-plaintext (owner's current lean)? Why: **a face photo is arguably as
  identifying as a name; encrypting text but not photos is an inconsistent privacy story worth a
  conscious call.** Resolve: owner decides after C.1; if plaintext, define the in-UI disclosure.

### E. Auth & account model

- **E.1 — Provider.** Q: Supabase Auth (owner knows it) as the account layer while Turso holds synced
  data? Why: someone has to own identity + the sub entitlement. Resolve: confirm Supabase Auth-only
  (no contact data in Supabase) is compatible with D0.1/§C.
- **E.2 — Account ↔ device ↔ key.** Q: How do an auth account, its enrolled devices, and the E2EE key
  relate? Why: auth proves *who pays*; the key proves *who can read* — they are different and must not
  be conflated (the server authenticating you must still not be able to read you). Resolve: a trust
  model diagram.

### F. Desktop (Electron)

- **F.1 — Code reuse.** Q: How much of `src/` (domain/services/DAOs) runs unchanged under Electron vs
  needs a non-RN shell? Why: the value of the SqlExecutor abstraction is maximal reuse. Resolve: map
  RN-only dependencies (Skia, Reanimated, expo-*) and decide replace-or-reimplement per surface.
- **F.2 — No headless/widget assumptions.** Q: Which mobile-only concepts (widget, notifications,
  share-intent) simply don't exist on desktop, and does any shared code assume they do? Resolve: audit.

### G. Web portal (the hard track — E2EE ⨯ browser)

- **G.1 — Is the portal even E2EE-compatible?** Q: If the portal decrypts data, the key must reach the
  browser (or the server sees plaintext, breaking E2EE for that surface). Is the portal a full-trust
  client (key in-browser via WebCrypto + a careful key-delivery flow), a *separate reduced-trust tier*
  (only non-sensitive data), or read-only? Why: this can directly contradict D0.4. **This is the single
  biggest architectural fork in the milestone.** Resolve: pick the portal's trust tier before designing
  it.
- **G.2 — Key in the browser.** Q: If full-trust: WebCrypto key storage (IndexedDB non-extractable
  keys?), enrollment (scan a code from the phone?), and the XSS blast-radius. Why: browser key custody
  is materially riskier than device keystores. Resolve: threat-model it.
- **G.3 — Portal scope.** Q: Read-only viewer, full CRUD, or admin/export only? Why: scope changes
  everything above. Resolve: product decision, gated on G.1.

### H. Product / commercial

- **H.1 — Freemium boundary.** Q: Exactly what's free vs paid (sync is paid — is the web portal paid,
  is Electron paid)? Resolve: tier table.
- **H.2 — Entitlement without breaking offline.** Q: How is "is this user a subscriber" checked so it
  gates *sync* but never blocks the offline local app? Why: an entitlement check on a read path violates
  §1. Resolve: entitlement is checked at sync time only, cached, fail-open-to-local.
- **H.3 — Cost at scale.** Q: Turso + Supabase cost curve as users grow, vs sub revenue. Resolve: model
  it before public launch (not urgent for owner-only / small beta).

---

## 3. Decision register (owner calls to be made)

Ordered; several depend on a spike above. "TBD" = genuinely undecided; recommendation given where I have one.

| # | Decision | Depends on | Recommendation / status |
|---|----------|-----------|-------------------------|
| R1 | Adopt Turso, or abort after spikes | A.1–A.6 | Proceed to spikes; adopt only if A.3/A.4/A.5 pass. |
| R2 | Custom fields: keep §14 columns vs rewrite to rows | A.5, B.6 | **Keep unless A.5 proves columns can't replicate.** Reversal is an owner call; don't pre-empt. |
| R3 | E2EE granularity: blob-per-row vs field-level | C.2–C.4 | Lean blob-per-row (sync is a dumb ciphertext pipe). Confirm after C.3/C.4. |
| R4 | What metadata the cloud may see | C.3 | account id · object uid · revision · tombstone flag only. Confirm. |
| R5 | Photos: E2E-encrypted vs flagged-plaintext | C.1, D.2 | **Owner call.** Flag the inconsistency; if plaintext, require in-UI disclosure. |
| R6 | Key recovery model (unrecoverable-by-design?) | C.6–C.8 | Recovery phrase + explicit loss warning at set-time. Owner ratifies the "we can't recover it" stance. |
| R7 | Web portal trust tier (full-trust / reduced / read-only) | G.1 | **Owner call — biggest fork.** Decide before portal design. |
| R8 | Device-local vs synced table partition | B.7 | Draft table provided in §B.7; owner ratifies. |
| R9 | Sequencing: sync-first vs design-retool-first | §I | Owner undecided; see §I for the tradeoff. |
| R10 | Freemium tier boundaries | H.1 | Owner call; sync=paid is set (D0.5), rest TBD. |

---

## 4. Recommended sequencing

1. **Spike gate first (Track A + A.5).** One throwaway branch, behind `SqlExecutor`, no v1.0 code
   touched: adapter fit, test suite, sync maturity, headless, **DDL replication**, Electron runtime.
   This is the go/no-go. If A.3/A.4/A.5 fail, we stop and reconsider (not automatically PowerSync — D0.3).
2. **In parallel, non-code decisions that don't need the spike:** C.1 (privacy posture), C.3 (metadata
   boundary), R7 (web portal tier), R9 (sequencing). These are owner/product calls.
3. **Only after the gate passes:** design the conflict engine (B), the E2EE + key layer (C.6–C.8),
   photos/object storage (D), auth (E), then the desktop (F) and web (G) clients — each likely its own
   phase.
4. **Then** run `/gsd-new-milestone` and turn the survivors of this register into a real phase roadmap.

Rough shape once green: easily **6–10 phases** (adapter+sync core · conflict/tombstone engine · E2EE +
key mgmt + enrollment/recovery · photo object storage · auth + entitlement · Electron client · web
portal · hardening). This is a milestone, not "a phase or two."

---

## 5. Explicitly deferred / not now

- Actual Turso/Supabase project creation, keys, or any paid infra — not until the spike gate passes.
- PowerSync — dropped (D0.3); only reconsidered if Turso fails, and then fresh.
- iOS — still deferred per `HANDOFF §11`; sync design should not *preclude* it but need not target it.
- Committing any of this to `ROADMAP.md` — it stays in this doc until the milestone is opened.

---

## 6. Open items feeding back to v1.0

Only one thing here needs action *before* the milestone, and it lives in v1.0: **tombstones + the
reconciliation core in Phase 16.** See `PHASE-16-SYNC-READINESS.md`. Everything else waits for the gate.
