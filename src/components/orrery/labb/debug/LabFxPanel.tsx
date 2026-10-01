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
 *   "replay last switch" (re-selects the previous System).
 *
 * Gated on the Lab B applicationId (not `__DEV__`) so release-build profiling
 * works (C-08). In any other build only the plain marker renders.
 */
import Constants from "expo-constants";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
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
  type LabFlagSpec,
  type LabReducedMotionMode,
  useLabFxStore,
} from "@/stores/orrery-labb-fx-store";
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
}: {
  colors: ThemePalette;
  pose: SharedValue<CameraPose>;
  recover: Recover;
  catalog: readonly SystemCatalogEntry[];
  currentSystemId: string | null;
  onSelectSystem: (ref: OrrerySystemRef, name: string) => void;
  onClose: () => void;
}) {
  const renderer = useLabFxStore((s) => s.renderer);
  const flags = useLabFxStore((s) => s.flags);
  const intensity = useLabFxStore((s) => s.intensity);
  const reducedMotion = useLabFxStore((s) => s.reducedMotion);
  const store = useLabFxStore.getState;
  const previousSystem = useRef<{ ref: OrrerySystemRef; name: string } | null>(
    null,
  );
  const applyPose = useCallback(
    (patch: Partial<CameraPose>) => {
      runOnUI((p: Partial<CameraPose>) => {
        "worklet";
        recover({ ...pose.value, ...p });
      })(patch);
    },
    [pose, recover],
  );
  const select = (entry: SystemCatalogEntry) => {
    const current = catalog.find((e) => e.id === currentSystemId);
    if (current && current.id !== entry.id)
      previousSystem.current = { ref: current.ref, name: current.name };
    onSelectSystem(entry.ref, entry.name);
  };
  const replay = () => {
    const prev = previousSystem.current;
    if (!prev) return;
    const current = catalog.find((e) => e.id === currentSystemId);
    previousSystem.current = current
      ? { ref: current.ref, name: current.name }
      : null;
    onSelectSystem(prev.ref, prev.name);
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

/** The marker (long-press opens the panel) + the panel itself. */
export function LabBMarkerHost({
  colors,
  pose,
  recover,
  catalog,
  currentSystemId,
  onSelectSystem,
}: {
  colors: ThemePalette;
  pose: SharedValue<CameraPose>;
  recover: Recover;
  catalog: readonly SystemCatalogEntry[];
  currentSystemId: string | null;
  onSelectSystem: (ref: OrrerySystemRef, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const lab = isLabBBuild();
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
        <AppText role="caption" style={{ color: colors.accentText }}>
          ORRERY LAB B — SKIA UNLEASHED
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
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  marker: {
    position: "absolute",
    bottom: SPACING.xs,
    alignSelf: "center",
    paddingHorizontal: SPACING.sm,
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
