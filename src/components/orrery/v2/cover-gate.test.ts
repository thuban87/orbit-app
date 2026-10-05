/**
 * 38.7-15: the first-frame cover lifts on the native "presented" answer for
 * the content frame, and is bounded so it can never stick.
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  COVER_HARD_MAX_MS,
  COVER_PRESENT_TIMEOUT_MS,
  type CoverLiftReason,
  createCoverGate,
  nextPresentToken,
} from "./cover-gate";

let armed: number[] = [];
let lifts: CoverLiftReason[] = [];
let tokens = 40;
const gate = () =>
  createCoverGate({
    arm: (token) => armed.push(token),
    lift: (reason) => lifts.push(reason),
    nextToken: () => ++tokens,
  });

beforeEach(() => {
  vi.useFakeTimers();
  armed = [];
  lifts = [];
});
afterEach(() => {
  vi.useRealTimers();
});

it("waits for the presented answer carrying the armed token, then lifts once", () => {
  const g = gate();
  // Nothing armed yet: an answer (an older canvas's) is ignored.
  g.presented(tokens + 1, "presented");
  expect(lifts).toEqual([]);
  g.contentReady();
  g.contentReady(); // armed once
  expect(armed).toEqual([41]);
  g.presented(40, "presented"); // another token
  vi.advanceTimersByTime(COVER_PRESENT_TIMEOUT_MS - 1);
  expect(lifts).toEqual([]);
  g.presented(41, "presented");
  expect(lifts).toEqual(["presented"]);
  g.presented(41, "presented");
  vi.advanceTimersByTime(COVER_HARD_MAX_MS);
  expect(lifts).toEqual(["presented"]); // no timer lifts again
});

it("a probe that could not tell lifts at once; no answer lifts at the present timeout", () => {
  const a = gate();
  a.contentReady();
  a.presented(armed[0], "timeout");
  expect(lifts).toEqual(["probe-failed"]);
  lifts = [];
  const b = gate();
  b.contentReady();
  vi.advanceTimersByTime(COVER_PRESENT_TIMEOUT_MS);
  expect(lifts).toEqual(["present-timeout"]);
});

it("round 3: a frame copied but not confirmed on the display lifts at once, told apart; only composite evidence is 'presented'", () => {
  const a = gate();
  a.contentReady();
  // The native probe waits for the composite before answering: no lift
  // meanwhile (well inside the present timeout).
  vi.advanceTimersByTime(600);
  expect(lifts).toEqual([]);
  a.presented(armed[0], "unlatched");
  expect(lifts).toEqual(["presented-unconfirmed"]);
  lifts = [];
  const b = gate();
  b.contentReady();
  b.presented(armed[1], "detached");
  expect(lifts).toEqual(["probe-failed"]);
  lifts = [];
  const c = gate();
  c.contentReady();
  c.presented(armed[2], "presented");
  expect(lifts).toEqual(["presented"]);
});

it("never sticks: content that never records lifts at the hard cap from mount", () => {
  const g = gate();
  vi.advanceTimersByTime(COVER_HARD_MAX_MS - 1);
  expect(lifts).toEqual([]);
  vi.advanceTimersByTime(1);
  expect(lifts).toEqual(["cap"]);
  // Late content after the cap arms nothing.
  g.contentReady();
  expect(armed).toEqual([]);
});

it("the cap also bounds a late arm (armed just before the cap)", () => {
  const g = gate();
  vi.advanceTimersByTime(COVER_HARD_MAX_MS - 100);
  g.contentReady();
  vi.advanceTimersByTime(100);
  expect(lifts).toEqual(["cap"]);
});

it("an unmounted canvas's gate lifts nothing", () => {
  const g = gate();
  g.contentReady();
  g.dispose();
  g.presented(armed[0], "presented");
  vi.advanceTimersByTime(COVER_HARD_MAX_MS * 2);
  expect(lifts).toEqual([]);
});

it("tokens are positive and fresh", () => {
  const a = nextPresentToken();
  const b = nextPresentToken();
  expect(a).toBeGreaterThan(0);
  expect(b).not.toBe(a);
});
