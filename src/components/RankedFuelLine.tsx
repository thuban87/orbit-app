/**
 * RankedFuelLine (FUEL-03) — the SURFACE-AGNOSTIC promoted line: the single
 * top-ranked fuel item's `text`, rendered as one clean, glance-legible string.
 *
 * This is the ONE projection dossier Cluster D decided serves every glanceable
 * surface. On the profile it renders as a promoted strip above the FuelEditor;
 * the SAME string is reused (unchanged) by the Phase-8 card preview, the Phase-11
 * notification line, and the Phase-12 widget tile — so this component takes a
 * plain string, holds NO ranking logic and NO DB access, and adds NO kind prefix
 * (the kind drove ranking upstream in `getRankedFuel`, not the display).
 *
 * The string is guaranteed non-`off_limits`, non-unconfirmed-AI, and non-blank by
 * `getRankedFuel`'s in-query predicates — never by anything here. When there is no
 * rankable fuel the caller passes null/empty and this renders NOTHING (the
 * editor's own empty state is the only prompt; the card's no-fuel state is
 * Phase-8-owned).
 *
 * Display contract (07-UI-SPEC): ONE line, `numberOfLines={1}`, tail ellipsis,
 * Body (15/400) `textPrimary` on a `surface` card with a `borderStrong` outline.
 * Every colour resolves through `useTheme().colors.*` — no net-new token, no raw
 * hex (CLAUDE.md / check:colors).
 */
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";

export interface RankedFuelLineProps {
  /** The top-ranked item's text (already excluded/ranked by getRankedFuel). */
  text: string | null | undefined;
  testID?: string;
}

export function RankedFuelLine({ text, testID }: RankedFuelLineProps) {
  const { colors } = useTheme();

  // No rankable fuel → render nothing. (getRankedFuel already drops blank rows,
  // so a present string is always usable; this guard covers the empty list.)
  if (!text || text.trim().length === 0) {
    return null;
  }

  return (
    <View
      testID={testID}
      style={[
        styles.strip,
        { backgroundColor: colors.surface, borderColor: colors.borderStrong },
      ]}
    >
      <Text
        testID={testID ? `${testID}-text` : undefined}
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[styles.text, { color: colors.textPrimary }]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  text: {
    fontSize: 15,
    fontWeight: "400",
  },
});
