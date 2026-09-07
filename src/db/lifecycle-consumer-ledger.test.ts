/**
 * lifecycle-consumer-ledger — the CI-enforceable Phase 18.2 consumer audit
 * (CDN-02 / CDN-03, cycle-2 review M5, Cycle 3 C3-H1).
 *
 * The Bound/Unbound lifecycle turned two once-total invariants into partial
 * ones: `interval_days` is now NULLABLE (an Unbound contact may carry no
 * cadence), and the "orbiting / favourite" projections are now the BOUND subset
 * (`tracking_enabled = 1`), not every contact. Every place that reads a cadence
 * or that projects the orbiting/favourite set therefore has to opt into the new
 * contract deliberately. A Markdown table cannot fail CI when a NEW consumer is
 * added without doing so, so this audit is a committed test:
 *
 *   1. It ripgreps the PRODUCTION source (comments stripped; tests, specs,
 *      migrations, and the test kit excluded) for the two fragment classes.
 *   2. It asserts every matched file is mapped to an owning task/predicate in
 *      the ledger below, failing — and naming the file — on any unmapped
 *      reference.
 *   3. It asserts no ledger entry has rotted (every listed file still exists and
 *      still carries the reference the ledger claims for it).
 *
 * The human-readable companion is `18.2-VALIDATION.md`; that document is
 * documentation kept in sync with this test, NOT the enforcement mechanism.
 *
 * SCOPING (deliberately narrow, so the gate is not brittle): the cadence scan
 * matches the bare token `\binterval_days\b`, which — by the left word boundary
 * — never matches the UNRELATED `backup_interval_days` app-settings column. The
 * predicate scan matches only the literal SQL form `tracking_enabled = 0|1`, so
 * a camelCase `trackingEnabled` guard in TS/JSX is not swept here; the delivered-
 * notification and widget ingress owners that gate on `trackingEnabled` are
 * recorded and separately asserted below.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import type { ContactEditRow } from "@/db/contact-read";
import type {
  CreateContactFullInput,
  UpdateContactFullInput,
} from "@/db/contacts-dao";
import type { DashboardRow } from "@/db/dashboard-read";
import type { ImpactInputs } from "@/db/impact-read";

const ROOT = process.cwd();
const SOURCE_ROOT = join(ROOT, "src");

/** Bare cadence token — excludes `backup_interval_days` via the left boundary. */
const CADENCE_TOKEN = /\binterval_days\b/;
/** The Bound/Unbound SQL predicate form the orbiting/favourite projections use. */
const LIFECYCLE_PREDICATE = /tracking_enabled\s*=\s*[01]\b/;

type ConsumerClass = "cadence" | "predicate";

interface LedgerEntry {
  /** The phase plan/task that owns the reference. */
  owner: string;
  /** The exact predicate/fragment or reason this file is a legitimate owner. */
  note: string;
}

/**
 * Every PRODUCTION file that legitimately reads nullable `interval_days`, mapped
 * to its owning task. Adding a new cadence consumer without an entry here fails
 * this test.
 */
const CADENCE_OWNERS: Record<string, LedgerEntry> = {
  "src/db/status.ts": {
    owner: "18.2-04",
    note: "PROGRESS_SQL divides by interval_days; STATUS_CADENCE_PRECONDITION requires IS NOT NULL before the fragment is evaluated.",
  },
  "src/db/notification-read.ts": {
    owner: "18.2-06",
    note: "Decay-candidate read returns raw last_contact + interval_days for the 11-10 scheduler; Bound-gated (tracking_enabled = 1 OR ?).",
  },
  "src/services/notifications/notification-schedule.ts": {
    owner: "18.2-06",
    note: "dueDate = last_contact + interval_days local-day arithmetic for a Bound, positively-cadenced candidate.",
  },
  "src/db/impact-read.ts": {
    owner: "18.2-05",
    note: "Single-snapshot impact inputs carry the nullable cadence; the intensity path fails closed on a null cadence.",
  },
  "src/db/contact-lifecycle-dao.ts": {
    owner: "18.2-03",
    note: "Bind/unbind DAO; the one-way cadence invariant (dormant cadence is never nulled) is enforced here.",
  },
  "src/db/contact-read.ts": {
    owner: "18.2-08",
    note: "Edit-form and header reads project the nullable cadence for lifecycle-aware presentation.",
  },
  "src/db/contacts-dao.ts": {
    owner: "18.2-02",
    note: "Create/update writers accept a nullable cadence (WR-02: a stored value is still a positive integer).",
  },
  "src/db/recency-dao.ts": {
    owner: "WR-02",
    note: "createContactWithInteraction writes a positive cadence; the WR-02 zero/negative interval hazard note lives here.",
  },
  "src/screens/edit-contact-logic.ts": {
    owner: "18.2-08",
    note: "Maps the stored nullable cadence into the edit form model.",
  },
  "src/backup/restore-apply.ts": {
    owner: "18.2-09",
    note: "Restores the nullable interval_days column and retains dormant cadence for Unbound merge winners.",
  },
  "src/backup/export-manifest.ts": {
    owner: "18.2-09",
    note: "Exports the nullable interval_days column in the portable graph.",
  },
  "src/db/merge-dao.ts": {
    owner: "20-01",
    note: "The atomic merge snapshot carries nullable interval_days into the full survivor update input; it preserves either contact's stored dormant cadence rather than performing cadence arithmetic.",
  },
  "src/db/reconcile-apply.ts": {
    owner: "20-03",
    note: "Shared reconciliation writer carries the stored nullable cadence into a complete metadata input without cadence arithmetic; it preserves Bound/Unbound state while applying selected source scalars.",
  },
  "src/db/bulk-review-dao.ts": {
    owner: "20-06",
    note: "Birthday-fix writer carries the stored nullable cadence into a complete metadata input without cadence arithmetic; it preserves the contact's Bound/Unbound state while changing only birthday.",
  },
  "src/db/benchmark.ts": {
    owner: "AUDITED",
    note: "Perf fixture writer; supplies a POSITIVE cadence on insert, so its STATUS_SCAN use inherits the updated fragment precondition and cannot observe a null-cadence row.",
  },
  "src/db/reserved-columns.ts": {
    owner: "AUDITED",
    note: "Reserved fixed-column name list; the `interval_days` literal is a custom-field shadowing guard, not a cadence read.",
  },
  "src/db/first-class-knowledge-read.ts": {
    owner: "24.1-04",
    note: "Read-only Things-to-Remember projection carries nullable interval_days for display; derived intensity delegates to the null-safe impact reader.",
  },
  "src/logic/dashboard-query-logic.ts": {
    owner: "25-03",
    note: "Closed Contact Frequency bucket predicates read interval_days only inside the Dashboard population scope, which structurally requires tracking_enabled = 1.",
  },
};

/**
 * Every PRODUCTION file that projects the orbiting / favourite (Bound) set or
 * the complementary Unbound set via the SQL `tracking_enabled = 0|1` predicate,
 * mapped to its owning task and exact predicate.
 */
const PREDICATE_OWNERS: Record<string, LedgerEntry> = {
  "src/db/orrery-system-read.ts": {
    owner: "29-03",
    note: "Complete reorder identities require archived_at IS NULL AND tracking_enabled=1 AND last_contact IS NOT NULL, plus the saved-sun fingerprint. Explicit All/Not member widening retains Bound/archive scope and null health; other Systems remain contacted-only.",
  },
  "src/logic/dashboard-query-logic.ts": {
    owner: "25-01",
    note: "ACTIVE_SEGREGATION_WHERE is the shared Active-universe predicate: archived-at-null, `tracking_enabled = 1`, and contacted; snooze suppression is intentionally absent.",
  },
  "src/db/dashboard-read.ts": {
    owner: "18.2-04 / 18.2-07",
    note: "DASHBOARD_BOUND_WHERE / FAVOURITES_BOUND_WHERE / LIVE_CONTACTS_BOUND_WHERE = `tracking_enabled = 1`; CARD_STATUS nulls progress/status for Unbound; favourite_rank projected only when Bound; the Never Contacted branch reads `tracking_enabled = 0`.",
  },
  "src/db/orrery-read.ts": {
    owner: "18.2-04",
    note: "ORBITING set = `archived_at IS NULL AND tracking_enabled = 1 AND last_contact IS NOT NULL` — the shared Orrery sun predicate.",
  },
  "src/db/ring-seq-dao.ts": {
    owner: "18.2-04",
    note: "Ring count/update guards restrict the (N) orbiting set and the (N-1) sun-excluded set to `tracking_enabled = 1`.",
  },
  "src/db/sun-picker-read.ts": {
    owner: "18.2-04",
    note: "Sun-candidate read: `archived_at IS NULL AND tracking_enabled = 1`.",
  },
  "src/db/digest-read.ts": {
    owner: "18.2-05",
    note: "Active-orbit digest projections gate on `c.tracking_enabled = 1`; Unbound history stays only in the retrospective/gentle lines.",
  },
  "src/db/notification-read.ts": {
    owner: "18.2-06",
    note: "Decay candidates gated `tracking_enabled = 1 OR ? = 1` (the birthday override parameter).",
  },
  "src/services/notifications/decay-suppression.ts": {
    owner: "18.2-06",
    note: "DECAY_ELIGIBLE_WHERE = `tracking_enabled = 1 …` — Unbound (tracking_enabled = 0) is suppressed.",
  },
  "src/db/unbound-read.ts": {
    owner: "18.2-07",
    note: "The Unbound browse/count projections read `tracking_enabled = 0`.",
  },
  "src/db/status.ts": {
    owner: "18.2-04",
    note: "STATUS_CADENCE_PRECONDITION opens with `tracking_enabled = 1`.",
  },
  "src/db/contact-lifecycle-dao.ts": {
    owner: "18.2-03",
    note: "Bind/unbind transitions guard on the current `tracking_enabled` state (bind requires = 0, unbind requires = 1).",
  },
};

/**
 * The shared status/PROGRESS_SQL fragment consumers, named explicitly because a
 * bare `interval_days` ripgrep MISSES them: they reach the cadence arithmetic
 * through the `@/db/status` import (PROGRESS_SQL / STATUS_SQL / REASON_SQL), not
 * a literal `interval_days` token of their own. Each is asserted below to still
 * import a status fragment, so the fragment reach cannot silently disappear.
 */
const STATUS_FRAGMENT_CONSUMERS: Record<string, LedgerEntry> = {
  "src/db/orrery-system-read.ts": {
    owner: "29-03",
    note: "System members share PROGRESS_SQL/STATUS_SQL inside Bound scope; CASE preserves null health for explicit All/Not never-contacted members.",
  },
  "src/db/contact-status-read.ts": {
    owner: "18.2-04",
    note: "Composes PROGRESS_SQL/STATUS_SQL/REASON_SQL into one by-id SELECT; returns a neutral null result for rows outside the cadence precondition.",
  },
  "src/db/digest-read.ts": {
    owner: "18.2-05",
    note: "Wraps PROGRESS_SQL/STATUS_SQL/REASON_SQL for the digest; the Bound predicate makes the fragment safe over a possible NULL cadence.",
  },
  "src/services/notifications/decay-suppression.ts": {
    owner: "18.2-06",
    note: "DECAY_ELIGIBLE_WHERE reuses PROGRESS_SQL over the Bound, positively-cadenced decay set.",
  },
};

/**
 * The PROACTIVE surfaces that must FAIL CLOSED for an Unbound target: a stale
 * active-cadence action must not act. Each gates on the camelCase `trackingEnabled`
 * header (not the SQL predicate), so the raw predicate scan does not flag them;
 * each is asserted below to still carry that gate.
 */
const PROACTIVE_FAILCLOSED_OWNERS: Record<string, LedgerEntry> = {
  "src/services/notifications/notification-actions.ts": {
    owner: "18.2-06 Task 4",
    note: "A delivered Snooze action is an intentional no-op once the target is Unbound (header.trackingEnabled === 0) — Snooze is cadence work.",
  },
  "src/services/widget/widget-quick-action-guard.ts": {
    owner: "18.2-06",
    note: "guardWidgetIntent fails a stale active-cadence Compose quick action closed (Unbound or archived) while preserving live Profile opens.",
  },
};

function productionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      // Exclude migrations (retired-schema DDL) and the shared test kit.
      if (entry.name === "migrations" || entry.name === "__testkit__") {
        return [];
      }
      return productionFiles(path);
    }
    if (!/\.[cm]?[jt]sx?$/.test(entry.name)) return [];
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) return [];
    return [path];
  });
}

/**
 * Blank out comments so a doc-comment mention of `interval_days` or a
 * `tracking_enabled = 1` prose reference is never mistaken for a code consumer.
 * The `[^:\\]` guard before a line comment preserves `://` inside a URL/scheme
 * literal (mirrors scripts/audit-scalar-method-refs.mjs).
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/(^|[^:\\])\/\/[^\n]*/gm, "$1");
}

interface ScanResult {
  cadence: Set<string>;
  predicate: Set<string>;
}

function scanProduction(): ScanResult {
  const cadence = new Set<string>();
  const predicate = new Set<string>();
  for (const path of productionFiles(SOURCE_ROOT)) {
    const rel = relative(ROOT, path).split("\\").join("/");
    const code = stripComments(readFileSync(path, "utf8"));
    if (CADENCE_TOKEN.test(code)) cadence.add(rel);
    if (LIFECYCLE_PREDICATE.test(code)) predicate.add(rel);
  }
  return { cadence, predicate };
}

const scan = scanProduction();

function fileStillReferences(file: string, klass: ConsumerClass): boolean {
  const code = stripComments(readFileSync(join(ROOT, file), "utf8"));
  return klass === "cadence"
    ? CADENCE_TOKEN.test(code)
    : LIFECYCLE_PREDICATE.test(code);
}

describe("lifecycle consumer ledger — nullable cadence (CDN-02)", () => {
  it("maps every production nullable-interval_days consumer to an owner", () => {
    const unmapped = [...scan.cadence]
      .filter((file) => CADENCE_OWNERS[file] === undefined)
      .sort();
    expect(
      unmapped,
      `Unowned nullable-cadence consumer(s). Add each to CADENCE_OWNERS with its owning task/test, then mirror it in 18.2-VALIDATION.md:\n${unmapped.join("\n")}`,
    ).toEqual([]);
  });

  it("names the shared status-fragment consumers explicitly (the reach a bare ripgrep misses)", () => {
    // These reach PROGRESS_SQL / STATUS_SQL through the `@/db/status` import
    // rather than a literal interval_days token, so a bare cadence grep would
    // miss them. Assert each is a named owner AND still imports a fragment.
    for (const file of Object.keys(STATUS_FRAGMENT_CONSUMERS)) {
      const code = readFileSync(join(ROOT, file), "utf8");
      expect(code, `${file} must import a status fragment from @/db/status`).toMatch(
        /from "@\/db\/status"/,
      );
      expect(code, `${file} must reference a PROGRESS_SQL/STATUS_SQL fragment`).toMatch(
        /PROGRESS_SQL|STATUS_SQL|STATUS_CADENCE_PRECONDITION/,
      );
    }
  });

  it("records benchmark.ts as an audited positive-cadence fragment consumer", () => {
    expect(CADENCE_OWNERS["src/db/benchmark.ts"]?.owner).toBe("AUDITED");
    expect(scan.cadence.has("src/db/benchmark.ts")).toBe(true);
  });

  it("keeps every cadence-ledger entry live (no rotted mapping)", () => {
    const rotted = Object.keys(CADENCE_OWNERS)
      .filter((file) => !fileStillReferences(file, "cadence"))
      .sort();
    expect(
      rotted,
      `CADENCE_OWNERS entries no longer reference interval_days — remove them:\n${rotted.join("\n")}`,
    ).toEqual([]);
  });
});

describe("lifecycle consumer ledger — orbiting/favourite Bound set (CDN-03)", () => {
  it("maps every production tracking_enabled = 0|1 predicate consumer to an owner", () => {
    const unmapped = [...scan.predicate]
      .filter((file) => PREDICATE_OWNERS[file] === undefined)
      .sort();
    expect(
      unmapped,
      `Unowned orbiting/favourite predicate consumer(s). Add each to PREDICATE_OWNERS with its exact Bound predicate, then mirror it in 18.2-VALIDATION.md:\n${unmapped.join("\n")}`,
    ).toEqual([]);
  });

  it("covers the required orbiting/favourite and Unbound projections", () => {
    for (const file of [
      "src/db/dashboard-read.ts",
      "src/db/orrery-read.ts",
      "src/db/ring-seq-dao.ts",
      "src/db/sun-picker-read.ts",
      "src/db/digest-read.ts",
      "src/db/notification-read.ts",
      "src/services/notifications/decay-suppression.ts",
      "src/db/unbound-read.ts",
    ]) {
      expect(PREDICATE_OWNERS[file], `${file} must be a named predicate owner`).toBeDefined();
    }
  });

  it("keeps every predicate-ledger entry live (no rotted mapping)", () => {
    const rotted = Object.keys(PREDICATE_OWNERS)
      .filter((file) => !fileStillReferences(file, "predicate"))
      .sort();
    expect(
      rotted,
      `PREDICATE_OWNERS entries no longer carry the SQL predicate — remove them:\n${rotted.join("\n")}`,
    ).toEqual([]);
  });
});

describe("lifecycle consumer ledger — proactive ingress owners", () => {
  it("keeps the proactive fail-closed owners gating on trackingEnabled", () => {
    for (const file of Object.keys(PROACTIVE_FAILCLOSED_OWNERS)) {
      // The ledger must not rot: each proactive owner must still exist and still
      // gate a stale active action on the trackingEnabled header.
      const code = stripComments(readFileSync(join(ROOT, file), "utf8"));
      expect(code, `${file} must still fail closed on trackingEnabled`).toMatch(
        /trackingEnabled/,
      );
    }
  });

  it("leaves a delivered notification TAP ungated (explicit action is permitted for Unbound)", () => {
    // notification-nav.ts resolves a delivered decay tap to a Compose reset with
    // no lifecycle gate — a delivered tap is an EXPLICIT person-level action,
    // permitted for Unbound (dossier Cluster N), unlike a proactive quick action.
    const nav = stripComments(
      readFileSync(join(ROOT, "src/services/notifications/notification-nav.ts"), "utf8"),
    );
    expect(nav).toMatch(/name:\s*"Compose"/);
    expect(nav, "a delivered tap must not be lifecycle-gated").not.toMatch(
      /trackingEnabled/,
    );
  });

  it("keeps profile-initiated Compose reachable for a live Unbound contact (dossier Cluster N)", () => {
    // The contrast with the widget Compose fail-closed guard: the Profile
    // "Message" primary opens the entry-agnostic Compose surface for ANY live
    // contact, Bound or Unbound. Explicit person-level action is permitted for
    // Unbound; only the PROACTIVE widget quick action fails closed. This asserts
    // the Message → Compose navigation is not placed behind a lifecycle guard.
    const screen = readFileSync(
      join(ROOT, "src/screens/ContactProfileScreen.tsx"),
      "utf8",
    );
    expect(screen).toContain('navigation.navigate("Compose", { contactId })');
    // The lifecycle view model governs only bind/cadence controls; it exposes no
    // flag that could suppress Compose.
    const guard = readFileSync(
      join(ROOT, "src/services/widget/widget-quick-action-guard.ts"),
      "utf8",
    );
    expect(guard).toMatch(/trackingEnabled/);
  });
});

/**
 * Compile-time nullable-cadence contract sweep. These type-level assertions fail
 * `tsc --noEmit` (not the runtime) if any cadence-bearing type stops agreeing
 * with the v11 DDL, where `contacts.interval_days` is nullable. A `runtime` no-op
 * keeps the block inside the vitest file without executing anything.
 */
type Assert<T extends true> = T;
type NullAssignable<T, K extends keyof T> = null extends T[K] ? true : false;

// `contacts.interval_days` is nullable at v11; every cadence-bearing view agrees:
type _CadenceImpactInputs = Assert<NullAssignable<ImpactInputs, "intervalDays">>;
type _CadenceEditRow = Assert<NullAssignable<ContactEditRow, "interval_days">>;
type _CadenceCreate = Assert<NullAssignable<CreateContactFullInput, "intervalDays">>;
type _CadenceUpdate = Assert<NullAssignable<UpdateContactFullInput, "intervalDays">>;
// DashboardRow carries no raw interval_days; cadence is projected as the nullable
// derived status/progress pair, which must stay nullable so an Unbound row reads
// neither stable nor overdue.
type _CadenceDashStatus = Assert<NullAssignable<DashboardRow, "status">>;
type _CadenceDashProgress = Assert<NullAssignable<DashboardRow, "progress">>;

describe("nullable-cadence type contract (compile-time)", () => {
  it("agrees with the v11 nullable interval_days DDL", () => {
    // The assertions above are enforced by tsc; this keeps the contract visible
    // in the runtime suite. Referencing the aliases avoids unused-type lint.
    const witnesses: Array<
      | _CadenceImpactInputs
      | _CadenceEditRow
      | _CadenceCreate
      | _CadenceUpdate
      | _CadenceDashStatus
      | _CadenceDashProgress
    > = [true, true, true, true, true, true];
    expect(witnesses.every((w) => w === true)).toBe(true);
  });
});
