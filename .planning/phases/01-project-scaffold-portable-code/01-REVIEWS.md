---
phase: 1
reviewers: [codex, claude]
reviewed_at: 2026-08-14T13:55:08Z
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md, 01-05-PLAN.md]
---

# Cross-AI Plan Review — Phase 1: Project Scaffold & Portable Code

## Codex Review

# Review outcome

The plans are generally well-grounded in the legacy source and respect Phase 1 boundaries, but I would not execute them unchanged. Two issues are mechanically contradictory, and the theme and Pixel proofs do not yet guarantee their stated success criteria.

## 01-01 — Scaffold

**Summary:** Solid flat-app scaffold plan with appropriate avoidance of quest-board monorepo machinery and correctly deferred package-ID ownership.

**Strengths**

- Correctly extracts only transferable patterns: quest-board’s portrait lock and predictive-back setting are real config patterns in [app.config.ts](/home/bwales/projects/quest-board-app/apps/mobile/app.config.ts:11), [app.config.ts](/home/bwales/projects/quest-board-app/apps/mobile/app.config.ts:25), while its package aliases are monorepo-specific ([tsconfig.json](/home/bwales/projects/quest-board-app/apps/mobile/tsconfig.json:6)).
- The placeholder package ID is explicitly deferred to the human checkpoint, consistent with the requirement to confirm it rather than infer it.
- `expo-sqlite` registration is only a native dependency/config-plugin preparation; it introduces no Phase-2 schema or DAO work.
- Excluding an Obsidian alias is correct: the legacy Vitest configuration uses one only to mock its plugin runtime ([vitest.config.ts](/home/bwales/projects/Orbit/vitest.config.ts:34)).

**Concerns**

- **MEDIUM — FND-06 folder-layout claim is not satisfied at the end of this plan.** The plan promises the full layout, but only creates tracked `db`, `components`, and `screens`; it defers `theme`, `stores`, `services`, `schemas`, and `utils` to later plans ([01-01-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-01-PLAN.md:195)). Those directories are explicitly part of the required layout ([CLAUDE.md](/home/bwales/projects/orbit-app/CLAUDE.md:101)).
- **LOW — Vitest alias implementation is underspecified.** “`@` → `./src`” needs an absolute resolved path in Vite/Vitest configuration for predictable behavior; otherwise Plan 02’s `@/types` imports are a potential first-test failure.

**Suggestions**

- Create all required `src/` folders in 01-01, using `.gitkeep` where no source lands yet.
- Specify the alias with `fileURLToPath(new URL("./src", import.meta.url))`, and add an alias-resolution smoke test.

**Risk Assessment:** **MEDIUM.** The architecture is sound, but the plan’s own artifact contract is currently incomplete.

## 01-02 — Portable logic and schemas

**Summary:** The source tracing is excellent and the intended Obsidian decoupling is correct, but this plan contains a hard contradiction around `formatLocalDate()` that will block acceptance.

**Strengths**

- The exact coupling removal is correctly identified: legacy `types.ts` imports `TFile` at [line 1](/home/bwales/projects/Orbit/src/types.ts:1) and exposes it only through `OrbitContact.file` at [lines 47–49](/home/bwales/projects/Orbit/src/types.ts:47). Removing those two elements preserves the pure status logic beginning at [line 98](/home/bwales/projects/Orbit/src/types.ts:98).
- Porting the existing tests is appropriate. They cover the important 80%/100% status boundaries ([types.test.ts](/home/bwales/projects/Orbit/test/unit/types.test.ts:32)) and the local-timezone date case ([dates.test.ts](/home/bwales/projects/Orbit/test/unit/utils/dates.test.ts:35)).
- Excluding `schemas/loader.ts` is correct and avoids Phase-3 leakage; the handoff expressly says it is obsolete vault parsing ([HANDOFF.md](/home/bwales/projects/orbit-app/HANDOFF.md:442)).

**Concerns**

- **HIGH — The `toISOString` acceptance check makes the plan impossible to pass while retaining the required comment.** The plan says to port `dates.ts` unchanged and preserve its explanatory comment ([01-02-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-02-PLAN.md:160)), but then requires `grep -c 'toISOString' … == 0` ([line 175](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-02-PLAN.md:175)). The required legacy comment contains that exact text twice ([dates.ts](/home/bwales/projects/Orbit/src/utils/dates.ts:4), [dates.ts](/home/bwales/projects/Orbit/src/utils/dates.ts:12)).
- **MEDIUM — “Verbatim” porting conflicts with the 2-space Biome gate.** The legacy files use four-space indentation and single quotes, e.g. [types.ts](/home/bwales/projects/Orbit/src/types.ts:7) and [logger.ts](/home/bwales/projects/Orbit/src/utils/logger.ts:8), while 01-01 configures Biome to require two spaces. “Only two deletions/one type change” is therefore incompatible with `biome check`.
- **LOW — The retained `SchemaDef.output.path` preserves an obsolete Obsidian file-creation concept.** This is not Phase-3 implementation scope creep, but it should be explicitly labelled legacy compatibility-only. The handoff says output paths are meaningless on mobile and must ultimately be dropped ([HANDOFF.md](/home/bwales/projects/orbit-app/HANDOFF.md:442)).

**Suggestions**

- Replace the `grep toISOString == 0` check with a test that proves local getters are used, plus a targeted scan that excludes comments; retain the explanatory comment verbatim.
- Say “behavior-preserving port, then Biome-format the files” rather than “verbatim,” and allow only formatting plus the stated portability edits.
- Add a short TODO on the schema compatibility types pointing to Phase 3, without adding loader/database behavior.

**Risk Assessment:** **HIGH** until the impossible date acceptance criterion and formatting contradiction are corrected.

## 01-03 — Theme and home shell

**Summary:** The proposed token boundary follows the quest-board pattern, but the persisted store is not actually connected to the provider or rendered app, so the plan does not prove persisted theme selection.

**Strengths**

- Centralizing literal palette values matches the pattern in [theme-presets.ts](/home/bwales/projects/quest-board-app/packages/ui/src/theme-presets.ts:8) and the non-null fallback in [theme-provider.tsx](/home/bwales/projects/quest-board-app/packages/ui/src/theme-provider.tsx:56).
- The plan honors the immutable token rule: all colors must resolve through tokens ([CLAUDE.md](/home/bwales/projects/orbit-app/CLAUDE.md:147)).
- It correctly removes quest-board’s per-character coupling, which exists only because its store is keyed by character ([theme-store.ts](/home/bwales/projects/quest-board-app/apps/mobile/src/stores/theme-store.ts:17)).

**Concerns**

- **HIGH — There is no store → provider → UI data path.** The plan creates `mode`/`presetId` in Zustand ([01-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-03-PLAN.md:149)), but the provider task does not consume the store ([lines 113–126](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-03-PLAN.md:113)), and `App.tsx` merely wraps a default `ThemeProvider` ([lines 180–184](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-03-PLAN.md:180)). Thus rehydration cannot restyle the app. Quest-board succeeds because its provider explicitly accepts `presetId` and resolved mode ([theme-provider.tsx](/home/bwales/projects/quest-board-app/packages/ui/src/theme-provider.tsx:24)).
- **MEDIUM — `system` mode has no resolution design.** The planned type includes `"system"` but the only preset is dark and the provider contract does not say how the OS mode is resolved. Persisting `"system"` could leave an undefined or misleading `mode`.
- **MEDIUM — The hardcoded-color verification is too narrow.** It only detects six-digit hex strings ([01-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-03-PLAN.md:193)); it misses `#fff`, 8-digit hex, `rgb()`, `hsl()`, named colors, and raw color strings. The project rule has no such exception.

**Suggestions**

- Make `ThemeProvider` subscribe to `useThemeStore`, resolve `system` through `useColorScheme`, and pass the resolved palette to the context. Add a hydration/selection test.
- Either omit `light`/`system` from the Phase-1 persisted state or define their exact fallback behavior now.
- Add a broader source scan or a Biome/custom lint rule for color literals outside `src/theme`.

**Risk Assessment:** **HIGH.** The current plan creates theme pieces but not the required persisted theme behavior.

## 01-04 — AI service port

**Summary:** This is a carefully researched fetch conversion. The counted call sites and body reads match the actual service, but the plan needs stronger behavioral verification and an explicit future guard against legacy mobile-incompatible providers.

**Strengths**

- The stated seven transport sites are accurate: availability/list/generate calls are at [AiService.ts:180](/home/bwales/projects/Orbit/src/services/AiService.ts:180), [194](/home/bwales/projects/Orbit/src/services/AiService.ts:194), [211](/home/bwales/projects/Orbit/src/services/AiService.ts:211), [264](/home/bwales/projects/Orbit/src/services/AiService.ts:264), [319](/home/bwales/projects/Orbit/src/services/AiService.ts:319), [377](/home/bwales/projects/Orbit/src/services/AiService.ts:377), and [431](/home/bwales/projects/Orbit/src/services/AiService.ts:431).
- The six `response.json` property reads are real ([AiService.ts:198](/home/bwales/projects/Orbit/src/services/AiService.ts:198), [222](/home/bwales/projects/Orbit/src/services/AiService.ts:222), [278](/home/bwales/projects/Orbit/src/services/AiService.ts:278), [334](/home/bwales/projects/Orbit/src/services/AiService.ts:334), [386](/home/bwales/projects/Orbit/src/services/AiService.ts:386), [443](/home/bwales/projects/Orbit/src/services/AiService.ts:443)). Requiring `await response.json()` and `response.ok` guards is the right conversion.
- The local settings contract is appropriately scoped to real reads: the legacy service uses provider, keys, model, and custom endpoint/model in [AiService.ts:475](/home/bwales/projects/Orbit/src/services/AiService.ts:475) through [529](/home/bwales/projects/Orbit/src/services/AiService.ts:529).

**Concerns**

- **MEDIUM — Structural greps do not prove the fetch conversion’s behavior.** A guard can be placed after a parse, use the wrong response, or return a misleading provider error while still satisfying all stated counts. This is the phase’s most failure-prone transformation.
- **MEDIUM — The local `AiSettings.aiProvider` type is underspecified.** The source has an explicit provider union ([settings.ts](/home/bwales/projects/Orbit/src/settings.ts:11)); “provider id / `none`” could become plain `string` and allow invalid provider states.
- **MEDIUM — The dormant port retains mobile-inappropriate `http://localhost:11434`.** The legacy Ollama constructor does this at [AiService.ts:173](/home/bwales/projects/Orbit/src/services/AiService.ts:173), while the project decision is “No Ollama/local AI on mobile; custom endpoint HTTPS-only” ([PROJECT.md](/home/bwales/projects/orbit-app/.planning/PROJECT.md:188)). Dormancy makes this acceptable in Phase 1, but the plan needs a tracked requirement that Phase 14 must remove/disable it before any UI can call the service.
- **LOW — It shares Plan 02’s “faithful port” versus two-space Biome conflict.**

**Suggestions**

- Add mocked-fetch tests for each provider’s non-OK response and one success parse; verify `json()` is never called after a non-OK response.
- Define `AiProviderId = "none" | "ollama" | "openai" | "anthropic" | "google" | "custom"` in `ai-types.ts`.
- Add an explicit Phase-14 blocker/TODO for no-Ollama and HTTPS-only custom endpoints before this service is wired.

**Risk Assessment:** **MEDIUM.** The code transformation is correctly scoped, but the verification must test semantics rather than only text patterns.

## 01-05 — Desktop build and Pixel proof

**Summary:** The owner checkpoint is correctly designed and faithfully preserves the no-push rule, but the emulator fallback must not be treated as FND-01 completion and the Windows command path needs to be made executable rather than illustrative.

**Strengths**

- The plan correctly blocks before altering the package ID, SSH configuration, or USB authorization ([01-05-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-05-PLAN.md:90)). This meets the owner-gating requirement.
- It uses the chosen rsync/scp transport rather than `git push`, matching the mandated build path ([PROJECT.md](/home/bwales/projects/orbit-app/.planning/PROJECT.md:118)).
- It correctly uses `emu-connect`, reads the device serial dynamically, and uses the SDK `adb`, consistent with [CLAUDE.md](/home/bwales/projects/orbit-app/CLAUDE.md:233) and [CLAUDE.md](/home/bwales/projects/orbit-app/CLAUDE.md:256).

**Concerns**

- **HIGH — The desktop-emulator fallback cannot satisfy FND-01.** The plan permits fallback at [01-05-PLAN.md:153](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-05-PLAN.md:153), yet declares FND-01 satisfied as a Pixel-6-Pro proof. The project explicitly defines the Pixel as the primary proof target and the desktop emulator only as fallback ([PROJECT.md](/home/bwales/projects/orbit-app/.planning/PROJECT.md:120)). An emulator run should be documented as partial verification and leave FND-01 open.
- **MEDIUM — The remote build commands are not yet runnable as written.** The rsync destination is `droid:.../orbit-app/` and the SSH command lacks a cmd-vs-PowerShell branch, despite the checkpoint correctly noting that shell choice changes paths/chaining ([01-05-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/01-project-scaffold-portable-code/01-05-PLAN.md:112)). The authoritative path is a Windows `C:\Users\bwles\projects\orbit-app` destination ([PROJECT.md](/home/bwales/projects/orbit-app/.planning/PROJECT.md:125)).
- **LOW — `rsync --delete` deserves an explicit destination validation before use.** It is appropriate for repeatable mirrors, but the plan should first assert the resolved remote directory is the intended Orbit checkout.

**Suggestions**

- Split outcomes: Pixel install/render = FND-01 complete; emulator install/render = pipeline smoke test only, with FND-01 blocked pending physical device validation.
- At checkpoint resume, record a concrete remote path plus a PowerShell or cmd command template, then use that exact template in the runbook.
- Before the first `--delete`, remotely verify the directory and a repository marker such as `package.json`/`HANDOFF.md`.

**Risk Assessment:** **HIGH** for phase completion reporting, because the current fallback can incorrectly close the physical-device requirement.

## Overall risk assessment: HIGH

The plans have strong source grounding, avoid SQLite/custom-field implementation scope, preserve the no-push rule, and correctly gate owner-only setup. The blocking issues are fixable:

1. Correct Plan 02’s impossible `toISOString` check and allow Biome formatting.
2. Wire Plan 03’s persisted store into the theme provider and define `system`.
3. Make Plan 05’s emulator route explicitly non-completing for FND-01.
4. Add behavioral mocked-fetch tests and a future no-Ollama/HTTPS guard to Plan 04.

---

## Claude Review

I verified the plans' claims against `~/projects/Orbit/src`, `~/projects/quest-board-app`, and the repo's own `.planning/` artifacts, and ran Biome 2.4.10 (quest-board's binary, same 2.x rule lineage as the pinned 2.5.8) against the actual files to be ported.

---

# Cross-AI Plan Review — Phase 1: Project Scaffold & Portable Code

## 1. Summary

This is a strong, unusually well-grounded plan set. Every file:line reference I checked in `~/projects/Orbit/src` is **accurate** — the seven `requestUrl(` call sites (180, 194, 211, 264, 319, 377, 431), the six `const data = response.json;` reads (198, 222, 278, 334, 386, 443), the status check at 185, the `TFile` import at `types.ts:1` and the `file: TFile` field at `types.ts:48-49`, and the exact `AiSettings` field set consumed at `AiService.ts:480/493-494/508/511/524`. The single highest-risk item in the whole phase — Obsidian's `requestUrl().json` being a *pre-parsed property* while `fetch`'s is an *async method*, a bug that typechecks silently — is correctly identified and gated by structural greps rather than by `tsc`. Owner-gated items (package id, `droid` SSH bring-up, USB-debug prompt) are correctly quarantined behind a `blocking-human` checkpoint in 01-05 and are not invented anywhere else. I found **no** Phase-2/Phase-3 scope leak, **no** `toISOString()` reintroduction, **no** `git push`, and **no** worktree usage.

Two problems are serious enough to stall execution as written: the "port verbatim + `biome check .` exits 0" pair is **provably unsatisfiable** (measured: 8 distinct recommended-rule violations plus formatter diffs across the ported files, of which the plans anticipate exactly one), and the FND-01 device proof will land on a red-box error screen because a debug APK carries no embedded JS bundle — a caveat documented by name in quest-board's own build guide. A third issue is a decision-authority question the plans quietly resolved on their own rather than escalating: porting `OllamaProvider`.

---

## 2. Strengths

- **Source claims are real, not asserted.** I opened every cited location. `~/projects/Orbit/src/services/AiService.ts:180,194,211,264,319,377,431` are the seven `requestUrl(` sites; `:198,222,278,334,386,443` are the six `const data = response.json;` reads; `:185` is `return response.status === 200;`; `:10` is the Obsidian import; `:13` is the unported `../settings` type import. All exact. This is materially better than the norm for planning artifacts.
- **The `.json` property-vs-method trap is caught and verified structurally.** 01-04's acceptance criteria (`grep -c 'await response.json' == 6`, `grep -c '\.json;' == 0`) are internally consistent with the source and catch a bug that produces no compile error. The paired `grep -c '!response.ok' >= 6` / `grep -c 'response.ok' >= 7` arithmetic is also correct (six guards + the one `isAvailable` return).
- **The `AiSettings` minimal-interface claim is verified.** `AiService` reads exactly `aiApiKeys`/`aiApiKey` (`:480`), `aiCustomEndpoint`/`aiCustomModel` (`:493-494`), `aiProvider` (`:508,511`), `aiModel` (`:524`). Nothing else. And `extractContext` (`:95-111`) reads only `name`/`category`/`lastContact`/`lastInteraction`/`daysSinceContact`/`socialBattery` — so deleting `file: TFile` really is compile-safe, as claimed.
- **Owner gating is done properly.** 01-05 is `autonomous: false` with a `blocking-human` Task 1, a populated `user_setup` block, and an explicit "must NOT invent the package id, edit ~/.ssh/config, or tap the on-device prompt." 01-01 plants `com.placeholder.orbit` with an adjacent comment pointing at that checkpoint. This is exactly the right shape.
- **Anti-patterns are drawn from the real files, not guessed.** `withSentry` is genuinely at `quest-board-app/apps/mobile/app.config.ts:1-3,67-71`; the `@quest-board/*` aliases are at `apps/mobile/tsconfig.json:9-12`; the reanimated plugin is at `apps/mobile/babel.config.js:5`; the haptics `noRestrictedImports` rule and the `.grit` plugin are at `biome.json:14,20-30`. Every "drop this" instruction corresponds to something actually present.
- **TDD ordering in 01-02 is correct and honest.** Tests ported first, with an explicit "`vitest run` MUST exit non-zero (RED)" acceptance criterion. That is a real gate, not a ceremonial one.
- **HANDOFF §15's first move #4 (the Obsidian importer) is correctly absent** — it was cut by the owner (PROJECT.md Out of Scope), and no plan re-proposes it. Likewise `schemas/loader.ts` is explicitly excluded per HANDOFF §14.9.

---

## 3. Concerns

### HIGH — "Port verbatim" and `biome check .` exit 0 are mutually unsatisfiable; the plans anticipate 1 of ~8 collisions

01-02 Task 2/3 and 01-04 all gate on `npx biome check .` exiting 0 while instructing "port verbatim / port faithfully." I copied the actual files into a temp dir, applied 01-02's exact `types.ts` line-1 deletion, and ran Biome with the plan's own config (recommended rules, 2-space indent):

```
6 lint/complexity/noThisInStatic      (logger.ts:15,20,25,32,39)
4 format                              (all 4 files: 4-space indent + single quotes)
3 lint/suspicious/noExplicitAny       (logger.ts — the ONLY one the plan anticipates)
3 lint/correctness/useParseIntRadix   (types.ts:170)
2 lint/suspicious/noGlobalIsNan       (types.ts:171,178)
1 lint/complexity/noStaticOnlyClass   (logger.ts:10)
exit 1
```

And on the ported test suite:

```
13 lint/style/noNonNullAssertion   (test/unit/types.test.ts — result!.getFullYear() etc.)
 1 lint/style/useImportType        (:15 — Frequency imported as a value, used only as a type)
 1 lint/correctness/noUnusedImports (:7 — vi, beforeEach, afterEach are imported and never used)
 1 format
```

All of these are `recommended` in Biome 2.x (confirmed via `biome explain`). Two consequences beyond the churn:

- **`noStaticOnlyClass` on `Logger` is a trap with blast radius.** The rule's suggested fix is to convert the class into plain functions. An executor optimising for a green gate could do that — and break `Logger.debug(...)` / `Logger.error(...)` at `AiService.ts:139,204,529,533,536`, which 01-04 ports verbatim in the *next* wave. The plan gives no instruction that would stop this.
- **`noGlobalIsNan`'s fix is not semantically neutral in general.** `isNaN(x)` coerces; `Number.isNaN(x)` does not. It happens to be safe at `types.ts:171,178` (the argument is always `Date.getTime()`), but the plan doesn't say so, and an executor applying Biome's fixes mechanically across a 540-line service has no such guarantee.

The formatter diffs alone (every ported file is 4-space + single-quoted; Biome defaults to double quotes) mean the executor faces a wall of diagnostics on the very first verify command of 01-02 Task 2.

### HIGH — FND-01's on-device assertion will fail: a debug APK ships no JS bundle, and 01-05 never starts Metro

01-05 Task 2 builds `gradlew.bat assembleDebug` on droid, pulls the APK, `adb install`s it, launches, and asserts `home-shell-root` via `uiautomator dump`. Nothing in the plan starts Metro on this box or verifies `adb reverse tcp:8081`.

quest-board's own guide says this by name — `apps/mobile/ANDROID_BUILD_GUIDE.md:213-222`, section **"Debug APK caveat — it needs Metro"**:

> `app-debug.apk` … loads JS from a Metro server, **not** from a bundle baked into the APK. So after installing, it shows your latest code only once Metro is up and reachable … A `release` APK, by contrast, bundles JS at build time and runs standalone with no Metro.

So the launched app renders the RN "could not connect to development server" error screen, the `uiautomator dump` finds no `home-shell-root`, and this happens *at the human-verification step* the owner is sitting in front of. RESEARCH Assumption A4 ("a plain debug APK satisfies FND-01") is the unexamined premise; the deferral of `expo-dev-client` (Open Question 3) doesn't change it — plain debug builds don't embed a bundle either.

Two fixes, both fine, but the plan must pick one: (a) add `emu-connect` + `npx expo start` + confirm `adb reverse tcp:8081 tcp:8081` to the sequence and the runbook, or (b) build `assembleRelease` for the one-time proof so the APK is standalone. Option (b) is arguably the cleaner FND-01 proof ("the app installs and opens") since it removes this box from the runtime path entirely.

### MEDIUM — `app.config.ts` will not load: `tsx` is never installed

01-01 Task 2 creates `app.config.ts` and tells the executor to read the quest-board analog first. That analog's **line 1 is `import "tsx/cjs";`**, and `apps/mobile/package.json:68` carries `"tsx": "^4.21.0"` (root `package.json:55` too). That import exists precisely because Expo needs a TS transpiler hook to evaluate a TypeScript app config. 01-01 installs `expo-sqlite`, `expo-status-bar`, `safe-area-context`, `async-storage`, `zustand`, `@biomejs/biome`, `vitest` — no `tsx`, and the `app.config.ts` content spec omits the `tsx/cjs` import.

This fails at `npx expo prebuild` on droid — i.e. in wave 4, **after** the blocking human checkpoint, at the most expensive possible moment. Cheap fix: add `tsx` to devDeps and the `import "tsx/cjs"` line, or use `app.config.js` and sidestep it.

### MEDIUM — Porting `OllamaProvider` resolves a conflict between two recorded decisions without escalating

Two authoritative records disagree:

- HANDOFF §4: `AiService.ts` (540 lines, "all 5 provider implementations") ports nearly as-is.
- PROJECT.md Out of Scope: "**Ollama / any local AI provider on mobile** — no zero-egress AI mode exists… Custom endpoint is HTTPS-only," and Key Decisions: "an `http://` LAN endpoint would reopen the **rejected** LAN path + force app-wide cleartext (03-fuel, 13-ai)."

`OllamaProvider` at `~/projects/Orbit/src/services/AiService.ts:168-228` defaults to `http://localhost:11434` and is registered unconditionally at `:484`. 01-04's own artifact description advertises the deliverable as "Ported 5-provider AI service (Ollama/OpenAI/Anthropic/Gemini/Custom)" — the plan picks HANDOFF §4 and never names the conflict. Per CLAUDE.md ("Enforcing a recorded decision is a planner call. Reversing one is the owner's… a reviewer flagging the removal of a control *by name* is an escalation trigger"), the direction of the call doesn't matter — **either** choice touches a recorded decision, so it belongs to the owner. Right now a cleartext-`http://` provider lands in `src/` labelled "port faithfully," and Phase 14 inherits it as pre-existing code rather than as a question.

01-04's threat register lists T-1-04 (cleartext egress) as "accept — out of scope, service dormant." That's a reasonable *risk* disposition, but risk posture is explicitly in the owner's bucket, and it doesn't address the decision conflict at all.

### MEDIUM — Wave-2 gate breaks if 01-03 executes before 01-02

01-01 Task 3 adds `--passWithNoTests` **to the invocation**, not to `vitest.config.ts`. 01-03 Task 3's acceptance criterion is the bare `npx tsc --noEmit && npx biome check . && npx vitest run`. 01-02 and 01-03 are both wave 2 with `depends_on: [01-01]` and no ordering between them, so if 01-03 runs first there are zero test files and the gate exits non-zero on a plan that did nothing wrong. Put `passWithNoTests: true` in `vitest.config.ts`, or make 01-03 `depends_on: [01-01, 01-02]`.

### MEDIUM — The no-hardcoded-colours gate only catches 6-digit hex

Both 01-03 Task 1 and Task 3 use `grep -rniE '#[0-9a-f]{6}'`. That misses:

- 3-digit hex — and the Expo `blank-typescript` template's own `App.tsx`, which 01-03 Task 3 replaces, uses `backgroundColor: '#fff'`. Task 1's criterion would pass while a hardcoded colour sits in the tree.
- 8-digit `#RRGGBBAA`, `rgb()`/`rgba()`/`hsl()`, and named colours (`'white'`, `'black'`, `'transparent'`).
- Composed values — quest-board's own presets do `palette.accent + "33"` (`packages/ui/src/theme-presets.ts:102`), the exact idiom a Skia phase will reach for.

CLAUDE.md calls this rule non-negotiable and extends it to Skia draw calls. A gate this porous will be cited as "enforced" for fifteen more phases.

### MEDIUM — 01-03's own `must_haves` truth about rehydration is neither wired nor verified

`01-03-PLAN.md` asserts: "A Zustand store persisted to AsyncStorage **rehydrates the selected theme across app restarts**." But the `<interfaces>` block specifies `ThemeProvider(props: { children })` — no `presetId`/`mode` props — and Task 3 only says "wrap the tree in ThemeProvider." Nothing reads `useThemeStore`. The store is dead code, the provider always resolves the single default preset, and no acceptance criterion (all greps + `tsc`) touches persistence. CLAUDE.md's "changing the active theme profile must restyle the entire app" is therefore unproven at the one moment it's cheapest to prove.

FND-05 only asks for a *scaffold*, so the scope is fine — but the plan should either wire `ThemeProvider` to the store and demote the claim, or keep them decoupled and delete the truth statement. Note also that quest-board resolves `'system'` before passing mode in (`theme-provider.tsx:27` comment); a `ThemeMode` union including `"system"` with no resolution site is a loose end.

### MEDIUM — The runbook bakes in a stale-`android/` trap for every later phase

01-05's rsync line excludes `android/` (correct — prebuild regenerates it) but the droid sequence is `npx expo prebuild --platform android --no-install` with no `--clean`. On the *first* run this is fine, since no `android/` exists. On every subsequent run, `android/` persists on droid and `prebuild` will not regenerate a manifest that already exists — so `app.config.ts` changes (new plugins, permissions, `orientation`, the package id itself) silently don't land. The plan explicitly says "Do NOT improvise a different pipeline later — this runbook is the procedure," and phases 5/10/11/12/13 all add native config. This defect propagates.

Worth also recording quest-board's `ANDROID_BUILD_GUIDE.md:222` corollary in the runbook: JS-only changes need no rebuild at all once Metro is live.

### LOW — assorted

- **`aiProvider`'s type is unspecified.** `AiService.ts:508` does `settings.aiProvider === 'none'`. If `ai-types.ts` narrows it to a union that omits `'none'`, TS errors (TS2367). Specify `'none' | 'ollama' | 'openai' | 'anthropic' | 'google' | 'custom'` (or `string`) explicitly. Related: `:480`'s `?? settings.aiApiKey ?? ''` is dead-ended if `aiApiKey` is declared non-optional.
- **`app.json` vs `app.config.ts` is never reconciled.** `create-expo-app --template blank-typescript` emits `app.json`; 01-01 adds `app.config.ts` and leaves both. The config exporting a plain object silently discards `app.json` (icon, splash, adaptive-icon references). Say explicitly whether to delete it or merge it.
- **`npx expo install expo@^57` doesn't re-pin the rest.** 01-01 Task 1 step 3's fallback pins only `expo`; RN/React stay wherever the template left them. Use `npx expo install --fix`.
- **`extractSection`/`assemblePrompt` (`AiService.ts:62-141`) are markdown-vault-shaped, not just Obsidian-imported.** The port is Obsidian-free at the *import* level, which is what FND-04 asks — but `assemblePrompt` interpolates arbitrary free text scraped from `##` sections, and `DEFAULT_PROMPT_TEMPLATE` (`:18-38`) hardcodes `{{Conversational Fuel}}` / `{{Small Talk Data}}`. Phase 14 must **replace** this, not extend it, or the never-transmitted `off_limits` and `share_with_ai` gating gets built on top of a function whose contract is "send whatever text you find." Worth one sentence in the 01-04 summary so it isn't inherited by accident.
- **`OrbitContact` carries precomputed `status`/`daysSinceContact`/`daysUntilDue` (`types.ts:62-70`)** — a plugin-era shape that reads as a contradiction of Phase 2's "derived-never-stored" decision. Harmless as a DTO; flag it so Phase 2 doesn't inherit it as a row type.
- **01-05's placeholder check passes vacuously on a missing file.** `test -z "$(grep -c 'com.placeholder.orbit' app.config.ts | grep -v '^0$')"` — if `app.config.ts` doesn't exist, `grep -c` prints nothing to stdout and the test passes. Use `! grep -q`.
- **The emulator fallback collides with a documented prohibition.** 01-05 offers "run the same loop against the desktop emulator via `emu-connect remote`," but `ANDROID_BUILD_GUIDE.md:179` says explicitly: "**Do not** run `adb install` from the Linux box over the `emu-connect` tunnel." The fallback needs its own install path spelled out (install on droid directly), or it fails the moment it's used.
- **The ADR bridge is unowned.** `docs/decisions/` does not exist; `adr-registry.ts` and `scripts/normalize-graph-docrefs.ts` are not created by any of the five plans. STATE.md lists this as a Phase 1/2 foundation task. Non-blocking (graphify is disabled and no plan builds it — correct), but nothing claims it, and no plan produces the `01-KB-MANIFEST.md` that CLAUDE.md requires before the first phase completes. (The two PreToolUse hooks *do* already exist at `.claude/hooks/` — that part is covered.)

---

## 4. Suggestions

1. **Add a Task 0 to 01-02 and a formatting step to 01-04:** run `npx biome check --write` on each ported file immediately after copying, then verify. Add an explicit constraint: *"Formatting and lint-mechanical fixes are permitted and expected. `noStaticOnlyClass` on `Logger` is `--ignore`d, not applied — `Logger.warn/error/debug` are call sites in `AiService.ts:139,204,529,533,536`. Do not restructure the class."* Same for `noNonNullAssertion` in the ported test file (or add a scoped override for `src/**/*.test.ts`). Re-scope 01-02's "verbatim" to mean *behaviour and comments preserved*, not *bytes preserved* — the two `types.ts` deletions, the `any[]→unknown[]` fix, `parseInt(x, 10)`, `Number.isNaN`, and formatting are all in-bounds.
2. **Resolve FND-01's bundle question in 01-05 before execution.** Either add `emu-connect` + `npx expo start` + `adb reverse tcp:8081 tcp:8081` to Task 2 and the runbook, or switch the one-time proof to `assembleRelease` (standalone APK, no Metro, cleanest possible "it installs and opens" evidence). Cite `ANDROID_BUILD_GUIDE.md:213-222` in the runbook either way.
3. **Add `tsx` to 01-01's devDeps and `import "tsx/cjs";` to `app.config.ts`** — or use `app.config.js`. Add an acceptance criterion that actually exercises it: `npx expo config --type public` exits 0. That catches the failure in wave 1 instead of wave 4.
4. **Escalate the Ollama question to the owner** before 01-04 runs, naming both halves: HANDOFF §4 says port all five providers faithfully; PROJECT.md Out of Scope rejects Ollama/local AI on mobile and rejects `http://` endpoints. Ask which one governs the port. If the answer is "port it," add a `// [REJECTED for mobile — PROJECT.md Out of Scope]` comment above `OllamaProvider` so Phase 14 can't wire it by accident.
5. **Harden the colour gate** to `#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(` plus a named-colour list, applied to `src/` + `App.tsx` with `src/theme/` excluded — and put it in `package.json` as `npm run check:colors` so all sixteen phases share one implementation rather than re-greping.
6. **Move `passWithNoTests: true` into `vitest.config.ts`** (01-01 Task 3) so no downstream plan's gate depends on execution order.
7. **Either wire `ThemeProvider` to `useThemeStore` or drop the rehydration claim** from 01-03's `must_haves`. If wiring it: pass `presetId`/`mode` from the store, resolve `'system'` at the App.tsx boundary as quest-board does, and add a trivial Vitest case over the palette resolver so FND-05 has one real assertion rather than four greps.
8. **Add `--clean` guidance to the runbook**, with the rule stated plainly: *"If `app.config.ts`, `package.json`, or any native dep changed, run `npx expo prebuild --clean`; JS-only changes need no rebuild at all."*
9. **Assign an owner for the ADR bridge and the `01-KB-MANIFEST.md`** — either a sixth Phase-1 plan or an explicit deferral note in STATE.md. Right now it's in nobody's bucket.

---

## 5. Risk Assessment

**MEDIUM** — rising to HIGH if executed as written.

The architecture is right and the research underneath it is unusually solid: I could not find a single false file:line claim, the phase boundary is clean (no SQLite schema, no custom fields, no CRUD), and the genuinely dangerous port bug (`.json` property → async method) is caught with the right kind of gate. Nothing here reverses a `[DECIDED]` item or reintroduces the UTC date bug, and the owner-gated items are gated correctly — which is the failure mode CLAUDE.md was written to prevent.

The risk is concentrated in **execution-time defects, not design defects**. Two of them are certain to fire: the Biome gate is provably red on first contact (measured, not predicted), and the FND-01 device check is built on a false premise about debug APKs that quest-board's own documentation contradicts by name. Both are cheap to fix now and expensive to hit later — the second one detonates at the human checkpoint, which is the single most costly place in the phase to lose the owner's attention. The `tsx` omission is the same shape: a five-minute fix in wave 1, a wave-4 blocker if left.

The one item that is genuinely not mine or the planner's to close is the Ollama conflict. Two recorded decisions disagree, the plans picked a side silently, and the losing side is a `[REJECTED]` cleartext-transport path. That needs an owner ruling before 01-04 executes, whichever way it goes.

---

## Consensus Summary

Both reviewers independently verified the plans' cited `file:line` references against the actual legacy source in `~/projects/Orbit/src` and the pattern reference in `~/projects/quest-board-app`, and both found the source grounding unusually accurate (Claude: "I could not find a single false file:line claim"; Codex: "source tracing is excellent"). Both agree the **phase boundary is clean** — no Phase-2 SQLite-schema leak, no Phase-3 custom-field leak, no CRUD — the **owner-gated items are correctly quarantined** behind the 01-05 `blocking-human` checkpoint (package id, `droid` SSH bring-up, USB-debug prompt), the **no-`git push` rule and rsync/scp transport are honored**, and there is **no worktree usage and no `toISOString()` UTC-bug reintroduction**. The risk is concentrated in *execution-time* defects, not design defects. Overall verdict: **HIGH risk if executed as written**, fixable without redesign.

### Agreed Strengths

- **Source claims are real, not asserted.** Both reviewers opened the cited locations and confirmed them: the seven `requestUrl(` sites and six `response.json` property reads in `AiService.ts`, the `TFile` import/`OrbitContact.file` coupling in `types.ts:1/47-49`, the exact minimal `AiSettings` field set, and the status boundaries in the ported tests.
- **The `.json` property-vs-async-method trap is caught with the right kind of gate.** Both single out 01-04's structural greps as correctly catching a bug that typechecks silently — the highest-risk transformation in the phase.
- **Owner gating is done properly.** 01-05 is `autonomous: false` / `blocking-human`; the placeholder package id points at that checkpoint; no agent invents the gated items.
- **Correct exclusions.** `schemas/loader.ts` (Phase-3 vault parsing) and the Obsidian importer are correctly absent; quest-board monorepo machinery (package aliases, Sentry) is correctly dropped.

### Agreed Concerns (2+ reviewers — highest priority)

- **HIGH / MEDIUM — "Port verbatim" collides with the `biome check .` exit-0 gate.** Claude rates this HIGH with measured evidence (copied the files, ran Biome 2.x with the plan's own config: ~8 recommended-rule violations plus 4-space/single-quote formatter diffs across the ported files, of which the plans anticipate exactly one; plus `noStaticOnlyClass` on `Logger` whose auto-fix would break `Logger.*` call sites 01-04 ports next wave). Codex rates the same collision MEDIUM. Consensus: re-scope "verbatim" to behaviour/comment-preserving, permit Biome formatting, and pin the dangerous rules (`noStaticOnlyClass`, test-file `noNonNullAssertion`) as ignores rather than auto-fixes.
- **HIGH — 01-05's FND-01 on-device proof is unsound.** Both flag 01-05 HIGH by two different mechanisms: Claude — a debug APK ships no embedded JS bundle and 01-05 never starts Metro / verifies `adb reverse tcp:8081`, so the launched app renders the RN "could not connect" red screen at the human-verification step (quest-board's own `ANDROID_BUILD_GUIDE.md:213-222` says this by name); Codex — the desktop-emulator fallback is treated as FND-01 completion though PROJECT.md defines the Pixel as the primary proof target and the emulator only as fallback. Consensus: fix the bundle/Metro path (add `emu-connect` + `expo start` + `adb reverse`, or build `assembleRelease` for the standalone one-time proof) AND make the emulator route explicitly non-completing for FND-01.
- **HIGH / MEDIUM — 01-03's persisted theme store is not wired to the provider.** Both find the Zustand `mode`/`presetId` store is dead code: `ThemeProvider(props:{children})` takes no store input, `App.tsx` wraps a default provider, and no acceptance criterion touches persistence — so "rehydrates the selected theme across restarts" / "restyle the entire app" is unproven. Codex rates HIGH; Claude MEDIUM (FND-05 only asks for a scaffold, so scope is fine) but agrees the `must_haves` truth statement is neither wired nor verified. Consensus: either wire `ThemeProvider` to `useThemeStore` (+ one resolver test) or drop the rehydration claim.
- **MEDIUM — The no-hardcoded-colours gate only catches 6-digit hex.** Both note `grep -rniE '#[0-9a-f]{6}'` misses `#fff` (present in the very `App.tsx` template 01-03 replaces), 8-digit hex, `rgb()`/`hsl()`, named colours, and composed values like `palette.accent + "33"`. CLAUDE.md calls this rule non-negotiable and extends it to Skia; a porous gate gets cited as "enforced" for later phases.
- **MEDIUM — `system` theme mode has no resolution design.** Both note the `ThemeMode` union includes `"system"` with the only preset dark and no resolution site (quest-board resolves it via `useColorScheme` at the App boundary). Define it now or omit it from Phase-1 persisted state.
- **MEDIUM (owner-bucket) — Porting `OllamaProvider` resolves a conflict between two recorded decisions without escalating.** Both flag that HANDOFF §4 ("port all 5 providers faithfully") and PROJECT.md Out of Scope ("Ollama/local AI on mobile" + "custom endpoint HTTPS-only", an explicitly **[REJECTED]** `http://` LAN path) disagree; `OllamaProvider` defaults to `http://localhost:11434` and is registered unconditionally. The plan silently picks HANDOFF §4. Per CLAUDE.md this is an owner decision regardless of direction — a landed cleartext-`http://` provider labelled "port faithfully" that Phase 14 inherits as code rather than as a question. Needs owner ruling before 01-04 executes; if "port it," add a `[REJECTED for mobile]` guard comment above `OllamaProvider`.
- **LOW — `aiProvider` union unspecified.** Both note `AiService.ts:508` does `settings.aiProvider === 'none'`; the ported type must include `'none'` or TS errors (TS2367). Specify the explicit union.
- **LOW — Legacy-only shapes should be labelled, not silently inherited.** Both flag `SchemaDef.output.path` (Obsidian file-creation, meaningless on mobile) and `OrbitContact`'s precomputed `status`/`daysSinceContact` (contradicts Phase-2 "derived-never-stored") as harmless DTO carryover that needs an explicit Phase-2/3 TODO so it isn't inherited as a row type.

### Divergent Views

- **Verification philosophy for 01-04.** Codex rates the structural-grep verification MEDIUM-risk ("greps do not prove behavior — a guard can sit after a parse and still satisfy the counts") and wants mocked-fetch tests per provider. Claude *praises* the same greps as the correct gate for the silent `.json` bug. Not a contradiction: both are right at different layers — the greps correctly catch the property-vs-method shape, but only behavioral tests prove guard *placement*. Worth adding the mocked-fetch tests.
- **01-02 `toISOString` acceptance criterion.** Codex rates HIGH: the plan says port `dates.ts` unchanged *and preserve its explanatory comment*, but then gates on `grep -c 'toISOString' == 0` — and the required comment contains that exact token twice (`dates.ts:4,12`), making the criterion impossible to pass. Claude did not surface this specific contradiction (it confirmed no `toISOString()` *reintroduction in code*). Single-reviewer HIGH worth fixing: scope the grep to exclude comments, or assert local-getter usage instead.
- **Single-reviewer execution blockers (Claude only, both cheap, both fire late):** `tsx` is never installed yet `app.config.ts` needs `import "tsx/cjs"` to load → fails at `expo prebuild` on droid in wave 4; and wave-2 ordering — 01-02/01-03 share `depends_on:[01-01]` with no order between them, so if 01-03 runs first the bare `vitest run` gate exits non-zero on zero test files (fix: `passWithNoTests:true` in `vitest.config.ts`). Also the stale-`android/` trap (no `--clean` on later prebuilds silently drops `app.config.ts` changes) and an unowned ADR-bridge / `01-KB-MANIFEST.md`.
- **Single-reviewer (Codex only):** 01-01 defers `theme`/`stores`/`services`/`schemas`/`utils` folders to later plans, so FND-06's full-layout claim isn't satisfied at 01-01's end; and 01-05's remote build commands aren't yet runnable (no cmd-vs-PowerShell branch, no concrete Windows path) with `rsync --delete` needing a destination-marker check first.
