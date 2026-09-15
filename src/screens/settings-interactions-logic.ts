import {
  type AppSettingsPatch,
  type DefaultMessageMode,
  MESSAGE_MODES,
} from "@/db/app-settings-dao";

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
