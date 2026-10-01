# Lab B — Decisions for you

These are the choices in Lab B that are yours to make: taste, product meaning, risk, or a
change to something already decided. The lab built each one behind a switch so you could
judge it. **None of them is decided.**

How to read each item:

- **Code**: type this to answer. For example, "TILT yes, FLOW no", or "approve all
  recommendations".
- **Look at**: the picture to open. Every path is under
  `docs/experiments/orrery-renderer/lab-b-skia-unleashed/evidence/`. These are emulator
  screenshots; real-phone pictures come later.
- **Recommendation**: my suggestion. "Yes" means keep it for the real Orrery (V2).
- **⚠ Changes a recorded decision**: marks items that would undo or alter something already
  written in an ADR, `HANDOFF.md` or the Orrery system doc. Those need an explicit yes, not
  silence.
- **(C-xx)**: the cross-reference into `research/COMPROMISES-LOG.md`, for later. You don't
  need it to answer.

R3 polish and a final check on a release build are done (R3 added CLAMP, IMMERSE and
SHIPSAFE below). One pass is still to come, and it may add items or change a picture:

- **Real-phone test**: pending, because the Pixel is in use by Lab A. See item PHONE.

To compare everything at once, the lab panel has a one-tap **preset** row: "Lab B best" (all
recommended effects), "Ship-safe", "Everything" and "Legacy" (today's Orrery). The side-by-side
pictures are `11-r3/05-final/presets-01-overview-inner.jpg`, `presets-02-overview-dense.jpg`
and `presets-05-focus-cleo.jpg`.

---

## Big calls (these shape everything else)

| Code | What it is | Today's Orbit | Recommendation | Look at |
|---|---|---|---|---|
| **TILT** ⚠ | When you open the Orrery or press Recenter, the map leans back about 32°. It looks like a game's star map seen from in front and above, not a flat target seen from straight above. You can still tilt it yourself. | Home is flat (tilt 0). The Orrery system doc says Recenter "restores all Home axes". | **Yes.** This is the single biggest improvement in the lab. It also turns on depth cues that were already built but hidden. If yes: write a new ADR for the Home camera, and check that the near side doesn't slide under the buttons at close zoom. | `10-r2/before-after-overview.jpg`, `10-r2/01-tilt-probe/sheet.jpg` |
| **SKY** ⚠ | A painted deep-space sky behind the Orrery: soft nebula clouds and three layers of stars that drift slowly and move with the camera. | ADR-114/179 force a plain solid background on the Orrery screen (no art). | **Yes**, with a new ADR that supersedes the Orrery part of ADR-114/179. The sky is drawn by code from your theme colours; it is not an image. | `05-m1-checkpoint/28c-ab-legacy-left-vs-lab-right.png` |
| **GLASS** ⚠ | Text on the see-through Orrery cards must stay readable over the brighter sky. In Standard Dark, secondary text measures **4.42:1** by the ADR-149 method (re-measured in R3 with all the R2 and R3 changes on, and with "Everything" on), just under the 4.5:1 accessibility line. It was 4.45–4.47 before. The bright pixel underneath is still an initials letter on a contact. The other three themes pass (4.51 / 5.56 / 5.10). (C-02) | ADR-149 proved the cards against the old, darker Orrery. | **Don't ship until it passes 4.5:1 in all four themes.** Fix it by dimming what the Orrery draws *under* the cards (the lab already does this for the focus card). Do not change the card opacity or your colours. | `11-r3/04-legibility-after/`, `09-r1/shots/05-sun-glow-cap-standard-dark-before-after.jpg` |
| **PORT** | Six fixes found in the lab also fix the **current** Orrery: <br>• a 3–7 second freeze when switching between big Systems; <br>• an app crash with very large Systems (800+ people); <br>• slow label and position maths with many people; <br>• contact initials showing as a cut-off full name ("El…") instead of "EN" on Android. <br>None of them changes what the Orrery shows or does. | The freeze, the crash risk and the initials bug are in the shipping app. | **Yes, port them to main soon**, as their own small phase, separate from V2. Details: HARVEST.md section A. | `07-switch-stall/05-sheet-inner-to-dense-before-vs-after-normal-speed.jpg` |
| **PHONE** | The lab never ran on a real phone, so every speed number is from the desktop emulator. A ready-made 20-minute script measures the real thing. | — | **Free up the Pixel for Lab B when Lab A is done**, then run `research/PHONE-PASS-SCRIPT.md`. Several items below depend on it. | — |

## Orbits (the rings)

| Code | What it is | Today's Orbit | Recommendation | Look at |
|---|---|---|---|---|
| **RINGS** | Thin, precise orbit lines instead of thick bands. The status colours and solid/dashed/dotted styles stay, and so does the order of thickness (decay thickest), but every line is thinner and fainter. Crowded areas fade a little at far zoom. (C-35, C-36) | 2–4 px coloured bands. | **Yes**, after a contrast check of the thinnest styles in light themes. Yellow dashed wobble on the pale sky is faint, but it is faint in today's app too. | `04-wp1.3/08-pass2-overview-dense-final.png`, `04-wp1.3/07a…` vs `07b…` |
| **RIM** | Orbit lines near the sun are a little brighter and the outer ones recede, as if lit by the sun. (C-68) | All equal. | **Yes**, checked together with RINGS for outer-ring contrast. | `10-r2/before-after-overview.jpg` |
| **FLOW** ⚠ | Small light pulses travel around every orbit at the same speed, all the time. They carry no meaning: every status gets the same pulses. (C-04, C-59) | None. `HANDOFF.md` §7 rejected per-status animation with the rule "**Motion encodes data, not mood.**" The lab's pulses are identical for every status, so they don't break the rejected item itself, but they are mood motion on the data lines. | **No.** It goes against the spirit of that rule. It also keeps the screen redrawing every frame, which costs battery. The lab already switches it off on very large Systems. | `04-wp1.3/09-flow-comets-overview-dense.mp4` |
| **WAKE** | A fading trail along each orbit from "north" to the contact, showing how far through their check-in interval they are. (C-17) | The angle already shows this. | **Not now.** It repeats what the position already says and was one of the costliest effects. The lab hides it on large Systems and while the camera moves. Revisit only if you want progress to be more visible. | `04-wp1.3/02-pass1-identity-2.2-hud-tags-wake-tether.png` |
| **TETHER** | For drifting (decay) and rogue contacts, a thin dotted line from where they should be on their orbit to where they are. "Out of orbit" becomes something you can see measured. (C-17) | Drift is shown only by position. | **Yes.** It's cheap, it reads as precise, and it only shows what the drift already means. | `05-m1-checkpoint/18-face-detail-3.2-ada-mustard-rogue-tether-moons.png` |

## Contacts (the bodies) and the sun

| Code | What it is | Today's Orbit | Recommendation | Look at |
|---|---|---|---|---|
| **STATUS** | Each contact is drawn as a small lit world. Status is shown by a thin coloured rim plus a glow ("atmosphere"): <br>• **stable / wobble**: full glow; <br>• **decay**: thin glow, 25 % less colour; <br>• **rogue**: no glow, a cold rim, 45 % less colour; <br>• **never contacted**: matte with a neutral rim. <br>(C-16) | A thick 3 px coloured outline. | **Yes.** Status stays readable at close zoom. At overview the ring colour does most of the work, in today's app as well. | `05-m1-checkpoint/18-…png`, `21-face-detail-3.2-logo-graphic-rogue-desaturated.png`, `23-…png` |
| **FACES** | Lighting from the sun darkens the far side of each photo to at most 55 % brightness (75 % in light themes). No test face became unrecognisable. The weakest case is dark skin on the shadow side of a rogue contact. (C-30) | Flat photos. | **Yes, provisionally.** Confirm on the real phone with a dark-skinned rogue contact at overview size, then decide. | `05-m1-checkpoint/18-face-detail-3.2-ada-mustard-rogue-tether-moons.png`, `M1-CRITIQUE.md` §Faces |
| **SUN** | When your own centre has no photo, the sun becomes a glowing star surface in your star colour, with your initials, instead of a coloured avatar disc. Photo suns keep the photo, never darkened. (C-31) | Avatar swatch plus initials. | **Yes.** | `03-wp1.2/09-pass3-sun-finer-granulation-identity.png`, `03-wp1.2/12-contact-sun-photo-emissive-status-corona-cheap-moons.png` |
| **FLOOR** | At the farthest zoom, very small contacts are drawn up to 1.4× bigger so they read as worlds, not pins. Tapping and labels are unchanged. Very tiny ones become coloured dots. (C-69, C-62) | Drawn at true size. | **Yes.** | `10-r2/06-final/02-overview-dense.jpg` |
| **STAGE** | The sun casts a soft light pool on the orbit plane around it, plus (Galaxy only) a faint grid that dips into a "gravity well" around the sun. Neither carries meaning. (C-67) | None. | **Yes to the light pool. The grid is optional**: keep it very faint, or drop it. It's a taste call. | `10-r2/04-iter3/art/`, `10-r2/03-iter2/crop-sun-art-bloom-flare.jpg` |

## Focus and interaction

| Code | What it is | Today's Orbit | Recommendation | Look at |
|---|---|---|---|---|
| **DIM** | When you focus a contact, everyone else goes a little darker and greyer, and their labels dim (they stay readable, measured ≥4.95:1). The focused contact glows more. The sun never dims. (C-52, C-14) | Only a blue ring marks focus. | **Yes.** | `08-wp2.2-focus/07-debug-dense-120-focus-world-response.jpg` |
| **CARD** ⚠ | The focus card now places itself so it never covers the focused contact or its name. If space is tight it gets shorter and scrolls. Detail behind the card is hidden instead of ghosting through the glass. The glass itself is unchanged. (C-57, C-61) | The card can cover the contact's face and name. Behind the card, details show through at about 9 %. | **Yes to both.** The "hide what's behind the card" part changes how ADR-149's see-through cards behave in practice, so it needs your explicit yes. | `08-wp2.2-focus/00-before-focus-card-covers-label-accent-ring.jpg` vs `01-…`, `09-r1/shots/01-focus-card-occlusion-off-vs-on-dense-eli.jpg` |
| **CHROME** | Thin corner brackets and squarer corners on the System picker, View options, the Orrery buttons and the focus card, so they look like instrument panels. Glass, sizes and the app header are unchanged. (C-56) | Rounded glass pills. | **Yes, lightly.** It's a taste call. | `08-wp2.2-focus/03-debug-galaxy-dark-home-vs-focus-hud-chrome.jpg` |
| **REORDER** | When you hold a contact to reorder it: a charge arc fills around it, its orbit glows, and the orbit flashes at each new slot. This replaces the blue ghost ring. The vibration is unchanged. (C-55) | Blue ghost ring. | **Yes.** | `08-wp2.2-focus/12-debug-sheet-reorder-hold-charge-held-ring-slot.jpg` |

## System switching

| Code | What it is | Today's Orbit | Recommendation | Look at |
|---|---|---|---|---|
| **SWITCH** | The System switch becomes a cinematic moment: <br>• stars stretch into hyperspace streaks; <br>• people leaving dissolve into sparks; <br>• arriving people fly in behind comet tails and flash as they settle; <br>• a ring-shaped shockwave locks the new System in. <br>Sparks and comets pass over faces for under a third of a second. Timing is unchanged (2.1 s). With Reduced Motion it stays a plain crossfade. (C-44, C-47) | The same movement, without these effects. | **Yes.** It's the lab's strongest "game" moment. Trim the sparks and comets if the phone shows stutter. | `06-wp2.1-switch/27-sheet-dense-to-inner-slowmo20-pass2.jpg`, `06-wp2.1-switch/01-first-switch-after-cold-launch-work-to-inner-normal-speed.mp4`, `10-r2/final-switch.jpg` |
| **HUE** | Each System gets its own sky colour, picked automatically from your star palette. All Contacts keeps the default. The sky changes colour during a switch. (C-05) | One sky. | **Yes**, but tie the colour to the System's permanent id so it never changes on a rename or restore. Later you could let people choose it. | `06-wp2.1-switch/05-settled-inner-circle-galaxy-dark-gold-sky-hue.jpg` |

## Camera and screen layout (added in R3)

| Code | What it is | Today's Orbit | Recommendation | Look at |
|---|---|---|---|---|
| **CLAMP** | At close zoom with the map tilted, contacts on the near side used to grow into big discs that slid under the buttons. The lab now limits how much the tilt can enlarge a contact (at most 6 % bigger) and caps any contact at 8 % of the screen width. Positions are unchanged; only the drawn size is limited. Tapping, labels and the focus marker follow the drawn size. (C-71) | No limit; Home is flat, so it barely mattered. | **Yes, if TILT is yes.** It only matters with the tilted Home. V2 should build the limit into the camera maths rather than adding it afterwards. | `11-r3/01-iter1/04-detail-dense.jpg` (before) vs `11-r3/02-iter2/04-detail-dense.jpg` (after) |
| **IMMERSE** | On the Orrery tab, the map now continues up under the "Orrery" title, which floats on a soft fade in your background colour, instead of stopping at a hard edge below the header. The three Orrery buttons become one instrument strip. The status bar, tab bar and "+" button are unchanged; making those see-through too would change the whole app's shell. The title still reads at ≥ 9.9:1. (C-72) | The header is a solid bar; the map starts below it. | **Yes.** It's a taste call. If you want the map truly edge to edge, that is a separate app-shell decision. | `11-r3/05-final/presets-02-overview-dense.jpg` (columns 1 vs 4), `11-r3/02-iter2/` |
| **SHIPSAFE** | The "Ship-safe" preset is the lab's guess at a first version: Lab B best minus FLOW, WAKE, DIM, the grid, the moving sky, the moon effect, and BLOOM / BLUR / FLARE / WOBBLE. It is also the only setting measurably cheaper on the emulator. Which effects belong in it is your call, item by item, via the codes above. (C-73) | — | **Use it as the starting point for the phone test**, not as a decision. Your answers above override it. | `11-r3/05-final/presets-*.jpg` (column 2) |

## Themes

| Code | What it is | Today's Orbit | Recommendation | Look at |
|---|---|---|---|---|
| **STD** | The Standard theme gets its own look: a calm graphite sky with a faint navigation chart (range rings, bearing lines, a degree scale) instead of the Galaxy nebula. The chart carries no data. (C-58) | Standard and Galaxy looked the same in the lab before this. | **Yes.** It's the most "strategy-game instrument" look in the lab. | `10-r2/06-final/07-overview-dense-standard-dark.jpg`, `08-wp2.2-focus/04-debug-standard-dark-chart-identity-home-vs-focus.jpg` |
| **LIGHT** | Light themes swap glow for paper: pale ink washes, ink-speck stars, soft shadows under contacts. Standard Light is the quietest. (C-15) | Solid background. | **Yes to the approach, but it needs its own art pass.** The pale sky still reads busy or washed out at the edges. | `10-r2/before-after-themes.jpg`, `10-r2/06-final/07-overview-dense-galaxy-light.jpg` |
| **TOKENS** | The new colours (nebula, glows, instrument ticks, switch effects) are currently mixed from your existing theme colours by formula. You haven't picked any of them. (C-03, C-32, C-40, C-44, C-53) | — | **Yes: give V2 a small task to define named Orrery colour tokens per theme**, starting from the lab's mixes. | `05-m1-checkpoint/27-themes-4-contact-sheet-gd-gl-sd-sl.png` |

## Experiments the lab recommends dropping or shrinking (FYI, say if you disagree)

| Code | What it is | Recommendation | Look at |
|---|---|---|---|
| **FLARE** | A cinematic lens flare: a horizontal light streak through the sun plus ghost circles. (C-70) | **Optional.** If you like it, keep only the streak, done cheaply. Drop the ghosts. | `10-r2/03-iter2/crop-sun-art-bloom-flare.jpg` (right side) |
| **BLOOM** | A real "glow everything bright" camera effect. | **Drop.** Beautiful, but likely too heavy for phones, and it washes the sun out. | `10-r2/final-hero-bloom-flare.jpg` |
| **BLUR** | Tilt-shift: blur the far and near parts of the map. | **Drop.** It blurs faces while names stay sharp. | `10-r2/03-iter2/sheet-hero.jpg` |
| **WOBBLE** | A heat-haze ripple on the switch shockwave. | **Drop.** Only visible in slow motion. | `10-r2/05-shockfilter/lockslow-off-vs-on.jpg` |

## Found during the final check (FYI)

| Code | What it is | Recommendation | Look at |
|---|---|---|---|
| **LABEL** | A bug in **today's** Orbit, not caused by the lab: after a cold start, if the last System you viewed is one you created yourself, the System picker reads "Unavailable System" until you pick a System again. The map itself is correct. | **Fix on main as a small bug fix**, alongside PORT. Details: `research/FINAL-VALIDATION.md` §3. | `13-final/08-unavailable-system-cold-start.jpg` |

The Polaris question from R3 is closed. Tapping Polaris does turn the map back to north, in
today's Orbit and in the lab. The earlier test recorded too late to catch the turn.

---

**Approve all recommendations** means:

| Answer | Items |
|---|---|
| Yes | TILT, SKY, PORT, PHONE, RINGS, RIM, TETHER, STATUS, FACES (provisional), SUN, FLOOR, STAGE (pool yes, grid optional), CLAMP (with TILT), IMMERSE, DIM, CARD, CHROME, REORDER, SWITCH, HUE, STD, LIGHT (approach), TOKENS, LABEL (fix on main) |
| Starting point only | SHIPSAFE |
| No | FLOW, BLOOM, BLUR, WOBBLE |
| Not now | WAKE |
| Optional | FLARE |
| Gate (no ship until it passes) | GLASS |

TILT, SKY, FLOW, CARD and GLASS touch recorded decisions, so they need a "yes" (or "no")
from you even under "approve all". Say so if you want them treated differently.
