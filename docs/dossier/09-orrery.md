# Dossier 09 — `orrery` — Orbit view

**Status:** complete · Interrogated 2026-08-13 · 13 questions over 5 rounds · No `[OPEN]` items
remain (the `rogue` multiple and tunability, and design-pass cosmetics, are deferred, not open)

## Scope

The animated solar-system visualization (HANDOFF §7): a glanceable overview, explicitly
**not** the primary interface (that is the dashboard, domain 8, which is the home screen).
This domain has **no plugin predecessor** — it is entirely net-new. Its mechanics are largely
`[DECIDED]` in HANDOFF §7; this interrogation settles the remainder and, critically, absorbs
two things later domains handed it:

1. **The two-view orrery** the owner introduced during 04-log — a *relationship* view (radius =
   closeness, static) versus a *status* view (position tracks orbital state). No domain owned it.
2. **How `rogue` renders** and its **threshold shape** — 04-log exported both as `[OPEN → domain 9]`.

It also inherits, as settled constraints from upstream domains: `ring_seq` as a global radius
override (radius no longer encodes frequency — 01-data reversed HANDOFF §7 on this), the
assignable sun (01-data), never-contacted exclusion (01-data), the Skia-renders-photos pipeline
and the unresolved Skia `file://` question (07-photos), and the rule that the dashboard card's
rogue rendering *inherits* whatever this domain decides (08-dashboard).

Excludes: the status math itself (01-data), photo storage (07-photos), gravity/intensity
definitions (04-log), and the dashboard (08-dashboard).

---

## Decisions

### Cluster A — The two-view model

**[DECIDED] Both views ship in v1; the *status* view is the default.** Opening the orrery shows
the living status view (who needs attention); a control flips to the calm relationship map.
Rationale: matches HANDOFF §7's stated purpose for the orrery — a *glanceable overview* whose
first answer should be "who's due." The owner chose status-default over relationship-default and
over shipping only one view.
**[REJECTED] Relationship view as default** — leads with "the shape of my social world" rather
than urgency. **[REJECTED] A single view in v1** (either one) — defers the owner's own 04-log
concept and leaves closeness *or* decay-motion without a home this release.

**[DECIDED] The two views SHARE the radius axis (radius = closeness / `ring_seq` in both) and
differ only in motion and colour.**
- **Relationship view:** angles fixed, muted colour — a restful map of who is close.
- **Status view:** angle = interval progress with decayed bodies drifting outward past their
  ring (HANDOFF §7), full status colour.
The toggle animates bodies from fixed angles into their progress positions and colours them up.
Rationale: this is the closest reading of the owner's 04-log words ("radius is closeness and does
not move with decay" vs "position tracks orbital state"), carries a single radius model, and makes
the flip a genuine morph rather than a recolour.
**[REJECTED] Different radius axis per view** (status radius = urgency / danger-zone) — more
dramatic and a stronger triage view, but radius would mean two different things depending which
view you are in. **[REJECTED] Status view reviving frequency as radius** (Daily innermost →
Yearly outermost, the §7 default `ring_seq` displaced) — would have given frequency the visual
home 01-data said it lost, but status-radius-as-frequency competes with decay-drift for the radial
axis. *Consequence carried forward: frequency still has no radial encoding — see Cluster F.*

**[DECIDED] Switching is a toggle that morphs both layouts on ONE Skia canvas.** A segmented
control / button; tapping animates every body between the two layouts via a single `progress`
shared value (platform-verified idiomatic — P2). The morph is the delight moment and does not
compete with tap-to-freeze for the touch surface.
**[REJECTED] Swipe between views** — feels physical but competes with tap-to-freeze for gestures
and needs gesture composition. **[REJECTED] Two separate screens** — simplest mentally, but loses
the animated morph and adds a nav destination.

### Cluster B — Motion & interaction

**[DECIDED] No continuous animation loop. Bodies are placed from timestamp math each time the
orrery focuses; they sit still while looked at.** At HANDOFF §7's ~5°/day a body advances
~0.00006° per frame — imperceptible — so a live loop would burn battery animating motion nobody
can see. The toggle-morph (event-driven) and the starfield (if animated at all — see Cluster H)
remain the only moving things.
Rationale: honestly implements §7's own "deliberately near-static motion" and "they sweep round
as days pass" (days, not seconds), and removes the pause-on-blur complexity (P2: the Skia clock
has no built-in pause; a live loop would require conditionally unmounting `<Canvas>`).
**[REJECTED] A live creeping loop** — keeps motion literally continuous but pays battery and the
unmount-on-blur dance for invisible movement.

**[DECIDED — ⚠ REVERSES HANDOFF §7 by obsolescence] Tap-to-freeze is dropped.** §7 `[DECIDED]`
tap-to-freeze so "a moving body is never hard to hit." With no live loop nothing moves, so there
is nothing to freeze. The owner was shown this makes a §7 decision unnecessary and confirmed it.
This is a reversal-by-obsolescence, not a redesign: the *reason* §7 added freeze (moving bodies
are hard to tap) no longer exists.

**[DECIDED] Tapping a contact's planet opens that contact's profile directly.** The orrery is a
launcher, not a browser — the fastest path from "I see they're due" to acting, matching HANDOFF
§1/§6's reduce-taps premise.
**[REJECTED] A peek card in place** — keeps you in the orrery to browse but costs a second tap to
act. **[REJECTED] Select/freeze then open** — incoherent now that nothing moves.

**Consequence recorded:** HANDOFF §7's pause-on-`useIsFocused`/AppState requirement applies to
whatever actually animates. The contact bodies do not move, but Cluster H chose an animated
starfield **and** a pulsing sun — so an ambient animation layer exists and **pause-on-blur is
live**: conditionally unmount `<Canvas>` on `useIsFocused && AppState==='active'` (P2). Dropping
tap-to-freeze remains correct regardless — the bodies are static even while the ambient layer runs.

### Cluster C — Status-view encoding & `rogue`

**[DECIDED] `rogue` renders as maximum drift + a cold/extinguished body.** A rogue contact drifts
furthest outward past its ring (beyond decay's drift), the planet desaturates and darkens, and its
ring fades to a faint trace. It stays **on rails and tappable** (04-log's constraint; HANDOFF §7's
"floating free with no orbit lines" stays `[REJECTED]`). This extends §7's existing progressions
rather than inventing a vocabulary: the ring goes solid (stable) → dashed (wobble) → faded (decay)
→ faint trace (rogue), and drift-outward simply goes further.
**[REJECTED] A distinct rogue treatment** (dim planet + broken orbit trail) — more explicit
identity, but a new visual vocabulary to design and theme. **[REJECTED] An outer 'escaped' band**
collecting all rogues at the screen edge — good for triage, but overrides radius = closeness for
those contacts, which contradicts Cluster A.

**[DECIDED] The time path to `rogue` is a MULTIPLE of the contact's interval** (working figure
~2–3× overdue; the exact multiple is a tunable constant deferred to phase planning, per CLAUDE.md).
Scales per contact — a Daily contact goes rogue in days, a Yearly one in a year-plus — matching
each relationship's own rhythm. This resolves 04-log's `[OPEN → domain 9]` rogue-threshold *shape*;
the number stays a single-edit constant. The **separate** 'Rarely responds' path to rogue is
setting-driven (04-log) and unaffected.
**[REJECTED] An absolute elapsed time** (e.g. 90+ days flat) — simpler, but sends a Yearly contact
rogue absurdly early and a Daily one absurdly late.

**[DECIDED] Frequency gets NO visual encoding on the orrery.** It lives only in the data and the
frequency picker; the orrery encodes closeness (radius), progress (angle), and status (colour).
This resolves the question 01-data exported when `ring_seq` took the radial axis over from
frequency.
Rationale: keeps the orrery uncluttered and is consistent with Cluster A's rejection of
frequency-as-radius. **[REJECTED] Body size = frequency** — adds a cue but may read as
'importance,' and it is the same channel 04-log left open for `gravity`. **[REJECTED] Ring
thickness = frequency** — competes with §7's ring-style-encodes-status on the same ring.

**[DECIDED] `gravity` is NOT encoded on the orrery in v1.** Confirms 04-log's deliberate call:
gravity stays profile-only (04-log Cluster G), body-size remains a free channel, and the orrery is
not overloaded (it already carries radius, angle, colour, and ring style). The body-size/ring-
weight option remains recorded-and-open for a later release.
**[REJECTED for v1] Body size = gravity** — would surface concept-#2 on the glanceable view but
revises 04-log's profile-only placement.

### Cluster D — The sun & self

**[DECIDED — owner's design, over all three offered options] When the sun is the user (self), its
colour is USER-SELECTABLE from a themed 'star' palette.** The owner's reasoning: self has no
status/interval/decay, so a status colour is meaningless for self — and "if it's you, you should
pick your own." Some people want a yellow star, some blue, etc.
- This fills the gap 01-data left (it decided "the sun glows the status colour of whoever occupies
  it," but self *has* no status). It does **not** reverse 01-data: a **contact** assigned to the
  sun still glows that contact's status colour (01-data unchanged). The user-picked colour applies
  to the **self-sun only**.
- Consistency with the no-hardcoded-colour rule: the choices are a **themed star-colour set**
  (resolved through theme tokens), the same discipline 07-photos used to quantize the photo-
  fallback swatch — not a freeform colour wheel of raw hex.
**Scope flagged for veto at review:** the orchestrator scoped "pick your own" to the self-sun; a
contact-occupied sun keeps status glow. If the owner meant *any* sun occupant should be colour-
pickable, that would revise 01-data's contact-sun-glows-status and needs saying.
**[REJECTED] A fixed warm 'star' colour for self**; **[REJECTED] neutral / no glow for self**;
**[REJECTED] always-'healthy' colour for self** (slightly false — no decay relationship to self).

### Cluster E — Empty & degenerate states

**[DECIDED] At zero orbiting contacts the orrery shows the sun plus a gentle empty-state prompt**
("mark someone contacted to see them orbit," pointing at the dashboard / never-contacted list). At
1–2 orbiting contacts it simply looks sparse, which is fine.
Rationale: never-contacted contacts are excluded from the orrery (01-data), so a brand-new user
who has added contacts but marked none contacted sees an orrery with only the sun; an unexplained
empty orrery reads as broken. The prompt is honest and routes the user to the action that
populates it.
**[REJECTED] Sun alone, no message** — elegant but reads as broken to a new user. **[REJECTED ·
⚠ would reverse 01-data] Showing never-contacted contacts in the orrery** — they have no defined
orbital position (no `last_contact`) and 01-data excluded them by decision; not adopted.

### Cluster H — Ambient animation (cosmetic; owner decided rather than punting)

**[DECIDED] The starfield is a cheap animated twinkle shader** (subtle), within HANDOFF §7's
"static image or very cheap shader" constraint. **[DECIDED] The sun has a gentle ambient
pulse/glow.**
**Consequence:** these two make the orrery's ambient layer genuinely animated, so pause-on-blur is
required (see Cluster B's amended consequence note). Battery cost is small but non-zero;
perf/battery claims remain physical-Pixel-only. The bodies remain static regardless.
**[REJECTED] A static starfield** (would have made the orrery loop-free and pause a non-issue) and
**[REJECTED] a static sun** — both were on the table; the owner chose a touch of life over zero
animation. **[Available but not taken] Punt to the §12.4 design pass.**
*These are taste calls in the owner's bucket and may be revisited freely in the §12.4 direct-design
session; the palette/exact-shader specifics are design-pass detail either way.*

---

## Cross-domain constraints exported

- **[orrery → dashboard (8)]** Resolves 08-dashboard's "the card's rogue rendering inherits domain
  9's rogue visual." A card has no rings or drift, so the inherited treatment is the **cold /
  extinguished, desaturated body + a faded-to-faint status ring**; the outward-drift component maps
  to nothing on a card and is simply dropped.
- **[orrery → notify (11) / data]** The `rogue` time-path threshold is **a multiple of the
  contact's interval** (working ~2–3×; exact value a tunable constant). This must be a **single
  shared constant** read by both the orrery's rogue rendering and notify's decay-suppression
  (04-log already gives rogue contacts no decay notifications) — do not compute rogue twice with
  two thresholds. Per CLAUDE.md it sits at the top of its service file.
- **[orrery → theme]** New theme tokens required (no hardcoded colours, including in Skia — P1
  confirms Skia accepts runtime token/HSL colours): a **`rogue`/extinguished status colour** (cold,
  dark) distinct from decay's colour; a **themed star-colour palette** for the user-selectable
  self-sun; and the **relationship-view "muted" palette** (the calm colour state the morph fades
  toward). The four status colours (stable/wobble/decay + rogue) plus the star set all resolve
  through tokens.
- **[orrery → data / backup (15)]** The orrery adds **no new per-contact columns** — radius uses
  01-data's `ring_seq`, and angle/status/`rogue` are all **derived** (matching 01-data's
  never-store-status rule). The only new persistent state is **one app-level setting: the self-sun
  colour** (a themed star-colour token; companion to 01-data's `sun_contact_id`). Export/restore
  must include it alongside the sun assignment 01-data already flagged.
- **[orrery → photos (7)]** Confirms and closes 07-photos' open Skia item for this surface: orrery
  planets load the 512px master via `useImage(absoluteFileUri)` directly (P1), fallback = themed
  swatch + initials drawn with a **bundled font** via the Paragraph API. The orrery does **not**
  need the widget's base64 path; the one-off Pixel `file://` spike (07-photos) lands in this
  domain's build phase.
- **[orrery → INDEX/self]** The orrery is reached **from the dashboard** (08-dashboard: dashboard
  is home; the orrery hangs off it). The exact nav mechanism stays deferred (08-dashboard).

---

## Deferred to phase discussion

- The relationship-view **"muted colour" treatment** — greyscale, desaturated status colours, or a
  single neutral tone — and exactly what the morph fades between.
- The **themed star-colour palette** offered for the self-sun (which colours; how the picker
  reads).
- Whether the `rogue` **multiple-of-interval value is user-tunable** (04-log left tunability open;
  the shape is now fixed as a multiple).
- The **morph** transition feel — duration, easing, whether the toggle is a segmented control vs a
  single button.
- Whether the **relationship view shows any status signal at all** or is purely closeness (Cluster
  A muted it; how muted is a design-pass call).

---

## Deferred to phase planning

- Exact piecewise angle-to-time math. HANDOFF §7 already fixed the shape ("simplest is for the
  top arc to carry the first half of the interval and the bottom arc the second"); implementation
  refines it.
- Tap hit-testing math against Skia-drawn circles (no view hierarchy — coordinate math) and
  tap-target sizing / overlap resolution.
- Whether `ring_seq` renumbers or leaves a gap when a contact is archived or purged (01-data
  deferred this).
- Render-loop throttling is **moot** — Cluster B chose no body loop; the ambient starfield/sun loop
  is the only loop and is paused by unmounting `<Canvas>` on blur (P2).
- The **relationship-view resting angles** — an aesthetic, decay-independent distribution (per-
  contact rings already separate everyone by radius, so angle there is free).
- The single **shared `rogue`-threshold constant** wired to both orrery rendering and notify's
  decay-suppression.
- Skia `file://` image path — **resolved by verification (see Findings):** `useImage(absoluteFileUri)`
  works directly by API contract on `@shopify/react-native-skia@2.6.2`; a base64 fallback is wired to
  `useImage`'s error handler. A one-off Pixel spike to confirm the happy path is the only remaining
  action, and it belongs to the photos/orrery build phase, not the owner.
- Bundling a font for the Skia initials-fallback text (a font file is mandatory — no OS default); and
  legacy `useFont` vs the now-recommended Paragraph API. Design/phase-planning.
- Orrery plan targets exactly what Expo SDK 57 pins: **`@shopify/react-native-skia@2.6.2` with
  `react-native-reanimated@4.5.1`** (+ `react-native-worklets@0.10.1`, `react-native-gesture-handler@~2.32.0`).
  Verified against the authoritative `expo/expo@sdk-57` `bundledNativeModules.json` — this corrects a
  version conflict between the two verifiers (one said Skia pairs with Reanimated v3; the pinned set is
  v4.5.1). Reanimated 4 requires the New Architecture (Fabric), which RN 0.86 mandates anyway.

---

## Decisions made without you

Orchestrator's picks with no articulable divergence. **Read each as the decision AS ADOPTED.** Veto
any cheaply at review.

1. **The two rogue *reasons* render identically** in the orrery (cold/extinguished body) — both the
   time-overdue path and the 'Rarely responds' path. The `reason` attribute (04-log) surfaces on
   the **profile**, not in the orrery; the orrery only shows the *state*.
2. **The relationship view keeps each body's photo/fallback unchanged** from the status view; only
   angle (fixed vs progress) and colour intensity (muted vs full status) differ across the morph.
3. **The self-sun colour is a single app-level setting**, not per-contact, stored with the sun
   assignment and exported with it.
4. **The morph is self-terminating and does not need pause-on-blur** (it is event-driven, fired by
   the toggle); only the ambient starfield/sun animation needs the unmount-on-blur pause.
5. **`rogue`'s outward drift is bounded to stay on-screen and tappable** — it is the furthest
   drift, but not off the viewport (04-log's on-rails/tappable constraint). Exact clamp is
   phase-planning.

---

## Findings

*Investigation 2026-08-13. Two platform verifiers returned; both summaries verified against the
authoritative Expo `sdk-57` manifest where they conflicted. Workpapers in `workpapers/09-orrery/`.*

### P0 — Version baseline (verified first-hand, resolves a verifier conflict)

`expo/expo@sdk-57` `bundledNativeModules.json` pins: **`@shopify/react-native-skia@2.6.2`**,
**`react-native-reanimated@4.5.1`**, `react-native-worklets@0.10.1`,
`react-native-gesture-handler@~2.32.0` (Expo SDK 57 = RN 0.86, New Architecture mandatory). The two
verifiers disagreed on the Skia↔Reanimated pairing; the manifest is authoritative and both are wrong in
part — build against this exact set.

### P2 — Render loop, animation engine, gestures, pause (verified, Expo SDK 57)

- **HANDOFF §7's rendering *mental model* is stale, though its intent survives.** Skia's own
  value/clock system (`useValue`/`useClockValue`/`useComputedValue`) was **removed** in the ~1.0
  rewrite. **Reanimated is now the animation engine itself — a hard dependency, not merely "for
  gestures"** as §7 phrased it. The off-JS-thread guarantee still holds (worklets on the UI thread, no
  `setState` per frame). This updates §7's wording; it does not reverse its decision.
- **The orrery can run in Expo Go.** Skia, Reanimated and Gesture Handler are all `inExpoGo: true` on
  SDK 57. Only the **widget** (domain 12) forces a custom dev client — the orrery does not. (This
  corrects the orchestrator's own task-framing assumption.)
- **No built-in pause on the Skia/Reanimated clock.** `useClock()` takes no `paused`/throttle arg. To
  truly stop the frame callback you **conditionally unmount `<Canvas>`** on `useIsFocused &&
  AppState==='active'`; gating derived values only hides motion, it doesn't stop the loop. Satisfies
  HANDOFF §7's pause-on-blur requirement, just by a specific mechanism.
- **Tap-to-freeze + hit-test confirmed:** `GestureDetector` + `Gesture.Tap()` around `<Canvas>`;
  Skia has no view hierarchy, so hit-testing is coordinate math (`(x−cx)²+(y−cy)² ≤ r²`).
- **Two-view morph is idiomatic on ONE canvas:** a single `progress` shared value + per-body
  `interpolate()` in `useDerivedValue`. **Toggle vs swipe vs two-screens is a UX choice, not a
  technical constraint — none is blocked.** (A swipe would compete with tap-to-freeze for the touch
  surface and need gesture composition.)
- **A continuous 60fps loop may be unnecessary for the bodies.** At §7's ~5°/day the per-frame delta is
  ~0.00006° — imperceptible. Deriving each body's angle from timestamp math and recomputing on focus
  would eliminate the loop entirely (and moot the pause problem); the starfield is then the only thing
  that might still want animation. This is an owner-facing product-feel question (below), not just
  implementation, because it decides whether anything visibly moves while you watch.
- Workpaper: `workpapers/09-orrery/platform-skia-reanimated.md`.

### P1 — Skia image/text/colour platform facts (verified, Expo SDK 57)

`@shopify/react-native-skia@2.6.2` + `expo-image-manipulator@~57.0.9` (Expo `sdk-57`
`bundledNativeModules.json`). Skia 2.6.2 pairs with **Reanimated v3** (v4 only from Skia 2.10+).

- **`file://` resolves the 07-photos fork.** `useImage(string)` delegates unchanged to
  `Skia.Data.fromURI(uri)`, whose contract is "from a Uri, locally or remotely" — so a raw absolute
  `file://` sandbox path works **by contract** (documented-by-contract, not by example; issue #1248
  shows historical sandbox-path failures). Plan: `useImage(absoluteFileUri)` per planet, base64
  (`Skia.Data.fromBase64` → `MakeImageFromEncoded`) wired to the error-handler arg as fallback; spike
  on the Pixel before treating as fully DECIDED. **No routine per-photo base64 step needed.**
- **Circular "planet" + ring is idiomatic:** ImageShader filling a `<Circle fit="cover">` (or a
  clipped `<Group>`), ring = a stroked `<Paint>` child. No obstacle.
- **Initials fallback text:** a font file **must be bundled** (`require("*.ttf")`); there is no OS
  default. Docs now recommend the **Paragraph API** (with `TextAlign.Center`) over legacy
  `useFont`/`matchFont` for new projects.
- **Themed colour is fully satisfiable in Skia:** colours are runtime values — CSS/HSL strings and
  `Skia.Color(token)` both accepted, including gradient arrays. Nothing forces a compiled literal, so
  the no-hardcoded-colour rule and the HSL-hash swatch survive into Skia draw calls.
- **Threading:** render/animation run on the UI thread via Reanimated worklets; image decode is async
  and native (off the JS thread) — ~8 photos resolve as promises at mount, fallback shown until ready.
  Only the base64 fallback touches the JS thread, once, at mount. Perf claims stay physical-Pixel-only.
- Workpaper: `workpapers/09-orrery/platform-skia-images-text.md`.

### Inherited constraints (verified on disk against the cited dossiers)

- **`ring_seq` is a global radius override (01-data, reverses HANDOFF §7).** Radius no longer
  encodes frequency. Frequency now has *no* visual encoding on the orrery — 01-data explicitly
  exported "decide whether it needs another one" to this domain.
- **The sun is assignable (01-data).** `sun_contact_id` nullable (NULL = self); the sun glows the
  status colour of its occupant and has no ring; the occupant does **not** also orbit. Ring
  ordering tiebreaks on `created_at` with an optional `ring_seq` override.
- **Status is a continuous progress value = elapsed ÷ interval (01-data).** The orrery's angular
  position reads that same number (`daysUntilDue`). `stable`/`wobble`/`decay` are thresholds at
  80%/100% over it.
- **Never-contacted contacts are excluded from the orrery entirely (01-data)** — `WHERE
  last_contact IS NOT NULL`. A brand-new user whose contacts have no interactions sees an empty
  orrery (sun only).
- **The two-view orrery (04-log, owner-introduced, unowned).** Relationship view: radius =
  closeness, does not move with decay. Status view: position tracks orbital state. Names,
  switching mechanism, and default are open.
- **`rogue` is a fourth threshold + a non-time entry path (04-log).** It must stay **on rails and
  tappable** — HANDOFF §7's `[REJECTED]` "floating free with no orbit lines" was **not** adopted.
  Threshold value/shape and per-surface rendering are `[OPEN → domain 9]`. The dashboard card
  inherits domain 9's rogue visual (08-dashboard).
- **`gravity` maps naturally onto body size / ring weight but was deliberately left un-encoded on
  the orrery in v1 (04-log) — recorded as considered-and-open, not overlooked.**
- **Photos render via Skia in the orrery (07-photos):** one 512px master per contact; fallback is
  a themed swatch + initials (deterministic per contact); no hardcoded colours, including in Skia.
  The Skia `file://` vs base64 question is an open platform item to resolve at orrery-phase time.

### HANDOFF §7 — settled mechanics carried in (not re-litigated unless flagged)

Sun at centre; angular position = interval progress (~5°/day, near-static); every contact gets
their own ring; status encoded without altering motion (colour on body + ring, ring style
solid→dashed→faded, decayed drift outward past the ring); differentiated per-band animation
`[REJECTED]`; elliptical orbits wider than the viewport with off-screen extremes; tap-to-freeze;
`react-native-skia` + Reanimated, animation off the JS thread, never driven by React state; pause
on `useIsFocused === false` and AppState background.
