/**
 * Staging sessions (38.11 D-77): a live Add Contact form's held photo belongs
 * to its session token, so the launch/foreground sweep never deletes it, while
 * another form's (or an ended form's) file does not.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetStagingSessionsForTest,
  beginStagingSession,
  endStagingSession,
  pendingBelongsToActiveSession,
  sessionTouchedSince,
  stagingPassMark,
} from "@/services/photos/staging-sessions";

beforeEach(() => {
  __resetStagingSessionsForTest();
});

describe("create-staging session ownership (38.11 D-77)", () => {
  const held = "create-staging/create-formA-pick1.jpg";

  it("a held file belongs to the active session with its token", () => {
    beginStagingSession("formA");
    expect(pendingBelongsToActiveSession(held)).toBe(true);
    expect(pendingBelongsToActiveSession(`${held}.stage-tmp`)).toBe(true);
    expect(
      pendingBelongsToActiveSession("create-staging/create-formA-pick2.jpg"),
    ).toBe(true);
  });

  it("a different token does not own it, even one that shares a prefix", () => {
    beginStagingSession("formB");
    beginStagingSession("form");
    expect(pendingBelongsToActiveSession(held)).toBe(false);
    beginStagingSession("formAA");
    expect(pendingBelongsToActiveSession(held)).toBe(false);
  });

  it("an ended session no longer owns its files", () => {
    beginStagingSession("formA");
    const mark = stagingPassMark();
    endStagingSession("formA");
    expect(pendingBelongsToActiveSession(held)).toBe(false);
    // The existing pass-mark rule still sees a session that ended mid-pass.
    expect(sessionTouchedSince(held, mark)).toBe(true);
  });

  it("a create-staging token never claims another namespace's files", () => {
    beginStagingSession("formA");
    expect(
      pendingBelongsToActiveSession("reconcile-staging/create-formA-pick1.jpg"),
    ).toBe(false);
    expect(
      pendingBelongsToActiveSession("import-staging/import-formA-pick1.jpg"),
    ).toBe(false);
  });

  it("keeps the restore-pending rules unchanged", () => {
    beginStagingSession("sess");
    expect(
      pendingBelongsToActiveSession(
        "avatars/_restore_pending/contact-uid-sess.jpg",
      ),
    ).toBe(true);
    expect(
      pendingBelongsToActiveSession(
        "profile-backgrounds/_restore_pending/sess.jpg",
      ),
    ).toBe(true);
    expect(
      pendingBelongsToActiveSession("create-staging/create-other-sess.jpg"),
    ).toBe(false);
  });
});
