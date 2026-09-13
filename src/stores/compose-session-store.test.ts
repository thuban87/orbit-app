import { afterEach, describe, expect, it, vi } from "vitest";
import { useComposeSession } from "@/stores/compose-session-store";

/**
 * The store is a plain in-memory Zustand singleton (COMP-07 / D-10). These tests
 * lock the three session guarantees: it survives an in-app nav away/back for the
 * SAME contact, it clears on a Transmit-confirmed send, and a fresh module import
 * (the relaunch analogue) yields empty state — there is no durable restore.
 */
afterEach(() => {
  // Reset the singleton to its baseline between cases (does not affect the
  // resetModules relaunch case, which imports a fresh module instance).
  useComposeSession.setState({
    contactId: null,
    body: "",
    subject: "",
    mode: "text",
    destination: null,
  });
});

describe("compose-session-store", () => {
  it("preserves an in-progress draft across nav away/back for the same contact", () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    store.setBody("draft");
    store.setSubject("re: lunch");

    // Navigating away and back re-enters Compose, which calls startSession for
    // the SAME contact. The module singleton is untouched, so the draft stands.
    useComposeSession.getState().startSession(7);

    expect(useComposeSession.getState().body).toBe("draft");
    expect(useComposeSession.getState().subject).toBe("re: lunch");
  });

  it("resets to a blank draft when a different contact starts a session", () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    store.setBody("draft");
    store.setSubject("keep me?");

    useComposeSession.getState().startSession(8);

    const s = useComposeSession.getState();
    expect(s.contactId).toBe(8);
    expect(s.body).toBe("");
    expect(s.subject).toBe("");
    expect(s.mode).toBe("text");
    expect(s.destination).toBeNull();
  });

  it("clearSession empties body/subject/destination for that contact", () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    store.setBody("draft");
    store.setSubject("re: lunch");
    store.setDestination("+15551234567");

    useComposeSession.getState().clearSession(7);

    const s = useComposeSession.getState();
    expect(s.body).toBe("");
    expect(s.subject).toBe("");
    expect(s.destination).toBeNull();
  });

  it("clearSession is a no-op for a different contact", () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    store.setBody("draft");

    useComposeSession.getState().clearSession(999);

    expect(useComposeSession.getState().body).toBe("draft");
  });

  it("does not survive relaunch — a fresh module import yields empty state", async () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    store.setBody("draft");
    store.setSubject("re: lunch");

    // A fresh module graph is the relaunch analogue: module-level state is gone.
    vi.resetModules();
    const fresh = await import("@/stores/compose-session-store");

    const s = fresh.useComposeSession.getState();
    expect(s.contactId).toBeNull();
    expect(s.body).toBe("");
    expect(s.subject).toBe("");
    expect(s.destination).toBeNull();
  });
});
