---
phase: 1
slug: project-scaffold-portable-code
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from `01-RESEARCH.md` §Validation Architecture (lines 439-473).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.x` (pure logic; no RN runtime needed). RN-component testing (jest-expo) deferred until there are components worth rendering. |
| **Config file** | `vitest.config.ts` — none yet; **Wave 0** (plan 01-01) creates it. |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx tsc --noEmit && npx biome check . && npx vitest run` |
| **Estimated runtime** | ~15 seconds (pure-function suites + typecheck + lint on a small tree) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit && npx biome check <changed>`
- **After every plan wave:** Run `npx tsc --noEmit && npx biome check . && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite green **and** the one-time FND-01 device-launch proof (manual, owner-gated)
- **Max feedback latency:** ~15 seconds (automated gates); FND-01 device proof is out-of-band (desktop build)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01..03 | 01 | 1 | FND-06 | T-1-supply-chain | Scaffolded deps pass legitimacy audit; no postinstall surprises | lint/static | `npx biome check . && npx tsc --noEmit` | ❌ W0 (creates tsconfig/biome/vitest config) | ⬜ pending |
| 01-02-01..02 (tdd) | 02 | 2 | FND-02 | — | N/A (pure logic) | unit (RED→GREEN) | `npx vitest run src/**/status.test.ts src/utils/dates.test.ts` | ❌ W0 (port plugin tests from `~/projects/Orbit/test/`) | ⬜ pending |
| 01-02-03 | 02 | 2 | FND-02, FND-03 | — | No Obsidian coupling remains | typecheck | `npx tsc --noEmit` + `grep -c obsidian src/types.ts == 0` | ❌ W0 | ⬜ pending |
| 01-03-01..03 | 03 | 2 | FND-05 | — | No key/secret rendered; no network on this path | lint/static | `npx biome check .` + grep hex literals outside `src/theme` == 0 | ❌ W0 | ⬜ pending |
| 01-04-01..02 | 04 | 3 | FND-04 | T-1-ai-nonok-parse, T-1-key-in-logs | `AiService` compiles standalone/dormant; `!response.ok` throws; keys never logged | typecheck (+ optional unit) | `npx tsc --noEmit` + `grep -c requestUrl src/services/AiService.ts == 0` + `grep -c 'await response.json' == 6` | ❌ W0 | ⬜ pending |
| 01-05-01 | 05 | 4 | FND-01 | — | Transport rsync/scp only; never `git push` | manual (device, owner-gated) | desktop-build → `adb install` → `uiautomator dump` shows themed home shell | ❌ manual | ⬜ pending |
| 01-05-02 | 05 | 4 | FND-01 | — | N/A | doc | `docs/runbooks/desktop-build-pipeline.md` exists | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — test runner config (plan 01-01)
- [ ] `tsconfig.json` — `tsc --noEmit` gate, `strict: true`, `@/*` paths (plan 01-01)
- [ ] `biome.json` — lint/format gate (plan 01-01)
- [ ] `npm install -D vitest` — framework install (plan 01-01)
- [ ] `src/**/status.test.ts`, `src/utils/dates.test.ts` — **port the plugin's existing Vitest tests** from `~/projects/Orbit/test/` (covering `calculateStatus`/`formatLocalDate`/type guards) rather than writing fresh (plan 01-02)

*Wave 0 is the tooling+test-harness slice; it lands inside plans 01-01 and 01-02 rather than a separate wave.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App builds + launches to a themed home shell on the Pixel 6 Pro | FND-01 | This box cannot build APKs (2012 Ivy Bridge); build runs on the `droid` Windows desktop over SSH, install is on the physical Pixel, and it is owner-gated (package-id, SSH bring-up, on-device USB-debug prompt) | commit → `rsync -az` source to `droid` → `gradlew.bat assembleDebug` at `C:\Users\bwles\projects\orbit-app` → pull APK → `adb install` on Pixel → `adb shell uiautomator dump` confirms the themed shell renders |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (plan-checker confirmed checks 8a–8d pass on plan content)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (tsconfig/biome/vitest config + ported tests)
- [x] No watch-mode flags (all commands are single-run: `vitest run`, `tsc --noEmit`, `biome check`)
- [x] Feedback latency < 15s (automated gates)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (execution not yet run — sign-off completes after Wave 0 lands green)
