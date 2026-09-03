/**
 * StatusGlyph (THEME-08 / D-06) — renders the DISTINCT silhouette for a
 * relationship display state through the icon registry, with colour from the
 * status theme tokens (never a hex) and an accessibilityLabel naming the state.
 *
 * Status stays readable WITHOUT colour via three redundant channels: the
 * distinct glyph (`statusGlyph`, the single source beside `ringVisual`), the
 * border weight `ringVisual` carries on the card ring, and this label. The tone
 * key is typed to the narrower `StatusTone` subset (never a raw
 * `keyof ThemePalette`) so it can only ever be a status/neutral token
 * (REVIEWS 23-05 cycle-4 MEDIUM).
 *
 * This is the STATUS-GLYPH PRIMITIVE + source; wiring it into
 * ContactCard/Profile/Orrery is a renderer-phase/Phase-15 adoption task (the
 * deferred-by-design scope note), verified here at the primitive level.
 */
import { View } from "react-native";
import {
  statusGlyph,
  type StatusDisplayState,
} from "@/components/contact-card-ring";
import { Icon } from "./Icon";
import type { IconSizeToken } from "@/theme/tokens/icon-size";
import type { StatusTone } from "./icon-registry";

/** Per-state status/neutral tone token — a `StatusTone`, never a raw palette key. */
const STATUS_TONE: Record<string, StatusTone> = {
  stable: "statusStable",
  wobble: "statusWobble",
  decay: "statusDecay",
  rogue: "rogue",
  snoozed: "border",
  null: "border",
};

/** Human-readable state name — the non-colour label channel. */
const STATUS_LABEL: Record<string, string> = {
  stable: "Stable",
  wobble: "Wobbling",
  decay: "Decaying",
  rogue: "Rogue",
  snoozed: "Snoozed",
  null: "Not yet contacted",
};

function stateKey(state: StatusDisplayState): string {
  return state === null ? "null" : state;
}

export interface StatusGlyphProps {
  state: StatusDisplayState;
  size?: IconSizeToken;
}

export function StatusGlyph({ state, size = "md" }: StatusGlyphProps) {
  const key = stateKey(state);
  const tone = STATUS_TONE[key];
  const label = STATUS_LABEL[key];
  return (
    <View accessible accessibilityLabel={label}>
      <Icon name={statusGlyph(state)} tone={tone} size={size} />
    </View>
  );
}
