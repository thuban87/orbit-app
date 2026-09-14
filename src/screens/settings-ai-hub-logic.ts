import type { AppSettingsPatch } from "@/db/app-settings-dao";
import type { AiAvailability } from "@/logic/ai-availability";

export type AiHubSection =
  | { readonly label: "Connection"; readonly route: "AIConnection" }
  | { readonly label: "Model"; readonly route: "AIModelPicker" }
  | {
      readonly label: "Writing Style" | "Personalization Context";
      readonly route: "AIPersonalization";
      readonly params: {
        readonly focus: "writing-style" | "personalization";
      };
    }
  | {
      readonly label: "AI Data Permissions";
      readonly route: "AIPermissions";
    }
  | {
      readonly label: "Preview What Orbit Sends";
      readonly route: "AIPreview";
    };

const AI_HUB_SECTIONS: ReadonlyArray<AiHubSection> = Object.freeze([
  { label: "Connection", route: "AIConnection" },
  { label: "Model", route: "AIModelPicker" },
  {
    label: "Writing Style",
    route: "AIPersonalization",
    params: { focus: "writing-style" },
  },
  {
    label: "Personalization Context",
    route: "AIPersonalization",
    params: { focus: "personalization" },
  },
  { label: "AI Data Permissions", route: "AIPermissions" },
  { label: "Preview What Orbit Sends", route: "AIPreview" },
]);

export interface AiHubState {
  readonly status: AiAvailability;
  readonly showSimplified: boolean;
  readonly escapeHatch: boolean;
  readonly sections: ReadonlyArray<AiHubSection>;
}

/** Master-off wins over every configuration signal and is never misconfiguration. */
export function deriveAiHubState(
  aiEnabled: boolean,
  availability: AiAvailability,
): AiHubState {
  if (!aiEnabled) {
    return {
      status: "off",
      showSimplified: true,
      escapeHatch: true,
      sections: [],
    };
  }

  return {
    status: availability === "off" ? "needs-attention" : availability,
    showSimplified: false,
    escapeHatch: false,
    sections: AI_HUB_SECTIONS,
  };
}

/** The master control is deliberately incapable of mutating saved AI config. */
export function buildAiEnabledPatch(enabled: boolean): AppSettingsPatch {
  return { aiEnabled: enabled ? 1 : 0 };
}
