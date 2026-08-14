---
phase: 1
cycle: 2
reviewers: [codex, claude]
reviewed_at: 2026-08-14T15:31:54Z
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md, 01-05-PLAN.md]
prior_review: git commit e30f6e3 (cycle 1, this same path, superseded)
revision_commit: 8eef807
current_high: 0
current_actionable: 13
---

# Cross-AI Plan Review — Phase 1 (CYCLE 2 · re-review of revised plans)

This is the second review round. Cycle 1 (preserved in git commit `e30f6e3`) raised 5 HIGH + assorted
MEDIUM/LOW findings; those were incorporated into the 5 plans in commit `8eef807`. This
round re-reviews the **current revised plans** and reports only concerns that REMAIN.
Both reviewers independently confirmed all five cycle-1 HIGH resolutions are present and
introduced no regression. No remaining concern is consensus-HIGH.

---

## Codex Review

# Cycle 2 review

## 01-01 — Scaffold

**Summary:** The revised scaffold plan is executable and resolves the prior configuration/tooling issues.

**Strengths**

- Installs `tsx`, exercises `expo config`, merges `app.json`, and applies the two scoped Biome overrides.
- Creates all eight required tracked `src/` directories and puts `passWithNoTests` in Vitest config.
- The colour gate is materially broader than the prior six-digit-hex grep.

**Concerns**

- None remaining.

**Suggestions**

- Execute as written.

**Risk Assessment:** **LOW** — the prior scaffold blockers are addressed.

## 01-02 — Portable logic and schemas

**Summary:** This is now a coherent semantic port plan: it preserves behavior/comments while explicitly allowing the required Biome formatting and safe fixes.

**Strengths**

- The source-grounded `TFile` removal remains precise: the only coupling is the import and `OrbitContact.file` in the legacy source ([types.ts](/home/bwales/projects/Orbit/src/types.ts:1), [types.ts](/home/bwales/projects/Orbit/src/types.ts:47)).
- It explicitly permits the exact Biome-safe transformations required by the legacy code ([01-02-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-02-PLAN.md:97)).
- The date acceptance criterion correctly distinguishes executable code from comments ([01-02-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-02-PLAN.md:178)); the legacy explanatory comment genuinely contains `toISOString` ([dates.ts](/home/bwales/projects/Orbit/src/utils/dates.ts:4)).

**Concerns**

- None remaining.

**Suggestions**

- Execute as written.

**Risk Assessment:** **LOW** — port behavior and lint requirements now agree.

## 01-03 — Theme and home shell

**Summary:** The store-to-provider wiring and pure resolver test are now present, but the new resolution path has two compile-blocking integration gaps.

**Strengths**

- The provider is explicitly required to subscribe to `useThemeStore` and derive its palette from persisted state ([01-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-03-PLAN.md:176)).
- `resolveMode`/`resolvePalette` are pure and have a concrete Vitest suite.
- The shared colour gate is correctly reused for `src` and `App.tsx`.

**Concerns**

- **HIGH — [NEW] `useColorScheme()` is passed to a narrower resolver type.** The revised contract accepts only `"light" | "dark" | null` ([01-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-03-PLAN.md:106)), while the plan directly passes `scheme` from `useColorScheme()` ([01-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-03-PLAN.md:178)). The in-repo React Native reference defines the hook result as `ColorSchemeName`, which includes `"unspecified"` ([Appearance.d.ts](/home/bwales/projects/quest-board-app/node_modules/react-native/Libraries/Utilities/Appearance.d.ts:12), [Appearance.d.ts](/home/bwales/projects/quest-board-app/node_modules/react-native/Libraries/Utilities/Appearance.d.ts:51)). As written, the required `tsc --noEmit` gate can fail.

- **HIGH — [PARTIAL: cycle-1 #4] `App.tsx` is told to import from a theme barrel that the plan never creates.** `@/*` maps `@/theme` to `src/theme` ([01-01-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-01-PLAN.md:181)), but 01-03 creates only `theme-types.ts`, `theme-presets.ts`, `theme-presets.test.ts`, and `theme-provider.tsx`—not `src/theme/index.ts` ([01-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-03-PLAN.md:7)). Task 3 nevertheless requires importing `ThemeProvider` from `@/theme` ([01-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-03-PLAN.md:214)). The home shell cannot typecheck unless a barrel is added or the import is direct.

**Suggestions**

- Normalize before calling the resolver, e.g. treat every non-`"light"` scheme as `"dark"`, and test `"unspecified"`.
- Add `src/theme/index.ts` exporting `ThemeProvider` and `useTheme`, or change `App.tsx` to import from `@/theme/theme-provider`.

**Risk Assessment:** **HIGH** — both defects can block the plan’s mandatory typecheck.

## 01-04 — AI service

**Summary:** The revised plan correctly omits the local provider and substantially improves the fetch conversion verification. The remaining gap is only the advertised HTTPS-only custom endpoint guarantee.

**Strengths**

- It removes the legacy local class and registration, which are the source of the literal `http://localhost:11434` path ([AiService.ts](/home/bwales/projects/Orbit/src/services/AiService.ts:168), [AiService.ts](/home/bwales/projects/Orbit/src/services/AiService.ts:482)).
- It specifies four `response.ok` guards before four async JSON reads, with behavioral tests that ensure `json()` is not called after a failed response.
- The local settings interface matches the legacy service’s actual settings reads ([AiService.ts](/home/bwales/projects/Orbit/src/services/AiService.ts:475)).

**Concerns**

- **MEDIUM — [PARTIAL: cycle-1 #5] The plan removes literal cleartext URLs but does not enforce HTTPS for the retained custom endpoint at runtime.** The custom provider stores an arbitrary endpoint string and sends its request directly to it ([AiService.ts](/home/bwales/projects/Orbit/src/services/AiService.ts:402), [AiService.ts](/home/bwales/projects/Orbit/src/services/AiService.ts:421)). The revised local contract still exposes `aiCustomEndpoint: string` ([01-04-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-04-PLAN.md:131)), and the port instructs `fetch(url, ...)` ([01-04-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-04-PLAN.md:175)). `! grep 'http://'` proves only that no literal is committed; `new CustomProvider("http://…")` would still make cleartext egress.

**Suggestions**

- Validate `new URL(endpoint).protocol === "https:"` in `CustomProvider` before `fetch`.
- Add a test proving an `http:` endpoint rejects and `fetch` is never called. This preserves the recorded omission of the local provider.

**Risk Assessment:** **MEDIUM** — dormant in Phase 1, but it leaves the claimed HTTPS-only boundary unenforced in the actual service.

## 01-05 — Pixel build proof

**Summary:** The release-APK, physical-Pixel-only completion rule, clean prebuild, and emulator non-completion semantics are all correctly fixed. The remote-transfer preflight is still incomplete.

**Strengths**

- The plan now uses `assembleRelease`, which embeds the JS bundle; the sibling Gradle configuration confirms release builds use the debug signing config by default ([build.gradle](/home/bwales/projects/quest-board-app/apps/mobile/android/app/build.gradle:102), [build.gradle](/home/bwales/projects/quest-board-app/apps/mobile/android/app/build.gradle:114)).
- It explicitly keeps FND-01 open for an emulator-only smoke test ([01-05-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-05-PLAN.md:193)).
- It adds the missing `prebuild --clean` rule and validates the remote marker before `rsync --delete`.

**Concerns**

- **MEDIUM — [PARTIAL: cycle-1 remote-build command] The checkpoint proves SSH authentication but never proves the remote `rsync` receiver or its Windows-path form.** Task 1 only executes `ssh droid 'echo ok'` ([01-05-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-05-PLAN.md:104)); it asks the owner to identify cmd/PowerShell and a `C:\...` path ([01-05-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-05-PLAN.md:128)). Task 2 then assumes `rsync` can run remotely against that path ([01-05-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-05-PLAN.md:168)). Windows OpenSSH alone does not establish either requirement, so the first real sync can still fail before Gradle runs.

**Suggestions**

- Add a pre-check for the remote receiver (`rsync --version`) and a non-destructive `rsync --dry-run` to the confirmed destination.
- Record the exact remote path syntax accepted by that receiver. If unavailable, make the owner choose and document the allowed `scp` fallback.

**Risk Assessment:** **MEDIUM** — likely a bring-up blocker, though it does not weaken the actual Pixel acceptance rule.

# Overall

The five requested cycle-1 HIGH resolutions are present:

1. **Biome vs verbatim:** confirmed in 01-02’s semantic-verbatim and `biome check --write` rules, plus 01-01’s logger/test overrides.
2. **`toISOString` criterion:** confirmed; executable code is checked separately while the mandated comment remains.
3. **Standalone physical-Pixel proof:** confirmed; 01-05 uses release APKs and says emulator evidence leaves FND-01 open.
4. **Live persisted theme store:** substantially confirmed; the provider now subscribes to the store and uses `useColorScheme`, with resolver tests. However, the two 01-03 integration defects above still prevent the intended implementation from typechecking as written.
5. **Local/LAN provider omitted:** confirmed. I am not re-raising its omission. The only residual issue is runtime validation of the separate custom endpoint’s HTTPS-only promise.

Remaining unresolved concerns:

- **HIGH:** 01-03 `useColorScheme` type/domain mismatch.
- **HIGH:** 01-03 missing `@/theme` barrel/direct-import specification.
- **MEDIUM:** 01-04 custom endpoint accepts runtime `http:` URLs.
- **MEDIUM:** 01-05 does not verify remote `rsync` capability/path syntax before its destructive sync.

---

## Claude Review

# Cross-AI Plan Review — CYCLE 2 (re-review of revised plans, commit 8eef807)

**Method note:** every file:line below was opened and verified this session — `~/projects/Orbit/src/{types.ts,utils/dates.ts,utils/logger.ts,schemas/*,services/AiService.ts}`, `~/projects/Orbit/test/unit/*`, `~/projects/quest-board-app/{biome.json,apps/mobile/app.config.ts,apps/mobile/tsconfig.json,apps/mobile/babel.config.js,apps/mobile/ANDROID_BUILD_GUIDE.md,apps/mobile/android/app/build.gradle,apps/mobile/src/app/_layout.tsx,packages/ui/src/*,node_modules/react-native/Libraries/Utilities/Appearance.d.ts}`, plus this repo's `.gitignore`, `.claude/settings.local.json`, `.claude/hooks/`, `docs/`.

---

## 01-01-PLAN.md — Scaffold + toolchain

### Summary
Solid, well-hedged. The revision's additions (full eight-folder layout landed here rather than deferred; `passWithNoTests` moved into the config; the two Biome overrides; the shared `check:colors` script; the `app.json`-merging `({ config })` form) all land as real tasks with grep-checkable criteria. Every cited analog claim checks out: `apps/mobile/app.config.ts:1` really is `import "tsx/cjs";`, `biome.json:2` really is schema `2.4.10` (bumping to 2.5.8 is right), `apps/mobile/babel.config.js:5` really is the reanimated plugin to drop, and `tsconfig.json:9-12` really are the `@quest-board/*` aliases to drop. The `.gitignore` acceptance criteria pass against the real file (`node_modules/` line 2, `graph.html` line 9), so the append-only check is not vacuous.

### Strengths
- `npx expo config --type public` as a **wave-1** gate for the tsx-loaded config is the right catch-early move — it converts a wave-4 prebuild failure into a wave-1 one.
- The two Biome overrides are correctly targeted: `Logger` at `~/projects/Orbit/src/utils/logger.ts:10-42` is a static-only class **and** uses `this.level` inside static methods (lines 25, 32, 39), so both `noStaticOnlyClass` and `noThisInStatic` genuinely fire. Naming both, and telling the executor to confirm ids against `biome explain`, is exactly right.
- `noNonNullAssertion` override is justified by real code: `~/projects/Orbit/test/unit/types.test.ts:170-172,193-194,211-213` use `result!.getFullYear()` etc.

### Concerns

- **MEDIUM [NEW] — the shared `check:colors` gate is never proven to *fail*.** `01-01-PLAN.md` Task 3 acceptance criteria contain no negative control. The only real invocation is `bash scripts/check-colors.sh src/theme`, and at that moment `src/theme/` contains nothing but `.gitkeep` — so it exits 0 trivially. The accompanying "self-test" (`printf "%s" "color: #fff;" | grep -qiE '#[0-9a-fA-F]{3,8}'`) tests a *regex string typed into the acceptance criterion*, not the script. A `check-colors.sh` with an inverted exit code, a wrong `--include` filter, or a missing `-r` would pass every criterion in 01-01 and then pass 01-03's `npm run check:colors` vacuously — and FND-05's headline claim ("no hardcoded colours") rests entirely on it. Fix: add `printf 'const c = "#ff0000";\n' > /tmp/cc-probe.ts && ! bash scripts/check-colors.sh /tmp/cc-probe.ts` (and a `rgba(` and a `"white"` probe) as acceptance criteria.

- **LOW [NEW] — plan misattributes who ports `logger.ts`.** `01-01-PLAN.md` Task 2 action says the static-class override exists because `Logger` is "ported verbatim by **01-04**". It is ported by **01-02** (`01-02-PLAN.md` `files_modified: src/utils/logger.ts`; Task 2 action). 01-04 only *calls* `Logger.warn/error/debug`. Harmless to the config, but this is executor-facing text and the wave-2/wave-3 distinction matters if 01-02 leaves the file lint-dirty.

### Suggestions
1. Decide explicitly whether to carry quest-board's `assist: { actions: { source: { organizeImports: "on" } } }` (`biome.json:15`). It's not mentioned either way, and 01-02 leans on `--write` doing import cleanup. (Ordering is safe: quest-board's own `app.config.ts:1-4` keeps the bare `import "tsx/cjs";` first ahead of alphabetically-earlier specifiers, so a side-effect import isn't reordered.)
2. Add the negative control above; it costs two lines and is the difference between a gate and a decoration.

### Risk: **LOW**

---

## 01-02-PLAN.md — Port pure logic, types, schemas

### Summary
The strongest of the five. Every line reference in this plan is exact against source, the TDD ordering is real (tests ported first, verified RED), and the "semantic-verbatim" definition resolves cycle-1's byte-verbatim-vs-Biome contradiction cleanly with an explicit in-bounds/out-of-bounds list.

### Strengths
- Line refs verified exact: `types.ts:1` is `import { TFile } from "obsidian";`; `types.ts:48-49` are the doc comment + `file: TFile;`. `dates.ts` is 22 lines, `logger.ts` 43, `schemas/types.ts` 99, both schemas 72 — all as stated.
- **Cycle-1 HIGH #2 is correctly resolved and actually works against the real file.** The criterion `test -z "$(grep -vE '^[[:space:]]*(\*|//|/\*)' src/utils/dates.ts | grep 'toISOString')"` succeeds because both live occurrences of the banned string sit at `~/projects/Orbit/src/utils/dates.ts:4` and `:12`, and both lines begin with whitespace + `*`. The companion `grep -c 'toISOString' >= 1` correctly forces comment retention. This is the rare acceptance criterion that was checked against the bytes.
- The `<legacy_compat>` block (SchemaDef.output.path, precomputed status/daysSince on `OrbitContact`) correctly labels carryover without letting Phase 2 inherit it — matches `~/projects/Orbit/src/schemas/types.ts:60-64` and `types.ts:62-70`.

### Concerns

- **LOW [NEW] — `biome check --write` will not apply the `isNaN` fix the plan expects.** Task 2 instructs "run `npx biome check --write` … and ACCEPT the safe autofixes: … `isNaN(...)`→`Number.isNaN(...)` (noGlobalIsNan)". Biome's `--write` applies **safe** fixes only; `noGlobalIsNan`'s fix changes coercion semantics and is classified unsafe, so it is not applied without `--unsafe`. The three call sites are `~/projects/Orbit/src/types.ts:171,178` — so `npx biome check src/types.ts` (Task 2's verify) exits non-zero and the task appears to fail. The plan does authorize the edit as in-bounds, so an executor recovers by hand; but say so: "`noGlobalIsNan` and any other unsafe-fix rule must be applied manually (or with `--write --unsafe` on these three files only)."

- **LOW [NEW] — `useParseIntRadix` is asserted as fact where 01-01 correctly hedges.** Task 2 states the `parseInt(x)`→`parseInt(x, 10)` rewrite as a known autofix of a named rule; 01-01 Task 2 tells the executor to confirm rule ids against `biome explain` for the *override* rules but this plan does not. The sites are real (`types.ts:170`, three `parseInt` calls) and the edit is right regardless of whether the rule is in `recommended`; just apply the same hedge.

### Suggestions
1. Add "if `biome check` reports a rule with no safe fix, apply the listed in-bounds edit by hand — do not add a Biome override, and do not touch `logger.ts`'s class shape or the test assertions" so the fallback is bounded.
2. Consider asserting `grep -c 'file:' src/types.ts == 0` alongside the obsidian grep — `grep -ic obsidian` alone would still pass if the `file:` field were kept with an invented local type.

### Risk: **LOW**

---

## 01-03-PLAN.md — Theme tokens, persisted store, themed shell

### Summary
Cycle-1's dead-store HIGH is genuinely fixed: the provider now subscribes to `useThemeStore`, the resolvers are pure (no `react-native` import) so they unit-test in the node env, and there is a real behavioural assertion instead of greps. One concrete defect remains in the specified resolver contract — it cannot accept the value the plan tells the provider to feed it.

### Strengths
- The `<interfaces>` block is a real contract, and the `resolvePalette(id,"light") === preset.dark` fallback closes cycle-1's "what does `system`/`light` resolve to when only dark ships" gap with a test rather than prose.
- Correctly flattens `packages/ui` → `src/theme` and strips the `character-store` coupling that dominates the analog (`apps/mobile/src/stores/theme-store.ts:5,78-112`).
- Requiring `grep -c "from 'react-native'" src/theme/theme-presets.ts == 0` is the right mechanism to keep the resolvers node-testable.

### Concerns

- **MEDIUM [NEW] — `resolveMode`'s specified signature is incompatible with `useColorScheme()`, and the behaviour table omits the value RN actually returns for "no preference".** The plan specifies `resolveMode(mode: ThemeMode, systemScheme: "light" | "dark" | null)` (`<interfaces>` block, Task 1 `<behavior>`: `resolveMode("system", null) -> "dark"`), and Task 2 instructs the provider to `read the OS scheme via useColorScheme()` and pass it in. But RN types it as `useColorScheme(): ColorSchemeName` with `type ColorSchemeName = 'light' | 'dark' | 'unspecified'` — **`null` is not in the union** (`~/projects/quest-board-app/node_modules/react-native/Libraries/Utilities/Appearance.d.ts:12` and `:51`, verified at RN 0.83.4; SDK 57 pins RN 0.86, i.e. later in the same lineage — `null` is not coming back). Two consequences: (a) `resolveMode(mode, useColorScheme())` is a TS2345 and fails the plan's own `npx tsc --noEmit` gate; (b) no test case covers `'unspecified'`, so the most obvious type-satisfying repair — widening the param to include `null` *and* keeping `=== "light" ? "light" : ...` logic, or the reverse — can silently invert the documented "default to dark". The analog does not have this bug: `~/projects/quest-board-app/apps/mobile/src/app/_layout.tsx:126-133` resolves with `systemScheme === "light" ? "light" : "dark"`, i.e. anything-not-light is dark, and never names `null`. Fix: type the param as RN's `ColorSchemeName | null | undefined` (or a local `"light" | "dark" | "unspecified" | null`), specify "anything other than `light` → `dark`", and add `resolveMode("system", "unspecified") -> "dark"` to the Task 1 behaviour table. (Blast radius this phase is small because `resolvePalette` falls back to the dark palette anyway — but this is a declared downstream contract.)

- **LOW [NEW] — the home shell lives at root `App.tsx` while `src/screens/` stays an empty `.gitkeep`.** `01-01` Task 3 creates `src/screens/.gitkeep` to satisfy FND-06's layout; `01-03` Task 3 puts the entire shell in root `App.tsx`. The layout requirement is therefore met decoratively — the one screen this phase produces is not in the screens folder. Plain `App.tsx` as the *entry* is the recorded resolution of RESEARCH Open Question 4 and should stay; but putting the shell body in `src/screens/HomeScreen.tsx` and having `App.tsx` render it costs nothing and gives Phase 4 navigation a real home.

### Suggestions
1. Have `useTheme()`'s outside-provider fallback go through `resolvePalette(defaultPresetId, "dark")` (already specified) **and** add a one-line test for it — it's the only branch in the provider that isn't covered and it is what tests/Skia call sites will hit.
2. Task 1's `npm run check:colors -- src` passes trivially while `src/theme` is the only populated dir under `src` and is excluded. Worth stating that the *meaningful* enforcement point is Task 3's unscoped run.

### Risk: **MEDIUM** (one contract defect that fails a gate; everything else is clean)

---

## 01-04-PLAN.md — Port AiService onto fetch, local provider omitted

### Summary
Technically the most impressive plan of the five, and the owner's Ollama-omission decision is enforced in the type system, the code, the greps, and the threat model — not just a comment. **Every single line reference in this plan is exact against the 540-line source.** One naming collision remains that the plan's own instructions invite.

### Strengths — line refs verified against `~/projects/Orbit/src/services/AiService.ts`
| Plan claim | Actual | ✓ |
|---|---|---|
| Obsidian import line 10 | `import { requestUrl } from 'obsidian';` :10 | ✓ |
| `../settings` type import line 13 | `import type { OrbitSettings } from '../settings';` :13 | ✓ |
| Ollama class block ~162-228 | section comment :162, class :168-228 | ✓ |
| Registration ~482-483 | comment :482, `this.providers.set('ollama', …)` :483 | ✓ |
| Omitted-provider HTTP sites 180/194/211, parses 198/222, probe 185 | exact | ✓ |
| Cloud sites 264 / 319 / 377 / 431 | exact | ✓ |
| Remaining body reads 278 / 334 / 386 / 443 | exact | ✓ |
| Sole `http://` default | `http://localhost:11434` :173 (inside the omitted class) | ✓ |
| Settings fields the service reads | `aiApiKeys`/`aiApiKey` :480, `aiCustomEndpoint`/`aiCustomModel` :492-494, `aiProvider` :508,511, `aiModel` :524 — exactly the six | ✓ |
| `'none'` must be in the union | `settings.aiProvider === 'none'` :510 → yes, TS2367 otherwise | ✓ |

- The `grep -c 'await response.json' == 4` count is arithmetically correct post-omission (6 − 2).
- `! grep -q 'http://'` is a sound gate: the surviving Google URL is `https://generativelanguage…` (:375), which does not contain the substring `http://`.
- Task 3's `expect(jsonSpy).not.toHaveBeenCalled()` is the right instrument — it proves *ordering*, which no grep can.

### Concerns

- **MEDIUM [NEW]** *(not raised in cycle 1; the union's contents changed in the revision, its name did not)* — **`AiProvider` is two different exported things in `src/services/`.** The ported file declares `export interface AiProvider { id; name; isAvailable(); listModels(); generate() }` at `~/projects/Orbit/src/services/AiService.ts:149`, and it is load-bearing there (`Map<string, AiProvider>` :469, `getProvider(): AiProvider | undefined` :499, `getActiveProvider(): AiProvider | null` :507). The plan simultaneously creates `src/services/ai-types.ts` exporting a **union type also named `AiProvider`** (`must_haves.artifacts`, `<interfaces>`, Task 1) — and Task 2 explicitly authorises `import type { AiSettings } from './ai-types'` **"(and `AiProvider` if needed)"**. Following that parenthetical produces TS2440 *"Import declaration conflicts with local declaration of 'AiProvider'"* in the very file being ported. Even when avoided, Phase 14 must import both meanings and will have to alias one. The plugin's own comment at `:150` calls the id union `AiProviderType` — rename to `AiProviderId` (or `AiProviderType`) in `ai-types.ts`, update the two acceptance greps, and delete the "(and `AiProvider` if needed)" clause.

- **LOW [PARTIAL: cycle-1 "custom endpoint HTTPS-only"]** — "HTTPS-only" is claimed in `must_haves.truths` and the `artifacts` description, but nothing in the ported code enforces a scheme; the only enforcement is `! grep -q 'http://'` over the **source literal**, and `CustomProvider` (`~/projects/Orbit/src/services/AiService.ts:399-454`) will happily `fetch` any `endpointUrl` string it is handed. The threat model row T-1-04 is honest about this ("Residual: … HTTPS-only enforcement on that field is a Phase-14 concern"), so the deferral is explicit rather than silent — that half is resolved. What remains is the language: the must_have asserts a control that does not exist yet. Either soften the wording to "no cleartext endpoint ships in source; scheme enforcement is Phase 14", or (cheaper, and it makes PROJECT.md's `✓ Good` Key Decision true in code today) add a three-line constructor guard: `if (endpointUrl && !endpointUrl.startsWith('https://')) throw new Error('Custom endpoint must be HTTPS')`. **This is a scope addition, so it is the owner's call, not the planner's** — flagging, not prescribing.

### Suggestions
1. Rename the union and drop the ambiguous import clause (above).
2. Task 3 constructs providers directly — worth one extra case asserting `new AiService().getActiveProvider({ aiProvider: 'none', … }) === null`, since `'none'` is the one union member with behaviour and it currently has zero coverage.

### Risk: **MEDIUM** (one certain-if-followed compile error; everything else verified correct)

---

## 01-05-PLAN.md — Prove the pipeline once

### Summary
Cycle-1's biggest HIGH (a debug APK showing the red screen at the human-verification step) is properly fixed, and the fix's supporting claims are all verifiable. The blocking checkpoint is well-shaped: it automates everything automatable *before* stopping and asks for four things only the owner can supply. The one new safety mechanism — the pre-rsync marker check — has no first-run path.

### Strengths — citations verified
- `apps/mobile/ANDROID_BUILD_GUIDE.md:213-222` is exactly the *"Debug APK caveat — it needs Metro"* section, and **:222** literally reads *"A `release` APK, by contrast, bundles JS at build time and runs standalone with no Metro."* Citation **CONFIRMED**.
- `apps/mobile/ANDROID_BUILD_GUIDE.md:179` is exactly *"**Do not** run `adb install` from the Linux box over the `emu-connect` tunnel."* Citation **CONFIRMED** — the emulator-fallback instruction ("install ON droid") is correct.
- The load-bearing claim that `assembleRelease` needs no keystore setup is **CONFIRMED** at `apps/mobile/android/app/build.gradle:116-118`: the `release` buildType carries `signingConfig signingConfigs.debug` with the stock *"Caution! In production, you need to generate your own keystore file"* comment.
- `! grep -q 'com.placeholder.orbit' app.config.ts` correctly replaces the previously-vacuous check.
- `.claude/settings.local.json` does allow `Bash(rsync *)`, `Bash(scp *)`, `Bash(ssh *)` — the CONTEXT claim holds, and the no-push posture is intact.

### Concerns

- **MEDIUM [NEW] — the `rsync --delete` marker check has no bootstrap path, so the first-ever sync can never run.** Task 2 step (2) says: *"over SSH assert a repo marker exists at the confirmed path, e.g. … `HANDOFF.md` (or `package.json`) is present at `C:\Users\bwles\projects\orbit-app`. **Only if the marker is found, proceed.**"* On a droid that has never received this repo, that path is absent or empty — the marker is necessarily missing, the gate fails, and there is no documented escape. STATE.md's blocker confirms this is the state of the world (*"bring-up still pending"*), so the very first execution hits it. The guard is protecting against the right thing (`--delete` mirroring onto the wrong tree), so keep it — but split the cases explicitly: **absent-or-empty dir → create and proceed; non-empty **and** unmarked → abort and ask the owner.** As written, an executor either deadlocks or improvises around the exact guard that was added for safety.

- **LOW [NEW] — `adb` and `emu-connect` are not in this repo's permission allow-list.** `.claude/settings.local.json` allows `rsync`/`scp`/`ssh` but has no `Bash(adb *)`, no `Bash(*adb *)` (CLAUDE.md mandates the absolute `~/.local/bin/adb`, which would not match a bare `adb` pattern anyway), and no `Bash(emu-connect *)`. Task 1 runs `emu-connect status` + `adb devices -l` and Task 2 runs `adb install` / `uiautomator dump`. If the phase is executed in YOLO mode (PROJECT.md Constraints) this is moot; if not, wave 4 stalls on prompts at precisely the step where the owner is already being asked for four other things. Cheap fix: add the entries at the Task 1 checkpoint.

- **LOW [NEW] — a release APK is not debuggable, which the runbook should record.** CLAUDE.md's device section documents `adb exec-out "run-as <package> cat …"` as working *"because the APK is debuggable"*. The FND-01 artifact is now `app-release.apk`, where `run-as` is unavailable. Verification this phase is UI-only anyway (correct — the plan says so), but `docs/runbooks/desktop-build-pipeline.md` is the durable artifact and should state: *data-layer inspection via `run-as` requires the debug APK; the release APK is for the standalone launch proof only.*

### Suggestions
1. Make the **"Orbit" title text the primary** on-device assertion and `home-shell-root` the secondary. RN's Android `testID` mapping into a `uiautomator dump` (`resource-id` vs. view tag vs. content-desc) varies by RN version and by whether the view is accessibility-focusable; the rendered text is unconditionally present in the dump. The plan already says "testID **or** the title", so this is a swap of primacy, not a new requirement — but the acceptance criterion currently lists testID first and an executor may treat its absence as failure.
2. Have Task 2 capture `adb shell dumpsys package <id> | grep versionCode` (or the install `Success` line) into the runbook verbatim, so the FND-01 evidence is reproducible rather than narrated.

### Risk: **MEDIUM** (owner-gated environment plus one bootstrap gap; the technical approach is now correct and evidenced)

---

# Overall

## Cycle-1 HIGH resolutions — all five CONFIRMED present

| # | Resolution | Verdict | Evidence |
|---|---|---|---|
| 1 | Semantic-verbatim + `biome check --write` + two overrides | **CONFIRMED** | 01-02 `<context>` defines semantic-verbatim with an explicit in/out-of-bounds list; 01-01 Task 2 creates both overrides with grep criteria (`logger.ts`, `noStaticOnlyClass`, `noNonNullAssertion`). Both overrides are *justified by real code*: static-only class + `this` in statics at `~/projects/Orbit/src/utils/logger.ts:10-42`; `result!` idioms at `test/unit/types.test.ts:170-172`. |
| 2 | `toISOString` banned in executable code only, comment preserved | **CONFIRMED** | 01-02 Task 2 acceptance criterion; verified to actually work against `~/projects/Orbit/src/utils/dates.ts:4,12` (both `*`-prefixed comment lines, both excluded by the strip-then-grep). |
| 3 | Standalone **release** APK on the physical Pixel; emulator leaves FND-01 OPEN | **CONFIRMED** | 01-05 objective, `must_haves`, Task 2, acceptance criteria, `<success_criteria>` all say it. Supporting citations verified: `ANDROID_BUILD_GUIDE.md:213-222` (red-screen mechanism), `:179` (install on droid, not over the tunnel), `android/app/build.gradle:116-118` (release signed by the debug keystore → installable with no extra setup). |
| 4 | Persisted store wired into ThemeProvider + pure-resolver test + `system` via `useColorScheme` | **CONFIRMED** (with the MEDIUM caveat above) | 01-03 Task 2 has the provider subscribe (`useThemeStore((s) => s.mode)`), `key_links` encodes it, Task 1 ships `theme-presets.test.ts`. The wiring is real and no longer dead code; the *type* of the value passed from `useColorScheme()` is wrong (`Appearance.d.ts:12,51`). |
| 5 | Ollama omitted entirely per owner decision | **CONFIRMED — and correctly enforced in code, not prose** | 01-04 excludes the id from the union (Task 1 + `grep -ic ollama … == 0`), omits the class and its registration (Task 2, targeting the verified `:168-228` and `:483`), gates cleartext with `! grep -q 'http://'`, and rewrites T-1-04 from "latent/accepted" to "ELIMINATED by omission". **Not re-raised here.** Re-adding the provider would be a decision reversal. |

No regression was introduced by any of the five resolutions.

## Remaining concerns, by severity

**HIGH:** none.

**MEDIUM**
1. `01-01` — `check:colors` has no negative control; the gate FND-05 depends on is never proven to fail. *[NEW]*
2. `01-03` — `resolveMode`'s `"light"|"dark"|null` param cannot accept `useColorScheme()` (`'light'|'dark'|'unspecified'`, `Appearance.d.ts:12,51`); no `'unspecified'` test case, so a type-satisfying repair can invert the documented dark default. *[NEW]*
3. `01-04` — `AiProvider` names both the ported provider **interface** (`AiService.ts:149`) and the new id **union**; Task 2 explicitly permits the import that makes it TS2440. *[NEW]*
4. `01-05` — the pre-`rsync --delete` marker check has no first-run path; on a never-synced droid the gate can never pass. *[NEW]*

**LOW**
5. `01-01` — logger.ts port misattributed to 01-04 (it is 01-02). *[NEW]*
6. `01-02` — `biome check --write` won't apply `noGlobalIsNan` (unsafe fix); Task 2's verify fails without a manual edit or `--unsafe`. *[NEW]*
7. `01-02` — `useParseIntRadix` asserted as fact where 01-01 correctly hedges rule ids. *[NEW]*
8. `01-03` — home shell at root `App.tsx` leaves `src/screens/` decorative. *[NEW]*
9. `01-04` — "custom HTTPS-only" claimed in `must_haves`, but no scheme check exists in code; deferral is explicit in T-1-04, so only the *wording* is unresolved. Adding enforcement is an owner-scope call. *[PARTIAL: cycle-1 HTTPS-only posture]*
10. `01-05` — `adb`/`emu-connect` absent from `.claude/settings.local.json` allow-list (rsync/scp/ssh are present). *[NEW]*
11. `01-05` — release APK is not debuggable; the runbook should say `run-as` inspection needs the debug APK. *[NEW]*
12. Cross-plan — `.planning/phases/01-project-scaffold-portable-code/01-PATTERNS.md:277-278` contains stray tool-call residue (`</content>` / `</invoke>`) at EOF. The document itself is complete (Metadata section closes it), but all five plans `@`-include this file as context. Cosmetic; one-line fix.

## Overall risk: **LOW–MEDIUM**

The revision is a genuine improvement, not a paper one — the five resolutions are implemented as tasks, acceptance criteria, threat-model rows and artifacts rather than restated as intentions, and the line-level claims in 01-02 and 01-04 are exact against 540 lines of real source (I checked all fourteen). Nothing remaining touches a recorded decision, and nothing remaining is a HIGH. The four MEDIUMs are each a one-to-three-line correction to plan text; items 2 and 3 will be caught by the plans' own `tsc --noEmit` gate if missed, items 1 and 4 will not be caught by anything, so those two are the ones worth fixing before execution.

---

## Consensus Summary

Both reviewers re-opened the cited source (`~/projects/Orbit/src`, `~/projects/quest-board-app`,
this repo's `.claude/` + `docs/`) and verified line refs against the actual code. **Both agree
all five cycle-1 HIGH resolutions are genuinely present in the revised plans, implemented as
tasks / acceptance-criteria / threat-model rows / artifacts rather than restated as intentions,
and none introduced a regression.** The Ollama/local-provider omission is enforced in the type
system, the code, the greps, and the threat model — it is the recorded owner resolution and was
correctly NOT re-raised by either reviewer.

### Cycle-1 HIGH resolutions — both reviewers CONFIRM present

1. **Biome-vs-verbatim → semantic-verbatim + `biome check --write` + two `biome.json` overrides**
   (`src/utils/logger.ts` static-class rules; `src/**/*.test.ts` noNonNullAssertion). Both overrides
   are justified by real legacy code (`logger.ts:10-42`; `types.test.ts:170-172`). CONFIRMED.
2. **`toISOString` banned in executable code only, explanatory comment preserved** — the strip-then-grep
   criterion actually works against the real `dates.ts:4,12` (both comment lines). CONFIRMED.
3. **FND-01 = STANDALONE release APK on the physical Pixel; emulator explicitly non-completing.**
   Supporting citations verified (`ANDROID_BUILD_GUIDE.md:213-222` red-screen mechanism; `:179`
   install-on-droid; `android/app/build.gradle:116-118` release signed by debug keystore). CONFIRMED.
4. **Persisted theme store wired into ThemeProvider + pure-resolver unit test + `system` via
   `useColorScheme`.** The provider now subscribes (`useThemeStore((s)=>s.mode)`); store is no longer
   dead code. CONFIRMED — with one MEDIUM caveat on the resolver's parameter type (below).
5. **Local/LAN provider OMITTED entirely per owner decision** — union excludes it, class + registration
   dropped, `! grep -q 'http://'` gate, T-1-04 rewritten to "ELIMINATED by omission". CONFIRMED and
   NOT re-raised (re-adding it would be a decision reversal).

### Agreed / notable remaining concerns

- **[MEDIUM] 01-03 `resolveMode` param type cannot accept `useColorScheme()`** *(both reviewers; the
  cycle-2 headline)*. RN types the hook as `ColorSchemeName = 'light' | 'dark' | 'unspecified'`
  (verified in-tree at `Appearance.d.ts:12,51`, RN 0.83.4 lineage; SDK 57 pins RN 0.86, same lineage) —
  `null` is not returned, `'unspecified'` is. The plan's `resolveMode(mode, systemScheme: "light"|"dark"|null)`
  passed `useColorScheme()` is a TS2345 that FAILS the plan's own `tsc --noEmit` gate; and with no
  `'unspecified'` test case, the obvious type-satisfying repair can silently invert the documented
  "default to dark". Codex rated this HIGH, Claude MEDIUM. **Adjudicated MEDIUM**: it is real and
  actionable, but it is caught by the plan's own mandatory in-task typecheck gate (the trait that
  separates it from cycle-1's uncaught HIGHs) and `resolvePalette`'s dark fallback bounds the blast
  radius. Fix: type the param as RN's `ColorSchemeName | null`, specify "anything not `light` → `dark`",
  add a `resolveMode("system","unspecified") -> "dark"` case.

- **[MEDIUM] 01-04 `AiProvider` names two different exported things** *(Claude)*. The ported
  `AiService.ts:149` already declares `interface AiProvider` (load-bearing at `:469,499,507`); the plan
  also creates a union type **named `AiProvider`** in `ai-types.ts` and Task 2 authorises
  `import ... "(and AiProvider if needed)"` — which produces TS2440 in the file being ported. Rename the
  union to `AiProviderId`/`AiProviderType`, update the two greps, drop the "(and AiProvider if needed)"
  clause.

- **[MEDIUM] 01-05 pre-`rsync --delete` marker check has no first-run/bootstrap path** *(Claude; Codex
  raises the adjacent facet)*. On a never-synced droid the marker (`HANDOFF.md`/`package.json`) is
  necessarily absent, so "only if the marker is found, proceed" can never pass on the first execution
  (STATE.md confirms bring-up is pending). Split the cases: absent-or-empty dir → create and proceed;
  non-empty AND unmarked → abort and ask. Codex's related point: the checkpoint proves `ssh droid 'echo ok'`
  but never proves the remote `rsync` receiver or the Windows-path form before the destructive sync — add
  an `rsync --dry-run` / receiver check.

- **[MEDIUM] 01-01 `check:colors` gate has no negative control** *(Claude)*. FND-05's headline claim
  rests on this shared gate, yet no acceptance criterion proves it FAILS on a bad input — the only real
  invocation runs against a `.gitkeep`-only `src/theme`, and the "self-test" tests a regex string, not
  the script. An inverted exit code / wrong filter would pass every criterion. Add failing probes
  (`#ff0000`, `rgba(`, `"white"`).

- **[MEDIUM] 01-03 `@/theme` import target ambiguity** *(Codex, rated HIGH; adjudicated MEDIUM)*. Task 3
  tells `App.tsx` to import `ThemeProvider` from `@/theme`, but the plan creates no `src/theme/index.ts`
  barrel — `@/theme` would be TS2307. The plan's structural contract (`key_links`, `<interfaces>`) points
  at `theme-provider.tsx`, so a direct import satisfies everything and the `tsc` gate catches a wrong
  import in-task; Claude did not flag it. Specify the direct import `@/theme/theme-provider` or add the
  barrel.

### Lower-severity remaining items (each a 1-3 line plan edit)

- **[LOW] 01-02 `biome check --write` won't apply `noGlobalIsNan`** (unsafe fix) — Task 2's verify
  (`biome check src/types.ts`) then exits non-zero unless the `isNaN→Number.isNaN` edit is applied by
  hand or with `--write --unsafe` on those files. The plan authorises the edit as in-bounds but should
  say the fix is manual/unsafe. Same hedge applies to asserting `useParseIntRadix` as a known autofix.
- **[LOW] 01-01 misattributes the `logger.ts` port to 01-04** — it is ported by **01-02**; 01-04 only
  calls `Logger.*`. Executor-facing text; correct the wave reference.
- **[LOW] 01-04 "custom endpoint HTTPS-only" wording** — `must_haves.truths`/artifact assert an HTTPS-only
  control, but no scheme check exists in code; the `! grep -q 'http://'` gate only proves no cleartext
  *literal* ships. The threat model **T-1-04 explicitly defers** runtime enforcement to Phase 14, so the
  substantive risk is a documented deferral (resolved), and adding an actual constructor guard is an
  owner-scope call. Only the must_have wording overstates today — soften it or (owner's call) add the
  three-line `https:`-only guard.
- **[LOW] 01-05 `adb` / `emu-connect` are not in `.claude/settings.local.json`** (rsync/scp/ssh are) —
  wave 4 may stall on permission prompts at the human checkpoint unless run in YOLO mode. Add the entries.
- **[LOW] 01-05 the release APK is not debuggable** — the durable runbook should note `run-as` data
  inspection needs the debug APK; the release APK is the standalone launch proof only.
- **[LOW] 01-03 home shell lives in root `App.tsx`** while `src/screens/.gitkeep` stays empty — FND-06's
  layout is met decoratively. Optional: move the shell body to `src/screens/HomeScreen.tsx`.
- **[LOW] `01-PATTERNS.md:277-278` has stray tool-call residue at EOF** — all five plans `@`-include it;
  cosmetic one-line cleanup.

### Divergent views

- **Severity of the two 01-03 defects.** Codex rated both the `useColorScheme` type mismatch and the
  `@/theme` barrel gap **HIGH** (framing the barrel as "cycle-1 #4 only partially resolved"). Claude
  rated the type mismatch **MEDIUM** and did not consider the barrel a concern, concluding **"HIGH:
  none."** Adjudication (with the RN types verified in-tree): both are real and actionable but are each
  caught by the plans' own mandatory `tsc --noEmit` gate *inside the same task*, neither touches a
  recorded decision, and cycle-1 resolution #4 (store→provider wiring) is independently confirmed
  present. Treated as **MEDIUM**, not HIGH. **No consensus HIGH remains.**
- **01-04 custom-endpoint HTTPS enforcement.** Codex wants a runtime `new URL(endpoint).protocol` guard
  + test now (rated MEDIUM); Claude agrees the code doesn't enforce it but notes the deferral is
  *explicit* in T-1-04 and that adding enforcement is an owner-scope decision, so only the wording is
  unresolved (rated LOW). Not a contradiction — a scope/ownership judgment. Flag to owner; do not add
  silently.

### Verdict

**No HIGH concerns remain.** The revision genuinely resolved all five cycle-1 HIGHs. The remaining
work is 5 MEDIUM + 8 LOW plan-text refinements (13 actionable total); of these, the 01-03 type mismatch
and the 01-04 `AiProvider` collision will be caught by the plans' own `tsc` gate if missed, while the
01-01 negative-control gap and the 01-05 first-run bootstrap gap will NOT be caught by any gate — those
two are the ones most worth fixing before execution. Overall risk: **LOW-MEDIUM**, no redesign required.
