import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResearchItem } from "@/db/compose-research-read";
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
    messageFocus: [],
  });
});

/**
 * A minimal validated Research item (COMP-11 / plan 35-06). `addToFocus` guards on
 * `aiEligible`/`isOffLimits`/`id` only, so tests build the smallest shape that
 * exercises the eligibility + cap + dedupe rules.
 */
function researchItem(overrides: Partial<ResearchItem> = {}): ResearchItem {
  return {
    id: "memory:1",
    group: "Memory",
    label: "Memory",
    value: "Bring the recipe",
    aiEligible: true,
    isOffLimits: false,
    ...overrides,
  };
}

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
    expect(s.messageFocus).toEqual([]);
  });
});

/**
 * Message Focus (COMP-11 / D-10): a session-only, capped-at-three, deduped,
 * append-ordered selection that grants no permission. The eligibility/off-limits
 * rejection guard is fenced separately (Task 4) but the cap/dedupe/order/clear
 * guarantees are locked here.
 */
describe("compose-session-store — Message Focus", () => {
  it("appends up to three items and rejects a fourth while three are selected", () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    store.addToFocus(researchItem({ id: "memory:1" }));
    store.addToFocus(researchItem({ id: "memory:2" }));
    store.addToFocus(researchItem({ id: "custom:3" }));
    // Fourth add while three are selected is a no-op (hard ceiling).
    store.addToFocus(researchItem({ id: "memory:4" }));

    const focus = useComposeSession.getState().messageFocus;
    expect(focus.map((item) => item.id)).toEqual([
      "memory:1",
      "memory:2",
      "custom:3",
    ]);
  });

  it("re-adding an existing item toggles it off (dedupe by identity, no duplicate)", () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    store.addToFocus(researchItem({ id: "memory:1" }));
    store.addToFocus(researchItem({ id: "custom:2" }));
    // Tap again on an already-selected item removes it.
    store.addToFocus(researchItem({ id: "memory:1" }));

    const focus = useComposeSession.getState().messageFocus;
    expect(focus.map((item) => item.id)).toEqual(["custom:2"]);
  });

  it("preserves selection (append) order, not a sorted order", () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    store.addToFocus(researchItem({ id: "custom:9" }));
    store.addToFocus(researchItem({ id: "memory:1" }));
    store.addToFocus(researchItem({ id: "relationship:5" }));

    expect(
      useComposeSession.getState().messageFocus.map((item) => item.id),
    ).toEqual(["custom:9", "memory:1", "relationship:5"]);
  });

  it("isInFocus / removeFromFocus operate by identity", () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    store.addToFocus(researchItem({ id: "memory:1" }));

    expect(useComposeSession.getState().isInFocus("memory:1")).toBe(true);
    expect(useComposeSession.getState().isInFocus("memory:2")).toBe(false);

    useComposeSession.getState().removeFromFocus("memory:1");
    expect(useComposeSession.getState().isInFocus("memory:1")).toBe(false);
    expect(useComposeSession.getState().messageFocus).toEqual([]);
  });

  it("clearSession empties messageFocus for that contact", () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    store.addToFocus(researchItem({ id: "memory:1" }));

    useComposeSession.getState().clearSession(7);

    expect(useComposeSession.getState().messageFocus).toEqual([]);
  });

  it("resets messageFocus when a different contact starts a session", () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    store.addToFocus(researchItem({ id: "memory:1" }));

    useComposeSession.getState().startSession(8);

    expect(useComposeSession.getState().messageFocus).toEqual([]);
  });
});

/**
 * Add-to-AI eligibility guard (COMP-11 / HIGH-6, T-35-15/T-35-16). The store fences
 * "AI-authorized only" and "Off Limits is never Message Focus" over the VALIDATED
 * ResearchItem shape — it reads the item's `aiEligible` / `isOffLimits` fields, not
 * raw source rows. Off Limits can never be added even though it is human-visible.
 */
describe("compose-session-store — Add-to-AI eligibility guard", () => {
  it("rejects a ResearchItem that is not aiEligible", () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    store.addToFocus(
      researchItem({ id: "firstclass:birthday", aiEligible: false }),
    );

    expect(useComposeSession.getState().messageFocus).toEqual([]);
  });

  it("rejects an Off Limits item (never Message Focus), even if aiEligible is spoofed true", () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    // Off Limits is always aiEligible=false at the read boundary; the store still
    // rejects it defensively even if isOffLimits and aiEligible disagree.
    store.addToFocus(
      researchItem({ id: "offlimits:9", isOffLimits: true, aiEligible: true }),
    );

    expect(useComposeSession.getState().messageFocus).toEqual([]);
  });

  it("admits an aiEligible item (up to the cap of three)", () => {
    const store = useComposeSession.getState();
    store.startSession(7);
    store.addToFocus(researchItem({ id: "memory:1", aiEligible: true }));
    store.addToFocus(researchItem({ id: "custom:2", aiEligible: true }));
    store.addToFocus(researchItem({ id: "memory:3", aiEligible: true }));

    expect(
      useComposeSession.getState().messageFocus.map((item) => item.id),
    ).toEqual(["memory:1", "custom:2", "memory:3"]);
  });
});
