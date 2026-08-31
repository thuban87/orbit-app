---
phase: 21-interaction-assist-reach-out
plan: 06
status: scaffolded
device: Pixel 6 Pro
build: DEBUG required (run-as database verification)
---

# Phase 21 Device UAT Scoreboard

This is the device-only release gate for Interaction Assist & Reach Out. Every
PASS requires a screenshot and a WAL-aware `run-as` database read recorded in
the Evidence column. Do not infer database correctness from visible UI.

## Evidence Rules

- Use a DEBUG APK; release builds cannot use `run-as`.
- For confirmed rows, verify `occurred_at === handoff_at`, `direction='outbound'`,
  `source='assist'`, and the action-specific `connected` value.
- Verify `contacts.last_contact` changes only through the authoritative recency
  recompute path, not a bespoke write.
- Record the actual device serial, build commit, screenshot path, SQL/read output,
  and time-travel technique for each row below.
- `BLOCKED` rows are explicit owner/device checkpoints and must never be
  auto-passed. A failure or deviation stops sign-off and is surfaced to the owner.

| ID | Scenario | Required result / DB assertion | Time travel | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| R01 | One actionable endpoint | Call/Text/Email route launches directly; reachable action is available. | N/A | PENDING | |
| R02 | Multiple endpoints | Selector appears; primary is emphasized; chosen endpoint launches in at most three taps. | N/A | PENDING | |
| R03 | Assist ON | Pending assist is written before native handoff; return later exposes banner. | N/A | PENDING | |
| R04 | Assist OFF, including toggle while pending | Native launch writes no assist and shows no banner; toggling OFF expires existing pending queue immediately. | N/A | PENDING | |
| R05 | Return before eligibility | Return in under 15 seconds does not show a prompt; assist remains pending. | Record DEBUG-lowered eligibility constant or WAL-aware `handoff_at` backdate. | PENDING | |
| R06 | Eligible foreground return | Return after eligibility presents the app-global banner; Android Back passes through it. | Record DEBUG-lowered eligibility constant or WAL-aware `handoff_at` backdate. | PENDING | |
| R07 | Call: Yes | Confirmation writes one outbound assist interaction at handoff time with `connected=1`; widget recency tile refreshes without restart. | N/A | PENDING | |
| R08 | Call: No answer | Confirmation writes one outbound assist interaction at handoff time with `connected=0`. | N/A | PENDING | |
| R09 | Text and Email: Yes | Each attestation writes an outbound assist interaction at handoff time with the channel-specific result. | N/A | PENDING | |
| R10 | Don't log and optional note | Don't log writes no interaction; a confirmation note persists on a written interaction. | N/A | PENDING | |
| R11 | Native handoff failure — Call | Thrown/no-compatible-app launch marks assist `failed`, shows channel Alert, and shows no prompt. | N/A | BLOCKED | Device-dependent failure; requires a genuine reproducible failed launch or owner decision. |
| R12 | Native handoff failure — Text | Thrown/no-compatible-app launch marks assist `failed`, shows channel Alert, and shows no prompt. | N/A | BLOCKED | Device-dependent failure; requires a genuine reproducible failed launch or owner decision. |
| R13 | Native handoff failure — Email | Thrown/no-compatible-app launch marks assist `failed`, shows channel Alert, and shows no prompt. | N/A | BLOCKED | Device-dependent failure; requires a genuine reproducible failed launch or owner decision. |
| R14 | 24-hour expiry and sixth-pending prune | Expired pending assist is not prompted; sixth pending creation expires/prunes the oldest per DAO contract. | Record DEBUG-lowered expiry constant or WAL-aware `handoff_at` backdate. | PENDING | |
| R15 | Same-contact repeat + process death/reboot | Two handoffs create separate assists; non-expired pending rows survive kill/reboot and resume in the banner. | N/A | PENDING | |
| R16 | Archived, merged, and purged lifecycle | Archived pending assist remains loggable; merged assist logs to survivor; purge removes assist and deep link shows unavailable then Dashboard. | N/A | PENDING | |
| R17 | Widget Contact and stale widget REACH | Contact opens shared router; archived existing REACH silently drops; purged REACH shows unavailable then Dashboard. | N/A | PENDING | |
| R18 | Widget route consume-once | After router opens from widget, background then foreground does not reopen it. | N/A | PENDING | |
| R19 | Compose handoff | Draft reaches Messages through shared handoff; later banner confirmation writes the assist interaction. | N/A | PENDING | |
| R20 | Long text visual backstop | Long contact name and optional note do not clip in banner, routes, or confirmation. | N/A | PENDING | |
| R21 | Owner sign-off | Node gates and every required device row pass with DB evidence and zero deviations; record the plain-language DB-state recommendation. | N/A | BLOCKED | Explicit owner/pre-approval checkpoint; do not auto-pass before the full device matrix. |

## Time-Travel Decision

Technique is intentionally undecided until Task 3. For each time-dependent row,
record exactly one reproducible method: a DEBUG-only lowered constant or a
WAL-aware `run-as` update that backdates the target row's `handoff_at`. Do not
wait for 15 seconds or 24 hours without recording the method used.

## Final Recommendation

Pending Task 3. If every row passes with zero deviations, summarize for the
owner that confirmations preserved handoff time, used the sole recency writer,
stored the asserted connected values, and preserved the failure/lifecycle
fail-safes. Otherwise list every failed, blocked, or deviating row for an owner
decision.
