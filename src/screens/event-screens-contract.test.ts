import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Event screens source pins (38.14 D-25, D-71, D-28, D-30, D-84).
 *
 * The behaviour is proven in group-events-search-render.test.tsx and the pure
 * logic tests; this scan pins the wiring a refactor could silently drop.
 */
const ROOT = join(__dirname, "..", "..");
const read = (file: string) =>
  readFileSync(join(ROOT, file), "utf8").replace(/\r\n/g, "\n");

describe("Events list search wiring (38.14 D-25; ADR-162)", () => {
  const events = read("src/screens/GroupEventsScreen.tsx");

  it("gates every search publish through one latest-request authority", () => {
    expect(events).toMatch(
      /useMemo\(\(\) => createLatestRequestAuthority\(\), \[\]\)/,
    );
    expect(events).toMatch(/runEventsSearch\(\{/);
  });

  it("registers the Back listener inside a useFocusEffect, gated on searchOpen", () => {
    const start = events.indexOf('"hardwareBackPress"');
    expect(start).toBeGreaterThan(-1);
    const effect = events.lastIndexOf("useFocusEffect(", start);
    const region = events.slice(effect, start);
    expect(region).toMatch(/if \(!searchOpen\) return undefined;/);
    expect(events.slice(start)).toMatch(/\}, \[searchOpen, closeSearch\]\)/);
  });

  it("no useFocusEffect lists term; the term load keys on useIsFocused()", () => {
    expect(events).toMatch(/const isFocused = useIsFocused\(\);/);
    expect(events).toMatch(/\}, \[isFocused, term, load\]\);/);
    const focusDeps = [
      ...events.matchAll(/useFocusEffect\([\s\S]*?\]\),\n {2}\);/g),
    ];
    expect(focusDeps).toHaveLength(2);
    for (const [region] of focusDeps) expect(region).not.toMatch(/\bterm\b/);
  });

  it("adds no tab-switch clear (B-14 is fixed by clear-on-close)", () => {
    expect(events).not.toMatch(/getParent/);
  });
});

describe("Event detail actions and sheet (38.14 D-71, D-28, D-30)", () => {
  const detail = read("src/screens/GroupEventDetailScreen.tsx");

  it("the ⋯ keeps only the two careful actions", () => {
    const start = detail.indexOf("overflow={[");
    expect(start).toBeGreaterThan(-1);
    const region = detail.slice(start, detail.indexOf("]}", start));
    const labels = [...region.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual(["Dissolve", "Delete Event & Interactions"]);
  });

  it("Edit Event and Add participants are visible buttons", () => {
    expect(detail).toMatch(/<Button\s[^>]*?label="Edit Event"/);
    expect(detail).toMatch(/<Button\s[^>]*?label="Add participants"/);
  });

  it("the empty participant state offers Add participants and never says save now", () => {
    const start = detail.indexOf("<EmptyState");
    expect(start).toBeGreaterThan(-1);
    const region = detail.slice(start, detail.indexOf("/>", start));
    expect(region).toMatch(/label: "Add participants"/);
    expect(detail).not.toMatch(/save now/i);
  });

  it("the sheet re-derives its participant each render; no View Event on its own event", () => {
    expect(detail).toMatch(/resolveDetailParticipant\(/);
    expect(detail).toMatch(
      /\[detailInteractionId, setDetailInteractionId\] = useState<\s*number \| null\s*>\(\s*null,?\s*\)/,
    );
    expect(detail).not.toMatch(/onViewGroupEvent/);
  });
});

describe("Participant wording and Edit participant load (38.14 D-29, D-25)", () => {
  it("the editor's follow lines and the card summary go through the named-field helpers", () => {
    const editor = read("src/components/group/ParticipantOverrideEditor.tsx");
    const card = read("src/components/group/ParticipantCard.tsx");
    expect(editor).toMatch(/followLineLabel\(label, following\)/);
    expect(editor).not.toMatch(/"Same as event"/);
    expect(card).toMatch(/participantChangeSummary\(/);
    expect(card).not.toMatch(/Changes for this person/);
  });

  it("Edit participant loads through a latest-request authority (ADR-162)", () => {
    const screen = read("src/screens/EditParticipantScreen.tsx");
    expect(screen).toMatch(
      /useMemo\(\(\) => createLatestRequestAuthority\(\), \[\]\)/,
    );
    expect(screen).toMatch(/loadAuthority\.isCurrent\(token\)/);
    expect(screen).toMatch(/\(\) => loadAuthority\.invalidate\(\)/);
  });
});
