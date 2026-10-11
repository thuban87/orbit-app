import { useNavigation } from "@react-navigation/native";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { resolveBackIntent } from "@/navigation/back-intent";
import { shellTransientStore } from "@/stores/shell-transient-store";
import {
  GlassForegroundScope,
  useGlassForegroundColors,
  useTheme,
} from "@/theme";
import { artScrimBacking } from "@/theme/art-treatments";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { chromeScrimOpacity } from "@/theme/tokens/surface";
import { useArtTreatment } from "@/theme/use-art-treatment";
import { Icon } from "./icons/Icon";
import { type OverflowAction, OverflowMenu } from "./OverflowMenu";
import { PersonLine } from "./PersonLine";

interface TrailingFitOptions {
  /** True until the complete app bar has measured enough room for labels. */
  compact: boolean;
}

type TrailingContent = ReactNode | ((options: TrailingFitOptions) => ReactNode);

interface ShellAppBarProps {
  variant: "root" | "child";
  title: string;
  overflow?: OverflowAction[];
  /** Existing ReactNode callers remain supported; root chrome can consume fit state. */
  trailing?: TrailingContent;
  /** Expanded labels that this bar measures invisibly at the active OS text scale. */
  trailingLabelProbe?: readonly string[];
  /**
   * The v2-marked header this bar is (38.5-06 / D-08, D-28). Only the Contacts
   * and Digest headers opt in; omitted, the bar renders exactly today's tree.
   */
  artComponent?: "contactsHeader" | "digestHeader";
  /**
   * Custom Back semantics (38.9 D-16). Runs AFTER the open-transient check, so
   * an open sheet or menu still closes first; omitted, Back is
   * `navigation.goBack()`. Either way a screen's own `goBack()` fires
   * `beforeRemove`, so discard guards keep working (T-38.9-22).
   */
  onBack?: () => void;
  /**
   * The child header's exit glyph (38.9 D-16, D-44, D-59): `back` is the
   * chevron labelled "Back"; `cancel` is the close glyph labelled "Cancel", for
   * focused confirm-or-abandon routes. Both are icon-only in a 44dp target.
   */
  backKind?: "back" | "cancel";
  /**
   * The person a person-scoped form is for (38.9 D-45): a line with their
   * avatar and name under the fixed title. Null or omitted renders no line.
   */
  person?: ShellAppBarPerson | null;
}

export interface ShellAppBarPerson {
  name: string;
  /** Stored RELATIVE photo path, or null for the initials avatar. */
  photo: string | null;
  contactId?: number;
}

const ROOT_HORIZONTAL_PADDING = 16;
const OVERFLOW_WIDTH = 44;
const ROOT_GAP_COUNT = 2;
const ROOT_GAP = 8;
const TWO_DESTINATION_CHROME_WIDTH = 64;
/** The child Back/Cancel target (44dp floor; D-44). */
const BACK_TARGET = 44;
/**
 * Gap between the title row and the person line (38.9 D-45, owner amendment:
 * more vertical space than the mockup). The row's own vertical slack (minHeight
 * 52) adds to it at default text size. Tune here (this plan only).
 */
const PERSON_LINE_GAP = SPACING.md;

/**
 * Shared screen-owned chrome for shell roots and future child surfaces. Root
 * destinations have a branded/title-only bar; child destinations add Back.
 *
 * ART TREATMENT OPT-IN (38.5-06 / D-08, D-10, D-28): with `artComponent`, the
 * scrim comes from the per-combination table. Backing `none` draws no scrim, and
 * the title/Back read the ROOT palette with trailing/overflow unscoped (text on
 * the art takes the root, art-suited colour). With `overflowLocalBacking` (the
 * owner's ⋯ question; false in production) only the ⋯ trigger gets a local
 * backing at today's header value, inside the glass scope. The bottom hairline
 * is unchanged for every backing.
 */
export function ShellAppBar({
  variant,
  title,
  overflow,
  trailing,
  trailingLabelProbe,
  artComponent,
  onBack: onBackOverride,
  backKind = "back",
  person,
}: ShellAppBarProps) {
  const { colors, mode, package: themePackage } = useTheme();
  // The bar draws its OWN chrome scrim below, so its title/Back read the glass
  // foreground palette directly (RG-029 / D-24: Standard Light over an asset
  // resolves the secondary Back label to primary).
  const glassColors = useGlassForegroundColors();
  const treatment = useArtTreatment(artComponent);
  const scrim = artScrimBacking(
    treatment,
    chromeScrimOpacity(themePackage, mode),
  );
  // Backing `none`: the text sits on the art, so it takes the root palette.
  const barColors = scrim.scoped ? glassColors : colors;
  const overflowLocalBacking =
    !scrim.scoped && treatment?.overflowLocalBacking === true;
  const navigation = useNavigation();
  const [rootWidth, setRootWidth] = useState(0);
  const [titleWidth, setTitleWidth] = useState(0);
  const [labelWidths, setLabelWidths] = useState<Record<string, number>>({});

  const labelsMeasured =
    trailingLabelProbe?.every((label) => labelWidths[label] !== undefined) ??
    false;
  const expandedTrailingWidth = trailingLabelProbe
    ? trailingLabelProbe.reduce(
        (total, label) => total + (labelWidths[label] ?? 0),
        TWO_DESTINATION_CHROME_WIDTH,
      )
    : 0;
  const availableTrailingWidth =
    rootWidth -
    ROOT_HORIZONTAL_PADDING * 2 -
    titleWidth -
    (overflow ? OVERFLOW_WIDTH : 0) -
    ROOT_GAP_COUNT * ROOT_GAP;
  // Fail closed before every measurement is available: labels only expand if
  // this bar proves they fit beside the rendered title and overflow affordance.
  const compact = !(
    rootWidth > 0 &&
    titleWidth > 0 &&
    labelsMeasured &&
    availableTrailingWidth >= expandedTrailingWidth
  );
  const trailingContent =
    typeof trailing === "function" ? trailing({ compact }) : trailing;

  const onBack = () => {
    const intent = resolveBackIntent({
      anyTransientOpen: shellTransientStore.getState().isAnyOpen(),
    });

    if (intent === "dismiss-transient") {
      shellTransientStore.getState().dismissTop();
      return;
    }

    if (onBackOverride) {
      onBackOverride();
      return;
    }

    navigation.goBack();
  };

  const cancel = backKind === "cancel";
  // Icon-only exit glyph (D-44 chevron; D-16/D-59 close for Cancel). `Icon`
  // reads `useTheme()`, so inside the scope it takes the glass foreground, like
  // the title.
  const backGlyph = cancel ? (
    <Icon name="close" tone="textPrimary" size="md" />
  ) : (
    <Icon name="back" tone="textPrimary" size="md" />
  );

  return (
    <View style={[styles.header, { borderColor: colors.border }]}>
      {/* Chrome scrim (31.1-05): a local surface backing so the title/Back stay
          AA-readable over the now-visible background veil. Token-only, absolute
          fill of the WHOLE header (the title row and the person line, 38.9
          C5-M6), never intercepts touches. */}
      {scrim.opacity !== null ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.surface,
              opacity: scrim.opacity,
            },
          ]}
        />
      ) : null}
      <View
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          setRootWidth((current) => (current === width ? current : width));
        }}
        style={styles.root}
      >
        {variant === "child" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cancel ? "Cancel" : "Back"}
            hitSlop={8}
            onPress={onBack}
            style={styles.back}
          >
            {scrim.scoped ? (
              <GlassForegroundScope>{backGlyph}</GlassForegroundScope>
            ) : (
              backGlyph
            )}
          </Pressable>
        ) : null}
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          ellipsizeMode="tail"
          onTextLayout={(event) => {
            const width = Math.max(
              0,
              ...event.nativeEvent.lines.map((line) => line.width),
            );
            setTitleWidth((current) => (current === width ? current : width));
          }}
          style={[styles.title, { color: barColors.textPrimary }]}
        >
          {title}
        </Text>
        {trailingContent ? (
          <View style={styles.trailing}>
            {scrim.scoped ? (
              <GlassForegroundScope>{trailingContent}</GlassForegroundScope>
            ) : (
              trailingContent
            )}
          </View>
        ) : null}
        {overflow && overflow.length > 0 ? (
          overflowLocalBacking ? (
            // The owner's ⋯ question (re-sign-off sheet): a local backing behind
            // only the ⋯ trigger at today's header value; the trigger is scoped.
            <View>
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: colors.surface,
                    opacity: chromeScrimOpacity(themePackage, mode),
                    borderRadius: RADII.sm,
                  },
                ]}
              />
              <GlassForegroundScope>
                <OverflowMenu actions={overflow} />
              </GlassForegroundScope>
            </View>
          ) : scrim.scoped ? (
            <GlassForegroundScope>
              <OverflowMenu actions={overflow} />
            </GlassForegroundScope>
          ) : (
            <OverflowMenu actions={overflow} />
          )
        ) : null}
        {trailingLabelProbe ? (
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={styles.labelProbe}
          >
            {trailingLabelProbe.map((label) => (
              <Text
                key={label}
                onTextLayout={(event) => {
                  const width = Math.max(
                    0,
                    ...event.nativeEvent.lines.map((line) => line.width),
                  );
                  setLabelWidths((current) =>
                    current[label] === width
                      ? current
                      : { ...current, [label]: width },
                  );
                }}
                style={styles.labelProbeText}
              >
                {label}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      {person ? (
        <View
          style={[
            styles.person,
            variant === "child" ? styles.personUnderChildTitle : null,
          ]}
        >
          {scrim.scoped ? (
            <GlassForegroundScope>
              <PersonLine
                name={person.name}
                photo={person.photo}
                contactId={person.contactId}
              />
            </GlassForegroundScope>
          ) : (
            <PersonLine
              name={person.name}
              photo={person.photo}
              contactId={person.contactId}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The header column: the bottom hairline and the chrome scrim belong to the
  // whole header, so they sit under the person line too (38.9 C5-M6).
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  root: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: ROOT_GAP,
    paddingHorizontal: ROOT_HORIZONTAL_PADDING,
  },
  back: {
    minWidth: BACK_TARGET,
    minHeight: BACK_TARGET,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  person: {
    paddingBottom: SPACING.sm,
    paddingHorizontal: ROOT_HORIZONTAL_PADDING,
    paddingTop: PERSON_LINE_GAP,
  },
  // Aligned under the title, past the Back target (mockup PN-A).
  personUnderChildTitle: {
    paddingLeft: ROOT_HORIZONTAL_PADDING + BACK_TARGET + ROOT_GAP,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
  },
  labelProbe: {
    position: "absolute",
    left: -10000,
    opacity: 0,
    flexDirection: "row",
  },
  labelProbeText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
