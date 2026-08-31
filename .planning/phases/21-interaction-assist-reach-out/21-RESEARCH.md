# Phase 21: Interaction Assist & Reach Out - Research

**Researched:** 2026-08-31
**Domain:** React Native / Expo Android-first — native Call/Text/Email handoff, durable SQLite-backed intent queue, app-global return banner, widget deep-link integration
**Confidence:** HIGH (every load-bearing claim verified by opening the source file this session; native-handoff runtime behavior is device-UAT, marked where it applies)

## Summary

Phase 21 is a **brownfield, additive** phase built almost entirely from primitives that already ship
in this repo. The single authoritative interaction writer the confirmation path must call —
`recordTouchpoint()` — already accepts every field the dossier needs (outbound direction, `connected=0`,
caller-supplied local `occurredAt`, free-text `channel`, optional `note`, custom `source`), verified at
`src/db/recency-dao.ts:217`. No recency/`last_contact`/`rarely_responds` logic is reinvented; the
confirmation DAO wraps `recordTouchpoint`. `[VERIFIED: src/db/recency-dao.ts:159-243]`

The phase adds **one new table** (`interaction_assists`) via **migration 014** (current head is 013 /
`TARGET_VERSION = 13`, verified at `src/db/database.ts:48,64`), **one new `app_settings` boolean column**
(`interaction_assist_enabled INTEGER NOT NULL DEFAULT 1`, following the migration-005 idiom), a Reach Out
router modal + endpoint selector (reusing `OverflowMenu`/`ComposeScreen` idioms per the approved UI-SPEC),
an app-global return banner (Zustand store + AppState listener), a launch-sweep hook for 24h-expiry /
30-day-retention pruning (`registerSweepHook`, `src/services/launch-sweep.ts:45`), and a bounded widget
change (Message→Contact) touching exactly three files.

**No new external packages are required.** Text handoff reuses the already-installed `expo-sms`
(`SMS.sendSMSAsync`, `src/screens/ComposeScreen.tsx:41,446`); Call and Email are greenfield and use
React Native core `Linking.openURL('tel:…' | 'mailto:…')` — the same `Linking` already imported across
the app. The three cross-phase wiring points that are easy to miss and MUST be honored: (1) add
`interaction_assists` to `mergeContacts`' reparent loop (`src/db/merge-dao.ts:153`) or a pending assist is
cascade-deleted on merge and redirect breaks; (2) rely on `contact_id … ON DELETE CASCADE` for purge
removal; (3) extend `resolveWidgetUri`'s strict allow-list (`src/navigation/widget-linking.ts:114`) with a
new `orbit://reach/<id>` form.

**Primary recommendation:** Build a new `interaction-assist-dao.ts` (create-before-handoff, resolve→
`recordTouchpoint`, prune) + `assist-store` (Zustand, AppState-driven banner queue) + Reach Out router
components, add migration 014 for the table and the settings column, wire the three cross-phase points
above, and register one sweep hook. Reuse `recordTouchpoint`, `listActionablePrimaryMethods`,
`listContactMethodGroups`, `newUid`, `localDateTime`, and `updateAppSettingsCore` verbatim — do not
reinvent any of them.

<user_constraints>
## User Constraints (from CONTEXT.md → dossier is ground truth)

> CONTEXT.md is a shim that points to `docs/dossier/21-interaction-assist-reach-out.md` as the
> authoritative, locked product-decision record (per project MEMORY: "Dossier is ground truth, not
> CONTEXT.md"). The dossier's `[DECIDED]`/`[REJECTED]`/`[SUPERSEDES]` clusters are locked. The 23
> Cross-Domain Invariants (dossier lines 723–748) are the acceptance contract.

### Locked Decisions (from dossier — do NOT reopen)

- **Reach Out is one reusable router** for actionable Call/Text/Email, primary-emphasized, ≤3 taps when
  endpoint choice is needed. Endpoint choice is handoff context only; interaction history stays coarse
  (`call`/`text`/`email`). (Clusters A, B, C, D)
- **Route enabling is phone/email-granular, not channel-granular** — any actionable phone backs BOTH Call
  and Text (a landline is offered as textable). No per-endpoint call-vs-text gating. (Cluster A, D;
  `[VERIFIED: src/logic/contact-method-normalization.ts:15-79]` — `isActionable` is a single boolean per
  method, phone line-type is discarded.)
- **Reach Out action is hidden entirely** when a contact has no actionable phone AND no actionable email —
  no dead entry point, no empty modal. (Cluster A)
- **Write the pending assist immediately BEFORE native handoff.** Failed handoff → `failed`, never a
  pending prompt, never an interaction. "Failed" = the native launch threw / no compatible app — NOT
  "user declined." (Clusters E, F)
- **Interaction Assist global toggle, default ON.** Reach Out works whether Assist is on or off. Toggling
  OFF **clears the pending queue immediately and silently** ("off means off") — no confirmation dialog,
  normal `Switch`. (Cluster G)
- **Return confirmation is an app-global, persistent, non-modal banner** — not a modal, not a dashboard
  card, not screen-tied. **Android Back passes THROUGH it** (explicit exception to the M2 shell "Back
  dismisses topmost transient" rule — the banner is durable state). (Cluster H)
- **15-second minimum buffer** after handoff before an assist is eligible to prompt. (Cluster I)
- **Confirmation actions:** Call → `Yes` / `No answer` / `Don't log`; Text/Email → `Yes` / `Don't log`.
  Text/Email `Yes` is **user attestation, NEVER delivery/read verification.** (Clusters J, AJ)
- **Optional Notes expander**, collapsed by default, offered on **every confirmation that writes an
  interaction** (incl. Call `No answer`). `Don't log` writes nothing → no notes. (Cluster K)
- **Queue capped at 5 unresolved + 24h expiry.** 6th pending prunes the oldest. Expired assists never
  write an interaction. Repeated same-contact attempts = separate assists. (Clusters L, M, N, O, P)
- **Pending non-expired assists survive process death / reboot** (SQLite durability). (Cluster Q)
- **Confirmed interaction time = the assist's handoff time**, not the confirmation time. (Cluster R)
- **All Phase-21 interactions are outbound.** Call `No answer` still writes a row with `connected=false`.
  (Clusters S, T)
- **All confirmed writes flow through the existing authoritative interaction/recency path**
  (`recordTouchpoint`). No new recency semantics. (Clusters U, T)
- **Assist status taxonomy:** `pending` / `logged` / `dismissed` / `expired` / `failed`. `Don't log` →
  `dismissed`. Resolved rows retained temporarily, pruned after 30 days. (Clusters V, W, X)
- **Contact lifecycle:** Reach Out/Assist work for Unbound (never auto-Binds). Archived target → still
  loggable. **Merged target → redirect to survivor by reparenting the assist inside Phase 20's merge**
  (NOT a lazy survivor lookup — no survivor pointer exists). **Purged target → removed with the identity;
  no interaction written.** Purged deep-link target → friendly "no longer available" → Dashboard.
  (Clusters Y, Z, AA, AB)
- **Compose "Send" writes nothing at handoff** — assist creation is additive; only confirmation writes.
  (Cluster AC; `[VERIFIED: src/screens/ComposeScreen.tsx:436-458]` — `onSend` writes no row.)
- **Basic Email handoff** (native mail app), no dedicated Orbit email compose screen. (Cluster AD)
- **Widget: replace larger widget's `Message` action with `Contact`** → deep-links into the shared Reach
  Out router. Widget NEVER writes assist rows. All other widget architecture unchanged; no widget-specific
  Call/Text/Email. Small-widget unchanged. (Clusters AE, AF, AG, AH)
- **Wholly local, user-initiated.** No passive call/SMS/email observation, no delivery/read verification,
  no background monitoring, no endpoint-level history. (Clusters AI, AJ)

### Claude's Discretion (planning choices WITHIN locked behavior)

Exact assist schema, router/banner component composition, deep-link payload shape, 15s/24h/cap-5
pruning implementation, handoff API wiring, notes UI, target-resolution wiring, merge/purge table
wiring mechanism, settings storage/migration, widget label/icon swap. (dossier "Remaining Phase 21
Planning Details", lines 779–825)

### Deferred Ideas (OUT OF SCOPE — do NOT build)

Notification-listener assist, call-log/SMS/RCS reading, inbound detection, automatic OS-event interaction
creation, call-duration capture, delivery/read verification, WhatsApp/Signal/etc. as first-class
channels, permanent endpoint-level history, dedicated email compose screen, system-notification assist
prompt, new small-widget comms actions, new widget Call/Email buttons, background assist polling.
(dossier "Explicitly Deferred", lines 761–776)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IAS-01 | Shared Reach Out router (profile + larger-widget Contact) for Call/Text/Email via actionable methods, primaries emphasized, ≤3 taps on endpoint choice | Router reuses `listActionablePrimaryMethods` / `listContactMethodGroups` (`src/db/contact-methods-read.ts:7-40`); UI idioms `OverflowMenu.tsx` + `ComposeScreen.tsx` (UI-SPEC §Design System). Handoff via `expo-sms` (Text) + core `Linking.openURL` (Call/Email). Widget entry via new `orbit://reach/<id>` allow-list form. |
| IAS-02 | Default-on Assist writes durable pending assist before handoff; failures → `failed`; app-global non-modal banner; 5-item / 24h queue | New `interaction_assists` table (migration 014); `interaction_assist_enabled` settings column (default 1); `assist-store` (Zustand + AppState); launch-sweep prune hook (`registerSweepHook`, `src/services/launch-sweep.ts:45`). Cap/expiry enforced at write-time + sweep + query filter. |
| IAS-03 | Confirmed → outbound coarse interactions at handoff time via authoritative writer; Call No answer `connected=false`; optional notes; no resurrection of merged/purged | Confirmation DAO calls `recordTouchpoint(exec, {direction:'outbound', connected, channel, occurredAt: handoff_at, note, source})` (`src/db/recency-dao.ts:217`). Merge reparent (`merge-dao.ts:153`) + purge cascade (`purge-dao.ts` FK) enforce no-resurrection. |
| IAS-04 | Wholly local/user-initiated; no passive monitoring/verification/endpoint-history/widget-side writer; widget Message→Contact, rest unchanged | No network on any path (local-first). Widget change is 3 files (`widget-render.tsx:452-459`, `widget-linking.ts`, guard). Widget emits only a deep-link URI; `widget-task-handler.tsx` writes nothing for OPEN_URI (`src/services/widget/widget-task-handler.tsx:78-83`). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Native Call/Text/Email launch | Browser/Client (RN JS → OS intent) | — | `expo-sms` / `Linking.openURL` hand off to the OS dialer/messages/mail app. User-initiated intents; no permission needed. |
| Durable pending-assist queue | Database/Storage (SQLite) | — | Must survive process death/reboot (Cluster Q). Local-first, no backend. |
| Confirmation → interaction write | Database/Storage (SQLite DAO) | — | Routes through `recordTouchpoint` single-writer (DATA-04 invariant). |
| Return banner surfacing / eligibility | Client (Zustand store + AppState) | Database (query pending) | Foreground-only, app-global overlay; re-queries SQLite on `background→active`. |
| 24h-expiry / 30-day-retention prune | Client (launch-sweep hook) | Database | SQLite has no scheduler — expiry runs as an app-launch sweep, never a timer. |
| Assist toggle | Database (`app_settings`) | Client (Settings `Switch`) | One boolean column; standard settings idiom. |
| Widget Contact deep-link | Client (widget RemoteViews → deep-link) | Client (nav resolver) | Widget cannot host an assist writer (RemoteViews); it only emits a URI. |

## Standard Stack

### Core (all already installed — NO new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-sms` | ~57.0.1 | Text handoff (`SMS.sendSMSAsync(phone, body)`) | Already the app's SMS path (`ComposeScreen.tsx:41,446`). `[VERIFIED: package.json]` |
| `react-native` (Linking) | 0.86.2 | Call (`tel:`) + Email (`mailto:`) handoff via `Linking.openURL` | Core module already imported app-wide (`LinksEditor.tsx:28`, `saf-storage.ts:2`). No new dep. `[VERIFIED: package.json + grep]` |
| `expo-sqlite` (via `@/db`) | (in use) | Durable assist table | Local-first DB; `recordTouchpoint` + migrations already here. |
| `zustand` | (in use, `src/stores/`) | Banner queue store | Project state-management convention (CLAUDE.md). |
| `react-native-android-widget` | 0.22.0 | Widget Contact action label + deep-link | Existing widget stack. `[VERIFIED: package.json]` |

### Supporting (in-repo helpers to REUSE verbatim)
| Helper | File:line | Purpose | When to Use |
|--------|-----------|---------|-------------|
| `recordTouchpoint()` | `recency-dao.ts:217` | THE authoritative interaction+recency writer | Every confirmation that writes a row (Yes / No answer / Text-Email Yes) |
| `listActionablePrimaryMethods()` | `contact-methods-read.ts:30` | Actionable primary phone/email per type | Router: decide which routes render + emphasize primary |
| `listContactMethodGroups()` | `contact-methods-read.ts:7` | All methods per type (ordered) | Endpoint selector when ≥2 actionable endpoints exist |
| `newUid()` | `uid.ts:18` | Hermes-safe UUID (guards `globalThis.crypto`) | Assist row `uid` + interaction `uid` — do NOT call `crypto.randomUUID` directly |
| `localDateTime()` | `database.ts:74` | Local wall-clock `YYYY-MM-DD HH:MM:SS` | `handoff_at`, `created_at`, `modified_at`, and the confirmation `occurredAt`/`now` |
| `formatLocalDate()` | `dates.ts:17` | Local `YYYY-MM-DD` | Any date-only need — never `toISOString().split('T')[0]` |
| `updateAppSettingsCore()` | `app-settings-dao.ts:617` | `?`-bound settings UPDATE | Toggle write (extend `COLUMN_OF` with the new key) |
| `registerSweepHook()` | `launch-sweep.ts:45` | Register a launch-time prune job | 24h-expiry + 30-day-retention sweep |
| `inWriteTransaction()` | `transaction.ts` | Hand-rolled BEGIN/COMMIT/ROLLBACK | Every multi-statement assist write (create-with-prune, resolve, toggle-off-clear) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Linking.openURL('tel:…')` for Call | `expo-intent-launcher` / `expo-linking` | New dependency for zero benefit; core `Linking` already handles `tel:`/`mailto:`. Do NOT add. |
| `Linking.openURL('mailto:…')` for Email | `expo-mail-composer` | New dep; dossier explicitly defers a rich email compose surface (Cluster AD). `mailto:` is the decided "basic handoff." |
| `SMS.sendSMSAsync` for Text | `Linking.openURL('sms:…')` | `expo-sms` is already the app's proven SMS path and pre-fills the body; keep it for consistency with Compose. |

**Installation:** none — no packages added this phase.

## Package Legitimacy Audit

> Phase installs **no** external packages. All handoff/storage/state APIs come from already-present,
> already-used dependencies. Gate is trivially satisfied.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `expo-sms` | npm (already installed ~57.0.1) | mature | high | github.com/expo/expo | OK (official Expo; in use `ComposeScreen.tsx:41`) | Approved — no install |
| `react-native` Linking | npm (0.86.2, core) | mature | very high | github.com/facebook/react-native | OK | Approved — no install |
| `react-native-android-widget` | npm (0.22.0, already installed) | mature | moderate | github.com/sAleksovski/react-native-android-widget | OK (in use) | Approved — no install |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
  Profile "Reach out"     │        SHARED REACH OUT ROUTER (modal)       │
  ───────────────────────▶│  read actionable methods                    │
  Widget "Contact"        │  (listActionablePrimaryMethods /             │
  (orbit://reach/<id>) ──▶│   listContactMethodGroups)                   │
  via WidgetLinkingGate   │                                              │
                          │  route buttons: Call · Text · Email          │
                          │  (only routes with an actionable method)     │
                          └───────────────┬──────────────────────────────┘
                                          │ endpoint ambiguous? (≥2)
                                          ▼
                          ┌──────────────────────────┐  1 endpoint → skip
                          │  ENDPOINT SELECTOR        │  (≤3 taps total, Cluster B)
                          │  primary emphasized       │
                          └───────────────┬──────────┘
                                          │ user picks endpoint
                                          ▼
          Assist ON?  ───yes──▶ ┌───────────────────────────────────┐
              │                 │ WRITE pending assist (BEFORE       │  interaction_assists
              │                 │ handoff): status='pending',        │  (SQLite, durable)
              │                 │ channel, endpoint_value, handoff_at │  cap-5 prune in same txn
              │                 └───────────────┬───────────────────┘
              no                                │
              │                                 ▼
              ▼                    ┌───────────────────────────┐
    (launch native app only) ────▶│  NATIVE HANDOFF            │── throws / no app ──▶ mark 'failed'
                                   │  expo-sms | Linking tel:/  │                       (never prompts)
                                   │  mailto:                   │
                                   └───────────────────────────┘
                                                │ app backgrounds, user returns
                                                ▼
        AppState background→active ──▶ ┌──────────────────────────────────┐
        (assist-store re-queries)      │  RETURN BANNER (app-global,       │
                                        │  non-modal, Back passes through)  │
                                        │  eligible = pending AND           │
                                        │  now-handoff_at ≥ 15s AND ≤24h    │
                                        │  shows newest + "{N} more pending"│
                                        └───────────────┬──────────────────┘
                          ┌───────────────┬─────────────┴────────┐
                       "Yes"          "No answer"            "Don't log"
                          │           (call only)                 │
                          ▼               ▼                       ▼
              recordTouchpoint(       recordTouchpoint(      status='dismissed'
                direction:'outbound',   connected:0, …)      (no interaction)
                connected:1,
                channel, occurredAt=handoff_at, note?)
                          │               │
                          ▼               ▼
                  status='logged'   status='logged'
                  (interactions table = authoritative history)

  Launch sweep hook (registerSweepHook): expire pending >24h → 'expired'; DELETE resolved >30 days.
  Merge: reparent assist to survivor INSIDE mergeContacts. Purge: FK ON DELETE CASCADE removes assist.
```

### Recommended Project Structure (new files)
```
src/db/
├── migrations/014-interaction-assists.ts   # new table + interaction_assist_enabled column
├── interaction-assist-dao.ts               # create-before-handoff, resolve→recordTouchpoint, prune, toggle-off-clear
└── interaction-assist-read.ts              # pending-queue query (eligible/newest/count)
src/services/
├── reach-out/handoff.ts                     # expo-sms + Linking tel:/mailto: launch + failure detection
└── interaction-assist-sweep.ts             # sweep hook: 24h expire + 30d prune (registerSweepHook)
src/stores/
└── assist-store.ts                          # Zustand banner queue + AppState subscription
src/components/
├── ReachOutRouter.tsx                       # route modal (OverflowMenu idiom)
├── EndpointSelector.tsx                     # ≥2 endpoints, primary emphasized (ComposeScreen actionBtn idiom)
├── AssistBanner.tsx                         # app-global non-modal banner (BirthdayBanner idiom)
└── AssistConfirmation.tsx                   # Yes/No answer/Don't log + Notes expander (aiPanel idiom)
```

### Pattern 1: Confirmation → authoritative writer (the core write)
**What:** Every confirmation that logs a row calls `recordTouchpoint`, passing the assist's stored
handoff time as `occurredAt` (Cluster R) and confirmation time as `now`.
**When to use:** Call `Yes`, Call `No answer` (connected=0), Text/Email `Yes`.
```typescript
// Source: signature verified src/db/recency-dao.ts:59-78, 217-243
await recordTouchpoint(exec, {
  contactId: assist.contact_id,
  uid: newUid(),                       // Hermes-safe (uid.ts:18) — NOT crypto.randomUUID
  occurredAt: assist.handoff_at,       // handoff time, NOT now (Cluster R)
  now: localDateTime(),                // confirmation time → recorded_at/modified_at
  channel: assist.channel,             // 'call' | 'text' | 'email' (free-text col, no CHECK)
  direction: "outbound",               // Cluster S — all Phase-21 interactions outbound
  connected: answered ? 1 : 0,         // 'No answer' → 0 (Cluster T)
  note: note ?? null,                  // optional (Cluster K)
  source: "assist",                    // new free-text source; interactions.source has NO CHECK
});
// then, same logical operation: UPDATE interaction_assists SET status='logged', resolved_at=?, modified_at=?
```
`interactions.channel`, `.direction`, `.source` are **free TEXT with no CHECK constraint**
`[VERIFIED: src/db/migrations/001-initial.ts:97-110]` — a new `source='assist'` value inserts cleanly.

### Pattern 2: Write-before-handoff with cap-5 prune (one transaction)
```typescript
// Source: schema idiom src/db/migrations/013-reconciliation-and-merge.ts:7-31; txn transaction.ts
return inWriteTransaction(exec, async () => {
  const uid = newUid();
  await exec.runAsync(
    `INSERT INTO interaction_assists
       (uid, contact_id, channel, endpoint_value, status, handoff_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [uid, contactId, channel, endpointValue, now, now, now]);
  // Cap 5 unresolved (Cluster M): expire any pending beyond the newest 5.
  await exec.runAsync(
    `UPDATE interaction_assists SET status='expired', resolved_at=?, modified_at=?
      WHERE status='pending' AND id NOT IN (
        SELECT id FROM interaction_assists WHERE status='pending'
        ORDER BY created_at DESC, id DESC LIMIT 5)`,
    [now, now]);
  return uid;
});
// The NATIVE handoff runs AFTER this commit (Cluster E). If it throws → separate UPDATE status='failed'.
```

### Pattern 3: Native handoff + failure detection
```typescript
// Source: src/screens/ComposeScreen.tsx:436-458 (SMS pattern), LinksEditor.tsx:79 (Linking.openURL)
try {
  if (channel === "text") await SMS.sendSMSAsync(endpoint, "");   // Android result 'unknown' — NOT a sent signal
  else await Linking.openURL(channel === "call" ? `tel:${endpoint}` : `mailto:${endpoint}`);
} catch (err) {
  // "failed" = launch threw / no compatible app (Cluster F). Mark assist 'failed'; Alert; never prompt.
  await markAssistFailed(exec, uid, localDateTime());
  Alert.alert(/* per-channel copy from UI-SPEC Copywriting */);
}
```
Do **not** gate on `Linking.canOpenURL` for `tel:`/`mailto:` — on Android 11+ it returns false without
`<queries>` manifest entries and produces false "unavailable" errors. Prefer try/`openURL`/catch (mirrors
`FuelEditor.tsx:129` / `LinksEditor.tsx:79`).

### Pattern 4: App-global return banner (Zustand + AppState, NOT setTimeout)
- The 15-second buffer (Cluster I) and 24h expiry (Cluster N) are **wall-clock comparisons against the
  stored `handoff_at`**, evaluated at query time — NOT an in-app `setTimeout` (a timer dies on process
  death and defeats Cluster Q durability).
- Banner re-queries pending assists on cold start and on every AppState `background→active` (mirror the
  `installSweepTrigger` transition test at `launch-sweep.ts:108-114`, but as a **separate** subscription —
  the banner must refresh on every return, whereas the launch sweep dedupes to once-per-launch).
- Eligible pending = `status='pending' AND (now - handoff_at) ≥ 15s AND (now - created_at) ≤ 24h`,
  ordered newest-first; banner shows the newest + `"{N} more pending"` for the rest.
- Banner is an **absolutely-positioned overlay in the App shell**, NOT a `Modal` — a `Modal` captures
  Android Back, but Cluster H requires Back to pass through. Render it above the navigator so it is
  app-global.

### Anti-Patterns to Avoid
- **Driving the banner/eligibility with `setTimeout`.** Dies on process death; violates Cluster Q. Use
  stored `handoff_at` + wall-clock.
- **Reintroducing a recency calculation.** `recordTouchpoint` owns `last_contact`/`rarely_responds`/gravity
  (DATA-04). The confirmation DAO must call it — never `UPDATE contacts.last_contact` directly
  (`recency-dao.ts:1-12` names itself the ONLY writer).
- **Calling `crypto.randomUUID()` directly.** Undefined in Hermes on-device (see Landmines). Use `newUid()`.
- **Using `toISOString()` for `handoff_at`.** UTC evening off-by-one; the interaction `occurred_at` derived
  from it would shift the status day. Use `localDateTime()` (`database.ts:74`).
- **Relying on FK cascade for merge redirect.** Cascade DELETES the assist on merge; redirect needs the
  assist REPARENTED first (see Landmine 2).
- **Rendering an empty Reach Out modal.** No actionable methods → hide the action entirely (Cluster A).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Writing the outbound interaction + recency | A bespoke INSERT + `last_contact` update | `recordTouchpoint()` (`recency-dao.ts:217`) | It is the single writer of `last_contact`; a second writer breaks DATA-04, `rarely_responds`, gravity. |
| UUID for assist/interaction rows | `crypto.randomUUID()` | `newUid()` (`uid.ts:18`) | Hermes has no `globalThis.crypto`; `newUid` already guards + falls back. |
| Local timestamp | `new Date().toISOString()` | `localDateTime()` / `formatLocalDate()` | UTC off-by-one at night; corrupts status day. |
| SMS handoff | Hand-rolled `sms:` URI | `SMS.sendSMSAsync` (`ComposeScreen.tsx:446`) | Native address+body marshalling; already the app's path. |
| Merge redirect of the assist | Lazy survivor lookup at confirm time | Add table to `mergeContacts` reparent loop (`merge-dao.ts:153`) | No survivor pointer exists in schema; merge and purge write identical tombstones — a stale id can't be resolved after the fact. `[VERIFIED: merge-dao.ts:184-185, purge-dao.ts:236-240]` |
| Settings write | Ad-hoc `UPDATE app_settings` | `updateAppSettingsCore()` (`app-settings-dao.ts:617`) + extend `COLUMN_OF` | `?`-bound, validated, single UPDATE path. |
| Launch-time expiry | A background timer/interval | `registerSweepHook()` (`launch-sweep.ts:45`) | SQLite has no scheduler; expiry is an app-launch sweep (CLAUDE.md data rule). |
| Widget deep-link parsing | Ad-hoc URI parse | Extend `resolveWidgetUri` allow-list (`widget-linking.ts:114`) | Strict anchored allow-list is a security boundary (untrusted launcher intent). |

**Key insight:** This phase is 90% orchestration of existing, verified primitives. The correctness risk is
almost entirely in the **cross-phase wiring** (merge/purge/widget) and the **durable-queue semantics**
(cap/expiry/eligibility as data, not timers) — not in any new algorithm.

## Runtime State Inventory

> Not a rename/refactor phase — additive. But it wires into three shared subsystems whose runtime state
> matters:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (new) | `interaction_assists` table (new, migration 014); `app_settings.interaction_assist_enabled` column | Migration 014; extend `AppSettings` type/keys/`COLUMN_OF`/`getAppSettings` SELECT (`app-settings-dao.ts:39-330`) |
| Shared-table writers — `interactions` | Confirmation adds a new writer path, but ONLY via `recordTouchpoint` (the sole `last_contact` writer). Existing writers unchanged. | Confirmation DAO calls `recordTouchpoint`; add no direct `interactions`/`last_contact` write. |
| Shared writer — `mergeContacts` reparent loop | `merge-dao.ts:153` reparents `["interactions","events","fuel","custom_field_values","contact_links","contact_methods","external_contact_links"]` | **Add `"interaction_assists"` to this array** so pending assists move to the survivor before the absorbed row is deleted (Cluster AA). |
| Shared writer — `purgeContact` | `purge-dao.ts:244` explicit fan-out over `PURGE_CHILDREN` (a `Record<TombstoneEntityType,…>`) | Assists are operational (not a tombstone entity, not mergeable, Cluster X) → **rely on `contact_id … ON DELETE CASCADE`** for purge removal. Add a purge-dao test asserting a pending assist is gone after purge. |
| Widget runtime | Larger widget emits `orbit://compose/<id>` from the `Message` action (`widget-render.tsx:452-459`); resolver allow-list has `contact`/`compose`/`favourites` only (`widget-linking.ts:83-92`) | Swap label→`Contact`, uri→`orbit://reach/<id>`; add `orbit://reach/<id>` to `resolveWidgetUri` + a new `WidgetNavIntent` variant + the guard. Keep the `compose` route (still used by notification tap, CMP-02). |
| Secrets/env vars | None — no keys, no permissions | None. User-initiated `tel:`/`sms:`/`mailto:` intents need **no Android permission** (unlike `READ_CONTACTS`/call-log, which remain out of scope per REQUIREMENTS "Out of Scope"). |
| Launch sweep | `launch-sweep.ts` registry currently holds other phases' hooks | Register one new prune hook (24h expire + 30d retention). Must NOT be imported by any headless path (`widget-task-handler.tsx:34-42` warns headless taps must never reach the sweep). |

## Common Pitfalls

### Pitfall 1: Hermes has no `globalThis.crypto` — `crypto.randomUUID()` throws on-device
**What goes wrong:** An assist/interaction row minted with `crypto.randomUUID()` works in Node/vitest
(WebCrypto present) but throws on the Pixel (Hermes), and tests never catch it (project MEMORY "Hermes
crypto is undefined", Bug B).
**How to avoid:** Use `newUid()` (`uid.ts:18`) — it already guards `globalThis.crypto?.randomUUID` and
falls back to a `Math.random` v4. **Warning sign:** any direct `crypto.` reference in new Phase-21 code.

### Pitfall 2: Merge cascade-deletes the pending assist before redirect
**What goes wrong:** With `contact_id … ON DELETE CASCADE` and no reparent, `mergeContacts` deletes the
absorbed contact (`merge-dao.ts:185`) and the pending assist vanishes — redirect to survivor (Cluster AA)
silently fails.
**How to avoid:** Add `"interaction_assists"` to the reparent array at `merge-dao.ts:153`. `reparent()`
does `SET contact_id=?, modified_at=?` — so the table MUST have a `modified_at` column. **Warning sign:**
a merge test where the survivor has no pending assist after absorbing a contact that had one.

### Pitfall 3: `interactions.source` — new value looks risky but is fine
**What goes wrong:** Teams sometimes assume `source` is CHECK-constrained and add a converter or reuse
`'manual'`. **Reality:** `interactions.source` is plain `TEXT NOT NULL` with **no CHECK**
`[VERIFIED: 001-initial.ts:97-110]`. A new `source='assist'` inserts cleanly and disambiguates assist-
logged rows from manual ones. Use it.

### Pitfall 4: Banner as a `Modal` captures Android Back
**What goes wrong:** RN `Modal` intercepts the hardware Back button; Cluster H requires Back to pass
THROUGH the banner (it is durable, not a transient layer). A `Modal`-based banner would consume Back and
violate the locked exception (dossier line 217).
**How to avoid:** Render the banner as an absolutely-positioned overlay in the app shell, not a `Modal`.

### Pitfall 5: `setTimeout`-based 15s buffer / expiry dies on process death
**What goes wrong:** A JS timer for "eligible after 15s" or "expire at 24h" is lost when the OS kills the
app during the native handoff — exactly when durability matters (Cluster Q).
**How to avoid:** Store `handoff_at`; compute eligibility/expiry as wall-clock deltas at query time; run
durable cleanup in the launch sweep.

### Pitfall 6: `Linking.canOpenURL` false-negatives on Android 11+
**What goes wrong:** `canOpenURL('tel:…')`/`('mailto:…')` returns false without `<queries>` manifest
entries, producing a spurious "no app" error even when a dialer/mail app exists.
**How to avoid:** try/`openURL`/catch (as `LinksEditor.tsx:79` / `FuelEditor.tsx:129` do); treat only a
thrown error as "failed handoff."

### Pitfall 7: `adb input tap` false-negatives during device UAT
**What goes wrong:** On-device verification of small RN `Pressable`s (route buttons, banner actions) can
silently miss (project MEMORY "adb tap false-negatives"), reading as a broken control.
**How to avoid:** Verify against code first; use the correct input method per control type (project MEMORY
"adb input source taxonomy"); prefer `uiautomator dump` for exact bounds.

## Code Examples

### Migration 014 — new table + settings column (idiom from 013 + 005)
```typescript
// Source: schema idiom src/db/migrations/013-reconciliation-and-merge.ts:4-56;
//         ALTER idiom src/db/migrations/005-digest-settings.ts:40-41
export const migration014: Migration = {
  version: 14,
  async apply(exec: SqlExecutor): Promise<void> {
    await exec.execAsync(`
      CREATE TABLE interaction_assists (
        id             INTEGER PRIMARY KEY,
        uid            TEXT NOT NULL UNIQUE,
        contact_id     INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        channel        TEXT NOT NULL CHECK (channel IN ('call','text','email')),
        endpoint_value TEXT,                    -- operational handoff context only (Cluster D); nullable
        status         TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','logged','dismissed','expired','failed')),
        handoff_at     TEXT NOT NULL,           -- local wall-clock; becomes interaction occurred_at (Cluster R)
        resolved_at    TEXT,
        created_at     TEXT NOT NULL,
        modified_at    TEXT NOT NULL            -- required by mergeContacts' reparent() (merge-dao.ts:89)
      );
      CREATE INDEX idx_interaction_assists_pending
        ON interaction_assists (status, created_at DESC);

      ALTER TABLE app_settings
        ADD COLUMN interaction_assist_enabled INTEGER NOT NULL DEFAULT 1;
    `);
  },
};
// Then: TARGET_VERSION 13 → 14 and append migration014 to MIGRATIONS (database.ts:48,51-65).
```
`[VERIFIED: src/db/database.ts:48]` `TARGET_VERSION = 13`; `[VERIFIED: src/db/database.ts:36-37,64]`
migrations run through 013 (`013-reconciliation-and-merge`). **Next migration = 014; new
TARGET_VERSION = 14.**

### Toggle-OFF clears the pending queue (Cluster G, one transaction)
```typescript
// Source: updateAppSettingsCore src/db/app-settings-dao.ts:617; txn transaction.ts
export function setInteractionAssistEnabled(exec, enabled: 0 | 1, now: string): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await updateAppSettingsCore(exec, { interactionAssistEnabled: enabled }, now); // add key to COLUMN_OF
    if (enabled === 0) {
      // "off means off": clear pending immediately (Cluster G). Mark 'expired' (keeps the 30-day audit
      // trail + lifecycle taxonomy) rather than hard-delete; cleared assists never resurface.
      await exec.runAsync(
        `UPDATE interaction_assists SET status='expired', resolved_at=?, modified_at=?
          WHERE status='pending'`, [now, now]);
    }
  });
}
```

### Widget Message → Contact (three edits)
```typescript
// 1) src/services/widget/widget-render.tsx:452-459 — the LargeTile action button
<ActionButton glyph="☎" label="Contact"            // was glyph="✉" label="Message"
  glyphColor={palette.accent} palette={palette}
  clickAction="OPEN_URI"
  clickActionData={{ uri: `orbit://reach/${tile.id}` }} />   // was orbit://compose/${tile.id}

// 2) src/navigation/widget-linking.ts — add to the strict allow-list (mirror CONTACT_URI:91)
const REACH_URI = /^orbit:\/\/reach\/([0-9]+)$/;
// …and a new WidgetNavIntent variant resetting onto [Home, target-that-opens-the-router].

// 3) reuse guardWidgetIntent (widget-quick-action-guard.ts) for the live/purged check;
//    purged target → guarded===null → drop; add the "no longer available"→Dashboard nav half (Cluster AB).
```
Keep the existing `orbit://compose/<id>` route in `resolveWidgetUri` — it is still used by the
notification-tap path (CMP-02); only the widget stops emitting it.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Widget `Message` → Compose | Widget `Contact` → shared Reach Out router | This phase (Cluster AH `[SUPERSEDES]` Dossier 12) | 3-file bounded change; small widget unchanged |
| (none) direct interaction at Send | Send/handoff writes nothing; only confirmation writes | Already true (Cluster AC) | Compose is additive; no change to `onSend` needed beyond optional assist creation when Send hands to Messages |

**Deprecated/outdated:** nothing removed. This phase adds; it reverses no shipped decision.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The legacy Obsidian plugin (`~/projects/Orbit`) offers no reusable native Call/Text/Email handoff code (a plugin has no dialer/SMS intent surface); Reach Out/Assist is greenfield here. | Standard Stack | Low — even if some UX copy is reusable, the handoff mechanism is necessarily new on RN/Android. Planner may skim plugin docs for confirmation-UX wording only. |
| A2 | `source='assist'` is the right new source label (vs reusing `'manual'`). Dossier does not name a source value. | Code Examples / Pattern 1 | Low — `source` is free TEXT; any label works. A distinct label just aids future queries. Owner/planner may prefer `'reach-out'`. |
| A3 | Marking cleared/expired assists `status='expired'` (vs hard DELETE) on toggle-off and 24h expiry. Dossier says "clears"/"prunes" without specifying. | Toggle-OFF / Sweep | Low — both satisfy "never resurface / no interaction." `expired` keeps the 30-day audit trace (Cluster X); DELETE is also compliant. Planning choice. |
| A4 | Purge removal via `ON DELETE CASCADE` (assists excluded from tombstones as operational state). Dossier blesses "cascade-delete OR explicit deletion." | Runtime State Inventory | Low — dossier Cluster AB explicitly permits cascade. A purge-dao test must assert removal either way. |
| A5 | The widget deep-link opens the router by resetting onto [Home, Profile/target] which auto-opens the router (vs a dedicated route). | Widget example | Low — nav-shape detail; the guard + allow-list are the load-bearing parts. Planner picks the exact route. |

## Open Questions

1. **Exact nav target for `orbit://reach/<id>`**
   - What we know: allow-list + `WidgetNavIntent` + guard must be extended (`widget-linking.ts`).
   - What's unclear: whether the router opens via a Profile param, a dedicated route, or a shell-level
     intent consumed by the app-global router host.
   - Recommendation: reset onto `[Home, Profile{contactId, openReachOut:true}]` and have Profile open the
     shared router on that param — minimal new routing surface; reuses the guarded Profile open.

2. **Should Compose "Send" create an assist now, or is that M2 Phase 12's job?**
   - What we know: Cluster AC says Compose Send hands to native + assist creation; Cross-Milestone note
     (dossier line 756) says M2 Phase 12 will own Compose Send UX and MUST map to this handoff model.
   - What's unclear: whether Phase 21 wires Compose→assist now or leaves a documented seam.
   - Recommendation: wire the shared handoff helper so Compose's existing `onSend` can create an assist
     when Assist is ON (small, additive), and record the M2 Phase 12 seam. Confirm scope with owner if it
     expands the phase.

3. **Notes on Call `No answer`** — confirmed in scope (Cluster K, dossier line 290): the Notes expander is
   offered because `No answer` still writes a row (Cluster T). No open question; flagged so it is not
   dropped from the confirmation UI for the non-`Yes` action.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-sms` | Text handoff | ✓ | ~57.0.1 | — |
| `react-native` Linking | Call/Email handoff | ✓ | 0.86.2 | — |
| `expo-sqlite` | Assist table | ✓ | in use | — |
| `zustand` | Banner store | ✓ | in use | — |
| `react-native-android-widget` | Widget Contact action | ✓ | 0.22.0 | — |
| Android dialer / messages / mail app | Native handoff success | device-dependent | — | Try/catch → `failed` + `Alert` (Cluster F) — the designed degrade path, not a blocker |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** a device lacking a compatible app for a channel → that handoff
throws → assist `failed` + per-channel `Alert` (the intended behavior, not an error).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 `[VERIFIED: package.json]` |
| Config file | `vitest.config.ts` `[VERIFIED: exists]` |
| Quick run command | `npx vitest run <file>` |
| Full suite command | `npm test` (`vitest run`) |

**Node-pure DAO contract:** every DAO takes `exec: SqlExecutor` and is tested node-side against the
`__testkit__` executor (e.g. `recency-dao.test.ts`, `merge-dao.test.ts`, `purge-dao.test.ts` all exist).
The new `interaction-assist-dao.ts` MUST follow this shape so its cap/expiry/resolve/merge-reparent logic
is node-testable without a device. **What Vitest CANNOT cover** (device-UAT only, per project MEMORY):
`expo-sms`/`Linking` native handoff, Hermes crypto behavior, the RemoteViews widget render, and the
AppState return-banner timing on-device.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IAS-02 | create-before-handoff + cap-5 prune | unit | `npx vitest run src/db/interaction-assist-dao.test.ts` | ❌ Wave 0 |
| IAS-02 | 24h expiry + 30d retention sweep | unit | `npx vitest run src/services/interaction-assist-sweep.test.ts` | ❌ Wave 0 |
| IAS-02 | toggle-off clears pending | unit | `npx vitest run src/db/interaction-assist-dao.test.ts` | ❌ Wave 0 |
| IAS-03 | confirm → `recordTouchpoint` (Yes/No answer/Text-Email Yes, outbound, handoff-time) | unit | `npx vitest run src/db/interaction-assist-dao.test.ts` | ❌ Wave 0 |
| IAS-03 | merge reparents pending assist to survivor | unit | `npx vitest run src/db/merge-dao.test.ts` (extend) | ✅ (extend) |
| IAS-03 | purge removes pending assist (cascade) | unit | `npx vitest run src/db/purge-dao.test.ts` (extend) | ✅ (extend) |
| IAS-01 | actionable-route derivation (hide when none, primary emphasis) | unit | `npx vitest run src/db/interaction-assist-read.test.ts` | ❌ Wave 0 |
| IAS-01/04 | widget allow-list accepts `orbit://reach/<id>`, rejects malformed | unit | `npx vitest run src/navigation/widget-linking.test.ts` (extend) | ✅ (extend) |
| IAS-02 | banner eligibility (≥15s, ≤24h, newest + count) | unit (pure logic) | `npx vitest run src/stores/assist-store.test.ts` (extract pure eligibility fn) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file(s)>`
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green before `/gsd-verify-work`; then **device UAT on the Pixel** for the
  native-handoff / banner / widget flows (project MEMORY "Verify UI on the Pixel yourself"; use the
  desktop-build pipeline + `run-as` for DB-invariant checks).

### Wave 0 Gaps
- [ ] `src/db/interaction-assist-dao.test.ts` — create/cap/resolve/toggle-off (IAS-02, IAS-03)
- [ ] `src/db/interaction-assist-read.test.ts` — route derivation + queue query (IAS-01, IAS-02)
- [ ] `src/services/interaction-assist-sweep.test.ts` — 24h expire + 30d prune (IAS-02)
- [ ] `src/stores/assist-store.test.ts` — pure eligibility (≥15s/≤24h/newest+count) (IAS-02)
- [ ] Extend `merge-dao.test.ts` — assist reparented to survivor (IAS-03)
- [ ] Extend `purge-dao.test.ts` — assist removed on purge (IAS-03)
- [ ] Extend `widget-linking.test.ts` — `orbit://reach/<id>` accepted, malformed rejected (IAS-04)

## Security Domain

> `security_enforcement: true` `[VERIFIED: .planning/config.json:46]` — section required.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local-first, single on-device user; no auth surface. |
| V3 Session Management | no | No sessions/network. |
| V4 Access Control | no | No multi-user/roles. |
| V5 Input Validation | **yes** | Widget deep-link URI is an **untrusted launcher intent** (can be spoofed by another app) — parse ONLY through the strict anchored allow-list `resolveWidgetUri` (`widget-linking.ts:114`); the new `orbit://reach/<id>` form MUST reuse the same `[0-9]+` + `Number.isSafeInteger` + `>0` guarding (`widget-linking.ts:91-106`). `endpoint_value` and `note` are `?`-bound, never interpolated. |
| V6 Cryptography | n/a | `uid` is an identifier, not a secret (`uid.ts:8-10`) — no crypto strength needed; `newUid` fallback is fine. |
| V7 Error Handling/Logging | yes | Handoff failures logged via `Logger` (no user content to a network — there is none); `Alert` copy carries no sensitive data. |

### Known Threat Patterns for {RN/Android, local-first, deep-links}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofed/oversized widget deep-link (`orbit://reach/<huge>`) | Tampering / DoS | Strict anchored regex + `Number.isSafeInteger` reject (reuse `parseWidgetId`, `widget-linking.ts:100-106`). |
| Deep-link to a purged/merged contact | Tampering (resurrection) | `guardWidgetIntent` live-check → purged drops to "no longer available"→Dashboard (Cluster AB); merged handled by reparent (Cluster AA). |
| SQL injection via note/endpoint | Tampering | All values `?`-bound through `SqlExecutor` (repo-wide invariant; `recency-dao.ts:33-34` security note). |
| Data egress via handoff | Info disclosure | Native intents hand OFF to the OS; Orbit sends nothing to a server (local-first). No new network path — verify none is added. |
| Privilege creep via new permission | Elevation | `tel:`/`sms:`/`mailto:` are user-initiated intents needing **no permission**; do NOT add `CALL_PHONE`/call-log/`READ_SMS` (out of scope, REQUIREMENTS "Out of Scope"). |

## Sources

### Primary (HIGH confidence — files opened this session)
- `src/db/recency-dao.ts:59-243` — `recordTouchpoint` signature + single-writer invariant
- `src/db/merge-dao.ts:88-189` — reparent loop (line 153), tombstone+delete (184-185)
- `src/db/purge-dao.ts:76-283` — explicit fan-out, `PURGE_CHILDREN`, cascade note
- `src/db/database.ts:48,64,74` — `TARGET_VERSION = 13`, migration list, `localDateTime`
- `src/db/migrations/001-initial.ts:97-110` — `interactions` schema (no CHECK on channel/direction/source)
- `src/db/migrations/013-reconciliation-and-merge.ts:4-56` — new-table schema idiom
- `src/db/migrations/005-digest-settings.ts:40-41` — `ALTER TABLE app_settings ADD COLUMN … DEFAULT 1`
- `src/db/uid.ts:18-38` — `newUid` Hermes-safe UUID
- `src/utils/dates.ts:17-22` — `formatLocalDate`
- `src/db/contact-methods-read.ts:7-40` — `listContactMethodGroups`, `listActionablePrimaryMethods`
- `src/logic/contact-method-normalization.ts:15-79` — `isActionable` boolean (phone/email granular)
- `src/navigation/widget-linking.ts:83-158` — strict allow-list resolver + `WidgetNavIntent`
- `src/services/widget/widget-render.tsx:436-459` — larger-widget `Message` action button
- `src/services/widget/widget-task-handler.tsx:78-83` — OPEN_URI writes nothing headless
- `src/services/launch-sweep.ts:26-115` — `registerSweepHook` / `installSweepTrigger`
- `src/screens/ComposeScreen.tsx:41,436-458` — `SMS.sendSMSAsync`, Send writes no row
- `src/db/app-settings-dao.ts:39-330,617` — settings booleans + `updateAppSettingsCore`
- `package.json` — `expo-sms ~57.0.1`, `react-native 0.86.2`, `react-native-android-widget 0.22.0`
- `.planning/config.json:24,46,51` — nyquist/security/worktrees flags
- `docs/dossier/21-interaction-assist-reach-out.md` (full) — locked product decisions
- `.planning/phases/21-interaction-assist-reach-out/21-UI-SPEC.md` (full) — approved UI contract

### Secondary (MEDIUM confidence)
- Project MEMORY notes (Hermes crypto, migration renumber, device UAT, adb taxonomy) — corroborated by
  the on-disk `uid.ts` guard and `database.ts` migration list.

### Tertiary (LOW confidence)
- Assumption A1 (legacy plugin has no reusable handoff) — reasoned, not file-verified this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every API verified in already-shipping code; no new packages.
- Architecture (writer, migration, merge/purge/widget wiring): HIGH — all touchpoints opened and cited.
- Native-handoff runtime behavior: MEDIUM — `expo-sms`/`Linking` behavior is device-observable only;
  failure model is verified against the existing Compose path.
- Pitfalls: HIGH — each traces to a verified file or a corroborated project-MEMORY incident.

**Research date:** 2026-08-31
**Valid until:** 2026-09-30 (stable brownfield; re-verify `TARGET_VERSION` before writing the migration —
it drifts every schema phase, and the next migration number is head+1 as of THIS session = 014).
</content>
</invoke>
