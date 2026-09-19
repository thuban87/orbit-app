import {
  type AppSettings,
  type AppSettingsPatch,
  type DefaultInteractionChannel,
  DEFAULT_INTERACTION_CHANNELS,
  type DefaultMessageMode,
  MESSAGE_MODES,
  type YourWeekPeriod,
  YOUR_WEEK_PERIODS,
} from "@/db/app-settings-dao";
import type { SqlExecutor } from "@/db/types";
import {
  RIGHT_SWIPE_ACTIONS,
  type RightSwipeAction,
} from "@/logic/dashboard-query-logic";

/**
 * A pure, frozen option model for a single interaction preference. Each entry
 * pairs a display label to the exact `AppSettingsPatch` it writes, so the screen
 * never re-declares the DB vocabulary or constructs a patch inline. The DAO's
 * exported enums + write-time validators remain the source of truth.
 */
export type InteractionOption<T> = {
  readonly value: T;
  readonly label: string;
  readonly patch: AppSettingsPatch;
};

const MESSAGE_MODE_LABELS: Record<DefaultMessageMode, string> = {
  remember: "Remember last",
  text: "Text",
  email: "Email",
};

/**
 * Compose default message mode options (D-04a, `default_message_mode`). Reuses
 * the DAO's exported `MESSAGE_MODES` — the option set is exactly that tuple, in
 * that order; each entry writes `{ defaultMessageMode: <mode> }`.
 */
export const MESSAGE_MODE_OPTIONS: ReadonlyArray<
  InteractionOption<DefaultMessageMode>
> = Object.freeze(
  MESSAGE_MODES.map((mode) => ({
    value: mode,
    label: MESSAGE_MODE_LABELS[mode],
    patch: { defaultMessageMode: mode } satisfies AppSettingsPatch,
  })),
);

const RIGHT_SWIPE_LABELS: Record<RightSwipeAction, string> = {
  "quick-log": "Quick Log",
  "log-contact": "Log Contact",
};

/**
 * Dashboard right-swipe action options (D-04c, `dashboard_right_swipe_action`).
 * Reuses the canonical `RIGHT_SWIPE_ACTIONS` tuple from dashboard-query-logic
 * (the DAO validates against the same source); each entry writes
 * `{ dashboardRightSwipeAction: <action> }`.
 */
export const RIGHT_SWIPE_OPTIONS: ReadonlyArray<
  InteractionOption<RightSwipeAction>
> = Object.freeze(
  RIGHT_SWIPE_ACTIONS.map((action) => ({
    value: action,
    label: RIGHT_SWIPE_LABELS[action],
    patch: { dashboardRightSwipeAction: action } satisfies AppSettingsPatch,
  })),
);

const DEFAULT_CHANNEL_LABELS: Record<DefaultInteractionChannel, string> = {
  remember: "Remember Last Choice",
  Message: "Message",
  Call: "Call",
  "In Person": "In Person",
};

/**
 * Default interaction channel options (§F, `default_interaction_channel`).
 * Reuses the DAO's `DEFAULT_INTERACTION_CHANNELS` ordinary-channel contract
 * (`remember` / Message / Call / In Person; Group Log is exempt per §F); each
 * entry writes `{ defaultInteractionChannel: <channel> }`.
 */
export const DEFAULT_CHANNEL_OPTIONS: ReadonlyArray<
  InteractionOption<DefaultInteractionChannel>
> = Object.freeze(
  DEFAULT_INTERACTION_CHANNELS.map((channel) => ({
    value: channel,
    label: DEFAULT_CHANNEL_LABELS[channel],
    patch: { defaultInteractionChannel: channel } satisfies AppSettingsPatch,
  })),
);

const YOUR_WEEK_PERIOD_LABELS: Record<YourWeekPeriod, string> = {
  rolling7: "Rolling 7 Days",
  calendar_week: "Calendar Week",
};

/** Both Digest and Settings persist this exact app_settings preference key. */
export const YOUR_WEEK_PERIOD_OPTIONS: ReadonlyArray<
  InteractionOption<YourWeekPeriod>
> = Object.freeze(
  YOUR_WEEK_PERIODS.map((period) => ({
    value: period,
    label: YOUR_WEEK_PERIOD_LABELS[period],
    patch: { yourWeekPeriod: period } satisfies AppSettingsPatch,
  })),
);

/**
 * Injectable dependencies for the Interaction Assist write path, mirroring the
 * `persistNotificationSettings` deps shape. The caller (the Interactions screen)
 * binds the real DAO writer/reader, the app-global banner refresh, and the
 * local-date clock; the test injects mocks.
 *
 * These deps are a REQUIRED parameter rather than a defaulted one because the
 * real bindings (`localDateTime` from `@/db/database`, `useAssistBanner` from
 * `@/stores/assist-store`) transitively import `expo-sqlite` / react-native,
 * whose Flow source vitest-node cannot parse — a top-level default import would
 * make this very module (and its required unit test) unloadable in the node test
 * env. The DAO enums/types stay imported (the DAO is node-safe); only the
 * RN-tethered runtime bindings are pushed to the caller.
 */
export interface InteractionAssistDeps {
  setInteractionAssistEnabled: (
    exec: SqlExecutor,
    enabled: 0 | 1,
    now: string,
  ) => Promise<void>;
  getAppSettings: (exec: SqlExecutor) => Promise<AppSettings>;
  refreshBanner: () => Promise<void>;
  now: () => string;
}

/**
 * Persist the migrated Interaction Assist toggle (D-10 / ADR-070: "off means
 * off, clear at once"). It writes through the CANONICAL specialized writer
 * `setInteractionAssistEnabled` — whose single transaction expires every
 * `pending` `interaction_assists` row on opt-out — then re-reads settings and
 * refreshes the app-global assist banner so it drops the just-expired pending
 * assists. It NEVER routes through the generic `updateAppSettings` / `persist()`
 * path, which would silently drop the atomic queue-clear + banner refresh and
 * reintroduce ADR-070's REJECTED "leave pending assists prompting" alternative.
 * Mirrors `SettingsScreen.tsx:596-606` verbatim. Injectable for vitest-node.
 */
export async function persistInteractionAssistEnabled(
  exec: SqlExecutor,
  enabled: 0 | 1,
  deps: InteractionAssistDeps,
): Promise<AppSettings> {
  await deps.setInteractionAssistEnabled(exec, enabled, deps.now());
  const next = await deps.getAppSettings(exec);
  await deps.refreshBanner();
  return next;
}
