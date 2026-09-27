/**
 * Repo-wide `<Sheet>` consumer contract (38.4 D-32, RG-034 follow-on,
 * device-found).
 *
 * `compact` and `detail` sheets scroll their body inside the percent cap by
 * default. A consumer that renders its own vertical scroll container inside a
 * compact/detail sheet must pass `scrollBody={false}`, so its container is the
 * single bounded scroll and no two vertical ScrollViews (or a VirtualizedList
 * inside a ScrollView) nest. `expanded` sheets are unaffected: their consumers
 * own their workspace scroll.
 *
 * The scan is textual (every `.tsx` under `src/`, tests excluded). It sees the
 * JSX written inside each `<Sheet>…</Sheet>` block, not the internals of child
 * components; child components rendered inside compact/detail sheets were
 * checked by hand in Plan 18 (none owns a vertical scroll container).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Variant = "compact" | "detail" | "expanded";

interface SheetBlock {
  file: string;
  line: number;
  variants: Variant[];
  optOut: boolean;
  /** JSX that renders while the sheet is compact/detail ("" when never). */
  nonExpandedContent: string;
}

const SCROLL_CONTAINER =
  /<(ScrollView|ScrollViewContainer|FlatList|SectionList)\b/;
const VIRTUALIZED_LIST = /<(FlatList|SectionList)\b/;

/** The files that own a scroll container inside a compact/detail sheet. */
const EXPECTED_OPT_OUTS = [
  "src/components/history/DateDetailSheet.tsx",
  "src/components/orrery/OrreryContactsSheet.tsx",
  "src/components/profile/ProfileRelationshipSheets.tsx",
];

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") && !/\.test\.tsx$/.test(path) ? [path] : [];
  });
}

/** End index (exclusive) of the JSX opener starting at `from`, brace-aware. */
function openerEnd(text: string, from: number): number {
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0 && text[i - 1] !== "=") return i + 1;
  }
  throw new Error("unterminated JSX opener");
}

/** Index just past the `)` that closes the `(` at `open`. */
function matchParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function parseVariant(
  opener: string,
  where: string,
): { variants: Variant[]; condition?: string; branches?: [Variant, Variant] } {
  const literal = opener.match(/\bvariant="(compact|detail|expanded)"/);
  if (literal) return { variants: [literal[1] as Variant] };
  const ternary = opener.match(
    /\bvariant=\{\s*([^?{}]+?)\s*\?\s*"(compact|detail|expanded)"\s*:\s*"(compact|detail|expanded)"\s*\}/,
  );
  if (ternary) {
    const branches: [Variant, Variant] = [
      ternary[2] as Variant,
      ternary[3] as Variant,
    ];
    return {
      variants: [...new Set(branches)],
      condition: ternary[1],
      branches,
    };
  }
  if (/\bvariant=/.test(opener)) {
    throw new Error(
      `${where}: unrecognised <Sheet variant> expression; use a literal or a two-literal ternary so the scroll-body contract can read it`,
    );
  }
  return { variants: ["compact"] };
}

/**
 * The content that renders while the sheet is compact/detail. When the variant
 * is a ternary with one `expanded` branch and the children switch on the SAME
 * condition (`{cond ? ( … ) : ( … )}`), only the matching non-expanded branch
 * counts; otherwise the whole block counts (conservative).
 */
function nonExpandedContent(
  children: string,
  parsed: ReturnType<typeof parseVariant>,
): string {
  if (!parsed.variants.some((v) => v !== "expanded")) return "";
  if (!parsed.condition || !parsed.branches?.includes("expanded"))
    return children;
  const head = `{${parsed.condition} ? (`;
  const at = children.indexOf(head);
  if (at === -1) return children;
  const firstOpen = at + head.length - 1;
  const firstEnd = matchParen(children, firstOpen);
  const rest = children.slice(firstEnd);
  const alt = rest.match(/^\s*:\s*\(/);
  if (firstEnd === -1 || !alt) return children;
  const secondOpen = firstEnd + (alt[0].length - 1);
  const secondEnd = matchParen(children, secondOpen);
  if (secondEnd === -1) return children;
  const consequent = children.slice(firstOpen, firstEnd);
  const alternate = children.slice(secondOpen, secondEnd);
  return parsed.branches[0] === "expanded" ? alternate : consequent;
}

function scanSheets(): SheetBlock[] {
  const blocks: SheetBlock[] = [];
  for (const file of tsxFiles("src")) {
    const source = readFileSync(file, "utf8");
    let from = 0;
    for (;;) {
      const start = source.indexOf("<Sheet", from);
      if (start === -1) break;
      from = start + 6;
      if (!/[\s>]/.test(source[start + 6] ?? "")) continue;
      const line = source.slice(0, start).split("\n").length;
      const where = `${file}:${line}`;
      const end = openerEnd(source, start);
      const opener = source.slice(start, end);
      const close = source.indexOf("</Sheet>", end);
      if (close === -1) throw new Error(`${where}: <Sheet> without </Sheet>`);
      const children = source.slice(end, close);
      expect(
        /<Sheet[\s>]/.test(children),
        `${where}: nested <Sheet> blocks are not supported by this scan`,
      ).toBe(false);
      const parsed = parseVariant(opener, where);
      blocks.push({
        file,
        line,
        variants: parsed.variants,
        optOut: /\bscrollBody=\{false\}/.test(opener),
        nonExpandedContent: nonExpandedContent(children, parsed),
      });
      from = close;
    }
  }
  return blocks;
}

describe("Sheet consumers and the compact/detail scroll body (D-32)", () => {
  const blocks = scanSheets();

  it("finds the Sheet consumers", () => {
    // 21 blocks across 17 files at Plan 18 (2026-09-26); a floor, not a pin.
    expect(blocks.length).toBeGreaterThanOrEqual(21);
  });

  it("opts out every compact/detail sheet that owns its own scroll container", () => {
    const offenders = blocks
      .filter((b) => SCROLL_CONTAINER.test(b.nonExpandedContent) && !b.optOut)
      .map(
        (b) =>
          `${b.file}:${b.line} renders a ScrollView/FlatList/SectionList inside a compact/detail <Sheet>; pass scrollBody={false} so it is the single bounded scroll (D-32)`,
      );
    expect(offenders).toEqual([]);
  });

  it("never puts a VirtualizedList inside the default sheet scroll body", () => {
    const offenders = blocks
      .filter((b) => !b.optOut && VIRTUALIZED_LIST.test(b.nonExpandedContent))
      .map(
        (b) =>
          `${b.file}:${b.line} nests a FlatList/SectionList inside the compact/detail sheet ScrollView`,
      );
    expect(offenders).toEqual([]);
  });

  it("uses the opt-out only where a consumer owns its scroll (exact set)", () => {
    const optOutFiles = [
      ...new Set(blocks.filter((b) => b.optOut).map((b) => b.file)),
    ].sort();
    expect(optOutFiles).toEqual(EXPECTED_OPT_OUTS);
    for (const b of blocks.filter((x) => x.optOut)) {
      expect(
        SCROLL_CONTAINER.test(b.nonExpandedContent),
        `${b.file}:${b.line} opts out but renders no scroll container of its own`,
      ).toBe(true);
    }
  });

  it("exempts only the expanded branch of a ternary variant (ProfileLayoutEditor)", () => {
    const editor = blocks.find((b) =>
      b.file.endsWith("profile/ProfileLayoutEditor.tsx"),
    );
    expect(editor?.variants.sort()).toEqual(["detail", "expanded"]);
    // The chooser (detail) page has no scroll container; the editor page's
    // ScrollViewContainer renders only on the expanded branch.
    expect(editor?.nonExpandedContent).toContain("Edit layout");
    expect(SCROLL_CONTAINER.test(editor?.nonExpandedContent ?? "x")).toBe(
      false,
    );
    expect(editor?.optOut).toBe(false);
  });
});
