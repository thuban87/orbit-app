---
phase: 1
cycle: 3
reviewers: [codex, claude]
reviewed_at: 2026-08-14
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md, 01-05-PLAN.md]
prior_cycle_commit: 85eb259
---

# Cross-AI Plan Review — Phase 1 (Cycle 3, re-review)

This is the third and final review cycle. Cycles 1–2 findings (5 HIGH + 12 MEDIUM/LOW) were
incorporated as surgical plan edits through commit `85eb259`. This cycle re-reads the five plans
against the actual source (`~/projects/Orbit/src`, `~/projects/quest-board-app`, the working tree)
to (a) confirm the cycle-2 edits held without regression, and (b) surface anything still unresolved.

**Both reviewers independently confirm:** every cycle-1 and cycle-2 core resolution is genuinely
present, no regression in the five named cycle-2 areas (resolveMode `SystemScheme` union, `AiProviderId`
rename, rsync bootstrap split, `check:colors` negative control, `@/theme` barrel + `HomeScreen` move),
and every spot-checked file:line citation in 01-02/01-04 is accurate. The Ollama/local-provider
omission is enforced in the type system, code, greps, and threat model — correctly NOT re-raised.

The new findings concentrate in **wave 1 (01-01)** — two of them are direct regressions introduced by
the cycle-2 edits themselves — plus the **FND-01 pipeline's external unknowns (01-05)**.

---

## Codex Review

## Summary

The plans are strong and largely close the prior review gaps. The remaining issues are a latent custom-provider orchestration bug inherited from the plugin and an unpinned cross-machine dependency install path.

## Strengths

- The fetch port correctly targets the four surviving cloud call sites in the predecessor at `~/projects/Orbit/src/services/AiService.ts:264,319,377,431`, while preserving response-shape validation.
- The `AiProviderId` naming avoids collision with the real provider interface at `~/projects/Orbit/src/services/AiService.ts:149`.
- The theme plan correctly makes `"unspecified"` resolve dark and adds the missing `@/theme` barrel and real `HomeScreen`.
- The release-APK proof is appropriate: the quest-board runbook confirms debug builds need Metro at `~/projects/quest-board-app/apps/mobile/ANDROID_BUILD_GUIDE.md:213-222`.

## Concerns

- **MEDIUM — Custom provider is unusable through `AiService.generate()`.** The predecessor registers `CustomProvider` with `aiCustomModel` (`~/projects/Orbit/src/services/AiService.ts:490-495`), and `CustomProvider.generate()` explicitly supports falling back to that model (`:431-439`). But the orchestrator always requires `settings.aiModel` and throws if it is empty before it delegates (`:518-527`). The settings UI deliberately does not show the global model selector for custom providers (`~/projects/Orbit/src/settings.ts:410-412`) and stores the custom model separately (`:396-405`; defaults at `:63-66`). Plan 01-04 ports this unchanged and tests providers directly, so it will miss the broken façade path.

- **MEDIUM — The "pinned stack / same lockfile" build claim is not enforceable.** The repo currently has no `package-lock.json`. Plan 01-01 runs mutable `create-expo-app@latest` and bare `npm install` commands (`.planning/phases/01-project-scaffold-portable-code/01-01-PLAN.md:123-137`) but neither lists nor verifies a committed lockfile. Plan 01-05 then runs `npm install` on `droid` (`01-05-PLAN.md:195-202`) while its threat model claims the same lockfile is used (`:263`). A fresh or missing lockfile can produce a different dependency graph on the build host.

## Suggestions

- Add an `AiService`-level mocked-fetch test for custom settings with `aiModel: ""` and a populated `aiCustomModel`; select the custom model before the empty-model guard (or make model selection provider-specific).
- Make `package-lock.json` an explicit Plan 01-01 artifact and acceptance check, commit it before rsync, and use `npm ci` on `droid`.

## Risk Assessment

**MEDIUM.** The scaffold, theme, and device-proof plans are well specified, but the custom AI façade would fail for its intended custom configuration, and the cross-machine build is not yet dependency-reproducible.

---

## Claude Review

## 1. Summary

I re-read the five plans against the actual source on disk: `~/projects/Orbit/src/{types.ts,utils/dates.ts,utils/logger.ts,schemas/*,services/AiService.ts}`, `~/projects/Orbit/test/unit/*`, `~/projects/quest-board-app/{biome.json,apps/mobile/*,packages/ui/src/*}`, and the orbit-app working tree. **The cycle-2 edits hold up under verification and I found no regression in any of the five named areas.** Specifically: RN's `ColorSchemeName` really is `'light' | 'dark' | 'unspecified'` with a non-nullable `useColorScheme()` (`quest-board-app/node_modules/react-native/Libraries/Utilities/Appearance.d.ts:12,51`), so the `SystemScheme` superset is correct and the `"unspecified"` test case is a real value, not a straw man; the `AiProviderId` rename is necessary and precisely scoped (`~/projects/Orbit/src/services/AiService.ts:149,469,499,507`); `noStaticOnlyClass` and `noThisInStatic` both exist and are `recommended` in the pinned Biome line, and `noThisInStatic` carries a **safe** fix — meaning `biome check --write` on `logger.ts` would silently rewrite `this.level`→`Logger.level` if the 01-01 override were not there, so that override is load-bearing and correct. Every file:line citation in 01-02 and 01-04 that I spot-checked is accurate (`types.ts:1` import, `types.ts:48-49` field, AiService call sites 264/319/377/431 and parses 278/334/386/443, Ollama block 168–228 and its registration at 483). The remaining findings are concentrated in wave 1 (two gate-breaking mechanical gaps introduced or exposed by the cycle-2 edits) and in the FND-01 pipeline's external unknowns.

## 2. Strengths

- **Source fidelity is high and independently verifiable.** The `.json` property→method trap, the four surviving parse sites after the Ollama omission (`== 4`, correctly recomputed from 6), and the `interface AiProvider` collision are all real and correctly located in the actual 540-line file.
- **The `AiProviderId` rename is the right fix, not a cosmetic one.** `AiService.ts` declares `interface AiProvider` at line 149 and consumes it at `Map<string, AiProvider>` (469), `getProvider(): AiProvider | undefined` (499), `getActiveProvider(): AiProvider | null` (507). Keeping the id union out of `AiService.ts` entirely (importing only `AiSettings`) is a cleaner resolution than aliasing at the import site.
- **The `'none'` member is correctly retained.** `AiService.ts:508` does `settings.aiProvider === 'none'`; omitting it would be a TS2367, and the plan calls that out by error code.
- **Behavioural proof where greps cannot reach.** 01-04 Task 3's `jsonSpy` + `not.toHaveBeenCalled()` is the only way to prove guard-*ordering*, and the plan says so explicitly. Likewise 01-01's positive+negative control on `check-colors.sh` genuinely exercises the script rather than a regex typed into an acceptance criterion.
- **The `toISOString` acceptance criterion is now satisfiable.** Stripping comment lines before grepping resolves the previous impossible-to-satisfy check while keeping the mandated explanatory comment (`~/projects/Orbit/src/utils/dates.ts:4,11-12`) intact.
- **The release-vs-debug APK reasoning for FND-01 is correct and correctly cited.** `quest-board-app/apps/mobile/ANDROID_BUILD_GUIDE.md:213-222` does document the red-screen failure by name, and line 222 states the release/standalone contrast. Line 179's "don't `adb install` from Linux over the tunnel" caveat is correctly scoped to the emulator path only — the Pixel is wired to *this* box, so pulling the APK back and installing locally is right.
- **The harness prerequisites CLAUDE.md asks for already exist** — `.claude/hooks/block-git-worktree.sh` and `.claude/hooks/block-graphify-build.sh` are present and executable — so the plans correctly do not re-create them.
- **`.claude/settings.local.json` confirms the 01-05 permissions note is accurate**: `rsync`/`scp`/`ssh` are allowed, `adb`/`emu-connect` are not. Instructing the executor to accept the prompt rather than edit the allow-list is the right call under "whose decision is it."

## 3. Concerns (unresolved in current plan text)

- **HIGH — 01-01 Task 1 never copies `app.json`, but 01-01 Task 2 requires it.** Task 1's action step 2 enumerates the files to move out of the temp scaffold: "`package.json`, `App.tsx`, `babel.config.js`, `metro.config.js` (if present), `index.ts`/`AppEntry`, `assets/`, `expo-env.d.ts`". `app.json` is not in that list, yet Task 2's design ("MERGES the template's `app.json`, preserving its icon/splash/adaptive-icon references — do NOT delete app.json") and its acceptance criterion `test -f app.json` both depend on it existing at the repo root. An executor following the enumeration literally lands a repo with no `app.json`; Task 2's acceptance then fails, and `assets/icon.png` / `adaptiveIcon` references are silently lost from the config that plan 01-05 prebuilds from. This is a direct internal contradiction created by the cycle-2 "merge app.json instead of deleting it" edit — the merge target was added to Task 2 but never added to Task 1's copy list.
  *Fix:* add `app.json` (and `package-lock.json`) to the Task 1 copy enumeration, and add `test -f app.json` to Task 1's acceptance criteria so the failure surfaces one task earlier.

- **MEDIUM — 01-01's green-baseline gate (`npx biome check .`) will fail on the scaffold's own files, and no task formats them.** Biome's default `javascript.formatter.quoteStyle` is `"double"` (the 01-01 `biome.json` sets only `indentStyle`/`indentWidth`, matching `quest-board-app/biome.json:32-36`, which likewise sets no `quoteStyle`). The Expo `blank-typescript` template is single-quoted — 01-03 Task 3's own action text confirms this, describing the template's `backgroundColor: '#fff'`. `biome check` (no `--write`) fails on formatter diffs, so `App.tsx` and `index.ts` will fail the gate in **both** 01-01 Task 2's verify block and Task 3's verify block / acceptance criteria. Plans 01-02, 01-03 and 01-04 each explicitly instruct `npx biome check --write` on the files they create; 01-01 is the only plan that establishes a repo-wide `biome check .` gate without ever formatting the files it inherits.
  *Fix:* add a step to 01-01 Task 3: `npx biome check --write .` on the scaffold-generated files (App.tsx, index.ts, expo-env.d.ts) before asserting the baseline, with a note that this is formatting-only.

- **MEDIUM — `vitest.config.ts` depends on `@types/node`, which is not in the install list.** 01-01 Task 3 mandates `fileURLToPath(new URL("./src", import.meta.url))`, i.e. `import { fileURLToPath } from "node:url"`. Task 1 installs `zustand`, `@biomejs/biome@2.5.8`, `vitest`, `tsx` — no `@types/node`. `expo/tsconfig.base` sets `lib: ["DOM", "ESNext"]` with no Node types, so `node:url` resolves only if `@types/node` happens to be hoisted. In quest-board it *is* present (`node_modules/@types/node@25.5.2`) but it appears in neither `package.json` devDependencies block — it is purely incidental hoisting, not a guarantee for a fresh Orbit tree. If absent, Task 3's `npx tsc --noEmit` fails with TS2307 on the config file the same task just wrote. (Note `path.resolve(__dirname, …)` is not an escape — it needs the same types.)
  *Fix:* add `@types/node` to Task 1's devDep install, or set `resolve.alias` to a plain relative `"./src"` string and drop the `node:url` import.

- **MEDIUM — the `tsx` dependency added in cycle 2 is outside the Package Legitimacy Audit the threat model claims covers everything.** 01-01's threat register T-1-SC names the audited set as "expo, expo-sqlite, zustand, biome, async-storage, safe-area-context" and concludes "No `[SLOP]`/`[SUS]`-with-real-signal packages — no human legitimacy checkpoint required." `01-RESEARCH.md:128` confirms the audit ran over exactly six packages. Task 1 now installs **`tsx` and `vitest`** as well, neither of which is in that set — `tsx` in particular is a transpiler hook that executes at config-load time on *both* this box and the `droid` build host. Under `security_enforcement: true` this is a stated-coverage-vs-actual-install mismatch, not a judgement about `tsx` itself (which is mainstream; quest-board pins `tsx@^4.21.0`).
  *Fix:* either extend T-1-SC's package list and re-run the legitimacy check for `tsx` + `vitest`, or narrow the threat-model claim to the audited six and note the two build-time additions explicitly.

- **MEDIUM — 01-05 supplies only the Windows-native path form for rsync, with no alternative and no fallback if rsync is absent.** Task 2 step 2a is meant to "PROVE the remote rsync receiver + the Windows-path FORM", but every command template in the plan uses `droid:<confirmed path>/` where the confirmed path is a backslash Windows path (`C:\Users\...`). Windows OpenSSH ships no rsync; the common installs (cwRsync, MSYS2) are Cygwin/MSYS-based and require `/cygdrive/c/Users/...` or `/c/Users/...` — `C:\...` will fail or be misparsed against `host:path` splitting. The plan gives the executor no second form to try, so a path-form failure is indistinguishable from "no receiver." Separately, `ssh droid 'rsync --version'` failing has no defined next step: PROJECT.md permits `scp` as transport, but no plan step defines the scp/tar-over-ssh fallback, so FND-01 stalls with the owner already at the checkpoint.
  *Fix:* have the dry-run try both forms (`C:\Users\...` and `/cygdrive/c/Users/...`) and record the winner in the runbook; add a one-line documented fallback (`tar czf - --exclude … | ssh droid 'tar xzf -'` or `scp -r`) for the no-rsync case.

- **LOW — 01-02's verification block contains a non-runnable check.** `grep -ic obsidian src/types.ts src/utils/dates.ts src/utils/logger.ts src/schemas/*.ts` == 0 — with multiple file arguments `grep -c` prints one `path:count` line per file, so there is no single number to compare against 0. (The per-task acceptance criteria use the correct single-file form; only the plan-level `<verification>` block is malformed.)
  *Fix:* `! grep -ril obsidian src/types.ts src/utils src/schemas` or pipe through `grep -c ':[1-9]'`.

- **LOW — the `home-shell-root` testID may not appear in a `uiautomator dump`.** 01-03 puts the testID on the root `View` of `HomeScreen`, and 01-05's must_haves lean on it ("verifiable via uiautomator dump"). `uiautomator dump` serialises the *accessibility* tree, which prunes views not marked important for accessibility; a plain non-accessible RN `View` container is not guaranteed to emit a node with that `resource-id`. 01-05's acceptance criterion already hedges (`home-shell-root` **or** the "Orbit" title), so this is not a blocker — but the artifact/must_haves language reads as if the testID assertion is the primary evidence.
  *Fix:* make the "Orbit" title text the primary assertion and the testID the secondary, or set `accessible` / `accessibilityLabel` on the root view in 01-03 so the node is guaranteed to survive pruning.

- **LOW — `AiService`'s prompt debug-log ports as-is and is not covered by the `<legacy_compat>` note.** `~/projects/Orbit/src/services/AiService.ts:139` does `Logger.debug('AiService', \`Assembled prompt:\n${result}\`)` — that is the full assembled prompt, i.e. contact-derived content, written to `console.log`. Threat T-1-02 correctly says "do NOT log settings objects or request bodies that carry a key" (keys are safe here), and the default level is `off`, so nothing leaks this phase. But 01-04's `<legacy_compat>` block flags `assemblePrompt`/`DEFAULT_PROMPT_TEMPLATE` for Phase-14 replacement without mentioning that this log line is the concrete place `off_limits`/`share_with_ai`-gated content would surface if debug logging is ever enabled.
  *Fix:* one sentence in `<legacy_compat>` naming line 139 as a Phase-14 (AI-04 redaction) target.

- **LOW — `expo prebuild --clean` over SSH is assumed non-interactive.** 01-05 Task 2 step 4 runs `npx expo prebuild --platform android --clean --no-install` over a non-TTY SSH session. On the first run there is no `android/` so it is a no-op, as the plan says; on every later run (the runbook's documented `--clean` rule) Expo CLI's "this will delete `android/`" confirmation is TTY-dependent. Worth one line in the runbook rather than a plan change.

## 4. Suggestions

1. **Move `app.json` into 01-01 Task 1's copy list and assert it there** (fixes HIGH), and add `package-lock.json` while you are in that enumeration so the droid `npm install` resolves the same tree this box did.
2. **Add `npx biome check --write .` as the first action of 01-01 Task 3**, with an explicit note that it is formatting-only on scaffold-generated files — this makes 01-01 consistent with 01-02/01-03/01-04, all of which format before gating.
3. **Add `@types/node` to 01-01's devDep install** and add `grep -c '@types/node' package.json >= 1` to Task 1's acceptance, so the `node:url` dependency in Task 3's own config file is explicit rather than incidental.
4. **Extend T-1-SC's package list to include `tsx` and `vitest`** (or re-scope the "no checkpoint required" claim). The audit itself is fine; the mismatch between what it covered and what Task 1 installs is the defect.
5. **In 01-05 Task 2 step 2a, run the dry-run against both path forms** and have the runbook record the one that worked, plus a named fallback transport if `rsync --version` fails on droid.
6. **Note the `bwles` vs `bwales` discrepancy explicitly at the checkpoint.** PROJECT.md and 01-RESEARCH.md both assume `C:\Users\bwles\projects\orbit-app` (Assumption A1), but quest-board's working build guide uses `C:\Users\bwales\projects\quest-board-app` (`ANDROID_BUILD_GUIDE.md:186`). The plan already asks the owner to confirm the exact string, but it should say *why* it is likely a typo so the owner does not just rubber-stamp the value the plan printed.
7. **Consider surfacing the safe-fix hazard in 01-02's action text.** `noThisInStatic` has a *safe* autofix (verified via `biome explain`), so absent the 01-01 override, `biome check --write src/utils/logger.ts` would rewrite the ported `Logger` without any warning. 01-02 correctly says "do NOT let autofix do these" — adding "because `noThisInStatic` is a *safe* fix and `--write` will apply it silently" makes the reason legible to an executor who is tempted to skip the override.
8. **Make the "Orbit" title the primary on-device assertion in 01-05**, with the testID as corroboration.

## 5. Risk Assessment

**MEDIUM (leaning low).**

The code risk in this phase is genuinely small and the plans have driven it down further: the ports are mechanical, every claimed file:line I checked is accurate, the one silent-failure trap (`.json` property→method) is guarded both structurally and behaviourally, and the owner's Ollama omission is enforced in the type system and by a `! grep -q 'http://'` gate rather than by a comment. Wave 2–4 is in good shape.

The residual risk sits in two places. **Wave 1 has two gate-breaking mechanical gaps** (missing `app.json` in the copy list; unformatted scaffold files versus a repo-wide `biome check .`) plus one likely-but-not-certain one (`@types/node`). None is dangerous — each fails loudly and is a one-line fix — but all three land in the plan that every other plan depends on, so they cost a full execute–fail–fix cycle at the worst point in the wave graph. **FND-01 remains the real risk**, as the research already concluded: the `droid` bring-up is owner-gated, unverified this session, and the plan's rsync-to-Windows path form is more likely to be wrong than right on first attempt. That risk is correctly *contained* by the blocking checkpoint (which is the right call — package id, SSH host key, and the USB-debug tap are all owner-bucket), but containment is not the same as reduction, and the plan gives the executor only one path form and no transport fallback to try before coming back to the owner a second time.

Nothing in this phase reverses a `[DECIDED]`/`[REJECTED]` item, widens egress, or touches a data-layer invariant. No escalation to the owner is warranted by any finding above.

---

## Consensus Summary

Both reviewers re-opened the cited source and verified line refs against the actual code. **Both agree
every cycle-1 and cycle-2 resolution is genuinely present and no regression appears in the five named
cycle-2 areas** (resolveMode `SystemScheme` union, `AiProviderId` rename, rsync bootstrap split,
`check:colors` negative control, `@/theme` barrel + `HomeScreen` move). The Ollama omission is correctly
NOT re-raised. Verified independently this cycle against `~/projects/Orbit/src`:
`interface AiProvider` at `AiService.ts:149`; the four surviving cloud call sites (264/319/377/431) and
parses (278/334/386/443); the Ollama block (168–228) + registration (483); `types.ts:1` Obsidian import
and `:48-49` `file: TFile` field; `dates.ts` `toISOString` present only in comments (lines 4, 12);
quest-board `biome.json` sets no `quoteStyle` (formatter block indent-only).

The new findings are wave-1 mechanical gaps (two of them regressions from the cycle-2 edits) and the
FND-01 pipeline's external unknowns. **No finding reverses a `[DECIDED]`/`[REJECTED]` decision, widens
egress, or touches a data-layer invariant — no owner escalation is warranted.**

### Agreed strengths (2+ reviewers)

- Source fidelity is high: the `.json` property→method trap, the recomputed `== 4` parse count, and the
  `interface AiProvider` collision are all real and correctly located; the `AiProviderId` rename is the
  right, minimally-scoped fix.
- The FND-01 release-vs-debug APK reasoning is correct and correctly cited
  (`ANDROID_BUILD_GUIDE.md:213-222`).
- The `"unspecified"` → dark resolver case, the `@/theme` barrel, and the real `HomeScreen` are the
  correct cycle-2 fixes and are present.

### Agreed / notable concerns

- **[MEDIUM] `package-lock.json` reproducibility gap** *(Codex; overlaps Claude's suggestion #1)*.
  No plan commits a lockfile as an artifact, yet 01-05's threat model (`01-05-PLAN.md:263`) claims the
  droid build "resolves the same lockfile." 01-01 runs `create-expo-app@latest` + bare `npm install`;
  01-05 runs `npm install` (not `npm ci`) on droid. Make `package-lock.json` an explicit 01-01 artifact
  + acceptance, commit it before rsync, and use `npm ci` on droid.
- **[MEDIUM] 01-05 rsync path-form + no-rsync fallback** *(Claude; Codex raised the receiver facet in
  cycle 2, now closed)*. The dry-run uses only the Windows-native `C:\...` form, which Cygwin/MSYS rsync
  misparses; and no scp/tar fallback is defined if rsync is absent on droid.

### Divergent views

- **Severity of the 01-01 `app.json` gap.** Claude rated it **HIGH** (it lands in the foundational
  wave-1 plan every other plan depends on); Codex did not flag it. **Adjudicated MEDIUM** (see below):
  it is a real internal contradiction, but it is caught by Task 2's *own* `test -f app.json` acceptance
  criterion, fails loudly one task late, is a one-line fix, and reverses no decision — the same profile
  cycle 2 adjudicated Codex's HIGHs down to MEDIUM for. Listed first among actionable items so the owner
  sees the dissent.
- **01-04 custom-provider façade bug** *(Codex, MEDIUM)*. Verified real: `generate()` throws on empty
  `settings.aiModel` (`AiService.ts:518-527`) *before* delegating, so `CustomProvider`'s
  `model || this.modelName` fallback (`:439`) is unreachable via the façade. But 01-04's stated scope is
  a *faithful port that compiles, does not run* (dormant, wired to no UI), so reproducing pre-existing
  plugin behaviour is correct-by-contract for FND-04; fixing it is a Phase-14 (wire-up) concern. Treated
  as a LOW `<legacy_compat>`-note item, not a Phase-1 defect.

### Adjudication — HIGH count

**0 unresolved HIGH.** Claude's single HIGH (01-01 `app.json` not in the Task 1 copy list) is a genuine
regression from the cycle-2 "merge app.json" edit and must be fixed, but it is caught by the plan's own
in-plan acceptance criterion (`test -f app.json`), fails loudly, is a one-line fix, and reverses no
recorded decision. Consistent with the cycle-2 adjudication framework (gate-caught mechanical gaps that
fail loudly are MEDIUM, not redesign-forcing HIGHs), it is counted as the top actionable MEDIUM rather
than a blocking HIGH. No consensus HIGH remains; Codex found none.

### Verdict

**No blocking HIGH remains; the phase is convergent.** The residual work is ~6 MEDIUM + ~4 LOW plan-text
refinements, concentrated in 01-01 (wave 1) and 01-05 (FND-01 pipeline). None requires redesign; all are
one-to-three-line edits. The two cycle-2-introduced regressions (`app.json` copy-list omission; `tsx`
outside the legitimacy-audit set) and the two uncaught reproducibility/transport gaps (lockfile;
rsync path-form + fallback) are the four most worth applying before execution, because they either fail
at the worst point in the wave graph (wave 1) or leave the owner stalled at the FND-01 checkpoint.
Overall risk: **LOW-MEDIUM**.
