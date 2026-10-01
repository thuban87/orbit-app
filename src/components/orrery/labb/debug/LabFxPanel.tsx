// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is semantic typography.
/**
 * ORRERY LAB B — the lab marker + effect toggle panel (research 03 §4).
 *
 * The "ORRERY LAB B — SKIA UNLEASHED" marker is long-pressable (outside the
 * canvas, so no gesture conflict) and opens a non-modal bottom panel that
 * controls:
 * - the renderer A/B switch (`lab` ↔ `legacy`), live;
 * - every flag in `LAB_FLAG_REGISTRY` (rendered generically);
 * - the global intensity;
 * - a forced reduced-motion override (OS / On / Off), app-wide and live;
 * - camera presets (adb cannot pinch): zoom far / overview / identity / detail
 *   / near, tilt and yaw — applied through the camera's normal `recover` path;
 * - quick System switching through the screen's normal store `select`, plus
 *   "replay last switch" (re-selects the previous System). WP-2.1: with
 *   "close on switch" (default ON) the panel closes and the switch fires
 *   ~0.7 s later, so recordings see the whole switch.
 *
 * Gated on the Lab B applicationId (not `__DEV__`) so release-build profiling
 * works (C-08). In any other build only the plain marker renders.
 */
import Constants from "expo-constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { runOnUI, type SharedValue } from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import type { SystemCatalogEntry } from "@/db/systems-catalog-read";
import {
  type CameraPose,
  IDENTITY_ZOOM,
  MAX_TILT,
  MAX_ZOOM,
} from "@/logic/orrery-camera-logic";
import type { OrrerySystemRef } from "@/logic/orrery-system-logic";
import {
  LAB_FLAG_REGISTRY,
  type LabFlagId,
  type LabFlagSpec,
  type LabReducedMotionMode,
  useLabFxStore,
} from "@/stores/orrery-labb-fx-store";
import { useThemeStore } from "@/stores/theme-store";
import type { ThemePalette } from "@/theme/theme-types";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { labEffectStatuses } from "../labb-effects";

const LAB_B_PACKAGE = "com.bwales.orbit.labb";

export function isLabBBuild(): boolean {
  return Constants.expoConfig?.android?.package === LAB_B_PACKAGE;
}

// --- Camera presets (semantic levels: identity ≥ 2, detail ≥ 3) ----------------
const ZOOM_PRESETS: readonly { id: string; label: string; zoom: number }[] = [
  { id: "far", label: "Far 0.4", zoom: 0.4 },
  { id: "overview", label: "Overview 1", zoom: 1 },
  { id: "identity", label: "Identity 2.2", zoom: IDENTITY_ZOOM + 0.2 },
  { id: "detail", label: "Detail 3.2", zoom: 3.2 },
  { id: "near", label: "Near 4", zoom: MAX_ZOOM },
];
const TILT_PRESETS: readonly { id: string; label: string; tilt: number }[] = [
  { id: "flat", label: "Tilt 0", tilt: 0 },
  { id: "mid", label: "Tilt 30°", tilt: Math.PI / 6 },
  { id: "max", label: "Tilt max", tilt: MAX_TILT },
];
const YAW_PRESETS: readonly { id: string; label: string; yaw: number }[] = [
  { id: "north", label: "Yaw 0", yaw: 0 },
  { id: "east", label: "Yaw 90°", yaw: Math.PI / 2 },
  { id: "south", label: "Yaw 180°", yaw: Math.PI },
];

type Recover = (target: CameraPose) => void;

/** Delay between closing the panel and firing a quick switch (ms). */
const SWITCH_AFTER_CLOSE_MS = 700;

function Chip({
  label,
  active,
  colors,
  onPress,
  testID,
}: {
  label: string;
  active?: boolean;
  colors: ThemePalette;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? colors.accent : colors.border,
          backgroundColor: active ? colors.accent : colors.surface,
        },
      ]}
    >
      <AppText
        role="caption"
        style={{ color: active ? colors.onAccent : colors.textPrimary }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ThemePalette;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <AppText role="label" style={{ color: colors.textSecondary }}>
        {title}
      </AppText>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

export function LabFxPanel({
  colors,
  pose,
  recover,
  catalog,
  currentSystemId,
  onSelectSystem,
  onClose,
  previousSystem,
  closeOnSwitch,
  setCloseOnSwitch,
}: {
  colors: ThemePalette;
  pose: SharedValue<CameraPose>;
  recover: Recover;
  catalog: readonly SystemCatalogEntry[];
  currentSystemId: string | null;
  onSelectSystem: (ref: OrrerySystemRef, name: string) => void;
  onClose: () => void;
  /** Owned by the host so "replay" survives the panel closing (WP-2.1). */
  previousSystem: { current: { ref: OrrerySystemRef; name: string } | null };
  closeOnSwitch: boolean;
  setCloseOnSwitch: (value: boolean) => void;
}) {
  const renderer = useLabFxStore((s) => s.renderer);
  const flags = useLabFxStore((s) => s.flags);
  const intensity = useLabFxStore((s) => s.intensity);
  const reducedMotion = useLabFxStore((s) => s.reducedMotion);
  const store = useLabFxStore.getState;
  const applyPose = useCallback(
    (patch: Partial<CameraPose>) => {
      runOnUI((p: Partial<CameraPose>) => {
        "worklet";
        recover({ ...pose.value, ...p });
      })(patch);
    },
    [pose, recover],
  );
  // WP-2.1: with "close on switch" the panel closes FIRST and the switch fires
  // after a short delay, so a recording sees the whole switch unobstructed.
  const fire = (ref: OrrerySystemRef, name: string) => {
    if (!closeOnSwitch) {
      onSelectSystem(ref, name);
      return;
    }
    onClose();
    setTimeout(() => onSelectSystem(ref, name), SWITCH_AFTER_CLOSE_MS);
  };
  const select = (entry: SystemCatalogEntry) => {
    const current = catalog.find((e) => e.id === currentSystemId);
    if (current && current.id !== entry.id)
      previousSystem.current = { ref: current.ref, name: current.name };
    fire(entry.ref, entry.name);
  };
  const replay = () => {
    const prev = previousSystem.current;
    if (!prev) return;
    const current = catalog.find((e) => e.id === currentSystemId);
    previousSystem.current = current
      ? { ref: current.ref, name: current.name }
      : null;
    fire(prev.ref, prev.name);
  };
  const statuses = labEffectStatuses();
  const sections: { key: LabFlagSpec["section"]; title: string }[] = [
    { key: "layers", title: "Layers" },
    { key: "effects", title: "Effects" },
    { key: "debug", title: "Debug" },
  ];
  return (
    <View
      testID="labb-fx-panel"
      style={[
        styles.panel,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <AppText role="label" style={{ color: colors.textPrimary }}>
          Lab B panel
        </AppText>
        <View style={styles.row}>
          <Chip label="Reset" colors={colors} onPress={() => store().reset()} />
          <Chip
            testID="labb-fx-close"
            label="Close"
            colors={colors}
            onPress={onClose}
          />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Systems (quick switch)" colors={colors}>
          {catalog
            .filter((entry) => !entry.hidden)
            .map((entry) => (
              <Chip
                key={entry.id}
                label={entry.name}
                active={entry.id === currentSystemId}
                colors={colors}
                onPress={() => select(entry)}
              />
            ))}
          <Chip label="Replay last switch" colors={colors} onPress={replay} />
          <Chip
            label={
              closeOnSwitch ? "Close on switch: ON" : "Close on switch: off"
            }
            active={closeOnSwitch}
            colors={colors}
            onPress={() => setCloseOnSwitch(!closeOnSwitch)}
          />
        </Section>
        <Section title="Renderer (A/B)" colors={colors}>
          <Chip
            label="Lab"
            active={renderer === "lab"}
            colors={colors}
            onPress={() => store().setRenderer("lab")}
          />
          <Chip
            label="Legacy"
            active={renderer === "legacy"}
            colors={colors}
            onPress={() => store().setRenderer("legacy")}
          />
        </Section>
        <Section title="Camera zoom (semantic levels)" colors={colors}>
          {ZOOM_PRESETS.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              colors={colors}
              onPress={() => applyPose({ zoom: p.zoom })}
            />
          ))}
        </Section>
        <Section title="Camera tilt / yaw" colors={colors}>
          {TILT_PRESETS.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              colors={colors}
              onPress={() => applyPose({ tilt: p.tilt })}
            />
          ))}
          {YAW_PRESETS.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              colors={colors}
              onPress={() => applyPose({ yaw: p.yaw })}
            />
          ))}
          <Chip
            label="Pan to sun"
            colors={colors}
            onPress={() => applyPose({ x: 0, y: 0 })}
          />
        </Section>
        <Section title="Reduced motion (forced, app-wide)" colors={colors}>
          {(["os", "on", "off"] as LabReducedMotionMode[]).map((mode) => (
            <Chip
              key={mode}
              label={mode === "os" ? "Follow OS" : mode === "on" ? "On" : "Off"}
              active={reducedMotion === mode}
              colors={colors}
              onPress={() => store().setReducedMotion(mode)}
            />
          ))}
        </Section>
        <Section title={`Intensity ${intensity.toFixed(2)}`} colors={colors}>
          <Chip
            label="−0.25"
            colors={colors}
            onPress={() => store().setIntensity(intensity - 0.25)}
          />
          <Chip
            label="1.00"
            colors={colors}
            onPress={() => store().setIntensity(1)}
          />
          <Chip
            label="+0.25"
            colors={colors}
            onPress={() => store().setIntensity(intensity + 0.25)}
          />
        </Section>
        {sections.map((section) => {
          const specs = (LAB_FLAG_REGISTRY as readonly LabFlagSpec[]).filter(
            (f) => f.section === section.key,
          );
          if (specs.length === 0) return null;
          return (
            <Section key={section.key} title={section.title} colors={colors}>
              {specs.map((spec) => {
                const id = spec.id as keyof typeof flags;
                return (
                  <Chip
                    key={spec.id}
                    label={`${flags[id] ? "ON" : "off"} · ${spec.label}`}
                    active={flags[id]}
                    colors={colors}
                    onPress={() => store().toggleFlag(id)}
                  />
                );
              })}
            </Section>
          );
        })}
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          {`Effects: ${Object.entries(statuses)
            .map(([name, s]) => `${name}=${s}`)
            .join("  ")}`}
        </AppText>
      </ScrollView>
    </View>
  );
}

/** A parsed `orbit://labb?...` command (lab build only; see LabBMarkerHost). */
export interface LabCommand {
  reset: boolean;
  renderer?: "lab" | "legacy";
  rm?: LabReducedMotionMode;
  intensity?: number;
  /** Switch duration multiplier (debug slow-motion). */
  slowmo?: number;
  flags: [string, boolean][];
  pose?: Partial<CameraPose>;
  system?: string;
  /** R1: focus the first System member with this name (normal intent path). */
  focus?: string;
  /** R1: clear the focus (normal companion "Clear focus" path). */
  clear: boolean;
  /** R1: in-memory theme switch `galaxy:dark` (never persisted). */
  theme?: { pkg: "galaxy" | "standard"; mode: "light" | "dark" };
  replay: boolean;
  delay: number;
  panel?: boolean;
}

/**
 * Parse `orbit://labb?flags=fx:0,fxStreaks:1&system=Lab%20B%20Dense&rm=on
 * &intensity=0.75&zoom=2.2&tilt=0.5&yaw=1.57&renderer=legacy&replay=1
 * &delay=0&panel=0&reset=1`. Null for any other URL. Unknown flag ids are
 * dropped (only registry ids reach the store).
 */
export function parseLabCommand(url: string): LabCommand | null {
  const m = /^orbit:\/\/labb\/?\?(.*)$/.exec(url);
  if (!m) return null;
  const q = new Map<string, string>();
  for (const part of m[1].split("&")) {
    const [k, v = ""] = part.split("=");
    if (k)
      q.set(decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, " ")));
  }
  const ids = new Set(LAB_FLAG_REGISTRY.map((f) => f.id as string));
  const flags: [string, boolean][] = (q.get("flags") ?? "")
    .split(",")
    .filter(Boolean)
    .map((pair) => pair.split(":"))
    .filter(([id]) => ids.has(id))
    .map(([id, v]) => [id, v === "1" || v === "on" || v === "true"]);
  const num = (key: string) => {
    const v = q.get(key);
    const n = v === undefined ? Number.NaN : Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const pose: Partial<CameraPose> = {};
  for (const key of ["zoom", "tilt", "yaw", "x", "y"] as const) {
    const n = num(key);
    if (n !== undefined) pose[key] = n;
  }
  const rm = q.get("rm");
  const renderer = q.get("renderer");
  const panel = q.get("panel");
  return {
    reset: q.get("reset") === "1",
    renderer:
      renderer === "lab" || renderer === "legacy" ? renderer : undefined,
    rm: rm === "on" || rm === "off" || rm === "os" ? rm : undefined,
    intensity: num("intensity"),
    slowmo: num("slowmo"),
    flags,
    pose: Object.keys(pose).length ? pose : undefined,
    system: q.get("system") || undefined,
    focus: q.get("focus") || undefined,
    clear: q.get("clear") === "1",
    theme: (() => {
      const [pkg, mode] = (q.get("theme") ?? "").split(":");
      return (pkg === "galaxy" || pkg === "standard") &&
        (mode === "light" || mode === "dark")
        ? { pkg, mode }
        : undefined;
    })(),
    replay: q.get("replay") === "1",
    delay: num("delay") ?? 0,
    panel: panel === undefined ? undefined : panel === "1",
  };
}

/** WP-1.3: the marker is a small, dimmed "LAB B" tag in the bottom-left
 * corner (it used to span the bottom centre over the scene). */
const MARKER_OPACITY = 0.75;

/** The marker (long-press opens the panel) + the panel itself. */
export function LabBMarkerHost({
  colors,
  pose,
  recover,
  catalog,
  currentSystemId,
  onSelectSystem,
  onLabFocus,
}: {
  colors: ThemePalette;
  pose: SharedValue<CameraPose>;
  recover: Recover;
  catalog: readonly SystemCatalogEntry[];
  currentSystemId: string | null;
  onSelectSystem: (ref: OrrerySystemRef, name: string) => void;
  /** R1 deep link: focus a member by name (null = clear focus). */
  onLabFocus?: (name: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [closeOnSwitch, setCloseOnSwitch] = useState(true);
  const previousSystem = useRef<{ ref: OrrerySystemRef; name: string } | null>(
    null,
  );
  const lab = isLabBBuild();
  // WP-2.1 adb remote control (lab build only): `orbit://labb?...` VIEW
  // intents drive the same store / select / camera paths as the panel, so a
  // recording never has the panel in frame and A/B runs are repeatable.
  const latest = useRef({
    catalog,
    currentSystemId,
    onSelectSystem,
    recover,
    onLabFocus,
  });
  latest.current = {
    catalog,
    currentSystemId,
    onSelectSystem,
    recover,
    onLabFocus,
  };
  useEffect(() => {
    if (!lab) return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      const cmd = parseLabCommand(url);
      if (!cmd) return;
      const l = latest.current;
      const store = useLabFxStore.getState();
      if (cmd.reset) store.reset();
      if (cmd.theme) {
        // Session-only (the store is hydrated from app_settings at boot).
        const theme = useThemeStore.getState();
        theme.setPackage(cmd.theme.pkg);
        useThemeStore.getState().setModeForActivePackage(cmd.theme.mode);
      }
      if (cmd.renderer) store.setRenderer(cmd.renderer);
      if (cmd.rm) store.setReducedMotion(cmd.rm);
      if (cmd.intensity !== undefined) store.setIntensity(cmd.intensity);
      if (cmd.slowmo !== undefined) store.setSwitchTimeScale(cmd.slowmo);
      for (const [id, on] of cmd.flags) store.setFlag(id as LabFlagId, on);
      if (cmd.pose) {
        const patch = cmd.pose;
        const rec = l.recover;
        // R2: honour `delay` (the VIEW intent remounts the Orrery, whose Home
        // framing would otherwise overwrite an immediate pose).
        setTimeout(
          () =>
            runOnUI((p: Partial<CameraPose>) => {
              "worklet";
              rec({ ...pose.value, ...p });
            })(patch),
          cmd.delay,
        );
      }
      const go = (ref: OrrerySystemRef, name: string) => {
        const current = l.catalog.find((e) => e.id === l.currentSystemId);
        if (current && current.name !== name)
          previousSystem.current = { ref: current.ref, name: current.name };
        setTimeout(() => l.onSelectSystem(ref, name), cmd.delay);
      };
      if (cmd.system) {
        const entry = l.catalog.find((e) => e.name === cmd.system);
        if (entry) go(entry.ref, entry.name);
      } else if (cmd.replay && previousSystem.current) {
        const prev = previousSystem.current;
        go(prev.ref, prev.name);
      }
      if ((cmd.focus || cmd.clear) && l.onLabFocus) {
        const target = cmd.focus ?? null;
        const run = l.onLabFocus;
        setTimeout(() => run(target), cmd.delay);
      }
      if (cmd.panel !== undefined) setOpen(cmd.panel);
    });
    return () => sub.remove();
  }, [lab, pose]);
  return (
    <>
      <Pressable
        testID="labb-marker"
        disabled={!lab}
        onLongPress={() => setOpen(true)}
        delayLongPress={400}
        accessibilityRole={lab ? "button" : undefined}
        accessibilityLabel="Orrery Lab B experiment build"
        accessibilityHint={
          lab ? "Long press to open the Lab B panel" : undefined
        }
        style={styles.marker}
      >
        <AppText
          role="caption"
          style={{ color: colors.accentText, opacity: MARKER_OPACITY }}
        >
          LAB B
        </AppText>
      </Pressable>
      {open && lab ? (
        <LabFxPanel
          colors={colors}
          pose={pose}
          recover={recover}
          catalog={catalog}
          currentSystemId={currentSystemId}
          onSelectSystem={onSelectSystem}
          onClose={() => setOpen(false)}
          previousSystem={previousSystem}
          closeOnSwitch={closeOnSwitch}
          setCloseOnSwitch={setCloseOnSwitch}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  marker: {
    position: "absolute",
    bottom: SPACING.xs,
    left: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  panel: {
    position: "absolute",
    left: SPACING.sm,
    right: SPACING.sm,
    bottom: SPACING.lg,
    maxHeight: "58%",
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingTop: SPACING.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
  },
  content: { padding: SPACING.md, gap: SPACING.sm },
  section: { gap: SPACING.xs },
  row: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  chip: {
    borderWidth: 1,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
});
