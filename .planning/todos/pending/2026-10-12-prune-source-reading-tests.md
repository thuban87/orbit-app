---
created: 2026-10-12T00:00:00.000Z
title: Prune source-reading and count-pinning tests; keep behaviour tests
area: tests
severity: minor
files:

  - src/theme/accent-text-glass-contract.test.ts
  - src/theme/placeholder-contract.test.ts
  - .planning/phases/38.4-audit-remediation-ui-performance-release/38.4-RG029-INVENTORY.md

source: owner, 38.10 plan-phase 2026-10-12. The plan checks spent cycles 3–7 mostly on test plumbing, not on features. Owner: "We clearly have been doing way too many tests though and I want to clamp down on this a bit. … let's add a todo. I'll probably add that to the milestone 3 items." Target: milestone 3 (owner to place).
---

## Problem

At 2026-10-12, `src` holds about 159k lines of tests against about 177k lines of app code, across 618 test files. Some single tests are larger than the file they test. For example, `restore-apply.ts` is 2,347 lines and its test is 3,323.

Of those 618 files, **110 read source files as text** (`readFileSync`) and assert on wording, anchors or site counts. Examples:

- The RG-029 inventory test pins 61 exact code snippets across the app.
- The placeholder test has an "at least N sites" floor.
- Various screen contract tests do the same kind of thing.

Deleting or rewriting a screen breaks these tests even when nothing user-visible changed. In 38.10, they produced most of the plan-check findings from cycle 3 onward.

## For the pruning work

- Triage the 110 source-reading tests. Retire any test that pins text, anchors or counts without protecting behaviour. Replace each real guarantee with a behaviour or render test, or with a lint rule where one fits (for example, "placeholderTextColor must be the theme token").
- Retire the RG-029 inventory test and its `.planning` inventory, unless a behaviour check replaces what it guards.
- Keep the data-layer tests (migrations, backup/restore, DAO invariants). There is no remote repair for user databases (CLAUDE.md "SQLite migrations"), so these earn their size.
- Consider a lightweight standing rule for new tests (what kind to write and when). Any such rule is the owner's decision.
- Scope estimate: about 1–2 plans, based on the 110-file count. The per-file triage depth is not estimated.
