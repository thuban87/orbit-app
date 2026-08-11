# orbit-app — Agent Orientation

Personal relationship manager (social CRM) mobile app. React Native / Expo, Android first. Local-first — on-device SQLite, no backend. Solo developer. New project.

**Read `HANDOFF.md` at the repo root before doing anything.** It records every architectural and product decision made before this repo existed, tagged `[DECIDED]` / `[OPEN]` / `[REJECTED]`. A `[DECIDED]` item is not yours to revisit. A `[REJECTED]` item was considered on the merits and turned down — do not re-propose it as if it were new.

---

## Answering the owner (non-negotiable)

- When the owner asks a question, answer that question — promptly and succinctly. Make no assumptions and take no unrequested actions (edits, commands, config changes) until they say so.
- A question is not authorization to act; explaining your reasoning is not a substitute for their approval.
- Suggestions or next steps within an answer are fine when genuinely useful — the limit is on taking action, not on being helpful.

## Whose decision is it (non-negotiable)

Decisions split into two buckets. Make the ones in your bucket and report them as done — do not drip-feed them back as questions. Stop and ask on the ones in the owner's.

**The owner's bucket is NOT "the non-technical decisions."** It is: taste, product, visual, priorities, **risk and security posture, and anything that reverses a decision already recorded in an ADR or in `HANDOFF.md`** — however technical the trigger. Do not reason "this is an engineering call, so it's mine." Technical does not imply yours.

**Your bucket:** which plan owns a task, whether a nit is worth fixing, doc syncs, plan ordering and splits, and implementation details explicitly delegated to you.

**Enforcing a recorded decision is a planner call. Reversing one is the owner's.** If a change deletes, weakens, or inverts behavior an existing ADR or `HANDOFF.md` entry decided — *especially* something explicitly considered and rejected — it is **not** a bug fix, no matter how technical the trigger. Stop and ask, and name which decision and which half of it dies. "It's just a bug fix" is not a licence to reverse a recorded decision; classifying the work does not decide the authority.

**Corollary:** a reviewer flagging the removal of a control *by name* is an escalation trigger, not a finding to close.

*Why this exists:* on the owner's other project, two plans deleted an ADR's anti-tamper price floor to close a quote-vs-charge bug. A floor-preserving fix existed and had been proposed by the phase's own code review. A cross-AI reviewer flagged the removal by name. It shipped anyway, unasked, because the work was labeled "a bug fix" — and the ADR had that exact removal sitting in its rejected-alternatives list.

## Git worktrees are disabled (non-negotiable)

`.planning/config.json` sets `workflow.use_worktrees: false`. Never run `git worktree` in this repo — not to isolate a fix, not to parallelize, not "just to be safe." Commit in place, on the current branch, where the owner can watch it happen.

This applies to **every** agent, including subagents you spawn. Workflow tooling does not necessarily read this preference, so an executor or fixer agent will happily create a branch + worktree and fast-forward it back unless you stop it. Orchestrators: state this constraint in the prompt of any agent you spawn that may write code, and never pass `isolation: "worktree"` to the Agent tool.

Set up a `PreToolUse` hook (`.claude/hooks/block-git-worktree.sh`) to block `git worktree` at the harness layer, mirroring quest-board. If you hit it, that is the rule working — do not route around it. If you think isolation is genuinely required, stop and ask the owner.

**Do not report a subagent's summary to the owner as fact.** Verify its claims against `git log` / `git show` and the working tree first — subagents have asserted file states and commit contents that turned out to be wrong.

## Review the code, not the diff (non-negotiable)

When reviewing, auditing, or planning changes, never scope your reading to a diff, a changed-files list, or another agent's summary. Read the **actual code on disk**: the full file being changed, plus every file in the same subsystem that shares its data — stores, services, components, and the SQLite migrations and queries that own the same tables.

Concretely:

- If a change touches a shared table (e.g. `contacts`, `interactions`), read **every writer** of that table before declaring an invariant about it, not just the writer in the diff.
- Verify claimed file:line references and claimed behavior by opening the file. Planning artifacts have contained confident, false statements about what code does.
- Orchestrators: write this instruction into the prompt of every reviewer, planner, checker, or auditor agent you spawn. Default review workflows are diff-scoped and will not do this on their own.

The extra reading costs real tokens. Accept the cost. On the owner's other project, eight diff-scoped reviews missed data-corrupting bugs that one subsystem-level audit found in minutes; each miss cost a full plan–execute–review cycle.

---

## Data layer rules (project-specific, non-negotiable)

### Local-first is a product commitment, not an implementation detail

Contact data never leaves the device. There is no backend, no telemetry, no analytics, no crash reporting that carries user content. Do not introduce a network dependency into any read path.

The single exception is the optional AI suggestion feature, which sends data to a provider **the user explicitly configured**, and only when they explicitly invoke it. Any change that widens what that feature transmits is an owner decision.

If a task seems to require a server, stop and ask. It almost certainly does not, and adding one silently would invalidate the app's core promise.

### SQLite migrations

- Schema changes ship **as application code**, via the `PRAGMA user_version` pattern. On launch: read `user_version`, compare to expected, run migrations in sequence, write the new value.
- **Migrations are forward-only and must run in strict order.** Any user may jump from v1 to v6 in one update. Never write a migration that assumes a particular starting state.
- Never edit an already-shipped migration. Add a new one.
- There is **no remote access to a user's database**. You cannot inspect it, repair it, or hotfix it. Anything a migration gets wrong is permanent for that user. Treat every migration as irreversible in production.
- There is no RPC equivalent. Logic that would live in a Postgres function lives in TypeScript.

### Offline

The dashboard must render with no network. Never put a blocking network call on a read path.

---

### Custom fields — invariants (non-negotiable)

Full design in `HANDOFF.md` §14. These are the rules an agent is most likely to break on instinct:

- **Two tables, and the same field is a row in one and a column in the other.** `custom_field_defs` holds one *row* per field (label, type, options, flags). `contact_custom_values` holds one *column* per field and one *row* per contact. Say "custom field," not "custom column" — the ambiguity has already caused confusion.
- **Every column in `contact_custom_values` is declared TEXT, forever.** This is deliberate, not an oversight. SQLite has no `ALTER COLUMN TYPE`, and TEXT storage makes a field type change a one-row `UPDATE` on the defs table instead of a four-step column rebuild. Never "fix" this by declaring a column INTEGER, REAL, or BOOLEAN.
- **Field type lives in `custom_field_defs.type` and drives the UI widget only.** Storage type and field type are different concepts. Changing a field's type must not touch `contact_custom_values` at all.
- **Route every sort or filter on a custom field through the single `sortExpr()` helper.** TEXT storage means numbers sort lexicographically (`"10"` before `"9"`). That helper is the *only* place the TEXT decision may be observable. Never interpolate a custom column name into an ORDER BY or comparison directly.
- **Never add an index or a UNIQUE constraint to a column in `contact_custom_values`.** `DROP COLUMN` fails on indexed, unique, view-referenced, or generated columns, and dropping is required by quarantine expiry. If an index ever becomes necessary, drop it before dropping the column.
- **Type changes never destroy data.** Values that fail the target type's parser are flagged and rendered as an error state on the profile, not coerced or cleared. There are 7 parsers, one per target type — never write pairwise converters.
- **Every destructive operation snapshots to `field_history` inside the same transaction.** Type conversions and column drops both qualify. This is the only recovery mechanism that exists; there is no server and no backup.
- **Deleting a defs row does not drop a column.** `ON DELETE CASCADE` deletes rows, never columns. Both statements must appear explicitly in one transaction.
- **Nothing watches a timestamp.** SQLite has no scheduler, and triggers fire only on data events. Quarantine expiry and history retention run as a sweep at app launch. Do not implement either with a background timer.

## Repo layout

| Path | Purpose |
|------|---------|
| `src/` | Application source |
| `src/db/` | SQLite schema, migrations, DAOs, dynamic query builder for custom fields |
| `src/services/` | Business logic — AI provider layer, status calculation, digest |
| `src/components/` | UI primitives |
| `src/screens/` | Screen-level components |
| `src/theme/` | Theme tokens — every colour resolves through here |
| `docs/` | Audience-facing knowledge base (read this when working) |
| `docs/decisions/` | ADRs, numbered globally, immutable |
| `docs/systems/` | Per-subsystem documentation |
| `docs/runbooks/` | Step-by-step procedures — follow them, do not improvise |
| `.planning/` | GSD workflow workspace (in-flight phase artifacts, research, brainstorming) |
| `.planning/graphs/` | Graphify discovery index |
| `HANDOFF.md` | Pre-repo decision record. Authoritative. |

## The legacy Obsidian plugin — `~/projects/Orbit`

The predecessor lives at **`~/projects/Orbit`** on this box: the Obsidian plugin version of this app (public repo `thuban87/Orbit`, v0.9.0, MIT, same author). It is a full, current clone of `main` — the owner's primary development copy was on his Windows machine, pushed to GitHub and cloned here specifically so agents can read it. Treat it as up to date.

It is **not** a dependency and is **not** vendored into this repo. It is reference material, and you have full read access to all of it — source, tests, docs, git history.

```
~/projects/Orbit/
  src/           34 files, ~6,100 lines TypeScript/TSX
  docs/          8 user-facing guides + assets/screenshots
  test/          vitest suites
```

**Access it directly at that path.** If your session is scoped to this repo and the path is unreadable, ask the owner to `/add-dir ~/projects/Orbit` — do not work around it by copying files in. **Never clone it into this repo**, gitignored or otherwise: ripgrep respects `.gitignore`, so a gitignored copy is invisible to Glob and Grep while still drifting from upstream.

**Read `HANDOFF.md` §4 before porting anything.** That section records, file by file and verified against the actual source, what was already extracted into `src/`, what gets rewritten, and what was deliberately abandoned (Obsidian API coupling, React DOM primitives, vault-specific plumbing). Most of what looks reusable at a glance is not. Re-porting something listed there as deleted is a decision reversal, not initiative.

Useful reference targets in that repo:

| Question | Where |
|---|---|
| What did feature X do, from the user's side? | `docs/*.md` — Getting Started, Orbit Hub, Adding People, Custom Schemas, Updating and Editing, Weekly Digest, AI Features, Sidebar View |
| How did the AI provider layer work? | `src/services/AiService.ts` (already ported) |
| What did the Hub / form modals do? | `src/modals/`, `src/components/FormRenderer.tsx` |
| Why is a value what it is? | `git -C ~/projects/Orbit log` |

---

## Conventions

- TypeScript everywhere. Biome for lint/format.
- State management: Zustand stores in `src/stores/`.
- Data layer: on-device SQLite via `expo-sqlite`. Queries go through DAOs in `src/db/`, never inline in components.
- **All colours resolve through theme tokens.** No hardcoded colour values anywhere, including in Skia draw calls. Changing the active theme profile must restyle the entire app.
- Animation uses `react-native-skia` with its own render loop. **Never drive animation from React state** — `setState` per frame re-renders the tree on the JS thread and will crawl. Reanimated for gestures.
- All animation pauses on `useIsFocused === false` and on `AppState` background.
- Tunable constants (decay thresholds, orbit geometry, notification timing) sit at the top of their service file so tuning is a single-number edit.
- Use `formatLocalDate()` from `src/utils/dates.ts`, never `toISOString().split('T')[0]` — the latter produces a UTC off-by-one in evening hours. This bug has already been fixed once in the plugin; do not reintroduce it.
- The app is portrait-locked at the config layer.

## Knowledge base

- **Why something works the way it does** → search `docs/decisions/`. ADRs are numbered globally (`ADR-001-…`) and immutable. If a decision changed, a newer ADR supersedes the old one and both are kept.
- **How a subsystem works** → `docs/systems/`.
- **Decisions predating this repo** → `HANDOFF.md`.
- ADRs are immutable. System docs are living — append to their Changelog when you update them.

## GSD workspace

`.planning/` holds the in-flight planning workspace, one directory per phase. When a phase completes, its decisions get extracted into the knowledge base above; the phase artifacts themselves stay in `.planning/phases/` as the historical record.

- **Templates** live in `.planning/knowledgebase/templates/` — read the matching template before generating any KB doc.
- **Phase KB manifests** live alongside their phase artifacts at `.planning/phases/{phase-id}/{phase-id}-KB-MANIFEST.md`.
- Quest-board uses a `qb-extract-phase-kb` skill for the extraction step. **That skill is project-specific and does not exist here** — an equivalent needs creating for this repo before the first phase completes. Until it does, extraction is manual and must still happen; do not let phase decisions rot in `.planning/`.

## Graphify and feature intelligence

Graphify is a **discovery index** (enable in `.planning/config.json`). It is the fastest way to find *what is related to what* — and the only way to see, without reading every file, that a decision has been retired. It is **not** a source of truth: verify what it points you at against the actual files, per "Review the code, not the diff."

Use it as the **entry point**, not the fallback. Read the graph, then read the code.

### Ask the graph FIRST

If your question is one of these, run the command before you grep. It answers in one shot what grep takes minutes to approximate — and grep silently misses supersessions.

| Question | Command |
|----------|---------|
| Which decisions govern this file? | `npm run graph:ask -- governs src/stores/contact-store.ts` |
| What breaks if I change ADR-N? | `npm run graph:ask -- impact 12` |
| Is this decision still live? | either of the above — a retired ADR is flagged **⚠ SUPERSEDED BY …** automatically |
| What is related to this module? | `$gsd-graphify query <term>` (broad, lexical, noisy — exploration, not precision) |

**Use `graph:ask`, not a raw `graphify query`, for the first two.** `graphify query` is a lexical substring match and buries the ADRs you wanted under every incidental match in the test suite. `graph:ask` returns exactly the governing decisions, labelled, with supersessions flagged. Measured on quest-board: an agent left to grep took three minutes to list the ADRs governing one store and missed that one had been retired; the graph took thirty seconds and flagged it.

**Trust the confidence labels — they are load-bearing.** `cites` edges (`EXTRACTED`) come from a real `ADR-NNN` token in a code comment. `governed_by` edges (`INFERRED`) are derived from an ADR's Key-files list — a document's claim, not the code's. Say which you are relying on. Never present an `INFERRED` edge as a fact the code asserts.

### Build discipline (non-negotiable)

- **Build with `npm run graph:build` — never `$gsd-graphify build`, and never `graphify` directly.** This is not a style preference: the stock build **silently corrupts** the graph, and the corrupted graph looks completely normal. Block both at the harness layer with `.claude/hooks/block-graphify-build.sh`, mirroring quest-board. Keep `auto_update` off; builds are explicit.
- Query and inspect freely: `$gsd-graphify query <term>`, `status`, `diff`. Only `build` is blocked.
- `.graphifyignore` defines the maintained engineering corpus. Exclude historical phases, archived reference code, generated output, and agent infrastructure so they do not overwhelm community detection. Exclude ADR *bodies* too — their decisions reach the graph via the registry below.
- `.planning/graphs/` holds `graph.json` and `GRAPH_REPORT.md` **committed**, plus `graph.html` and `.last-build-snapshot.json` which are **generated-but-ignored**. Both are rewritten wholesale every build, so git cannot delta them — on quest-board they were adding ~19 MB of new blobs per KB-extraction commit. Set the `.gitignore` up this way from the first build. On a fresh clone, run `npm run graph:build` once before using the visualization or `graphify diff`.
- Never edit generated files directly; rebuild.

### The ADR bridge — how decisions reach the graph

Two pieces make it work, and both are load-bearing. **Neither exists in this repo yet** — port both from `~/projects/quest-board-app` before the first graph build, or ADR nodes will be missing or wrong:

- **`docs/decisions/adr-registry.ts`** — a *generated* file (`npm run gen:adr-registry`), sourced from the ADR bodies, never from a derived INDEX. It exists solely to be read by graphify, which mints ADR nodes **only from `ADR-NNN` tokens in JS/TS comments**. Markdown and JSON are invisible to that scan — an INDEX.md alone produces no ADR nodes at all. Regenerate whenever an ADR is added or superseded, or the graph will confidently report a retired ADR as current.
- **`scripts/normalize-graph-docrefs.ts`** — repairs a graphify bug that scatters an ADR cited by N files into N disconnected nodes instead of one shared node, destroying every code→ADR edge. `graph:build` must normalize the copy in `.planning/graphs/` *after* copying, never graphify's own incremental baseline, which would silently re-scatter on the next build.

**A file is only connected to an ADR if the file cites `ADR-NNN` in a comment.** So a *missing* code→ADR edge means "nobody wrote the citation," never "no decision governs this file." Do not read absence as evidence.

### What the graph cannot see

A clean, confident-looking cluster does not mean the graph has the whole picture.

- **No TypeScript→SQL edges.** SQLite queries are string literals, which AST extraction cannot follow. **The graph therefore cannot enumerate the writers of a table.** "Read every writer of `contacts.last_contact`" is a manual grep — the graph will not do it for you and will not tell you it didn't. This is the single most important gap for this repo, since the data layer is where correctness bugs will live.
- **No code↔system-doc edges.** The ADR bridge is the only code↔docs link. `docs/systems/*.md` and `docs/runbooks/*.md` connect to nothing in code.
- **Communities are heuristic and renumber on every corpus change.** A community ID is not a durable reference — never cite one in a doc or a plan. Verify any cluster against the subsystem boundaries before trusting it.

---

## Android device — you can drive the app yourself

> **Adapt before first use.** This section is carried over from the owner's quest-board project and describes the same physical hardware and the same Linux box. The tooling is shared. What must change: the **app package name** (below is quest-board's), and the **tmux session name** in any Metro-pane command. Confirm both with the owner rather than guessing.

You can drive the real app from this Linux box. There are **two targets**, and `emu-connect` picks one for you:

| Target | What it is | When it is used |
|--------|-----------|-----------------|
| **`device`** | The owner's **physical Pixel 6 Pro** over USB | **Default**, whenever it is plugged in |
| **`remote`** | The emulator on the owner's Windows desktop (SSH host `droid` / `living-room`, over Tailscale) | **Automatic fallback** when the phone is absent |

The phone is the owner's work phone and is not always connected. Never assume a target; `emu-connect` probes and falls back on its own.

```bash
emu-connect          # ~/.local/bin/emu-connect — auto: phone if present, else desktop
emu-connect status   # which target is live, is the phone attached, is Metro up
adb devices -l       # ALWAYS read the serial from here; never hardcode one
```

Force a target: `emu-connect device` (aliases `usb`, `phone`) · `emu-connect remote` (`desktop`, `droid`) · `emu-connect down`. `QB_NO_USB=1 emu-connect` forces the desktop even with the phone plugged in.

**The two topologies are mutually exclusive — all targets want TCP 5037.** In `device` mode a *local* adb server owns the port and sees USB. In `remote` mode an SSH `-L 5037` tunnel points at the desktop's adb server, plus an `-R 8081` tunnel so the desktop can reach Metro here. `emu-connect` tears one down before bringing the other up. Either way **Metro runs on this box**, `adb reverse tcp:8081 tcp:8081` is set, and the app fast-refreshes on edit.

**The serial is NOT always `emulator-5554`.** On the phone it is a hardware serial; on the desktop emulator it is `emulator-5554`. Resolve it from `adb devices`. Mode exclusivity guarantees one *topology*, **not** one *device* — check cardinality yourself: `adb devices | awk '$2=="device"' | wc -l` must print `1`.

| Action | Command |
|--------|---------|
| Screenshot | `adb exec-out screencap -p > shot.png` |
| Read the UI tree (text, a11y labels, tap bounds) | `adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml` |
| Tap / swipe / type / back | `adb shell input tap X Y` · `input swipe` · `input text "…"` · `input keyevent 4` |
| Read app data without root | `adb exec-out "run-as <package> cat /data/data/…"` (works because the APK is debuggable) |

Prefer `uiautomator dump` over eyeballing pixel coordinates — exact bounds and accessibility labels, and it survives the resolution difference between targets, which hardcoded taps do not.

**Reading the app's `console.log` — check both channels with a *delta*, never a presence test.** On quest-board this routing flipped at least once between `adb logcat -s ReactNativeJS` and the Metro tmux pane. The trap: a Metro pane can contain stale `LOG` lines from an earlier session, so anything electing a channel by grepping for `LOG` picks the wrong one. Capture the pane, fire a probe, diff. Use whichever channel actually moved. Metro is still correct for bundler/fast-refresh output.

**Non-negotiable — never `apt install adb`.** The Debian package is 34.0.4; the SDK's is 37.0.0. An adb client meeting a different-version server **kills that server** — in `remote` mode that server belongs to the owner's Windows desktop and killing it breaks his tooling. Always use `~/.local/bin/adb` (symlinked to `~/Android/Sdk/platform-tools/adb`). The apt package has been deliberately removed.

**Gotchas:**

- **Re-run `emu-connect` whenever anything looks disconnected.** Tunnels do not survive a reboot of either machine; `adb reverse` does not survive an emulator restart, a device reboot, or **replugging the USB cable**.
- The adb transport is a single shared OS-level resource — every shell and every Claude session on this box uses the same one.
- **A phone that is plugged in but shows `unauthorized`** needs the on-device "Allow USB debugging" prompt accepted. Only the owner can do that — ask him.
- **Performance: the target decides whether a claim is possible at all.** On the *desktop emulator*, frame timing reflects the emulator's rendering path and the desktop's GPU, not the app — never make a perf claim from it. On the *physical phone* a perf claim is legitimate. Either way `dumpsys gfxinfo` sees only the UI/render thread while React Native jank usually lives on the JS thread, so say which thread your evidence covers. **This matters more here than on quest-board** — the orrery is a Skia render-loop feature and its performance characteristics cannot be assessed on the emulator at all.
- Verification is UI-observable only. Seeing a screen render is not proof the underlying data or invariants are correct — "Review the code, not the diff" still applies.
- **There is no local emulator on this box, by hardware.** The CPU is an i7-3770K (Ivy Bridge, 2012) = x86-64-v2, lacking instructions a modern Android x86_64 system image requires; the guest kernel panics ~8s in and reboot-loops. The emulator *package* is installed, so `emu-connect local` becomes viable after a CPU upgrade. Do not re-diagnose this.

### Widget development note

Home screen widgets require `react-native-android-widget` and a **custom dev client** — they do not work in Expo Go. Android widgets are native `RemoteViews`; React Native cannot render them directly. **Text input inside a widget is impossible** — `RemoteViews` has no editable field. Do not plan features that require typing into the widget.
