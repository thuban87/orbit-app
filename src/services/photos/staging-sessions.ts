/** In-process guard against a foreground drain sweeping a live staged photo. */
const active = new Set<string>();
const endedAt = new Map<string, number>();
let sequence = 0;

export function beginStagingSession(token: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(token))
    throw new Error("unsafe staging session token");
  sequence += 1;
  active.add(token);
  endedAt.delete(token);
}
export function endStagingSession(token: string): void {
  sequence += 1;
  active.delete(token);
  endedAt.set(token, sequence);
}
export function isStagingSessionActive(token: string): boolean {
  return active.has(token);
}
export function stagingPassMark(): number {
  return sequence;
}

function matches(relative: string, token: string): boolean {
  const path = relative.endsWith(".stage-tmp")
    ? relative.slice(0, -10)
    : relative;
  if (path.startsWith("avatars/_restore_pending/"))
    return path.endsWith(`-${token}.jpg`);
  if (path.startsWith("profile-backgrounds/_restore_pending/"))
    return path.endsWith(`/${token}.jpg`);
  return false;
}
export function pendingBelongsToActiveSession(relative: string): boolean {
  for (const token of active) if (matches(relative, token)) return true;
  return false;
}
export function sessionTouchedSince(relative: string, mark: number): boolean {
  if (pendingBelongsToActiveSession(relative)) return true;
  for (const [token, end] of endedAt)
    if (end > mark && matches(relative, token)) return true;
  return false;
}
export function __resetStagingSessionsForTest(): void {
  active.clear();
  endedAt.clear();
  sequence = 0;
}
