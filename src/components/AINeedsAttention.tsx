// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit's visual/typography domain prop.
import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import type { AiRepair } from "@/screens/ai-connection-logic";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { AppText } from "./ui/AppText";
import { Button } from "./ui/Button";
import { GlassSurface } from "./ui/GlassSurface";

export interface AINeedsAttentionProps {
  repair: AiRepair;
  onRepair: (action: AiRepair["action"]) => void;
  secondary?: boolean;
}

/** Settings-side repair notice. It reports the cause and never changes config itself. */
export function AINeedsAttention({
  repair,
  onRepair,
  secondary = false,
}: AINeedsAttentionProps) {
  const { colors } = useTheme();
  return (
    <GlassSurface density="dense" style={styles.surface}>
      <View style={styles.content}>
        <View style={styles.row}>
          <Icon name="warning" tone="danger" size="md" />
          <View style={styles.copy}>
            <AppText role="heading">Needs attention</AppText>
            <AppText role="body" style={{ color: colors.textSecondary }}>
              {repair.message}
            </AppText>
          </View>
        </View>
        <Button
          role={secondary ? "secondary" : "primary"}
          label={repair.label}
          onPress={() => onRepair(repair.action)}
        />
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: SPACING.xs },
  content: { gap: SPACING.md },
  row: { alignItems: "flex-start", flexDirection: "row", gap: SPACING.md },
  surface: { padding: SPACING.base },
});
