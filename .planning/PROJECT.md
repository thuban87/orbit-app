# Orbit

## What This Is

Orbit is a local-first, Android-first **personal relationship manager** — a CRM for your own
social life, not for sales. It tracks the people you care about, how overdue each one is for a
check-in, and what you might talk about next time. It is built in React Native / Expo on
on-device SQLite with **no backend**: contact data never leaves the phone. It is personal-use
first (the owner is user #1) but architected as though a public Play Store release will follow.

It is the successor to an Obsidian plugin (`~/projects/Orbit`, v0.9.0) that worked but fell out
of use because capture was too high-friction. The rebuild exists to fix exactly that.

## Core Value

**Collapse the taps between "you're overdue with X" and the message actually being sent.**
Familiarity is a function of contact *frequency*, not depth per contact (HANDOFF §1). Every
design decision is measured against "does this reduce the number of taps between the reminder
and the message going out." If everything else fails, frictionless, no-obligation check-ins must
work — that is the one thing the plugin got wrong and the reason this project exists.

## Business Context

<!-- Personal-use-first, but architected for a public release. -->

- **Customer**: The owner (user #1) today; Android users who want a private, subscription-free
  personal CRM later. Differentiators are all answers to complaints users already make about
  competitors: **Android-first**, **private by construction**, **no subscription** (HANDOFF §8).
- **Revenue model**: Undecided and deliberately deferred (HANDOFF Q1). AI is free BYO-key in v1
  (the user pays their chosen provider directly), so nothing in the architecture forces a
  subscription and monetisation can be chosen later with no rework (13-ai Cluster D).
- **Success metric**: The owner keeps using it — i.e. capture and mark-contacted stay frictional
  enough to survive daily real use where the plugin did not.
- **Competitive note**: UpHabit shut down ~April 2026 (took users' data with it); Dex is
  $12/mo with no free tier. A local-only DB structurally cannot lock in or shut down a user.

## Requirements

All Active requirements are hypotheses until shipped and validated. The scoped, testable v1 set
lives in `.planning/REQUIREMENTS.md`; this is the thematic summary.

### Validated

All 21 v1.0 phases shipped (2026-08-11 → 2026-08-31; milestone closed 2026-09-01). Full per-phase
detail: `.planning/milestones/v1.0-ROADMAP.md`; requirements traceability: `v1.0-REQUIREMENTS.md`.
Later phases (14, 17, 18.1, 18.2, 20, 21) were verified via device-UAT + owner sign-off. All commits
are local on `main`, NOT pushed.

- ✓ **Foundation & portable code** — v1.0 (Phase 1). Expo SDK 57 scaffold, ~900 lines of portable
  plugin logic extracted into `src/`, theme tokens + persisted store, FND-01 proven on the Pixel 6 Pro.
- ✓ **Data foundation & status engine** — v1.0 (Phase 2). Migration-1 scaffold with every un-backfillable
  column, the single-writer `last_contact` DAO, continuous derived status, launch-sweep skeleton.
- ✓ **Custom fields** — v1.0 (Phase 3), later normalized. Two-table design, TEXT-forever, `sortExpr`,
  7 parsers, `field_history`, quarantine/expiry, field editor.
- ✓ **Contact CRUD & lifecycle** — v1.0 (Phase 4). Create/edit forms, `contact_links`, archive/restore/purge.
- ✓ **Photos** — v1.0 (Phase 5). Library/URL picker, in-app Skia crop, 512px master, themed-initials fallback.
- ✓ **Interaction log, status & impact** — v1.0 (Phase 6). Touchpoints, editable timeline, gravity/intensity,
  `rogue`, "Rarely responds".
- ✓ **Conversational Fuel** — v1.0 (Phase 7). Per-item rows (incl. `off_limits`), ranked projection, search.
- ✓ **Dashboard & never-contacted screen** — v1.0 (Phase 8). Sort/filter/search, birthday banner, favourites.
- ✓ **Compose screen & SMS handoff** — v1.0 (Phase 9). In-app message surface (fuel visible, Send→SMS, Copy).
- ✓ **Share-sheet capture** — v1.0 (Phase 10). Android share target, grid-of-faces picker, `EXTRA_SUBJECT` patch.
- ✓ **Actionable notifications** — v1.0 (Phase 11). Pre-scheduled + launch-reconcile, decay + birthday, mute.
- ✓ **Home screen widget** — v1.0 (Phase 12). Favourites grid, headless mark, Quick mark · Log contact · Message.
- ✓ **Orrery** — v1.0 (Phase 13). Two-view Skia solar-system, rogue rendering, assignable/self-colour sun.
- ✓ **AI message suggestions** — v1.0 (Phase 14). Providers + secure-store keys, editable draft, `share_with_ai`.
- ✓ **Weekly digest** — v1.0 (Phase 15). One WEEKLY Sunday notification → a live "your week" screen.
- ✓ **Custom-field value normalization** — v1.0 (Phase 16, migration 006 / ADR-001). Normalized value-row model.
- ✓ **Backup, export & restore** — v1.0 (Phase 17). Manual + auto SAF backup, optional encryption, Merge/Replace.
- ✓ **Contact method normalization + Bound/Unbound lifecycle** — v1.0 (Phases 18.1, 18.2). Normalized
  phone/email methods, system-contact provenance, independent Bound/Unbound lifecycle.
- ✓ **System contact import** — v1.0 (Phases 19, 19.1; ADR-002 hybrid two-picker). Single/bulk acquisition,
  conservative duplicate evidence, resumable review; older-Android picker path.
- ✓ **Contact reconciliation & merge** — v1.0 (Phase 20; ADR-003). One-way source reconciliation, durable
  review, explicit atomic Orbit-to-Orbit merge with tombstoning.
- ✓ **Interaction assist & reach out** — v1.0 (Phase 21). Shared Call/Text/Email routing, durable
  post-handoff assist confirmation, widget Contact integration.

### Active

- **v1.1 — not yet scoped.** Run `/gsd-new-milestone` to question → research → define requirements →
  roadmap the next milestone. The milestone-2 dossier audit and `docs/dossier/milestone-2/AUDIT-HANDOFF.md`
  already exist to seed it. Deferred/v2 candidates remain in `docs/dossier/*.md` "Deferred to phase
  discussion" sections and the archived `v1.0-REQUIREMENTS.md` "v2 / Deferred" list.

### Out of Scope

- **Any backend / cloud sync in v1** — local-first is a product commitment, not an implementation
  detail (HANDOFF §3). A future opt-in sync layer would sit *over* a working local DB, never the reverse.
- **Supabase / agent-controlled DB experimentation** — explicitly moved to the owner's Mise project
  (HANDOFF §3, §11). All Orbit data is sensitive, so a "cloud half" would be too thin to be useful.
- **Obsidian vault importer** — domain 5 cut by the owner (04-log): he was the plugin's only user, the
  app starts clean with contacts typed by hand. *Code* porting (§4) is untouched; only *data* migration is cut.
- **iOS** — deferred, not cancelled (HANDOFF §11).
- **End-to-end encryption work** — moot for a local-only DB (HANDOFF §11).
- **Images as fuel** — text and links only in v1; no `image/*` intent filter (03-fuel).
- **Ollama / any local AI provider on mobile** — no zero-egress AI mode exists; every AI use ships to a
  configured cloud provider (03-fuel, owner call). Custom endpoint is HTTPS-only.
- **In-app camera / `SCHEDULE_EXACT_ALARM`** — declined on the "asks for almost nothing" privacy posture
  (07-photos, 11-notify). *(`READ_CONTACTS` was originally in this list but is now shipped, narrowly:
  ADR-002 declares it scoped `maxSdkVersion="36"` for the older-Android import picker, and ADR-003
  enables it on API 37+ only for user-initiated reconciliation re-reads. Import on API 37+ still uses the
  permissionless system picker. Owner-approved after Phase-20 device UAT; both are owner decisions on
  permission posture + Google Play Contacts policy.)*
- **Widget self-swap-to-profile, Direct Share targets, capture inbox, CSV export, monetisation/IAP** — all
  deferred post-v1 with recorded reasons (12-widget, 10-capture, 15-backup, 13-ai).

## Context

- **Current state (v1.0 shipped 2026-09-01).** All 21 phases complete; ~90,800 lines of TypeScript in
  `src/`; SQLite at migration `user_version` 14. The KB substrate is live — 24 phase KB manifests
  extracted, ADRs 001–0xx in `docs/decisions/` (graphify enabled). v1.0 phase artifacts are archived
  under `.planning/milestones/v1.0-phases/`; the milestone-2 dossier audit is done (`docs/dossier/
  milestone-2/AUDIT-HANDOFF.md`). All commits are local on `main`, NOT pushed — the owner pushes. Known
  deferred items (pre-existing lint drift, historical debug/UAT status residue) are recorded in
  STATE.md "Deferred Items"; none block v1.0.
- **The dossier is the authoritative research.** `docs/dossier/` holds 21 completed domain files
  (`01-data` … `21-interaction-assist-reach-out`) plus `INDEX.md`, whose "Cross-domain constraint log" records every
  `[source → target]` decision that binds a later phase. Each decision is tagged `[DECIDED]` /
  `[OPEN]` / `[REJECTED]`. Supporting evidence is in `docs/dossier/workpapers/`. This roadmap is
  **derived from** those decisions, not re-derived — a `[DECIDED]`/`[REJECTED]` item is not to be
  reopened without the owner. `HANDOFF.md` is the pre-repo decision record (platform, data layer,
  custom fields §14, friction features §6, positioning §8, first moves §15). `CLAUDE.md` holds the
  non-negotiable operating rules.
- **The predecessor plugin** lives read-only at `~/projects/Orbit` (`thuban87/Orbit`, v0.9.0, MIT).
  HANDOFF §4 records, verified against source, what ports (~900 lines: `AiService.ts`,
  `calculateStatus()` + constants/types, `schemas/types.ts`, both built-in schemas, `dates.ts`,
  `logger.ts`), what gets rewritten against SQLite, and what is deleted (Obsidian coupling). Reference
  it in place; never clone it into this repo.
- **Build & test pipeline (owner-defined, 2026-08-14).** This Linux box **cannot build Android APKs**
  (2012 Ivy Bridge CPU can't run a modern x86_64 emulator; no local Gradle/APK path). The intended
  loop: commit → **`rsync`/`scp` the repo over SSH** to the owner's Windows 11 desktop (SSH host
  `droid`, repo at `C:\Users\bwles\projects\orbit-app`) → build debug/release APK there via SSH
  (Android Studio is installed on the desktop) → pull the APK back to this box → `adb install` on the
  **Pixel 6 Pro** wired to this box → drive/test via `adb` / `uiautomator`. **Transport decided
  (2026-08-14): rsync/scp, NOT git push** — this keeps CLAUDE.md's global no-push rule fully intact
  for every repo (see Constraints). Source is pinned to `/home/bwales/projects/orbit-app`, dest to
  `C:\Users\bwles\projects\orbit-app`, build invoked only there. The desktop emulator is a fallback
  test target; perf claims are physical-Pixel-only (CLAUDE.md).
- **Intended execution style:** the owner plans to run the whole project autonomously end-to-end,
  sequentially (parallelization off).
- **Surfaces the dossier discovered with no INDEX owner:** the **never-contacted screen** (now owned by
  domain 8 / dashboard) and the **in-app compose screen** (still unowned — given its own phase here, as
  the first consumer is notifications and it is also consumed by the widget Message action and AI Suggest).

## Constraints

- **Tech stack**: React Native / Expo SDK 57 (RN 0.86, New Architecture), TypeScript, expo-sqlite,
  Zustand stores, Biome. Skia 2.6.2 + Reanimated 4.5.1 for the orrery; `react-native-android-widget`
  0.22.0 (+ custom dev client) for the widget; `expo-share-intent` for capture. — Reuse quest-board's
  scaffolding and theme-token pattern where it transfers (HANDOFF §2).
- **Local-first is a product commitment** — no backend, no telemetry, no analytics, no network on any
  read path. The sole network egress is the optional, user-invoked AI feature to a user-configured
  provider. Widening what leaves the device is an owner decision. (CLAUDE.md, HANDOFF §3.)
- **SQLite migrations are forward-only, ship as application code via `user_version`, run in strict
  order, and are irreversible in production** (no remote access to any user's DB). Never edit a shipped
  migration; never assume a starting state; wrap every step in a transaction. Un-backfillable columns
  (`uid`, `created_at`, `modified_at`, `ring_seq`, interaction `recorded_at`/`source`, fuel
  `kind`/`created_at`/`source`/`url`, `custom_field_defs` display-order) must exist from migration 1.
- **Custom-fields invariants** (CLAUDE.md / HANDOFF §14): two tables; every `contact_custom_values`
  column is TEXT forever; route every custom-field sort/filter through the single `sortExpr()`; never
  index or UNIQUE a custom value column (breaks `DROP COLUMN`); type changes never destroy data
  (flag, don't coerce); every destructive op snapshots to `field_history` in the same transaction;
  `col_name` is whitelist-**constructed**, never escaped; the launch sweep (not a timer) runs
  quarantine expiry, history retention, archived-contact purge, schedule reconcile, and backup rotation.
- **All colours resolve through theme tokens** — no hardcoded colours anywhere, including Skia draw
  calls. Never drive animation from React state; pause animation on `useIsFocused === false` and
  AppState background. Portrait-locked at the config layer.
- **Dates**: use `formatLocalDate()` on the TS side and `date('now','localtime')` in SQL — never
  `toISOString().split('T')[0]` / `date('now')` (UTC off-by-one; already fixed once in the plugin).
- **Git — push posture stays fully denied (transport is rsync, decided 2026-08-14).** CLAUDE.md's
  global rule "agents never push; the owner pushes" is **unchanged** — `git push` remains denied in
  `~/.claude/settings.json` for every repo. The owner considered a repo-scoped push allow but it can't
  be expressed cleanly (in Claude Code `deny` beats `allow` and merges across sources, so a local
  allow can't override the global deny; and Bash rules aren't directory-scoped). So code reaches the
  desktop via **`rsync`/`scp` over SSH** instead — `Bash(rsync *)`/`Bash(scp *)`/`Bash(ssh *)` are
  allowed in this repo's `settings.local.json` only. Agents still never `git push`.
- **No git worktrees** (`.planning/config.json` `use_worktrees:false`; blocked by a PreToolUse hook to
  add). Commit in place on the current branch.
- **No local APK build** — verification that needs a running app goes through the desktop-build → Pixel
  loop above (execution-time; verify SSH + a debug build once before relying on it).
- **Execution**: sequential (parallelization off), YOLO mode, quality model profile, research +
  plan-check + verifier + nyquist + source-grounding all on.

## Key Decisions

<!-- The load-bearing recorded decisions that constrain future work. Full rationale in the dossier. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| On-device SQLite, no backend; migration path stays open (sync would be opt-in, over a working local DB) | Privacy is the product; no lock-in/shutdown risk; no per-user server cost (HANDOFF §3) | ✓ Good |
| `contacts` has a surrogate PK **and** a distinct globally-unique `uid`; `modified_at` on every mergeable table from migration 1 | Merge-on-restore keys on `uid`; newest-edit-wins needs `modified_at`; neither is backfillable (01-data, 04-log, 15-backup) | ✓ Good (v1.0) |
| One single-writer DAO owns `last_contact` (= MAX over interaction rows, recomputed on every insert/edit/delete); every touchpoint inserts a row, incl. one-tap routes | Recency and history reconciled by construction; kills the plugin's four-writer drift (01-data, 04-log) | ✓ Good (v1.0) |
| Status is a continuous progress value (elapsed ÷ interval), derived-never-stored; `stable/wobble/decay` are thresholds; `rogue` is a 4th threshold + non-time path | One number drives dashboard sort and orrery angle; a stored status rots silently (01-data, 04-log) | ✓ Good (v1.0) |
| `ring_seq` is a **global** radius override (reverses HANDOFF §7's frequency-ordered radius; §7 survives as the default arrangement) | Emotional closeness ≠ contact frequency — owner's explicit reversal (01-data) | ✓ Good |
| Custom fields ship in v1 as their own phase; TEXT-forever two-table design | Owner is user #1 and hits missing fields within a week; forces the data model correct early (HANDOFF §14) | ✓ Good (v1.0) |
| Never-contacted contacts are excluded from dashboard/orrery and get their own screen; archived is a separate home | `last_contact IS NULL` removes born-red/NULL-sort hazards; two populations are semantically different (01-data, 06-crud, 08-dashboard) | ✓ Good (v1.0) |
| Friction features (share-sheet capture, actionable notifications, widget) are make-or-break, built early; dashboard before orrery | They are the reason the plugin fell out of use (HANDOFF §6, §15.5) | ✓ Good (v1.0) |
| "Fuel visible" at the reminder = an in-app **compose screen**, not drawn over / prefilled into the SMS composer; notification body is generic (frozen scheduled content) | Literal reading unbuildable on Android; `expo-sms` can't run headless; scheduled content freezes at schedule time (03-fuel, 11-notify) | ✓ Good (v1.0) |
| No Ollama/local AI on mobile; custom endpoint HTTPS-only; keys in `expo-secure-store`, never exported | No zero-egress mode; an `http://` LAN endpoint would reopen the rejected LAN path + force app-wide cleartext (03-fuel, 13-ai) | ✓ Good |
| Obsidian vault *data* import cut; *code* porting (§4) untouched | Owner was the only plugin user; app starts clean (04-log) | ✓ Good |
| `android:allowBackup="false"` + deletion-on-uninstall makes export **load-bearing**: v1 ships manual + auto rotating SAF backup, plaintext-default with optional AES-256-GCM | Export is the only barrier to total loss and the anti-lock-in differentiator (01-data, 15-backup) | ✓ Good (v1.0) |
| Build/test via desktop (`droid`) SSH build + Pixel 6 Pro install; transport is rsync/scp, NOT git push | This box can't build APKs; keeps the global no-push rule fully intact (2026-08-14) | ✓ Good (v1.0) |
| Custom-field values normalized to a durable value-row model (migration 006 / ADR-001), retiring the dynamic-column table; TEXT-forever preserved | Sync-safety + stable `uid` per value; dynamic columns can't survive Merge-restore (16-normalization) | ✓ Good (v1.0) |
| System-contact import uses a hybrid two-picker (ADR-002): permissionless system picker on API ≥37; scoped `READ_CONTACTS maxSdkVersion="36"` + in-app picker on ≤16 | Google Play Contacts policy (effective 2027-01-27) bars broad `READ_CONTACTS` on modern targets (19-import, 19.1) | ✓ Good (v1.0) |
| Reconciliation re-read enables `READ_CONTACTS` on API 37+ (ADR-003, supersedes ADR-002 partial) — user-initiated only | The one-shot picker can't supply an ongoing linked-set comparison; owner-approved after device UAT (20-reconcile) | ✓ Good (v1.0) |
| Bound/Unbound contact lifecycle is independent of cadence; merge tombstones the absorbed contact (not archive) | Preserves future-sync compatibility without building sync now; existing contacts migrate Bound (18.2, 20) | ✓ Good (v1.0) |
| Interaction Assist writes a durable pending assist before native handoff and logs the interaction at handoff time through the single recency writer | Local, user-initiated, no passive monitoring; never resurrects merged/purged contacts (21-assist) | ✓ Good (v1.0) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Business Context check — customer, revenue model, success metric still accurate?
4. Audit Out of Scope — reasons still valid?
5. Update Context with current state

---
*Last updated: 2026-09-01 after v1.0 MVP milestone*
