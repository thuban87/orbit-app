import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { createContactFull } from "@/db/contacts-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-28 12:00:00";
const CAPTURE_SOURCE = readFileSync(
  fileURLToPath(new URL("./CaptureScreen.tsx", import.meta.url)),
  "utf8",
);

let exec: SqlExecutor;
let uidCounter = 0;
const newUid = () => `capture-uid-${++uidCounter}`;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(
    exec,
    [
      migration001,
      migration002,
      migration003,
      migration004,
      migration005,
      migration006,
      migration007,
      migration008,
      migration009,
      migration010,
      migration011,
    ],
    11,
    { now: NOW, newUid, defaultPhoneRegion: "US" },
  );
});

describe("CaptureScreen inline create lifecycle contract", () => {
  it("passes the explicit Bound cadence and an empty normalized method list without scalar compatibility inputs", () => {
    const call = CAPTURE_SOURCE.match(
      /createContactAndShare\(\s*getExecutor\(\),\s*\{(?<input>[\s\S]*?)\n\s*\},/,
    );

    expect(call?.groups?.input).toContain(
      "intervalDays: NEW_CONTACT_DEFAULT_INTERVAL_DAYS",
    );
    expect(CAPTURE_SOURCE).toMatch(
      /import \{ NEW_CONTACT_DEFAULT_INTERVAL_DAYS \} from "@\/constants\/new-contact-defaults"/,
    );
    expect(call?.groups?.input).toContain("methodDrafts: []");
    expect(call?.groups?.input).not.toMatch(/\b(phone|email)\s*:/);
    expect(call?.groups?.input).not.toContain("firstInteraction");
  });

  it("persists the inline Bound contract through the v11 default with no methods or contact event", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: newUid(),
      name: "Capture inline",
      intervalDays: 30,
      methodDrafts: [],
      now: NOW,
    });

    expect(
      await exec.getFirstAsync<{
        interval_days: number | null;
        tracking_enabled: number;
        last_contact: string | null;
      }>(
        "SELECT interval_days, tracking_enabled, last_contact FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).toEqual({
      interval_days: 30,
      tracking_enabled: 1,
      last_contact: null,
    });
    const methods = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM contact_methods WHERE contact_id = ?",
      [contactId],
    );
    const interactions = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM interactions WHERE contact_id = ?",
      [contactId],
    );
    expect(methods?.n).toBe(0);
    expect(interactions?.n).toBe(0);
  });
});

/** Slice of the focused hardwareBackPress handler body. */
function backHandlerSource(): string {
  const start = CAPTURE_SOURCE.indexOf('addEventListener("hardwareBackPress"');
  expect(start).toBeGreaterThan(-1);
  const end = CAPTURE_SOURCE.indexOf("return () => sub.remove();", start);
  expect(end).toBeGreaterThan(start);
  return CAPTURE_SOURCE.slice(start, end);
}

describe("CaptureScreen Back closes the innermost surface first (38.9 D-33, D-14)", () => {
  it("routes Back through resolveCaptureBack with the typed name and note", () => {
    expect(CAPTURE_SOURCE).toMatch(
      /import \{[^}]*\bresolveCaptureBack\b[^}]*\} from "@\/screens\/capture-back-logic"/,
    );
    expect(CAPTURE_SOURCE).toMatch(
      /import \{[^}]*\bconfirmDiscard\b[^}]*\} from "@\/navigation\/discard-keep-guard"/,
    );
    const handler = backHandlerSource();
    expect(handler).toContain("resolveCaptureBack({");
    for (const field of [
      "inlineOpen",
      "inlineName",
      "searchOpen",
      "multiSelect",
      "noteOpen",
      "noteText",
    ]) {
      expect(handler).toMatch(new RegExp(`\\b${field}\\b`));
    }
  });

  it("handles every outcome and prompts only for typed text", () => {
    const handler = backHandlerSource();
    for (const outcome of [
      "close-inline",
      "prompt-discard-inline",
      "close-search",
      "exit-multi-select",
      "prompt-discard-note",
      "cancel-capture",
    ]) {
      expect(handler).toContain(`"${outcome}"`);
    }
    expect(handler.split("confirmDiscard()").length - 1).toBe(2);
  });

  it("always consumes Back (never lets native-stack pop or finish)", () => {
    const handler = backHandlerSource();
    expect(handler).not.toMatch(/return false/);
    expect(handler).toMatch(/return true;/);
  });
});

const SHARE_CARD_LOGIC_SOURCE = readFileSync(
  fileURLToPath(new URL("../logic/share-card-logic.ts", import.meta.url)),
  "utf8",
);

describe("CaptureScreen confirmation card (38.10 D-77, D-100, D-120)", () => {
  it("mounts the card only from a completed write", () => {
    // Each write path publishes the card from runShareWrite's onSuccess.
    const writes = CAPTURE_SOURCE.split("runShareWrite({").slice(1);
    const pickWrites = writes.filter(
      (body) =>
        body.includes("shareToContacts(") ||
        body.includes("createContactAndShare("),
    );
    expect(pickWrites).toHaveLength(2);
    for (const body of pickWrites) {
      const success = body.indexOf("onSuccess:");
      expect(success).toBeGreaterThan(-1);
      expect(body.indexOf("setCard({", success)).toBeGreaterThan(success);
    }
    expect(CAPTURE_SOURCE).toMatch(
      /\{card !== null \? \(\s*<ShareConfirmationCard\s+key=\{seq\}/,
    );
  });

  it("declares the auto-close constant at the top of the card logic", () => {
    const declaration = SHARE_CARD_LOGIC_SOURCE.indexOf(
      "export const SHARE_CARD_AUTO_CLOSE_MS =",
    );
    expect(declaration).toBeGreaterThan(-1);
    const firstFunction = SHARE_CARD_LOGIC_SOURCE.indexOf("function ");
    expect(declaration).toBeLessThan(firstFunction);
  });

  it("has no screen-level finish timer and no finish on Undo", () => {
    expect(CAPTURE_SOURCE).not.toMatch(/armAutoReturn|returnTimer/);
    // finishActivity() is called from cancelCapture only.
    expect(CAPTURE_SOURCE.split("finishActivity();").length - 1).toBe(1);
    const undo = CAPTURE_SOURCE.slice(
      CAPTURE_SOURCE.indexOf("undo: (target) =>"),
      CAPTURE_SOURCE.indexOf("UNDO_FAILED,"),
    );
    expect(undo).toContain("undoCreateContactAndShare(");
    expect(undo).toContain("shareScreenAfterUndo(");
    expect(undo).not.toMatch(/finishActivity|cancelCapture/);
  });

  it("reads the share snapshot for the empty state and the preview strip (c10)", () => {
    expect(CAPTURE_SOURCE).toContain("captureViewPayload(snapshot)");
    expect(CAPTURE_SOURCE).not.toMatch(/payload\.displayText === null/);
  });
});

describe("CaptureScreen list picker (38.10 D-80, D-82, D-12; c7, c10)", () => {
  const list = CAPTURE_SOURCE.slice(
    CAPTURE_SOURCE.indexOf("<ContactPickerList"),
    CAPTURE_SOURCE.indexOf("/>", CAPTURE_SOURCE.indexOf("<ContactPickerList")),
  );

  it("embeds the shared list in source order, never offering archived contacts", () => {
    expect(list).toContain("key={seq}");
    expect(list).toContain("searchResetKey={seq}");
    expect(list).toContain("keepSourceOrder");
    expect(list).toContain("allowArchivedSearch={false}");
    expect(list).toContain('label: "New contact"');
  });

  it("is inert while the card is up or a pick is pending (WR-01)", () => {
    expect(list).toContain("disabled={listLocked}");
    expect(CAPTURE_SOURCE).toMatch(
      /const listLocked = shareListLocked\(\{\s*cardMounted: card !== null,\s*writePending: committing,/,
    );
  });

  it("owns search and multi-select for Back (38.9 D-33)", () => {
    expect(list).toContain("searchText={searchText}");
    expect(list).toContain("onSearchTextChange={setSearchText}");
    expect(list).toContain("multiSelect={multiSelect}");
    expect(list).toContain("onMultiSelectChange={setMultiSelect}");
    expect(backHandlerSource()).toContain('searchOpen: searchText !== ""');
  });

  it("has no face-grid styles left", () => {
    expect(CAPTURE_SOURCE).not.toMatch(
      /\b(tile|tileSelected|newTile|newGlyphBox|checkBadge):/,
    );
  });
});

describe("share card stays below the status bar (38.10 D-147)", () => {
  const CARD_SOURCE = readFileSync(
    fileURLToPath(
      new URL("../components/ShareConfirmationCard.tsx", import.meta.url),
    ),
    "utf8",
  );

  it("the screen caps the card from its measured frame and bottom offset", () => {
    expect(CAPTURE_SOURCE).toMatch(
      /shareCardMaxHeight\(\{\s*frameHeight,\s*bottomOffset,\s*safeTop: 0,\s*\}\)/,
    );
    expect(CAPTURE_SOURCE).toContain("maxHeight={cardMaxHeight}");
  });

  it("the card applies the cap and scrolls its body past it", () => {
    expect(CARD_SOURCE).toContain("maxHeight === null ? null : { maxHeight }");
    expect(CARD_SOURCE).toMatch(/<ScrollView[\s\S]*?style=\{styles\.body\}/);
    expect(CARD_SOURCE).toContain('keyboardShouldPersistTaps="handled"');
    expect(CARD_SOURCE).toMatch(/body: \{ flexGrow: 0, flexShrink: 1 \}/);
    // The open note block is kept in view through the pure helper.
    expect(CARD_SOURCE).toContain("shareCardNoteScrollY({");
    expect(CARD_SOURCE).toMatch(
      /testID="capture-note-block"[\s\S]*?onLayout=\{onNoteLayout\}/,
    );
  });
});
