#!/usr/bin/env node
/**
 * Fails if code outside the three explicit legacy transition owners reads or
 * writes retired scalar contact methods. Comments are stripped before matching:
 * the AI context exclusion notes intentionally mention phone/email, but are not
 * executable scalar contracts.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOT = join(ROOT, "src");

const OWNERS = {
  "src/db/migrations/001-initial.ts": "v8 fixture schema, retired by migration009",
  "src/db/migrations/009-contact-method-normalization.ts": "v8-to-v9 contact_methods migration",
  "src/backup/backup-schema.ts": "v1 backup forward migration to contactMethods",
};

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/(^|[^:\\])\/\/[^\n]*/gm, "$1");
}

function scalarReferences(source) {
  const code = stripComments(source);
  const patterns = [
    /\b(?:contacts|contact|row|legacyContact)\.(?:phone|email)\b/g,
    /\{\s*phone\s*,\s*email\s*,\s*\.\.\.[^}]+\}\s*=\s*(?:contact|row)\b/g,
    /CREATE\s+TABLE\s+contacts\s*\([\s\S]*?\b(?:phone|email)\s+\w+/gi,
  ];
  const refs = new Set();
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      const line = code.slice(0, match.index).split("\n").length;
      refs.add(`${line}: ${match[0].replace(/\s+/g, " ")}`);
    }
  }
  return [...refs];
}

const findings = filesUnder(SOURCE_ROOT).flatMap((path) => {
  const file = relative(ROOT, path);
  return scalarReferences(readFileSync(path, "utf8")).map((reference) => ({
    file,
    reference,
    owner: OWNERS[file],
  }));
});

for (const finding of findings) {
  console.log(`${finding.file}:${finding.reference} -> ${finding.owner ?? "UNOWNED"}`);
}

const unowned = findings.filter((finding) => finding.owner == null);
if (unowned.length > 0) {
  console.error(`audit-scalar-method-refs: ${unowned.length} unowned production scalar-method reference(s).`);
  process.exitCode = 1;
} else {
  console.log(`audit-scalar-method-refs: PASS (${findings.length} owned legacy transition reference(s)).`);
}
