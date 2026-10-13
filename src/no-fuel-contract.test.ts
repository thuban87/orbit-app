/**
 * 38.10 D-01 (with D-87, D-106): the retired five-kind knowledge table and its
 * wording are gone for good.
 *
 * 1. No file under `src/` or `App.tsx` matches /fuel/i, comments included
 *    (D-01: "no fuel table, writer, reader or UI wording survives"), except
 *    the file-level allowlist below. Every entry carries its reason. This is
 *    not a `RETIRED_FORMS` entry in `glossary-contract.test.ts`: that contract
 *    checks literals only, and the immutable shipped migrations must keep
 *    naming the table (docs/systems/glossary.md, "fuel").
 * 2. Compose Research's read has no "Avoid" heading literal (D-87: the group
 *    reads "Off Limits"). Only quoted literals count; the bare word in prose
 *    comments is not a heading.
 * 3. Among non-test files only `src/db/capture-dao.ts` contains
 *    `requireArchived: false` (D-106: the share-Undo purge is the one
 *    exception to ADR-018's archive-before-purge gate).
 *
 * Files are read with `readFileSync`, which is safe with the NUL bytes in
 * `prompt-template.ts`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

const RETIRED = /fuel/i;

/** Repo-relative path → why the file may still name the retired table. */
const ALLOWLIST: Readonly<Record<string, string>> = {
  // Shipped migrations are immutable (CLAUDE.md "SQLite migrations"); they
  // created, rebuilt, moved rows out of and finally dropped the table. Their
  // tests assert that history against a real schema.
  "src/db/migrations/001-initial.ts": "shipped migration: creates the table",
  "src/db/migrations/001-initial.test.ts": "tests shipped migration 001",
  "src/db/migrations/009-contact-method-normalization.ts":
    "shipped migration: rebuilds the table (contact uid FK)",
  "src/db/migrations/009-contact-method-normalization.test.ts":
    "tests shipped migration 009",
  "src/db/migrations/011-contact-lifecycle-schema.ts":
    "shipped migration: rebuilds the table for the contact lifecycle",
  "src/db/migrations/011-contact-lifecycle-schema.test.ts":
    "tests shipped migration 011",
  "src/db/migrations/016-contact-knowledge.ts":
    "shipped migration: its header records that it leaves the table alone",
  "src/db/migrations/016-contact-knowledge.test.ts":
    "tests shipped migration 016",
  "src/db/migrations/017-knowledge-egress-datamove.ts":
    "shipped migration: moves two retired populations out of the table",
  "src/db/migrations/017-knowledge-egress-datamove.test.ts":
    "tests shipped migration 017",
  "src/db/migrations/033-knowledge-homes.ts":
    "migration 033 maps the legacy rows to their new homes and drops the table (D-54, D-56)",
  "src/db/migrations/033-knowledge-homes.test.ts":
    "tests migration 033's mapping and drop",
  "src/db/migrations/full-chain.test.ts":
    "regression test: after 033 the table is absent (D-54); must name it",
  "src/db/tombstones-dao.test.ts":
    "regression test: the tombstone union rejects the retired entity type; must name it",
  "src/backup/phase-17-integration.test.ts":
    "its hard-delete scan reads migrations 017 and 033, which still DELETE FROM the table, so its covered entry must name it",
  // The single TypeScript statement of where each legacy row lives, shared by
  // the v7 backup converter (D-56, D-97).
  "src/db/legacy-fuel-mapping.ts": "legacy row mapping module (D-56)",
  "src/db/legacy-fuel-mapping.test.ts":
    "pins the mapping against migration 033's frozen literals",
  // A v7 backup file still holds legacy rows; the converter reads them.
  "src/backup/v7-legacy-conversion.ts": "v7 -> v8 backup converter",
  "src/backup/v7-legacy-conversion.test.ts": "tests the v7 converter",
  "src/backup/v7-v8-migration-equivalence.test.ts":
    "proves the converter and migration 033 land legacy rows identically",
  "src/backup/backup-schema.test.ts":
    "plan 04 kept the v7 fixture here: the v8 parser rejects the retired entity type and manifest key",
  "src/no-fuel-contract.test.ts": "this gate",
};

function allFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...allFiles(path));
    else out.push(path);
  }
  return out;
}

const repoPath = (path: string) => relative(ROOT, path).split(sep).join("/");

const scanned = [...allFiles(SRC), join(ROOT, "App.tsx")].map((path) => ({
  path: repoPath(path),
  text: readFileSync(path, "utf8"),
}));

/** Matches a quoted "Avoid" heading literal: double, single or back quotes. */
const AVOID_LITERAL = /["'`]Avoid["'`]/;

const hasAvoidHeadingLiteral = (text: string) => AVOID_LITERAL.test(text);

describe("no-fuel contract (38.10 D-01)", () => {
  it("scans src/ and App.tsx", () => {
    expect(scanned.length).toBeGreaterThan(100);
    expect(scanned.some((file) => file.path === "App.tsx")).toBe(true);
  });

  it("no file outside the allowlist names the retired table or its wording", () => {
    const offenders = scanned
      .filter((file) => RETIRED.test(file.text))
      .map((file) => file.path)
      .filter((path) => !(path in ALLOWLIST))
      .sort();
    expect(offenders).toEqual([]);
  });

  it("every allowlist entry exists, has a reason, and still needs its entry", () => {
    const stale = Object.entries(ALLOWLIST)
      .filter(
        ([path, reason]) =>
          reason.trim().length === 0 ||
          !existsSync(join(ROOT, path)) ||
          !RETIRED.test(readFileSync(join(ROOT, path), "utf8")),
      )
      .map(([path]) => path);
    expect(stale).toEqual([]);
  });

  it("the match is case-insensitive and counts comments", () => {
    expect(RETIRED.test("// the old Fuel editor")).toBe(true);
    expect(RETIRED.test("const label = 'FUEL';")).toBe(true);
    expect(RETIRED.test("// Off Limits, Gift Ideas, Thought of Them")).toBe(
      false,
    );
  });
});

describe('Compose Research has no "Avoid" heading literal (38.10 D-87)', () => {
  it("compose-research-read.ts holds no quoted Avoid literal", () => {
    const file = "src/db/compose-research-read.ts";
    const text = readFileSync(join(ROOT, file), "utf8");
    expect(hasAvoidHeadingLiteral(text)).toBe(false);
  });

  it("a prose comment with the bare word passes; a quoted literal fails", () => {
    expect(
      hasAvoidHeadingLiteral("// the read-only Avoid group stays visible"),
    ).toBe(false);
    expect(hasAvoidHeadingLiteral('heading: "Avoid",')).toBe(true);
    expect(hasAvoidHeadingLiteral("heading: 'Avoid',")).toBe(true);
    expect(hasAvoidHeadingLiteral("heading: `Avoid`,")).toBe(true);
  });
});

describe("requireArchived: false stays the one D-106 exception", () => {
  it("only src/db/capture-dao.ts contains it among non-test files", () => {
    const holders = scanned
      .filter((file) => !file.path.includes(".test."))
      .filter((file) => file.text.includes("requireArchived: false"))
      .map((file) => file.path);
    expect(holders).toEqual(["src/db/capture-dao.ts"]);
  });
});
