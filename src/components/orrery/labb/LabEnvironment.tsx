/**
 * ORRERY LAB B — L0 deep environment (WP-1.1).
 *
 * Back to front:
 * 1. Sky + NEBULA. Default: a seamlessly tiling DENSITY texture (lobe A, lobe
 *    B, dust) is baked ONCE at Orrery entry (`nebulaBake`, 512² at ~0.3
 *    texel/dp) and sampled every frame by `nebulaSample` (one texture fetch per
 *    pixel + token colouring + parallax + drift/breathing warp + vignette +
 *    dither). A/B flag `nebulaLive` swaps in the same nebula computed LIVE at
 *    full resolution (`nebulaLive`) to measure what the bake saves.
 *    Colours are uniforms from palette tokens (profile `env`), so a theme change
 *    never rebakes.
 * 2. STARFIELD: three depth layers in two Atlas draws — FAR (static colours, one
 *    crisp dot sprite) and MID+NEAR (twinkling via the colour buffer; soft glow
 *    and diffraction-spike sprites on dark themes). The sprite atlas is an
 *    alpha MASK tinted per star from tokens (`modulate`).
 *
 * Parallax reads ONLY the animated frame (`labSkyPose(frame.value)`), never
 * `pose`: during a System switch the displayed camera is the sampled one
 * (research 03 §0.3).
 *
 * Reduced motion: drift, breathing and twinkle freeze in a fixed composition;
 * parallax still follows the user's own gestures (user-driven motion).
 *
 * Fallbacks: a null effect (SkSL/driver failure or the panel's force-fallback)
 * renders the plain token `Fill`; the starfield needs no runtime effect.
 *
 * Every per-frame value is a SharedValue (derived / buffer mapper); React
 * renders only on mount, theme or flag changes.
 */
import {
  Atlas,
  Circle,
  Fill,
  Group,
  ImageShader,
  LinearGradient,
  RadialGradient,
  Rect,
  rect,
  Shader,
  type SkImage,
  type SkRSXform,
  useColorBuffer,
  useRSXformBuffer,
  useTexture,
  vec,
} from "@shopify/react-native-skia";
import { useMemo, useState } from "react";
import {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
} from "react-native-reanimated";
import { MIN_ZOOM } from "@/logic/orrery-camera-logic";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import type { LabFlags, LabFxSnapshot } from "@/stores/orrery-labb-fx-store";
import {
  LAB_SPRITE_MASK,
  LAB_SPRITE_MASK_CLEAR,
  LAB_SPRITE_MASK_HALO,
  type LabFxProfile,
  labColor,
} from "@/theme/orrery-lab-fx";
import type { ThemePalette } from "@/theme/theme-types";
import { useLabRenderContext } from "./labb-context";
import { getLabEffect } from "./labb-effects";
import {
  buildStarField,
  type LabStarLayerSpec,
  labSkyPose,
  NEBULA_FACTOR,
  placeSkyPoint,
  S_ALPHA,
  S_CELL,
  S_LAYER,
  S_PHASE,
  S_RANK,
  S_SIZE,
  S_SPEED,
  S_TONE,
  S_X,
  S_Y,
  STAR_CELL_DOT,
  STAR_STRIDE,
  skyLayerPlacement,
  starTileSize,
} from "./labb-sky";
import { mixVec, tokenToVec3, type Vec3 } from "./labb-uniforms";

// --- Tunables -----------------------------------------------------------------
/** Baked density texture (square, seamlessly tiling). */
const NEB_TEX = 512;
const NEB_TEX_SIZE = { width: NEB_TEX, height: NEB_TEX };
/** Noise lattice period across the texture (base cells per tile). */
const NEB_PERIOD = 8;
/** Texels per dp: tile = 512 / 0.3 ≈ 1700 dp, base cloud cell ≈ 213 dp. */
const NEB_TEXELS_PER_DP = 0.3;
/** Ambient drift: a slow Lissajous (dp amplitude, s period) — bounded, never walks off. */
const DRIFT_X = 26;
const DRIFT_Y = 18;
const DRIFT_PX = 95;
const DRIFT_PY = 131;
/** Breathing warp: amplitude (dp) oscillating over BREATH_S seconds. */
const WARP_DP = 9;
const BREATH_S = 40;
/** Frozen composition used under reduced motion / drift off (seconds). */
const STILL_T = 23;

/** Star sprite atlas: three square cells, drawn once as an alpha mask. */
const CELL = 32;
const ATLAS_SIZE = { width: CELL * 3, height: CELL };
/** Visual diameter (texels) of each cell's star core, used to size sprites. */
const CELL_CORE = [12, 13, 9] as const;

const FAR: LabStarLayerSpec = {
  count: 760,
  factor: 0.03,
  sizeMin: 0.8,
  sizeMax: 1.9,
  alphaMin: 0.3,
  alphaMax: 0.8,
  twinkle: 0,
  spikes: 0,
};
const MID: LabStarLayerSpec = {
  count: 300,
  factor: 0.1,
  sizeMin: 1.3,
  sizeMax: 2.8,
  alphaMin: 0.45,
  alphaMax: 0.95,
  twinkle: 1,
  spikes: 0,
};
const NEAR: LabStarLayerSpec = {
  count: 110,
  factor: 0.22,
  sizeMin: 2.4,
  sizeMax: 6,
  alphaMin: 0.55,
  alphaMax: 1,
  twinkle: 0.7,
  spikes: 0.14,
};
/** Twinkle speed (rad/s) per unit star speed. */
const TWINKLE_RATE = 1.1;

// --- Worklet helpers (declared ABOVE their callers) ----------------------------

/** The effect-strength scalar: profile × panel intensity. */
function envScale(profile: number, fx: LabFxSnapshot | null): number {
  "worklet";
  return profile * (fx ? fx.intensity : 1);
}

/** Per-frame nebula uniforms (parallax from the DISPLAYED camera). */
function nebulaFrameUniforms(
  frame: AnimatedFrame,
  flags: LabFlags | null,
  timeMs: number,
  reduced: boolean,
): {
  uVC: number[];
  uOff: number[];
  uRot: number;
  uScale: number;
  uDrift: number[];
  uWarp: number;
  uTime: number;
} {
  "worklet";
  const sky = labSkyPose(frame);
  const parallax = flags ? flags.parallax : true;
  const place = skyLayerPlacement(sky, NEBULA_FACTOR, parallax);
  const animate = !reduced && (flags ? flags.nebulaDrift : true);
  const t = animate ? (timeMs / 1000) % 1000 : STILL_T;
  const tau = Math.PI * 2;
  return {
    uVC: [sky.vx, sky.vy],
    uOff: [place.ox, place.oy],
    uRot: parallax ? sky.yaw : 0,
    uScale: place.zs,
    uDrift: [
      Math.sin((t * tau) / DRIFT_PX) * DRIFT_X,
      Math.cos((t * tau) / DRIFT_PY) * DRIFT_Y,
    ],
    uWarp: WARP_DP * (0.55 + 0.45 * Math.sin((t * tau) / BREATH_S)),
    uTime: t,
  };
}

// --- Static (React-side) uniform blocks ----------------------------------------

interface NebulaStatic {
  uRes: number[];
  uSky: Vec3;
  uLobeA: Vec3;
  uLobeB: Vec3;
  uEmber: Vec3;
  uVigTone: Vec3;
  uTexPerDp: number;
  uTexSize: number;
  uPer: number;
  strA: number;
  strB: number;
  glow: number;
  ember: number;
  dust: number;
  vig: number;
  intensity: number;
}

function nebulaStatic(
  width: number,
  height: number,
  colors: ThemePalette,
  background: string,
  profile: LabFxProfile,
): NebulaStatic {
  const env = profile.env;
  const sky = tokenToVec3(background);
  const pick = (i: number) =>
    colors.starPalette[
      Math.min(Math.max(0, i), colors.starPalette.length - 1)
    ] ?? background;
  // Dark: corners sink toward a darker shade of the sky token itself;
  // light: corners wash toward a token (vellum edge).
  const vigTone: Vec3 = env.vignetteTone
    ? tokenToVec3(labColor(colors, env.vignetteTone))
    : mixVec(sky, [0, 0, 0] as Vec3, env.vignetteShade);
  return {
    uRes: [width, height],
    uSky: sky,
    uLobeA: tokenToVec3(labColor(colors, env.lobeA)),
    uLobeB: tokenToVec3(pick(env.lobeBStar)),
    uEmber: tokenToVec3(pick(env.emberStar)),
    uVigTone: vigTone,
    uTexPerDp: NEB_TEXELS_PER_DP,
    uTexSize: NEB_TEX,
    uPer: NEB_PERIOD,
    strA: env.strengthA,
    strB: env.strengthB,
    glow: env.glow,
    ember: env.ember,
    dust: env.dust,
    vig: env.vignette,
    intensity: profile.intensity,
  };
}

function useNebulaUniforms(
  frame: SharedValue<AnimatedFrame>,
  st: NebulaStatic,
  withTexSize: boolean,
) {
  const ctx = useLabRenderContext();
  const ambient = ctx?.ambient;
  const fxFlags = ctx?.fxFlags;
  const reducedMotion = ctx?.reducedMotion;
  return useDerivedValue(() => {
    const fx = fxFlags ? fxFlags.value : null;
    const flags = fx ? fx.flags : null;
    const k = envScale(st.intensity, fx);
    const dyn = nebulaFrameUniforms(
      frame.value,
      flags,
      ambient ? ambient.value : 0,
      reducedMotion ? reducedMotion.value : false,
    );
    const vignette = flags ? flags.vignette : true;
    const base = {
      ...dyn,
      uRes: st.uRes,
      uSky: st.uSky,
      uLobeA: st.uLobeA,
      uLobeB: st.uLobeB,
      uEmber: st.uEmber,
      uVigTone: st.uVigTone,
      uTexPerDp: st.uTexPerDp,
      uStrA: Math.min(1, st.strA * k),
      uStrB: Math.min(1, st.strB * k),
      uGlow: st.glow * k,
      uEmberStr: st.ember * k,
      uDust: Math.min(1, st.dust * k),
      uVig: vignette ? Math.min(1, st.vig * Math.max(0.6, k)) : 0,
    };
    return withTexSize
      ? { ...base, uTexSize: st.uTexSize, uPer: st.uPer }
      : base;
  });
}

/** Default path: bake once, sample per frame. */
function NebulaBaked({
  frame,
  st,
  background,
}: {
  frame: SharedValue<AnimatedFrame>;
  st: NebulaStatic;
  background: string;
}) {
  const bake = getLabEffect("nebulaBake");
  const sample = getLabEffect("nebulaSample");
  const bakeElement = bake ? (
    <Fill>
      <Shader
        source={bake}
        uniforms={{ uTexSize: NEB_TEX, uPer: NEB_PERIOD }}
      />
    </Fill>
  ) : (
    <Fill color={background} />
  );
  const texture = useTexture(bakeElement, NEB_TEX_SIZE, []);
  const [ready, setReady] = useState(false);
  useAnimatedReaction(
    () => texture.value !== null,
    (done, previous) => {
      if (done && !previous) runOnJS(setReady)(true);
    },
  );
  const uniforms = useNebulaUniforms(frame, st, false);
  if (!bake || !sample || !ready) return <Fill color={background} />;
  return (
    <Fill>
      <Shader source={sample} uniforms={uniforms}>
        <ImageShader
          image={texture}
          tx="repeat"
          ty="repeat"
          fit="fill"
          rect={rect(0, 0, NEB_TEX, NEB_TEX)}
        />
      </Shader>
    </Fill>
  );
}

/** A/B path: the same nebula computed live at full resolution. */
function NebulaLive({
  frame,
  st,
  background,
}: {
  frame: SharedValue<AnimatedFrame>;
  st: NebulaStatic;
  background: string;
}) {
  const live = getLabEffect("nebulaLive");
  const uniforms = useNebulaUniforms(frame, st, true);
  if (!live) return <Fill color={background} />;
  return (
    <Fill>
      <Shader source={live} uniforms={uniforms} />
    </Fill>
  );
}

// --- Starfield -----------------------------------------------------------------

/** The sprite atlas: soft glow · crisp dot · diffraction spike (alpha masks). */
function StarSprites() {
  const h = CELL / 2;
  return (
    <Group>
      <Circle cx={h} cy={h} r={h}>
        <RadialGradient
          c={vec(h, h)}
          r={h}
          colors={[
            LAB_SPRITE_MASK,
            LAB_SPRITE_MASK,
            LAB_SPRITE_MASK_HALO,
            LAB_SPRITE_MASK_CLEAR,
          ]}
          positions={[0, 0.14, 0.32, 1]}
        />
      </Circle>
      <Circle cx={CELL + h} cy={h} r={8}>
        <RadialGradient
          c={vec(CELL + h, h)}
          r={8}
          colors={[LAB_SPRITE_MASK, LAB_SPRITE_MASK, LAB_SPRITE_MASK_CLEAR]}
          positions={[0, 0.6, 1]}
        />
      </Circle>
      <Rect x={CELL * 2} y={h - 0.75} width={CELL} height={1.5}>
        <LinearGradient
          start={vec(CELL * 2, h)}
          end={vec(CELL * 3, h)}
          colors={[
            LAB_SPRITE_MASK_CLEAR,
            LAB_SPRITE_MASK,
            LAB_SPRITE_MASK_CLEAR,
          ]}
        />
      </Rect>
      <Rect x={CELL * 2 + h - 0.75} y={0} width={1.5} height={CELL}>
        <LinearGradient
          start={vec(CELL * 2 + h, 0)}
          end={vec(CELL * 2 + h, CELL)}
          colors={[
            LAB_SPRITE_MASK_CLEAR,
            LAB_SPRITE_MASK,
            LAB_SPRITE_MASK_CLEAR,
          ]}
        />
      </Rect>
      <Circle cx={CELL * 2 + h} cy={h} r={9}>
        <RadialGradient
          c={vec(CELL * 2 + h, h)}
          r={9}
          colors={[
            LAB_SPRITE_MASK,
            LAB_SPRITE_MASK,
            LAB_SPRITE_MASK_HALO,
            LAB_SPRITE_MASK_CLEAR,
          ]}
          positions={[0, 0.3, 0.5, 1]}
        />
      </Circle>
    </Group>
  );
}

interface StarLayerPlace {
  ox: number;
  oy: number;
  zs: number;
  c: number;
  s: number;
}

function StarAtlas({
  image,
  field,
  tiles,
  factors,
  tones,
  soft,
  additive,
  density,
  alphaScale,
  twinkleAmp,
  intensity,
  frame,
}: {
  image: SharedValue<SkImage | null>;
  field: number[];
  tiles: number[];
  factors: number[];
  /** Flat RGB per tone (tone i → [3i, 3i+1, 3i+2]). */
  tones: number[];
  soft: boolean;
  additive: boolean;
  density: number;
  alphaScale: number;
  twinkleAmp: number;
  intensity: number;
  frame: SharedValue<AnimatedFrame>;
}) {
  const ctx = useLabRenderContext();
  const ambient = ctx?.ambient;
  const fxFlags = ctx?.fxFlags;
  const reducedMotion = ctx?.reducedMotion;
  const count = Math.floor(field.length / STAR_STRIDE);
  const twinkles = twinkleAmp > 0;
  const sprites = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const layer = field[i * STAR_STRIDE + S_LAYER];
        const cell =
          !soft || factors[layer] < 0.05
            ? STAR_CELL_DOT
            : field[i * STAR_STRIDE + S_CELL];
        return rect(cell * CELL, 0, CELL, CELL);
      }),
    [count, field, soft, factors],
  );
  // Per-frame layer placements, computed ONCE per frame (not per star).
  const places = useDerivedValue(() => {
    const sky = labSkyPose(frame.value);
    const parallax = fxFlags ? fxFlags.value.flags.parallax : true;
    const out: StarLayerPlace[] = [];
    for (let l = 0; l < factors.length; l++)
      out.push(skyLayerPlacement(sky, factors[l], parallax));
    return { vx: sky.vx, vy: sky.vy, layers: out };
  });
  const transforms = useRSXformBuffer(count, (xf: SkRSXform, i: number) => {
    "worklet";
    const k = i * STAR_STRIDE;
    if (field[k + S_RANK] >= density) {
      xf.set(0, 0, -64, -64);
      return;
    }
    const P = places.value;
    const layer = field[k + S_LAYER];
    const place = P.layers[layer];
    const pt = placeSkyPoint(
      field[k + S_X],
      field[k + S_Y],
      tiles[layer],
      place,
      P.vx,
      P.vy,
    );
    const cell =
      !soft || factors[layer] < 0.05 ? STAR_CELL_DOT : field[k + S_CELL];
    // Near layers grow slightly with zoom (fly-in feel).
    const size = field[k + S_SIZE] * Math.sqrt(place.zs);
    const sc = size / CELL_CORE[cell];
    xf.set(sc, 0, pt.x - (sc * CELL) / 2, pt.y - (sc * CELL) / 2);
  });
  const colors = useColorBuffer(count, (c, i: number) => {
    "worklet";
    const k = i * STAR_STRIDE;
    const tone = field[k + S_TONE] * 3;
    const fx = fxFlags ? fxFlags.value : null;
    const scale = envScale(intensity, fx);
    let a =
      field[k + S_ALPHA] * alphaScale * (0.4 + 0.6 * Math.min(1.5, scale));
    if (
      twinkles &&
      ambient &&
      !(reducedMotion ? reducedMotion.value : false) &&
      (fx ? fx.flags.twinkle : true)
    ) {
      const t = (ambient.value / 1000) % 1000;
      a *=
        1 +
        twinkleAmp *
          Math.sin(t * TWINKLE_RATE * field[k + S_SPEED] + field[k + S_PHASE]);
    }
    c[0] = tones[tone];
    c[1] = tones[tone + 1];
    c[2] = tones[tone + 2];
    c[3] = Math.min(1, Math.max(0, a));
  });
  return (
    <Atlas
      image={image}
      sprites={sprites}
      transforms={transforms}
      colors={colors}
      colorBlendMode="modulate"
      blendMode={additive ? "plus" : "srcOver"}
    />
  );
}

function Starfield({
  width,
  height,
  colors,
  profile,
  frame,
}: {
  width: number;
  height: number;
  colors: ThemePalette;
  profile: LabFxProfile;
  frame: SharedValue<AnimatedFrame>;
}) {
  const env = profile.env;
  const image = useTexture(<StarSprites />, ATLAS_SIZE, []);
  const tones = useMemo(
    () =>
      [colors.textPrimary, colors.textSecondary, ...colors.starPalette].flatMap(
        (token) => tokenToVec3(token),
      ),
    [colors],
  );
  const tintTones = colors.starPalette.length;
  const far = useMemo(() => {
    const tiles = [starTileSize(width, height, FAR.factor, MIN_ZOOM)];
    return {
      tiles,
      factors: [FAR.factor],
      field: buildStarField([FAR], tiles, 2, tintTones, env.starTint, 11),
    };
  }, [width, height, tintTones, env.starTint]);
  const near = useMemo(() => {
    const tiles = [
      starTileSize(width, height, MID.factor, MIN_ZOOM),
      starTileSize(width, height, NEAR.factor, MIN_ZOOM),
    ];
    return {
      tiles,
      factors: [MID.factor, NEAR.factor],
      field: buildStarField(
        [MID, NEAR],
        tiles,
        2,
        tintTones,
        env.starTint,
        977,
      ),
    };
  }, [width, height, tintTones, env.starTint]);
  if (width <= 0 || height <= 0) return null;
  const common = {
    image,
    tones,
    soft: env.starSoft,
    additive: env.starAdditive,
    density: env.starDensity,
    alphaScale: env.starAlpha,
    intensity: profile.intensity,
    frame,
  };
  return (
    <Group>
      <StarAtlas {...common} {...far} twinkleAmp={0} />
      <StarAtlas {...common} {...near} twinkleAmp={env.twinkle} />
    </Group>
  );
}

export function LabEnvironment({
  width,
  height,
  colors,
  background,
  frame,
  profile,
  flags,
}: {
  width: number;
  height: number;
  colors: ThemePalette;
  /** Sky fill: the lab `sky` role (a palette token). */
  background: string;
  frame: SharedValue<AnimatedFrame>;
  profile: LabFxProfile;
  flags: LabFlags;
}) {
  const st = useMemo(
    () => nebulaStatic(width, height, colors, background, profile),
    [width, height, colors, background, profile],
  );
  return (
    <Group>
      {flags.nebula && flags.nebulaLive ? (
        <NebulaLive frame={frame} st={st} background={background} />
      ) : flags.nebula ? (
        <NebulaBaked frame={frame} st={st} background={background} />
      ) : (
        <Fill color={background} />
      )}
      {flags.stars ? (
        <Starfield
          width={width}
          height={height}
          colors={colors}
          profile={profile}
          frame={frame}
        />
      ) : null}
    </Group>
  );
}
