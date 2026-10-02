/**
 * ORRERY LAB B — tilt fix, final form: the RING FIELD (flag `ringField`).
 *
 * Phone finding (research/PHONE-PASS-RESULTS.md "Tilt fix"): on Mali-G78 every
 * per-ring draw of the orbit layer is fragment-bound, tilted or not. Ganesh's
 * circle op shades an octagon band ≈ 8 % of the radius thick (not the 1-dp
 * hairline), its ellipse op the whole bounding box, and its path renderers
 * cost CPU per ring per frame; a shader local matrix (or an in-shader inverse
 * homography) on top of ~100 large ring draws halved the frame rate even
 * untilted. So the class rings, the progress wakes and the switch trims are
 * evaluated ANALYTICALLY in ONE full-screen shader (`ringField`): per pixel,
 * the inverse plane homography gives the world point, a radius LUT gives the
 * nearest ring, and the ring's style (status hue, dashes, flow comets,
 * far-side fade, rim light, wake arc, trim sweep) is the same maths as the
 * per-ring shaders. Anti-aliasing comes from the homography's analytic
 * Jacobian (SkSL has no derivatives): screen distance = world radial distance
 * × |J·n̂|. The cost is one screen of fragments, whatever the ring count.
 *
 * This module builds the shader's two data textures on the UI thread (pure
 * worklets, node-tested):
 *   - the RING TABLE, width = entry count, 3 rows, RGBA8 (alpha always 255:
 *     image shaders return premultiplied colour, so data lives in RGB):
 *       row 0: radius 16-bit (/ rmax), class index + 8 × type (0 ring, 1 trim)
 *       row 1: alpha 8-bit, wake angle 16-bit (/ 2π; 0 = no wake)
 *       row 2: trim length 8-bit, trim head angle 16-bit (/ 2π)
 *     entries sorted by radius;
 *   - the LUT, `FIELD_LUT_W` × 1: bin b over [0, rmax] → index (16-bit) of
 *     the entry whose radius is nearest the bin centre.
 *
 * Hermes rule: helpers are declared ABOVE their worklet callers.
 */

/** LUT bins over [0, rmax]. */
export const FIELD_LUT_W = 4096;
/** Floats per entry in the flat entry list. */
export const FIELD_STRIDE = 7;
/** Entry type codes. */
export const FIELD_RING = 0;
export const FIELD_TRIM = 1;

const TAU = Math.PI * 2;

/**
 * Append one entry to the flat list `out`: [R (world), class index 0..4,
 * type, alpha 0..1, wake angle rad (0 = none), trim length 0..1, trim head
 * angle rad].
 */
export function pushFieldEntry(
  out: number[],
  R: number,
  cls: number,
  type: number,
  alpha: number,
  wake: number,
  trimLen: number,
  trimHead: number,
): void {
  "worklet";
  out.push(R, cls, type, alpha, wake, trimLen, trimHead);
}

function byte(v: number): number {
  "worklet";
  const b = Math.round(v * 255);
  return b < 0 ? 0 : b > 255 ? 255 : b;
}

function word(v: number): number {
  "worklet";
  const w = Math.round(v * 65535);
  return w < 0 ? 0 : w > 65535 ? 65535 : w;
}

/** Angle in [0, 2π). */
function wrapAngle(a: number): number {
  "worklet";
  const m = a % TAU;
  return m < 0 ? m + TAU : m;
}

export interface RingFieldData {
  /** RGBA8, `width` × 3 rows. */
  table: Uint8Array;
  width: number;
  /** RGBA8, FIELD_LUT_W × 1. */
  lut: Uint8Array;
  /** Radius normaliser (world): every entry radius ≤ rmax. */
  rmax: number;
  /** Entries actually encoded. */
  count: number;
}

/**
 * Encode the flat entry list (see `pushFieldEntry`) into the ring table and
 * the radius LUT. Entries with a non-positive radius or alpha are dropped.
 * Null when nothing remains (the caller draws nothing).
 */
export function buildRingField(
  entries: readonly number[],
): RingFieldData | null {
  "worklet";
  const n = Math.floor(entries.length / FIELD_STRIDE);
  const order: number[] = [];
  let rmax = 0;
  for (let i = 0; i < n; i++) {
    const R = entries[i * FIELD_STRIDE];
    const a = entries[i * FIELD_STRIDE + 3];
    if (!(R > 0) || !(a > 0)) continue;
    order.push(i);
    if (R > rmax) rmax = R;
  }
  const count = order.length;
  if (count === 0) return null;
  order.sort((x, y) => entries[x * FIELD_STRIDE] - entries[y * FIELD_STRIDE]);
  rmax *= 1.0001;
  const width = count;
  const table = new Uint8Array(width * 3 * 4);
  const row = width * 4;
  for (let k = 0; k < count; k++) {
    const o = order[k] * FIELD_STRIDE;
    const R = word(entries[o] / rmax);
    const p0 = k * 4;
    table[p0] = R >> 8;
    table[p0 + 1] = R & 255;
    table[p0 + 2] = entries[o + 1] + 8 * entries[o + 2];
    table[p0 + 3] = 255;
    const wake = entries[o + 4] > 0 ? word(wrapAngle(entries[o + 4]) / TAU) : 0;
    const p1 = row + p0;
    table[p1] = byte(entries[o + 3]);
    table[p1 + 1] = wake >> 8;
    table[p1 + 2] = wake & 255;
    table[p1 + 3] = 255;
    const head = word(wrapAngle(entries[o + 6]) / TAU);
    const p2 = row * 2 + p0;
    table[p2] = byte(entries[o + 5]);
    table[p2 + 1] = head >> 8;
    table[p2 + 2] = head & 255;
    table[p2 + 3] = 255;
  }
  // LUT: nearest entry (by radius) to each bin centre; one forward sweep.
  const lut = new Uint8Array(FIELD_LUT_W * 4);
  let k = 0;
  for (let b = 0; b < FIELD_LUT_W; b++) {
    const rc = ((b + 0.5) / FIELD_LUT_W) * rmax;
    while (
      k + 1 < count &&
      Math.abs(entries[order[k + 1] * FIELD_STRIDE] - rc) <=
        Math.abs(entries[order[k] * FIELD_STRIDE] - rc)
    )
      k++;
    const p = b * 4;
    lut[p] = k >> 8;
    lut[p + 1] = k & 255;
    lut[p + 2] = 0;
    lut[p + 3] = 255;
  }
  return { table, width, lut, rmax, count };
}

/** Decode helpers (tests; the shader does the same with `floor(x·255+.5)`). */
export function fieldEntryAt(
  data: RingFieldData,
  k: number,
): {
  R: number;
  cls: number;
  type: number;
  alpha: number;
  wake: number;
  trimLen: number;
  trimHead: number;
} {
  const t = data.table;
  const row = data.width * 4;
  const p = k * 4;
  const code = t[p + 2];
  return {
    R: (((t[p] << 8) | t[p + 1]) / 65535) * data.rmax,
    cls: code & 7,
    type: code >> 3,
    alpha: t[row + p] / 255,
    wake: (((t[row + p + 1] << 8) | t[row + p + 2]) / 65535) * TAU,
    trimLen: t[row * 2 + p] / 255,
    trimHead: (((t[row * 2 + p + 1] << 8) | t[row * 2 + p + 2]) / 65535) * TAU,
  };
}

/** LUT index of bin `b` (tests). */
export function fieldLutAt(data: RingFieldData, b: number): number {
  return (data.lut[b * 4] << 8) | data.lut[b * 4 + 1];
}
