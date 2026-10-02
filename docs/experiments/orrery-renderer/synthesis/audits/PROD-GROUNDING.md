# Orrery V2 (38.7) — Production Grounding

Grounded against `main` @ `34920925` on 2026-10-02. I read the files on disk; I edited, built and committed nothing. File:line references were checked by opening the file. Where a claim came from a subagent, I spot-checked its key lines myself (marked "verified").

---

## 1. Current production Orrery inventory

### 1.1 Files and roles

**Screen / composition**
| File | Role |
|---|---|
| `src/screens/OrreryScreen.tsx` (1346) | The orchestrator. It owns the System store instance, switch runtime, camera pose SharedValue, focus, cluster and satellite state, the focus/AppState lifecycle, the Home-framing effect, Recenter/Reset-north, and the HUD (selector, view options, controls, focus card, cluster panel, contacts sheet). |
| `src/components/orrery/OrreryWorld.tsx` (614) | The renderer root. It holds one `useDerivedValue` frame (choreography sample → reorder preview → moons → single projection), the label Paragraph prep, label allocation, the gesture build, and the Skia layer tree (rings → Polaris → reorder ghost → body batch → labels). |
| `OrreryCanvas.tsx` | The mountable `<Canvas>`. It has the solid `Fill` background, 44 seeded twinkling stars, and the single `useClock()` behind `OrreryClockContext`, all inside `GestureDetector`. |
| `orrery-clock-context.ts` | Context that carries the one ambient clock to `SunBody`. |
| `OrbitBody.tsx` | Contact body: photo or initials disc, status fill/outline, billboarded from the frame. It builds an initials Paragraph per mount. |
| `SunBody.tsx` | Sun: photo or self-star colour, a glow pulse from the clock (static under reduced motion), and an initials Paragraph. |
| `SatelliteBody.tsx` | Moon body inside the body batch. |
| `ProjectedOrbitRing.tsx` | Per-contact ring path from `frame.bodies[].ringPath`. It is styled by `orreryRingStyle`. |
| `Polaris.tsx` | The world-north marker. Tapping it resets yaw. |
| `OrreryLabel.tsx` | Screen-space Paragraph label/caption drawn at an allocated slot. |
| `use-orrery-camera.ts` (532) | The UI-thread camera and input owner. Gestures: pan, pinch, rotation, two-finger tilt, tap, hold-reorder, and coast/recover. |
| `use-orrery-switch-runtime.ts` (421) | Screen-owned switch runtime: `transition`/`progress`/`cameraFrom`/`cameraTo` SharedValues plus the keyed `resources[]` that survive canvas unmount. `NORMAL_SWITCH_DURATION_MS = 2100` and `REDUCED_SWITCH_DURATION_MS = 180` (`:25-26`). |
| `orrery-switch-animation.ts` | Membership delta and intensity math, plus the `shouldPublishSwitchScene` guard. |
| `use-orrery-photo.ts` | Downsampled, on-disk-derivative Skia image loader for bodies and the sun (38.6 D-11/D-41). |
| `orrery-satellite-context.ts` | Moon name and relation text (presentation only). |
| `OrreryFocusContext.tsx` | The glass focus card (`GlassSurface treatment="orrery-overlay"`). Its position is a UI-thread animated style **below the body** (`top = body.y + body.radius + SPACING.sm`, clamped, `:46-72`). It shows the name, Clear focus, Open Profile, and the focused person's moon list (`relationshipContext`, `OrreryScreen.tsx:1109-1131`). |
| `OrreryClusterPanel.tsx` | The ambiguous-tap cluster list panel. |
| `OrreryContactsSheet.tsx` | The conventional, non-canvas list of the same System ("Focus in Orrery: X" / "Open Profile: X"). This is the a11y path. |
| `OrreryControls.tsx` / `orrery-controls-logic.ts` | The Contacts, Recenter and Reset north buttons, with obstacle-aware placement. |
| `OrrerySystemSelector.tsx` / `orrery-companion-logic.ts` | The Choose System switcher (catalog order, counts, attention). |
| `OrreryViewOptions.tsx` | The density and satellites toggle panel. |
| `OrreryFeedback.tsx` / `orrery-feedback-logic.ts` | Canvas and sheet notices (E9 copy). |
| `OrreryObstacle.tsx` / `orrery-obstacle-logic.ts` | HUD rectangles published as camera obstacles (the usable rect). |
| `orrery-overlay-logic.ts` | Close-before-action ordering. |
| `SystemPreviewCanvas.tsx` / `system-preview-logic.ts` | The simplified Preview renderer for unsaved System drafts (Phase 30). |
| `ManageMembersGrid.tsx`, `manage-members-logic.ts`, `system-builder-logic.ts`, `SystemRuleAccordion.tsx` | System authoring HUD (Phase 30). Not part of the renderer. |

**Pure logic (`src/logic/`)**
| File | Role |
|---|---|
| `orrery-world-logic.ts` | `deriveOrreryWorld`: dense rank → ring, progress → angle, **decay/rogue drift push**, collision nudge, gravity mass, extent. Contains `DENSITY_PRESETS`. |
| `orrery-geometry-logic.ts` | Constants (`SUN_RADIUS`, `PLANET_RADIUS=16`, `HIT_RADIUS`, `DECAY_DRIFT_SPAN=40` `:63`, `ROGUE_DRIFT_SPAN=80` `:65`), `progressToAngle`, `polarToXY`. Also the legacy Phase-13 `drawnRadius`/`driftPush`/`hitTest`/`deriveOrreryMetrics`, which have **no non-test consumer**. |
| `orrery-camera-logic.ts` | `CameraPose {x,y,zoom,tilt,yaw,focalDistance}`, `HOME_CAMERA` (tilt 0, `:60-67`), `MAX_TILT = π/3` (`:72`), `deriveHomePose` (`:254-280`), project/unproject, `projectFrame` (128 ring points per body, `:490-537`), hit candidates, `tapIntent` (1 hit → focus, or profile at zoom ≥2; >1 hit → "group"). |
| `orrery-frame.ts` | `bodyKey`, world-transition interpolation, `projectAnimatedFrame`, `billboardPose`. |
| `orrery-switch-choreography.ts` | Accelerate/shed/capture/settle phases (`:4-13`), role trajectories, sample, retarget. |
| `orrery-recovery-logic.ts` | Distance-adaptive recovery (180–850 ms; reduced 100), coast (`COAST_MS=120`), Polaris hit, `northTarget`. |
| `orrery-gesture-logic.ts` | Input ownership thresholds: pan 10, tap 8, hold 850 ms, tilt 28 pt at 0.004 rad/pt. |
| `orrery-label-logic.ts` | `SemanticLevel` overview/identity/detail with hysteresis (`IDENTITY_ENTER=2`, `DETAIL_ENTER=3`), `orreryInitials`, `allocateLabels`, `labelContext`. |
| `orrery-satellite-logic.ts` | `deriveSatelliteBodies` (none at overview, `:31`; `MOON_RADIUS=4`, `PARENT_GAP=24`), `resolveSatelliteTap`. |
| `orrery-focus-logic.ts` | Identity targets, tap resolution, focus controller, `focusEffectivelyOffscreen`. |
| `orrery-reorder-logic.ts` | Hold-to-reorder: begin/move/release/preview (radial, snapshot-bound, contacted-only). |
| `orrery-ring-logic.ts` | Status → ring style (solid/dashed/faded/faintTrace) and body fill. It reuses `ringVisual`. |
| `orrery-session-logic.ts` | Memory-only camera restore across navigation. |
| `orrery-system-logic.ts` | `OrrerySystemRef` (builtin/category uid/custom uid), `systemRefId`, `parseSystemRef`. |

**Read model / data**
| File | Role |
|---|---|
| `src/services/orrery-scene.ts` | `loadOrreryScene` → `OrrerySceneSnapshot` (`:41-60`, `:210-257`). Also the satellite and scene controllers and the intent dispatcher. |
| `src/db/orrery-system-read.ts` | `readOrrerySystemSnapshot`: membership (builtin, category or custom resolver), dense order, sun identity, impact inputs. |
| `src/db/orrery-read.ts`, `orrery-impact-read.ts`, `orrery-satellites-read.ts`, `orrery-action-read.ts` | Orbiting scan, Gravity inputs, moons (relationship people), and fresh-identity validation for actions. |
| `src/db/systems-dao.ts`, `systems-catalog-read.ts`, `systems-members-read.ts` | Phase-30 System CRUD, catalog and counts, and the member editor. |
| `src/db/app-settings-dao.ts` | `orrery_density`, `orrery_satellites_enabled`, `orrery_last_system`. |
| `src/stores/orrery-system-store.ts` | Zustand factory: select/reload, generation guard, status initial/loading/ready/stale/error. |
| `src/stores/orrery-preferences-store.ts` | Persisted density, satellites and lastSystem, with cross-surface origin. |
| `src/stores/orrery-session-store.ts` | Memory-only route session. |

**Tests (selected)**: there are colocated `*.test.ts` files for every logic file, plus `orrery-render.test.tsx`, `orrery-frame-mapper.test.ts` (its worklet capture map), `orrery-worklet-boundary.test.ts`, **`orrery-worklet-order.test.ts`** (the TS-checker forward-reference guard, D-19/T-38.4-02-01), `orrery-switch-runtime.test.ts`, `orrery-switch-choreography.test.ts`, `orrery-scene.test.ts`, `orrery-exploration.integration.test.ts`, `src/screens/orrery-screen-framing.test.ts`, and the db read tests.

### 1.2 Data flow

```
SQLite ─ readOrrerySystemSnapshot (orrery-system-read) ─┐
        + impact/gravity inputs, settings, sun          │
                                                        ▼
loadOrreryScene (services/orrery-scene.ts:210) ─ deriveSceneGeometry → deriveOrreryWorld (world-logic:83)
        → OrrerySceneSnapshot {world: WorldBody[], extent, contacts, gravity, sun, systemSnapshot}
                                                        ▼
createOrrerySystemStore (stores/orrery-system-store.ts) select/reload, generation-guarded
                                                        ▼  subscribe (OrreryScreen.tsx:305-345)
useOrrerySwitchRuntime.publish(snapshot, inSession, intensity, destinationHome)
        → transition SV (beginSwitchChoreography) + progress withTiming 2100 ms + resources[]
                                                        ▼
OrreryWorld frame = useDerivedValue (OrreryWorld.tsx:222-262):
   sampleSwitchChoreography(transition, progress).world
   → sampleOrrerySwitchCamera / pose.value
   → previewReorder(held drag)
   → deriveSatelliteBodies(level)
   → projectAnimatedFrame → ProjectedFrame {pose, viewport, bodies[x,y,radius,hitRadius,ringPath,depth,opacity,interactive]}
                                                        ▼
camera.frame.value = frame (useAnimatedReaction :264-269). Consumers: FocusContext, controls, gestures/hit-test.
Renderer: ProjectedOrbitRing / OrbitBody / SunBody / SatelliteBody / Polaris / OrreryLabel each read frame.value by bodyKey.
```

### 1.3 Behaviours

| Concern | Today (where) |
|---|---|
| Lifecycle pause | `visible = measured && isFocused && appActive` (`OrreryScreen.tsx:610`). `OrreryWorld` (and so the Canvas and clock) mounts only when `visible && sessionReady && scene` (`:1048`). AppState background calls `pauseSwitch()`, captures the session and cancels the intent (`:416-424`). Each focus calls `hydratePreferences`, then `useSystemStore.reload()` (`:427-435`), so **every tab return re-reads the scene** (consistent with the "slow to reload after tab return" observation). |
| Reduced motion | `useReducedMotionShared()` SharedValue. Star twinkle collapses to a constant (`OrreryCanvas.tsx`). The sun pulse is static (`SunBody.tsx:117-130`). Switch duration is 180 ms with a crossfade-like path (`use-orrery-switch-runtime.ts:266-274`). A mid-switch toggle retargets (`:363-383`). Recovery is 100 ms (`REDUCED_RECOVERY_MS`). |
| Semantic zoom / labels | `semanticLevel(zoom)` overview <2 ≤ identity <3 ≤ detail, with hysteresis. Labels are prepared for **every** body on the JS thread (`OrreryWorld.tsx:276-339`) and allocated on the UI thread each frame (`:363-392`). |
| Focus | `tapIntent`. Single focus zooms to `min(IDENTITY_ZOOM, framing)` (`OrreryScreen.tsx:957-961`). The card docks **below** the body and follows it (`OrreryFocusContext.tsx:46-72`). Focus is lost when it goes offscreen. There is no dimming of other bodies. |
| Cluster | More than one hit gives a `"group"` intent, which opens `OrreryClusterPanel` (a list). It **does not zoom into the cluster**. |
| Satellites | Hidden at overview. At identity zoom and above they appear as separate 4-unit moons offset from the parent. They are listed in the focus card (already, `OrreryScreen.tsx:1109-1131`). The gate is `preferences.satellitesEnabled`. |
| Switch choreography | Phases accelerate 0–0.2 / shed 0.18–0.58 / capture 0.44–0.82 / settle 0.72–1 over 2100 ms. Interaction is ready at progress 0.82. The camera interpolates from the displayed pose to destination Home (`OrreryScreen.tsx:327-339`, `:940-950`). |
| Reorder | Long-press 850 ms on a contacted body, then a radial drag snaps to ring slots (`orrery-reorder-logic.ts`), shown by `ReorderGhost` (accent path). Commit goes through `onReorder` → ring_seq write. |
| Camera / Home | `deriveHomePose` returns `HOME_CAMERA` (x0, y0, **tilt 0**, yaw 0) with zoom = `min(1, max(readability floor, fit))`. Recenter and System switch both land on it (`OrreryScreen.tsx:997-1005`). The user can tilt up to `MAX_TILT = 60°` with a two-finger vertical drag. |
| A11y | The canvas exposes nothing. The accessible route is the HUD buttons (`OrreryControls.tsx:101-140`), then `OrreryContactsSheet` (Focus in Orrery / Open Profile per member), then `OrreryFocusContext` buttons. |

### 1.4 Renderer seams and what V2 keeps vs. may replace

| Seam | Contract a new renderer plugs into |
|---|---|
| **S1 Scene** | `OrrerySceneSnapshot` from `loadOrreryScene`. V2 should consume it as-is, with no new SQL. |
| **S2 World** | `deriveOrreryWorld` → `WorldBody{id,kind,x,y,radius,ringRadius}`. **D12 changes this**: drop `push` (see §2). |
| **S3 Frame** | `ProjectedFrame`/`AnimatedFrame` from the single `useDerivedValue` in `OrreryWorld`, published to `camera.frame`. Gestures, focus card, offscreen detection and hit-testing all read it. A V2 renderer should be a new consumer of the same frame, replacing the `OrreryWorld` JSX subtree and `OrreryCanvas`. |
| **S4 Camera** | `CameraPose` SharedValue + `useOrreryCamera` + `deriveHomePose`/`HOME_CAMERA`. Making tilt tunable is a single constant: `HOME_CAMERA.tilt`. 62° is **above `MAX_TILT` (60°)**, and `clampCameraPose` (`:244`) would clamp it. `deriveFocalDistance` uses `MAX_TILT`, so raising it changes focal distance and depth budget everywhere. |
| **S5 Switch** | `useOrrerySwitchRuntime` (transition/progress/camera SharedValues) + `sampleSwitchChoreography`. The V2 warp/streak/swirl is presentation layered on `progress`. |
| **S6 Lifecycle** | The `visible` mount gate + the single `useClock` in the Canvas. New idle motion must hang off the same clock and reduced-motion SharedValue. |
| **S7 HUD** | FocusContext, ClusterPanel, ContactsSheet, Controls and Selector are RN views over the frame and can stay. |

**V2 must keep (semantics):** dense rank → ring order (ADR-046); timestamp → angle (`progressToAngle`); status from query-time health (ADR-011); one canonical world with the camera separate (ADR-077); frame-driven hit-testing and identity guards (uid + generation); contacted-only reorder intent and its ring_seq write; System identity and membership and the switch-lands-at-Home + shared-focus preservation (Phase 30); single unmountable clock + focus/AppState pause; reduced-motion SharedValue gates; the conventional ContactsSheet a11y path; the worklet ordering guard.
**V2 may replace (presentation):** `OrreryCanvas` background/stars, body/sun/moon/ring drawing, the label renderer (with a cache), ring styling (solid/dashed/faded → B rings+rim, but status must still be colour-independent for a11y), choreography spectacle constants, the `ReorderGhost` look (→ charge arc + projected outline), focus card placement, and cluster behaviour.

---

## 2. Recorded decisions V2 touches

This section was gathered by a read-only crawl subagent. I re-opened and confirmed the load-bearing quotes myself: HANDOFF.md:192-196, ADR-077:18, ADR-149:18, ADR-114:18, phase-08:68/300-306/468-470/568, 09-orrery.md:99-104, systems/orrery.md:71/77, phase-02:309-315, 38.5 dossier:200-203/640. Phases 29 and 30 have no DISCUSSION-LOG files; only the CONTEXT shims and 29-UI-SPEC exist. **Every REVERSES row is an owner-bucket item: record it as an explicit supersession, D-NN plus a new ADR, not as a bug fix.**

### 2.1 Decision table

| Topic (owner pick) | Recorded decision (file:line — quote) | V2 verdict |
|---|---|---|
| **Tilted Home ~62° as one tunable (D3 ⚠)** | phase-08:68 "**[DECIDED]** Default/Home view is top-down, centered on the sun, with canonical north at the top." · phase-08:300-306 "Recenter restores the complete canonical camera state: … top-down tilt" · 29-UI-SPEC:106 "Home is sun-centered, top-down and north-up." · systems/orrery.md:77 "Recenter clears focus/group and restores all Home axes" · :71 "tilt 0–60 degrees" · phase-08:76 tilt bounded, no "near-edge-on extremes" | **REVERSES** top-down Home. Recenter still restores "all Home axes", only now Home has a non-zero tilt (AMENDS that). Code: `HOME_CAMERA.tilt: 0` (`orrery-camera-logic.ts:64`). **62° > `MAX_TILT = π/3` (60°, `:72`)** and is clamped at `:244`. Either use ≤60° or raise MAX_TILT, which changes `deriveFocalDistance` (`:91-99`) and the phase-08:76 bound. phase-09:311 "Preview does not initially expose tilt/yaw": decide whether the Preview canvas also tilts. |
| **Painted sky + per-System hue (D7 ⚠, D8)** | ADR-114:18 "only the actual Orrery route forces None/Solid" · ADR-179:21 / 38.5 D-54 (dossier:640) "The Orrery keeps its solid background." · 38.5 D-12 (:200-203) "The Orrery route's art stays out of scope (it forces `none`)" · **but** phase-02:309-315 "**[DECIDED]** Orrery … gets a specialized visualization background. It does not have to use the same ordinary selected background." / "may use stronger glow, edge-to-edge rendering, more motion" | **AMENDS/REVERSES (owner).** The ADRs govern the app-wide *BackgroundHost art*. An in-canvas painted sky can keep `none` for BackgroundHost and still be in line with phase-02's "specialized visualization background". The literal "solid background" wording in ADR-179/D-54 is still reversed, though, so this needs an owner ruling and a superseding ADR. Prod today already paints more than a solid colour: `Fill` + 44 twinkling stars (`OrreryCanvas.tsx`). |
| **Subtle light pulses along orbits (D10 ⚠)** | ADR-077:18 (and ADR-048:18) "the subtle starfield and sun pulse remain the **sole ambient animation** with a single unmountable owner" · 09-orrery.md:68-72 "No continuous animation loop … starfield … remain the only moving things" · HANDOFF.md:195 "**[REJECTED]** Differentiated per-band animation … Motion encodes data, not mood" · phase-02:160 / phase-08:32 "Orrery remains the visually expressive motion-heavy surface" | **REVERSES** the "sole ambient animation" clause (ADR-077/048, 09-orrery). The HANDOFF rejection is about *per-band body* motion that destroys position. Pulses on rings that leave bodies static do not re-propose that, but they do contradict the "not mood" principle, so the owner must name it as a deliberate exception. **Must keep:** the single clock owner (ADR-048:32, ADR-077:40) and the ADR-085 reduced-motion gate. |
| **Contacts on their orbit line; status = ring colour + angle (D12 ⚠)** | HANDOFF.md:194 "**[DECIDED]** Status is encoded without altering motion. Colour on body and ring …, ring style (solid → dashed → faded), and **decayed contacts drifting outward past their assigned ring** so 'out of orbit' becomes literal while they stay on rails and stay tappable." · 09-orrery.md:99-104 "**[DECIDED]** `rogue` renders as maximum drift + a cold/extinguished body … drift-outward simply goes further." · ADR-046:18 "derives … status, progress, and bounded drift at read time" · systems/orrery.md:30 "bounded drift" | **REVERSES** the drift half of HANDOFF §7 and 09-orrery Cluster C, plus ADR-046's drift clause. **ENFORCES** HANDOFF:192 (angle = progress), on-rails/tappable, and the ring colour/style ladder (if B's RINGS+RIM drops dashed/faded, that is a further AMEND of the ladder; keep a non-colour cue for a11y). |
| ADR-149 glass + AA (D20, D28) | ADR-149:18 "`orrery-overlay` … Galaxy 0.91 / Standard 0.87 … **AA-proven against the brightest raw Orrery star**" · ADR-169:18 "each foreground [must] clear its floor at both extrema" · 38.5 D-12 (:200) "every Orrery control and menu keep a full scrim in every combination" | **ENFORCES** the glass. The AA proof is **invalidated by a painted sky**, so redo it with the ADR-169 both-extrema method over the brightest sky/nebula/star pixel in all four package×mode combinations (this is D28's hard gate). Contradiction: D-12 says "full scrim" while ADR-149 is translucent; the owner should clarify. |
| Focus card placement (D19) | 29-UI-SPEC:93 (E7) "Screen-facing, near their focused body … Minimal identity/context rather than a miniature Profile" · phase-08:225-230 focus "animates the camera to the identity inspection level … stops at the name-visible level rather than automatically diving" | **AMENDS.** Prod *already* docks the card **below** the body (`OrreryFocusContext.tsx:66-71`). "Card above" is lab A only. "Person centred and large" goes past the identity zoom cap (`OrreryScreen.tsx:960` caps single focus at `IDENTITY_ZOOM=2`; at ≥2 a tap becomes "profile" per `tapIntent`, `orrery-camera-logic.ts:587`). A larger focus zoom changes the tap-to-Profile threshold: this is an owner-visible AMEND. |
| Dim others + reticle (D18, D21) | phase-08:228/254 "highlights the contact"; 29-UI-SPEC:73 accent reserved for "focus outline separate from status" | **AMENDS** (no ban on dimming). The reticle must use the accent. Dimming must not wash out status hue on the focused body. |
| Satellites/moons (D17) | phase-08:469 "**[DECIDED]** far overview → hidden" · :472-474 "focused parent → reveal its satellites"; "much smaller/visually subordinate" · ADR-105:18 / 29-CONTEXT D-11 unlinked-only; nonmember sun gets no moons | **REVERSES** "far overview → hidden" (a bump at far zoom). The rest is ENFORCED. Code: `deriveSatelliteBodies` returns `[]` at overview (`orrery-satellite-logic.ts:31`). **D17 "NEW: focusing lists their moons" already exists in prod**: the focus card renders the focused member's satellite rows (`OrreryScreen.tsx:1109-1131`) when satellites are enabled. Lab parity, not new. |
| Reorder (D23) | phase-08:345-349 "intentionally prolonged stationary hold … clear visual/haptic acknowledgement" · orrery.md:73 "850ms stationary hold … highlight/ghost and haptic" · 29-RESEARCH:262 "subtract canonical outward drift before rank comparison" | **AMENDS** (new visual; the hold and semantics stay). The drift subtraction (`orrery-reorder-logic.ts:73`, `:138`) collapses to 0 once D12 ships. |
| Switch choreography (D24) | phase-08:568 "**[DECIDED FOR LATER SYSTEMS PHASE]** … **spin + shedding/capture** … rather than a **wholesale light-speed scene replacement**" · phase-09:462-479 adaptive to membership delta, "must not unnecessarily lock out interaction" · 30-CONTEXT D-11 owner-specified staged choreography, approved on the Pixel · phase-09:450 lands at canonical Home | **REVERSES** the explicit "not light-speed" choice if B's star warp replaces the scene. **AMENDS** if the warp is a sky/star overlay while bodies still spin/shed/capture by membership delta (A's planets streaking around their orbits is spin-like). Keep: delta-adaptive intensity, land at Home, interaction ready by `INTERACTION_READY_PROGRESS = 0.82`, and the 2100/180 ms durations as tunables (`use-orrery-switch-runtime.ts:25-26`). |
| Cluster tap zooms in (D19 NEW) | phase-08:250-257 "**[DECIDED]** Cluster Focus frames the group and exposes a conventional floating bottom contact panel … lists the contacts" · 29-UI-SPEC:92 (E6) | **ENFORCES** (framing the group is already decided). Prod frames focused bodies via `frameBodies` (`OrreryScreen.tsx:953-957`) *and* opens `OrreryClusterPanel`. Check on device whether the framing zoom is sufficient. **REVERSES** only if the panel is dropped. |
| Per-System identity/hue (D8) | `022-orrery-systems.ts:10` `uid TEXT NOT NULL UNIQUE`; `001-initial.ts:44` categories `uid … UNIQUE`; `systemRefId` (`orrery-system-logic.ts:58-66`); backup contract:24 "`uid` is the durable custom identity"; ADR-142 portable Category UIDs | **ENFORCES.** A stable id exists. Derive the hue from `systemRefId` through themed tokens (ADR-022 swatch-index pattern). No schema change. Caveat: Duplicate mints a new uid (phase-09 §S), so a duplicated System gets a different hue. |
| Theme tokens | ADR-006:18 "Every colour resolves through theme tokens … `check:colors` fails the build"; ADR-084 contrast gate | **ENFORCES.** Sky, nebula, hue and pulse colours become palette tokens (per package×mode), including in Skia. |
| Reduced motion | ADR-085:18 "Skia ambient consumers read the shared value inside derived worklets and collapse their motion" · phase-08:519-531 · phase-09:491 switch → "simpler crossfade/reposition" | **ENFORCES.** Pulses, drifting sky, twinkle, warp, streak and swirl must all collapse via `useReducedMotionShared`. The switch keeps the 180 ms crossfade. |
| Portrait lock | `app.json:6`, `app.config.ts:69` `"portrait"`; phase-01:460 | **ENFORCES** |
| One-finger pan (D4) | systems/orrery.md:73 "One finger pans" | **ENFORCES** |
| Coast (D5) | prod has `COAST_MS=120`, `PAN_COAST_POINTS=18` (`orrery-recovery-logic.ts:16-17`); reduced motion disables inertia (phase-08:519-531) | **AMENDS** (tune it up; the owner said none was perceptible) |
| Elliptical orbits | HANDOFF.md:196 "**[DECIDED]** Elliptical orbits wider than the viewport" was silently replaced by circular rings plus the camera (no recorded supersession) | Flag it: V2's orbit geometry should note this as already superseded in practice. |

### 2.2 Every consumer of drift / `push` (D12 blast radius)

| Kind | Location |
|---|---|
| Producer | `orrery-world-logic.ts:61-72` `drift()`; `:95` `push`; `:96-99` reference radius (+push, used for the collision test); `:119-122` widest radius (+push, used for the nudge bound); `:136` body position `ringRadius + entry.push`; `:140-148` extent (`hypot(x,y)` includes the push) |
| Constants | `orrery-geometry-logic.ts:62-65` `DECAY_DRIFT_SPAN=40`, `ROGUE_DRIFT_SPAN=80`. Legacy `drawnRadius`/`driftPush`/`DRIFT_MAX`/`deriveOrreryMetrics` (`:137-178`, `:237-262`) have **no non-test consumer** (Phase-13 leftovers) |
| Downstream by position (inherit drift through `x,y`) | hit-testing `collectHitCandidates` (`orrery-camera-logic.ts:539-561`); label anchors `OrreryWorld.tsx:366-375`; focus card position `OrreryFocusContext.tsx:46-72`; offscreen detection `orrery-focus-logic.ts:119`; Home fit via `worldExtent` (`orrery-camera-logic.ts:101-110`) and `deriveHomePose`; moon parent offset `orrery-satellite-logic.ts:43-60`; switch choreography radial shed/capture (`orrery-switch-choreography.ts:308`, `:341`); scene extent (`orrery-scene.ts:106`) |
| Reorder | `orrery-reorder-logic.ts:73` `drift: hypot(center) − ringRadius/zoom`; `:93` subtracts it; `:131-145` `previewReorder` keeps "each body's actual drift" |
| Tests | `orrery-world-logic.test.ts:69-110` (rogue members; nudge bounds use `hypot`); `orrery-geometry-logic.test.ts:104-159`, `:271-272` (legacy drift); reorder tests on drift (`orrery-reorder-logic.test.ts`) |
| Docs | HANDOFF.md:194 · 09-orrery.md:45, :55, :99-104, :186-188, :273-275, :374 · dossier INDEX.md:236 · workpapers/01-data/overlap-read-side.md:375-379, :517-523 · ADR-046:18, :46 · systems/orrery.md:30 · 29-RESEARCH.md:63, :262 · 29-09-PLAN.md:49 · v1.0 13-orrery plans/summaries |

### 2.3 Orrery-related ADRs

| ADR | Title | Status |
|---|---|---|
| 011 | Query-Time Status and Never-Contacted Segregation | live |
| 022 | (tokenized swatches) | live; pattern for the hue |
| 026 | Rogue Status for Unresponsive or Far-Overdue Contacts | live |
| 027 | Derived Profile-Only Gravity and Intensity | **partially superseded by ADR-106** |
| 042 | Shared Status Palette for Dashboard and Widget Rings | live |
| 046 | Query-Time Orrery Placement and Transactional Ring Ordering | live (the drift clause is reversed by D12) |
| 047 | App-Level Assignable Sun and Themed Self Identity | live |
| 048 | Status-Default Static Orrery with a Single-Canvas Morph | **partially superseded by ADR-077** (dual view/morph); static placement and the single clock remain live |
| 077 | Single Canonical Orrery with a Constrained Inspection Camera | live ("sole ambient animation" reversed by D10) |
| 085 | Live Reduced-Motion Signal for Skia Ambient Animation | live |
| 087 | Bundled Background Presets and Package-Specific Surface Treatment | **partially superseded by ADR-115, ADR-177** |
| 104 | Durable Orrery Preferences and Live System Scope | live |
| 105 | Scoped Relationship Satellites for System-Member Context | live |
| 106 | Derived Orrery Gravity Visual Mass and Accessible Context | live (supersedes part of 027) |
| 113 | Persistent Shared System Background Selection | live; partly overridden by 38.4 D-39 (ADR-177:25) |
| 114 | Route-Aware App-Wide System Background Composition | live (Orrery forces None/Solid) |
| 115 | Visible Mode-Aware Background Surface Composition | **partially superseded by ADR-177** |
| 142 / 143 / 144 | Categories: stable identity / atomic deletion & System fallout / grouped System selector | live |
| 149 | Orrery-Specific Translucent Overlay Treatment and Icon Controls | live (the AA proof must be redone over the sky) |
| 169 | Standard-Light Glass Foreground Scope, Both-Extrema Contrast Proof, Accent Role Contract | live (the AA method) |
| 170 | Bounded Your Week Reads and Settled Orrery Resource Retirement | live (governs `orrery-switch-choreography.ts`, INFERRED) |
| 177 / 179 | Mode-Specific Background Art / Owner-Ruled Art Treatments | live (179 = "Orrery keeps its solid background") |

Graph edges (via `npm run graph:ask -- governs`):
- `orrery-world-logic.ts`: EXTRACTED cites of ADR-011/027(⚠ superseded partially by 106)/046/077, plus an INFERRED edge to 106.
- `orrery-camera-logic.ts`: EXTRACTED cite of ADR-077.
- `OrreryCanvas.tsx`: INFERRED edges to 048(⚠ partial by 077)/077/085.
- `orrery-switch-choreography.ts`: INFERRED edge to 170.


---

## 3. Main-line bugs the labs reported (verified on main @ 34920925)

The lab write-ups are in the lab worktrees, not this repo: `/home/bwales/projects/orbit-orrery-lab-{a,b,c}/docs/experiments/orrery-renderer/…` (Lab B `HARVEST.md` §A, `OWNER-REVIEW.md`). `docs/orrery-investigation/` (untracked) only holds `ORRERY-EXPERIMENT-CONTRACT.md`.

| Bug | On main? | Where | Root cause (one sentence) | Lab fix |
|---|---|---|---|---|
| (a) 3–7 s switch freeze | **Yes** | `OrreryWorld.tsx:222-262` (frame worklet captures `switchRuntime`, `scene.systemSnapshot.members`); `use-orrery-switch-runtime.ts:168` (each resource holds the whole `scene`), `:401-411` (fresh runtime object every render) — verified | The frame worklet closes over the runtime and its `resources[]`, each carrying a full scene snapshot, and the runtime object is recreated on every render, so each render during a switch re-serialises the whole graph onto the UI runtime. | Lab B `ea137306` (H-A1); Lab A `842f1f36`+`ba3cef68` (M1): capture only SharedValues/small ids, memoise runtime |
| (a') O(N²) lookups | **Yes** | `orrery-frame.ts:51-60` (`beginWorldTransition` `some`/`find` per key) and `:209` (`billboardPose` `find` per body per frame); `OrreryWorld.tsx:280`, `:366`; `ProjectedOrbitRing.tsx:18,30`; `OrreryLabel.tsx:85`; `use-orrery-switch-runtime.ts:178-179`; `orrery-satellite-logic.ts:40-46`; `orrery-reorder-logic.ts:65,134`; `orrery-world-logic.ts:111-118` (collision `some` in `map`, JS side) — verified | Every per-body consumer does a linear `find` by `bodyKey` over all bodies each frame, and `projectFrame` projects 128 ring points per body each frame (`orrery-camera-logic.ts:513-528`). | Lab B `83c9033a` (`byKey` index; H-A3), `89c2f1dd` (hoist; H-A4); Lab A `ba3cef68` (`projectWithBasis`) |
| (b) 800+ body crash | **Yes (code path)** | `OrreryWorld.tsx:276-339` (`prepareOrreryText` up to 2× per body in a memo); deps include `clusterIds`, which `OrreryScreen.tsx:1063` passes as a fresh `[]` every render | Every scene, focus or screen render rebuilds 1–2 Skia Paragraphs per body (~1,900 at 940 bodies), which coincides with a Hermes SIGSEGV in `JsiHostObject::get`. Lab B says the cause is **inferred, not proven**. | Lab B `83c9033a` `textCache` keyed role|width|text (H-A2); also give `clusterIds` a stable empty default |
| (c) Initials "El…" | **Yes** | `orrery-label-logic.ts:22` `if (typeof Intl.Segmenter !== "function") return name;` → `OrbitBody.tsx:92-103` paragraph `maxLines:1, ellipsis:"…"` laid out at disc width — verified | Hermes lacks `Intl.Segmenter`, so the whole name goes into a one-line disc paragraph and gets ellipsised. | Lab A `c862c30a`+`864f7e04`: code-point fallback. **Caution:** the full-name fallback was a deliberate Phase-29 choice (`29-05-SUMMARY.md:93`, EDGE-14: no UTF-16 slicing / partial emoji). The fix amends a planning-record decision, so flag it to the owner. |
| (d) "Unavailable System" after cold start | **Yes** | `OrreryScreen.tsx:466` cold restore `select(system, undefined, false)`; `orrery-system-store.ts:95-104` name resolves only builtin/category; `:122-131` post-load `currentName` category-only — verified | A cold start into a custom System passes no name and the store never resolves custom names from the catalog, so the label stays "Unavailable System". | Lab C `f608d35d` (lab branch only): set `requested.name` from the loaded catalog for custom refs |
| (e) Per-mount Paragraph/Builder pressure | **Yes** | `OrbitBody.tsx:88-106`, `SunBody.tsx:135-153`, `OrreryLabel.tsx:42-54` (`Skia.ParagraphBuilder.Make` per mount/rebuild; no cache, no `dispose`) — verified for OrbitBody | Every body and label builds its own builder and Paragraph (about 1 MB of Hermes external memory each, per Lab C), which drives GC churn (Lab C measured 1569 MB external at mount, 50–100 GC/s). | Lab C `e4d9e842`: shared builder per font provider + `OrreryTextCache` with disposal (1569 → 297 MB) |

Related open item: `.planning/todos/pending/2026-09-29-orrery-anr-choose-system.md` (38.5 D-51 "G1-LATER"). It records two ANRs (UI thread, 5 s) opening Choose System on a Pixel 3a debug build, not yet investigated. It is plausibly the same family as (a)/(b). V2 should absorb or close it.

None of the before/after freeze numbers were measured on main; they all come from lab builds running the shared legacy code path.

---

## 4. Constraints for 38.7

| Constraint | Fact |
|---|---|
| Migration head | **032** (`src/db/migrations/032-import-batch-cadence.ts:24`, `TARGET_VERSION = IMPORT_BATCH_CADENCE_SCHEMA_VERSION` = 32, `src/db/database.ts:70`). Any new migration is 033, re-verified on disk at plan time. |
| V2 schema need | **None needed.** Per-System hue can be derived deterministically from the stable id `systemRefId()` (`orrery-system-logic.ts:58-66`): `builtin:<id>` (fixed tokens), `category:<uid>` (`categories.uid TEXT NOT NULL UNIQUE`, `001-initial.ts:44`), `custom:<uid>` (`systems.uid TEXT NOT NULL UNIQUE`, `022-orrery-systems.ts:10`). A schema change (migration 033 + a backup decision) is needed only if the owner wants a **user-pickable or persisted** hue. Tilt, sky and pulses are constants. If a user setting is wanted, `app_settings` has Orrery prefs, but that is still a migration. |
| Backup format | `BACKUP_FORMAT_VERSION = 7` (`src/backup/types.ts:14`). No bump is expected. A bump is an owner decision. |
| Devices | Pixel 6 Pro + Pixel 3a are both test phones; resolve the target at run time (`emu-connect`, `adb devices`). In recent dossiers (38.5/38.6) the pattern is debug builds for iteration, then **one release build** for owner sign-off on both phones. Perf and memory claims count only on a physical phone, release build (38.6 D-11 memory was measured on the phone). The owner's Pass-1 perf baseline was taken on release builds on both phones. |
| Build pipeline | `docs/runbooks/desktop-build-pipeline.md`: build on `droid` over ssh with tar transport (no rsync on droid, never git push), then install on the phone. Orbit Metro runs on :8082 with `adb reverse tcp:8081 tcp:8082`. |
| Gates | `npm run check:colors` (`scripts/check-colors.sh`: no hex/rgb/hsl/named colour literals outside `src/**/theme/**`; this applies to Skia draws and any sky/nebula/hue palette, so put hues in theme tokens or derive them from tokens). `npx tsc --noEmit`: there is **no tsc npm script**, so run it explicitly in each post-merge gate. `npm test` (vitest). |
| Worklet forward-ref | A worklet that calls a same-file worklet defined *later* captures `undefined` and crashes on Hermes (fix f979263). Define helpers above their callers. Guarded by `src/components/orrery/orrery-worklet-order.test.ts` (TS-checker scan); add new V2 files to its scan scope. |
| Worklet capture | `orrery-frame-mapper.test.ts:104,115` currently **expects** `switchRuntime` and `scene` in the capture map. Bug (a)'s fix must update that test. |
| Hermes gaps | `Intl.Segmenter` is absent (bug c). `globalThis.crypto` is absent: there is no crypto use in the Orrery files today (grep is clean), so it applies only if V2 seeds randomness with crypto. Use the existing deterministic `seeded()` hash pattern (`OrreryCanvas.tsx`) instead. |
| Portrait lock | `app.json:6` `"orientation": "portrait"`; `app.config.ts:69`. |
| Portability | Android first; iOS and web planned (owner pick). Skia is portable; keep native-only APIs out of the renderer. |

---

## 5. Roadmap state and dossier conventions

| Item | `.planning/ROADMAP.md` |
|---|---|
| Phase 29 | `[x]` complete 2026-09-08 (line 147). UAT 8/9; the pinch/reorder crashes were fixed inline (f979263); H6 backup contention deferred to Phase 40. |
| Phase 30 | **Checkbox still `[ ]`** at line 148, but the details (line 546ff) say "12/12 plans executed … owner approval recorded 2026-09-09". The owner says it is done. This is roadmap drift: tick it when inserting 38.7. 30-11/12 restored the owner-approved staged spin/shed/capture choreography (ORRS-13). |
| Phase 38.6 | `[x]` complete 2026-09-30 (line 164). No migration (head 032), backup 7. |
| Next slot | **38.7 does not exist yet** (no ROADMAP, STATE or dossier hit). Insert it **by hand** between 38.6 (line 164 / §1325) and Phase 39, using the `(INSERTED)` convention. `gsd-tools phase insert` is unusable on the v2 roadmap. |

**Dossier conventions** (`docs/dossier/milestone-2/phase-38.6-photo-handling-dossier.md`):
- A header `**Status:**` paragraph records the insertion and discuss dates.
- `## Decision Legend` (`:8-16`): **[DECIDED]** owner-chosen; **[OPEN]** owner decision pending (discuss); **[DERIVED]** a consequence of a decision or a measured fact; **[PLANNING NOTE]** a repo finding to verify at plan time.
- **Numbering:** D-01..D-0N are the owner's insertion-time requests; discuss rulings continue from the next number; carried decisions are written "38.4 D-NN" or cite their dossier. Entry format: `-   **[DECIDED · 2026-09-29] D-51 --- SHORT-NAME.** text`, with an *(italic done-note + commit)* appended when executed.
- Section order: Objective, Owner Requests, Current State (grounding), Derived Constraints, OPEN, Discuss Rulings (subsections by date/stage: post-research, execution, device-pass), Engineering boundaries, Carried Constraints, Related Backlog/Todos Reviewed, Verification Expectations, **`## Revision Log`** (dated bullets, one per ruling batch).
- For 38.7 that means: D-01..D-30 = the owner's field-sheet picks (D1–D30 map directly), the ⚠ reversals recorded as explicit supersessions, and the lab bug fixes as [DERIVED]/[PLANNING NOTE].
