# Orrery Renderer R&D — Shared Experiment Contract

## Purpose
These are disposable but visually serious R&D prototypes. Their purpose is to discover the best direction for a later clean Orrery V2 production phase. None of the experiment branches is to be merged wholesale into main.

## Absolute Git/worktree safety
The owner has already created and explicitly authorized the experimental worktree. This is a narrow owner-approved exception to the repository's normal `CLAUDE.md` rule disabling worktrees.

Before ANY modification run:
- `pwd`
- `git status`
- `git branch --show-current`
- `git worktree list`

Verify that you are inside the assigned `orbit-orrery-lab-*` directory, on the assigned `experiment/orrery-*` branch, NOT in the primary Orbit directory, and NOT on main/master. If any check fails, STOP without modifying files.

Do NOT create, remove, move, prune, repair, or otherwise manage worktrees. Do NOT modify the primary worktree. Do NOT check out, merge into, rebase, reset, force-update, or delete main/master. Never push or use a tool that pushes. Commit coherent milestones locally inside the assigned experiment branch only.

After verification, you may be highly destructive INSIDE THE ASSIGNED WORKTREE ONLY.

## Read first
Read `CLAUDE.md`, `HANDOFF.md`, `docs/systems/orrery.md`, `docs/runbooks/orrery-visual-layer.md`, current Orrery ADRs/dossiers, `src/screens/OrreryScreen.tsx`, `src/components/orrery/`, `src/logic/orrery-*`, `src/services/orrery-scene.ts`, Orrery stores/read models/tests, and relevant Phase 29/30 artifacts. Use Graphify for discovery where useful, then verify actual code.

## Preserve product semantics
Unless the specialized prompt explicitly grants rendering/camera freedom, preserve the meaning and availability of Gravity, Frequency, Systems, center/sun, contacts/photos/initials, satellites, focus, semantic zoom/labels, system switching, reorder behavior, accessibility/reduced motion, themes, high-count behavior, and lifecycle pausing/unmounting.

Contacts and relationships remain the information architecture. Do not turn the Orrery into a literal solar-system simulator.

## Real app + device iteration
A web mockup, Claude Artifact, standalone demo, or fake solar system is NOT the deliverable. Integrate into the real RN Android app and real Orrery data/scene pipeline.

Use `emu-connect` to discover the available emulator/old Pixel. Compilation alone is not success. Install, launch, interact with, inspect, and refine on Android repeatedly: once early, multiple times during refinement, and at final validation. Perform at least two meaningful visual refinement passes after the first viable prototype.

Exercise overview, near/far zoom, focus, satellites, labels, gestures/camera, system switching, dense Systems, reduced motion, relevant themes, and background/foreground/refocus.

## System switching
Preserve the semantic choreography: departing System leaves, retained bodies preserve meaningful continuity where applicable, incoming bodies arrive/capture, destination settles. Treat this as an opportunity for visual expression.

## Assets / Codex
Do not scrape random graphical assets online. Prefer procedural rendering where appropriate. If an original graphical asset genuinely improves the prototype, delegate it to Codex when an appropriate invocation path exists. Give Codex a precise brief including role, dimensions, transparency, format, visual requirements, tiling needs, and performance constraints. Inspect and iterate in context. Do not create assets merely to consume Codex usage.

## Visual target
Opening the Orrery should feel like entering a polished game's interactive star-system map while remaining recognizably Orbit: premium space-strategy/astronomical interface, not dashboard widgets.

Do not interpret game-like as merely “add glow.” Reconsider depth, hierarchy, environment, contact bodies, orbital paths, lighting/compositing, motion, camera feel, focus states, labels, transitions, parallax, and feedback.

## Technical principles
Never drive per-frame animation with React state. Animation must stop appropriately when inactive. Preserve reduced-motion intent and local-first privacy. No network dependency in rendering/read paths. A/B should preserve theme-token discipline; B/C must document temporary experimental compromises.

Collect honest performance evidence on Android; record target, scene density, jank/memory/thermal observations and reliable quantitative measurements where available. Do not invent precision.

## Required research package
Create `docs/experiments/orrery-renderer/<prototype>/` containing:
- `README.md` — goal/status/branch/key commits/run-build-test instructions.
- `ARCHITECTURE.md` — renderer, data flow, dependencies, lifecycle, animation model.
- `VISUAL-DESIGN.md` — visual language, rationale, tunables, background/bodies/orbits/depth/labels/focus/motion/transitions/themes.
- `IMPLEMENTATION.md` — important files/functions/shaders/assets/algorithms with commit/file references sufficient for later reproduction.
- `INTERACTIONS.md` — camera/gestures/focus/zoom/switching/reduced-motion.
- `PERFORMANCE.md` — targets, scene sizes, measurements, bottlenecks, risks.
- `ASSET-MANIFEST.md` — every added asset, provenance, purpose, format/dimensions, keep/discard recommendation.
- `DECISIONS.md` — chronological experiments and why choices changed.
- `DEAD-ENDS.md` — rejected ideas, including attractive-but-slow techniques, with commits/files when recoverable.
- `HARVEST.md` — every successful idea: verdict, value, production readiness, implementation location, commit, deps/assets, performance, visual evidence, and what V2 should preserve.
- `PRODUCTIONIZATION.md` — cleanup/tests/accessibility/performance/dependency/edge-case work needed to ship.
- `RECOMMENDATIONS.md` — lessons, carry-forward/reject list, and “what I would do with one additional day.”

## Visual evidence
Capture durable screenshots and, where possible, short screen recordings: overview, zoom levels, focus, dense System, satellite, transitions, important effects, and meaningful theme/reduced-motion variants. Motion ideas need recordings where possible. HARVEST items should reference evidence.

Claude Artifacts are optional as a gallery/presentation layer only. Source of truth = experiment branch + commits + research package + visual evidence + device-tested build.

## Done means
The assigned rendering hypothesis is pushed far enough for a genuine visual/product judgment; it runs in the real app on Android; repeated device iteration occurred; representative interactions are judgeable; performance evidence exists; successes and failures are documented; visual evidence exists; milestones are committed; future agents can reproduce the good ideas; and main/primary worktree remained untouched.

At completion summarize key commits, rsync/build/test steps, evidence locations, strongest/weakest findings, and highest-value HARVEST items. Never merge or push.
