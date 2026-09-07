# Phase 29 native acceptance checklist

**Status: pending — no device actions or native observations performed by Plan 29-12.**

The approved [UI-SPEC](29-UI-SPEC.md), [CONTEXT](29-CONTEXT.md), [COVERAGE](COVERAGE.md) and [VALIDATION](29-VALIDATION.md) govern this checklist. Automated SQLite/controller/component results are separate evidence. The end-of-phase human verification workflow must retain pending UAT and cannot report phase verification complete while its native obligations remain unresolved. This adds no automated-execution checkpoint or requirement to operate a device now.

## Before a future native run

Confirm the app package and Metro tmux session with the owner per AGENTS.md before first actual device use. Then use approved emu-connect/adb tooling, resolve the current serial and verify exactly one device. No adb installation, hardcoded serial or local emulator. Record physical phone versus desktop emulator. Only a physical phone supports performance claims; emulator UI observations cannot establish Skia performance.

Use disposable representative contacts/history/photos. Do not modify the owner's real relationships for test setup. Record build commit, target, OS, font scale, theme package/mode, Reduce Motion setting and each fixture's contact/history/photo counts. Leave any unavailable or unobserved condition pending rather than treating another test as a substitute.

## Evidence record

| Field | Current evidence |
|---|---|
| Build commit / package / Metro session | Pending owner-confirmed native session |
| Target type / serial / OS | Unobserved |
| Fixture contact count / interaction count / age range | Unmeasured |
| Photo count / total bytes / largest photo | Unmeasured |
| Font scale / Unicode fixtures / theme modes | Unobserved |
| Native backup/scene/write overlap | Unobserved |
| Screenshots / UI tree / recording / observer / timestamp | None |
| Frame timing thread/tool and physical-phone identity | Unmeasured; no performance claim |

For each check, record pass/fail/pending, fixture, observation, timestamp and evidence path. A data-invariant claim additionally needs the automated/source evidence; seeing a screen render is not database proof.

## Approved E1–E9 state checks — 55 total

Each row is pending. Repeat visual/text checks with long names, combining marks, emoji and non-Latin scripts, largest supported text, Galaxy/Standard and light/dark as applicable. The treatments below carry all approved categories; “covered” in planning means specified, not verified.

| Check | State | Native expected treatment | Result / evidence |
|---|---|---|---|
| E1-1 E1 World | empty | True empty uses No contacts in your Orrery yet and Add Contact; selected empty uses Show All Contacts; qualifying sun-only uses centered-here copy. | Pending |
| E1-2 E1 World | loading | Initial load shows Loading your Orrery…; opening the companion remains possible. | Pending |
| E1-3 E1 World | error | Read failure shows Reload System; failed same-System refresh retains inert prior content with the refresh notice. | Pending |
| E1-4 E1 World | populated | Canonical timestamp world; no Status/Relationship toggle; bounded readable Home. | Pending |
| E1-5 E1 World | partial | Missing photo falls back to initials, null progress is neutral, absent optional context is omitted. | Pending |
| E1-6 E1 World | overflow | World clips to viewport with working camera access and complete companion membership. | Pending |
| E1-7 E1 World | zero-one-many | Empty, sun-only, one, six, ten and large System preserve useful scale; no count cap. | Pending |
| E1-8 E1 World | long-text | Canvas ellipsis, full accessible identity and wrapping companion name preserve Unicode. | Pending |
| E2-1 E2 System selector | empty | All six built-ins remain selectable with zero members; absent Categories omit only category entries. | Pending |
| E2-2 E2 System selector | loading | Selected destination is busy; previous bodies are never relabelled as destination members. | Pending |
| E2-3 E2 System selector | error | Reload System stays available without automatic fallback selection or fabricated save success. | Pending |
| E2-4 E2 System selector | populated | Exactly one selection; built-in order then actual UID categories; saved selection is truthful. | Pending |
| E2-5 E2 System selector | partial | Missing/deleted Category has explicit recovery; duplicate names retain separate identities. | Pending |
| E2-6 E2 System selector | overflow | Long category lists scroll without clipping controls. | Pending |
| E2-7 E2 System selector | zero-one-many | No, one and many Categories; zero-member System remains enabled. | Pending |
| E2-8 E2 System selector | long-text | One-line trigger ellipsis with complete accessible current-System name; dropdown rows wrap. | Pending |
| E3-1 E3 View options | empty | Fresh defaults are Balanced and satellites Off. | Pending |
| E3-2 E3 View options | loading | Hydration/save is busy on affected controls; duplicate/conflicting saves cannot race. | Pending |
| E3-3 E3 View options | error | Read failure retries without overwriting saved values; write failure retains committed choice and retry intent. | Pending |
| E3-4 E3 View options | partial | Optional omission uses defaults only when appropriate; old backup omission retains existing choices. | Pending |
| E3-5 E3 View options | long-text | Density labels/help/switch rows grow and wrap at largest supported text. | Pending |
| E4-1 E4 Contacts/Recenter | loading | Contacts opens loading/empty sheet; Recenter disabled until measured with accessible disabled state. | Pending |
| E4-2 E4 Contacts/Recenter | error | Member-load failure retains navigation recovery; direct camera action has no network/save spinner. | Pending |
| E4-3 E4 Contacts/Recenter | overflow | Separate bottom-right controls stay above tabs/FAB and inside measured bounds, with minimum targets. | Pending |
| E4-4 E4 Contacts/Recenter | long-text | Complete accessible names and wrapping labels; Contacts above Recenter remains reachable. | Pending |
| E5-1 E5 Companion sheet | empty | Same active-System empty truth as world, including correct qualifying sun-only membership. | Pending |
| E5-2 E5 Companion sheet | loading | Loading contacts… matches requested System; no old/new membership mix. | Pending |
| E5-3 E5 Companion sheet | error | Same-System stale content/notice, explicit reload; failed optional context preserves parent identity. | Pending |
| E5-4 E5 Companion sheet | populated | Exactly one row per member, qualifying sun once; health/named Gravity; separate Focus/Open Profile. | Pending |
| E5-5 E5 Companion sheet | partial | Photo fallback and omission of missing optional context; parent relationship context uses original text. | Pending |
| E5-6 E5 Companion sheet | overflow | Detail sheet scrolls within bounds; underlying world/modal controls inaccessible. | Pending |
| E5-7 E5 Companion sheet | zero-one-many | Zero empty state, one ordinary row, many scrolling rows; no nonmember sun appended. | Pending |
| E5-8 E5 Companion sheet | long-text | Full names wrap and actions reflow vertically; focus closes sheet then frames; Profile closes then navigates. | Pending |
| E6-1 E6 Cluster panel | empty | Zero surviving targets closes group. | Pending |
| E6-2 E6 Cluster panel | loading | Derived from actual projected hit targets; no artificial loading delay; actions fresh-validate. | Pending |
| E6-3 E6 Cluster panel | error | Read failure retains valid same-System content with failure notice/reload. | Pending |
| E6-4 E6 Cluster panel | populated | All plausible targets ordered deterministically; Contacts here with correct count and separate actions. | Pending |
| E6-5 E6 Cluster panel | partial | Missing optional metadata omitted; stale target rejected without guessing another Profile. | Pending |
| E6-6 E6 Cluster panel | overflow | Floating panel scrolls within measured space; framed world, dismiss and Recenter remain available. | Pending |
| E6-7 E6 Cluster panel | zero-one-many | One surviving target remains actionable; many scroll; singular/plural count correct. | Pending |
| E6-8 E6 Cluster panel | long-text | Names/actions wrap; canvas remains interactive, unlike modal companion. | Pending |
| E7-1 E7 Focus labels | loading | Loaded identity remains visible while optional relationship context loads. | Pending |
| E7-2 E7 Focus labels | error | Satellite failure has targeted reload; removed target clears focus with documented notice. | Pending |
| E7-3 E7 Focus labels | overflow | Focus persists during camera moves until explicit dismissal/offscreen loss; labels cannot strand hidden focus. | Pending |
| E7-4 E7 Focus labels | long-text | Names/context wrap within usable bounds; subordinate context yields before covering controls; full parent context accessible. | Pending |
| E8-1 E8 Polaris | empty | Meaningful with zero contacts; tokenized local starburst. | Pending |
| E8-2 E8 Polaris | loading | Disabled until valid camera measurement; orientation absent until valid. | Pending |
| E8-3 E8 Polaris | error | No remote asset/error path; camera recovery remains reachable on member read failure. | Pending |
| E8-4 E8 Polaris | populated | Restrained in-world landmark moves consistently with yaw; tap resets yaw only. | Pending |
| E8-5 E8 Polaris | overflow | At viewport edge accessible Reset north remains usable; landmark is not pinned to HUD. | Pending |
| E8-6 E8 Polaris | long-text | Complete textual orientation and accessibility label at large text sizes. | Pending |
| E9-1 E9 Feedback | loading | Distinct named loading copy; retry busy while pending and available again after failure. | Pending |
| E9-2 E9 Feedback | error | Specific read/refresh/preferences/reorder/satellite/removed/missing recovery preserves valid content/intent. | Pending |
| E9-3 E9 Feedback | overflow | Bounded scrolling messages retain reachable recovery actions. | Pending |
| E9-4 E9 Feedback | long-text | Wrapped copy at largest text; no technical stack trace or network setup prompt. | Pending |

## Combined native workflows

| ID | Scenario and required observation | Result / evidence |
|---|---|---|
| N01 | Pan over a body, pinch at a body and empty sky, rotate, deliberately tilt; bounded camera never inverts or passes below plane; manual control stays enabled with Reduced Motion. | Pending |
| N02 | Tilt/yaw near/far bodies across sun: circular photos, horizontal labels and natural sibling depth; tap moving/intermediate projected centers at quarter/half/three-quarter recovery and membership transitions. Inclusive boundary ambiguity includes all candidates. | Pending |
| N03 | Distant isolated tap focuses to name-visible level; inspected tap opens correct Profile. Duplicate/Unicode names never confuse identity. Open from cluster row, companion and single-focus context. | Pending |
| N04 | TalkBack and switch navigation traverse complete names, health/named Gravity, Focus/Open Profile, parent satellite context and orientation. No raw Gravity score, human-worth framing or invented neutral decay. Dropdown/sheet close restores trigger focus; modal companion isolates world; nonmodal group preserves camera/Recenter. Back/tab retap dismisses top transient first. | Pending |
| N05 | Profile Back restores prior pose/valid focus; dismissed group does not reopen. Background/foreground preserves session; fresh visit/relaunch returns Home. Change/remove target while away and observe stale focus discarded. | Pending |
| N06 | Polaris tap and accessible Reset north preserve pan/zoom/tilt; Recenter clears all focus/group and restores every Home axis. Interrupt near/far recovery with new input. Tiny inertia remains restrained. | Pending |
| N07 | Stationary prolonged hold visibly/haptically arms reorder; move before hold and confirm pan. No-op release, second finger, cancellation, background and System switch do not commit. Test decay/rogue drift at current camera pose. | Pending |
| N08 | Filtered hold: change eligible membership before release while complete order/sun remain unchanged; stale request rejects, committed layout returns, reorder notice and Reload System work. Repeat sun/order change; hidden slots and recency stay intact per SQL tests. | Pending |
| N09 | Enable satellites at readable inspection: zero/one/many unlinked people appear subordinately; hidden/linked/deleted rows disappear and restored/unlinked rows reappear. Moon tap shows original name/relation only; absent relation uses key-person fallback; no Profile/log/status/cadence action. | Pending |
| N10 | Favorites excludes global contact sun: isolated focus, inspected Profile and Back still work; mixed sun/member ambiguity includes sun once; companion excludes it. Repeat Category exclusion. With satellites On at inspection the nonmember sun has no moons/context/stale satellite action. Requalify parent and observe eligible moons/context exactly once without changing sun contact actions. | Pending |
| N11 | Toggle live OS Reduced Motion while inertia/focus/recenter/ambient motion runs. Existing motion cancels/simplifies, no stale initial seed restarts it, direct camera gestures work. Blur/background stops clock-owning subtree; resume does not accumulate motion. | Pending |
| N12 | Same-System membership refresh retains continuity; switch loading/failure does not relabel old bodies. Preference save/retry, category disappearance, satellite failure and repeated reload remain recoverable with scaled text. Exercise failure fixtures only through approved test setup, never new production diagnostics. | Pending |

## Tap a contact during automatic backup

**Current status: pending; actual snapshot overlap unobserved.** Use normal enabled automatic-backup behavior with a disposable representative photo/history fixture. Keep FIFO ordering, photo-inclusive snapshot coherence and fresh target probes intact.

1. Record contacts, history rows/age range, photo count/bytes, build, target type and existing observable backup start/completion evidence.
2. While backup runs, tap an isolated distant contact to focus. Repeat at visible identity scale for Profile. Record tap and completion times plus whether overlap with the actual backup snapshot was observed.
3. Repeat with Clear focus and Recenter before validation settles, then System switch, then background. Confirm no delayed focus/Profile action after cancellation.
4. Trigger a scene refresh concurrent with a normal Quick Log/write. Record completion of both, retained loading/refresh treatment, any visible wait and final visible membership/health.
5. Attach observations/recording and limits. If snapshot overlap was not observed, retain the contention case pending; ordinary successful navigation does not prove overlap. Do not add telemetry, a production diagnostic surface, timeout, priority, busy UI or probe/snapshot bypass.

| Observation | Result |
|---|---|
| Backup start/end and proven snapshot overlap | Pending |
| Focus tap/completion and Profile tap/completion | Pending |
| Clear/Recenter/System/background cancellation | Pending |
| Scene refresh + normal Quick Log/write completion and visible wait | Pending |
| Representative long-history/photo scale | Unmeasured |
| JS/Skia frame timing on physical phone | Unmeasured |

Wall-clock tap delay is not JS/Skia frame time. A desktop emulator can support UI observations only. Phase 40 receives measured long-history/photo-library contention and optimization evidence, or this explicit **unmeasured** status if still unavailable. No optimization that weakens FIFO/coherence/fresh validation is authorized by the handoff.

## Coverage and downstream handoff

Automated production integration: `src/services/orrery-exploration.integration.test.ts` (real migration chain, DAO lifecycle, export→scene/action cancellation and fresh control, scene→recency snapshot ordering, clock-only rank validation and UID reuse). Existing scene tests exercise production pan callbacks without rank writes and current-frame taps; owning geometry/render/session suites cover the other numerical/controller contracts. Full suite evidence is in Plan 29-12 SUMMARY. These results do not pass any row above.

COVERAGE maps all ORRC-01–16, D-01–D-11 and EDGE-01–37 to their implementing plans. N01/N02/N06/N07/N11 retain native evidence for flagged assumptions EDGE-03/11/20/21/22/37; no extra product semantics are inferred. All 55 state checks and N01–N12 remain native-pending.

Phase 30: custom Systems and polished switching. Phase 36: preference wire emission/versioning. Phase 37: Category administration/deletion fallout. Phase 40: final density/neighbor/large-System, contention, gesture/GPU/accessibility calibration. No deferred scope is implemented by this checklist.
