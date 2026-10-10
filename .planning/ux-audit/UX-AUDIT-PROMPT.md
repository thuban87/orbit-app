# Orbit UX Audit — Orchestrator Prompt

> Paste everything below the line into a fresh Claude Code session in `/home/bwales/projects/orbit-app`,
> running **Opus 5.5 at medium reasoning**. Written 2026-10-09 from the Phase 39 planning session;
> owner direction recorded in `.planning/phases/39-onboarding/39-LEDGER.md` (Batch 11, N-16).

---

You are the orchestrator of a **hands-on UX audit** of Orbit, an Android personal relationship manager (React Native / Expo, local-first SQLite). The owner wants to know whether the app looks and behaves like one polished, coherent product, or whether it is full of leftover screens, mismatched editors, dead ends and things that only make sense if you built them.

This is **not** a code review, security review or performance review. You judge the app **from the user's side of the screen**: what a person sees, taps and understands. Code is read only to diagnose a finding you already observed on the phone.

## 1. The one rule that matters most

**Never excuse a finding because a document says it is intended.** The owner has overturned many of his own earlier decisions. An old ADR, dossier or comment that says "X is deliberate" does not make X good UX today. If something looks old, inconsistent, hidden, confusing or unfinished to a user, report it. The owner will decide later what is intended (a separate decisions audit may run afterwards). Do not read `docs/decisions/` or `docs/dossier/` to judge findings.

## 2. Hard rules (sources in brackets)

- **Report only. Do not change app code, config or docs** [owner, 2026-10-09: "We're not changing anything"]. The only files you write are the audit outputs in §8.
- **Never push. Never `git worktree`. Never pass `isolation: "worktree"`** [CLAUDE.md]. Commit only the report file in §8, with a plain message and no AI attribution [owner memory].
- **No real AI provider calls.** Do not press Draft / Rewrite / any AI action, do not connect a provider, do not validate a key [owner: "except the AI stuff as that could incur costs"]. You may open and browse the AI Settings screens.
- **Never edit the phone's Android Contacts app data, never change the device clock, never upload to Google Drive** [owner memory: test-phone rules; no Drive uploads].
- **Never press Transmit in Compose to a real recipient.** Use only synthetic contacts with no real phone numbers or emails; if a handoff opens an Android app, back out without sending.
- **One agent drives the phone at a time.** Device passes run strictly sequentially. Agents that only read code may run in parallel with a device pass.
- **Device:** the **Pixel 6 Pro** [owner, 2026-10-09: "I would actually use the pixel 6 for this … the target device really for this project"]. Resolve its serial from `adb devices -l` (the runbook lists it); exactly one device must be listed in state `device`. If it is absent or `unauthorized`, stop and tell the owner; do not fall back to another phone.
- **Models:** you and every subagent run **Opus at medium effort** [owner, 2026-10-09]. Pass `model: "opus"` and `effort: "medium"` on every Agent call.
- **Out of scope** [owner, 2026-10-09]: the **Orrery** (just redesigned in Phase 38.7), the **home-screen widget** (scheduled for a full overhaul), **onboarding/tutorials** (Phase 39, not built yet), and anything requiring a real AI call.

## 3. Read first (items 1–3 yourself; delegate item 4)

1. `CLAUDE.md` — especially the Android device section and its gotchas.
2. `docs/runbooks/desktop-build-pipeline.md` §0 and §2 — how to build a **debug** APK on the desktop (`ssh droid`, arm64-v8a only) and run Metro on this box.
3. These notes in `/home/bwales/.claude-account2/projects/-home-bwales-projects-orbit-app/memory/` (they are hard-won device lessons; pass the relevant ones to every device agent):
   `orbit-metro-port-8082-remap.md`, `adb-reverse-lifecycle.md`, `logbox-toast-blocks-tab-taps.md`, `adb-tap-false-negatives.md`, `adb-input-source-taxonomy.md`, `device-uat-runas-pattern.md`, `saf-grant-reconnect-cycle.md`, `test-phones-are-for-testing.md`, `no-ai-api-calls-without-clearing.md`, `untracked-artifacts-folder.md`.
4. **Coverage checklist (delegate it):** have one non-device agent read `src/navigation/types.ts`, `src/navigation/RootNavigator.tsx` and `src/navigation/tabs/*.tsx` and write `untracked/artifacts/ux-audit/coverage-checklist.md`: every registered route, grouped by the §5 areas, with how a user reaches it. Each area's agents get their slice. The audit is complete only when every in-scope route has been reached on the phone or marked unreachable (which is itself a finding).
5. **Known items — do not re-report** (list them in the report's "Known" section only if you find materially new detail):
   - `.planning/ROADMAP.md` backlog **999.3** (old Fuel editor for Off Limits; inline Memory/Off Limits inputs on the contact forms), **999.4** (app name hardcoded as "Orbit" in many places), **999.5** (things shared into the app from other apps are saved invisibly; a new Things to Remember section is planned), **999.6** (moving entries between Things to Remember sections).
   - Phase 39 dossier `.planning/phases/39-onboarding/39-CONTEXT.draft.md` prerequisite fixes already decided: manual Add Contact defaults (Unbound + Today), Relationship Basics collapsed, tapping a possible match does nothing, the double "Did you send it?" in Compose, "Not tracked" status on a tracked person with no contact yet.
   - Systems builder shows "0 members" with every filter "Any"; Archive runs with no confirmation (ledger N-10).

## 4. Setup (one device agent, before any audit pass)

1. Confirm the 6 Pro is attached. Record `adb shell dumpsys package com.bwales.orbit | grep -E 'versionName|lastUpdateTime|flags'`.
2. **Back up the phone's current app data first** [owner: "maybe we should do a export first so we can restore that test harness"]:
   - In the app: Settings → Data & Backup → Export (or the equivalent), saved to the phone's backup folder; confirm the file exists (`adb shell ls` on that folder) and note its name.
   - If the installed build is debuggable, also copy the database files with `run-as` (all of `*.db`, `-wal`, `-shm`) into `untracked/artifacts/ux-audit/baseline/`.
   - Do not continue until at least one restorable copy is confirmed.
3. Build and install a **debug** APK of the current `main` per the runbook (§2; arm64-v8a only). If the installed build is a release build, `install -r` of a debug build will fail on signature; only then uninstall, and only after step 2 is confirmed. Start Metro on **:8082** and remap `adb reverse tcp:8081 tcp:8082` per the memory note. Dismiss the LogBox toast before tapping tabs.
4. **Data.** Keep the existing data if it survived; the 6 Pro handles large sets. Add synthetic contacts only where a check needs a state that doesn't exist yet, all named with a `Zz UX` prefix and with no real phone numbers or emails. Make sure the audit can see: a contact with every Things to Remember section filled; Off Limits entries; custom fields of several types; categories; a group event; an Unbound person; an archived person; something in Recently Deleted; a possible duplicate for import review; a contact never contacted; a contact with long history; a contact with no photo and one with a photo.
5. Note the theme in use. Every pass checks its screens in the default theme, and spot-checks the most important screens in light and dark mode of both theme packages (Galaxy and Standard) at the end of the pass.

## 5. Audit passes (sequential device agents)

Run one device agent per area, in this order. Give each agent: §1, §2, the relevant memory notes, its slice of the coverage checklist, the finding format (§6) and its output folder. Each agent works **exhaustively**: open every screen in its area, tap every button, open every menu, sheet and dialog, try every option, change every setting and change it back, try empty / one / many states, use Android Back from every screen, and test text entry with very long text and empty input. Restore any setting it changed.

| # | Area | Includes |
|---|---|---|
| A | Contacts tab | list and grid views, search, filters, sort, populations, selection and bulk actions, row/card swipe gestures and long-press menus, empty states, header actions, the + button and each of its actions (open them; deep audit of each happens in its own area) |
| B | Events tab | event list, event detail, creating, editing and deleting events, reminders on events, empty states |
| C | Digest | light pass: Up Next, Horizon, Your Week, every tappable thing, empty states (the owner considers Digest intentionally slim; report only real problems) |
| D | Profile | every section (Relationship Overview, Things to Remember, Contact Methods, History), every card and sheet they open, the header actions, More actions (Edit, Snooze, Unbind, Archive, Profile Layout, Background, Reset), Message and Call buttons, collapsed/expanded behaviour |
| E | Add, Edit and Update Contact | Add Contact (all sections, Show More), Edit Contact (all sections), Update Contact and each focused editor it opens, photos, categories, Bound/Unbound and frequency, validation, discard behaviour |
| F | Logging and history | Quick Log from each place it exists, Log Interaction, Group Log, the post-log snackbar (Undo, Add Note), interaction detail, editing and deleting interactions, backdating, the History section (heatmap, lenses, Jump to date, the stream) |
| G | Things to Remember | Memories (add, edit, types, pin/hide/outdated, history), current-state fields (last talked about, current location), Key People / relationships, Off Limits, custom fields and their definitions, categories management |
| H | People lifecycle and import | Import from Contacts (single and bulk), review matches, reconcile/merge, Unbound list, Archive, Recently Deleted, restore, permanent delete, Favourite, Snooze, Mute |
| I | Sharing into the app | share text and a link from another app (e.g. Chrome or Keep) into Orbit, pick a contact, then look for where it ended up (known: 999.5 — report only new problems with the flow itself) |
| J | Compose and confirmations | Compose from each entry, Things to Remember inside Compose, Copy, Transmit to a synthetic contact (back out of the Android app without sending), the "Did you send it?" panel, the app-wide banner and the pending list (do not press any AI button) |
| K | Settings | every Settings page and sub-page, every toggle and picker (change and restore), Notifications settings and the permission flow, Data & Backup screens (do not restore over the phone's data), AI screens browsed only, About |

After all passes, one non-device agent runs a **cross-cutting comparison** (§7): line up the same kind of thing across areas and report every mismatch. At minimum compare:
- every editor for a piece of information about a person (are the same data edited the same way everywhere?);
- every Save / Cancel / Done / Discard placement and wording;
- every delete or destructive confirmation;
- every empty state;
- every list row, chip, toggle and button style;
- every header (titles, back buttons, overflow menus);
- the words used for the same concept on different screens (e.g. "Log", "Log Interaction", "Quick Log"; "Bound", "tracked"; channel names);
- every sheet and dialog style.

## 6. What counts as a finding

Report anything a careful user or designer would notice. Categories:

| Code | Category | Examples |
|---|---|---|
| LEFT | Leftover or retired surface | a screen or editor that looks like an older generation of the app; a duplicate path to the same thing that behaves differently |
| INC | Inconsistency | the same data edited by different editors; same action, different label or behaviour; mismatched styles between sibling screens |
| DEAD | Dead end or broken | a tap that does nothing; a save that seems to vanish; no way back; a control that never enables; an error with no recovery |
| HID | Hidden or unintuitive | an important action only reachable by an undisclosed gesture; unclear consequences; labels that only make sense to the developer |
| COPY | Wording | inconsistent terms, typos, jargon, truncation, unclear button text |
| VIS | Visual polish | alignment, spacing, clipping, overlap (e.g. the + button covering content), contrast, wrong colours in a theme, inconsistent icons |
| A11Y | Accessibility seen from the UI | controls without labels in the uiautomator dump, things only distinguishable by colour, targets that are too small |

Severity: **High** — broken, data seems lost or invisible, or a dead end. **Medium** — inconsistent or confusing enough to make a user hesitate. **Low** — polish.

**Fix proposals** [owner, 2026-10-09: "fixes should be proposed if it's an easy to diagnose issue. For bigger issues that require real investigating, we should put a pin in those for later"]:
- If the cause is clear after a short, read-only look at the code (one or two files), add a **Proposed fix**: what to change, where (`path:line`), and what the user will see afterwards.
- Otherwise mark **Needs investigation** with what you observed and where you would start looking. Do not dig further.

Each finding:

```
### <AREA>-<NN> · <CODE> · <High|Medium|Low> — <one-line title>
- Where: <screen> → <how you got there> (route name if known)
- What happens: <observed, plain words>
- Why it's a problem: <from the user's side; name the other screen it disagrees with, if any>
- Evidence: <screenshot path(s)>; <uiautomator dump path if relevant>
- Proposed fix: <…>   OR   Needs investigation: <…>
```

## 7. Keep your own context lean: workers write files, you read summaries

The owner will keep using this session after the audit (fixes, follow-ups), so **you never load screenshots, UI dumps or full findings files yourself** [owner, 2026-10-09]. Work through files and short summaries:

- **Every agent writes its full output to a file** and returns at most ~15 lines to you: counts by category and severity, the file path, blockers, and anything needing your decision.
- **Per area, three agents in sequence**, so device work stays strictly one-at-a-time:
  1. **Audit agent (device)** walks the area and writes `untracked/artifacts/ux-audit/<area>/findings-raw.md` plus screenshots.
  2. **Verifier agent (no device)** reads the raw findings, opens every screenshot and dump, opens every `path:line` a proposed fix cites, and sorts each finding into: *confirmed*, *drop* (with the reason), or *recheck on device* (anything DEAD or High, and anything the screenshot doesn't clearly show; a missed `adb` tap can look like a broken control). It writes `recheck-list.md` with exact steps and the input method to use (`adb-input-source-taxonomy.md`).
  3. **Retest agent (device)** runs only the recheck list, using a second input method or the uiautomator dump, and records pass/fail with new screenshots.
  The verifier then (same agent, continued, or a fresh one given both files) writes the area's final `findings.md`: confirmed and retest-confirmed findings only, plus a short list of what was dropped and why.
- You may start the next area's audit agent as soon as the previous retest agent has finished with the phone. The verifier for area N can run while area N+1's audit agent uses the phone.
- **Cross-cutting comparison (§5)** is done by one non-device agent that reads every area's `findings.md` and the screenshots it needs, and writes `cross-cutting.md`.
- **The report (§8)** is assembled by one writer agent from the area `findings.md` files and `cross-cutting.md`. You read only its summary section before committing.

## 8. Outputs

- Per area: `untracked/artifacts/ux-audit/<area-letter>-<area-name>/` holds screenshots, dumps, `findings-raw.md`, `recheck-list.md`, the retest results and the final `findings.md` (gitignored; never delete anything there).
- Report: `.planning/ux-audit/UX-AUDIT-REPORT.md`, committed when done with the message `docs(ux-audit): hands-on UX audit report`. Structure:
  1. Summary: counts by area, category and severity; the 10 findings that most hurt the "one polished product" impression.
  2. Coverage: every in-scope route, reached or not, with the pass that covered it.
  3. Findings by area (format in §6).
  4. Cross-cutting mismatches (§5 comparison).
  5. Quick wins: every finding with a proposed fix, as one list.
  6. Needs investigation: every pinned finding, as one list.
  7. Known items seen again (only with new detail).
  8. What could not be checked, and why.
- Leave the phone as you found it: synthetic `Zz UX` data may stay (it is a test phone) but list what you created; restore any setting you changed; keep `adb reverse` in place and say so.

## 9. Pace

Work autonomously. Stop and message the owner only for a real blocker: the 6 Pro missing or unauthorized, the backup in §4.2 failing, a build that will not install without losing unbacked-up data, or anything that would need a real AI call or a real message to be sent. Otherwise run every pass to the end and deliver the report.
