/**
 * ORRERY LAB B — theme token → shader uniform conversion.
 *
 * Colours reach SkSL only as uniforms derived from `ThemePalette` tokens (never
 * literals). `tokenToVec4` goes through `Skia.Color` (lazy, JS thread, memoised
 * per token string). `mixVec` derives lab colours as NUMERIC mixes of tokens.
 * Plain JS (not worklets): call during render / useMemo and pass the arrays
 * into derived uniforms.
 */
import { Skia } from "@shopify/react-native-skia";

export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

const memo = new Map<string, Vec4>();

/** RGBA in 0..1 for a token value; transparent-black when Skia is unavailable. */
export function tokenToVec4(token: string): Vec4 {
  const hit = memo.get(token);
  if (hit) return hit;
  let out: Vec4 = [0, 0, 0, 0];
  try {
    const c = Skia.Color(token) as unknown as ArrayLike<number>;
    out = [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 1];
  } catch {
    // Skia missing (node tests) — keep the neutral value, never throw.
  }
  memo.set(token, out);
  return out;
}

export function tokenToVec3(token: string): Vec3 {
  const [r, g, b] = tokenToVec4(token);
  return [r, g, b];
}

/** Linear mix of two colour vectors (t clamped to 0..1). */
export function mixVec<T extends number[]>(a: T, b: T, t: number): T {
  const k = Math.min(1, Math.max(0, t));
  return a.map((v, i) => v + ((b[i] ?? v) - v) * k) as T;
}

/** Same vector with alpha replaced (premultiplication is the shader's job). */
export function withAlpha(v: Vec4, alpha: number): Vec4 {
  return [v[0], v[1], v[2], alpha];
}
