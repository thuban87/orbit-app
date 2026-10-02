/**
 * ORRERY LAB B — tilt fix: plane circles as SCREEN-SPACE ellipses.
 *
 * WHY THIS EXISTS (research/PHONE-PASS-RESULTS.md "Tilt fix"). The lab drew
 * every orbit ring, wake, trim ring, focus glow, reticle ripple and chart ring
 * as a stroked world circle under the 3×3 PERSPECTIVE plane homography
 * (`planeHomography`). On the Pixel 6 Pro (Mali-G78) Ganesh has no analytic op
 * for a stroked oval under perspective: it falls back to a generic path
 * renderer and the GPU pinned at 99.7 % (Dense 120 at 3–9 fps with the Home
 * tilt; 92–99 fps with tilt 0). The emulator's desktop GPU hid it.
 *
 * A circle on the plane maps under a homography to an exact CONIC; for every
 * pose the camera allows (pan ≤ extent, focal ≥ 4.6·extent, tilt ≤ 60°) the
 * whole circle stays in front of the camera, so the conic is a bounded
 * ELLIPSE. This module computes it (centre, semi-axes, rotation) on the UI
 * thread from the homography's adjugate — no per-point projection — so the
 * renderer can draw ring geometry WITHOUT a perspective matrix:
 *   - as an analytic oval (translate · rotate, `drawOval`), or
 *   - as the circle path mapped through the homography (`SkPath.transform`
 *     maps conic segments exactly: a rational quadratic stays one), stroked
 *     in screen space (affine CTM),
 * with the ring shaders still evaluated in WORLD coordinates through a
 * perspective SHADER LOCAL MATRIX (a per-fragment divide, cheap) instead of a
 * perspective CTM on the geometry.
 *
 * Accuracy is pinned against `projectWorldPoint` samples on the ring
 * (labb-plane-ellipse.test.ts): < 0.5 px over tilts 0…MAX_TILT, all yaws,
 * zooms MIN…MAX and panned poses.
 *
 * Hermes rule: helpers are declared ABOVE their worklet callers.
 */

/** Screen-space ellipse: centre, semi-axis `a` along `theta`, `b` across. */
export interface PlaneEllipse {
  x: number;
  y: number;
  a: number;
  b: number;
  /** Rotation of the `a` axis (radians, screen, clockwise from +x). */
  theta: number;
}

/**
 * Projected ellipse of the world circle (cx, cy, R) under the row-major plane
 * homography `m` (world → screen dp). Null when the image is not a bounded
 * ellipse (circle crosses / lies behind the camera's horizon, degenerate
 * radius or matrix) — callers then skip the draw (it cannot happen for legal
 * camera poses, see the module comment).
 *
 * Method: screen point s maps back to world w ∝ adj(m)·s (adjugate rows
 * n0, n1, n2; scale is irrelevant for a conic). The circle
 * (wx − cx)² + (wy − cy)² − R²·wz² = 0 becomes sᵀQs = 0 with
 *   Q = u·uᵀ + v·vᵀ − R²·n2·n2ᵀ,  u = n0 − cx·n2,  v = n1 − cy·n2.
 * Centre = −M⁻¹·q (M = upper-left 2×2, q = (Q02, Q12)); the axes come from
 * M's eigenvalues and Q's value at the centre.
 */
export function projectedCircleEllipse(
  m: readonly number[],
  cx: number,
  cy: number,
  R: number,
): PlaneEllipse | null {
  "worklet";
  if (!(R > 0)) return null;
  // The circle's centre must be in front of the camera (w > 0).
  if (!(m[6] * cx + m[7] * cy + m[8] > 0)) return null;
  // Adjugate (transposed cofactors) of the row-major 3×3.
  const n00 = m[4] * m[8] - m[5] * m[7];
  const n01 = m[2] * m[7] - m[1] * m[8];
  const n02 = m[1] * m[5] - m[2] * m[4];
  const n10 = m[5] * m[6] - m[3] * m[8];
  const n11 = m[0] * m[8] - m[2] * m[6];
  const n12 = m[2] * m[3] - m[0] * m[5];
  const n20 = m[3] * m[7] - m[4] * m[6];
  const n21 = m[1] * m[6] - m[0] * m[7];
  const n22 = m[0] * m[4] - m[1] * m[3];
  const u0 = n00 - cx * n20;
  const u1 = n01 - cx * n21;
  const u2 = n02 - cx * n22;
  const v0 = n10 - cy * n20;
  const v1 = n11 - cy * n21;
  const v2 = n12 - cy * n22;
  const r2 = R * R;
  const q00 = u0 * u0 + v0 * v0 - r2 * n20 * n20;
  const q01 = u0 * u1 + v0 * v1 - r2 * n20 * n21;
  const q11 = u1 * u1 + v1 * v1 - r2 * n21 * n21;
  const q02 = u0 * u2 + v0 * v2 - r2 * n20 * n22;
  const q12 = u1 * u2 + v1 * v2 - r2 * n21 * n22;
  const q22 = u2 * u2 + v2 * v2 - r2 * n22 * n22;
  const det = q00 * q11 - q01 * q01;
  if (!(det > 0) || !Number.isFinite(det)) return null;
  const x = (q01 * q12 - q11 * q02) / det;
  const y = (q01 * q02 - q00 * q12) / det;
  const f0 = q22 + q02 * x + q12 * y;
  const mean = (q00 + q11) / 2;
  const half = (q00 - q11) / 2;
  const root = Math.sqrt(half * half + q01 * q01);
  const l1 = mean + root;
  const l2 = mean - root;
  const sa = -f0 / l1;
  const sb = -f0 / l2;
  if (!(sa > 0) || !(sb > 0)) return null;
  return {
    x,
    y,
    a: Math.sqrt(sa),
    b: Math.sqrt(sb),
    theta: 0.5 * Math.atan2(2 * q01, q00 - q11),
  };
}

/** Point on the ellipse at parameter `t` (tests / probes). */
export function ellipsePoint(
  e: PlaneEllipse,
  t: number,
): { x: number; y: number } {
  "worklet";
  const c = Math.cos(e.theta);
  const s = Math.sin(e.theta);
  const ax = e.a * Math.cos(t);
  const by = e.b * Math.sin(t);
  return { x: e.x + ax * c - by * s, y: e.y + ax * s + by * c };
}

/**
 * True when the ellipse's stroke (half width `pad`, plus AA) can touch the
 * viewport [0, w] × [0, h]: its axis-aligned bounds overlap the viewport and
 * the viewport is not entirely INSIDE the stroke's inner edge (a ring that
 * encloses the whole screen draws nothing). Replaces the R1 circle test
 * (`ringOnScreen`) with the exact projected shape.
 */
export function ellipseOnScreen(
  e: PlaneEllipse,
  pad: number,
  w: number,
  h: number,
): boolean {
  "worklet";
  const c = Math.cos(e.theta);
  const s = Math.sin(e.theta);
  const hx = Math.sqrt(e.a * e.a * c * c + e.b * e.b * s * s) + pad;
  const hy = Math.sqrt(e.a * e.a * s * s + e.b * e.b * c * c) + pad;
  if (e.x + hx < 0 || e.x - hx > w || e.y + hy < 0 || e.y - hy > h)
    return false;
  const ia = e.a - pad;
  const ib = e.b - pad;
  if (!(ia > 0) || !(ib > 0)) return true;
  for (let k = 0; k < 4; k++) {
    const px = (k & 1 ? w : 0) - e.x;
    const py = (k & 2 ? h : 0) - e.y;
    const u = (px * c + py * s) / ia;
    const v = (-px * s + py * c) / ib;
    if (u * u + v * v >= 1) return true;
  }
  return false;
}

/** True when the homography has a perspective row (tilted plane). */
export function hasPerspective(m: readonly number[]): boolean {
  "worklet";
  return Math.abs(m[6]) > 1e-9 || Math.abs(m[7]) > 1e-9;
}

/**
 * Row-major 3×3 product a·b (shader local matrices: `(T·R)⁻¹ · H` for the
 * oval draw variant).
 */
export function mul3(a: readonly number[], b: readonly number[]): number[] {
  "worklet";
  const out = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      out[i * 3 + j] =
        a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return out;
}

/**
 * Shader local matrix for an oval drawn under translate(e.x, e.y) ·
 * rotate(e.theta): L = rotate(−θ) · translate(−x, −y) · H, so the shader still
 * receives WORLD plane coordinates (CTM · L = H).
 */
export function ovalLocalMatrix(
  e: PlaneEllipse,
  m: readonly number[],
): number[] {
  "worklet";
  const c = Math.cos(e.theta);
  const s = Math.sin(e.theta);
  // rotate(−θ) · translate(−x, −y)
  const inv = [c, s, -(c * e.x + s * e.y), -s, c, s * e.x - c * e.y, 0, 0, 1];
  return mul3(inv, m);
}
