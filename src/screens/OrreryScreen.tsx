/**
 * OrreryScreen (ORR-01/03/04/05) — the reachable, static STATUS-view orrery: a
 * Skia "solar system" of the orbiting set (one status-coloured ring + planet per
 * live, contacted, non-archived contact), a central sun, the rogue visual, an
 * empty-state prompt, and tap→Profile. Ambient motion, the two-view morph, and the
 * radial `ring_seq` drag land in 13-07; the Settings star/sun controls in 13-06.
 *
 * ── Render architecture (H1, Rules of Hooks) ────────────────────────────────
 * This screen owns ONLY screen-level hooks (theme, navigation, the measured-canvas
 * dims, the focus read, the bundled font, the tap gesture) — a FIXED hook count
 * independent of the contact count. Every per-body Skia hook lives in a keyed child:
 *   - `<OrbitBody key={c.id}/>` owns its own `useImage` (+ 13-07's morph derived
 *     value) — this screen's `.map()` returns those ELEMENTS and calls NO hook;
 *   - `<SunBody/>` owns the sun photo hook;
 *   - `<OrreryCanvas>` is the conditionally-mounted `<Canvas>` subtree (owns 13-07's
 *     `useClock`), so unmounting it halts the render loop (pause-on-blur, 13-07).
 *
 * ── Measured metrics (H2 / C2-4) ────────────────────────────────────────────
 * The canvas is MEASURED via `onLayout`; a `dimsValid` gate defers computing the
 * layout, mounting `OrreryCanvas`, and enabling the tap gesture until the measured
 * dims are valid (a transient 0×0 first pass never reaches `deriveOrreryMetrics`/
 * `hitTest`). `deriveOrreryMetrics(w, h, n)` runs ONCE per placement and the SAME
 * metrics object `C` feeds render AND hit-test (no second geometry path).
 *
 * ── Sun occupant (M4 / C2-2) ────────────────────────────────────────────────
 * When a contact is the sun, its photo/status/archived come from a `Promise.all`
 * over `getContactHeader` (photo/archived_at) + `getContactStatus` (status); the
 * screen threads `statusRow?.status ?? null` (a never-contacted contact-sun → null
 * status → the neutral glow). An archived/missing occupant resolves to self.
 *
 * Offline read path only (CLAUDE.md): a failed settings read renders with defaults;
 * a photo that fails to decode falls back silently to a swatch + initials. Every
 * Skia colour resolves through `useTheme().colors.*` — no hex (check:colors).
 */
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Circle,
  DashPathEffect,
  Group,
  useFonts,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  Easing,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { getInitials, swatchIndex } from "@/components/avatar-initials";
import { OrbitBody } from "@/components/orrery/OrbitBody";
import { OrreryCanvas } from "@/components/orrery/OrreryCanvas";
import { SunBody } from "@/components/orrery/SunBody";
import { SegmentedControl } from "@/components/SegmentedControl";
import { getAppSettings } from "@/db/app-settings-dao";
import { getContactHeader } from "@/db/contact-read";
import { getContactStatus, type ProfileStatus } from "@/db/contact-status-read";
import { getExecutor, localDateTime } from "@/db/database";
import { listOrbitingContacts, type OrbitingContact } from "@/db/orrery-read";
import { getProfile, getProfilePhoto } from "@/db/profile-dao";
import { rewriteRingSeq } from "@/db/ring-seq-dao";
import {
  deriveOrreryMetrics,
  drawnRadius,
  evenSpreadAngle,
  hitTest,
  MORPH_MS,
  type OrreryBody,
  polarToXY,
  progressToAngle,
  ringRadius,
  shortestAngleDelta,
} from "@/logic/orrery-geometry-logic";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { computeRingReorder } from "@/logic/ring-reorder-logic";
import {
  resolveSunOccupant,
  type SunOccupantLookup,
} from "@/logic/sun-occupant-logic";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme";
import type { ThemePalette } from "@/theme/theme-types";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "orrery";

/** Movement (px) past which a touch becomes a radial drag rather than a tap. */
const PAN_MIN_DISTANCE = 10;
/** Accent ghost-ring drag-preview stroke width + opacity. */
const GHOST_STROKE = 2;
const GHOST_OPACITY = 0.6;

/** The worklet-safe metrics snapshot the pan drag reads on the UI thread (M5). */
interface DragMetrics {
  cx: number;
  cy: number;
  ringInner: number;
  effectiveGap: number;
  hitRadius: number;
  count: number;
}

/** The orrery's two views; morph between them lands in 13-07 (inert here). */
type OrreryView = "status" | "relationship";

/** The raw sun reads assembled on focus; `resolveSunOccupant` runs at render. */
interface SunRead {
  sunContactId: number | null;
  selfSunColour: string | null;
  selfPhoto: string | null;
  selfName: string;
  /** The M4 two-read occupant, or null when the id is missing/unknown (C2-2). */
  occupant: SunOccupantLookup | null;
  /** The sun-contact's display name (for the initials fallback). */
  sunContactName: string;
}

const DEFAULT_SUN: SunRead = {
  sunContactId: null,
  selfSunColour: null,
  selfPhoto: null,
  selfName: "",
  occupant: null,
  sunContactName: "",
};

/**
 * The relationship-view "muted" outline colour a body morphs toward (ORR-02/04): a
 * desaturated same-hue token per live status. Rogue stays extinguished/cold in BOTH
 * views (no separate muted endpoint) so it fades to its own `fullFill`. Orbiting
 * bodies always carry a live status (never the null never-contacted case).
 */
function mutedBodyFill(
  status: ProfileStatus,
  fullFill: string,
  colors: ThemePalette,
): string {
  switch (status) {
    case "stable":
      return colors.mutedStable;
    case "wobble":
      return colors.mutedWobble;
    case "decay":
      return colors.mutedDecay;
    default:
      return fullFill; // rogue → rogueExtinguished (both views)
  }
}

export function OrreryScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // The bundled initials font (new-to-repo Skia idiom; first proven on device in
  // 13-08 UAT). Null until it loads → the swatch shows with no glyph.
  const fontProvider = useFonts({
    Inter: [require("../../assets/Inter-SemiBold.ttf")],
  });

  const [view, setView] = useState<OrreryView>("status");
  const [orbiting, setOrbiting] = useState<OrbitingContact[]>([]);
  const [sun, setSun] = useState<SunRead>(DEFAULT_SUN);
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });

  // ORR-02 — the SINGLE view-morph shared value (0 = Status default, 1 =
  // Relationship). Every body's angle+colour interpolation reads it on the UI
  // thread; the toggle drives it with one `withTiming` (event-driven, self-
  // terminating — no pause-on-blur needed, unlike the ambient clock).
  const morph = useSharedValue(0);

  // Drive the morph on toggle: set React `view` (chrome/hit-test) AND animate the
  // shared value with a single MORPH_MS ease-in-out timing.
  const onChangeView = useCallback(
    (next: OrreryView) => {
      setView(next);
      morph.value = withTiming(next === "relationship" ? 1 : 0, {
        duration: MORPH_MS,
        easing: Easing.inOut(Easing.ease),
      });
    },
    [morph],
  );

  // Refs the tap handler reads (kept in sync with the render-time placement) so the
  // gesture object stays stable across re-renders.
  const bodiesRef = useRef<OrreryBody[]>([]);
  const sunHitRef = useRef<{
    cx: number;
    cy: number;
    contactId: number | null;
  } | null>(null);
  const hitRadiusRef = useRef(0);
  const sunRadiusRef = useRef(0);

  // Focus read (FuelSearch cancelled-flag pattern): settings → sun occupant
  // (Promise.all, M4) → orbiting set. Offline, async only.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const exec = getExecutor();
          const settings = await getAppSettings(exec);

          let occupant: SunOccupantLookup | null = null;
          let sunContactName = "";
          if (settings.sunContactId !== null) {
            const [header, statusRow] = await Promise.all([
              getContactHeader(exec, settings.sunContactId),
              getContactStatus(exec, settings.sunContactId),
            ]);
            occupant = header
              ? {
                  photo: header.photo,
                  // C2-2: nullable status — never-contacted contact-sun → null.
                  status: statusRow?.status ?? null,
                  archived: header.archived_at !== null,
                }
              : null;
            sunContactName = header?.name ?? "";
          }

          const [selfPhoto, selfProfile, bodies] = await Promise.all([
            getProfilePhoto(exec),
            getProfile(exec),
            listOrbitingContacts(exec, {
              excludeContactId: settings.sunContactId,
            }),
          ]);

          if (cancelled) {
            return;
          }
          setSun({
            sunContactId: settings.sunContactId,
            selfSunColour: settings.selfSunColour,
            selfPhoto,
            selfName: selfProfile?.name ?? "",
            occupant,
            sunContactName,
          });
          setOrbiting(bodies);
        } catch (err) {
          // Offline read-path rule: render with defaults, no error UI.
          Logger.error(LOG_SCOPE, "failed to load orrery", err);
          if (!cancelled) {
            setSun(DEFAULT_SUN);
            setOrbiting([]);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const onCanvasLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvas((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  // C2-4: defer ALL layout until the canvas is measured.
  const dimsValid = canvas.width > 0 && canvas.height > 0;

  // ORR-03 pause-on-blur (Pitfall 4): the ambient clock lives inside OrreryCanvas,
  // so UNMOUNTING that subtree is what stops the loop — gating derived values would
  // not. Mount it only when focused AND foregrounded AND measured. `useIsFocused`
  // (@react-navigation) + an AppState 'change' listener (mirrors HomeScreen) feed a
  // boolean; the RN chrome (header, toggle, empty state) stays mounted regardless.
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => sub.remove();
  }, []);

  // Resolve the sun occupant + glow at render (needs the live palette).
  const resolvedSun = resolveSunOccupant({
    sunContactId: sun.sunContactId,
    selfSunColour: sun.selfSunColour,
    starPalette: colors.starPalette,
    selfPhoto: sun.selfPhoto,
    occupant: sun.occupant,
    colors,
  });
  const sunName =
    resolvedSun.kind === "self" ? sun.selfName : sun.sunContactName;

  // H2/C2-4: ONE metrics object per placement; the SAME `C` feeds render + hit-test.
  const placement = useMemo(() => {
    if (!dimsValid) {
      return null;
    }
    const C = deriveOrreryMetrics(canvas.width, canvas.height, orbiting.length);
    const count = orbiting.length;
    // The resting positions for EACH view — the tap hit-test snaps to whichever
    // view `morph` settled on (a mid-morph tap hits the resting target; accepted).
    const statusBodies: OrreryBody[] = [];
    const restBodies: OrreryBody[] = [];
    const swatchCount = colors.avatarSwatches.length;

    const rings = orbiting.map((c, rank) => {
      const style = orreryRingStyle(c.status, colors);
      const dashed =
        style.strokeStyle === "dashed" || style.strokeStyle === "faintTrace";
      const ringOpacity =
        style.strokeStyle === "faded"
          ? 0.7
          : style.strokeStyle === "faintTrace"
            ? 0.3
            : style.opacity;
      return (
        <Circle
          key={`ring-${c.id}`}
          cx={C.cx}
          cy={C.cy}
          r={ringRadius(rank, C)}
          style="stroke"
          strokeWidth={style.width}
          color={style.color}
          opacity={ringOpacity}
        >
          {dashed ? <DashPathEffect intervals={[6, 6]} phase={0} /> : null}
        </Circle>
      );
    });

    const planets = orbiting.map((c, rank) => {
      const style = orreryRingStyle(c.status, colors);
      const dr = drawnRadius(c.progress, rank, c.status, C);
      // The two morph endpoints — status-progress angle ↔ even-spread angle — on
      // the SAME fixed drawn radius (the shared axis). angleDelta takes the short
      // way across the wrap (Pitfall 2).
      const statusAngle = progressToAngle(c.progress);
      const restAngle = evenSpreadAngle(rank, count);
      const angleDelta = shortestAngleDelta(statusAngle, restAngle);
      const statusPos = polarToXY(C.cx, C.cy, dr, statusAngle);
      const restPos = polarToXY(C.cx, C.cy, dr, restAngle);
      statusBodies.push({ id: c.id, x: statusPos.x, y: statusPos.y });
      restBodies.push({ id: c.id, x: restPos.x, y: restPos.y });
      return (
        <OrbitBody
          key={`body-${c.id}`}
          cx={statusPos.x}
          cy={statusPos.y}
          radius={C.PLANET_RADIUS}
          photo={c.photo}
          bodyFill={style.bodyFill}
          mutedFill={mutedBodyFill(c.status, style.bodyFill, colors)}
          swatch={colors.avatarSwatches[swatchIndex(c.name, swatchCount)]}
          swatchText={colors.avatarSwatchText}
          initials={getInitials(c.name)}
          fontProvider={fontProvider}
          morph={morph}
          orbitRadius={dr}
          statusAngle={statusAngle}
          angleDelta={angleDelta}
        />
      );
    });

    return { C, statusBodies, restBodies, rings, planets };
    // `view` is intentionally NOT a dep: the ELEMENTS + both view endpoints are
    // view-independent (the `morph` shared value drives the interpolation off the
    // JS thread). Only the tap hit-test picks a view (a separate cheap memo below).
  }, [
    dimsValid,
    canvas.width,
    canvas.height,
    orbiting,
    colors,
    fontProvider,
    morph,
  ]);

  // The tap hit-test targets whichever view `morph` has settled on (M5 feeds the
  // SAME resting set into the pan drag's worklet-safe snapshot).
  const hitBodies = useMemo<OrreryBody[]>(() => {
    if (!placement) {
      return [];
    }
    return view === "relationship"
      ? placement.restBodies
      : placement.statusBodies;
  }, [placement, view]);

  // Keep the tap-handler refs in sync with the current placement (render-time
  // assignment is idempotent). The sun hit-target is the resolved occupant.
  if (placement) {
    bodiesRef.current = hitBodies;
    hitRadiusRef.current = placement.C.HIT_RADIUS;
    sunRadiusRef.current = placement.C.SUN_RADIUS;
    sunHitRef.current = {
      cx: placement.C.cx,
      cy: placement.C.cy,
      contactId: resolvedSun.kind === "contact" ? resolvedSun.contactId : null,
    };
  } else {
    bodiesRef.current = [];
    sunHitRef.current = null;
  }

  const handleTap = useCallback(
    (x: number, y: number) => {
      // Planet first (nearest within HIT_RADIUS wins).
      const hit = hitTest(x, y, bodiesRef.current, hitRadiusRef.current);
      if (hit !== null) {
        navigation.navigate("Profile", { contactId: hit });
        return;
      }
      // Then the sun: a contact-occupied sun navigates; a self sun is a no-op.
      const s = sunHitRef.current;
      if (s && s.contactId !== null) {
        const d2 = (x - s.cx) ** 2 + (y - s.cy) ** 2;
        if (d2 <= sunRadiusRef.current ** 2) {
          navigation.navigate("Profile", { contactId: s.contactId });
        }
      }
    },
    [navigation],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(8)
        .onEnd((e) => {
          runOnJS(handleTap)(e.x, e.y);
        }),
    [handleTap],
  );

  // ── ORR-06 radial drag → ring_seq ───────────────────────────────────────────
  // M5: worklet-safe UI-thread snapshots — the resting body positions + a single
  // metrics object — so the pan worklet never reads a plain JS array/number.
  const bodiesShared = useSharedValue<OrreryBody[]>([]);
  const dragMetrics = useSharedValue<DragMetrics>({
    cx: 0,
    cy: 0,
    ringInner: 0,
    effectiveGap: 1,
    hitRadius: 0,
    count: 0,
  });
  const activeDragId = useSharedValue<number | null>(null);
  const dragRadius = useSharedValue(0);

  // Mirror the current resting layout + metrics into the shared values whenever the
  // placement or the settled view changes (M5 — the drag reads THESE, never JS).
  useEffect(() => {
    bodiesShared.value = hitBodies;
    if (placement) {
      dragMetrics.value = {
        cx: placement.C.cx,
        cy: placement.C.cy,
        ringInner: placement.C.ringInner,
        effectiveGap: placement.C.effectiveGap,
        hitRadius: placement.C.HIT_RADIUS,
        count: orbiting.length,
      };
    }
  }, [hitBodies, placement, orbiting.length, bodiesShared, dragMetrics]);

  // The JS-thread commit (off the worklet, via runOnJS): reorder the rendered
  // (sun-excluded) orbiting list and rewrite ring_seq in ONE transaction, threading
  // the current sun occupant as `excludeContactId` so the N−1 dragged list agrees
  // with the DAO's guard (else a contact-sun reorder rolls back on Guard 2). A
  // persist failure alerts + re-reads the persisted truth.
  const commitRingSeq = useCallback(
    async (movedId: number, targetRank: number) => {
      const fromRank = orbiting.findIndex((c) => c.id === movedId);
      if (fromRank < 0) {
        return;
      }
      const currentOrderedIds = orbiting.map((c) => c.id);
      const newIds = computeRingReorder(
        currentOrderedIds,
        fromRank,
        targetRank,
      );
      try {
        const exec = getExecutor();
        await rewriteRingSeq(exec, newIds, localDateTime(), sun.sunContactId);
        // Reflow: re-read the dense rank/radius from the persisted order.
        const bodies = await listOrbitingContacts(exec, {
          excludeContactId: sun.sunContactId,
        });
        setOrbiting(bodies);
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to commit ring reorder", err);
        Alert.alert(
          "Couldn't reorder",
          "That change didn't stick. Please try again.",
        );
        // Restore the on-screen order to the persisted truth.
        try {
          const bodies = await listOrbitingContacts(getExecutor(), {
            excludeContactId: sun.sunContactId,
          });
          setOrbiting(bodies);
        } catch (reErr) {
          Logger.error(
            LOG_SCOPE,
            "failed to reload after reorder error",
            reErr,
          );
        }
      }
    },
    [orbiting, sun.sunContactId],
  );

  // Latest-ref so the (stable) pan gesture always calls the current commit closure.
  const commitRef = useRef(commitRingSeq);
  useEffect(() => {
    commitRef.current = commitRingSeq;
  }, [commitRingSeq]);
  const commitFromWorklet = useCallback(
    (movedId: number, targetRank: number) => {
      void commitRef.current(movedId, targetRank);
    },
    [],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(PAN_MIN_DISTANCE)
        .onBegin((e) => {
          // Hit-test the touch-down body ON THE UI THREAD against the worklet-safe
          // snapshot (a worklet-inline `hitTest`; nearest within HIT_RADIUS wins).
          const bodies = bodiesShared.value;
          const hr = dragMetrics.value.hitRadius;
          let best: number | null = null;
          let bestD2 = hr * hr;
          for (let i = 0; i < bodies.length; i++) {
            const b = bodies[i];
            const d2 = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
            if (d2 <= bestD2) {
              bestD2 = d2;
              best = b.id;
            }
          }
          activeDragId.value = best;
        })
        .onUpdate((e) => {
          if (activeDragId.value === null) {
            return;
          }
          // Radius only — the angular component is ignored (live ghost-ring preview).
          const m = dragMetrics.value;
          const dx = e.x - m.cx;
          const dy = e.y - m.cy;
          dragRadius.value = Math.sqrt(dx * dx + dy * dy);
        })
        .onEnd((e) => {
          if (activeDragId.value === null) {
            return;
          }
          // H2: release radius → clamped rank via the SAME metrics object as render
          // + hit-test (C.ringInner / C.effectiveGap; effectiveGap is floored > 0).
          const m = dragMetrics.value;
          const dx = e.x - m.cx;
          const dy = e.y - m.cy;
          const releaseRadius = Math.sqrt(dx * dx + dy * dy);
          const maxRank = Math.max(0, m.count - 1);
          const rawRank = Math.round(
            (releaseRadius - m.ringInner) / m.effectiveGap,
          );
          const targetRank = Math.max(0, Math.min(rawRank, maxRank));
          runOnJS(commitFromWorklet)(activeDragId.value, targetRank);
        })
        .onFinalize(() => {
          activeDragId.value = null;
          dragRadius.value = 0;
        }),
    [bodiesShared, dragMetrics, activeDragId, dragRadius, commitFromWorklet],
  );

  // Gesture.Race: a stationary touch → tap → Profile; movement past the threshold
  // → the radial drag (both first hit-test the touch-down body).
  const canvasGesture = useMemo(
    () => Gesture.Race(tapGesture, panGesture),
    [tapGesture, panGesture],
  );

  // The accent ghost-ring drag preview: the target rank's ring radius, shown only
  // while a body is being dragged. cx/cy are the fixed canvas centre; r + opacity
  // derive off the drag shared values (UI thread).
  const ghostRingRadius = useDerivedValue(() => {
    const m = dragMetrics.value;
    const raw = (dragRadius.value - m.ringInner) / m.effectiveGap;
    const maxRank = Math.max(0, m.count - 1);
    const rank = Math.max(0, Math.min(Math.round(raw), maxRank));
    return m.ringInner + rank * m.effectiveGap;
  });
  const ghostRingOpacity = useDerivedValue(() =>
    activeDragId.value === null ? 0 : GHOST_OPACITY,
  );

  // Ambient star tones — passed as tokens (check:colors) into OrreryCanvas.
  const starColors = useMemo(
    () => [colors.textSecondary, colors.textPrimary, ...colors.starPalette],
    [colors],
  );

  // The single mount gate for the clock-owning subtree (pause-on-blur).
  const canvasVisible =
    dimsValid && placement !== null && isFocused && appActive;

  const isEmpty = orbiting.length === 0;

  return (
    <View
      testID="orrery-root"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Pressable
          testID="orrery-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Orbit
        </Text>
      </View>

      <View style={styles.toggleRow}>
        <SegmentedControl<OrreryView>
          options={[
            { label: "Status", value: "status" },
            { label: "Relationship", value: "relationship" },
          ]}
          value={view}
          onChange={onChangeView}
        />
      </View>

      <View
        testID="orrery-canvas-container"
        style={styles.canvasArea}
        onLayout={onCanvasLayout}
      >
        {canvasVisible && placement ? (
          <OrreryCanvas
            width={canvas.width}
            height={canvas.height}
            background={colors.background}
            starColors={starColors}
            gesture={canvasGesture}
          >
            <Group>{placement.rings}</Group>
            {/* Accent ghost-ring drag preview (hidden until a drag is active). */}
            <Circle
              cx={placement.C.cx}
              cy={placement.C.cy}
              r={ghostRingRadius}
              style="stroke"
              strokeWidth={GHOST_STROKE}
              color={colors.accent}
              opacity={ghostRingOpacity}
            />
            <Group>{placement.planets}</Group>
            <SunBody
              cx={placement.C.cx}
              cy={placement.C.cy}
              radius={placement.C.SUN_RADIUS}
              glowRadius={placement.C.SUN_GLOW_RADIUS}
              photo={resolvedSun.photo}
              glowColor={resolvedSun.glowColor}
              swatch={
                colors.avatarSwatches[
                  swatchIndex(sunName, colors.avatarSwatches.length)
                ]
              }
              swatchText={colors.avatarSwatchText}
              initials={getInitials(sunName)}
              fontProvider={fontProvider}
            />
          </OrreryCanvas>
        ) : null}

        {isEmpty ? (
          <View
            testID="orrery-empty"
            style={styles.emptyOverlay}
            pointerEvents="none"
          >
            <Text style={[styles.emptyHeading, { color: colors.textPrimary }]}>
              Your orbit is empty
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              Mark someone as contacted and they'll start orbiting you. Add a
              first interaction from the dashboard.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  backBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  toggleRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  canvasArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyHeading: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
});
