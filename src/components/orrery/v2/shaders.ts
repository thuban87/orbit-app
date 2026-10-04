/**
 * 38.7-06 (D-44): the V2 SkSL sources and their lazy RuntimeEffect cache.
 *
 * Sources are STATIC module strings; only numeric uniforms vary (T-38.7-06-01).
 * They carry no colour literal: every ink arrives as a `half4` uniform built
 * from a theme token on the JS side (`scene-specs.ts`, check:colors).
 */
import { Skia, type SkRuntimeEffect } from "@shopify/react-native-skia";

/**
 * One orbit ring, drawn in WORLD space under the camera homography.
 *
 * The geometry is a cached UNIT annulus strip (`SkVertices`) drawn under
 * H·S(uR), so the local coordinate `u` is a unit-ring coordinate and
 * p = u · uR is the world point. Nothing is stroked (no stroke under a
 * perspective matrix — the Mali cliff); the line is analytic:
 * - the screen-dp distance to the ring is |r − uR| times the radial derivative
 *   of the projection at p (the Jacobian of H), so the line keeps a constant
 *   screen width at any tilt and zoom, with a one-device-pixel AA feather
 *   (uAA = dp per device pixel);
 * - fragments at or beyond the camera's near plane (homogeneous depth
 *   w ≤ uEps, the projection's HORIZON_EPSILON) are never drawn;
 * - uN > 0 dashes the ring into uN equal world-angle periods, `uDuty` of each
 *   on, clockwise from north (38.7-09: Lab B's dash and trace duties, D-11).
 *
 * 38.7-09 (D-11) Lab B's thin SUN-LIT line:
 * - sun light (uLit.x gain, uLit.y radius in world units, uLit.z ink mix):
 *   rings near the sun brighten (alpha × (1 + gain·e^(−r/radius))) and lean
 *   toward the ring-light ink `uLight` (`orreryRingLight`), as if lit by the
 *   star; gain 0 = off;
 * - depth: the side of the plane away from the camera fades toward uLit.w in
 *   proportion to the perspective across the ring (none when flat).
 * The status colour and the solid / dashed / faded / faint-trace ladder stay
 * the non-colour cue (alpha and dashes come from the status).
 *
 * 38.7-09 (D-10) pulse arc: uArc.y > 0 limits the ring to a soft window of
 * half-length uArc.y radians centred on uArc.x (clockwise from north), so the
 * same shader draws the subtle orbit pulses (never baked).
 *
 * 38.7-13 (D-24) orbit streak: with uArc.z > 0.5 the window is ONE-SIDED —
 * the arc of length uArc.y radians BEHIND the head angle uArc.x (against the
 * clockwise spin), its alpha ramping from 0 at the tail through uArc.w at
 * TRAIL_RAMP_AT (Lab A's 0.55 stop) to full at the head (Lab A's streak
 * gradient, `world-plane.ts` §7a).
 *
 * The output is premultiplied: ink × (ink alpha · alpha · coverage).
 * Uniform order is mirrored by `ringPlaneUniforms` (draw-plane.ts).
 */
export const RING_PLANE_SKSL = `
uniform float3 uH0;
uniform float3 uH1;
uniform float3 uH2;
uniform float uR;
uniform float uHalfW;
uniform float uAA;
uniform float uN;
uniform float uEps;
uniform float uAlpha;
uniform half4 uInk;
uniform float uDuty;
uniform float4 uLit;
uniform half4 uLight;
uniform float4 uArc;

half4 main(float2 u) {
  const float TAU = 6.2831853;
  const float PI = 3.14159265;
  const float TRAIL_AT = 0.55;
  float2 p = u * uR;
  float r = length(p);
  if (r < 0.0001) return half4(0.0);
  float3 q = float3(p, 1.0);
  float w = dot(uH2, q);
  if (w <= uEps) return half4(0.0);
  float sx = dot(uH0, q) / w;
  float sy = dot(uH1, q) / w;
  float2 d = p / r;
  float2 j = float2(dot(uH0.xy, d) - sx * dot(uH2.xy, d),
                    dot(uH1.xy, d) - sy * dot(uH2.xy, d)) / w;
  float dist = abs(r - uR) * length(j);
  float cover = clamp((uHalfW - dist) / uAA + 0.5, 0.0, 1.0);
  if (cover <= 0.0) return half4(0.0);
  float an = mod(atan(p.x, -p.y) + TAU, TAU);
  if (uN > 0.5) {
    if (fract(an / TAU * uN) >= uDuty) return half4(0.0);
  }
  float a = uAlpha * cover;
  if (uArc.y > 0.0) {
    if (uArc.z > 0.5) {
      float behind = mod(uArc.x - an + TAU, TAU);
      if (behind > uArc.y) return half4(0.0);
      float t = 1.0 - behind / uArc.y;
      a *= t < TRAIL_AT ? uArc.w * t / TRAIL_AT
                        : uArc.w + (1.0 - uArc.w) * (t - TRAIL_AT) / (1.0 - TRAIL_AT);
    } else {
      float da = abs(mod(an - uArc.x + PI, TAU) - PI);
      float m = 1.0 - smoothstep(0.0, uArc.y, da);
      a *= m * m;
    }
    if (a <= 0.0) return half4(0.0);
  }
  float g = length(uH2.xy);
  if (uLit.w < 1.0 && g > 0.0) {
    float farSide = 0.5 + 0.5 * dot(uH2.xy / g, d);
    float amount = clamp(2.0 * r * g / max(uH2.z, 0.0001), 0.0, 1.0);
    a *= mix(1.0, uLit.w, farSide * amount);
  }
  float3 col = float3(uInk.rgb);
  if (uLit.x > 0.0) {
    float lit = uLit.x * exp(-r / max(uLit.y, 1.0));
    col = mix(col, float3(uLight.rgb), clamp(lit * uLit.z, 0.0, 0.5));
    a *= 1.0 + lit;
  }
  float ia = clamp(float(uInk.a) * a, 0.0, 1.0);
  return half4(half3(col * ia), half(ia));
}
`;

/**
 * 38.7-09 (D-09): the optional orbital-plane grid in Lab C's style — polar
 * guide circles and radial spokes (spokes fainter, fading in away from the
 * sun), edge-faded toward the grid's reach — as ONE analytic draw in WORLD
 * space under the camera homography. The geometry is a cached UNIT disc fan
 * drawn under H·S(uReach), so p = u · uReach is the world point. Lines keep a
 * constant screen width through the same Jacobian as the rings; fragments at
 * or beyond the near plane are discarded (horizon-safe); the far side fades
 * like the rings (uFar). uAlpha 0 is never drawn (the caller skips it).
 * Uniform order is mirrored by `gridPlaneUniforms` (draw-plane.ts).
 */
export const GRID_PLANE_SKSL = `
uniform float3 uH0;
uniform float3 uH1;
uniform float3 uH2;
uniform float uReach;
uniform float uHalfW;
uniform float uAA;
uniform float uEps;
uniform float uRings;
uniform float uSpokes;
uniform float uAlpha;
uniform float uFar;
uniform half4 uInk;

half4 main(float2 u) {
  const float TAU = 6.2831853;
  float2 p = u * uReach;
  float r = length(p);
  if (r < 0.0001) return half4(0.0);
  float3 q = float3(p, 1.0);
  float w = dot(uH2, q);
  if (w <= uEps) return half4(0.0);
  float sx = dot(uH0, q) / w;
  float sy = dot(uH1, q) / w;
  float2 jx = (uH0.xy - sx * uH2.xy) / w;
  float2 jy = (uH1.xy - sy * uH2.xy) / w;
  float2 rd = p / r;
  float2 td = float2(-rd.y, rd.x);
  float sr = length(float2(dot(jx, rd), dot(jy, rd)));
  float st = length(float2(dot(jx, td), dot(jy, td)));
  float t = r / uReach;
  float edge = 1.0 - smoothstep(0.75, 1.0, t);
  if (edge <= 0.0) return half4(0.0);
  float gap = uReach / max(uRings, 1.0);
  float k = floor(r / gap + 0.5);
  float ring = 0.0;
  if (k >= 1.0) {
    ring = clamp((uHalfW - abs(r - k * gap) * sr) / uAA + 0.5, 0.0, 1.0);
  }
  float spoke = 0.0;
  if (uSpokes > 0.5) {
    float an = mod(atan(p.x, -p.y) + TAU, TAU);
    float sp = TAU / uSpokes;
    float m = floor(an / sp + 0.5) * sp;
    spoke = clamp((uHalfW - r * abs(sin(an - m)) * st) / uAA + 0.5, 0.0, 1.0)
        * smoothstep(0.12, 0.3, t) * 0.6;
  }
  float a = max(ring, spoke) * edge * uAlpha;
  float g = length(uH2.xy);
  if (uFar < 1.0 && g > 0.0) {
    float farSide = 0.5 + 0.5 * dot(uH2.xy / g, rd);
    float amount = clamp(2.0 * r * g / max(uH2.z, 0.0001), 0.0, 1.0);
    a *= mix(1.0, uFar, farSide * amount);
  }
  float ia = clamp(float(uInk.a) * a, 0.0, 1.0);
  if (ia <= 0.0) return half4(0.0);
  return half4(uInk.rgb * half(ia), half(ia));
}
`;

/**
 * 38.7-10 (D-13/D-14): one lit status body, Lab B's BODY_LIT rewritten with
 * lighter faces. Drawn in the body's billboard space (translate + uniform
 * scale only, units = world radius) as ONE circle of radius r × reach: inside
 * r the surface (photo or swatch) is lit from the sun's screen direction with
 * wrap lighting and a readability floor (no far-side haze on faces), the
 * decay/rogue desaturation, a soft specular glint, a Fresnel limb and a crisp
 * inner rim in the status rim ink; outside r a soft atmosphere in the status
 * glow ink, stronger on the sun-facing side (none when uD.a = 0: rogue).
 * `uG.x` is the defocus amount (Plan 11, D-21; 0 here). Output premultiplied.
 *   uA = (r, local units per dp, lightX, lightY)
 *   uB = (lightZ, floor, wrap, desaturate)
 *   uC = (rim.rgb, rimStrength)       uD = (glow.rgb, atmosphere)
 *   uE = (highlight.rgb, spec)        uF = (fresnel, rimDp, atmoReach, atmoAdd)
 *   uG = (defocus, 0, 0, 0)
 * Uniform order is mirrored by `bodyLitUniforms` (draw-bodies.ts).
 */
const BODY_LIT_CORE = `
uniform float4 uA;
uniform float4 uB;
uniform float4 uC;
uniform float4 uD;
uniform float4 uE;
uniform float4 uF;
uniform float4 uG;

half4 litBody(float2 xy, float3 surf) {
  float r = uA.x;
  float px = uA.y;
  float2 d = xy / r;
  float l = length(d);
  float aa = px / r;
  float inside = clamp((1.0 - l) / aa + 0.5, 0.0, 1.0);
  float2 dir = d / max(l, 0.0001);
  float facing = dot(dir, uA.zw);
  float3 c = float3(0.0);
  if (inside > 0.0) {
    float nz = sqrt(max(0.0, 1.0 - l * l));
    float3 n = float3(d, nz);
    float3 lv = normalize(float3(uA.zw, uB.x));
    float lam = clamp((dot(n, lv) + uB.z) / (1.0 + uB.z), 0.0, 1.0);
    float shade = uB.y + (1.0 - uB.y) * lam;
    float lum = dot(surf, float3(0.299, 0.587, 0.114));
    c = mix(surf, float3(lum), uB.w) * shade;
    float3 hv = normalize(lv + float3(0.0, 0.0, 1.0));
    c += uE.rgb * pow(max(dot(n, hv), 0.0), 28.0) * uE.a;
    float fres = pow(1.0 - nz, 2.5) * uF.x * (0.3 + 0.7 * max(0.0, facing));
    c = mix(c, uC.rgb, clamp(fres, 0.0, 1.0));
    float rimW = uF.y * px / r;
    float rim = smoothstep(1.0 - rimW - aa, 1.0 - rimW, l) * uC.a;
    c = mix(c, uC.rgb, rim);
    float dfc = uG.x;
    if (dfc > 0.0) {
      float dl = dot(c, float3(0.299, 0.587, 0.114));
      c = mix(c, float3(dl), 0.3 * dfc) * (1.0 - 0.32 * dfc);
    }
  }
  float t = clamp((l - 1.0) / max(uF.z - 1.0, 0.0001), 0.0, 1.0);
  float g = 1.0 - t;
  g = g * g * g * uD.a * (0.4 + 0.6 * max(0.0, facing));
  g *= 1.0 - 0.55 * uG.x;
  float ga = g * (1.0 - 0.75 * uF.w);
  float3 oc = uD.rgb * g;
  return half4(half3(c * inside + oc * (1.0 - inside)),
               half(inside + ga * (1.0 - inside)));
}
`;

/** The swatch body: the lit swatch colour `uS.rgb` (initials drawn on top). */
export const BODY_SWATCH_SKSL = `${BODY_LIT_CORE}
uniform float4 uS;
half4 main(float2 xy) {
  return litBody(xy, uS.rgb);
}
`;

/**
 * The photo body: child `uImage` (the photo, identity local matrix) sampled
 * cover-fit — the centre square (origin uI.xy, side uI.z) across the disc.
 */
export const BODY_PHOTO_SKSL = `${BODY_LIT_CORE}
uniform shader uImage;
uniform float4 uI;
half4 main(float2 xy) {
  float2 q = xy / uA.x;
  float2 uv = uI.xy + (q * 0.5 + 0.5) * uI.z;
  return litBody(xy, float3(uImage.eval(uv).rgb));
}
`;

/**
 * 38.7-10 (D-15): Lab A's sun as a star — a white-hot core grading to the
 * occupant glow hue, with an edge shaped by angular harmonics and a soft
 * bloom (dark); engraved rays + rings on light themes (uChart). Local
 * coordinates centred on the sun, units = sun world radius. `uTime` moves only
 * with the sun pulse (D-37) and is fixed under reduced motion; uFlare is 0
 * (Plan 13 owns switch effects). No colour literal: core and glow are inks.
 * Uniform order is mirrored by `coronaUniforms` (draw-bodies.ts).
 */
export const SUN_CORONA_SKSL = `
uniform float uR;
uniform float uTime;
uniform float uFlare;
uniform float uReach;
uniform float uChart;
uniform float uAlpha;
uniform half4 uCore;
uniform half4 uGlow;

half4 main(float2 p) {
  float d = length(p) / uR;
  float ang = atan(p.y, p.x);
  float t = uTime;
  float n = 0.5 + 0.22 * sin(ang * 7.0 + t * 1.3)
      + 0.16 * sin(ang * 13.0 - t * 1.9 + 1.7)
      + 0.12 * sin(ang * 29.0 + t * 2.6 + 4.1);
  float reach = 1.0 + (0.38 + 0.5 * n) * (1.0 + uFlare);
  float x = max(d - 1.0, 0.0);
  float fade = 1.0 - smoothstep(uReach * 0.72, uReach, d);
  if (uChart > 0.5) {
    float rays = pow(abs(cos(ang * 12.0 + t * 0.15)), 60.0);
    float rayLen = 1.0 - smoothstep(1.0, reach + 0.55, d);
    float rings = 1.0 - smoothstep(0.0, 0.05, abs(fract(d * 3.0) - 0.5));
    float ringMask = (1.0 - smoothstep(1.2, uReach * 0.85, d)) * step(1.0, d);
    float wash = (1.0 - smoothstep(1.0, reach, d)) * 0.28;
    float a = clamp(rays * rayLen * 0.75 + rings * ringMask * 0.35 + wash, 0.0, 1.0);
    a *= fade * uAlpha;
    half3 col = mix(uGlow.rgb, uCore.rgb, half(0.65));
    return half4(col * half(a), half(a));
  }
  float corona = clamp(1.0 - x / (reach - 1.0), 0.0, 1.0);
  corona = corona * corona * corona;
  float bloom = exp(-x * 1.25) * (0.5 + 0.5 * uFlare);
  float hot = clamp(corona * 1.1 - 0.15, 0.0, 1.0);
  half3 col = mix(uGlow.rgb, uCore.rgb, half(hot));
  float a = clamp(corona * 0.9 + bloom * 0.55, 0.0, 1.0) * fade * uAlpha;
  return half4(col * half(a), half(a));
}
`;

/**
 * 38.7-10 (D-15): Lab A's sun DISC — uPhoto 0: an opaque stellar surface
 * (core → occupant hue toward the limb, limb darkening, slow granulation in
 * O(1) coordinates, mediump-safe); uPhoto 1: only a glowing limb band framing
 * the occupant photo (the photo stays the identity). uAA = local units per
 * device pixel. Uniform order is mirrored by `sunDiscUniforms`.
 */
export const SUN_DISC_SKSL = `
uniform float uR;
uniform float uTime;
uniform float uPhoto;
uniform float uAA;
uniform float uFlare;
uniform half4 uCore;
uniform half4 uGlow;

half4 main(float2 p) {
  float2 q = p / uR;
  float d = length(q);
  float aa = max(uAA / uR, 0.002);
  float edge = 1.0 - smoothstep(1.0 - aa, 1.0, d);
  if (edge <= 0.0) return half4(0.0);
  float t = uTime;
  float ang = atan(q.y, q.x);
  float mu = sqrt(max(0.0, 1.0 - d * d));
  float2 s = q / (0.35 + mu);
  float g1 = sin(s.x * 9.1 + sin(s.y * 6.3 + t * 0.41) * 1.8 + t * 0.53)
      * sin(s.y * 10.7 + sin(s.x * 5.9 - t * 0.33) * 1.7 - t * 0.37);
  float g2 = sin(s.x * 23.0 + s.y * 7.0 + sin(s.y * 17.0 - t * 0.7) * 1.3)
      * sin(s.y * 21.0 - s.x * 6.0 + sin(s.x * 15.0 + t * 0.6) * 1.2);
  float g3 = sin(ang * 5.0 + d * 9.0 - t * 0.3);
  float g = (g1 * 0.6 + g2 * 0.28 + g3 * 0.25) / 1.13;
  float cells = 1.0 - abs(g1);
  float heat = pow(mu, 1.6 - 0.6 * uFlare);
  half3 col = mix(uGlow.rgb, uCore.rgb, half(heat));
  col = col * half(0.5 + 0.5 * pow(mu, 0.55));
  col = col + uCore.rgb * half((0.35 + 0.4 * uFlare) * pow(mu, 6.0));
  col = col * half(1.0 + (0.07 * g + 0.05 * cells - 0.025) * mu);
  float limb = smoothstep(0.86, 0.99, d) * (1.0 - smoothstep(0.99, 1.0, d));
  col = col + uGlow.rgb * half(0.22 * limb);
  if (uPhoto > 0.5) {
    float band = smoothstep(0.74, 0.97, d);
    half3 bandCol = mix(uGlow.rgb, uCore.rgb, half(0.35 * (1.0 - band)));
    float a = band * 0.92 * edge;
    return half4(bandCol * half(a), half(a));
  }
  return half4(col * half(edge), half(edge));
}
`;

/*
 * 38.7-09 (rework, owner 2026-10-03): Lab B's DISTANT nebula
 * (`labb-effects.ts` NEBULA_NOISE / NEBULA_SHADE / NEBULA_FAR_STARS, ported).
 *
 * The noise is PERIODIC (the lattice wraps with `mod(i, per)`; every octave
 * doubles frequency and period), so the baked density tiles seamlessly with
 * `repeat` and the sky never shows an edge however far the camera pans. It is
 * evaluated ONCE per bake (never live per frame — DEAD-ENDS), in `float`
 * (highp), on coordinates of at most a few hundred units.
 */
const SKY_NOISE = `
float nbHash(float2 p) {
  float3 p3 = fract(float3(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

const SKY_FBM = `
float nbNoise(float2 p, float per) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = nbHash(mod(i, per));
  float b = nbHash(mod(i + float2(1.0, 0.0), per));
  float c = nbHash(mod(i + float2(0.0, 1.0), per));
  float d = nbHash(mod(i + float2(1.0, 1.0), per));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float nbFbm(float2 p, float per) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 5; k++) {
    v += a * nbNoise(p, per);
    p = p * 2.0;
    per = per * 2.0;
    a *= 0.5;
  }
  return v / 0.96875;
}
`;

/**
 * The one-shot BAKE: nebula DENSITIES, never colours — r = lobe A, g = lobe B,
 * b = dust lanes (Lab B `nebulaBake`, unchanged maths). Domain-warped fbm
 * (q → r → n) gives the sculpted lobes; a half-frequency `region` field splits
 * the sky between lobe A and lobe B; a finer warped fbm thresholded high gives
 * the dark dust lanes. Coordinates are texels of a square tiling texture.
 *   uBake = (texture size, lattice period, seed x, seed y)
 * The seed is an integer lattice offset (the tile stays periodic).
 */
export const SKY_NEBULA_BAKE_SKSL = `${SKY_NOISE}${SKY_FBM}
uniform float4 uBake;
half4 main(float2 xy) {
  float per = uBake.y;
  float2 p = xy / uBake.x * per + uBake.zw;
  float2 q = float2(nbFbm(p, per), nbFbm(p + float2(5.2, 1.3), per));
  float2 r = float2(nbFbm(p + 3.0 * q + float2(1.7, 9.2), per),
                    nbFbm(p + 3.0 * q + float2(8.3, 2.8), per));
  float n = nbFbm(p + 3.2 * r, per);
  float nb = nbFbm(p + 3.2 * r.yx + float2(4.1, 7.7), per);
  float region = nbNoise(p * 0.5 + float2(0.37, 0.71), per * 0.5);
  float lobeA = smoothstep(0.42, 0.86, n) * smoothstep(0.28, 0.7, region);
  float lobeB = smoothstep(0.42, 0.86, nb) * (1.0 - smoothstep(0.3, 0.72, region));
  float d = nbFbm(p * 2.0 + 4.0 * q, per * 2.0);
  float dust = smoothstep(0.52, 0.78, d);
  return half4(half3(clamp(float3(lobeA, lobeB, dust), 0.0, 1.0)), 1.0);
}
`;

/**
 * The per-frame SKY: the whole painted sky in one full-canvas pass (Lab B
 * `nebulaSample` + `lbShade` + `lbFarStars`). One texture fetch per pixel of
 * the baked densities (child `uNeb`, texel coordinates, repeat-tiled), then:
 * the neutral horizon → base gradient; token colouring — the sky mixes toward
 * lobe A and lobe B by density × strength, an ember tint where they overlap,
 * a quadratic core glow (dark only), dust lanes that darken the clouds;
 * the FAR star layer drawn analytically AFTER the clouds so it shines through
 * them (a hash grid, one candidate star per 22-dp sky cell); the corner
 * vignette; a 1/255 dither. Colours are uniforms only (theme tokens; H9: the
 * System hue arrives in uLobeB at draw time, never baked).
 *   uG = (width, height, horizonStop, texels per dp)
 *   uHorizon.rgb, uBase.rgb       the neutral gradient ends
 *   uLobeA / uLobeB / uEmber      (rgb, strength)
 *   uShade = (glow, dust, vignette, vignette shade toward black)
 *   uVigTone = (rgb, 1 = wash toward this ink instead of the shaded sky)
 *   uCam = (viewport cx, cy, yaw, nebula zoom scale)
 *   uOff = (nebula offset x, y, drift x, y)      (dp)
 *   uMotion = (breathing warp dp, time s, far-star zoom scale, 0)
 *   uFar = (far offset x, y, star alpha, star density)
 *   uStarA = (rgb, 1 = additive), uStarB / uStarC = (rgb, 0)
 * Uniform order is mirrored by `skyNebulaUniforms` (draw-sky.ts).
 */
export const SKY_NEBULA_SKSL = `${SKY_NOISE}
uniform shader uNeb;
uniform float4 uG;
uniform float4 uHorizon;
uniform float4 uBase;
uniform float4 uLobeA;
uniform float4 uLobeB;
uniform float4 uEmber;
uniform float4 uShade;
uniform float4 uVigTone;
uniform float4 uCam;
uniform float4 uOff;
uniform float4 uMotion;
uniform float4 uFar;
uniform float4 uStarA;
uniform float4 uStarB;
uniform float4 uStarC;

float2 nbSky(float2 xy) {
  float2 d = xy - uCam.xy - uOff.xy;
  float c = cos(uCam.z);
  float s = sin(uCam.z);
  float2 p = float2(c * d.x + s * d.y, -s * d.x + c * d.y) / uCam.w;
  p += uOff.zw;
  p += uMotion.x * float2(sin(p.y * 0.011 + uMotion.y * 0.21),
                          cos(p.x * 0.013 - uMotion.y * 0.17));
  return p;
}

float3 nbFarStars(float2 xy, float3 col) {
  float c = cos(uCam.z);
  float s = sin(uCam.z);
  float2 d = xy - uCam.xy - uFar.xy;
  float2 p = float2(c * d.x + s * d.y, -s * d.x + c * d.y) / uMotion.z;
  float2 cell = floor(p / 22.0);
  if (nbHash(cell + 17.0) > uFar.w) return col;
  float2 sp = (cell + 0.2 + 0.6 * float2(nbHash(cell + 41.3), nbHash(cell + 7.9))) * 22.0;
  float dist = length(p - sp) * uMotion.z;
  float rad = 0.42 + 0.75 * pow(nbHash(cell + 3.1), 3.0);
  float a = min(1.0, exp(-(dist * dist) / (rad * rad)) * (0.45 + 0.85 * nbHash(cell + 9.7)) * uFar.z);
  float t = nbHash(cell + 5.5);
  float3 sc = t < 0.72 ? uStarA.rgb : (t < 0.86 ? uStarB.rgb : uStarC.rgb);
  return mix(mix(col, sc, a), col + sc * a, uStarA.a);
}

half4 main(float2 xy) {
  float g = clamp(xy.y / max(uG.y * uG.z, 1.0), 0.0, 1.0);
  float3 sky = mix(uHorizon.rgb, uBase.rgb, g);
  float3 n = float3(uNeb.eval(nbSky(xy) * uG.w).rgb);
  float a = n.x;
  float b = n.y;
  float3 col = mix(sky, uLobeA.rgb, clamp(a * uLobeA.a, 0.0, 1.0));
  col = mix(col, uLobeB.rgb, clamp(b * uLobeB.a, 0.0, 1.0));
  col = mix(col, uEmber.rgb, clamp(a * b * 4.0 * uEmber.a, 0.0, 1.0));
  col += uLobeA.rgb * (a * a * uShade.x) + uLobeB.rgb * (b * b * uShade.x);
  col *= 1.0 - n.z * clamp(0.25 + a + b, 0.0, 1.0) * uShade.y;
  col = nbFarStars(xy, col);
  float2 v = (xy - 0.5 * uG.xy) / (0.5 * uG.xy);
  float vig = smoothstep(0.45, 1.4, length(v * float2(1.0, 0.85)));
  float3 tone = mix(sky * (1.0 - uShade.w), uVigTone.rgb, uVigTone.a);
  col = mix(col, tone, vig * uShade.z);
  col += (nbHash(xy) - 0.5) / 255.0;
  return half4(half3(clamp(col, 0.0, 1.0)), 1.0);
}
`;

export type OrreryShaderId =
  | "ringPlane"
  | "gridPlane"
  | "bodySwatch"
  | "bodyPhoto"
  | "sunCorona"
  | "sunDisc"
  | "skyNebulaBake"
  | "skyNebula";

const SOURCES: Record<OrreryShaderId, string> = {
  ringPlane: RING_PLANE_SKSL,
  gridPlane: GRID_PLANE_SKSL,
  bodySwatch: BODY_SWATCH_SKSL,
  bodyPhoto: BODY_PHOTO_SKSL,
  sunCorona: SUN_CORONA_SKSL,
  sunDisc: SUN_DISC_SKSL,
  skyNebulaBake: SKY_NEBULA_BAKE_SKSL,
  skyNebula: SKY_NEBULA_SKSL,
};

const cache: Partial<Record<OrreryShaderId, SkRuntimeEffect | null>> = {};
const reported = new Set<OrreryShaderId>();

/**
 * The compiled effect for `id`, compiled once (JS thread) and cached; null
 * when the runtime cannot compile it (the renderer then skips that layer).
 * A failure is logged once, in development only.
 */
export function orreryShader(id: OrreryShaderId): SkRuntimeEffect | null {
  if (id in cache) return cache[id] ?? null;
  let effect: SkRuntimeEffect | null = null;
  try {
    effect = Skia?.RuntimeEffect?.Make?.(SOURCES[id]) ?? null;
  } catch {
    effect = null;
  }
  cache[id] = effect;
  const dev = typeof __DEV__ !== "undefined" && __DEV__;
  if (!effect && dev && !reported.has(id)) {
    reported.add(id);
    console.warn(`[orrery] ${id} shader failed to compile; layer skipped`);
  }
  return effect;
}

/** Test seam: forget compiled effects (a fresh Skia mock per test). */
export function resetOrreryShaderCache(): void {
  for (const id of Object.keys(cache) as OrreryShaderId[]) delete cache[id];
  reported.clear();
}
