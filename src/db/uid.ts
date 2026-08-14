/**
 * Merge-key UUID generator (DATA-03).
 *
 * Every mergeable table row carries an app-generated `uid` (distinct from its
 * integer surrogate PK) so Phase-16 newest-edit-wins merge can identify the
 * same logical row across devices. A `uid` is an IDENTIFIER, not a secret
 * (RESEARCH Security Domain V6), so there is no crypto-strength requirement —
 * we prefer the platform `crypto.randomUUID()` (present in both the Expo
 * runtime and the Node test env) and fall back to an RFC-4122 v4 built from
 * `Math.random` when it is absent. Zero new dependencies (RESEARCH A5).
 */

/**
 * Return a fresh RFC-4122 v4-shaped UUID string. Two successive calls differ.
 * Used as the `newUid` dependency threaded into every migration seed and DAO
 * insert of a mergeable row.
 */
export function newUid(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return fallbackUuidV4();
}

/**
 * Dependency-free RFC-4122 v4 generator using `Math.random`. Only reached when
 * `crypto.randomUUID` is unavailable; a `uid` is not a secret so the weaker
 * entropy source is acceptable (RESEARCH A5 / Security Domain V6).
 */
function fallbackUuidV4(): string {
  // xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx : version nibble 4, variant nibble 8-b.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
