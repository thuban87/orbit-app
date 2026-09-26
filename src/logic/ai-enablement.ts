/**
 * ai-enablement — the single canonical AI master predicate (38.4 RG-008;
 * architecture/AUD-ARCH-003, react-native/AUD-RN-005; D-17).
 *
 * ADR-135 made `app_settings.ai_enabled` the durable master switch. It is
 * deliberately distinct from the active connection, connection readiness,
 * per-item `allow_ai` consent and each lane's remembered model: the master
 * answers only "has the user turned AI on?". The legacy `aiProvider` field is a
 * retained compatibility field (backup schema, older settings rows) and must
 * never decide whether AI is available — a stale `'none'` there must not hide
 * AI from a user who turned the master on, and a stale provider id must not
 * surface AI after the user turned the master off.
 *
 * Pure: reads no storage and writes nothing, so a host that derives availability
 * from it on load can never change consent as a side effect (D-17).
 *
 * NODE-PURE: no UI-runtime import.
 */

import type { AppSettings } from "@/db/app-settings-dao";

/** Whether the user's AI master switch is on (ADR-135). */
export function isAiMasterEnabled(
  settings: Pick<AppSettings, "aiEnabled">,
): boolean {
  return settings.aiEnabled === 1;
}
