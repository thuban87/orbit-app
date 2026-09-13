/**
 * Pure form <-> DAO-input + defaulting model for LogInteractionScreen
 * (CAPT-07/08/09/10/11/13/14).
 *
 * Extracted from the RN screen so the correctness-critical rules are unit-tested
 * in the node Vitest env (`LogInteractionScreen.tsx` imports react-native + the
 * native `TouchpointRefineForm`, and cannot load there — the same split as
 * `edit-interaction-logic.ts` / `create-contact-logic.ts`). This module owns the
 * genuinely-new Log-Interaction logic — the shared refine form owns the widgets,
 * the recency DAO owns the write — namely:
 *
 *   • channel-sensitive Direction/Connected DEFAULTING (CAPT-08, dossier §R/§S):
 *     In Person → Direction Mutual + Connected hidden; Message/Call → Direction
 *     Outbound + Connected shown; a channel change never re-fights a Direction the
 *     user explicitly overrode;
 *   • the Default Interaction Channel PREFERENCE resolution (CAPT-11, D-09): a
 *     fixed preference selects that channel, the `remember` sentinel reads the
 *     remembered value (Message fallback);
 *   • the REMEMBERED-write gate (CAPT-11, D-09): the remembered channel updates
 *     ONLY after a successful ordinary (non-group) save — never on cancel/failure
 *     and never for Group Log;
 *   • assembling the `recordTouchpoint` input from the controlled form value —
 *     Tone passthrough (null stays null, never coerced to Neutral — D-08), Allow-AI
 *     via `coerceAllowAi` (default OFF — D-04), duration optional; and
 *   • the three canonical ordinary-log channel options + the Phase-36 Allow-AI
 *     type-default seam.
 *
 * Pure and react-native-free — it imports only the node-safe `coerceAllowAi` from
 * `touchpoint-refine-logic` and TYPE-only shapes (erased at compile), so it never
 * pulls react-native into the vitest env. It builds NO SQL and performs NO write —
 * `recordTouchpoint` is the single recency chokepoint (ADR-010/024/071).
 */
import { coerceAllowAi } from "@/components/touchpoint-refine-logic";
import type { TouchpointRefineValue } from "@/components/TouchpointRefineForm";
import type {
  DefaultInteractionChannel,
  RememberedInteractionChannel,
} from "@/db/app-settings-dao";
import type { RecordTouchpointInput } from "@/db/recency-dao";

/**
 * The three canonical ordinary-log channels (D-06, frozen). This is the option
 * set LogInteractionScreen passes to TouchpointRefineForm's `channelOptions` prop
 * (CAPT-08) — EXACTLY Message/Call/In Person, in that order, with NO legacy
 * `other`/`unspecified`. Shaped to match the form's channel-option element so the
 * screen can pass it straight through. The shared Edit Interaction / Group Log
 * surfaces pass NO channelOptions and keep the form's default five entries, so a
 * legacy `other`/`unspecified` row stays representable there (no Phase-32 regression).
 */
export const ORDINARY_LOG_CHANNEL_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "Message", label: "Message" },
  { value: "Call", label: "Call" },
  { value: "In Person", label: "In Person" },
] as const;

/** Message-first fallback when a remembered value is somehow absent (CAPT-11). */
const REMEMBERED_FALLBACK: RememberedInteractionChannel = "Message";

/** The channel-sensitive Direction/Connected defaults for one channel (dossier §R/§S). */
export interface ChannelDefaults {
  /** Direction default: `outbound` for Message/Call, `mutual` for In Person. */
  direction: string;
  /** True for In Person — the Connected control is hidden (a face-to-face is connected). */
  connectedHidden: boolean;
  /** Connected default — always Yes (1) on a fresh channel selection. */
  connected: number;
}

/**
 * The channel-sensitive Direction/Connected defaults (CAPT-08, dossier §R/§S):
 *   • In Person → Direction Mutual, Connected hidden (and 1);
 *   • Message / Call (and any other channel) → Direction Outbound, Connected shown (1).
 * Connected defaults Yes in every case; only In Person HIDES the control.
 */
export function defaultsForChannel(channel: string): ChannelDefaults {
  if (channel === "In Person") {
    return { direction: "mutual", connectedHidden: true, connected: 1 };
  }
  return { direction: "outbound", connectedHidden: false, connected: 1 };
}

/**
 * Apply a channel change to the controlled refine value, seeding the
 * channel-sensitive Direction/Connected defaults (CAPT-08). GUARDED: once the
 * user has explicitly overridden Direction (`userOverrodeDirection`), a channel
 * change NEVER re-fights that override — the user's Direction is preserved. When
 * the new channel HIDES Connected (In Person), Connected is forced to 1 so a
 * hidden control never leaves a stale 0; otherwise the user's Connected is kept.
 */
export function applyChannelChange(
  value: TouchpointRefineValue,
  nextChannel: string,
  userOverrodeDirection: boolean,
): TouchpointRefineValue {
  const defaults = defaultsForChannel(nextChannel);
  return {
    ...value,
    channel: nextChannel,
    direction: userOverrodeDirection ? value.direction : defaults.direction,
    connected: defaults.connectedHidden ? 1 : value.connected,
  };
}

/**
 * Resolve the initial Channel from the Default Interaction Channel preference
 * (CAPT-11, D-09): a fixed preference (`Message`/`Call`/`In Person`) selects that
 * channel; the `remember` sentinel reads the remembered value, falling back to
 * `Message` when the remembered value is somehow absent. Never returns empty.
 */
export function resolveInitialChannel(
  pref: DefaultInteractionChannel,
  remembered: RememberedInteractionChannel | null | undefined,
): string {
  if (pref !== "remember") {
    return pref;
  }
  return remembered ?? REMEMBERED_FALLBACK;
}

/** The inputs that decide whether the remembered channel should be written. */
export interface RememberedWriteContext {
  /** True only after a CONFIRMED successful interaction save. */
  saveSucceeded: boolean;
  /** True for a Group Log save — which never mutates the remembered channel. */
  isGroupLog: boolean;
}

/**
 * Gate the remembered-channel write (CAPT-11, D-09): update the remembered channel
 * ONLY after a successful ordinary (non-group) save. A cancelled/failed save and
 * every Group Log save leave it unchanged. Re-saving the same channel is
 * idempotent (the DAO write is a plain assignment).
 */
export function shouldUpdateRemembered(ctx: RememberedWriteContext): boolean {
  return ctx.saveSucceeded && !ctx.isGroupLog;
}

/**
 * The Allow-AI initial value (CAPT-10, D-04). Returns 0 (OFF) today — the single
 * seam Phase 36's new-items-only type default will later feed WITHOUT changing
 * shipped behavior. A forward reference only; this phase ships Allow-AI-OFF.
 */
export function resolveInitialAllowAi(): number {
  return 0;
}

/** The ids + timestamp that scope one ordinary log through the recency spine. */
export interface LogInteractionDeps {
  contactId: number;
  /** Merge-key UUID for the new interaction row — `newUid()`. */
  uid: string;
  /** Local wall-clock now — `localDateTime()` (immutable recorded_at + modified_at). */
  now: string;
}

/**
 * Map the controlled refine value + ids into the `recordTouchpoint` input (the
 * SOLE recency writer for a new interaction). Tone (`quality`) passes through
 * verbatim — a null Tone STAYS null, never coerced to Neutral (D-08). Allow-AI is
 * normalised through `coerceAllowAi` so any non-explicit value resolves OFF (0,
 * D-04). Duration is optional (null = none). This builds NO SQL — the DAO owns the
 * future-date guard and the recency recompute inside its one transaction.
 */
export function buildLogInteractionInput(
  value: TouchpointRefineValue,
  deps: LogInteractionDeps,
): RecordTouchpointInput {
  return {
    contactId: deps.contactId,
    uid: deps.uid,
    occurredAt: value.occurredAt,
    now: deps.now,
    channel: value.channel,
    direction: value.direction,
    connected: value.connected,
    quality: value.quality,
    note: value.note,
    duration: value.duration,
    allowAi: coerceAllowAi(value.allowAi),
    source: "manual",
  };
}
