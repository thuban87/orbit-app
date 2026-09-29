/**
 * Bare-text site classifier fixtures (38.5-01, P-6; D-02 scope: text directly on
 * the art with no glass or opaque backing).
 *
 * The classifier (`__contract__/bare-text-sites.ts`) is TOOL SUPPORT ONLY: the
 * `scripts/bare-text-inventory.ts` CLI re-derives the brief's `bare-text-sites.csv`
 * from the code on disk with it. These fixtures pin the backing classes of the
 * 38.4 brief §C (glass, opaque, bare, mixed), the AppText role colour defaults
 * and the fill-less Button roles, on in-memory sources.
 */
import { describe, expect, it } from "vitest";
import {
  BARE_TEXT_CSV_COLUMNS,
  type BareTextAnalysis,
  classifyBareTextSites,
  rowsToCsv,
} from "./__contract__/bare-text-sites";
import { ART_COMBINATION_KEYS, ART_TREATMENTS } from "./art-treatments";

const NAV = "src/navigation/tabs/TestStack.tsx";

function stack(routes: Record<string, { name: string; from: string }>): {
  file: string;
  source: string;
} {
  const imports = Object.values(routes)
    .map((r) => `import { ${r.name} } from "${r.from}";`)
    .join("\n");
  const screens = Object.entries(routes)
    .map(
      ([route, r]) =>
        `      <Stack.Screen name="${route}" component={${r.name}} />`,
    )
    .join("\n");
  return {
    file: NAV,
    source: `${imports}
const Stack = createNativeStackNavigator();
export function TestStack() {
  return (
    <Stack.Navigator>
${screens}
    </Stack.Navigator>
  );
}
`,
  };
}

function site(analysis: BareTextAnalysis, file: string, line: number) {
  const found = analysis.sites.find((s) => s.file === file && s.line === line);
  if (!found) throw new Error(`no site at ${file}:${line}`);
  return found;
}

/** The 1-based line of the first occurrence of `needle` in `source`. */
function lineOf(source: string, needle: string): number {
  const idx = source.indexOf(needle);
  if (idx < 0) throw new Error(`needle not found: ${needle}`);
  return source.slice(0, idx).split("\n").length;
}

describe("classifyBareTextSites — backing classes", () => {
  it("text inside GlassSurface, ChromeScrim or ShellAppBar is backed (glass)", () => {
    const screen = `import { View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { ShellAppBar } from "@/components/ShellAppBar";
export function GlassScreen() {
  return (
    <View>
      <ShellAppBar title={<AppText role="heading">Bar</AppText>} />
      <GlassSurface treatment="card">
        <AppText role="body">In card</AppText>
      </GlassSurface>
      <ChromeScrim>
        <AppText role="caption">In scrim</AppText>
      </ChromeScrim>
    </View>
  );
}
`;
    const file = "src/screens/GlassScreen.tsx";
    const a = classifyBareTextSites([
      { file, source: screen },
      stack({ Glass: { name: "GlassScreen", from: "@/screens/GlassScreen" } }),
    ]);
    for (const needle of ["Bar</AppText>", "In card", "In scrim"]) {
      const s = site(a, file, lineOf(screen, needle));
      expect(s.classification).toBe("backed");
      expect(s.backingKinds).toContain("glass");
    }
    expect(a.rows).toHaveLength(0);
  });

  it("text inside a palette-filled View or a Sheet/Modal/ConfirmDialog is backed (opaque)", () => {
    const screen = `import { View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { Sheet } from "@/components/ui/Sheet";
export function OpaqueScreen() {
  const { colors } = useTheme();
  return (
    <View>
      <View style={[styles.row, { backgroundColor: colors.surfaceElevated }]}>
        <AppText role="body">On surface</AppText>
      </View>
      <Sheet visible>
        <AppText role="body">In sheet</AppText>
      </Sheet>
    </View>
  );
}
`;
    const file = "src/screens/OpaqueScreen.tsx";
    const a = classifyBareTextSites([
      { file, source: screen },
      stack({
        Opaque: { name: "OpaqueScreen", from: "@/screens/OpaqueScreen" },
      }),
    ]);
    for (const needle of ["On surface", "In sheet"]) {
      const s = site(a, file, lineOf(screen, needle));
      expect(s.classification).toBe("backed");
      expect(s.backingKinds).toContain("opaque");
    }
  });

  it("text with no backing up to the route registration is bare, with the brief's columns", () => {
    const screen = `import { View, Text } from "react-native";
import { AppText } from "@/components/ui/AppText";
export function BareScreen() {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <AppText role="caption" style={{ color: colors.danger }}>Load failed</AppText>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>Hint</Text>
    </View>
  );
}
`;
    const file = "src/screens/BareScreen.tsx";
    const a = classifyBareTextSites([
      { file, source: screen },
      stack({ Digest: { name: "BareScreen", from: "@/screens/BareScreen" } }),
    ]);
    const danger = site(a, file, lineOf(screen, "Load failed"));
    expect(danger.classification).toBe("bare");
    expect(danger.token).toBe("danger");
    const row = a.rows.find((r) => r.fileLine === `${file}:${danger.line}`);
    expect(row).toMatchObject({
      route: "Digest",
      component: "BareScreen",
      element: "AppText",
      token: "danger",
      roleSize: "caption 14/400",
      floor: "4.5",
      bareKind: "bare",
      verification: "ESTIMATED(AST-traced, not hand-read)",
      xBand: "ESTIMATED(n/a)",
    });
    expect(row?.density.startsWith("comfortable")).toBe(true);
    expect(row?.parentChainNote).toContain(`route:Digest@${NAV}`);
    const text = a.rows.find(
      (r) => r.fileLine === `${file}:${lineOf(screen, "Hint")}`,
    );
    expect(text).toMatchObject({
      element: "Text",
      token: "textSecondary",
      roleSize: 'Text 13/"600"',
    });
    expect(rowsToCsv(a.rows).split("\n")[0]).toBe(
      BARE_TEXT_CSV_COLUMNS.join(","),
    );
  });

  it("a component rendered under a backed parent at one site and a bare parent at another is mixed", () => {
    const row = `import { AppText } from "@/components/ui/AppText";
export function SharedRow() {
  return <AppText role="label">Shared</AppText>;
}
`;
    const screenA = `import { GlassSurface } from "@/components/ui/GlassSurface";
import { SharedRow } from "@/components/SharedRow";
export function CardScreen() {
  return (
    <GlassSurface>
      <SharedRow />
    </GlassSurface>
  );
}
`;
    const screenB = `import { View } from "react-native";
import { SharedRow } from "@/components/SharedRow";
export function PlainScreen() {
  return (
    <View>
      <SharedRow />
    </View>
  );
}
`;
    const a = classifyBareTextSites([
      { file: "src/components/SharedRow.tsx", source: row },
      { file: "src/screens/CardScreen.tsx", source: screenA },
      { file: "src/screens/PlainScreen.tsx", source: screenB },
      stack({
        CardRoute: { name: "CardScreen", from: "@/screens/CardScreen" },
        PlainRoute: { name: "PlainScreen", from: "@/screens/PlainScreen" },
      }),
    ]);
    const s = site(a, "src/components/SharedRow.tsx", 3);
    expect(s.classification).toBe("mixed");
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0]).toMatchObject({
      route: "PlainRoute",
      bareKind: "mixed",
      token: "textPrimary(default)",
    });
  });

  it("a wrapper that renders its children inside a backing backs its call-site children", () => {
    const card = `import { GlassSurface } from "@/components/ui/GlassSurface";
export function InfoCard({ children }: { children: React.ReactNode }) {
  return <GlassSurface>{children}</GlassSurface>;
}
`;
    const screen = `import { AppText } from "@/components/ui/AppText";
import { InfoCard } from "@/components/InfoCard";
export function WrappedScreen() {
  return (
    <InfoCard>
      <AppText role="body">Wrapped</AppText>
    </InfoCard>
  );
}
`;
    const a = classifyBareTextSites([
      { file: "src/components/InfoCard.tsx", source: card },
      { file: "src/screens/WrappedScreen.tsx", source: screen },
      stack({
        Wrapped: { name: "WrappedScreen", from: "@/screens/WrappedScreen" },
      }),
    ]);
    const s = site(
      a,
      "src/screens/WrappedScreen.tsx",
      lineOf(screen, "Wrapped<"),
    );
    expect(s.classification).toBe("backed");
  });
});

describe("classifyBareTextSites — table-driven art backings (38.5 WR-03)", () => {
  it("a ChromeScrim with artComponent is mixed: backed in its signed cells, bare in its `none` cells", () => {
    const screen = `import { View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
export function CountScreen() {
  return (
    <View>
      <ChromeScrim artComponent="contactsCountLabel">
        <AppText role="caption">12 contacts</AppText>
      </ChromeScrim>
      <ChromeScrim>
        <AppText role="caption">Default scrim</AppText>
      </ChromeScrim>
    </View>
  );
}
`;
    const file = "src/screens/CountScreen.tsx";
    const a = classifyBareTextSites([
      { file, source: screen },
      stack({ Count: { name: "CountScreen", from: "@/screens/CountScreen" } }),
    ]);
    const label = site(a, file, lineOf(screen, "12 contacts"));
    expect(label.classification).toBe("mixed");
    expect(label.backingKinds).toEqual(["glass"]);
    expect(label.bareRoutes).toEqual(["Count"]);
    const notes = label.chains.map((c) => c.note.join(" < ")).join("\n");
    // The signed v3 column: `none` in the 7 light-mode art and None cells.
    expect(notes).toContain("artComponent=contactsCountLabel none in 7/16");
    expect(notes).toContain("galaxy-light-quiet");
    expect(notes).toContain("artComponent=contactsCountLabel backed in 9/16");
    // 38.5-09 M-2: backed in 9 cells, bare in 7, so the ROW is
    // combination-dependent (the site keeps its chain-level `mixed`).
    expect(a.rows).toEqual([
      expect.objectContaining({
        route: "Count",
        bareKind: "combination-dependent",
      }),
    ]);
    // With no artComponent the primitive is today's always-backed scrim.
    expect(site(a, file, lineOf(screen, "Default scrim")).classification).toBe(
      "backed",
    );
  });

  it("a column with no `none` cell stays backed; a non-literal artComponent is split conservatively", () => {
    const screen = `import { View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
export function EdgeScreen({ which }: { which: string }) {
  return (
    <View>
      <ChromeScrim artComponent="contactsCardEntries">
        <AppText role="caption">Never none</AppText>
      </ChromeScrim>
      <ChromeScrim artComponent={which}>
        <AppText role="caption">Unresolved</AppText>
      </ChromeScrim>
    </View>
  );
}
`;
    const file = "src/screens/EdgeScreen.tsx";
    const a = classifyBareTextSites([
      { file, source: screen },
      stack({ Edge: { name: "EdgeScreen", from: "@/screens/EdgeScreen" } }),
    ]);
    expect(site(a, file, lineOf(screen, "Never none")).classification).toBe(
      "backed",
    );
    const unresolved = site(a, file, lineOf(screen, "Unresolved"));
    expect(unresolved.classification).toBe("mixed");
    expect(
      unresolved.chains.some((c) =>
        c.note.some((n) => n.includes("artComponent=expr:which")),
      ),
    ).toBe(true);
  });

  it("a ShellAppBar's own title follows each render site's artComponent; guarded text a site never renders is not a site there", () => {
    const bar = `import { Pressable, Text, View } from "react-native";
export function ShellAppBar({ variant, title, overflow, artComponent }) {
  return (
    <View>
      {variant === "child" ? (
        <Pressable>
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
      ) : null}
      <Text style={{ color: colors.textPrimary }}>{title}</Text>
      {overflow && overflow.length > 0 ? (
        <Text style={{ color: colors.textSecondary }}>More</Text>
      ) : null}
    </View>
  );
}
`;
    const artScreen = `import { ShellAppBar } from "@/components/ShellAppBar";
export function ArtScreen() {
  return <ShellAppBar variant="root" title="Digest" artComponent="digestHeader" />;
}
`;
    const childScreen = `import { ShellAppBar } from "@/components/ShellAppBar";
export function ChildScreen() {
  return <ShellAppBar variant="child" title="Details" overflow={actions} />;
}
`;
    const barFile = "src/components/ShellAppBar.tsx";
    const a = classifyBareTextSites([
      { file: barFile, source: bar },
      { file: "src/screens/ArtScreen.tsx", source: artScreen },
      { file: "src/screens/ChildScreen.tsx", source: childScreen },
      stack({
        ArtRoute: { name: "ArtScreen", from: "@/screens/ArtScreen" },
        ChildRoute: { name: "ChildScreen", from: "@/screens/ChildScreen" },
      }),
    ]);
    const title = site(a, barFile, lineOf(bar, "{title}"));
    expect(title.classification).toBe("mixed");
    expect(title.bareRoutes).toEqual(["ArtRoute"]);
    expect(
      title.chains.some((c) =>
        c.note.some((n) =>
          n.includes("art-none:<ShellAppBar>@src/screens/ArtScreen.tsx"),
        ),
      ),
    ).toBe(true);
    // Back renders only for variant="child", More only with `overflow`: the
    // Digest-style root bar has neither, so both stay backed.
    for (const needle of [">Back<", ">More<"]) {
      const s = site(a, barFile, lineOf(bar, needle));
      expect(s.classification, needle).toBe("backed");
      expect(s.bareRoutes, needle).toEqual([]);
    }
    expect(a.rows.map((r) => `${r.route} ${r.fileLine}`)).toEqual([
      `ArtRoute ${barFile}:${lineOf(bar, "{title}")}`,
    ]);
  });
});

describe("classifyBareTextSites — foreground tokens", () => {
  it("AppText without an explicit colour takes its role default; TextInput is always backed", () => {
    const screen = `import { View, TextInput } from "react-native";
import { AppText } from "@/components/ui/AppText";
export function RolesScreen() {
  return (
    <View>
      <AppText role="display">D</AppText>
      <AppText role="heading">H</AppText>
      <AppText>B</AppText>
      <AppText role="label">L</AppText>
      <AppText role="caption">C</AppText>
      <TextInput value="x" />
    </View>
  );
}
`;
    const file = "src/screens/RolesScreen.tsx";
    const a = classifyBareTextSites([
      { file, source: screen },
      stack({ Roles: { name: "RolesScreen", from: "@/screens/RolesScreen" } }),
    ]);
    const expectations: [string, string, string, string][] = [
      ['role="display"', "textPrimary(default)", "display 28/600", "3.0"],
      ['role="heading"', "textPrimary(default)", "heading 20/600", "4.5*"],
      ["<AppText>B", "textPrimary(default)", "body 16/400", "4.5"],
      ['role="label"', "textPrimary(default)", "label 14/600", "4.5"],
      ['role="caption"', "textSecondary(default)", "caption 14/400", "4.5"],
    ];
    for (const [needle, token, roleSize, floor] of expectations) {
      const s = site(a, file, lineOf(screen, needle));
      expect(s.classification).toBe("bare");
      expect({ token: s.token, roleSize: s.roleSize, floor: s.floor }).toEqual({
        token,
        roleSize,
        floor,
      });
    }
    const input = site(a, file, lineOf(screen, "<TextInput"));
    expect(input.classification).toBe("backed");
    expect(input.backingKinds).toContain("self-filled");
  });

  it("Button tertiary is an accentText link, iconOnly a textPrimary glyph, filled roles are not sites", () => {
    const screen = `import { View } from "react-native";
import { Button } from "@/components/ui/Button";
export function ButtonsScreen() {
  return (
    <View>
      <Button role="tertiary" label="Back" onPress={() => {}} />
      <Button role="iconOnly" icon="close" accessibilityLabel="Close" onPress={() => {}} />
      <Button role="primary" label="Save" onPress={() => {}} />
    </View>
  );
}
`;
    const file = "src/screens/ButtonsScreen.tsx";
    const a = classifyBareTextSites([
      { file, source: screen },
      stack({
        Buttons: { name: "ButtonsScreen", from: "@/screens/ButtonsScreen" },
      }),
    ]);
    const link = site(a, file, lineOf(screen, 'role="tertiary"'));
    expect(link).toMatchObject({
      element: "Button-link",
      token: "accentText",
      roleSize: "label 14/600",
      floor: "4.5",
      classification: "bare",
    });
    const icon = site(a, file, lineOf(screen, 'role="iconOnly"'));
    expect(icon).toMatchObject({
      element: "Button-icon",
      token: "textPrimary",
      roleSize: "icon 20",
      floor: "3.0",
      classification: "bare",
    });
    expect(
      a.sites.some(
        (s) => s.file === file && s.line === lineOf(screen, 'role="primary"'),
      ),
    ).toBe(false);
  });
});

describe("classifyBareTextSites — render helpers and hosted content", () => {
  it("JSX passed to a same-file render helper that renders it inside a GlassSurface is backed", () => {
    const screen = `import { View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { GlassSurface } from "@/components/ui/GlassSurface";
export function HelperScreen() {
  function card(key: string, body: React.ReactNode) {
    return <GlassSurface key={key}>{body}</GlassSurface>;
  }
  return (
    <View>
      {card("a", <AppText role="body">Inside card</AppText>)}
      <AppText role="body">Outside card</AppText>
    </View>
  );
}
`;
    const file = "src/screens/HelperScreen.tsx";
    const a = classifyBareTextSites([
      { file, source: screen },
      stack({
        Helper: { name: "HelperScreen", from: "@/screens/HelperScreen" },
      }),
    ]);
    expect(site(a, file, lineOf(screen, "Inside card")).classification).toBe(
      "backed",
    );
    expect(site(a, file, lineOf(screen, "Outside card")).classification).toBe(
      "bare",
    );
  });

  it("JSX handed to a call inside an object (a store or portal request) is flagged UNTRACED HOST", () => {
    const screen = `import { View, Pressable } from "react-native";
import { AppText } from "@/components/ui/AppText";
export function PortalScreen() {
  const open = () => panelStore.open({ content: <AppText role="body">In panel</AppText> });
  return (
    <View>
      <Pressable onPress={open} />
    </View>
  );
}
`;
    const file = "src/screens/PortalScreen.tsx";
    const a = classifyBareTextSites([
      { file, source: screen },
      stack({
        Portal: { name: "PortalScreen", from: "@/screens/PortalScreen" },
      }),
    ]);
    const s = site(a, file, lineOf(screen, "In panel"));
    expect(
      s.chains.some((c) => c.note.some((n) => n.includes("UNTRACED HOST"))),
    ).toBe(true);
  });
});

/** The signed v3 keys where `component` has `backing`. */
function keysWhere(component: string, backing: string): string[] {
  return ART_COMBINATION_KEYS.filter(
    (k) =>
      ART_TREATMENTS[k]?.[component as keyof (typeof ART_TREATMENTS)[string]]
        ?.backing === backing,
  );
}

describe("classifyBareTextSites — treatment-aware per combination (38.5-09 M-2)", () => {
  const LIST_ROW = `import { Pressable, Text } from "react-native";
import { useArtTreatment } from "@/theme/use-art-treatment";
export function ListRow({ name }: { name: string }) {
  const backing = listRowBacking(useArtTreatment("contactsListEntries"));
  return (
    <Pressable
      style={[styles.row, backing.solidFill ? { backgroundColor: colors.surface } : null]}
    >
      <Text style={{ color: colors.textPrimary }}>{name}</Text>
    </Pressable>
  );
}
`;
  const HOME = `import { View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { ListRow } from "@/components/ListRow";
export function HomeScreen() {
  return (
    <View>
      <ChromeScrim artComponent="contactsCountLabel">
        <AppText role="caption">7 contacts</AppText>
      </ChromeScrim>
      <ListRow name="Ada" />
      <GlassSurface treatment="contact-entry">
        <AppText role="label">Card name</AppText>
      </GlassSurface>
      <GlassSurface treatment="card">
        <AppText role="label">Plain card</AppText>
      </GlassSurface>
    </View>
  );
}
`;
  const homeFile = "src/screens/HomeScreen.tsx";
  const listFile = "src/components/ListRow.tsx";
  const analyse = () =>
    classifyBareTextSites([
      { file: listFile, source: LIST_ROW },
      { file: homeFile, source: HOME },
      stack({ Home: { name: "HomeScreen", from: "@/screens/HomeScreen" } }),
    ]);

  it("a `none` cell puts chrome text on the art in exactly that combination", () => {
    const a = analyse();
    const label = site(a, homeFile, lineOf(HOME, "7 contacts"));
    const none = keysWhere("contactsCountLabel", "none");
    expect(none.length).toBeGreaterThan(0);
    expect(label.onArtKeys).toEqual(none);
    // A see-through chrome cell (Galaxy Dark) is backed: not on the art there.
    expect(keysWhere("contactsCountLabel", "seeThrough")).toContain(
      "galaxy-dark-quiet",
    );
    expect(label.onArtKeys).not.toContain("galaxy-dark-quiet");
  });

  it("a component backed in some combinations and bare in others is combination-dependent", () => {
    const a = analyse();
    const label = site(a, homeFile, lineOf(HOME, "7 contacts"));
    expect(label.artKind).toBe("combination-dependent");
    const row = a.rows.find((r) => r.fileLine.endsWith(`:${label.line}`));
    expect(row?.bareKind).toBe("combination-dependent");
    expect(row?.parentChainNote).toContain(
      `combination-dependent ON THE ART in ${label.onArtKeys.length}/16`,
    );
  });

  it("text inside ListRow is a see-through-entry from the contactsListEntries column, with no marker at the call site", () => {
    const a = analyse();
    const name = site(a, listFile, lineOf(LIST_ROW, "{name}"));
    const seeThrough = keysWhere("contactsListEntries", "seeThrough");
    expect(seeThrough).toHaveLength(11);
    expect(name.artKind).toBe("see-through-entry");
    expect(name.onArtKeys).toEqual([
      ...ART_COMBINATION_KEYS.filter(
        (k) =>
          seeThrough.includes(k) ||
          keysWhere("contactsListEntries", "none").includes(k),
      ),
    ]);
    // The full rows (the four None backgrounds and Standard Light Paper) back it.
    expect(name.backingKinds).toEqual(["opaque"]);
    expect(name.onArtKeys).not.toContain("standard-light-paper");
    const row = a.rows.find((r) => r.fileLine === `${listFile}:${name.line}`);
    expect(row).toEqual(
      expect.objectContaining({ route: "Home", bareKind: "see-through-entry" }),
    );
    expect(row?.parentChainNote).toContain(
      "see-through-entry ON THE ART in 11/16",
    );
  });

  it("text in GridCard's GlassSurface treatment=contact-entry is a see-through-entry from the contactsCardEntries column", () => {
    const a = analyse();
    const card = site(a, homeFile, lineOf(HOME, "Card name"));
    expect(card.artKind).toBe("see-through-entry");
    expect(card.onArtKeys).toEqual(
      keysWhere("contactsCardEntries", "seeThrough"),
    );
    expect(card.backingKinds).toEqual(["glass"]);
    // Any other GlassSurface treatment keeps today's always-backed rule.
    const plain = site(a, homeFile, lineOf(HOME, "Plain card"));
    expect(plain.classification).toBe("backed");
    expect(plain.artKind).toBeUndefined();
  });

  it("an unmarked ShellAppBar consumer stays backed", () => {
    const bar = `import { Text, View } from "react-native";
export function ShellAppBar({ title }) {
  return (
    <View>
      <Text style={{ color: colors.textPrimary }}>{title}</Text>
    </View>
  );
}
`;
    const screen = `import { ShellAppBar } from "@/components/ShellAppBar";
export function PlainScreen() {
  return <ShellAppBar variant="root" title="Plain" />;
}
`;
    const barFile = "src/components/ShellAppBar.tsx";
    const a = classifyBareTextSites([
      { file: barFile, source: bar },
      { file: "src/screens/PlainScreen.tsx", source: screen },
      stack({ Plain: { name: "PlainScreen", from: "@/screens/PlainScreen" } }),
    ]);
    const title = site(a, barFile, lineOf(bar, "{title}"));
    expect(title.classification).toBe("backed");
    expect(title.artKind).toBeUndefined();
    expect(title.onArtKeys).toEqual([]);
    expect(a.rows).toEqual([]);
  });
});
